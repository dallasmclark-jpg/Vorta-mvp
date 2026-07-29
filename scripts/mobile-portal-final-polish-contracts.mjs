import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const environment = read(".env.example");
const operations = read("src/screens/AiOperations/AiOperations.tsx");
const maintenanceExperience = read("src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx");
const globalAssistant = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");
const mobilePageHeader = read("src/screens/AiOperations/MobilePageHeaderExperience.tsx");
const portalShell = read("src/components/PortalShell.tsx");
const demoSimulationBanner = read("src/components/DemoSimulationBanner.tsx");
const aiMatchingEntry = read("src/screens/AiMatching/AiMatchingRouteEntry.tsx");
const phoneGuard = read("src/screens/AiOperations/TabletDesktopOnly.tsx");
const polish = read("src/screens/AiOperations/mobilePortalFinalPolish.css");
const mobileHardening = read("src/screens/AiOperations/mobilePortalHardening.css");
const mobileAiPolish = read("src/screens/AiOperations/MobileAiPolishStyles.tsx");
const skillsEntry = read("src/screens/SkillsMatrix/index.ts");
const capabilitySummary = read("src/screens/SkillsMatrix/MobileCapabilitySummary.tsx");
const requirementsEntry = read("src/screens/Requirements/RequirementsRouteEntry.tsx");
const mobileRequirements = read("src/screens/Requirements/MobileRequirementsSection.tsx");
const routes = [
  read("src/screens/Engineers/EngineersRouteEntry.tsx"),
  read("src/screens/Training/TrainingRouteEntry.tsx"),
  read("src/screens/TrainingProviders/TrainingProvidersRouteEntry.tsx"),
  read("src/screens/Career/CareerRouteEntry.tsx"),
  read("src/screens/Support/SupportRouteEntry.tsx"),
  read("src/screens/Settings/SettingsRouteEntry.tsx"),
  read("src/screens/Equipment/EquipmentRouteEntry.tsx"),
  requirementsEntry,
  skillsEntry,
];

assert.match(environment, /^VITE_ENABLE_CAPABILITY_MATCHING=false$/m);
assert.match(operations, /VITE_ENABLE_CAPABILITY_MATCHING/);
assert.match(operations, /path="ai-matching" element=\{<AiMatchingSection \/>\}/);
assert.match(operations, /\.\.\.\(capabilityMatchingEnabled/);
assert.match(aiMatchingEntry, /VITE_ENABLE_CAPABILITY_MATCHING/);
assert.match(aiMatchingEntry, /if \(!capabilityMatchingEnabled\)/);
assert.match(aiMatchingEntry, /<Navigate to="\/requirements" replace \/>/);
assert.match(operations, /<TabletDesktopOnly>[\s\S]*?<PilotSetupSection \/>[\s\S]*?<\/TabletDesktopOnly>/);
assert.match(operations, /<TabletDesktopOnly>[\s\S]*?<SapDataImportSection \/>[\s\S]*?<\/TabletDesktopOnly>/);
assert.match(operations, /path="shift-handover" element=\{<ShiftHandoverSection \/>\}/);

assert.match(phoneGuard, /max-width: 767px/);
assert.match(phoneGuard, /<Navigate to=\{fallbackRoute\} replace \/>/);
assert.match(maintenanceExperience, /const isPhone = useMediaQuery\("\(max-width: 767px\)"\)/);
assert.match(maintenanceExperience, /data-vorta-shared-mobile-ai-launcher="true"/);
assert.match(maintenanceExperience, /<MobilePageHeaderExperience \/>/);

assert.match(mobilePageHeader, /usePortalMobileHeaderTitle\(title\)/);
assert.match(mobilePageHeader, /title: "Capability"/);
assert.match(mobilePageHeader, /title: "Shift Handover"/);
assert.match(mobilePageHeader, /title: "Equipment"/);
assert.doesNotMatch(mobilePageHeader, /querySelector|MutationObserver|content: attr|!important/);
assert.match(portalShell, /PortalMobileHeaderContext/);
assert.match(portalShell, /data-vorta-mobile-topbar="true"/);
assert.match(portalShell, /data-vorta-mobile-header-title="true"/);
assert.match(portalShell, /data-vorta-mobile-topbar-home="true"/);
assert.match(portalShell, /aria-label="Go to main dashboard"/);
assert.match(portalShell, /data-vorta-mobile-topbar-menu="true"/);
assert.match(portalShell, /grid-cols-\[2\.5rem_minmax\(0,1fr\)_2\.5rem\]/);
assert.match(portalShell, /data-vorta-mobile-navigation-overlay="true"/);
assert.match(portalShell, /data-vorta-mobile-navigation-drawer="true"/);
assert.match(portalShell, /PHONE_HIDDEN_ROUTES/);
assert.match(portalShell, /filterPhoneNav/);
assert.match(portalShell, /data-vorta-portal-scroll-container="true"/);

assert.match(demoSimulationBanner, /export function DemoSimulationBanner/);
assert.match(demoSimulationBanner, /\): null \{\s*return null;\s*\}/s);
assert.doesNotMatch(
  demoSimulationBanner,
  /data-demo-simulation|Demo simulation|FlaskConical|role="note"/,
  "The shared demo statement boundary must not render visible or accessible content.",
);

