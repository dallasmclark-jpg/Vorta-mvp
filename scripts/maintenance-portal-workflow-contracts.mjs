import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  operations,
  maintenanceExperience,
  pilotImpact,
  pilotAdoption,
  pilotSetup,
  pilotSetupHook,
  pilotSetupModel,
  pilotSetupData,
  pilotSetupPeople,
  pilotSetupRehearsal,
  pilotSetupLaunch,
  pilotUsage,
] = await Promise.all([
  read("../src/screens/AiOperations/AiOperations.tsx"),
  read("../src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx"),
  read("../src/screens/PilotImpact/PilotImpactSection.tsx"),
  read("../src/screens/PilotAdoption/PilotAdoptionSection.tsx"),
  read("../src/screens/PilotSetup/PilotSetupSection.tsx"),
  read("../src/screens/PilotSetup/usePilotSetup.ts"),
  read("../src/screens/PilotSetup/pilotSetupModel.ts"),
  read("../src/screens/PilotSetup/PilotSetupDataStage.tsx"),
  read("../src/screens/PilotSetup/PilotSetupPeopleStage.tsx"),
  read("../src/screens/PilotSetup/PilotSetupRehearsalStage.tsx"),
  read("../src/screens/PilotSetup/PilotSetupLaunchStage.tsx"),
  read("../src/lib/pilotUsage.ts"),
]);

const combinedPilotSetup = [
  pilotSetup,
  pilotSetupHook,
  pilotSetupModel,
  pilotSetupData,
  pilotSetupPeople,
  pilotSetupRehearsal,
  pilotSetupLaunch,
].join("\n");

const mustMatch = (source, pattern, message) => assert.match(source, pattern, message);
const mustNotMatch = (source, pattern, message) => assert.doesNotMatch(source, pattern, message);

mustMatch(operations, /label: "Training Plan"/, "Training must remain an operational plan");
mustNotMatch(operations, /label: "Providers"/, "Providers must not return to primary navigation");
mustMatch(operations, /path="training-providers"/, "Providers must remain contextually routable");
mustMatch(operations, /label: "Pilot Impact"/, "Pilot Impact must remain visible");
mustMatch(operations, /label: "Pilot Adoption"/, "Pilot Adoption must remain visible");
mustMatch(operations, /const canAdministerPilot/, "Pilot Setup must have an explicit admin capability");
mustMatch(
  operations,
  /isDemoAdmin[\s\S]*role === "vorta_admin"[\s\S]*role === "site_admin"/,
  "Only demo, Vorta or site administrators may expose Pilot Setup",
);
mustMatch(operations, /label: "Pilot Setup"/, "Admin navigation must expose Pilot Setup");
mustMatch(operations, /path="settings\/pilot-setup"/, "Pilot Setup route must remain available");
mustMatch(operations, /canAdministerPilot \?/, "Pilot Setup route must use the admin capability");
mustMatch(
  operations,
  /<Navigate to="\/dashboard" replace \/>/,
  "Unauthorised Pilot Setup access must redirect",
);
mustNotMatch(operations, /MaintenanceOperationalBrief/, "Side pages must retain native hierarchy");

assert.equal(
  [...pilotImpact.matchAll(/vorta_get_pilot_value_report/g)].length,
  1,
  "Pilot Impact must use one consolidated report RPC",
);
mustMatch(pilotImpact, /p_site_id: siteContext\.siteId/, "Pilot Impact must use auth site context");
mustMatch(pilotImpact, /p_start_date: range\.startDate/, "Pilot Impact must send start date");
mustMatch(pilotImpact, /p_end_date: range\.endDate/, "Pilot Impact must send end date");
mustMatch(pilotImpact, /Pilot to date/, "Pilot Impact must provide pilot-to-date range");
mustMatch(pilotImpact, /Last 30 days/, "Pilot Impact must provide 30-day range");
mustMatch(pilotImpact, /Custom range/, "Pilot Impact must provide custom range");
mustMatch(
  pilotImpact,
  /const maintenance = report\.maintenanceData\.periodActivity/,
  "Maintenance evidence must follow the selected period",
);
mustMatch(pilotImpact, /Download Pilot Report/, "Pilot report download must remain available");
mustMatch(pilotImpact, /window\.print\(\)/, "Pilot report must support print-to-PDF");
mustMatch(pilotImpact, /@media print/, "Pilot report must retain print styling");
mustMatch(
  pilotImpact,
  /Risk reductions and closed-gap claims remain deliberately suppressed/,
  "Baseline-only claims must remain suppressed",
);

assert.equal(
  [...pilotAdoption.matchAll(/vorta_get_pilot_adoption_report/g)].length,
  1,
  "Pilot Adoption must use one report RPC",
);
mustMatch(pilotAdoption, /p_site_id: siteId/, "Pilot Adoption must use auth site context");
mustMatch(pilotAdoption, /Ask Vorta queries/, "Ask Vorta engagement must remain visible");
mustMatch(pilotAdoption, /Follow-through actions/, "Follow-through must remain distinct from views");
mustMatch(pilotAdoption, /Prompt text is never stored/, "Prompt privacy boundary must remain visible");

