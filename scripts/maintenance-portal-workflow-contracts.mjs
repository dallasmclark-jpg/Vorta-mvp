import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const operations = await readFile(
  new URL("../src/screens/AiOperations/AiOperations.tsx", import.meta.url),
  "utf8",
);
const maintenanceExperience = await readFile(
  new URL("../src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx", import.meta.url),
  "utf8",
);
const pilotImpact = await readFile(
  new URL("../src/screens/PilotImpact/PilotImpactSection.tsx", import.meta.url),
  "utf8",
);
const pilotAdoption = await readFile(
  new URL("../src/screens/PilotAdoption/PilotAdoptionSection.tsx", import.meta.url),
  "utf8",
);
const pilotSetup = await readFile(
  new URL("../src/screens/PilotSetup/PilotSetupSection.tsx", import.meta.url),
  "utf8",
);
const pilotSetupHook = await readFile(
  new URL("../src/screens/PilotSetup/usePilotSetup.ts", import.meta.url),
  "utf8",
);
const pilotSetupModel = await readFile(
  new URL("../src/screens/PilotSetup/pilotSetupModel.ts", import.meta.url),
  "utf8",
);
const pilotSetupData = await readFile(
  new URL("../src/screens/PilotSetup/PilotSetupDataStage.tsx", import.meta.url),
  "utf8",
);
const pilotSetupPeople = await readFile(
  new URL("../src/screens/PilotSetup/PilotSetupPeopleStage.tsx", import.meta.url),
  "utf8",
);
const pilotSetupRehearsal = await readFile(
  new URL("../src/screens/PilotSetup/PilotSetupRehearsalStage.tsx", import.meta.url),
  "utf8",
);
const pilotSetupLaunch = await readFile(
  new URL("../src/screens/PilotSetup/PilotSetupLaunchStage.tsx", import.meta.url),
  "utf8",
);
const pilotUsage = await readFile(
  new URL("../src/lib/pilotUsage.ts", import.meta.url),
  "utf8",
);
const combinedPilotSetup = [
  pilotSetup,
  pilotSetupHook,
  pilotSetupModel,
  pilotSetupData,
  pilotSetupPeople,
  pilotSetupRehearsal,
  pilotSetupLaunch,
].join("\n");

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
assert.match(
  operations,
  /label: "Pilot Adoption"/,
  "Maintenance navigation must expose pilot adoption evidence",
);
assert.match(
  operations,
  /path="pilot-adoption" element={<PilotAdoptionSection \/>}/,
  "Pilot Adoption must render as a native Maintenance Manager route",
);
assert.match(
  operations,
  /const canAdministerPilot/,
  "Pilot Setup visibility must be controlled by an explicit administrator capability",
);
assert.match(
  operations,
  /isDemoAdmin[\s\S]*role === "vorta_admin"[\s\S]*role === "site_admin"/,
  "Only Vorta or site administrators may expose Pilot Setup",
);
assert.match(
  operations,
  /label: "Pilot Setup"/,
  "Administrator navigation must expose Pilot Setup",
);
assert.match(
  operations,
  /path="settings\/pilot-setup"/,
  "Pilot Setup must remain a site-scoped Settings route",
);
assert.match(
  operations,
  /canAdministerPilot \?/,
  "Pilot Setup route rendering must use the administrator capability",
);
assert.match(
  operations,
  /<Navigate to="\/dashboard" replace \/>/,
  "Unauthorised Pilot Setup routes must redirect to the dashboard",
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

assert.equal(
  [...pilotAdoption.matchAll(/vorta_get_pilot_adoption_report/g)].length,
  1,
  "Pilot Adoption must use one manager-scoped adoption RPC",
);
assert.match(
  pilotAdoption,
  /p_site_id: siteId/,
  "Pilot Adoption must use the authenticated site context",
);
assert.match(
  pilotAdoption,
  /p_start_date: range\.startDate/,
  "Pilot Adoption must pass the selected start date to the backend",
);
assert.match(
  pilotAdoption,
  /p_end_date: range\.endDate/,
  "Pilot Adoption must pass the selected end date to the backend",
);
assert.match(
  pilotAdoption,
  /Ask Vorta queries/,
  "Pilot Adoption must expose Ask Vorta engagement",
);
assert.match(
  pilotAdoption,
  /Follow-through actions/,
  "Pilot Adoption must distinguish meaningful follow-through from page views",
);
assert.match(
  pilotAdoption,
  /Prompt text is never stored/,
  "Pilot Adoption must state the prompt privacy boundary",
);
assert.doesNotMatch(
  pilotAdoption,
  /11000000-0000-0000-0000-000000000001/,
  "Pilot Adoption must not hardcode the Wrexham pilot site",
);

assert.equal(
  [...pilotSetupHook.matchAll(/vorta_get_pilot_setup/g)].length,
  1,
  "Pilot Setup must load through one administrator-scoped setup RPC",
);
assert.match(
  pilotSetupHook,
  /const siteId = siteContext\?\.siteId/,
  "Pilot Setup must use authenticated site context for every workflow update",
);
assert.match(
  pilotSetupHook,
  /vorta_update_pilot_configuration/,
  "Pilot Setup must persist objective, dates and limitations through the controlled RPC",
);
assert.match(
  pilotSetupHook,
  /vorta_update_pilot_participants/,
  "Pilot Setup must explicitly persist pilot ownership and the manager contact",
);
assert.match(
  pilotSetupHook,
  /vorta_update_pilot_success_criteria/,
  "Pilot Setup success criteria must be editable rather than decorative",
);
assert.match(
  pilotSetupHook,
  /vorta_update_pilot_manual_check/,
  "Pilot Setup must persist evidence-backed manual readiness",
);
assert.match(
  pilotSetupHook,
  /vorta_record_pilot_rehearsal_attempt/,
  "Pilot Setup must append rehearsal evidence rather than overwrite history",
);
assert.match(
  pilotSetupHook,
  /vorta_upsert_pilot_weekly_review/,
  "Pilot Setup must support structured weekly pilot reviews",
);
assert.match(
  pilotSetupHook,
  /vorta_launch_pilot/,
  "Pilot Setup must launch through the backend readiness gate",
);
assert.match(
  pilotSetupHook,
  /window\.addEventListener\("beforeunload"/,
  "Pilot Setup must protect unsaved configuration from accidental navigation",
);
assert.match(
  pilotSetupHook,
  /configurationDirty \|\| criteriaDirty \|\| participantsDirty/,
  "Pilot Setup must track dirty state independently across setup forms",
);
assert.match(
  pilotSetupHook,
  /draft\.notes\.trim\(\)\.length < 8/,
  "Passing rehearsals must require meaningful notes",
);
assert.match(
  pilotSetupHook,
  /draft\.evidence\.trim\(\)\.length < 8/,
  "Passing rehearsals must require meaningful evidence",
);
assert.match(
  pilotSetupHook,
  /A completed review needs value, accuracy, summary and next actions/,
  "Completed weekly reviews must contain decision-grade evidence",
);
assert.match(
  pilotSetupModel,
  /result: ""/,
  "Rehearsal drafts must not default to pass",
);
assert.match(
  pilotSetupRehearsal,
  /<option value="">Choose result<\/option>/,
  "Rehearsal result selection must require an explicit choice",
);
assert.match(
  pilotSetupRehearsal,
  /consecutive clean passes/i,
  "Rehearsal UI must explain that failures reset the pass streak",
);
assert.match(
  pilotSetupPeople,
  /At least 8 characters required/,
  "Manual passes must remain unavailable until evidence is present",
);
assert.match(
  pilotSetupData,
  /These cannot be manually overridden/,
  "Automated readiness evidence must not be manually overridable",
);
assert.match(
  pilotSetupLaunch,
  /Edit review/,
  "Existing weekly reviews must be reloadable for editing",
);
assert.match(
  pilotSetup,
  /aria-label="Pilot setup stages"/,
  "Pilot Setup must use a compact five-stage workflow instead of one long form",
);
assert.match(
  pilotSetup,
  /Unsaved changes/,
  "Pilot Setup must visibly indicate unsaved work",
);
assert.match(
  pilotSetup,
  /Confirm pilot launch/,
  "Pilot launch must require an explicit confirmation dialog",
);
assert.match(
  pilotSetup,
  /disabled={[\s\S]*!report\.readiness\.launchEligible/,
  "Pilot launch must remain disabled until the backend marks the site eligible",
);
assert.match(
  combinedPilotSetup,
  /Administrator-only workflow · SAP remains read-only/,
  "Pilot Setup must preserve the administrator and read-only SAP boundaries",
);
assert.doesNotMatch(
  combinedPilotSetup,
  /11000000-0000-0000-0000-000000000001/,
  "Pilot Setup must not hardcode the Wrexham pilot site",
);

assert.match(
  pilotUsage,
  /vorta_track_pilot_usage_event/,
  "Pilot usage must use the controlled tracking RPC",
);
assert.match(
  pilotUsage,
  /window\.sessionStorage/,
  "Pilot usage must group events into browser sessions",
);
assert.doesNotMatch(
  pilotUsage,
  /service_role/,
  "Pilot usage tracking must never expose a service-role credential",
);
assert.match(
  maintenanceExperience,
  /eventType: "equipment_view"/,
  "Equipment route reviews must be captured",
);
assert.match(
  maintenanceExperience,
  /eventType: "work_order_view"/,
  "Work-order overlay reviews must be captured",
);
assert.match(
  maintenanceExperience,
  /eventType: "ask_vorta_query"/,
  "Ask Vorta submissions must be captured without prompt text",
);
assert.match(
  maintenanceExperience,
  /questionLength: question\.length/,
  "Ask Vorta usage may retain question length for quality analysis",
);
assert.doesNotMatch(
  maintenanceExperience,
  /metadata:\s*\{\s*question\s*:/,
  "Ask Vorta prompt text must not be sent to usage tracking",
);
assert.match(
  maintenanceExperience,
  /eventType: "recommendation_opened"/,
  "AI recommendation follow-through must be captured",
);
assert.match(
  maintenanceExperience,
  /eventType: "pilot_report_downloaded"/,
  "Pilot report downloads must be captured",
);
assert.doesNotMatch(
  maintenanceExperience,
  /location\.pathname === "\/pilot-adoption"/,
  "The adoption analytics page must not inflate its own usage score",
);

console.log("Maintenance portal workflow contracts passed.");
