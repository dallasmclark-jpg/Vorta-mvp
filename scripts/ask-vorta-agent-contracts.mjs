import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const agent = read("netlify/functions/ask-vorta.mts");
const service = read("src/screens/AiOperations/vortaAgentService.ts");
const assistant = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");
const evaluationSet = JSON.parse(read("tests/evals/ask-vorta-core.json"));

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const requiredTools = [
  "get_site_risk",
  "get_equipment_risk",
  "get_shift_cover",
  "get_equipment_work",
  "get_equipment_calibrations",
  "get_equipment_skills",
  "get_equipment_spares",
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
  agent.includes("You may use only the supplied Vorta tools") &&
    agent.includes("never browse the web") &&
    agent.includes("never invent site records") &&
    !agent.includes('type: "web_search'),
  "Ask Vorta must remain bounded to Vorta evidence with no web-search tool.",
);

check(
  agent.includes("For shift-cover questions, always call get_shift_cover") &&
    agent.includes("holiday/training/absence reasons") &&
    agent.includes('"vorta_get_shift_cover_ai_brief"'),
  "Shift-cover questions must use dated calendar, exception and skills evidence.",
);

check(
  agent.includes("MAX_TOOL_ROUNDS = 4") &&
    agent.includes("MAX_TOOL_OUTPUT_CHARACTERS") &&
    agent.includes("store: false") &&
    agent.includes("max_output_tokens: 1_800"),
  "The agent loop, provider storage and response size must remain bounded.",
);

check(
  agent.includes('type: "json_schema"') &&
    agent.includes("additionalProperties: false") &&
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
    assistant.includes("buildGlobalAnswer("),
  "The shared assistant must use the agent first and retain its verified deterministic fallback.",
);

check(
  !agent.includes(".insert(") &&
    !agent.includes(".update(") &&
    !agent.includes(".upsert(") &&
    !agent.includes(".delete("),
  "The first Ask Vorta agent release must remain read-only.",
);

check(
  Array.isArray(evaluationSet) &&
    evaluationSet.length >= 50 &&
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

console.log("Ask Vorta authenticated, Vorta-only, evidence and fallback contracts passed.");
