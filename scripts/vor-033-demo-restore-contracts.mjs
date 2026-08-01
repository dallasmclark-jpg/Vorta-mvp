import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readMigration = (name) => readFileSync(resolve(root, "supabase/migrations", name), "utf8");

const snapshot = readMigration("20260801183220_extend_demo_snapshot_for_restore.sql");
const restore = readMigration("20260801183251_add_demo_restore_health_and_action.sql");
const baseline = readMigration("20260801183324_capture_demo_restore_baseline.sql");
const normalisation = readMigration("20260801183434_normalise_demo_restore_audit_timestamps.sql");

const requireText = (source, expected, message) => {
  assert.ok(source.includes(expected), message ?? `Expected migration to include: ${expected}`);
};

const payloadKeys = [
  "equipmentAssets",
  "equipmentFaultCodes",
  "preventiveMaintenance",
  "equipmentComponents",
  "siteMaterialStock",
  "knowledgeDocuments",
  "maintenanceNotifications",
  "workOrders",
  "workOrderConfirmations",
  "knowledgeChunks",
  "maintenanceOrderNotificationLinks",
  "workOrderMaterialReservations",
  "workOrderGoodsMovements",
  "shiftHandoverActions",
];
for (const key of payloadKeys) requireText(snapshot, `'${key}'`, `Snapshot must include ${key}.`);

requireText(snapshot, "private.vorta_upsert_demo_snapshot_rows_internal", "Restore writes must use a constrained helper.");
requireText(snapshot, "Table % is not approved for demo restore", "The generic helper must reject unapproved tables.");
requireText(snapshot, "jsonb_populate_recordset", "Snapshot rows must be type-checked by the target table schema.");
requireText(snapshot, "on conflict (id) do update", "The restore must support existing and missing captured rows.");
requireText(snapshot, "revoke all on function private.vorta_upsert_demo_snapshot_rows_internal(regclass,jsonb) from public,anon,authenticated");
requireText(snapshot, "grant execute on function private.vorta_upsert_demo_snapshot_rows_internal(regclass,jsonb) to service_role");

const restoreOrder = [
  "'public.equipment_assets'::regclass",
  "'public.equipment_fault_codes'::regclass",
  "'public.preventive_maintenance'::regclass",
  "'public.equipment_components'::regclass",
  "'public.site_material_stock'::regclass",
  "'public.knowledge_documents'::regclass",
  "'public.maintenance_notifications'::regclass",
  "'public.work_orders'::regclass",
  "'public.work_order_confirmations'::regclass",
  "'public.knowledge_chunks'::regclass",
  "'public.maintenance_order_notification_links'::regclass",
  "'public.work_order_material_reservations'::regclass",
  "'public.work_order_goods_movements'::regclass",
  "'public.shift_handover_actions'::regclass",
];
let previousIndex = -1;
for (const table of restoreOrder) {
  const index = restore.indexOf(`v_baseline.payload->`, restore.indexOf(table));
  const tableIndex = restore.indexOf(table, previousIndex + 1);
  assert.ok(tableIndex > previousIndex, `Restore dependency order is wrong at ${table}.`);
  assert.ok(index > tableIndex, `Restore call for ${table} is incomplete.`);
  previousIndex = tableIndex;
}

requireText(restore, "pg_advisory_xact_lock", "Only one restore may run for a site at a time.");
requireText(restore, "private.vorta_get_demo_baseline_restore_health_internal", "Every restore must verify exact snapshot equality.");
requireText(restore, "raise exception 'Demo restore did not reproduce baseline", "A mismatched restore must roll back.");
requireText(restore, "perform public.vorta_recalculate_equipment_risk_profiles()");
requireText(restore, "perform public.vorta_sync_maintenance_risk_work_plan()");
requireText(restore, "perform private.vorta_apply_demo_storyline_narratives_internal", "Approved story narratives must survive restore recalculation.");
requireText(restore, "revoke all on function private.vorta_restore_demo_dataset_baseline_internal(uuid) from public,anon,authenticated");
requireText(restore, "grant execute on function private.vorta_restore_demo_dataset_baseline_internal(uuid) to service_role");

requireText(baseline, "'vor-033-credible-v2-restore-test'");
requireText(baseline, "private.vorta_capture_demo_dataset_baseline_internal");

requireText(normalisation, "value - 'updated_at'", "Trigger-maintained audit timestamps must not invalidate semantic equality.");
requireText(normalisation, "'ignoredAuditFields',jsonb_build_array('updated_at')");
assert.equal(normalisation.includes("source_updated_at"), false, "Source evidence timestamps must remain part of restore equality.");

for (const source of [snapshot, restore, baseline, normalisation]) {
  assert.equal(/\b(delete|truncate)\s+from\s+public\./i.test(source), false, "Restore migrations must not destructively clear production tables.");
  assert.equal(/create\s+(or\s+replace\s+)?function\s+public\.vorta_.*restore/i.test(source), false, "Restore functions must remain outside the public Data API schema.");
}

console.log("VOR-033 demo restore contracts passed (14 evidence groups)." );
