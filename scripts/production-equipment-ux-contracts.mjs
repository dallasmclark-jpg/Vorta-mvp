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

assert.match(netlify, /VITE_VORTA_DATA_MODE = "demo"/);
assert.match(liveEntry, /if \(mode === "demo"\) return <EquipmentSection \/>/);
assert.match(equipmentSection, /data-vorta-production-equipment-list="true"/);
assert.match(equipmentSection, /data-vorta-equipment-sort="true"/);
assert.match(equipmentSection, /type EquipmentSortKey = "risk" \| "name" \| "backlog" \| "evidence"/);
assert.match(equipmentSection, /<option value="backlog">Largest backlog<\/option>/);
assert.match(equipmentSection, /<option value="evidence">Evidence gaps<\/option>/);
assert.match(equipmentSection, /\| "Evidence Gaps"/);
assert.match(equipmentSection, /label="Evidence Gaps"/);
assert.match(equipmentSection, /itemEvidence &&[\s\S]*!itemEvidence\.complete/);
assert.doesNotMatch(equipmentSection, />\s*5\/5 evidence\s*</);

const rpcCalls = evidenceCoverage.match(/\.rpc\(/g) ?? [];
assert.equal(rpcCalls.length, 1, "Evidence coverage must use one aggregate RPC");
assert.doesNotMatch(
  evidenceCoverage,
  /\.from\(/,
  "Evidence coverage must not download underlying table rows",
);
assert.match(
  evidenceCoverage,
  /vorta_get_equipment_evidence_coverage/,
);

assert.match(migration, /create or replace function public\.vorta_get_equipment_evidence_coverage/);
assert.match(migration, /public\.vorta_has_site_access\(equipment\.site_id, false\)/);
assert.match(migration, /cardinality\(p_equipment_ids\) > 500/);
assert.match(migration, /revoke all on function public\.vorta_get_equipment_evidence_coverage/);
assert.match(migration, /grant execute[\s\S]*to authenticated, service_role/);
assert.match(migration, /document\.is_current/);
assert.match(migration, /fault\.is_active/);

console.log("Production Equipment UX contracts passed.");
