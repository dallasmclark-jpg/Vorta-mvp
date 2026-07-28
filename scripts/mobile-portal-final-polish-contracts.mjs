import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const environment = read(".env.example");
const operations = read("src/screens/AiOperations/AiOperations.tsx");
const maintenanceExperience = read("src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx");
const mobilePageHeader = read("src/screens/AiOperations/MobilePageHeaderExperience.tsx");
const portalShell = read("src/components/PortalShell.tsx");
const demoSimulationBanner = read("src/components/DemoSimulationBanner.tsx");
const aiMatchingEntry = read("src/screens/AiMatching/AiMatchingRouteEntry.tsx");
const phoneGuard = read("src/screens/AiOperations/TabletDesktopOnly.tsx");
const polish = read("src/screens/AiOperations/mobilePortalFinalPolish.css");
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

assert.match(mobilePageHeader, /data-vorta-mobile-header-title/);
assert.match(mobilePageHeader, /content: attr\(data-vorta-mobile-header-title\)/);
assert.match(mobilePageHeader, /data-vorta-mobile-duplicate-page-title/);
assert.match(mobilePageHeader, /data-vorta-mobile-settings-duplicate-theme-toggle/);
assert.match(mobilePageHeader, /removeSettingsHeaderThemeShortcut/);
assert.match(mobilePageHeader, /THEME_SHORTCUT_LABELS/);
assert.match(mobilePageHeader, /title: "Capability"/);
assert.match(mobilePageHeader, /title: "Shift Handover"/);
assert.match(mobilePageHeader, /profile: \{ title: "Equipment", duplicateHeadings: \[\] \}/);
assert.match(mobilePageHeader, /font-size: 1\.125rem !important/);
assert.match(mobilePageHeader, /min-height: 4rem !important/);
assert.match(mobilePageHeader, /data-vorta-mobile-dashboard-logo-link/);
assert.match(mobilePageHeader, /aria-label", "Go to main dashboard"/);
assert.match(mobilePageHeader, /navigate\("\/dashboard"\)/);
assert.match(mobilePageHeader, /event\.key !== "Enter" && event\.key !== " "/);
assert.match(portalShell, /<NavLink to=\{homeRoute\} aria-label="Vorta home"/);

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
assert.match(polish, /Remove the retired standalone matching action/);
assert.match(polish, /data-vorta-mobile-requirements/);

assert.match(polish, /@media \(max-width: 767px\)/);
assert.match(polish, /flex-direction: row-reverse !important/);
assert.match(polish, /justify-content: space-between/);
assert.match(polish, /justify-content: flex-end/);
assert.match(polish, /aria-label="Portal navigation"/);
assert.match(polish, /href="\/settings\/pilot-setup"/);
assert.match(polish, /href="\/settings\/data-import"/);
assert.match(polish, /@media \(min-width: 640px\) and \(max-width: 767px\)/);
assert.match(polish, /height: 100dvh !important/);

console.log("Final mobile portal navigation, retired demo statements, dashboard logo routing, page titles, settings controls, breakpoints, capability summary and route restrictions passed.");
