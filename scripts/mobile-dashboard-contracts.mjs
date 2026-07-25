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
const mobileDashboardStyles = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/dashboardMobileFocus.css",
);
const mobileRiskScopeSelector = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/MobileRiskScopeSelector.tsx",
);
const dashboardOverview = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx",
);
const portalShell = read("src/components/PortalShell.tsx");
const aiCommandBar = read("src/components/ai/VortaAiCommandBar.tsx");

check(
  !dashboardWrapper.includes('data-vorta-mobile-section-nav="true"') &&
    !dashboardWrapper.includes("MobileDashboardSectionNav") &&
    !dashboardWrapper.includes("MOBILE_SECTION_OPTIONS") &&
    !dashboardWrapper.includes("scrollToDashboardSection"),
  "Mobile dashboard must not render the removed persistent bottom navigation.",
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

check(
  mobileDashboardStyles.includes("[hidden]") &&
    mobileDashboardStyles.includes("display: none !important;"),
  "Phone dashboards must honour the hidden attribute even when component display utilities are present.",
);

check(
  mobileRiskScopeSelector.includes("<h2") &&
    mobileRiskScopeSelector.includes("Today's Risk") &&
    mobileDashboardStyles.includes(
      'header:has([data-vorta-embedded-ai="true"]) > div:first-child > *',
    ),
  "Phone dashboards must use Today's Risk as the scope heading and remove the repeated briefing heading.",
);

check(
  mobileDashboardStyles.includes(
    '[data-vorta-mobile-risk-scope="true"]::after',
  ) &&
    mobileDashboardStyles.includes("linear-gradient(90deg") &&
    mobileDashboardStyles.includes("min-height: 4.25rem") &&
    mobileDashboardStyles.includes("min-height: 4.625rem") &&
    mobileDashboardStyles.includes("border-width: 0 !important") &&
    mobileDashboardStyles.includes(
      'button[aria-label="Add attachment or context"]',
    ) &&
    mobileDashboardStyles.includes("font-size: 0.75rem !important"),
  "Phone dashboard must retain the compact briefing, tab overflow cue, unclipped Ask Vorta input and simplified work-plan hierarchy.",
);

check(
  portalShell.includes("px-4 py-1 md:hidden") &&
    aiCommandBar.includes("px-2 py-1 sm:py-1.5") &&
    dashboardOverview.includes('className="p-3 sm:p-5"') &&
    dashboardOverview.includes("p-2.5 sm:p-4") &&
    dashboardWrapper.includes("0.75rem 0.75rem 1.5rem") &&
    !dashboardWrapper.includes("0.75rem 0.75rem 8rem"),
  "Phone dashboard polish must retain compact spacing without obsolete bottom-navigation clearance.",
);

console.log("Mobile dashboard scanability contracts passed.");
