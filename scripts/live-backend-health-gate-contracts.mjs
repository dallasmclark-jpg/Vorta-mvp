import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const gate = read("scripts/live-demo-backend-health.mjs");
const contractRunner = read("scripts/run-contract-suite.mjs");

for (const expected of [
  "signInWithPassword",
  "vorta_get_demo_backend_health",
  "data.healthy",
  "data.siteId",
  "data.assetCount",
  "data.coverage",
  "data.integrity",
  "data.maintenanceTruth",
  "data.security",
  "reviewedAuthenticatedMutationRpcCount",
  "reviewedAuthenticatedReadRpcCount",
  "authenticatedSecurityDefinerRpcCount",
  "authenticatedSecurityInvokerRpcCount",
  "anonymousVortaRpcCount",
  "rpcSecurityManifestDriftCount",
  "largestIdenticalSignatureGroup",
  "healthAttempts = 2",
  "error?.code === \"57014\"",
  "await delay(2_000)",
  "signOut",
]) {
  assert.ok(gate.includes(expected), `Missing live health gate contract: ${expected}`);
}

assert.doesNotMatch(gate, /supabase\s*\.\s*from\s*\(/);
assert.doesNotMatch(gate, /vorta_(refresh|recalculate|sync)_/);
assert.doesNotMatch(gate, /\.(insert|update|upsert|delete)\s*\(/);
assert.doesNotMatch(gate, /healthAttempts\s*=\s*[3-9]/, "The health check may retry only once.");
assert.ok(
  contractRunner.includes(
    '"scripts/live-backend-health-gate-contracts.mjs"',
  ),
  "The production contract manifest must invoke live backend health contracts",
);

const configuredEmail = String(process.env.VORTA_E2E_EMAIL ?? "").trim();
const configuredSiteId = String(process.env.VORTA_E2E_SITE_ID ?? "").trim();
const demoSiteId = "11000000-0000-0000-0000-000000000001";
if (!configuredSiteId && configuredEmail === "demo@vorta.network") {
  process.env.VORTA_E2E_SITE_ID = demoSiteId;
}

// The full contract suite is executed by many parallel workflows. Running the
// same authenticated database health RPC in every one creates a CI thundering
// herd and can manufacture statement-timeout failures under otherwise healthy
// production conditions. Keep structural coverage everywhere, but execute the
// live authenticated health assertion only in the single Maintenance Manager
// release gate (or when explicitly requested locally/CI).
const liveHealthRequested =
  process.env.VORTA_RUN_LIVE_BACKEND_HEALTH === "true" ||
  process.env.GITHUB_WORKFLOW === "Maintenance Manager quality gate";

if (liveHealthRequested) {
  for (const name of [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "VORTA_E2E_EMAIL",
    "VORTA_E2E_PASSWORD",
    "VORTA_E2E_SITE_ID",
  ]) {
    assert.ok(
      String(process.env[name] ?? "").trim(),
      `${name} is required when the authenticated live backend health gate is requested`,
    );
  }

  await import("./live-demo-backend-health.mjs");
  console.log("Authenticated live backend health gate passed.");
} else {
  console.log(
    "Live backend health structure passed; authenticated execution is serialized to the Maintenance Manager release gate.",
  );
}
