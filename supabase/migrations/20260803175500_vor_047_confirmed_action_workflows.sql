alter table public.ask_vorta_action_drafts
  add column if not exists action_kind text not null default 'read_only',
  add column if not exists target_type text,
  add column if not exists target_id uuid,
  add column if not exists proposed_changes jsonb not null default '{}'::jsonb,
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists idempotency_key text,
  add column if not exists version integer not null default 1,
  add column if not exists supported boolean not null default false,
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancelled_at timestamptz,
  add column if not exists result_type text,
  add column if not exists result_id uuid,
  add column if not exists result_payload jsonb,
  add column if not exists failure_reason text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.ask_vorta_action_drafts
  drop constraint if exists ask_vorta_action_drafts_status_check,
  add constraint ask_vorta_action_drafts_status_check
    check (status in ('draft', 'confirmed', 'cancelled', 'failed')),
  drop constraint if exists ask_vorta_action_drafts_action_kind_check,
  add constraint ask_vorta_action_drafts_action_kind_check
    check (action_kind in ('read_only', 'handover_note', 'work_request', 'spare_stock_review')),
  drop constraint if exists ask_vorta_action_drafts_priority_check,
  add constraint ask_vorta_action_drafts_priority_check
    check (priority in ('now', 'before_shift', 'this_week', 'planned')),
  drop constraint if exists ask_vorta_action_drafts_proposed_changes_object_check,
  add constraint ask_vorta_action_drafts_proposed_changes_object_check
    check (jsonb_typeof(proposed_changes) = 'object'),
  drop constraint if exists ask_vorta_action_drafts_evidence_object_check,
  add constraint ask_vorta_action_drafts_evidence_object_check
    check (jsonb_typeof(evidence) = 'object'),
  drop constraint if exists ask_vorta_action_drafts_version_check,
  add constraint ask_vorta_action_drafts_version_check check (version > 0);

create unique index if not exists ask_vorta_action_drafts_idempotency_uidx
  on public.ask_vorta_action_drafts (user_id, site_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists ask_vorta_action_drafts_status_idx
  on public.ask_vorta_action_drafts (site_id, status, created_at desc);

create table if not exists public.ask_vorta_action_events (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.ask_vorta_action_drafts(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('created', 'confirmed', 'cancelled', 'failed', 'idempotent_replay')),
  action_kind text not null,
  target_type text,
  target_id uuid,
  draft_version integer not null,
  event_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(event_payload) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists ask_vorta_action_events_draft_idx
  on public.ask_vorta_action_events (draft_id, created_at desc);
create index if not exists ask_vorta_action_events_site_idx
  on public.ask_vorta_action_events (site_id, created_at desc);

create table if not exists public.spare_stock_review_tasks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  component_id uuid not null references public.equipment_components(id) on delete restrict,
  source_draft_id uuid not null unique references public.ask_vorta_action_drafts(id) on delete restrict,
  requested_quantity numeric,
  reason text not null,
  owner_name text not null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'reviewed', 'cancelled')),
  component_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(component_snapshot) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists spare_stock_review_tasks_site_status_idx
  on public.spare_stock_review_tasks (site_id, status, created_at desc);
create index if not exists spare_stock_review_tasks_component_idx
  on public.spare_stock_review_tasks (component_id, status);

alter table public.ask_vorta_action_events enable row level security;
alter table public.spare_stock_review_tasks enable row level security;

drop policy if exists ask_vorta_action_events_select_own on public.ask_vorta_action_events;
create policy ask_vorta_action_events_select_own
  on public.ask_vorta_action_events
  for select to authenticated
  using (
    private.vorta_rls_has_site_access(site_id, false)
    and exists (
      select 1
      from public.ask_vorta_action_drafts draft_row
      where draft_row.id = draft_id
        and draft_row.user_id = (select auth.uid())
    )
  );

drop policy if exists spare_stock_review_tasks_select_site on public.spare_stock_review_tasks;
create policy spare_stock_review_tasks_select_site
  on public.spare_stock_review_tasks
  for select to authenticated
  using (private.vorta_rls_has_site_access(site_id, false));

drop policy if exists ask_vorta_action_drafts_insert_own on public.ask_vorta_action_drafts;
drop policy if exists ask_vorta_action_drafts_update_own on public.ask_vorta_action_drafts;

