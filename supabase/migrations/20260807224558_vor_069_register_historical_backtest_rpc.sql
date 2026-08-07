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
  'vorta_get_historical_backtest(uuid,uuid,text,integer)',
  'VOR-069 authorised historical equipment and spares backtest read RPC',
  'SECURITY DEFINER; authenticated/service-role execution only; requires vorta_has_site_access for the requested site, validates optional equipment belongs to that site, returns version-pinned historical risk/stock/work-order evidence, and performs no operational or SAP mutation.',
  'vor_069_register_historical_backtest_rpc',
  'read',
  'definer',
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
    'public.vorta_get_historical_backtest(uuid,uuid,text,integer)'
  );
  v_drift integer;
  v_read integer;
  v_mutation integer;
  v_definer integer;
  v_invoker integer;
  v_anon integer;
begin
  if v_function is null then
    raise exception 'VOR-069 historical backtest RPC does not exist';
  end if;

  if not (select prosecdef from pg_proc where oid = v_function) then
    raise exception 'VOR-069 historical backtest RPC must remain SECURITY DEFINER';
  end if;

  if has_function_privilege('anon', v_function, 'EXECUTE') then
    raise exception 'VOR-069 historical backtest RPC must not be anonymous';
  end if;

  if not has_function_privilege('authenticated', v_function, 'EXECUTE')
     or not has_function_privilege('service_role', v_function, 'EXECUTE') then
    raise exception
      'VOR-069 historical backtest RPC must be callable by authenticated and service_role';
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
     or v_read <> 55
     or v_mutation <> 21
     or v_definer <> 72
     or v_invoker <> 4
     or v_anon <> 0 then
    raise exception
      'Unexpected VOR-069 RPC manifest state: drift %, read %, mutation %, definer %, invoker %, anon %',
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
