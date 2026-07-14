with day_equipment as (
  select
    equipment.id,
    equipment.name,
    equipment.area,
    equipment.line,
    equipment.operators_required
  from public.equipment_assets equipment
  where equipment.site_id = '11000000-0000-0000-0000-000000000001'::uuid
    and equipment.area in ('Utilities', 'Warehouse')
),
candidates as (
  select
    equipment.id as equipment_id,
    equipment.name as equipment_name,
    equipment.operators_required,
    operator.id as operator_id,
    operator.display_name,
    operator.operator_level,
    operator.promotion_readiness_score,
    case
      when lower(coalesce(operator.line, '')) = lower(coalesce(equipment.line, '')) then 100
      when equipment.area = operator.area then 50
      else 0
    end as relevance_score
  from day_equipment equipment
  join public.operators operator
    on operator.site_id = '11000000-0000-0000-0000-000000000001'::uuid
   and operator.area = equipment.area
   and operator.shift = 'Days'
   and operator.employment_status = 'active'
),
ranked as (
  select
    candidates.*,
    row_number() over (
      partition by equipment_id
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
  where candidate_rank <= greatest(
    2,
    least(coalesce(operators_required, 1), 3)
  )
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
    when selected.candidate_rank = 1 then 'lead_operator'
    else 'relief_operator'
  end,
  selected.candidate_rank = 1,
  greatest(1, least(selected.operator_level, 4)),
  'ACTIVE',
  greatest(1, least(selected.operator_level, 4)),
  least(selected.operator_level + 1, 5),
  'VALIDATED',
  case
    when selected.operator_level >= 4 then 'BASIC_INSPECTION'
    when selected.operator_level = 3 then 'CILT_STANDARD'
    else 'CLEAN_INSPECT_TAG'
  end,
  case
    when selected.operator_level >= 3 then array[
      'Daily condition checks and abnormality escalation',
      'CILT or standard operator care routine',
      'Basic inspection and deviation recording'
    ]::text[]
    else array[
      'Daily condition checks and abnormality escalation',
      'Operator care routine under local standard'
    ]::text[]
  end,
  'Validated equipment-specific operator care standard and abnormality escalation evidence.',
  now() - make_interval(days => 35 + selected.operator_level * 10),
  current_date + 365,
  'Days AM coverage for ' || selected.equipment_name || '.'
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
