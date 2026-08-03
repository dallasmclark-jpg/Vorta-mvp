create or replace function public.vorta_confirm_ask_vorta_action(
  p_draft_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_draft public.ask_vorta_action_drafts;
  v_changes jsonb;
  v_result jsonb;
  v_result_id uuid;
  v_result_type text;
  v_notification public.maintenance_notifications;
  v_stock_task public.spare_stock_review_tasks;
  v_component public.equipment_components;
  v_priority_code text;
  v_priority_description text;
  v_notification_number text;
begin
  select * into v_draft
  from public.ask_vorta_action_drafts draft_row
  where draft_row.id = p_draft_id
    and draft_row.user_id = v_actor
  for update;

  if v_draft.id is null or not private.vorta_ask_vorta_can_manage(v_draft.site_id) then
    raise exception 'Ask Vorta action draft was not found.' using errcode = '42501';
  end if;
  if v_draft.status = 'confirmed' then
    insert into public.ask_vorta_action_events (
      draft_id, site_id, actor_id, event_type, action_kind,
      target_type, target_id, draft_version, event_payload
    ) values (
      v_draft.id, v_draft.site_id, v_actor, 'idempotent_replay',
      v_draft.action_kind, v_draft.target_type, v_draft.target_id,
      v_draft.version, jsonb_build_object('operation', 'confirm')
    );
    return private.vorta_ask_vorta_action_draft_json(v_draft);
  end if;
  if v_draft.status <> 'draft' then
    raise exception 'Only draft actions can be confirmed.' using errcode = '55000';
  end if;
  if not v_draft.supported or v_draft.action_kind = 'read_only' then
    raise exception 'This Ask Vorta draft is read-only and cannot be applied.' using errcode = '0A000';
  end if;
  if v_draft.version <> p_expected_version then
    raise exception 'Action draft changed before confirmation. Refresh and retry.' using errcode = '40001';
  end if;

  v_changes := v_draft.proposed_changes;
  select coalesce(nullif(btrim(profile.full_name), ''), v_actor::text)
  into v_actor_name
  from public.profiles profile
  where profile.id = v_actor;
  v_actor_name := coalesce(v_actor_name, v_actor::text);

  begin
    if v_draft.action_kind = 'handover_note' then
      if not exists (
        select 1 from public.work_orders work_order
        where work_order.id = v_draft.target_id
          and work_order.site_id = v_draft.site_id
          and work_order.technical_completion_at is null
          and work_order.business_completion_at is null
          and upper(coalesce(work_order.status, '')) not in ('COMPLETED', 'CLOSED', 'TECO', 'CLSD')
          and not (coalesce(work_order.system_status_codes, array[]::text[]) && array['TECO', 'CLSD']::text[])
      ) then
        raise exception 'The target work order is no longer eligible for handover.' using errcode = '55000';
      end if;

      v_result := public.vorta_save_shift_handover_action(
        v_draft.site_id,
        v_draft.target_id,
        (v_changes ->> 'windowStart')::timestamptz,
        (v_changes ->> 'windowEnd')::timestamptz,
        v_changes ->> 'outgoingNote',
        v_changes ->> 'nextAction',
        v_changes ->> 'ownerName',
        (v_changes ->> 'dueAt')::timestamptz,
        coalesce((v_changes ->> 'expectedVersion')::integer, 0)
      );
      v_result_id := (v_result ->> 'id')::uuid;
      v_result_type := 'shift_handover_action';

    elsif v_draft.action_kind = 'work_request' then
      if not exists (
        select 1 from public.equipment_assets asset
        where asset.id = v_draft.target_id
          and asset.site_id = v_draft.site_id
      ) then
        raise exception 'The target equipment is no longer available in the active site.' using errcode = '55000';
      end if;

      v_priority_code := upper(coalesce(
        nullif(btrim(v_changes ->> 'priorityCode'), ''),
        case v_draft.priority
          when 'now' then '1'
          when 'before_shift' then '2'
          when 'this_week' then '3'
          else '4'
        end
      ));
      if v_priority_code not in ('1', '2', '3', '4') then
        raise exception 'Work request priority code changed to an unsupported value.' using errcode = '55000';
      end if;
      v_priority_description := case v_priority_code
        when '1' then 'Critical'
        when '2' then 'High'
        when '3' then 'Medium'
        else 'Low'
      end;
      v_notification_number := 'VQ-' || upper(substr(replace(v_draft.id::text, '-', ''), 1, 12));

      insert into public.maintenance_notifications (
        site_id, equipment_id, notification_number,
        notification_type_code, notification_type_description,
        short_text, long_text, priority_code, priority_description,
        status, malfunction_start_at, breakdown_indicator, reported_by,
        required_start_date, required_end_date, planner_group,
        main_work_center, source_system, source_record_key,
        source_created_at, source_updated_at, workflow_status,
        risk_points, risk_reason
      ) values (
        v_draft.site_id, v_draft.target_id, v_notification_number,
        'VQ', 'Ask Vorta maintenance work request',
        btrim(v_changes ->> 'shortText'),
        nullif(btrim(v_changes ->> 'longText'), ''),
        v_priority_code, v_priority_description,
        'OPEN',
        nullif(v_changes ->> 'malfunctionStartAt', '')::timestamptz,
        coalesce((v_changes ->> 'breakdownIndicator')::boolean, false),
        v_actor_name,
        nullif(v_changes ->> 'requiredStartDate', '')::date,
        nullif(v_changes ->> 'requiredEndDate', '')::date,
        nullif(btrim(v_changes ->> 'plannerGroup'), ''),
        nullif(btrim(v_changes ->> 'mainWorkCenter'), ''),
        'ask_vorta', v_draft.id::text,
        now(), now(), 'AWAITING_WORK_ORDER',
        case v_priority_code when '1' then 25 when '2' then 15 when '3' then 8 else 3 end,
        btrim(v_draft.expected_impact)
      )
      on conflict (site_id, lower(btrim(source_system)), lower(btrim(source_record_key)))
        where source_record_key is not null
      do nothing;

      select * into v_notification
      from public.maintenance_notifications notification_row
      where notification_row.site_id = v_draft.site_id
        and lower(btrim(notification_row.source_system)) = 'ask_vorta'
        and lower(btrim(notification_row.source_record_key)) = lower(v_draft.id::text);
      if v_notification.id is null then
        raise exception 'Maintenance work request could not be verified after creation.' using errcode = '55000';
      end if;
      v_result_id := v_notification.id;
      v_result_type := 'maintenance_notification';
      v_result := jsonb_build_object(
        'id', v_notification.id,
        'notificationNumber', v_notification.notification_number,
        'equipmentId', v_notification.equipment_id,
        'shortText', v_notification.short_text,
        'priorityCode', v_notification.priority_code,
        'status', v_notification.status,
        'workflowStatus', v_notification.workflow_status,
        'createdAt', v_notification.created_at
      );

    elsif v_draft.action_kind = 'spare_stock_review' then
      select * into v_component
      from public.equipment_components component
      where component.id = v_draft.target_id
        and component.site_id = v_draft.site_id;
      if v_component.id is null then
        raise exception 'The target spare component is no longer available in the active site.' using errcode = '55000';
      end if;

      insert into public.spare_stock_review_tasks (
        site_id, component_id, source_draft_id, requested_quantity,
        reason, owner_name, due_at, status, component_snapshot,
        created_by, updated_at
      ) values (
        v_draft.site_id, v_component.id, v_draft.id,
        nullif(v_changes ->> 'requestedQuantity', '')::numeric,
        btrim(v_changes ->> 'reason'),
        coalesce(nullif(btrim(v_changes ->> 'ownerName'), ''), v_draft.owner),
        nullif(v_changes ->> 'dueAt', '')::timestamptz,
        'open',
        jsonb_build_object(
          'componentCode', v_component.component_code,
          'componentName', v_component.component_name,
          'availableQuantity', v_component.quantity_available,
          'minimumQuantity', v_component.minimum_quantity,
          'targetQuantity', v_component.quantity_target,
          'availabilityStatus', v_component.availability_status,
          'leadDays', v_component.lead_days,
          'criticality', v_component.criticality
        ),
        v_actor, now()
      )
      on conflict (source_draft_id) do nothing;

      select * into v_stock_task
      from public.spare_stock_review_tasks task_row
      where task_row.source_draft_id = v_draft.id;
      if v_stock_task.id is null then
        raise exception 'Spare stock review task could not be verified after creation.' using errcode = '55000';
      end if;
      v_result_id := v_stock_task.id;
      v_result_type := 'spare_stock_review_task';
      v_result := jsonb_build_object(
        'id', v_stock_task.id,
        'componentId', v_stock_task.component_id,
        'requestedQuantity', v_stock_task.requested_quantity,
        'reason', v_stock_task.reason,
        'ownerName', v_stock_task.owner_name,
        'dueAt', v_stock_task.due_at,
        'status', v_stock_task.status,
        'componentSnapshot', v_stock_task.component_snapshot,
        'createdAt', v_stock_task.created_at
      );
    else
      raise exception 'This Ask Vorta action kind is not supported.' using errcode = '0A000';
    end if;

    update public.ask_vorta_action_drafts
    set status = 'confirmed',
        confirmed_by = v_actor,
        confirmed_at = now(),
        reviewed_at = now(),
        result_type = v_result_type,
        result_id = v_result_id,
        result_payload = v_result,
        failure_reason = null,
        version = version + 1,
        updated_at = now()
    where id = v_draft.id
    returning * into v_draft;

    insert into public.ask_vorta_action_events (
      draft_id, site_id, actor_id, event_type, action_kind,
      target_type, target_id, draft_version, event_payload
    ) values (
      v_draft.id, v_draft.site_id, v_actor, 'confirmed', v_draft.action_kind,
      v_draft.target_type, v_draft.target_id, v_draft.version,
      jsonb_build_object(
        'resultType', v_result_type,
        'resultId', v_result_id,
        'result', v_result
      )
    );

  exception when others then
    update public.ask_vorta_action_drafts
    set status = 'failed',
        failure_reason = left(sqlerrm, 1000),
        reviewed_at = now(),
        version = version + 1,
        updated_at = now()
    where id = v_draft.id
    returning * into v_draft;

    insert into public.ask_vorta_action_events (
      draft_id, site_id, actor_id, event_type, action_kind,
      target_type, target_id, draft_version, event_payload
    ) values (
      v_draft.id, v_draft.site_id, v_actor, 'failed', v_draft.action_kind,
      v_draft.target_type, v_draft.target_id, v_draft.version,
      jsonb_build_object('error', left(sqlerrm, 1000))
    );
  end;

  return private.vorta_ask_vorta_action_draft_json(v_draft);
end;
$function$;

revoke all on function public.vorta_confirm_ask_vorta_action(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.vorta_confirm_ask_vorta_action(uuid, integer)
  to authenticated, service_role;

comment on function public.vorta_confirm_ask_vorta_action(uuid, integer)
  is 'Confirms one owned Ask Vorta draft through an action-specific guarded workflow and records an immutable audit event.';

notify pgrst, 'reload schema';
