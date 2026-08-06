import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx",
  "utf8",
);

for (const marker of [
  "ASK_VORTA_DOCUMENT_ROUTE",
  'new URLSearchParams(location.search).get("from") === "ai"',
  "data-vorta-back-to-ask-vorta",
  'aria-label="Back to Ask Vorta chat"',
  "navigate(-1)",
  'navigate("/dashboard", { replace: true })',
  "openMaintenanceAiAssistant({ submit: false })",
  "const showDesktopAssistantLauncher = !isPhone;",
  'data-vorta-shared-mobile-ai-launcher="true"',
]) {
  assert.ok(source.includes(marker), `Missing VOR-067 navigation marker: ${marker}`);
}

assert.match(
  source,
  /const openedFromAskVorta =\s*ASK_VORTA_DOCUMENT_ROUTE\.test\(location\.pathname\) &&\s*new URLSearchParams\(location\.search\)\.get\("from"\) === "ai";/,
  "Back to chat must be restricted to an internal Ask Vorta-origin document route",
);

const returnFunction = source.match(
  /const returnToAskVortaChat = useCallback\(\(\): void => \{[\s\S]*?\n  \}, \[navigate\]\);/,
)?.[0];
assert.ok(returnFunction, "The governed Back to chat handler must exist");
assert.match(
  returnFunction,
  /navigate\(-1\)[\s\S]*?navigate\("\/dashboard", \{ replace: true \}\)[\s\S]*?openMaintenanceAiAssistant\(\{ submit: false \}\)/,
  "Returning from a document must use internal history with a safe dashboard fallback and reopen Ask Vorta without submitting a question",
);
assert.ok(
  !returnFunction.includes("question:") && !returnFunction.includes("submit: true"),
  "Back to chat must never manufacture or submit a question",
);

assert.match(
  source,
  /\{openedFromAskVorta \? \([\s\S]*?data-vorta-back-to-ask-vorta="true"[\s\S]*?Back to chat[\s\S]*?\) : null\}/,
  "The Back to chat control must render only for Ask Vorta-origin document views",
);
assert.match(
  source,
  /showLauncher=\{showDesktopAssistantLauncher\}/,
  "The existing governed assistant must remain the desktop and tablet direct-open entry point",
);

console.log(
  "VOR-067 Ask Vorta navigation contracts passed: AI-origin documents return to the active chat, desktop/tablet can open the assistant directly, and no artificial question is submitted.",
);
