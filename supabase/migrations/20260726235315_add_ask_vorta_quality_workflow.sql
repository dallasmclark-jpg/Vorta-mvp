-- Add privacy-preserving Ask Vorta quality telemetry and approval-only action
-- drafts. Both tables remain user/site scoped through RLS and are explicitly
-- granted because new public tables are not guaranteed to be Data API exposed.

create table if not exists public.ask_vorta_interactions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null,
  question_fingerprint text not null,
  intent_label text,
  tools_used text[] not null default '{}',
  sources text[] not null default '{}',
  confidence smallint check (confidence between 0 and 100),
  missing_data_count integer not null default 0 check (missing_data_count >= 0),
  duration_ms integer check (duration_ms >= 0),
  status text not null default 'started'
    check (status in ('started', 'completed', 'fallback', 'failed', 'rate_limited')),
  feedback text check (feedback in ('helpful', 'not_helpful')),
  feedback_reason text check (feedback_reason is null or char_length(feedback_reason) <= 500),
  feedback_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ask_vorta_interactions_user_rate_idx
  on public.ask_vorta_interactions(user_id, created_at desc);

create index if not exists ask_vorta_interactions_site_quality_idx
  on public.ask_vorta_interactions(site_id, created_at desc)
  where status in ('completed', 'fallback', 'failed');

alter table public.ask_vorta_interactions enable row level security;

drop policy if exists ask_vorta_interactions_select_own on public.ask_vorta_interactions;
create policy ask_vorta_interactions_select_own
  on public.ask_vorta_interactions
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and private.vorta_rls_has_site_access(site_id, false)
  );

drop policy if exists ask_vorta_interactions_insert_own on public.ask_vorta_interactions;
create policy ask_vorta_interactions_insert_own
  on public.ask_vorta_interactions
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and private.vorta_rls_has_site_access(site_id, false)
  );

drop policy if exists ask_vorta_interactions_update_own on public.ask_vorta_interactions;
create policy ask_vorta_interactions_update_own
  on public.ask_vorta_interactions
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and private.vorta_rls_has_site_access(site_id, false)
  )
  with check (
    user_id = (select auth.uid())
    and private.vorta_rls_has_site_access(site_id, false)
  );

revoke all on public.ask_vorta_interactions from public, anon;
grant select, insert, update on public.ask_vorta_interactions to authenticated;

create table if not exists public.ask_vorta_action_drafts (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid references public.ask_vorta_interactions(id) on delete set null,
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  priority text not null check (priority in ('now', 'before_shift', 'this_week', 'planned')),
  action text not null check (char_length(action) between 1 and 1000),
  owner text not null check (char_length(owner) between 1 and 200),
  expected_impact text not null check (char_length(expected_impact) between 1 and 1000),
  verification text not null check (char_length(verification) between 1 and 1000),
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists ask_vorta_action_drafts_site_idx
  on public.ask_vorta_action_drafts(site_id, created_at desc);

alter table public.ask_vorta_action_drafts enable row level security;

drop policy if exists ask_vorta_action_drafts_select_own on public.ask_vorta_action_drafts;
create policy ask_vorta_action_drafts_select_own
  on public.ask_vorta_action_drafts
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and private.vorta_rls_has_site_access(site_id, false)
  );

drop policy if exists ask_vorta_action_drafts_insert_own on public.ask_vorta_action_drafts;
create policy ask_vorta_action_drafts_insert_own
  on public.ask_vorta_action_drafts
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'draft'
    and private.vorta_rls_has_site_access(site_id, false)
  );

drop policy if exists ask_vorta_action_drafts_update_own on public.ask_vorta_action_drafts;
create policy ask_vorta_action_drafts_update_own
  on public.ask_vorta_action_drafts
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and private.vorta_rls_has_site_access(site_id, false)
  )
  with check (
    user_id = (select auth.uid())
    and private.vorta_rls_has_site_access(site_id, false)
  );

revoke all on public.ask_vorta_action_drafts from public, anon;
grant select, insert, update on public.ask_vorta_action_drafts to authenticated;
