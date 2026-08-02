import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`VOR-042 patch anchor missing: ${label}`);
  if (source.indexOf(search, index + search.length) >= 0) {
    throw new Error(`VOR-042 patch anchor is not unique: ${label}`);
  }
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function patchWorkspace() {
  const path = "src/screens/AiOperations/AskVortaWorkspace.tsx";
  let source = readFileSync(path, "utf8");

  if (!source.includes("visibleConversationMessages")) {
    source = replaceOnce(
      source,
      `  const hasUserQuestion = messages.some(\n    (message) => message.role === \"user\" && message.text?.trim(),\n  );`,
      `  const hasUserQuestion = messages.some(\n    (message) => message.role === \"user\" && message.text?.trim(),\n  );\n  const visibleConversationMessages = hasUserQuestion\n    ? messages.filter(\n        (message, index) =>\n          !(\n            index === 0 &&\n            message.role === \"assistant\" &&\n            Boolean(message.answer)\n          ),\n      )\n    : messages;`,
      "workspace active-conversation visibility",
    );
  }

  source = source.replace(
    "{messages.map((message) => (",
    "{visibleConversationMessages.map((message) => (",
  );

  source = replaceOnce(
    source,
    `<span className=\"max-w-sm truncate\">{contextLine}</span>`,
    `<span className=\"max-w-sm truncate\">\n                {contextReady ? \"Live evidence loaded\" : contextLine}\n              </span>`,
    "workspace evidence status",
  );

  writeFileSync(path, source);
}

function patchAssistant() {
  const path = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
  let source = readFileSync(path, "utf8");

  if (!source.includes('presentation?: "compact" | "workspace"')) {
    source = replaceOnce(
      source,
      `function AnswerBlock({\n  answer,\n  onFollowUp,\n}: {\n  answer: GlobalAiAnswer;\n  onFollowUp: (question: string) => void;\n}) {`,
      `function AnswerBlock({\n  answer,\n  onFollowUp,\n  presentation = \"compact\",\n}: {\n  answer: GlobalAiAnswer;\n  onFollowUp: (question: string) => void;\n  presentation?: \"compact\" | \"workspace\";\n}) {`,
      "AnswerBlock presentation prop",
    );
  }

  if (!source.includes("wideCompactPresentation")) {
    source = replaceOnce(
      source,
      `  const hasStructuredFindings = Boolean(answer.findings?.length);\n  const hasStructuredActions = Boolean(answer.actionPlan?.length);`,
      `  const hasStructuredFindings = Boolean(answer.findings?.length);\n  const hasStructuredActions = Boolean(answer.actionPlan?.length);\n  const workspacePresentation = presentation === \"workspace\";\n  const wideCompactPresentation =\n    !workspacePresentation &&\n    typeof window !== \"undefined\" &&\n    window.matchMedia(\"(min-width: 769px)\").matches;\n  const decisionSummaryLimit = wideCompactPresentation ? 4 : 7;`,
      "AnswerBlock presentation flags",
    );
  }

  source = replaceOnce(
    source,
    `      <div className=\"flex flex-wrap items-center gap-1.5\">\n        <Badge className=\"h-auto rounded bg-blue-500/15 px-1.5 py-0 text-xs font-bold text-blue-300 shadow-none\">\n          {answer.responseBadge}\n        </Badge>\n        <Badge className=\"h-auto rounded bg-gray-800 px-1.5 py-0 text-xs font-medium text-slate-400 shadow-none\">\n          {answer.roleLabel}\n        </Badge>\n        <Badge className=\"h-auto rounded bg-gray-800/80 px-1.5 py-0 text-xs font-medium text-slate-500 shadow-none\">\n          {answer.intentLabel}\n        </Badge>\n      </div>\n\n      <p className=\"text-base leading-7 text-slate-200 sm:text-sm sm:leading-6\">`,
    `      {!workspacePresentation && (\n        <div className=\"flex flex-wrap items-center gap-1.5\">\n          <Badge className=\"h-auto rounded bg-blue-500/15 px-1.5 py-0 text-xs font-bold text-blue-300 shadow-none\">\n            {answer.responseBadge}\n          </Badge>\n          <Badge className=\"h-auto rounded bg-gray-800 px-1.5 py-0 text-xs font-medium text-slate-400 shadow-none\">\n            {answer.roleLabel}\n          </Badge>\n          {!wideCompactPresentation && (\n            <Badge className=\"h-auto rounded bg-gray-800/80 px-1.5 py-0 text-xs font-medium text-slate-500 shadow-none\">\n              {answer.intentLabel}\n            </Badge>\n          )}\n        </div>\n      )}\n\n      <p\n        className={\n          workspacePresentation\n            ? \"border-l-2 border-blue-400/70 pl-4 text-lg font-semibold leading-8 text-slate-100\"\n            : \"text-base leading-7 text-slate-200 sm:text-sm sm:leading-6\"\n        }\n      >`,
    "AnswerBlock response metadata and direct answer",
  );

  source = replaceOnce(
    source,
    "{answer.decisionSummary.slice(0, 7).map((item, index) => (",
    "{answer.decisionSummary.slice(0, decisionSummaryLimit).map((item, index) => (",
    "decision summary density",
  );

  source = replaceOnce(
    source,
    `          <AnswerBlock\n            answer={answer as GlobalAiAnswer}\n            onFollowUp={submitQuestion}\n          />`,
    `          <AnswerBlock\n            answer={answer as GlobalAiAnswer}\n            onFollowUp={submitQuestion}\n            presentation=\"workspace\"\n          />`,
    "workspace AnswerBlock presentation",
  );

  if (!source.includes("messageIndex === 0")) {
    source = replaceOnce(
      source,
      `{messages.map((message) => (\n              <div\n                key={message.id}\n                className={\`flex \${message.role === \"user\" ? \"justify-end\" : \"justify-start\"}\`}\n              >`,
      `{messages.map((message, messageIndex) => (\n              <div\n                key={message.id}\n                className={\`flex \${message.role === \"user\" ? \"justify-end\" : \"justify-start\"} \${\n                  hasActiveConversation && messageIndex === 0 ? \"md:hidden\" : \"\"\n                }\`}\n              >`,
      "compact introduction visibility",
    );
  }

  writeFileSync(path, source);
}

