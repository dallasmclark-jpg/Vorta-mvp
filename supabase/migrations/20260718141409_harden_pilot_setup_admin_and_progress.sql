create or replace function public.vorta_can_administer_pilot(p_site_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_profile_role text;
  v_demo_admin boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if not public.vorta_has_site_access(p_site_id, false) then
    return false;
  end if;

  select lower(replace(replace(coalesce(profile.role, ''), '-', '_'), ' ', '_'))
  into v_profile_role
  from public.profiles profile
  where profile.id = auth.uid();

  v_demo_admin := coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'demo_admin')::boolean,
    false
  );

  return v_demo_admin or v_profile_role in ('vorta_admin', 'site_admin');
end;
$function$;

revoke all on function public.vorta_can_administer_pilot(uuid) from public, anon;
grant execute on function public.vorta_can_administer_pilot(uuid) to authenticated;

create or replace function private.vorta_get_pilot_rehearsal_progress(p_pilot_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path to 'pg_catalog', 'private'
as $function$
with scenario_progress as (
  select
    scenario.id,
    scenario.scenario_key,
    scenario.scenario_order,
    scenario.title,
    scenario.objective,
    scenario.expected_outcome,
    scenario.required_clean_passes,
    scenario.blocking,
    coalesce(history.attempts, 0)::integer as attempts,
    coalesce(history.failures, 0)::integer as failures,
    coalesce(history.blocked_attempts, 0)::integer as blocked_attempts,
    coalesce(streak.clean_passes, 0)::integer as clean_passes,
    latest.result as latest_result,
    latest.intervention_required as latest_intervention_required,
    latest.notes as latest_notes,
    latest.evidence as latest_evidence,
    latest.issue_reference as latest_issue_reference,
    latest.recorded_at as last_attempt_at,
    (
      latest.result = 'pass'
      and latest.intervention_required is false
      and coalesce(streak.clean_passes, 0) >= scenario.required_clean_passes
    ) as complete
  from private.vorta_pilot_rehearsal_scenarios scenario
  left join lateral (
    select
      count(*)::integer as attempts,
      count(*) filter (where attempt.result = 'fail')::integer as failures,
      count(*) filter (where attempt.result = 'blocked')::integer as blocked_attempts,
      max(attempt.recorded_at) filter (
        where attempt.result <> 'pass' or attempt.intervention_required
      ) as last_reset_at
    from private.vorta_pilot_rehearsal_attempts attempt
    where attempt.scenario_id = scenario.id
  ) history on true
  left join lateral (
    select
      attempt.result,
      attempt.intervention_required,
      attempt.notes,
      attempt.evidence,
      attempt.issue_reference,
      attempt.recorded_at
    from private.vorta_pilot_rehearsal_attempts attempt
    where attempt.scenario_id = scenario.id
    order by attempt.recorded_at desc, attempt.id desc
    limit 1
  ) latest on true
  left join lateral (
    select count(*)::integer as clean_passes
    from private.vorta_pilot_rehearsal_attempts attempt
    where attempt.scenario_id = scenario.id
      and attempt.result = 'pass'
      and not attempt.intervention_required
      and (
        history.last_reset_at is null
        or attempt.recorded_at > history.last_reset_at
      )
  ) streak on true
  where scenario.pilot_id = p_pilot_id
),
summary as (
  select
    count(*)::integer as total_scenarios,
    count(*) filter (where progress.complete)::integer as completed_scenarios,
    coalesce(sum(progress.clean_passes), 0)::integer as clean_passes,
    count(*) filter (
      where progress.blocking and not progress.complete
    )::integer as blockers,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key', progress.scenario_key,
          'order', progress.scenario_order,
          'title', progress.title,
          'objective', progress.objective,
          'expectedOutcome', progress.expected_outcome,
          'requiredCleanPasses', progress.required_clean_passes,
          'blocking', progress.blocking,
          'attempts', progress.attempts,
          'cleanPasses', progress.clean_passes,
          'failures', progress.failures,
          'blockedAttempts', progress.blocked_attempts,
          'complete', progress.complete,
          'latestResult', progress.latest_result,
          'latestInterventionRequired', progress.latest_intervention_required,
          'latestNotes', progress.latest_notes,
          'latestEvidence', progress.latest_evidence,
          'latestIssueReference', progress.latest_issue_reference,
          'lastAttemptAt', progress.last_attempt_at
        )
        order by progress.scenario_order
      ),
      '[]'::jsonb
    ) as scenarios
  from scenario_progress progress
)
select jsonb_build_object(
  'complete', summary.total_scenarios > 0
    and summary.completed_scenarios = summary.total_scenarios,
  'totalScenarios', summary.total_scenarios,
  'completedScenarios', summary.completed_scenarios,
  'cleanPasses', summary.clean_passes,
  'blockers', summary.blockers,
  'scenarios', summary.scenarios
)
from summary;
$function$;

