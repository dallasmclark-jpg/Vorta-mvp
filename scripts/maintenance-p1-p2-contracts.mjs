import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relativePath) =>
  readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), "utf8");
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const service = read("src/screens/Equipment/equipmentService.ts");
const dashboard = read("src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx");
const dashboardWrapper = read("src/screens/AiOperations/MaintenanceDashboardExperience.tsx");
const portalWrapper = read("src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx");
const workOrders = read("src/screens/Equipment/EquipmentWorkOrders.tsx");
const ai = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");
const hardening = read("src/components/MaintenancePortalHardening.tsx");
const evidenceHardening = read("src/components/MaintenanceActionEvidenceHardening.tsx");
const skillsMatrix = read("src/screens/SkillsMatrix/SkillsMatrixNative.tsx");
const portalShell = read("src/components/PortalShell.tsx");
const browserTest = read("tests/browser/maintenance-manager-core.spec.ts");

check(
  service.includes("getOperationalDashboardSnapshot") &&
    service.includes("vorta_get_operational_dashboard_snapshot") &&
    service.includes("vorta_refresh_and_get_operational_dashboard"),
  "Dashboard service must expose explicit snapshot and refresh calls.",
);
check(
  dashboard.includes("recalculate = false") &&
    dashboard.includes("getOperationalDashboardSnapshot") &&
    dashboard.includes("selectedRiskScopeKey, true"),
  "Dashboard must use snapshot-first loading and explicit recalculation.",
);
check(
  !existsSync(fileURLToPath(new URL("../src/lib/maintenanceDashboardSnapshotGuard.ts", import.meta.url))) &&
    !dashboardWrapper.includes("installMaintenanceDashboardSnapshotGuard"),
  "Global Supabase RPC interception must be removed.",
);
check(
  workOrders.includes("openMaintenanceAiAssistant") &&
    portalWrapper.includes("trackRecommendationFollowThrough") &&
    !portalWrapper.includes("workOrderAskVortaQuestion"),
  "Work Orders AI actions must use the shared same-page assistant event.",
);
check(
  !ai.includes('topAsset?.id ??') && !ai.includes('"fl-03",\n               knowledgeQuery'),
  "Global AI must not search an arbitrary equipment fallback.",
);
check(
  !hardening.includes("MutationObserver") &&
    !evidenceHardening.includes("MutationObserver"),
  "Portal hardening must not mutate React-owned content through global observers.",
);
check(
  skillsMatrix.includes("selectedContextSkill") &&
    skillsMatrix.includes("selectedSkillId, selectedSummary"),
  "Skills Matrix must render selected-skill context directly.",
);
check(
  dashboard.includes('aria-label="Risk scope"') &&
    dashboardWrapper.includes("Ask Vorta") === false &&
    portalWrapper.includes('placeholder^="Ask Vorta about"'),
  "Mobile scope and embedded-AI collision controls must be present.",
);
check(
  portalShell.includes("2xl:w-56") &&
    portalShell.includes("min-width: 1536px"),
  "Tablet landscape must retain the compact sidebar.",
);
check(
  hardening.includes('[data-vorta-maintenance-portal="true"] [class*="grid-cols-2"]') &&
    !hardening.includes('[data-vorta-maintenance-portal="true"] main [class*="grid-cols-2"]'),
  "Responsive hardening selectors must target descendants of the real portal root.",
);
check(
  browserTest.includes('getByLabel("Risk scope"') &&
    browserTest.includes('name: "Ask Vorta AI"') &&
    browserTest.includes("toBeHidden"),
  "Browser regression must cover mobile scope and duplicate AI controls.",
);

console.log("Maintenance Manager audit hardening contracts passed.");