revoke insert, update, delete on table public.ask_vorta_action_drafts from authenticated;
revoke insert, update, delete on table public.ask_vorta_action_events from authenticated;
revoke insert, update, delete on table public.spare_stock_review_tasks from authenticated;
grant select on table public.ask_vorta_action_drafts to authenticated;
grant select on table public.ask_vorta_action_events to authenticated;
grant select on table public.spare_stock_review_tasks to authenticated;

create or replace function private.vorta_ask_vorta_can_manage(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  select auth.uid() is not null
    and private.vorta_rls_has_site_access(p_site_id, false)
    and exists (
      select 1
      from public.user_site_access access_row
      where access_row.user_id = auth.uid()
        and access_row.site_id = p_site_id
        and access_row.active
        and lower(replace(coalesce(access_row.app_role, ''), '-', '_')) in (
          'vorta_admin',
          'site_admin',
          'maintenance_manager',
          'reliability_engineer'
        )
    );
$function$;

create or replace function private.vorta_ask_vorta_action_draft_json(
  p_draft public.ask_vorta_action_drafts
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select jsonb_build_object(
    'id', p_draft.id,
    'interactionId', p_draft.interaction_id,
    'siteId', p_draft.site_id,
    'userId', p_draft.user_id,
    'priority', p_draft.priority,
    'action', p_draft.action,
    'owner', p_draft.owner,
    'expectedImpact', p_draft.expected_impact,
    'verification', p_draft.verification,
    'status', p_draft.status,
    'actionKind', p_draft.action_kind,
    'targetType', p_draft.target_type,
    'targetId', p_draft.target_id,
    'proposedChanges', p_draft.proposed_changes,
    'evidence', p_draft.evidence,
    'idempotencyKey', p_draft.idempotency_key,
    'version', p_draft.version,
    'supported', p_draft.supported,
    'confirmedBy', p_draft.confirmed_by,
    'confirmedAt', p_draft.confirmed_at,
    'cancelledBy', p_draft.cancelled_by,
    'cancelledAt', p_draft.cancelled_at,
    'resultType', p_draft.result_type,
    'resultId', p_draft.result_id,
    'resultPayload', p_draft.result_payload,
    'failureReason', p_draft.failure_reason,
    'createdAt', p_draft.created_at,
    'reviewedAt', p_draft.reviewed_at,
    'updatedAt', p_draft.updated_at,
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', event_row.id,
          'eventType', event_row.event_type,
          'actorId', event_row.actor_id,
          'draftVersion', event_row.draft_version,
          'payload', event_row.event_payload,
          'createdAt', event_row.created_at
        ) order by event_row.created_at desc
      )
      from public.ask_vorta_action_events event_row
      where event_row.draft_id = p_draft.id
    ), '[]'::jsonb)
  );
