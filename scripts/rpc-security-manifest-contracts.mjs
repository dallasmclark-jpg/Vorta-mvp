import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const engineerCalendarMigration = read(
  "supabase/migrations/20260904103500_register_engineer_calendar_rpc_security.sql",
);
const manifest = JSON.parse(read("supabase/rpc-security-manifest.json"));
const liveHealthGate = read("scripts/live-demo-backend-health.mjs");
const contractRunner = read("scripts/run-contract-suite.mjs");

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.migrationVersion, "20260904103500");
assert.equal(manifest.migrationName, "register_engineer_calendar_rpc_security");
assert.deepEqual(manifest.invariants, {
  authenticatedCallable: 82,
  reviewedRead: 58,
  reviewedMutation: 24,
  securityDefiner: 6,
  securityInvoker: 76,
  anonymousCallable: 0,
  manifestDrift: 0,
});

const expectedEngineerCalendarRpcs = [
  {
    identity: "vorta_ask_my_calendar(uuid,text)",
    rpcClass: "read",
  },
  {
    identity: "vorta_delete_my_engineer_calendar_entry(uuid,uuid)",
    rpcClass: "mutation",
  },
  {
    identity: "vorta_get_engineer_rota_window(uuid,date,date)",
    rpcClass: "read",
  },
  {
    identity: "vorta_get_my_engineer_calendar(uuid,date,date)",
    rpcClass: "read",
  },
  {
    identity: "vorta_save_my_engineer_calendar_entry(uuid,date,text,text,text,numeric,text,text,uuid,uuid)",
    rpcClass: "mutation",
  },
  {
    identity: "vorta_save_my_engineer_calendar_entry_v2(uuid,date,text,text,text,numeric,text,text,uuid,uuid,text)",
    rpcClass: "mutation",
  },
];

assert.deepEqual(
  manifest.engineerCalendarRpcs.map(({ identity, class: rpcClass }) => ({
    identity,
    rpcClass,
  })),
  expectedEngineerCalendarRpcs,
);

for (const { identity, rpcClass } of expectedEngineerCalendarRpcs) {
  const [functionName] = identity.split("(");
  assert.ok(
    engineerCalendarMigration.includes(`'${identity}'`) &&
      engineerCalendarMigration.includes(`'${rpcClass}'`) &&
      engineerCalendarMigration.includes("'definer'") &&
      engineerCalendarMigration.includes("false"),
    `Engineer calendar RPC is missing from the reviewed security manifest: ${identity}`,
  );
  assert.ok(
    engineerCalendarMigration.includes(`revoke execute on function public.${functionName}`) &&
      engineerCalendarMigration.includes(`grant execute on function public.${functionName}`),
    `Engineer calendar RPC grants are incomplete: ${identity}`,
  );
}

assert.match(
  engineerCalendarMigration,
  /\^vorta_\(launch\|update\|record\|refresh\|recalculate\|log\|track\|upsert\|save\|delete\|acknowledge\|carry\|create\|confirm\|cancel\)/,
  "Mutation classifier must include delete RPCs",
);
assert.match(
  engineerCalendarMigration,
  /from public, anon/,
  "Engineer calendar RPCs must revoke anonymous execution",
);
assert.match(
  engineerCalendarMigration,
  /to authenticated, service_role/,
  "Engineer calendar RPCs must retain authenticated and service-role execution",
);

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

assert.match(liveHealthGate, /reviewedAuthenticatedMutationRpcCount\),\s*24/);
assert.match(liveHealthGate, /reviewedAuthenticatedReadRpcCount\),\s*58/);
assert.match(liveHealthGate, /authenticatedSecurityDefinerRpcCount\),\s*6/);
assert.match(liveHealthGate, /authenticatedSecurityInvokerRpcCount\),\s*76/);
assert.match(liveHealthGate, /anonymousVortaRpcCount\),\s*0/);
assert.match(liveHealthGate, /rpcSecurityManifestDriftCount\),\s*0/);

assert.ok(
  contractRunner.includes('"scripts/rpc-security-manifest-contracts.mjs"'),
  "The production contract manifest must enforce the RPC security manifest",
);

console.log("RPC security manifest contracts passed.");
