-- Complete the authenticated Vorta RPC manifest, remove inherited anonymous
-- helper execution and make manifest drift visible to health gates.

alter table private.vorta_privileged_rpc_allowlist
  add column if not exists security_mode text not null default 'definer',
  add column if not exists anonymous_execute boolean not null default false;

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.vorta_privileged_rpc_allowlist'::regclass
      and conname = 'vorta_privileged_rpc_allowlist_security_mode_check'
  ) then
    alter table private.vorta_privileged_rpc_allowlist
      add constraint vorta_privileged_rpc_allowlist_security_mode_check
      check (security_mode in ('definer', 'invoker'));
  end if;
end;
$constraint$;

update private.vorta_privileged_rpc_allowlist
set security_mode = 'definer',
    anonymous_execute = false;

insert into private.vorta_privileged_rpc_allowlist(
  rpc_identity,
  purpose,
  access_contract,
  reviewed_migration,
  rpc_class,
  security_mode,
  anonymous_execute
)
values
  (
    'vorta_get_equipment_history(uuid)',
    'Equipment history read RPC',
    'SECURITY INVOKER; requires authenticated equipment access through existing row-level security.',
    'complete_rpc_security_manifest',
    'read',
    'invoker',
    false
  ),
  (
    'vorta_get_equipment_documents(uuid)',
    'Equipment document-list read RPC',
    'SECURITY INVOKER; requires authenticated equipment access through existing row-level security.',
    'complete_rpc_security_manifest',
    'read',
    'invoker',
    false
  ),
  (
    'vorta_get_equipment_document(uuid,uuid)',
    'Controlled equipment document read RPC',
    'SECURITY INVOKER; requires authenticated equipment and document access through existing row-level security.',
    'complete_rpc_security_manifest',
    'read',
    'invoker',
    false
  )
on conflict(rpc_identity) do update set
  purpose = excluded.purpose,
  access_contract = excluded.access_contract,
  reviewed_migration = excluded.reviewed_migration,
  rpc_class = excluded.rpc_class,
  security_mode = excluded.security_mode,
  anonymous_execute = excluded.anonymous_execute,
  reviewed_at = now();

-- These pure scoring helpers are internal implementation details, not Data API RPCs.
revoke execute on function public.vorta_effective_pm_status(text,date)
  from public, anon, authenticated;
revoke execute on function public.vorta_spare_component_risk_points(text,text)
  from public, anon, authenticated;
revoke execute on function public.vorta_work_order_is_overdue(text,date)
  from public, anon, authenticated;

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
      and allowlist.rpc_class = 'mutation'
  where namespace_row.nspname = 'public'
    and function_row.prokind = 'f'
    and has_function_privilege('authenticated', function_row.oid, 'EXECUTE')
    and function_row.proname ~ '^vorta_(launch|update|record|refresh|recalculate|log|track|upsert)'
    and allowlist.rpc_identity is null
  order by function_row.proname, function_row.oid::regprocedure::text;
$function$;

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
    and has_function_privilege('authenticated', function_row.oid, 'EXECUTE')
    and function_row.proname like 'vorta_%'
    and function_row.proname !~ '^vorta_(launch|update|record|refresh|recalculate|log|track|upsert)'
    and allowlist.rpc_identity is null
  order by function_row.proname, function_row.oid::regprocedure::text;
$function$;

