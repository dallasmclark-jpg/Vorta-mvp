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
  v_actor_role text;
  v_target_role text;
begin
  if p_actor_user_id is null or p_target_user_id is null or p_site_id is null then
    raise exception 'Actor, target user and site are required';
  end if;
  if p_actor_user_id = p_target_user_id then
    raise exception 'Site ownership is already assigned to this user';
  end if;

  select a.organisation_id, a.app_role
    into v_org_id, v_actor_role
  from public.user_site_access a
  where a.user_id = p_actor_user_id
    and a.site_id = p_site_id
    and a.active
  for update;

  if not found or v_actor_role <> 'site_owner' then
    raise exception 'Only the current Site Owner can transfer ownership';
  end if;

  select a.app_role into v_target_role
  from public.user_site_access a
  where a.user_id = p_target_user_id
    and a.site_id = p_site_id
    and a.organisation_id = v_org_id
    and a.active
  for update;

  if not found then
    raise exception 'The new Site Owner must already be an active member of this site';
  end if;

  update public.user_site_access
  set app_role = 'site_admin', updated_at = now()
  where user_id = p_actor_user_id and site_id = p_site_id;

  update public.user_site_access
  set app_role = 'site_owner', updated_at = now()
  where user_id = p_target_user_id and site_id = p_site_id;

  update public.profiles
  set role = 'site_admin', updated_at = now()
  where id = p_actor_user_id and organisation_id = v_org_id;

  update public.profiles
  set role = 'site_owner', updated_at = now()
  where id = p_target_user_id and organisation_id = v_org_id;

  insert into public.site_admin_audit_log(
    organisation_id, site_id, actor_user_id, target_user_id, action, previous_value, new_value
  ) values (
    v_org_id, p_site_id, p_actor_user_id, p_target_user_id, 'SITE_OWNERSHIP_TRANSFERRED',
    jsonb_build_object('previous_owner', p_actor_user_id, 'target_previous_role', v_target_role),
    jsonb_build_object('new_owner', p_target_user_id, 'previous_owner_role', 'site_admin')
  );
end;
$function$;

revoke all on function public.vorta_transfer_site_ownership(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.vorta_transfer_site_ownership(uuid,uuid,uuid) to service_role;