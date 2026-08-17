import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const controlsPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260801173323_add_demo_dataset_credibility_controls.sql",
);
const preparationPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260801173542_prepare_wrexham_credible_demo_dataset.sql",
);
const dailyRefreshPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260809145500_vor_033_schedule_guarded_daily_demo_refresh.sql",
);

const controls = readFileSync(controlsPath, "utf8");
const preparation = readFileSync(preparationPath, "utf8");
const dailyRefresh = readFileSync(dailyRefreshPath, "utf8");

const requireText = (source, expected, message) => {
  assert.ok(source.includes(expected), message ?? `Expected migration to include: ${expected}`);
};

requireText(controls, "private.vorta_demo_dataset_baselines", "Baseline storage must exist.");
requireText(controls, "private.vorta_demo_equipment_code_map", "Equipment-code mapping must be explicit.");
requireText(controls, "'DEMO-WMS-001','WMS-02'", "WMS-02 avoids the existing WMS-01 identifier.");
requireText(
  controls,
  "private.vorta_get_demo_dataset_credibility_internal",
  "A deterministic credibility report must gate the dataset.",
);
requireText(
  controls,
  "private.vorta_capture_demo_dataset_baseline_internal",
  "A baseline must be captured before data mutation.",
);
requireText(
  controls,
  "private.vorta_refresh_demo_dataset_dates_internal",
  "The rolling-date refresh must be repeatable.",
);
requireText(controls, "revoke all on table private.vorta_demo_dataset_baselines from public,anon,authenticated");
requireText(controls, "grant execute on function private.vorta_refresh_demo_dataset_dates_internal(uuid,date) to service_role");
requireText(controls, "due_0_7>=10", "Open work must retain a due-soon population.");
requireText(controls, "overdue between 20 and 45", "Open work must retain a controlled overdue population.");
requireText(controls, "pm_overdue between 20 and 50", "PM backlog must be credible rather than perfect or abandoned.");
requireText(controls, "perform public.vorta_recalculate_equipment_risk_profiles()");
requireText(controls, "perform public.vorta_sync_maintenance_risk_work_plan()");

const baselineIndex = preparation.indexOf("private.vorta_capture_demo_dataset_baseline_internal");
const firstMutationIndex = preparation.indexOf("update public.equipment_fault_codes");
assert.ok(baselineIndex >= 0, "The preparation migration must capture a baseline.");
assert.ok(firstMutationIndex >= 0, "The preparation migration must update connected evidence.");
assert.ok(
  baselineIndex < firstMutationIndex,
  "The baseline must be captured before the first production-data mutation.",
);

const faultUpdateIndex = preparation.indexOf("update public.equipment_fault_codes fault");
const workOrderUpdateIndex = preparation.indexOf("update public.work_orders\n    set description");
assert.ok(
  faultUpdateIndex >= 0 && workOrderUpdateIndex >= 0 && faultUpdateIndex < workOrderUpdateIndex,
  "Fault-code references must be renamed before the composite work-order foreign key is updated.",
);

requireText(preparation, "'vor-033-before-credible-demo-refresh'");
requireText(preparation, "CH1-GSK-SAMPLE");
requireText(preparation, "CH1-GSK-015");
requireText(preparation, "\\s+rev\\s+demo$");
requireText(preparation, "private.vorta_refresh_demo_dataset_dates_internal(v_site_id,current_date)");
requireText(preparation, "VOR-033 demo dataset credibility contract failed");

for (const required of [
  "refresh-vorta-demo-dataset-daily",
  "'17 1 * * *'",
  "private.vorta_refresh_demo_dataset_dates_internal(",
  "(now() at time zone 'Europe/London')::date",
  "cron.unschedule(jobid)",
]) {
  requireText(dailyRefresh, required, `Daily VOR-033 rolling maintenance must retain ${required}`);
}
assert.equal(
  /\b(public\.vorta_refresh_demo_dataset_dates_internal|anon|authenticated)\b/.test(dailyRefresh),
  false,
  "The scheduled demo refresh must call only the private governed refresh and must not grant end-user execution.",
);

assert.equal(
  /create\s+(or\s+replace\s+)?function\s+public\.vorta_(get|refresh|capture)_demo_dataset/i.test(controls),
  false,
  "The maintenance functions must remain private and unavailable through the public Data API.",
);

console.log("VOR-033 demo dataset credibility contracts passed, including guarded daily rolling maintenance.");
