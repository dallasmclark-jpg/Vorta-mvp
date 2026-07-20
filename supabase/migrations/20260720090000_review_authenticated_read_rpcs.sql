-- Make every authenticated read-only SECURITY DEFINER RPC explicit, reviewed and
-- health-enforced. Mutation-capable wrappers remain classified separately.

alter table private.vorta_privileged_rpc_allowlist
  add column if not exists rpc_class text not null default 'mutation';

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.vorta_privileged_rpc_allowlist'::regclass
      and conname = 'vorta_privileged_rpc_allowlist_class_check'
  ) then
    alter table private.vorta_privileged_rpc_allowlist
      add constraint vorta_privileged_rpc_allowlist_class_check
      check (rpc_class in ('mutation', 'read'));
  end if;
end;
$constraint$;

insert into private.vorta_privileged_rpc_allowlist(
  rpc_identity,
  purpose,
  access_contract,
  reviewed_migration,
  rpc_class
)
values
  ('vorta_get_area_equipment_risk_reduction_plan(text,uuid)', 'Maintenance Manager read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_area_risk_reduction_plan(text)', 'Maintenance Manager read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_ask_vorta_evidence(uuid,text,integer)', 'Ask Vorta evidence read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_capability_reconciliation_report(uuid,integer)', 'Capability read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_capability_risk_history(uuid,date,date,integer)', 'Capability history read RPC', 'Requires authorised site manager.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_demo_area_equipment_risk(text)', 'Maintenance Manager read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_demo_backend_health()', 'Authenticated backend health read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_demo_equipment_risk_list()', 'Maintenance Manager read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_document_ingestion_health(uuid)', 'Document health read RPC', 'Requires authorised site manager.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_equipment_calibrations(uuid)', 'Equipment read RPC', 'Requires authorised equipment access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_equipment_development_paths(uuid)', 'Equipment capability read RPC', 'Requires authorised equipment access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_equipment_engineer_capabilities(uuid)', 'Equipment capability read RPC', 'Requires authorised equipment access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_equipment_evidence_coverage(uuid[])', 'Equipment evidence read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_equipment_labour_risk(uuid,date,text)', 'Labour-risk read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_equipment_notification_summary(uuid)', 'Equipment notification read RPC', 'Requires authorised equipment access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_equipment_notifications(uuid)', 'Equipment notification read RPC', 'Requires authorised equipment access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_equipment_operator_capabilities(uuid)', 'Equipment capability read RPC', 'Requires authorised equipment access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_equipment_recommended_work_queue(uuid)', 'Equipment work-queue read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_equipment_risk_intervention(uuid)', 'Equipment risk read RPC', 'Requires authorised equipment access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_equipment_risk_trend(uuid,text,date)', 'Equipment risk history read RPC', 'Requires authorised equipment access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_equipment_skills_showcase(uuid)', 'Equipment skills read RPC', 'Requires authorised equipment access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_equipment_work_items(uuid)', 'Equipment work-item read RPC', 'Requires authorised equipment access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_latest_pilot_readiness_summary()', 'Pilot readiness read RPC', 'Requires authorised site manager.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_maintenance_workflow_integrity(uuid)', 'Maintenance integrity read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_operational_dashboard_snapshot()', 'Maintenance dashboard read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_pilot_adoption_report(uuid,date,date)', 'Pilot reporting read RPC', 'Requires authorised site manager.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_pilot_setup(uuid)', 'Pilot administration read RPC', 'Requires authenticated pilot administrator.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_pilot_value_report(uuid,date,date)', 'Pilot reporting read RPC', 'Requires authorised site manager.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_risk_dashboard_scope_kpis(date)', 'Maintenance KPI read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_risk_dashboard_scope_plans()', 'Maintenance risk-plan read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_risk_dashboard_scopes()', 'Maintenance scope read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_risk_reduction_kpis(text,date)', 'Maintenance KPI read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_scoped_risk_reduction_kpis(text,date,text)', 'Maintenance KPI read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_shift_calendar(uuid,date,date)', 'Shift Cover read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_shift_cover_snapshot(uuid,date,date)', 'Shift Cover read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_shift_roster(uuid,date,text)', 'Shift Cover read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_site_labour_risk(uuid,date,text)', 'Labour-risk read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_site_risk_reduction_plan()', 'Maintenance risk-plan read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_workforce_avatar_by_name(text,text)', 'Workforce avatar read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_get_workforce_avatar(text,uuid)', 'Workforce avatar read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_match_visual_diagnostic(uuid,text,integer)', 'Visual diagnostic read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_resolve_shift_context(uuid,timestamp with time zone)', 'Shift-context read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read'),
  ('vorta_search_equipment_knowledge(uuid,text,integer)', 'Equipment knowledge read RPC', 'Requires authorised site access.', '20260720090000_review_authenticated_read_rpcs', 'read')
