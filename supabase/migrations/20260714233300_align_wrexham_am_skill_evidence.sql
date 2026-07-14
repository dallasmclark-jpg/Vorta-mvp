create temporary table temp_wrexham_operator_am_targets
on commit drop
as
select
  assignment.operator_id,
  max(assignment.am_step)::integer as current_am_step,
  max(coalesce(assignment.target_am_step, assignment.am_step))::integer as target_am_step
from public.operator_equipment_assignments assignment
join public.equipment_assets equipment on equipment.id = assignment.equipment_id
where equipment.site_id = '11000000-0000-0000-0000-000000000001'::uuid
group by assignment.operator_id;

with am_skills as (
  select
    skill.id,
    skill.name,
    coalesce(
      substring(skill.subcategory from 'Step ([0-7])')::integer,
      substring(skill.name from '^AM Step ([0-7])')::integer
    ) as am_step
  from public.operator_skills skill
  where skill.category = 'Autonomous Maintenance'
),
validated_targets as (
  select
    target.operator_id,
    target.current_am_step,
    skill.id as skill_id,
    skill.name as skill_name,
    skill.am_step
  from temp_wrexham_operator_am_targets target
  join am_skills skill
    on skill.am_step between 1 and target.current_am_step
)
update public.operator_skill_assignments assignment
set
  self_rating = greatest(coalesce(assignment.self_rating, 0), 4),
  supervisor_rating = greatest(coalesce(assignment.supervisor_rating, 0), 4),
  validated_rating = greatest(coalesce(assignment.validated_rating, 0), 4),
  target_rating = greatest(coalesce(assignment.target_rating, 0), 4),
  confidence_score = greatest(coalesce(assignment.confidence_score, 0), 82),
  years_experience = greatest(coalesce(assignment.years_experience, 0), 1),
  last_used_date = current_date,
  evidence = 'Validated AM Step evidence linked to current Wrexham equipment capability assignments.',
  expiry_date = current_date + 365,
  verified_at = coalesce(assignment.verified_at, now() - interval '45 days'),
  verification_status = 'validated',
  training_required = false,
  priority_level = 'medium',
  notes = 'Equipment-specific AM capability verified and aligned to the Skills Matrix.',
  updated_at = now()
from validated_targets target
where assignment.operator_id = target.operator_id
  and assignment.skill_id = target.skill_id;

with am_skills as (
  select
    skill.id,
    skill.name,
    coalesce(
      substring(skill.subcategory from 'Step ([0-7])')::integer,
      substring(skill.name from '^AM Step ([0-7])')::integer
    ) as am_step
  from public.operator_skills skill
  where skill.category = 'Autonomous Maintenance'
),
validated_targets as (
  select
    target.operator_id,
    skill.id as skill_id,
    skill.name as skill_name,
    skill.am_step
  from temp_wrexham_operator_am_targets target
  join am_skills skill
    on skill.am_step between 1 and target.current_am_step
)
insert into public.operator_skill_assignments (
  operator_id,
  skill_id,
  self_rating,
  supervisor_rating,
  validated_rating,
  target_rating,
  confidence_score,
  years_experience,
  last_used_date,
  evidence,
  expiry_date,
  verified_at,
  verification_status,
  training_required,
  priority_level,
  notes
)
select
  target.operator_id,
  target.skill_id,
  4,
  4,
  4,
  4,
  86,
  1.5,
  current_date,
  'Validated ' || target.skill_name || ' evidence linked to current Wrexham equipment capability.',
  current_date + 365,
  now() - interval '45 days',
  'validated',
  false,
  'medium',
  'Equipment-specific AM capability verified and aligned to the Skills Matrix.'
from validated_targets target
where not exists (
  select 1
  from public.operator_skill_assignments existing
  where existing.operator_id = target.operator_id
    and existing.skill_id = target.skill_id
);

with am_skills as (
  select
    skill.id,
    skill.name,
    coalesce(
      substring(skill.subcategory from 'Step ([0-7])')::integer,
      substring(skill.name from '^AM Step ([0-7])')::integer
    ) as am_step
  from public.operator_skills skill
  where skill.category = 'Autonomous Maintenance'
),
development_targets as (
  select
    target.operator_id,
    target.current_am_step,
    target.target_am_step,
    skill.id as skill_id,
    skill.name as skill_name
  from temp_wrexham_operator_am_targets target
  join am_skills skill on skill.am_step = target.target_am_step
  where target.target_am_step > target.current_am_step
)
insert into public.operator_skill_assignments (
  operator_id,
  skill_id,
  self_rating,
  supervisor_rating,
  validated_rating,
  target_rating,
  confidence_score,
  years_experience,
  last_used_date,
  evidence,
  verification_status,
  training_required,
  priority_level,
  notes
)
select
  target.operator_id,
  target.skill_id,
  greatest(1, target.current_am_step),
  null,
  null,
  3,
  48,
  0,
  current_date,
  'Development evidence required for ' || target.skill_name || '.',
  'self_assessed',
  true,
  'high',
  'Next AM Step is linked to an active equipment development path.'
from development_targets target
where not exists (
  select 1
  from public.operator_skill_assignments existing
  where existing.operator_id = target.operator_id
    and existing.skill_id = target.skill_id
);
