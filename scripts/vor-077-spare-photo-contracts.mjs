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
  "is this spare on stock?",
  "is this a stock item",
  "is this in stock?",
  "do we stock this?",
  "have we got this part in stores?",
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
    image_alt_text: "Siemens compact servo motor with front flange and output shaft",
    image_verification_status: "verified",
    quantity_available: 1,
    storage_location: "Stores A-05",
    availability_status: "Available",
  },
  {
    id: "siemens-hmi",
    equipment_id: "vf02",
    component_name: "SIMATIC ET 200SP digital input module",
    component_code: "VF02-PLC-DI",
    oem_part_number: "6ES7131-6BH01-0BA0",
    maker_name: "Siemens",
    vendor_name: "Siemens Industry UK",
    image_url: "https://example.test/siemens-hmi.jpg",
    image_alt_text: "Siemens SIMATIC PLC digital input module",
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
assert.equal(
  ranked.candidates[0]?.componentId,
  "siemens-servo",
  "Visible motor geometry must rank a Siemens servo above a Siemens PLC module even before visual-image scoring.",
);
assert.ok(
  (ranked.candidates[0]?.metadataScore ?? 0) >
    (ranked.candidates[1]?.metadataScore ?? 0),
  "Component-class fallback must prevent equal metadata confidence for obvious physical mismatches.",
);

const matches = combineAskVortaSparePhotoMatches(ranked.candidates, [
  { componentId: "siemens-servo", visualSimilarity: 98 },
  { componentId: "siemens-hmi", visualSimilarity: 12 },
]);
assert.equal(matches[0]?.componentId, "siemens-servo");
assert.ok((matches[0]?.matchConfidence ?? 0) > (matches[1]?.matchConfidence ?? 0));
assert.ok(matches.length <= 5, "Spare-photo results must never exceed five matches.");

const metadataFallback = combineAskVortaSparePhotoMatches(ranked.candidates, []);
assert.equal(metadataFallback[0]?.componentId, "siemens-servo");
assert.ok(
  (metadataFallback[0]?.matchConfidence ?? 0) >
    (metadataFallback[1]?.matchConfidence ?? 0),
  "Unavailable visual-image scoring must not collapse dissimilar Siemens candidates to an equal confidence tie.",
);

const runtimeSource = readFileSync(
  resolve(root, "netlify/functions/ask-vorta/spare-photo-identification.mts"),
  "utf8",
);
assert.match(runtimeSource, /\.from\("vorta_entity_images"\)/);
assert.match(runtimeSource, /\.eq\("entity_type", "spare"\)/);
assert.match(runtimeSource, /prepareVisualCandidates/);
assert.match(runtimeSource, /candidateImageAsDataUrl/);
assert.match(runtimeSource, /Compare component class and physical geometry before branding/);
assert.match(runtimeSource, /Yes\. Closest stock match:/);
assert.doesNotMatch(runtimeSource, /get_equipment_decision_pack/);

const backtestRuntimeSource = readFileSync(
  resolve(root, "netlify/functions/ask-vorta/runtime-backtest.mts"),
  "utf8",
);
assert.match(backtestRuntimeSource, /shouldHandleSparePhotoPayload/);
assert.match(backtestRuntimeSource, /handleSparePhotoIdentification/);
assert.match(backtestRuntimeSource, /runtime-equipment-fallback\.mjs/);

const documentWrapperSource = readFileSync(
  resolve(root, "netlify/functions/ask-vorta/runtime-document-links.mts"),
  "utf8",
);
assert.match(documentWrapperSource, /runtime-backtest\.mjs/);
assert.match(documentWrapperSource, /ASK_VORTA_BACKTEST_REVISION/);

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

const focusGuardSource = readFileSync(
  resolve(root, "src/lib/askVortaWorkspaceFocusGuard.ts"),
  "utf8",
);
assert.match(focusGuardSource, /data-vorta-ai-workspace-input/);
assert.match(focusGuardSource, /outline: none !important/);
assert.match(focusGuardSource, /box-shadow: none !important/);
assert.match(focusGuardSource, /border-color: rgb\(55 65 81\) !important/);

const entryClientSource = readFileSync(
  resolve(root, "src/index.tsx"),
  "utf8",
);
assert.match(entryClientSource, /installAskVortaWorkspaceFocusGuard/);

const tailwindConfigSource = readFileSync(
  resolve(root, "tailwind.config.js"),
  "utf8",
);
assert.match(
  tailwindConfigSource,
  /blocklist: \["focus-within:border-blue-500\/50"\]/,
);
assert.doesNotMatch(tailwindConfigSource, /borderColor: "rgb\(55 65 81/);

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
assert.match(entrySource, /runtime-document-links\.mjs/);
assert.match(entrySource, /runtime-equipment-fallback\.mjs/);

console.log("VOR-077/VOR-079/VOR-080 spare-photo contracts passed.");
