-- VOR-069 linked historical backtest scenarios.
-- 24 balanced scenarios: six stock-out-extended recoveries, six elevated-risk
-- breakdowns, six successful interventions and six retained false positives.

with ranked_assets as (
  select
    asset.id as equipment_id,
    asset.site_id,
    asset.equipment_code,
    row_number() over (
      order by
        case lower(coalesce(asset.criticality, ''))
          when 'critical' then 1
          when 'high' then 2
          when 'medium' then 3
          else 4
        end,
        asset.equipment_code
    ) as rn
  from public.equipment_assets asset
  where asset.site_id = '11000000-0000-0000-0000-000000000001'::uuid
    and exists (
      select 1
      from public.equipment_components component
      where component.equipment_id = asset.id
    )
),
selected as (
  select
    ranked.*,
    component.id as component_id,
    component.component_code,
    (date '2024-03-15' + ((ranked.rn - 1) * 26)::integer)::date as scenario_date,
    case mod((ranked.rn - 1)::integer, 4)
      when 0 then 'stockout_extended_recovery'
      when 1 then 'elevated_risk_breakdown'
      when 2 then 'successful_intervention'
      else 'false_positive'
    end as scenario_type
  from ranked_assets ranked
  join lateral (
    select component.*
    from public.equipment_components component
    where component.equipment_id = ranked.equipment_id
    order by
      case lower(coalesce(component.criticality, ''))
        when 'critical' then 1
        when 'high' then 2
        when 'medium' then 3
        else 4
      end,
      component.component_code
    limit 1
  ) component on true
  where ranked.rn <= 24
)
insert into private.vorta_demo_backtest_scenarios (
  site_id,
  scenario_key,
  scenario_type,
  equipment_id,
  component_id,
  material_number,
  warning_start_at,
  intervention_at,
  failure_at,
  stockout_start_at,
  stock_replenished_at,
  expected_warning_days,
  expected_classifications,
  risk_model_version,
  dataset_version,
  evidence_provenance,
  notes,
  active,
  updated_at
)
select
  selected.site_id,
  'vor069-' || lpad(selected.rn::text, 2, '0') || '-' || lower(selected.equipment_code),
  selected.scenario_type,
  selected.equipment_id,
  selected.component_id,
  selected.component_code,
  ((selected.scenario_date - 21)::date + time '08:00') at time zone 'Europe/London',
  case
    when selected.scenario_type = 'successful_intervention'
      then ((selected.scenario_date - 2)::date + time '09:00') at time zone 'Europe/London'
    else null
  end,
  case
    when selected.scenario_type in ('stockout_extended_recovery','elevated_risk_breakdown')
      then (selected.scenario_date + time '14:00') at time zone 'Europe/London'
    else null
  end,
  case
    when selected.scenario_type = 'stockout_extended_recovery'
      then ((selected.scenario_date - 14)::date + time '15:30') at time zone 'Europe/London'
    when selected.scenario_type = 'false_positive'
      then ((selected.scenario_date - 7)::date + time '11:00') at time zone 'Europe/London'
    else null
  end,
  case
    when selected.scenario_type = 'stockout_extended_recovery'
      then ((selected.scenario_date + 1)::date + time '00:30') at time zone 'Europe/London'
    when selected.scenario_type = 'false_positive'
      then ((selected.scenario_date + 1)::date + time '10:00') at time zone 'Europe/London'
    else null
  end,
  21,
  case selected.scenario_type
    when 'stockout_extended_recovery' then array[
      'elevated risk preceded breakdown',
      'stock-out preceded breakdown',
      'stock-out materially extended recovery'
    ]::text[]
    when 'elevated_risk_breakdown' then array[
      'elevated risk preceded breakdown',
      'intervention plausibly relevant'
    ]::text[]
    when 'successful_intervention' then array[
      'elevated risk preceded intervention',
      'intervention completed',
      'no subsequent breakdown in validation window'
    ]::text[]
    else array[
      'elevated risk without subsequent breakdown',
      'false positive retained for model validation'
    ]::text[]
  end,
  'vor069-canonical-demo-v1',
  'vor069-historical-backtest-v1',
  'synthetic_demo',
  case selected.scenario_type
    when 'stockout_extended_recovery'
      then 'Synthetic backtest scenario: critical spare unavailable before failure and issued after recovery delay.'
    when 'elevated_risk_breakdown'
      then 'Synthetic backtest scenario: elevated PM-driven risk precedes a later failure without a spare constraint.'
    when 'successful_intervention'
      then 'Synthetic backtest scenario: elevated risk is followed by an intervention and no later breakdown in the validation window.'
    else 'Synthetic backtest scenario retained as a false positive so the demonstration cannot be hindsight-only.'
  end,
  true,
  now()
