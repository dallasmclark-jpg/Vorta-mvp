create or replace function private.vorta_get_unreviewed_authenticated_mutation_rpcs()
returns table(rpc_identity text, function_name text)
language sql
stable security definer
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
    and function_row.proname ~ '^vorta_(launch|update|record|refresh|recalculate|log|track|upsert|save|delete|acknowledge|carry|create|confirm|cancel)'
    and allowlist.rpc_identity is null
  order by function_row.proname, function_row.oid::regprocedure::text;
$function$;

create or replace function private.vorta_get_unreviewed_authenticated_read_rpcs()
returns table(rpc_identity text, function_name text)
language sql
stable security definer
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
    and function_row.proname !~ '^vorta_(launch|update|record|refresh|recalculate|log|track|upsert|save|delete|acknowledge|carry|create|confirm|cancel)'
    and allowlist.rpc_identity is null
  order by function_row.proname, function_row.oid::regprocedure::text;
$function$;

revoke execute on function public.vorta_ask_my_calendar(uuid,text) from public, anon;
revoke execute on function public.vorta_delete_my_engineer_calendar_entry(uuid,uuid) from public, anon;
revoke execute on function public.vorta_get_engineer_rota_window(uuid,date,date) from public, anon;
revoke execute on function public.vorta_get_my_engineer_calendar(uuid,date,date) from public, anon;
revoke execute on function public.vorta_save_my_engineer_calendar_entry(uuid,date,text,text,text,numeric,text,text,uuid,uuid) from public, anon;
revoke execute on function public.vorta_save_my_engineer_calendar_entry_v2(uuid,date,text,text,text,numeric,text,text,uuid,uuid,text) from public, anon;

grant execute on function public.vorta_ask_my_calendar(uuid,text) to authenticated, service_role;
grant execute on function public.vorta_delete_my_engineer_calendar_entry(uuid,uuid) to authenticated, service_role;
grant execute on function public.vorta_get_engineer_rota_window(uuid,date,date) to authenticated, service_role;
grant execute on function public.vorta_get_my_engineer_calendar(uuid,date,date) to authenticated, service_role;
grant execute on function public.vorta_save_my_engineer_calendar_entry(uuid,date,text,text,text,numeric,text,text,uuid,uuid) to authenticated, service_role;
grant execute on function public.vorta_save_my_engineer_calendar_entry_v2(uuid,date,text,text,text,numeric,text,text,uuid,uuid,text) to authenticated, service_role;

insert into private.vorta_privileged_rpc_allowlist
  (rpc_identity, purpose, access_contract, reviewed_migration, rpc_class, security_mode, anonymous_execute)
values
  ('vorta_ask_my_calendar(uuid,text)', 'Engineer personal calendar read RPC', 'Requires authenticated engineer identity and authorised site access; response is restricted to the signed-in engineer calendar evidence.', 'register_engineer_calendar_rpc_security', 'read', 'definer', false),
  ('vorta_delete_my_engineer_calendar_entry(uuid,uuid)', 'Engineer personal calendar delete RPC', 'Requires authenticated engineer identity and authorised site access; deletion is restricted to the signed-in engineer own calendar entry.', 'register_engineer_calendar_rpc_security', 'mutation', 'definer', false),
  ('vorta_get_engineer_rota_window(uuid,date,date)', 'Engineer rota window read RPC', 'Requires authenticated site access and returns the authorised engineer rota window used by the Engineer portal.', 'register_engineer_calendar_rpc_security', 'read', 'definer', false),
  ('vorta_get_my_engineer_calendar(uuid,date,date)', 'Engineer personal calendar read RPC', 'Requires authenticated engineer identity and authorised site access; reads only the signed-in engineer personal calendar and formal training evidence.', 'register_engineer_calendar_rpc_security', 'read', 'definer', false),
  ('vorta_save_my_engineer_calendar_entry(uuid,date,text,text,text,numeric,text,text,uuid,uuid)', 'Engineer personal calendar write RPC', 'Requires authenticated engineer identity and authorised site access; inserts or updates only the signed-in engineer own calendar entry.', 'register_engineer_calendar_rpc_security', 'mutation', 'definer', false),
  ('vorta_save_my_engineer_calendar_entry_v2(uuid,date,text,text,text,numeric,text,text,uuid,uuid,text)', 'Engineer personal calendar write RPC with equipment context', 'Requires authenticated engineer identity and authorised site access; inserts or updates only the signed-in engineer own calendar entry and optional equipment label.', 'register_engineer_calendar_rpc_security', 'mutation', 'definer', false)
on conflict (rpc_identity) do update
set purpose = excluded.purpose,
    access_contract = excluded.access_contract,
    reviewed_migration = excluded.reviewed_migration,
    reviewed_at = now(),
    rpc_class = excluded.rpc_class,
    security_mode = excluded.security_mode,
    anonymous_execute = excluded.anonymous_execute;
