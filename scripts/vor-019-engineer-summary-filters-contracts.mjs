import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const mobileEngineers = read("src/screens/Engineers/MobileEngineersSection.tsx");
const tabStates = read("src/tab-states.css");
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

assert.match(
  tabStates,
  /\[data-vorta-engineer-summary-filter\]\[aria-selected="true"\]/,
  "Engineer summary cards must use the shared portal selected-card rule.",
);
assert.match(tabStates, /border: 1px solid #2563eb !important;/);
assert.match(tabStates, /border-color: #60a5fa !important;/);
assert.match(tabStates, /background: #fff !important;/);
assert.match(
  tabStates,
  /Selected controls now use the same quiet intelligence-blue outline[\s\S]*background: transparent !important;/,
  "Dark selected engineer filters must use the approved transparent Dashboard-style state.",
);
assert.match(tabStates, /box-shadow: none !important;/);
assert.doesNotMatch(
  tabStates,
  /background:\s*#(?:1d4ed8|2563eb|3b82f6)/i,
  "Selected engineer cards must not use an opaque blue fill.",
);

assert.match(browserCoverage, /data-vorta-engineer-summary-tabs/);
assert.match(browserCoverage, /summaryLabels/);
assert.match(browserCoverage, /data-vorta-engineer-summary-count/);
assert.match(browserCoverage, /data-vorta-engineer-priority-count/);
assert.match(browserCoverage, /toHaveAttribute\("aria-selected", "true"\)/);
assert.match(browserCoverage, /getComputedStyle/);
assert.match(browserCoverage, /rgb\(96, 165, 250\)/);
assert.match(browserCoverage, /rgb\(37, 99, 235\)/);
assert.match(browserCoverage, /rgba\(0, 0, 0, 0\)/);
assert.match(browserCoverage, /boxShadow/);
assert.match(browserCoverage, /toHaveCount\(initialRegisterCount\)/);
assert.match(browserCoverage, /\[360, 390, 430\]/);
assert.match(browserCoverage, /page\.reload\(\)/);

console.log(
  "VOR-019/VOR-097 mobile engineer summary filters, transparent selected-card styling, priority panel and register preservation contracts passed.",
);
