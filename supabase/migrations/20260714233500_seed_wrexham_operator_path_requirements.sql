with target_skills as (
  select
    skill.id,
    skill.name,
    coalesce(
      substring(skill.subcategory from 'Step ([0-7])')::integer,
      substring(skill.name from '^AM Step ([0-7])')::integer
    ) as am_step
  from public.operator_skills skill
  where skill.category = 'Autonomous Maintenance'
)
insert into public.operator_career_path_requirements (
  career_path_id,
  requirement_type,
  skill_id,
  name,
  current_level,
  target_level,
  status,
  priority,
  impact_score
)
select
  path.id,
  'am_step_skill',
  skill.id,
  skill.name,
  path.current_am_step,
  path.target_am_step,
  case
    when path.current_am_step >= path.target_am_step then 'completed'
    when path.current_am_step > 0 then 'in_progress'
    else 'not_started'
  end,
  'high',
  10
from public.operator_career_paths path
join public.equipment_assets equipment on equipment.id = path.equipment_id
join target_skills skill on skill.am_step = path.target_am_step
where equipment.site_id = '11000000-0000-0000-0000-000000000001'::uuid
  and path.target_capability_role = 'AM_STEP'
  and path.status = 'active'
  and not exists (
    select 1
    from public.operator_career_path_requirements existing
    where existing.career_path_id = path.id
      and existing.requirement_type = 'am_step_skill'
  );

insert into public.operator_career_path_requirements (
  career_path_id,
  requirement_type,
  name,
  current_level,
  target_level,
  status,
  priority,
  impact_score
)
select
  path.id,
  requirement.requirement_type,
  requirement.name,
  requirement.current_level,
  requirement.target_level,
  requirement.status,
  'high',
  10
from public.operator_career_paths path
join public.equipment_assets equipment on equipment.id = path.equipment_id
cross join lateral (
  values
    (
      'supervised_routine'::text,
      'Complete supervised equipment AM routines'::text,
      path.supervised_routines_completed::integer,
      path.supervised_routines_required::integer,
      case
        when path.supervised_routines_completed >= path.supervised_routines_required
          then 'completed'
        when path.supervised_routines_completed > 0
          then 'in_progress'
        else 'not_started'
      end::text
    ),
    (
      'supervisor_validation'::text,
      'Supervisor validation for the target AM Step'::text,
      0,
      1,
      'not_started'::text
    )
) as requirement(
  requirement_type,
  name,
  current_level,
  target_level,
  status
)
where equipment.site_id = '11000000-0000-0000-0000-000000000001'::uuid
  and path.target_capability_role = 'AM_STEP'
  and path.status = 'active'
  and not exists (
    select 1
    from public.operator_career_path_requirements existing
    where existing.career_path_id = path.id
      and existing.requirement_type = requirement.requirement_type
  );
