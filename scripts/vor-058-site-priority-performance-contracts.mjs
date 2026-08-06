// VOR-058 runs six authenticated decisions against the exact bundled PR source.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync(
  "netlify/functions/ask-vorta/route-planning.mts",
  "utf8",
);
const runtimeSource = readFileSync(
  "netlify/functions/ask-vorta/runtime.mts",
  "utf8",
);
const answerSource = readFileSync(
  "netlify/functions/ask-vorta/decision-answer.mts",
  "utf8",
);
const workflowSource = readFileSync(
  ".github/workflows/vor-049-validation.yml",
  "utf8",
);
const localServerSource = readFileSync(
  "scripts/vor-058-local-eval-server.mjs",
  "utf8",
);
const errorBoundarySource = readFileSync(
  "src/components/VortaErrorBoundary.tsx",
  "utf8",
);
const netlifyHeadersSource = readFileSync(
  "public/_headers",
  "utf8",
);
const suiteSource = readFileSync("scripts/run-contract-suite.mjs", "utf8");
const packageSource = readFileSync("package.json", "utf8");
const scenarios = JSON.parse(
  readFileSync(
    "tests/evals/vor-058-site-priority-performance.json",
    "utf8",
  ),
);

const siteMatcherIndex = routeSource.indexOf("const sitePriorityQuestion");
const historyFallbackIndex = routeSource.indexOf(
  "if (hasConversationHistory) return null;",
);
assert.ok(siteMatcherIndex >= 0, "The natural site-priority matcher must exist");
assert.ok(
  siteMatcherIndex < historyFallbackIndex,
  "Site-priority follow-ups must be handled before semantic-history fallback",
);
for (const phrase of [
  "(?:are\\s+)?(?:most\\s+)?likely to",
  "(?:current|site|maintenance)\\s+){0,2}",
  "where should",
  "what needs",
  "get_site_operational_snapshot",
]) {
  assert.ok(
    routeSource.includes(phrase),
    `Site-priority routing must retain ${phrase}`,
  );
}
assert.ok(
  routeSource.includes('"site_threat_prioritization"'),
  "The site-priority route must use the canonical intent",
);

for (const required of [
  'plannedIntent === "site_priorities"',
  'plannedIntent === "site_threat_prioritization"',
  'requiredTools: ["get_site_operational_snapshot"]',
  'optionalTools: []',
  'routingMode: "deterministic"',
]) {
  assert.ok(
    runtimeSource.includes(required),
    `Semantic site-priority normalisation must retain ${required}`,
  );
}
assert.ok(
  !runtimeSource.includes(
    'requiredTools: ["get_site_operational_snapshot", "get_equipment_risk"]',
  ),
  "Site-priority normalisation must not add equipment specialist lookups",
);

for (const required of [
  'intent === "site_priorities"',
  'intent === "site_threat_prioritization"',
  'const rankedActions = records(rankedData)',
  'actionPlan: topAction',
  "calculated reduction",
  "Unavailable operational domains",
]) {
  assert.ok(
    answerSource.includes(required),
    `Deterministic site-priority answers must retain ${required}`,
  );
}
assert.ok(
  answerSource.includes("Maintenance Manager / Planner"),
  "The deterministic answer must retain an accountable operational owner",
);
assert.ok(
  answerSource.includes("authorised SAP user"),
  "The deterministic answer must preserve the SAP read-only boundary",
);

assert.equal(scenarios.length, 6, "VOR-058 requires six natural variants");
assert.ok(
  scenarios.some(
    (scenario) =>
      scenario.question.trim().toLowerCase() ===
      "what is the biggest risk today?",
  ),
  "The exact production question must remain in the authenticated VOR-058 suite",
);
for (const scenario of scenarios) {
  assert.deepEqual(
    scenario.expectedTools,
    ["get_site_operational_snapshot"],
    `${scenario.id} must use one authorised site snapshot`,
  );
  assert.equal(
    scenario.maxToolCount,
    1,
    `${scenario.id} must suppress redundant specialist calls`,
  );
  assert.ok(
    scenario.maxDurationMs <= 18_000,
    `${scenario.id} must retain the production p95 ceiling`,
  );
  assert.notEqual(
    scenario.requireActionPlan,
    false,
    `${scenario.id} must remain decision-ready`,
  );
}

for (const required of [
  "failed to fetch dynamically imported module",
  "STALE_ASSET_RECOVERY_KEY",
  "STALE_ASSET_RECOVERY_WINDOW_MS",
  "scheduleStaleAssetRecovery",
  "window.location.reload()",
  "data-stale-asset-recovery",
]) {
  assert.ok(
    errorBoundarySource.includes(required),
    `Stale application recovery must retain ${required}`,
  );
}
assert.ok(
  errorBoundarySource.includes("Without a loop guard an automatic reload could repeat forever."),
  "Automatic stale-asset recovery must fail closed when the session loop guard is unavailable",
);
assert.match(
  netlifyHeadersSource,
  /\/\*\s+Cache-Control: no-store, no-cache, must-revalidate, max-age=0/,
  "SPA and HTML responses must revalidate across production releases",
);
assert.match(
  netlifyHeadersSource,
  /\/assets\/\*\s+Cache-Control: public, max-age=31536000, immutable/,
  "Content-hashed assets must remain immutable and long cached",
);
assert.match(
  netlifyHeadersSource,
  /\/vorta-build\.json\s+Cache-Control: no-store, no-cache, must-revalidate, max-age=0/,
  "Build metadata must never be served stale",
);

for (const required of [
  '"netlify/functions/ask-vorta/**"',
  '"scripts/vor-058*"',
  '"tests/evals/vor-058-site-priority-performance.json"',
  "Start exact-source Ask Vorta evaluation server",
  "Run six authenticated VOR-058 site-priority decisions",
  "VORTA_EVAL_BASE_URL: http://127.0.0.1:8788",
  "npm run eval:ask-vorta:vor058",
  "vor-058-live-eval.log",
]) {
  assert.ok(
    workflowSource.includes(required),
    `The central exact-source gate must retain ${required}`,
  );
}
assert.doesNotMatch(
  workflowSource,
  /VORTA_EVAL_BASE_URL:\s*https:\/\/vorta-app\.netlify\.app/,
  "VOR-058 pull-request decisions must not run against stale production",
);
for (const required of [
  'entryPoints: ["netlify/functions/ask-vorta.mts"]',
  'globalThis.Netlify =',
  'requestId: randomUUID()',
  'server.listen(port, host',
]) {
  assert.ok(
    localServerSource.includes(required),
    `The exact-source local function wrapper must retain ${required}`,
  );
}

assert.ok(
  suiteSource.includes("VOR-058 site-priority performance"),
  "The permanent contract suite must register VOR-058",
);
assert.ok(
  packageSource.includes('"eval:ask-vorta:vor058"'),
  "package.json must expose the authenticated VOR-058 evaluation",
);

console.log(
  "VOR-058 contracts passed: deterministic site-priority routing, one-snapshot tool suppression, the exact production question, decision-ready ranked answers, bounded stale-asset recovery, coherent Netlify caching, exact-source authenticated execution, latency limits and SAP read-only wording are protected.",
);
