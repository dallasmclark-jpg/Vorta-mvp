import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  resilience,
  operationsIndex,
  settingsFunction,
  playwright,
  performance,
  packageText,
] = await Promise.all([
  read("../src/lib/liveEvidenceResilience.ts"),
  read("../src/screens/AiOperations/index.ts"),
  read("../supabase/functions/settings-evidence-data/index.ts"),
  read("../playwright.config.ts"),
  read("./check-performance-budgets.mjs"),
  read("../package.json"),
]);

const mustMatch = (source, pattern, message) => assert.match(source, pattern, message);
const mustNotMatch = (source, pattern, message) => assert.doesNotMatch(source, pattern, message);

for (const slug of [
  "skills-matrix-data",
  "engineers-data",
  "requirements-data",
  "training-data",
  "training-providers-data",
  "ai-matching-data",
  "career-evidence-data",
  "support-evidence-data",
  "settings-evidence-data",
]) {
  mustMatch(resilience, new RegExp(`"${slug}"`), `${slug} must use the shared resilience boundary`);
}
mustMatch(resilience, /REQUEST_TIMEOUT_MS = 15_000/, "Evidence requests must have a bounded timeout");
mustMatch(resilience, /MAX_ATTEMPTS = 3/, "Evidence requests must use bounded retry");
mustMatch(resilience, /TRANSIENT_MESSAGE/, "Only recognised transport failures may be retried");
mustMatch(resilience, /attempt === MAX_ATTEMPTS - 1/, "Retries must stop at the final attempt");
mustMatch(resilience, /__vortaLiveEvidenceResilienceInstalled/, "The shared wrapper must be idempotent during reloads");
mustMatch(operationsIndex, /import "\.\.\/\.\.\/lib\/liveEvidenceResilience"/, "Maintenance Manager must install the resilience boundary before routes render");

mustMatch(settingsFunction, /details: \{\}/, "Settings evidence must withhold incident detail payloads");
mustMatch(settingsFunction, /datasetFingerprints: \{\}/, "Settings evidence must withhold dataset fingerprints");
mustMatch(settingsFunction, /manifestFingerprint: "withheld"/, "Settings evidence must withhold the recovery manifest fingerprint");
mustNotMatch(settingsFunction, /row\.details\s*&&/, "Settings evidence must not forward raw incident details");
mustNotMatch(settingsFunction, /recoveryRow\.dataset_fingerprints/, "Settings evidence must not forward dataset fingerprints");
mustNotMatch(settingsFunction, /recoveryRow\.manifest_fingerprint/, "Settings evidence must not forward the manifest fingerprint");

mustMatch(playwright, /retries: process\.env\.CI \? 1 : 0/, "CI must retain one diagnostic retry");
mustMatch(playwright, /failOnFlakyTests: Boolean\(process\.env\.CI\)/, "CI must fail when a test passes only after retry");
mustMatch(playwright, /forbidOnly: Boolean\(process\.env\.CI\)/, "CI must reject focused tests");

for (const [name, value] of [
  ["totalJavaScriptBytes", "3_250_000"],
  ["largestJavaScriptBytes", "625_000"],
  ["totalCssBytes", "150_000"],
  ["totalDistBytes", "3_500_000"],
]) {
  mustMatch(performance, new RegExp(`${name}: ${value}`), `${name} must retain the reviewed production budget`);
}
mustMatch(performance, /process\.exit\(1\)/, "Performance budget failures must fail the build");

const packageJson = JSON.parse(packageText);
assert.equal(packageJson.scripts["test:performance"], "node scripts/check-performance-budgets.mjs");
assert.equal(packageJson.scripts.postbuild, "npm run test:performance");
assert.equal(packageJson.scripts.build, "npm run build:metadata && npm run typecheck && npm run test:contracts && npm run test:smoke && vite build");

console.log("Pilot resilience and performance contracts passed.");
