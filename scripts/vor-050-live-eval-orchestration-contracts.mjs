import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const vor048Workflow = readFileSync(
  ".github/workflows/vor-048-validation.yml",
  "utf8",
);
const prDecisionWorkflow = readFileSync(
  ".github/workflows/vor-049-validation.yml",
  "utf8",
);
const dailyWorkflow = readFileSync(
  ".github/workflows/netlify-daily-release.yml",
  "utf8",
);
const productionWorkflow = readFileSync(
  ".github/workflows/maintenance-manager-production.yml",
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

for (const workflow of [vor048Workflow, prDecisionWorkflow]) {
  assert.doesNotMatch(
    workflow,
    /deploy-preview-|Wait for exact Netlify preview commit|VORTA_EVAL_BASE_URL|eval:ask-vorta:vor0(?:48|49)/,
    "Pull-request validation must not consume a Netlify deployment or the shared authenticated live-evaluation account",
  );
}
assert.ok(
  vor048Workflow.includes("group: vor-048-") &&
    prDecisionWorkflow.includes("group: ask-vorta-live-"),
  "PR validation must retain deterministic concurrency even after remote live traffic is removed",
);
assert.ok(
  dailyWorkflow.includes(
    "uses: ./.github/workflows/maintenance-manager-production.yml",
  ) && dailyWorkflow.includes("expected_commit:"),
  "The single daily release must own exact-commit production verification",
);
assert.ok(
  productionWorkflow.includes("workflow_call:") &&
    productionWorkflow.includes("node scripts/verify-production-commit.mjs"),
  "Authenticated evaluation must run only after the exact production commit is visible",
);

const backlogIndex = productionWorkflow.indexOf(
  "Run VOR-056 backlog production decision",
);
const firstResetIndex = productionWorkflow.indexOf(
  "Reset after backlog production decision",
);
const firstWindowIndex = productionWorkflow.indexOf(
  "Run first 12 Ask Vorta production decisions",
);
const secondResetIndex = productionWorkflow.indexOf(
  "Reset production evaluation rate window",
);
const finalWindowIndex = productionWorkflow.indexOf(
  "Run final Ask Vorta production decision",
);
assert.ok(
  backlogIndex >= 0 &&
    firstResetIndex > backlogIndex &&
    firstWindowIndex > firstResetIndex &&
    secondResetIndex > firstWindowIndex &&
    finalWindowIndex > secondResetIndex,
  "The daily production gate must isolate backlog and golden decisions in separate account windows",
);
assert.ok(
  (productionWorkflow.match(/run: sleep 310/g) ?? []).length >= 2,
  "The daily production gate must retain two deliberate account-window resets",
);
assert.ok(
  (productionWorkflow.match(/VORTA_EVAL_RATE_LIMIT_MAX_RETRIES: 3/g) ?? [])
    .length >= 3 &&
    (productionWorkflow.match(/VORTA_EVAL_RATE_LIMIT_RETRY_MS: 310000/g) ?? [])
      .length >= 3,
  "Every authenticated production decision window must use the bounded retry policy",
);
for (const log of [
  "ask-vorta-production-backlog.log",
  "ask-vorta-production-window-1.log",
  "ask-vorta-production-window-2.log",
]) {
  assert.ok(
    productionWorkflow.includes(log),
    `Production evidence must preserve ${log}`,
  );
}
assert.ok(
  liveEvaluator.includes("rateLimitWaitMs") &&
    liveEvaluator.includes("activeDurationMs") &&
    liveEvaluator.includes("elapsedDurationMs"),
  "Deliberate capacity waiting must remain separate from active service latency",
);
assert.equal(
  shiftCoverScenarios.length,
  6,
  "All six Shift Cover scenarios must remain available for focused audits",
);
assert.equal(
  equipmentScenarios.length,
  24,
  "All 24 equipment scenarios must remain available for exhaustive audits",
);
assert.ok(
  shiftCoverScenarios.every(
    (scenario) => Number(scenario.maxDurationMs) <= 12_000,
  ),
  "The daily deployment policy must not relax the Shift Cover latency target",
);

console.log("VOR-050 daily live evaluation orchestration contracts passed.");
