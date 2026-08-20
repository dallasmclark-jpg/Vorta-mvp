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
const askVortaActionManifestMigration = read(
  "supabase/migrations/20260803175800_vor_047_register_action_rpcs.sql",
);
const documentAccessManifestMigration = read(
  "supabase/migrations/20260806113100_vor_061_register_document_access_state_rpc.sql",
);
const historicalBacktestManifestMigration = read(
  "supabase/migrations/20260807224558_vor_069_register_historical_backtest_rpc.sql",
);
const securityInvokerContractMigration = read(
  "supabase/migrations/20260820211200_vor_093_sync_security_invoker_contract.sql",
);
const manifest = JSON.parse(read("supabase/rpc-security-manifest.json"));
const liveHealthGate = read("scripts/live-demo-backend-health.mjs");
const contractRunner = read("scripts/run-contract-suite.mjs");

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.migrationVersion, "20260820211200");
assert.equal(manifest.migrationName, "vor_093_sync_security_invoker_contract");
assert.deepEqual(manifest.invariants, {
  authenticatedCallable: 76,
  reviewedRead: 55,
  reviewedMutation: 21,
  securityDefiner: 0,
  securityInvoker: 76,
  anonymousCallable: 0,
  manifestDrift: 0,
});
assert.match(manifest.securityPolicy, /SECURITY INVOKER/);
assert.match(manifest.securityPolicy, /anonymous execution is revoked/);

for (const expected of [
  "ALTER FUNCTION %s SECURITY INVOKER",
  "security_mode = 'invoker'",
  "anonymous_execute = false",
  "vor_093_sync_security_invoker_contract",
  "v_reviewed <> 76",
  "v_read <> 55",
  "v_mutation <> 21",
  "v_definer <> 0",
  "v_invoker <> 76",
  "v_anon <> 0",
  "v_drift <> 0",
]) {
  assert.ok(
    securityInvokerContractMigration.includes(expected),
    `Missing current RPC invoker contract invariant: ${expected}`,
  );
}

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
assert.ok(
  manifest.askVortaEvidenceRpcs.some(
    ({ identity }) => identity === "vorta_get_historical_backtest(uuid,uuid,text,integer)",
  ),
  "The canonical manifest does not list the VOR-069 historical backtest RPC",
);
assert.ok(
  historicalBacktestManifestMigration.includes(
    "'vorta_get_historical_backtest(uuid,uuid,text,integer)'",
  ) &&
    historicalBacktestManifestMigration.includes("'read'") &&
    historicalBacktestManifestMigration.includes("'definer'") &&
    historicalBacktestManifestMigration.includes("false") &&
    historicalBacktestManifestMigration.includes("vorta_has_site_access"),
  "VOR-069 historical backtest RPC is missing from the reviewed security manifest migration",
);
for (const expected of [
  "v_drift <> 0",
  "v_read <> 55",
  "v_mutation <> 21",
  "v_definer <> 72",
  "v_invoker <> 4",
  "v_anon <> 0",
]) {
  assert.ok(
    historicalBacktestManifestMigration.includes(expected),
    `Missing VOR-069 RPC manifest invariant: ${expected}`,
  );
}

const askVortaActionRpcs = [
  {
    identity: "vorta_create_ask_vorta_action_draft(uuid,uuid,text,text,uuid,text,text,text,text,text,jsonb,jsonb,text)",
    rpcClass: "mutation",
  },
  {
    identity: "vorta_get_ask_vorta_action_draft(uuid)",
    rpcClass: "read",
  },
  {
    identity: "vorta_cancel_ask_vorta_action(uuid,integer)",
    rpcClass: "mutation",
  },
  {
    identity: "vorta_confirm_ask_vorta_action(uuid,integer)",
    rpcClass: "mutation",
  },
];
assert.deepEqual(
  manifest.askVortaActionRpcs.map(({ identity, class: rpcClass }) => ({
    identity,
    rpcClass,
  })),
  askVortaActionRpcs,
);
for (const { identity, rpcClass } of askVortaActionRpcs) {
  assert.ok(
    askVortaActionManifestMigration.includes(`'${identity}'`) &&
      askVortaActionManifestMigration.includes(`'${rpcClass}'`) &&
      askVortaActionManifestMigration.includes("'definer'") &&
      askVortaActionManifestMigration.includes("false"),
    `Ask Vorta controlled-action RPC is missing from the reviewed security manifest: ${identity}`,
  );
}
assert.match(
  askVortaActionManifestMigration,
  /Dispatch is limited to the existing vorta_save_shift_handover_action RPC/,
);
assert.doesNotMatch(
  askVortaActionManifestMigration,
  /maintenance work-request creation|spare-stock task creation/i,
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

const legacyInvokerRpcs = [
  "vorta_get_equipment_history(uuid)",
  "vorta_get_equipment_documents(uuid)",
  "vorta_get_equipment_document(uuid,uuid)",
];
const documentAccessRpc =
  "vorta_get_equipment_document_access_state(uuid,uuid)";
const invokerRpcs = [...legacyInvokerRpcs, documentAccessRpc];
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

for (const rpcIdentity of legacyInvokerRpcs) {
  assert.ok(
    baseMigration.includes(`'${rpcIdentity}'`),
    `Missing invoker RPC manifest row: ${rpcIdentity}`,
  );
}
assert.ok(
  documentAccessManifestMigration.includes(`'${documentAccessRpc}'`) &&
    documentAccessManifestMigration.includes("'read'") &&
    documentAccessManifestMigration.includes("'invoker'") &&
    documentAccessManifestMigration.includes("false"),
  "The bounded document access-state RPC is missing from the reviewed manifest migration",
);
for (const expected of [
  "v_drift <> 0",
  "v_read <> 54",
  "v_mutation <> 21",
  "v_definer <> 71",
  "v_invoker <> 4",
  "v_anon <> 0",
]) {
  assert.ok(
    documentAccessManifestMigration.includes(expected),
    `Missing VOR-061 RPC manifest invariant: ${expected}`,
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
  "const reviewedRpcCount",
  "const callableRpcCount",
  "callableRpcCount",
  "reviewedRpcCount",
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
