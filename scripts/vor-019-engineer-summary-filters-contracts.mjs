import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const mobileEngineers = read("src/screens/Engineers/MobileEngineersSection.tsx");
const browserCoverage = read(
  "tests/browser/maintenance-manager-engineer-summary-filters.spec.ts",
);

assert.match(mobileEngineers, /type EngineerSummaryFilter/);
assert.match(mobileEngineers, /"on-shift"/);
assert.match(mobileEngineers, /"available"/);
assert.match(mobileEngineers, /"critical-sme"/);
assert.match(mobileEngineers, /"at-risk"/);
assert.match(mobileEngineers, /role="tablist"/);
assert.match(mobileEngineers, /role="tab"/);
assert.match(mobileEngineers, /aria-selected=\{selected\}/);
assert.match(mobileEngineers, /data-vorta-engineer-summary-filter/);
assert.match(mobileEngineers, /data-vorta-engineer-summary-count/);
assert.match(mobileEngineers, /data-vorta-engineer-priority-panel/);
assert.match(mobileEngineers, /data-vorta-engineer-priority-count/);
assert.match(mobileEngineers, /data-vorta-engineer-register/);
assert.match(mobileEngineers, /current === definition\.key \? null : definition\.key/);
assert.match(mobileEngineers, /All engineers/);
assert.match(mobileEngineers, /No matching engineers/);
assert.match(mobileEngineers, /availability_status\.toLowerCase\(\) === "on_shift"/);
assert.match(mobileEngineers, /availability_status\.toLowerCase\(\) === "available"/);
assert.match(mobileEngineers, /critical_knowledge_holder === true/);
assert.match(
  mobileEngineers,
  /\["critical", "high"\]\.includes\(engineer\.risk_level\.toLowerCase\(\)\)/,
);
assert.doesNotMatch(
  mobileEngineers,
  /label="At-risk shifts"/,
  "The Engineers summary must report at-risk engineers, not weekly rota shifts.",
);

assert.match(browserCoverage, /Engineer priority filters/);
assert.match(browserCoverage, /data-vorta-engineer-summary-count/);
assert.match(browserCoverage, /data-vorta-engineer-priority-count/);
assert.match(browserCoverage, /toHaveAttribute\("aria-selected", "true"\)/);
assert.match(browserCoverage, /toHaveCount\(initialRegisterCount\)/);
assert.match(browserCoverage, /\[360, 390, 430\]/);
assert.match(browserCoverage, /page\.reload\(\)/);

console.log(
  "VOR-019 mobile engineer summary filters, priority panel and register preservation contracts passed.",
);