create or replace function private.vorta_get_rpc_security_manifest_drift()
returns table(
  issue_type text,
  rpc_identity text,
  detail text
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  with actual as (
    select
      function_row.oid,
      function_row.oid::regprocedure::text as rpc_identity,
      function_row.prosecdef,
      has_function_privilege('anon', function_row.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', function_row.oid, 'EXECUTE') as authenticated_execute,
      has_function_privilege('service_role', function_row.oid, 'EXECUTE') as service_role_execute,
      exists (
        select 1
        from unnest(coalesce(function_row.proconfig, array[]::text[])) setting
        where setting like 'search_path=%'
      ) as fixed_search_path
    from pg_proc function_row
    join pg_namespace namespace_row
      on namespace_row.oid = function_row.pronamespace
    where namespace_row.nspname = 'public'
      and function_row.prokind = 'f'
      and function_row.proname like 'vorta_%'
  ), manifest as (
    select *
    from private.vorta_privileged_rpc_allowlist
  )
  select
    'missing_manifest'::text,
    actual.rpc_identity,
    'Authenticated or anonymous execution exists without a reviewed manifest row.'::text
  from actual
  left join manifest on manifest.rpc_identity = actual.rpc_identity
  where (actual.authenticated_execute or actual.anon_execute)
    and manifest.rpc_identity is null

  union all

  select
    'stale_manifest'::text,
    manifest.rpc_identity,
    'Manifest row no longer maps to an authenticated-callable public Vorta function.'::text
  from manifest
  left join actual on actual.rpc_identity = manifest.rpc_identity
  where actual.rpc_identity is null
     or not actual.authenticated_execute

  union all

  select
    'security_mode_mismatch'::text,
    actual.rpc_identity,
    format(
      'Manifest expects %s but the database function is %s.',
      manifest.security_mode,
      case when actual.prosecdef then 'definer' else 'invoker' end
    )::text
  from actual
  join manifest on manifest.rpc_identity = actual.rpc_identity
  where manifest.security_mode <>
    case when actual.prosecdef then 'definer' else 'invoker' end

  union all

  select
    'anonymous_execute'::text,
    actual.rpc_identity,
    'Anonymous execution is not approved for Vorta RPCs.'::text
  from actual
  where actual.anon_execute

  union all

  select
    'missing_fixed_search_path'::text,
    actual.rpc_identity,
    'Client-callable Vorta function has no fixed search_path.'::text
  from actual
  where actual.authenticated_execute
    and not actual.fixed_search_path

  union all

  select
    'missing_service_role_execute'::text,
    actual.rpc_identity,
    'Reviewed client RPC is not executable by service_role.'::text
  from actual
  join manifest on manifest.rpc_identity = actual.rpc_identity
  where not actual.service_role_execute

  union all

  select
    'anonymous_contract_mismatch'::text,
    actual.rpc_identity,
    'Database anonymous execution does not match the reviewed manifest contract.'::text
  from actual
  join manifest on manifest.rpc_identity = actual.rpc_identity
  where actual.anon_execute <> manifest.anonymous_execute

  order by 1, 2;
$function$;

revoke all on function private.vorta_get_rpc_security_manifest_drift()
  from public, anon, authenticated;
grant execute on function private.vorta_get_rpc_security_manifest_drift()
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
  authenticated_definer_count integer := 0;
  authenticated_invoker_count integer := 0;
  anonymous_rpc_count integer := 0;
  manifest_drift_count integer := 0;
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

  select
    count(*) filter (where function_row.prosecdef)::integer,
    count(*) filter (where not function_row.prosecdef)::integer,
    count(*) filter (
      where has_function_privilege('anon', function_row.oid, 'EXECUTE')
    )::integer
  into authenticated_definer_count, authenticated_invoker_count, anonymous_rpc_count
  from pg_proc function_row
  join pg_namespace namespace_row
    on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.prokind = 'f'
    and function_row.proname like 'vorta_%'
    and has_function_privilege('authenticated', function_row.oid, 'EXECUTE');

  select count(*)::integer
  into manifest_drift_count
  from private.vorta_get_rpc_security_manifest_drift();

  report := jsonb_set(
    report,
    '{integrity}',
    coalesce(report -> 'integrity', '{}'::jsonb)
      || jsonb_build_object(
        'unreviewed_authenticated_mutation_rpcs', unreviewed_mutation_count,
        'unreviewed_authenticated_read_rpcs', unreviewed_read_count,
        'rpc_security_manifest_drift', manifest_drift_count
      ),
    true
  );

  report := jsonb_set(
    report,
    '{healthy}',
    to_jsonb(
      coalesce((report ->> 'healthy')::boolean, false)
      and manifest_drift_count = 0
      and anonymous_rpc_count = 0
    ),
    true
  );

  return report || jsonb_build_object(
    'security', jsonb_build_object(
      'manifestVersion', 'complete_rpc_security_manifest',
      'reviewedAuthenticatedMutationRpcCount', reviewed_mutation_count,
      'reviewedAuthenticatedReadRpcCount', reviewed_read_count,
      'authenticatedSecurityDefinerRpcCount', authenticated_definer_count,
      'authenticatedSecurityInvokerRpcCount', authenticated_invoker_count,
      'anonymousVortaRpcCount', anonymous_rpc_count,
      'rpcSecurityManifestDriftCount', manifest_drift_count
    )
  );
end;
$function$;

do $migration$
declare
  drift_summary text;
  reviewed_count integer;
  read_count integer;
  mutation_count integer;
  definer_count integer;
  invoker_count integer;
  anon_count integer;
begin
  select string_agg(
    format('%s:%s', drift.issue_type, drift.rpc_identity),
    ', ' order by drift.issue_type, drift.rpc_identity
  )
  into drift_summary
  from private.vorta_get_rpc_security_manifest_drift() drift;

  if drift_summary is not null then
    raise exception 'Vorta RPC security manifest drift remains: %', drift_summary;
  end if;

  select
    count(*)::integer,
    count(*) filter (where rpc_class = 'read')::integer,
    count(*) filter (where rpc_class = 'mutation')::integer
  into reviewed_count, read_count, mutation_count
  from private.vorta_privileged_rpc_allowlist;

  select
    count(*) filter (where function_row.prosecdef)::integer,
    count(*) filter (where not function_row.prosecdef)::integer,
    count(*) filter (
      where has_function_privilege('anon', function_row.oid, 'EXECUTE')
    )::integer
  into definer_count, invoker_count, anon_count
  from pg_proc function_row
  join pg_namespace namespace_row
    on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.prokind = 'f'
    and function_row.proname like 'vorta_%'
    and has_function_privilege('authenticated', function_row.oid, 'EXECUTE');

  if reviewed_count <> 61 or read_count <> 46 or mutation_count <> 15 then
    raise exception
      'Unexpected Vorta RPC manifest counts: total %, read %, mutation %',
      reviewed_count, read_count, mutation_count;
  end if;

  if definer_count <> 58 or invoker_count <> 3 or anon_count <> 0 then
    raise exception
      'Unexpected Vorta RPC execution surface: definer %, invoker %, anonymous %',
      definer_count, invoker_count, anon_count;
  end if;
end;
$migration$;