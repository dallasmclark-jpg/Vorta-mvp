import { readFileSync, writeFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const write = (path, content) => writeFileSync(path, content, "utf8");

function replaceOnce(content, search, replacement, label) {
  const count = content.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  return content.replace(search, replacement);
}

const assistantPath = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
let assistant = read(assistantPath);
assistant = replaceOnce(
  assistant,
  '                className="h-8 shrink-0 gap-1 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"',
  '                data-vorta-global-ai-send="true"\n                aria-label="Send"\n                className="h-8 shrink-0 gap-1 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 max-md:h-10 max-md:w-10 max-md:gap-0 max-md:p-0 max-md:text-[0px]"',
  "Send button",
);
assistant = replaceOnce(
  assistant,
  '                <Send className="h-3 w-3" />\n                Send',
  '                <Send className="h-3 w-3 max-md:h-[1.125rem] max-md:w-[1.125rem]" aria-hidden="true" />\n                <span className="max-md:sr-only">Send</span>',
  "Send contents",
);
write(assistantPath, assistant);

const controlsPath = "src/screens/AiOperations/MobileAiComposerControls.tsx";
let controls = read(controlsPath);
controls = replaceOnce(
  controls,
  `const GENERAL_PANEL_SELECTOR =\n  '[data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"])';`,
  `const GENERAL_PANEL_SELECTOR = '[data-vorta-global-ai-panel="true"]';`,
  "general panel selector",
);
controls = replaceOnce(
  controls,
  '  const generalFooter = generalPanel?.querySelector<HTMLElement>(":scope > div.border-t") ?? null;\n  const generalRow = generalFooter?.querySelector<HTMLElement>(":scope > div.flex") ?? null;',
  '  const generalFooter = generalPanel?.querySelector<HTMLElement>(\n    \'[data-vorta-global-ai-composer="true"]\',\n  ) ?? null;\n  const generalRow = generalPanel?.querySelector<HTMLElement>(\n    \'[data-vorta-global-ai-composer-row="true"]\',\n  ) ?? null;',
  "composer selectors",
);
write(controlsPath, controls);

for (const path of [
  "src/screens/AiOperations/MobileAiPolishStyles.tsx",
  "src/screens/AiOperations/mobilePortalHardening.css",
]) {
  let content = read(path);
  content = content.replaceAll(
    '[data-vorta-global-ai-composer-row="true"] > button:not([aria-label])',
    '[data-vorta-global-ai-send="true"]',
  );
  content = content.replaceAll(
    '[data-vorta-global-ai-composer-row="true"] > button:last-child',
    '[data-vorta-global-ai-send="true"]',
  );
  write(path, content);
}

const contractPath = "scripts/mobile-portal-final-polish-contracts.mjs";
let contract = read(contractPath);
contract = replaceOnce(
  contract,
  'const mobileAiPolish = read("src/screens/AiOperations/MobileAiPolishStyles.tsx");',
  'const mobileAiPolish = read("src/screens/AiOperations/MobileAiPolishStyles.tsx");\nconst mobileAiControls = read("src/screens/AiOperations/MobileAiComposerControls.tsx");',
  "contract input",
);
contract = replaceOnce(
  contract,
  'assert.match(globalAssistant, /data-vorta-global-ai-input="true"/);',
  'assert.match(globalAssistant, /data-vorta-global-ai-input="true"/);\nassert.match(globalAssistant, /data-vorta-global-ai-send="true"/);\nassert.match(globalAssistant, /max-md:text-\\[0px\\]/);',
  "assistant contract",
);
contract = replaceOnce(
  contract,
  'assert.match(mobileAiPolish, /data-vorta-global-ai-composer-row/);',
  'assert.match(mobileAiPolish, /data-vorta-global-ai-composer-row/);\nassert.match(mobileAiPolish, /data-vorta-global-ai-send/);\nassert.doesNotMatch(mobileAiPolish, /button:has\\(svg\\.lucide-send\\)|button:not\\(\\[aria-label\\]\\)/);\nassert.match(mobileAiControls, /GENERAL_PANEL_SELECTOR = \'\\[data-vorta-global-ai-panel="true"\\]\'/);\nassert.match(mobileAiControls, /data-vorta-global-ai-composer="true"/);\nassert.doesNotMatch(mobileAiControls, /Close global assistant.*:has/s);\nassert.doesNotMatch(mobileHardening, /global-ai-composer-row[^\\n]*button:last-child/);',
  "semantic composer contract",
);
write(contractPath, contract);

console.log("VOR-022 final semantic Send and composer hooks applied.");
