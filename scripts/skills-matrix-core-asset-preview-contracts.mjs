import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const gate = await readFile(
  new URL("../src/screens/SkillsMatrix/index.ts", import.meta.url),
  "utf8",
);
const preview = await readFile(
  new URL("../src/screens/SkillsMatrix/SkillsMatrixCoreAssetPreview.tsx", import.meta.url),
  "utf8",
);
const envExample = await readFile(
  new URL("../.env.example", import.meta.url),
  "utf8",
);

assert.match(gate, /VITE_SKILLS_MATRIX_CORE_ASSET_PREVIEW === "true"/);
assert.match(gate, /SkillsMatrixCoreAssetPreview/);
assert.match(gate, /SkillsMatrixNative/);
assert.match(gate, /CORE_ASSET_SKILLS_PREVIEW_ENABLED/);

assert.match(envExample, /VITE_SKILLS_MATRIX_CORE_ASSET_PREVIEW=false/);
assert.doesNotMatch(envExample, /VITE_SKILLS_MATRIX_CORE_ASSET_PREVIEW=true/);

for (const text of [
  "Core + Asset Preview",
  "Comparison model only",
  "Core Capability",
  "Asset Competence",
  "Skills Readiness",
  "40% Core Capability",
  "60% Asset Competence",
  "PM score capped at 5",
  "Historical PM evidence is read-only",
  "existing capability score remains authoritative",
]) {
  assert.match(
    preview,
    new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    `Preview must retain ${text}`,
  );
}

assert.match(preview, /validateSkillsMatrixPayload\(value\)/);
assert.match(preview, /preview\.modelStatus !== "preview"/);
assert.match(preview, /details\?\.\[payload\.overall\.id\]\?\.capabilityPreview/);
assert.match(preview, /selectedSummary\.proposedSkillsReadinessScore/);
assert.match(preview, /selectedSummary\.coreCapabilityScore/);
assert.match(preview, /selectedSummary\.assetCompetenceScore/);
assert.match(preview, /preview\.coreCapability\.engineers/);
assert.match(preview, /preview\?\.assetCompetence\.assets/);
assert.match(preview, /engineer\.pmExperienceScore\.toFixed\(1\)/);
assert.match(preview, /engineer\.confirmedPmCount/);
assert.match(preview, /engineer\.lastPmCompletedAt/);
assert.match(preview, /clearMaintenancePortalDataCache\(SKILLS_MATRIX_FUNCTION\)/);
assert.match(preview, /supabase\.functions\.invoke/);
assert.doesNotMatch(preview, /\.from\("work_order_confirmations"\)/);
assert.doesNotMatch(preview, /\.from\("engineer_source_identities"\)/);
assert.doesNotMatch(preview, /\.from\("engineer_pm_experience_snapshots"\)/);
assert.doesNotMatch(preview, /insert\(|update\(|delete\(/);

console.log("Skills Matrix core and asset preview contracts passed.");
