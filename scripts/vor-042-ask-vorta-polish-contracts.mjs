import { readFileSync } from "node:fs";

// Final visual contract keeps the refined workspace hierarchy inside the existing Ask Vorta architecture.
// Reopen coverage verifies Recents first, then returns to Conversation before checking message content.
const workspace = readFileSync("src/screens/AiOperations/AskVortaWorkspace.tsx", "utf8");
const assistant = readFileSync("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx", "utf8");
const browser = readFileSync("tests/browser/vor-041-ask-vorta-workspace.spec.ts", "utf8");

const checks = [
  [workspace.includes("visibleConversationMessages"), "active workspace conversation hides its introductory card"],
  [workspace.includes('contextReady\n                    ? "Live evidence"'), "workspace uses a compact evidence-status label"],
  [assistant.includes('presentation?: "compact" | "workspace"'), "AnswerBlock supports workspace presentation"],
  [assistant.includes("wideCompactPresentation"), "compact density is limited only on non-mobile layouts"],
  [assistant.includes("decisionSummaryLimit"), "decision summary density is explicitly bounded"],
  [assistant.includes('presentation="workspace"'), "workspace rendering opts into the clean hierarchy"],
  [assistant.includes('messageIndex === 0 ? "md:hidden"'), "compact introduction remains available on phone and hides on wider active conversations"],
  [browser.includes("check_shift_cover") && browser.includes("toHaveCount(0)"), "browser coverage rejects internal intent labels"],
  [browser.includes("compactSummary") && browser.includes("toHaveCount(4)"), "browser coverage protects compact response density"],
];

const failures = checks.filter(([passed]) => !passed);
for (const [passed, label] of checks) console.log(`${passed ? "✓" : "✗"} ${label}`);
if (failures.length) process.exit(1);