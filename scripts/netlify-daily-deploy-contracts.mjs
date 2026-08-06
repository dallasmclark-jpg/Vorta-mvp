import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const netlify = read("netlify.toml");
const production = read(".github/workflows/maintenance-manager-production.yml");
const lockedCiDocs = read("docs/locked-ci-dependencies.md");
const suite = read("scripts/run-contract-suite.mjs");

assert.doesNotMatch(
  netlify,
  /^\s*ignore\s*=/m,
  "Production builds from main must not be blocked by a date or marker gate",
);
assert.match(
  netlify,
  /command = "node scripts\/validate-data-mode\.mjs && npm run build"/,
  "The normal Netlify build must retain data-mode validation and the canonical application build",
);
assert.match(netlify, /publish = "dist"/);

for (const removedPath of [
  ".github/workflows/netlify-daily-release.yml",
  ".github/workflows/emergency-vor-049-release-20260806.yml",
  "scripts/netlify-ignore-build.mjs",
  "docs/netlify-daily-release.md",
]) {
  assert.equal(
    existsSync(removedPath),
    false,
    `The obsolete VOR-057 deployment gate must remain removed: ${removedPath}`,
  );
}

if (existsSync("ops/netlify-release.json")) {
  const bootstrapMarker = JSON.parse(read("ops/netlify-release.json"));
  assert.equal(
    bootstrapMarker.temporaryBootstrap,
    true,
    "A release marker may exist only as the temporary VOR-057 recovery bootstrap",
  );
}

for (const required of [
  "workflow_run:",
  "Maintenance Manager quality gate",
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.head_branch == 'main'",
  "github.event.workflow_run.head_sha",
  "node scripts/verify-production-commit.mjs",
  "Run authenticated production regression",
]) {
  assert.ok(
    production.includes(required),
    `The established automatic production-verification workflow is missing: ${required}`,
  );
}

assert.doesNotMatch(
  lockedCiDocs,
  /single daily Netlify release marker|one Netlify production deployment per/i,
  "CI documentation must not reinstate the removed daily deployment restriction",
);
assert.ok(
  lockedCiDocs.includes("Netlify automatically builds the merged `main` commit"),
  "CI documentation must describe the restored main-to-Netlify workflow",
);
assert.ok(
  suite.includes(
    '["VOR-057 daily Netlify release", "scripts/netlify-daily-deploy-contracts.mjs"]',
  ),
  "The restored deployment contract must remain in the permanent suite",
);

console.log(
  "VOR-057 release contracts passed: validated main merges return to the established automatic Netlify build and exact-commit production verification flow.",
);
