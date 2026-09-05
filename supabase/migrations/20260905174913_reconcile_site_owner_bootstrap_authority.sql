alter table public.sites
  add column if not exists owner_user_id uuid references auth.users(id) on delete restrict;

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

  insert into public.sites(organisation_id, name, address, region, created_by, owner_user_id)
  values (
    v_org_id,
    v_site_name,
    nullif(btrim(p_site_location), ''),
    nullif(btrim(p_country), ''),
    v_user_id,
    v_user_id
  )
  returning id into v_site_id;

  insert into public.profiles(id, organisation_id, full_name, role)
  values (v_user_id, v_org_id, v_full_name, 'site_admin')
  on conflict (id) do update set
    organisation_id = excluded.organisation_id,
    full_name = excluded.full_name,
    role = 'site_admin',
    updated_at = now();

  insert into public.user_site_access(user_id, organisation_id, site_id, app_role, is_default, active)
  values (v_user_id, v_org_id, v_site_id, 'site_admin', true, true);

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
    jsonb_build_object(
      'authority', 'site_owner',
      'portal_role', 'site_admin',
      'email', lower(v_email)
    )
  );

  return query select v_org_id, v_site_id, 'site_admin'::text;
end;
$function$;

revoke execute on function private.vorta_bootstrap_site_owner(text,text,text,text,text,text) from public, anon;
grant execute on function private.vorta_bootstrap_site_owner(text,text,text,text,text,text) to authenticated, service_role;

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
security invoker
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

revoke all on function public.vorta_bootstrap_site_owner(text,text,text,text,text,text) from public, anon;
grant execute on function public.vorta_bootstrap_site_owner(text,text,text,text,text,text) to authenticated;

create or replace function public.vorta_transfer_site_ownership(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_site_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_org_id uuid;
  v_owner_user_id uuid;
  v_target_role text;
begin
  if p_actor_user_id is null or p_target_user_id is null or p_site_id is null then
    raise exception 'Actor, target user and site are required';
  end if;
  if p_actor_user_id = p_target_user_id then
    raise exception 'Site ownership is already assigned to this user';
  end if;

  select site.organisation_id, site.owner_user_id
    into v_org_id, v_owner_user_id
  from public.sites site
  where site.id = p_site_id
  for update;

  if not found or v_owner_user_id is distinct from p_actor_user_id then
    raise exception 'Only the current Site Owner can transfer ownership';
  end if;

  select access_row.app_role into v_target_role
  from public.user_site_access access_row
  where access_row.user_id = p_target_user_id
    and access_row.site_id = p_site_id
    and access_row.organisation_id = v_org_id
    and access_row.active
  for update;

  if not found then
    raise exception 'The new Site Owner must already be an active member of this site';
  end if;

  update public.sites
  set owner_user_id = p_target_user_id, updated_at = now()
  where id = p_site_id;

  if v_target_role <> 'site_admin' then
    update public.user_site_access
    set app_role = 'site_admin', updated_at = now()
    where user_id = p_target_user_id and site_id = p_site_id;
  end if;

  update public.profiles
  set role = 'site_admin', updated_at = now()
  where id = p_target_user_id and organisation_id = v_org_id;

  insert into public.site_admin_audit_log(
    organisation_id, site_id, actor_user_id, target_user_id, action, previous_value, new_value
  ) values (
    v_org_id, p_site_id, p_actor_user_id, p_target_user_id, 'SITE_OWNERSHIP_TRANSFERRED',
    jsonb_build_object('previous_owner', p_actor_user_id, 'target_previous_role', v_target_role),
    jsonb_build_object('new_owner', p_target_user_id, 'portal_role', 'site_admin')
  );
end;
$function$;

revoke all on function public.vorta_transfer_site_ownership(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.vorta_transfer_site_ownership(uuid,uuid,uuid) to service_role;

update private.vorta_privileged_rpc_allowlist
set purpose = 'Self-service customer organisation bootstrap with authoritative Site Owner and Site Admin portal access',
    access_contract = 'Public Data API entrypoint is SECURITY INVOKER. Authenticated execution only. Private SECURITY DEFINER implementation revalidates auth.uid(), verified email, absence of existing organisation/site access and bounded input; creates exactly one organisation and site with sites.owner_user_id bound to the caller, grants the caller site_admin portal access, and writes the SITE_CREATED audit event atomically.',
    reviewed_migration = 'reconcile_site_owner_bootstrap_authority',
    reviewed_at = now(),
    security_mode = 'invoker',
    anonymous_execute = false
where rpc_identity = 'vorta_bootstrap_site_owner(text,text,text,text,text,text)';
