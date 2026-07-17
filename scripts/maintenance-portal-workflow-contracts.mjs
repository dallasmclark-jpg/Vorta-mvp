import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const operations = await readFile(
  new URL("../src/screens/AiOperations/AiOperations.tsx", import.meta.url),
  "utf8",
);

assert.match(
  operations,
  /label: "Training Plan"/,
  "Maintenance navigation must frame bookings as an operational training plan",
);
assert.doesNotMatch(
  operations,
  /label: "Providers"/,
  "Training providers must not remain a permanent primary navigation item",
);
assert.match(
  operations,
  /path="training-providers"/,
  "Training providers must remain available as a contextual route",
);
assert.doesNotMatch(
  operations,
  /MaintenanceOperationalBrief/,
  "Maintenance side pages must retain their native page hierarchy without a generic top brief",
);
assert.match(
  operations,
  /path="skills-matrix" element={<SkillsMatrixSection \/>}/,
  "Skills Matrix must render directly without an extra top wrapper",
);
assert.match(
  operations,
  /path="engineers" element={<EngineersSection \/>}/,
  "Engineers must render directly without an extra top wrapper",
);
assert.match(
  operations,
  /path="requirements" element={<RequirementsSection \/>}/,
  "Requirements must render directly without an extra top wrapper",
);
assert.match(
  operations,
  /path="training" element={<TrainingSection \/>}/,
  "Training Plan must render directly without an extra top wrapper",
);
assert.match(
  operations,
  /path="ai-matching" element={<AiMatchingSection \/>}/,
  "AI Matching must render directly without an extra top wrapper",
);

console.log("Maintenance portal workflow contracts passed.");
