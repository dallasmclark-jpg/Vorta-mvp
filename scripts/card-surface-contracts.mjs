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
assert.match(tabs, /--vorta-color-canvas: #000814/);
assert.match(tabs, /--vorta-color-sidebar: #000814/);
assert.match(tabs, /--vorta-color-surface: #252a30/);
assert.match(tabs, /--vorta-color-surface-raised: #2d333a/);
assert.match(tabs, /--vorta-color-border-base: #94a3b8/);
assert.match(tabs, /--vorta-color-text-primary: #f8fafc/);
assert.match(tabs, /--vorta-color-text-secondary: #cbd5e1/);
assert.match(tabs, /--vorta-color-text-muted: #94a3b8/);
assert.match(tabs, /--vorta-color-intelligence: #60a5fa/);
assert.match(tabs, /--vorta-color-action: #2563eb/);
assert.match(tabs, /--vorta-color-risk-critical: #ef4444/);
assert.match(tabs, /--vorta-color-risk-high: #f97316/);
assert.match(tabs, /--vorta-color-risk-medium: #facc15/);
assert.match(tabs, /--vorta-color-verified: #10b981/);
assert.match(tabs, /--vorta-border-quiet: color-mix\(in srgb, var\(--vorta-color-border-base\) 10%, transparent\)/);
assert.match(tabs, /--vorta-border-strong: color-mix\(in srgb, var\(--vorta-color-border-base\) 19%, transparent\)/);
assert.match(tabs, /--vorta-surface-page: var\(--vorta-color-canvas\)/);
assert.match(tabs, /--vorta-surface-card: var\(--vorta-color-surface\)/);
assert.match(tabs, /--vorta-surface-raised: var\(--vorta-color-surface-raised\)/);
assert.match(tabs, /rgba\(0, 14, 32, 0\.28\) 0%/);
assert.match(tabs, /rgba\(0, 10, 24, 0\.16\) 42%/);
assert.match(tabs, /rgba\(0, 8, 20, 0\) 100%/);
assert.match(tabs, /--vorta-surface-border: var\(--vorta-border-strong\)/);
assert.match(tabs, /--vorta-surface-raised-border: var\(--vorta-border-quiet\)/);
assert.match(tabs, /--vorta-surface-shadow: 0 16px 38px rgba\(0, 0, 0, 0\.36\)/);
assert.match(tabs, /--vorta-surface-raised-shadow: 0 8px 20px rgba\(0, 0, 0, 0\.20\)/);
assert.match(
  tabs,
  /\[aria-label="Risk intelligence scope"\][\s\S]*\[role="tab"\] \{[\s\S]*border-radius: 9999px !important;[\s\S]*background: transparent !important/,
);
assert.match(
  tabs,
  /\[aria-label="Risk intelligence scope"\][\s\S]*\[role="tab"\]\[aria-selected="true"\][\s\S]*border: 1px solid var\(--vorta-color-intelligence\) !important;[\s\S]*background: transparent !important/,
);
assert.match(
  tabs,
  /\[data-vorta-nav-item="true"\]\[aria-label="Dashboard"\]\.text-blue-400[\s\S]*background: transparent !important;[\s\S]*color: var\(--vorta-color-intelligence\) !important/,
);
assert.match(
  tabs,
  /span\.inline-flex\[class\*="-500\/20"\][\s\S]*border: 1px solid currentColor !important/,
);
assert.match(
  tabs,
  /signature card depth[\s\S]*color-mix\(in srgb, var\(--vorta-color-border-base\) 30%, transparent\)[\s\S]*transparent 68%/,
);
assert.match(
  tabs,
  /Site Risk Briefing technical icons[\s\S]*color: var\(--vorta-color-intelligence\) !important;[\s\S]*stroke-width: 1\.5 !important/,
);
assert.match(
  tabs,
  /\[data-vorta-embedded-ai="true"\][\s\S]*\[class~="bg-\[#0f1218\]"\][\s\S]*border-color: color-mix\(in srgb, var\(--vorta-color-intelligence\) 38%, transparent\) !important;[\s\S]*background-color: transparent !important;[\s\S]*border-radius: 9999px !important/,
);

assert.match(maintenanceExperience, /data-vorta-mobile-ai-safe-area="true"/);
assert.match(maintenanceExperience, /className="h-28 shrink-0"/);
assert.match(maintenanceExperience, /data-vorta-mobile-ai-launcher-label="true"/);
assert.match(maintenanceExperience, /h-12 w-12/);
assert.match(maintenanceExperience, /min-\[420px\]:w-auto/);
assert.match(maintenanceExperience, /hidden min-\[420px\]:inline/);

console.log("Shared Vorta page, canonical VOR-095/VOR-097 dashboard palette, transparent Ask Vorta input, approved upper-edge card depth, selected scope/navigation, semantic group-frame, contrast and launcher hierarchy passed.");
