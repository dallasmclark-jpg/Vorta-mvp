-- Store site-capability resilience in the equipment risk profile. Current-shift
-- skill coverage remains available through the labour-risk functions.

create or replace function public.vorta_sync_equipment_risk_counts()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  affected integer;
begin
  update public.equipment_risk_profiles risk_profile
  set
    overdue_pm_count = (
      select count(*)::integer
      from public.preventive_maintenance maintenance
      where maintenance.equipment_id = risk_profile.equipment_id
        and public.vorta_effective_pm_status(
          maintenance.status,
          maintenance.next_due_date
        ) = 'OVERDUE'
        and lower(coalesce(maintenance.pm_type, '')) <> 'calibration'
    ),
    calibration_overdue_count = (
      select count(*)::integer
      from public.preventive_maintenance maintenance
      where maintenance.equipment_id = risk_profile.equipment_id
        and public.vorta_effective_pm_status(
          maintenance.status,
          maintenance.next_due_date
        ) = 'OVERDUE'
        and lower(coalesce(maintenance.pm_type, '')) = 'calibration'
    ),
    open_work_order_count = (
      select count(*)::integer
      from public.work_orders work_order
      where work_order.equipment_id = risk_profile.equipment_id
        and upper(coalesce(work_order.status, 'OPEN')) <> 'COMPLETED'
    ),
    repeat_breakdown_count = coalesce((
      select sum(repeated.recurrences)::integer
      from (
        select greatest(count(*) - 1, 0) as recurrences
        from public.work_orders work_order
        where work_order.equipment_id = risk_profile.equipment_id
          and upper(coalesce(work_order.work_type, '')) = 'CORRECTIVE'
          and work_order.requested_date >= current_date - 90
          and work_order.fault_code is not null
        group by work_order.fault_code
        having count(*) > 1
      ) repeated
    ), 0),
    single_point_skill_gap = exists (
      select 1
      from private.vorta_get_equipment_skill_resilience(
        risk_profile.equipment_id,
        current_date
      ) resilience
      where resilience.missing_skill_count > 0
        or resilience.below_minimum_skill_count > 0
        or resilience.single_person_skill_count > 0
    ),
    critical_spares_missing = (
      select count(*)::integer
      from public.equipment_components component
      where component.equipment_id = risk_profile.equipment_id
        and coalesce(component.quantity_available, 0) <= 0
        and lower(component.criticality) in ('critical', 'high')
    ),
    updated_at = now()
  where risk_profile.equipment_id is not null;

  get diagnostics affected = row_count;
  return affected;
end;
$function$;

do $migration$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
  v_asset_count integer;
  v_missing_assets integer;
  v_gap_assets integer;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform public.vorta_refresh_current_risk_internal();

  select
    count(*)::integer,
    count(*) filter (
      where resilience.missing_skill_count > 0
    )::integer,
    count(*) filter (
      where risk_profile.single_point_skill_gap
    )::integer
  into v_asset_count, v_missing_assets, v_gap_assets
  from public.equipment_assets equipment
  join public.equipment_risk_profiles risk_profile
    on risk_profile.equipment_id = equipment.id
  cross join lateral private.vorta_get_equipment_skill_resilience(
    equipment.id,
    current_date
  ) resilience
  where equipment.site_id = v_site_id;

  if v_missing_assets <> 0 then
    raise exception 'Canonical Wrexham skill resilience still has % assets with missing required skills',
      v_missing_assets;
  end if;

  if v_gap_assets <= 0 or v_gap_assets >= v_asset_count then
    raise exception 'Canonical Wrexham skill resilience did not produce a credible mixed distribution: % of % assets flagged',
      v_gap_assets,
      v_asset_count;
  end if;
end;
$migration$;
