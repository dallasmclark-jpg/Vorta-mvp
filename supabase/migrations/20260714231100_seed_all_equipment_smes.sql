create or replace function private.vorta_equipment_discipline_fit(
  p_equipment_type text,
  p_discipline text
)
returns integer
language sql
immutable
security definer
set search_path to 'pg_catalog'
as $function$
  select case
    when coalesce(p_equipment_type, '') ilike any (
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
      when coalesce(p_discipline, '') ilike any (
        array[
          '%Utilities%',
          '%Instrumentation%',
          '%Biologics%',
          '%Bioprocess%',
          '%Validation%'
        ]
      ) then 30
      when coalesce(p_discipline, '') ilike any (
        array['%Electrical%', '%Mechanical%']
      ) then 20
      else 5
    end
    when coalesce(p_equipment_type, '') ilike any (
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
      when coalesce(p_discipline, '') ilike any (
        array[
          '%Automation%',
          '%Controls%',
          '%Robotics%',
          '%Serialisation%',
          '%Vision%',
          '%Packaging%'
        ]
      ) then 30
      when coalesce(p_discipline, '') ilike any (
        array['%Electrical%', '%Instrumentation%']
      ) then 20
      when coalesce(p_discipline, '') ilike '%Mechanical%' then 15
      else 5
    end
    when coalesce(p_equipment_type, '') ilike any (
      array[
        '%freeze dryer%',
        '%palletiser%',
        '%dock leveller%',
        '%compressor%',
        '%chiller%'
      ]
    ) then case
      when coalesce(p_discipline, '') ilike '%Mechanical%' then 30
      when coalesce(p_discipline, '') ilike any (
        array['%Electrical%', '%Automation%']
      ) then 20
      when coalesce(p_discipline, '') ilike '%Reliability%' then 15
      else 5
    end
    else case
      when coalesce(p_discipline, '') ilike any (
        array[
          '%Electrical%',
          '%Mechanical%',
          '%Automation%',
          '%Instrumentation%'
        ]
      ) then 20
      else 5
    end
  end;
$function$;

revoke all on function private.vorta_equipment_discipline_fit(text, text)
  from public, anon, authenticated;
grant execute on function private.vorta_equipment_discipline_fit(text, text)
  to postgres, service_role;

create temporary table temp_equipment_engineer_candidates
on commit drop
as
with candidate_scores as (
  select
    equipment.id as equipment_id,
    equipment.name as equipment_name,
    equipment.criticality as equipment_criticality,
    engineer.id as engineer_id,
    engineer.full_name,
    engineer.discipline,
    count(requirement.id) filter (
      where skill.verification_status = 'validated'
        and coalesce(skill.validated_rating, skill.manager_rating, 0)
          >= requirement.required_level
    )::integer as matched_required_skills,
    coalesce(
      max(coalesce(
        skill.validated_rating,
        skill.manager_rating,
        skill.self_rating,
        0
      )),
      0
    )::integer as highest_rating,
    private.vorta_equipment_discipline_fit(
      equipment.equipment_type,
      engineer.discipline
    ) as discipline_score
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
  'Validated from equipment skill coverage, discipline fit and manager review.',
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
  'Validated from equipment skill coverage and manager review.',
  current_date - 90,
  current_date + 365,
  'Independent support for faults and planned maintenance.'
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
