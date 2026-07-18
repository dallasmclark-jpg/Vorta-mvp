create or replace function public.vorta_track_pilot_usage_event(
  p_site_id uuid,
  p_event_type text,
  p_pathname text default null,
  p_entity_type text default null,
  p_entity_id text default null,
  p_session_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text;
  v_event_type text := lower(trim(coalesce(p_event_type, '')));
  v_pathname text := left(nullif(trim(coalesce(p_pathname, '')), ''), 240);
  v_entity_type text := left(nullif(lower(trim(coalesce(p_entity_type, ''))), ''), 40);
  v_entity_id text := left(nullif(trim(coalesce(p_entity_id, '')), ''), 160);
  v_input_metadata jsonb := case
    when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object' then coalesce(p_metadata, '{}'::jsonb)
    else '{}'::jsonb
  end;
  v_metadata jsonb := '{}'::jsonb;
  v_existing_id uuid;
  v_event_id uuid;
begin
  if v_actor_user_id is null or not public.vorta_can_manage_site(p_site_id) then
    return null;
  end if;

  if v_event_type <> all (array[
    'dashboard_review',
    'pilot_impact_review',
    'equipment_view',
    'work_order_view',
    'ask_vorta_query',
    'recommendation_opened',
    'capability_review',
    'pilot_report_range_applied',
    'pilot_report_downloaded'
  ]::text[]) then
    return null;
  end if;

  v_metadata := case v_event_type
    when 'pilot_impact_review' then
      jsonb_strip_nulls(jsonb_build_object(
        'page', left(nullif(v_input_metadata->>'page', ''), 40)
      ))
    when 'equipment_view' then
      jsonb_strip_nulls(jsonb_build_object(
        'section', left(nullif(v_input_metadata->>'section', ''), 40)
      ))
    when 'work_order_view' then
      jsonb_strip_nulls(jsonb_build_object(
        'equipmentId', left(nullif(v_input_metadata->>'equipmentId', ''), 160)
      ))
    when 'ask_vorta_query' then
      jsonb_strip_nulls(jsonb_build_object(
        'category', left(nullif(v_input_metadata->>'category', ''), 40),
        'questionLength', least(10000, greatest(0, coalesce(
          case when (v_input_metadata->>'questionLength') ~ '^\d+$'
            then (v_input_metadata->>'questionLength')::integer
          end,
          0
        )))
      ))
    when 'recommendation_opened' then
      jsonb_strip_nulls(jsonb_build_object(
        'destination', left(nullif(v_input_metadata->>'destination', ''), 240)
      ))
    when 'pilot_report_range_applied' then
      jsonb_strip_nulls(jsonb_build_object(
        'preset', left(nullif(v_input_metadata->>'preset', ''), 40),
        'startDate', case when (v_input_metadata->>'startDate') ~ '^\d{4}-\d{2}-\d{2}$' then v_input_metadata->>'startDate' end,
        'endDate', case when (v_input_metadata->>'endDate') ~ '^\d{4}-\d{2}-\d{2}$' then v_input_metadata->>'endDate' end,
        'periodDays', least(3660, greatest(0, coalesce(
          case when (v_input_metadata->>'periodDays') ~ '^\d+$'
            then (v_input_metadata->>'periodDays')::integer
          end,
          0
        ))),
        'surface', left(nullif(v_input_metadata->>'surface', ''), 40)
      ))
    when 'pilot_report_downloaded' then
      jsonb_strip_nulls(jsonb_build_object(
        'format', left(nullif(v_input_metadata->>'format', ''), 40)
      ))
    else '{}'::jsonb
  end;

  select lower(replace(replace(coalesce(profile.role, 'unknown'), '-', '_'), ' ', '_'))
  into v_actor_role
  from public.profiles profile
  where profile.id = v_actor_user_id;

  v_actor_role := coalesce(v_actor_role, 'unknown');

  if v_event_type = any (array[
    'dashboard_review',
    'pilot_impact_review',
    'equipment_view',
    'capability_review'
  ]::text[]) then
    select usage_event.id
    into v_existing_id
    from private.vorta_pilot_usage_events usage_event
    where usage_event.site_id = p_site_id
      and usage_event.actor_user_id = v_actor_user_id
      and usage_event.event_type = v_event_type
      and usage_event.pathname is not distinct from v_pathname
      and usage_event.entity_type is not distinct from v_entity_type
      and usage_event.entity_id is not distinct from v_entity_id
      and usage_event.session_id is not distinct from p_session_id
      and usage_event.occurred_at >= now() - interval '5 minutes'
    order by usage_event.occurred_at desc
    limit 1;

    if v_existing_id is not null then
      return v_existing_id;
    end if;
  elsif v_event_type = 'ask_vorta_query' then
    select usage_event.id
    into v_existing_id
    from private.vorta_pilot_usage_events usage_event
    where usage_event.site_id = p_site_id
      and usage_event.actor_user_id = v_actor_user_id
      and usage_event.event_type = v_event_type
      and usage_event.session_id is not distinct from p_session_id
      and usage_event.occurred_at >= now() - interval '3 seconds'
    order by usage_event.occurred_at desc
    limit 1;

    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  insert into private.vorta_pilot_usage_events (
    site_id,
    actor_user_id,
    actor_role,
    event_type,
    pathname,
    entity_type,
    entity_id,
    session_id,
    metadata
  ) values (
    p_site_id,
    v_actor_user_id,
    v_actor_role,
    v_event_type,
    v_pathname,
    v_entity_type,
    v_entity_id,
    p_session_id,
    v_metadata
  )
  returning id into v_event_id;

  return v_event_id;
end;
$function$;

revoke all on function public.vorta_track_pilot_usage_event(uuid, text, text, text, text, uuid, jsonb) from public;
revoke all on function public.vorta_track_pilot_usage_event(uuid, text, text, text, text, uuid, jsonb) from anon;
grant execute on function public.vorta_track_pilot_usage_event(uuid, text, text, text, text, uuid, jsonb) to authenticated;

comment on function public.vorta_track_pilot_usage_event(uuid, text, text, text, text, uuid, jsonb) is
  'Records an allow-listed, manager-scoped pilot workflow event using strict event-specific metadata fields, server-side identity and duplicate suppression.';
