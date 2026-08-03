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
values (
  'vorta_get_ranked_operational_actions(uuid,integer)',
  'Ask Vorta operational-value ranking read RPC',
  'SECURITY DEFINER with a fixed search path; authenticated execution only; resolves the authorised demo site, validates optional equipment scope and returns deterministic calculated action rankings.',
  '20260803115400_vor_044_register_operational_value_rpc',
  now(),
  'read',
  'definer',
  false
)
on conflict (rpc_identity) do update
set
  purpose = excluded.purpose,
  access_contract = excluded.access_contract,
  reviewed_migration = excluded.reviewed_migration,
  reviewed_at = excluded.reviewed_at,
  rpc_class = excluded.rpc_class,
  security_mode = excluded.security_mode,
  anonymous_execute = excluded.anonymous_execute;

notify pgrst, 'reload schema';
