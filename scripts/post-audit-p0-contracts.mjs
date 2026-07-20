import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  dataTrust,
  liveTrust,
  liveRoutes,
  liveViews,
  pilotEvidenceViews,
  pilotEvidenceService,
  equipmentIndex,
  equipmentTabs,
  maintenanceActions,
  maintenanceHardening,
  dashboardExperience,
  skillsRoute,
  aiOperations,
  shiftEntry,
  shiftPage,
  shiftService,
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
  read("src/screens/Equipment/EquipmentPilotEvidenceViews.tsx"),
  read("src/screens/Equipment/equipmentPilotEvidence.ts"),
  read("src/screens/Equipment/index.ts"),
  read("src/screens/Equipment/EquipmentTabNavigation.tsx"),
  read("src/lib/maintenanceActions.ts"),
  read("src/components/MaintenancePortalHardening.tsx"),
  read("src/screens/AiOperations/MaintenanceDashboardExperience.tsx"),
  read("src/screens/AiOperations/SkillsMatrixRouteEntry.tsx"),
  read("src/screens/AiOperations/AiOperations.tsx"),
  read("src/screens/LabourRisk/ShiftCoverPageEntry.tsx"),
  read("src/screens/LabourRisk/LiveShiftCoverPage.tsx"),
  read("src/screens/LabourRisk/shiftCoverService.ts"),
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

