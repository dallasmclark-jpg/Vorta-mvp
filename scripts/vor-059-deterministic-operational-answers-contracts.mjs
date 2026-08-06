import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const answerSource = readFileSync(
  "netlify/functions/ask-vorta/decision-answer.mts",
  "utf8",
);
const workflowSource = readFileSync(
  ".github/workflows/vor-049-validation.yml",
  "utf8",
);
const packageSource = readFileSync("package.json", "utf8");
const suiteSource = readFileSync("scripts/run-contract-suite.mjs", "utf8");
const scenarios = JSON.parse(
  readFileSync(
    "tests/evals/vor-059-deterministic-operational-answers.json",
    "utf8",
  ),
);
const audit = JSON.parse(
  readFileSync(
    "tests/evals/vor-059-operational-model-independence-audit.json",
    "utf8",
  ),
);

for (const intent of ["shift_handover", "spares_priority", "contractor_support"]) {
  assert.ok(
    answerSource.includes(`intent === "${intent}"`),
    `Missing deterministic answer builder for ${intent}`,
  );
}
for (const tool of [
  "get_shift_handover",
  "get_site_spares_risk",
  "get_contractor_availability",
]) {
  assert.ok(
    answerSource.includes(`outcomes.get("${tool}")`) &&
      answerSource.includes(`outcomeData(outcomes, "${tool}")`),
    `The deterministic builder must consume authorised ${tool} evidence`,
  );
}
for (const required of [
  "Maintenance Manager / Incoming Shift",
  "Maintenance Manager / Stores / Buyer",
  "Maintenance Manager / Planner",
  "Ask Vorta does not place orders or alter stock",
  "Ask Vorta does not assign or book contractors",
  "without creating a parallel work queue",
  "confidence: top ? (missingData.length ? 72 : 86) : 45",
  "confidence: top ? (missingData.length ? 68 : 86) : 45",
]) {
  assert.ok(
    answerSource.includes(required),
    `VOR-059 must retain ${required}`,
  );
}
assert.doesNotMatch(
  answerSource,
  /purchase order placed|ordered successfully|contractor assigned|booking confirmed|attendance booked/,
  "Deterministic operational answers must not claim an operational write",
);

assert.equal(scenarios.length, 6, "VOR-059 requires six permanent exact-source decisions");
assert.equal(audit.length, 12, "VOR-059 must retain the full 12-question audit");
for (const scenario of [...scenarios, ...audit]) {
  assert.equal(
    scenario.expectedTools.length,
    1,
    `${scenario.id} must use exactly one authorised evidence tool`,
  );
  assert.equal(
    scenario.maxToolCount,
    1,
    `${scenario.id} must prohibit redundant tool rounds`,
  );
  assert.ok(
    Number(scenario.confidenceMin) >= 65,
    `${scenario.id} must reject unexplained low confidence`,
  );
  assert.ok(
    Number(scenario.maxDurationMs) <= 18_000,
    `${scenario.id} must retain the production p95 ceiling`,
  );
}

for (const required of [
  '"scripts/vor-059*"',
  '"tests/evals/vor-059-deterministic-operational-answers.json"',
  "Run permanent VOR-059 contracts",
  "Run six authenticated VOR-059 operational decisions",
  "npm run eval:ask-vorta:vor059",
  "vor-059-live-eval.log",
]) {
  assert.ok(
    workflowSource.includes(required),
    `The central exact-source gate must retain ${required}`,
  );
}
assert.ok(
  packageSource.includes('"eval:ask-vorta:vor059"') &&
    packageSource.includes('"eval:ask-vorta:vor059:audit"'),
  "package.json must expose permanent and full VOR-059 audits",
);
assert.ok(
  suiteSource.includes("VOR-059 deterministic operational answers"),
  "The permanent contract suite must register VOR-059",
);

console.log(
  "VOR-059 contracts passed: handover, spares and contractor decisions are model-independent, confidence-bounded, one-tool and read-only.",
);