assert.equal(
  [...pilotSetupHook.matchAll(/vorta_get_pilot_setup/g)].length,
  1,
  "Pilot Setup must load through one administrator-scoped RPC",
);
mustMatch(pilotSetupHook, /const siteId = siteContext\?\.siteId/, "Pilot Setup must use auth site context");
mustMatch(pilotSetupHook, /vorta_update_pilot_configuration/, "Configuration must use controlled RPC");
mustMatch(pilotSetupHook, /vorta_update_pilot_participants/, "Participants must be explicit and persisted");
mustMatch(pilotSetupHook, /vorta_update_pilot_success_criteria/, "Success criteria must be editable");
mustMatch(pilotSetupHook, /vorta_update_pilot_manual_check/, "Manual evidence must use controlled RPC");
mustMatch(pilotSetupHook, /vorta_record_pilot_rehearsal_attempt/, "Rehearsals must append attempts");
mustMatch(pilotSetupHook, /vorta_upsert_pilot_weekly_review/, "Weekly reviews must be persisted");
mustMatch(pilotSetupHook, /vorta_launch_pilot/, "Launch must use backend gate");
mustMatch(pilotSetupHook, /window\.addEventListener\("beforeunload"/, "Unsaved work must be protected");
mustMatch(
  pilotSetupHook,
  /configurationDirty \|\| criteriaDirty \|\| participantsDirty/,
  "Setup forms must keep independent dirty state",
);
mustMatch(pilotSetupHook, /draft\.notes\.trim\(\)\.length < 8/, "Passes must require notes");
mustMatch(pilotSetupHook, /draft\.evidence\.trim\(\)\.length < 8/, "Passes must require evidence");
mustMatch(
  pilotSetupHook,
  /A completed review needs value, accuracy, summary and next actions/,
  "Completed reviews must require decision-grade evidence",
);
mustMatch(pilotSetupModel, /result: ""/, "Rehearsal drafts must not default to pass");
mustMatch(
  pilotSetupRehearsal,
  /<option value="">Choose result<\/option>/,
  "Rehearsal result must be explicit",
);
mustMatch(pilotSetupRehearsal, /consecutive clean passes/i, "UI must explain pass-streak reset");
mustMatch(pilotSetupPeople, /At least 8 characters required/, "Manual pass must require evidence");
mustMatch(pilotSetupData, /These cannot be manually overridden/, "Automated gates must remain immutable");
mustMatch(pilotSetupLaunch, /Edit review/, "Weekly reviews must be editable");
mustMatch(
  pilotSetupLaunch,
  /disabled={[\s\S]*!report\.readiness\.launchEligible/,
  "Launch action must remain disabled until eligible",
);
mustMatch(pilotSetup, /aria-label="Pilot setup stages"/, "Pilot Setup must use staged navigation");
mustMatch(pilotSetup, /Unsaved changes/, "Pilot Setup must expose dirty state");
mustMatch(pilotSetup, /Confirm pilot launch/, "Pilot launch must require confirmation");
mustMatch(
  combinedPilotSetup,
  /Administrator-only workflow · SAP remains read-only/,
  "Pilot Setup must retain admin and read-only SAP boundaries",
);
mustNotMatch(
  combinedPilotSetup,
  /11000000-0000-0000-0000-000000000001/,
  "Pilot Setup must never hardcode the Wrexham site",
);

mustMatch(pilotUsage, /vorta_track_pilot_usage_event/, "Usage must use controlled tracking RPC");
mustMatch(pilotUsage, /window\.sessionStorage/, "Usage events must be session grouped");
mustNotMatch(pilotUsage, /service_role/, "Frontend must never expose service-role credentials");
mustMatch(maintenanceExperience, /eventType: "equipment_view"/, "Equipment reviews must be tracked");
mustMatch(maintenanceExperience, /eventType: "work_order_view"/, "Work-order reviews must be tracked");
mustMatch(maintenanceExperience, /eventType: "ask_vorta_query"/, "Ask Vorta use must be tracked");
mustMatch(maintenanceExperience, /questionLength: question\.length/, "Only Ask Vorta length may be retained");
mustNotMatch(
  maintenanceExperience,
  /metadata:\s*\{\s*question\s*:/,
  "Ask Vorta prompt text must not enter telemetry",
);
mustMatch(maintenanceExperience, /eventType: "recommendation_opened"/, "Recommendation follow-through must be tracked");
mustMatch(maintenanceExperience, /eventType: "pilot_report_downloaded"/, "Pilot report downloads must be tracked");

console.log("Maintenance portal workflow contracts passed.");
