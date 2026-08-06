import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const entrypoint = read("netlify/functions/ask-vorta.mts");
const fallback = read(
  "netlify/functions/ask-vorta/runtime-equipment-fallback.mts",
);
const evidence = read(
  "netlify/functions/ask-vorta/equipment-evidence.mts",
);
const tools = read(
  "netlify/functions/ask-vorta/tool-execution.mts",
);
const frontend = read(
  "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx",
);
const exactProductionScenario = JSON.parse(
  read("tests/evals/vor-049-vial-fill-sensor-regression.json"),
)[0];

assert.match(
  entrypoint,
  /runtime-equipment-fallback\.mjs/,
  "The production endpoint must pass reasoning failures through the equipment evidence fallback",
);

for (const marker of [
  "vial fill sensor fault",
  "primaryResponse.status !== 503",
  "authenticateAskVortaRequest",
  'routeKey !== "equipment"',
  'executeTool(\n    "get_equipment_risk"',
  'executeTool(\n    "get_equipment_decision_pack"',
  "previous work orders and confirmations",
  "approved current manual/SOP/drawing sections",
  "retainEquipmentDecisionFacts",
  "repairEquipmentDecisionAnswer",
  'status: "fallback"',
  'failure_stage: "answer"',
  'routing_mode: "fallback"',
  "No verified document section was returned, so Vorta is not inventing one.",
]) {
  assert.ok(
    fallback.includes(marker.replace("vial fill sensor fault", "vial fill sensor fault")) ||
      (marker === "vial fill sensor fault" &&
        fallback.includes("EQUIPMENT_FAULT_PATTERN") &&
        fallback.includes("filler|fill|vial")),
    `Missing VOR-049 production-fallback marker: ${marker}`,
  );
}

assert.match(
  fallback,
  /workFact[\s\S]*?documentFact[\s\S]*?calibrationFact[\s\S]*?spareFact/,
  "The fallback must visibly prioritise prior work, approved guidance, instrument evidence and relevant spares",
);
assert.match(
  fallback,
  /For \$\{label\}, Vorta found/,
  "The fallback must answer the equipment fault rather than substitute a site-risk summary",
);
assert.doesNotMatch(
  fallback,
  /question does not match a specific risk category/i,
  "The equipment fallback must never claim an equipment fault lacks a relevant category",
);
assert.match(
  tools,
  /documentSearchRequested[\s\S]*?fault\|diagnos[\s\S]*?search_maintenance_documents/,
  "Equipment fault packs must retain approved maintenance-document search",
);
assert.match(
  evidence,
  /work evidence[\s\S]*?document evidence/,
  "Equipment decision facts must retain previous work and source-document evidence",
);
assert.match(
  frontend,
  /Ask Vorta agent unavailable; using verified deterministic fallback/,
  "The old client fallback remains a last resort only when the server cannot build the equipment answer",
);

assert.equal(
  exactProductionScenario.question,
  "vial fill sensor fault",
  "The physical production regression wording must remain an exact authenticated scenario",
);
assert.equal(exactProductionScenario.requireVisibleDecision, true);
assert.equal(exactProductionScenario.requireActionPlan, false);
assert.ok(
  exactProductionScenario.expectedTools.includes("get_equipment_history") &&
    exactProductionScenario.expectedTools.includes("get_equipment_documents"),
  "The exact production scenario must prove both prior-work history and approved documents",
);
for (const requiredPhrase of ["VF-02", "F-204", "WO-", "approved"]) {
  assert.ok(
    exactProductionScenario.mustMention.includes(requiredPhrase),
    `The exact production scenario must visibly require ${requiredPhrase}`,
  );
}
assert.ok(
  exactProductionScenario.mustNotMention.includes(
    "question does not match a specific risk category",
  ),
  "The generic site-risk regression wording must permanently fail the exact scenario",
);

console.log(
  "VOR-049 production equipment fallback contracts passed: the exact vial-fill sensor regression keeps authorised work, history, document, calibration and spare evidence when conversational reasoning fails.",
);
