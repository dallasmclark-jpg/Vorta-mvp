import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const outputDir = ".tmp/vor-063";
const outputFile = `${outputDir}/site-access-context.mjs`;
mkdirSync(outputDir, { recursive: true });

await build({
  entryPoints: ["src/lib/siteAccessContext.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "es2022",
  outfile: outputFile,
  logLevel: "silent",
});

const { chooseAuthorisedSiteGrant, findAuthorisedSiteGrant } = await import(
  `${pathToFileURL(process.cwd() + "/" + outputFile).href}?t=${Date.now()}`,
);

const grants = [
  { siteId: "site-a", organisationId: "org-a", role: "maintenance_manager", isDefault: false },
  { siteId: "site-b", organisationId: "org-b", role: "reliability_engineer", isDefault: true },
  { siteId: "site-c", organisationId: "org-c", role: "site_admin", isDefault: false },
];

assert.equal(chooseAuthorisedSiteGrant(grants, "site-c")?.siteId, "site-c", "stored authorised site wins");
assert.equal(chooseAuthorisedSiteGrant(grants, "stale-site")?.siteId, "site-b", "stale stored site falls back to verified default");
assert.equal(chooseAuthorisedSiteGrant(grants.map((grant) => ({ ...grant, isDefault: false })), null)?.siteId, "site-a", "first deterministic grant is final fallback");
assert.equal(chooseAuthorisedSiteGrant([], "site-a"), null, "no authorised grants fails closed");
assert.equal(findAuthorisedSiteGrant(grants, "site-b")?.role, "reliability_engineer", "site-specific role stays attached to grant");
assert.equal(findAuthorisedSiteGrant(grants, "cross-site"), null, "unknown site cannot be selected");
assert.equal(findAuthorisedSiteGrant(grants, null), null, "empty selection cannot be authorised");

rmSync(outputDir, { recursive: true, force: true });
console.log("VOR-063 focused tests passed: authorised multi-site selection and fallbacks are deterministic and fail closed.");
