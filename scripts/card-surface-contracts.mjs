import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const index = read("index.html");
const surfaces = read("src/card-surfaces.css");
const transition = read("src/components/PageTransition.tsx");
const card = read("src/components/ui/card.tsx");
const equipmentSpares = read("src/screens/Equipment/EquipmentSpares.tsx");
const mobileEquipment = read("src/screens/Equipment/MobileEquipmentSection.tsx");
const shiftHandover = read("src/screens/ShiftHandover/ShiftHandoverSection.tsx");
const maintenanceExperience = read(
  "src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx",
);

assert.match(index, /<link href="\/src\/card-surfaces\.css" rel="stylesheet" \/>/);
assert.match(transition, /data-vorta-page-content="true"/);
assert.match(transition, /className="min-h-full min-w-0 w-full max-w-full overflow-x-hidden"/);

assert.match(card, /data-vorta-card="true"/);
assert.match(card, /vorta-card rounded-2xl border bg-card text-card-foreground/);
assert.match(card, /p-4 sm:p-5 lg:p-6/);
assert.doesNotMatch(card, /text-card-foreground shadow/);

assert.match(surfaces, /--vorta-surface-page: #090c12/);
assert.match(surfaces, /--vorta-surface-card: #141922/);
assert.match(surfaces, /--vorta-surface-raised: #181f2a/);
assert.match(surfaces, /--vorta-surface-raised-border: rgba\(148, 163, 184, 0\.05\)/);
assert.match(surfaces, /--vorta-surface-divider: rgba\(148, 163, 184, 0\.09\)/);
assert.match(surfaces, /--vorta-surface-raised-shadow: inset 0 1px 0/);
assert.doesNotMatch(surfaces, /--vorta-surface-raised-shadow: 0 [1-9]/);
assert.match(surfaces, /\[data-vorta-portal-shell="true"\]/);
assert.match(surfaces, /\[data-vorta-page-content="true"\]/);
assert.match(surfaces, /\[data-vorta-card="true"\]/);
assert.match(surfaces, /Group-only frames organise child cards and grouped controls/);
assert.match(
  surfaces,
  /\[data-vorta-card="true"\]:has\(\[data-vorta-mobile-risk-scope="true"\]\)/,
);
assert.equal(
  (surfaces.match(/:has\(\[data-vorta-mobile-risk-scope="true"\]\)/g) ?? []).length,
  1,
  "The existing dashboard group hook must remain supported exactly once.",
);
assert.match(surfaces, /section\[class\*="rounded"\]\[class\*="border"\]/);
assert.match(surfaces, /button\[class\*="rounded"\]\[class\*="border"\]/);
assert.match(surfaces, /div\[class\*="rounded-xl"\]\[class\*="border"\]/);
assert.match(
  surfaces,
  /:is\(\[class\*="grid"\], \[class\*="flex"\]\) >[\s\S]*\) ~[\s\S]*\)/,
);
assert.match(surfaces, /:not\([\s\S]*bg-red[\s\S]*bg-indigo[\s\S]*\):has\(/);
assert.match(surfaces, /background-color: transparent !important/);
assert.match(surfaces, /box-shadow: none !important/);
assert.doesNotMatch(
  surfaces,
  /\[data-vorta-card="true"\]:has\(\s*\[class\*="grid"\]/,
  "Repeated group detection must not be restricted to the shared Card primitive.",
);

assert.match(equipmentSpares, /Spares Resilience Briefing/);
assert.match(equipmentSpares, /mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4/);
assert.ok(
  (equipmentSpares.match(/rounded-xl border border-gray-800 bg-\[#0c1118\]\/80 p-3/g) ?? []).length >= 4,
  "The Spares Resilience Briefing must retain its repeated filled child metric panels.",
);

assert.match(mobileEquipment, /data-vorta-mobile-equipment="true"/);
assert.match(mobileEquipment, /w-full rounded-xl border border-gray-800 bg-\[#141820\] p-4/);
assert.match(mobileEquipment, /mt-3 grid grid-cols-3 gap-2/);
assert.ok(
  (mobileEquipment.match(/rounded-lg border border-gray-800 bg-\[#0d1117\] p-2/g) ?? []).length >= 3,
  "Mobile Equipment records must retain their three filled KPI child panels.",
);

assert.match(shiftHandover, /data-vorta-shift-handover="true"/);
assert.match(shiftHandover, /rounded-2xl border border-gray-800 bg-\[#10151d\] p-4 sm:p-5/);
assert.match(shiftHandover, /aria-label="Handover scope level"/);
assert.match(shiftHandover, /min-h-11 shrink-0 rounded-lg border/);

assert.match(surfaces, /Nested metrics should read as grouped panels, not a second card hierarchy/);
assert.match(surfaces, /rounded-lg/);
assert.match(surfaces, /border-color: var\(--vorta-surface-raised-border\)/);
assert.match(surfaces, /Secondary evidence remains readable/);
assert.match(surfaces, /color: #94a3b8 !important/);
assert.match(surfaces, /Quiet structure should not compete/);
assert.match(surfaces, /risk colours[\s\S]*keep their operational meaning/);
assert.match(surfaces, /@media \(hover: hover\) and \(pointer: fine\)/);
assert.match(surfaces, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(surfaces, /focus-visible/);

assert.match(maintenanceExperience, /data-vorta-mobile-ai-safe-area="true"/);
assert.match(maintenanceExperience, /className="h-28 shrink-0"/);
assert.match(maintenanceExperience, /data-vorta-mobile-ai-launcher-label="true"/);
assert.match(maintenanceExperience, /h-12 w-12/);
assert.match(maintenanceExperience, /min-\[420px\]:w-auto/);
assert.match(maintenanceExperience, /hidden min-\[420px\]:inline/);

console.log("Shared Vorta page, card, legacy group-frame, contrast and launcher hierarchy passed.");
