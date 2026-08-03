begin;

update public.ask_vorta_action_drafts
set action_kind = 'read_only',
    supported = false,
    failure_reason = coalesce(
      nullif(btrim(failure_reason), ''),
      'Unsupported by the Vorta read-only SAP boundary.'
    ),
    updated_at = now()
where action_kind not in ('read_only', 'handover_note');

alter table public.ask_vorta_action_drafts
  drop constraint if exists ask_vorta_action_drafts_work_request_disabled;

alter table public.ask_vorta_action_drafts
  drop constraint if exists ask_vorta_action_drafts_action_kind_check;

alter table public.ask_vorta_action_drafts
  add constraint ask_vorta_action_drafts_action_kind_check
  check (action_kind in ('read_only', 'handover_note'));

drop trigger if exists ask_vorta_disable_work_request_drafts
  on public.ask_vorta_action_drafts;
drop function if exists private.vorta_disable_ask_vorta_work_request_drafts();

do $block$
declare
  v_task_count bigint := 0;
begin
  if to_regclass('public.spare_stock_review_tasks') is not null then
    execute 'select count(*) from public.spare_stock_review_tasks'
      into v_task_count;
    if v_task_count <> 0 then
      raise exception
        'VOR-047 cannot remove spare_stock_review_tasks because % records exist.',
        v_task_count;
    end if;
    execute 'drop table public.spare_stock_review_tasks';
  end if;
end;
$block$;

do $block$
declare
  v_notification_count bigint;
begin
  select count(*)
  into v_notification_count
  from public.maintenance_notifications
  where lower(btrim(coalesce(source_system, ''))) = 'ask_vorta';

  if v_notification_count <> 0 then
    raise exception
      'VOR-047 found % Ask Vorta maintenance notifications. Reconciliation must fail closed.',
      v_notification_count;
  end if;
end;
$block$;

create index if not exists ask_vorta_action_drafts_interaction_idx
  on public.ask_vorta_action_drafts (interaction_id)
  where interaction_id is not null;
create index if not exists ask_vorta_action_drafts_confirmed_by_idx
  on public.ask_vorta_action_drafts (confirmed_by)
  where confirmed_by is not null;
create index if not exists ask_vorta_action_drafts_cancelled_by_idx
  on public.ask_vorta_action_drafts (cancelled_by)
  where cancelled_by is not null;
create index if not exists ask_vorta_action_events_actor_idx
  on public.ask_vorta_action_events (actor_id, created_at desc);

create or replace function private.vorta_get_unreviewed_authenticated_mutation_rpcs()
returns table(rpc_identity text, function_name text)
language sql
stable
security definer
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
    and function_row.proname ~ '^vorta_(launch|update|record|refresh|recalculate|log|track|upsert|save|acknowledge|carry|create|confirm|cancel)'
    and allowlist.rpc_identity is null
  order by function_row.proname, function_row.oid::regprocedure::text;
$function$;

create or replace function private.vorta_get_unreviewed_authenticated_read_rpcs()
returns table(rpc_identity text, function_name text)
language sql
stable
security definer
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
    and function_row.proname !~ '^vorta_(launch|update|record|refresh|recalculate|log|track|upsert|save|acknowledge|carry|create|confirm|cancel)'
    and allowlist.rpc_identity is null
  order by function_row.proname, function_row.oid::regprocedure::text;
$function$;

revoke all on function private.vorta_get_unreviewed_authenticated_mutation_rpcs()
  from public, anon, authenticated;
revoke all on function private.vorta_get_unreviewed_authenticated_read_rpcs()
  from public, anon, authenticated;
grant execute on function private.vorta_get_unreviewed_authenticated_mutation_rpcs()
  to service_role;
grant execute on function private.vorta_get_unreviewed_authenticated_read_rpcs()
  to service_role;

create or replace function private.vorta_block_ask_vorta_maintenance_notifications()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  if lower(btrim(coalesce(new.source_system, ''))) = 'ask_vorta' then
    raise exception
      'Ask Vorta cannot create or relabel maintenance notifications because Vorta is read-only from SAP.'
      using errcode = '0A000';
  end if;
  return new;
end;
$function$;

revoke all on function private.vorta_block_ask_vorta_maintenance_notifications()
  from public, anon, authenticated, service_role;

drop trigger if exists vorta_block_ask_vorta_maintenance_notifications
  on public.maintenance_notifications;

create trigger vorta_block_ask_vorta_maintenance_notifications
before insert or update of source_system
on public.maintenance_notifications
for each row
execute function private.vorta_block_ask_vorta_maintenance_notifications();

comment on function private.vorta_block_ask_vorta_maintenance_notifications()
  is 'Hard boundary preventing Ask Vorta from creating or relabelling maintenance notifications; SAP remains the maintenance system of record.';
comment on function public.vorta_create_ask_vorta_action_draft(
  uuid, uuid, text, text, uuid, text, text, text, text, text, jsonb, jsonb, text
) is 'Prepares only a reviewable Vorta shift-handover draft. Work requests, notifications, stock tasks and SAP-equivalent records are unsupported.';
comment on function public.vorta_confirm_ask_vorta_action(uuid, integer)
  is 'Confirms only a Vorta shift-handover action linked to an existing open work order. SAP remains unchanged.';

notify pgrst, 'reload schema';

commit;
