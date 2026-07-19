-- Consume effective due states in work-order payloads and risk counts.

create or replace function public.vorta_get_equipment_work_items_internal(p_equipment_id uuid)
returns table(
  work_order_id uuid,
  work_order_number text,
  description text,
  priority text,
  work_type text,
  status text,
  assigned_engineer text,
  requested_date date,
  due_date date,
  completed_date date,
  age_label text,
  is_overdue boolean,
  preventive_maintenance_id uuid,
  pm_number text,
  pm_title text,
  pm_type text,
  pm_status text,
  pm_next_due_date date,
  notification_number text,
  order_type_code text,
  order_type_description text,
  order_origin text
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select
    work_order.id,
    work_order.wo_number,
    work_order.description,
    work_order.priority,
    work_order.work_type,
    work_order.status,
    work_order.assigned_engineer,
    work_order.requested_date,
    work_order.due_date,
    work_order.completed_date,
    work_order.age_label,
    public.vorta_work_order_is_overdue(work_order.status, work_order.due_date),
    pm.id,
    pm.pm_number,
    pm.title,
    pm.pm_type,
    case
      when pm.id is null then null
      else public.vorta_effective_pm_status(pm.status, pm.next_due_date)
    end,
    pm.next_due_date,
    work_order.primary_notification_number,
    work_order.order_type_code,
    work_order.order_type_description,
    work_order.order_origin
  from public.work_orders work_order
  left join public.preventive_maintenance pm
    on pm.id = work_order.preventive_maintenance_id
  where work_order.equipment_id = p_equipment_id
  order by
    case when upper(work_order.status) = 'COMPLETED' then 2 else 1 end,
    case upper(work_order.priority)
      when 'CRITICAL' then 1
      when 'HIGH' then 2
      when 'MEDIUM' then 3
      else 4
    end,
    work_order.due_date nulls last,
    work_order.wo_number;
$$;

create or replace function public.vorta_sync_equipment_risk_counts()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  affected integer;
begin
  update public.equipment_risk_profiles erp
  set
    overdue_pm_count = (
      select count(*)::int
      from public.preventive_maintenance pm
      where pm.equipment_id = erp.equipment_id
        and public.vorta_effective_pm_status(pm.status, pm.next_due_date) = 'OVERDUE'
        and lower(coalesce(pm.pm_type, '')) <> 'calibration'
    ),
    calibration_overdue_count = (
      select count(*)::int
      from public.preventive_maintenance pm
      where pm.equipment_id = erp.equipment_id
        and public.vorta_effective_pm_status(pm.status, pm.next_due_date) = 'OVERDUE'
        and lower(coalesce(pm.pm_type, '')) = 'calibration'
    ),
    open_work_order_count = (
      select count(*)::int
      from public.work_orders wo
      where wo.equipment_id = erp.equipment_id
        and upper(coalesce(wo.status, 'OPEN')) <> 'COMPLETED'
    ),
    repeat_breakdown_count = coalesce((
      select sum(repeated.recurrences)::int
      from (
        select greatest(count(*) - 1, 0) as recurrences
        from public.work_orders wo
        where wo.equipment_id = erp.equipment_id
          and upper(coalesce(wo.work_type, '')) = 'CORRECTIVE'
          and wo.requested_date >= current_date - 90
          and wo.fault_code is not null
        group by wo.fault_code
        having count(*) > 1
      ) repeated
    ), 0),
    single_point_skill_gap = exists (
      select 1
      from public.equipment_required_skills ers
      join public.equipment_assets req_asset on req_asset.id = ers.equipment_id
      where ers.equipment_id = erp.equipment_id
        and (
          select count(distinct es.engineer_id)
          from public.engineer_skills es
          join public.engineers eng on eng.id = es.engineer_id
          where es.skill_id = ers.skill_id
            and eng.site_id = req_asset.site_id
            and eng.verified = true
            and coalesce(es.validated_rating, es.manager_rating, 0) >= ers.required_level
            and (
              ers.validation_required = false
              or es.verification_status in ('validated', 'manager_review')
            )
            and es.verification_status not in ('expired', 'rejected')
            and (es.expiry_date is null or es.expiry_date >= current_date)
            and case ers.execution_authority
              when 'authoriser' then es.practice_authority = 'authoriser'
              when 'independent' then es.practice_authority in ('independent', 'authoriser')
              else true
            end
        ) < ers.minimum_qualified_engineers
    ),
    critical_spares_missing = (
      select count(*)::int
      from public.equipment_components ec
      where ec.equipment_id = erp.equipment_id
        and coalesce(ec.quantity_available, 0) <= 0
        and lower(ec.criticality) in ('critical', 'high')
    ),
    updated_at = now()
  where erp.equipment_id is not null;

  get diagnostics affected = row_count;
  return affected;
end;
$$;