from selected
on conflict (site_id, scenario_key) do update set
  scenario_type = excluded.scenario_type,
  equipment_id = excluded.equipment_id,
  component_id = excluded.component_id,
  material_number = excluded.material_number,
  warning_start_at = excluded.warning_start_at,
  intervention_at = excluded.intervention_at,
  failure_at = excluded.failure_at,
  stockout_start_at = excluded.stockout_start_at,
  stock_replenished_at = excluded.stock_replenished_at,
  expected_warning_days = excluded.expected_warning_days,
  expected_classifications = excluded.expected_classifications,
  risk_model_version = excluded.risk_model_version,
  dataset_version = excluded.dataset_version,
  evidence_provenance = excluded.evidence_provenance,
  notes = excluded.notes,
  active = excluded.active,
  updated_at = now();

-- Create historical outcome work orders for breakdown and intervention scenarios.
-- False-positive scenarios deliberately have no failure/work order.
insert into public.work_orders (
  equipment_id,
  wo_number,
  priority,
  description,
  work_type,
  status,
  requested_date,
  due_date,
  completed_date,
  age_label,
  downtime_minutes,
  mttr_hours,
  outcome,
  is_overdue,
  created_at,
  updated_at,
  fault_code,
  site_id,
  source_system,
  source_record_key,
  source_updated_at,
  order_type_code,
  order_type_description,
  maintenance_activity_type_code,
  maintenance_activity_type_description,
  order_origin,
  priority_code,
  functional_location_code,
  maintenance_plant,
  planner_group,
  main_work_center,
  basic_start_date,
  basic_finish_date,
  scheduled_start_at,
  scheduled_finish_at,
  actual_start_at,
  actual_finish_at,
  technical_completion_at,
  business_completion_at,
  system_status_codes,
  user_status_codes,
  source_created_at
)
select
  scenario.equipment_id,
  'BT-' || asset.equipment_code || '-' || substr(md5(scenario.scenario_key), 1, 6),
  case
    when scenario.scenario_type in ('stockout_extended_recovery','elevated_risk_breakdown') then 'HIGH'
    else 'MEDIUM'
  end,
  case scenario.scenario_type
    when 'stockout_extended_recovery'
      then asset.name || ': historical failure of ' || component.component_name || '; material availability constrained recovery.'
    when 'elevated_risk_breakdown'
      then asset.name || ': historical equipment failure after a period of elevated PM-driven risk.'
    else asset.name || ': historical condition-based intervention on ' || component.component_name || ' completed before failure.'
  end,
  case
    when scenario.scenario_type in ('stockout_extended_recovery','elevated_risk_breakdown') then 'Corrective'
    else 'Predictive'
  end,
  'COMPLETED',
  coalesce(scenario.failure_at, scenario.intervention_at)::date,
  coalesce(scenario.failure_at, scenario.intervention_at)::date,
  coalesce(
    case when scenario.scenario_type = 'stockout_extended_recovery' then scenario.stock_replenished_at::date end,
    coalesce(scenario.failure_at, scenario.intervention_at)::date
  ),
  'Historical backtest',
  case
    when scenario.scenario_type = 'stockout_extended_recovery'
      then greatest(120, extract(epoch from (scenario.stock_replenished_at + interval '2 hours' - scenario.failure_at)) / 60)::integer
    when scenario.scenario_type = 'elevated_risk_breakdown' then 180
    else 60
  end,
  case
    when scenario.scenario_type = 'stockout_extended_recovery'
      then round((extract(epoch from (scenario.stock_replenished_at + interval '2 hours' - scenario.failure_at)) / 3600)::numeric, 2)
    when scenario.scenario_type = 'elevated_risk_breakdown' then 3.0
    else 1.0
  end,
  case
    when scenario.scenario_type = 'stockout_extended_recovery'
      then 'Returned to service after replacement material became available and was fitted.'
    when scenario.scenario_type = 'elevated_risk_breakdown'
      then 'Returned to service after fault isolation and corrective repair.'
    else 'Intervention completed; no subsequent breakdown recorded in the scenario validation window.'
  end,
  false,
  coalesce(scenario.failure_at, scenario.intervention_at) - interval '1 hour',
  case
    when scenario.scenario_type = 'stockout_extended_recovery' then scenario.stock_replenished_at + interval '2 hours'
    else coalesce(scenario.failure_at, scenario.intervention_at) + interval '3 hours'
  end,
  null,
  scenario.site_id,
  'vorta_demo_backtest',
  'scenario:' || scenario.scenario_key,
  case
    when scenario.scenario_type = 'stockout_extended_recovery' then scenario.stock_replenished_at + interval '2 hours'
    else coalesce(scenario.failure_at, scenario.intervention_at) + interval '3 hours'
  end,
  case when scenario.scenario_type in ('stockout_extended_recovery','elevated_risk_breakdown') then 'PM02' else 'PM03' end,
  case when scenario.scenario_type in ('stockout_extended_recovery','elevated_risk_breakdown') then 'Corrective Maintenance' else 'Condition Intervention' end,
  case when scenario.scenario_type in ('stockout_extended_recovery','elevated_risk_breakdown') then 'BRKD' else 'PRED' end,
  case when scenario.scenario_type in ('stockout_extended_recovery','elevated_risk_breakdown') then 'Breakdown response' else 'Condition-based intervention' end,
  'Historical backtest dataset',
  case when scenario.scenario_type in ('stockout_extended_recovery','elevated_risk_breakdown') then 'HIGH' else 'MEDIUM' end,
  asset.equipment_code,
  '1000',
  'MECH',
  'MAINT',
  coalesce(scenario.failure_at, scenario.intervention_at)::date,
  coalesce(
    case when scenario.scenario_type = 'stockout_extended_recovery' then scenario.stock_replenished_at::date end,
    coalesce(scenario.failure_at, scenario.intervention_at)::date
  ),
  coalesce(scenario.failure_at, scenario.intervention_at),
  case
    when scenario.scenario_type = 'stockout_extended_recovery' then scenario.stock_replenished_at + interval '2 hours'
    else coalesce(scenario.failure_at, scenario.intervention_at) + interval '3 hours'
  end,
  coalesce(scenario.failure_at, scenario.intervention_at),
  case
    when scenario.scenario_type = 'stockout_extended_recovery' then scenario.stock_replenished_at + interval '2 hours'
    else coalesce(scenario.failure_at, scenario.intervention_at) + interval '3 hours'
  end,
  case
    when scenario.scenario_type = 'stockout_extended_recovery' then scenario.stock_replenished_at + interval '2 hours'
    else coalesce(scenario.failure_at, scenario.intervention_at) + interval '3 hours'
  end,
  case
    when scenario.scenario_type = 'stockout_extended_recovery' then scenario.stock_replenished_at + interval '2 hours'
    else coalesce(scenario.failure_at, scenario.intervention_at) + interval '3 hours'
  end,
  array['TECO','CLSD']::text[],
  '{}'::text[],
  coalesce(scenario.failure_at, scenario.intervention_at) - interval '1 hour'
