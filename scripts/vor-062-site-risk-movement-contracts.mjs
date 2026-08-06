import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const movementSource = readFileSync(
  "netlify/functions/ask-vorta/site-risk-movement.mts",
  "utf8",
);
const runtimeSource = readFileSync(
  "netlify/functions/ask-vorta/runtime.mts",
  "utf8",
);
const phaseRuntimeSource = readFileSync(
  "netlify/functions/ask-vorta/phase-runtime.mts",
  "utf8",
);
const entrypointSource = readFileSync(
  "netlify/functions/ask-vorta.mts",
  "utf8",
);
const packageSource = readFileSync("package.json", "utf8");
const workflowSource = readFileSync(
  ".github/workflows/vor-049-validation.yml",
  "utf8",
);
const suiteSource = readFileSync(
  "scripts/run-contract-suite.mjs",
  "utf8",
);
const scenarios = JSON.parse(
  readFileSync(
    "tests/evals/vor-062-site-risk-movement.json",
    "utf8",
  ),
);

for (const required of [
  'intentLabel: "site_risk_movement"',
  'requiredTools: ["get_site_risk_movement"]',
  '.from("site_risk_history")',
  '.eq("site_id", request.siteId)',
  '.order("snapshot_date", { ascending: false })',
  'new Map<string, SiteRiskSnapshot>()',
  'shiftLevelAvailable: false',
  'MAX_LATEST_SNAPSHOT_AGE_DAYS',
  'snapshots.length < 2',
  'latestAgeDays > MAX_LATEST_SNAPSHOT_AGE_DAYS',
  'No verified shift-level site-risk snapshot exists',
  'Daily snapshots prove movement, not its cause',
  'The daily snapshots do not prove which work, spare, skill, absence or equipment event caused the movement.',
]) {
  assert.ok(
    movementSource.includes(required),
    `VOR-062 movement contract is missing: ${required}`,
  );
}

for (const metric of [
  "risk_score",
  "risk_level",
  "highest_area",
  "highest_area_score",
  "at_risk_assets",
  "overdue_pm_count",
  "calibration_backlog_count",
  "cover_gap_count",
  "operational_risk_score",
  "labour_risk_score",
  "scheduled_engineer_count",
  "labour_shift_type",
]) {
  assert.ok(
    movementSource.includes(metric),
    `VOR-062 must retain exact daily metric: ${metric}`,
  );
}

