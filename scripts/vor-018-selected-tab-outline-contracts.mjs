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
assert.match(
  tabStates,
  /\[data-vorta-portal-shell="true"\]/,
  "Selected tab normalisation must be scoped to the Vorta portal.",
);
assert.match(
  tabStates,
  /:where\(\[data-vorta-tab-outline="true"\], \[role="tab"\]\)\[aria-selected="true"\]/,
  "Portal tabs must retain semantic selected-state styling.",
);
assert.match(tabStates, /border: 1px solid #2563eb;/, "Light selected tabs must use one complete blue outline.");
assert.match(tabStates, /background: #fff;/, "Light selected tabs must retain a neutral surface.");
assert.match(tabStates, /border-color: #60a5fa;/, "Dark selected tabs must use the blue outline.");
assert.match(tabStates, /background: #0d1117;/, "Dark selected tabs must retain a neutral surface.");
assert.match(tabStates, /box-shadow: none;/, "Component-specific selected shadows must be normalised.");
assert.match(tabStates, /outline: 2px solid #60a5fa;/, "Tabs must retain a visible keyboard focus outline.");
assert.doesNotMatch(tabStates, /!important/, "Selected tab styling must not depend on global importance escalation.");
assert.doesNotMatch(tabStates, /background:\s*#(?:1d4ed8|2563eb|3b82f6)/i, "Selected tabs must not restore an opaque blue fill.");
assert.doesNotMatch(tabStates, /\[aria-current="?page"?\]/, "Ordinary current-page navigation must not be styled as a tab.");

assert.match(storesInventory, /role="tab"[\s\S]*aria-selected=\{selected\}/, "Stores Inventory tabs must expose semantic selection state.");
assert.match(equipmentTabs, /role="tab"[\s\S]*aria-selected=\{active\}/, "Equipment tabs must expose semantic selection state.");
assert.match(equipmentTabs, /data-vorta-tab-outline="true"/, "Equipment tabs must declare shared visual intent explicitly.");

console.log("VOR-018 and VOR-022 portal-scoped selected-tab contracts passed.");