from private.vorta_demo_backtest_scenarios scenario
join public.equipment_assets asset on asset.id = scenario.equipment_id
join public.equipment_components component on component.id = scenario.component_id
where scenario.dataset_version = 'vor069-historical-backtest-v1'
  and scenario.scenario_type in (
    'stockout_extended_recovery',
    'elevated_risk_breakdown',
    'successful_intervention'
  )
on conflict (site_id, lower(btrim(wo_number))) do nothing;

update private.vorta_demo_backtest_scenarios scenario
set work_order_id = work_order.id,
    updated_at = now()
from public.work_orders work_order
where work_order.site_id = scenario.site_id
  and work_order.source_system = 'vorta_demo_backtest'
  and work_order.source_record_key = 'scenario:' || scenario.scenario_key
  and scenario.dataset_version = 'vor069-historical-backtest-v1';

-- Overlay the daily risk history with explicit warning windows. This uses the
-- same canonical asset and labour helpers as the live risk model.
with scenario_windows as (
  select
    scenario.*,
    case
      when scenario.scenario_type in ('stockout_extended_recovery','elevated_risk_breakdown') then scenario.failure_at::date
      when scenario.scenario_type = 'successful_intervention' then scenario.intervention_at::date
      else scenario.warning_start_at::date + 28
    end as high_risk_end_date
  from private.vorta_demo_backtest_scenarios scenario
  where scenario.dataset_version = 'vor069-historical-backtest-v1'
),
candidate as (
  select
    history.id,
    scenario.scenario_key,
    scenario.scenario_type,
    asset.criticality,
    public.vorta_asset_score(asset.criticality) as asset_score,
    history.labour_risk_score,
    case when scenario.scenario_type in ('stockout_extended_recovery','false_positive') then 100 else 0 end as new_spares_pct,
    case when scenario.scenario_type in ('stockout_extended_recovery','false_positive') then 1 else 0 end as new_spares_missing,
    case when scenario.scenario_type = 'stockout_extended_recovery' then 56 else 84 end as new_pm_pct,
    case when scenario.scenario_type = 'stockout_extended_recovery' then 2 else 3 end as new_overdue_pm_count
  from public.equipment_risk_history history
  join scenario_windows scenario
    on scenario.equipment_id = history.equipment_id
   and history.snapshot_date between scenario.warning_start_at::date and scenario.high_risk_end_date
  join public.equipment_assets asset on asset.id = history.equipment_id
),
scored as (
  select
    candidate.*,
    round((candidate.new_pm_pct * 35 + candidate.asset_score * 30 + candidate.new_spares_pct * 15)::numeric / 100, 1) as new_operational
  from candidate
)
update public.equipment_risk_history history
set
  pm_backlog_pct = scored.new_pm_pct,
  asset_criticality_pct = scored.asset_score,
  calibration_pct = 0,
  spares_pct = scored.new_spares_pct,
  overdue_pm_count = scored.new_overdue_pm_count,
  calibration_overdue_count = 0,
  critical_spares_missing = scored.new_spares_missing,
  operational_risk_score = scored.new_operational,
  risk_score = public.vorta_apply_equipment_labour_weight(
    scored.new_operational,
    coalesce(scored.labour_risk_score, 25),
    scored.criticality,
    false
  ),
  risk_level = case
    when public.vorta_apply_equipment_labour_weight(scored.new_operational, coalesce(scored.labour_risk_score, 25), scored.criticality, false) >= 85 then 'Critical'
    when public.vorta_apply_equipment_labour_weight(scored.new_operational, coalesce(scored.labour_risk_score, 25), scored.criticality, false) >= 65 then 'High'
    when public.vorta_apply_equipment_labour_weight(scored.new_operational, coalesce(scored.labour_risk_score, 25), scored.criticality, false) >= 40 then 'Medium'
    when public.vorta_apply_equipment_labour_weight(scored.new_operational, coalesce(scored.labour_risk_score, 25), scored.criticality, false) >= 20 then 'Low'
    else 'Minimal'
  end,
  primary_driver = case when scored.new_spares_pct > scored.new_pm_pct then 'Spares' else 'PM Backlog' end,
  main_driver_pct = greatest(scored.new_spares_pct, scored.new_pm_pct, scored.asset_score),
  change_reason = 'VOR-069 synthetic scenario warning window; evidence retained for historical backtest validation.',
  risk_model_version = 'vor069-canonical-demo-v1',
  evidence_provenance = 'synthetic_demo',
  dataset_version = 'vor069-historical-backtest-v1',
  scenario_key = scored.scenario_key,
  source_event = 'vor069_scenario_warning'
