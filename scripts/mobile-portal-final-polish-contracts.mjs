import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const environment = read(".env.example");
const operations = read("src/screens/AiOperations/AiOperations.tsx");
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
assert.match(polish, /justify-content: space-between/);
assert.match(polish, /justify-content: flex-end/);
assert.match(polish, /aria-label="Portal navigation"/);
assert.match(polish, /href="\/settings\/pilot-setup"/);
assert.match(polish, /href="\/settings\/data-import"/);
assert.match(polish, /@media \(min-width: 640px\) and \(max-width: 767px\)/);
assert.match(polish, /height: 100dvh !important/);

console.log("Final mobile portal navigation, breakpoints, capability summary and route restrictions passed.");