function patchBrowserContract() {
  const path = "tests/browser/vor-041-ask-vorta-workspace.spec.ts";
  let source = readFileSync(path, "utf8");

  source = source.replace(
    'intentLabel: "Shift cover decision",',
    'intentLabel: "check_shift_cover",',
  );

  if (!source.includes('label: "Scheduled"')) {
    source = replaceOnce(
      source,
      `    {\n      label: \"First action\",\n      value: \"Confirm the proposed cover package before releasing planned work.\",\n    },`,
      `    {\n      label: \"First action\",\n      value: \"Confirm the proposed cover package before releasing planned work.\",\n    },\n    { label: \"Scheduled\", value: \"Four engineers are currently rostered.\" },\n    { label: \"Absence\", value: \"No recorded absence is visible.\" },\n    { label: \"Best provisional cover\", value: \"Oliver Clarke and Laura Davies.\" },\n    { label: \"Calculated impact\", value: \"Closes the highest-priority gap.\" },\n    { label: \"Residual risk\", value: \"Approval and rest compliance remain open.\" },`,
      "browser decision summary fixtures",
    );
  }

  if (!source.includes("Live evidence loaded")) {
    source = replaceOnce(
      source,
      `    await expect(workspace.getByText(mockedAnswer.directAnswer)).toBeVisible();`,
      `    await expect(workspace.getByText(mockedAnswer.directAnswer)).toBeVisible();\n    await expect(workspace.getByText(\"Live evidence loaded\", { exact: true })).toBeVisible();\n    await expect(workspace.getByText(\"check_shift_cover\", { exact: true })).toHaveCount(0);\n    await expect(workspace.getByText(\"Strategic maintenance response\", { exact: true })).toHaveCount(0);\n    await expect(workspace.getByText(\"Maintenance Manager\", { exact: true })).toHaveCount(0);\n    await expect(\n      workspace.getByText(\"I can answer Maintenance Manager questions\", { exact: false }),\n    ).toHaveCount(0);`,
      "workspace hierarchy assertions",
    );
  }

  if (!source.includes("compactSummary")) {
    source = replaceOnce(
      source,
      `    await expect(panel.getByText(mockedAnswer.directAnswer)).toBeVisible();`,
      `    await expect(panel.getByText(mockedAnswer.directAnswer)).toBeVisible();\n    const compactSummary = panel.locator(\n      'section[aria-labelledby=\"ask-vorta-decision-summary\"]',\n    );\n    await expect(compactSummary.locator(\"li\")).toHaveCount(4);`,
      "compact density assertion",
    );
  }

  writeFileSync(path, source);
}

