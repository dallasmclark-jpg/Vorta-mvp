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
    portalWrapper.includes('[data-vorta-embedded-ai="true"]') &&
    portalWrapper.includes('placeholder^="Ask Vorta about"'),
  "Mobile risk scope and duplicate assistant controls must be handled explicitly.",
);
check(
  portalShell.includes("2xl:w-56") &&
    portalShell.includes("min-width: 1536px"),
  "Tablet landscape must retain the compact sidebar.",
);
check(
  hardening.includes(
    '[data-vorta-maintenance-portal="true"] [class*="grid-cols-2"]',
  ) &&
    !hardening.includes(
      '[data-vorta-maintenance-portal="true"] main [class*="grid-cols-2"]',
    ),
  "Responsive hardening selectors must target descendants of the portal root.",
);

check(
  dashboardWrapper.includes("/maintenance/labour-risk/shift-cover") &&
    !dashboardWrapper.includes("/skills-matrix?"),
  "The Dashboard Shift Cover card must open the dedicated calendar workflow.",
);
check(
  browserTest.includes('name: "Shift Cover"') &&
    browserTest.includes('name: "Shift Cover Risk"') &&
    browserTest.includes('name: "Operational Rota Risk Map"') &&
    browserTest.includes("/maintenance\\/labour-risk\\/shift-cover"),
  "The authenticated browser workflow must protect the Shift Cover calendar route.",
);
check(
  browserTest.includes('getByLabel("Risk scope"') &&
    browserTest.includes('name: "Ask Vorta AI"') &&
    browserTest.includes("toBeHidden"),
  "Browser regression must cover mobile risk scope and duplicate assistant controls.",
);

console.log("Maintenance Manager audit hardening contracts passed.");
