with path_source as (
  select
    equipment.id as equipment_id,
    equipment.equipment_code,
    equipment.name as equipment_name,
    lower(coalesce(equipment.criticality, 'medium')) as criticality,
    backup.engineer_id,
    backup.competency_level,
    engineer.discipline,
    primary_sme.engineer_id as mentor_engineer_id,
    count(requirement.id)::integer as required_skill_total,
    count(requirement.id) filter (
      where engineer_skill.verification_status = 'validated'
        and coalesce(
          engineer_skill.validated_rating,
          engineer_skill.manager_rating,
          0
        ) >= requirement.required_level
    )::integer as matched_required_skills,
    count(requirement.id) filter (
      where lower(requirement.criticality) = 'critical'
    )::integer as critical_skill_total,
    count(requirement.id) filter (
      where lower(requirement.criticality) = 'critical'
        and engineer_skill.verification_status = 'validated'
        and coalesce(
          engineer_skill.validated_rating,
          engineer_skill.manager_rating,
          0
        ) >= requirement.required_level
    )::integer as matched_critical_skills
  from public.equipment_assets equipment
  join public.equipment_engineer_capabilities backup
    on backup.equipment_id = equipment.id
   and backup.capability_role = 'DEVELOPING_BACKUP'
   and backup.capability_status = 'IN_DEVELOPMENT'
  join public.engineers engineer
    on engineer.id = backup.engineer_id
  join public.equipment_engineer_capabilities primary_sme
    on primary_sme.equipment_id = equipment.id
   and primary_sme.capability_role = 'PRIMARY_SME'
   and primary_sme.capability_status = 'ACTIVE'
  left join public.equipment_required_skills requirement
    on requirement.equipment_id = equipment.id
  left join public.engineer_skills engineer_skill
    on engineer_skill.engineer_id = backup.engineer_id
   and engineer_skill.skill_id = requirement.skill_id
  group by
    equipment.id,
    equipment.equipment_code,
    equipment.name,
    equipment.criticality,
    backup.engineer_id,
    backup.competency_level,
    engineer.discipline,
    primary_sme.engineer_id
),
calculated as (
  select
    source.*,
    round(
      least(
        85,
        greatest(
          45,
          45
          + case
              when required_skill_total > 0
                then 30.0 * matched_required_skills / required_skill_total
              else 0
            end
          + case
              when critical_skill_total > 0
                then 10.0 * matched_critical_skills / critical_skill_total
              else 0
            end
        )
      ),
      0
    ) as calculated_readiness
  from path_source source
)
insert into public.engineer_career_paths (
  engineer_id,
  current_job_role,
  current_level,
  target_job_role,
  target_level,
  path_name,
  pathway_category,
  readiness_score,
  estimated_timeframe,
  management_track,
  project_track,
  specialist_track,
  leadership_track,
  succession_priority,
  mentor_engineer_id,
  status,
  equipment_id,
  target_capability_role,
  supervised_interventions_required,
  supervised_interventions_completed,
  evidence_items_required,
  evidence_items_completed,
  expected_risk_reduction,
  target_completion_date,
  development_summary
)
select
  calculated.engineer_id,
  calculated.discipline,
  calculated.competency_level,
  calculated.equipment_name || ' Backup SME',
  4,
  calculated.equipment_code || ' Backup SME Development',
  'Equipment Capability',
  calculated.calculated_readiness,
  case
    when calculated.calculated_readiness >= 70 then '8-12 weeks'
    when calculated.calculated_readiness >= 55 then '3-4 months'
    else '4-6 months'
  end,
  false,
  false,
  true,
  false,
  case
    when calculated.criticality in ('critical', 'high') then 'high'
    else 'medium'
  end,
  calculated.mentor_engineer_id,
  'active',
  calculated.equipment_id,
  'BACKUP_SME',
  case when calculated.criticality = 'critical' then 3 else 2 end,
  case when calculated.calculated_readiness >= 65 then 1 else 0 end,
  2,
  case when calculated.calculated_readiness >= 70 then 1 else 0 end,
  case calculated.criticality
    when 'critical' then 10.0
    when 'high' then 7.5
    when 'medium' then 5.0
    else 2.5
  end,
  current_date + case
    when calculated.calculated_readiness >= 70 then 84
    when calculated.calculated_readiness >= 55 then 120
    else 180
  end,
  'Develop from Level '
    || calculated.competency_level
    || ' to Level 4 independent backup SME for '
    || calculated.equipment_name
    || '. Complete outstanding skill validation, supervised interventions and manager sign-off.'
from calculated
where not exists (
  select 1
  from public.engineer_career_paths existing
  where existing.engineer_id = calculated.engineer_id
    and existing.equipment_id = calculated.equipment_id
    and existing.target_capability_role = 'BACKUP_SME'
    and existing.status = 'active'
);
