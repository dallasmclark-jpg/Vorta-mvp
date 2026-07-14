insert into public.engineer_career_path_requirements (
  career_path_id,
  requirement_type,
  skill_id,
  name,
  current_level,
  target_level,
  status,
  priority,
  impact_score,
  evidence_required,
  notes
)
select
  path.id,
  'equipment_skill',
  requirement.skill_id,
  skill_definition.name,
  coalesce(
    engineer_skill.validated_rating,
    engineer_skill.manager_rating,
    engineer_skill.self_rating,
    0
  ),
  requirement.required_level,
  case
    when engineer_skill.verification_status = 'validated'
      and coalesce(
        engineer_skill.validated_rating,
        engineer_skill.manager_rating,
        0
      ) >= requirement.required_level
      then 'completed'
    when coalesce(
      engineer_skill.validated_rating,
      engineer_skill.manager_rating,
      engineer_skill.self_rating,
      0
    ) > 0
      then 'in_progress'
    else 'not_started'
  end,
  case
    when lower(requirement.criticality) = 'critical' then 'high'
    else 'medium'
  end,
  case
    when lower(requirement.criticality) = 'critical' then 10
    when lower(requirement.criticality) = 'high' then 7
    else 4
  end,
  true,
  'Provide equipment-specific evidence and manager validation at the required level.'
from public.engineer_career_paths path
join public.equipment_required_skills requirement
  on requirement.equipment_id = path.equipment_id
join public.skills skill_definition
  on skill_definition.id = requirement.skill_id
left join public.engineer_skills engineer_skill
  on engineer_skill.engineer_id = path.engineer_id
 and engineer_skill.skill_id = requirement.skill_id
where path.equipment_id is not null
  and path.target_capability_role = 'BACKUP_SME'
  and path.status = 'active'
  and not exists (
    select 1
    from public.engineer_career_path_requirements existing
    where existing.career_path_id = path.id
      and existing.requirement_type = 'equipment_skill'
      and existing.skill_id = requirement.skill_id
  );

insert into public.engineer_career_path_requirements (
  career_path_id,
  requirement_type,
  name,
  current_level,
  target_level,
  status,
  priority,
  impact_score,
  evidence_required,
  notes
)
select
  path.id,
  requirement.requirement_type,
  requirement.name,
  requirement.current_level,
  requirement.target_level,
  requirement.status,
  requirement.priority,
  requirement.impact_score,
  true,
  requirement.notes
from public.engineer_career_paths path
cross join lateral (
  values
    (
      'supervised_intervention'::text,
      'Complete supervised equipment interventions'::text,
      path.supervised_interventions_completed::integer,
      path.supervised_interventions_required::integer,
      case
        when path.supervised_interventions_completed
          >= path.supervised_interventions_required
          then 'completed'
        when path.supervised_interventions_completed > 0
          then 'in_progress'
        else 'not_started'
      end::text,
      'high'::text,
      10::numeric,
      'Interventions must cover fault diagnosis, safe execution and post-work verification.'::text
    ),
    (
      'manager_validation'::text,
      'Manager validation for independent backup SME authority'::text,
      0,
      1,
      'not_started'::text,
      'high'::text,
      10::numeric,
      'Final validation confirms independent practice authority and escalation responsibilities.'::text
    )
) as requirement(
  requirement_type,
  name,
  current_level,
  target_level,
  status,
  priority,
  impact_score,
  notes
)
where path.equipment_id is not null
  and path.target_capability_role = 'BACKUP_SME'
  and path.status = 'active'
  and not exists (
    select 1
    from public.engineer_career_path_requirements existing
    where existing.career_path_id = path.id
      and existing.requirement_type = requirement.requirement_type
  );
