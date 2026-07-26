-- Register the grounded Shift Cover AI brief in the complete reviewed RPC
-- manifest so authenticated backend health remains fail-closed without drift.

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
  'vorta_get_shift_cover_ai_brief(uuid,date,date)',
  'Ask Vorta Shift Cover evidence read RPC',
  'SECURITY DEFINER with a fixed search path; requires authenticated access to the requested site and exposes only dated rota, exception and required-skill evidence.',
  '20260726233000_register_shift_cover_ai_brief_rpc',
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

do $verification$
declare
  drift_count integer;
  unreviewed_count integer;
begin
  select count(*)::integer
  into drift_count
  from private.vorta_get_rpc_security_manifest_drift()
  where rpc_identity = 'vorta_get_shift_cover_ai_brief(uuid,date,date)';

  select count(*)::integer
  into unreviewed_count
  from private.vorta_get_unreviewed_authenticated_read_rpcs()
  where rpc_identity = 'vorta_get_shift_cover_ai_brief(uuid,date,date)';

  if drift_count <> 0 or unreviewed_count <> 0 then
    raise exception
      'Shift Cover AI brief RPC manifest registration failed: drift %, unreviewed %',
      drift_count,
      unreviewed_count;
  end if;
end;
$verification$;
