import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const migrationPath =
  "supabase/migrations/20260720100000_set_based_dashboard_kpis.sql";
const original = readFileSync(migrationPath, "utf8");

assert.match(original, /from windows window/);
assert.match(original, /\bwindow\./);

const corrected = original
  .replaceAll("from windows window", "from windows period_window")
  .replaceAll("window.", "period_window.");

assert.doesNotMatch(corrected, /from windows window/);
assert.doesNotMatch(corrected, /\bwindow\./);
assert.match(corrected, /from windows period_window/);
assert.match(corrected, /period_window\.scope_key/);

writeFileSync(migrationPath, corrected);
console.log("Corrected reserved WINDOW aliases in the set-based KPI migration.");
