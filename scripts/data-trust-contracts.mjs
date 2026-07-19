import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  dataTrust,
  banner,
  portal,
  routes,
  shiftPage,
  shiftEntry,
  shiftService,
  equipmentData,
  equipmentEntry,
  trustedEntries,
  liveRoutes,
  liveTrust,
  equipmentIndex,
  browserTest,
  liveBrowserTest,
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
  read("src/screens/LabourRisk/ShiftCoverPageEntry.tsx"),
  read("src/screens/LabourRisk/shiftCoverService.ts"),
  read("src/screens/Equipment/equipmentData.ts"),
  read("src/screens/Equipment/EquipmentOverviewEntry.tsx"),
  read("src/screens/Equipment/EquipmentTrustedEntries.tsx"),
  read("src/screens/Equipment/EquipmentLiveRoutes.tsx"),
  read("src/screens/Equipment/equipmentLiveTrust.ts"),
  read("src/screens/Equipment/index.ts"),
  read("tests/browser/maintenance-manager-core.spec.ts"),
  read("tests/browser/maintenance-manager-live.spec.ts"),
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
assert.match(dataTrust, /PROD \? "unavailable" : "demo"/);

assert.match(banner, /LIVE SITE DATA/);
assert.match(banner, /DEMO DATA/);
assert.match(banner, /DATA UNAVAILABLE/);
assert.match(portal, /<DataTrustBanner \/>/);

assert.match(
  routes,
  /path="maintenance\/labour-risk\/shift-cover"[\s\S]*<ShiftCoverPageEntry \/>/,
);
assert.match(shiftPage, /Operational Rota Risk Map/);
assert.match(shiftPage, /No static roster or fabricated recommendation has been substituted/);
assert.doesNotMatch(shiftPage, /SC_ENGINEERS|TEAM_CONFIGS|ROTA_OVERLAYS/);
assert.match(shiftPage, /LIVE ROTA/);
assert.match(shiftPage, /DEMO ROTA/);
assert.match(shiftPage, /DATA UNAVAILABLE/);
assert.match(shiftPage, /data-vorta-mobile-rota/);
assert.match(shiftEntry, /getEffectiveDataMode/);
assert.match(shiftEntry, /data-vorta-shift-cover-mode/);
assert.match(shiftEntry, /<LiveShiftCoverPage dataMode=\{dataMode\} \/>/);
assert.doesNotMatch(shiftEntry, /display:\s*none|demonstration site database/);
assert.match(shiftService, /vorta_get_shift_cover_snapshot/);
assert.match(shiftService, /"shiftDate", "shift_date"/);
assert.match(shiftService, /"coverageStatus", "coverage_status"/);
assert.match(shiftService, /completenessPercent/);

assert.match(equipmentData, /if \(!demoFallbacksAllowed\(\)\)/);
assert.match(equipmentData, /No local demo profile was substituted/);
assert.match(equipmentEntry, /getConfiguredDataMode\(\) === "demo"/);
assert.match(equipmentEntry, /EquipmentOverviewLive/);
assert.match(trustedEntries, /LIVE EVIDENCE UNAVAILABLE/);
assert.match(trustedEntries, /legacy demonstration records/);
for (const routeEntry of [
  "EquipmentSectionEntry",
  "EquipmentOverviewTrustedEntry",
  "EquipmentNotificationsTrustedEntry",
  "EquipmentWorkOrdersTrustedEntry",
  "EquipmentCalibrationsTrustedEntry",
  "EquipmentHistoryTrustedEntry",
  "EquipmentSkillsTrustedEntry",
  "EquipmentSparesEntry",
  "EquipmentDocumentsTrustedEntry",
  "EquipmentDocumentViewerTrustedEntry",
  "EquipmentAiInsightsTrustedEntry",
]) {
  assert.match(liveRoutes, new RegExp(routeEntry));
  assert.match(equipmentIndex, new RegExp(routeEntry));
}
assert.match(liveRoutes, /EquipmentDetailBoundary/);
assert.match(liveTrust, /Stock resilience is unavailable, not 100%/);
assert.match(liveTrust, /\.eq\("site_id", siteId\)/);
assert.match(liveTrust, /MAX_RISK_PROFILE_AGE_MS/);
assert.doesNotMatch(liveTrust, /vorta_get_demo_equipment_risk_list/);

for (const functionName of [
  "vorta_get_shift_calendar",
  "vorta_get_shift_roster",
  "vorta_get_site_labour_risk",
  "vorta_get_shift_cover_snapshot",
  "vorta_test_site_isolation",
]) {
  assert.match(migration, new RegExp(functionName));
}
assert.doesNotMatch(migration, /vorta_has_site_access\(p_site_id, true\)/);
assert.match(migration, /deniedShiftCalendarRows/);
assert.match(migration, /from public, anon, authenticated/);

assert.match(browserTest, /verifyCrossSiteIsolation/);
assert.match(browserTest, /VORTA_E2E_DENIED_SITE_ID/);
assert.match(browserTest, /expect\(await deniedResponse\.json\(\)\)\.toBeNull\(\)/);
assert.match(browserTest, /data-vorta-data-mode/);
assert.match(browserTest, /data-vorta-shift-cover-mode/);
assert.match(browserTest, /DEMO ROTA/);
assert.match(liveBrowserTest, /another site fails closed/);
assert.match(liveBrowserTest, /Stock resilience is unavailable, not 100%/);
assert.match(liveBrowserTest, /data-vorta-mobile-rota/);

assert.doesNotMatch(netlify, /netlify-release-gate/);
assert.match(netlify, /node scripts\/validate-data-mode\.mjs && npm run build/);
assert.match(netlify, /VITE_VORTA_DATA_MODE = "demo"/);
assert.match(releaseGate, /maintenance-manager-quality\.yml/);
assert.match(releaseGate, /run\.conclusion === "success"/);
assert.match(releaseGate, /pollIntervalMs = 60_000/);
assert.match(releaseGate, /timeoutMs = 50 \* 60_000/);
assert.match(releaseGate, /x-ratelimit-remaining/);
assert.doesNotMatch(releaseGate, /pollIntervalMs = 10_000/);
assert.match(qualityWorkflow, /push:/);
assert.match(qualityWorkflow, /workflow_dispatch:/);
assert.match(qualityWorkflow, /supabase\/migrations\/\*\*/);
assert.match(qualityWorkflow, /--project=desktop-1920/);
assert.match(qualityWorkflow, /VITE_VORTA_DATA_MODE: live/);
assert.match(productionWorkflow, /Verify exact production commit/);
assert.match(productionWorkflow, /verify-production-commit\.mjs/);
assert.match(productionWorkflow, /VORTA_E2E_BASE_URL/);

console.log("P0 data trust contracts passed.");
