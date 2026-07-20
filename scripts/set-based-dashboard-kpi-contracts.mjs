import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260720100000_set_based_dashboard_kpis.sql",
    import.meta.url,
  ),
  "utf8",
);

for (const expected of [
  "private.vorta_get_risk_dashboard_scope_kpis_set_based",
  "site_context as materialized",
  "anchor_plan_facts as materialized",
  "plan_facts as materialized",
  "daily_anchor_candidates as materialized",
  "scope_periods as materialized",
  "windows as materialized",
  "plan_aggregates as materialized",
  "transition_per_equipment as materialized",
  "skill_event_aggregates as materialized",
  "window_evidence as materialized",
  "metric_rows as materialized",
  "current_date - 14",
  "date '2026-06-30'",
  "legacy_output is distinct from candidate_output",
  "from private.vorta_get_risk_dashboard_scope_kpis_set_based(p_anchor_date)",
]) {
  assert.ok(migration.includes(expected), `Missing set-based KPI contract: ${expected}`);
}

const candidateStart = migration.indexOf(
  "create or replace function private.vorta_get_risk_dashboard_scope_kpis_set_based",
);
const candidateEnd = migration.indexOf(
  "revoke all on function private.vorta_get_risk_dashboard_scope_kpis_set_based",
);
assert.ok(candidateStart >= 0 && candidateEnd > candidateStart);
const candidateBody = migration.slice(candidateStart, candidateEnd);

assert.doesNotMatch(
  candidateBody,
  /vorta_get_scoped_risk_reduction_kpis_internal/,
  "The batch path must not fan out through the legacy scoped calculator",
);
assert.doesNotMatch(
  candidateBody,
  /cross join lateral public\.vorta_get_/,
  "The batch path must aggregate shared facts instead of invoking RPCs per row",
);
assert.match(candidateBody, /period_definitions\(period_key, display_order\)/);
assert.match(candidateBody, /\('daily'::text, 1\)/);
assert.match(candidateBody, /\('weekly'::text, 2\)/);
assert.match(candidateBody, /\('monthly'::text, 3\)/);
assert.match(candidateBody, /\('ytd'::text, 4\)/);

for (const metric of [
  "risk_reduction_achieved",
  "risk_reduction_plan_attainment",
  "high_critical_risks_eliminated",
  "priority_actions_completed_on_time",
  "skills_risk_change",
  "critical_parts_readiness",
]) {
  assert.ok(candidateBody.includes(`'${metric}'::text`), `Missing KPI metric: ${metric}`);
}

console.log("Set-based dashboard KPI contracts passed.");
