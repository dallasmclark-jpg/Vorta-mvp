import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relativePath) =>
  readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), "utf8");

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const service = read("src/screens/Equipment/equipmentService.ts");
const dashboard = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx",
);
const dashboardWrapper = read(
  "src/screens/AiOperations/MaintenanceDashboardExperience.tsx",
);
const skillsMatrixRoute = read(
  "src/screens/AiOperations/SkillsMatrixRouteEntry.tsx",
);
const aiOperations = read("src/screens/AiOperations/AiOperations.tsx");
const portalWrapper = read(
  "src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx",
);
const workOrders = read("src/screens/Equipment/EquipmentWorkOrders.tsx");
const aiCommand = read("src/lib/maintenanceAiAssistant.ts");
const globalAi = read(
  "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx",
);
const hardening = read("src/components/MaintenancePortalHardening.tsx");
const evidenceHardening = read(
  "src/components/MaintenanceActionEvidenceHardening.tsx",
);
const skillsMatrix = read("src/screens/SkillsMatrix/SkillsMatrixNative.tsx");
const portalShell = read("src/components/PortalShell.tsx");
const browserTest = read("tests/browser/maintenance-manager-core.spec.ts");
const workOrderBrowserTest = read("tests/browser/maintenance-manager-work-orders.spec.ts");
const liveBrowserTest = read("tests/browser/maintenance-manager-live.spec.ts");
const indexHtml = read("index.html");
const shiftCoverService = read("src/screens/LabourRisk/shiftCoverService.ts");
const riskActionRouting = read("src/screens/AiOperations/riskActionRouting.ts");

check(
  service.includes("getOperationalDashboardSnapshot") &&
    service.includes("vorta_get_operational_dashboard_snapshot") &&
    service.includes("vorta_refresh_and_get_operational_dashboard"),
  "Dashboard service must expose explicit snapshot and refresh calls.",
);
check(
  dashboard.includes("recalculate = false") &&
    dashboard.includes("await getOperationalDashboardSnapshot()") &&
    dashboard.includes("await refreshAndGetOperationalDashboard()") &&
    dashboard.includes("selectedRiskScopeKey, true"),
  "Dashboard must use snapshot-first loading and explicit recalculation.",
);
check(
  !existsSync(
    fileURLToPath(
      new URL(
        "../src/lib/maintenanceDashboardSnapshotGuard.ts",
        import.meta.url,
      ),
    ),
  ) && !dashboardWrapper.includes("installMaintenanceDashboardSnapshotGuard"),
  "Global Supabase RPC interception must be removed.",
);

check(
  aiCommand.includes("openMaintenanceAiAssistant") &&
    aiCommand.includes("vorta-global-ai-prompt") &&
    workOrders.includes("openMaintenanceAiAssistant") &&
    !portalWrapper.includes("workOrderAskVortaQuestion"),
  "Maintenance AI entry points must use the shared same-page assistant command.",
);
check(
  globalAi.includes("topAsset") &&
    globalAi.includes("Promise.resolve([] as EquipmentKnowledgeChunk[])") &&
    !globalAi.includes('"fl-03",\n               knowledgeQuery'),
  "Global AI must not search an arbitrary equipment fallback.",
);

check(
  !hardening.includes("MutationObserver") &&
    !evidenceHardening.includes("MutationObserver"),
  "Portal hardening must not mutate React-owned content through global observers.",
);
check(
  skillsMatrix.includes("selectedContextSkill") &&
    skillsMatrix.includes("Skill: ${selectedContextSkill.name}"),
  "Skills Matrix must render selected-skill context directly.",
);
check(
  dashboard.includes('aria-label="Risk scope"') &&
    portalWrapper.includes("showAssistantLauncher") &&
    portalWrapper.includes('location.pathname !== "/dashboard"'),
  "Mobile risk scope and duplicate assistant controls must be handled explicitly.",
);
check(
  portalShell.includes("2xl:w-56") &&
    portalShell.includes("data-vorta-desktop-sidebar"),
  "Shared portals must retain a stable compact desktop sidebar contract.",
);
check(
  hardening.includes('[data-vorta-desktop-sidebar="true"]') &&
    hardening.includes("min-width: 1360px") &&
    !hardening.includes(":has(") &&
    !hardening.includes("nth-child") &&
    !hardening.includes('[class*='),
  "Maintenance laptop navigation must use stable component data attributes rather than rendered Tailwind structure.",
);

check(
  aiOperations.includes("<SkillsMatrixRouteEntry />") &&
    aiOperations.includes('import("./SkillsMatrixRouteEntry")') &&
    skillsMatrixRoute.includes('risk === "shift-cover"') &&
    skillsMatrixRoute.includes("/maintenance/labour-risk/shift-cover") &&
    !dashboardWrapper.includes("isShiftCoverCard"),
  "The Dashboard Shift Cover workflow must resolve to the dedicated calendar route.",
);
check(
  browserTest.includes('data-vorta-labour-risk-card="shift-cover"') &&
    browserTest.includes('name: "Shift Cover Risk"') &&
    browserTest.includes('name: "Operational Rota Risk Map"') &&
    browserTest.includes("/maintenance\\/labour-risk\\/shift-cover"),
  "The authenticated browser workflow must protect the Shift Cover calendar route.",
);
check(
  browserTest.includes('getByLabel("Risk scope"') &&
    browserTest.includes('name: "Ask Vorta AI"') &&
    browserTest.includes("toBeHidden") &&
    workOrderBrowserTest.includes("originating page"),
  "Browser regressions must cover mobile risk scope, duplicate assistant controls and same-page work orders.",
);
check(
  liveBrowserTest.includes("data-vorta-mobile-rota") &&
    liveBrowserTest.includes("Rota completeness") &&
    liveBrowserTest.includes("Open controlled document") &&
    liveBrowserTest.includes("simulated work-order reader failure") &&
    liveBrowserTest.includes("simulated history reader failure") &&
    !liveBrowserTest.includes("toBeDisabled"),
  "Live browser regression must cover responsive Shift Cover, verified History and Documents, and truth-safe evidence failures.",
);
check(
  !indexHtml.includes("equipmentDocumentNavigationInterceptor") &&
    !indexHtml.includes("workforceProfilePhotos") &&
    !indexHtml.includes(":has(") &&
    !indexHtml.includes("nth-child"),
  "The document shell must not patch React output with global interceptors or structural selectors.",
);
check(
  shiftCoverService.includes("snapshot.siteId does not match") &&
    shiftCoverService.includes("dateOnlyTimestamp") &&
    shiftCoverService.includes("labourRiskScore") &&
    shiftCoverService.includes("duplicate day or night shifts"),
  "Shift Cover must reject malformed or cross-site live evidence.",
);
check(
  service.includes("RiskActionTarget") &&
    service.includes("resolveRiskActionTarget") &&
    riskActionRouting.includes("action.target"),
  "Dashboard action routing must use a typed target contract.",
);
check(
  dashboard.includes("Promise.allSettled") &&
    dashboard.includes('setSnapshotEvidenceState(hasPreviousSnapshot ? "stale" : "unavailable")') &&
    dashboard.includes("riskActionsDisabled"),
  "Dashboard must preserve verified evidence and disable projections after partial or refresh failure.",
);

console.log("Maintenance Manager audit hardening contracts passed.");
