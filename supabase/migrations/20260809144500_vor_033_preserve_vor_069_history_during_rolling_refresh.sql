-- VOR-033 / VOR-069 rolling-date coexistence.
--
-- VOR-033 keeps the current demo site rolling. VOR-069 intentionally owns a
-- fixed 2024-2025 synthetic historical backtest. The original VOR-033 phase-one
-- refresh ranked every COMPLETED work order and therefore pulled VOR-069
-- source_system=vorta_demo_backtest rows into the current period.
--
-- This migration restores the governed VOR-069 timestamps deterministically,
-- then excludes that source namespace from VOR-033 current/open and completed
-- work-order rankings. No historical record is deleted or converted to live
-- evidence.

-- Restore the deterministic 30-row-per-asset HIST-* series from the original
-- VOR-069 baseline formula.
with ranked_assets as (
  select
    asset.id as equipment_id,
    asset.equipment_code,
    row_number() over (order by asset.equipment_code) as asset_ordinal
  from public.equipment_assets asset
  where asset.site_id = '11000000-0000-0000-0000-000000000001'::uuid
),
restored as (
  select
    work_order.id,
    (date '2024-01-05'
      + mod(
          (asset.asset_ordinal * 7
            + right(work_order.source_record_key, 3)::integer * 23)::integer,
          720
        ))::date as event_date,
    greatest(coalesce(work_order.downtime_minutes, 0), 30) as duration_minutes
  from public.work_orders work_order
  join ranked_assets asset on asset.equipment_id = work_order.equipment_id
  where work_order.site_id = '11000000-0000-0000-0000-000000000001'::uuid
    and work_order.source_system = 'vorta_demo_backtest'
    and work_order.source_record_key ~ '^vor069:.*:[0-9]{3}$'
    and work_order.wo_number like 'HIST-%'
)
update public.work_orders work_order
set requested_date = restored.event_date,
    due_date = restored.event_date,
    completed_date = restored.event_date,
    basic_start_date = restored.event_date,
    basic_finish_date = restored.event_date,
    scheduled_start_at = (restored.event_date + time '08:00') at time zone 'Europe/London',
    scheduled_finish_at = ((restored.event_date + time '08:00') at time zone 'Europe/London')
      + restored.duration_minutes * interval '1 minute',
    actual_start_at = (restored.event_date + time '08:00') at time zone 'Europe/London',
    actual_finish_at = ((restored.event_date + time '08:00') at time zone 'Europe/London')
      + restored.duration_minutes * interval '1 minute',
    technical_completion_at = ((restored.event_date + time '08:00') at time zone 'Europe/London')
      + restored.duration_minutes * interval '1 minute',
    business_completion_at = ((restored.event_date + time '08:00') at time zone 'Europe/London')
      + restored.duration_minutes * interval '1 minute',
    created_at = (restored.event_date + time '07:00') at time zone 'Europe/London',
    updated_at = (restored.event_date + time '18:00') at time zone 'Europe/London',
    source_created_at = (restored.event_date + time '07:00') at time zone 'Europe/London',
    source_updated_at = (restored.event_date + time '18:00') at time zone 'Europe/London',
    age_label = 'Historical',
    is_overdue = false
from restored
where work_order.id = restored.id;

