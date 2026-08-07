import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const panel = read("src/screens/Equipment/EquipmentHistoricalBacktest.tsx");
const trusted = read("src/screens/Equipment/EquipmentTrustedEntries.tsx");

for (const expected of [
  "Historical risk validation",
  "Synthetic demo evidence",
  "Breakdowns warned",
  "Median warning",
  "Pre-failure stock-outs",
  "Recovery impacts",
  "Successful interventions",
  "False positives",
  "Evidence boundary",
  "Temporal sequence does not by itself prove causation",
  "Historical validation unavailable",
  "No controlled VOR-069 case for this equipment",
]) {
  assert.ok(panel.includes(expected), `Missing VOR-069 UI evidence: ${expected}`);
}
assert.match(panel, /sm:grid-cols-2/);
assert.match(panel, /xl:grid-cols-/);
assert.match(panel, /flex flex-col/);
assert.match(panel, /overflow-hidden/);
assert.match(panel, /Retry/);
assert.match(panel, /Ask Vorta about evidence/);
assert.doesNotMatch(panel, /would have prevented/i);
assert.match(trusted, /DemoEquipmentHistoryWithBacktest/);
assert.match(trusted, /getConfiguredDataMode\(\) === "demo"/);
assert.match(trusted, /not permitted to render during a live pilot/i);

console.log("VOR-069 backtest UI contracts passed.");
