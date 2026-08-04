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
const workOrderBrowser = read(
  "tests/browser/maintenance-manager-work-orders.spec.ts",
);
const liveGolden = read("tests/evals/ask-vorta-live-golden.json");
const agentEntry = read("netlify/functions/ask-vorta.mts");
const agentContracts = read("netlify/functions/ask-vorta/contracts.mts");
const routePlanning = read("netlify/functions/ask-vorta/route-planning.mts");

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

check(
  agentEntry.includes('import handler from "./ask-vorta/runtime.mjs"') &&
    agentEntry.includes('path: "/api/ask-vorta"') &&
    agentEntry.includes('method: "POST"'),
  "The modular Ask Vorta backend must preserve the canonical Netlify route and runtime entry point.",
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
    agentContracts.includes(`name: "${tool}"`),
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
  agentContracts.includes('name: "get_shift_cover"') &&
    agentContracts.includes(
      "Always use this for rota, leave, training, availability or shift-cover questions.",
    ) &&
    routePlanning.includes('"get_equipment_decision_pack"') &&
    routePlanning.includes('"get_shift_cover"'),
  "One modular agent must select shift-cover or specialist equipment evidence according to the actual question.",
);

check(
  workOrderBrowser.includes("What are the shift cover issues today?") &&
    workOrderBrowser.includes('data-vorta-global-ai-panel="true"') &&
    workOrderBrowser.includes('data-vorta-fault-panel="true"') &&
    workOrderBrowser.includes("Recent matching history") &&
    workOrderBrowser.includes("Equipment SME") &&
    workOrderBrowser.includes("Corresponding documentation"),
  "The authenticated browser regression must use the reported wording and reject the retired fault presentation.",
);

check(
  liveGolden.includes('"id": "golden-cover-today-unified"') &&
    liveGolden.includes('"question": "What are the shift cover issues today?"') &&
    liveGolden.includes('"expectedTools": ["get_shift_cover"]') &&
    liveGolden.includes("FD-03 Approved Fault-Finding Guide"),
  "The live agent evaluation must prove the reported wording selects Shift Cover and excludes unrelated fault evidence.",
);

console.log(
  "VOR-037 unified Ask Vorta routing and unchanged mobile presentation contracts passed.",
);
