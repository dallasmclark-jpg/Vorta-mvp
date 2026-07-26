import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const operations = read("src/screens/AiOperations/AiOperations.tsx");
const frame = read("src/screens/Equipment/EquipmentMobileDetailFrame.tsx");
const navigation = read("src/screens/Equipment/EquipmentTabNavigation.tsx");
const overviewEntry = read("src/screens/Equipment/EquipmentOverviewRouteEntry.tsx");
const workOrdersEntry = read("src/screens/Equipment/EquipmentWorkOrdersWithAiNavigation.tsx");
const browser = read("tests/browser/maintenance-manager-mobile-routes.spec.ts");

assert.match(frame, /max-width: 767px/);
assert.match(frame, /data-vorta-equipment-shared-mobile-hero="true"/);
assert.match(frame, /EquipmentTabNavigationVisibilityProvider visible=\{false\}/);
assert.match(frame, /data-vorta-equipment-tab-placeholder="true"/);
assert.match(frame, /:is\(header, div\):has\(> \[data-vorta-equipment-tab-placeholder/);
assert.match(frame, /data-vorta-mobile-equipment-overview/);

for (const route of [
  "overview",
  "notifications",
  "work-orders",
  "pms",
  "history",
  "skills",
  "spares",
  "documents",
  "ai-insights",
]) {
  assert.match(
    operations,
    new RegExp(`<EquipmentMobileDetailFrame activeTab="${route}">`),
    `${route} must use the shared mobile equipment frame.`,
  );
}

assert.match(navigation, /pendingVerticalScrollByEquipment/);
assert.match(navigation, /top: window\.scrollY/);
assert.match(navigation, /preventScrollReset: true/);
assert.match(navigation, /window\.scrollTo/);
assert.match(navigation, /window\.setTimeout\(restore, 160\)/);
assert.match(navigation, /max-width: 767px/);
assert.match(navigation, /EquipmentTabNavigationVisibilityContext/);

assert.match(overviewEntry, /max-width: 767px/);
assert.match(workOrdersEntry, /max-width: 767px/);

assert.match(browser, /data-vorta-equipment-shared-mobile-hero/);
assert.match(browser, /Equipment tab changes preserve vertical position/);
assert.match(browser, /scrollPositionBeforeTabChange/);

console.log("Shared mobile equipment hero and tab scroll continuity passed.");
