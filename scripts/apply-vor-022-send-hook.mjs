import { readFileSync, writeFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function write(path, content) {
  writeFileSync(path, content, "utf8");
}

function replaceOnce(content, search, replacement, label) {
  const occurrences = content.split(search).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label}: expected one match, found ${occurrences}`);
  }
  return content.replace(search, replacement);
}

const assistantPath = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
let assistant = read(assistantPath);
assistant = replaceOnce(
  assistant,
  '                className="h-8 shrink-0 gap-1 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"',
  '                data-vorta-global-ai-send="true"\n                aria-label="Send"\n                className="h-8 shrink-0 gap-1 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 max-md:h-10 max-md:w-10 max-md:gap-0 max-md:p-0 max-md:text-[0px]"',
  "global assistant send button",
);
assistant = replaceOnce(
  assistant,
  '                <Send className="h-3 w-3" />\n                Send',
  '                <Send className="h-3 w-3 max-md:h-[1.125rem] max-md:w-[1.125rem]" aria-hidden="true" />\n                <span className="max-md:sr-only">Send</span>',
  "global assistant send content",
);
write(assistantPath, assistant);

const controlsPath = "src/screens/AiOperations/MobileAiComposerControls.tsx";
let controls = read(controlsPath);
controls = replaceOnce(
  controls,
  `const GENERAL_PANEL_SELECTOR =\n  '[data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"])';`,
  `const GENERAL_PANEL_SELECTOR = '[data-vorta-global-ai-panel="true"]';`,
  "general assistant panel selector",
);
controls = replaceOnce(
  controls,
  '  const generalFooter = generalPanel?.querySelector<HTMLElement>(":scope > div.border-t") ?? null;\n  const generalRow = generalFooter?.querySelector<HTMLElement>(":scope > div.flex") ?? null;',
  '  const generalFooter = generalPanel?.querySelector<HTMLElement>(\n    \'[data-vorta-global-ai-composer="true"]\',\n  ) ?? null;\n  const generalRow = generalPanel?.querySelector<HTMLElement>(\n    \'[data-vorta-global-ai-composer-row="true"]\',\n  ) ?? null;',
  "general assistant composer selectors",
);
write(controlsPath, controls);

const polishPath = "src/screens/AiOperations/MobileAiPolishStyles.tsx";
let polish = read(polishPath);
polish = polish.replaceAll(
  '[data-vorta-global-ai-composer-row="true"] > button:has(svg.lucide-send)',
  '[data-vorta-global-ai-send="true"]',
);
if (polish.includes('button:has(svg.lucide-send)')) {
  throw new Error("send icon :has selector remains in MobileAiPolishStyles");
}
write(polishPath, polish);

const hardeningPath = "src/screens/AiOperations/mobilePortalHardening.css";
let hardening = read(hardeningPath);
hardening = hardening.replaceAll(
  '[data-vorta-global-ai-composer-row="true"] > button:last-child',
  '[data-vorta-global-ai-send="true"]',
);
if (hardening.includes('[data-vorta-global-ai-composer-row="true"] > button:last-child')) {
  throw new Error("last-child send selector remains in mobilePortalHardening.css");
}
write(hardeningPath, hardening);

const contractPath = "scripts/mobile-portal-final-polish-contracts.mjs";
let contract = read(contractPath);
contract = replaceOnce(
  contract,
  'const portalShell = read("src/components/PortalShell.tsx");',
  'const portalShell = read("src/components/PortalShell.tsx");\nconst globalAssistant = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");\nconst mobileAiPolish = read("src/screens/AiOperations/MobileAiPolishStyles.tsx");\nconst mobileAiControls = read("src/screens/AiOperations/MobileAiComposerControls.tsx");\nconst mobileHardening = read("src/screens/AiOperations/mobilePortalHardening.css");',
  "responsive contract imports",
);
contract = replaceOnce(
  contract,
  'assert.match(portalShell, /data-vorta-mobile-navigation-drawer/);',
  'assert.match(portalShell, /data-vorta-mobile-navigation-drawer/);\nassert.match(globalAssistant, /data-vorta-global-ai-send="true"/);\nassert.match(globalAssistant, /max-md:text-\\[0px\\]/);\nassert.match(mobileAiPolish, /data-vorta-global-ai-send/);\nassert.doesNotMatch(mobileAiPolish, /button:has\\(svg\\.lucide-send\\)/);\nassert.match(mobileAiControls, /GENERAL_PANEL_SELECTOR = \'\\[data-vorta-global-ai-panel="true"\\]\'/);\nassert.doesNotMatch(mobileAiControls, /Close global assistant.*:has/s);\nassert.doesNotMatch(mobileHardening, /global-ai-composer-row[^\\n]*button:last-child/);',
  "semantic send contracts",
);
write(contractPath, contract);

console.log("VOR-022 semantic Ask Vorta send hook applied. Triggered from an established workflow definition.");
