import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const backendPath = resolve(repositoryRoot, "netlify/functions/ask-vorta.mts");
const liveEvalPath = resolve(repositoryRoot, "scripts/ask-vorta-live-evals.mjs");
const templatePath = (name) =>
  resolve(repositoryRoot, "scripts/templates", name);
const chainContractPaths = [
  resolve(repositoryRoot, "scripts/vor-044-operational-value-ranking-contracts.mjs"),
  resolve(repositoryRoot, "scripts/vor-045-conversation-context-contracts.mjs"),
  resolve(repositoryRoot, "scripts/vor-046-photo-ocr-contracts.mjs"),
];

const backendMarker = "function compactEquipmentDecisionPackForModel(";
const repairMarker = "function repairEquipmentDecisionAnswer(";
const evalMarker = "function visibleDecisionText(answer)";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`VOR-049 could not locate ${label}.`);
  }
  return source.replace(search, replacement);
}

function extendIntegrationChainContracts() {
  const existing =
    "(?: && node scripts\\/vor-048-integrate-routing-telemetry-feedback\\.mjs)?";
  const extended =
    `${existing}(?: && node scripts\\/vor-049-integrate-decision-ready-equipment\\.mjs)?`;
  for (const contractPath of chainContractPaths) {
    let contract = readFileSync(contractPath, "utf8");
    if (contract.includes("vor-049-integrate-decision-ready-equipment")) continue;
    if (!contract.includes(existing)) {
      throw new Error(
        `VOR-049 could not extend integration-chain contract ${contractPath}.`,
      );
    }
    contract = contract.replaceAll(existing, extended);
    writeFileSync(contractPath, contract);
  }
}

let backend = readFileSync(backendPath, "utf8");
let liveEval = readFileSync(liveEvalPath, "utf8");
const fullyApplied =
  backend.includes(backendMarker) &&
  backend.includes(repairMarker) &&
  liveEval.includes(evalMarker);
if (fullyApplied) {
  extendIntegrationChainContracts();
  console.log("VOR-049 decision-ready equipment integration is already applied.");
  process.exit(0);
}
if (
  backend.includes(backendMarker) ||
  backend.includes(repairMarker) ||
  liveEval.includes(evalMarker)
) {
  throw new Error(
    "VOR-049 integration is partially applied. Restore a clean source tree before rebuilding.",
  );
}

const oldTrimToolResult = [
  "function trimToolResult(result: ToolResult): string {",
  "  const serialised = JSON.stringify(result);",
  "  if (serialised.length <= MAX_TOOL_OUTPUT_CHARACTERS) return serialised;",
  "  return JSON.stringify({",
  "    source: result.source,",
  "    status: \"unavailable\",",
  "    message: \"The result was too large to analyse safely. Narrow the equipment or date range.\",",
  "  });",
  "}",
].join("\n");
const trimReplacement = readFileSync(
  templatePath("vor-049-trim-tool-result.txt"),
  "utf8",
).trimEnd();
backend = replaceOnce(
  backend,
  oldTrimToolResult,
  trimReplacement,
  "trimToolResult",
);

const domainSelection = readFileSync(
  templatePath("vor-049-domain-selection.txt"),
  "utf8",
);
backend = replaceOnce(
  backend,
  "function collectDecisionFacts(\n",
  `${domainSelection}function collectDecisionFacts(\n`,
  "decision-fact helper anchor",
);

const oldDomainNames = [
  "      const domainNames = [",
  "        \"get_equipment_work\",",
  "        \"get_equipment_calibrations\",",
  "        \"get_equipment_skills\",",
  "        \"get_equipment_spares\",",
  "        \"get_equipment_risk_actions\",",
  "        \"get_equipment_history\",",
  "        \"get_equipment_documents\",",
  "      ] as const;",
].join("\n");
backend = replaceOnce(
  backend,
  oldDomainNames,
  "      const domainNames = equipmentDecisionDomains(request.question);",
  "equipment decision-pack domain list",
);

const packDataAnchor = [
  "          coveredTools,",
  "          decisionFacts: equipmentDecisionFacts(selected, domains, request.question),",
  "          domains,",
].join("\n");
const packDataReplacement = [
  "          coveredTools,",
  "          includedDomains: domainNames,",
  "          omittedDomains: ALL_EQUIPMENT_DECISION_DOMAINS.filter(",
  "            (domain) => !domainNames.includes(domain),",
  "          ),",
  "          decisionFacts: equipmentDecisionFacts(selected, domains, request.question),",
  "          domains,",
].join("\n");
backend = replaceOnce(
  backend,
  packDataAnchor,
  packDataReplacement,
  "equipment decision-pack output",
);

const oldFactsReturn = [
  "  const questionRanked = relevantEquipmentDecisionFacts(",
  "    question,",
  "    [...explicitFacts, ...rankedFacts],",
  "  );",
  "  return [",
  "    ...new Set([",
  "      ...priorityFacts,",
  "      ...identity,",
  "      ...questionRanked,",
  "      ...explicitFacts.slice(0, 32),",
  "      ...rankedFacts.slice(0, 24),",
  "    ]),",
  "  ].slice(0, 64);",
].join("\n");
const newFactsReturn = [
  "  const questionRanked = relevantEquipmentDecisionFacts(",
  "    question,",
  "    [...explicitFacts, ...rankedFacts],",
  "  );",
  "  return [",
  "    ...new Set([",
  "      ...priorityFacts,",
  "      ...identity,",
  "      ...questionRanked,",
  "      ...explicitFacts,",
  "      ...rankedFacts,",
  "    ]),",
  "  ]",
  "    .slice(0, 24)",
  "    .map((fact) => fact.slice(0, 900));",
].join("\n");
backend = replaceOnce(
  backend,
  oldFactsReturn,
  newFactsReturn,
  "equipment decision-fact boundary",
);

