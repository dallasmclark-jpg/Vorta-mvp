create temporary table temp_equipment_engineer_candidates
on commit drop
as
with candidate_scores as (
  select
    equipment.id as equipment_id,
    equipment.equipment_code,
    equipment.name as equipment_name,
    equipment.criticality as equipment_criticality,
    engineer.id as engineer_id,
    engineer.full_name,
    engineer.discipline,
    count(requirement.id) filter (
      where skill.verification_status = 'validated'
        and coalesce(skill.validated_rating, skill.manager_rating, 0) >= requirement.required_level
    )::integer as matched_required_skills,
    count(requirement.id)::integer as required_skill_total,
    count(requirement.id) filter (
      where lower(requirement.criticality) = 'critical'
    )::integer as critical_skill_total,
    count(requirement.id) filter (
      where lower(requirement.criticality) = 'critical'
        and skill.verification_status = 'validated'
        and coalesce(skill.validated_rating, skill.manager_rating, 0) >= requirement.required_level
    )::integer as matched_critical_skills,
    coalesce(
      max(coalesce(skill.validated_rating, skill.manager_rating, skill.self_rating, 0)),
      0
    )::integer as highest_rating,
    case
      when equipment.equipment_type ilike any (
        array[
          '%HVAC%',
          '%autoclave%',
          '%washer%',
          '%bioreactor%',
          '%CIP%',
          '%process skid%',
          '%chromatography%',
          '%clean utility%',
          '%pure steam%'
        ]
      ) then case
        when engineer.discipline ilike any (
          array[
            '%Utilities%',
            '%Instrumentation%',
            '%Biologics%',
            '%Bioprocess%',
            '%Validation%'
          ]
        ) then 30
        when engineer.discipline ilike any (
          array['%Electrical%', '%Mechanical%']
        ) then 20
        else 5
      end
      when equipment.equipment_type ilike any (
        array[
          '%vial%',
          '%vision%',
          '%inspection%',
          '%cartoner%',
          '%labeller%',
          '%case packer%',
          '%blister%',
          '%serialisation%',
          '%warehouse management%',
          '%barcode%',
          '%DCS%'
        ]
      ) then case
        when engineer.discipline ilike any (
          array[
            '%Automation%',
            '%Controls%',
            '%Robotics%',
            '%Serialisation%',
            '%Vision%',
            '%Packaging%'
          ]
        ) then 30
        when engineer.discipline ilike any (
          array['%Electrical%', '%Instrumentation%']
        ) then 20
        when engineer.discipline ilike '%Mechanical%' then 15
        else 5
      end
      when equipment.equipment_type ilike any (
        array[
          '%freeze dryer%',
          '%palletiser%',
          '%dock leveller%',
          '%compressor%',
          '%chiller%'
        ]
      ) then case
        when engineer.discipline ilike '%Mechanical%' then 30
        when engineer.discipline ilike any (
          array['%Electrical%', '%Automation%']
        ) then 20
        when engineer.discipline ilike '%Reliability%' then 15
        else 5
      end
      else case
        when engineer.discipline ilike any (
          array[
            '%Electrical%',
            '%Mechanical%',
            '%Automation%',
            '%Instrumentation%'
          ]
        ) then 20
        else 5
      end
    end as discipline_score
  from public.equipment_assets equipment
  join public.engineers engineer
    on engineer.site_id = equipment.site_id
  left join public.equipment_required_skills requirement
    on requirement.equipment_id = equipment.id
  left join public.engineer_skills skill
    on skill.engineer_id = engineer.id
   and skill.skill_id = requirement.skill_id
  group by
    equipment.id,
    equipment.equipment_code,
    equipment.name,
    equipment.criticality,
    equipment.equipment_type,
    engineer.id,
    engineer.full_name,
    engineer.discipline
)
select
  candidate_scores.*,
  row_number() over (
    partition by equipment_id
    order by
      matched_required_skills desc,
      discipline_score desc,
      highest_rating desc,
      full_name
  ) as candidate_rank
from candidate_scores;

