import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const index = read("index.html");
const surfaces = read("src/card-surfaces.css");
const transition = read("src/components/PageTransition.tsx");
const card = read("src/components/ui/card.tsx");
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
assert.match(surfaces, /Group-only frames organise child cards without competing with them/);
assert.match(
  surfaces,
  /\[data-vorta-card="true"\]:has\(\[data-vorta-mobile-risk-scope="true"\]\)/,
);
assert.match(surfaces, /background-color: transparent !important/);
assert.match(surfaces, /box-shadow: none !important/);
assert.equal(
  (surfaces.match(/:has\(\[data-vorta-mobile-risk-scope="true"\]\)/g) ?? []).length,
  1,
  "Only the explicit risk-briefing group may become transparent.",
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
assert.doesNotMatch(surfaces, /\[class\*="bg-(?:red|orange|amber|emerald|green|blue)/);

assert.match(maintenanceExperience, /data-vorta-mobile-ai-safe-area="true"/);
assert.match(maintenanceExperience, /className="h-28 shrink-0"/);
assert.match(maintenanceExperience, /data-vorta-mobile-ai-launcher-label="true"/);
assert.match(maintenanceExperience, /h-12 w-12/);
assert.match(maintenanceExperience, /min-\[420px\]:w-auto/);
assert.match(maintenanceExperience, /hidden min-\[420px\]:inline/);

console.log("Shared Vorta page, card, group-frame, contrast and launcher hierarchy passed.");
