import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const index = read("index.html");
const tabStates = read("src/tab-states.css");
const storesInventory = read("src/screens/StoresInventory/StoresInventorySection.tsx");
const equipmentTabs = read("src/screens/Equipment/EquipmentTabNavigation.tsx");

assert.match(
  index,
  /<link href="\/src\/card-surfaces\.css" rel="stylesheet" \/>\s*<link href="\/src\/tab-states\.css" rel="stylesheet" \/>/,
  "The selected-tab stylesheet must load after shared surface rules.",
);

for (const token of [
  "--vorta-tab-selected-surface",
  "--vorta-tab-selected-border",
  "--vorta-tab-selected-text",
  "--vorta-tab-focus-outline",
]) {
  assert.match(tabStates, new RegExp(token), `${token} must remain a shared theme token.`);
}

assert.match(tabStates, /html\.dark\{[\s\S]*--vorta-tab-selected-surface:#0d1117/, "Dark mode must use a neutral selected surface.");
assert.match(tabStates, /\[role=tab\]\[aria-selected=true\]/, "ARIA-selected tabs must use the shared rule.");
assert.match(tabStates, /\[role=tab\]\[data-state=active\]/, "Data-state tabs must use the shared rule.");
assert.match(tabStates, /\[role=tablist\][\s\S]*\[aria-current=page\]/, "Tab links must use the shared rule.");
assert.match(tabStates, /border:1px solid var\(--vorta-tab-selected-border\)!important/, "Selected tabs must use one complete blue outline.");
assert.match(tabStates, /background:var\(--vorta-tab-selected-surface\)!important/, "Selected tabs must retain a neutral surface.");
assert.match(tabStates, /box-shadow:none!important/, "Component-specific selected shadows must be normalised.");
assert.match(tabStates, /:focus-visible\{outline:2px solid var\(--vorta-tab-focus-outline\)!important/, "Tabs must retain a visible keyboard focus outline.");
assert.doesNotMatch(tabStates, /background:(?:#(?:1d4ed8|2563eb|3b82f6)|rgb\(37,99,235\)|rgb\(59,130,246\))/i, "Selected tabs must not restore an opaque blue fill.");

assert.match(storesInventory, /role="tab"[\s\S]*aria-selected=\{selected\}/, "Stores Inventory tabs must expose semantic selection state.");
assert.match(equipmentTabs, /role="tab"[\s\S]*aria-selected=\{active\}/, "Equipment tabs must expose semantic selection state.");
assert.doesNotMatch(tabStates, /:where\(\[aria-current=page\]/, "The shared rule must not style sidebar or ordinary navigation links.");

console.log("VOR-018 shared outlined selected-tab contracts passed.");
