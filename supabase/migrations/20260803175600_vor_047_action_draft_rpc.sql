create or replace function public.vorta_create_ask_vorta_action_draft(
  p_interaction_id uuid,
  p_site_id uuid,
  p_action_kind text,
  p_target_type text,
  p_target_id uuid,
  p_priority text,
  p_action text,
  p_owner text,
  p_expected_impact text,
  p_verification text,
  p_proposed_changes jsonb default '{}'::jsonb,
  p_evidence jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_kind text := lower(btrim(coalesce(p_action_kind, '')));
  v_target_type text := lower(btrim(coalesce(p_target_type, '')));
  v_priority text := lower(btrim(coalesce(p_priority, 'planned')));
  v_changes jsonb := coalesce(p_proposed_changes, '{}'::jsonb);
  v_evidence jsonb := coalesce(p_evidence, '{}'::jsonb);
  v_idempotency_key text;
  v_existing public.ask_vorta_action_drafts;
  v_saved public.ask_vorta_action_drafts;
begin
  if not private.vorta_ask_vorta_can_manage(p_site_id) then
    raise exception 'Maintenance Manager action access required.' using errcode = '42501';
  end if;

  if p_interaction_id is null or not exists (
    select 1
    from public.ask_vorta_interactions interaction_row
    where interaction_row.id = p_interaction_id
      and interaction_row.site_id = p_site_id
      and interaction_row.user_id = v_actor
      and interaction_row.status in ('completed', 'fallback')
  ) then
    raise exception 'A completed Ask Vorta response owned by the current user is required.'
      using errcode = '42501';
  end if;

  if v_kind <> 'handover_note' then
    raise exception 'Only a Vorta shift-handover action can be prepared.'
      using errcode = '0A000';
  end if;
  if v_target_type <> 'work_order' or p_target_id is null then
    raise exception 'An existing work order is required for a handover action.'
      using errcode = '22023';
  end if;
  if v_priority not in ('now', 'before_shift', 'this_week', 'planned') then
    raise exception 'Unsupported action priority.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_changes) <> 'object' or jsonb_typeof(v_evidence) <> 'object' then
    raise exception 'Proposed changes and evidence must be JSON objects.'
      using errcode = '22023';
  end if;
  if nullif(btrim(p_action), '') is null
     or nullif(btrim(p_owner), '') is null
     or nullif(btrim(p_expected_impact), '') is null
     or nullif(btrim(p_verification), '') is null then
    raise exception 'Action, owner, impact and verification are required.'
      using errcode = '22023';
  end if;
  if char_length(p_action) > 1200
     or char_length(p_owner) > 160
     or char_length(p_expected_impact) > 1200
     or char_length(p_verification) > 1200 then
    raise exception 'Action draft text exceeds the allowed length.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.work_orders work_order
    where work_order.id = p_target_id
      and work_order.site_id = p_site_id
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
    raise exception 'The target work order is not eligible for shift handover.'
      using errcode = '55000';
  end if;

  if nullif(btrim(v_changes ->> 'windowStart'), '') is null
     or nullif(btrim(v_changes ->> 'windowEnd'), '') is null
     or nullif(btrim(v_changes ->> 'outgoingNote'), '') is null
     or nullif(btrim(v_changes ->> 'nextAction'), '') is null
     or nullif(btrim(v_changes ->> 'ownerName'), '') is null
     or nullif(btrim(v_changes ->> 'dueAt'), '') is null
     or nullif(btrim(v_changes ->> 'expectedVersion'), '') is null then
    raise exception 'Handover window, notes, owner, due time and target version are required.'
      using errcode = '22023';
  end if;
  if (v_changes ->> 'windowStart')::timestamptz
     > (v_changes ->> 'windowEnd')::timestamptz then
    raise exception 'Handover window end must be after its start.'
      using errcode = '22023';
  end if;
  if (v_changes ->> 'expectedVersion')::integer < 0 then
    raise exception 'Handover target version is invalid.' using errcode = '22023';
  end if;
  if char_length(v_changes ->> 'outgoingNote') > 4000
     or char_length(v_changes ->> 'nextAction') > 4000
     or char_length(v_changes ->> 'ownerName') > 200 then
    raise exception 'Handover action text exceeds the allowed length.'
      using errcode = '22023';
  end if;

  v_idempotency_key := coalesce(
    nullif(btrim(p_idempotency_key), ''),
    md5(concat_ws(
      '|',
      v_actor::text,
      p_site_id::text,
      p_interaction_id::text,
      v_kind,
      p_target_id::text,
      v_changes::text
    ))
  );
  if char_length(v_idempotency_key) > 160 then
    raise exception 'Idempotency key exceeds the allowed length.'
      using errcode = '22023';
  end if;

  select * into v_existing
  from public.ask_vorta_action_drafts draft_row
  where draft_row.user_id = v_actor
    and draft_row.site_id = p_site_id
    and draft_row.idempotency_key = v_idempotency_key;

  if v_existing.id is not null then
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
      v_existing.id,
      v_existing.site_id,
      v_actor,
      'idempotent_replay',
      v_existing.action_kind,
      v_existing.target_type,
      v_existing.target_id,
      v_existing.version,
      jsonb_build_object('operation', 'create')
    );
    return private.vorta_ask_vorta_action_draft_json(v_existing);
  end if;

  insert into public.ask_vorta_action_drafts (
    interaction_id,
    site_id,
    user_id,
    priority,
    action,
    owner,
    expected_impact,
    verification,
    status,
    action_kind,
    target_type,
    target_id,
    proposed_changes,
    evidence,
    idempotency_key,
    version,
    supported,
    updated_at
  ) values (
    p_interaction_id,
    p_site_id,
    v_actor,
    v_priority,
    btrim(p_action),
    btrim(p_owner),
    btrim(p_expected_impact),
    btrim(p_verification),
    'draft',
    'handover_note',
    'work_order',
    p_target_id,
    v_changes,
    v_evidence,
    v_idempotency_key,
    1,
    true,
    now()
  )
  returning * into v_saved;

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
    v_saved.id,
    v_saved.site_id,
    v_actor,
    'created',
    v_saved.action_kind,
    v_saved.target_type,
    v_saved.target_id,
    v_saved.version,
    jsonb_build_object(
      'proposedChanges', v_saved.proposed_changes,
      'evidence', v_saved.evidence,
      'supported', true,
      'sapChanged', false
    )
  );

  return private.vorta_ask_vorta_action_draft_json(v_saved);
