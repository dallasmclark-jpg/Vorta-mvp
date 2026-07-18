create table private.vorta_pilot_usage_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_role text not null,
  event_type text not null,
  pathname text,
  entity_type text,
  entity_id text,
  session_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint vorta_pilot_usage_events_event_type_check check (
    event_type = any (array[
      'dashboard_review',
      'pilot_impact_review',
      'equipment_view',
      'work_order_view',
      'ask_vorta_query',
      'recommendation_opened',
      'capability_review',
      'pilot_report_range_applied',
      'pilot_report_downloaded'
    ]::text[])
  ),
  constraint vorta_pilot_usage_events_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index vorta_pilot_usage_events_site_time_idx
  on private.vorta_pilot_usage_events (site_id, occurred_at desc);
create index vorta_pilot_usage_events_site_type_time_idx
  on private.vorta_pilot_usage_events (site_id, event_type, occurred_at desc);
create index vorta_pilot_usage_events_actor_time_idx
  on private.vorta_pilot_usage_events (actor_user_id, occurred_at desc);
create index vorta_pilot_usage_events_session_idx
  on private.vorta_pilot_usage_events (session_id)
  where session_id is not null;
create index vorta_pilot_usage_events_entity_idx
  on private.vorta_pilot_usage_events (site_id, entity_type, entity_id, occurred_at desc)
  where entity_id is not null;

alter table private.vorta_pilot_usage_events enable row level security;

create policy vorta_pilot_usage_events_deny_anon
  on private.vorta_pilot_usage_events
  for all to anon
  using (false)
  with check (false);

create policy vorta_pilot_usage_events_deny_authenticated
  on private.vorta_pilot_usage_events
  for all to authenticated
  using (false)
  with check (false);

revoke all on private.vorta_pilot_usage_events from public;
revoke all on private.vorta_pilot_usage_events from anon;
revoke all on private.vorta_pilot_usage_events from authenticated;

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
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
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

  if jsonb_typeof(v_metadata) <> 'object' then
    v_metadata := '{}'::jsonb;
  end if;

  v_metadata := v_metadata - array[
    'question', 'query', 'prompt', 'message', 'email', 'full_name', 'name', 'stack'
  ]::text[];

  if octet_length(v_metadata::text) > 4096 then
    v_metadata := jsonb_build_object('metadataTruncated', true);
  end if;

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

