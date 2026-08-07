-- VOR-069 historical baseline for the Wrexham demo site.
-- Synthetic evidence is confined to 2024-01-01 through 2025-12-31 so it
-- cannot influence current operational calculations. Every row is tagged.

with assets as (
  select
    asset.id,
    asset.site_id,
    asset.equipment_code,
    asset.criticality,
    public.vorta_asset_score(asset.criticality) as asset_score
  from public.equipment_assets asset
  where asset.site_id = '11000000-0000-0000-0000-000000000001'::uuid
),
days as (
  select generate_series(
    date '2024-01-01',
    date '2025-12-31',
    interval '1 day'
  )::date as snapshot_date
),
features as (
  select
    asset.*,
    day.snapshot_date,
    mod(abs(hashtextextended(asset.equipment_code || ':' || day.snapshot_date::text || ':pm', 0)), 100)::integer as h_pm,
    mod(abs(hashtextextended(asset.equipment_code || ':' || day.snapshot_date::text || ':cal', 0)), 100)::integer as h_cal,
    mod(abs(hashtextextended(asset.equipment_code || ':' || day.snapshot_date::text || ':spares', 0)), 100)::integer as h_spares,
    mod(abs(hashtextextended(asset.equipment_code || ':' || day.snapshot_date::text || ':skills', 0)), 100)::integer as h_skills,
    mod(abs(hashtextextended(asset.equipment_code || ':' || day.snapshot_date::text || ':labour', 0)), 100)::integer as h_labour
  from assets asset
  cross join days day
),
drivers as (
  select
    features.*,
    case when h_pm < 7 then 3 when h_pm < 20 then 2 when h_pm < 42 then 1 else 0 end as overdue_pm_count,
    case when h_cal < 10 then 1 else 0 end as calibration_overdue_count,
    case when h_spares < 5 then 1 else 0 end as critical_spares_missing,
    case when h_pm < 7 then 84 when h_pm < 20 then 56 when h_pm < 42 then 28 else 0 end as pm_pct,
    case when h_cal < 10 then 35 else 0 end as cal_pct,
    case when h_spares < 5 then 100 when h_spares < 16 then 35 else 0 end as spares_pct,
    case when h_skills < 8 then 55 when h_skills < 25 then 30 else 10 end as skills_pct,
    (15 + mod(h_labour, 46))::numeric as labour_score
  from features
),
scored as (
  select
    drivers.*,
    round((
      drivers.pm_pct * 35
      + drivers.asset_score * 30
      + drivers.cal_pct * 20
      + drivers.spares_pct * 15
    )::numeric / 100, 1) as operational_score
  from drivers
),
final as (
  select
    scored.*,
    public.vorta_apply_equipment_labour_weight(
      scored.operational_score,
      scored.labour_score,
      scored.criticality,
      false
    )::integer as final_score
  from scored
)
insert into public.equipment_risk_history (
  equipment_id,
  snapshot_date,
  risk_score,
  risk_level,
  pm_backlog_pct,
  asset_criticality_pct,
  calibration_pct,
  skills_pct,
  spares_pct,
  overdue_pm_count,
  calibration_overdue_count,
  critical_spares_missing,
  snapshot_label,
  source_event,
  primary_driver,
  main_driver_pct,
  change_reason,
  captured_at,
  operational_risk_score,
  labour_risk_score,
  scheduled_engineer_count,
  labour_shift_type,
  risk_model_version,
  evidence_provenance,
  dataset_version,
  scenario_key,
  created_at
)
select
  final.id,
  final.snapshot_date,
  final.final_score,
  case
    when final.final_score >= 85 then 'Critical'
    when final.final_score >= 65 then 'High'
    when final.final_score >= 40 then 'Medium'
    when final.final_score >= 20 then 'Low'
    else 'Minimal'
  end,
  final.pm_pct,
  final.asset_score,
  final.cal_pct,
  final.skills_pct,
  final.spares_pct,
  final.overdue_pm_count,
  final.calibration_overdue_count,
  final.critical_spares_missing,
  to_char(final.snapshot_date, 'DD Mon YYYY'),
  'vor069_demo_history_v1',
  case greatest(
    final.pm_pct,
    final.asset_score,
    final.cal_pct,
    final.skills_pct,
    final.spares_pct
  )
    when final.pm_pct then 'PM Backlog'
    when final.asset_score then 'Asset Criticality'
    when final.cal_pct then 'Calibration'
    when final.skills_pct then 'Skills'
    else 'Spares'
  end,
  greatest(
    final.pm_pct,
    final.asset_score,
    final.cal_pct,
    final.skills_pct,
    final.spares_pct
  ),
  'Deterministic synthetic historical baseline for backtest demonstration; not imported SAP evidence.',
  (final.snapshot_date + time '12:00') at time zone 'Europe/London',
  final.operational_score,
  final.labour_score,
  2 + mod(final.h_labour, 3),
  case when mod(extract(doy from final.snapshot_date)::integer, 2) = 0 then 'day' else 'night' end,
  'vor069-canonical-demo-v1',
  'synthetic_demo',
  'vor069-historical-backtest-v1',
  null,
  (final.snapshot_date + time '12:00') at time zone 'Europe/London'
