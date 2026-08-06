import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/screens/AiOperations/AskVortaDesktopWorkspaceExperience.tsx",
  "utf8",
);

for (const marker of [
  "CONVERSATION_SELECTOR",
  "conversationMessages",
  "messageTop",
  "beginActiveMessageFollow",
  "MutationObserver",
  "baselineCount",
  'message.classList.contains("justify-end")',
  'message.classList.contains("justify-start")',
  'querySelector(".animate-spin")',
  "programmaticScrollUntil",
  "Math.abs(activeScrollContainer.scrollTop - expectedTop) > 110",
  "stopActiveMessageFollow",
  'button?.textContent?.trim() === "Send"',
  'window.addEventListener("vorta-global-ai-prompt"',
  "60_000",
]) {
  assert.ok(source.includes(marker), `Missing VOR-066 viewport marker: ${marker}`);
}

assert.match(
  source,
  /if \(isPhone\) return;/,
  "The tablet/desktop active-message correction must leave the approved phone experience untouched",
);
assert.match(
  source,
  /positionActiveMessage\(\);[\s\S]*?responseComplete[\s\S]*?positionActiveMessage\(\);[\s\S]*?stopActiveMessageFollow\(\)/,
  "A new exchange must be positioned while loading and settled at the start of the completed answer",
);
assert.match(
  source,
  /Date\.now\(\) <= programmaticScrollUntil[\s\S]*?stopActiveMessageFollow\(\)/,
  "Deliberate user scrolling must stop automatic following rather than repeatedly yanking the viewport",
);
assert.match(
  source,
  /storeWorkspaceView[\s\S]*?SCROLL_STORAGE_KEY[\s\S]*?restoreWorkspaceView/,
  "Minimise and expand must retain the established saved workspace position",
);

console.log(
  "VOR-066 active conversation viewport contracts passed: new questions become the visible exchange, completed answers settle in view, deliberate upward scrolling is respected and phone behaviour remains unchanged.",
);
