import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260720120000_set_based_dashboard_scopes.sql",
    import.meta.url,
  ),
  "utf8",
);

for (const expected of [
  "private.vorta_get_scope_labour_cards_set",
  "private.vorta_get_risk_dashboard_scopes_set_based",
  "shift_context as materialized",
  "scope_metrics as materialized",
  "leave_exceptions as materialized",
  "qualified_engineer_areas as materialized",
  "required_area_skills as materialized",
  "equipment_rows as materialized",
  "area_equipment as materialized",
  "site_children as materialized",
  "Set-based dashboard scope output differs from the legacy output",
  "Set-based dashboard labour-card output differs from the legacy output",
  "from private.vorta_get_scope_labour_cards_set(p_site_id)",
  "from private.vorta_get_risk_dashboard_scopes_set_based()",
]) {
  assert.ok(migration.includes(expected), `Missing dashboard scope contract: ${expected}`);
}

const scopeStart = migration.indexOf(
  "create or replace function private.vorta_get_risk_dashboard_scopes_set_based",
);
const scopeEnd = migration.indexOf(
  "revoke all on function private.vorta_get_risk_dashboard_scopes_set_based",
);
assert.ok(scopeStart >= 0 && scopeEnd > scopeStart);
const scopeBody = migration.slice(scopeStart, scopeEnd);

assert.equal(
  (scopeBody.match(/vorta_get_scope_labour_cards_set/g) ?? []).length,
  1,
  "The scope builder must consume one set of labour cards, not call per area",
);
assert.doesNotMatch(
  scopeBody,
  /public\.vorta_get_scope_labour_cards\s*\(/,
  "The set-based scope builder must not call the legacy labour helper",
);
assert.doesNotMatch(
  scopeBody,
  /left join lateral[\s\S]*order by[\s\S]*limit 1/,
  "Highest equipment must come from the shared ranked equipment set",
);
assert.match(scopeBody, /row_number\(\) over \([\s\S]*partition by asset\.area/);
assert.match(scopeBody, /filter \(where equipment\.area_rank <= 4\)/);

const labourStart = migration.indexOf(
  "create or replace function private.vorta_get_scope_labour_cards_set",
);
const labourEnd = migration.indexOf(
  "revoke all on function private.vorta_get_scope_labour_cards_set",
);
assert.ok(labourStart >= 0 && labourEnd > labourStart);
const labourBody = migration.slice(labourStart, labourEnd);

for (const card of [
  "'title', 'Shift Cover'",
  "'title', 'Single Point Risk'",
  "'title', 'Annual Leave'",
  "'title', 'Training Risk'",
]) {
  assert.ok(labourBody.includes(card), `Missing labour card: ${card}`);
}
assert.doesNotMatch(
  labourBody,
  /for\s+.*loop|foreach\s+.*loop/i,
  "Labour cards must be calculated as one set",
);

console.log("Set-based dashboard scope contracts passed.");
