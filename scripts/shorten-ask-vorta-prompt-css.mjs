import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const assistantPath = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
let assistant = readFileSync(assistantPath, "utf8");
const promptPanel = `          <div className={\`border-b border-gray-800 px-4 py-3 \${hasActiveConversation ? "md:hidden" : ""}\`}>
            <div className="mb-2 flex flex-wrap gap-1.5">`;
const promptPanelWithHook = `          <div
            data-vorta-global-ai-prompts="true"
            className={\`border-b border-gray-800 px-4 py-3 \${hasActiveConversation ? "md:hidden" : ""}\`}
          >
            <div className="mb-2 flex flex-wrap gap-1.5">`;
assert.equal(assistant.split(promptPanel).length - 1, 1, "Expected one compact Ask Vorta prompt panel");
assistant = assistant.replace(promptPanel, promptPanelWithHook);
writeFileSync(assistantPath, assistant);

const cssPath = "src/screens/AiOperations/mobilePortalHardening.css";
let css = readFileSync(cssPath, "utf8");
const oldCss = `  /* Surface three existing quick-question buttons without duplicating their component styling. */
  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) {
    order: 3;
    display: block !important;
    padding: 0.35rem 0.75rem !important;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2):has(+ [data-vorta-global-ai-messages="true"] > div:nth-child(2)) {
    display: none !important;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.mb-2 {
    flex-wrap: nowrap !important;
    margin: 0 !important;
    overflow-x: auto;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.mb-2 > button {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.mb-2 > button:nth-child(n+4),
  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.text-xs {
    display: none !important;
  }
`;
const newCss = `  /* Surface three existing quick-question buttons without duplicating their component styling. */
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
assert.equal(css.split(oldCss).length - 1, 1, "Expected one semantic prompt CSS candidate block");
css = css.replace(oldCss, newCss);
writeFileSync(cssPath, css);

console.log(`Shortened Ask Vorta prompt CSS by ${oldCss.length - newCss.length} source bytes.`);