import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  dataTrust,
  banner,
  portal,
  routes,
  shiftPage,
  shiftService,
  equipmentData,
  equipmentEntry,
  trustedEntries,
  equipmentIndex,
  browserTest,
  migration,
  netlify,
  releaseGate,
  qualityWorkflow,
  productionWorkflow,
] = await Promise.all([
  read("src/lib/dataTrust.ts"),
  read("src/components/DataTrustBanner.tsx"),
  read("src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx"),
  read("src/screens/AiOperations/AiOperations.tsx"),
  read("src/screens/LabourRisk/LiveShiftCoverPage.tsx"),
  read("src/screens/LabourRisk/shiftCoverService.ts"),
  read("src/screens/Equipment/equipmentData.ts"),
  read("src/screens/Equipment/EquipmentOverviewEntry.tsx"),
  read("src/screens/Equipment/EquipmentTrustedEntries.tsx"),
  read("src/screens/Equipment/index.ts"),
  read("tests/browser/maintenance-manager-core.spec.ts"),
  read("supabase/migrations/20260719070448_p0_pilot_trust_hardening.sql"),
  read("netlify.toml"),
  read("scripts/netlify-release-gate.mjs"),
  read(".github/workflows/maintenance-manager-quality.yml"),
  read(".github/workflows/maintenance-manager-production.yml"),
]);

for (const mode of ["live", "demo", "unavailable"]) {
  assert.match(dataTrust, new RegExp(`"${mode}"`));
}
assert.match(dataTrust, /VITE_VORTA_DATA_MODE/);
assert.match(dataTrust, /demoFallbacksAllowed/);

assert.match(banner, /LIVE SITE DATA/);
assert.match(banner, /DEMO DATA/);
assert.match(banner, /DATA UNAVAILABLE/);
assert.match(portal, /<DataTrustBanner \/>/);

assert.match(
  routes,
  /path="maintenance\/labour-risk\/shift-cover"[\s\S]*<LiveShiftCoverPage \/>/,
);
assert.match(shiftPage, /Operational Rota Risk Map/);
assert.match(
  shiftPage,
  /No static roster or fabricated recommendation has been substituted/,
);
assert.doesNotMatch(shiftPage, /SC_ENGINEERS|TEAM_CONFIGS|ROTA_OVERLAYS/);
assert.match(shiftService, /vorta_get_shift_cover_snapshot/);
assert.match(shiftService, /"shiftDate", "shift_date"/);
assert.match(shiftService, /"coverageStatus", "coverage_status"/);

assert.match(equipmentData, /if \(!demoFallbacksAllowed\(\)\)/);
assert.match(equipmentData, /No local demo profile was substituted/);
assert.match(equipmentEntry, /getConfiguredDataMode\(\) === "demo"/);
assert.match(equipmentEntry, /EquipmentOverviewLive/);
for (const routeEntry of [
  "EquipmentHistoryEntry",
  "EquipmentDocumentsEntry",
  "EquipmentAiInsightsEntry",
]) {
  assert.match(trustedEntries, new RegExp(routeEntry));
  assert.match(equipmentIndex, new RegExp(routeEntry));
}
assert.match(trustedEntries, /LIVE EVIDENCE UNAVAILABLE/);
assert.match(trustedEntries, /legacy demonstration records/);

for (const functionName of [
  "vorta_get_shift_calendar",
  "vorta_get_shift_roster",
  "vorta_get_site_labour_risk",
  "vorta_get_shift_cover_snapshot",
  "vorta_test_site_isolation",
]) {
  assert.match(migration, new RegExp(functionName));
}
assert.doesNotMatch(
  migration,
  /vorta_has_site_access\(p_site_id, true\)/,
);
assert.match(migration, /deniedShiftCalendarRows/);
assert.match(migration, /from public, anon, authenticated/);

assert.match(browserTest, /verifyCrossSiteIsolation/);
assert.match(browserTest, /VORTA_E2E_DENIED_SITE_ID/);
assert.match(browserTest, /expect\(await deniedResponse\.json\(\)\)\.toBeNull\(\)/);
assert.match(browserTest, /data-vorta-data-mode/);

assert.match(netlify, /ignore = "node scripts\/netlify-release-gate\.mjs"/);
assert.match(netlify, /VITE_VORTA_DATA_MODE = "demo"/);
assert.match(releaseGate, /maintenance-manager-quality\.yml/);
assert.match(releaseGate, /run\.conclusion === "success"/);
assert.match(releaseGate, /process\.exit\(0\)/);
assert.match(qualityWorkflow, /push:/);
assert.match(qualityWorkflow, /workflow_dispatch:/);
assert.match(qualityWorkflow, /supabase\/migrations\/\*\*/);
assert.match(productionWorkflow, /Verify exact production commit/);
assert.match(productionWorkflow, /verify-production-commit\.mjs/);
assert.match(productionWorkflow, /VORTA_E2E_BASE_URL/);

console.log("P0 data trust contracts passed.");
