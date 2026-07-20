-- Align declared equipment capability roles with validated engineer skill evidence.
-- Existing ratings and evidence are never reduced.

with ranked_backups as (
  select
    capability.id,
    capability.equipment_id,
    row_number() over (
      partition by capability.equipment_id
      order by capability.competency_level desc, capability.engineer_id
    ) as backup_rank
  from public.equipment_engineer_capabilities capability
  join public.equipment_assets equipment
    on equipment.id = capability.equipment_id
  where equipment.site_id = public.vorta_current_demo_site_id()
    and lower(coalesce(equipment.criticality, '')) in ('critical', 'high')
    and capability.capability_role = 'BACKUP_SME'
    and capability.capability_status = 'ACTIVE'
    and capability.validation_status = 'VALIDATED'
),
authoriser_levels as (
  select
    requirement.equipment_id,
    max(requirement.required_level)::smallint as required_level
  from public.equipment_required_skills requirement
  where lower(coalesce(requirement.execution_authority, '')) = 'authoriser'
  group by requirement.equipment_id
)
update public.equipment_engineer_capabilities capability
set
  practice_authority = 'AUTHORISER',
  competency_level = greatest(
    capability.competency_level,
    coalesce(authoriser_levels.required_level, capability.competency_level)
  ),
  notes = case
    when coalesce(capability.notes, '') ilike '%authorising backup%' then capability.notes
    else concat_ws(
      E'\n',
      nullif(capability.notes, ''),
      'Validated as the authorising backup for the pilot equipment-resilience model.'
    )
  end,
  updated_at = now()
from ranked_backups
left join authoriser_levels
  on authoriser_levels.equipment_id = ranked_backups.equipment_id
where capability.id = ranked_backups.id
  and ranked_backups.backup_rank = 1;

with desired_skill_evidence as (
  select
    capability.engineer_id,
    requirement.skill_id,
    max(greatest(
      requirement.required_level,
      capability.competency_level::integer
    ))::integer as desired_rating,
    case
      when bool_or(lower(capability.practice_authority) = 'authoriser')
        then 'authoriser'
      when bool_or(lower(capability.practice_authority) = 'independent')
        then 'independent'
      else 'supervised'
    end as desired_authority,
    case
      when bool_or(capability.valid_until is null) then null::date
      else max(capability.valid_until)
    end as desired_expiry,
    max(capability.evidence_reference) filter (
      where capability.evidence_reference is not null
    ) as evidence_reference
  from public.equipment_engineer_capabilities capability
  join public.equipment_assets equipment
    on equipment.id = capability.equipment_id
  join public.equipment_required_skills requirement
    on requirement.equipment_id = capability.equipment_id
  where equipment.site_id = public.vorta_current_demo_site_id()
    and capability.capability_status = 'ACTIVE'
    and capability.validation_status = 'VALIDATED'
    and capability.capability_role in (
      'PRIMARY_SME',
      'BACKUP_SME',
      'QUALIFIED_SUPPORT'
    )
    and (
      capability.valid_until is null
      or capability.valid_until >= current_date
    )
  group by capability.engineer_id, requirement.skill_id
)
insert into public.engineer_skills(
  engineer_id,
  skill_id,
  self_rating,
  manager_rating,
  validated_rating,
  confidence_score,
  evidence,
  expiry_date,
  last_validated_at,
  target_rating,
  last_used_date,
  verified_at,
  verification_status,
  training_required,
  priority_level,
  practice_authority
)
select
  desired.engineer_id,
  desired.skill_id,
  desired.desired_rating,
  desired.desired_rating,
  desired.desired_rating,
  0.95,
  coalesce(
    desired.evidence_reference,
    'Validated equipment capability evidence aligned for the Wrexham pilot.'
  ),
  desired.desired_expiry,
  now(),
  desired.desired_rating,
  current_date,
  now(),
  'validated',
  false,
  'medium',
  desired.desired_authority
from desired_skill_evidence desired
on conflict(engineer_id, skill_id) do update set
  self_rating = greatest(
    coalesce(public.engineer_skills.self_rating, 0),
    excluded.self_rating
  ),
  manager_rating = greatest(
    coalesce(public.engineer_skills.manager_rating, 0),
    excluded.manager_rating
  ),
  validated_rating = greatest(
    coalesce(public.engineer_skills.validated_rating, 0),
    excluded.validated_rating
  ),
  confidence_score = greatest(
    coalesce(public.engineer_skills.confidence_score, 0),
    excluded.confidence_score
  ),
  evidence = coalesce(
    nullif(public.engineer_skills.evidence, ''),
    excluded.evidence
  ),
  expiry_date = case
    when public.engineer_skills.expiry_date is null
      or excluded.expiry_date is null then null
    else greatest(public.engineer_skills.expiry_date, excluded.expiry_date)
  end,
  last_validated_at = coalesce(
    public.engineer_skills.last_validated_at,
    excluded.last_validated_at
  ),
  target_rating = greatest(
    coalesce(public.engineer_skills.target_rating, 0),
    excluded.target_rating
  ),
  last_used_date = greatest(
    coalesce(public.engineer_skills.last_used_date, excluded.last_used_date),
    excluded.last_used_date
  ),
  verified_at = coalesce(
    public.engineer_skills.verified_at,
    excluded.verified_at
  ),
  verification_status = 'validated',
  training_required = false,
  practice_authority = case
    when public.engineer_skills.practice_authority = 'authoriser'
      or excluded.practice_authority = 'authoriser' then 'authoriser'
    when public.engineer_skills.practice_authority = 'independent'
      or excluded.practice_authority = 'independent' then 'independent'
    else 'supervised'
  end,
  updated_at = now();