from scored
where history.id = scored.id;

-- For successful-intervention scenarios, clear the actionable drivers for a
-- 30-day validation window. This deliberately creates positive controls.
with success as (
  select
    scenario.*,
    asset.criticality,
    public.vorta_asset_score(asset.criticality) as asset_score
  from private.vorta_demo_backtest_scenarios scenario
  join public.equipment_assets asset on asset.id = scenario.equipment_id
  where scenario.dataset_version = 'vor069-historical-backtest-v1'
    and scenario.scenario_type = 'successful_intervention'
),
rows_to_lower as (
  select
    history.id,
    success.scenario_key,
    success.criticality,
    success.asset_score,
    history.labour_risk_score,
    round((success.asset_score * 30)::numeric / 100, 1) as new_operational
  from success
  join public.equipment_risk_history history
    on history.equipment_id = success.equipment_id
   and history.snapshot_date between success.intervention_at::date and success.intervention_at::date + 30
)
update public.equipment_risk_history history
set
  pm_backlog_pct = 0,
  calibration_pct = 0,
  spares_pct = 0,
  overdue_pm_count = 0,
  calibration_overdue_count = 0,
  critical_spares_missing = 0,
  operational_risk_score = rows_to_lower.new_operational,
  risk_score = public.vorta_apply_equipment_labour_weight(
    rows_to_lower.new_operational,
    coalesce(rows_to_lower.labour_risk_score, 20),
    rows_to_lower.criticality,
    false
  ),
  risk_level = case
    when public.vorta_apply_equipment_labour_weight(rows_to_lower.new_operational, coalesce(rows_to_lower.labour_risk_score, 20), rows_to_lower.criticality, false) >= 85 then 'Critical'
    when public.vorta_apply_equipment_labour_weight(rows_to_lower.new_operational, coalesce(rows_to_lower.labour_risk_score, 20), rows_to_lower.criticality, false) >= 65 then 'High'
    when public.vorta_apply_equipment_labour_weight(rows_to_lower.new_operational, coalesce(rows_to_lower.labour_risk_score, 20), rows_to_lower.criticality, false) >= 40 then 'Medium'
    when public.vorta_apply_equipment_labour_weight(rows_to_lower.new_operational, coalesce(rows_to_lower.labour_risk_score, 20), rows_to_lower.criticality, false) >= 20 then 'Low'
    else 'Minimal'
  end,
  primary_driver = 'Asset Criticality',
  main_driver_pct = rows_to_lower.asset_score,
  change_reason = 'VOR-069 synthetic successful intervention; risk drivers cleared for 30-day validation window.',
  scenario_key = rows_to_lower.scenario_key,
  source_event = 'vor069_scenario_post_intervention'
