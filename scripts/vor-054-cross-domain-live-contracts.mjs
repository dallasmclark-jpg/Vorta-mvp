import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";

const workflowDirectory = ".github/workflows";
const retiredWorkflow =
  ".github/workflows/vor-038-intelligence-live-eval.yml";
const centralWorkflowPath =
  ".github/workflows/vor-049-validation.yml";
const productionWorkflowPath =
  ".github/workflows/maintenance-manager-production.yml";
const crossDomainScenarioPath =
  "tests/evals/vor-054-cross-domain-live.json";

assert.equal(
  existsSync(retiredWorkflow),
  false,
  "The branch-pinned VOR-038 live workflow must be retired",
);

const workflowFiles = readdirSync(workflowDirectory)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();
const workflowSources = workflowFiles.map((name) => ({
  name,
  source: readFileSync(join(workflowDirectory, name), "utf8"),
}));
const authenticatedOwners = workflowSources.filter(({ source }) =>
  source.includes("npm run eval:ask-vorta:") ||
  source.includes(
    "node scripts/ask-vorta-live-evals.mjs tests/evals/",
  ),
);
assert.deepEqual(
  authenticatedOwners.map(({ name }) => name),
  [
    "maintenance-manager-production.yml",
    "vor-049-validation.yml",
  ],
  "Only the PR gate and exact-production verifier may run authenticated Ask Vorta evaluations",
);
const pullRequestOwners = authenticatedOwners.filter(({ source }) =>
  source.includes("pull_request:"),
);
assert.deepEqual(
  pullRequestOwners.map(({ name }) => name),
  ["vor-049-validation.yml"],
  "Exactly one pull-request workflow must own authenticated Ask Vorta live traffic",
);
const productionWorkflow = readFileSync(
  productionWorkflowPath,
  "utf8",
);
assert.ok(
  productionWorkflow.includes("workflow_run:") &&
    productionWorkflow.includes(
      "github.event.workflow_run.head_branch == 'main'",
    ),
  "Production evaluation must run only after a successful main-branch quality workflow",
);
const productionCommitCheck = productionWorkflow.indexOf(
  "node scripts/verify-production-commit.mjs",
);
const productionEvaluation = productionWorkflow.indexOf(
  "npm run eval:ask-vorta:live",
);
assert.ok(
  productionCommitCheck >= 0 &&
    productionEvaluation > productionCommitCheck,
  "Production evaluation must verify the exact deployed commit before using the authenticated account",
);
for (const { name, source } of workflowSources) {
  assert.equal(
    source.includes("deploy-preview-187--vorta-app.netlify.app"),
    false,
    `${name} must not target the retired fixed deploy preview`,
  );
  assert.equal(
    source.includes("fix/vor-038-ask-vorta-intelligence"),
    false,
    `${name} must not target the retired VOR-038 branch`,
  );
}

const centralWorkflow = readFileSync(centralWorkflowPath, "utf8");
const routePlanning = readFileSync(
  "netlify/functions/ask-vorta/route-planning.mts",
  "utf8",
);
const responseValidation = readFileSync(
  "netlify/functions/ask-vorta/response-validation.mts",
  "utf8",
);
const shiftCoverScenarios = JSON.parse(
  readFileSync(
    "tests/evals/vor-048-shift-cover-routing.json",
    "utf8",
  ),
);
const crossDomainScenarios = JSON.parse(
  readFileSync(crossDomainScenarioPath, "utf8"),
);
const equipmentScenarios = JSON.parse(
  readFileSync("tests/evals/vor-033-demo-golden.json", "utf8"),
);

assert.equal(
  shiftCoverScenarios.length,
  6,
  "The first authenticated window must retain six Shift Cover scenarios",
);
assert.equal(
  crossDomainScenarios.length,
  6,
  "VOR-054 must add exactly six cross-domain scenarios",
);
assert.equal(
  shiftCoverScenarios.length + crossDomainScenarios.length,
  12,
  "The first authenticated window must stay within the 12-request account limit",
);
assert.equal(
  equipmentScenarios.length,
  24,
  "The exhaustive equipment audit must retain all 24 decisions",
);

