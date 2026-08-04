import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const vor048Workflow = readFileSync(
  ".github/workflows/vor-048-validation.yml",
  "utf8",
);
const liveWorkflow = readFileSync(
  ".github/workflows/vor-049-validation.yml",
  "utf8",
);
const liveEvaluator = readFileSync(
  "scripts/ask-vorta-live-evals.mjs",
  "utf8",
);
const shiftCoverScenarios = JSON.parse(
  readFileSync("tests/evals/vor-048-shift-cover-routing.json", "utf8"),
);
const equipmentScenarios = JSON.parse(
  readFileSync("tests/evals/vor-033-demo-golden.json", "utf8"),
);

assert.ok(
  vor048Workflow.includes("group: vor-048-${{ github.sha }}"),
  "VOR-048 static and browser validation must not compete in the authenticated live-evaluation queue",
);
assert.ok(
  !vor048Workflow.includes("npm run eval:ask-vorta:vor048"),
  "VOR-048 must not independently consume the shared authenticated evaluation account",
);
assert.ok(
  liveWorkflow.includes(
    "group: ask-vorta-live-${{ github.event.pull_request.number || github.run_id }}",
  ),
  "One PR-scoped workflow must own authenticated Ask Vorta evaluation traffic",
);
assert.ok(
  liveWorkflow.includes("timeout-minutes: 75"),
  "The exhaustive live gate must have enough wall-clock allowance for deliberate rate-window resets",
);
assert.ok(
  liveWorkflow.includes('      - "scripts/vor-048*"') &&
    liveWorkflow.includes('      - "tests/evals/vor-048-shift-cover-routing.json"') &&
    liveWorkflow.includes('      - ".github/workflows/vor-048-validation.yml"'),
  "VOR-048 routing or workflow changes must trigger the central authenticated live gate",
);

const shiftCoverIndex = liveWorkflow.indexOf(
  "npm run eval:ask-vorta:vor048",
);
const resetIndex = liveWorkflow.indexOf(
  "Reset rate window before exhaustive equipment audit",
);
const equipmentIndex = liveWorkflow.indexOf(
  "npm run eval:ask-vorta:vor049",
);
assert.ok(
  shiftCoverIndex >= 0 && resetIndex > shiftCoverIndex && equipmentIndex > resetIndex,
  "The central gate must run Shift Cover, reset the account window, then run the exhaustive equipment audit",
);
assert.ok(
  (liveWorkflow.match(/run: sleep 310/g) ?? []).length >= 2,
  "The central gate must establish clean account windows before both authenticated suites",
);
assert.ok(
  liveWorkflow.includes("VORTA_EVAL_RATE_LIMIT_RETRY_MS: 370000") &&
    liveWorkflow.includes("VORTA_EVAL_RATE_LIMIT_RETRY_MS: 310000") &&
    (liveWorkflow.match(/VORTA_EVAL_RATE_LIMIT_MAX_RETRIES: 3/g) ?? []).length >= 2,
  "Both live suites must retry the exact blocked scenario without running in lockstep",
);
assert.ok(
  liveWorkflow.includes("vor-048-live-eval.log") &&
    liveWorkflow.includes("vor-049-live-eval.log"),
  "Success and failure artifacts must preserve both authenticated suite logs",
);
assert.ok(
  liveEvaluator.includes("rateLimitWaitMs") &&
    liveEvaluator.includes("activeDurationMs") &&
    liveEvaluator.includes("elapsedDurationMs"),
  "Deliberate rate-window waiting must remain separate from active service latency",
);
assert.equal(
  shiftCoverScenarios.length,
  6,
  "The central live gate must retain all six Shift Cover routing scenarios",
);
assert.equal(
  equipmentScenarios.length,
  24,
  "The central live gate must retain all 24 maintenance-manager equipment decisions",
);
assert.ok(
  shiftCoverScenarios.every(
    (scenario) => Number(scenario.maxDurationMs) <= 12_000,
  ),
  "VOR-050 must not relax the existing Shift Cover response-latency target",
);

console.log("VOR-050 live evaluation orchestration contracts passed.");
