-- VOR-009: register the authenticated Shift Handover workflow RPCs in the reviewed security manifest.

insert into private.vorta_privileged_rpc_allowlist (
  rpc_identity,
  purpose,
  access_contract,
  reviewed_migration,
  reviewed_at,
  rpc_class,
  security_mode,
  anonymous_execute
)
values
  (
    'vorta_get_shift_handover_actions(uuid,timestamp with time zone,timestamp with time zone)',
    'Shift Handover control read RPC',
    'SECURITY DEFINER; authenticated execution only; requires authorised site access and returns controls for the exact handover window.',
    '20260728140000_register_shift_handover_workflow_rpcs',
    now(),
    'read',
    'definer',
    false
  ),
  (
    'vorta_save_shift_handover_action(uuid,uuid,timestamp with time zone,timestamp with time zone,text,text,text,timestamp with time zone,integer)',
    'Shift Handover control mutation RPC',
    'SECURITY DEFINER; authenticated Maintenance Manager-class role, authorised site and work-order scope, optimistic version and completion guards.',
    '20260728140000_register_shift_handover_workflow_rpcs',
    now(),
    'mutation',
    'definer',
    false
  ),
  (
    'vorta_acknowledge_shift_handover_action(uuid,integer)',
    'Shift Handover acknowledgement mutation RPC',
    'SECURITY DEFINER; authenticated Maintenance Manager-class role, authorised site scope and optimistic version guard.',
    '20260728140000_register_shift_handover_workflow_rpcs',
    now(),
    'mutation',
    'definer',
    false
  ),
  (
    'vorta_carry_forward_shift_handover_action(uuid,integer,timestamp with time zone,timestamp with time zone,timestamp with time zone)',
    'Shift Handover carry-forward mutation RPC',
    'SECURITY DEFINER; authenticated Maintenance Manager-class role, authorised site scope, optimistic version and duplicate-window guards.',
    '20260728140000_register_shift_handover_workflow_rpcs',
    now(),
    'mutation',
    'definer',
    false
  )
on conflict (rpc_identity) do update
set purpose = excluded.purpose,
    access_contract = excluded.access_contract,
    reviewed_migration = excluded.reviewed_migration,
    reviewed_at = excluded.reviewed_at,
    rpc_class = excluded.rpc_class,
    security_mode = excluded.security_mode,
    anonymous_execute = excluded.anonymous_execute;

do $$
declare
  reviewed_count integer;
  read_count integer;
  mutation_count integer;
  definer_count integer;
  invoker_count integer;
  anon_count integer;
  drift_count integer;
begin
  select
    count(*)::integer,
    count(*) filter (where rpc_class = 'read')::integer,
    count(*) filter (where rpc_class = 'mutation')::integer,
    count(*) filter (where security_mode = 'definer')::integer,
    count(*) filter (where security_mode = 'invoker')::integer,
    count(*) filter (where anonymous_execute)::integer
  into reviewed_count, read_count, mutation_count, definer_count, invoker_count, anon_count
  from private.vorta_privileged_rpc_allowlist;

  select count(*)::integer
  into drift_count
  from private.vorta_get_rpc_security_manifest_drift();

  if reviewed_count <> 69
     or read_count <> 51
     or mutation_count <> 18
     or definer_count <> 66
     or invoker_count <> 3
     or anon_count <> 0
     or drift_count <> 0 then
    raise exception
      'Shift Handover RPC security manifest invariant failed: reviewed %, read %, mutation %, definer %, invoker %, anon %, drift %',
      reviewed_count, read_count, mutation_count, definer_count, invoker_count, anon_count, drift_count;
  end if;
end;
$$;