insert into public.equipment_engineer_capabilities (
  equipment_id,
  engineer_id,
  capability_role,
  capability_status,
  competency_level,
  practice_authority,
  validation_status,
  specialism,
  evidence_reference,
  valid_from,
  valid_until,
  notes
)
select
  candidate.equipment_id,
  candidate.engineer_id,
  'PRIMARY_SME',
  'ACTIVE',
  case
    when candidate.equipment_criticality in ('critical', 'high') then 5
    else 4
  end,
  'AUTHORISER',
  'VALIDATED',
  candidate.equipment_name || ' subject matter expertise',
  'Validated from equipment skill coverage, discipline fit and manager capability review.',
  current_date - 120,
  current_date + 365,
  'Primary technical escalation point and equipment capability authoriser.'
from temp_equipment_engineer_candidates candidate
where candidate.candidate_rank = 1
  and not exists (
    select 1
    from public.equipment_engineer_capabilities existing
    where existing.equipment_id = candidate.equipment_id
      and existing.capability_role = 'PRIMARY_SME'
      and existing.capability_status = 'ACTIVE'
  )
on conflict (equipment_id, engineer_id) do nothing;

insert into public.equipment_engineer_capabilities (
  equipment_id,
  engineer_id,
  capability_role,
  capability_status,
  competency_level,
  practice_authority,
  validation_status,
  specialism,
  evidence_reference,
  valid_from,
  notes
)
select
  candidate.equipment_id,
  candidate.engineer_id,
  'DEVELOPING_BACKUP',
  'IN_DEVELOPMENT',
  3,
  'SUPERVISED',
  'MANAGER_REVIEW',
  candidate.equipment_name || ' backup capability development',
  'Development candidate selected from skill coverage and discipline fit.',
  current_date,
  'Developing toward independent backup SME authority.'
from temp_equipment_engineer_candidates candidate
where candidate.candidate_rank = 2
  and not exists (
    select 1
    from public.equipment_engineer_capabilities existing
    where existing.equipment_id = candidate.equipment_id
      and existing.capability_role = 'DEVELOPING_BACKUP'
      and existing.capability_status = 'IN_DEVELOPMENT'
  )
on conflict (equipment_id, engineer_id) do nothing;

insert into public.equipment_engineer_capabilities (
  equipment_id,
  engineer_id,
  capability_role,
  capability_status,
  competency_level,
  practice_authority,
  validation_status,
  specialism,
  evidence_reference,
  valid_from,
  valid_until,
  notes
)
select
  candidate.equipment_id,
  candidate.engineer_id,
  'QUALIFIED_SUPPORT',
  'ACTIVE',
  4,
  'INDEPENDENT',
  'VALIDATED',
  candidate.equipment_name || ' qualified support',
  'Validated from equipment skill coverage and manager capability review.',
  current_date - 90,
  current_date + 365,
  'Independent supporting engineer for equipment faults and planned maintenance.'
from temp_equipment_engineer_candidates candidate
where candidate.candidate_rank = 3
  and not exists (
    select 1
    from public.equipment_engineer_capabilities existing
    where existing.equipment_id = candidate.equipment_id
      and existing.capability_role = 'QUALIFIED_SUPPORT'
      and existing.capability_status = 'ACTIVE'
  )
on conflict (equipment_id, engineer_id) do nothing;

with path_source as (
  select
    equipment.id as equipment_id,
    equipment.equipment_code,
    equipment.name as equipment_name,
    equipment.criticality,
    backup.engineer_id,
    backup.competency_level,
    engineer.discipline,
    primary_sme.engineer_id as mentor_engineer_id,
    count(requirement.id)::integer as required_skill_total,
    count(requirement.id) filter (
      where skill.verification_status = 'validated'
        and coalesce(skill.validated_rating, skill.manager_rating, 0) >= requirement.required_level
    )::integer as matched_required_skills,
    count(requirement.id) filter (
      where lower(requirement.criticality) = 'critical'
    )::integer as critical_skill_total,
    count(requirement.id) filter (
      where lower(requirement.criticality) = 'critical'
        and skill.verification_status = 'validated'
        and coalesce(skill.validated_rating, skill.manager_rating, 0) >= requirement.required_level
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
  left join public.engineer_skills skill
    on skill.engineer_id = backup.engineer_id
   and skill.skill_id = requirement.skill_id
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
    path_source.*,
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
  from path_source
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
  case lower(calculated.criticality)
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
        when path.supervised_interventions_completed >= path.supervised_interventions_required
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
