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
  "positiveInteger",
  "releaseAttempt !== previousAttempt + 1",
  'triggerMode === "manual_same_day_exception"',
  'triggerMode !== "manual_recovery"',
  "sameDayExceptionApprovedAtUtc",
  "the same-day release exception lacks valid approval evidence",
  "process.exit(1)",
]) {
  assert.ok(ignore.includes(required), `Missing Netlify ignore control: ${required}`);
}

assert.equal(marker.notBeforeDate, "2026-08-06");
assert.ok(
  marker.releaseDate === null || /^\d{4}-\d{2}-\d{2}$/.test(marker.releaseDate),
  "The release marker must be empty or carry one valid London calendar date",
);
assert.ok(
  marker.sourceCommit === null || /^[0-9a-f]{40}$/.test(marker.sourceCommit),
  "The release source must be empty or an exact Git commit",
);
assert.ok(
  marker.attempt == null ||
    (Number.isInteger(marker.attempt) && marker.attempt > 0),
  "A release attempt must be a positive integer when present",
);
if (marker.releaseDate !== null) {
  assert.ok(marker.sourceCommit, "A dated release requires an exact source commit");
  assert.ok(
    typeof marker.requestedAtUtc === "string" &&
      !Number.isNaN(Date.parse(marker.requestedAtUtc)),
    "A dated release requires a valid request timestamp",
  );
}
if (marker.triggerMode === "manual_same_day_exception") {
  assert.ok(
    Number.isInteger(marker.attempt) && marker.attempt >= 2,
    "A same-day exception must advance the numbered release attempt",
  );
  assert.ok(
    typeof marker.sameDayExceptionApprovedAtUtc === "string" &&
      !Number.isNaN(Date.parse(marker.sameDayExceptionApprovedAtUtc)),
    "A same-day exception requires a valid approval timestamp",
  );
  assert.ok(
    typeof marker.sameDayExceptionReason === "string" &&
      marker.sameDayExceptionReason.trim().length >= 20,
    "A same-day exception requires a bounded recorded reason",
  );
}
if (marker.deployedCommit != null) {
  assert.match(
    marker.deployedCommit,
    /^[0-9a-f]{40}$/,
    "A verified deployment must record its exact commit",
  );
  assert.ok(
    typeof marker.deployedAtUtc === "string" &&
      !Number.isNaN(Date.parse(marker.deployedAtUtc)),
    "A verified deployment must record its completion timestamp",
  );
}

for (const required of [
  'cron: "30 20 * * *"',
  "recover_failed_release:",
  "group: daily-netlify-production-release",
  "TZ=Europe/London date +%F",
  "production_release_date",
  "A recovery cannot run until 30 minutes after the previous trigger",
  "No unreleased product changes were found",
  "NETLIFY_BUILD_HOOK_URL: ${{ secrets.NETLIFY_BUILD_HOOK_URL }}",
  "The release marker will not be changed",
  "npm run build",
  "npm run test:performance",
  "git add ops/netlify-release.json",
  "git push origin HEAD:main",
  "Trigger the exact validated Netlify release",
  '--request POST',
  '"$NETLIFY_BUILD_HOOK_URL"',
  "netlify-build-hook-response.json",
  "uses: ./.github/workflows/maintenance-manager-production.yml",
  "Record the verified production release",
  "marker.deployedCommit = process.env.DEPLOYED_COMMIT",
]) {
  assert.ok(daily.includes(required), `Missing daily release control: ${required}`);
}

const planIndex = daily.indexOf("Plan the London-date release");
const secretIndex = daily.indexOf("Require the secure Netlify build trigger");
const validationIndex = daily.indexOf("Run canonical release validation");
const markerIndex = daily.indexOf("Advance the controlled release marker");
const commitIndex = daily.indexOf("Commit the single daily release request");
const triggerIndex = daily.indexOf("Trigger the exact validated Netlify release");
assert.ok(
  planIndex >= 0 &&
    secretIndex > planIndex &&
    validationIndex > secretIndex &&
    markerIndex > validationIndex &&
    commitIndex > markerIndex &&
    triggerIndex > commitIndex,
  "The release must plan, require a secure trigger and validate before changing the marker or triggering Netlify",
);
assert.doesNotMatch(
  daily,
  /run:\s*(?:npx\s+)?netlify\s+deploy|api\.netlify\.com\/api\/v1\/sites\/.*\/builds/i,
  "The daily release must use the configured secret hook rather than ad-hoc CLI or raw Netlify API deployment",
);
assert.doesNotMatch(
  daily,
  /https:\/\/api\.netlify\.com\/build_hooks\//,
  "The secret Netlify build hook URL must never be committed",
);

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
]) {
  assert.ok(production.includes(required), `Missing production verification control: ${required}`);
}

for (const required of [
  "one Netlify production deployment per Europe/London calendar day",
  "NETLIFY_BUILD_HOOK_URL",
  "fails before changing the release marker",
  "recover_failed_release",
  "30 minutes",
  "exact deployed commit",
]) {
  assert.ok(docs.includes(required), `Missing release documentation: ${required}`);
}
assert.ok(
  suite.includes(
    '["VOR-057 daily Netlify release", "scripts/netlify-daily-deploy-contracts.mjs"]',
  ),
);

console.log(
  "VOR-057 release contracts passed: one-deployment-per-day remains the default, same-day recovery and user-approved exceptions require a one-step numbered attempt with recorded evidence, and exact production verification remains protected.",
);
