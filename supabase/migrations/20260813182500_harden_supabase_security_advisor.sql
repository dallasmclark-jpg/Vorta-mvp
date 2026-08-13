-- Vorta Supabase security hardening
-- Explicit default-deny RLS plus invoker-only public RPC entrypoints.

begin;

do $do$
declare r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r'
      and c.relrowsecurity
      and n.nspname in ('public','private')
      and not exists (select 1 from pg_policy p where p.polrelid=c.oid)
  loop
    execute format(
      'create policy vorta_explicit_default_deny on %I.%I for all to anon, authenticated using (false) with check (false)',
      r.schema_name,r.table_name
    );
  end loop;
end
$do$;

create table if not exists private.vorta_rpc_security_backup (
  captured_at timestamptz not null default now(),
  function_oid oid not null,
  function_name text not null,
  identity_args text not null,
  definition text not null,
  acl aclitem[],
  primary key (captured_at,function_oid)
);
alter table private.vorta_rpc_security_backup enable row level security;

do $do$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='private'
      and tablename='vorta_rpc_security_backup'
      and policyname='vorta_rpc_security_backup_default_deny'
  ) then
    create policy vorta_rpc_security_backup_default_deny
      on private.vorta_rpc_security_backup
      for all to anon,authenticated
      using (false) with check (false);
  end if;
end
$do$;

revoke all on private.vorta_rpc_security_backup from public,anon,authenticated;
grant select,insert on private.vorta_rpc_security_backup to service_role;

insert into private.vorta_rpc_security_backup(function_oid,function_name,identity_args,definition,acl)
select p.oid,p.proname,oidvectortypes(p.proargtypes),pg_get_functiondef(p.oid),p.proacl
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.prokind='f'
  and p.prosecdef
  and has_function_privilege('authenticated',p.oid,'EXECUTE');

do $do$
declare
  r record;
  call_args text;
  vol text;
  wrapper_sql text;
  rpc_id text;
begin
  for r in
    select p.oid,p.proname,p.pronargs,p.proargnames,p.proretset,p.provolatile,
           oidvectortypes(p.proargtypes) as argtypes,
           pg_get_function_arguments(p.oid) as create_args,
           pg_get_function_result(p.oid) as result_type
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prokind='f'
      and p.prosecdef
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
    order by p.proname,oidvectortypes(p.proargtypes)
  loop
    call_args:=case when r.pronargs=0 then '' else array_to_string(r.proargnames[1:r.pronargs],', ') end;
    vol:=case r.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end;
    rpc_id:=r.proname||'('||replace(r.argtypes,', ', ',')||')';

    execute format('alter function public.%I(%s) set schema private',r.proname,r.argtypes);
    execute format('revoke all on function private.%I(%s) from public, anon',r.proname,r.argtypes);
    execute format('grant execute on function private.%I(%s) to authenticated, service_role',r.proname,r.argtypes);

    wrapper_sql:=format(
      'create function public.%I(%s) returns %s language sql %s security invoker set search_path = pg_catalog, private, public as $wrapper$ %s $wrapper$',
      r.proname,r.create_args,r.result_type,vol,
      case when r.proretset
        then format('select * from private.%I(%s);',r.proname,call_args)
        else format('select private.%I(%s);',r.proname,call_args)
      end
    );
    execute wrapper_sql;

    execute format('revoke all on function public.%I(%s) from public, anon',r.proname,r.argtypes);
    execute format('grant execute on function public.%I(%s) to authenticated, service_role',r.proname,r.argtypes);

    update private.vorta_privileged_rpc_allowlist
       set security_mode='invoker',
           reviewed_migration='20260813182500_harden_supabase_security_advisor',
           reviewed_at=now(),
           access_contract=case
             when position('Public Data API entrypoint is SECURITY INVOKER' in access_contract)=0
               then access_contract||' Public Data API entrypoint is SECURITY INVOKER; the privilege-bearing implementation is isolated in the non-exposed private schema.'
             else access_contract end
     where rpc_identity=rpc_id;
  end loop;
end
$do$;

grant usage on schema private to anon,authenticated,service_role;

update private.vorta_privileged_rpc_allowlist a
set security_mode='invoker',
    reviewed_migration='20260813182500_harden_supabase_security_advisor',
    reviewed_at=now(),
    access_contract=case
      when position('Public Data API entrypoint is SECURITY INVOKER' in access_contract)=0
        then access_contract||' Public Data API entrypoint is SECURITY INVOKER; the privilege-bearing implementation is isolated in the non-exposed private schema when elevated access is required.'
      else access_contract end
where exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.prokind='f'
    and not p.prosecdef
    and has_function_privilege('authenticated',p.oid,'EXECUTE')
    and a.rpc_identity=p.proname||'('||replace(oidvectortypes(p.proargtypes),', ', ',')||')'
);

notify pgrst,'reload schema';
commit;