from final
on conflict (equipment_id, snapshot_date) do nothing;

with components as (
  select
    component.id as component_id,
    component.site_id,
    component.equipment_id,
    component.component_code,
    component.component_name,
    component.storage_location,
    coalesce(stock.plant_code, '1000') as plant_code,
    greatest(coalesce(component.minimum_quantity, 1), 0)::numeric as minimum_quantity,
    greatest(coalesce(component.quantity_target, 2), 1)::numeric as target_quantity
  from public.equipment_components component
  left join public.site_material_stock stock
    on stock.site_id = component.site_id
   and stock.material_number = component.component_code
  where component.site_id = '11000000-0000-0000-0000-000000000001'::uuid
),
days as (
  select generate_series(
    date '2024-01-01',
    date '2025-12-31',
    interval '1 day'
  )::date as snapshot_date
),
raw as (
  select
    component.*,
    day.snapshot_date,
    mod(abs(hashtextextended(component.component_code || ':' || day.snapshot_date::text || ':stock', 0)), 100)::integer as h
  from components component
  cross join days day
),
quantities as (
  select
    raw.*,
    case
      when raw.h < 3 then 0::numeric
      when raw.h < 15 then greatest(raw.minimum_quantity - 1, 0)
      else greatest(raw.target_quantity - mod(raw.h, 2), raw.minimum_quantity)
    end as unrestricted_quantity,
    case when mod(raw.h, 17) = 0 then 1::numeric else 0::numeric end as reserved_quantity
  from raw
),
final_stock as (
  select
    quantities.*,
    greatest(quantities.unrestricted_quantity - quantities.reserved_quantity, 0) as available_quantity
  from quantities
)
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
  final_stock.site_id,
  final_stock.equipment_id,
  final_stock.component_id,
  final_stock.component_code,
  final_stock.component_name,
  final_stock.plant_code,
  final_stock.storage_location,
  (final_stock.snapshot_date + time '06:00') at time zone 'Europe/London',
  final_stock.unrestricted_quantity,
  0,
  0,
  final_stock.reserved_quantity,
  final_stock.available_quantity,
  final_stock.minimum_quantity,
  final_stock.target_quantity,
  case
    when final_stock.available_quantity <= 0 then 'out_of_stock'
    when final_stock.available_quantity < final_stock.minimum_quantity then 'low_stock'
    else 'in_stock'
  end,
  'vorta_demo_backtest',
  final_stock.component_code || ':' || final_stock.snapshot_date::text || ':daily',
  (final_stock.snapshot_date + time '06:00') at time zone 'Europe/London',
  'synthetic_demo',
  'vor069-historical-backtest-v1',
  null,
  (final_stock.snapshot_date + time '06:00') at time zone 'Europe/London'
from final_stock
on conflict do nothing;

