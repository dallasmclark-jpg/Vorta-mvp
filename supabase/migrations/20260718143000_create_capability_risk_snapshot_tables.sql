create table private.vorta_capability_risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  snapshot_date date not null,
  captured_at timestamptz not null default now(),
  source_event text not null default 'daily scheduled snapshot',
  site_risk_score numeric(6,2),
  site_risk_level text,
  operational_risk_score numeric(6,2),
  labour_risk_score numeric(6,2),
  total_assets integer not null default 0,
  at_risk_assets integer not null default 0,
  high_assets integer not null default 0,
  critical_assets integer not null default 0,
  overdue_pm_count integer not null default 0,
  calibration_backlog_count integer not null default 0,
  cover_gap_count integer not null default 0,
  critical_spares_missing integer not null default 0,
  scheduled_engineer_count integer not null default 0,
  capability_action_count integer not null default 0,
  critical_action_count integer not null default 0,
  high_action_count integer not null default 0,
  medium_action_count integer not null default 0,
  low_action_count integer not null default 0,
  backup_sme_action_count integer not null default 0,
  skill_coverage_action_count integer not null default 0,
  am_shift_action_count integer not null default 0,
  maximum_priority_score numeric(6,2),
  average_priority_score numeric(6,2),
  capability_summary jsonb not null default '{}'::jsonb,
  source_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, snapshot_date),
  check (site_risk_score is null or site_risk_score between 0 and 100),
  check (operational_risk_score is null or operational_risk_score between 0 and 100),
  check (labour_risk_score is null or labour_risk_score between 0 and 100),
  check (maximum_priority_score is null or maximum_priority_score between 0 and 100),
  check (average_priority_score is null or average_priority_score between 0 and 100)
);

create table private.vorta_capability_action_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references private.vorta_capability_risk_snapshots(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  snapshot_date date not null,
  action_id text not null,
  action_type text not null,
  priority_rank integer,
  priority_score numeric(6,2) not null,
  priority_level text not null,
  equipment_id uuid references public.equipment_assets(id) on delete set null,
  equipment_code text,
  equipment_name text,
  area text,
  equipment_risk_score numeric(6,2),
  requirement_skill_id uuid,
  requirement_name text,
  primary_sme_id uuid,
  primary_sme_name text,
  backup_sme_id uuid,
  backup_sme_name text,
  candidate_person_type text,
  candidate_id uuid,
  candidate_name text,
  candidate_status text,
  candidate_skill_matches integer,
  candidate_skill_total integer,
  affected_shift_count integer not null default 0,
  affected_shift_codes text[] not null default '{}'::text[],
  missing_evidence text[] not null default '{}'::text[],
  action_owner text,
  recommended_action text,
  rationale text,
  state_hash text not null,
  action_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (snapshot_id, action_id),
  check (priority_score between 0 and 100),
  check (equipment_risk_score is null or equipment_risk_score between 0 and 100)
);

create index vorta_capability_risk_snapshots_site_date_idx
  on private.vorta_capability_risk_snapshots (site_id, snapshot_date desc);

create index vorta_capability_action_snapshots_site_date_idx
  on private.vorta_capability_action_snapshots (site_id, snapshot_date desc);

create index vorta_capability_action_snapshots_action_date_idx
  on private.vorta_capability_action_snapshots (site_id, action_id, snapshot_date desc);

create index vorta_capability_action_snapshots_equipment_date_idx
  on private.vorta_capability_action_snapshots (site_id, equipment_id, snapshot_date desc);

create index vorta_capability_action_snapshots_equipment_id_idx
  on private.vorta_capability_action_snapshots (equipment_id);

alter table private.vorta_capability_risk_snapshots enable row level security;
alter table private.vorta_capability_action_snapshots enable row level security;

create policy vorta_capability_risk_snapshots_deny_direct
  on private.vorta_capability_risk_snapshots
  for all
  to public
  using (false)
  with check (false);

create policy vorta_capability_action_snapshots_deny_direct
  on private.vorta_capability_action_snapshots
  for all
  to public
  using (false)
  with check (false);

revoke all on private.vorta_capability_risk_snapshots from public, anon, authenticated;
revoke all on private.vorta_capability_action_snapshots from public, anon, authenticated;

comment on table private.vorta_capability_risk_snapshots is
  'Private daily site-level capability and risk evidence snapshots.';

comment on table private.vorta_capability_action_snapshots is
  'Private daily action-level capability evidence used for before-and-after comparison.';