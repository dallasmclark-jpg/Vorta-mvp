import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(repositoryRoot, path), "utf8");
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const dashboardWrapper = read(
  "src/screens/AiOperations/MaintenanceDashboardExperience.tsx",
);
const labourRisk = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/LabourRiskSection.tsx",
);

check(
  dashboardWrapper.includes('data-vorta-mobile-section-nav="true"') &&
    dashboardWrapper.includes('aria-label="Dashboard section navigation"'),
  "Mobile dashboard must expose a persistent section navigator.",
);

for (const label of ["Overview", "Plant", "Labour", "Trends"]) {
  check(
    dashboardWrapper.includes(`label: "${label}"`),
    `Mobile dashboard navigation is missing ${label}.`,
  );
}

check(
  dashboardWrapper.includes("scrollIntoView") &&
    dashboardWrapper.includes("prefers-reduced-motion") &&
    dashboardWrapper.includes('aria-label="Risk reduction performance"'),
  "Mobile section navigation must scroll accessibly to live dashboard sections.",
);

check(
  dashboardWrapper.includes(
    'section:has([aria-label^="View equipment in "]) div:has(> [aria-label^="View equipment in "])',
  ) &&
    dashboardWrapper.includes("scroll-snap-type: x mandatory") &&
    dashboardWrapper.includes("dl > div:not(:first-child)"),
  "Plant risk cards must become compact swipeable summaries on mobile.",
);

check(
  labourRisk.includes('data-vorta-card-rail="labour-risk"') &&
    labourRisk.includes('data-vorta-dashboard-card="labour-risk"') &&
    labourRisk.includes('data-vorta-mobile-secondary="true"') &&
    labourRisk.includes('data-vorta-mobile-card-action="true"'),
  "Labour risk cards must expose explicit mobile summary hooks.",
);

check(
  dashboardWrapper.includes(
    '[aria-label="Risk reduction KPI cards"] > [data-risk-kpi-card]',
  ) &&
    dashboardWrapper.includes("min-width: 100% !important") &&
    dashboardWrapper.includes("scroll-snap-stop: always"),
  "Mobile KPI cards must render one complete card per viewport without partial clipping.",
);

check(
  dashboardWrapper.includes("min-height: 2.75rem") &&
    dashboardWrapper.includes("width: 100%") &&
    labourRisk.includes("Open details →"),
  "Mobile actions must provide clear full-width, touch-friendly controls.",
);

check(
  !dashboardWrapper.includes("MutationObserver") &&
    !dashboardWrapper.includes("innerHTML") &&
    !dashboardWrapper.includes("appendChild"),
  "Mobile dashboard improvements must not reintroduce rendered-DOM patching.",
);

console.log("Mobile dashboard scanability contracts passed.");
