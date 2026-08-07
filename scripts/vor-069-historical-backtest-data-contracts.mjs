import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const schema = read("supabase/migrations/20260807215524_vor_069_historical_backtest_schema.sql");
const baseline = read("supabase/migrations/20260807215601_vor_069_historical_backtest_baseline.sql");
const scenarios = read("supabase/migrations/20260807215912_vor_069_historical_backtest_scenario_core.sql");
const health = read("supabase/migrations/20260807215938_vor_069_historical_backtest_evidence_health.sql");
const all = [schema, baseline, scenarios, health].join("\n");

assert.match(schema, /create table if not exists public\.equipment_risk_event_history/i);
assert.match(schema, /create table if not exists public\.site_material_stock_history/i);
assert.match(schema, /create table if not exists private\.vorta_demo_backtest_scenarios/i);
assert.match(schema, /captured_at timestamptz not null/i);
assert.match(schema, /snapshot_at timestamptz not null/i);
assert.match(schema, /private\.vorta_rls_has_site_access\(site_id, false\)/i);
assert.match(schema, /evidence_provenance text not null/i);
assert.match(schema, /dataset_version text not null/i);
assert.match(schema, /revoke insert, update, delete, truncate, references, trigger[\s\S]*authenticated/i);

assert.match(baseline, /date '2024-01-01'/i);
assert.match(baseline, /date '2025-12-31'/i);
assert.doesNotMatch(baseline, /generate_series\([\s\S]{0,100}date '2026-/i);
assert.match(baseline, /'synthetic_demo'/i);
assert.match(baseline, /'vor069-historical-backtest-v1'/i);
assert.match(baseline, /'vorta_demo_backtest'/i);
assert.match(baseline, /public\.vorta_apply_equipment_labour_weight/i);
assert.match(baseline, /public\.vorta_asset_score/i);
assert.match(baseline, /'COMPLETED'/i);
assert.match(baseline, /not imported SAP evidence/i);
assert.doesNotMatch(baseline, /'OPEN'/i);

for (const scenarioType of [
  "stockout_extended_recovery",
  "elevated_risk_breakdown",
  "successful_intervention",
  "false_positive",
]) {
  assert.match(scenarios, new RegExp(`'${scenarioType}'`, "i"));
}

assert.match(scenarios, /scenario_warning_start/i);
assert.match(scenarios, /scenario_pre_outcome/i);
assert.match(scenarios, /scenario_post_intervention/i);
assert.match(scenarios, /false positive retained for model validation/i);
assert.match(scenarios, /event-driven|sub-day|Exact sub-day/i);
assert.match(scenarios, /stockout_start/i);
assert.match(scenarios, /failure_state/i);
assert.match(scenarios, /replenished/i);
assert.match(scenarios, /false-positive stock-outs|False-positive stock-outs/i);
assert.doesNotMatch(scenarios, /would have prevented/i);

assert.match(health, /reservation_status,[\s\S]*'issued'/i);
assert.match(health, /'261'/i);
assert.match(health, /vorta_get_historical_backtest_dataset_health_internal/i);
assert.match(health, /stockout_link_failures/i);
assert.match(health, /missing_risk_timestamps/i);
assert.match(health, /missing_event_timestamps/i);
assert.match(health, /missing_stock_timestamps/i);
assert.match(health, /missing_scenario_work_orders/i);
assert.match(health, /synthetic_risk_rows_in_live_period/i);
assert.match(health, /synthetic_stock_rows_in_live_period/i);
assert.match(health, /daily_risk_rows >= 25000/i);
assert.match(health, /stock_history_rows >= 120000/i);
assert.match(health, /historical_work_orders >= 1000/i);
assert.match(health, /scenario_count >= 24/i);
assert.match(health, /raise exception 'VOR-069 historical dataset health contract failed/i);
assert.match(health, /grant execute[\s\S]*service_role/i);
assert.doesNotMatch(health, /grant execute[\s\S]*authenticated/i);

assert.match(all, /risk_model_version/i);
assert.match(all, /evidence_provenance/i);
assert.match(all, /dataset_version/i);
assert.doesNotMatch(all, /would have prevented/i);

console.log("VOR-069 historical backtest data contracts passed.");
