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

revoke all on function private.vorta_ask_vorta_can_manage(uuid)
  from public, anon, authenticated;
grant execute on function private.vorta_ask_vorta_can_manage(uuid)
  to service_role;
revoke all on function private.vorta_ask_vorta_action_draft_json(public.ask_vorta_action_drafts)
  from public, anon, authenticated;
grant execute on function private.vorta_ask_vorta_action_draft_json(public.ask_vorta_action_drafts)
  to service_role;

notify pgrst, 'reload schema';