assert.doesNotMatch(
  movementSource,
  /\.insert\(|\.update\(|\.delete\(|service_role|security definer/i,
  "VOR-062 must remain a site-scoped authenticated read path",
);
assert.doesNotMatch(
  movementSource,
  /area_risk_history|maintenance_parts_readiness_snapshots|maintenance_skill_risk_snapshots/,
  "VOR-062 must not use stale domain histories to explain current movement",
);
assert.doesNotMatch(
  movementSource,
  /OpenAI|responses\.create|VORTA_AI_MODEL|VORTA_AI_PLANNER_MODEL/,
  "VOR-062 movement and answer construction must be model-independent",
);

for (const required of [
  'from "./site-risk-movement.mjs"',
  "siteRiskMovementQuestionPlan(request) ?? deterministicQuestionPlan(request)",
  "siteRiskMovementQuestionPlan(planningRequest) ??",
  'toolName === "get_site_risk_movement"',
  "loadSiteRiskMovement(supabase, request)",
  "siteRiskMovementAnswer(request, questionPlan, toolOutcomes)",
  "toolRoundCount = deterministicToolNames.length > 0 ? 1 : 0",
  'label: "Open site risk"',
  'path: "/dashboard"',
  "authenticateAskVortaRequest(req)",
  "beginAskVortaInteraction({",
  "updateAskVortaInteraction(",
]) {
  assert.ok(
    runtimeSource.includes(required),
    `VOR-062 runtime integration must retain: ${required}`,
  );
}
assert.ok(
  runtimeSource.indexOf("siteRiskMovementQuestionPlan(request)") <
    runtimeSource.indexOf("const telemetryStart = await beginAskVortaInteraction"),
  "VOR-062 routing must be selected before telemetry starts so the canonical route key is recorded",
);
assert.ok(
  runtimeSource.indexOf('toolName === "get_site_risk_movement"') <
    runtimeSource.indexOf("client.responses.create"),
  "The deterministic movement evidence path must execute before any model answer path",
);
assert.ok(
  runtimeSource.indexOf("siteRiskMovementAnswer(request, questionPlan, toolOutcomes)") <
    runtimeSource.indexOf("for (let round = 0; round < MAX_TOOL_ROUNDS"),
  "A successful VOR-062 answer must complete before the model loop",
);
assert.ok(
  phaseRuntimeSource.includes('if (intent === "site_risk_movement")') &&
    phaseRuntimeSource.includes('return "site_risk_movement";'),
  "VOR-062 telemetry must retain a specific site_risk_movement route key instead of falling back to general",
);

assert.ok(
  entrypointSource.includes('import handler from "./ask-vorta/runtime.mjs";') &&
    entrypointSource.includes("export default handler;"),
  "The canonical endpoint must remain the exact modular runtime delegate",
);
assert.ok(
  entrypointSource.includes("ASK_VORTA_RESPONSE_VALIDATION_REVISION"),
  "The validated response bundle pin must remain intact",
);
assert.doesNotMatch(
  entrypointSource,
  /siteRiskMovement|site-risk-movement/,
  "VOR-062 must not bypass the canonical modular runtime from the deployable entrypoint",
);

assert.equal(
  scenarios.length,
  5,
  "VOR-062 requires five permanent natural-language scenarios",
);
for (const scenario of scenarios) {
  assert.deepEqual(
    scenario.expectedTools,
    ["get_site_risk_movement"],
    `${scenario.id} must use only the authorised movement reader`,
  );
  assert.equal(
    scenario.maxToolCount,
    1,
    `${scenario.id} must prohibit redundant evidence calls`,
  );
  assert.equal(
    scenario.requireActionPlan,
    false,
    `${scenario.id} must not manufacture an action plan for a factual comparison`,
  );
  assert.ok(
    Number(scenario.maxDurationMs) <= 5_000,
    `${scenario.id} must retain the deterministic latency ceiling`,
  );
}
const shiftScenario = scenarios.find(
  (scenario) => scenario.id === "vor062-previous-shift-boundary",
);
assert.ok(shiftScenario, "VOR-062 must retain a previous-shift boundary scenario");
assert.ok(
  shiftScenario.mustMentionAny.some((value) => /daily|shift-level/.test(value)),
  "The previous-shift scenario must disclose the daily-only evidence boundary",
);

for (const required of [
  '"eval:ask-vorta:vor062"',
  'tests/evals/vor-062-site-risk-movement.json',
]) {
  assert.ok(
    packageSource.includes(required),
    `package.json must expose the authenticated VOR-062 evaluator: ${required}`,
  );
}
for (const required of [
  '"scripts/vor-062*"',
  '"tests/evals/vor-062-site-risk-movement.json"',
  "Run permanent VOR-062 contracts",
  "Run five authenticated VOR-062 site-risk movement decisions",
  "npm run eval:ask-vorta:vor062",
  "vor-062-live-eval.log",
]) {
  assert.ok(
    workflowSource.includes(required),
    `The exact-source validation workflow must retain: ${required}`,
  );
}

assert.ok(
  suiteSource.includes("VOR-062 site risk movement"),
  "The permanent contract suite must register VOR-062",
);

console.log(
  "VOR-062 contracts passed: site-scoped daily risk movement is deterministic, one-tool, authenticated, correctly classified, fail-closed and does not invent shift precision or causation.",
);
