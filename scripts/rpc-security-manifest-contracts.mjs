import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read(
  "supabase/migrations/20260720193117_complete_rpc_security_manifest.sql",
);
const manifest = JSON.parse(read("supabase/rpc-security-manifest.json"));
const liveHealthGate = read("scripts/live-demo-backend-health.mjs");
const contractRunner = read("scripts/run-contract-suite.mjs");

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.migrationVersion, "20260720193117");
assert.deepEqual(manifest.invariants, {
  authenticatedCallable: 61,
  reviewedRead: 46,
  reviewedMutation: 15,
  securityDefiner: 58,
  securityInvoker: 3,
  anonymousCallable: 0,
  manifestDrift: 0,
});

const invokerRpcs = [
  "vorta_get_equipment_history(uuid)",
  "vorta_get_equipment_documents(uuid)",
  "vorta_get_equipment_document(uuid,uuid)",
];
const revokedHelpers = [
  "vorta_effective_pm_status(text,date)",
  "vorta_spare_component_risk_points(text,text)",
  "vorta_work_order_is_overdue(text,date)",
];

assert.deepEqual(
  manifest.securityInvokerRpcs.map(({ identity }) => identity),
  invokerRpcs,
);
assert.deepEqual(manifest.revokedPublicHelpers, revokedHelpers);

for (const rpcIdentity of invokerRpcs) {
  assert.ok(
    migration.includes(`'${rpcIdentity}'`),
    `Missing invoker RPC manifest row: ${rpcIdentity}`,
  );
}
for (const helperIdentity of revokedHelpers) {
  const [functionName] = helperIdentity.split("(");
  const argumentsText = helperIdentity.slice(functionName.length + 1, -1);
  assert.ok(
    migration.includes(
      `revoke execute on function public.${functionName}(${argumentsText})`,
    ),
    `Missing helper execute revocation: ${helperIdentity}`,
  );
}

for (const expected of [
  "add column if not exists security_mode",
  "add column if not exists anonymous_execute",
  "security_mode in ('definer', 'invoker')",
  "private.vorta_get_rpc_security_manifest_drift",
  "missing_manifest",
  "stale_manifest",
  "security_mode_mismatch",
  "anonymous_execute",
  "missing_fixed_search_path",
  "missing_service_role_execute",
  "anonymous_contract_mismatch",
  "rpc_security_manifest_drift",
  "authenticatedSecurityDefinerRpcCount",
  "authenticatedSecurityInvokerRpcCount",
  "anonymousVortaRpcCount",
  "rpcSecurityManifestDriftCount",
  "reviewed_count <> 61",
  "read_count <> 46",
  "mutation_count <> 15",
  "definer_count <> 58",
  "invoker_count <> 3",
  "anon_count <> 0",
]) {
  assert.ok(migration.includes(expected), `Missing RPC manifest contract: ${expected}`);
}

for (const expected of [
  "data.security",
  "reviewedAuthenticatedMutationRpcCount",
  "reviewedAuthenticatedReadRpcCount",
  "authenticatedSecurityDefinerRpcCount",
  "authenticatedSecurityInvokerRpcCount",
  "anonymousVortaRpcCount",
  "rpcSecurityManifestDriftCount",
]) {
  assert.ok(
    liveHealthGate.includes(expected),
    `Authenticated health gate does not enforce: ${expected}`,
  );
}

assert.ok(
  contractRunner.includes(
    '"scripts/rpc-security-manifest-contracts.mjs"',
  ),
  "The production contract manifest must enforce the RPC security manifest",
);

console.log("RPC security manifest contracts passed.");
