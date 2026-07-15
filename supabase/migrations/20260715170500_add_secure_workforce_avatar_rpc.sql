create or replace function public.vorta_get_workforce_avatar(
  p_entity_type text,
  p_entity_id uuid
)
returns table(avatar_url text)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  if p_entity_id is null then
    return;
  end if;

  case lower(coalesce(p_entity_type, ''))
    when 'engineer' then
      return query
      select engineer.avatar_url
      from public.engineers engineer
      where engineer.id = p_entity_id
        and private.vorta_rls_has_site_access(engineer.site_id, false);

    when 'operator' then
      return query
      select operator.avatar_url
      from public.operators operator
      where operator.id = p_entity_id
        and private.vorta_rls_has_site_access(operator.site_id, false);

    when 'profile' then
      return query
      select profile.avatar_url
      from public.profiles profile
      where profile.id = p_entity_id
        and (
          profile.id = (select auth.uid())
          or private.vorta_rls_current_role() = 'vorta_admin'
        );

    else
      return;
  end case;
end;
$function$;

revoke all on function public.vorta_get_workforce_avatar(text, uuid) from public;
grant execute on function public.vorta_get_workforce_avatar(text, uuid) to authenticated;

comment on function public.vorta_get_workforce_avatar(text, uuid) is
  'Returns the authorised workforce avatar for an engineer, operator or user profile by immutable entity ID.';
