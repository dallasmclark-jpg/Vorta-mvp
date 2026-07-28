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
assert.match(tabStates, /\[role=tab\]\[aria-selected=true\]/, "ARIA-selected tabs must use the shared rule.");
assert.match(tabStates, /\[role=tab\]\[data-state=active\]/, "Data-state tabs must use the shared rule.");
assert.match(tabStates, /border:1px solid #2563eb!important/, "Light selected tabs must use one complete blue outline.");
assert.match(tabStates, /background:#fff!important/, "Light selected tabs must retain a neutral surface.");
assert.match(tabStates, /html\.dark :is\([\s\S]*border-color:#60a5fa!important/, "Dark selected tabs must use the blue outline.");
assert.match(tabStates, /background:#0d1117!important/, "Dark selected tabs must retain a neutral surface.");
assert.match(tabStates, /box-shadow:none!important/, "Component-specific selected shadows must be normalised.");
assert.match(tabStates, /\[role=tab\]:focus-visible\{outline:2px solid #60a5fa!important/, "Tabs must retain a visible keyboard focus outline.");
assert.doesNotMatch(tabStates, /background:#(?:1d4ed8|2563eb|3b82f6)!important/i, "Selected tabs must not restore an opaque blue fill.");
assert.doesNotMatch(tabStates, /\[aria-current=page\](?![^{}]*\[role=tab\])/, "Ordinary current-page navigation must not be styled as a tab.");

assert.match(storesInventory, /role="tab"[\s\S]*aria-selected=\{selected\}/, "Stores Inventory tabs must expose semantic selection state.");
assert.match(equipmentTabs, /role="tab"[\s\S]*aria-selected=\{active\}/, "Equipment tabs must expose semantic selection state.");

console.log("VOR-018 shared outlined selected-tab contracts passed.");
