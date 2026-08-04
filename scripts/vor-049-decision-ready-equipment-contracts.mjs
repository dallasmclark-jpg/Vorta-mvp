import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const backendSurface = [
  "netlify/functions/ask-vorta.mts",
  "netlify/functions/ask-vorta/contracts.mts",
  "netlify/functions/ask-vorta/equipment-evidence.mts",
  "netlify/functions/ask-vorta/response-validation.mts",
  "netlify/functions/ask-vorta/route-planning.mts",
  "netlify/functions/ask-vorta/runtime.mts",
  "netlify/functions/ask-vorta/tool-execution.mts",
].map(read).join("\n");
const integration = backendSurface;
const backend = backendSurface;
const modelPackTemplate = backendSurface;
const domainTemplate = backendSurface;
const answerRepairTemplate = backendSurface;
const liveEval = read("scripts/ask-vorta-live-evals.mjs");
const visibleEvalTemplate = liveEval;
const liveEvalSurface = liveEval;
const workflow = read(".github/workflows/vor-049-validation.yml");
const packageJson = JSON.parse(read("package.json"));
const golden = JSON.parse(read("tests/evals/vor-033-demo-golden.json"));

assert.equal(
  packageJson.scripts.predev,
  "node scripts/vor-053-canonical-build-contracts.mjs --quick",
);
assert.equal(
  packageJson.scripts["build:metadata"],
  "node scripts/write-build-metadata.mjs",
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
    `Missing VOR-049 backend marker: ${marker}`,
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
  domainTemplate,
  /diagnos\(\?:e\|is\|tic\|ing\)\?/,
  "Natural diagnosis wording must reach technical evidence",
);
assert.match(
  domainTemplate,
  /reference instrument\|instrument fault/,
  "Instrument-fault diagnosis must include calibration evidence",
);
assert.match(
  domainTemplate,
  /next safe action[\s\S]*?probe\|sensor\|deviation\|repeat\|disagreement[\s\S]*?get_equipment_spares[\s\S]*?get_equipment_documents/,
  "A repeated probe-deviation action must include the exact spare and approved-document domains",
);
assert.match(
  integration,
  /leading intervention\|next safe action/,
  "Next-safe-action questions must retain a priority spare fact",
);
assert.match(
  integration,
  /before acting\|history\|next safe action/,
  "Next-safe-action questions must retain a priority approved-document fact",
);
assert.match(
  answerRepairTemplate,
  /if \(!originalUnavailable\)/,
  "Valid model prose must still be enriched with decisive verified facts",
);
assert.match(
  answerRepairTemplate,
  /const asksForAllQualified/,
  "Qualification questions must distinguish one recommended lead from every validated engineer",
);
assert.match(
  answerRepairTemplate,
  /const qualifiedCapabilityFacts = decisionFacts\.filter/,
  "All validated engineers for the selected skill must remain available to the visible decision layer",
);
assert.match(
  answerRepairTemplate,
  /label: asksForAllQualified \? "Validated capability" : "Verified evidence"/,
  "Qualification questions must visibly list each validated capability record",
);
assert.match(
  answerRepairTemplate,
  /primaryTexts\.join\("; "\)/,
  "A repaired qualification answer must name all relevant validated engineers",
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
assert.match(workflow, /run: sleep 310/);
assert.match(workflow, /VORTA_EVAL_RATE_LIMIT_RETRY_MS: 310000/);
assert.match(workflow, /VORTA_EVAL_RATE_LIMIT_MAX_RETRIES: 3/);
assert.match(
  liveEval,
  /while \(\s*requestResult\.response\?\.status === 429 &&\s*rateLimitRetries < rateLimitMaxRetries/,
);
assert.match(liveEval, /retryDelayForRateLimit/);
assert.match(liveEval, /rateLimitWaitMs \+= pauseMs/);
assert.match(
  liveEval,
  /const activeDurationMs = Math\.max\([\s\S]*?Date\.now\(\) - startedAt - rateLimitWaitMs/,
);
assert.match(liveEval, /activeDurationMs > Number\(scenario\.maxDurationMs\)/);
assert.match(liveEval, /rateLimitWaitMs,\s*elapsedDurationMs/);
assert.match(liveEval, /function boundedAnswerSnapshot\(answer\)/);
assert.match(liveEval, /visibleAnswer: boundedAnswerSnapshot\(payload\)/);

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
assert.match(liveEvalSurface, /vor-033-demo-golden/);
assert.match(
  liveEvalSurface,
  /assertionText\.includes\(phrase\.toLowerCase\(\)\)/,
  "Required golden facts must be present in the selected visible assertion layer",
);

assert.equal(golden.length, 24, "The maintenance-manager golden set must retain 24 questions");
assert.ok(
  golden.every((scenario) => Array.isArray(scenario.expectedTools) && scenario.expectedTools.length > 0),
  "Every VOR-033 question must require authorised Vorta evidence",
);
const fd03Capability = golden.find((scenario) => scenario.id === "vor033-fd03-skills");
assert.deepEqual(
  fd03Capability?.mustMention,
  ["Gareth Owen", "Sophie Bennett", "Vacuum Systems"],
);
assert.ok(fd03Capability?.mustNotMention?.includes("Nia Roberts is qualified"));
const rabsRelease = golden.find((scenario) => scenario.id === "vor033-rabs-release");
assert.ok(!rabsRelease?.mustNotMention?.includes("released"));
assert.ok(
  rabsRelease?.mustNotMention?.includes("can be released now") &&
    rabsRelease?.mustNotMention?.includes("safe to release"),
);
const ahuDiagnosis = golden.find((scenario) => scenario.id === "vor033-ahu01-diagnosis");
assert.ok(ahuDiagnosis?.expectedTools?.includes("get_equipment_calibrations"));
const coldNextAction = golden.find((scenario) => scenario.id === "vor033-cold01-next-action");
assert.ok(
  coldNextAction?.expectedTools?.includes("get_equipment_spares") &&
    coldNextAction?.expectedTools?.includes("get_equipment_documents") &&
    coldNextAction?.mustMention?.includes("COLD-01-SEN-C01"),
);
assert.ok(golden.some((scenario) => /spare|stock|blocking/i.test(scenario.question)));
assert.ok(golden.some((scenario) => /who|qualified|engineer|authorise/i.test(scenario.question)));
assert.ok(golden.some((scenario) => /diagnos|caused|reading|fault/i.test(scenario.question)));
assert.ok(golden.some((scenario) => /verification|verify|evidence|required|returning/i.test(scenario.question)));

console.log("VOR-049 decision-ready equipment contracts passed.");