import { existsSync, readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const dashboardExperience = read(
  "../src/screens/AiOperations/MaintenanceDashboardExperience.tsx",
);
const aiOperations = read(
  "../src/screens/AiOperations/AiOperations.tsx",
);
const workOrderExperience = read(
  "../src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx",
);

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
  "Dashboard loads a read-only operational snapshot",
  dashboardExperience.includes("vorta_get_operational_dashboard_snapshot")
);

check(
  "Dashboard recalculates only from the explicit refresh control",
  dashboardExperience.includes("vorta_recalculate_and_get_operational_dashboard") &&
    dashboardExperience.includes("Refresh risk intelligence")
);

check(
  "Legacy duplicate dashboard controls are hidden",
  dashboardExperience.includes("vortaDashboardOriginalControl") &&
    dashboardExperience.includes('button.getAttribute("aria-label") === "Refresh"')
);

check(
  "Live freshness replaces hard-coded pseudo content",
  dashboardExperience.includes("vorta-live-dashboard-freshness::before") &&
    dashboardExperience.includes("Risk calculated") &&
    dashboardExperience.includes("maintenanceDataAt") &&
    dashboardExperience.includes("workforceDataAt")
);

check(
  "Stale dashboard intelligence refreshes once in the background",
  dashboardExperience.includes("backgroundRefreshStartedRef") &&
    dashboardExperience.includes("STALE_AFTER_MS")
);

check(
  "Persistent pulse styling is neutralised",
  dashboardExperience.includes("button.animate-pulse") &&
    dashboardExperience.includes("animation: none !important")
);

check(
  "Desktop KPI cards render as a comparison grid",
  dashboardExperience.includes('aria-label="Risk reduction KPI cards"') &&
    dashboardExperience.includes("grid-template-columns: repeat(3")
);

check(
  "Dashboard navigation cards gain keyboard interaction",
  dashboardExperience.includes('element.setAttribute("role", "link")') &&
    dashboardExperience.includes('event.key !== "Enter"')
);

check(
  "Intervention dialog gains modal semantics and Escape support",
  dashboardExperience.includes('dialog.setAttribute("aria-modal", "true")') &&
    dashboardExperience.includes('event.key === "Escape"')
);

check(
  "Dashboard work-order actions resolve equipment before opening the overlay",
  workOrderExperience.includes("getEquipmentIdForWorkOrder") &&
    workOrderExperience.includes("VORTA_WORK_ORDER_DETAIL_EVENT")
);

check(
  "Temporary dashboard patch workflows are absent",
  !existsSync(
    new URL(
      "../.github/workflows/apply-maintenance-dashboard-improvements.yml",
      import.meta.url,
    ),
  ) &&
    !existsSync(
      new URL(
        "../.github/workflows/apply-maintenance-dashboard-core-v2.yml",
        import.meta.url,
      ),
    )
);

if (failures.length > 0) {
  console.error(`\n${failures.length} maintenance dashboard contract(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nMaintenance dashboard contracts passed.");
}
