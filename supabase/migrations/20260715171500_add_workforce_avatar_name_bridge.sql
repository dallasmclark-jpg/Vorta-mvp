create or replace function public.vorta_get_workforce_avatar_by_name(
  p_entity_type text,
  p_name text
)
returns table(entity_id uuid, avatar_url text)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  if nullif(btrim(p_name), '') is null then
    return;
  end if;

  case lower(coalesce(p_entity_type, ''))
    when 'engineer' then
      return query
      select engineer.id, engineer.avatar_url
      from public.engineers engineer
      where engineer.full_name = btrim(p_name)
        and private.vorta_rls_has_site_access(engineer.site_id, false)
      order by engineer.id
      limit 1;

    when 'operator' then
      return query
      select operator.id, operator.avatar_url
      from public.operators operator
      where operator.display_name = btrim(p_name)
        and private.vorta_rls_has_site_access(operator.site_id, false)
      order by operator.id
      limit 1;

    else
      return;
  end case;
end;
$function$;

revoke all on function public.vorta_get_workforce_avatar_by_name(text, text) from public;
grant execute on function public.vorta_get_workforce_avatar_by_name(text, text) to authenticated;

comment on function public.vorta_get_workforce_avatar_by_name(text, text) is
  'Temporary authorised bridge for legacy workforce lists that do not yet expose immutable entity IDs. New pages must use vorta_get_workforce_avatar by ID.';
