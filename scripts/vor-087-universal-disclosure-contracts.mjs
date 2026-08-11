import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const assistant = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");
const workspace = read("src/screens/AiOperations/AskVortaWorkspace.tsx");
const workspaceBase = read("src/screens/AiOperations/AskVortaWorkspaceBase.tsx");
const sparePhoto = read("src/screens/AiOperations/AskVortaSparePhotoDisclosures.tsx");
const liveActivity = read("src/screens/AiOperations/AskVortaLiveEvidenceActivity.tsx");
const conciseCss = read("src/screens/AiOperations/askVortaConciseAnswer.css");
const shell = read("index.html");
const mobileCss = read("src/screens/AiOperations/mobilePortalHardening.css");

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

assert.doesNotMatch(assistant, />\s*Direct answer\s*</, "The old labelled Direct answer report card must not return");
assert.doesNotMatch(assistant, /Choosing and checking the relevant Vorta sources/, "The opaque compact loading sentence must not return");
assert.ok(assistant.includes("<AskVortaLiveEvidenceActivity />"), "Compact Ask Vorta must use the shared source-driven live activity");
assert.ok(workspaceBase.includes("SharedAskVortaLiveEvidenceActivity"), "Full workspace must use the shared live activity");
for (const marker of [
  'data-vorta-ai-live-evidence-activity="true"',
  'data-vorta-ai-single-status="true"',
  'data-vorta-ai-single-status-icon="true"',
  'data-vorta-ai-single-status-label="true"',
  "currentProgressStep",
  "ASK_VORTA_PROGRESS_EVENT",
  "ASK_VORTA_PROGRESS_RESET_EVENT",
]) {
  assert.ok(liveActivity.includes(marker), `Universal live activity is missing ${marker}`);
}
assert.doesNotMatch(
  liveActivity,
  /completedCount|checked\s*<|MAX_VISIBLE_PROGRESS_STEPS|SPARE_PHOTO_PROGRESS_PREFIX|SparePhotoLiveEvidenceActivity|rounded-full border px-2 py-1/,
  "All Ask Vorta questions must use one image-standard live status with no counters, progress pills or route-specific loading renderer",
);
for (const marker of [
  '@property --vorta-evidence-pulse-angle',
  '@keyframes vorta-evidence-border-pulse',
  'conic-gradient(from var(--vorta-evidence-pulse-angle)',
  '[data-vorta-ai-live-evidence-activity="true"][data-vorta-ai-single-status="true"]',
  'max-width:440px!important',
  'height:44px!important',
]) {
  assert.ok(shell.includes(marker), `Universal Vorta pulse loading is missing ${marker}`);
}
const pulseStyle = shell.indexOf('[data-vorta-ai-live-evidence-activity="true"][data-vorta-ai-single-status="true"]');
const desktopMedia = shell.indexOf("@media(min-width:769px){");
assert.ok(pulseStyle >= 0 && desktopMedia > pulseStyle, "The Vorta single-status pulse must apply before desktop-only styling so it is shared by phone, tablet and desktop");

assert.ok(shell.includes('/src/screens/AiOperations/askVortaConciseAnswer.css'), "The image-standard concise answer stylesheet must be loaded by the app shell");
for (const marker of [
  ':where([data-vorta-global-ai-panel=true],[data-vorta-ai-workspace=true])',
  '[data-vorta-ai-supporting-evidence=true],details.bg-gray-900\\/40):has(~[data-vorta-ai-source-disclosure=true])',
  '[data-vorta-ai-feedback=true]',
  '[data-vorta-ai-workspace-source-summary=true]',
  '.rounded-md.border-blue-500\\/20.bg-blue-500\\/10.px-2.py-1\\.5',
  '.rounded-md.border-yellow-500\\/20.bg-yellow-500\\/10.px-2.py-1\\.5',
]) {
  assert.ok(conciseCss.includes(marker), `Concise image-standard default answer is missing ${marker}`);
}
assert.match(conciseCss, /content\s*:\s*["']Evidence & sources["']/, "Concise source disclosure must be labelled Evidence & sources");
assert.doesNotMatch(conciseCss, /nth-of-type\(/, "Concise Ask Vorta answers must use semantic hooks rather than positional hiding");

assert.doesNotMatch(
  mobileCss,
  /div\.flex\.flex-col\.gap-2 > div:nth-of-type\(1\)[\s\S]*?div:nth-of-type\(n\+4\)/,
  "Phone Ask Vorta must not use the retired positional answer trimming that can hide semantic progressive sections",
);

assert.match(workspace, /isAskVortaSparePhotoAnswer\(answer\)[\s\S]*?<AskVortaSparePhotoDisclosures answer=\{answer\}/, "The specialist spare-photo result renderer must remain intact");
for (const marker of ["Closest stock match", "Next closest matches", "initiallyOpen", "Stores Inventory"]) {
  assert.ok(sparePhoto.includes(marker), `Spare-photo disclosure is missing ${marker}`);
}

assert.match(assistant, /<AnswerBlock[\s\S]*?onFollowUp=\{[\s\S]*?submitQuestion[\s\S]*?\}/, "Compact phone/tablet/desktop answers must continue through the shared AnswerBlock");
assert.match(assistant, /presentation="workspace"/, "Tablet/desktop workspace answers must opt into the shared workspace presentation");
assert.ok(assistant.includes('data-vorta-ai-evidence-links="true"') && assistant.includes("navigate(link.path)"), "Open in Vorta evidence links must remain available");
assert.ok(assistant.includes("submitAskVortaFeedback") && assistant.includes("prepareDraft"), "Feedback and controlled action review must remain available in the model even when default feedback chrome is hidden");

console.log("VOR-087 universal Ask Vorta disclosure contracts passed: one image-standard live status across all questions/devices, concise decision-first generic answers including structured finding variants, specialist spare-photo results and controlled evidence/action behaviour are protected.");
