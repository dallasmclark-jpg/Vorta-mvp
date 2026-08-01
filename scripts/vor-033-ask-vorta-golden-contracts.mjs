import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scenarios = JSON.parse(readFileSync(resolve(root, "tests/evals/vor-033-demo-golden.json"), "utf8"));
const evaluator = readFileSync(resolve(root, "scripts/ask-vorta-live-evals.mjs"), "utf8");
const askVorta = readFileSync(resolve(root, "netlify/functions/ask-vorta.mts"), "utf8");

assert.ok(Array.isArray(scenarios), "The VOR-033 golden suite must be a JSON array.");
assert.ok(scenarios.length >= 20, "The Maintenance Manager golden suite must contain at least twenty questions.");

const ids = new Set();
const storyPrefixes = ["fd03", "rabs", "vf02", "wfi01", "ahu01", "cold01"];
for (const scenario of scenarios) {
  assert.equal(typeof scenario.id, "string", "Every scenario needs a stable ID.");
  assert.ok(!ids.has(scenario.id), `Duplicate scenario ID: ${scenario.id}`);
  ids.add(scenario.id);
  assert.equal(typeof scenario.question, "string", `${scenario.id} needs a question.`);
  assert.ok(scenario.question.length >= 20, `${scenario.id} question is too vague.`);
  assert.ok(Array.isArray(scenario.expectedTools), `${scenario.id} needs expectedTools.`);
  assert.ok(Array.isArray(scenario.mustMention), `${scenario.id} needs mustMention.`);
  assert.ok(Array.isArray(scenario.mustMentionAny), `${scenario.id} needs mustMentionAny.`);
  assert.ok(Array.isArray(scenario.mustNotMention), `${scenario.id} needs mustNotMention.`);
  assert.ok(scenario.mustMention.length > 0, `${scenario.id} must verify exact evidence.`);
  assert.ok(scenario.mustMentionAny.length > 0, `${scenario.id} must verify at least one supporting finding.`);
  for (const tool of scenario.expectedTools) {
    assert.ok(askVorta.includes(`name: "${tool}"`), `${scenario.id} references unknown tool ${tool}.`);
  }
}

for (const prefix of storyPrefixes) {
  const count = scenarios.filter((scenario) => scenario.id.startsWith(`vor033-${prefix}`)).length;
  assert.equal(count, 4, `${prefix} must have four golden questions.`);
}

const requiredEvidence = [
  "FD-03-PLC-01",
  "RABS-01-PLC-01",
  "VF02-SENS-014",
  "WFI1-COND-001",
  "HVAC-DP-001",
  "COLD-01-SEN-C01",
  "Nia Roberts",
  "Natalie Morgan",
  "James Mitchell",
  "Priya Shah",
  "Gareth Owen",
];
const encoded = JSON.stringify(scenarios);
for (const evidence of requiredEvidence) {
  assert.ok(encoded.includes(evidence), `Golden suite must verify ${evidence}.`);
}

assert.ok(evaluator.includes("VORTA_EVAL_SCENARIOS"), "The live evaluator must support an explicit scenario file.");
assert.ok(evaluator.includes("VORTA_EVAL_LIMIT"), "The live evaluator must support bounded diagnostic runs.");
assert.ok(evaluator.includes("no traceable response ID"), "Every live answer must remain traceable.");
assert.ok(evaluator.includes("no evidence links"), "Every live answer must expose evidence links.");

console.log(`VOR-033 Ask Vorta golden-suite contracts passed (${scenarios.length} questions).`);
