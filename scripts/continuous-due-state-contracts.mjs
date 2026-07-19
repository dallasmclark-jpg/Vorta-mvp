import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260719230000_enforce_continuous_due_state_truth.sql",
    import.meta.url,
  ),
  "utf8",
);

function effectivePmStatus(status, dueDate, anchorDate) {
  if (String(status ?? "").toUpperCase() === "COMPLETED") return "COMPLETED";
  if (dueDate && dueDate < anchorDate) return "OVERDUE";
  const dueSoonLimit = new Date(anchorDate);
  dueSoonLimit.setUTCDate(dueSoonLimit.getUTCDate() + 14);
  if (dueDate && dueDate <= dueSoonLimit) return "DUE SOON";
  if (["OVERDUE", "DUE SOON"].includes(String(status ?? "").toUpperCase())) {
    return "ON TRACK";
  }
  return status || "PLANNED";
}

const date = (value) => new Date(`${value}T00:00:00Z`);

assert.equal(effectivePmStatus("ON TRACK", date("2026-07-20"), date("2026-07-19")), "DUE SOON");
assert.equal(effectivePmStatus("DUE SOON", date("2026-07-20"), date("2026-07-21")), "OVERDUE");
assert.equal(effectivePmStatus("OVERDUE", date("2026-08-30"), date("2026-07-19")), "ON TRACK");
assert.equal(effectivePmStatus("COMPLETED", date("2026-01-01"), date("2026-07-19")), "COMPLETED");

assert.match(migration, /private\.vorta_normalise_due_states/);
assert.match(migration, /perform private\.vorta_normalise_due_states\(v_site_id, current_date\)/);
assert.match(migration, /public\.vorta_effective_pm_status/);
assert.match(migration, /calibration\.effective_status/);
assert.match(migration, /set schedule = '1 \* \* \* \*'/);
assert.match(migration, /revoke all on function private\.vorta_normalise_due_states/);
assert.match(migration, /grant execute on function private\.vorta_normalise_due_states[\s\S]*to service_role/);
assert.doesNotMatch(migration, /set updated_at = now\(\)/);

console.log("Continuous due-state contracts passed.");
