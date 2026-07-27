import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const agent = read("netlify/functions/ask-vorta.mts");
const service = read("src/screens/AiOperations/vortaAgentService.ts");
const assistant = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");
const evaluationSet = JSON.parse(read("tests/evals/ask-vorta-core.json"));
const liveGoldenSet = JSON.parse(read("tests/evals/ask-vorta-live-golden.json"));
const liveEvalRunner = read("scripts/ask-vorta-live-evals.mjs");
const qualityMigration = read(
  "supabase/migrations/20260726235315_add_ask_vorta_quality_workflow.sql",
);
const rpcManifestMigration = read(
  "supabase/migrations/20260726233000_register_shift_cover_ai_brief_rpc.sql",
);
const intelligenceMigration = read(
  "supabase/migrations/20260726234000_enrich_ask_vorta_maintenance_intelligence.sql",
);

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const requiredTools = [
  "get_site_risk",
  "get_equipment_risk",
  "get_shift_cover",
  "get_shift_handover",
  "get_contractor_availability",
  "get_site_work_backlog",
  "get_site_maintenance_plan",
  "get_site_spares_risk",
  "get_site_capability_actions",
  "get_equipment_work",
  "get_equipment_calibrations",
  "get_equipment_skills",
  "get_equipment_spares",
  "get_equipment_risk_actions",
  "get_equipment_history",
  "get_equipment_documents",
  "search_maintenance_documents",
];

for (const tool of requiredTools) {
  check(agent.includes(`name: "${tool}"`), `Ask Vorta is missing the ${tool} tool.`);
}

check(
  agent.includes('if (!bearer) return jsonResponse({ error: "Authentication is required." }, 401)') &&
    agent.includes('.from("user_site_access")') &&
    agent.includes('.eq("site_id", request.siteId)') &&
    agent.includes('.eq("active", true)'),
  "Ask Vorta must authenticate the caller and verify active access to the requested site.",
);

check(
  agent.includes("RATE_LIMIT_REQUESTS = 12") &&
    agent.includes('"ask_vorta_interactions"') &&
    agent.includes("questionFingerprint") &&
    agent.includes("evidenceLinks") &&
    agent.includes("responseId"),
  "Ask Vorta must enforce user-level capacity, record privacy-preserving telemetry and return traceable evidence links.",
);

check(
  agent.includes("You may use only the supplied Vorta tools") &&
    agent.includes("never browse the web") &&
    agent.includes("never invent site records") &&
    !agent.includes('type: "web_search'),
  "Ask Vorta must remain bounded to Vorta evidence with no web-search tool.",
);

check(
  service.includes("submitAskVortaFeedback") &&
    service.includes("createAskVortaActionDraft") &&
    assistant.includes("Prepare action draft") &&
    assistant.includes("Was this decision pack useful?") &&
    assistant.includes("Open in Vorta") &&
    assistant.includes("onFollowUp(question)"),
  "Ask Vorta must support feedback, approval-only action drafts, evidence navigation and tappable follow-ups.",
);

check(
  agent.includes("For shift-cover questions, always call get_shift_cover") &&
    agent.includes("off-rota candidate") &&
    agent.includes("calculated cover package") &&
    agent.includes('"vorta_get_shift_cover_ai_brief"'),
  "Shift-cover questions must use dated absences, rota, skills and calculated cover evidence.",
);

check(
  agent.includes("MAX_TOOL_ROUNDS = 5") &&
    agent.includes("MAX_TOOL_OUTPUT_CHARACTERS") &&
    agent.includes('const MODEL = "gpt-4.1-mini"') &&
    agent.includes("compactShiftCoverData") &&
    agent.includes("normaliseRelativeShiftCoverArguments") &&
    agent.includes("start_date: formatUtcDate(start)") &&
    agent.includes("enforceAnswerEvidence") &&
    agent.includes("compareCoverPriority") &&
    agent.includes("Joint-highest-risk shifts") &&
    agent.includes("Off-rota engineers — availability not confirmed") &&
    agent.includes("skill-by-asset exposure points") &&
    agent.includes('label: "First action"') &&
    agent.includes("Calculated cover-package impact") &&
    agent.includes("Ask Vorta is read-only and cannot change Vorta records") &&
    agent.includes("priorityShiftCountWithDetailedEvidence") &&
    agent.includes("store: false") &&
    !agent.includes("reasoning: { effort:") &&
    !agent.includes('verbosity: "low"') &&
    agent.includes("max_output_tokens: 3_000"),
  "The agent loop, low-latency model, provider storage and response size must remain bounded for serverless latency.",
);

check(
  agent.includes('type: "json_schema"') &&
    agent.includes("additionalProperties: false") &&
    agent.includes("skillsCovered") &&
    agent.includes("assetsProtected") &&
    agent.includes("remainingRisk") &&
    agent.includes("coverOptions") &&
    agent.includes("actionPlan") &&
    agent.includes("followUpQuestions") &&
    agent.includes("missingData") &&
    agent.includes("toolsUsed"),
  "Ask Vorta must return a strict evidence-aware response contract.",
);

