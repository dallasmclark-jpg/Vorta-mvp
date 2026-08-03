import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  imageDiagnosisSearchText,
  rankAskVortaImageMatches,
} from "../netlify/functions/_shared/askVortaImageDiagnosis.mjs";

const fixturePath = process.argv[2] || "tests/evals/vor-046-image-diagnosis.json";
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const equipment = fixture.catalog?.equipment ?? [];
const components = fixture.catalog?.components ?? [];
const scenarios = Array.isArray(fixture.scenarios) ? fixture.scenarios : [];
const failures = [];

for (const scenario of scenarios) {
  try {
    const result = rankAskVortaImageMatches(
      scenario.extraction,
      equipment,
      components,
    );
    const expected = scenario.expect ?? {};
    if (Object.hasOwn(expected, "matchStatus")) {
      assert.equal(result.matchStatus, expected.matchStatus);
    }
    if (Object.hasOwn(expected, "selectedEquipmentQuery")) {
      assert.equal(result.selectedEquipmentQuery, expected.selectedEquipmentQuery);
    }
    if (Object.hasOwn(expected, "topEquipmentCode")) {
      assert.equal(result.equipmentMatches[0]?.equipmentCode ?? null, expected.topEquipmentCode);
    }
    if (Object.hasOwn(expected, "topEquipmentExact")) {
      assert.equal(result.equipmentMatches[0]?.exactIdentifier ?? false, expected.topEquipmentExact);
    }
    if (Object.hasOwn(expected, "topComponentCode")) {
      assert.equal(result.componentMatches[0]?.componentCode ?? null, expected.topComponentCode);
    }
    if (Object.hasOwn(expected, "topComponentExact")) {
      assert.equal(result.componentMatches[0]?.exactIdentifier ?? false, expected.topComponentExact);
    }
    if (Object.hasOwn(expected, "hasConflicts")) {
      assert.equal(result.conflicts.length > 0, expected.hasConflicts);
    }
    if (Object.hasOwn(expected, "topFaultCode")) {
      assert.equal(result.extraction?.faultCodes[0]?.value ?? null, expected.topFaultCode);
    }
    if (result.extraction) {
      const searchText = imageDiagnosisSearchText(result);
      assert.equal(searchText.includes("data:image"), false);
      assert.ok(searchText.length <= 1_500);
    }
    console.log(`✓ ${scenario.id}`);
  } catch (error) {
    failures.push({ id: scenario.id, error });
    console.error(`✗ ${scenario.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${scenarios.length - failures.length}/${scenarios.length} VOR-046 image diagnosis scenarios passed.`);
if (failures.length) process.exit(1);
