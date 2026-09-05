create or replace function private.vorta_bootstrap_site_owner(
  p_full_name text,
  p_organisation_name text,
  p_industry text,
  p_country text,
  p_site_name text,
  p_site_location text default null
)
returns table(organisation_id uuid, site_id uuid, app_role text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'private'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
  v_existing_org uuid;
  v_org_id uuid;
  v_site_id uuid;
  v_full_name text := nullif(btrim(p_full_name), '');
  v_org_name text := nullif(btrim(p_organisation_name), '');
  v_site_name text := nullif(btrim(p_site_name), '');
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select users.email, users.email_confirmed_at
    into v_email, v_confirmed_at
  from auth.users users
  where users.id = v_user_id;

  if v_email is null or v_confirmed_at is null then
    raise exception 'A verified email address is required before creating a Vorta site' using errcode = '28000';
  end if;

  if v_full_name is null or length(v_full_name) > 120 then raise exception 'Your name is required'; end if;
  if v_org_name is null or length(v_org_name) > 160 then raise exception 'Organisation name is required'; end if;
  if v_site_name is null or length(v_site_name) > 160 then raise exception 'Site name is required'; end if;

  if exists (
    select 1
    from public.user_site_access access_row
    where access_row.user_id = v_user_id
      and access_row.active
  ) then
    raise exception 'This account already has an active Vorta site assignment';
  end if;

  select profile.organisation_id
    into v_existing_org
  from public.profiles profile
  where profile.id = v_user_id;

  if v_existing_org is not null then
    raise exception 'This account is already attached to a Vorta organisation';
  end if;

  insert into public.organisations(name, type, industry, location, status, created_by)
  values (
    v_org_name,
    'site_customer',
    nullif(btrim(p_industry), ''),
    nullif(btrim(p_country), ''),
    'active',
    v_user_id
  )
  returning id into v_org_id;

  insert into public.sites(organisation_id, name, address, region, created_by)
  values (
    v_org_id,
    v_site_name,
    nullif(btrim(p_site_location), ''),
    nullif(btrim(p_country), ''),
    v_user_id
  )
  returning id into v_site_id;

  insert into public.profiles(id, organisation_id, full_name, role)
  values (v_user_id, v_org_id, v_full_name, 'site_owner')
  on conflict (id) do update set
    organisation_id = excluded.organisation_id,
    full_name = excluded.full_name,
    role = 'site_owner',
    updated_at = now();

  insert into public.user_site_access(user_id, organisation_id, site_id, app_role, is_default, active)
  values (v_user_id, v_org_id, v_site_id, 'site_owner', true, true);

  insert into public.site_admin_audit_log(
    organisation_id,
    site_id,
    actor_user_id,
    target_user_id,
    action,
    new_value
  )
  values (
    v_org_id,
    v_site_id,
    v_user_id,
    v_user_id,
    'SITE_CREATED',
    jsonb_build_object('role', 'site_owner', 'email', lower(v_email))
  );

  return query select v_org_id, v_site_id, 'site_owner'::text;
end;
$function$;

create or replace function public.vorta_bootstrap_site_owner(
  p_full_name text,
  p_organisation_name text,
  p_industry text,
  p_country text,
  p_site_name text,
  p_site_location text default null
)
returns table(organisation_id uuid, site_id uuid, app_role text)
language sql
set search_path to 'pg_catalog', 'private', 'public'
as $function$
  select *
  from private.vorta_bootstrap_site_owner(
    p_full_name,
    p_organisation_name,
    p_industry,
    p_country,
    p_site_name,
    p_site_location
  );
$function$;

create or replace function private.vorta_accept_site_invitation(
  p_invitation_id uuid,
  p_full_name text default null
)
returns table(organisation_id uuid, site_id uuid, app_role text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'private'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
  v_inv public.site_invitations%rowtype;
  v_existing_org uuid;
  v_default boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select users.email, users.email_confirmed_at
    into v_email, v_confirmed_at
  from auth.users users
  where users.id = v_user_id;

  if v_email is null or v_confirmed_at is null then
    raise exception 'A verified email address is required';
  end if;

  select *
    into v_inv
  from public.site_invitations invitation
  where invitation.id = p_invitation_id
  for update;

  if not found then raise exception 'Vorta invitation not found'; end if;
  if v_inv.status <> 'pending' then raise exception 'This Vorta invitation is no longer active'; end if;
  if v_inv.expires_at <= now() then
    update public.site_invitations
    set status = 'expired', updated_at = now()
    where id = v_inv.id;
    raise exception 'This Vorta invitation has expired';
  end if;
  if lower(v_inv.email) <> lower(v_email) then
    raise exception 'This invitation was issued to a different email address';
  end if;

  select profile.organisation_id
    into v_existing_org
  from public.profiles profile
  where profile.id = v_user_id;

  if v_existing_org is not null and v_existing_org <> v_inv.organisation_id then
    raise exception 'This account belongs to a different Vorta organisation';
  end if;

  v_default := not exists (
    select 1
    from public.user_site_access access_row
    where access_row.user_id = v_user_id
      and access_row.active
  );

  insert into public.profiles(id, organisation_id, full_name, role)
  values (
    v_user_id,
    v_inv.organisation_id,
    coalesce(nullif(btrim(p_full_name), ''), v_inv.full_name),
    v_inv.app_role
  )
  on conflict (id) do update set
    organisation_id = excluded.organisation_id,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role = case
      when public.profiles.organisation_id is null then excluded.role
      else public.profiles.role
    end,
    updated_at = now();

  insert into public.user_site_access(user_id, organisation_id, site_id, app_role, is_default, active)
  values (v_user_id, v_inv.organisation_id, v_inv.site_id, v_inv.app_role, v_default, true)
  on conflict (user_id, site_id) do update set
    organisation_id = excluded.organisation_id,
    app_role = excluded.app_role,
    active = true,
    is_default = case
      when v_default then true
      else public.user_site_access.is_default
    end,
    updated_at = now();

  update public.site_invitations
  set status = 'accepted',
      auth_user_id = v_user_id,
      accepted_at = now(),
      updated_at = now()
  where id = v_inv.id;

  insert into public.site_admin_audit_log(
    organisation_id,
    site_id,
    actor_user_id,
    target_user_id,
    action,
    new_value
  )
  values (
    v_inv.organisation_id,
    v_inv.site_id,
    v_user_id,
    v_user_id,
    'INVITATION_ACCEPTED',
    jsonb_build_object('role', v_inv.app_role, 'email', lower(v_email))
  );

  return query select v_inv.organisation_id, v_inv.site_id, v_inv.app_role;
end;
$function$;

create or replace function public.vorta_accept_site_invitation(
  p_invitation_id uuid,
  p_full_name text default null
)
returns table(organisation_id uuid, site_id uuid, app_role text)
language sql
set search_path to 'pg_catalog', 'private', 'public'
as $function$
  select *
  from private.vorta_accept_site_invitation(p_invitation_id, p_full_name);
$function$;

revoke execute on function private.vorta_bootstrap_site_owner(text,text,text,text,text,text) from public, anon;
revoke execute on function private.vorta_accept_site_invitation(uuid,text) from public, anon;
revoke execute on function public.vorta_bootstrap_site_owner(text,text,text,text,text,text) from public, anon;
revoke execute on function public.vorta_accept_site_invitation(uuid,text) from public, anon;

grant execute on function private.vorta_bootstrap_site_owner(text,text,text,text,text,text) to authenticated, service_role;
grant execute on function private.vorta_accept_site_invitation(uuid,text) to authenticated, service_role;
grant execute on function public.vorta_bootstrap_site_owner(text,text,text,text,text,text) to authenticated, service_role;
grant execute on function public.vorta_accept_site_invitation(uuid,text) to authenticated, service_role;

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
    and function_row.proname ~ '^vorta_(launch|update|record|refresh|recalculate|log|track|upsert|save|delete|acknowledge|carry|create|confirm|cancel|bootstrap|accept)'
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
    and function_row.proname !~ '^vorta_(launch|update|record|refresh|recalculate|log|track|upsert|save|delete|acknowledge|carry|create|confirm|cancel|bootstrap|accept)'
    and allowlist.rpc_identity is null
  order by function_row.proname, function_row.oid::regprocedure::text;
$function$;

insert into private.vorta_privileged_rpc_allowlist
  (rpc_identity, purpose, access_contract, reviewed_migration, rpc_class, security_mode, anonymous_execute)
values
  (
    'vorta_bootstrap_site_owner(text,text,text,text,text,text)',
    'Self-service customer organisation and Site Owner bootstrap',
    'Public Data API entrypoint is SECURITY INVOKER. Authenticated execution only. Private SECURITY DEFINER implementation revalidates auth.uid(), verified email, absence of existing organisation/site access, bounded input and creates exactly one organisation, site, Site Owner membership and audit event atomically.',
    'harden_site_onboarding_rpc_security',
    'mutation',
    'invoker',
    false
  ),
  (
    'vorta_accept_site_invitation(uuid,text)',
    'Accept one site-scoped Vorta invitation',
    'Public Data API entrypoint is SECURITY INVOKER. Authenticated execution only. Private SECURITY DEFINER implementation locks and revalidates pending state, expiry, verified exact-email match and organisation consistency before membership creation and audit.',
    'harden_site_onboarding_rpc_security',
    'mutation',
    'invoker',
    false
  )
on conflict (rpc_identity) do update
set purpose = excluded.purpose,
    access_contract = excluded.access_contract,
    reviewed_migration = excluded.reviewed_migration,
    reviewed_at = now(),
    rpc_class = excluded.rpc_class,
    security_mode = excluded.security_mode,
    anonymous_execute = excluded.anonymous_execute;