$function$;

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
  v_kind text := lower(btrim(coalesce(p_action_kind, 'read_only')));
  v_target_type text := lower(btrim(coalesce(p_target_type, '')));
  v_priority text := lower(btrim(coalesce(p_priority, 'planned')));
  v_changes jsonb := coalesce(p_proposed_changes, '{}'::jsonb);
  v_evidence jsonb := coalesce(p_evidence, '{}'::jsonb);
  v_supported boolean;
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
    raise exception 'A completed Ask Vorta response owned by the current user is required.' using errcode = '42501';
  end if;
  if v_kind not in ('read_only', 'handover_note', 'work_request', 'spare_stock_review') then
    raise exception 'Unsupported Ask Vorta action kind.' using errcode = '22023';
  end if;
  if v_priority not in ('now', 'before_shift', 'this_week', 'planned') then
    raise exception 'Unsupported action priority.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_changes) <> 'object' or jsonb_typeof(v_evidence) <> 'object' then
    raise exception 'Proposed changes and evidence must be JSON objects.' using errcode = '22023';
  end if;
  if nullif(btrim(p_action), '') is null
     or nullif(btrim(p_owner), '') is null
     or nullif(btrim(p_expected_impact), '') is null
     or nullif(btrim(p_verification), '') is null then
    raise exception 'Action, owner, impact and verification are required.' using errcode = '22023';
  end if;
  if char_length(p_action) > 1200
     or char_length(p_owner) > 160
     or char_length(p_expected_impact) > 1200
     or char_length(p_verification) > 1200 then
    raise exception 'Action draft text exceeds the allowed length.' using errcode = '22023';
  end if;

  v_supported := v_kind <> 'read_only';

  if v_kind = 'handover_note' then
    if v_target_type <> 'work_order' or p_target_id is null or not exists (
      select 1 from public.work_orders work_order
      where work_order.id = p_target_id and work_order.site_id = p_site_id
    ) then
      raise exception 'A work order in the active site is required for a handover note.' using errcode = '42501';
    end if;
    if nullif(btrim(v_changes ->> 'windowStart'), '') is null
       or nullif(btrim(v_changes ->> 'windowEnd'), '') is null
       or nullif(btrim(v_changes ->> 'outgoingNote'), '') is null
       or nullif(btrim(v_changes ->> 'nextAction'), '') is null
       or nullif(btrim(v_changes ->> 'ownerName'), '') is null
       or nullif(btrim(v_changes ->> 'dueAt'), '') is null then
      raise exception 'Handover window, note, next action, owner and due time are required.' using errcode = '22023';
    end if;
  elsif v_kind = 'work_request' then
    if v_target_type <> 'equipment' or p_target_id is null or not exists (
      select 1 from public.equipment_assets asset
      where asset.id = p_target_id and asset.site_id = p_site_id
    ) then
      raise exception 'Equipment in the active site is required for a work request.' using errcode = '42501';
    end if;
    if nullif(btrim(v_changes ->> 'shortText'), '') is null then
      raise exception 'Work request short text is required.' using errcode = '22023';
    end if;
    if char_length(v_changes ->> 'shortText') > 160
       or char_length(coalesce(v_changes ->> 'longText', '')) > 4000 then
      raise exception 'Work request text exceeds the allowed length.' using errcode = '22023';
    end if;
  elsif v_kind = 'spare_stock_review' then
    if v_target_type <> 'equipment_component' or p_target_id is null or not exists (
      select 1 from public.equipment_components component
      where component.id = p_target_id and component.site_id = p_site_id
    ) then
      raise exception 'A spare component in the active site is required for a stock review.' using errcode = '42501';
    end if;
    if nullif(btrim(v_changes ->> 'reason'), '') is null then
      raise exception 'A stock-review reason is required.' using errcode = '22023';
    end if;
    if (v_changes ? 'requestedQuantity')
       and coalesce((v_changes ->> 'requestedQuantity')::numeric, 0) <= 0 then
      raise exception 'Requested quantity must be greater than zero.' using errcode = '22023';
    end if;
  end if;

  v_idempotency_key := coalesce(
    nullif(btrim(p_idempotency_key), ''),
    md5(concat_ws(
      '|',
      v_actor::text,
      p_site_id::text,
      p_interaction_id::text,
      v_kind,
      coalesce(p_target_id::text, ''),
      v_changes::text
    ))
  );
  if char_length(v_idempotency_key) > 160 then
    raise exception 'Idempotency key exceeds the allowed length.' using errcode = '22023';
  end if;

  select * into v_existing
  from public.ask_vorta_action_drafts draft_row
  where draft_row.user_id = v_actor
    and draft_row.site_id = p_site_id
    and draft_row.idempotency_key = v_idempotency_key;
  if v_existing.id is not null then
    insert into public.ask_vorta_action_events (
      draft_id, site_id, actor_id, event_type, action_kind,
      target_type, target_id, draft_version, event_payload
    ) values (
      v_existing.id, v_existing.site_id, v_actor, 'idempotent_replay',
      v_existing.action_kind, v_existing.target_type, v_existing.target_id,
      v_existing.version, jsonb_build_object('operation', 'create')
    );
    return private.vorta_ask_vorta_action_draft_json(v_existing);
  end if;

  insert into public.ask_vorta_action_drafts (
    interaction_id, site_id, user_id, priority, action, owner,
    expected_impact, verification, status, action_kind, target_type,
    target_id, proposed_changes, evidence, idempotency_key,
    version, supported, updated_at
  ) values (
    p_interaction_id, p_site_id, v_actor, v_priority,
    btrim(p_action), btrim(p_owner), btrim(p_expected_impact),
    btrim(p_verification), 'draft', v_kind,
    nullif(v_target_type, ''), p_target_id, v_changes, v_evidence,
    v_idempotency_key, 1, v_supported, now()
  ) returning * into v_saved;

  insert into public.ask_vorta_action_events (
    draft_id, site_id, actor_id, event_type, action_kind,
    target_type, target_id, draft_version, event_payload
  ) values (
    v_saved.id, v_saved.site_id, v_actor, 'created', v_saved.action_kind,
    v_saved.target_type, v_saved.target_id, v_saved.version,
    jsonb_build_object(
      'proposedChanges', v_saved.proposed_changes,
      'evidence', v_saved.evidence,
      'supported', v_saved.supported
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
  if v_draft.id is null or not private.vorta_rls_has_site_access(v_draft.site_id, false) then
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
  if v_draft.id is null or not private.vorta_ask_vorta_can_manage(v_draft.site_id) then
    raise exception 'Ask Vorta action draft was not found.' using errcode = '42501';
  end if;
  if v_draft.status = 'cancelled' then
    return private.vorta_ask_vorta_action_draft_json(v_draft);
  end if;
  if v_draft.status <> 'draft' then
    raise exception 'Only draft actions can be cancelled.' using errcode = '55000';
  end if;
  if v_draft.version <> p_expected_version then
    raise exception 'Action draft changed before cancellation. Refresh and retry.' using errcode = '40001';
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
    draft_id, site_id, actor_id, event_type, action_kind,
    target_type, target_id, draft_version, event_payload
  ) values (
    v_draft.id, v_draft.site_id, v_actor, 'cancelled', v_draft.action_kind,
    v_draft.target_type, v_draft.target_id, v_draft.version,
    jsonb_build_object('sourceChanged', false)
  );

  return private.vorta_ask_vorta_action_draft_json(v_draft);
end;
$function$;

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

      v_priority_code := upper(coalesce(nullif(btrim(v_changes ->> 'priorityCode'), ''),
        case v_draft.priority
          when 'now' then '1'
          when 'before_shift' then '2'
          when 'this_week' then '3'
          else '4'
        end));
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
    raise;
  end;

  return private.vorta_ask_vorta_action_draft_json(v_draft);
end;
$function$;

revoke all on function public.vorta_create_ask_vorta_action_draft(
  uuid, uuid, text, text, uuid, text, text, text, text, text, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.vorta_create_ask_vorta_action_draft(
  uuid, uuid, text, text, uuid, text, text, text, text, text, jsonb, jsonb, text
) to authenticated, service_role;

revoke all on function public.vorta_get_ask_vorta_action_draft(uuid)
  from public, anon, authenticated;
grant execute on function public.vorta_get_ask_vorta_action_draft(uuid)
  to authenticated, service_role;

revoke all on function public.vorta_cancel_ask_vorta_action(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.vorta_cancel_ask_vorta_action(uuid, integer)
  to authenticated, service_role;

revoke all on function public.vorta_confirm_ask_vorta_action(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.vorta_confirm_ask_vorta_action(uuid, integer)
  to authenticated, service_role;

revoke all on function private.vorta_ask_vorta_can_manage(uuid)
  from public, anon, authenticated;
grant execute on function private.vorta_ask_vorta_can_manage(uuid)
  to service_role;

revoke all on function private.vorta_ask_vorta_action_draft_json(public.ask_vorta_action_drafts)
  from public, anon, authenticated;
grant execute on function private.vorta_ask_vorta_action_draft_json(public.ask_vorta_action_drafts)
  to service_role;

comment on function public.vorta_create_ask_vorta_action_draft(
  uuid, uuid, text, text, uuid, text, text, text, text, text, jsonb, jsonb, text
) is 'Creates an idempotent typed Ask Vorta action draft. It never changes the target maintenance record.';
comment on function public.vorta_confirm_ask_vorta_action(uuid, integer)
  is 'Confirms one owned Ask Vorta draft through an action-specific guarded workflow and records an immutable audit event.';
comment on function public.vorta_cancel_ask_vorta_action(uuid, integer)
  is 'Cancels one owned Ask Vorta draft without changing the target maintenance record.';

notify pgrst, 'reload schema';
