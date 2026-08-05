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
if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
  skipBuild("no dated production release has been requested");
}
if (releaseDate < notBeforeDate) {
  skipBuild(`release date ${releaseDate} is before the permitted date ${notBeforeDate}`);
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

let previousReleaseDate = "";
const previousMarker = spawnSync(
  "git",
  ["show", `${cachedCommit}:${markerPath}`],
  { encoding: "utf8" },
);
if (previousMarker.status === 0) {
  try {
    previousReleaseDate = String(
      JSON.parse(previousMarker.stdout).releaseDate ?? "",
    ).trim();
  } catch {
    skipBuild("the previously deployed release marker is invalid");
  }
}

if (previousReleaseDate && releaseDate <= previousReleaseDate) {
  skipBuild(
    `release date ${releaseDate} does not advance the previous deployment date ${previousReleaseDate}`,
  );
}

continueBuild(`release marker advanced to ${releaseDate}`);
