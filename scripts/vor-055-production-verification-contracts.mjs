import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routePlanning = readFileSync(
  "netlify/functions/ask-vorta/route-planning.mts",
  "utf8",
);
const productionWorkflow = readFileSync(
  ".github/workflows/maintenance-manager-production.yml",
  "utf8",
);
const centralWorkflow = readFileSync(
  ".github/workflows/vor-049-validation.yml",
  "utf8",
);
const contractSuite = readFileSync(
  "scripts/run-contract-suite.mjs",
  "utf8",
);
const scenarios = JSON.parse(
  readFileSync("tests/evals/ask-vorta-live-golden.json", "utf8"),
);

assert.ok(
  routePlanning.includes("function parseEnglishDateRange(") &&
    routePlanning.includes("const explicitCoverRange = parseEnglishDateRange("),
  "Absolute English dates must be parsed before deterministic routing",
);
assert.ok(
  routePlanning.includes("const absoluteWorkforceQuestion =") &&
    routePlanning.includes("if (equipmentQuery && !absoluteWorkforceQuestion)"),
  "Absolute-date workforce questions must bypass equipment-reference routing",
);
const explicitRangeIndex = routePlanning.indexOf(
  "const explicitCoverRange = parseEnglishDateRange(",
);
const equipmentRouteIndex = routePlanning.indexOf(
  "if (equipmentQuery && !absoluteWorkforceQuestion)",
);
const coverRouteIndex = routePlanning.indexOf(
  '"get_shift_cover",',
  equipmentRouteIndex,
);
assert.ok(
  explicitRangeIndex >= 0 &&
    equipmentRouteIndex > explicitRangeIndex &&
    coverRouteIndex > equipmentRouteIndex,
  "Date-aware workforce precedence must be established before equipment and Shift Cover routing",
);
assert.ok(
  routePlanning.includes("explicitCoverRange ??") &&
    routePlanning.includes("explicitCoverRange !== null ||"),
  "Parsed absolute dates must drive Shift Cover tool arguments and dated-workforce detection",
);

const contractorStart = routePlanning.indexOf('"contractor_support"');
const backlogStart = routePlanning.indexOf('"work_backlog"');
assert.ok(contractorStart >= 0 && backlogStart > contractorStart);
assert.ok(
  routePlanning.slice(contractorStart, backlogStart).includes(
    "forceActionPlan: true",
  ),
  "Contractor availability decisions must include a confirmation action",
);
assert.ok(
  routePlanning.slice(backlogStart, backlogStart + 700).includes(
    "forceActionPlan: true",
  ),
  "Backlog decisions must include an executable next action",
);

assert.equal(
  scenarios.length,
  13,
  "The production golden suite must retain all 13 cross-domain scenarios",
);
const assertions = scenarios.flatMap((scenario) => [
  ...(scenario.mustMention ?? []),
  ...(scenario.mustMentionAny ?? []),
]);
for (const forbidden of [
  "1 Aug",
  "2 Aug",
  "Gareth Owen",
  "Nia Roberts",
  "Isla Green",
]) {
  assert.equal(
    assertions.includes(forbidden),
    false,
    `Production evidence assertions must not freeze the historical value ${forbidden}`,
  );
}
assert.equal(
  assertions.some((value) => /^\d+(?:\.\d+)?$/.test(String(value))),
  false,
  "Production evidence assertions must not freeze changing numeric counts",
);

for (const marker of [
  "VORTA_EVAL_OFFSET: 0",
  "VORTA_EVAL_LIMIT: 12",
  "VORTA_EVAL_OFFSET: 12",
  "VORTA_EVAL_LIMIT: 1",
  "run: sleep 310",
  "ask-vorta-production-window-1.log",
  "ask-vorta-production-window-2.log",
]) {
  assert.ok(
    productionWorkflow.includes(marker),
    `Production verification is missing ${marker}`,
  );
}
const firstWindow = productionWorkflow.indexOf(
  "Run first 12 Ask Vorta production decisions",
);
const reset = productionWorkflow.indexOf(
  "Reset production evaluation rate window",
);
const secondWindow = productionWorkflow.indexOf(
  "Run final Ask Vorta production decision",
);
const enforce = productionWorkflow.indexOf(
  "Enforce Ask Vorta production evaluations",
);
const browser = productionWorkflow.indexOf(
  "Run authenticated production regression",
);
assert.ok(
  firstWindow >= 0 &&
    reset > firstWindow &&
    secondWindow > reset &&
    enforce > secondWindow &&
    browser > enforce,
  "Production verification must run 12 decisions, reset, run one decision, enforce results, then run browser regression",
);
assert.ok(
  productionWorkflow.includes("continue-on-error: true") &&
    productionWorkflow.includes("if: always()") &&
    productionWorkflow.includes("steps.production_window_one.outcome") &&
    productionWorkflow.includes("steps.production_window_two.outcome"),
  "Both production windows must finish and preserve evidence before the result is enforced",
);
assert.ok(
  productionWorkflow.includes("actions/upload-artifact@v4") &&
    productionWorkflow.includes("if-no-files-found: error"),
  "Both production evaluation logs must be preserved",
);
assert.ok(
  productionWorkflow.includes(
    "node scripts/verify-production-commit.mjs",
  ),
  "Exact production commit verification must remain the first operational gate",
);

assert.ok(
  contractSuite.includes(
    '["VOR-055 Ask Vorta production verification", "scripts/vor-055-production-verification-contracts.mjs"]',
  ),
  "VOR-055 must remain in the permanent contract suite",
);
for (const trigger of [
  '      - "scripts/vor-055*"',
  '      - "tests/evals/ask-vorta-live-golden.json"',
  '      - ".github/workflows/maintenance-manager-production.yml"',
]) {
  assert.ok(
    centralWorkflow.includes(trigger),
    `The central Ask Vorta gate is missing trigger ${trigger.trim()}`,
  );
}

console.log("VOR-055 Ask Vorta production verification contracts passed.");
