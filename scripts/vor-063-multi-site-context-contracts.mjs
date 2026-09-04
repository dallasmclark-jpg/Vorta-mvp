import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const auth = readFileSync("src/lib/auth.tsx", "utf8");
const helper = readFileSync("src/lib/siteAccessContext.ts", "utf8");

for (const required of [
  'siteAccesses: readonly SiteAccessGrant<PilotRole>[]',
  'selectSite: (siteId: string) => boolean',
  'const accessRows = (accessResult.data ?? [])',
  'chooseAuthorisedSiteGrant(',
  'findAuthorisedSiteGrant(',
  'selectedSiteStorageKey(nextUserId)',
  'selectedSiteStorageKey(session.user.id)',
  'setSiteAccesses([])',
]) assert.ok(auth.includes(required), `VOR-063 missing auth contract: ${required}`);

const accessQueryStart = auth.indexOf('"user_site_access"');
const accessQueryEnd = auth.indexOf('const profileError = profileResult.error;', accessQueryStart);
assert.ok(accessQueryStart >= 0 && accessQueryEnd > accessQueryStart, "VOR-063 site-access query could not be isolated");
const accessQuery = auth.slice(accessQueryStart, accessQueryEnd);
assert.ok(!accessQuery.includes('.limit('), "VOR-063 must fetch every RLS-visible active site grant, not a limited subset");
assert.ok(!accessQuery.includes('.maybeSingle()'), "VOR-063 user_site_access query must return an array of grants");
assert.ok(!/service_role|SUPABASE_SERVICE_ROLE/.test(auth), "VOR-063 browser auth must not use privileged credentials");
assert.ok(helper.includes("storedSiteId"));
assert.ok(helper.includes("grant.isDefault"));
assert.ok(helper.includes("grants[0]"));

const focused = spawnSync(process.execPath, ["scripts/vor-063-multi-site-context-tests.mjs"], { stdio: "inherit" });
assert.equal(focused.status, 0, "VOR-063 focused selection tests failed");

console.log("VOR-063 permanent contracts passed: complete RLS-visible grants, bounded selection and fail-closed clearing are retained.");
