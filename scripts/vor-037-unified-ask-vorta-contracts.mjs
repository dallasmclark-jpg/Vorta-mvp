import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const wrapper = read(
  "src/screens/AiOperations/GlobalMaintenanceAiAssistantWithFaultsV2.tsx",
);
const assistant = read(
  "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx",
);
const experience = read(
  "src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx",
);
const mobilePresentation = read(
  "src/screens/AiOperations/mobilePortalHardening.css",
);
const agent = read("netlify/functions/ask-vorta.mts");

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const mountedAssistantCount = (
  wrapper.match(/<GlobalMaintenanceAiAssistant\b/g) ?? []
).length;

check(
  mountedAssistantCount === 1 &&
    !wrapper.includes("FaultIntelligenceDrawer") &&
    !wrapper.includes("shouldHandlePrompt") &&
    !wrapper.includes("isFaultQuestion"),
  "VOR-037 requires one mounted Ask Vorta assistant with no competing frontend intent router or fault drawer.",
);

check(
  experience.includes("<GlobalMaintenanceAiAssistantWithFaultsV2") &&
    !experience.includes("<FaultIntelligenceDrawer"),
  "The Maintenance Manager shell must mount only the unified Ask Vorta compatibility wrapper.",
);

for (const tool of [
  "get_equipment_work",
  "get_equipment_skills",
  "get_equipment_spares",
  "get_equipment_history",
  "get_equipment_documents",
  "search_maintenance_documents",
]) {
  check(
    agent.includes(`name: \"${tool}\"`),
    `The unified agent must retain specialist fault evidence through ${tool}.`,
  );
}

check(
  assistant.includes('data-vorta-global-ai-panel="true"') &&
    assistant.includes('data-vorta-global-ai-header="true"') &&
    assistant.includes('data-vorta-global-ai-messages="true"') &&
    assistant.includes('data-vorta-global-ai-composer="true"') &&
    assistant.includes('data-vorta-global-ai-send="true"') &&
    mobilePresentation.includes("height: 100dvh !important") &&
    mobilePresentation.includes('content: "What can I help with?"') &&
    mobilePresentation.includes("font-size: 0 !important"),
  "The existing mobile Ask Vorta shell, welcome state and composer presentation must remain unchanged.",
);

check(
  agent.includes("For shift-cover questions, always call get_shift_cover") &&
    agent.includes("For equipment-specific questions, call get_equipment_risk first") &&
    agent.includes("get_equipment_history") &&
    agent.includes("search_maintenance_documents"),
  "One agent must select shift-cover or specialist equipment evidence according to the actual question.",
);

console.log(
  "VOR-037 unified Ask Vorta routing and unchanged mobile presentation contracts passed.",
);
