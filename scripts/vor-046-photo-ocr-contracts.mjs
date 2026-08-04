import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import "./vor-046-image-evidence-contracts.mjs";

const read = (path) => readFileSync(path, "utf8");
const backendIntegration = read("scripts/vor-046-integrate-image-backend.mjs");
const backendHelpers = read("scripts/templates/vor-046-image-backend-helpers.txt");
const backendSurface = `${backendIntegration}\n${backendHelpers}`;
const clientIntegration = read("scripts/vor-046-integrate-image-client.mjs");
const imageValidation = read("netlify/functions/_shared/askVortaImageEvidence.mjs");
const diagnosis = read("netlify/functions/_shared/askVortaImageDiagnosis.mjs");
const clientImage = read("src/screens/AiOperations/askVortaImageClient.ts");
const packageJson = JSON.parse(read("package.json"));

for (const script of [
  "scripts/vor-046-integrate-image-backend.mjs",
  "scripts/vor-046-integrate-image-client.mjs",
  "scripts/vor-046-image-diagnosis-evals.mjs",
]) {
  const syntax = spawnSync(process.execPath, ["--check", script], { encoding: "utf8" });
  assert.equal(syntax.status, 0, `${script} has invalid syntax:\n${syntax.stderr}`);
}

const diagnosisEval = spawnSync(
  process.execPath,
  [
    "scripts/vor-046-image-diagnosis-evals.mjs",
    "tests/evals/vor-046-image-diagnosis.json",
  ],
  { encoding: "utf8" },
);
assert.equal(
  diagnosisEval.status,
  0,
  `VOR-046 image diagnosis fixtures failed:\n${diagnosisEval.stdout}\n${diagnosisEval.stderr}`,
);

for (const marker of [
  "MAX_IMAGE_BYTES = 3_000_000",
  "MIN_IMAGE_DIMENSION = 64",
  "MAX_IMAGE_DIMENSION = 4096",
  "MAX_IMAGE_PIXELS = 12_000_000",
  "dimensionsFromPng",
  "dimensionsFromJpeg",
  "dimensionsFromWebp",
  "actual_mime_mismatch",
  "safeAskVortaImageMetadata",
]) assert.match(imageValidation, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

for (const marker of [
  "ASK_VORTA_IMAGE_EXTRACTION_SCHEMA",
  "observedText",
  "faultCodes",
  "manufacturerCandidates",
  "modelCandidates",
  "partCandidates",
  "equipmentCodeCandidates",
  "exact_identifier",
  "ambiguous",
  "no_supported_match",
  "selectedEquipmentQuery",
]) assert.match(diagnosis, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

assert.match(backendIntegration, /vor-046-image-backend-helpers\.txt/);
assert.match(backendSurface, /type: "input_image"/);
assert.match(backendSurface, /image_url: image\.dataUrl/);
assert.match(backendSurface, /store: false/);
assert.match(backendSurface, /VORTA_AI_VISION_MODEL/);
assert.match(backendSurface, /equipment_assets/);
assert.match(backendSurface, /equipment_components/);
assert.match(backendSurface, /\.eq\("site_id", request\.siteId\)/);
assert.match(backendSurface, /get_equipment_decision_pack/);
assert.match(backendSurface, /approved\/current documents/);
assert.match(backendSurface, /Do not recommend bypassing protection/);
assert.match(backendSurface, /User-supplied image evidence/);
assert.match(backendSurface, /imageFingerprint/);
assert.doesNotMatch(backendSurface, /storage\.from|supabase\.storage|upload\(/);
assert.doesNotMatch(backendSurface, /answer\.image\s*=|conversationContext.*dataUrl/);

for (const marker of [
  "maxBytes: 3_000_000",
  "minDimension: 64",
  "maxDimension: 4096",
  "maxPixels: 12_000_000",
  "createImageBitmap",
  "readAsDataUrl",
]) assert.match(clientImage, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

assert.match(clientIntegration, /max-md:hidden|md:inline-flex/);
assert.match(clientIntegration, /PreparedAskVortaImage/);
assert.match(clientIntegration, /Not saved to Vorta records or Recents/);
assert.match(clientIntegration, /does not retain image uploads/);
assert.match(clientIntegration, /imageName/);
assert.match(clientIntegration, /dataUrl: image\.dataUrl/);
assert.doesNotMatch(clientIntegration, /localStorage[^\n]*dataUrl/);
assert.doesNotMatch(clientIntegration, /conversationContext\s*:\s*\{[^}]*dataUrl/);
assert.doesNotMatch(clientIntegration, /answer\s*:\s*\{[^}]*dataUrl/);
assert.doesNotMatch(clientIntegration, /src\/screens\/ShiftHandover|ShiftHandover/);

assert.equal(packageJson.scripts.prebuild, "node scripts/validate-live-pilot.mjs");
assert.equal(
  packageJson.scripts.build,
  "npm run build:metadata && npm run typecheck && npm run test:contracts && npm run test:smoke && vite build",
);
assert.match(
  packageJson.scripts["build:metadata"],
  /vor-045-integrate-conversation-context\.mjs && node scripts\/vor-046-integrate-image-backend\.mjs && node scripts\/vor-046-integrate-image-client\.mjs(?: && node scripts\/vor-047-integrate-confirmed-actions\.mjs)?(?: && node scripts\/vor-048-integrate-routing-telemetry-feedback\.mjs)?(?: && node scripts\/vor-049-integrate-decision-ready-equipment\.mjs)? && node scripts\/write-build-metadata\.mjs/,
);
assert.equal(
  packageJson.scripts["eval:ask-vorta:vor046"],
  "node scripts/vor-046-image-diagnosis-evals.mjs tests/evals/vor-046-image-diagnosis.json",
);

console.log("VOR-046 photo and OCR workflow contracts passed.");
