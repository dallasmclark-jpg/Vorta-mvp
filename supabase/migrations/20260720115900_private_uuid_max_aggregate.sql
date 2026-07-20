-- PostgreSQL does not provide max(uuid), although UUID values support ordering.
-- The set-based dashboard scope query needs one filtered UUID aggregate to select
-- the already-ranked area leader. Keep the compatibility aggregate private and
-- unavailable to Data API roles.

create or replace function private.vorta_uuid_max(
  p_state uuid,
  p_value uuid
)
returns uuid
language sql
immutable
parallel safe
set search_path to 'pg_catalog', 'private'
as $function$
  select case
    when p_state is null then p_value
    when p_value is null then p_state
    when p_value > p_state then p_value
    else p_state
  end;
$function$;

revoke all on function private.vorta_uuid_max(uuid, uuid)
  from public, anon, authenticated;

do $aggregate$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
      and procedure.proname = 'max'
      and pg_catalog.pg_get_function_identity_arguments(procedure.oid) = 'uuid'
      and procedure.prokind = 'a'
  ) then
    create aggregate private.max(uuid) (
      sfunc = private.vorta_uuid_max,
      stype = uuid,
      sortop = operator(>)
    );
  end if;
end;
$aggregate$;

revoke all on function private.max(uuid)
  from public, anon, authenticated;