revoke all on function private.vorta_get_pilot_rehearsal_progress(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.vorta_get_pilot_setup(p_site_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_report jsonb;
  v_progress jsonb;
  v_participants jsonb := '[]'::jsonb;
  v_pilot_id uuid;
  v_owner_name text;
  v_manager_name text;
  v_automated_blockers integer := 0;
  v_manual_blockers integer := 0;
  v_rehearsal_blockers integer := 0;
  v_total_units numeric := 0;
  v_earned_units numeric := 0;
  v_score numeric := 0;
  v_launch_eligible boolean := false;
  v_rehearsal_complete boolean := false;
  v_status text;
  v_next_action text;
begin
  if v_actor_user_id is null
    or not public.vorta_can_administer_pilot(p_site_id) then
    return null;
  end if;

  v_report := private.vorta_get_pilot_setup_core(p_site_id, v_actor_user_id);
  v_pilot_id := (v_report #>> '{pilot,id}')::uuid;
  v_progress := private.vorta_get_pilot_rehearsal_progress(v_pilot_id);

  v_automated_blockers := coalesce(
    (v_report #>> '{readiness,automatedBlockers}')::integer,
    0
  );
  v_manual_blockers := coalesce(
    (v_report #>> '{readiness,manualBlockers}')::integer,
    0
  );
  v_rehearsal_blockers := coalesce(
    (v_progress ->> 'blockers')::integer,
    0
  );
  v_rehearsal_complete := coalesce(
    (v_progress ->> 'complete')::boolean,
    false
  );

  select
    coalesce(sum(case check_value ->> 'status'
      when 'pass' then 1
      when 'warning' then 0.5
      else 0
    end), 0),
    count(*)::numeric
  into v_earned_units, v_total_units
  from jsonb_array_elements(
    coalesce(v_report #> '{readiness,automatedChecks}', '[]'::jsonb)
  ) check_value;

  select
    v_earned_units + coalesce(sum(case check_value ->> 'status'
      when 'pass' then 1
      when 'not_applicable' then 1
      when 'warning' then 0.5
      else 0
    end), 0),
    v_total_units + count(*)::numeric
  into v_earned_units, v_total_units
  from jsonb_array_elements(
    coalesce(v_report #> '{readiness,manualChecks}', '[]'::jsonb)
  ) check_value;

  v_earned_units := v_earned_units
    + coalesce((v_progress ->> 'completedScenarios')::integer, 0);
  v_total_units := v_total_units
    + coalesce((v_progress ->> 'totalScenarios')::integer, 0);

  v_score := case
    when v_total_units = 0 then 0
    else round(v_earned_units * 100.0 / v_total_units, 1)
  end;

  v_launch_eligible := v_automated_blockers = 0
    and v_manual_blockers = 0
    and v_rehearsal_blockers = 0
    and v_rehearsal_complete;

  v_status := coalesce(v_report #>> '{pilot,status}', 'DRAFT');
  if v_status not in ('LIVE', 'PAUSED', 'COMPLETED') then
    v_status := case
      when v_launch_eligible then 'READY'
      when coalesce((v_progress ->> 'completedScenarios')::integer, 0) > 0
        then 'REHEARSAL'
      when v_automated_blockers = 0 then 'REHEARSAL'
      when nullif(trim(coalesce(v_report #>> '{pilot,objective}', '')), '') is not null
        then 'DATA_PREPARATION'
      else 'DRAFT'
    end;
  end if;

  v_next_action := case
    when v_automated_blockers > 0
      then 'Resolve the blocking configuration or data-readiness checks.'
    when v_manual_blockers > 0
      then 'Complete the remaining manual readiness confirmations with evidence.'
    when v_rehearsal_blockers > 0
      then 'Complete two consecutive clean passes for every rehearsal scenario.'
    when v_launch_eligible and v_status = 'READY'
      then 'Review the launch summary and confirm the pilot start.'
    when v_status = 'LIVE'
      then 'Run the first session and complete the next weekly pilot review.'
    when v_status = 'PAUSED'
      then 'Resolve the pause reason before resuming the pilot.'
    when v_status = 'COMPLETED'
      then 'Review the final evidence and commercial next step.'
    else 'Review the current pilot stage.'
  end;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', profile.id,
        'name', coalesce(nullif(trim(profile.full_name), ''), 'Site user'),
        'role', lower(
          replace(
            replace(coalesce(access.app_role, profile.role, ''), '-', '_'),
            ' ',
            '_'
          )
        )
      )
      order by coalesce(nullif(trim(profile.full_name), ''), 'Site user')
    ),
    '[]'::jsonb
  )
  into v_participants
  from public.user_site_access access
  join public.profiles profile on profile.id = access.user_id
  where access.site_id = p_site_id
    and access.active;

  select coalesce(nullif(trim(owner_profile.full_name), ''), 'Site user')
  into v_owner_name
  from public.profiles owner_profile
  where owner_profile.id = (v_report #>> '{pilot,pilotOwnerUserId}')::uuid;

  select coalesce(nullif(trim(manager_profile.full_name), ''), 'Site user')
  into v_manager_name
  from public.profiles manager_profile
  where manager_profile.id = (v_report #>> '{pilot,managerContactUserId}')::uuid;

  v_report := jsonb_set(v_report, '{reportVersion}', to_jsonb('1.1.0'::text), true);
  v_report := jsonb_set(v_report, '{pilot,status}', to_jsonb(v_status), true);
  v_report := jsonb_set(
    v_report,
    '{pilot,pilotOwnerName}',
    coalesce(to_jsonb(v_owner_name), 'null'::jsonb),
    true
  );
  v_report := jsonb_set(
    v_report,
    '{pilot,managerContactName}',
    coalesce(to_jsonb(v_manager_name), 'null'::jsonb),
    true
  );
  v_report := jsonb_set(
    v_report,
    '{pilot,availableParticipants}',
    v_participants,
    true
  );
  v_report := jsonb_set(v_report, '{rehearsal}', v_progress - 'blockers', true);
  v_report := jsonb_set(v_report, '{readiness,score}', to_jsonb(v_score), true);
  v_report := jsonb_set(
    v_report,
    '{readiness,rehearsalBlockers}',
    to_jsonb(v_rehearsal_blockers),
    true
  );
  v_report := jsonb_set(
    v_report,
    '{readiness,launchEligible}',
    to_jsonb(v_launch_eligible),
    true
  );
  v_report := jsonb_set(
    v_report,
    '{readiness,recommendedNextAction}',
    to_jsonb(v_next_action),
    true
  );

  return v_report;
end;
$function$;

create or replace function public.vorta_update_pilot_configuration(
  p_site_id uuid,
  p_objective text,
  p_planned_start_date date,
  p_planned_end_date date,
  p_known_limitations text default null
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
begin
  if v_actor_user_id is null
    or not public.vorta_can_administer_pilot(p_site_id) then
    return null;
  end if;

  if p_planned_start_date is not null
    and p_planned_end_date is not null
    and p_planned_end_date < p_planned_start_date then
    raise exception 'Pilot end date must be on or after the start date.';
  end if;

  if length(coalesce(p_objective, '')) > 2000 then
    raise exception 'Pilot objective must be 2000 characters or fewer.';
  end if;

  if length(coalesce(p_known_limitations, '')) > 5000 then
    raise exception 'Known limitations must be 5000 characters or fewer.';
  end if;

  v_pilot_id := private.vorta_ensure_pilot_program(p_site_id, v_actor_user_id);

  update private.vorta_pilot_programs
  set objective = nullif(trim(coalesce(p_objective, '')), ''),
      planned_start_date = p_planned_start_date,
      planned_end_date = p_planned_end_date,
      known_limitations = nullif(trim(coalesce(p_known_limitations, '')), ''),
      pilot_owner_user_id = coalesce(pilot_owner_user_id, v_actor_user_id),
      manager_contact_user_id = coalesce(manager_contact_user_id, v_actor_user_id),
      updated_by = v_actor_user_id,
      updated_at = now()
  where id = v_pilot_id;

  return public.vorta_get_pilot_setup(p_site_id);
end;
$function$;

create or replace function public.vorta_update_pilot_participants(
  p_site_id uuid,
  p_pilot_owner_user_id uuid,
  p_manager_contact_user_id uuid
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
begin
  if v_actor_user_id is null
    or not public.vorta_can_administer_pilot(p_site_id) then
    return null;
  end if;

  if not exists (
    select 1
    from public.user_site_access access
    where access.site_id = p_site_id
      and access.user_id = p_pilot_owner_user_id
      and access.active
  ) then
    raise exception 'Pilot owner must have active access to this site.';
  end if;

  if not exists (
    select 1
    from public.user_site_access access
    where access.site_id = p_site_id
      and access.user_id = p_manager_contact_user_id
      and access.active
  ) then
    raise exception 'Maintenance Manager contact must have active access to this site.';
  end if;

  v_pilot_id := private.vorta_ensure_pilot_program(p_site_id, v_actor_user_id);

  update private.vorta_pilot_programs
  set pilot_owner_user_id = p_pilot_owner_user_id,
      manager_contact_user_id = p_manager_contact_user_id,
      updated_by = v_actor_user_id,
      updated_at = now()
  where id = v_pilot_id;

  return public.vorta_get_pilot_setup(p_site_id);
end;
$function$;

create or replace function public.vorta_update_pilot_success_criteria(
  p_site_id uuid,
  p_success_criteria jsonb
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
  v_sanitised jsonb;
begin
  if v_actor_user_id is null
    or not public.vorta_can_administer_pilot(p_site_id) then
    return null;
  end if;

  if jsonb_typeof(p_success_criteria) <> 'array'
    or jsonb_array_length(p_success_criteria) < 1
    or jsonb_array_length(p_success_criteria) > 12 then
    raise exception 'Success criteria must contain between 1 and 12 items.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_success_criteria) criterion
    where nullif(trim(coalesce(criterion ->> 'key', '')), '') is null
      or length(coalesce(criterion ->> 'label', '')) > 120
      or length(coalesce(criterion ->> 'unit', '')) > 40
      or jsonb_typeof(criterion -> 'target') <> 'number'
      or (criterion ->> 'target')::numeric < 0
      or (criterion ->> 'target')::numeric > 100000
  ) then
    raise exception 'Success criteria contain an invalid key, label, unit or target.';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'key', upper(trim(criterion ->> 'key')),
      'label', left(trim(criterion ->> 'label'), 120),
      'target', (criterion ->> 'target')::numeric,
      'unit', left(trim(criterion ->> 'unit'), 40)
    )
    order by ordinal
  )
  into v_sanitised
  from jsonb_array_elements(p_success_criteria)
    with ordinality as item(criterion, ordinal);

  v_pilot_id := private.vorta_ensure_pilot_program(p_site_id, v_actor_user_id);

  update private.vorta_pilot_programs
  set success_criteria = v_sanitised,
      updated_by = v_actor_user_id,
      updated_at = now()
  where id = v_pilot_id;

  return public.vorta_get_pilot_setup(p_site_id);
end;
$function$;

revoke all on function public.vorta_get_pilot_setup(uuid) from public, anon;
revoke all on function public.vorta_update_pilot_configuration(uuid,text,date,date,text) from public, anon;
revoke all on function public.vorta_update_pilot_participants(uuid,uuid,uuid) from public, anon;
revoke all on function public.vorta_update_pilot_success_criteria(uuid,jsonb) from public, anon;

grant execute on function public.vorta_get_pilot_setup(uuid) to authenticated;
grant execute on function public.vorta_update_pilot_configuration(uuid,text,date,date,text) to authenticated;
grant execute on function public.vorta_update_pilot_participants(uuid,uuid,uuid) to authenticated;
grant execute on function public.vorta_update_pilot_success_criteria(uuid,jsonb) to authenticated;

comment on function public.vorta_can_administer_pilot(uuid) is
  'Returns true only for an authorised Vorta or site administrator with active site access.';
comment on function private.vorta_get_pilot_rehearsal_progress(uuid) is
  'Calculates consecutive clean rehearsal passes, resetting progress after any failed, blocked or assisted attempt.';
