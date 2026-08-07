import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx",
  "utf8",
);
const workspaceExperience = readFileSync(
  "src/screens/AiOperations/AskVortaDesktopWorkspaceExperience.tsx",
  "utf8",
);

for (const marker of [
  '"vorta:ask-vorta:navigation-context:v1"',
  '"vorta:ask-vorta:return-active-conversation:v1"',
  "isAskVortaInternalNavigationTarget",
  'data-vorta-ai-evidence-links="true"',
  'data-vorta-global-ai-panel="true"',
  'data-vorta-ai-workspace="true"',
  "markAskVortaNavigationOrigin()",
  "readAskVortaNavigationContext()",
  "clearAskVortaNavigationContext()",
  "data-vorta-back-to-ask-vorta",
  'aria-label="Back to Ask Vorta chat"',
  "markAskVortaConversationForReturn();",
  "shouldRestoreAskVortaConversation()",
  "openMaintenanceAiAssistant({ submit: false })",
  "const showDesktopAssistantLauncher = !isPhone;",
  'data-vorta-shared-mobile-ai-launcher="true"',
]) {
  assert.ok(source.includes(marker), `Missing VOR-067 navigation marker: ${marker}`);
}

for (const forbidden of [
  "ASK_VORTA_DOCUMENT_ROUTE",
  'new URLSearchParams(location.search).get("from") === "ai"',
  "openedFromAskVorta",
]) {
  assert.ok(
    !source.includes(forbidden),
    `Back to chat must not depend on a document-only route flag: ${forbidden}`,
  );
}

for (const marker of [
  '"vorta:ask-vorta:return-active-conversation:v1"',
  'readSessionValue(RETURN_ACTIVE_CONVERSATION_KEY) === "1"',
  'aside button[aria-current="page"]',
  "activeRecent.click();",
  "removeSessionValue(RETURN_ACTIVE_CONVERSATION_KEY);",
]) {
  assert.ok(
    workspaceExperience.includes(marker),
    `Missing VOR-067 active-conversation restoration marker: ${marker}`,
  );
}

assert.match(
  source,
  /function isAskVortaInternalNavigationTarget[\s\S]*?data-vorta-ai-evidence-links="true"[\s\S]*?data-vorta-global-ai-panel="true"[\s\S]*?data-vorta-ai-workspace="true"[\s\S]*?url\.origin === window\.location\.origin/,
  "The application shell must recognise Ask Vorta evidence buttons and same-origin links without knowing their destination type",
);

assert.match(
  source,
  /const trackRecommendationFollowThrough = useCallback\([\s\S]*?isAskVortaInternalNavigationTarget\(event\.target\)[\s\S]*?setAskVortaNavigationContext\(markAskVortaNavigationOrigin\(\)\)/,
  "Every internal Ask Vorta navigation click must establish global return context before the destination opens",
);

const returnFunction = source.match(
  /const returnToAskVortaChat = useCallback\(\(\): void => \{[\s\S]*?\n  \}, \[askVortaNavigationContext, navigate\]\);/,
)?.[0];
assert.ok(returnFunction, "The global Back to chat handler must exist");
assert.match(
  returnFunction,
  /markAskVortaConversationForReturn\(\)[\s\S]*?clearAskVortaNavigationContext\(\)[\s\S]*?setAskVortaNavigationContext\(null\)[\s\S]*?navigate\(returnPath\)/,
  "Back to chat must mark the active conversation, clear excursion state and return to the recorded chat route",
);
assert.ok(
  !returnFunction.includes("submit: true") &&
    !returnFunction.includes("?from=ai") &&
    !returnFunction.includes("navigate(-1)"),
  "Back to chat must not manufacture a question, depend on query magic or guess using browser history",
);

assert.match(
  source,
  /useEffect\(\(\) => \{\s*if \(!shouldRestoreAskVortaConversation\(\)\) return;[\s\S]*?setTimeout\(\(\) => \{\s*openMaintenanceAiAssistant\(\{ submit: false \}\);\s*\}, 0\)[\s\S]*?\}, \[location\.pathname, location\.search\]\);/,
  "The mounted return route must reopen Ask Vorta after navigation without any destination-specific condition",
);

assert.match(
  workspaceExperience,
  /readSessionValue\(RETURN_ACTIVE_CONVERSATION_KEY\) === "1"[\s\S]*?aside button\[aria-current="page"\][\s\S]*?activeRecent\.click\(\)[\s\S]*?removeSessionValue\(RETURN_ACTIVE_CONVERSATION_KEY\)/,
  "The reopened desktop/tablet workspace must reload the active Recent before clearing the one-shot return marker",
);

assert.match(
  source,
  /\{askVortaNavigationContext \? \([\s\S]*?data-vorta-back-to-ask-vorta="true"[\s\S]*?Back to chat[\s\S]*?\) : null\}/,
  "The application shell must own one global Back to chat control for the whole Ask Vorta excursion",
);
assert.match(
  source,
  /showLauncher=\{showDesktopAssistantLauncher\}/,
  "The existing governed assistant must remain the desktop and tablet direct-open entry point",
);

console.log(
  "VOR-067 Ask Vorta navigation contracts passed: Back to chat is application-shell owned, destination-type agnostic, independent of query parameters and browser-history guessing, and restores the active conversation.",
);
