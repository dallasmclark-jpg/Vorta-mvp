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
const askVortaManifestMigration = read(
  "supabase/migrations/20260726233000_register_shift_cover_ai_brief_rpc.sql",
);
const handoverManifestMigration = read(
  "supabase/migrations/20260728140000_register_shift_handover_workflow_rpcs.sql",
);
const handoverGrantMigration = read(
  "supabase/migrations/20260728133000_restrict_shift_handover_rpc_anon.sql",
);
const operationalValueManifestMigration = read(
  "supabase/migrations/20260803115400_vor_044_register_operational_value_rpc.sql",
);
const manifest = JSON.parse(read("supabase/rpc-security-manifest.json"));
const liveHealthGate = read("scripts/live-demo-backend-health.mjs");
const contractRunner = read("scripts/run-contract-suite.mjs");

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.migrationVersion, "20260803115400");
assert.equal(manifest.migrationName, "vor_044_register_operational_value_rpc");
assert.deepEqual(manifest.invariants, {
  authenticatedCallable: 70,
  reviewedRead: 52,
  reviewedMutation: 18,
  securityDefiner: 67,
  securityInvoker: 3,
  anonymousCallable: 0,
  manifestDrift: 0,
});
assert.ok(
  askVortaManifestMigration.includes("vorta_get_shift_cover_ai_brief(uuid,date,date)") &&
    askVortaManifestMigration.includes("'read'") &&
    askVortaManifestMigration.includes("'definer'"),
  "Ask Vorta Shift Cover evidence RPC is missing from the reviewed manifest migration",
);
assert.ok(
  operationalValueManifestMigration.includes("vorta_get_ranked_operational_actions(uuid,integer)") &&
    operationalValueManifestMigration.includes("'read'") &&
    operationalValueManifestMigration.includes("'definer'") &&
    operationalValueManifestMigration.includes("false"),
  "Ask Vorta operational-value RPC is missing from the reviewed manifest migration",
);
assert.ok(
  manifest.askVortaEvidenceRpcs.some(
    ({ identity }) => identity === "vorta_get_ranked_operational_actions(uuid,integer)",
  ),
  "The canonical manifest does not list the Ask Vorta operational-value RPC",
);

const shiftHandoverWorkflowRpcs = [
  {
    identity: "vorta_get_shift_handover_actions(uuid,timestamp with time zone,timestamp with time zone)",
    rpcClass: "read",
  },
  {
    identity: "vorta_save_shift_handover_action(uuid,uuid,timestamp with time zone,timestamp with time zone,text,text,text,timestamp with time zone,integer)",
    rpcClass: "mutation",
  },
  {
    identity: "vorta_acknowledge_shift_handover_action(uuid,integer)",
    rpcClass: "mutation",
  },
  {
    identity: "vorta_carry_forward_shift_handover_action(uuid,integer,timestamp with time zone,timestamp with time zone,timestamp with time zone)",
    rpcClass: "mutation",
  },
];
assert.deepEqual(
  manifest.shiftHandoverWorkflowRpcs.map(({ identity, class: rpcClass }) => ({
    identity,
    rpcClass,
  })),
  shiftHandoverWorkflowRpcs,
);
for (const { identity, rpcClass } of shiftHandoverWorkflowRpcs) {
  assert.ok(
    handoverManifestMigration.includes(`'${identity}'`) &&
      handoverManifestMigration.includes(`'${rpcClass}'`) &&
      handoverManifestMigration.includes("'definer'") &&
      handoverManifestMigration.includes("false"),
    `Shift Handover RPC is missing from the reviewed security manifest: ${identity}`,
  );
  const [functionName] = identity.split("(");
  assert.ok(
    handoverGrantMigration.includes(`revoke all on function public.${functionName}`) &&
      handoverGrantMigration.includes(`grant execute on function public.${functionName}`),
    `Shift Handover RPC grants are incomplete: ${identity}`,
  );
}
for (const expected of [
  "reviewed_count <> 69",
  "read_count <> 51",
  "mutation_count <> 18",
  "definer_count <> 66",
  "invoker_count <> 3",
  "anon_count <> 0",
  "drift_count <> 0",
]) {
  assert.ok(
    handoverManifestMigration.includes(expected),
    `Missing Shift Handover RPC manifest invariant: ${expected}`,
  );
}

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
  "18",
  "52",
  "67",
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
