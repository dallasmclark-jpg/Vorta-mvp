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
    'Create an idempotent Vorta shift-handover draft',
    'SECURITY DEFINER with fixed search path; authenticated execution only; completed interaction ownership, active site, management role, open work-order target and exact handover proposal are revalidated. SAP and the target work order are not changed.',
    '20260803175800_vor_047_register_action_rpcs',
    now(),
    'mutation',
    'definer',
    false
  ),
  (
    'vorta_get_ask_vorta_action_draft(uuid)',
    'Read one owned Ask Vorta handover draft and its audit events',
    'SECURITY DEFINER with fixed search path; authenticated execution only; draft ownership and active site access are required.',
    '20260803175800_vor_047_register_action_rpcs',
    now(),
    'read',
    'definer',
    false
  ),
  (
    'vorta_cancel_ask_vorta_action(uuid,integer)',
    'Cancel one owned Ask Vorta handover draft',
    'SECURITY DEFINER with fixed search path; authenticated execution only; management role, ownership, active site and optimistic draft version are revalidated. The work order, handover source and SAP remain unchanged.',
    '20260803175800_vor_047_register_action_rpcs',
    now(),
    'mutation',
    'definer',
    false
  ),
  (
    'vorta_confirm_ask_vorta_action(uuid,integer)',
    'Confirm one owned Vorta shift-handover action',
    'SECURITY DEFINER with fixed search path; authenticated execution only; management role, ownership, active site, optimistic draft version and current open work-order state are revalidated. Dispatch is limited to the existing vorta_save_shift_handover_action RPC. SAP, maintenance notifications, work requests, work orders, stock records and parallel task queues cannot be created or changed.',
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
