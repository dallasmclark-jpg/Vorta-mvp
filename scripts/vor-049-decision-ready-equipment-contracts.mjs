import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (path) => readFileSync(path, "utf8");
const integration = read("scripts/vor-049-integrate-decision-ready-equipment.mjs");
const backend = read("netlify/functions/ask-vorta.mts");
const liveEval = read("scripts/ask-vorta-live-evals.mjs");
const workflow = read(".github/workflows/vor-049-validation.yml");
const modelPackTemplate = read("scripts/templates/vor-049-trim-tool-result.txt");
const domainTemplate = read("scripts/templates/vor-049-domain-selection.txt");
const answerRepairTemplate = read("scripts/templates/vor-049-answer-repair.txt");
const visibleEvalTemplate = read("scripts/templates/vor-049-visible-eval-helpers.txt");
const backendSurface = [
  backend,
  integration,
  modelPackTemplate,
  domainTemplate,
  answerRepairTemplate,
].join("\n");
const liveEvalSurface = [liveEval, integration, visibleEvalTemplate].join("\n");
const packageJson = JSON.parse(read("package.json"));
const golden = JSON.parse(read("tests/evals/vor-033-demo-golden.json"));

const syntax = spawnSync(
  process.execPath,
  ["--check", "scripts/vor-049-integrate-decision-ready-equipment.mjs"],
  { encoding: "utf8" },
);
assert.equal(
  syntax.status,
  0,
  `VOR-049 integration has invalid syntax:\n${syntax.stdout}\n${syntax.stderr}`,
);

assert.match(
  packageJson.scripts.predev,
  /vor-048-integrate-routing-telemetry-feedback\.mjs && node scripts\/vor-049-integrate-decision-ready-equipment\.mjs$/,
);
assert.match(
  packageJson.scripts["build:metadata"],
  /vor-048-integrate-routing-telemetry-feedback\.mjs && node scripts\/vor-049-integrate-decision-ready-equipment\.mjs && node scripts\/write-build-metadata\.mjs$/,
);
assert.equal(
  packageJson.scripts["eval:ask-vorta:vor049"],
  "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-033-demo-golden.json",
);

