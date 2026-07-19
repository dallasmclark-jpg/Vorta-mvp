import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const indexHtml = read("index.html");
const portalHardening = read("src/components/MaintenancePortalHardening.tsx");
const portalShell = read("src/components/PortalShell.tsx");
const dashboard = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx",
);
const dashboardNotice = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardEvidenceNotice.tsx",
);
const riskMeter = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/RiskMeter.tsx",
);
const labourRiskSection = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/LabourRiskSection.tsx",
);
const equipmentService = read("src/screens/Equipment/equipmentService.ts");
const riskRouting = read("src/screens/AiOperations/riskActionRouting.ts");
const shiftService = read("src/screens/LabourRisk/shiftCoverService.ts");
const aiOperations = read("src/screens/AiOperations/AiOperations.tsx");
const assistant = read(
  "src/screens/AiOperations/GlobalMaintenanceAiAssistantWithFaultsV2.tsx",
);
const browserWorkflow = read(".github/workflows/maintenance-manager-quality.yml");

for (const retired of [
  "src/lib/equipmentDocumentNavigationInterceptor.ts",
  "src/lib/workforceProfilePhotos.ts",
  "src/lib/vortaAiLauncherEnhancement.ts",
  "src/lib/vortaAiPanelEnhancement.ts",
  "src/lib/vortaAiPanelMinimiseFix.ts",
  "src/lib/vortaAiPanelFinalCleanup.ts",
  "src/lib/vortaAiGenericFaultBridge.ts",
  "src/lib/vortaAiFaultIntelligence.ts",
]) {
  assert.equal(existsSync(new URL(`../${retired}`, import.meta.url)), false, `${retired} must be retired`);
}

assert.doesNotMatch(indexHtml, /:has\(|nth-child|equipmentDocumentNavigationInterceptor|workforceProfilePhotos/);
assert.doesNotMatch(portalHardening, /:has\(|nth-child|\[class\*=/);
assert.match(portalHardening, /data-vorta-desktop-sidebar/);
assert.match(portalShell, /data-vorta-sidebar-label/);

assert.match(shiftService, /snapshot.siteId does not match/);
assert.match(shiftService, /dateOnlyTimestamp/);
assert.match(shiftService, /finiteNumber/);
assert.match(shiftService, /labourRiskScore/);
assert.match(shiftService, /duplicate day or night shifts/);

assert.match(dashboard, /Promise\.allSettled/);
assert.match(dashboard, /lastSuccessfulSnapshotAt/);
assert.match(dashboard, /riskActionsDisabled/);
assert.match(dashboardNotice, /data-vorta-dashboard-evidence-state/);
assert.match(riskMeter, /prefers-reduced-motion/);
assert.match(dashboard, /<LabourRiskSection/);
assert.match(labourRiskSection, /data-vorta-labour-risk-card/);
assert.match(equipmentService, /RiskActionTarget/);
assert.match(equipmentService, /getAreaInterventionPlansStrict/);
assert.match(riskRouting, /action\.target/);
assert.doesNotMatch(riskRouting, /includes\("skill"\)|includes\("spare"\)/);

assert.match(aiOperations, /const SkillsMatrixRouteEntry = lazy/);
assert.match(aiOperations, /const EquipmentWorkOrders = lazy/);
assert.match(aiOperations, /<Suspense fallback=\{<RouteLoader \/>\}>/);
assert.doesNotMatch(assistant, /MutationObserver|stopImmediatePropagation|document\.querySelector/);

assert.match(browserWorkflow, /maintenance-manager-work-orders\.spec\.ts/);
assert.match(browserWorkflow, /maintenance-manager-dashboard-resilience\.spec\.ts/);
assert.match(browserWorkflow, /maintenance-manager-visual\.spec\.ts/);

console.log("Audit remediation contracts passed.");
