-- VOR-069 evidence linkage and permanent dataset-health gate.
-- Stock-out recovery scenarios use canonical reservation and 261 goods-movement
-- evidence. The health function is private/service-role only.

insert into public.work_order_material_reservations (
  site_id,
  work_order_id,
  component_id,
  material_number,
  reservation_number,
  reservation_item,
  requirement_date,
  required_quantity,
  reserved_quantity,
  withdrawn_quantity,
  base_unit,
  storage_location,
  reservation_status,
  final_issue,
  source_system,
  source_record_key,
  source_updated_at,
  created_at,
  updated_at
)
select
  scenario.site_id,
  scenario.work_order_id,
  scenario.component_id,
  scenario.material_number,
  'RSV-' || substr(md5(scenario.scenario_key), 1, 8),
  '001',
  scenario.failure_at::date,
  1,
  0,
  1,
  'EA',
  component.storage_location,
  'issued',
  true,
  'vorta_demo_backtest',
  'reservation:' || scenario.scenario_key,
  scenario.stock_replenished_at,
  scenario.failure_at - interval '30 minutes',
  scenario.stock_replenished_at
from private.vorta_demo_backtest_scenarios scenario
join public.equipment_components component on component.id = scenario.component_id
where scenario.dataset_version = 'vor069-historical-backtest-v1'
  and scenario.scenario_type = 'stockout_extended_recovery'
  and scenario.work_order_id is not null
on conflict (site_id, work_order_id, material_number, reservation_item) do nothing;

insert into public.work_order_goods_movements (
  site_id,
  work_order_id,
  work_order_reservation_id,
  component_id,
  material_document_number,
  material_document_year,
  document_item,
  movement_type,
  posting_date,
  document_date,
  entry_timestamp,
  material_number,
  material_description,
  quantity,
  base_unit,
  debit_credit_indicator,
  plant_code,
  storage_location,
  reservation_number,
  reservation_item,
  entered_by,
  reversal,
  source_system,
  source_record_key,
  source_updated_at,
  created_at,
  updated_at
)
select
  scenario.site_id,
  scenario.work_order_id,
  reservation.id,
  scenario.component_id,
  '49' || substr(md5(scenario.scenario_key), 1, 8),
  extract(year from scenario.stock_replenished_at)::integer::text,
  '001',
  '261',
  scenario.stock_replenished_at::date,
  scenario.stock_replenished_at::date,
  scenario.stock_replenished_at,
  scenario.material_number,
  component.component_name,
  1,
  'EA',
  'S',
  coalesce(stock.plant_code, '1000'),
  component.storage_location,
  reservation.reservation_number,
  reservation.reservation_item,
  'HIST-SYSTEM',
  false,
  'vorta_demo_backtest',
  'movement:' || scenario.scenario_key,
  scenario.stock_replenished_at,
  scenario.stock_replenished_at,
  scenario.stock_replenished_at
from private.vorta_demo_backtest_scenarios scenario
join public.equipment_components component on component.id = scenario.component_id
join public.work_order_material_reservations reservation
  on reservation.work_order_id = scenario.work_order_id
 and reservation.material_number = scenario.material_number
 and reservation.source_system = 'vorta_demo_backtest'
left join lateral (
  select material_stock.plant_code
  from public.site_material_stock material_stock
  where material_stock.site_id = scenario.site_id
    and material_stock.material_number = scenario.material_number
  order by material_stock.storage_location
  limit 1
) stock on true
where scenario.dataset_version = 'vor069-historical-backtest-v1'
  and scenario.scenario_type = 'stockout_extended_recovery'
  and scenario.work_order_id is not null
on conflict (site_id, source_system, source_record_key) do nothing;

