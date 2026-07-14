create or replace function public.vorta_get_equipment_development_paths(
  p_equipment_id uuid
)
returns table (
  person_type text,
  path_id uuid,
  person_id uuid,
  person_name text,
  shift_name text,
  current_job_role text,
  target_job_role text,
  target_capability_role text,
  current_level integer,
  target_level integer,
  current_am_step integer,
  target_am_step integer,
  readiness_score numeric,
  estimated_timeframe text,
  mentor_name text,
  supervised_completed integer,
  supervised_required integer,
  evidence_completed integer,
  evidence_required integer,
  expected_risk_reduction numeric,
  target_completion_date date,
  development_summary text,
  requirement_count integer,
  completed_requirement_count integer,
  high_priority_remaining integer
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  if not private.vorta_rls_has_equipment_access(p_equipment_id, false) then
    return;
  end if;

  return query
  select
    'ENGINEER'::text,
    path.id,
    engineer.id,
    engineer.full_name,
    coalesce(team.name, engineer.shift_pattern),
    path.current_job_role,
    path.target_job_role,
    path.target_capability_role,
    path.current_level,
    path.target_level,
    null::integer,
    null::integer,
    path.readiness_score,
    path.estimated_timeframe,
    mentor.full_name,
    path.supervised_interventions_completed::integer,
    path.supervised_interventions_required::integer,
    path.evidence_items_completed::integer,
    path.evidence_items_required::integer,
    path.expected_risk_reduction,
    path.target_completion_date,
    path.development_summary,
    coalesce(requirements.requirement_count, 0),
    coalesce(requirements.completed_requirement_count, 0),
    coalesce(requirements.high_priority_remaining, 0)
  from public.engineer_career_paths path
  join public.engineers engineer on engineer.id = path.engineer_id
  left join public.engineers mentor on mentor.id = path.mentor_engineer_id
  left join lateral (
    select shift_team.name
    from public.maintenance_shift_team_members member
    join public.maintenance_shift_teams shift_team on shift_team.id = member.team_id
    where member.engineer_id = engineer.id
      and shift_team.active
      and member.active_from <= current_date
      and (member.active_to is null or member.active_to >= current_date)
    order by member.active_from desc
    limit 1
  ) team on true
  left join lateral (
    select
      count(*)::integer as requirement_count,
      count(*) filter (where requirement.status = 'completed')::integer as completed_requirement_count,
      count(*) filter (
        where requirement.status <> 'completed'
          and requirement.priority = 'high'
      )::integer as high_priority_remaining
    from public.engineer_career_path_requirements requirement
    where requirement.career_path_id = path.id
  ) requirements on true
  where path.equipment_id = p_equipment_id
    and path.status = 'active'

  union all

  select
    'OPERATOR'::text,
    path.id,
    operator.id,
    operator.display_name,
    coalesce(team.name, operator.shift),
    path.current_job_role,
    path.target_job_role,
    path.target_capability_role,
    path.current_level,
    path.target_level,
    path.current_am_step::integer,
    path.target_am_step::integer,
    path.readiness_score,
    path.estimated_timeframe,
    mentor.full_name,
    path.supervised_routines_completed::integer,
    path.supervised_routines_required::integer,
    path.evidence_items_completed::integer,
    path.evidence_items_required::integer,
    path.expected_risk_reduction,
    path.target_completion_date,
    path.development_summary,
    coalesce(requirements.requirement_count, 0),
    coalesce(requirements.completed_requirement_count, 0),
    coalesce(requirements.high_priority_remaining, 0)
  from public.operator_career_paths path
  join public.operators operator on operator.id = path.operator_id
  left join public.engineers mentor on mentor.id = path.mentor_engineer_id
  left join public.maintenance_shift_teams team on team.id = operator.shift_team_id
  left join lateral (
    select
      count(*)::integer as requirement_count,
      count(*) filter (where requirement.status = 'completed')::integer as completed_requirement_count,
      count(*) filter (
        where requirement.status <> 'completed'
          and requirement.priority = 'high'
      )::integer as high_priority_remaining
    from public.operator_career_path_requirements requirement
    where requirement.career_path_id = path.id
  ) requirements on true
  where path.equipment_id = p_equipment_id
    and path.status = 'active'

  order by person_type, readiness_score desc, person_name;
end;
$function$;

revoke all on function public.vorta_get_equipment_development_paths(uuid)
  from public, anon;
grant execute on function public.vorta_get_equipment_development_paths(uuid)
  to authenticated, postgres, service_role;