from rows_to_lower
where history.id = rows_to_lower.id;

-- Exact sub-day risk events. Daily history remains one row per asset/day for
-- chart compatibility; this table supplies forensic event ordering.
insert into public.equipment_risk_event_history (
  site_id,
  equipment_id,
  captured_at,
  risk_score,
  risk_level,
  operational_risk_score,
  labour_risk_score,
  pm_backlog_pct,
  asset_criticality_pct,
  calibration_pct,
  skills_pct,
  spares_pct,
  overdue_pm_count,
  calibration_overdue_count,
  critical_spares_missing,
  primary_driver,
  source_event,
  risk_model_version,
  evidence_provenance,
  dataset_version,
  scenario_key,
  created_at
)
select
  scenario.site_id,
  scenario.equipment_id,
  event.captured_at,
  event.risk_score,
  case
    when event.risk_score >= 85 then 'Critical'
    when event.risk_score >= 65 then 'High'
    when event.risk_score >= 40 then 'Medium'
    when event.risk_score >= 20 then 'Low'
    else 'Minimal'
  end,
  event.operational_risk_score,
  25,
  event.pm_pct,
  public.vorta_asset_score(asset.criticality),
  0,
  15,
  event.spares_pct,
  event.overdue_pm_count,
  0,
  event.spares_missing,
  event.primary_driver,
  event.source_event,
  'vor069-canonical-demo-v1',
  'synthetic_demo',
  'vor069-historical-backtest-v1',
  scenario.scenario_key,
  event.captured_at
