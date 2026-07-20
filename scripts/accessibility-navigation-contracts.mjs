import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const hardening = read("src/components/MaintenancePortalHardening.tsx");
const equipmentTabs = read(
  "src/screens/Equipment/EquipmentTabNavigation.tsx",
);
const portalShell = read("src/components/PortalShell.tsx");
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

console.log("Accessibility and navigation contracts passed.");