-- 30 deterministic completed maintenance events per Wrexham asset. They are
-- deliberately completed and pre-2026, and do not invent fault-library codes.
with assets as (
  select
    asset.*,
    row_number() over (order by asset.equipment_code) as asset_ordinal
  from public.equipment_assets asset
  where asset.site_id = '11000000-0000-0000-0000-000000000001'::uuid
),
events as (
  select
    asset.id as equipment_id,
    asset.site_id,
    asset.equipment_code,
    asset.name as equipment_name,
    asset.asset_ordinal,
    n,
    (date '2024-01-05' + mod((asset.asset_ordinal * 7 + n * 23)::integer, 720))::date as event_date,
    mod(abs(hashtextextended(asset.equipment_code || ':' || n::text || ':duration', 0)), 600)::integer as h_duration
  from assets asset
  cross join generate_series(1, 30) n
),
prepared as (
  select
    events.*,
    case
      when mod(n, 10) = 0 then 180 + h_duration
      when mod(n, 5) = 0 then 45 + mod(h_duration, 120)
      else 0
    end::integer as downtime_minutes,
    case
      when mod(n, 10) = 0 then 'Corrective'
      when mod(n, 5) = 0 then 'Corrective'
      when mod(n, 4) = 0 then 'Inspection'
      else 'Predictive'
    end as work_type,
    case
      when mod(n, 10) = 0 then 'HIGH'
      when mod(n, 5) = 0 then 'MEDIUM'
      else 'LOW'
    end as priority
  from events
)
insert into public.work_orders (
  equipment_id,
  wo_number,
  priority,
  description,
  work_type,
  status,
  assigned_engineer,
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
  prepared.equipment_id,
  'HIST-' || prepared.equipment_code || '-' || lpad(prepared.n::text, 3, '0'),
  prepared.priority,
  case
    when mod(prepared.n, 10) = 0 then prepared.equipment_name || ': historical unplanned stop investigated and equipment returned to service.'
    when mod(prepared.n, 5) = 0 then prepared.equipment_name || ': historical corrective adjustment completed following condition deviation.'
    when mod(prepared.n, 4) = 0 then prepared.equipment_name || ': historical inspection completed with condition findings recorded.'
    else prepared.equipment_name || ': historical predictive condition check completed and trend recorded.'
  end,
  prepared.work_type,
  'COMPLETED',
  null,
  prepared.event_date,
  prepared.event_date,
  prepared.event_date,
  'Historical',
  prepared.downtime_minutes,
  round(prepared.downtime_minutes::numeric / 60, 2),
  case
    when prepared.downtime_minutes > 0 then 'Returned to service after fault isolation and corrective work.'
    else 'Completed; condition recorded for historical trend analysis.'
  end,
  false,
  (prepared.event_date + time '07:00') at time zone 'Europe/London',
  (prepared.event_date + time '18:00') at time zone 'Europe/London',
  null,
  prepared.site_id,
  'vorta_demo_backtest',
  'vor069:' || prepared.equipment_code || ':' || lpad(prepared.n::text, 3, '0'),
  (prepared.event_date + time '18:00') at time zone 'Europe/London',
  case when prepared.work_type = 'Corrective' then 'PM02' else 'PM03' end,
  case when prepared.work_type = 'Corrective' then 'Corrective Maintenance' else 'Condition / Inspection Work' end,
  case when mod(prepared.n, 10) = 0 then 'BRKD' when prepared.work_type = 'Corrective' then 'CORR' else 'COND' end,
  case when mod(prepared.n, 10) = 0 then 'Breakdown response' when prepared.work_type = 'Corrective' then 'Corrective maintenance' else 'Condition monitoring' end,
  'Historical backtest dataset',
  prepared.priority,
  prepared.equipment_code,
  '1000',
  'MECH',
  'MAINT',
  prepared.event_date,
  prepared.event_date,
  (prepared.event_date + time '08:00') at time zone 'Europe/London',
  ((prepared.event_date + time '08:00') at time zone 'Europe/London') + greatest(prepared.downtime_minutes, 30) * interval '1 minute',
  (prepared.event_date + time '08:00') at time zone 'Europe/London',
  ((prepared.event_date + time '08:00') at time zone 'Europe/London') + greatest(prepared.downtime_minutes, 30) * interval '1 minute',
  ((prepared.event_date + time '08:00') at time zone 'Europe/London') + greatest(prepared.downtime_minutes, 30) * interval '1 minute',
  ((prepared.event_date + time '08:00') at time zone 'Europe/London') + greatest(prepared.downtime_minutes, 30) * interval '1 minute',
  array['TECO','CLSD']::text[],
  '{}'::text[],
  (prepared.event_date + time '07:00') at time zone 'Europe/London'
from prepared
on conflict (site_id, lower(btrim(wo_number))) do nothing;
