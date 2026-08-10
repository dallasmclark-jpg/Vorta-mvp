import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const path = "src/screens/AiOperations/mobilePortalHardening.css";
let css = readFileSync(path, "utf8");

const before = `  /* Keep the mobile landing clean while surfacing three useful prompt chips above the composer. */
  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) {
    order: 3;
    display: block !important;
    padding: 0.35rem 0.75rem 0.25rem !important;
    border-bottom: 0 !important;
    background: rgb(11 14 20) !important;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2):has(+ [data-vorta-global-ai-messages="true"] > div:nth-child(2)) {
    display: none !important;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.mb-2 {
    display: flex !important;
    gap: 0.5rem !important;
    margin: 0 !important;
    overflow-x: auto;
    padding-bottom: 0.15rem;
    scrollbar-width: none;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.mb-2::-webkit-scrollbar {
    display: none;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.mb-2 > button {
    min-height: 2rem;
    flex: 0 0 auto;
    padding: 0.35rem 0.65rem !important;
    white-space: nowrap;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.mb-2 > button:nth-child(n+4) {
    display: none !important;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2) > div.text-xs {
    display: none !important;
  }

  [data-vorta-global-ai-panel="true"] > div:has(> div.mb-2):has(button:not([title])) > div.text-xs {
    display: block !important;
    margin-top: 0.5rem;
  }
`;

const after = `  /* Surface three existing quick-question buttons without duplicating their component styling. */
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

assert.equal(css.split(before).length - 1, 1, "Expected one mobile prompt CSS block");
css = css.replace(before, after);
writeFileSync(path, css);
console.log(`Trimmed Ask Vorta mobile CSS by ${before.length - after.length} source bytes.`);