const answerRepair = readFileSync(
  templatePath("vor-049-answer-repair.txt"),
  "utf8",
);
backend = replaceOnce(
  backend,
  "function retainEquipmentDecisionFacts(\n",
  `${answerRepair}function retainEquipmentDecisionFacts(\n`,
  "retainEquipmentDecisionFacts",
);

const deterministicRepairAnchor = [
  "    retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);",
  "    answer.confidence = evidenceAwareConfidence(answer, questionPlan, toolOutcomes);",
].join("\n");
const deterministicRepairReplacement = [
  "    retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);",
  "    repairEquipmentDecisionAnswer(answer, questionPlan, toolOutcomes);",
  "    answer.confidence = evidenceAwareConfidence(answer, questionPlan, toolOutcomes);",
].join("\n");
backend = replaceOnce(
  backend,
  deterministicRepairAnchor,
  deterministicRepairReplacement,
  "deterministic answer completion",
);

const semanticRepairAnchor = [
  "        retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);",
  "        enforceEquipmentReturnToServiceSafety(answer, questionPlan);",
].join("\n");
const semanticRepairReplacement = [
  "        retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);",
  "        repairEquipmentDecisionAnswer(answer, questionPlan, toolOutcomes);",
  "        enforceEquipmentReturnToServiceSafety(answer, questionPlan);",
].join("\n");
backend = replaceOnce(
  backend,
  semanticRepairAnchor,
  semanticRepairReplacement,
  "semantic answer completion",
);

const confidenceReturnAnchor = [
  "  const lowerBound = okResults.length > 0 ? (ambiguity ? 40 : 55) : 20;",
  "  return Math.max(lowerBound, Math.min(95, Math.round(score)));",
].join("\n");
const confidenceReturnReplacement = [
  "  const lowerBound = okResults.length > 0 ? (ambiguity ? 40 : 55) : 20;",
  "  const visibleDecisionUnavailable = unavailableEquipmentDecisionClaim(",
  "    equipmentVisibleDecisionText(answer),",
  "  );",
  "  const upperBound = visibleDecisionUnavailable ? 50 : 95;",
  "  return Math.max(",
  "    Math.min(lowerBound, upperBound),",
  "    Math.min(upperBound, Math.round(score)),",
  "  );",
].join("\n");
backend = replaceOnce(
  backend,
  confidenceReturnAnchor,
  confidenceReturnReplacement,
  "confidence calibration",
);
writeFileSync(backendPath, backend);

const visibleEvalHelpers = readFileSync(
  templatePath("vor-049-visible-eval-helpers.txt"),
  "utf8",
);
liveEval = replaceOnce(
  liveEval,
  "function answerText(answer) {\n",
  `${visibleEvalHelpers}function answerText(answer) {\n`,
  "live-evaluation answer text helper",
);

const evalTextAnchor = [
  "    const text = answerText(payload);",
  "    const usedTools = new Set(payload.toolsUsed || []);",
].join("\n");
const evalTextReplacement = [
  "    const text = answerText(payload);",
  "    const visibleText = visibleDecisionText(payload);",
  "    const requireVisibleDecision =",
  "      scenario.requireVisibleDecision === true ||",
  "      /vor-033-demo-golden\\.json$/.test(scenarioFile);",
  "    const assertionText = requireVisibleDecision ? visibleText : text;",
  "    const usedTools = new Set(payload.toolsUsed || []);",
].join("\n");
liveEval = replaceOnce(
  liveEval,
  evalTextAnchor,
  evalTextReplacement,
  "live-evaluation response assertions",
);
liveEval = liveEval.replaceAll(
  "text.includes(phrase.toLowerCase())",
  "assertionText.includes(phrase.toLowerCase())",
);

const mustNotBlock = [
  "    for (const phrase of scenario.mustNotMention || []) {",
  "      if (assertionText.includes(phrase.toLowerCase())) failures.push(`unsafe phrase \"${phrase}\"`);",
  "    }",
].join("\n");
const contradictionChecks = [
  mustNotBlock,
  "    if (requireVisibleDecision) {",
  "      failures.push(...visibleDecisionContradictions(payload));",
  "      if (",
  "        /(?:decision pack|equipment evidence|authorised result)[^.]{0,120}(?:unavailable|too large)/.test(",
  "          visibleText,",
  "        )",
  "      ) {",
  "        failures.push(\"visible decision layer reports an unavailable or oversized equipment pack\");",
  "      }",
  "    }",
].join("\n");
liveEval = replaceOnce(
  liveEval,
  mustNotBlock,
  contradictionChecks,
  "visible contradiction assertions",
);
writeFileSync(liveEvalPath, liveEval);

extendIntegrationChainContracts();
console.log(
  "Applied VOR-049 decision-ready equipment evidence, answer repair and visible-quality evaluation.",
);
