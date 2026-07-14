with rotating_equipment as (
  select
    equipment.id,
    equipment.equipment_code,
    equipment.name,
    equipment.area,
    equipment.line,
    equipment.criticality,
    equipment.operators_required
  from public.equipment_assets equipment
  where equipment.site_id = '11000000-0000-0000-0000-000000000001'::uuid
    and equipment.area in (
      'Fill-Finish',
      'Inspection',
      'Lyophilisation',
      'Packaging',
      'Sterile Prep'
    )
    and equipment.equipment_code <> 'DEMO-VF-002'
),
candidates as (
  select
    equipment.id as equipment_id,
    equipment.name as equipment_name,
    equipment.criticality,
    equipment.operators_required,
    operator.id as operator_id,
    operator.display_name,
    operator.operator_level,
    operator.promotion_readiness_score,
    team.id as shift_team_id,
    team.name as shift_name,
    case
      when lower(coalesce(operator.line, '')) = lower(coalesce(equipment.line, '')) then 100
      when equipment.line ilike '%line 1%'
        and operator.line ilike '%line 1%' then 80
      when equipment.line ilike '%line 2%'
        and operator.line ilike '%line 2%' then 80
      when equipment.area = operator.area then 50
      else 0
    end as relevance_score
  from rotating_equipment equipment
  join public.operators operator
    on operator.site_id = '11000000-0000-0000-0000-000000000001'::uuid
   and operator.area = equipment.area
   and operator.employment_status = 'active'
  join public.maintenance_shift_teams team
    on team.id = operator.shift_team_id
   and team.code in ('RED', 'GREEN', 'BLUE', 'YELLOW')
   and team.active
),
ranked as (
  select
    candidates.*,
    row_number() over (
      partition by equipment_id, shift_team_id
      order by
        relevance_score desc,
        operator_level desc,
        promotion_readiness_score desc nulls last,
        display_name
    ) as candidate_rank
  from candidates
),
selected as (
  select *
  from ranked
  where candidate_rank <= case
    when lower(coalesce(criticality, '')) = 'critical'
      or coalesce(operators_required, 1) >= 3
      then 2
    else 1
  end
)
insert into public.operator_equipment_assignments (
  operator_id,
  equipment_id,
  role_on_equipment,
  is_primary,
  competency_level,
  assignment_status,
  am_step,
  target_am_step,
  am_validation_status,
  am_authority,
  permitted_activities,
  validation_evidence,
  validated_at,
  valid_until,
  notes
)
select
  selected.operator_id,
  selected.equipment_id,
  case
    when selected.candidate_rank = 1 then 'primary_operator'
    else 'relief_operator'
  end,
  selected.candidate_rank = 1,
  greatest(1, least(selected.operator_level, 4)),
  case
    when selected.operator_level <= 1 then 'IN_DEVELOPMENT'
    else 'ACTIVE'
  end,
  case
    when selected.operator_level <= 1 then 0
    else least(selected.operator_level, 4)
  end,
  case
    when selected.operator_level <= 1 then 1
    else least(selected.operator_level + 1, 5)
  end,
  case
    when selected.operator_level <= 1 then 'IN_TRAINING'
    else 'VALIDATED'
  end,
  case
    when selected.operator_level >= 4 then 'BASIC_INSPECTION'
    when selected.operator_level = 3 then 'CILT_STANDARD'
    when selected.operator_level = 2 then 'CLEAN_INSPECT_TAG'
    else 'OBSERVE'
  end,
  case
    when selected.operator_level >= 4 then array[
      'Initial cleaning and abnormality tagging',
      'CILT checks and contamination countermeasures',
      'Cleaning, inspection and lubrication standards',
      'Basic mechanical, pneumatic and sensor inspection'
    ]::text[]
    when selected.operator_level = 3 then array[
      'Initial cleaning and abnormality tagging',
      'CILT checks and contamination countermeasures',
      'Cleaning, inspection and lubrication standards'
    ]::text[]
    when selected.operator_level = 2 then array[
      'Initial cleaning and abnormality tagging',
      'CILT checks',
      'Contamination source identification and escalation'
    ]::text[]
    else array[
      'Observe initial cleaning',
      'Identify and escalate abnormalities under supervision'
    ]::text[]
  end,
  case
    when selected.operator_level <= 1 then
      'Equipment AM Step 1 training plan opened; supervisor validation remains outstanding.'
    else
      'Validated equipment-specific AM standard, CILT completion and abnormality escalation evidence.'
  end,
  case
    when selected.operator_level <= 1 then null
    else now() - make_interval(days => 30 + selected.operator_level * 10)
  end,
  case
    when selected.operator_level <= 1 then null
    else current_date + 365
  end,
  selected.shift_name || ' AM coverage for ' || selected.equipment_name || '.'
from selected
on conflict (operator_id, equipment_id)
do update set
  role_on_equipment = excluded.role_on_equipment,
  is_primary = excluded.is_primary,
  competency_level = excluded.competency_level,
  assignment_status = excluded.assignment_status,
  am_step = excluded.am_step,
  target_am_step = excluded.target_am_step,
  am_validation_status = excluded.am_validation_status,
  am_authority = excluded.am_authority,
  permitted_activities = excluded.permitted_activities,
  validation_evidence = excluded.validation_evidence,
  validated_at = excluded.validated_at,
  valid_until = excluded.valid_until,
  notes = excluded.notes,
  updated_at = now();
