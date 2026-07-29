import { readFileSync, writeFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function write(path, content) {
  writeFileSync(path, content, "utf8");
}

const assistantPath = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
let assistant = read(assistantPath);
const phoneVariants = assistant.match(/max-sm:/g) ?? [];
if (phoneVariants.length === 0) {
  throw new Error("VOR-022 expected generated max-sm assistant variants");
}
assistant = assistant.replaceAll("max-sm:", "max-md:");
if (assistant.includes("max-sm:")) {
  throw new Error("VOR-022 assistant still contains the wrong phone breakpoint");
}
write(assistantPath, assistant);

const cssPath = "src/screens/AiOperations/mobilePortalFinalPolish.css";
let css = read(cssPath);
css = css.replace(
  '[data-vorta-mobile-page-title="true"] {',
  '[data-vorta-maintenance-portal="true"] [data-vorta-mobile-page-title="true"] {',
);
if (!css.includes('[data-vorta-maintenance-portal="true"] [data-vorta-mobile-page-title="true"]')) {
  throw new Error("VOR-022 mobile title rule was not scoped to the Maintenance portal");
}
write(cssPath, css);

const contractPath = "scripts/mobile-portal-final-polish-contracts.mjs";
let contract = read(contractPath);
contract = contract.replace(/max-sm:h-\\\[100dvh\\\]/g, "max-md:h-\\[100dvh\\]");
contract = contract.replace(
  "assert.match(polish, /data-vorta-mobile-page-title/);",
  'assert.match(polish, /data-vorta-maintenance-portal/);\nassert.match(polish, /data-vorta-mobile-page-title/);',
);
contract = contract.replace(
  "assert.match(globalAssistant, /max-sm:hidden/);",
  "assert.match(globalAssistant, /max-md:hidden/);\nassert.doesNotMatch(globalAssistant, /max-sm:/);",
);
write(contractPath, contract);

console.log(`Finalised VOR-022 with ${phoneVariants.length} sub-768px assistant variants.`);
