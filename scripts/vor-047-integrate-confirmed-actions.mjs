import { readFileSync, writeFileSync } from "node:fs";

function findFunctionBody(source, name) {
  const marker = `function ${name}(`;
  const asyncMarker = `async function ${name}(`;
  const start = source.indexOf(marker) >= 0
    ? source.indexOf(marker)
    : source.indexOf(asyncMarker);
  if (start < 0) throw new Error(`Function ${name} was not found.`);
  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) throw new Error(`Function ${name} has no body.`);
  const braceEnd = findClosingBrace(source, braceStart);
  return { start, braceStart, braceEnd };
}

function findClosingBrace(source, braceStart) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = braceStart; index < source.length; index += 1) {
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
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error("A closing brace could not be found.");
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
    console.log("VOR-047 legacy action draft writer is already disabled.");
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
  if (source.includes("openAskVortaActionReviewDialog")) {
    console.log("VOR-047 controlled action review is already integrated.");
    return;
  }

  source = source.replace(
    /^\s*createAskVortaActionDraft,\s*\n/m,
    "",
  );
  const serviceImportEnd = '} from "./vortaAgentService";';
  if (!source.includes(serviceImportEnd)) {
    throw new Error("VOR-047 could not locate the Ask Vorta service import.");
  }
  source = source.replace(
    serviceImportEnd,
    `${serviceImportEnd}\nimport { openAskVortaActionReviewDialog } from "./askVortaActionReviewLauncher";`,
  );

  const range = findConstArrowRange(source, "prepareActionDraft");
  const replacement = `const prepareActionDraft = async (
    action: VortaAgentAction,
    answer: GlobalAiAnswer,
  ): Promise<void> => {
    if (!siteContext?.siteId || !answer.responseId) return;
    openAskVortaActionReviewDialog({
      siteId: siteContext.siteId,
      responseId: answer.responseId,
      action,
      conversationContext: answer.conversationContext,
      evidence: answer.evidence,
      sources: answer.sources,
    });
  };`;
  source = source.slice(0, range.start) + replacement + source.slice(range.end);

  const callPattern = /prepareActionDraft\(\s*action\s*,\s*answer\.responseId\s*\)/g;
  const callCount = (source.match(callPattern) ?? []).length;
  if (callCount < 1) {
    throw new Error("VOR-047 could not locate the action review button call.");
  }
  source = source.replace(callPattern, "prepareActionDraft(action, answer)");
  source = source.replace(/Prepare action draft/g, "Review controlled action");
  source = source.replace(/Prepare draft/g, "Review controlled action");

  writeFileSync(path, source);
  console.log(`Integrated VOR-047 controlled action review at ${callCount} action button call(s).`);
}

patchAgentService();
patchAssistant();