for (const route of routes) {
  assert.match(route, /max-width: 767px/, "Every explicit phone route must cover the full sub-768px range.");
}

assert.match(skillsEntry, /MobileCapabilitySummary/);
assert.match(capabilitySummary, /data-vorta-mobile-capability-summary="true"/);
assert.match(capabilitySummary, /Capability Summary/);
assert.match(capabilitySummary, /skills-matrix-data/);
assert.match(capabilitySummary, /criticalGaps/);
assert.match(capabilitySummary, /priorityRisks/);
assert.match(capabilitySummary, /navigate\(`\/equipment\/\$\{encodeURIComponent\(risk\.equipmentId\)\}\/skills`\)/);
assert.doesNotMatch(capabilitySummary, /insert\(|update\(|delete\(/);

assert.match(requirementsEntry, /MobileRequirementsSection/);
assert.match(mobileRequirements, /View capability evidence/);
assert.doesNotMatch(mobileRequirements, /Open AI Matching|navigate\("\/ai-matching"\)/);

assert.match(globalAssistant, /data-vorta-global-ai-panel="true"/);
assert.match(globalAssistant, /data-vorta-global-ai-header="true"/);
assert.match(globalAssistant, /data-vorta-global-ai-messages="true"/);
assert.match(globalAssistant, /data-vorta-global-ai-composer="true"/);
assert.match(globalAssistant, /data-vorta-global-ai-input="true"/);
assert.match(globalAssistant, /max-md:h-\[100dvh\]/);
assert.match(globalAssistant, /max-md:hidden/);
assert.doesNotMatch(globalAssistant, /max-sm:/);

assert.match(polish, /@media \(max-width: 767px\)/);
assert.match(polish, /data-vorta-embedded-ai/);
assert.match(polish, /data-vorta-maintenance-portal/);
assert.match(polish, /data-vorta-mobile-page-title/);
assert.doesNotMatch(polish, /:has\(|md\\:hidden|href=|aria-label=|>\s|\[class|placeholder\^=/);
assert.equal((polish.match(/!important/g) ?? []).length, 1);
assert.doesNotMatch(mobileHardening, /> section > div\.md\\:hidden|content: attr\(data-vorta-mobile-page-title\)/);
assert.doesNotMatch(mobileHardening, /div\.fixed:has\(button\[aria-label="Close global assistant"\]\)/);
assert.match(mobileHardening, /data-vorta-global-ai-panel/);
assert.match(mobileHardening, /data-vorta-global-ai-header/);
assert.match(mobileHardening, /data-vorta-global-ai-messages/);
assert.match(mobileHardening, /data-vorta-global-ai-composer/);
assert.doesNotMatch(mobileAiPolish, /div\.fixed:has\(button\[aria-label="Close global assistant"\]\)/);
assert.match(mobileAiPolish, /data-vorta-global-ai-panel/);
assert.match(mobileAiPolish, /data-vorta-global-ai-composer-row/);

console.log("Semantic mobile portal navigation, shared page titles, AI layout, capability summary and route restrictions passed.");
