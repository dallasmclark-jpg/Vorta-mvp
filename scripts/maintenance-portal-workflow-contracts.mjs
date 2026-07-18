import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const operations = await readFile(
  new URL("../src/screens/AiOperations/AiOperations.tsx", import.meta.url),
  "utf8",
);
const pilotImpact = await readFile(
  new URL("../src/screens/PilotImpact/PilotImpactSection.tsx", import.meta.url),
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
assert.match(
  operations,
  /label: "Pilot Impact"/,
  "Maintenance navigation must expose the pilot evidence page",
);
assert.match(
  operations,
  /path="pilot-impact" element={<PilotImpactSection \/>}/,
  "Pilot Impact must render as a native Maintenance Manager route",
);
assert.equal(
  [...pilotImpact.matchAll(/vorta_get_pilot_value_report/g)].length,
  1,
  "Pilot Impact must use one consolidated pilot value RPC",
);
assert.match(
  pilotImpact,
  /p_site_id: siteContext\.siteId/,
  "Pilot Impact must use the authenticated site context",
);
assert.match(
  pilotImpact,
  /p_start_date: range\.startDate/,
  "Pilot Impact must pass the selected report start date to the backend",
);
assert.match(
  pilotImpact,
  /p_end_date: range\.endDate/,
  "Pilot Impact must pass the selected report end date to the backend",
);
assert.match(
  pilotImpact,
  /Pilot to date/,
  "Pilot Impact must provide a pilot-to-date range",
);
assert.match(
  pilotImpact,
  /Last 30 days/,
  "Pilot Impact must provide a rolling 30-day range",
);
assert.match(
  pilotImpact,
  /Custom range/,
  "Pilot Impact must provide a custom date range",
);
assert.match(
  pilotImpact,
  /const maintenance = report\.maintenanceData\.periodActivity/,
  "Pilot report maintenance evidence must follow the selected period",
);
assert.match(
  pilotImpact,
  /report\.site\?\.name/,
  "Pilot reports must display authorised site metadata from the consolidated RPC",
);
assert.match(
  pilotImpact,
  /Download Pilot Report/,
  "Pilot Impact must expose the report download action",
);
assert.match(
  pilotImpact,
  /window\.print\(\)/,
  "Pilot report download must use the browser print-to-PDF workflow",
);
assert.match(
  pilotImpact,
  /@media print/,
  "Pilot Impact must include a dedicated print layout",
);
assert.match(
  pilotImpact,
  /data-pilot-impact-report="true"/,
  "Pilot Impact must isolate printable evidence from portal navigation",
);
assert.match(
  pilotImpact,
  /Risk reductions and closed-gap claims remain deliberately suppressed/,
  "Pilot Impact must explain why baseline-only data is not a reduction claim",
);
assert.doesNotMatch(
  pilotImpact,
  /11000000-0000-0000-0000-000000000001/,
  "Pilot Impact must not hardcode the Wrexham pilot site",
);

console.log("Maintenance portal workflow contracts passed.");
