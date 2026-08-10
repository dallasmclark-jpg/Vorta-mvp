import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const assistant = readFileSync(
  "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx",
  "utf8",
);
const workspace = [
  readFileSync(
    "src/screens/AiOperations/AskVortaWorkspace.tsx",
    "utf8",
  ),
  readFileSync(
    "src/screens/AiOperations/AskVortaWorkspaceBase.tsx",
    "utf8",
  ),
].join("\n\n");
const mobileCss = readFileSync(
  "src/screens/AiOperations/mobilePortalHardening.css",
  "utf8",
);

assert.match(
  workspace,
  /data-vorta-ai-workspace="true"[\s\S]*hidden min-h-0[\s\S]*md:flex/,
  "The full Ask Vorta workspace must exist only on tablet and desktop layouts.",
);
assert.match(
  workspace,
  /New conversation[\s\S]*Recents/,
  "The workspace must provide new and recent conversations.",
);
assert.match(
  workspace,
  /vorta:ask-vorta:recent-conversations:v1/,
  "Recent conversations must use the bounded local workspace store.",
);
assert.match(
  workspace,
  /vorta:ask-vorta:active-conversation:v1[\s\S]*sessionStorage.getItem[\s\S]*sessionStorage.setItem/,
  "The active conversation survives compact workspace remounts without duplicating Recents.",
);
for (const label of ["Conversation", "Evidence", "Actions"]) {
  assert.ok(
    workspace.includes(`label: "${label}"`),
    `The ${label} workspace tab must remain available.`,
  );
}
assert.match(
  workspace,
  /data-vorta-ai-workspace-conversation="true"/,
  "The workspace must expose a semantic conversation region.",
);
assert.match(
  workspace,
  /data-vorta-ai-workspace-evidence="true"/,
  "The workspace must expose a semantic evidence region.",
);
assert.match(
  workspace,
  /data-vorta-ai-workspace-actions="true"/,
  "The workspace must expose a semantic actions region.",
);
assert.match(
  workspace,
  /data-vorta-ai-workspace-welcome="true"[\s\S]*What can I help with\?/,
  "The full workspace must use the maintenance-first welcome state before the first question.",
);
assert.ok(
  workspace.includes("Collapse recent conversations") &&
    workspace.includes("Expand recent conversations"),
  "The Recent conversations rail must be collapsible without leaving the workspace.",
);
assert.ok(
  !workspace.includes("Return to compact panel"),
  "The duplicate sidebar compact-panel action must be removed.",
);
assert.match(
  workspace,
  /data-vorta-ai-workspace-source-summary="true"/,
  "Workspace answers must expose a direct route to their source evidence.",
);
assert.match(
  workspace,
  /matchMedia\("\(max-width: 768px\)"\)[\s\S]*onCollapse\(\)/,
  "Crossing into phone width must collapse the workspace back to the approved mobile assistant.",
);
assert.match(
  assistant,
  /data-vorta-global-ai-expand="true"[\s\S]*max-md:hidden/,
  "The workspace expand control must be hidden on mobile.",
);
assert.match(
  assistant,
  /w-\[min\(500px,calc\(100vw-2rem\)\)\]/,
  "The non-mobile compact panel must use the wider 500px decision width.",
);
assert.match(
  assistant,
  /max-h-\[min\(56vh,560px\)\][\s\S]*max-md:max-h-none[\s\S]*max-md:flex-1/,
  "The desktop and tablet message area may grow without changing mobile flex behaviour.",
);
assert.match(
  assistant,
  /data-vorta-global-ai-prompts="true"[\s\S]*max-md:order-3[\s\S]*hasActiveConversation \? "hidden" : ""/,
  "Quick prompts must sit above the phone composer and disappear after the first question.",
);
assert.match(
  assistant,
  /quickQuestions\.map\(\(question, questionIndex\)[\s\S]*questionIndex >= 3 \? "max-md:hidden"/,
  "Phone Ask Vorta must show the first three suggested prompts only.",
);
assert.match(
  assistant,
  /className="text-xs max-md:hidden"[\s\S]*aria-live="polite"/,
  "Verbose verified-context copy stays out of the phone landing view.",
);
assert.match(
  assistant,
  /<AskVortaWorkspace[\s\S]*messages=\{messages as AskVortaWorkspaceMessage\[\]\}[\s\S]*renderAnswer=/,
  "The workspace must reuse the existing conversation and answer renderer rather than mount a second assistant.",
);

for (const hook of [
  'data-vorta-global-ai-panel="true"',
  'data-vorta-global-ai-header="true"',
  'data-vorta-global-ai-messages="true"',
  'data-vorta-global-ai-composer="true"',
  'data-vorta-global-ai-send="true"',
]) {
  assert.ok(
    assistant.includes(hook),
    `The approved mobile Ask Vorta hook ${hook} must remain unchanged.`,
  );
}

for (const rule of [
  "height: 100dvh !important",
  'content: "What can I help with?"',
  "font-size: 0 !important",
  '[data-vorta-global-ai-composer-row="true"]',
]) {
  assert.ok(
    mobileCss.includes(rule),
    `The approved mobile presentation rule ${rule} must remain unchanged.`,
  );
}

console.log(
  "VOR-041 desktop/tablet Ask Vorta workspace and refined mobile boundary contracts passed.",
);
