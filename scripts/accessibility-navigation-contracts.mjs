import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const hardening = read("src/components/MaintenancePortalHardening.tsx");
const equipmentTabs = read(
  "src/screens/Equipment/EquipmentTabNavigation.tsx",
);
const portalShell = read("src/components/PortalShell.tsx");
const engineerPortal = read("src/screens/EngineerPortal/EngineerPortal.tsx");
const engineerPortalShell = read(
  "src/screens/EngineerPortal/EngineerPortalShell.tsx",
);
const operatorPortal = read("src/screens/OperatorPortal/OperatorPortal.tsx");
const shiftCover = read("src/screens/LabourRisk/LiveShiftCoverPage.tsx");
const qualityWorkflow = read(".github/workflows/maintenance-manager-quality.yml");
const contractRunner = read("scripts/run-contract-suite.mjs");

for (const expected of [
  ":focus-visible",
  "outline: 2px solid #93c5fd",
  '[aria-current="page"]',
  '[role="tab"][aria-selected="true"]',
  '[aria-pressed="true"]',
  "prefers-reduced-motion: reduce",
  "forced-colors: active",
]) {
  assert.ok(
    hardening.includes(expected),
    `Missing Maintenance Manager accessibility treatment: ${expected}`,
  );
}

for (const expected of [
  'role="tablist"',
  'role="tab"',
  "aria-selected={active}",
  "tabIndex={active ? 0 : -1}",
  'event.key === "ArrowRight"',
  'event.key === "ArrowLeft"',
  'event.key === "Home"',
  'event.key === "End"',
  'event.key === "Enter"',
  'event.key === " "',
  "tabRefs.current[nextIndex]?.focus()",
  "pendingKeyboardFocusByEquipment",
  "activeButton.focus({ preventScroll: true })",
  'aria-orientation="horizontal"',
  'data-vorta-equipment-tablist="true"',
]) {
  assert.ok(
    equipmentTabs.includes(expected),
    `Missing Equipment keyboard-navigation contract: ${expected}`,
  );
}

assert.doesNotMatch(equipmentTabs, /document\.|MutationObserver/);
assert.doesNotMatch(hardening, /document\.|MutationObserver/);

for (const expected of [
  'aria-label="Primary navigation"',
  'aria-label="Secondary navigation"',
  'aria-label="Portal navigation"',
  'aria-label="Open menu"',
  'aria-label="Close sidebar"',
]) {
  assert.ok(
    portalShell.includes(expected),
    `Missing portal navigation label: ${expected}`,
  );
}

assert.match(
  operatorPortal,
  /accentColor="blue"/,
  "Operator portal must use the canonical Vorta intelligence-blue navigation accent.",
);
assert.doesNotMatch(
  operatorPortal,
  /accentColor="emerald"/,
  "Operator portal must not use role-specific green navigation branding.",
);

assert.match(
  engineerPortal,
  /<EngineerPortalShell>/,
  "Engineer portal must use the dedicated responsive Engineer shell.",
);
assert.doesNotMatch(
  engineerPortal,
  /accentColor="emerald"/,
  "Engineer portal must not use role-specific green navigation branding.",
);
for (const expected of [
  'aria-label="Engineer primary navigation"',
  'aria-label="Engineer secondary navigation"',
  'aria-label="Open engineer menu"',
  'aria-label="Close menu"',
  'data-vorta-engineer-bottom-nav="true"',
  'bg-blue-500/[0.10] text-blue-300',
  'active ? "text-blue-400"',
  'focus-visible:ring-blue-400',
]) {
  assert.ok(
    engineerPortalShell.includes(expected),
    `Missing Engineer accessibility or intelligence-blue navigation contract: ${expected}`,
  );
}
assert.doesNotMatch(
  engineerPortalShell,
  /(?:text|bg|border)-emerald-[0-9]+/,
  "Engineer navigation shell must not introduce role-specific green branding.",
);

for (const expected of [
  "aria-pressed={selected}",
  'aria-label="Previous week"',
  'aria-label="Next week"',
  'aria-label="Previous day"',
  'aria-label="Next day"',
]) {
  assert.ok(
    shiftCover.includes(expected),
    `Missing Shift Cover keyboard contract: ${expected}`,
  );
}

assert.ok(
  qualityWorkflow.includes(
    "tests/browser/maintenance-manager-accessibility.spec.ts",
  ),
  "The authenticated browser gate must run the accessibility regression",
);

assert.ok(
  contractRunner.includes(
    '"scripts/accessibility-navigation-contracts.mjs"',
  ),
  "The production contract manifest must enforce accessibility navigation contracts",
);

console.log("Accessibility and canonical VOR-097 / Engineer navigation contracts passed.");
