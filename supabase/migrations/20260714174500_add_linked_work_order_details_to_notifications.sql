drop function if exists public.vorta_get_equipment_notification_summary(uuid);
drop function if exists public.vorta_notification_score(uuid);
drop function if exists public.vorta_get_equipment_notifications(uuid);
drop function if exists public.vorta_get_equipment_notifications_internal(uuid);

create function public.vorta_get_equipment_notifications_internal(
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
  linked_work_order_priority text,
  linked_work_order_due_date date,
  linked_work_order_overdue boolean,
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
      linked.work_order_priority,
      linked.work_order_due_date,
      linked.work_order_overdue,
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
          work_order.priority,
          work_order.priority_code
        ) as work_order_priority,
        coalesce(
          work_order.due_date,
          work_order.basic_finish_date,
          work_order.scheduled_finish_at::date
        ) as work_order_due_date,
        (
          coalesce(work_order.is_overdue, false)
          or (
            coalesce(
              work_order.due_date,
              work_order.basic_finish_date,
              work_order.scheduled_finish_at::date
            ) < current_date
            and upper(coalesce(work_order.status, '')) not in (
              'COMPLETED',
              'CLOSED',
              'TECO',
              'CLSD'
            )
            and not exists (
              select 1
              from unnest(
                coalesce(work_order.system_status_codes, '{}'::text[])
              ) work_order_status_code
              where upper(work_order_status_code) in ('TECO', 'CLSD')
            )
          )
        ) as work_order_overdue,
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
          ) or exists (
            select 1
            from unnest(
              coalesce(work_order.system_status_codes, '{}'::text[])
            ) work_order_status_code
            where upper(work_order_status_code) in ('TECO', 'CLSD')
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
          ) notification_status_code
          where upper(notification_status_code) in ('NOCO', 'CLSD')
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
    derived.work_order_priority,
    derived.work_order_due_date,
    coalesce(derived.work_order_overdue, false),
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

create function public.vorta_get_equipment_notifications(
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
  linked_work_order_priority text,
  linked_work_order_due_date date,
  linked_work_order_overdue boolean,
  converted_at timestamptz
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
  select *
  from public.vorta_get_equipment_notifications_internal(
    p_equipment_id
  );
end;
$function$;

create function public.vorta_get_equipment_notification_summary(
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
      where notifications.workflow_status = 'AWAITING_WORK_ORDER'
    )::integer,
    count(*) filter (
      where notifications.workflow_status = 'CONVERTED'
    )::integer,
    count(*) filter (
      where notifications.workflow_status = 'AWAITING_WORK_ORDER'
        and (
          upper(coalesce(notifications.priority_description, '')) in (
            'CRITICAL',
            'HIGH'
          )
          or upper(coalesce(notifications.priority_code, '')) in (
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
      where notifications.workflow_status = 'AWAITING_WORK_ORDER'
        and notifications.breakdown_indicator
    )::integer,
    coalesce(
      max(notifications.age_days) filter (
        where notifications.workflow_status = 'AWAITING_WORK_ORDER'
      ),
      0
    )::integer,
    least(
      100,
      coalesce(
        sum(notifications.risk_points) filter (
          where notifications.workflow_status = 'AWAITING_WORK_ORDER'
        ),
        0
      )
    )::integer
  from notifications;
end;
$function$;

create function public.vorta_notification_score(
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

revoke all on function public.vorta_get_equipment_notifications_internal(uuid)
  from public, anon, authenticated;
grant execute on function public.vorta_get_equipment_notifications_internal(uuid)
  to service_role;

revoke all on function public.vorta_get_equipment_notifications(uuid)
  from public, anon;
grant execute on function public.vorta_get_equipment_notifications(uuid)
  to authenticated, service_role;

revoke all on function public.vorta_get_equipment_notification_summary(uuid)
  from public, anon;
grant execute on function public.vorta_get_equipment_notification_summary(uuid)
  to authenticated, service_role;

revoke all on function public.vorta_notification_score(uuid)
  from public, anon, authenticated;
grant execute on function public.vorta_notification_score(uuid)
  to service_role;
