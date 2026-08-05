import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const entrypoint = readFileSync(
  "netlify/functions/ask-vorta.mts",
  "utf8",
);
const responseValidation = readFileSync(
  "netlify/functions/ask-vorta/response-validation.mts",
  "utf8",
);
const routePlanning = readFileSync(
  "netlify/functions/ask-vorta/route-planning.mts",
  "utf8",
);
const decisionAnswer = readFileSync(
  "netlify/functions/ask-vorta/decision-answer.mts",
  "utf8",
);
const runtime = readFileSync(
  "netlify/functions/ask-vorta/runtime.mts",
  "utf8",
);
const contractSuite = readFileSync(
  "scripts/run-contract-suite.mjs",
  "utf8",
);
const centralWorkflow = readFileSync(
  ".github/workflows/vor-049-validation.yml",
  "utf8",
);
const scenarios = JSON.parse(
  readFileSync("tests/evals/vor-056-backlog-action-plan.json", "utf8"),
);

const workRouteIndex = routePlanning.indexOf('"work_backlog"');
assert.ok(workRouteIndex >= 0, "The deterministic backlog route must remain available");
assert.ok(
  routePlanning
    .slice(workRouteIndex, workRouteIndex + 800)
    .includes("forceActionPlan: true"),
  "The backlog route must continue to require a decision-ready action plan",
);

for (const marker of [
  "const firstFinding = records(answer.findings)[0]",
  "const evidenceBackedWorkAction =",
  'scope === "work" && findingTitle',
  "Maintenance Manager / Planner",
  "authorised assignee",
  "SAP work order",
  "assignee, readiness, due date and released sequence",
]) {
  assert.ok(
    responseValidation.includes(marker),
    `The deterministic response guard is missing ${marker}`,
  );
}
assert.ok(
  responseValidation.includes(
    "answer.recommendedActions = [action]",
  ),
  "The evidence-backed fallback must keep recommended actions and the action plan aligned",
);
assert.ok(
  responseValidation.includes(
    'scope === "work"\n          ? "Moves the highest-priority overdue or unassigned work order',
  ),
  "The backlog action must state the decision impact without claiming a write",
);
assert.equal(
  /assigned successfully|updated SAP|work order released/i.test(
    responseValidation,
  ),
  false,
  "Ask Vorta must not claim that it performed a backlog or SAP write",
);

for (const marker of [
  "export function enforceBacklogActionPlan(",
  'outcomes.get("get_site_work_backlog")',
  'usedTools.has("get_site_work_backlog")',
  "records(answer.actionPlan).length > 0",
  "authorised assignee",
  "Maintenance Manager / Planner",
  "released sequence are recorded by an authorised user",
]) {
  assert.ok(
    responseValidation.includes(marker),
    `The final backlog response boundary is missing ${marker}`,
  );
}
assert.ok(
  runtime.includes("enforceBacklogActionPlan") &&
    runtime.split("enforceBacklogActionPlan(").length - 1 >= 3 &&
    runtime.split("toolOutcomes, usedTools").length - 1 >= 3,
  "The backlog guard must be imported and run with executed-tool evidence at deterministic, semantic and verified-fallback response boundaries",
);

for (const marker of [
  "ASK_VORTA_RESPONSE_VALIDATION_REVISION",
  '"vor-056-final-backlog-boundary-v1"',
]) {
  assert.ok(
    responseValidation.includes(marker),
    `The response-validation deployment revision is missing ${marker}`,
  );
  assert.ok(
    entrypoint.includes(marker),
    `The Netlify entrypoint deployment integrity check is missing ${marker}`,
  );
}
assert.ok(
  entrypoint.includes(
    'import handler from "./ask-vorta/runtime.mjs";',
  ) && entrypoint.includes("export default handler;"),
  "The deployment integrity check must preserve the thin Netlify handler delegation",
);

for (const marker of [
  'intent === "work_backlog"',
  'outcomeData(outcomes, "get_site_work_backlog")',
  "records(backlogRecord.workOrders)",
  "overdue work orders",
  "unassigned work orders",
  "Maintenance Manager / Planner",
  "authorised assignee",
  "released sequence are recorded by an authorised user",
]) {
  assert.ok(
    decisionAnswer.includes(marker),
    `The deterministic backlog answer is missing ${marker}`,
  );
}
assert.ok(
  decisionAnswer.indexOf('intent === "work_backlog"') <
    decisionAnswer.indexOf('intent === "shift_cover_risk"'),
  "The deterministic backlog answer must execute before the model-backed fallback path",
);

assert.equal(scenarios.length, 1, "VOR-056 must retain one focused live scenario");
const scenario = scenarios[0];
assert.equal(scenario.id, "vor-056-backlog-action-plan");
assert.deepEqual(scenario.expectedTools, ["get_site_work_backlog"]);
assert.ok(
  scenario.mustNotMention.includes("updated SAP") &&
    scenario.mustNotMention.includes("assigned successfully"),
  "The live scenario must protect the read-only boundary",
);

assert.ok(
  contractSuite.includes(
    '["VOR-056 actionable backlog decisions", "scripts/vor-056-backlog-action-plan-contracts.mjs"]',
  ),
  "VOR-056 must remain in the permanent contract suite",
);
for (const trigger of [
  '      - "scripts/vor-056*"',
  '      - "tests/evals/vor-056-backlog-action-plan.json"',
]) {
  assert.ok(
    centralWorkflow.includes(trigger),
    `The central Ask Vorta gate is missing ${trigger.trim()}`,
  );
}
const resetIndex = centralWorkflow.indexOf(
  "Reset rate window before exhaustive equipment audit",
);
const backlogIndex = centralWorkflow.indexOf(
  "Run backlog action-plan decision",
);
const equipmentIndex = centralWorkflow.indexOf(
  "Run all 24 visible-answer golden decisions",
);
assert.ok(
  resetIndex >= 0 && backlogIndex > resetIndex && equipmentIndex > backlogIndex,
  "The focused backlog decision must run after the reset and before the 24 equipment decisions",
);
assert.ok(
  centralWorkflow.includes(
    "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-056-backlog-action-plan.json",
  ) && centralWorkflow.includes("vor-056-live-eval.log"),
  "The central gate must run and preserve VOR-056 live evidence",
);

console.log("VOR-056 actionable backlog decision contracts passed.");