check(
  service.includes("Authorization: `Bearer ${session.access_token}`") &&
    service.includes("history.slice(-8)") &&
    service.includes('fetch("/api/ask-vorta"'),
  "The frontend agent service must send authenticated requests with bounded conversation context.",
);

check(
  assistant.includes("await askVortaAgent") &&
    assistant.includes("conversationHistory(messages)") &&
    assistant.includes("using verified deterministic fallback") &&
    assistant.includes("buildGlobalAnswer(") &&
    assistant.includes('answer.responseBadge = "Verified Vorta decision pack"') &&
    assistant.includes("findings.push({") &&
    assistant.includes("coverOptions.push({") &&
    assistant.includes("actionPlan.push({") &&
    assistant.includes("Decision summary") &&
    assistant.includes("Detailed cover evidence") &&
    assistant.includes("<details") &&
    assistant.includes("Skills covered") &&
    assistant.includes("Assets protected") &&
    assistant.includes("Remaining risk:") &&
    assistant.includes("text-[15px]") &&
    assistant.includes("zero-cover exposures"),
  "The shared assistant must use the agent first and retain its verified deterministic fallback.",
);

check(
    agent.includes("decisionSummary") &&
    service.includes("isDecisionSummary") &&
    service.includes("record.decisionSummary") &&
    liveEvalRunner.includes("answer.decisionSummary"),
  "Ask Vorta must preserve the structured decision summary from the agent through the UI and live quality gate.",
);

const agentMutationTargets = [
  ...agent.matchAll(
    /\.from\("([^"]+)"\)[\s\S]{0,180}?\.(insert|update|upsert|delete)\(/g,
  ),
].map((match) => match[1]);
check(
  agentMutationTargets.length > 0 &&
    agentMutationTargets.every((table) => table === "ask_vorta_interactions") &&
    !agent.includes('.from("work_orders").update(') &&
    !agent.includes('.from("engineer_availability").update('),
  "Ask Vorta may write only its own quality telemetry; operational source records must remain read-only.",
);

check(
  rpcManifestMigration.includes("vorta_get_shift_cover_ai_brief(uuid,date,date)") &&
    rpcManifestMigration.includes("'read'") &&
    rpcManifestMigration.includes("'definer'") &&
    rpcManifestMigration.includes("anonymous_execute") &&
    rpcManifestMigration.includes("false"),
  "The Shift Cover AI brief must remain registered in the reviewed read-only RPC manifest.",
);

check(
  intelligenceMigration.includes("'offRota'") &&
    intelligenceMigration.includes("'coverCandidates'") &&
    intelligenceMigration.includes("'coverPackages'") &&
    intelligenceMigration.includes("'missingSkillsClosed'") &&
    intelligenceMigration.includes("'remainingMissingSkills'") &&
    intelligenceMigration.includes("off_rota_confirmation_required") &&
    intelligenceMigration.includes("provisional_confirm_availability_and_fatigue"),
  "Shift Cover intelligence must name rota-off engineers and calculate provisional cover impact without claiming availability.",
);

check(
  Array.isArray(evaluationSet) &&
    evaluationSet.length >= 80 &&
    evaluationSet.every(
      (scenario) =>
        typeof scenario.id === "string" &&
        typeof scenario.question === "string" &&
        Array.isArray(scenario.expectedTools) &&
        Array.isArray(scenario.mustMention),
    ),
  "Ask Vorta must retain at least 50 structured maintenance-manager evaluation scenarios.",
);

const evaluationTools = new Set(evaluationSet.flatMap((scenario) => scenario.expectedTools));
for (const tool of requiredTools) {
  check(evaluationTools.has(tool), `The evaluation baseline does not exercise ${tool}.`);
}

check(
  Array.isArray(liveGoldenSet) &&
    liveGoldenSet.length >= 10 &&
    liveGoldenSet.every(
      (scenario) =>
        typeof scenario.id === "string" &&
        typeof scenario.question === "string" &&
        Array.isArray(scenario.expectedTools) &&
        Array.isArray(scenario.mustMention) &&
        Array.isArray(scenario.mustNotMention),
    ) &&
    liveEvalRunner.includes("VORTA_EVAL_TOKEN") &&
    liveEvalRunner.includes("/api/ask-vorta") &&
    liveEvalRunner.includes("missing tool") &&
    liveEvalRunner.includes("unsafe phrase"),
  "Ask Vorta must retain an executable, authenticated golden-answer evaluation suite.",
);

check(
  qualityMigration.includes("ask_vorta_interactions") &&
    qualityMigration.includes("ask_vorta_action_drafts") &&
    qualityMigration.includes("enable row level security") &&
    qualityMigration.includes("vorta_rls_has_site_access") &&
    qualityMigration.includes("grant select, insert, update"),
  "Ask Vorta telemetry and drafts must remain explicitly granted, RLS protected and site scoped.",
);

console.log("Ask Vorta authenticated, Vorta-only, evidence and fallback contracts passed.");