for (const marker of [
  "compactEquipmentDecisionPackForModel",
  "equipmentDecisionDomains",
  "ALL_EQUIPMENT_DECISION_DOMAINS",
  "includedDomains",
  "omittedDomains",
  ".slice(0, 24)",
  "repairEquipmentDecisionAnswer",
  "unavailableEquipmentDecisionClaim",
  "visibleDecisionUnavailable ? 50 : 95",
]) {
  assert.match(
    backendSurface,
    new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Missing VOR-049 backend integration marker: ${marker}`,
  );
}

assert.match(
  modelPackTemplate,
  /const compactEquipmentPack = compactEquipmentDecisionPackForModel\(result\);/,
  "Equipment packs must be compacted before the generic oversize failure path",
);
assert.match(
  modelPackTemplate,
  /decisionFacts: textValues\(data\.decisionFacts\)/,
  "The model-facing pack must retain verified decision facts",
);
assert.doesNotMatch(
  modelPackTemplate,
  /domains:\s*data\.domains/,
  "Raw multi-domain equipment payloads must not be copied into the model-facing compact pack",
);
assert.match(
  integration,
  /const domainNames = equipmentDecisionDomains\(request\.question\);/,
  "Focused equipment questions must select only relevant evidence domains",
);
assert.match(
  domainTemplate,
  /add\("get_equipment_spares", "get_equipment_work", "get_equipment_risk_actions"\)/,
  "Blocked interventions must include spares, work and the calculated risk-action domain",
);
assert.match(
  answerRepairTemplate,
  /if \(!originalUnavailable\)/,
  "Valid model prose must still be enriched with the decisive verified fact",
);
assert.match(
  answerRepairTemplate,
  /label: "Verified evidence", value: primaryText/,
  "The highest-relevance exact decision fact must be visible in decisionSummary",
);
assert.match(
  answerRepairTemplate,
  /title: "Verified decision fact",\s*detail: primaryText/,
  "The exact decision fact must also remain visible in findings",
);
assert.match(
  integration,
  /repairEquipmentDecisionAnswer\(answer, questionPlan, toolOutcomes\);[\s\S]*?answer\.confidence = evidenceAwareConfidence/,
  "Deterministic completion must repair contradictions before confidence calibration",
);
assert.match(
  integration,
  /retainEquipmentDecisionFacts\(answer, questionPlan, toolOutcomes\);[\s\S]*?repairEquipmentDecisionAnswer\(answer, questionPlan, toolOutcomes\);[\s\S]*?enforceEquipmentReturnToServiceSafety/,
  "Model-generated equipment answers must be repaired before return-to-service wording and confidence",
);
assert.match(
  integration,
  /visibleDecisionUnavailable \? 50 : 95/,
  "Non-answerable visible decisions must not report confidence above 50 percent",
);
assert.match(
  workflow,
  /Wait for a clean shared evaluation rate window/,
  "The live golden gate must isolate itself from parallel CI traffic",
);
assert.match(
  workflow,
  /run: sleep 310/,
  "The shared evaluation account must receive a full production rate-window reset",
);
assert.match(
  workflow,
  /VORTA_EVAL_RATE_LIMIT_RETRY_MS: 310000/,
  "The dedicated gate must wait out a collided production rate window",
);
assert.match(
  workflow,
  /VORTA_EVAL_RATE_LIMIT_MAX_RETRIES: 3/,
  "The dedicated gate must retry the same blocked scenario without silently skipping it",
);
assert.match(
  liveEval,
  /while \(\s*requestResult\.response\?\.status === 429 &&\s*rateLimitRetries < rateLimitMaxRetries/,
  "The evaluator must pause and retry a rate-limited scenario",
);
assert.match(
  liveEval,
  /retryDelayForRateLimit/,
  "The evaluator must honour the configured or server-provided retry window",
);
assert.match(
  liveEval,
  /rateLimitRetries,/,
  "Retry evidence must be included in the evaluation result",
);

for (const marker of [
  "function visibleDecisionText(answer)",
  "function visibleDecisionContradictions(answer)",
  "requireVisibleDecision",
  "assertionText",
  "visible answer denies capability evidence",
  "visible answer denies spare evidence",
  "visible decision layer reports an unavailable or oversized equipment pack",
]) {
  assert.match(
    liveEvalSurface,
    new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Missing VOR-049 visible-evaluation marker: ${marker}`,
  );
}
assert.match(
  liveEvalSurface,
  /vor-033-demo-golden/,
  "The VOR-033 golden set must automatically judge the visible decision layer",
);
assert.match(
  integration,
  /assertionText\.includes\(phrase\.toLowerCase\(\)\)/,
  "Required golden facts must be present in the selected visible assertion layer",
);

assert.equal(golden.length, 24, "The permanent maintenance-manager golden set must retain 24 questions");
assert.ok(
  golden.every((scenario) => Array.isArray(scenario.expectedTools) && scenario.expectedTools.length > 0),
  "Every VOR-033 question must require authorised Vorta evidence",
);
assert.ok(
  golden.some((scenario) => /spare|stock|blocking/i.test(scenario.question)),
  "The golden set must cover spares and execution blockers",
);
assert.ok(
  golden.some((scenario) => /who|qualified|engineer|authorise/i.test(scenario.question)),
  "The golden set must cover named capability decisions",
);
assert.ok(
  golden.some((scenario) => /diagnos|caused|reading|fault/i.test(scenario.question)),
  "The golden set must cover technical diagnosis",
);
assert.ok(
  golden.some((scenario) => /verification|verify|evidence|required|returning/i.test(scenario.question)),
  "The golden set must cover verification and return-to-service decisions",
);

assert.match(
  integration,
  /chainContractPaths/,
  "The VOR-049 integration must preserve the established integration-chain contracts",
);
assert.match(
  integration,
  /VOR-049 integration is partially applied/,
  "The build transformation must fail closed on partial application",
);

console.log("VOR-049 decision-ready equipment contracts passed.");