const scenariosById = new Map(
  crossDomainScenarios.map((scenario) => [scenario.id, scenario]),
);
for (const id of [
  "vor054-site-priority-natural",
  "vor054-plan-feasibility",
  "vor054-handover-shorthand",
  "vor054-spares-advisory",
  "vor054-capability-backup",
  "vor054-read-only-write-boundary",
]) {
  assert.ok(scenariosById.has(id), `Missing cross-domain scenario ${id}`);
}
const allExpectedTools = crossDomainScenarios.flatMap(
  (scenario) => scenario.expectedTools ?? [],
);
for (const tool of [
  "get_site_operational_snapshot",
  "get_site_maintenance_plan",
  "get_shift_cover",
  "get_shift_handover",
  "get_site_spares_risk",
  "get_site_capability_actions",
]) {
  assert.ok(
    allExpectedTools.includes(tool),
    `Cross-domain live coverage is missing ${tool}`,
  );
}
const writeBoundary = scenariosById.get(
  "vor054-read-only-write-boundary",
);
assert.deepEqual(
  writeBoundary.expectedTools,
  ["get_shift_cover"],
  "The staffing write-boundary scenario may use one read-only Shift Cover lookup",
);
assert.equal(
  writeBoundary.maxToolCount,
  1,
  "The staffing write-boundary scenario must not expand beyond one read-only lookup",
);
assert.ok(
  writeBoundary.mustMention.includes("read-only"),
  "The write-boundary scenario must require the SAP/read-only boundary",
);
assert.ok(
  writeBoundary.mustMentionAny.some((value) =>
    ["cannot", "can’t"].includes(value)
  ),
  "The write-boundary scenario must require a refusal",
);

assert.ok(
  routePlanning.includes("const staffingWriteRequest =") &&
    routePlanning.includes("staffingWriteRequest ||"),
  "Staffing write commands must route deterministically through one Shift Cover lookup",
);
assert.ok(
  routePlanning.includes(
    "Ask Vorta is read-only and cannot assign engineers or change the rota",
  ),
  "The staffing route must require an explicit read-only refusal",
);
assert.ok(
  responseValidation.includes(
    "export function enforceReadOnlyWriteBoundary(",
  ) &&
    (responseValidation.match(
      /enforceReadOnlyWriteBoundary\(answer, question\);/g,
    ) ?? []).length >= 2,
  "The read-only boundary must be enforced before and after Shift Cover answer shaping",
);

for (const trigger of [
  '      - "scripts/vor-054*"',
  '      - "tests/evals/vor-054-cross-domain-live.json"',
  '      - ".github/workflows/vor-038-intelligence-live-eval.yml"',
]) {
  assert.ok(
    centralWorkflow.includes(trigger),
    `The central workflow is missing trigger ${trigger.trim()}`,
  );
}
assert.ok(
  centralWorkflow.includes(
    "node scripts/vor-054-cross-domain-live-contracts.mjs",
  ),
  "The central gate must run the permanent VOR-054 contract",
);
const shiftCoverIndex = centralWorkflow.indexOf(
  "npm run eval:ask-vorta:vor048",
);
const crossDomainIndex = centralWorkflow.indexOf(
  "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-054-cross-domain-live.json",
);
const resetIndex = centralWorkflow.indexOf(
  "Reset rate window before exhaustive equipment audit",
);
const equipmentIndex = centralWorkflow.indexOf(
  "npm run eval:ask-vorta:vor049",
);
assert.ok(
  shiftCoverIndex >= 0 &&
    crossDomainIndex > shiftCoverIndex &&
    resetIndex > crossDomainIndex &&
    equipmentIndex > resetIndex,
  "The central gate must run Shift Cover, cross-domain decisions, reset, then equipment decisions",
);
assert.ok(
  centralWorkflow.includes("vor-054-live-eval.log"),
  "Success and failure artifacts must preserve the cross-domain live log",
);
assert.ok(
  centralWorkflow.includes("timeout-minutes: 80"),
  "The central gate must allow for the additional bounded cross-domain suite",
);

console.log("VOR-054 cross-domain live coverage contracts passed.");
