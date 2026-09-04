import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const ranking = read("supabase/migrations/20260803113112_vor_044_rank_operational_actions.sql");
const invariants = read("supabase/migrations/20260803113243_vor_044_operational_value_invariants.sql");
const manifest = read("supabase/migrations/20260803115400_vor_044_register_operational_value_rpc.sql");
const canonicalBackend = [
  "netlify/functions/ask-vorta/contracts.mts",
  "netlify/functions/ask-vorta/tool-execution.mts",
  "netlify/functions/ask-vorta/decision-answer.mts",
  "netlify/functions/ask-vorta/route-planning.mts",
  "netlify/functions/ask-vorta/runtime.mts",
].map(read).join("\n");
const healthGate = read("scripts/live-demo-backend-health.mjs");
const packageJson = JSON.parse(read("package.json"));

for (const marker of [
  "vorta_get_ranked_operational_actions",
  "vorta_rank_operational_actions_internal",
  "operational_value_v1",
  "risk_reduction_points",
  "urgency_points",
  "readiness_points",
  "criticality_points",
  "efficiency_points",
  "confidence_points",
  "hard_dependencies text[]",
  "advisory_dependencies text[]",
  "current_risk_score numeric",
  "projected_risk_score numeric",
  "calculated_risk_reduction numeric",
  "confidence_score integer",
  "evidence_updated_at timestamptz",
  "security definer",
  "vorta_has_site_access",
  "set search_path to 'pg_catalog', 'public'",
]) assert.match(ranking, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

assert.match(ranking, /case when scored\.feasibility_state = 'ready_now' then 0 else 1 end/);
assert.match(invariants, /blocked work outranked executable work/);
assert.match(invariants, /operational-value score does not equal its returned components/);
assert.match(invariants, /has_function_privilege\('anon'/);
assert.match(manifest, /vorta_get_ranked_operational_actions\(uuid,integer\)/);
assert.match(manifest, /'read'/);
assert.match(manifest, /'definer'/);
assert.match(manifest, /false/);
assert.match(healthGate, /reviewedAuthenticatedMutationRpcCount\),\s*26/);
assert.match(healthGate, /reviewedAuthenticatedReadRpcCount\),\s*58/);
assert.match(healthGate, /authenticatedSecurityDefinerRpcCount\),\s*6/);
assert.match(healthGate, /authenticatedSecurityInvokerRpcCount\),\s*78/);
assert.match(canonicalBackend, /case "get_site_ranked_actions":/);
assert.match(canonicalBackend, /rankedActions/);
assert.match(canonicalBackend, /vorta_get_ranked_operational_actions/);
assert.match(canonicalBackend, /Equipment operational-value ranking/);
assert.match(canonicalBackend, /Score components:/);
assert.match(canonicalBackend, /hardDependencies/);

assert.equal(packageJson.scripts.prebuild, "node scripts/validate-live-pilot.mjs");
assert.equal(
  packageJson.scripts.build,
  "npm run build:metadata && npm run typecheck && npm run test:contracts && npm run test:smoke && vite build",
);
assert.equal(
  packageJson.scripts["build:metadata"],
  "node scripts/write-build-metadata.mjs",
);
assert.equal(
  packageJson.scripts.predev,
  "node scripts/vor-053-canonical-build-contracts.mjs --quick",
);
assert.equal(
  packageJson.scripts["test:contracts"],
  "node scripts/run-contract-suite.mjs",
);

console.log("VOR-044 operational-value ranking contracts passed.");
