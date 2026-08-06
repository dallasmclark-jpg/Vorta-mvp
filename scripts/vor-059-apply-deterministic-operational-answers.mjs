import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(path, before, after) {
  const source = readFileSync(path, "utf8");
  const matches = source.split(before).length - 1;
  assert.equal(matches, 1, `${path}: expected one replacement anchor, found ${matches}`);
  writeFileSync(path, source.replace(before, after));
}

function replaceAllExact(path, before, after, expectedMatches) {
  const source = readFileSync(path, "utf8");
  const matches = source.split(before).length - 1;
  assert.equal(
    matches,
    expectedMatches,
    `${path}: expected ${expectedMatches} replacement anchors, found ${matches}`,
  );
  writeFileSync(path, source.replaceAll(before, after));
}

const fragment = readFileSync(
  "scripts/vor-059-deterministic-operational-answers.fragment.txt",
  "utf8",
);
replaceOnce(
  "netlify/functions/ask-vorta/decision-answer.mts",
  '  if (intent === "maintenance_plan_cover_feasibility") {\n',
  `${fragment}  if (intent === "maintenance_plan_cover_feasibility") {\n`,
);

replaceOnce(
  "package.json",
  '    "eval:ask-vorta:vor058": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-058-site-priority-performance.json"\n',
  '    "eval:ask-vorta:vor058": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-058-site-priority-performance.json",\n    "eval:ask-vorta:vor059": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-059-deterministic-operational-answers.json",\n    "eval:ask-vorta:vor059:audit": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-059-operational-model-independence-audit.json"\n',
);

replaceOnce(
  "scripts/run-contract-suite.mjs",
  '  ["VOR-058 site-priority performance", "scripts/vor-058-site-priority-performance-contracts.mjs"],\n',
  '  ["VOR-058 site-priority performance", "scripts/vor-058-site-priority-performance-contracts.mjs"],\n  ["VOR-059 deterministic operational answers", "scripts/vor-059-deterministic-operational-answers-contracts.mjs"],\n',
);

const workflowPath = ".github/workflows/vor-049-validation.yml";
replaceAllExact(
  workflowPath,
  '      - "scripts/vor-058*"\n',
  '      - "scripts/vor-058*"\n      - "scripts/vor-059*"\n',
  2,
);
replaceAllExact(
  workflowPath,
  '      - "tests/evals/vor-058-site-priority-performance.json"\n',
  '      - "tests/evals/vor-058-site-priority-performance.json"\n      - "tests/evals/vor-059-deterministic-operational-answers.json"\n      - "tests/evals/vor-059-operational-model-independence-audit.json"\n',
  2,
);
replaceOnce(
  workflowPath,
  '      - name: Run complete contract suite\n',
  '      - name: Run permanent VOR-059 contracts\n        run: node scripts/vor-059-deterministic-operational-answers-contracts.mjs\n\n      - name: Run complete contract suite\n',
);
replaceOnce(
  workflowPath,
  '      - name: Stop exact-source Ask Vorta evaluation server\n',
  '      - name: Run six authenticated VOR-059 operational decisions\n        env:\n          VORTA_EVAL_BASE_URL: http://127.0.0.1:8788\n          VORTA_EVAL_DELAY_MS: 250\n          VORTA_EVAL_RATE_LIMIT_RETRY_MS: 310000\n          VORTA_EVAL_RATE_LIMIT_MAX_RETRIES: 1\n        shell: bash\n        run: npm run eval:ask-vorta:vor059 | tee vor-059-live-eval.log\n\n      - name: Stop exact-source Ask Vorta evaluation server\n',
);
replaceAllExact(
  workflowPath,
  '            vor-058-live-eval.log\n',
  '            vor-058-live-eval.log\n            vor-059-live-eval.log\n',
  2,
);

const orchestrationPath = "scripts/vor-050-live-eval-orchestration-contracts.mjs";
replaceOnce(
  orchestrationPath,
  'const equipmentScenarios = JSON.parse(\n',
  'const operationalScenarios = JSON.parse(\n  readFileSync(\n    "tests/evals/vor-059-deterministic-operational-answers.json",\n    "utf8",\n  ),\n);\nconst equipmentScenarios = JSON.parse(\n',
);
replaceOnce(
  orchestrationPath,
  '/deploy-preview-|Wait for exact Netlify preview commit|VORTA_EVAL_BASE_URL|eval:ask-vorta:vor0(?:48|49|58)/,\n',
  '/deploy-preview-|Wait for exact Netlify preview commit|VORTA_EVAL_BASE_URL|eval:ask-vorta:vor0(?:48|49|58|59)/,\n',
);
replaceOnce(
  orchestrationPath,
  '    prDecisionWorkflow.includes("npm run eval:ask-vorta:vor058"),\n  "The central pull-request owner may run only the bounded VOR-058 suite against exact local branch source",\n',
  '    prDecisionWorkflow.includes("npm run eval:ask-vorta:vor058") &&\n    prDecisionWorkflow.includes("npm run eval:ask-vorta:vor059"),\n  "The central pull-request owner must run the bounded VOR-058 and VOR-059 suites against exact local branch source",\n',
);
replaceOnce(
  orchestrationPath,
  'assert.equal(\n  equipmentScenarios.length,\n',
  'assert.equal(\n  operationalScenarios.length,\n  6,\n  "The exact-source pull-request gate must retain six model-independent operational scenarios",\n);\nassert.ok(\n  operationalScenarios.every(\n    (scenario) =>\n      Number(scenario.maxToolCount) === 1 &&\n      Number(scenario.maxDurationMs) <= 18_000,\n  ),\n  "VOR-059 must use one authorised tool per question and retain the production p95 ceiling",\n);\nassert.equal(\n  sitePriorityScenarios.length + operationalScenarios.length,\n  12,\n  "The exact-source account window must remain bounded to 12 total requests",\n);\nassert.equal(\n  equipmentScenarios.length,\n',
);

replaceOnce(
  "scripts/vor-054-cross-domain-live-contracts.mjs",
  '    centralWorkflow.includes("npm run eval:ask-vorta:vor058"),\n  "The sole pull-request owner may run the bounded VOR-058 suite only against exact local branch source",\n',
  '    centralWorkflow.includes("npm run eval:ask-vorta:vor058") &&\n    centralWorkflow.includes("npm run eval:ask-vorta:vor059"),\n  "The sole pull-request owner may run the bounded VOR-058 and VOR-059 suites only against exact local branch source",\n',
);

console.log("Applied VOR-059 deterministic operational answer implementation.");
