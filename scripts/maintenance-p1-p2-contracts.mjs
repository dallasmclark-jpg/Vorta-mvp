import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relativePath) =>
  readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), "utf8");

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const guard = read("src/lib/maintenanceDashboardSnapshotGuard.ts");
const dashboardWrapper = read("src/screens/AiOperations/MaintenanceDashboardExperience.tsx");
const dashboard = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx",
);
const portalWrapper = read("src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx");
const hardening = read("src/components/MaintenancePortalHardening.tsx");
const actionEvidence = read("src/components/MaintenanceActionEvidenceHardening.tsx");
const focusTrap = read("src/hooks/useModalFocusTrap.ts");
const skillsMatrix = read("src/screens/SkillsMatrix/SkillsMatrixNative.tsx");
const tsconfig = read("tsconfig.maintenance.json");
const browserTest = read("tests/browser/maintenance-manager-core.spec.ts");
const playwrightConfig = read("playwright.config.ts");
const packageJson = read("package.json");

check(
  guard.includes("vorta_get_operational_dashboard_snapshot") &&
    guard.includes("vorta_refresh_and_get_operational_dashboard"),
  "Dashboard guard must distinguish snapshot reads from explicit recalculation.",
);
check(
  guard.includes("vorta_refresh_risk_work_plan") &&
    guard.includes("allowNextWorkPlanRefresh = shouldRecalculate") &&
    guard.includes("Promise.resolve"),
  "Initial dashboard reads must not rebuild the work plan; explicit refresh must allow one rebuild.",
);
check(
  dashboardWrapper.includes("installMaintenanceDashboardSnapshotGuard") &&
    dashboardWrapper.includes("markExplicitRiskIntelligenceRefresh") &&
    dashboardWrapper.toLowerCase().includes("refresh risk intelligence"),
  "Dashboard wrapper must install the snapshot guard and mark the explicit refresh control.",
);
check(
  dashboard.includes('"daily"') &&
    dashboard.includes('"site"') &&
    dashboard.includes("Refresh risk intelligence"),
  "Existing dashboard initial-load and explicit-refresh behaviours must remain wired.",
);
check(
  guard.indexOf("vorta_get_operational_dashboard_snapshot") <
    guard.indexOf("shouldRecalculate ? REFRESH_RPC : SNAPSHOT_RPC"),
  "Initial dashboard calls must resolve through the read-only snapshot path.",
);

check(
  portalWrapper.includes('data-vorta-maintenance-portal="true"') &&
    portalWrapper.includes("<MaintenancePortalHardening />") &&
    portalWrapper.includes("<MaintenanceActionEvidenceHardening />"),
  "Maintenance Manager routes must mount both shared hardening layers.",
);
check(
  hardening.includes("Skill: ${skillName}") &&
    hardening.includes('searchParams.get("skill")') &&
    skillsMatrix.includes("Clear filters"),
  "Skills Matrix must show the URL-selected skill while preserving Clear filters.",
);

for (const label of [
  "Finding",
  "Source evidence",
  "Responsible person or team",
  "System where action occurs",
  "Completion evidence",
  "Expected risk reduction",
]) {
  check(
    hardening.includes(label) && actionEvidence.includes(label),
    `Risk-reduction evidence contract is missing: ${label}.`,
  );
}
check(
  actionEvidence.includes("values.size < 2") &&
    actionEvidence.includes("vortaEvidenceSummary") &&
    actionEvidence.includes("if (!value) return"),
  "Action evidence summaries must use existing values only and omit unsupported fields.",
);

for (const state of ["loading", "empty", "stale", "error"]) {
  check(
    hardening.includes(`data-vorta-operational-state=\"${state}\"`) ||
      hardening.includes(`state = \"${state}\"`),
    `Shared operational state is missing: ${state}.`,
  );
}

check(
  focusTrap.includes("MODAL_FOCUSABLE_SELECTOR") &&
    focusTrap.includes("previousFocus") &&
    focusTrap.includes('event.key === "Escape"') &&
    hardening.includes("vortaFallbackFocusTrap"),
  "Managed and fallback dialogs must trap focus, support Escape and restore focus.",
);
check(
  hardening.includes("@media (max-width: 420px)") &&
    hardening.includes("@media (min-width: 600px) and (max-width: 1024px)") &&
    hardening.includes("@media (min-width: 1366px)") &&
    playwrightConfig.includes("phone-360") &&
    playwrightConfig.includes("samsung-tablet-portrait") &&
    playwrightConfig.includes("samsung-tablet-landscape") &&
    playwrightConfig.includes("laptop-1366") &&
    playwrightConfig.includes("desktop-1920"),
  "Responsive hardening must cover the five required viewport classes.",
);
check(
  hardening.includes('text-[9px]') &&
    hardening.includes('text-[10px]') &&
    hardening.includes('text-[11px]') &&
    actionEvidence.includes('text-[8px]') &&
    actionEvidence.includes('text-[8.5px]'),
  "Persistent operational typography below approximately 12px must be raised.",
);

for (const requiredScope of [
  "DashboardOverviewSection/DashboardOverviewSection.tsx",
  "GlobalMaintenanceAiAssistantWithFaultsV2.tsx",
  "EquipmentWorkOrders.tsx",
  "equipmentService.ts",
  "workOrderExecutionService.ts",
  "SkillsMatrixNative.tsx",
  "TrainingSection.tsx",
  "RequirementsSection.tsx",
  "MaintenancePortalHardening.tsx",
  "MaintenanceActionEvidenceHardening.tsx",
  "useModalFocusTrap.ts",
]) {
  check(
    tsconfig.includes(requiredScope),
    `Maintenance TypeScript scope is missing ${requiredScope}.`,
  );
}

for (const workflowStep of [
  "Email",
  "Password",
  "Operations Overview",
  "aria-selected",
  "Equipment",
  "work-orders",
  "Confirmation text",
  "Goods movements",
  "toHaveURL(workOrdersUrl)",
  "Ask Vorta",
  "Recent matching history",
  "openFirstDifferentAiWorkOrder",
]) {
  check(
    browserTest.includes(workflowStep),
    `Authenticated browser smoke test is missing: ${workflowStep}.`,
  );
}
check(
  !browserTest.includes("Vorta123!") &&
    !packageJson.includes("Vorta123!"),
  "Browser credentials must never be committed to the repository.",
);
check(
  packageJson.includes('"test:browser"') &&
    packageJson.includes("maintenance-p1-p2-contracts.mjs"),
  "Package scripts must expose the browser and P1/P2 contract gates.",
);

console.log("Maintenance Manager P1/P2 hardening contracts passed.");