create or replace function private.vorta_get_pilot_adoption_report_core(
  p_site_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_start_date date := least(coalesce(p_start_date, current_date), coalesce(p_end_date, current_date));
  v_end_date date := greatest(coalesce(p_start_date, current_date), coalesce(p_end_date, current_date));
  v_site_timezone text := 'UTC';
  v_period_days integer;
  v_total_events integer := 0;
  v_active_users integer := 0;
  v_sessions integer := 0;
  v_active_days integer := 0;
  v_dashboard_reviews integer := 0;
  v_pilot_reviews integer := 0;
  v_equipment_views integer := 0;
  v_unique_equipment integer := 0;
  v_work_order_views integer := 0;
  v_ask_queries integer := 0;
  v_recommendations integer := 0;
  v_capability_reviews integer := 0;
  v_range_applies integer := 0;
  v_report_downloads integer := 0;
  v_risk_users integer := 0;
  v_equipment_users integer := 0;
  v_ai_users integer := 0;
  v_action_users integer := 0;
  v_meaningful_actions integer := 0;
  v_first_event timestamptz;
  v_latest_event timestamptz;
  v_activity_score numeric := 0;
  v_workflow_score numeric := 0;
  v_breadth_score numeric := 0;
  v_repeat_score numeric := 0;
  v_adoption_score numeric := 0;
  v_status text := 'NO_USAGE';
  v_daily_trend jsonb := '[]'::jsonb;
  v_event_breakdown jsonb := '[]'::jsonb;
  v_top_equipment jsonb := '[]'::jsonb;
  v_limitations jsonb := '[]'::jsonb;
begin
  select coalesce(nullif(site.timezone, ''), 'UTC')
  into v_site_timezone
  from public.sites site
  where site.id = p_site_id;

  v_period_days := greatest(1, v_end_date - v_start_date + 1);

  with scoped as (
    select usage_event.*
    from private.vorta_pilot_usage_events usage_event
    where usage_event.site_id = p_site_id
      and (usage_event.occurred_at at time zone v_site_timezone)::date between v_start_date and v_end_date
  )
  select
    count(*)::integer,
    count(distinct actor_user_id)::integer,
    count(distinct session_id) filter (where session_id is not null)::integer,
    count(distinct (occurred_at at time zone v_site_timezone)::date)::integer,
    count(*) filter (where event_type = 'dashboard_review')::integer,
    count(*) filter (where event_type = 'pilot_impact_review')::integer,
    count(*) filter (where event_type = 'equipment_view')::integer,
    count(distinct entity_id) filter (where event_type = 'equipment_view' and entity_id is not null)::integer,
    count(*) filter (where event_type = 'work_order_view')::integer,
    count(*) filter (where event_type = 'ask_vorta_query')::integer,
    count(*) filter (where event_type = 'recommendation_opened')::integer,
    count(*) filter (where event_type = 'capability_review')::integer,
    count(*) filter (where event_type = 'pilot_report_range_applied')::integer,
    count(*) filter (where event_type = 'pilot_report_downloaded')::integer,
    count(distinct actor_user_id) filter (where event_type in ('dashboard_review', 'pilot_impact_review'))::integer,
    count(distinct actor_user_id) filter (where event_type = 'equipment_view')::integer,
    count(distinct actor_user_id) filter (where event_type = 'ask_vorta_query')::integer,
    count(distinct actor_user_id) filter (where event_type in ('work_order_view', 'recommendation_opened', 'pilot_report_downloaded'))::integer,
    min(occurred_at),
    max(occurred_at)
  into
    v_total_events,
    v_active_users,
    v_sessions,
    v_active_days,
    v_dashboard_reviews,
    v_pilot_reviews,
    v_equipment_views,
    v_unique_equipment,
    v_work_order_views,
    v_ask_queries,
    v_recommendations,
    v_capability_reviews,
    v_range_applies,
    v_report_downloads,
    v_risk_users,
    v_equipment_users,
    v_ai_users,
    v_action_users,
    v_first_event,
    v_latest_event
  from scoped;

  v_meaningful_actions := v_work_order_views + v_recommendations + v_report_downloads;

  v_activity_score := round(least(100::numeric, v_active_days * 100.0 / least(v_period_days, 14)), 1);
  v_workflow_score := round(
    least(100::numeric, (v_dashboard_reviews + v_pilot_reviews) * 100.0 / 3) * 0.20
    + least(100::numeric, v_equipment_views * 100.0 / 5) * 0.25
    + least(100::numeric, v_ask_queries * 100.0 / 3) * 0.25
    + least(100::numeric, v_meaningful_actions * 100.0 / 3) * 0.30,
    1
  );
  v_breadth_score := round(
    least(100::numeric,
      (
        (case when v_dashboard_reviews + v_pilot_reviews > 0 then 1 else 0 end)
        + (case when v_equipment_views > 0 then 1 else 0 end)
        + (case when v_work_order_views > 0 then 1 else 0 end)
        + (case when v_ask_queries > 0 then 1 else 0 end)
        + (case when v_recommendations > 0 then 1 else 0 end)
        + (case when v_capability_reviews > 0 then 1 else 0 end)
        + (case when v_report_downloads > 0 then 1 else 0 end)
      ) * 100.0 / 7
    ),
    1
  );
  v_repeat_score := case
    when v_active_days = 0 then 0
    else round(least(100::numeric, greatest(v_sessions, v_active_days) * 100.0 / greatest(1, v_active_days * 2)), 1)
  end;
  v_adoption_score := round(
    v_activity_score * 0.30
    + v_workflow_score * 0.35
    + v_breadth_score * 0.20
    + v_repeat_score * 0.15,
    1
  );

  v_status := case
    when v_total_events = 0 then 'NO_USAGE'
    when v_active_days < 3 then 'BASELINE_USAGE'
    when v_active_days < 7 or v_adoption_score < 60 then 'EARLY_ADOPTION'
    when v_active_days < 14 or v_adoption_score < 80 then 'ESTABLISHED_USE'
    else 'SUSTAINED_ADOPTION'
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', trend.event_date,
    'events', trend.event_count,
    'sessions', trend.session_count,
    'riskReviews', trend.risk_reviews,
    'equipmentViews', trend.equipment_views,
    'askVortaQueries', trend.ask_queries,
    'meaningfulActions', trend.meaningful_actions
  ) order by trend.event_date), '[]'::jsonb)
  into v_daily_trend
  from (
    select
      day_value::date as event_date,
      count(usage_event.id)::integer as event_count,
      count(distinct usage_event.session_id) filter (where usage_event.session_id is not null)::integer as session_count,
      count(usage_event.id) filter (where usage_event.event_type in ('dashboard_review', 'pilot_impact_review'))::integer as risk_reviews,
      count(usage_event.id) filter (where usage_event.event_type = 'equipment_view')::integer as equipment_views,
      count(usage_event.id) filter (where usage_event.event_type = 'ask_vorta_query')::integer as ask_queries,
      count(usage_event.id) filter (where usage_event.event_type in ('work_order_view', 'recommendation_opened', 'pilot_report_downloaded'))::integer as meaningful_actions
    from generate_series(v_start_date::timestamp, v_end_date::timestamp, interval '1 day') day_value
    left join private.vorta_pilot_usage_events usage_event
      on usage_event.site_id = p_site_id
      and (usage_event.occurred_at at time zone v_site_timezone)::date = day_value::date
    group by day_value::date
  ) trend;

  select coalesce(jsonb_agg(jsonb_build_object(
    'eventType', event_group.event_type,
    'count', event_group.event_count,
    'users', event_group.user_count
  ) order by event_group.event_count desc, event_group.event_type), '[]'::jsonb)
  into v_event_breakdown
  from (
    select
      usage_event.event_type,
      count(*)::integer as event_count,
      count(distinct usage_event.actor_user_id)::integer as user_count
    from private.vorta_pilot_usage_events usage_event
    where usage_event.site_id = p_site_id
      and (usage_event.occurred_at at time zone v_site_timezone)::date between v_start_date and v_end_date
    group by usage_event.event_type
  ) event_group;

  select coalesce(jsonb_agg(jsonb_build_object(
    'equipmentId', equipment_group.equipment_id,
    'equipmentCode', equipment_group.equipment_code,
    'equipmentName', equipment_group.equipment_name,
    'views', equipment_group.view_count,
    'users', equipment_group.user_count
  ) order by equipment_group.view_count desc, equipment_group.equipment_name), '[]'::jsonb)
  into v_top_equipment
  from (
    select
      usage_event.entity_id as equipment_id,
      coalesce(asset.equipment_code, usage_event.entity_id) as equipment_code,
      coalesce(asset.name, 'Equipment record') as equipment_name,
      count(*)::integer as view_count,
      count(distinct usage_event.actor_user_id)::integer as user_count
    from private.vorta_pilot_usage_events usage_event
    left join public.equipment_assets asset
      on asset.site_id = p_site_id
      and asset.id::text = usage_event.entity_id
    where usage_event.site_id = p_site_id
      and usage_event.event_type = 'equipment_view'
      and usage_event.entity_id is not null
      and (usage_event.occurred_at at time zone v_site_timezone)::date between v_start_date and v_end_date
    group by usage_event.entity_id, asset.equipment_code, asset.name
    order by count(*) desc
    limit 5
  ) equipment_group;

  v_limitations := to_jsonb(array_remove(array[
    case when v_total_events = 0 then 'No manager usage events have been captured in the selected period.' end,
    case when v_active_days between 1 and 2 then 'Fewer than three active days exist; adoption is a baseline signal only.' end,
    case when v_active_days between 3 and 6 then 'Fewer than seven active days exist; adoption remains an early signal.' end,
    case when v_ask_queries = 0 then 'No Ask Vorta queries were captured in the selected period.' end,
    case when v_meaningful_actions = 0 then 'No recommendation, work-order or pilot-report follow-through event was captured.' end,
    'Usage events demonstrate product engagement, not causal maintenance outcomes.'
  ]::text[], null));

  return jsonb_build_object(
    'status', v_status,
    'score', v_adoption_score,
    'interpretation', 'Adoption measures deliberate Maintenance Manager workflow engagement. It does not infer maintenance outcomes from clicks alone.',
    'period', jsonb_build_object(
      'startDate', v_start_date,
      'endDate', v_end_date,
      'periodDays', v_period_days,
      'firstEventAt', v_first_event,
      'latestEventAt', v_latest_event
    ),
    'summary', jsonb_build_object(
      'totalEvents', v_total_events,
      'activeUsers', v_active_users,
      'sessions', v_sessions,
      'activeDays', v_active_days,
      'meaningfulActions', v_meaningful_actions
    ),
    'workflow', jsonb_build_object(
      'riskReviews', v_dashboard_reviews + v_pilot_reviews,
      'dashboardReviews', v_dashboard_reviews,
      'pilotImpactReviews', v_pilot_reviews,
      'equipmentViews', v_equipment_views,
      'uniqueEquipmentViewed', v_unique_equipment,
      'workOrderViews', v_work_order_views,
      'askVortaQueries', v_ask_queries,
      'recommendationsOpened', v_recommendations,
      'capabilityReviews', v_capability_reviews,
      'reportRangeApplications', v_range_applies,
      'reportDownloads', v_report_downloads
    ),
    'funnel', jsonb_build_object(
      'activeUsers', v_active_users,
      'riskReviewUsers', v_risk_users,
      'equipmentReviewUsers', v_equipment_users,
      'askVortaUsers', v_ai_users,
      'followThroughUsers', v_action_users
    ),
    'scoreComponents', jsonb_build_object(
      'activityCoverage', v_activity_score,
      'workflowDepth', v_workflow_score,
      'featureBreadth', v_breadth_score,
      'repeatUse', v_repeat_score
    ),
    'dailyTrend', v_daily_trend,
    'eventBreakdown', v_event_breakdown,
    'topEquipment', v_top_equipment,
    'limitations', v_limitations
  );
