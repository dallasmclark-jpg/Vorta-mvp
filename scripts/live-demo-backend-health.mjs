import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = String(process.env[name] ?? "").trim();
  assert.ok(value, `${name} is required for the live backend health gate`);
  return value;
};

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const isTransientSchemaCacheError = (error) =>
  error?.code === "PGRST002" ||
  /schema cache|retrying/i.test(String(error?.message ?? ""));

const supabaseUrl = required("VITE_SUPABASE_URL");
const supabaseKey = required("VITE_SUPABASE_ANON_KEY");
const email = required("VORTA_E2E_EMAIL");
const password = required("VORTA_E2E_PASSWORD");
const expectedSiteId = required("VORTA_E2E_SITE_ID");

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const { data: signIn, error: signInError } =
  await supabase.auth.signInWithPassword({ email, password });
assert.ifError(signInError);
assert.ok(signIn.user, "Authenticated health gate did not receive a user");

const readHealthReport = async () => {
  let lastError = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const { data, error } = await supabase.rpc("vorta_get_demo_backend_health");

    if (!error) return data;

    lastError = error;
    if (!isTransientSchemaCacheError(error) || attempt === 5) break;

    const retryDelay = 500 * 2 ** (attempt - 1);
    console.warn(
      `Live backend health schema cache is unavailable; retrying in ${retryDelay}ms (${attempt}/5).`,
    );
    await sleep(retryDelay);
  }

  assert.ifError(lastError);
  return null;
};

try {
  const data = await readHealthReport();
  assert.ok(data && typeof data === "object", "Health RPC returned no report");

  assert.equal(data.siteId, expectedSiteId, "Health report returned the wrong site");
  assert.equal(data.healthy, true, "Live demo backend health is not green");
  assert.ok(Number(data.assetCount) > 0, "Health report contains no equipment assets");

  for (const [key, value] of Object.entries(data.coverage ?? {})) {
    assert.equal(Number(value), 0, `Coverage health failed: ${key}=${value}`);
  }
  for (const [key, value] of Object.entries(data.integrity ?? {})) {
    assert.equal(Number(value), 0, `Integrity health failed: ${key}=${value}`);
  }
  for (const [key, value] of Object.entries(data.maintenanceTruth ?? {})) {
    assert.equal(Number(value), 0, `Maintenance truth failed: ${key}=${value}`);
  }

  assert.ok(
    Number(data.realism?.largestIdenticalSignatureGroup ?? 0) <= 1,
    "Demo work histories have collapsed into repeated identical signatures",
  );

  assert.ok(data.security && typeof data.security === "object", "Health report contains no RPC security contract");
  assert.equal(
    Number(data.security.reviewedAuthenticatedMutationRpcCount),
    15,
    "Authenticated mutation RPC manifest count has drifted",
  );
  assert.equal(
    Number(data.security.reviewedAuthenticatedReadRpcCount),
    49,
    "Authenticated read RPC manifest count has drifted",
  );
  assert.equal(
    Number(data.security.authenticatedSecurityDefinerRpcCount),
    61,
    "Authenticated SECURITY DEFINER RPC count has drifted",
  );
  assert.equal(
    Number(data.security.authenticatedSecurityInvokerRpcCount),
    3,
    "Authenticated SECURITY INVOKER RPC count has drifted",
  );
  assert.equal(
    Number(data.security.anonymousVortaRpcCount),
    0,
    "Anonymous Vorta RPC execution is not permitted",
  );
  assert.equal(
    Number(data.security.rpcSecurityManifestDriftCount),
    0,
    "RPC security manifest drift is not permitted",
  );

  console.log(
    JSON.stringify(
      {
        healthy: data.healthy,
        siteId: data.siteId,
        assetCount: data.assetCount,
        checkedAt: data.checkedAt,
        coverage: data.coverage,
        integrity: data.integrity,
        maintenanceTruth: data.maintenanceTruth,
        realism: data.realism,
        security: data.security,
      },
      null,
      2,
    ),
  );
} finally {
  await supabase.auth.signOut();
}
