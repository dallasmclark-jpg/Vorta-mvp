-- VOR-069: historical equipment and spares backtest data foundation.
-- Adds provenance/versioning to daily risk history, exact event-risk history,
-- item-level stock history, and a private synthetic-scenario registry.

alter table public.equipment_risk_history
  add column if not exists risk_model_version text,
  add column if not exists evidence_provenance text,
  add column if not exists dataset_version text,
  add column if not exists scenario_key text;

create index if not exists equipment_risk_history_dataset_idx
  on public.equipment_risk_history (dataset_version, equipment_id, captured_at desc)
  where dataset_version is not null;

create table if not exists public.equipment_risk_event_history (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  captured_at timestamptz not null,
  risk_score integer not null check (risk_score between 0 and 100),
  risk_level text not null,
  operational_risk_score numeric,
  labour_risk_score numeric,
  pm_backlog_pct integer not null default 0,
  asset_criticality_pct integer not null default 0,
  calibration_pct integer not null default 0,
  skills_pct integer not null default 0,
  spares_pct integer not null default 0,
  overdue_pm_count integer not null default 0,
  calibration_overdue_count integer not null default 0,
  critical_spares_missing integer not null default 0,
  primary_driver text,
  source_event text not null,
  risk_model_version text not null,
  evidence_provenance text not null,
  dataset_version text not null,
  scenario_key text,
  created_at timestamptz not null default now(),
  unique (equipment_id, captured_at, source_event)
);

create index if not exists equipment_risk_event_history_equipment_time_idx
  on public.equipment_risk_event_history (equipment_id, captured_at desc);
create index if not exists equipment_risk_event_history_site_time_idx
  on public.equipment_risk_event_history (site_id, captured_at desc);
create index if not exists equipment_risk_event_history_scenario_idx
  on public.equipment_risk_event_history (scenario_key, captured_at)
  where scenario_key is not null;

alter table public.equipment_risk_event_history enable row level security;
drop policy if exists equipment_risk_event_history_site_read on public.equipment_risk_event_history;
create policy equipment_risk_event_history_site_read
  on public.equipment_risk_event_history
  for select to authenticated
  using (private.vorta_rls_has_site_access(site_id, false));

revoke all on table public.equipment_risk_event_history from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.equipment_risk_event_history from authenticated;
grant select on table public.equipment_risk_event_history to authenticated;

create table if not exists public.site_material_stock_history (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  component_id uuid not null references public.equipment_components(id) on delete cascade,
  material_number text not null,
  material_description text,
  plant_code text,
  storage_location text,
  snapshot_at timestamptz not null,
  unrestricted_quantity numeric not null default 0,
  quality_inspection_quantity numeric not null default 0,
  blocked_quantity numeric not null default 0,
  reserved_quantity numeric not null default 0,
  available_quantity numeric not null default 0,
  minimum_quantity numeric not null default 0,
  target_quantity numeric not null default 0,
  stock_status text not null check (stock_status in ('in_stock','low_stock','out_of_stock','unavailable')),
  source_system text not null,
  source_record_key text not null,
  source_updated_at timestamptz,
  evidence_provenance text not null,
  dataset_version text not null,
  scenario_key text,
  created_at timestamptz not null default now(),
  unique (site_id, component_id, snapshot_at, source_record_key)
);

create index if not exists site_material_stock_history_site_material_time_idx
  on public.site_material_stock_history (site_id, material_number, snapshot_at desc);
create index if not exists site_material_stock_history_equipment_time_idx
  on public.site_material_stock_history (equipment_id, snapshot_at desc);
create index if not exists site_material_stock_history_component_time_idx
  on public.site_material_stock_history (component_id, snapshot_at desc);
create index if not exists site_material_stock_history_scenario_idx
  on public.site_material_stock_history (scenario_key, snapshot_at)
  where scenario_key is not null;

alter table public.site_material_stock_history enable row level security;
drop policy if exists site_material_stock_history_site_read on public.site_material_stock_history;
create policy site_material_stock_history_site_read
  on public.site_material_stock_history
  for select to authenticated
  using (private.vorta_rls_has_site_access(site_id, false));

revoke all on table public.site_material_stock_history from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.site_material_stock_history from authenticated;
grant select on table public.site_material_stock_history to authenticated;

create table if not exists private.vorta_demo_backtest_scenarios (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  scenario_key text not null,
  scenario_type text not null check (
    scenario_type in (
      'stockout_extended_recovery',
      'elevated_risk_breakdown',
      'successful_intervention',
      'false_positive'
    )
  ),
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  component_id uuid not null references public.equipment_components(id) on delete cascade,
  material_number text not null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  warning_start_at timestamptz not null,
  intervention_at timestamptz,
  failure_at timestamptz,
  stockout_start_at timestamptz,
  stock_replenished_at timestamptz,
  expected_warning_days integer not null default 21,
  expected_classifications text[] not null default '{}'::text[],
  risk_model_version text not null,
  dataset_version text not null,
  evidence_provenance text not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, scenario_key)
);

revoke all on table private.vorta_demo_backtest_scenarios from public, anon, authenticated;
grant select, insert, update, delete on table private.vorta_demo_backtest_scenarios to service_role;

-- Existing demo backfill is explicitly marked synthetic. No operational values are changed.
update public.equipment_risk_history
set
  evidence_provenance = coalesce(evidence_provenance, 'synthetic_demo'),
  dataset_version = coalesce(dataset_version, 'legacy-demo-history-v1'),
  risk_model_version = coalesce(risk_model_version, 'legacy-demo-risk-v1')
where source_event in ('demo_history_backfill','demo_backend_expansion')
  and evidence_provenance is null;
