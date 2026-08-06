-- VOR-061: register the bounded document access-state reader in the reviewed
-- authenticated RPC security manifest. The function remains SECURITY INVOKER,
-- read-only and subject to the existing equipment/document row-level security.

begin;

insert into private.vorta_privileged_rpc_allowlist(
  rpc_identity,
  purpose,
  access_contract,
  reviewed_migration,
  rpc_class,
  security_mode,
  anonymous_execute
)
values (
  'vorta_get_equipment_document_access_state(uuid,uuid)',
  'Bounded controlled-document access-state read RPC',
  'SECURITY INVOKER; returns only a bounded access state and explanation for an equipment/document row already visible through existing row-level security. It does not expose document identity, content, source, revision or chunks.',
  'vor_061_register_document_access_state_rpc',
  'read',
  'invoker',
  false
)
on conflict (rpc_identity) do update set
  purpose = excluded.purpose,
  access_contract = excluded.access_contract,
  reviewed_migration = excluded.reviewed_migration,
  rpc_class = excluded.rpc_class,
  security_mode = excluded.security_mode,
  anonymous_execute = excluded.anonymous_execute,
  reviewed_at = now();

do $verify$
declare
  v_function oid := to_regprocedure(
    'public.vorta_get_equipment_document_access_state(uuid,uuid)'
  );
  v_drift integer;
  v_read integer;
  v_mutation integer;
  v_definer integer;
  v_invoker integer;
  v_anon integer;
begin
  if v_function is null then
    raise exception 'VOR-061 document access-state RPC does not exist';
  end if;

  if (select prosecdef from pg_proc where oid = v_function) then
    raise exception 'VOR-061 document access-state RPC must remain SECURITY INVOKER';
  end if;

  if has_function_privilege('anon', v_function, 'EXECUTE') then
    raise exception 'VOR-061 document access-state RPC must not be anonymous';
  end if;

  if not has_function_privilege('authenticated', v_function, 'EXECUTE')
     or not has_function_privilege('service_role', v_function, 'EXECUTE') then
    raise exception
      'VOR-061 document access-state RPC must be callable by authenticated and service_role';
  end if;

  select count(*)::integer
  into v_drift
  from private.vorta_get_rpc_security_manifest_drift();

  select
    count(*) filter (where rpc_class = 'read')::integer,
    count(*) filter (where rpc_class = 'mutation')::integer
  into v_read, v_mutation
  from private.vorta_privileged_rpc_allowlist;

  select
    count(*) filter (where function_row.prosecdef)::integer,
    count(*) filter (where not function_row.prosecdef)::integer,
    count(*) filter (
      where has_function_privilege('anon', function_row.oid, 'EXECUTE')
    )::integer
  into v_definer, v_invoker, v_anon
  from pg_proc function_row
  join pg_namespace namespace_row
    on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.prokind = 'f'
    and function_row.proname like 'vorta_%'
    and has_function_privilege('authenticated', function_row.oid, 'EXECUTE');

  if v_drift <> 0
     or v_read <> 54
     or v_mutation <> 21
     or v_definer <> 71
     or v_invoker <> 4
     or v_anon <> 0 then
    raise exception
      'Unexpected VOR-061 RPC manifest state: drift %, read %, mutation %, definer %, invoker %, anon %',
      v_drift,
      v_read,
      v_mutation,
      v_definer,
      v_invoker,
      v_anon;
  end if;
end;
$verify$;

commit;
