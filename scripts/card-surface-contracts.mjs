import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const index = read("index.html");
const surfaces = read("src/card-surfaces.css");
const tabStates = read("src/tab-states.css");
const transition = read("src/components/PageTransition.tsx");
const card = read("src/components/ui/card.tsx");
const equipmentSpares = read("src/screens/Equipment/EquipmentSpares.tsx");
const mobileEquipment = read("src/screens/Equipment/MobileEquipmentSection.tsx");
const shiftHandover = read("src/screens/ShiftHandover/ShiftHandoverSection.tsx");
const dashboard = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx",
);
const maintenanceExperience = read(
  "src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx",
);

assert.match(index, /<link href="\/src\/card-surfaces\.css" rel="stylesheet" \/>/);
assert.match(index, /<link href="\/src\/tab-states\.css" rel="stylesheet" \/>/);
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
assert.match(surfaces, /Group-only frames are declared by component intent/);
assert.match(surfaces, /\[data-vorta-group-frame="true"\]/);
assert.match(surfaces, /background-color: transparent !important/);
assert.match(surfaces, /box-shadow: none !important/);
assert.doesNotMatch(surfaces, /:has\(/, "Card hierarchy must not depend on DOM shape, utility classes or accessible copy.");
assert.doesNotMatch(surfaces, /aria-label="Handover scope level"/);
assert.doesNotMatch(surfaces, /grid-cols-3/);
assert.match(dashboard, /data-vorta-group-frame="true"/);
assert.match(equipmentSpares, /data-vorta-group-frame="true"/);
assert.match(equipmentSpares, /Spares Resilience Briefing/);
assert.match(mobileEquipment, /data-vorta-mobile-equipment="true"/);
assert.match(mobileEquipment, /data-vorta-group-frame="true"/);
assert.match(mobileEquipment, /min-h-14 rounded-lg border border-gray-800 bg-\[#0d1117\]/);
assert.match(shiftHandover, /data-vorta-shift-handover="true"/);
assert.match(shiftHandover, /data-vorta-group-frame="true"/);
assert.match(shiftHandover, /min-h-11 shrink-0(?: whitespace-nowrap)? rounded-lg border/);
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

assert.match(surfaces, /VOR-088 selector geometry/);
assert.match(surfaces, /Skills Matrix severity cards remain distinct/);
assert.match(tabStates, /VOR-088 adds one premium selector geometry/);
assert.match(tabStates, /\[role="tablist"\]:not\(\[aria-label="KPI period"\]\)/);
assert.match(tabStates, /\[data-vorta-mobile-settings="true"\] button\[aria-pressed\]/);
assert.match(tabStates, /border-radius: 16px !important/);
assert.match(tabStates, /box-shadow: var\(--vorta-surface-shadow\) !important/);
assert.match(tabStates, /outline: 1px solid rgba\(37, 99, 235, 0\.36\)/);
assert.match(tabStates, /outline-color: rgba\(96, 165, 250, 0\.55\)/);
assert.match(tabStates, /min-height: 44px/);
assert.match(tabStates, /transform: translateY\(-1px\)/);
assert.doesNotMatch(tabStates, /:focus-visible/, "Existing component-owned keyboard focus must remain authoritative.");

assert.match(maintenanceExperience, /data-vorta-mobile-ai-safe-area="true"/);
assert.match(maintenanceExperience, /className="h-28 shrink-0"/);
assert.match(maintenanceExperience, /data-vorta-mobile-ai-launcher-label="true"/);
assert.match(maintenanceExperience, /h-12 w-12/);
assert.match(maintenanceExperience, /min-\[420px\]:w-auto/);
assert.match(maintenanceExperience, /hidden min-\[420px\]:inline/);
console.log("Shared Vorta page, premium selector system, semantic group-frame, contrast and launcher hierarchy passed.");
