import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const mobileUiTransform = spawnSync(
  "python3",
  ["scripts/apply-mobile-header-risk-picker-fix.py"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
  },
);

if (mobileUiTransform.error) {
  throw mobileUiTransform.error;
}

if (mobileUiTransform.status !== 0) {
  throw new Error(
    `Mobile UI source transformation failed with exit code ${mobileUiTransform.status}.`,
  );
}

const commit =
  process.env.COMMIT_REF?.trim() ||
  process.env.GITHUB_SHA?.trim() ||
  "local";
const dataMode =
  process.env.VITE_VORTA_DATA_MODE?.trim().toLowerCase() ||
  (process.env.NODE_ENV === "production" ? "live" : "demo");
const outputDirectory = resolve("public");
const outputPath = resolve(outputDirectory, "vorta-build.json");

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      commit,
      dataMode,
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Wrote Vorta build metadata for ${commit}.`);
