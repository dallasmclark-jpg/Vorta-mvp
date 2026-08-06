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
  /const openedFromAskVorta =[\s\S]*?ASK_VORTA_DOCUMENT_ROUTE\.test\(location\.pathname\)[\s\S]*?searchParams|const openedFromAskVorta =[\s\S]*?ASK_VORTA_DOCUMENT_ROUTE\.test\(location\.pathname\)[\s\S]*?new URLSearchParams\(location\.search\)\.get\("from"\) === "ai"/,
  "Back to chat must be restricted to an internal Ask Vorta-origin document route",
);
assert.match(
  source,
  /const returnToAskVortaChat = useCallback\([\s\S]*?navigate\(-1\)[\s\S]*?navigate\("\/dashboard", \{ replace: true \}\)[\s\S]*?openMaintenanceAiAssistant\(\{ submit: false \}\)/,
  "Returning from a document must use internal history with a safe dashboard fallback and reopen Ask Vorta without submitting a question",
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
assert.doesNotMatch(
  source,
  /returnToAskVortaChat[\s\S]*?openMaintenanceAiAssistant\(\{[\s\S]*?question\s*:/,
  "Back to chat must never manufacture or submit a question",
);

console.log(
  "VOR-067 Ask Vorta navigation contracts passed: AI-origin documents return to the active chat, desktop/tablet can open the assistant directly, and no artificial question is submitted.",
);
