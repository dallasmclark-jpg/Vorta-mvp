import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const uuidCompatibility = readFileSync(
  new URL(
    "../supabase/migrations/20260720115900_private_uuid_max_aggregate.sql",
    import.meta.url,
  ),
  "utf8",
);

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260720120000_cache_dashboard_scopes.sql",
    import.meta.url,
  ),
  "utf8",
);

for (const expected of [
  "private.vorta_uuid_max",
  "create aggregate private.max(uuid)",
  "revoke all on function private.max(uuid)",
  "procedure.prokind = 'a'",
]) {
  assert.ok(
    uuidCompatibility.includes(expected),
    `Missing private UUID compatibility contract: ${expected}`,
  );
}

assert.doesNotMatch(
  uuidCompatibility,
  /grant\s+execute[\s\S]+authenticated|grant\s+execute[\s\S]+anon/i,
  "The temporary UUID compatibility objects must not be exposed to Data API roles",
);

for (const expected of [
  "private.vorta_dashboard_scope_cache",
  "private.vorta_calculate_risk_dashboard_scopes",
  "private.vorta_refresh_dashboard_scope_cache",
  "vorta_refresh_dashboard_scope_cache_after_risk",
  "Dashboard scope cache differs from the legacy output",
  "Dashboard scope reader hash differs after cache activation",
  "jsonb_array_length(v_cached) <> 8",
  "from private.vorta_calculate_risk_dashboard_scopes()",
  "drop table if exists private.vorta_migration_sql_stage",
  "drop aggregate if exists private.max(uuid)",
  "drop function if exists private.vorta_uuid_max(uuid, uuid)",
]) {
  assert.ok(migration.includes(expected), `Missing dashboard scope cache contract: ${expected}`);
}

assert.match(
  migration,
  /alter function public\.vorta_get_risk_dashboard_scopes_internal\(\)\s+set schema private/,
);
assert.match(
  migration,
  /alter function private\.vorta_get_risk_dashboard_scopes_internal\(\)\s+rename to vorta_calculate_risk_dashboard_scopes/,
);
assert.match(
  migration,
  /create trigger vorta_refresh_dashboard_scope_cache_after_risk[\s\S]*after insert or update on public\.site_risk_profile/,
);
assert.match(
  migration,
  /revoke all on private\.vorta_dashboard_scope_cache[\s\S]*from public, anon, authenticated/,
);

const cacheGrantStart = migration.indexOf(
  "grant select, insert, update, delete\n  on private.vorta_dashboard_scope_cache",
);
const cacheGrantEnd = migration.indexOf(";", cacheGrantStart);
assert.ok(cacheGrantStart >= 0 && cacheGrantEnd > cacheGrantStart);
const cacheGrant = migration.slice(cacheGrantStart, cacheGrantEnd + 1);
assert.match(cacheGrant, /to service_role;/);
assert.doesNotMatch(
  cacheGrant,
  /\b(?:anon|authenticated)\b/i,
  "The typed scope cache must remain private",
);

const readerStart = migration.indexOf(
  "create or replace function public.vorta_get_risk_dashboard_scopes_internal",
);
const readerEnd = migration.indexOf(
  "revoke all on function public.vorta_get_risk_dashboard_scopes_internal",
);
assert.ok(readerStart >= 0 && readerEnd > readerStart);
const readerBody = migration.slice(readerStart, readerEnd);

assert.match(readerBody, /from private\.vorta_dashboard_scope_cache cache/);
assert.match(readerBody, /order by cache\.display_order/);
assert.match(readerBody, /from private\.vorta_calculate_risk_dashboard_scopes\(\)/);
assert.doesNotMatch(
  readerBody,
  /public\.vorta_get_scope_labour_cards\s*\(/,
  "Dashboard page reads must not rebuild labour cards",
);
assert.doesNotMatch(
  readerBody,
  /public\.vorta_get_risk_dashboard_scopes_internal\s*\(/,
  "The cached reader must not recurse",
);

const refreshStart = migration.indexOf(
  "create or replace function private.vorta_refresh_dashboard_scope_cache",
);
const refreshEnd = migration.indexOf(
  "revoke all on function private.vorta_refresh_dashboard_scope_cache",
);
assert.ok(refreshStart >= 0 && refreshEnd > refreshStart);
const refreshBody = migration.slice(refreshStart, refreshEnd);

assert.match(refreshBody, /delete from private\.vorta_dashboard_scope_cache/);
assert.match(refreshBody, /insert into private\.vorta_dashboard_scope_cache/);
assert.match(refreshBody, /from private\.vorta_calculate_risk_dashboard_scopes\(\)/);
assert.match(refreshBody, /get diagnostics v_inserted = row_count/);

console.log("Dashboard scope cache contracts passed.");
