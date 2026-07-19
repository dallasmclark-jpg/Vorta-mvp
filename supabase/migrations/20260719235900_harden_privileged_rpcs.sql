-- Reduce directly callable SECURITY DEFINER helpers and make mutation-capable
-- authenticated RPCs explicit, reviewable and testable.

revoke execute on function public.vorta_can_administer_pilot(uuid)
  from authenticated;
revoke execute on function public.vorta_get_function_context()
  from authenticated;
revoke execute on function public.vorta_get_latest_recovery_manifest()
  from authenticated;
revoke execute on function public.vorta_get_operational_audit_events(integer)
  from authenticated;
revoke execute on function public.vorta_get_system_health_incidents(integer)
  from authenticated;
revoke execute on function public.vorta_get_system_health_summary()
  from authenticated;

create table if not exists private.vorta_privileged_rpc_allowlist (
  rpc_identity text primary key,
  purpose text not null,
  access_contract text not null,
  reviewed_migration text not null,
  reviewed_at timestamp with time zone not null default now()
);

revoke all on table private.vorta_privileged_rpc_allowlist
  from public, anon, authenticated;
grant select on table private.vorta_privileged_rpc_allowlist
  to service_role;

insert into private.vorta_privileged_rpc_allowlist(
  rpc_identity,
  purpose,
  access_contract,
  reviewed_migration
)
select
  function_row.oid::regprocedure::text,
  case
    when function_row.proname like 'vorta_update_pilot_%'
      or function_row.proname in (
        'vorta_launch_pilot',
        'vorta_record_pilot_rehearsal_attempt',
        'vorta_upsert_pilot_weekly_review'
      ) then 'Pilot administration'
    when function_row.proname in (
      'vorta_refresh_current_risk',
      'vorta_refresh_operational_risk',
      'vorta_refresh_risk_work_plan',
      'vorta_recalculate_risk_work_plan',
      'vorta_recalculate_and_get_operational_dashboard'
    ) then 'Maintenance Manager risk refresh'
    when function_row.proname = 'vorta_log_frontend_error'
      then 'Authenticated error telemetry'
    when function_row.proname = 'vorta_track_pilot_usage_event'
      then 'Authenticated pilot usage telemetry'
    when function_row.proname = 'vorta_refresh_and_get_operational_dashboard'
      then 'Read-only dashboard compatibility wrapper'
    else 'Reviewed authenticated privileged RPC'
  end,
  case
    when function_row.proname like 'vorta_update_pilot_%'
      or function_row.proname in (
        'vorta_launch_pilot',
        'vorta_record_pilot_rehearsal_attempt',
        'vorta_upsert_pilot_weekly_review'
      ) then 'Requires auth.uid(), site access and vorta_can_administer_pilot inside the wrapper.'
    when function_row.proname in (
      'vorta_refresh_current_risk',
      'vorta_refresh_operational_risk',
      'vorta_refresh_risk_work_plan',
      'vorta_recalculate_risk_work_plan',
      'vorta_recalculate_and_get_operational_dashboard'
    ) then 'Requires vorta_can_manage_site before any mutation.'
    when function_row.proname in (
      'vorta_log_frontend_error',
      'vorta_track_pilot_usage_event'
    ) then 'Requires an authenticated actor and authorised site context; input length and shape are bounded.'
    else 'Read-only wrapper; underlying snapshot enforces authorised site context.'
  end,
  '20260719235900_harden_privileged_rpcs'
from pg_proc function_row
join pg_namespace namespace_row
  on namespace_row.oid = function_row.pronamespace
where namespace_row.nspname = 'public'
  and function_row.prosecdef
  and has_function_privilege('authenticated', function_row.oid, 'EXECUTE')
  and function_row.proname in (
    'vorta_launch_pilot',
    'vorta_log_frontend_error',
    'vorta_recalculate_and_get_operational_dashboard',
    'vorta_recalculate_risk_work_plan',
    'vorta_record_pilot_rehearsal_attempt',
    'vorta_refresh_and_get_operational_dashboard',
    'vorta_refresh_current_risk',
    'vorta_refresh_operational_risk',
    'vorta_refresh_risk_work_plan',
    'vorta_track_pilot_usage_event',
    'vorta_update_pilot_configuration',
    'vorta_update_pilot_manual_check',
    'vorta_update_pilot_participants',
    'vorta_update_pilot_success_criteria',
    'vorta_upsert_pilot_weekly_review'
  )
on conflict(rpc_identity) do update set
  purpose = excluded.purpose,
  access_contract = excluded.access_contract,
  reviewed_migration = excluded.reviewed_migration,
  reviewed_at = now();

create or replace function private.vorta_get_unreviewed_authenticated_mutation_rpcs()
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
  where namespace_row.nspname = 'public'
    and function_row.prokind = 'f'
    and function_row.prosecdef
    and has_function_privilege('authenticated', function_row.oid, 'EXECUTE')
    and function_row.proname ~ '^vorta_(launch|update|record|refresh|recalculate|log|track|upsert)'
    and allowlist.rpc_identity is null
  order by function_row.proname, function_row.oid::regprocedure::text;
$function$;

revoke all on function private.vorta_get_unreviewed_authenticated_mutation_rpcs()
  from public, anon, authenticated;
grant execute on function private.vorta_get_unreviewed_authenticated_mutation_rpcs()
  to service_role;

create index if not exists work_order_goods_movements_component_id_idx
  on public.work_order_goods_movements(component_id);

create index if not exists vorta_recovery_manifests_latest_health_run_id_idx
  on private.vorta_recovery_manifests(latest_health_run_id);

create or replace function public.vorta_get_demo_backend_health()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
  v_report jsonb;
  v_unreviewed_count integer := 0;
begin
  if not public.vorta_has_site_access(v_site_id, false) then
    return null;
  end if;

  v_report := private.vorta_get_demo_backend_health_internal(v_site_id);

  select count(*)::integer
  into v_unreviewed_count
  from private.vorta_get_unreviewed_authenticated_mutation_rpcs();

  return v_report || jsonb_build_object(
    'security', jsonb_build_object(
      'unreviewedAuthenticatedMutationRpcCount', v_unreviewed_count,
      'reviewedAuthenticatedMutationRpcCount', (
        select count(*)::integer
        from private.vorta_privileged_rpc_allowlist
      )
    )
  );
end;
$function$;

do $migration$
declare
  v_unreviewed text;
begin
  if has_function_privilege(
    'authenticated',
    'public.vorta_can_administer_pilot(uuid)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'vorta_can_administer_pilot must not be directly executable by authenticated users';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.vorta_get_system_health_summary()'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'System-health diagnostics must remain service-role only';
  end if;

  select string_agg(unreviewed.rpc_identity, ', ' order by unreviewed.rpc_identity)
  into v_unreviewed
  from private.vorta_get_unreviewed_authenticated_mutation_rpcs() unreviewed;

  if v_unreviewed is not null then
    raise exception 'Unreviewed authenticated mutation-capable RPCs remain: %', v_unreviewed;
  end if;
end;
$migration$;
