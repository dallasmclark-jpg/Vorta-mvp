import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const engineerCalendarMigration = read(
  "supabase/migrations/20260904103500_register_engineer_calendar_rpc_security.sql",
);
const onboardingSecurityMigration = read(
  "supabase/migrations/20260904215000_harden_site_onboarding_rpc_security.sql",
);
const manifest = JSON.parse(read("supabase/rpc-security-manifest.json"));
const liveHealthGate = read("scripts/live-demo-backend-health.mjs");
const contractRunner = read("scripts/run-contract-suite.mjs");

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.migrationVersion, "20260904215000");
assert.equal(manifest.migrationName, "harden_site_onboarding_rpc_security");
assert.deepEqual(manifest.invariants, {
  authenticatedCallable: 84,
  reviewedRead: 58,
  reviewedMutation: 26,
  securityDefiner: 6,
  securityInvoker: 78,
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

const expectedSiteOnboardingRpcs = [
  {
    identity: "vorta_bootstrap_site_owner(text,text,text,text,text,text)",
    rpcClass: "mutation",
  },
  {
    identity: "vorta_accept_site_invitation(uuid,text)",
    rpcClass: "mutation",
  },
];

assert.deepEqual(
  manifest.siteOnboardingRpcs.map(({ identity, class: rpcClass }) => ({
    identity,
    rpcClass,
  })),
  expectedSiteOnboardingRpcs,
);

for (const { identity } of expectedSiteOnboardingRpcs) {
  const [functionName] = identity.split("(");
  assert.ok(
    onboardingSecurityMigration.includes(`'${identity}'`) &&
      onboardingSecurityMigration.includes("'mutation'") &&
      onboardingSecurityMigration.includes("'invoker'") &&
      onboardingSecurityMigration.includes("false"),
    `Site onboarding RPC is missing from the reviewed security manifest: ${identity}`,
  );
  assert.ok(
    onboardingSecurityMigration.includes(`revoke execute on function public.${functionName}`) &&
      onboardingSecurityMigration.includes(`grant execute on function public.${functionName}`),
    `Site onboarding RPC grants are incomplete: ${identity}`,
  );
}

assert.match(
  onboardingSecurityMigration,
  /create or replace function private\.vorta_bootstrap_site_owner[\s\S]*security definer/,
  "Site bootstrap privilege-bearing implementation must live in the private schema",
);
assert.match(
  onboardingSecurityMigration,
  /create or replace function public\.vorta_bootstrap_site_owner[\s\S]*language sql[\s\S]*from private\.vorta_bootstrap_site_owner/,
  "Site bootstrap public entrypoint must be an invoker wrapper",
);
assert.match(
  onboardingSecurityMigration,
  /create or replace function private\.vorta_accept_site_invitation[\s\S]*security definer/,
  "Invitation privilege-bearing implementation must live in the private schema",
);
assert.match(
  onboardingSecurityMigration,
  /create or replace function public\.vorta_accept_site_invitation[\s\S]*language sql[\s\S]*from private\.vorta_accept_site_invitation/,
  "Invitation public entrypoint must be an invoker wrapper",
);
assert.match(
  onboardingSecurityMigration,
  /\^vorta_\(launch\|update\|record\|refresh\|recalculate\|log\|track\|upsert\|save\|delete\|acknowledge\|carry\|create\|confirm\|cancel\|bootstrap\|accept\)/,
  "Mutation classifier must classify bootstrap and invitation acceptance as mutations",
);
assert.match(
  onboardingSecurityMigration,
  /from public, anon/,
  "Site onboarding RPCs must revoke anonymous execution",
);
assert.match(
  onboardingSecurityMigration,
  /to authenticated, service_role/,
  "Site onboarding RPCs must retain authenticated and service-role execution",
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

assert.match(liveHealthGate, /reviewedAuthenticatedMutationRpcCount\),\s*26/);
assert.match(liveHealthGate, /reviewedAuthenticatedReadRpcCount\),\s*58/);
assert.match(liveHealthGate, /authenticatedSecurityDefinerRpcCount\),\s*6/);
assert.match(liveHealthGate, /authenticatedSecurityInvokerRpcCount\),\s*78/);
assert.match(liveHealthGate, /anonymousVortaRpcCount\),\s*0/);
assert.match(liveHealthGate, /rpcSecurityManifestDriftCount\),\s*0/);

assert.ok(
  contractRunner.includes('"scripts/rpc-security-manifest-contracts.mjs"'),
  "The production contract manifest must enforce the RPC security manifest",
);

console.log("RPC security manifest contracts passed.");
