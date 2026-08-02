import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const equipmentSection = read("src/screens/Equipment/EquipmentSection.tsx");
const mobileEquipment = read(
  "src/screens/Equipment/MobileEquipmentSection.tsx",
);
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
  dataTrustBanner.includes('if (mode !== "unavailable")'),
  "The global data-trust banner must render only for unavailable data.",
);
assert.ok(
  !dataTrustBanner.includes('data-vorta-data-mode="demo"'),
  "Demo trust messaging must remain absent from operational pages.",
);
assert.ok(
  !mobileEquipment.includes("VerifiedEquipmentImage"),
  "Phone Equipment cards must not render equipment images or unavailable-image placeholders.",
);
assert.ok(
  mobileEquipment.includes(
    'className="flex min-h-16 w-full items-start justify-between',
  ),
  "Phone Equipment card content must start at the top without retained image spacing.",
);

for (const [label, source] of [
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

for (const [label, source, markers] of [
  [
    "dashboard risk scope",
    dashboardOverview,
    [
      'data-vorta-mobile-risk-scope="true"',
      'aria-label="Risk intelligence scope"',
      'data-vorta-risk-dot="true"',
      "overflow-x-auto",
    ],
  ],
  [
    "equipment section navigation",
    equipmentTabs,
    [
      'data-vorta-equipment-mobile-tabs="true"',
      'data-vorta-equipment-tablist="true"',
      'aria-label="Equipment sections"',
      "overflow-x-auto",
    ],
  ],
]) {
  assert.ok(
    !source.includes("components/Select"),
    `${label} must use horizontal tabs rather than a dropdown.`,
  );
  assert.ok(
    !source.includes("<select"),
    `${label} must not fall back to a native mobile select menu.`,
  );
  for (const marker of markers) {
    assert.ok(source.includes(marker), `${label} is missing ${marker}.`);
  }
}

for (const expected of [
  'data-vorta-equipment-detail-header="true"',
  "flex flex-wrap gap-3",
  "sm:hidden",
  "Risk briefing",
  "h-20 w-20",
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
