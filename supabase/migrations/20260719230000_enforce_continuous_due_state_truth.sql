-- Keep date-derived maintenance states aligned as the calendar advances.
-- Stored source statuses remain useful import metadata, but active Maintenance
-- Manager reads and risk refreshes must not drift after midnight.

create or replace function private.vorta_normalise_due_states(
  p_site_id uuid,
  p_anchor_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_work_orders_updated integer := 0;
  v_pm_rows_updated integer := 0;
begin
  if p_site_id is null or p_anchor_date is null then
    return jsonb_build_object(
      'workOrdersUpdated', 0,
      'preventiveMaintenanceUpdated', 0,
      'anchorDate', p_anchor_date
    );
  end if;

  update public.work_orders work_order
  set is_overdue = (
    upper(coalesce(work_order.status, 'OPEN')) <> 'COMPLETED'
    and work_order.due_date is not null
    and work_order.due_date < p_anchor_date
  )
  from public.equipment_assets equipment
  where equipment.id = work_order.equipment_id
    and equipment.site_id = p_site_id
    and work_order.is_overdue is distinct from (
      upper(coalesce(work_order.status, 'OPEN')) <> 'COMPLETED'
      and work_order.due_date is not null
      and work_order.due_date < p_anchor_date
    );

  get diagnostics v_work_orders_updated = row_count;

  update public.preventive_maintenance maintenance
  set status = case
    when upper(coalesce(maintenance.status, '')) = 'COMPLETED' then 'COMPLETED'
    when maintenance.next_due_date is not null
      and maintenance.next_due_date < p_anchor_date then 'OVERDUE'
    when maintenance.next_due_date is not null
      and maintenance.next_due_date <= p_anchor_date + 14 then 'DUE SOON'
    when upper(coalesce(maintenance.status, '')) in ('OVERDUE', 'DUE SOON')
      then 'ON TRACK'
    else coalesce(nullif(maintenance.status, ''), 'PLANNED')
  end
  where maintenance.site_id = p_site_id
    and maintenance.status is distinct from case
      when upper(coalesce(maintenance.status, '')) = 'COMPLETED' then 'COMPLETED'
      when maintenance.next_due_date is not null
        and maintenance.next_due_date < p_anchor_date then 'OVERDUE'
      when maintenance.next_due_date is not null
        and maintenance.next_due_date <= p_anchor_date + 14 then 'DUE SOON'
      when upper(coalesce(maintenance.status, '')) in ('OVERDUE', 'DUE SOON')
        then 'ON TRACK'
      else coalesce(nullif(maintenance.status, ''), 'PLANNED')
    end;

  get diagnostics v_pm_rows_updated = row_count;

  return jsonb_build_object(
    'workOrdersUpdated', v_work_orders_updated,
    'preventiveMaintenanceUpdated', v_pm_rows_updated,
    'anchorDate', p_anchor_date,
    'completedAt', now()
  );
end;
$function$;

revoke all on function private.vorta_normalise_due_states(uuid, date)
  from public, anon, authenticated;
grant execute on function private.vorta_normalise_due_states(uuid, date)
  to service_role;

create or replace function public.vorta_get_equipment_calibrations_internal(
  p_equipment_id uuid
)
returns table(
  calibration_id uuid,
  calibration_number text,
  title text,
  calibration_point text,
  tolerance_specification text,
  last_completed_date date,
  next_due_date date,
  schedule_status text,
  criticality text,
  assigned_engineer text,
  procedure_reference text,
  checklist_reference text,
  last_result text,
  result_at timestamp with time zone,
  certificate_reference text,
  linked_work_order_number text,
  linked_work_order_status text,
  linked_work_order_due_date date,
  risk_state text
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  with calibration_rows as (
    select
      maintenance.*,
      public.vorta_effective_pm_status(
        maintenance.status,
        maintenance.next_due_date
      ) as effective_status
    from public.preventive_maintenance maintenance
    where maintenance.equipment_id = p_equipment_id
      and lower(coalesce(maintenance.pm_type, '')) = 'calibration'
  )
  select
    calibration.id,
    calibration.pm_number,
    calibration.title,
    calibration.calibration_point,
    calibration.tolerance_specification,
    calibration.last_completed_date,
    calibration.next_due_date,
    calibration.effective_status,
    calibration.criticality,
    calibration.assigned_engineer,
    calibration.procedure_ref,
    calibration.checklist_ref,
    calibration.last_calibration_result,
    calibration.calibration_result_at,
    calibration.certificate_reference,
    linked.wo_number,
    linked.work_order_status,
    linked.due_date,
    case
      when calibration.effective_status = 'OVERDUE' then 'OVERDUE'
      when calibration.effective_status = 'DUE SOON' then 'DUE SOON'
      when upper(coalesce(calibration.last_calibration_result, ''))
        in ('FAIL', 'FAILED', 'ADJUSTMENT REQUIRED') then 'RESULT RISK'
      else 'CONTROLLED'
    end
  from calibration_rows calibration
  left join lateral (
    select
      work_order.wo_number,
      work_order.status as work_order_status,
      work_order.due_date
    from public.work_orders work_order
    where work_order.preventive_maintenance_id = calibration.id
    order by
      case when upper(work_order.status) = 'COMPLETED' then 2 else 1 end,
      work_order.updated_at desc,
      work_order.wo_number
    limit 1
  ) linked on true
  order by
    case calibration.effective_status
      when 'OVERDUE' then 1
      when 'DUE SOON' then 2
      else 3
    end,
    calibration.next_due_date nulls last,
    calibration.pm_number;
$function$;

create or replace function public.vorta_refresh_current_risk_internal()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_request_role text := coalesce(auth.role(), 'anon');
  v_site_id uuid;
  v_actor_user_id uuid := auth.uid();
  v_correlation_id uuid := gen_random_uuid();
  v_started timestamp with time zone := clock_timestamp();
  v_duration_ms numeric(12,3);
  v_previous_site_risk numeric;
  v_previous_site_level text;
  v_current_site_risk numeric;
  v_current_site_level text;
  v_highest_area text;
  v_highest_area_score integer;
  v_total_assets integer;
  v_overdue_pm_count integer;
  v_calibration_backlog_count integer;
  v_critical_spares_missing integer;
  v_top_actions jsonb := '[]'::jsonb;
begin
  if v_request_role not in ('authenticated', 'service_role') then
    return 0;
  end if;

  select
    risk_profile.site_id,
    risk_profile.risk_score,
    risk_profile.risk_level
  into
    v_site_id,
    v_previous_site_risk,
    v_previous_site_level
  from public.site_risk_profile risk_profile
  where risk_profile.id = 1;

  if v_site_id is null then
    return 0;
  end if;

  perform private.vorta_normalise_due_states(v_site_id, current_date);
  perform public.vorta_recalculate_equipment_risk_profiles();
  perform public.vorta_sync_equipment_risk_counts();
  perform public.vorta_recalculate_area_risk_profiles();
  perform public.vorta_recalculate_site_risk_profile();
  perform public.vorta_sync_maintenance_risk_work_plan();

  select
    risk_profile.risk_score,
    risk_profile.risk_level,
    risk_profile.highest_area,
    risk_profile.highest_area_score,
    risk_profile.total_assets,
    risk_profile.overdue_pm_count,
    risk_profile.calibration_backlog_count,
    risk_profile.critical_spares_missing
  into
    v_current_site_risk,
    v_current_site_level,
    v_highest_area,
    v_highest_area_score,
    v_total_assets,
    v_overdue_pm_count,
    v_calibration_backlog_count,
    v_critical_spares_missing
  from public.site_risk_profile risk_profile
  where risk_profile.id = 1;

  select coalesce(plan.actions, '[]'::jsonb)
  into v_top_actions
  from public.vorta_get_site_risk_reduction_plan_internal() plan
  limit 1;

  v_duration_ms := round(
    (extract(epoch from clock_timestamp() - v_started) * 1000)::numeric,
    3
  );

  insert into private.vorta_operational_audit_events(
    correlation_id,
    site_id,
    actor_user_id,
    actor_role,
    event_type,
    event_status,
    source,
    duration_ms,
    details
  )
  values(
    v_correlation_id,
    v_site_id,
    v_actor_user_id,
    v_request_role,
    'risk_refresh',
    'success',
    case
      when v_request_role = 'service_role' then 'service_role'
      else 'authenticated_rpc'
    end,
    v_duration_ms,
    jsonb_build_object(
      'previousSiteRisk', v_previous_site_risk,
      'previousSiteLevel', v_previous_site_level,
      'currentSiteRisk', v_current_site_risk,
      'currentSiteLevel', v_current_site_level,
      'highestArea', v_highest_area,
      'highestAreaScore', v_highest_area_score,
      'totalAssets', v_total_assets,
      'overduePmCount', v_overdue_pm_count,
      'calibrationBacklogCount', v_calibration_backlog_count,
      'criticalSparesMissing', v_critical_spares_missing,
      'topActions', v_top_actions
    )
  );

  return 1;
end;
$function$;

-- Run the hourly refresh immediately after the date changes so stored source
-- labels are aligned before normal portal use begins.
select cron.alter_job(
  job_id := (
    select jobid
    from cron.job
    where jobname = 'vorta-risk-refresh-hourly'
  ),
  schedule := '1 * * * *'
);

comment on function private.vorta_normalise_due_states(uuid, date) is
  'Aligns stored work-order overdue flags and PM schedule labels to an explicit anchor date.';

comment on function public.vorta_get_equipment_calibrations_internal(uuid) is
  'Returns calibration schedule status derived from dates at read time.';

do $migration$
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform private.vorta_normalise_due_states(
    public.vorta_current_demo_site_id(),
    current_date
  );
  perform public.vorta_refresh_current_risk_internal();
end;
$migration$;
