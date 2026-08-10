import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  combineAskVortaSparePhotoMatches,
  isAskVortaSparePhotoQuestion,
  rankAskVortaSparePhotoCandidates,
} from "../netlify/functions/_shared/askVortaSparePhotoMatch.mjs";

const root = resolve(import.meta.dirname, "..");

for (const question of [
  "what is the stock number of this spare?",
  "identify this spare",
  "find this part in stores",
  "match this component to stock",
]) {
  assert.equal(
    isAskVortaSparePhotoQuestion(question),
    true,
    `Expected spare-photo intent: ${question}`,
  );
}
assert.equal(
  isAskVortaSparePhotoQuestion("what caused this motor fault last time?"),
  false,
  "Fault-history questions must remain on the existing image/equipment route.",
);

const extraction = {
  extractionStatus: "readable",
  imageType: "component",
  observedText: [{ value: "SIEMENS", confidence: 98 }],
  faultCodes: [],
  manufacturerCandidates: [{ value: "Siemens", confidence: 98 }],
  modelCandidates: [],
  partCandidates: [],
  equipmentCodeCandidates: [],
  visualObservations: [
    "industrial servo motor with front flange and output shaft",
    "top mounted electrical connector",
  ],
  qualityWarnings: [],
};

const components = [
  {
    id: "siemens-servo",
    equipment_id: "vf02",
    component_name: "Siemens SIMOTICS S 1FK7 Compact servo motor, 0.38 kW",
    component_code: "VF02-SM-022",
    oem_part_number: "1FK7022-5AK71-1LG3",
    maker_name: "Siemens",
    vendor_name: "RS / Siemens supply",
    image_url: "https://example.test/siemens-servo.jpg",
    image_alt_text: "Siemens compact servo motor with flange and shaft",
    image_verification_status: "verified",
    quantity_available: 1,
    storage_location: "Stores A-05",
    availability_status: "Available",
  },
  {
    id: "siemens-hmi",
    equipment_id: "vf02",
    component_name: "HMI Touchscreen Panel 12 inch",
    component_code: "VF02-HMI-012",
    oem_part_number: "6AV2124-0MC01-0AX0",
    maker_name: "Siemens",
    vendor_name: "Siemens Industry UK",
    image_url: "https://example.test/siemens-hmi.jpg",
    image_alt_text: "Siemens touchscreen HMI panel",
    image_verification_status: "verified",
    quantity_available: 1,
    storage_location: "Stores A-03",
    availability_status: "Available",
  },
  {
    id: "abb-motor",
    equipment_id: "vf02",
    component_name: "ABB induction motor",
    component_code: "VF02-MTR-ABB",
    oem_part_number: "ABB-123",
    maker_name: "ABB",
    vendor_name: "ABB",
    image_url: "https://example.test/abb.jpg",
    image_alt_text: "ABB motor",
    image_verification_status: "verified",
    quantity_available: 1,
    storage_location: "Stores A-02",
    availability_status: "Available",
  },
];

const ranked = rankAskVortaSparePhotoCandidates(extraction, components, {
  pagePath: "/equipment/vf02/spares",
});
assert.equal(ranked.manufacturerFilterApplied, true);
assert.equal(ranked.manufacturerFilter, "Siemens");
assert.equal(
  ranked.candidates.some((candidate) => candidate.componentId === "abb-motor"),
  false,
  "Reliable Siemens OCR must constrain the candidate pool before visual ranking.",
);
assert.equal(ranked.candidates.length, 2);

const matches = combineAskVortaSparePhotoMatches(ranked.candidates, [
  { componentId: "siemens-servo", visualSimilarity: 98 },
  { componentId: "siemens-hmi", visualSimilarity: 12 },
]);
assert.equal(matches[0]?.componentId, "siemens-servo");
assert.ok((matches[0]?.matchConfidence ?? 0) > (matches[1]?.matchConfidence ?? 0));
assert.ok(matches.length <= 5, "Spare-photo results must never exceed five matches.");

const runtimeSource = readFileSync(
  resolve(root, "netlify/functions/ask-vorta/spare-photo-identification.mts"),
  "utf8",
);
assert.match(runtimeSource, /\.eq\("site_id", request\.siteId\)/);
assert.match(runtimeSource, /image_verification_status/);
assert.match(runtimeSource, /compareVerifiedSpareImages/);
assert.match(runtimeSource, /Closest match:/);
assert.doesNotMatch(runtimeSource, /get_equipment_decision_pack/);

const imageClientSource = readFileSync(
  resolve(root, "src/screens/AiOperations/askVortaImageClient.ts"),
  "utf8",
);
assert.match(imageClientSource, /getAskVortaImagePreview/);
assert.doesNotMatch(imageClientSource, /localStorage|sessionStorage/);

const workspaceSource = readFileSync(
  resolve(root, "src/screens/AiOperations/AskVortaWorkspace.tsx"),
  "utf8",
);
assert.match(workspaceSource, /getAskVortaImagePreview/);
assert.match(workspaceSource, /Submitted maintenance photo/);

const assistantSource = readFileSync(
  resolve(root, "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx"),
  "utf8",
);
assert.match(assistantSource, /Closest stock matches/);
assert.match(assistantSource, /sparePhotoIdentification \? 5/);
assert.match(
  assistantSource,
  /hasStructuredActions \|\| answer\.recommendedActions\.length > 0/,
);

const entrySource = readFileSync(
  resolve(root, "netlify/functions/ask-vorta.mts"),
  "utf8",
);
assert.match(entrySource, /vor-076-spare-photo-top-five-v1/);

console.log("VOR-076 spare-photo contracts passed.");
