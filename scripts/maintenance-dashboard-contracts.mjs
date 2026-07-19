import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const dashboardExperience = read("../src/screens/AiOperations/MaintenanceDashboardExperience.tsx");
const dashboard = read("../src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx");
const aiOperations = read("../src/screens/AiOperations/AiOperations.tsx");
const skillsMatrixRoute = read("../src/screens/AiOperations/SkillsMatrixRouteEntry.tsx");
const workOrderExperience = read("../src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx");
const maintenanceActions = read("../src/lib/maintenanceActions.ts");

const failures = [];
const check = (name, condition) => {
  if (condition) {
    console.log(`✓ ${name}`);
    return;
  }
  failures.push(name);
  console.error(`✗ ${name}`);
};

check(
  "Maintenance dashboard route uses the scoped dashboard experience",
  aiOperations.includes("<MaintenanceDashboardExperience />") &&
    !aiOperations.includes("element={<DashboardOverviewSection />}")
);

check(
  "Dashboard wrapper avoids broad rendered-DOM patching",
  !dashboardExperience.includes("MutationObserver") &&
    !dashboardExperience.includes("createPortal") &&
    !dashboardExperience.includes("document.body") &&
    !dashboardExperience.includes("innerHTML") &&
    !dashboardExperience.includes("appendChild") &&
    !dashboardExperience.includes("querySelector") &&
    !dashboardExperience.includes("onClickCapture")
);

check(
  "Router protects the dedicated Shift Cover calendar",
  aiOperations.includes("<SkillsMatrixRouteEntry />") &&
    aiOperations.includes('import("./SkillsMatrixRouteEntry")') &&
    skillsMatrixRoute.includes('risk === "shift-cover"') &&
    skillsMatrixRoute.includes("/maintenance/labour-risk/shift-cover") &&
    !dashboardExperience.includes("isShiftCoverCard")
);

check(
  "Dashboard owns its explicit operational refresh",
  dashboard.includes("refreshAndGetOperationalDashboard") &&
    dashboard.includes("getOperationalDashboardSnapshot") &&
    dashboard.includes("loadRiskDashboard")
);

check(
  "Desktop KPI cards render as a comparison grid",
  dashboardExperience.includes('aria-label="Risk reduction KPI cards"') &&
    dashboardExperience.includes("grid-template-columns: repeat(3")
);

check(
  "Portal bridge no longer parses arbitrary work order clicks",
  !workOrderExperience.includes("WORK_ORDER_NUMBER") &&
    !workOrderExperience.includes("getEquipmentIdForWorkOrder") &&
    !workOrderExperience.includes("stopImmediatePropagation")
);

check(
  "Maintenance actions expose an explicit work order command",
  maintenanceActions.includes("openWorkOrderDetail") &&
    maintenanceActions.includes("WorkOrderDetailSelection")
);

check(
  "Dashboard uses the explicit work order action",
  dashboard.includes("openWorkOrderDetail")
);

check(
  "Temporary dashboard patch workflows are absent",
  !existsSync(new URL("../.github/workflows/apply-maintenance-dashboard-improvements.yml", import.meta.url)) &&
    !existsSync(new URL("../.github/workflows/apply-maintenance-dashboard-core-v2.yml", import.meta.url))
);

if (failures.length > 0) {
  console.error(`\n${failures.length} maintenance dashboard contract(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nMaintenance dashboard contracts passed.");
}
