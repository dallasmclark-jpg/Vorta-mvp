-- VOR-033: keep prominent demo-narrative health compatible with the governed VOR-069 historical backtest series.
-- The historical HIST-* records are intentionally repetitive time-series evidence and are governed separately by VOR-069.
-- Current/non-historical operational records must still have zero repeated prominent narrative groups.

alter function private.vorta_get_demo_storyline_health_internal(uuid)
  rename to vorta_get_demo_storyline_health_pre_backtest_internal;

revoke all on function private.vorta_get_demo_storyline_health_pre_backtest_internal(uuid)
  from public, anon, authenticated;
grant execute on function private.vorta_get_demo_storyline_health_pre_backtest_internal(uuid)
  to service_role;

create or replace function private.vorta_get_demo_storyline_health_internal(p_site_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog','public','private'
as $$
with base as (
  select private.vorta_get_demo_storyline_health_pre_backtest_internal(p_site_id) as value
),
current_duplicates as (
  select count(*)::int as groups
  from (
    select description
    from public.work_orders
    where site_id = p_site_id
      and wo_number not like 'HIST-%'
      and nullif(trim(description), '') is not null
    group by description
    having count(*) >= 3
  ) grouped
),
historical_duplicates as (
  select count(*)::int as groups
  from (
    select description
    from public.work_orders
    where site_id = p_site_id
      and wo_number like 'HIST-%'
      and nullif(trim(description), '') is not null
    group by description
    having count(*) >= 3
  ) grouped
),
resolved as (
  select
    base.value,
    current_duplicates.groups as current_groups,
    historical_duplicates.groups as historical_groups,
    coalesce((base.value->'visibleSeedIdentifiers'->>'equipment')::int, 0) as seed_equipment,
    coalesce((base.value->'visibleSeedIdentifiers'->>'documents')::int, 0) as seed_documents,
    coalesce((base.value->'visibleSeedIdentifiers'->>'knowledgeChunks')::int, 0) as seed_chunks,
    coalesce((base.value->'storylines'->>'active')::int, 0) as active_storylines,
    coalesce((base.value->'storylines'->>'fullyLinked')::int, 0) as fully_linked_storylines,
    coalesce((base.value->'storylines'->>'questionPrompts')::int, 0) as question_prompts,
    coalesce((base.value->'topTenEvidenceCoverage'->>'assets')::int, 0) as top_assets,
    coalesce((base.value->'topTenEvidenceCoverage'->>'complete')::int, 0) as top_complete
  from base, current_duplicates, historical_duplicates
)
select value || jsonb_build_object(
  'healthy',
    seed_equipment + seed_documents + seed_chunks = 0
    and current_groups = 0
    and active_storylines >= 6
    and fully_linked_storylines = active_storylines
    and question_prompts >= 20
    and top_assets = 10
    and top_complete = 10,
  'duplicateNarrativeGroups', current_groups,
  'historicalBacktestDuplicateNarrativeGroups', historical_groups,
  'historicalBacktestNarrativesExcludedFromProminentDemoGate', true
)
from resolved;
$$;

revoke all on function private.vorta_get_demo_storyline_health_internal(uuid)
  from public, anon, authenticated;
grant execute on function private.vorta_get_demo_storyline_health_internal(uuid)
  to service_role;

comment on function private.vorta_get_demo_storyline_health_internal(uuid) is
  'VOR-033 demo-storyline health. Duplicate prominent operational narratives fail the gate; VOR-069 HIST-* backtest-series repetition is reported separately and governed by historical-backtest contracts.';