assert.match(liveRoutes, /EquipmentSectionEntry/);
assert.match(equipmentIndex, /EquipmentLiveListEntry as EquipmentSection/);
for (const entry of [
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
assert.match(liveRoutes, /LiveEquipmentWorkOrdersPilotView/);
assert.match(liveRoutes, /LiveEquipmentHistoryView/);
assert.match(liveRoutes, /LiveEquipmentDocumentsView/);
assert.match(liveRoutes, /LiveEquipmentDocumentViewerView/);
assert.doesNotMatch(liveRoutes, /History.*not yet been approved for live pilot use/);
assert.doesNotMatch(liveRoutes, /Live document evidence remains withheld/);
assert.doesNotMatch(liveRoutes, /navigate\(-1\)/);
assert.doesNotMatch(liveRoutes, /setTimeout/);

assert.match(liveViews, /LiveEquipmentSparesView/);
assert.match(liveViews, /loadLiveEquipmentComponents\(record\.siteId, record\.id\)/);
assert.match(liveViews, /stockResilience === null/);
assert.doesNotMatch(liveViews, /<EquipmentSpares/);
assert.match(liveViews, /rows\.length > 0/);
assert.match(liveViews, /Evidence completeness/);
assert.match(liveViews, /requestVersion/);
assert.match(liveViews, /finally/);

assert.match(pilotEvidenceViews, /usePilotEvidence/);
assert.match(pilotEvidenceViews, /requestVersion/);
assert.match(pilotEvidenceViews, /catch \(error\)/);
assert.match(pilotEvidenceViews, /finally/);
assert.match(pilotEvidenceViews, /LiveEquipmentWorkOrdersPilotView/);
assert.match(pilotEvidenceViews, /LiveEquipmentHistoryView/);
assert.match(pilotEvidenceViews, /LiveEquipmentDocumentsView/);
assert.match(pilotEvidenceViews, /LiveEquipmentDocumentViewerView/);
assert.match(pilotEvidenceViews, /executionReadiness === null/);
assert.match(pilotEvidenceViews, /No demonstration values, optimistic percentages or cross-site records were substituted/);
assert.match(pilotEvidenceViews, /buildWorkEvidenceCitation/);
assert.match(pilotEvidenceViews, /buildDocumentCitation/);

assert.match(pilotEvidenceService, /vorta_get_equipment_history/);
assert.match(pilotEvidenceService, /vorta_get_equipment_documents/);
assert.match(pilotEvidenceService, /vorta_get_equipment_document/);
assert.match(pilotEvidenceService, /isLiveWorkItemOverdue/);
assert.match(pilotEvidenceService, /isLiveWorkItemCompleted/);
assert.match(pilotEvidenceService, /buildWorkEvidenceCitation/);
assert.match(pilotEvidenceService, /buildDocumentCitation/);

assert.doesNotMatch(equipmentTabs, /unavailableInLive/);
assert.doesNotMatch(equipmentTabs, /aria-describedby/);
assert.match(equipmentTabs, /aria-label="Equipment sections"/);
assert.match(equipmentTabs, /aria-current=\{active \? "page" : undefined\}/);
assert.match(equipmentTabs, /Ask Vorta/);
assert.match(equipmentTabs, /data-vorta-equipment-action/);
assert.match(equipmentTabs, /label: "History"/);
assert.match(equipmentTabs, /label: "Documents"/);

assert.match(maintenanceActions, /openMaintenanceAiAssistant/);
assert.match(maintenanceActions, /vorta-global-ai-prompt/);

assert.match(shiftEntry, /<LiveShiftCoverPage dataMode=\{dataMode\} \/>/);
assert.doesNotMatch(shiftEntry, /h1\s*\+\s*span|display:\s*none|FlaskConical/);
assert.match(shiftPage, /data-vorta-mobile-rota/);
assert.match(shiftPage, /data-vorta-desktop-rota/);
assert.match(shiftPage, /Rota completeness/);
assert.match(shiftPage, /completenessPercent/);
assert.match(shiftService, /completeShiftCount/);
assert.match(shiftService, /expectedShiftCount/);
assert.match(shiftService, /assignedShiftCount/);
assert.match(shiftService, /staffedShiftCount/);
assert.match(shiftService, /snapshot.siteId does not match/);
assert.match(shiftService, /labourRiskScore/);
assert.match(shiftService, /duplicate day or night shifts/);

assert.match(maintenanceHardening, /min-width: 1360px/);
assert.doesNotMatch(maintenanceHardening, /text-\[7\.5px\]|text-\[8px\]|text-\[9px\]/);
assert.doesNotMatch(maintenanceHardening, /grid-cols-2|grid-cols-3|grid-cols-4|grid-cols-5|grid-cols-6/);

assert.doesNotMatch(dashboardExperience, /querySelector|onClickCapture|cursor-pointer/);
assert.match(skillsRoute, /risk === "shift-cover"/);
assert.match(skillsRoute, /maintenance\/labour-risk\/shift-cover/);
assert.match(aiOperations, /<SkillsMatrixRouteEntry \/>/);
assert.match(aiOperations, /import\("\.\/SkillsMatrixRouteEntry"\)/);

assert.match(liveBrowserTest, /data-vorta-live-equipment-list/);
assert.match(liveBrowserTest, /another site fails closed/);
assert.match(liveBrowserTest, /Stock resilience is unavailable, not 100%/);
assert.match(liveBrowserTest, /data-vorta-mobile-rota/);
assert.match(liveBrowserTest, /Rota completeness/);
assert.match(liveBrowserTest, /toBeDisabled/);
assert.match(qualityWorkflow, /VITE_VORTA_DATA_MODE: live/);
assert.match(qualityWorkflow, /maintenance-manager-live\.spec\.ts/);
assert.match(qualityWorkflow, /maintenance-manager-core\.spec\.ts/);
assert.match(qualityWorkflow, /maintenance-manager-work-orders\.spec\.ts/);
assert.doesNotMatch(
  qualityWorkflow,
  /maintenance-manager-live\.spec\.ts[^\n]*--project=/,
  "Live responsive tests must run against every configured viewport project.",
);

assert.doesNotMatch(netlify, /netlify-release-gate/);
assert.match(netlify, /node scripts\/validate-data-mode\.mjs && npm run build/);
assert.match(validateMode, /context !== "production"/);
assert.match(validateMode, /Missing configuration is not treated as live/);
assert.match(releaseGate, /pollIntervalMs = 60_000/);
assert.match(releaseGate, /timeoutMs = 50 \* 60_000/);
assert.match(releaseGate, /x-ratelimit-remaining/);
assert.doesNotMatch(releaseGate, /pollIntervalMs = 10_000/);
assert.match(qualityWorkflow, /group: maintenance-manager-quality-\$\{\{ github\.sha \}\}/);
assert.match(qualityWorkflow, /cancel-in-progress: false/);
assert.match(qualityWorkflow, /--project=desktop-1920/);
assert.match(qualityWorkflow, /VITE_VORTA_DATA_MODE: demo/);

console.log("Post-audit responsive UX and live pilot evidence contracts passed.");
