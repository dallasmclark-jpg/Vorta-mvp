import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const netlify = read("netlify.toml");
const ignore = read("scripts/netlify-ignore-build.mjs");
const daily = read(".github/workflows/netlify-daily-release.yml");
const production = read(".github/workflows/maintenance-manager-production.yml");
const docs = read("docs/netlify-daily-release.md");
const marker = JSON.parse(read("ops/netlify-release.json"));
const prWorkflows = [
  read(".github/workflows/vor-048-validation.yml"),
  read(".github/workflows/vor-049-validation.yml"),
  read(".github/workflows/vor-051-validation.yml"),
].join("\n");
const suite = read("scripts/run-contract-suite.mjs");

assert.match(netlify, /ignore = "node \.\/scripts\/netlify-ignore-build\.mjs"/);
for (const required of [
  'context !== "production" || branch !== "main"',
  "Deploy Previews and branch deploys are disabled",
  '["diff", "--quiet", cachedCommit, commit, "--", markerPath]',
  '["show", `${cachedCommit}:${markerPath}`]',
  "releaseDate <= previousReleaseDate",
  "process.exit(1)",
]) assert.ok(ignore.includes(required), `Missing Netlify ignore control: ${required}`);

assert.equal(marker.notBeforeDate, "2026-08-06");
assert.equal(marker.releaseDate, null);
assert.equal(marker.sourceCommit, null);

for (const required of [
  'cron: "30 20 * * *"',
  "group: daily-netlify-production-release",
  "TZ=Europe/London date +%F",
  "previous_release_date",
  "No unreleased product changes were found",
  "npm run build",
  "npm run test:performance",
  "git add ops/netlify-release.json",
  "git push origin HEAD:main",
  "uses: ./.github/workflows/maintenance-manager-production.yml",
]) assert.ok(daily.includes(required), `Missing daily release control: ${required}`);
assert.doesNotMatch(daily, /run:\s*(?:npx\s+)?netlify\s+deploy|api\.netlify\.com\/api\/v1\/sites\/.*\/builds/i);

assert.doesNotMatch(
  prWorkflows,
  /deploy-preview-|Wait for exact Netlify preview commit|PREVIEW_URL/,
);
assert.ok(
  prWorkflows.includes("npm run typecheck") &&
    prWorkflows.includes("npm run test:contracts") &&
    prWorkflows.includes("npx vite build"),
  "Pull requests must retain local static and production-build validation",
);

for (const required of [
  "workflow_call:",
  "expected_commit:",
  "node scripts/verify-production-commit.mjs",
  "Run VOR-056 backlog production decision",
  "Run first 12 Ask Vorta production decisions",
  "Run final Ask Vorta production decision",
  "Run authenticated production regression",
]) assert.ok(production.includes(required), `Missing production verification control: ${required}`);

assert.ok(docs.includes("one Netlify production deployment per Europe/London calendar day"));
assert.ok(
  suite.includes(
    '["VOR-057 daily Netlify release", "scripts/netlify-daily-deploy-contracts.mjs"]',
  ),
);

console.log("VOR-057 one-deployment-per-day contracts passed.");