on conflict(rpc_identity) do update set
  purpose = excluded.purpose,
  access_contract = excluded.access_contract,
  reviewed_migration = excluded.reviewed_migration,
  rpc_class = excluded.rpc_class,
  reviewed_at = now();

create or replace function private.vorta_get_unreviewed_authenticated_read_rpcs()
returns table(
  rpc_identity text,
  function_name text
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  select
    function_row.oid::regprocedure::text as rpc_identity,
    function_row.proname::text as function_name
  from pg_proc function_row
  join pg_namespace namespace_row
    on namespace_row.oid = function_row.pronamespace
  left join private.vorta_privileged_rpc_allowlist allowlist
    on allowlist.rpc_identity = function_row.oid::regprocedure::text
      and allowlist.rpc_class = 'read'
  where namespace_row.nspname = 'public'
    and function_row.prokind = 'f'
    and function_row.prosecdef
    and has_function_privilege('authenticated', function_row.oid, 'EXECUTE')
    and function_row.proname like 'vorta_%'
    and function_row.proname !~ '^vorta_(launch|update|record|refresh|recalculate|log|track|upsert)'
    and allowlist.rpc_identity is null
  order by function_row.proname, function_row.oid::regprocedure::text;
$function$;

revoke all on function private.vorta_get_unreviewed_authenticated_read_rpcs()
  from public, anon, authenticated;
grant execute on function private.vorta_get_unreviewed_authenticated_read_rpcs()
  to service_role;

create or replace function public.vorta_get_demo_backend_health()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  site_id uuid := public.vorta_current_demo_site_id();
  report jsonb;
  unreviewed_mutation_count integer := 0;
  unreviewed_read_count integer := 0;
  reviewed_mutation_count integer := 0;
  reviewed_read_count integer := 0;
begin
  if not public.vorta_has_site_access(site_id, false) then
    return null;
  end if;

  report := private.vorta_get_demo_backend_health_internal(site_id);

  select count(*)::integer
  into unreviewed_mutation_count
  from private.vorta_get_unreviewed_authenticated_mutation_rpcs();

  select count(*)::integer
  into unreviewed_read_count
  from private.vorta_get_unreviewed_authenticated_read_rpcs();

  select
    count(*) filter (where rpc_class = 'mutation')::integer,
    count(*) filter (where rpc_class = 'read')::integer
  into reviewed_mutation_count, reviewed_read_count
  from private.vorta_privileged_rpc_allowlist;

  return jsonb_set(
    report,
    '{integrity}',
    coalesce(report -> 'integrity', '{}'::jsonb)
      || jsonb_build_object(
        'unreviewed_authenticated_mutation_rpcs', unreviewed_mutation_count,
        'unreviewed_authenticated_read_rpcs', unreviewed_read_count
      ),
    true
  ) || jsonb_build_object(
    'security', jsonb_build_object(
      'reviewedAuthenticatedMutationRpcCount', reviewed_mutation_count,
      'reviewedAuthenticatedReadRpcCount', reviewed_read_count
    )
  );
end;
$function$;

do $migration$
declare
  unreviewed_read text;
  reviewed_read_count integer;
begin
  select string_agg(unreviewed.rpc_identity, ', ' order by unreviewed.rpc_identity)
  into unreviewed_read
  from private.vorta_get_unreviewed_authenticated_read_rpcs() unreviewed;

  if unreviewed_read is not null then
    raise exception 'Unreviewed authenticated read SECURITY DEFINER RPCs remain: %', unreviewed_read;
  end if;

  select count(*)::integer
  into reviewed_read_count
  from private.vorta_privileged_rpc_allowlist
  where rpc_class = 'read';

  if reviewed_read_count <> 43 then
    raise exception 'Expected 43 reviewed authenticated read RPCs, found %', reviewed_read_count;
  end if;
end;
$migration$;