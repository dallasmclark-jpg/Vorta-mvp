import { readFileSync, writeFileSync } from "node:fs";

function scanClosingDelimiter(source, openingIndex, opening, closing) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === opening) depth += 1;
    if (character === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  throw new Error(`A closing ${closing} could not be found.`);
}

function findClosingBrace(source, braceStart) {
  return scanClosingDelimiter(source, braceStart, "{", "}");
}

function findFunctionBody(source, name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  if (start === undefined) throw new Error(`Function ${name} was not found.`);

  const parameterStart = source.indexOf("(", start);
  if (parameterStart < 0) throw new Error(`Function ${name} has no parameters.`);
  const parameterEnd = scanClosingDelimiter(source, parameterStart, "(", ")");
  const braceStart = source.indexOf("{", parameterEnd + 1);
  if (braceStart < 0) throw new Error(`Function ${name} has no body.`);

  return { braceStart, braceEnd: findClosingBrace(source, braceStart) };
}

function findConstArrowRange(source, name) {
  const marker = `const ${name} =`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Arrow function ${name} was not found.`);

  const arrow = source.indexOf("=>", start);
  if (arrow < 0) throw new Error(`Arrow function ${name} has no arrow.`);
  const braceStart = source.indexOf("{", arrow);
  if (braceStart < 0) throw new Error(`Arrow function ${name} has no body.`);
  const braceEnd = findClosingBrace(source, braceStart);
  const semicolon = source.indexOf(";", braceEnd);

  return {
    start,
    end: semicolon >= 0 ? semicolon + 1 : braceEnd + 1,
  };
}

function patchAgentService() {
  const path = "src/screens/AiOperations/vortaAgentService.ts";
  let source = readFileSync(path, "utf8");
  if (source.includes("Controlled Ask Vorta actions require the review dialog")) {
    console.log("VOR-047 legacy direct draft writer is already disabled.");
    return;
  }

  const range = findFunctionBody(source, "createAskVortaActionDraft");
  source =
    source.slice(0, range.braceStart + 1) +
    `
  throw new Error(
    "Controlled Ask Vorta actions require the review dialog and explicit server confirmation.",
  );
` +
    source.slice(range.braceEnd);

  writeFileSync(path, source);
  console.log("Disabled the legacy direct Ask Vorta draft writer.");
}

function patchAssistant() {
  const path = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
  let source = readFileSync(path, "utf8");

  source = source.replace(/^\s*createAskVortaActionDraft,\s*\n/m, "");

  const serviceImportEnd = '} from "./vortaAgentService";';
  const launcherImport =
    'import { openAskVortaActionReviewDialog } from "./askVortaActionReviewLauncher";';
  if (!source.includes(launcherImport)) {
    if (!source.includes(serviceImportEnd)) {
      throw new Error("VOR-047 could not locate the Ask Vorta service import.");
    }
    source = source.replace(
      serviceImportEnd,
      `${serviceImportEnd}\n${launcherImport}`,
    );
  }

  if (!source.includes("VOR-047 controlled handover review")) {
    const range = findConstArrowRange(source, "prepareDraft");
    const replacement = `const prepareDraft = async (
    item: VortaAgentAction,
    index: number,
  ): Promise<void> => {
    if (!siteContext?.siteId || !answer.responseId || draftedActions.has(index)) return;
    setWorkflowMessage(null);
    setDraftedActions((current) => {
      const next = new Set(current);
      next.delete(index);
      return next;
    });
    openAskVortaActionReviewDialog({
      siteId: siteContext.siteId,
      responseId: answer.responseId,
      action: item,
      evidence: answer.evidence,
      sources: answer.sources,
    });
    setWorkflowMessage("Review the exact Vorta shift-handover action before confirmation.");
    // VOR-047 controlled handover review: SAP and SAP-equivalent records remain read-only.
  };`;

    source = source.slice(0, range.start) + replacement + source.slice(range.end);
  }

  writeFileSync(path, source);
  console.log("Integrated the VOR-047 handover-only review workflow.");
}

patchAgentService();
patchAssistant();
