import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function excludes(source, forbidden, label) {
  assert.equal(
    source.includes(forbidden),
    false,
    `${label} must not contain ${forbidden}`,
  );
}

const packageJson = JSON.parse(read("package.json"));
const assistant = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");
const controlledActions = read("src/screens/AiOperations/askVortaControlledActions.ts");
const dialog = read("src/screens/AiOperations/AskVortaActionReviewDialog.tsx");
const launcher = read("src/screens/AiOperations/askVortaActionReviewLauncher.tsx");
const schemaMigration = read(
  "supabase/migrations/20260803175500_vor_047_action_draft_schema.sql",
);
const draftMigration = read(
  "supabase/migrations/20260803175600_vor_047_action_draft_rpc.sql",
);
const confirmationMigration = read(
  "supabase/migrations/20260803175700_vor_047_action_confirmation_rpc.sql",
);
const registrationMigration = read(
  "supabase/migrations/20260803175800_vor_047_register_action_rpcs.sql",
);
const reconciliationMigration = read(
  "supabase/migrations/20260803180000_vor_047_disable_work_requests.sql",
);

assert.equal(
  packageJson.scripts.predev,
  "node scripts/vor-053-canonical-build-contracts.mjs --quick",
  "Confirmed-action behaviour must be committed source rather than a build transform",
);
assert.equal(
  packageJson.scripts.predev.includes("vor-047-integrate-confirmed-actions.mjs"),
  false,
);
assert.match(
  assistant,
  /openAskVortaActionReviewDialog/,
  "The canonical Ask Vorta action button must open the controlled review",
);
assert.match(
  assistant,
  /Controlled Ask Vorta actions require the review dialog/,
  "The legacy direct draft path must remain disabled in canonical source",
);

assert.match(
  controlledActions,
  /export type AskVortaActionKind = "handover_note"/,
  "The client action union must contain only handover_note",
);
assert.match(
  controlledActions,
  /p_action_kind: "handover_note"/,
  "The client must send a fixed handover_note action kind",
);
assert.match(
  controlledActions,
  /type: "work_order"/,
  "The only client target must be an existing work order",
);
excludes(controlledActions, '"work_request"', "Controlled-action client");
excludes(controlledActions, '"spare_stock_review"', "Controlled-action client");
excludes(controlledActions, 'from("maintenance_notifications")', "Controlled-action client");
excludes(controlledActions, 'from("spare_stock_review_tasks")', "Controlled-action client");

assert.match(
  dialog,
  /Vorta remains read-only from SAP/,
  "The review must state the SAP boundary",
);
assert.match(
  dialog,
  /Confirm handover action/,
  "The confirmation control must be explicitly handover-only",
);
excludes(dialog, 'value="spare_stock_review"', "Handover review dialog");
excludes(dialog, "requestedQuantity", "Handover review dialog");

assert.match(
  launcher,
  /max-width: 768px/,
  "The controlled review must not alter the approved phone presentation",
);
assert.match(
  launcher,
  /isHandoverRecommendation/,
  "Only a handover recommendation may open the controlled review",
);
excludes(launcher, "stock review", "Controlled-action launcher");

assert.match(
  schemaMigration,
  /action_kind in \('read_only', 'handover_note'\)/,
  "The action-kind database constraint must be handover-only",
);
excludes(schemaMigration, "create table if not exists public.spare_stock_review_tasks", "Action schema");

assert.match(
  draftMigration,
  /if v_kind <> 'handover_note'/,
  "The draft RPC must reject every non-handover action kind",
);
assert.match(
  draftMigration,
  /v_target_type <> 'work_order'/,
  "The draft RPC must require an existing work order",
);
excludes(draftMigration, "elsif v_kind = 'work_request'", "Draft RPC");
excludes(draftMigration, "elsif v_kind = 'spare_stock_review'", "Draft RPC");

assert.match(
  confirmationMigration,
  /vorta_save_shift_handover_action/,
  "Confirmation must dispatch only through the approved handover RPC",
);
assert.match(
  confirmationMigration,
  /v_draft\.action_kind <> 'handover_note'/,
  "Confirmation must reject every non-handover draft",
);
excludes(confirmationMigration, "insert into public.maintenance_notifications", "Confirmation RPC");
excludes(confirmationMigration, "insert into public.spare_stock_review_tasks", "Confirmation RPC");
excludes(confirmationMigration, "elsif v_draft.action_kind", "Confirmation RPC");

assert.match(
  registrationMigration,
  /Dispatch is limited to the existing vorta_save_shift_handover_action RPC/,
  "The privileged RPC manifest must describe the handover-only boundary",
);
assert.match(
  reconciliationMigration,
  /drop table public\.spare_stock_review_tasks/,
  "Reconciliation must remove the unused parallel stock-task queue",
);
assert.match(
  reconciliationMigration,
  /vorta_block_ask_vorta_maintenance_notifications/,
  "The database must retain a hard maintenance-notification block",
);
assert.match(
  reconciliationMigration,
  /Reconciliation must fail closed/,
  "Unexpected Ask Vorta maintenance notifications must stop reconciliation",
);

console.log("✓ VOR-047 is limited to confirmed Vorta shift-handover actions");
console.log("✓ SAP and SAP-equivalent maintenance records remain read-only");
console.log("✓ Canonical source owns the confirmed-action workflow");
console.log("✓ The unused spare-stock task queue is removed fail-closed");
console.log("✓ The approved mobile Ask Vorta presentation remains unchanged");
