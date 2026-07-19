import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260719235900_harden_privileged_rpcs.sql",
    import.meta.url,
  ),
  "utf8",
);

for (const helper of [
  "vorta_can_administer_pilot(uuid)",
  "vorta_get_function_context()",
  "vorta_get_latest_recovery_manifest()",
  "vorta_get_operational_audit_events(integer)",
  "vorta_get_system_health_incidents(integer)",
  "vorta_get_system_health_summary()",
]) {
  assert.ok(
    migration.includes(`revoke execute on function public.${helper}`),
    `Authenticated access was not revoked from ${helper}`,
  );
}

for (const expected of [
  "private.vorta_privileged_rpc_allowlist",
  "private.vorta_get_unreviewed_authenticated_mutation_rpcs",
  "has_function_privilege('authenticated'",
  "Requires vorta_can_manage_site before any mutation.",
  "Requires auth.uid(), site access and vorta_can_administer_pilot inside the wrapper.",
  "work_order_goods_movements_component_id_idx",
  "vorta_recovery_manifests_latest_health_run_id_idx",
  "unreviewedAuthenticatedMutationRpcCount",
  "reviewedAuthenticatedMutationRpcCount",
]) {
  assert.ok(migration.includes(expected), `Missing privileged RPC contract: ${expected}`);
}

assert.match(
  migration,
  /function_row\.proname ~ '\^vorta_\(launch\|update\|record\|refresh\|recalculate\|log\|track\|upsert\)'/,
);
assert.match(migration, /and allowlist\.rpc_identity is null/);
assert.match(migration, /if v_unreviewed is not null then/);
assert.doesNotMatch(
  migration,
  /revoke execute on function public\.vorta_get_demo_backend_health/,
);
assert.doesNotMatch(
  migration,
  /revoke execute on function public\.vorta_get_shift_cover_snapshot/,
);

console.log("Privileged RPC hardening contracts passed.");
