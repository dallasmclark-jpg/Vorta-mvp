import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const index = read("index.html");
const surfaces = read("src/card-surfaces.css");
const transition = read("src/components/PageTransition.tsx");
const card = read("src/components/ui/card.tsx");

assert.match(index, /<link href="\/src\/card-surfaces\.css" rel="stylesheet" \/>/);
assert.match(transition, /data-vorta-page-content="true"/);
assert.match(transition, /className="min-h-full min-w-0 w-full max-w-full overflow-x-hidden"/);

assert.match(card, /data-vorta-card="true"/);
assert.match(card, /vorta-card rounded-2xl border bg-card text-card-foreground/);
assert.match(card, /p-4 sm:p-5 lg:p-6/);
assert.doesNotMatch(card, /text-card-foreground shadow/);

assert.match(surfaces, /--vorta-surface-page: #090c12/);
assert.match(surfaces, /--vorta-surface-card: #141922/);
assert.match(surfaces, /--vorta-surface-raised: #1a202b/);
assert.match(surfaces, /\[data-vorta-portal-shell="true"\]/);
assert.match(surfaces, /\[data-vorta-page-content="true"\]/);
assert.match(surfaces, /\[data-vorta-card="true"\]/);
assert.match(surfaces, /Nested metrics should read as raised controls/);
assert.match(surfaces, /risk colours[\s\S]*keep their operational meaning/);
assert.match(surfaces, /@media \(hover: hover\) and \(pointer: fine\)/);
assert.match(surfaces, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(surfaces, /focus-visible/);
assert.doesNotMatch(surfaces, /\[class\*="bg-(?:red|orange|amber|emerald|green|blue)/);

console.log("Shared Vorta page, card and raised-surface hierarchy passed.");
