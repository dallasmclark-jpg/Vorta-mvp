import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const baseMigration = read(
  "supabase/migrations/20260720193117_complete_rpc_security_manifest.sql",
);
const healthGrantMigration = read(
  "supabase/migrations/20260721175500_grant_authenticated_system_health_evidence.sql",
);
const healthManifestMigration = read(
  "supabase/migrations/20260721180500_extend_rpc_security_manifest_for_health_evidence.sql",
);
const manifest = JSON.parse(read("supabase/rpc-security-manifest.json"));
const liveHealthGate = read("scripts/live-demo-backend-health.mjs");
const contractRunner = read("scripts/run-contract-suite.mjs");

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.migrationVersion, "20260721180500");
assert.equal(manifest.migrationName, "extend_rpc_security_manifest_for_health_evidence");
assert.deepEqual(manifest.invariants, {
  authenticatedCallable: 64,
  reviewedRead: 49,
  reviewedMutation: 15,
  securityDefiner: 61,
  securityInvoker: 3,
  anonymousCallable: 0,
  manifestDrift: 0,
});

const invokerRpcs = [
  "vorta_get_equipment_history(uuid)",
  "vorta_get_equipment_documents(uuid)",
  "vorta_get_equipment_document(uuid,uuid)",
];
const healthEvidenceRpcs = [
  "vorta_get_system_health_summary()",
  "vorta_get_system_health_incidents(integer)",
  "vorta_get_latest_recovery_manifest()",
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
assert.deepEqual(
  manifest.healthEvidenceRpcs.map(({ identity }) => identity),
  healthEvidenceRpcs,
);
assert.deepEqual(manifest.revokedPublicHelpers, revokedHelpers);

for (const rpcIdentity of invokerRpcs) {
  assert.ok(
    baseMigration.includes(`'${rpcIdentity}'`),
    `Missing invoker RPC manifest row: ${rpcIdentity}`,
  );
}
for (const rpcIdentity of healthEvidenceRpcs) {
  assert.ok(
    healthManifestMigration.includes(`'${rpcIdentity}'`),
    `Missing health evidence RPC manifest row: ${rpcIdentity}`,
  );
  const [functionName] = rpcIdentity.split("(");
  assert.ok(
    healthGrantMigration.includes(`grant execute on function public.${functionName}`),
    `Missing authenticated execute grant for ${rpcIdentity}`,
  );
}
for (const helperIdentity of revokedHelpers) {
  const [functionName] = helperIdentity.split("(");
  const argumentsText = helperIdentity.slice(functionName.length + 1, -1);
  assert.ok(
    baseMigration.includes(
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
]) {
  assert.ok(baseMigration.includes(expected), `Missing base RPC manifest contract: ${expected}`);
}

for (const expected of [
  "reviewed_count <> 64",
  "read_count <> 49",
  "mutation_count <> 15",
  "definer_count <> 61",
  "invoker_count <> 3",
  "anon_count <> 0",
]) {
  assert.ok(
    healthManifestMigration.includes(expected),
    `Missing extended RPC manifest invariant: ${expected}`,
  );
}

for (const expected of [
  "data.security",
  "reviewedAuthenticatedMutationRpcCount",
  "reviewedAuthenticatedReadRpcCount",
  "authenticatedSecurityDefinerRpcCount",
  "authenticatedSecurityInvokerRpcCount",
  "anonymousVortaRpcCount",
  "rpcSecurityManifestDriftCount",
  "49",
  "61",
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
