import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const schemaMigration = read(
  "supabase/migrations/20260801213000_add_verified_equipment_part_image_provenance.sql",
);
const seedMigration = read(
  "supabase/migrations/20260801214500_classify_and_seed_verified_equipment_images.sql",
);
const equipmentImages = read("src/screens/Equipment/equipmentImages.ts");
const verifiedEquipmentImage = read(
  "src/screens/Equipment/VerifiedEquipmentImage.tsx",
);
const mobileEquipment = read(
  "src/screens/Equipment/MobileEquipmentSection.tsx",
);

const checks = [
  {
    label: "equipment verification provenance is required",
    pass:
      schemaMigration.includes("equipment_assets_verified_image_evidence_check") &&
      schemaMigration.includes("image_source_url") &&
      schemaMigration.includes("image_verified_at") &&
      schemaMigration.includes("image_alt_text"),
  },
  {
    label: "spare-part verification requires an exact OEM part number",
    pass:
      schemaMigration.includes("equipment_components_verified_image_evidence_check") &&
      schemaMigration.includes("nullif(btrim(oem_part_number), '') is not null") &&
      schemaMigration.includes("image_match_basis = 'exact_part'"),
  },
  {
    label: "unidentified spare parts fail closed",
    pass:
      schemaMigration.includes("default 'blocked_identity'") &&
      schemaMigration.includes("Exact OEM manufacturer part number is not recorded"),
  },
  {
    label: "fabricated equipment drawings are no longer returned",
    pass:
      equipmentImages.includes("VERIFIED IMAGE UNAVAILABLE") &&
      equipmentImages.includes("No unverified substitute is shown") &&
      !equipmentImages.includes("Palletiser 2") &&
      !equipmentImages.includes("Vial Filler VF-02") &&
      !equipmentImages.includes("Case Packer CP-01"),
  },
  {
    label: "verified seed images record source and match basis",
    pass:
      seedMigration.includes("image_source_url") &&
      seedMigration.includes("image_source_type") &&
      seedMigration.includes("image_match_basis") &&
      seedMigration.includes("image_verification_status = 'verified'"),
  },
  {
    label: "custom or inconsistent equipment identities remain blocked",
    pass:
      seedMigration.includes("'FD-01','FD-02'") &&
      seedMigration.includes("image_verification_status = 'blocked_identity'") &&
      seedMigration.includes("approved site photograph or exact model"),
  },
  {
    label: "phone equipment imagery uses a compact fixed thumbnail",
    pass:
      mobileEquipment.includes('data-vorta-mobile-equipment-media="compact"') &&
      mobileEquipment.includes('className="h-[88px] w-[88px]"') &&
      mobileEquipment.includes("compact") &&
      !mobileEquipment.includes('className="h-40 w-full"'),
  },
  {
    label: "compact unavailable imagery avoids the full fallback panel",
    pass:
      verifiedEquipmentImage.includes('data-vorta-equipment-image-layout="compact"') &&
      verifiedEquipmentImage.includes("No verified image") &&
      verifiedEquipmentImage.includes('role={hasVerifiedImage ? undefined : "img"}') &&
      verifiedEquipmentImage.includes('data-vorta-equipment-image-layout="full"'),
  },
];

const failures = checks.filter((check) => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} - ${check.label}`);
}

if (failures.length > 0) {
  console.error(`VOR-034 contract failed: ${failures.length} check(s).`);
  process.exit(1);
}

console.log(`VOR-034 contract passed: ${checks.length}/${checks.length}.`);
