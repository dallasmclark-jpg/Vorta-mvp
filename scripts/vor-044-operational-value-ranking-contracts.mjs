import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (path) => readFileSync(path, "utf8");
const ranking = read("supabase/migrations/20260803113112_vor_044_rank_operational_actions.sql");
const invariants = read("supabase/migrations/20260803113243_vor_044_operational_value_invariants.sql");
const manifest = read("supabase/migrations/20260803115400_vor_044_register_operational_value_rpc.sql");
const integration = read("scripts/vor-044-integrate-operational-value.mjs");
const healthGate = read("scripts/live-demo-backend-health.mjs");
const packageJson = JSON.parse(read("package.json"));

assert.equal(
  spawnSync(process.execPath, ["--check", "scripts/vor-044-integrate-operational-value.mjs"]).status,
  0,
  "VOR-044 integration codemod must have valid syntax",
);

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
assert.match(healthGate, /reviewedAuthenticatedReadRpcCount\),\s*53/);
assert.match(healthGate, /authenticatedSecurityDefinerRpcCount\),\s*71/);
assert.match(integration, /case "get_site_ranked_actions":/);
assert.match(integration, /rankedActions/);
assert.match(integration, /vorta_get_ranked_operational_actions/);
assert.match(integration, /Equipment operational-value ranking/);
assert.match(integration, /Score components:/);
assert.match(integration, /hardDependencies/);
assert.match(integration, /const targetPath = "netlify\/functions\/ask-vorta\.mts"/);
assert.doesNotMatch(integration, /src\/screens\/|src\/components\//);

assert.equal(packageJson.scripts.prebuild, "node scripts/validate-live-pilot.mjs");
assert.equal(
  packageJson.scripts.build,
  "npm run build:metadata && npm run typecheck && npm run test:contracts && npm run test:smoke && vite build",
);
assert.match(
  packageJson.scripts["build:metadata"],
  /^node scripts\/vor-044-integrate-operational-value\.mjs(?: && node scripts\/vor-045-normalise-request-context\.mjs && node scripts\/vor-045-integrate-conversation-context\.mjs)?(?: && node scripts\/vor-046-integrate-image-backend\.mjs && node scripts\/vor-046-integrate-image-client\.mjs)?(?: && node scripts\/vor-047-integrate-confirmed-actions\.mjs)?(?: && node scripts\/vor-048-integrate-routing-telemetry-feedback\.mjs)?(?: && node scripts\/vor-049-integrate-decision-ready-equipment\.mjs)? && node scripts\/write-build-metadata\.mjs$/,
);
assert.equal(packageJson.scripts["pretest:contracts"], undefined);
assert.match(
  packageJson.scripts.predev,
  /^node scripts\/vor-044-integrate-operational-value\.mjs(?: && node scripts\/vor-045-normalise-request-context\.mjs && node scripts\/vor-045-integrate-conversation-context\.mjs)?(?: && node scripts\/vor-046-integrate-image-backend\.mjs && node scripts\/vor-046-integrate-image-client\.mjs)?(?: && node scripts\/vor-047-integrate-confirmed-actions\.mjs)?(?: && node scripts\/vor-048-integrate-routing-telemetry-feedback\.mjs)?(?: && node scripts\/vor-049-integrate-decision-ready-equipment\.mjs)?$/,
);

console.log("VOR-044 operational-value ranking contracts passed.");
