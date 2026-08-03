begin;

create or replace function private.vorta_disable_ask_vorta_work_request_drafts()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  if new.action_kind = 'work_request' then
    new.supported := false;
    new.failure_reason := coalesce(
      nullif(btrim(new.failure_reason), ''),
      'Disabled: Vorta is read-only from SAP and cannot create maintenance work requests or notifications.'
    );
  end if;
  return new;
end;
$function$;

revoke all on function private.vorta_disable_ask_vorta_work_request_drafts()
  from public, anon, authenticated, service_role;

drop trigger if exists ask_vorta_disable_work_request_drafts
  on public.ask_vorta_action_drafts;

create trigger ask_vorta_disable_work_request_drafts
before insert or update of action_kind, supported
on public.ask_vorta_action_drafts
for each row
execute function private.vorta_disable_ask_vorta_work_request_drafts();

update public.ask_vorta_action_drafts
set supported = false,
    failure_reason = coalesce(
      nullif(btrim(failure_reason), ''),
      'Disabled: Vorta is read-only from SAP and cannot create maintenance work requests or notifications.'
    ),
    updated_at = now()
where action_kind = 'work_request';

alter table public.ask_vorta_action_drafts
  drop constraint if exists ask_vorta_action_drafts_work_request_disabled;

alter table public.ask_vorta_action_drafts
  add constraint ask_vorta_action_drafts_work_request_disabled
  check (action_kind <> 'work_request' or supported = false)
  not valid;

alter table public.ask_vorta_action_drafts
  validate constraint ask_vorta_action_drafts_work_request_disabled;

create or replace function private.vorta_block_ask_vorta_maintenance_notifications()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  if lower(btrim(coalesce(new.source_system, ''))) = 'ask_vorta' then
    raise exception 'Ask Vorta cannot create maintenance notifications because Vorta is read-only from SAP.'
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

revoke all on function public.vorta_confirm_ask_vorta_action(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.vorta_confirm_ask_vorta_action(uuid, integer)
  to authenticated, service_role;

comment on function private.vorta_disable_ask_vorta_work_request_drafts()
  is 'Permanently forces Ask Vorta work-request drafts to unsupported because Vorta is read-only from SAP.';

comment on function private.vorta_block_ask_vorta_maintenance_notifications()
  is 'Blocks Ask Vorta from creating or relabelling maintenance notifications; SAP remains the maintenance system of record.';

notify pgrst, 'reload schema';

commit;
