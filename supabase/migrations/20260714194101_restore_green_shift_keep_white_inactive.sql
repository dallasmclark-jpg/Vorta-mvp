with target_site as (
  select equipment.site_id
  from public.equipment_assets equipment
  where equipment.equipment_code = 'DEMO-VF-002'
  limit 1
)
update public.maintenance_shift_teams team
set
  code = 'GREEN',
  name = 'Green Shift',
  pattern_type = 'continental',
  cycle_offset = 4,
  active = true,
  updated_at = now()
from target_site target
where team.site_id = target.site_id
  and team.code = 'WHITE'
  and exists (
    select 1
    from public.maintenance_shift_team_members member
    where member.team_id = team.id
  );

with green_team as (
  select
    team.site_id,
    team.reference_date
  from public.maintenance_shift_teams team
  where team.site_id = (
    select equipment.site_id
    from public.equipment_assets equipment
    where equipment.equipment_code = 'DEMO-VF-002'
    limit 1
  )
    and team.code = 'GREEN'
  limit 1
)
insert into public.maintenance_shift_teams (
  site_id,
  code,
  name,
  pattern_type,
  cycle_offset,
  reference_date,
  active
)
select
  green.site_id,
  'WHITE',
  'White Shift',
  'continental',
  0,
  green.reference_date,
  false
from green_team green
on conflict (site_id, code)
do update set
  name = excluded.name,
  pattern_type = excluded.pattern_type,
  cycle_offset = excluded.cycle_offset,
  reference_date = excluded.reference_date,
  active = false,
  updated_at = now();

update public.operators operator
set
  shift = team.name,
  updated_at = now()
from public.maintenance_shift_teams team
where operator.shift_team_id = team.id
  and team.code = 'GREEN'
  and operator.shift <> team.name;

with target_equipment as (
  select equipment.id
  from public.equipment_assets equipment
  where equipment.equipment_code = 'DEMO-VF-002'
  limit 1
)
update public.operator_equipment_assignments assignment
set
  notes = replace(
    coalesce(assignment.notes, ''),
    'White Shift',
    'Green Shift'
  ),
  updated_at = now()
from target_equipment target
where assignment.equipment_id = target.id;

create or replace function public.vorta_get_equipment_operator_capabilities(
  p_equipment_id uuid
)
returns table (
  assignment_id uuid,
  operator_id uuid,
  operator_name text,
  job_title text,
  operator_level integer,
  area text,
  line text,
  shift_name text,
  team_leader_name text,
  role_on_equipment text,
  is_primary boolean,
  equipment_competency_level integer,
  assignment_status text,
  am_step integer,
  target_am_step integer,
  am_validation_status text,
  am_authority text,
  permitted_activities text[],
  validation_evidence text,
  validated_at timestamptz,
  valid_until date,
  notes text,
  career_path_id uuid,
  career_path_name text,
  career_target_role text,
  career_readiness_score numeric,
  validated_am_skill_count integer,
  am_training_gap_count integer
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  if not private.vorta_rls_has_equipment_access(
    p_equipment_id,
    false
  ) then
    return;
  end if;

  return query
  select
    assignment.id as assignment_id,
    operator.id as operator_id,
    operator.display_name as operator_name,
    operator.job_title,
    operator.operator_level,
    operator.area,
    operator.line,
    coalesce(team.name, operator.shift) as shift_name,
    operator.team_leader_name,
    assignment.role_on_equipment,
    assignment.is_primary,
    assignment.competency_level as equipment_competency_level,
    assignment.assignment_status,
    assignment.am_step::integer,
    assignment.target_am_step::integer,
    assignment.am_validation_status,
    assignment.am_authority,
    assignment.permitted_activities,
    assignment.validation_evidence,
    assignment.validated_at,
    assignment.valid_until,
    assignment.notes,
    career.id as career_path_id,
    career.path_name as career_path_name,
    career.target_job_role as career_target_role,
    career.readiness_score as career_readiness_score,
    am_skills.validated_am_skill_count,
    am_skills.am_training_gap_count
  from public.operator_equipment_assignments assignment
  join public.operators operator
    on operator.id = assignment.operator_id
  left join public.maintenance_shift_teams team
    on team.id = operator.shift_team_id
  left join lateral (
    select
      path.id,
      path.path_name,
      path.target_job_role,
      path.readiness_score
    from public.operator_career_paths path
    where path.operator_id = operator.id
      and path.status = 'active'
    order by
      path.readiness_score desc nulls last,
      path.updated_at desc
    limit 1
  ) career on true
  left join lateral (
    select
      count(*) filter (
        where skill.category = 'Autonomous Maintenance'
          and skill_assignment.verification_status = 'validated'
          and coalesce(skill_assignment.validated_rating, 0) >= 3
      )::integer as validated_am_skill_count,
      count(*) filter (
        where skill.category = 'Autonomous Maintenance'
          and skill_assignment.training_required
      )::integer as am_training_gap_count
    from public.operator_skill_assignments skill_assignment
    join public.operator_skills skill
      on skill.id = skill_assignment.skill_id
    where skill_assignment.operator_id = operator.id
  ) am_skills on true
  where assignment.equipment_id = p_equipment_id
  order by
    case coalesce(team.code, upper(operator.shift))
      when 'RED' then 1
      when 'GREEN' then 2
      when 'BLUE' then 3
      when 'YELLOW' then 4
      when 'DAYS' then 5
      when 'WHITE' then 6
      else 7
    end,
    assignment.is_primary desc,
    assignment.am_step desc,
    operator.display_name;
end;
$function$;
