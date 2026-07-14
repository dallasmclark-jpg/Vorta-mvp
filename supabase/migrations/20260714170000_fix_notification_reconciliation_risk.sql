create or replace function public.vorta_get_equipment_notifications_internal(
  p_equipment_id uuid
)
returns table (
  notification_id uuid,
  notification_number text,
  notification_type_code text,
  notification_type_description text,
  short_text text,
  long_text text,
  priority_code text,
  priority_description text,
  source_status text,
  workflow_status text,
  breakdown_indicator boolean,
  reported_by text,
  required_start_date date,
  required_end_date date,
  reported_at timestamptz,
  age_days integer,
  risk_points integer,
  risk_reason text,
  linked_work_order_number text,
  linked_work_order_status text,
  converted_at timestamptz
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  with reconciled as (
    select
      notification.*,
      linked.wo_number,
      linked.work_order_status,
      linked.linked_at
    from public.maintenance_notifications notification
    join public.equipment_assets equipment
      on equipment.id = notification.equipment_id
     and equipment.site_id = notification.site_id
    left join lateral (
      select
        work_order.wo_number,
        work_order.status as work_order_status,
        coalesce(
          link.source_updated_at,
          link.updated_at,
          link.created_at,
          work_order.source_updated_at,
          work_order.updated_at,
          work_order.created_at
        ) as linked_at
      from public.maintenance_order_notification_links link
      join public.work_orders work_order
        on work_order.id = link.work_order_id
       and work_order.site_id = notification.site_id
       and work_order.equipment_id = notification.equipment_id
      where link.maintenance_notification_id = notification.id
        and link.site_id = notification.site_id
      order by
        coalesce(link.is_primary_notification, false) desc,
        case
          when upper(coalesce(work_order.status, '')) in (
            'COMPLETED',
            'CLOSED',
            'TECO',
            'CLSD'
          ) then 1
          else 0
        end,
        work_order.updated_at desc nulls last
      limit 1
    ) linked on true
    where notification.equipment_id = p_equipment_id
  ),
  derived as (
    select
      reconciled.*,
      case
        when reconciled.wo_number is not null then 'CONVERTED'
        when upper(coalesce(reconciled.status, '')) in (
          'CLOSED',
          'COMPLETE',
          'COMPLETED'
        ) or exists (
          select 1
          from unnest(
            coalesce(reconciled.system_status_codes, '{}'::text[])
          ) status_code
          where upper(status_code) in ('NOCO', 'CLSD')
        ) then 'CLOSED_WITHOUT_WORK'
        else 'AWAITING_WORK_ORDER'
      end as derived_workflow_status
    from reconciled
  )
  select
    derived.id,
    derived.notification_number,
    derived.notification_type_code,
    derived.notification_type_description,
    derived.short_text,
    derived.long_text,
    derived.priority_code,
    derived.priority_description,
    derived.status,
    derived.derived_workflow_status,
    derived.breakdown_indicator,
    derived.reported_by,
    derived.required_start_date,
    derived.required_end_date,
    coalesce(derived.source_created_at, derived.created_at),
    greatest(
      current_date
      - coalesce(derived.source_created_at, derived.created_at)::date,
      0
    )::integer,
    case
      when derived.derived_workflow_status = 'AWAITING_WORK_ORDER'
        then derived.risk_points
      else 0
    end,
    case
      when derived.derived_workflow_status = 'AWAITING_WORK_ORDER'
        then derived.risk_reason
      else null
    end,
    derived.wo_number,
    derived.work_order_status,
    case
      when derived.derived_workflow_status = 'CONVERTED'
        then coalesce(derived.converted_at, derived.linked_at)
      else derived.converted_at
    end
  from derived
  order by
    case derived.derived_workflow_status
      when 'AWAITING_WORK_ORDER' then 1
      when 'CONVERTED' then 2
      else 3
    end,
    case
      when derived.derived_workflow_status = 'AWAITING_WORK_ORDER'
        then derived.risk_points
      else 0
    end desc,
    coalesce(derived.source_created_at, derived.created_at) desc;
$function$;

create or replace function public.vorta_get_equipment_notification_summary(
  p_equipment_id uuid
)
returns table (
  total_notifications integer,
  awaiting_work_order integer,
  converted_notifications integer,
  high_critical_awaiting integer,
  breakdown_awaiting integer,
  oldest_awaiting_days integer,
  notification_risk_score integer
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  if not private.vorta_rls_has_equipment_access(
    p_equipment_id,
    false
  ) then
    return;
  end if;

  return query
  with notifications as (
    select *
    from public.vorta_get_equipment_notifications_internal(
      p_equipment_id
    )
  )
  select
    count(*)::integer,
    count(*) filter (
      where workflow_status = 'AWAITING_WORK_ORDER'
    )::integer,
    count(*) filter (
      where workflow_status = 'CONVERTED'
    )::integer,
    count(*) filter (
      where workflow_status = 'AWAITING_WORK_ORDER'
        and (
          upper(coalesce(priority_description, '')) in (
            'CRITICAL',
            'HIGH'
          )
          or upper(coalesce(priority_code, '')) in (
            '1',
            '2',
            'P1',
            'P2',
            'CRITICAL',
            'HIGH'
          )
        )
    )::integer,
    count(*) filter (
      where workflow_status = 'AWAITING_WORK_ORDER'
        and breakdown_indicator
    )::integer,
    coalesce(
      max(age_days) filter (
        where workflow_status = 'AWAITING_WORK_ORDER'
      ),
      0
    )::integer,
    least(
      100,
      coalesce(
        sum(risk_points) filter (
          where workflow_status = 'AWAITING_WORK_ORDER'
        ),
        0
      )
    )::integer
  from notifications;
end;
$function$;

create or replace function public.vorta_notification_score(
  p_equipment_id uuid
)
returns integer
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select least(
    100,
    coalesce(sum(notification.risk_points), 0)
  )::integer
  from public.vorta_get_equipment_notifications_internal(
    p_equipment_id
  ) notification
  where notification.workflow_status = 'AWAITING_WORK_ORDER';
$function$;
