import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const packageJson = JSON.parse(read("package.json"));
const entry = read("netlify/functions/ask-vorta.mts");
const runtime = read("netlify/functions/ask-vorta/runtime.mts");
const contracts = read("netlify/functions/ask-vorta/contracts.mts");
const authentication = read("netlify/functions/ask-vorta/authenticated-context.mts");
const assistant = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");
const workspace = read("src/screens/AiOperations/AskVortaWorkspace.tsx");
const service = read("src/screens/AiOperations/vortaAgentService.ts");
const liveEval = read("scripts/ask-vorta-live-evals.mjs");
const controlledActions = read("src/screens/AiOperations/askVortaControlledActions.ts");

const legacyLifecycleScripts = [
  "vor-044-integrate-operational-value.mjs",
  "vor-045-normalise-request-context.mjs",
  "vor-045-integrate-conversation-context.mjs",
  "vor-046-integrate-image-backend.mjs",
  "vor-046-integrate-image-client.mjs",
  "vor-047-integrate-confirmed-actions.mjs",
  "vor-048-integrate-routing-telemetry-feedback.mjs",
  "vor-049-integrate-decision-ready-equipment.mjs",
  "vor-051-integrate-evidence-links.mjs",
];
const lifecycle = [
  packageJson.scripts.predev,
  packageJson.scripts["build:metadata"],
  packageJson.scripts["test:contracts"],
].join("\n");

assert.equal(
  packageJson.scripts.predev,
  "node scripts/vor-053-canonical-build-contracts.mjs --quick",
  "Development startup must verify canonical source without mutating it",
);
assert.equal(
  packageJson.scripts["build:metadata"],
  "node scripts/write-build-metadata.mjs",
  "Build metadata must be the only pre-build write",
);
assert.equal(
  packageJson.scripts["test:contracts"],
  "node scripts/run-contract-suite.mjs",
  "Contract execution must not prepare or mutate source",
);
assert.equal(
  packageJson.scripts.build,
  "npm run build:metadata && npm run typecheck && npm run test:contracts && npm run test:smoke && vite build",
);
for (const script of legacyLifecycleScripts) {
  assert.equal(
    lifecycle.includes(script),
    false,
    `${script} must not run from the package lifecycle`,
  );
}

assert.doesNotMatch(entry, /VOR-052 legacy integration guards/);
assert.doesNotMatch(entry, /case "get_site_ranked_actions":/);
assert.match(entry, /import handler from "\.\/ask-vorta\/runtime\.mjs"/);
assert.match(entry, /export default handler/);
assert.match(entry, /path: "\/api\/ask-vorta"/);
assert.match(entry, /method: "POST"/);

for (const marker of [
  "authenticateAskVortaRequest(req)",
  "beginAskVortaInteraction({",
  "buildQuestionPlan",
  "executeTool",
  "repairEquipmentDecisionAnswer",
  "buildAskVortaImageDiagnosis",
]) assert.ok(runtime.includes(marker), `Canonical runtime is missing ${marker}`);
assert.match(contracts, /export const TOOLS/);
assert.match(authentication, /supabase\.auth\.getUser\(bearer\)/);
assert.match(authentication, /\.from\("user_site_access"\)/);

for (const marker of [
  "VortaConversationContext",
  "PreparedAskVortaImage",
  "AskVortaFeedbackCategory",
  "conversationContext",
  "evidenceLinks",
]) assert.ok(service.includes(marker), `Canonical agent service is missing ${marker}`);
for (const marker of [
  "pendingImage",
  "onSelectImage",
  "onRemoveImage",
  "Photo attached:",
]) assert.ok(workspace.includes(marker), `Canonical workspace is missing ${marker}`);
for (const marker of [
  "latestConversationContext",
  "openAskVortaActionReviewDialog",
  "prepareAskVortaImage",
  'data-vorta-ai-feedback="true"',
  'data-vorta-ai-evidence-links="true"',
  "submitAskVortaFeedback",
]) assert.ok(assistant.includes(marker), `Canonical assistant is missing ${marker}`);
for (const marker of [
  "function visibleDecisionText(answer)",
  "function visibleDecisionContradictions(answer)",
  "requireVisibleDecision",
  "visibleAnswer: boundedAnswerSnapshot(payload)",
]) assert.ok(liveEval.includes(marker), `Canonical live evaluator is missing ${marker}`);

assert.match(controlledActions, /handover_note/);
assert.match(controlledActions, /ask_vorta_action/);
for (const forbidden of [
  "create_maintenance_notification",
  "create_maintenance_work_request",
  "vorta_save_shift_handover_action",
]) {
  assert.equal(runtime.includes(forbidden), false, `Runtime crosses the SAP/action boundary with ${forbidden}`);
}

if (process.argv.includes("--require-retired-scaffolding")) {
  for (const script of legacyLifecycleScripts) {
    assert.equal(existsSync(`scripts/${script}`), false, `${script} must be retired`);
  }
}

console.log("VOR-053 canonical Ask Vorta build contracts passed.");
