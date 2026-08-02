import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260802144500_backfill_equipment_risk_trend_buckets.sql",
    import.meta.url,
  ),
  "utf8",
);

assert.match(
  migration,
  /create or replace function public\.vorta_get_equipment_risk_trend_internal/,
  "VOR-036 must replace only the internal Equipment risk-trend function.",
);
assert.match(
  migration,
  /when history_row\.snapshot_date <= b\.bucket_end then 0[\s\S]*else 1/,
  "Trend buckets must prefer the latest verified snapshot at or before the bucket end.",
);
assert.match(
  migration,
  /when history_row\.snapshot_date > b\.bucket_end[\s\S]*then history_row\.snapshot_date[\s\S]*end asc/,
  "Buckets before stored history must fall back to the earliest verified snapshot.",
);
assert.match(
  migration,
  /coalesce\([\s\S]*when s\.sort_order = v_bucket_count - 1[\s\S]*then p\.risk_score[\s\S]*else s\.risk_score[\s\S]*s\.risk_score,[\s\S]*p\.risk_score/,
  "Every returned bucket must resolve a non-null risk score from verified history or the current profile.",
);
assert.match(
  migration,
  /Earliest verified equipment-risk snapshot used as the pre-history baseline\./,
  "Pre-history baseline points must retain an explicit provenance explanation.",
);
assert.match(
  migration,
  /s\.sort_order = v_bucket_count - 1 as is_live/,
  "Each range must retain one final live point.",
);
assert.doesNotMatch(
  migration,
  /insert into public\.equipment_risk_history|update public\.equipment_risk_history|delete from public\.equipment_risk_history/,
  "VOR-036 must not fabricate or rewrite stored equipment-risk history rows.",
);

console.log("VOR-036 equipment risk trend contracts passed.");
