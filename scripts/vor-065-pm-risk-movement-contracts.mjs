import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const movementSource = readFileSync(
  "netlify/functions/ask-vorta/site-risk-movement.mts",
  "utf8",
);
const suiteSource = readFileSync("scripts/run-contract-suite.mjs", "utf8");
const packageSource = readFileSync("package.json", "utf8");
const workflowSource = readFileSync(
  ".github/workflows/vor-049-validation.yml",
  "utf8",
);
const scenarios = JSON.parse(
  readFileSync("tests/evals/vor-065-pm-risk-movement.json", "utf8"),
);

for (const required of [
  "requestedDateRange(",
  'intentLabel: "site_risk_movement"',
  'requiredTools: ["get_site_risk_movement"]',
  '"what caused|what drove|what is behind|what\'s behind"',
  '.from("preventive_maintenance")',
  '.eq("site_id", request.siteId)',
  '.gte("next_due_date", previous.snapshotDate)',
  '.lt("next_due_date", current.snapshotDate)',
  '.from("equipment_assets")',
  '.in("id", equipmentIds)',
  'verificationState: "verified"',
  'verificationState: "count_mismatch"',
  'verificationState: "no_pm_increase"',
  'verificationState: "non_consecutive"',
  "matchedRecordCount !== snapshotOverduePmDelta",
  "recorded PM driver of the overdue-count movement",
  "does not prove every cause of the overall site-risk score change",
  "The PM record count does not reconcile to the snapshot overdue-PM delta",
]) {
  assert.ok(
    movementSource.includes(required),
    `VOR-065 PM movement contract is missing: ${required}`,
  );
}

assert.doesNotMatch(
  movementSource,
  /\.insert\(|\.update\(|\.delete\(|service_role|security definer/i,
  "VOR-065 must remain read-only and must not bypass authenticated RLS",
);
assert.doesNotMatch(
  movementSource,
  /OpenAI|responses\.create|VORTA_AI_MODEL|VORTA_AI_PLANNER_MODEL/,
  "VOR-065 PM reconciliation must remain model-independent",
);

assert.equal(
  scenarios.length,
  4,
  "VOR-065 requires four permanent authenticated natural-language scenarios",
);
for (const scenario of scenarios) {
  assert.deepEqual(
    scenario.expectedTools,
    ["get_site_risk_movement"],
    `${scenario.id} must stay on the one authorised site-risk movement tool`,
  );
  assert.equal(
    scenario.maxToolCount,
    1,
    `${scenario.id} must remain one-tool from the Ask Vorta orchestration layer`,
  );
  assert.equal(
    scenario.requireActionPlan,
    false,
    `${scenario.id} must not manufacture an operational write/action plan`,
  );
  assert.ok(
    Number(scenario.maxDurationMs) <= 5_000,
    `${scenario.id} must retain the deterministic latency ceiling`,
  );
}

const exact = scenarios.find(
  (scenario) => scenario.id === "vor065-exact-two-pm-reconciliation",
);
assert.ok(exact, "VOR-065 must retain the exact two-PM reconciliation fixture");
assert.ok(
  exact.mustMention.includes("PM-VF02-REJECT-30D") &&
    exact.mustMention.includes("PM-WFI-SEAL-Q"),
  "The exact reconciliation fixture must require both verified PM records",
);

const mismatch = scenarios.find(
  (scenario) => scenario.id === "vor065-pm-count-mismatch-fail-closed",
);
assert.ok(
  mismatch?.mustMention.includes("counts do not reconcile") &&
    mismatch?.mustNotMention.includes("verified PM driver"),
  "The mismatch fixture must fail closed instead of claiming causation",
);

const noIncrease = scenarios.find(
  (scenario) => scenario.id === "vor065-no-positive-pm-delta",
);
assert.ok(
  noIncrease?.mustMention.includes("no positive overdue-PM count movement"),
  "VOR-065 must retain a no-positive-PM-delta scenario",
);

const shift = scenarios.find(
  (scenario) => scenario.id === "vor065-previous-shift-boundary",
);
assert.ok(
  shift?.mustMention.includes("No verified shift-level site-risk snapshot"),
  "VOR-065 must preserve the previous-shift daily-evidence boundary",
);

for (const required of [
  '"eval:ask-vorta:vor065"',
  'tests/evals/vor-065-pm-risk-movement.json',
]) {
  assert.ok(
    packageSource.includes(required),
    `package.json must expose VOR-065 authenticated evaluation: ${required}`,
  );
}
assert.ok(
  suiteSource.includes("VOR-065 verified PM risk movement"),
  "The permanent contract suite must register VOR-065",
);
for (const required of [
  '"scripts/vor-065*"',
  '"tests/evals/vor-065-pm-risk-movement.json"',
  "Run permanent VOR-065 contracts",
  "Run four authenticated VOR-065 PM risk movement decisions",
  "npm run eval:ask-vorta:vor065",
  "vor-065-live-eval.log",
]) {
  assert.ok(
    workflowSource.includes(required),
    `The exact-source Ask Vorta workflow must retain VOR-065 coverage: ${required}`,
  );
}

console.log(
  "VOR-065 contracts passed: PM due-date crossings are site-scoped, record-level, count-reconciled, deterministic and fail closed when the evidence disagrees.",
);
