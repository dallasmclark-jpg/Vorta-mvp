import { existsSync, readFileSync, writeFileSync } from "node:fs";

const path = "netlify/functions/ask-vorta.mts";
let source = readFileSync(path, "utf8");
let changed = false;

const modularEntrypoint = 'export { default, config } from "./ask-vorta/runtime.mjs";';
if (source.includes(modularEntrypoint)) {
  const contractsPath = "netlify/functions/ask-vorta/contracts.mts";
  const requestContextPath = "netlify/functions/ask-vorta/request-context.mts";
  const routePlanningPath = "netlify/functions/ask-vorta/route-planning.mts";
  for (const modulePath of [contractsPath, requestContextPath, routePlanningPath]) {
    if (!existsSync(modulePath)) {
      throw new Error(`VOR-045 modular Ask Vorta source is missing ${modulePath}.`);
    }
  }

  const contracts = readFileSync(contractsPath, "utf8");
  const requestContext = readFileSync(requestContextPath, "utf8");
  const routePlanning = readFileSync(routePlanningPath, "utf8");
  const requiredMarkers = [
    [contracts, "interface PageContext {", contractsPath],
    [contracts, "pageContext: PageContext;", contractsPath],
    [requestContext, "function equipmentReferenceFromQuestion(", requestContextPath],
    [routePlanning, '{ role: "user", content: request.question.trim() },', routePlanningPath],
  ];
  for (const [moduleSource, marker, modulePath] of requiredMarkers) {
    if (!moduleSource.includes(marker)) {
      throw new Error(`VOR-045 modular Ask Vorta source is missing ${marker} in ${modulePath}.`);
    }
  }

  console.log("VOR-045 Ask Vorta request, equipment reference and planner context shapes are already normalised in focused modules.");
  process.exit(0);
}

const requestMarker = "interface AskVortaRequest {\n";
const inlinePageContext = [
  "  pageContext: {",
  "    path: string;",
  "    timezone: string;",
  "  };",
].join("\n");

if (!source.includes("interface PageContext {") || !source.includes("  pageContext: PageContext;")) {
  if (!source.includes(requestMarker)) {
    throw new Error("VOR-045 could not locate the AskVortaRequest interface.");
  }
  if (!source.includes(inlinePageContext)) {
    throw new Error("VOR-045 could not locate the inline pageContext type.");
  }

  source = source.replace(
    requestMarker,
    [
      "interface PageContext {",
      "  path: string;",
      "  timezone: string;",
      "}",
      "",
      requestMarker.trimEnd(),
    ].join("\n") + "\n",
  );
  source = source.replace(inlinePageContext, "  pageContext: PageContext;");
  changed = true;
}

if (!source.includes("function equipmentReferenceFromQuestion(")) {
  const insertionMarker = "interface ToolResult {\n";
  if (!source.includes(insertionMarker)) {
    throw new Error("VOR-045 could not locate the ToolResult interface insertion point.");
  }
  source = source.replace(
    insertionMarker,
    [
      "function equipmentReferenceFromQuestion(question: string): string {",
      "  const explicitCode = question.match(/\\b[A-Z]{2,8}-\\d{1,6}\\b/i)?.[0];",
      "  return explicitCode ? explicitCode.toUpperCase() : \"\";",
      "}",
      "",
      insertionMarker.trimEnd(),
    ].join("\n") + "\n",
  );
  changed = true;
}

const plannerStart = source.indexOf("async function buildQuestionPlan(");
const plannerEnd = source.indexOf("\nfunction systemInstructions(", plannerStart);
if (plannerStart < 0 || plannerEnd < 0) {
  throw new Error("VOR-045 could not locate the semantic planner function.");
}
const plannerBlock = source.slice(plannerStart, plannerEnd);
const originalPlannerInput = '{ role: "user", content: request.question },';
const normalisedPlannerInput = '{ role: "user", content: request.question.trim() },';
if (!plannerBlock.includes(normalisedPlannerInput)) {
  const matchCount = plannerBlock.split(originalPlannerInput).length - 1;
  if (matchCount !== 1) {
    throw new Error(`VOR-045 expected one planner input line, found ${matchCount}.`);
  }
  source =
    source.slice(0, plannerStart) +
    plannerBlock.replace(originalPlannerInput, normalisedPlannerInput) +
    source.slice(plannerEnd);
  changed = true;
}

if (changed) {
  writeFileSync(path, source);
  console.log("Normalised VOR-045 Ask Vorta request, equipment reference and planner context shapes.");
} else {
  console.log("VOR-045 Ask Vorta request, equipment reference and planner context shapes are already normalised.");
}