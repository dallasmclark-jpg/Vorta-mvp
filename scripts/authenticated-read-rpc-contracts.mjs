import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260720090000_review_authenticated_read_rpcs.sql",
    import.meta.url,
  ),
  "utf8",
);

const reviewedReadRpcs = [
  "vorta_get_area_equipment_risk_reduction_plan(text,uuid)",
  "vorta_get_area_risk_reduction_plan(text)",
  "vorta_get_ask_vorta_evidence(uuid,text,integer)",
  "vorta_get_capability_reconciliation_report(uuid,integer)",
  "vorta_get_capability_risk_history(uuid,date,date,integer)",
  "vorta_get_demo_area_equipment_risk(text)",
  "vorta_get_demo_backend_health()",
  "vorta_get_demo_equipment_risk_list()",
  "vorta_get_document_ingestion_health(uuid)",
  "vorta_get_equipment_calibrations(uuid)",
  "vorta_get_equipment_development_paths(uuid)",
  "vorta_get_equipment_engineer_capabilities(uuid)",
  "vorta_get_equipment_evidence_coverage(uuid[])",
  "vorta_get_equipment_labour_risk(uuid,date,text)",
  "vorta_get_equipment_notification_summary(uuid)",
  "vorta_get_equipment_notifications(uuid)",
  "vorta_get_equipment_operator_capabilities(uuid)",
  "vorta_get_equipment_recommended_work_queue(uuid)",
  "vorta_get_equipment_risk_intervention(uuid)",
  "vorta_get_equipment_risk_trend(uuid,text,date)",
  "vorta_get_equipment_skills_showcase(uuid)",
  "vorta_get_equipment_work_items(uuid)",
  "vorta_get_latest_pilot_readiness_summary()",
  "vorta_get_maintenance_workflow_integrity(uuid)",
  "vorta_get_operational_dashboard_snapshot()",
  "vorta_get_pilot_adoption_report(uuid,date,date)",
  "vorta_get_pilot_setup(uuid)",
  "vorta_get_pilot_value_report(uuid,date,date)",
  "vorta_get_risk_dashboard_scope_kpis(date)",
  "vorta_get_risk_dashboard_scope_plans()",
  "vorta_get_risk_dashboard_scopes()",
  "vorta_get_risk_reduction_kpis(text,date)",
  "vorta_get_scoped_risk_reduction_kpis(text,date,text)",
  "vorta_get_shift_calendar(uuid,date,date)",
  "vorta_get_shift_cover_snapshot(uuid,date,date)",
  "vorta_get_shift_roster(uuid,date,text)",
  "vorta_get_site_labour_risk(uuid,date,text)",
  "vorta_get_site_risk_reduction_plan()",
  "vorta_get_workforce_avatar_by_name(text,text)",
  "vorta_get_workforce_avatar(text,uuid)",
  "vorta_match_visual_diagnostic(uuid,text,integer)",
  "vorta_resolve_shift_context(uuid,timestamp with time zone)",
  "vorta_search_equipment_knowledge(uuid,text,integer)",
];

assert.equal(reviewedReadRpcs.length, 43);
for (const rpcIdentity of reviewedReadRpcs) {
  assert.ok(
    migration.includes(`'${rpcIdentity}'`),
    `Missing reviewed read RPC: ${rpcIdentity}`,
  );
}

for (const expected of [
  "add column if not exists rpc_class",
  "vorta_privileged_rpc_allowlist_class_check",
  "rpc_class in ('mutation', 'read')",
  "private.vorta_get_unreviewed_authenticated_read_rpcs",
  "has_function_privilege('authenticated'",
  "function_row.proname !~ '^vorta_(launch|update|record|refresh|recalculate|log|track|upsert)'",
  "unreviewed_authenticated_read_rpcs",
  "reviewedAuthenticatedReadRpcCount",
  "reviewed_read_count <> 43",
]) {
  assert.ok(migration.includes(expected), `Missing read RPC contract: ${expected}`);
}

assert.match(
  migration,
  /left join private\.vorta_privileged_rpc_allowlist allowlist[\s\S]*allowlist\.rpc_class = 'read'/,
);
assert.match(
  migration,
  /and allowlist\.rpc_identity is null/,
);
assert.doesNotMatch(
  migration,
  /revoke execute on function public\.vorta_get_demo_backend_health/,
);
assert.doesNotMatch(
  migration,
  /revoke execute on function public\.vorta_get_shift_cover_snapshot/,
);

console.log("Authenticated read RPC contracts passed.");
