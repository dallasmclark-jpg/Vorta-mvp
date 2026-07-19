import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260719224500_set_based_shift_cover_calendar.sql",
    import.meta.url,
  ),
  "utf8",
);

const rosterCalls = migration.match(/vorta_get_shift_roster_internal\(/g) ?? [];

assert.equal(
  rosterCalls.length,
  1,
  "Shift Cover must build the roster once for the requested period",
);
assert.doesNotMatch(
  migration,
  /vorta_get_site_labour_risk_internal\(/,
  "The calendar must not recalculate site labour risk once per shift",
);
assert.doesNotMatch(
  migration,
  /vorta_get_equipment_labour_risk_internal\(/,
  "The calendar must not recalculate equipment labour risk once per asset and shift",
);
assert.match(migration, /roster_summary as \(/);
assert.match(migration, /requirement_coverage as \(/);
assert.match(migration, /coverage_summary as \(/);
assert.match(migration, /equipment_labour as \(/);
assert.match(migration, /site_labour as \(/);
assert.match(migration, /p_end_date/);
assert.match(migration, /engineer_skill\.expiry_date >= shift\.shift_date/);
assert.match(migration, /scheduled_engineer_count = 0 then 100\.0::numeric/);
assert.match(migration, /contractor_engineer_count > 0 then 'contractor'/);

console.log("Shift Cover performance contracts passed.");
