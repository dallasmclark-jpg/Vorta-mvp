import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

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
const productionScenarios = JSON.parse(
  read("tests/evals/vor-049-vial-fill-sensor-regression.json"),
);

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

const resolverTemp = mkdtempSync(join(tmpdir(), "vorta-vor-049-resolver-"));
try {
  const resolverBundle = join(resolverTemp, "utilities.mjs");
  await build({
    entryPoints: ["netlify/functions/ask-vorta/utilities.mts"],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    outfile: resolverBundle,
    logLevel: "silent",
  });
  const resolver = await import(
    `${pathToFileURL(resolverBundle).href}?revision=${Date.now()}`
  );
  const naturalQuestions = [
    "vial fill sensor fault",
    "Vial filling sensor issue",
    "vial filler sensor issue",
  ];
  for (const question of naturalQuestions) {
    assert.equal(
      resolver.extractEquipmentReference(question),
      "vial fill",
      `Natural equipment wording must produce one stable equipment query: ${question}`,
    );
    assert.equal(
      resolver.equipmentReferenceMatches(
        "Bosch Vial Filler VF-02",
        question,
      ),
      true,
      `The real resolver must match VF-02 for: ${question}`,
    );
    assert.equal(
      resolver.equipmentReferenceMatches(
        "AHU-01 Supply Air Handling Unit",
        question,
      ),
      false,
      `The real resolver must reject unrelated equipment for: ${question}`,
    );
    assert.equal(
      resolver.equipmentReferenceMatches("Fill Finish", question),
      false,
      `An area name must not be mistaken for the vial filler: ${question}`,
    );
  }
  assert.equal(
    resolver.extractEquipmentReference(
      "what shift cover issues are there this week",
    ),
    null,
    "Workforce questions must not be reclassified as equipment merely because they contain the word issues",
  );

  const plannerBundle = join(resolverTemp, "route-planning.mjs");
  await build({
    entryPoints: ["netlify/functions/ask-vorta/route-planning.mts"],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    outfile: plannerBundle,
    logLevel: "silent",
  });
  const planner = await import(
    `${pathToFileURL(plannerBundle).href}?revision=${Date.now()}`
  );
  for (const question of naturalQuestions) {
    const plan = planner.deterministicQuestionPlan({
      question,
      history: [],
      pageContext: {
        path: "/dashboard",
        timezone: "Europe/London",
      },
    });
    assert.ok(plan, `Natural equipment wording must produce a plan: ${question}`);
    assert.equal(
      plan.routingMode,
      "deterministic",
      `Natural equipment wording must bypass semantic replanning: ${question}`,
    );
    assert.equal(
      plan.scope,
      "equipment",
      `Natural equipment wording must stay in equipment scope: ${question}`,
    );
    assert.equal(
      plan.intentLabel,
      "equipment_decision",
      `Natural equipment wording must use the equipment decision route: ${question}`,
    );
    assert.equal(
      plan.equipmentQuery,
      "vial fill",
      `Natural equipment wording must pass the bounded VF-02 query to evidence: ${question}`,
    );
    assert.deepEqual(
      plan.requiredTools,
      ["get_equipment_decision_pack"],
      `Natural equipment wording must load the cross-domain equipment pack: ${question}`,
    );
  }
} finally {
  rmSync(resolverTemp, { recursive: true, force: true });
}

assert.deepEqual(
  productionScenarios.map((scenario) => scenario.question),
  [
    "vial fill sensor fault",
    "Vial filling sensor issue",
    "vial filler sensor issue",
  ],
  "Production evaluation must include the original fixture, the exact failed tablet wording and one natural variant",
);
for (const scenario of productionScenarios) {
  assert.equal(scenario.requireVisibleDecision, true);
  assert.equal(scenario.requireActionPlan, false);
  assert.ok(
    scenario.expectedTools.includes("get_equipment_history") &&
      scenario.expectedTools.includes("get_equipment_documents"),
    `The production scenario must prove both prior-work history and approved documents: ${scenario.question}`,
  );
  for (const requiredPhrase of ["VF-02", "F-204", "WO-", "approved"]) {
    assert.ok(
      scenario.mustMention.includes(requiredPhrase),
      `The production scenario must visibly require ${requiredPhrase}: ${scenario.question}`,
    );
  }
  for (const forbiddenPhrase of [
    "question does not match a specific risk category",
    "No equipment matching",
    "provide the filler asset code",
  ]) {
    assert.ok(
      scenario.mustNotMention.includes(forbiddenPhrase),
      `The failed production wording must remain forbidden: ${forbiddenPhrase}`,
    );
  }
}

console.log(
  "VOR-049 production equipment resolution contracts passed: the real resolver and planner map natural vial-filler sensor wording to the deterministic VF-02 equipment pack, reject unrelated equipment and retain authorised work, history and document evidence.",
);
