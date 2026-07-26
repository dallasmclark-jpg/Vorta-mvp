import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const typography = read("src/screens/AiOperations/MobileTypographyStyles.tsx");
const experience = read("src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx");
const browser = read("tests/browser/maintenance-manager-mobile-routes.spec.ts");

assert.match(typography, /@media \(max-width: 767px\)/);
assert.doesNotMatch(typography, /min-width:\s*768px/);
assert.match(typography, /data-vorta-maintenance-portal/);
assert.match(typography, /data-vorta-portal-shell/);
assert.match(typography, /\.text-\\\[10px\\\][\s\S]*?font-size: 0\.75rem !important/);
assert.match(typography, /\.text-xs[\s\S]*?font-size: 0\.875rem !important/);
assert.match(typography, /\.text-sm[\s\S]*?font-size: 1rem !important/);
assert.match(typography, /\.text-base[\s\S]*?font-size: 1\.0625rem !important/);
assert.match(typography, /\.text-xl[\s\S]*?font-size: 1\.5rem !important/);
assert.match(typography, /input:not\(\[type="file"\]\), textarea, select/);
assert.match(typography, /font-size: 1\.0625rem !important/);
assert.match(typography, /What can I help with/);
assert.match(typography, /font-size: 1\.875rem !important/);
assert.match(typography, /font-size: 1\.125rem !important/);
assert.match(typography, /data-vorta-dashboard-root/);
assert.match(typography, /data-vorta-shared-mobile-ai-launcher/);

assert.match(experience, /import \{ MobileTypographyStyles \} from "\.\/MobileTypographyStyles"/);
assert.match(experience, /<MobileAiPolishStyles \/>[\s\S]*?<MobileTypographyStyles \/>/);

assert.match(browser, /Capability Summary/);
assert.match(browser, /fontSizePixels/);
assert.match(browser, /pseudoFontSizePixels/);
assert.match(browser, /Mobile typography/);
assert.match(browser, /toBeGreaterThanOrEqual\(24\)/);
assert.match(browser, /toBeGreaterThanOrEqual\(17\)/);

console.log("Phone-only body, control, heading and Ask Vorta typography scale passed.");