-- Restore the linked scenario outcome work orders from the governed private
-- scenario timestamps. False positives have no work order by design.
with restored as (
  select
    work_order.id,
    scenario.scenario_type,
    coalesce(scenario.failure_at, scenario.intervention_at) as event_at,
    case
      when scenario.scenario_type = 'stockout_extended_recovery'
        then scenario.stock_replenished_at + interval '2 hours'
      else coalesce(scenario.failure_at, scenario.intervention_at) + interval '3 hours'
    end as finish_at,
    case
      when scenario.scenario_type = 'stockout_extended_recovery'
        then scenario.stock_replenished_at::date
      else coalesce(scenario.failure_at, scenario.intervention_at)::date
    end as completed_on
  from private.vorta_demo_backtest_scenarios scenario
  join public.work_orders work_order
    on work_order.site_id = scenario.site_id
   and work_order.source_system = 'vorta_demo_backtest'
   and work_order.source_record_key = 'scenario:' || scenario.scenario_key
  where scenario.site_id = '11000000-0000-0000-0000-000000000001'::uuid
    and scenario.dataset_version = 'vor069-historical-backtest-v1'
    and scenario.scenario_type in (
      'stockout_extended_recovery',
      'elevated_risk_breakdown',
      'successful_intervention'
    )
)
update public.work_orders work_order
set requested_date = restored.event_at::date,
    due_date = restored.event_at::date,
    completed_date = restored.completed_on,
    basic_start_date = restored.event_at::date,
    basic_finish_date = restored.completed_on,
    scheduled_start_at = restored.event_at,
    scheduled_finish_at = restored.finish_at,
    actual_start_at = restored.event_at,
    actual_finish_at = restored.finish_at,
    technical_completion_at = restored.finish_at,
    business_completion_at = restored.finish_at,
    created_at = restored.event_at - interval '1 hour',
    updated_at = restored.finish_at,
    source_created_at = restored.event_at - interval '1 hour',
    source_updated_at = restored.finish_at,
    age_label = 'Historical backtest',
    is_overdue = false
from restored
where work_order.id = restored.id;

-- Patch the existing private phase-one refresh in place. This is deliberately
-- guarded against source drift and is idempotent for databases that already
-- carry the exclusions.
do $do$
declare
  v_definition text;
  v_open_pattern text := $open$where work_order.site_id=p_site_id and upper(work_order.status)<>'COMPLETED'$open$;
  v_completed_pattern text := $completed$where work_order.site_id=p_site_id and upper(work_order.status)='COMPLETED'$completed$;
  v_open_replacement text := $openrep$where work_order.site_id=p_site_id and upper(work_order.status)<>'COMPLETED'
      and coalesce(work_order.source_system,'') <> 'vorta_demo_backtest'$openrep$;
  v_completed_replacement text := $completedrep$where work_order.site_id=p_site_id and upper(work_order.status)='COMPLETED'
      and coalesce(work_order.source_system,'') <> 'vorta_demo_backtest'$completedrep$;
  v_exclusion_pattern text := $exclude$and coalesce(work_order.source_system,'') <> 'vorta_demo_backtest'$exclude$;
  v_open_count integer;
  v_completed_count integer;
  v_exclusion_count integer;
begin
  select pg_get_functiondef(p.oid)
  into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'vorta_refresh_demo_dataset_dates_phase1_internal'
    and pg_get_function_identity_arguments(p.oid) = 'p_site_id uuid, p_anchor_date date';

  if v_definition is null then
    raise exception 'VOR-033 phase-one refresh definition not found';
  end if;

  v_exclusion_count :=
    (length(v_definition) - length(replace(v_definition, v_exclusion_pattern, '')))
    / length(v_exclusion_pattern);

  if v_exclusion_count < 2 then
    v_open_count :=
      (length(v_definition) - length(replace(v_definition, v_open_pattern, '')))
      / length(v_open_pattern);
    v_completed_count :=
      (length(v_definition) - length(replace(v_definition, v_completed_pattern, '')))
      / length(v_completed_pattern);

    if v_open_count <> 1 or v_completed_count <> 1 then
      raise exception
        'VOR-033 phase-one ranking contract drifted: open %, completed %',
        v_open_count,
        v_completed_count;
    end if;

    v_definition := replace(v_definition, v_open_pattern, v_open_replacement);
    v_definition := replace(v_definition, v_completed_pattern, v_completed_replacement);
    execute v_definition;
  end if;
end;
$do$;

-- Clean up the one-off preserved helper if it exists from an earlier live
-- repair attempt. The canonical implementation is the function above.
drop function if exists private.vorta_refresh_demo_dataset_dates_phase1_pre_backtest_guard_inte(uuid, date);

revoke all on function private.vorta_refresh_demo_dataset_dates_phase1_internal(uuid, date)
  from public, anon, authenticated;
grant execute on function private.vorta_refresh_demo_dataset_dates_phase1_internal(uuid, date)
  to service_role;

comment on function private.vorta_refresh_demo_dataset_dates_phase1_internal(uuid, date) is
  'VOR-033 rolling phase-one refresh. Current operational work rolls with the demo anchor; source_system=vorta_demo_backtest rows are excluded from open/completed rankings so VOR-069 historical evidence remains immutable.';
