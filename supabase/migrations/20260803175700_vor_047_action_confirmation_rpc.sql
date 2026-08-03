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
  v_draft public.ask_vorta_action_drafts;
  v_changes jsonb;
  v_result jsonb;
  v_result_id uuid;
begin
  select * into v_draft
  from public.ask_vorta_action_drafts draft_row
  where draft_row.id = p_draft_id
    and draft_row.user_id = v_actor
  for update;

  if v_draft.id is null
     or not private.vorta_ask_vorta_can_manage(v_draft.site_id) then
    raise exception 'Ask Vorta action draft was not found.' using errcode = '42501';
  end if;

  if v_draft.status = 'confirmed' then
    insert into public.ask_vorta_action_events (
      draft_id,
      site_id,
      actor_id,
      event_type,
      action_kind,
      target_type,
      target_id,
      draft_version,
      event_payload
    ) values (
      v_draft.id,
      v_draft.site_id,
      v_actor,
      'idempotent_replay',
      v_draft.action_kind,
      v_draft.target_type,
      v_draft.target_id,
      v_draft.version,
      jsonb_build_object('operation', 'confirm')
    );
    return private.vorta_ask_vorta_action_draft_json(v_draft);
  end if;

  if v_draft.status <> 'draft' then
    raise exception 'Only draft actions can be confirmed.' using errcode = '55000';
  end if;
  if v_draft.version <> p_expected_version then
    raise exception 'Action draft changed before confirmation. Refresh and retry.'
      using errcode = '40001';
  end if;
  if not v_draft.supported
     or v_draft.action_kind <> 'handover_note'
     or v_draft.target_type <> 'work_order'
     or v_draft.target_id is null then
    raise exception 'Only a Vorta shift-handover action can be confirmed.'
      using errcode = '0A000';
  end if;

  v_changes := v_draft.proposed_changes;

  begin
    if not exists (
      select 1
      from public.work_orders work_order
      where work_order.id = v_draft.target_id
        and work_order.site_id = v_draft.site_id
        and work_order.technical_completion_at is null
        and work_order.business_completion_at is null
        and upper(coalesce(work_order.status, '')) not in (
          'COMPLETED', 'CLOSED', 'TECO', 'CLSD', 'CANCELLED'
        )
        and not (
          coalesce(work_order.system_status_codes, array[]::text[])
          && array['TECO', 'CLSD']::text[]
        )
    ) then
      raise exception 'The target work order is no longer eligible for handover.'
        using errcode = '55000';
    end if;

    if nullif(btrim(v_changes ->> 'windowStart'), '') is null
       or nullif(btrim(v_changes ->> 'windowEnd'), '') is null
       or nullif(btrim(v_changes ->> 'outgoingNote'), '') is null
       or nullif(btrim(v_changes ->> 'nextAction'), '') is null
       or nullif(btrim(v_changes ->> 'ownerName'), '') is null
       or nullif(btrim(v_changes ->> 'dueAt'), '') is null
       or nullif(btrim(v_changes ->> 'expectedVersion'), '') is null then
      raise exception 'The handover draft is incomplete.' using errcode = '55000';
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
      (v_changes ->> 'expectedVersion')::integer
    );

    v_result_id := nullif(v_result ->> 'id', '')::uuid;
    if v_result_id is null then
      raise exception 'The handover action could not be verified after confirmation.'
        using errcode = '55000';
    end if;

    update public.ask_vorta_action_drafts
    set status = 'confirmed',
        confirmed_by = v_actor,
        confirmed_at = now(),
        reviewed_at = now(),
        result_type = 'shift_handover_action',
        result_id = v_result_id,
        result_payload = v_result,
        failure_reason = null,
        version = version + 1,
        updated_at = now()
    where id = v_draft.id
    returning * into v_draft;

    insert into public.ask_vorta_action_events (
      draft_id,
      site_id,
      actor_id,
      event_type,
      action_kind,
      target_type,
      target_id,
      draft_version,
      event_payload
    ) values (
      v_draft.id,
      v_draft.site_id,
      v_actor,
      'confirmed',
      'handover_note',
      'work_order',
      v_draft.target_id,
      v_draft.version,
      jsonb_build_object(
        'resultType', 'shift_handover_action',
        'resultId', v_result_id,
        'result', v_result,
        'sapChanged', false
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
      draft_id,
      site_id,
      actor_id,
      event_type,
      action_kind,
      target_type,
      target_id,
      draft_version,
      event_payload
    ) values (
      v_draft.id,
      v_draft.site_id,
      v_actor,
      'failed',
      v_draft.action_kind,
      v_draft.target_type,
      v_draft.target_id,
      v_draft.version,
      jsonb_build_object(
        'error', left(sqlerrm, 1000),
        'sourceChanged', false,
        'sapChanged', false
      )
    );
  end;

  return private.vorta_ask_vorta_action_draft_json(v_draft);
end;
$function$;

revoke all on function public.vorta_confirm_ask_vorta_action(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.vorta_confirm_ask_vorta_action(uuid, integer)
  to authenticated, service_role;

comment on function public.vorta_confirm_ask_vorta_action(uuid, integer)
  is 'Confirms one owned Vorta shift-handover draft through the existing guarded handover RPC. It never changes SAP or creates SAP-equivalent records.';

notify pgrst, 'reload schema';
