import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const movementSource = readFileSync(
  "netlify/functions/ask-vorta/site-risk-movement.mts",
  "utf8",
);
const handlerSource = readFileSync(
  "netlify/functions/ask-vorta/site-risk-movement-handler.mts",
  "utf8",
);
const entrypointSource = readFileSync(
  "netlify/functions/ask-vorta.mts",
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
  "authenticateAskVortaRequest",
  "beginAskVortaInteraction",
  "updateAskVortaInteraction",
  "withPhaseTimeout",
  "loadSiteRiskMovement",
  "siteRiskMovementAnswer",
  "plannerMs: 0",
  "answerMs: 0",
  "toolRoundCount: 1",
  'new Set(["get_site_risk_movement"])',
  'path: "/dashboard"',
]) {
  assert.ok(
    handlerSource.includes(required),
    `VOR-062 handler must retain: ${required}`,
  );
}
assert.doesNotMatch(
  handlerSource,
  /OpenAI|responses\.create|VORTA_AI_MODEL|VORTA_AI_PLANNER_MODEL/,
  "The VOR-062 boundary must not invoke a reasoning model",
);

assert.ok(
  entrypointSource.includes("handleSiteRiskMovementRequest") &&
    entrypointSource.includes("movementResponse ?? runtimeHandler(req, context)"),
  "The canonical entrypoint must route VOR-062 first and delegate all unrelated requests to the unchanged runtime",
);
assert.ok(
  entrypointSource.includes("ASK_VORTA_RESPONSE_VALIDATION_REVISION"),
  "The validated response bundle pin must remain intact",
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

assert.ok(
  suiteSource.includes("VOR-062 site risk movement"),
  "The permanent contract suite must register VOR-062",
);

console.log(
  "VOR-062 contracts passed: site-scoped daily risk movement is deterministic, one-tool, fail-closed and does not invent shift precision or causation.",
);
