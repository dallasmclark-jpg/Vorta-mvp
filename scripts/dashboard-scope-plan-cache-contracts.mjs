import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260720110000_cache_dashboard_scope_plans.sql",
    import.meta.url,
  ),
  "utf8",
);

for (const expected of [
  "private.vorta_dashboard_scope_plan_cache",
  "private.vorta_calculate_risk_dashboard_scope_plans",
  "private.vorta_refresh_dashboard_scope_plan_cache",
  "legacy_dashboard_scope_plans",
  "Dashboard scope-plan cache differs from the legacy output",
  "Expected 8 cached scope-plan rows",
  "order by cache.display_order",
  "if exists (",
  "return query",
  "scopePlanCacheRows",
  "vorta_refresh_current_risk_internal",
  "vorta_sync_maintenance_risk_work_plan",
]) {
  assert.ok(migration.includes(expected), `Missing scope-plan cache contract: ${expected}`);
}

const readerStart = migration.indexOf(
  "create or replace function public.vorta_get_risk_dashboard_scope_plans_internal",
);
const readerEnd = migration.indexOf(
  "create or replace function public.vorta_refresh_current_risk",
);
assert.ok(readerStart >= 0 && readerEnd > readerStart);
const readerBody = migration.slice(readerStart, readerEnd);

assert.ok(readerBody.includes("private.vorta_dashboard_scope_plan_cache"));
assert.ok(readerBody.includes("private.vorta_calculate_risk_dashboard_scope_plans"));
assert.doesNotMatch(
  readerBody,
  /vorta_get_area_equipment_risk_reduction_plan_internal/,
  "Normal scope-plan reads must not fan out through per-area intervention planning",
);
assert.doesNotMatch(
  readerBody,
  /vorta_get_equipment_risk_intervention/,
  "Normal scope-plan reads must not rebuild equipment interventions",
);

const calculatorStart = migration.indexOf(
  "create or replace function private.vorta_calculate_risk_dashboard_scope_plans",
);
const calculatorEnd = migration.indexOf(
  "revoke all on function private.vorta_calculate_risk_dashboard_scope_plans",
);
assert.ok(calculatorStart >= 0 && calculatorEnd > calculatorStart);
const calculatorBody = migration.slice(calculatorStart, calculatorEnd);
assert.ok(
  calculatorBody.includes("vorta_get_area_equipment_risk_reduction_plan_internal"),
  "The refresh calculator must preserve the existing planning contract",
);

for (const orchestrator of [
  "public.vorta_refresh_current_risk()",
  "private.vorta_run_scheduled_risk_refresh()",
  "public.vorta_recalculate_risk_work_plan()",
]) {
  const start = migration.indexOf(`create or replace function ${orchestrator}`);
  assert.ok(start >= 0, `Missing cache refresh orchestrator: ${orchestrator}`);
  const body = migration.slice(start, migration.indexOf("$function$;", start) + 11);
  assert.ok(
    body.includes("private.vorta_refresh_dashboard_scope_plan_cache"),
    `${orchestrator} does not refresh the scope-plan cache`,
  );
}

assert.doesNotMatch(
  migration,
  /create trigger|execute function.*scope_plan_cache/i,
  "The cache must refresh once per orchestration path, not through row-level triggers",
);

console.log("Dashboard scope-plan cache contracts passed.");
