import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  dataTrust,
  liveTrust,
  liveRoutes,
  liveViews,
  equipmentIndex,
  maintenanceActions,
  dashboardExperience,
  skillsRoute,
  aiOperations,
  liveBrowserTest,
  netlify,
  validateMode,
  releaseGate,
  qualityWorkflow,
] = await Promise.all([
  read("src/lib/dataTrust.ts"),
  read("src/screens/Equipment/equipmentLiveTrust.ts"),
  read("src/screens/Equipment/EquipmentLiveRoutes.tsx"),
  read("src/screens/Equipment/EquipmentLiveEvidenceViews.tsx"),
  read("src/screens/Equipment/index.ts"),
  read("src/lib/maintenanceActions.ts"),
  read("src/screens/AiOperations/MaintenanceDashboardExperience.tsx"),
  read("src/screens/AiOperations/SkillsMatrixRouteEntry.tsx"),
  read("src/screens/AiOperations/AiOperations.tsx"),
  read("tests/browser/maintenance-manager-live.spec.ts"),
  read("netlify.toml"),
  read("scripts/validate-data-mode.mjs"),
  read("scripts/netlify-release-gate.mjs"),
  read(".github/workflows/maintenance-manager-quality.yml"),
]);

assert.match(
  dataTrust,
  /import\.meta\.env\.PROD \? "unavailable" : "demo"/,
  "Production must fail closed when VITE_VORTA_DATA_MODE is missing.",
);

assert.match(liveTrust, /loadLiveEquipmentList\(\s*siteId/);
assert.match(liveTrust, /\.eq\("site_id", siteId\)/);
assert.match(liveTrust, /loadLiveEquipmentRecord/);
assert.match(liveTrust, /MAX_RISK_PROFILE_AGE_MS/);
assert.match(liveTrust, /expectedRiskLevel/);
assert.match(liveTrust, /Stored risk drivers total/);
assert.match(liveTrust, /Stock resilience is unavailable, not 100%/);
assert.match(liveTrust, /derivedStatus/);
assert.doesNotMatch(liveTrust, /vorta_get_demo_equipment_risk_list/);
assert.doesNotMatch(liveTrust, /riskBreakdownFor/);

for (const entry of [
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
  assert.match(liveRoutes, new RegExp(entry));
  assert.match(equipmentIndex, new RegExp(entry));
}
assert.match(liveRoutes, /EquipmentDetailBoundary/);
assert.match(liveRoutes, /loadLiveEquipmentRecord\(siteContext\.siteId, equipmentId\)/);
assert.match(liveRoutes, /openMaintenanceAiAssistant/);
assert.doesNotMatch(liveRoutes, /navigate\(-1\)/);
assert.doesNotMatch(liveRoutes, /setTimeout/);

assert.match(liveViews, /LiveEquipmentSparesView/);
assert.match(liveViews, /loadLiveEquipmentComponents\(record\.siteId, record\.id\)/);
assert.match(liveViews, /stockResilience === null/);
assert.doesNotMatch(liveViews, /<EquipmentSpares/);
assert.match(liveViews, /rows\.length > 0/);
assert.match(liveViews, /Evidence completeness/);

assert.match(maintenanceActions, /openMaintenanceAiAssistant/);
assert.match(maintenanceActions, /vorta-global-ai-prompt/);

assert.doesNotMatch(dashboardExperience, /querySelector|onClickCapture|cursor-pointer/);
assert.match(skillsRoute, /risk === "shift-cover"/);
assert.match(skillsRoute, /maintenance\/labour-risk\/shift-cover/);
assert.match(aiOperations, /<SkillsMatrixRouteEntry \/>/);

assert.match(liveBrowserTest, /data-vorta-live-equipment-list/);
assert.match(liveBrowserTest, /another site fails closed/);
assert.match(liveBrowserTest, /Stock resilience is unavailable, not 100%/);
assert.match(liveBrowserTest, /Close global assistant/);
assert.match(qualityWorkflow, /VITE_VORTA_DATA_MODE: live/);
assert.match(qualityWorkflow, /maintenance-manager-live\.spec\.ts/);

assert.match(netlify, /node scripts\/validate-data-mode\.mjs && npm run build/);
assert.match(validateMode, /context !== "production"/);
assert.match(validateMode, /Missing configuration is not treated as live/);
assert.match(releaseGate, /20 \* 60_000/);
assert.match(qualityWorkflow, /github\.event\.pull_request\.number \|\| github\.sha/);
assert.match(qualityWorkflow, /cancel-in-progress: false/);
assert.match(qualityWorkflow, /--project=desktop-1920/);
assert.match(qualityWorkflow, /VITE_VORTA_DATA_MODE: demo/);

console.log("Post-audit P0 contracts passed.");
