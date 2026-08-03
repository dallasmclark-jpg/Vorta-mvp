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
    'vorta_create_ask_vorta_action_draft(uuid,uuid,text,text,uuid,text,text,text,text,text,jsonb,jsonb,text)',
    'Create an idempotent typed Ask Vorta action draft',
    'SECURITY DEFINER with fixed search path; authenticated execution only; completed interaction ownership, active site, management role, target scope and proposal shape are revalidated. No target maintenance record is changed.',
    '20260803175800_vor_047_register_action_rpcs',
    now(),
    'mutation',
    'definer',
    false
  ),
  (
    'vorta_get_ask_vorta_action_draft(uuid)',
    'Read one owned Ask Vorta action draft and audit events',
    'SECURITY DEFINER with fixed search path; authenticated execution only; draft ownership and active site access are required.',
    '20260803175800_vor_047_register_action_rpcs',
    now(),
    'read',
    'definer',
    false
  ),
  (
    'vorta_cancel_ask_vorta_action(uuid,integer)',
    'Cancel one owned Ask Vorta action draft',
    'SECURITY DEFINER with fixed search path; authenticated execution only; management role, ownership, active site and optimistic draft version are revalidated. Source records are not changed.',
    '20260803175800_vor_047_register_action_rpcs',
    now(),
    'mutation',
    'definer',
    false
  ),
  (
    'vorta_confirm_ask_vorta_action(uuid,integer)',
    'Confirm one owned Ask Vorta draft through an action-specific workflow',
    'SECURITY DEFINER with fixed search path; authenticated execution only; management role, ownership, active site, optimistic draft version and current target state are revalidated. Dispatch is limited to handover note, maintenance notification and spare stock review task workflows.',
    '20260803175800_vor_047_register_action_rpcs',
    now(),
    'mutation',
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
