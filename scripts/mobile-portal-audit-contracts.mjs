import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relativePath) =>
  readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), "utf8");

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const aiOperations = read("src/screens/AiOperations/AiOperations.tsx");
const maintenanceActions = read("src/lib/maintenanceActions.ts");
const maintenanceExperience = read("src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx");
const mobileHardening = read("src/screens/AiOperations/mobilePortalHardening.css");
const mobileAiPolish = read("src/screens/AiOperations/MobileAiPolishStyles.tsx");
const mobileComposer = read("src/screens/AiOperations/MobileAiComposerControls.tsx");
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
    maintenanceExperience.includes('data-vorta-ai-context-prompt=') &&
    maintenanceExperience.includes('aria-label="Ask Vorta"') &&
    maintenanceExperience.includes('data-vorta-mobile-ai-safe-area="true"') &&
    maintenanceExperience.includes("mobileAssistantPrompt") &&
    maintenanceExperience.includes("openMaintenanceAiAssistant({ submit: false })") &&
    maintenanceExperience.includes('import { MobileAiPolishStyles } from "./MobileAiPolishStyles"') &&
    maintenanceExperience.includes("<MobileAiPolishStyles />") &&
    maintenanceActions.includes("question?: string") &&
    maintenanceActions.includes("submit: question ?") &&
    equipmentTabs.includes('tab.route !== "ai-insights"') &&
    !equipmentTabs.includes('data-vorta-equipment-mobile-actions="true"') &&
    mobileHardening.includes('data-vorta-embedded-ai="true"') &&
    mobileHardening.includes('placeholder^="Ask Vorta about"'),
  "Mobile pages must open one contextual Ask Vorta assistant without duplicate controls or prefilled composer text.",
);

check(
  mobileHardening.includes("height: 100dvh !important") &&
    mobileHardening.includes('content: "What can I help with?"') &&
    mobileHardening.includes("font-size: 0 !important") &&
    mobileHardening.includes("div:nth-of-type(n+4)") &&
    mobileHardening.includes('data-vorta-fault-panel="true"'),
  "Mobile Vorta AI must use a full-screen chat presentation with a restrained answer and icon-only composer.",
);

check(
  mobileAiPolish.includes("MOBILE_AI_POLISH_STYLES") &&
    mobileAiPolish.includes("linear-gradient(145deg") &&
    mobileAiPolish.includes('button[aria-label="Close global assistant"]') &&
    mobileAiPolish.includes("input:focus-visible") &&
    mobileAiPolish.includes("outline: 0 solid transparent !important") &&
    mobileAiPolish.includes("box-shadow: none !important") &&
    mobileAiPolish.includes('data-vorta-fault-panel="true"') &&
    mobileAiPolish.includes('data-vorta-ai-attach-control="true"') &&
    mobileAiPolish.includes('button[aria-label$="voice dictation"]') &&
    mobileAiPolish.includes("order: 1") &&
    mobileAiPolish.includes("order: 3") &&
    mobileAiPolish.includes("order: 4"),
  "Mobile Ask Vorta must retain its branded header, neutral focus and ChatGPT-style composer order.",
);

check(
  mobileComposer.includes("createPortal") &&
    mobileComposer.includes('aria-label="Add photos and files"') &&
    mobileComposer.includes('accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"') &&
    mobileComposer.includes('data-vorta-ai-attachment-count=') &&
    mobileComposer.includes('data-vorta-ai-mobile-mic="true"') &&
    mobileComposer.includes("webkitSpeechRecognition") &&
    mobileComposer.includes("setControlledInputValue"),
  "The shared mobile composer must provide file selection and a working voice control for both assistant modes.",
);

check(
  browserTest.includes("mobileRoutes") &&
    browserTest.includes("expectNoPageOverflow") &&
    browserTest.includes("data-vorta-shared-mobile-ai-launcher") &&
    browserTest.includes("What can I help with?") &&
    browserTest.includes('toHaveCSS("font-size", "0px")') &&
    browserTest.includes('toHaveValue("")') &&
    browserTest.includes('toHaveCSS("outline-width", "0px")') &&
    browserTest.includes("Add photos and files") &&
    browserTest.includes("equipment-evidence.jpg") &&
    browserTest.includes("microphoneBox") &&
    browserTest.includes("Pilot evidence views") &&
    browserTest.includes("Appearance"),
  "Authenticated browser coverage must protect the mobile route matrix and ChatGPT-style AI composer.",
);

console.log("Maintenance Manager mobile portal audit contracts passed.");
