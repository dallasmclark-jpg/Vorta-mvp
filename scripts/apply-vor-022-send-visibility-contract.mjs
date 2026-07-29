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
  ' max-md:h-10 max-md:w-10 max-md:gap-0 max-md:p-0 max-md:text-[0px]"',
  ' max-md:h-10 max-md:w-10 max-md:gap-0 max-md:p-0"',
  "remove irrelevant parent font-size override",
);
write(assistantPath, assistant);

const browserPath = "tests/browser/maintenance-manager-mobile-routes.spec.ts";
let browser = read(browserPath);
browser = replaceOnce(
  browser,
  '  await expect(sendButton).toHaveCSS("font-size", "0px");',
  '  await expect(sendButton).toHaveAttribute("data-vorta-global-ai-send", "true");\n  await expect(sendButton).toHaveAccessibleName("Send");\n  await expect(sendButton.getByText("Send", { exact: true })).toHaveClass(/sr-only/);\n  await expect(sendButton.locator("svg")).toBeVisible();',
  "mobile Send browser assertion",
);
write(browserPath, browser);

const contractPath = "scripts/mobile-portal-final-polish-contracts.mjs";
let contract = read(contractPath);
contract = replaceOnce(
  contract,
  'assert.match(globalAssistant, /max-md:text-\\[0px\\]/);',
  'assert.match(globalAssistant, /<span className="max-md:sr-only">Send<\\/span>/);',
  "Send source contract",
);
write(contractPath, contract);

console.log("VOR-022 Send visibility and accessibility contracts updated.");
