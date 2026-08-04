import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (path) => readFileSync(path, "utf8");
const integration = read("scripts/vor-049-integrate-decision-ready-equipment.mjs");
const backend = read("netlify/functions/ask-vorta.mts");
const liveEval = read("scripts/ask-vorta-live-evals.mjs");
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
    backend,
    new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Missing transformed VOR-049 backend marker: ${marker}`,
  );
}

assert.match(
  backend,
  /const compactEquipmentPack = compactEquipmentDecisionPackForModel\(result\);/,
  "Equipment packs must be compacted before the generic oversize failure path",
);
assert.match(
  backend,
  /decisionFacts: textValues\(data\.decisionFacts\)/,
  "The model-facing pack must retain verified decision facts",
);
assert.doesNotMatch(
  backend.match(/function compactEquipmentDecisionPackForModel[\s\S]*?function trimToolResult/)?.[0] ?? "",
  /domains:\s*data\.domains/,
  "Raw multi-domain equipment payloads must not be copied into the model-facing compact pack",
);
assert.match(
  backend,
  /const domainNames = equipmentDecisionDomains\(request\.question\);/,
  "Focused equipment questions must select only relevant evidence domains",
);
assert.match(
  backend,
  /repairEquipmentDecisionAnswer\(answer, questionPlan, toolOutcomes\);[\s\S]*?answer\.confidence = evidenceAwareConfidence/,
  "Deterministic completion must repair contradictions before confidence calibration",
);
assert.match(
  backend,
  /retainEquipmentDecisionFacts\(answer, questionPlan, toolOutcomes\);\s*repairEquipmentDecisionAnswer\(answer, questionPlan, toolOutcomes\);\s*enforceEquipmentReturnToServiceSafety/,
  "Model-generated equipment answers must be repaired before return-to-service wording and confidence",
);
assert.match(
  backend,
  /const upperBound = visibleDecisionUnavailable \? 50 : 95/,
  "Non-answerable visible decisions must not report confidence above 50 percent",
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
    liveEval,
    new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Missing VOR-049 visible-evaluation marker: ${marker}`,
  );
}
assert.match(
  liveEval,
  /\/vor-033-demo-golden\\\.json\$\/\.test\(scenarioFile\)/,
  "The VOR-033 golden set must automatically judge the visible decision layer",
);
assert.match(
  liveEval,
  /if \(!assertionText\.includes\(phrase\.toLowerCase\(\)\)\)/,
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
