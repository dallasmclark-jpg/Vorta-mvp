import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260802151500_make_equipment_risk_trend_evidence_only.sql",
    import.meta.url,
  ),
  "utf8",
);

assert.match(
  migration,
  /create or replace function public\.vorta_get_equipment_risk_trend_internal/,
  "VOR-036 must remain isolated to the internal Equipment risk-trend function.",
);
assert.match(
  migration,
  /history_row\.snapshot_date between b\.bucket_start and b\.bucket_end/,
  "Every historical point must come from a verified snapshot inside its displayed bucket.",
);
assert.match(
  migration,
  /join lateral \([\s\S]*equipment_risk_history[\s\S]*\) h on true/,
  "Empty history buckets must be omitted rather than backfilled.",
);
assert.doesNotMatch(
  migration,
  /Earliest verified equipment-risk snapshot used as the pre-history baseline|history_row\.snapshot_date > b\.bucket_end|coalesce\([\s\S]*s\.risk_score[\s\S]*p\.risk_score/,
  "The rejected copied pre-history baseline must not return.",
);
assert.match(
  migration,
  /Verified history begins %s; earlier periods are not plotted\./,
  "The live point must state the verified history boundary.",
);
assert.match(
  migration,
  /true as is_live/,
  "Every range must retain one separate live point.",
);
assert.match(
  migration,
  /false as is_live/,
  "Historical evidence points must remain distinct from the live point.",
);
assert.doesNotMatch(
  migration,
  /insert into public\.equipment_risk_history|update public\.equipment_risk_history|delete from public\.equipment_risk_history/,
  "The repair must not fabricate or rewrite stored equipment-risk history.",
);

console.log("VOR-036 evidence-only equipment risk trend contracts passed.");
