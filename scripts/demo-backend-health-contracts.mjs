import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const dueFunctions = read(
  "supabase/migrations/20260719211500_maintenance_due_date_truth_functions.sql",
);
const dueConsumers = read(
  "supabase/migrations/20260719211501_maintenance_due_date_truth_consumers.sql",
);
const dueNormalisation = read(
  "supabase/migrations/20260719211502_normalise_wrexham_due_states.sql",
);
const evidenceMetadata = read(
  "supabase/migrations/20260719212002_complete_wrexham_asset_evidence_metadata.sql",
);
const realismWork = read(
  "supabase/migrations/20260719212500_diversify_wrexham_demo_work_histories.sql",
);
const realismEvidence = read(
  "supabase/migrations/20260719212501_diversify_wrexham_demo_evidence.sql",
);
const thinRealismWork = read(
  "supabase/migrations/20260719212502_diversify_completed_wrexham_assets_work.sql",
);
const thinRealismEvidence = read(
  "supabase/migrations/20260719212503_diversify_completed_wrexham_assets_evidence.sql",
);
const backendHealth = read(
  "supabase/migrations/20260719213500_add_demo_backend_health_contract.sql",
);
const evidenceAggregation = read(
  "supabase/migrations/20260719233000_add_equipment_evidence_coverage_rpc.sql",
);
const evidenceCoverage = read(
  "src/screens/Equipment/equipmentEvidenceCoverage.ts",
);
const equipmentList = read(
  "src/screens/Equipment/EquipmentLiveListEntry.tsx",
);
const equipmentIndex = read("src/screens/Equipment/index.ts");

for (const requiredPath of [
  "supabase/migrations/20260719212000_complete_wrexham_asset_evidence_materials.sql",
  "supabase/migrations/20260719212001_complete_wrexham_asset_evidence_knowledge.sql",
]) {
  assert.equal(
    existsSync(new URL(`../${requiredPath}`, import.meta.url)),
    true,
    `${requiredPath} must remain part of the replayable demo expansion`,
  );
}

assert.match(dueFunctions, /vorta_effective_pm_status/);
assert.match(dueFunctions, /p_next_due_date < current_date/);
assert.match(dueFunctions, /vorta_work_order_is_overdue/);
assert.match(dueFunctions, /vorta_pm_backlog_score/);
assert.match(dueFunctions, /vorta_calibration_score/);
assert.match(dueConsumers, /vorta_get_equipment_work_items_internal/);
assert.match(dueConsumers, /vorta_work_order_is_overdue\(work_order\.status, work_order\.due_date\)/);
assert.match(dueConsumers, /vorta_effective_pm_status\(pm\.status, pm\.next_due_date\)/);
assert.match(dueNormalisation, /is distinct from public\.vorta_work_order_is_overdue/);
assert.match(dueNormalisation, /status is distinct from public\.vorta_effective_pm_status/);

assert.match(evidenceMetadata, /Wrexham asset missing BOM component evidence/);
assert.match(evidenceMetadata, /Wrexham asset missing current controlled document/);
assert.match(evidenceMetadata, /Wrexham asset missing searchable knowledge/);
assert.match(evidenceMetadata, /Wrexham asset missing fault-code evidence/);
assert.match(evidenceMetadata, /Wrexham calibration missing point or tolerance/);
assert.match(evidenceMetadata, /Completed Wrexham work order missing outcome/);

assert.match(realismWork, /demo_wrexham_realism_seed/);
assert.match(realismWork, /extra_work_orders/);
assert.match(realismEvidence, /Reliability and Asset Strategy/);
assert.match(realismEvidence, /AWAITING_WORK_ORDER/);
assert.match(thinRealismWork, /demo_wrexham_thin_realism_seed/);
assert.match(thinRealismEvidence, /Equipment Performance Review/);

assert.match(evidenceCoverage, /vorta_get_equipment_evidence_coverage/);
assert.equal(
  evidenceCoverage.match(/\.rpc\(/g)?.length ?? 0,
  1,
  "Evidence coverage must use one aggregate RPC",
);
assert.doesNotMatch(evidenceCoverage, /\.from\(/);
for (const table of [
  "equipment_components",
  "knowledge_documents",
  "equipment_fault_codes",
  "work_orders",
  "preventive_maintenance",
]) {
  assert.match(evidenceAggregation, new RegExp(`public\\.${table}`));
}
assert.match(evidenceAggregation, /vorta_has_site_access/);
assert.match(equipmentList, /type SortKey = "risk" \| "name" \| "backlog" \| "evidence"/);
assert.match(equipmentList, /type RiskFilter = "all" \| "high" \| "overdue" \| "evidence-gaps"/);
assert.match(equipmentList, /Evidence unavailable/);
assert.match(equipmentList, /Risk and backlog records remain available/);
assert.match(equipmentList, /Complete path/);
assert.match(equipmentIndex, /EquipmentLiveListEntry as EquipmentSection/);
assert.doesNotMatch(equipmentIndex, /EquipmentSectionEntry as EquipmentSection/);

assert.match(backendHealth, /private\.vorta_get_demo_backend_health_internal/);
assert.match(backendHealth, /work_order_overdue_mismatches/);
assert.match(backendHealth, /pm_status_mismatches/);
assert.match(backendHealth, /invalid_goods_movement_site_links/);
assert.match(backendHealth, /duplicate_work_order_source_keys/);
assert.match(backendHealth, /profile\.notification_pct<>100/);
assert.match(backendHealth, /largest_identical_signature_group<=1/);
assert.match(backendHealth, /revoke all on function public\.vorta_get_demo_backend_health\(\) from public,anon/);
assert.match(backendHealth, /grant execute on function public\.vorta_get_demo_backend_health\(\) to authenticated,service_role/);
assert.match(backendHealth, /Wrexham demo backend health contract failed/);

console.log("Demo backend health contracts passed.");
