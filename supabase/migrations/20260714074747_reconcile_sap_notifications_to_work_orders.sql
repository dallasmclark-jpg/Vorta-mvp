-- Read-only SAP notification/work-order reconciliation for Equipment Notifications.
-- Audit note: Vorta derives workflow state from imported SAP notification rows
-- and imported SAP work orders that carry the SAP notification reference. No
-- Vorta-owned workflow status, mutation RPC, assignment, comment, conversion or
-- closure field is introduced here; SAP remains the system of record.

alter table if exists public.work_orders
  add column if not exists sap_notification_number text;

comment on column public.work_orders.sap_notification_number is
  'Imported SAP notification number referenced by this SAP work order. Used only for read-only reconciliation.';

create or replace function public.vorta_get_equipment_notifications(p_equipment_id text)
returns table (
  notification_id text,
  notification_number text,
  notification_type_code text,
  notification_type_description text,
  source_status text,
  priority_code text,
  priority_description text,
  short_text text,
  long_text text,
  reported_at timestamptz,
  required_start_date date,
  required_end_date date,
  reported_by text,
  breakdown_indicator boolean,
  age_days integer,
  workflow_status text,
  linked_work_order_number text,
  linked_work_order_status text,
  linked_work_order_priority text,
  linked_work_order_due_date date,
  linked_work_order_overdue boolean,
  risk_points integer,
  risk_reason text,
  converted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
with notification_source as (
  select
    n.id::text as notification_id,
    n.notification_number::text as notification_number,
    n.notification_type_code::text as notification_type_code,
    n.notification_type_description::text as notification_type_description,
    coalesce(n.source_status, n.status, 'OPEN')::text as source_status,
    n.priority_code::text as priority_code,
    n.priority_description::text as priority_description,
    coalesce(n.short_text, 'Maintenance notification')::text as short_text,
    n.long_text::text as long_text,
    coalesce(n.reported_at, n.created_at)::timestamptz as reported_at,
    n.required_start_date::date as required_start_date,
    n.required_end_date::date as required_end_date,
    n.reported_by::text as reported_by,
    coalesce(n.breakdown_indicator, false)::boolean as breakdown_indicator,
    coalesce(e.criticality, e.risk_level, '')::text as equipment_criticality
  from public.equipment_notifications n
  left join public.equipment e on e.id::text = n.equipment_id::text
  where n.equipment_id::text = p_equipment_id
), linked_work_orders as (
  select distinct on (wo.sap_notification_number)
    wo.sap_notification_number::text as notification_number,
    coalesce(wo.wo_number, wo.id::text)::text as work_order_number,
    wo.status::text as work_order_status,
    wo.priority::text as work_order_priority,
    wo.due_date::date as work_order_due_date,
    coalesce(wo.is_overdue, wo.due_date::date < current_date, false)::boolean as work_order_overdue,
    coalesce(wo.requested_date, wo.created_at)::timestamptz as converted_at
  from public.work_orders wo
  where wo.equipment_id::text = p_equipment_id
    and nullif(trim(wo.sap_notification_number), '') is not null
  order by wo.sap_notification_number, coalesce(wo.requested_date, wo.created_at) desc nulls last
), reconciled as (
  select
    n.*,
    wo.work_order_number,
    wo.work_order_status,
    wo.work_order_priority,
    wo.work_order_due_date,
    wo.work_order_overdue,
    wo.converted_at,
    (
      wo.work_order_number is null
      and upper(n.source_status) ~ '(CLOSED|COMPLETE|COMPLETED|CLSD|TECO|NOCO)'
    ) as closed_without_work
  from notification_source n
  left join linked_work_orders wo
    on wo.notification_number = n.notification_number
), derived as (
  select
    r.*,
    case
      when r.work_order_number is not null then 'CONVERTED'
      when r.closed_without_work then 'CLOSED_WITHOUT_WORK'
      else 'AWAITING_WORK_ORDER'
    end as derived_workflow_status,
    greatest(0, (current_date - coalesce(r.reported_at::date, current_date)))::integer as derived_age_days
  from reconciled r
), risked as (
  select
    d.*,
    case when d.derived_workflow_status = 'AWAITING_WORK_ORDER' then
      least(100,
        15
        + case when upper(coalesce(d.priority_description, d.priority_code, '')) in ('HIGH', 'H', '1') then 25
               when upper(coalesce(d.priority_description, d.priority_code, '')) in ('CRITICAL', 'VERY HIGH', 'VH') then 35
               when upper(coalesce(d.priority_description, d.priority_code, '')) in ('MEDIUM', 'M', '2') then 15
               else 5 end
        + case when d.breakdown_indicator then 25 else 0 end
        + case when d.derived_age_days >= 30 then 25
               when d.derived_age_days >= 14 then 15
               when d.derived_age_days >= 7 then 10
               else 0 end
        + case when upper(d.equipment_criticality) in ('CRITICAL', 'HIGH') then 15 else 0 end
        + case when d.required_start_date is not null and d.required_start_date < current_date then 20 else 0 end
        + 10
      )
    else 0 end as derived_risk_points
  from derived d
)
select
  notification_id,
  notification_number,
  notification_type_code,
  notification_type_description,
  source_status,
  priority_code,
  priority_description,
  short_text,
  long_text,
  reported_at,
  required_start_date,
  required_end_date,
  reported_by,
  breakdown_indicator,
  derived_age_days as age_days,
  derived_workflow_status as workflow_status,
  work_order_number as linked_work_order_number,
  work_order_status as linked_work_order_status,
  work_order_priority as linked_work_order_priority,
  work_order_due_date as linked_work_order_due_date,
  work_order_overdue as linked_work_order_overdue,
  derived_risk_points as risk_points,
  case
    when derived_workflow_status = 'CONVERTED' then 'Notification reconciled to imported SAP work order; notification-specific unconverted risk removed.'
    when derived_workflow_status = 'CLOSED_WITHOUT_WORK' then 'SAP notification is closed/completed and no imported SAP work order references it.'
    else concat_ws('; ',
      'No imported SAP work order references this notification',
      case when breakdown_indicator then 'breakdown indicator set' end,
      case when required_start_date is not null and required_start_date < current_date then 'required start date overdue' end,
      case when derived_age_days > 0 then derived_age_days || ' days old' end,
      case when nullif(coalesce(priority_description, priority_code), '') is not null then 'SAP priority ' || coalesce(priority_description, priority_code) end
    )
  end as risk_reason,
  converted_at
from risked
order by
  case when derived_workflow_status = 'AWAITING_WORK_ORDER' then 0 else 1 end,
  derived_risk_points desc,
  derived_age_days desc;
$$;

create or replace function public.vorta_get_equipment_notification_summary(p_equipment_id text)
returns table (
  total_notifications integer,
  awaiting_work_order integer,
  converted_notifications integer,
  high_critical_awaiting integer,
  breakdown_awaiting integer,
  oldest_awaiting_days integer,
  notification_risk_score integer
)
language sql
stable
security definer
set search_path = public
as $$
with notifications as (
  select * from public.vorta_get_equipment_notifications(p_equipment_id)
)
select
  count(*)::integer as total_notifications,
  count(*) filter (where workflow_status = 'AWAITING_WORK_ORDER')::integer as awaiting_work_order,
  count(*) filter (where workflow_status = 'CONVERTED')::integer as converted_notifications,
  count(*) filter (
    where workflow_status = 'AWAITING_WORK_ORDER'
      and upper(coalesce(priority_description, priority_code, '')) in ('HIGH', 'CRITICAL', 'H', '1')
  )::integer as high_critical_awaiting,
  count(*) filter (where workflow_status = 'AWAITING_WORK_ORDER' and breakdown_indicator)::integer as breakdown_awaiting,
  coalesce(max(age_days) filter (where workflow_status = 'AWAITING_WORK_ORDER'), 0)::integer as oldest_awaiting_days,
  coalesce(max(risk_points) filter (where workflow_status = 'AWAITING_WORK_ORDER'), 0)::integer as notification_risk_score
from notifications;
$$;

grant execute on function public.vorta_get_equipment_notifications(text) to authenticated;
grant execute on function public.vorta_get_equipment_notification_summary(text) to authenticated;