function addContract() {
  const contractPath = "scripts/vor-042-ask-vorta-polish-contracts.mjs";
  const contract = [
    'import { readFileSync } from "node:fs";',
    "",
    'const workspace = readFileSync("src/screens/AiOperations/AskVortaWorkspace.tsx", "utf8");',
    'const assistant = readFileSync("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx", "utf8");',
    'const browser = readFileSync("tests/browser/vor-041-ask-vorta-workspace.spec.ts", "utf8");',
    "",
    "const checks = [",
    '  [workspace.includes("visibleConversationMessages"), "active workspace conversation hides its introductory card"],',
    '  [workspace.includes("Live evidence loaded"), "workspace uses a compact evidence-status label"],',
    '  [assistant.includes(\'presentation?: "compact" | "workspace"\'), "AnswerBlock supports workspace presentation"],',
    '  [assistant.includes("wideCompactPresentation"), "compact density is limited only on non-mobile layouts"],',
    '  [assistant.includes("decisionSummaryLimit"), "decision summary density is explicitly bounded"],',
    '  [assistant.includes(\'presentation="workspace"\'), "workspace rendering opts into the clean hierarchy"],',
    '  [assistant.includes(\'messageIndex === 0 ? "md:hidden"\'), "compact introduction remains available on phone and hides on wider active conversations"],',
    '  [browser.includes("check_shift_cover") && browser.includes("toHaveCount(0)"), "browser coverage rejects internal intent labels"],',
    '  [browser.includes("compactSummary") && browser.includes("toHaveCount(4)"), "browser coverage protects compact response density"],',
    "];",
    "",
    "const failures = checks.filter(([passed]) => !passed);",
    'for (const [passed, label] of checks) console.log(`${passed ? "✓" : "✗"} ${label}`);',
    "if (failures.length) process.exit(1);",
    "",
  ].join("\n");
  writeFileSync(contractPath, contract);

  const runnerPath = "scripts/run-contract-suite.mjs";
  let runner = readFileSync(runnerPath, "utf8");
  if (!runner.includes("VOR-042 Ask Vorta response hierarchy")) {
    runner = replaceOnce(
      runner,
      `  [\"VOR-041 Ask Vorta workspace\", \"scripts/vor-041-ask-vorta-workspace-contracts.mjs\"],`,
      `  [\"VOR-041 Ask Vorta workspace\", \"scripts/vor-041-ask-vorta-workspace-contracts.mjs\"],\n  [\"VOR-042 Ask Vorta response hierarchy\", \"scripts/vor-042-ask-vorta-polish-contracts.mjs\"],`,
      "contract-suite registration",
    );
  }
  writeFileSync(runnerPath, runner);
}

patchWorkspace();
patchAssistant();
patchBrowserContract();
addContract();
console.log("VOR-042 Ask Vorta response hierarchy patch applied.");
