import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relativePath) =>
  readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), "utf8");

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const aiOperations = read("src/screens/AiOperations/AiOperations.tsx");
const maintenanceExperience = read("src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx");
const mobileHardening = read("src/screens/AiOperations/mobilePortalHardening.css");
const pageTransition = read("src/components/PageTransition.tsx");
const equipmentIndex = read("src/screens/Equipment/index.ts");
const equipmentRoute = read("src/screens/Equipment/EquipmentRouteEntry.tsx");
const equipmentOverviewRoute = read("src/screens/Equipment/EquipmentOverviewRouteEntry.tsx");
const equipmentTabs = read("src/screens/Equipment/EquipmentTabNavigation.tsx");
const mobileEquipment = read("src/screens/Equipment/MobileEquipmentSection.tsx");
const mobileEquipmentOverview = read("src/screens/Equipment/MobileEquipmentOverview.tsx");
const engineersRoute = read("src/screens/Engineers/EngineersRouteEntry.tsx");
const requirementsRoute = read("src/screens/Requirements/RequirementsRouteEntry.tsx");
const trainingRoute = read("src/screens/Training/TrainingRouteEntry.tsx");
const providersRoute = read("src/screens/TrainingProviders/TrainingProvidersRouteEntry.tsx");
const careerRoute = read("src/screens/Career/CareerRouteEntry.tsx");
const supportRoute = read("src/screens/Support/SupportRouteEntry.tsx");
const settingsRoute = read("src/screens/Settings/SettingsRouteEntry.tsx");
const mobileProviders = read("src/screens/TrainingProviders/MobileTrainingProvidersSection.tsx");
const mobileCareer = read("src/screens/Career/MobileCareerSection.tsx");
const mobileSupport = read("src/screens/Support/MobileSupportSection.tsx");
const mobileSettings = read("src/screens/Settings/MobileSettingsSection.tsx");
const browserTest = read("tests/browser/maintenance-manager-mobile-routes.spec.ts");

check(
  engineersRoute.includes("<MobileEngineersSection dataMode={dataMode}") &&
    engineersRoute.includes('dataMode !== "unavailable"'),
  "Engineers must share the phone presentation across demo and live evidence.",
);

check(
  requirementsRoute.includes('dataMode={isLivePilotMode ? "live" : "demo"}') &&
    trainingRoute.includes('dataMode="live"'),
  "Requirements and Training must use their phone-native presentation in live mode.",
);

check(
  equipmentIndex.includes('EquipmentRouteEntry as EquipmentSection') &&
    equipmentIndex.includes('EquipmentOverviewRouteEntry as EquipmentOverview') &&
    !equipmentIndex.includes("equipmentMobilePolish.css") &&
    !equipmentIndex.includes("equipmentOverviewMobileFocus.css"),
  "Equipment routes must no longer depend on brittle mobile DOM-hiding styles.",
);

check(
  equipmentRoute.includes("MobileEquipmentSection") &&
    equipmentOverviewRoute.includes("MobileEquipmentOverview") &&
    mobileEquipment.includes('data-vorta-mobile-equipment="true"') &&
    mobileEquipmentOverview.includes('data-vorta-mobile-equipment-overview="true"'),
  "Equipment list and overview require explicit phone components.",
);

for (const [label, route, marker] of [
  ["Training Providers", providersRoute, "MobileTrainingProvidersSection"],
  ["Workforce Development", careerRoute, "MobileCareerSection"],
  ["Support", supportRoute, "MobileSupportSection"],
  ["Settings", settingsRoute, "MobileSettingsSection"],
]) {
  check(route.includes(marker), `${label} route must expose its mobile workflow.`);
}

check(
  mobileProviders.includes("DetailDrawer") &&
    mobileProviders.includes('data-vorta-mobile-training-providers="true"') &&
    mobileCareer.includes('data-vorta-mobile-career="true"') &&
    mobileSupport.includes("DetailDrawer") &&
    mobileSupport.includes('data-vorta-mobile-support="true"') &&
    mobileSettings.includes('data-vorta-mobile-settings="true"'),
  "Secondary mobile workflows must use semantic phone surfaces and shared drawers.",
);

check(
  mobileSettings.includes("getThemePreference") &&
    mobileSettings.includes("setThemePreference") &&
    mobileSettings.includes("System health") &&
    mobileSettings.includes("<details"),
  "Mobile Settings must lead with appearance and defer administrator health detail.",
);

check(
  aiOperations.includes("PilotEvidenceFrame") &&
    aiOperations.includes('label: "Pilot Evidence"') &&
    !aiOperations.includes('label: "Pilot Adoption"') &&
    mobileHardening.includes('nav[aria-label="Pilot setup stages"]') &&
    mobileHardening.includes('data-vorta-pilot-evidence-tabs="true"'),
  "Pilot evidence and setup must use compact mobile navigation.",
);

check(
  pageTransition.includes("vortaMobilePageTitle") &&
    pageTransition.includes("mobileRouteLabel") &&
    mobileHardening.includes("grid-template-columns: 2.5rem minmax(0, 1fr) 2.5rem") &&
    mobileHardening.includes('> div.md\\:hidden > button') &&
    mobileHardening.includes("grid-column: 3"),
  "The shared phone header must lock logo-left, title-centre and menu-right positions.",
);

check(
  maintenanceExperience.includes('data-vorta-shared-mobile-ai-launcher="true"') &&
    maintenanceExperience.includes('aria-label="Ask Vorta"') &&
    maintenanceExperience.includes('data-vorta-mobile-ai-safe-area="true"') &&
    maintenanceExperience.includes("mobileAssistantPrompt") &&
    equipmentTabs.includes('tab.route !== "ai-insights"') &&
    !equipmentTabs.includes('data-vorta-equipment-mobile-actions="true"') &&
    mobileHardening.includes('data-vorta-embedded-ai="true"') &&
    mobileHardening.includes('placeholder^="Ask Vorta about"'),
  "Mobile pages must use one contextual Ask Vorta launcher without duplicate Equipment docks or inline forms.",
);

check(
  browserTest.includes("mobileRoutes") &&
    browserTest.includes("expectNoPageOverflow") &&
    browserTest.includes("data-vorta-shared-mobile-ai-launcher") &&
    browserTest.includes("Pilot evidence views") &&
    browserTest.includes("Appearance"),
  "Authenticated browser coverage must protect the mobile route matrix and shared AI launcher.",
);

console.log("Maintenance Manager mobile portal audit contracts passed.");
