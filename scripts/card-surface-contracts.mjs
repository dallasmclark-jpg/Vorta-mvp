import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const index = read("index.html");
const surfaces = read("src/card-surfaces.css");
const tabs = read("src/tab-states.css");
const transition = read("src/components/PageTransition.tsx");
const card = read("src/components/ui/card.tsx");
const equipmentSpares = read("src/screens/Equipment/EquipmentSpares.tsx");
const mobileEquipment = read("src/screens/Equipment/MobileEquipmentSection.tsx");
const shiftHandover = read("src/screens/ShiftHandover/ShiftHandoverSection.tsx");
const login = read("src/screens/Login/LoginPage.tsx");
const dashboard = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx",
);
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

assert.match(surfaces, /--vorta-surface-page: #000c1c/);
assert.match(surfaces, /--vorta-surface-page-image: linear-gradient/);
assert.match(surfaces, /rgba\(0, 20, 44, 0\.42\) 0%/);
assert.match(surfaces, /rgba\(0, 14, 32, 0\.26\) 42%/);
assert.match(surfaces, /rgba\(0, 12, 28, 0\) 100%/);
assert.match(surfaces, /background-size: 100% 100dvh !important/);
assert.match(surfaces, /html\.dark #app > \.flex\.min-h-screen\.flex-col/);
assert.match(surfaces, /--vorta-surface-card: #252a30/);
assert.match(surfaces, /--vorta-surface-raised: #2d333a/);
assert.match(surfaces, /--vorta-surface-raised-border: rgba\(148, 163, 184, 0\.05\)/);
assert.match(surfaces, /--vorta-surface-divider: rgba\(148, 163, 184, 0\.09\)/);
assert.match(surfaces, /--vorta-surface-raised-shadow: inset 0 1px 0/);
assert.doesNotMatch(surfaces, /--vorta-surface-raised-shadow: 0 [1-9]/);
assert.match(surfaces, /\[data-vorta-portal-shell\]/);
assert.match(surfaces, /\[data-vorta-page-content\]/);
assert.match(surfaces, /\[data-vorta-sidebar\]/);
assert.match(surfaces, /\[data-vorta-card="true"\]/);
assert.match(login, /style=\{\{ backgroundColor: "#0b0e14" \}\}/);
assert.doesNotMatch(login, /#07131f/);
assert.match(surfaces, /Group-only frames are declared by component intent/);
assert.match(surfaces, /\[data-vorta-group-frame="true"\]/);
assert.match(surfaces, /background-color: transparent !important/);
assert.match(surfaces, /box-shadow: none !important/);
assert.doesNotMatch(
  surfaces,
  /:has\(/,
  "Card hierarchy must not depend on DOM shape, utility classes or accessible copy.",
);
assert.doesNotMatch(surfaces, /aria-label="Handover scope level"/);
assert.doesNotMatch(surfaces, /grid-cols-3/);

assert.match(dashboard, /data-vorta-group-frame="true"/);
assert.match(dashboard, /data-vorta-embedded-ai="true"/);
assert.match(equipmentSpares, /data-vorta-group-frame="true"/);
assert.match(equipmentSpares, /Spares Resilience Briefing/);
assert.match(mobileEquipment, /data-vorta-mobile-equipment="true"/);
assert.match(mobileEquipment, /data-vorta-group-frame="true"/);
assert.match(mobileEquipment, /min-h-14 rounded-lg border border-gray-800 bg-\[#0d1117\]/);
assert.match(shiftHandover, /data-vorta-shift-handover="true"/);
assert.match(shiftHandover, /data-vorta-group-frame="true"/);
assert.match(
  shiftHandover,
  /min-h-11 shrink-0(?: whitespace-nowrap)? rounded-lg border/,
);

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

assert.match(index, /span\.inline-flex\[class\*="-500\/20"\]\{background-color:transparent!important\}/);

/* VOR-095/VOR-097 canonical dark dashboard palette and approved visual treatment. */
assert.match(tabs, /VOR-095 \/ VOR-097/);
assert.match(tabs, /--vorta-surface-page: #000814/);
assert.match(tabs, /--vorta-surface-card: #030c1d/);
assert.match(tabs, /--vorta-surface-raised: #07172b/);
assert.match(tabs, /rgba\(0, 14, 32, 0\.28\) 0%/);
assert.match(tabs, /rgba\(0, 10, 24, 0\.16\) 42%/);
assert.match(tabs, /rgba\(0, 8, 20, 0\) 100%/);
assert.match(tabs, /--vorta-surface-border: rgba\(148, 163, 184, 0\.19\)/);
assert.match(tabs, /--vorta-surface-raised-border: rgba\(148, 163, 184, 0\.10\)/);
assert.match(tabs, /--vorta-surface-shadow: 0 16px 38px rgba\(0, 0, 0, 0\.36\)/);
assert.match(tabs, /--vorta-surface-raised-shadow: 0 8px 20px rgba\(0, 0, 0, 0\.20\)/);
assert.match(
  tabs,
  /\[aria-label="Risk intelligence scope"\] \[role="tab"\] \{[\s\S]*border-radius: 9999px !important;[\s\S]*background: transparent !important/,
);
assert.match(
  tabs,
  /\[aria-label="Risk intelligence scope"\] \[role="tab"\]\[aria-selected="true"\] \{[\s\S]*border: 1px solid #60a5fa !important;[\s\S]*background: transparent !important;[\s\S]*color: #f8fafc !important/,
);
assert.match(
  tabs,
  /\[data-vorta-nav-item="true"\]\[aria-label="Dashboard"\]\.text-blue-400[\s\S]*background: transparent !important;[\s\S]*color: #60a5fa !important/,
);
assert.match(
  tabs,
  /span\.inline-flex\[class\*="-500\/20"\][\s\S]*border: 1px solid currentColor !important/,
);
assert.match(
  tabs,
  /Approved mock-up card depth[\s\S]*border-color: rgba\(96, 165, 250, 0\.13\) !important;[\s\S]*background-color: #030c1d !important;[\s\S]*linear-gradient\(180deg, rgba\(8, 28, 52, 0\.38\)/,
);
assert.doesNotMatch(tabs, /background-image: linear-gradient\(180deg, rgba\(148, 163, 184/);
assert.match(
  tabs,
  /\[data-vorta-embedded-ai="true"\] > \[data-vorta-card="true"\][\s\S]*border: 0 !important;[\s\S]*background: transparent !important;[\s\S]*box-shadow: none !important/,
);
assert.match(
  tabs,
  /\[data-vorta-embedded-ai="true"\][\s\S]*\[class~="bg-\[#0f1218\]"\][\s\S]*border-color: rgba\(96, 165, 250, 0\.24\) !important;[\s\S]*background-color: rgba\(3, 12, 29, 0\.72\) !important;[\s\S]*border-radius: 9999px !important/,
);
assert.match(read("src/components/ai/VortaAiCommandBar.tsx"), /data-vorta-embedded-ask=\{embedded \? "true" : undefined\}[\s\S]*borderRadius: "9999px"[\s\S]*backgroundColor: "#1746b3"/);

/* VOR-095 03/09/2026 focused refinements. */
assert.match(
  tabs,
  /VOR-095 refinement 03\/09\/2026[\s\S]*div:has\(> input\)[\s\S]*input \{[\s\S]*background-color: transparent !important;[\s\S]*background-image: none !important;[\s\S]*box-shadow: none !important/,
);
assert.match(
  tabs,
  /\[data-vorta-group-frame="true"\] \{[\s\S]*border-color: transparent !important;[\s\S]*background-color: transparent !important;[\s\S]*background-image: none !important;[\s\S]*box-shadow: none !important/,
);
assert.match(
  tabs,
  /\[data-vorta-group-frame="true"\] \[class~="border-red-500\/30"\]\[class~="bg-\[#0d1117\]"\][\s\S]*border-color: rgba\(96, 165, 250, 0\.13\) !important;[\s\S]*background-color: #030c1d !important/,
);
assert.match(
  tabs,
  /\[aria-label\^="View equipment in "\] p\[class\*="min-h-9"\][\s\S]*display: none !important/,
);
assert.match(
  dashboard,
  /<dt className="text-sm text-slate-400">Calibration backlog<\/dt>[\s\S]*\{area\.calibrationOverdueCount\}/,
);

assert.match(maintenanceExperience, /data-vorta-mobile-ai-safe-area="true"/);
assert.match(maintenanceExperience, /className="h-28 shrink-0"/);
assert.match(maintenanceExperience, /data-vorta-mobile-ai-launcher-label="true"/);
assert.match(maintenanceExperience, /h-12 w-12/);
assert.match(maintenanceExperience, /min-\[420px\]:w-auto/);
assert.match(maintenanceExperience, /hidden min-\[420px\]:inline/);

console.log("Shared Vorta page, canonical VOR-095/VOR-097 dashboard palette, transparent Ask Vorta input, transparent briefing group, matched briefing surfaces, single calibration metric, approved upper-card depth, selected scope/navigation, semantic group-frame, contrast and launcher hierarchy passed.");
