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
const browser = read("tests/browser/maintenance-manager-equipment-tab-continuity.spec.ts");

assert.match(frame, /max-width: 767px/);
assert.match(frame, /data-vorta-equipment-shared-mobile-hero="true"/);
assert.match(frame, /EquipmentTabNavigationVisibilityProvider visible=\{false\}/);
assert.match(frame, /data-vorta-equipment-tab-placeholder="true"/);
assert.match(frame, /:is\(header, div\):has\(> \[data-vorta-equipment-tab-placeholder/);
assert.match(frame, /data-vorta-mobile-equipment-overview/);
assert.match(frame, /data-vorta-equipment-active-tab=\{activeTab\}/);
assert.match(frame, /overflow-x: clip/);
assert.match(frame, /table tbody tr/);
assert.match(frame, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(frame, /table\[class\*="min-w-\[900px\]"\]/);
assert.match(frame, /table\[class\*="min-w-\[760px\]"\]/);
assert.match(frame, /content: "Stock \/ target"/);
assert.match(frame, /svg\[class\*="min-w-"\]/);

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

assert.match(navigation, /findPortalScrollContainer/);
assert.match(navigation, /verticalScrollByEquipmentRoute/);
assert.match(navigation, /scrollContainer\.scrollTop/);
assert.match(navigation, /scrollContainer\.scrollTo/);
assert.match(navigation, /preventScrollReset: true/);
assert.match(navigation, /window\.setTimeout\(restore, 160\)/);
assert.match(navigation, /data-vorta-preserve-portal-scroll="true"/);
assert.doesNotMatch(navigation, /window\.scrollY/);
assert.doesNotMatch(navigation, /window\.scrollTo/);
assert.match(navigation, /max-width: 767px/);
assert.match(navigation, /EquipmentTabNavigationVisibilityContext/);

assert.match(overviewEntry, /max-width: 767px/);
assert.match(workOrdersEntry, /max-width: 767px/);

assert.match(browser, /data-vorta-equipment-shared-mobile-hero/);
assert.match(browser, /Equipment tab changes preserve vertical position/);
assert.match(browser, /portalScrollPositionBeforeTabChange/);
assert.match(browser, /Every Equipment section fits the full phone viewport/);
assert.match(browser, /expectEquipmentContentFitsViewport/);
assert.match(browser, /wideSurfaces/);
assert.match(browser, /clipped visible elements/);
assert.match(browser, /\[360, 700\]/);

console.log("Shared mobile equipment hero, portal scroll continuity and width containment passed.");
