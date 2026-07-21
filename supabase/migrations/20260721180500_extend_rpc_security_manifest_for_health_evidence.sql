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
    'vorta_get_system_health_summary()',
    'Active-site system health summary for the live Settings evidence page',
    'SECURITY DEFINER; authenticated execution only; resolves the caller site and requires vorta_has_site_access.',
    'extend_rpc_security_manifest_for_health_evidence',
    'read',
    'definer',
    false
  ),
  (
    'vorta_get_system_health_incidents(integer)',
    'Active-site system health incidents for the live Settings evidence page',
    'SECURITY DEFINER; authenticated execution only; resolves the caller site and requires vorta_has_site_access.',
    'extend_rpc_security_manifest_for_health_evidence',
    'read',
    'definer',
    false
  ),
  (
    'vorta_get_latest_recovery_manifest()',
    'Active-site recovery manifest for the live Settings evidence page',
    'SECURITY DEFINER; authenticated execution only; resolves the caller site and requires vorta_has_site_access.',
    'extend_rpc_security_manifest_for_health_evidence',
    'read',
    'definer',
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

do $manifest$
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

  if reviewed_count <> 64 or read_count <> 49 or mutation_count <> 15 then
    raise exception
      'Unexpected Vorta RPC manifest counts: total %, read %, mutation %',
      reviewed_count, read_count, mutation_count;
  end if;

  if definer_count <> 61 or invoker_count <> 3 or anon_count <> 0 then
    raise exception
      'Unexpected Vorta RPC execution surface: definer %, invoker %, anonymous %',
      definer_count, invoker_count, anon_count;
  end if;
end;
$manifest$;
