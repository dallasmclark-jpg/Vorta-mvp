alter table public.operators
  add column shift_team_id uuid references public.maintenance_shift_teams(id) on delete set null;

create index operators_shift_team_id_idx
  on public.operators (shift_team_id);

with target_site as (
  select equipment.site_id
  from public.equipment_assets equipment
  where equipment.equipment_code = 'DEMO-VF-002'
  limit 1
)
update public.maintenance_shift_teams team
set
  code = 'WHITE',
  name = 'White Shift',
  updated_at = now()
from target_site target
where team.site_id = target.site_id
  and team.code = 'GREEN';

with target_site as (
  select equipment.site_id
  from public.equipment_assets equipment
  where equipment.equipment_code = 'DEMO-VF-002'
  limit 1
),
shift_map(old_shift, team_code) as (
  values
    ('A Shift', 'WHITE'),
    ('B Shift', 'RED'),
    ('C Shift', 'BLUE'),
    ('D Shift', 'YELLOW'),
    ('Days', 'DAYS')
)
update public.operators operator
set
  shift_team_id = team.id,
  shift = team.name,
  updated_at = now()
from target_site target
join shift_map mapping on true
join public.maintenance_shift_teams team
  on team.site_id = target.site_id
 and team.code = mapping.team_code
where operator.site_id = target.site_id
  and operator.shift = mapping.old_shift;

create or replace function private.vorta_validate_operator_shift_team()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_team_site_id uuid;
  v_team_name text;
begin
  if new.shift_team_id is null then
    return new;
  end if;

  select team.site_id, team.name
  into v_team_site_id, v_team_name
  from public.maintenance_shift_teams team
  where team.id = new.shift_team_id
    and team.active;

  if not found then
    raise exception 'Active shift team % does not exist', new.shift_team_id
      using errcode = '23503';
  end if;

  if new.site_id is distinct from v_team_site_id then
    raise exception 'Operator and shift team must belong to the same site'
      using errcode = '23514';
  end if;

  new.shift := v_team_name;
  return new;
end;
$function$;

revoke all on function private.vorta_validate_operator_shift_team()
  from public, anon, authenticated;
grant execute on function private.vorta_validate_operator_shift_team()
  to postgres, service_role;

create trigger operators_shift_team_integrity
before insert or update of site_id, shift_team_id
on public.operators
for each row
execute function private.vorta_validate_operator_shift_team();

with target_equipment as (
  select equipment.id
  from public.equipment_assets equipment
  where equipment.equipment_code = 'DEMO-VF-002'
  limit 1
)
update public.operator_equipment_assignments assignment
set
  notes = replace(
    replace(
      replace(
        replace(
          coalesce(assignment.notes, ''),
          'A Shift',
          'White Shift'
        ),
        'B Shift',
        'Red Shift'
      ),
      'C Shift',
      'Blue Shift'
    ),
    'D Shift',
    'Yellow Shift'
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
      when 'WHITE' then 1
      when 'RED' then 2
      when 'BLUE' then 3
      when 'YELLOW' then 4
      when 'DAYS' then 5
      else 6
    end,
    assignment.is_primary desc,
    assignment.am_step desc,
    operator.display_name;
end;
$function$;
