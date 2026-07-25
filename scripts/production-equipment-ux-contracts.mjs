import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const equipmentSection = read("src/screens/Equipment/EquipmentSection.tsx");
const evidenceCoverage = read(
  "src/screens/Equipment/equipmentEvidenceCoverage.ts",
);
const liveEntry = read("src/screens/Equipment/EquipmentLiveListEntry.tsx");
const dataTrustBanner = read("src/components/DataTrustBanner.tsx");
const equipmentTabs = read("src/screens/Equipment/EquipmentTabNavigation.tsx");
const equipmentOverview = read("src/screens/Equipment/EquipmentOverview.tsx");
const dashboardOverview = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx",
);
const equipmentSpares = read("src/screens/Equipment/EquipmentSpares.tsx");
const equipmentAssistant = read(
  "src/screens/Equipment/EquipmentKnowledgeAssistant.tsx",
);
const liveEngineers = read("src/screens/Engineers/LiveEngineersSection.tsx");
const liveRequirements = read(
  "src/screens/Requirements/LiveRequirementsSection.tsx",
);
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
  '{ value: "risk", label: "Highest risk" }',
  '{ value: "backlog", label: "Largest backlog" }',
  '{ value: "name", label: "Equipment name" }',
  '{ value: "evidence", label: "Evidence gaps" }',
]) {
  assert.ok(equipmentSection.includes(option));
}
assert.ok(equipmentSection.includes('import { Select } from "../../components/Select"'));
assert.ok(!equipmentSection.includes("<select"));
assert.ok(equipmentSection.includes('| "Evidence Gaps"'));
assert.ok(equipmentSection.includes('label="Evidence Gaps"'));
assert.ok(equipmentSection.includes('itemEvidence &&'));
assert.ok(equipmentSection.includes('!itemEvidence.complete'));
assert.ok(!equipmentSection.includes('>5/5 evidence<'));
assert.ok(
  dataTrustBanner.includes(
    'const mobileVisibility = mode === "demo" ? "hidden sm:flex" : "flex"',
  ),
  "Demo trust messaging must be removed from every phone route without hiding live or unavailable warnings.",
);

for (const [label, source] of [
  ["dashboard risk scope", dashboardOverview],
  ["equipment section navigation", equipmentTabs],
  ["demo equipment sort", equipmentSection],
  ["live equipment filters", liveEntry],
  ["equipment spares filter", equipmentSpares],
  ["equipment assistant cases", equipmentAssistant],
  ["engineer risk filter", liveEngineers],
  ["requirements priority filter", liveRequirements],
]) {
  assert.ok(
    source.includes("components/Select"),
    `${label} must use the shared Vorta dropdown.`,
  );
  assert.ok(
    !source.includes("<select"),
    `${label} must not fall back to a native mobile select menu.`,
  );
}

for (const expected of [
  'data-vorta-equipment-detail-header="true"',
  "grid-cols-[72px_minmax(0,1fr)]",
  "sm:hidden",
  "Risk briefing",
  "sm:w-32",
  "sm:text-4xl",
]) {
  assert.ok(
    equipmentOverview.includes(expected),
    `Mobile equipment summary is missing ${expected}.`,
  );
}

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