end;
$function$;

create or replace function public.vorta_get_ask_vorta_action_draft(p_draft_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_draft public.ask_vorta_action_drafts;
begin
  select * into v_draft
  from public.ask_vorta_action_drafts draft_row
  where draft_row.id = p_draft_id
    and draft_row.user_id = auth.uid();

  if v_draft.id is null
     or not private.vorta_rls_has_site_access(v_draft.site_id, false) then
    raise exception 'Ask Vorta action draft was not found.' using errcode = '42501';
  end if;

  return private.vorta_ask_vorta_action_draft_json(v_draft);
end;
$function$;

create or replace function public.vorta_cancel_ask_vorta_action(
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
  if v_draft.status = 'cancelled' then
    return private.vorta_ask_vorta_action_draft_json(v_draft);
  end if;
  if v_draft.status <> 'draft' then
    raise exception 'Only draft actions can be cancelled.' using errcode = '55000';
  end if;
  if v_draft.version <> p_expected_version then
    raise exception 'Action draft changed before cancellation. Refresh and retry.'
      using errcode = '40001';
  end if;

  update public.ask_vorta_action_drafts
  set status = 'cancelled',
      cancelled_by = v_actor,
      cancelled_at = now(),
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
    'cancelled',
    v_draft.action_kind,
    v_draft.target_type,
    v_draft.target_id,
    v_draft.version,
    jsonb_build_object('sourceChanged', false, 'sapChanged', false)
  );

  return private.vorta_ask_vorta_action_draft_json(v_draft);
end;
$function$;

revoke all on function public.vorta_create_ask_vorta_action_draft(
  uuid, uuid, text, text, uuid, text, text, text, text, text, jsonb, jsonb, text
) from public, anon, authenticated, service_role;
grant execute on function public.vorta_create_ask_vorta_action_draft(
  uuid, uuid, text, text, uuid, text, text, text, text, text, jsonb, jsonb, text
) to authenticated, service_role;

revoke all on function public.vorta_get_ask_vorta_action_draft(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.vorta_get_ask_vorta_action_draft(uuid)
  to authenticated, service_role;

revoke all on function public.vorta_cancel_ask_vorta_action(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.vorta_cancel_ask_vorta_action(uuid, integer)
  to authenticated, service_role;

comment on function public.vorta_create_ask_vorta_action_draft(
  uuid, uuid, text, text, uuid, text, text, text, text, text, jsonb, jsonb, text
) is 'Creates an idempotent Vorta shift-handover draft. It never changes SAP or the target work order.';
comment on function public.vorta_cancel_ask_vorta_action(uuid, integer)
  is 'Cancels one owned Ask Vorta handover draft without changing the work order or SAP.';

notify pgrst, 'reload schema';
