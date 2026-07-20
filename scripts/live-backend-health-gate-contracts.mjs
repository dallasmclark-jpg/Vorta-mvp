import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const gate = read("scripts/live-demo-backend-health.mjs");
const packageJson = JSON.parse(read("package.json"));

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
  "signOut",
]) {
  assert.ok(gate.includes(expected), `Missing live health gate contract: ${expected}`);
}

assert.doesNotMatch(gate, /supabase\s*\.\s*from\s*\(/);
assert.doesNotMatch(gate, /vorta_(refresh|recalculate|sync)_/);
assert.doesNotMatch(gate, /\.(insert|update|upsert|delete)\s*\(/);
assert.ok(
  packageJson.scripts["test:contracts"].includes(
    "node scripts/live-backend-health-gate-contracts.mjs",
  ),
  "The protected contract gate must invoke live backend health contracts",
);

const hasMaintenanceTestContext = Boolean(
  process.env.VORTA_E2E_EMAIL ||
    process.env.VORTA_E2E_SITE_ID ||
    process.env.VORTA_E2E_PASSWORD,
);

if (hasMaintenanceTestContext) {
  for (const name of [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "VORTA_E2E_EMAIL",
    "VORTA_E2E_PASSWORD",
    "VORTA_E2E_SITE_ID",
  ]) {
    assert.ok(
      String(process.env[name] ?? "").trim(),
      `${name} is required when the authenticated Maintenance Manager test context is configured`,
    );
  }

  await import("./live-demo-backend-health.mjs");
  console.log("Authenticated live backend health gate passed.");
} else {
  console.log("Live backend health structure passed; authenticated check is reserved for the protected Maintenance Manager CI context.");
}
