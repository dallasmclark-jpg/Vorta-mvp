import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const assistantPath = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
let assistant = readFileSync(assistantPath, "utf8");

const oldPrompt = `          <div
            data-vorta-global-ai-prompts="true"
            className={\`border-b border-gray-800 px-4 py-3 \${hasActiveConversation ? "md:hidden" : ""}\`}
          >
            <div className="mb-2 flex flex-wrap gap-1.5">
              {roleProfile.quickQuestions.map((question) => (`;
const newPrompt = `          <div
            data-vorta-global-ai-prompts="true"
            className={\`border-b border-gray-800 px-4 py-3 max-md:order-3 max-md:block max-md:px-3 max-md:py-1.5 \${
              hasActiveConversation ? "hidden" : ""
            }\`}
          >
            <div className="mb-2 flex flex-wrap gap-1.5 max-md:mb-0 max-md:flex-nowrap max-md:overflow-x-auto">
              {roleProfile.quickQuestions.map((question, questionIndex) => (`;
assert.equal(assistant.split(oldPrompt).length - 1, 1, "Expected one prompt wrapper");
assistant = assistant.replace(oldPrompt, newPrompt);

const oldButtonClass = `                  className="rounded-full border border-gray-700 bg-[#0f1218] px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-700 disabled:hover:text-slate-400"`;
const newButtonClass = `                  className={\`rounded-full border border-gray-700 bg-[#0f1218] px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-700 disabled:hover:text-slate-400 max-md:shrink-0 max-md:whitespace-nowrap \${
                    questionIndex >= 3 ? "max-md:hidden" : ""
                  }\`}`;
assert.equal(assistant.split(oldButtonClass).length - 1, 1, "Expected one quick-question button class");
assistant = assistant.replace(oldButtonClass, newButtonClass);

const oldContext = `            <div
              className="text-xs"
              aria-live="polite"
            >`;
const newContext = `            <div
              className="text-xs max-md:hidden"
              aria-live="polite"
            >`;
assert.equal(assistant.split(oldContext).length - 1, 1, "Expected one compact context block");
assistant = assistant.replace(oldContext, newContext);
writeFileSync(assistantPath, assistant);

const cssPath = "src/screens/AiOperations/mobilePortalHardening.css";
let css = readFileSync(cssPath, "utf8");
const promptCss = `  /* Surface three existing quick-question buttons without duplicating their component styling. */
  [data-vorta-global-ai-prompts] {
    order: 3;
    display: block !important;
    padding: 0.35rem 0.75rem !important;
  }

  [data-vorta-global-ai-prompts]:has(+ [data-vorta-global-ai-messages="true"] > div:nth-child(2)) {
    display: none !important;
  }

  [data-vorta-global-ai-prompts] > div.mb-2 {
    flex-wrap: nowrap !important;
    margin: 0 !important;
    overflow-x: auto;
  }

  [data-vorta-global-ai-prompts] > div.mb-2 > button {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  [data-vorta-global-ai-prompts] > div.mb-2 > button:nth-child(n+4),
  [data-vorta-global-ai-prompts] > div.text-xs {
    display: none !important;
  }

`;
assert.equal(css.split(promptCss).length - 1, 1, "Expected one prompt CSS block");
css = css.replace(promptCss, "");
writeFileSync(cssPath, css);

const contractPath = "scripts/vor-041-ask-vorta-workspace-contracts.mjs";
let contract = readFileSync(contractPath, "utf8");
const oldRules = `for (const rule of [
  "height: 100dvh !important",
  'content: "What can I help with?"',
  "font-size: 0 !important",
  '[data-vorta-global-ai-composer-row="true"]',
  "button:nth-child(n+4)",
  "order: 3",
]) {`;
const newRules = `for (const rule of [
  "height: 100dvh !important",
  'content: "What can I help with?"',
  "font-size: 0 !important",
  '[data-vorta-global-ai-composer-row="true"]',
]) {`;
assert.equal(contract.split(oldRules).length - 1, 1, "Expected one mobile rule list");
contract = contract.replace(oldRules, newRules);

const anchor = `assert.match(
  assistant,
  /hasActiveConversation \\? "md:hidden" : ""/,
  "Quick prompts and verbose context must collapse only on non-mobile layouts after a conversation starts.",
);`;
const replacement = `assert.match(
  assistant,
  /data-vorta-global-ai-prompts="true"[\\s\\S]*max-md:order-3[\\s\\S]*hasActiveConversation \\? "hidden" : ""/,
  "Quick prompts must sit above the phone composer and disappear after the first question.",
);
assert.match(
  assistant,
  /quickQuestions\\.map\\(\\(question, questionIndex\\)[\\s\\S]*questionIndex >= 3 \\? "max-md:hidden"/,
  "Phone Ask Vorta must show the first three suggested prompts only.",
);
assert.match(
  assistant,
  /className="text-xs max-md:hidden"[\\s\\S]*aria-live="polite"/,
  "Verbose verified-context copy stays out of the phone landing view.",
);`;
assert.equal(contract.split(anchor).length - 1, 1, "Expected one old quick-prompt contract");
contract = contract.replace(anchor, replacement);
writeFileSync(contractPath, contract);

console.log("Moved Ask Vorta phone prompt layout out of custom CSS and into the existing component.");