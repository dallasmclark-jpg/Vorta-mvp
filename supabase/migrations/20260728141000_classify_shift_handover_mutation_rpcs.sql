-- VOR-009: extend the security review classifier for explicit handover mutation verbs.

create or replace function private.vorta_get_unreviewed_authenticated_mutation_rpcs()
returns table(rpc_identity text, function_name text)
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
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
    and function_row.proname ~ '^vorta_(launch|update|record|refresh|recalculate|log|track|upsert|save|acknowledge|carry)'
    and allowlist.rpc_identity is null
  order by function_row.proname, function_row.oid::regprocedure::text;
$$;

create or replace function private.vorta_get_unreviewed_authenticated_read_rpcs()
returns table(rpc_identity text, function_name text)
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
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
    and function_row.proname !~ '^vorta_(launch|update|record|refresh|recalculate|log|track|upsert|save|acknowledge|carry)'
    and allowlist.rpc_identity is null
  order by function_row.proname, function_row.oid::regprocedure::text;
$$;

revoke all on function private.vorta_get_unreviewed_authenticated_mutation_rpcs() from public;
revoke all on function private.vorta_get_unreviewed_authenticated_read_rpcs() from public;
