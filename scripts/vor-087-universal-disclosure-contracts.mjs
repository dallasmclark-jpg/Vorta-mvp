import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const assistant = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");
const workspace = read("src/screens/AiOperations/AskVortaWorkspace.tsx");
const workspaceBase = read("src/screens/AiOperations/AskVortaWorkspaceBase.tsx");
const sparePhoto = read("src/screens/AiOperations/AskVortaSparePhotoDisclosures.tsx");
const liveActivity = read("src/screens/AiOperations/AskVortaLiveEvidenceActivity.tsx");

for (const marker of [
  'data-vorta-ai-primary-answer="true"',
  'data-vorta-ai-progressive-decision="true"',
  'data-vorta-ai-primary-priority="true"',
  'data-vorta-ai-next-priorities="true"',
  'data-vorta-ai-supporting-evidence="true"',
  'Supporting evidence',
  'Recommended actions',
  'data-vorta-ai-source-disclosure="true"',
  'Open in Vorta',
]) {
  assert.ok(assistant.includes(marker), `Universal answer hierarchy is missing ${marker}`);
}

assert.doesNotMatch(
  assistant,
  />\s*Direct answer\s*</,
  "The old labelled Direct answer report card must not return",
);
assert.doesNotMatch(
  assistant,
  /Choosing and checking the relevant Vorta sources/,
  "The opaque compact loading sentence must not return",
);
assert.ok(
  assistant.includes("<AskVortaLiveEvidenceActivity />"),
  "Compact Ask Vorta must use the same source-driven live evidence activity",
);
assert.ok(
  workspaceBase.includes("SharedAskVortaLiveEvidenceActivity"),
  "Full workspace must use the shared live evidence activity",
);
for (const marker of [
  'data-vorta-ai-live-evidence-activity="true"',
  "ASK_VORTA_PROGRESS_EVENT",
  "ASK_VORTA_PROGRESS_RESET_EVENT",
]) {
  assert.ok(liveActivity.includes(marker), `Live evidence activity is missing ${marker}`);
}

assert.match(
  workspace,
  /isAskVortaSparePhotoAnswer\(answer\)[\s\S]*?<AskVortaSparePhotoDisclosures answer=\{answer\}/,
  "The specialist spare-photo disclosure renderer must remain intact",
);
for (const marker of [
  "Closest stock match",
  "Next closest matches",
  "initiallyOpen",
  "Stores Inventory",
]) {
  assert.ok(sparePhoto.includes(marker), `Spare-photo disclosure is missing ${marker}`);
}

assert.match(
  assistant,
  /<AnswerBlock[\s\S]*?onFollowUp=\{[\s\S]*?submitQuestion[\s\S]*?\}/,
  "Compact phone/tablet/desktop answers must continue through the shared AnswerBlock",
);
assert.match(
  assistant,
  /presentation="workspace"/,
  "Tablet/desktop workspace answers must opt into the shared workspace presentation",
);
assert.ok(
  assistant.includes('data-vorta-ai-evidence-links="true"') && assistant.includes("navigate(link.path)"),
  "Open in Vorta evidence links must remain available",
);
assert.ok(
  assistant.includes("submitAskVortaFeedback") && assistant.includes("prepareDraft"),
  "Feedback and controlled action review must remain available",
);

console.log("VOR-087 universal Ask Vorta disclosure contracts passed: primary answer, progressive priorities, collapsed evidence/actions/sources, source-driven loading, specialist spare-photo preservation and all-device shared rendering are protected.");
