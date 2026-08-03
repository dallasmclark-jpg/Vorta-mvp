import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const golden = JSON.parse(readFileSync(resolve(root, "tests/evals/vor-033-demo-golden.json"), "utf8"));
const natural = JSON.parse(readFileSync(resolve(root, "tests/evals/vor-040-natural-questions.json"), "utf8"));
const evaluator = readFileSync(resolve(root, "scripts/ask-vorta-live-evals.mjs"), "utf8");
const assistant = readFileSync(resolve(root, "netlify/functions/ask-vorta.mts"), "utf8");
const backlogEdge = readFileSync(resolve(root, "netlify/edge-functions/ask-vorta-work-backlog.ts"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

assert.equal(golden.length, 24, "The established VOR-033 manager suite must retain 24 questions.");
assert.ok(natural.length >= 30, "VOR-040 must add at least 30 fresh natural-language scenarios.");
assert.ok(golden.length + natural.length >= 54, "The combined Ask Vorta quality audit must contain at least 54 scenarios.");

const ids = new Set();
const questions = new Set();
for (const scenario of [...golden, ...natural]) {
  assert.equal(typeof scenario.id, "string", "Every scenario needs a stable ID.");
  assert.ok(!ids.has(scenario.id), `Duplicate scenario ID: ${scenario.id}`);
  ids.add(scenario.id);
  assert.equal(typeof scenario.question, "string", `${scenario.id} needs a question.`);
  assert.ok(scenario.question.trim().length >= 18, `${scenario.id} question is too short.`);
  const normalisedQuestion = scenario.question.trim().toLowerCase();
  assert.ok(!questions.has(normalisedQuestion), `Duplicate scenario question: ${scenario.question}`);
  questions.add(normalisedQuestion);
}

for (const scenario of natural) {
  assert.ok(scenario.id.startsWith("vor040-"), `${scenario.id} must use the VOR-040 prefix.`);
  assert.ok(
    Array.isArray(scenario.expectedTools) || Array.isArray(scenario.expectedAnyTools),
    `${scenario.id} must constrain tool selection.`,
  );
  assert.ok(Array.isArray(scenario.mustMentionAny), `${scenario.id} needs mustMentionAny assertions.`);
  assert.ok(scenario.mustMentionAny.length > 0, `${scenario.id} must verify relevant answer content.`);
  assert.ok(Array.isArray(scenario.mustNotMention), `${scenario.id} needs mustNotMention assertions.`);
  assert.ok(Number.isFinite(scenario.confidenceMin), `${scenario.id} needs a confidence floor.`);
  assert.ok(Number.isFinite(scenario.maxToolCount), `${scenario.id} needs a tool-count ceiling.`);
  assert.ok(Number.isFinite(scenario.maxDurationMs), `${scenario.id} needs a latency ceiling.`);
  assert.ok(Number.isFinite(scenario.maxDecisionSummaryItems), `${scenario.id} needs an answer-density ceiling.`);
  assert.ok(Number.isFinite(scenario.maxFollowUpQuestions), `${scenario.id} needs a follow-up ceiling.`);
}

const followUps = natural.filter((scenario) => Array.isArray(scenario.history) && scenario.history.length > 0);
assert.ok(followUps.length >= 2, "VOR-040 must evaluate conversational follow-up resolution.");

const typoOrShorthand = natural.filter((scenario) => /typo|shorthand|colloquial/.test(scenario.id));
assert.ok(typoOrShorthand.length >= 10, "VOR-040 must include substantial typo, shorthand and colloquial coverage.");

const mixed = natural.filter((scenario) => Number(scenario.minimumToolCount || 0) >= 2);
assert.ok(mixed.length >= 2, "VOR-040 must include mixed-domain decision questions.");

const safetyCases = natural.filter((scenario) =>
  scenario.mustNotMention.some((phrase) => /created|placed|guaranteed|definitely|without testing|becomes zero/i.test(phrase)),
);
assert.ok(safetyCases.length >= 8, "VOR-040 must protect against unsupported certainty and false write claims.");

const requiredDomains = [
  "get_site_operational_snapshot",
  "get_site_risk",
  "get_shift_handover",
  "get_shift_cover",
  "get_contractor_availability",
  "get_site_spares_risk",
  "get_site_work_backlog",
  "get_site_capability_actions",
  "get_site_maintenance_plan",
  "get_equipment_decision_pack",
];
const encoded = JSON.stringify(natural);
for (const tool of requiredDomains) {
  assert.ok(encoded.includes(tool), `VOR-040 must cover ${tool}.`);
}

for (const evidence of ["FD-03", "RABS-01", "VF-02", "WFI-01", "AHU-01", "COLD-01"]) {
  assert.ok(encoded.includes(evidence), `VOR-040 must retain natural-language coverage for ${evidence}.`);
}

for (const evaluatorFeature of [
  "scenario.history || []",
  "scenario.confidenceMin",
  "scenario.maxToolCount",
  "scenario.maxDecisionSummaryItems",
  "scenario.maxFollowUpQuestions",
  "scenario.maxDurationMs",
  "no evidence links",
  "no traceable response ID",
  "reauthentications",
  "payload.coveredTools || []",
  "hasEvidenceTool",
  "Decision-pack covered tools",
]) {
  assert.ok(evaluator.includes(evaluatorFeature), `Live evaluator must retain ${evaluatorFeature}.`);
}

for (const assistantFeature of [
  "maintenancePlanOnly",
"deterministicOperationalAnswer",
"maintenance_plan_cover_feasibility",
"site_evidence_freshness",
"site_missing_evidence",
"morning_maintenance_briefing",
"verified_risk_reduction_ranking",
"completeDeterministicAnswer",
"verifiedFallback",
"followUpLimit",
"completion is not yet proven by the recorded evidence",
"Source evidence freshness",
"Morning briefing evidence",
"Evidence gaps and confirmations",
"evidence|prove|confirm|picture",
  '"maintenance_plan"',
  '"get_site_maintenance_plan"',
  "normaliseEquipmentReference",
  "excludedAcronyms",
  "relevantEquipmentDecisionFacts",
  "retainEquipmentDecisionFacts",
  "retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes)",
  "decisionFacts: equipmentDecisionFacts(selected, domains, request.question)",
  "explicitEquipmentDomainFacts",
  "nestedDecisionRecords",
  "work evidence",
  "spare evidence",
  "capability evidence",
  "document evidence",
  "qualified engineers 0",
  "requiredSkill.qualified_engineers",
  "documentSearchRequested",
  "coveredTools",
  "before acting|evidence supports|verification record",
  "block(?:ing|ed)?|preventing",
  "const questionRanked = relevantEquipmentDecisionFacts(\n    question,\n    [...explicitFacts, ...rankedFacts]",
  "...selectedFacts,\n      ...textValues(answer.evidence)",
  "typeof value !== \"object\"",
  "pathSegments",
]) {
  assert.ok(assistant.includes(assistantFeature), `Ask Vorta must retain ${assistantFeature}.`);
}
assert.ok(
  assistant.includes('value.match(/\\b[A-Z]{3,5}\\b/g)') && assistant.includes('"WFI"') === false,
  "Acronym-only equipment resolution must be generic rather than hardcoded to WFI.",
);

for (const edgeFeature of [
  "OPEN_WORK_PATTERN",
  "isFactualBacklogRequest",
  "CAPABILITY_PATTERN",
  "isCapabilityRequest",
  "EQUIPMENT_SPARE_FOLLOW_UP_PATTERN",
  "isEquipmentSpareFollowUp",
  "equipmentReferenceFromRequest",
  "componentConstraintScore",
  'toolsUsed: ["get_equipment_spares"]',
  'intentLabel: "equipment_spare_blocker"',
  "vorta_get_capability_reconciliation_report",
  "context.next(request)",
  "ask_vorta_interactions",
  'toolsUsed: ["get_site_work_backlog"]',
  'toolsUsed: ["get_site_capability_actions"]',
  'intentLabel: "work_backlog"',
  'intentLabel: "capability_risk"',
  'path: "/api/ask-vorta"',
  'method: "POST"',
]) {
  assert.ok(backlogEdge.includes(edgeFeature), `Ask Vorta edge fast paths must retain ${edgeFeature}.`);
}
assert.ok(!backlogEdge.includes('from "openai"'), "The factual fast paths must not call the language model.");
assert.ok(
  backlogEdge.includes("MIXED_DECISION_PATTERN") && backlogEdge.includes("EQUIPMENT_CODE_PATTERN"),
  "The edge middleware must delegate mixed and equipment-specific questions to the main assistant.",
);

assert.equal(
  packageJson.scripts?.["eval:ask-vorta:vor040"],
  "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-040-natural-questions.json",
  "The repository must expose a dedicated VOR-040 live evaluation command.",
);

console.log(`VOR-040 natural-question contracts passed (${golden.length + natural.length} total scenarios).`);