create or replace function private.vorta_get_historical_backtest_dataset_health_internal(
  p_site_id uuid,
  p_dataset_version text default 'vor069-historical-backtest-v1'
)
returns jsonb
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'private'
as $function$
with metrics as (
  select
    (
      select count(*)
      from public.equipment_risk_history history
      join public.equipment_assets asset on asset.id = history.equipment_id
      where asset.site_id = p_site_id
        and history.dataset_version = p_dataset_version
    )::integer as daily_risk_rows,
    (
      select count(*)
      from public.equipment_risk_event_history history
      where history.site_id = p_site_id
        and history.dataset_version = p_dataset_version
    )::integer as event_risk_rows,
    (
      select count(*)
      from public.site_material_stock_history history
      where history.site_id = p_site_id
        and history.dataset_version = p_dataset_version
    )::integer as stock_history_rows,
    (
      select count(*)
      from public.work_orders work_order
      where work_order.site_id = p_site_id
        and work_order.source_system = 'vorta_demo_backtest'
        and work_order.requested_date < date '2026-01-01'
    )::integer as historical_work_orders,
    (
      select count(*)
      from public.work_orders work_order
      where work_order.site_id = p_site_id
        and work_order.source_system = 'vorta_demo_backtest'
        and work_order.requested_date < date '2026-01-01'
        and coalesce(work_order.downtime_minutes, 0) >= 60
        and work_order.actual_start_at is not null
    )::integer as breakdown_candidates,
    (
      select count(*)
      from private.vorta_demo_backtest_scenarios scenario
      where scenario.site_id = p_site_id
        and scenario.dataset_version = p_dataset_version
        and scenario.active
    )::integer as scenario_count,
    (
      select count(*)
      from public.equipment_risk_history history
      join public.equipment_assets asset on asset.id = history.equipment_id
      where asset.site_id = p_site_id
        and history.dataset_version = p_dataset_version
        and history.captured_at is null
    )::integer as missing_risk_timestamps,
    (
      select count(*)
      from public.equipment_risk_event_history history
      where history.site_id = p_site_id
        and history.dataset_version = p_dataset_version
        and history.captured_at is null
    )::integer as missing_event_timestamps,
    (
      select count(*)
      from public.site_material_stock_history history
      where history.site_id = p_site_id
        and history.dataset_version = p_dataset_version
        and history.snapshot_at is null
    )::integer as missing_stock_timestamps,
    (
      select count(*)
      from private.vorta_demo_backtest_scenarios scenario
      left join public.work_orders work_order
        on work_order.id = scenario.work_order_id
       and work_order.site_id = scenario.site_id
      where scenario.site_id = p_site_id
        and scenario.dataset_version = p_dataset_version
        and scenario.scenario_type in (
          'stockout_extended_recovery',
          'elevated_risk_breakdown',
          'successful_intervention'
        )
        and work_order.id is null
    )::integer as missing_scenario_work_orders,
    (
      select count(*)
      from private.vorta_demo_backtest_scenarios scenario
      where scenario.site_id = p_site_id
        and scenario.dataset_version = p_dataset_version
        and scenario.scenario_type = 'stockout_extended_recovery'
        and (
          not exists (
            select 1
            from public.work_order_material_reservations reservation
            where reservation.work_order_id = scenario.work_order_id
              and reservation.material_number = scenario.material_number
              and reservation.source_system = 'vorta_demo_backtest'
          )
          or not exists (
            select 1
            from public.work_order_goods_movements movement
            where movement.work_order_id = scenario.work_order_id
              and movement.material_number = scenario.material_number
              and movement.source_system = 'vorta_demo_backtest'
              and movement.entry_timestamp >= scenario.failure_at
          )
        )
    )::integer as stockout_link_failures,
    (
      select count(*)
      from public.equipment_risk_history history
      join public.equipment_assets asset on asset.id = history.equipment_id
      where asset.site_id = p_site_id
        and history.dataset_version = p_dataset_version
        and history.snapshot_date >= date '2026-01-01'
    )::integer as synthetic_risk_rows_in_live_period,
    (
      select count(*)
      from public.site_material_stock_history history
      where history.site_id = p_site_id
        and history.dataset_version = p_dataset_version
        and history.snapshot_at >= timestamptz '2026-01-01 00:00:00+00'
    )::integer as synthetic_stock_rows_in_live_period
),
types as (
  select jsonb_object_agg(scenario_type, scenario_count) as by_type
  from (
    select
      scenario_type,
      count(*)::integer as scenario_count
    from private.vorta_demo_backtest_scenarios
    where site_id = p_site_id
      and dataset_version = p_dataset_version
      and active
    group by scenario_type
  ) typed
)
select jsonb_build_object(
  'healthy',
    daily_risk_rows >= 25000
    and event_risk_rows >= 54
    and stock_history_rows >= 120000
    and historical_work_orders >= 1000
    and breakdown_candidates >= 100
    and scenario_count >= 24
    and missing_risk_timestamps = 0
    and missing_event_timestamps = 0
    and missing_stock_timestamps = 0
    and missing_scenario_work_orders = 0
    and stockout_link_failures = 0
    and synthetic_risk_rows_in_live_period = 0
    and synthetic_stock_rows_in_live_period = 0,
  'datasetVersion', p_dataset_version,
  'dailyRiskRows', daily_risk_rows,
  'eventRiskRows', event_risk_rows,
  'stockHistoryRows', stock_history_rows,
  'historicalWorkOrders', historical_work_orders,
  'breakdownCandidates', breakdown_candidates,
  'scenarioCount', scenario_count,
  'scenarioTypes', coalesce(types.by_type, '{}'::jsonb),
  'missingRiskTimestamps', missing_risk_timestamps,
  'missingEventTimestamps', missing_event_timestamps,
  'missingStockTimestamps', missing_stock_timestamps,
  'missingScenarioWorkOrders', missing_scenario_work_orders,
  'stockoutLinkFailures', stockout_link_failures,
  'syntheticRiskRowsInLivePeriod', synthetic_risk_rows_in_live_period,
  'syntheticStockRowsInLivePeriod', synthetic_stock_rows_in_live_period
)
from metrics
cross join types;
$function$;

revoke all on function private.vorta_get_historical_backtest_dataset_health_internal(uuid, text)
  from public, anon, authenticated;
grant execute on function private.vorta_get_historical_backtest_dataset_health_internal(uuid, text)
  to service_role;

-- Migration-level fail-closed verification. A partial or misleading historical
-- dataset must not be accepted silently.
do $block$
declare
  v_health jsonb;
begin
  v_health := private.vorta_get_historical_backtest_dataset_health_internal(
    '11000000-0000-0000-0000-000000000001'::uuid,
    'vor069-historical-backtest-v1'
  );

  if not coalesce((v_health ->> 'healthy')::boolean, false) then
    raise exception 'VOR-069 historical dataset health contract failed: %', v_health;
  end if;
end;
$block$;