end;
$function$;

revoke all on function private.vorta_get_pilot_adoption_report_core(uuid, date, date) from public;
revoke all on function private.vorta_get_pilot_adoption_report_core(uuid, date, date) from anon;
revoke all on function private.vorta_get_pilot_adoption_report_core(uuid, date, date) from authenticated;
revoke all on function private.vorta_get_pilot_adoption_report_core(uuid, date, date) from service_role;

create or replace function public.vorta_get_pilot_value_report(
  p_site_id uuid,
  p_start_date date default null,
  p_end_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_report jsonb;
  v_adoption jsonb;
  v_site_name text;
  v_site_region text;
  v_site_timezone text;
  v_report_start_date date;
  v_report_end_date date;
begin
  if not public.vorta_can_manage_site(p_site_id) then
    return null;
  end if;

  select site.name, site.region, site.timezone
  into v_site_name, v_site_region, v_site_timezone
  from public.sites site
  where site.id = p_site_id;

  if v_site_name is null then
    return null;
  end if;

  v_report := private.vorta_get_pilot_value_report_core(p_site_id, p_start_date, p_end_date);
  if v_report is null then
    return null;
  end if;

  v_report_start_date := (v_report #>> '{period,requestedStartDate}')::date;
  v_report_end_date := (v_report #>> '{period,requestedEndDate}')::date;
  v_adoption := private.vorta_get_pilot_adoption_report_core(
    p_site_id,
    v_report_start_date,
    v_report_end_date
  );

  return v_report || jsonb_build_object(
    'reportVersion', '1.2.0',
    'site', jsonb_build_object(
      'id', p_site_id,
      'name', v_site_name,
      'region', v_site_region,
      'timezone', coalesce(nullif(v_site_timezone, ''), 'UTC')
    ),
    'adoption', v_adoption
  );
end;
$function$;

revoke all on function public.vorta_get_pilot_value_report(uuid, date, date) from public;
revoke all on function public.vorta_get_pilot_value_report(uuid, date, date) from anon;
grant execute on function public.vorta_get_pilot_value_report(uuid, date, date) to authenticated;
grant execute on function public.vorta_get_pilot_value_report(uuid, date, date) to service_role;

comment on table private.vorta_pilot_usage_events is
  'Privacy-minimised Maintenance Manager pilot workflow events used to measure adoption without storing prompt text or personal content.';
comment on function public.vorta_track_pilot_usage_event(uuid, text, text, text, text, uuid, jsonb) is
  'Records an allow-listed, manager-scoped pilot workflow event with server-side identity, metadata sanitisation and duplicate suppression.';
comment on function private.vorta_get_pilot_adoption_report_core(uuid, date, date) is
  'Builds date-scoped Maintenance Manager adoption evidence for the consolidated pilot value report.';
comment on function public.vorta_get_pilot_value_report(uuid, date, date) is
  'Returns manager-scoped pilot value evidence with authorised site metadata and privacy-minimised adoption reporting.';
