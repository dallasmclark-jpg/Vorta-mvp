import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const markerPath = "ops/netlify-release.json";

function skipBuild(reason) {
  console.log(`Skipping Netlify build: ${reason}`);
  process.exit(0);
}

function continueBuild(reason) {
  console.log(`Proceeding with controlled Netlify build: ${reason}`);
  process.exit(1);
}

function positiveInteger(value, fallback = 1) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

const context = String(process.env.CONTEXT ?? "").trim();
const branch = String(process.env.BRANCH ?? "").trim();

if (context !== "production" || branch !== "main") {
  skipBuild("Deploy Previews and branch deploys are disabled; GitHub CI validates pull requests.");
}

let marker;
try {
  marker = JSON.parse(readFileSync(markerPath, "utf8"));
} catch {
  skipBuild("the controlled release marker is unavailable or invalid");
}

const releaseDate = String(marker.releaseDate ?? "").trim();
const notBeforeDate = String(marker.notBeforeDate ?? "0000-00-00").trim();
const releaseAttempt = positiveInteger(marker.attempt);
if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
  skipBuild("no dated production release has been requested");
}
if (releaseDate < notBeforeDate) {
  skipBuild(`release date ${releaseDate} is before the permitted date ${notBeforeDate}`);
}
if (releaseAttempt === null) {
  skipBuild("the controlled release attempt is invalid");
}

const cachedCommit = String(process.env.CACHED_COMMIT_REF ?? "").trim();
const commit = String(process.env.COMMIT_REF ?? "").trim();
if (!cachedCommit || !commit || cachedCommit === commit) {
  skipBuild("Netlify did not provide two distinct Git revisions to compare");
}

const markerDiff = spawnSync(
  "git",
  ["diff", "--quiet", cachedCommit, commit, "--", markerPath],
  { stdio: "ignore" },
);
if (markerDiff.status === 0) {
  skipBuild("the daily release marker did not change");
}
if (markerDiff.status !== 1) {
  skipBuild("the daily release marker change could not be verified safely");
}

let previousMarker = null;
const previousMarkerResult = spawnSync(
  "git",
  ["show", `${cachedCommit}:${markerPath}`],
  { encoding: "utf8" },
);
if (previousMarkerResult.status === 0) {
  try {
    previousMarker = JSON.parse(previousMarkerResult.stdout);
  } catch {
    skipBuild("the previously deployed release marker is invalid");
  }
}

const previousReleaseDate = String(previousMarker?.releaseDate ?? "").trim();
const previousAttempt = positiveInteger(previousMarker?.attempt);
if (previousReleaseDate && releaseDate < previousReleaseDate) {
  skipBuild(
    `release date ${releaseDate} is earlier than the previous deployment date ${previousReleaseDate}`,
  );
}

if (previousReleaseDate && releaseDate === previousReleaseDate) {
  if (
    previousAttempt === null ||
    releaseAttempt !== previousAttempt + 1
  ) {
    skipBuild(
      `same-day release attempt ${releaseAttempt} does not advance previous attempt ${previousAttempt ?? "invalid"} by exactly one`,
    );
  }

  const triggerMode = String(marker.triggerMode ?? "").trim();
  if (triggerMode === "manual_same_day_exception") {
    const approvedAt = String(
      marker.sameDayExceptionApprovedAtUtc ?? "",
    ).trim();
    const reason = String(
      marker.sameDayExceptionReason ?? "",
    ).trim();

    if (
      !approvedAt ||
      Number.isNaN(Date.parse(approvedAt)) ||
      reason.length < 20
    ) {
      skipBuild("the same-day release exception lacks valid approval evidence");
    }
  } else if (triggerMode !== "manual_recovery") {
    skipBuild("a same-day build requires an explicit recovery or approved exception mode");
  }

  continueBuild(
    `approved same-day release ${releaseDate}, attempt ${releaseAttempt}`,
  );
}

continueBuild(`release marker advanced to ${releaseDate}`);
