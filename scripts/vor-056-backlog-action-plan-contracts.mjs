import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const entrypoint = readFileSync(
  "netlify/functions/ask-vorta.mts",
  "utf8",
);
const equipmentFallback = readFileSync(
  "netlify/functions/ask-vorta/runtime-equipment-fallback.mts",
  "utf8",
);
const responseValidation = readFileSync(
  "netlify/functions/ask-vorta/response-validation.mts",
  "utf8",
);
const finalResponseBoundary = readFileSync(
  "netlify/functions/ask-vorta/runtime-document-links.mts",
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
const liveHarness = readFileSync(
  "scripts/ask-vorta-live-evals.mjs",
  "utf8",
);
const centralWorkflow = readFileSync(
  ".github/workflows/vor-049-validation.yml",
  "utf8",
);
const productionWorkflow = readFileSync(
  ".github/workflows/maintenance-manager-production.yml",
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
  "export function enforceFinalOperationalActionPlan(",
  "visibleWorkOrderId(answer)",
  "requiresBacklogActionPlan(question)",
  "requiresHandoverActionPlan(question)",
  "const mentionsBacklog = /\\bbacklog\\b/i.test(question)",
  "const mentionsBacklogState = /\\b(?:overdue|unassigned)\\b/i.test(question)",
  "const mentionsWorkOrders = /\\bwork(?:\\s+orders?)?\\b/i.test(question)",
  "mentionsBacklog || (mentionsBacklogState && mentionsWorkOrders)",
  "if (!workOrderId) return false",
  "if (!backlog && !handover) return false",
  "Maintenance Manager / Planner",
  "authorised SAP-backed work-order evidence",
  "make any required record change in SAP",
  "authorised SAP-backed status and blocker",
  "outside Vorta",
  "responseWithFinalGuard",
]) {
  assert.ok(
    finalResponseBoundary.includes(marker),
    `The final HTTP response boundary is missing ${marker}`,
  );
}
assert.ok(
  finalResponseBoundary.indexOf("enforceFinalOperationalActionPlan(") <
    finalResponseBoundary.indexOf("answerDocumentEvidenceText("),
  "The final operational guard must run before document-link early returns can bypass it",
);
for (const earlyReturn of [
  "if (!answerReferencesDocuments(evidenceText)) return responseWithFinalGuard();",
  "if (!equipmentId) return responseWithFinalGuard();",
  "return responseWithFinalGuard();",
]) {
  assert.ok(
    finalResponseBoundary.includes(earlyReturn),
    `Document-link processing must preserve the final action-plan repair at ${earlyReturn}`,
  );
}
assert.equal(
  /assigned successfully|updated SAP/i.test(finalResponseBoundary),
  false,
  "The final response guard must not claim that Ask Vorta performed an SAP or assignment write",
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
const delegatesDirectly = entrypoint.includes(
  'import handler from "./ask-vorta/runtime.mjs";',
);
const delegatesThroughFallback =
  entrypoint.includes(
    'import handler from "./ask-vorta/runtime-equipment-fallback.mjs";',
  ) &&
  equipmentFallback.includes('import coreHandler from "./runtime.mjs";') &&
  equipmentFallback.includes("const primaryResponse = await coreHandler(");
assert.ok(
  (delegatesDirectly || delegatesThroughFallback) &&
    entrypoint.includes("export default handler;"),
  "The deployment integrity check must preserve a thin Netlify delegation to the canonical runtime, directly or through the validated equipment fallback wrapper",
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
for (const marker of [
  "function isUsageExceeded(",
  'requestResult.response?.status === 503',
  '"usage_exceeded"',
  "function isRetryableCapacityResponse(",
  "blockedByCapacity",
  "platform usage capacity exceeded after configured retries",
  "blockedByRateLimit || blockedByCapacity",
]) {
  assert.ok(
    liveHarness.includes(marker),
    `The live evaluator capacity retry is missing ${marker}`,
  );
}
assert.ok(
  liveHarness.includes(
    'String(requestResult.payload?.error ?? "").trim().toLowerCase()',
  ),
  "Only the exact usage_exceeded platform response may use the 503 retry path",
);

const backlogIndex = productionWorkflow.indexOf(
  "Run VOR-056 backlog production decision",
);
const resetIndex = productionWorkflow.indexOf(
  "Reset after backlog production decision",
);
const productionWindowIndex = productionWorkflow.indexOf(
  "Run first 12 Ask Vorta production decisions",
);
assert.ok(
  backlogIndex >= 0 && resetIndex > backlogIndex && productionWindowIndex > resetIndex,
  "The focused backlog decision must run once after deployment and before the production golden suite",
);
assert.ok(
  productionWorkflow.includes(
    "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-056-backlog-action-plan.json",
  ) && productionWorkflow.includes("ask-vorta-production-backlog.log"),
  "The production verifier must run and preserve VOR-056 live evidence",
);

console.log("VOR-056 actionable backlog decision contracts passed.");