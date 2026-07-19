import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const equipmentSection = read("src/screens/Equipment/EquipmentSection.tsx");
const evidenceCoverage = read(
  "src/screens/Equipment/equipmentEvidenceCoverage.ts",
);
const liveEntry = read("src/screens/Equipment/EquipmentLiveListEntry.tsx");
const netlify = read("netlify.toml");
const migration = read(
  "supabase/migrations/20260719233000_add_equipment_evidence_coverage_rpc.sql",
);

assert.ok(netlify.includes('VITE_VORTA_DATA_MODE = "demo"'));
assert.ok(liveEntry.includes('if (mode === "demo") return <EquipmentSection />'));
assert.ok(equipmentSection.includes('data-vorta-production-equipment-list="true"'));
assert.ok(equipmentSection.includes('data-vorta-equipment-sort="true"'));
assert.ok(
  equipmentSection.includes(
    'type EquipmentSortKey = "risk" | "name" | "backlog" | "evidence"',
  ),
);
for (const option of [
  '<option value="risk">Highest risk</option>',
  '<option value="backlog">Largest backlog</option>',
  '<option value="name">Equipment name</option>',
  '<option value="evidence">Evidence gaps</option>',
]) {
  assert.ok(equipmentSection.includes(option));
}
assert.ok(equipmentSection.includes('| "Evidence Gaps"'));
assert.ok(equipmentSection.includes('label="Evidence Gaps"'));
assert.ok(equipmentSection.includes('itemEvidence &&'));
assert.ok(equipmentSection.includes('!itemEvidence.complete'));
assert.ok(!equipmentSection.includes('>5/5 evidence<'));

assert.equal(
  evidenceCoverage.match(/\.rpc\(/g)?.length ?? 0,
  1,
  "Evidence coverage must use one aggregate RPC",
);
assert.ok(!/supabase\s*\.\s*from\s*\(/.test(evidenceCoverage));
assert.ok(
  evidenceCoverage.includes("vorta_get_equipment_evidence_coverage"),
);

for (const expected of [
  "create or replace function public.vorta_get_equipment_evidence_coverage",
  "public.vorta_has_site_access(equipment.site_id, false)",
  "cardinality(p_equipment_ids) > 500",
  "revoke all on function public.vorta_get_equipment_evidence_coverage",
  "to authenticated, service_role",
  "document.is_current",
  "fault.is_active",
]) {
  assert.ok(migration.includes(expected), `Missing migration contract: ${expected}`);
}

console.log("Production Equipment UX contracts passed.");
