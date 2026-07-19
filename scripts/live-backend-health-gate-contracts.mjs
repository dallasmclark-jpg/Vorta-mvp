import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const gate = read("scripts/live-demo-backend-health.mjs");
const workflow = read(".github/workflows/maintenance-manager-quality.yml");

for (const expected of [
  "signInWithPassword",
  "vorta_get_demo_backend_health",
  "data.healthy",
  "data.siteId",
  "data.assetCount",
  "data.coverage",
  "data.integrity",
  "data.maintenanceTruth",
  "largestIdenticalSignatureGroup",
  "signOut",
]) {
  assert.ok(gate.includes(expected), `Missing live health gate contract: ${expected}`);
}

assert.doesNotMatch(gate, /supabase\s*\.\s*from\s*\(/);
assert.doesNotMatch(gate, /vorta_(refresh|recalculate|sync)_/);
assert.doesNotMatch(gate, /\.(insert|update|upsert|delete)\s*\(/);

for (const expected of [
  "Run authenticated live backend health gate",
  "node scripts/live-demo-backend-health.mjs",
  "live-backend-health.log",
  "live-backend-health-report",
  "Enforce live backend health result",
]) {
  assert.ok(workflow.includes(expected), `Release workflow is missing: ${expected}`);
}

const healthStep = workflow.indexOf("Run authenticated live backend health gate");
const browserInstall = workflow.indexOf(
  "Install browser-test runner without changing the lockfile",
);
assert.ok(healthStep > 0 && healthStep < browserInstall);

console.log("Live backend health gate contracts passed.");
