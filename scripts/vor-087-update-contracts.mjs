import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`VOR-087 could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`VOR-087 found more than one ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const liveContractPath = "scripts/vor-084-live-evidence-activity-contracts.mjs";
const agentContractPath = "scripts/ask-vorta-agent-contracts.mjs";
const runnerPath = "scripts/run-contract-suite.mjs";
const newContractPath = "scripts/vor-087-universal-disclosure-contracts.mjs";

let liveContract = readFileSync(liveContractPath, "utf8");
let agentContract = readFileSync(agentContractPath, "utf8");
let runner = readFileSync(runnerPath, "utf8");

liveContract = replaceOnce(
  liveContract,
  `const workspace = read("src/screens/AiOperations/AskVortaWorkspaceBase.tsx");\nconst shell = read("index.html");`,
  `const workspace = read("src/screens/AiOperations/AskVortaWorkspaceBase.tsx");\nconst liveActivity = read("src/screens/AiOperations/AskVortaLiveEvidenceActivity.tsx");\nconst shell = read("index.html");`,
  "VOR-084 shared live activity source",
);

liveContract = replaceOnce(
  liveContract,
  `for (const marker of [\n  'data-vorta-ai-live-evidence-activity="true"',\n  "Checking Vorta evidence",\n  "MAX_VISIBLE_PROGRESS_STEPS = 6",\n  "ASK_VORTA_PROGRESS_EVENT",\n  "ASK_VORTA_PROGRESS_RESET_EVENT",\n  "<CheckCircle2",\n]) {\n  assert.ok(workspace.includes(marker), \`Workspace live activity is missing \${marker}\`);\n}`,
  `for (const marker of [\n  'data-vorta-ai-live-evidence-activity="true"',\n  "MAX_VISIBLE_PROGRESS_STEPS = 4",\n  "ASK_VORTA_PROGRESS_EVENT",\n  "ASK_VORTA_PROGRESS_RESET_EVENT",\n  "<CheckCircle2",\n  "Starting the relevant evidence checks",\n]) {\n  assert.ok(liveActivity.includes(marker), \`Shared live activity is missing \${marker}\`);\n}\nassert.ok(\n  workspace.includes("SharedAskVortaLiveEvidenceActivity"),\n  "Desktop/tablet workspace must render the shared live evidence activity",\n);`,
  "VOR-084 workspace source markers",
);

agentContract = replaceOnce(
  agentContract,
  `    assistant.includes("Decision summary") &&\n    assistant.includes("Detailed cover evidence") &&`,
  `    assistant.includes("data-vorta-ai-progressive-decision") &&\n    assistant.includes("Supporting evidence") &&\n    assistant.includes("Recommended actions") &&\n    assistant.includes("data-vorta-ai-source-disclosure") &&`,
  "Ask Vorta hierarchy markers",
);

runner = replaceOnce(
  runner,
  `  ["VOR-084 live Ask Vorta evidence activity", "scripts/vor-084-live-evidence-activity-contracts.mjs"],`,
  `  ["VOR-084 live Ask Vorta evidence activity", "scripts/vor-084-live-evidence-activity-contracts.mjs"],\n  ["VOR-087 universal Ask Vorta disclosure", "scripts/vor-087-universal-disclosure-contracts.mjs"],`,
  "VOR-087 contract registration",
);

const newContract = `import assert from "node:assert/strict";\nimport { readFileSync } from "node:fs";\n\nconst read = (path) => readFileSync(path, "utf8");\nconst assistant = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");\nconst workspace = read("src/screens/AiOperations/AskVortaWorkspace.tsx");\nconst workspaceBase = read("src/screens/AiOperations/AskVortaWorkspaceBase.tsx");\nconst sparePhoto = read("src/screens/AiOperations/AskVortaSparePhotoDisclosures.tsx");\nconst liveActivity = read("src/screens/AiOperations/AskVortaLiveEvidenceActivity.tsx");\n\nfor (const marker of [\n  'data-vorta-ai-primary-answer="true"',\n  'data-vorta-ai-progressive-decision="true"',\n  'data-vorta-ai-primary-priority="true"',\n  'data-vorta-ai-next-priorities="true"',\n  'data-vorta-ai-supporting-evidence="true"',\n  'Supporting evidence',\n  'Recommended actions',\n  'data-vorta-ai-source-disclosure="true"',\n  'Open in Vorta',\n]) {\n  assert.ok(assistant.includes(marker), \`Universal answer hierarchy is missing \${marker}\`);\n}\n\nassert.doesNotMatch(\n  assistant,\n  />\\s*Direct answer\\s*</,\n  "The old labelled Direct answer report card must not return",\n);\nassert.doesNotMatch(\n  assistant,\n  /Choosing and checking the relevant Vorta sources/,\n  "The opaque compact loading sentence must not return",\n);\nassert.ok(\n  assistant.includes("<AskVortaLiveEvidenceActivity />"),\n  "Compact Ask Vorta must use the same source-driven live evidence activity",\n);\nassert.ok(\n  workspaceBase.includes("SharedAskVortaLiveEvidenceActivity"),\n  "Full workspace must use the shared live evidence activity",\n);\nfor (const marker of [\n  'data-vorta-ai-live-evidence-activity="true"',\n  "ASK_VORTA_PROGRESS_EVENT",\n  "ASK_VORTA_PROGRESS_RESET_EVENT",\n]) {\n  assert.ok(liveActivity.includes(marker), \`Live evidence activity is missing \${marker}\`);\n}\n\nassert.match(\n  workspace,\n  /isAskVortaSparePhotoAnswer\\(answer\\)[\\s\\S]*?<AskVortaSparePhotoDisclosures answer=\\{answer\\}/,\n  "The specialist spare-photo disclosure renderer must remain intact",\n);\nfor (const marker of [\n  "Closest stock match",\n  "Next closest matches",\n  "initiallyOpen",\n  "Stores Inventory",\n]) {\n  assert.ok(sparePhoto.includes(marker), \`Spare-photo disclosure is missing \${marker}\`);\n}\n\nassert.match(\n  assistant,\n  /<AnswerBlock[\\s\\S]*?onFollowUp=\\{[\\s\\S]*?submitQuestion[\\s\\S]*?\\}/,\n  "Compact phone/tablet/desktop answers must continue through the shared AnswerBlock",\n);\nassert.match(\n  assistant,\n  /presentation="workspace"/,\n  "Tablet/desktop workspace answers must opt into the shared workspace presentation",\n);\nassert.ok(\n  assistant.includes('data-vorta-ai-evidence-links="true"') && assistant.includes("navigate(link.path)"),\n  "Open in Vorta evidence links must remain available",\n);\nassert.ok(\n  assistant.includes("submitAskVortaFeedback") && assistant.includes("prepareDraft"),\n  "Feedback and controlled action review must remain available",\n);\n\nconsole.log("VOR-087 universal Ask Vorta disclosure contracts passed: primary answer, progressive priorities, collapsed evidence/actions/sources, source-driven loading, specialist spare-photo preservation and all-device shared rendering are protected.");\n`;

writeFileSync(liveContractPath, liveContract);
writeFileSync(agentContractPath, agentContract);
writeFileSync(runnerPath, runner);
writeFileSync(newContractPath, newContract);
console.log("VOR-087 contract updates applied.");
