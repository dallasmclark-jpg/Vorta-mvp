import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync(
  "netlify/functions/ask-vorta/route-planning.mts",
  "utf8",
);
const runtimeSource = readFileSync(
  "netlify/functions/ask-vorta/runtime.mts",
  "utf8",
);
const answerSource = readFileSync(
  "netlify/functions/ask-vorta/decision-answer.mts",
  "utf8",
);
const suiteSource = readFileSync("scripts/run-contract-suite.mjs", "utf8");
const packageSource = readFileSync("package.json", "utf8");
const scenarios = JSON.parse(
  readFileSync(
    "tests/evals/vor-058-site-priority-performance.json",
    "utf8",
  ),
);

const siteMatcherIndex = routeSource.indexOf("const sitePriorityQuestion");
const historyFallbackIndex = routeSource.indexOf(
  "if (hasConversationHistory) return null;",
);
assert.ok(siteMatcherIndex >= 0, "The natural site-priority matcher must exist");
assert.ok(
  siteMatcherIndex < historyFallbackIndex,
  "Site-priority follow-ups must be handled before semantic-history fallback",
);
for (const phrase of [
  "most\\s+)?likely to",
  "where should",
  "what needs",
  "get_site_operational_snapshot",
]) {
  assert.ok(
    routeSource.includes(phrase),
    `Site-priority routing must retain ${phrase}`,
  );
}
assert.ok(
  routeSource.includes('"site_threat_prioritization"'),
  "The site-priority route must use the canonical intent",
);

for (const required of [
  'plannedIntent === "site_priorities"',
  'plannedIntent === "site_threat_prioritization"',
  'requiredTools: ["get_site_operational_snapshot"]',
  'optionalTools: []',
  'routingMode: "deterministic"',
]) {
  assert.ok(
    runtimeSource.includes(required),
    `Semantic site-priority normalisation must retain ${required}`,
  );
}
assert.ok(
  !runtimeSource.includes(
    'requiredTools: ["get_site_operational_snapshot", "get_equipment_risk"]',
  ),
  "Site-priority normalisation must not add equipment specialist lookups",
);

for (const required of [
  'intent === "site_priorities"',
  'intent === "site_threat_prioritization"',
  'const rankedActions = records(rankedData)',
  'actionPlan: topAction',
  "calculated reduction",
  "Unavailable operational domains",
]) {
  assert.ok(
    answerSource.includes(required),
    `Deterministic site-priority answers must retain ${required}`,
  );
}
assert.ok(
  answerSource.includes("Maintenance Manager / Planner"),
  "The deterministic answer must retain an accountable operational owner",
);
assert.ok(
  answerSource.includes("authorised SAP user"),
  "The deterministic answer must preserve the SAP read-only boundary",
);

assert.equal(scenarios.length, 6, "VOR-058 requires six natural variants");
for (const scenario of scenarios) {
  assert.deepEqual(
    scenario.expectedTools,
    ["get_site_operational_snapshot"],
    `${scenario.id} must use one authorised site snapshot`,
  );
  assert.equal(
    scenario.maxToolCount,
    1,
    `${scenario.id} must suppress redundant specialist calls`,
  );
  assert.ok(
    scenario.maxDurationMs <= 18_000,
    `${scenario.id} must retain the production p95 ceiling`,
  );
  assert.notEqual(
    scenario.requireActionPlan,
    false,
    `${scenario.id} must remain decision-ready`,
  );
}

assert.ok(
  suiteSource.includes("VOR-058 site-priority performance"),
  "The permanent contract suite must register VOR-058",
);
assert.ok(
  packageSource.includes('"eval:ask-vorta:vor058"'),
  "package.json must expose the authenticated VOR-058 evaluation",
);

console.log(
  "VOR-058 contracts passed: deterministic site-priority routing, one-snapshot tool suppression, decision-ready ranked answers, latency limits and SAP read-only wording are protected.",
);