from private.vorta_demo_backtest_scenarios scenario
join public.equipment_assets asset on asset.id = scenario.equipment_id
cross join lateral (
  values
    (
      scenario.warning_start_at,
      72,
      66::numeric,
      case when scenario.scenario_type = 'stockout_extended_recovery' then 56 else 84 end,
      case when scenario.scenario_type in ('stockout_extended_recovery','false_positive') then 100 else 0 end,
      case when scenario.scenario_type = 'stockout_extended_recovery' then 2 else 3 end,
      case when scenario.scenario_type in ('stockout_extended_recovery','false_positive') then 1 else 0 end,
      case when scenario.scenario_type in ('stockout_extended_recovery','false_positive') then 'Spares' else 'PM Backlog' end,
      'scenario_warning_start'
    ),
    (
      coalesce(scenario.failure_at, scenario.intervention_at, scenario.warning_start_at + interval '21 days') - interval '1 hour',
      case when scenario.scenario_type = 'successful_intervention' then 78 else 82 end,
      case when scenario.scenario_type = 'successful_intervention' then 72::numeric else 76::numeric end,
      case when scenario.scenario_type = 'stockout_extended_recovery' then 56 else 84 end,
      case when scenario.scenario_type in ('stockout_extended_recovery','false_positive') then 100 else 0 end,
      case when scenario.scenario_type = 'stockout_extended_recovery' then 2 else 3 end,
      case when scenario.scenario_type in ('stockout_extended_recovery','false_positive') then 1 else 0 end,
      case when scenario.scenario_type in ('stockout_extended_recovery','false_positive') then 'Spares' else 'PM Backlog' end,
      'scenario_pre_outcome'
    )
) as event(
  captured_at,
  risk_score,
  operational_risk_score,
  pm_pct,
  spares_pct,
  overdue_pm_count,
  spares_missing,
  primary_driver,
  source_event
)
where scenario.dataset_version = 'vor069-historical-backtest-v1'
on conflict do nothing;

insert into public.equipment_risk_event_history (
  site_id,
  equipment_id,
  captured_at,
  risk_score,
  risk_level,
  operational_risk_score,
  labour_risk_score,
  pm_backlog_pct,
  asset_criticality_pct,
  calibration_pct,
  skills_pct,
  spares_pct,
  overdue_pm_count,
  calibration_overdue_count,
  critical_spares_missing,
  primary_driver,
  source_event,
  risk_model_version,
  evidence_provenance,
  dataset_version,
  scenario_key,
  created_at
)
select
  scenario.site_id,
  scenario.equipment_id,
  scenario.intervention_at + interval '1 hour',
  32,
  'Low',
  28,
  20,
  0,
  public.vorta_asset_score(asset.criticality),
  0,
  15,
  0,
  0,
  0,
  0,
  'Asset Criticality',
  'scenario_post_intervention',
  'vor069-canonical-demo-v1',
  'synthetic_demo',
  'vor069-historical-backtest-v1',
  scenario.scenario_key,
  scenario.intervention_at + interval '1 hour'
from private.vorta_demo_backtest_scenarios scenario
join public.equipment_assets asset on asset.id = scenario.equipment_id
where scenario.dataset_version = 'vor069-historical-backtest-v1'
  and scenario.scenario_type = 'successful_intervention'
on conflict do nothing;

-- Force the daily material history to the scenario stock-out state during the
-- relevant windows, retaining exact event snapshots below.
update public.site_material_stock_history history
set
  unrestricted_quantity = 0,
  reserved_quantity = 0,
  available_quantity = 0,
  stock_status = 'out_of_stock',
  scenario_key = scenario.scenario_key,
  source_record_key = history.material_number || ':' || history.snapshot_at::date::text || ':scenario',
  source_updated_at = history.snapshot_at
from private.vorta_demo_backtest_scenarios scenario
where history.component_id = scenario.component_id
  and scenario.dataset_version = 'vor069-historical-backtest-v1'
  and scenario.stockout_start_at is not null
  and scenario.stock_replenished_at is not null
  and history.snapshot_at >= scenario.stockout_start_at
  and history.snapshot_at < scenario.stock_replenished_at;

