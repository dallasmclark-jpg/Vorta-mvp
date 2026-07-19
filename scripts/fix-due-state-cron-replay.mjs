import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL(
  "../supabase/migrations/20260719230000_enforce_continuous_due_state_truth.sql",
  import.meta.url,
);
const source = readFileSync(path, "utf8");
const before = `update cron.job\nset schedule = '1 * * * *'\nwhere jobname = 'vorta-risk-refresh-hourly';`;
const after = `select cron.alter_job(\n  job_id := (\n    select jobid\n    from cron.job\n    where jobname = 'vorta-risk-refresh-hourly'\n  ),\n  schedule := '1 * * * *'\n);`;

assert.equal(
  source.split(before).length - 1,
  1,
  "Expected one direct cron.job update in the due-state migration",
);
writeFileSync(path, source.replace(before, after));
console.log("Due-state cron replay corrected.");
