create or replace function public.vorta_update_pilot_manual_check(
  p_site_id uuid,
  p_item_key text,
  p_status text,
  p_evidence text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_pilot_id uuid;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_evidence text := trim(coalesce(p_evidence, ''));
begin
  if v_actor_user_id is null
    or not public.vorta_can_administer_pilot(p_site_id) then
    return null;
  end if;

  if v_status <> all(
    array['pending','pass','warning','fail','not_applicable']::text[]
  ) then
    raise exception 'Invalid manual check status.';
  end if;

  if length(v_evidence) > 2000 then
    raise exception 'Manual-check evidence must be 2000 characters or fewer.';
  end if;

  if v_status <> 'pending' and length(v_evidence) < 8 then
    raise exception 'Evidence is required before a readiness check can be recorded.';
  end if;

  v_pilot_id := private.vorta_ensure_pilot_program(p_site_id, v_actor_user_id);

  update private.vorta_pilot_manual_checks
  set status = v_status,
      evidence = nullif(v_evidence, ''),
      checked_at = case when v_status = 'pending' then null else now() end,
      checked_by = case when v_status = 'pending' then null else v_actor_user_id end,
      updated_at = now()
  where pilot_id = v_pilot_id
    and item_key = upper(trim(coalesce(p_item_key, '')));

  if not found then
    raise exception 'Unknown pilot readiness item.';
  end if;

  return public.vorta_get_pilot_setup(p_site_id);
end;
$function$;

create or replace function public.vorta_record_pilot_rehearsal_attempt(
  p_site_id uuid,
  p_scenario_key text,
  p_result text,
  p_duration_minutes integer default null,
  p_intervention_required boolean default false,
  p_notes text default null,
  p_evidence text default null,
  p_issue_reference text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_pilot_id uuid;
  v_scenario_id uuid;
  v_result text := lower(trim(coalesce(p_result, '')));
  v_notes text := trim(coalesce(p_notes, ''));
  v_evidence text := trim(coalesce(p_evidence, ''));
begin
  if v_actor_user_id is null
    or not public.vorta_can_administer_pilot(p_site_id) then
    return null;
  end if;

  if v_result <> all(array['pass','fail','blocked']::text[]) then
    raise exception 'Choose a rehearsal result.';
  end if;

  if p_duration_minutes is not null
    and (p_duration_minutes < 0 or p_duration_minutes > 1440) then
    raise exception 'Rehearsal duration must be between 0 and 1440 minutes.';
  end if;

  if length(v_notes) > 3000
    or length(v_evidence) > 2000
    or length(coalesce(p_issue_reference, '')) > 500 then
    raise exception 'Rehearsal evidence exceeds the allowed length.';
  end if;

  if v_result = 'pass' then
    if p_duration_minutes is null or p_duration_minutes < 1 then
      raise exception 'A passing rehearsal requires a recorded duration.';
    end if;

    if coalesce(p_intervention_required, false) then
      raise exception 'A rehearsal requiring intervention cannot be recorded as a clean pass.';
    end if;

    if length(v_notes) < 8 or length(v_evidence) < 8 then
      raise exception 'A passing rehearsal requires notes and evidence.';
    end if;
  elsif length(v_notes) < 8 then
    raise exception 'Failed or blocked rehearsals require explanatory notes.';
  end if;

  v_pilot_id := private.vorta_ensure_pilot_program(p_site_id, v_actor_user_id);

  select scenario.id
  into v_scenario_id
  from private.vorta_pilot_rehearsal_scenarios scenario
  where scenario.pilot_id = v_pilot_id
    and scenario.scenario_key = upper(trim(coalesce(p_scenario_key, '')));

  if v_scenario_id is null then
    raise exception 'Unknown rehearsal scenario.';
  end if;

  insert into private.vorta_pilot_rehearsal_attempts (
    pilot_id,
    scenario_id,
    result,
    duration_minutes,
    intervention_required,
    notes,
    evidence,
    issue_reference,
    recorded_by
  ) values (
    v_pilot_id,
    v_scenario_id,
    v_result,
    p_duration_minutes,
    coalesce(p_intervention_required, false),
    nullif(v_notes, ''),
    nullif(v_evidence, ''),
    nullif(trim(coalesce(p_issue_reference, '')), ''),
    v_actor_user_id
  );

  return public.vorta_get_pilot_setup(p_site_id);
end;
$function$;

create or replace function public.vorta_upsert_pilot_weekly_review(
  p_site_id uuid,
  p_week_number integer,
  p_period_start date,
  p_period_end date,
  p_status text default 'draft',
  p_manager_value_score numeric default null,
  p_data_accuracy_percent numeric default null,
  p_estimated_time_saved_minutes integer default null,
  p_risks_identified integer default 0,
  p_follow_through_actions integer default 0,
  p_summary text default null,
  p_blockers text default null,
  p_next_actions text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_pilot_id uuid;
  v_status text := lower(trim(coalesce(p_status, 'draft')));
  v_summary text := trim(coalesce(p_summary, ''));
  v_next_actions text := trim(coalesce(p_next_actions, ''));
begin
  if v_actor_user_id is null
    or not public.vorta_can_administer_pilot(p_site_id) then
    return null;
  end if;

  if p_week_number < 0 or p_week_number > 52 then
    raise exception 'Week number must be between 0 and 52.';
  end if;

  if p_period_end < p_period_start then
    raise exception 'Weekly review end date must be on or after the start date.';
  end if;

  if v_status <> all(array['draft','complete']::text[]) then
    raise exception 'Invalid weekly review status.';
  end if;

  if p_manager_value_score is not null
    and (p_manager_value_score < 0 or p_manager_value_score > 10) then
    raise exception 'Manager value score must be between 0 and 10.';
  end if;

  if p_data_accuracy_percent is not null
    and (p_data_accuracy_percent < 0 or p_data_accuracy_percent > 100) then
    raise exception 'Data accuracy must be between 0 and 100.';
  end if;

  if coalesce(p_estimated_time_saved_minutes, 0) < 0
    or coalesce(p_risks_identified, 0) < 0
    or coalesce(p_follow_through_actions, 0) < 0 then
    raise exception 'Weekly review counts cannot be negative.';
  end if;

  if length(v_summary) > 5000
    or length(coalesce(p_blockers, '')) > 3000
    or length(v_next_actions) > 3000 then
    raise exception 'Weekly review text exceeds the allowed length.';
  end if;

  if v_status = 'complete' and (
    p_manager_value_score is null
    or p_data_accuracy_percent is null
    or length(v_summary) < 8
    or length(v_next_actions) < 8
  ) then
    raise exception 'A completed weekly review requires value, accuracy, summary and next actions.';
  end if;

  v_pilot_id := private.vorta_ensure_pilot_program(p_site_id, v_actor_user_id);

  insert into private.vorta_pilot_weekly_reviews (
    pilot_id,
    week_number,
    period_start,
    period_end,
    status,
    manager_value_score,
    data_accuracy_percent,
    estimated_time_saved_minutes,
    risks_identified,
    follow_through_actions,
    summary,
    blockers,
    next_actions,
    completed_at,
    completed_by,
    created_by,
    updated_by
  ) values (
    v_pilot_id,
    p_week_number,
    p_period_start,
    p_period_end,
    v_status,
    p_manager_value_score,
    p_data_accuracy_percent,
    p_estimated_time_saved_minutes,
    coalesce(p_risks_identified, 0),
    coalesce(p_follow_through_actions, 0),
    nullif(v_summary, ''),
    nullif(trim(coalesce(p_blockers, '')), ''),
    nullif(v_next_actions, ''),
    case when v_status = 'complete' then now() else null end,
    case when v_status = 'complete' then v_actor_user_id else null end,
    v_actor_user_id,
    v_actor_user_id
  )
  on conflict (pilot_id, week_number) do update set
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    status = excluded.status,
    manager_value_score = excluded.manager_value_score,
    data_accuracy_percent = excluded.data_accuracy_percent,
    estimated_time_saved_minutes = excluded.estimated_time_saved_minutes,
    risks_identified = excluded.risks_identified,
    follow_through_actions = excluded.follow_through_actions,
    summary = excluded.summary,
    blockers = excluded.blockers,
    next_actions = excluded.next_actions,
    completed_at = case
      when excluded.status = 'complete'
        then coalesce(private.vorta_pilot_weekly_reviews.completed_at, now())
      else null
    end,
    completed_by = case
      when excluded.status = 'complete' then v_actor_user_id
      else null
    end,
    updated_by = v_actor_user_id,
    updated_at = now();

  return public.vorta_get_pilot_setup(p_site_id);
end;
$function$;

create or replace function public.vorta_launch_pilot(p_site_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_pilot_id uuid;
  v_report jsonb;
begin
  if v_actor_user_id is null
    or not public.vorta_can_administer_pilot(p_site_id) then
    return null;
  end if;

  v_pilot_id := private.vorta_ensure_pilot_program(p_site_id, v_actor_user_id);
  v_report := public.vorta_get_pilot_setup(p_site_id);

  if coalesce(
    (v_report #>> '{readiness,launchEligible}')::boolean,
    false
  ) is not true then
    raise exception 'Pilot launch is blocked until every required readiness gate and consecutive rehearsal pass is complete.';
  end if;

  update private.vorta_pilot_programs
  set status = 'LIVE',
      actual_start_at = coalesce(actual_start_at, now()),
      launch_confirmed_by = v_actor_user_id,
      launch_confirmed_at = now(),
      updated_by = v_actor_user_id,
      updated_at = now()
  where id = v_pilot_id;

  return public.vorta_get_pilot_setup(p_site_id);
end;
$function$;

revoke all on function public.vorta_update_pilot_manual_check(uuid,text,text,text) from public, anon;
revoke all on function public.vorta_record_pilot_rehearsal_attempt(uuid,text,text,integer,boolean,text,text,text) from public, anon;
revoke all on function public.vorta_upsert_pilot_weekly_review(uuid,integer,date,date,text,numeric,numeric,integer,integer,integer,text,text,text) from public, anon;
revoke all on function public.vorta_launch_pilot(uuid) from public, anon;

grant execute on function public.vorta_update_pilot_manual_check(uuid,text,text,text) to authenticated;
grant execute on function public.vorta_record_pilot_rehearsal_attempt(uuid,text,text,integer,boolean,text,text,text) to authenticated;
grant execute on function public.vorta_upsert_pilot_weekly_review(uuid,integer,date,date,text,numeric,numeric,integer,integer,integer,text,text,text) to authenticated;
grant execute on function public.vorta_launch_pilot(uuid) to authenticated;