-- Exact stock-out/failure/replenishment events for delayed-recovery scenarios.
insert into public.site_material_stock_history (
  site_id,
  equipment_id,
  component_id,
  material_number,
  material_description,
  plant_code,
  storage_location,
  snapshot_at,
  unrestricted_quantity,
  quality_inspection_quantity,
  blocked_quantity,
  reserved_quantity,
  available_quantity,
  minimum_quantity,
  target_quantity,
  stock_status,
  source_system,
  source_record_key,
  source_updated_at,
  evidence_provenance,
  dataset_version,
  scenario_key,
  created_at
)
select
  scenario.site_id,
  scenario.equipment_id,
  scenario.component_id,
  component.component_code,
  component.component_name,
  coalesce(stock.plant_code, '1000'),
  component.storage_location,
  event.snapshot_at,
  event.qty,
  0,
  0,
  0,
  event.qty,
  greatest(coalesce(component.minimum_quantity, 1), 0),
  greatest(coalesce(component.quantity_target, 2), 1),
  case when event.qty <= 0 then 'out_of_stock' else 'in_stock' end,
  'vorta_demo_backtest',
  scenario.scenario_key || ':' || event.event_key,
  event.snapshot_at,
  'synthetic_demo',
  'vor069-historical-backtest-v1',
  scenario.scenario_key,
  event.snapshot_at
from private.vorta_demo_backtest_scenarios scenario
join public.equipment_components component on component.id = scenario.component_id
left join lateral (
  select material_stock.plant_code
  from public.site_material_stock material_stock
  where material_stock.site_id = scenario.site_id
    and material_stock.material_number = component.component_code
  order by material_stock.storage_location
  limit 1
) stock on true
cross join lateral (
  values
    (scenario.stockout_start_at, 0::numeric, 'stockout_start'::text),
    (scenario.failure_at, 0::numeric, 'failure_state'::text),
    (scenario.stock_replenished_at, 1::numeric, 'replenished'::text)
) as event(snapshot_at, qty, event_key)
where scenario.dataset_version = 'vor069-historical-backtest-v1'
  and scenario.scenario_type = 'stockout_extended_recovery'
  and event.snapshot_at is not null
on conflict do nothing;

-- False-positive stock-outs are retained as negative controls and have no
-- failure work order by design.
insert into public.site_material_stock_history (
  site_id,
  equipment_id,
  component_id,
  material_number,
  material_description,
  plant_code,
  storage_location,
  snapshot_at,
  unrestricted_quantity,
  quality_inspection_quantity,
  blocked_quantity,
  reserved_quantity,
  available_quantity,
  minimum_quantity,
  target_quantity,
  stock_status,
  source_system,
  source_record_key,
  source_updated_at,
  evidence_provenance,
  dataset_version,
  scenario_key,
  created_at
)
select
  scenario.site_id,
  scenario.equipment_id,
  scenario.component_id,
  component.component_code,
  component.component_name,
  coalesce(stock.plant_code, '1000'),
  component.storage_location,
  event.snapshot_at,
  event.qty,
  0,
  0,
  0,
  event.qty,
  greatest(coalesce(component.minimum_quantity, 1), 0),
  greatest(coalesce(component.quantity_target, 2), 1),
  case when event.qty <= 0 then 'out_of_stock' else 'in_stock' end,
  'vorta_demo_backtest',
  scenario.scenario_key || ':' || event.event_key,
  event.snapshot_at,
  'synthetic_demo',
  'vor069-historical-backtest-v1',
  scenario.scenario_key,
  event.snapshot_at
from private.vorta_demo_backtest_scenarios scenario
join public.equipment_components component on component.id = scenario.component_id
left join lateral (
  select material_stock.plant_code
  from public.site_material_stock material_stock
  where material_stock.site_id = scenario.site_id
    and material_stock.material_number = component.component_code
  order by material_stock.storage_location
  limit 1
) stock on true
cross join lateral (
  values
    (scenario.stockout_start_at, 0::numeric, 'false_positive_stockout'::text),
    (scenario.stock_replenished_at, 1::numeric, 'false_positive_replenished'::text)
) as event(snapshot_at, qty, event_key)
where scenario.dataset_version = 'vor069-historical-backtest-v1'
  and scenario.scenario_type = 'false_positive'
  and event.snapshot_at is not null
on conflict do nothing;
