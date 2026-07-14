with ranked_candidates as (
  select
    equipment.id as equipment_id,
    equipment.equipment_code,
    equipment.name as equipment_name,
    lower(coalesce(equipment.criticality, 'medium')) as criticality,
    assignment.operator_id,
    assignment.am_step,
    greatest(
      assignment.am_step + 1,
      coalesce(assignment.target_am_step, assignment.am_step + 1)
    ) as target_am_step,
    assignment.assignment_status,
    operator.job_title,
    operator.operator_level,
    operator.promotion_readiness_score,
    primary_sme.engineer_id as mentor_engineer_id,
    row_number() over (
      partition by equipment.id
      order by
        case
          when assignment.assignment_status = 'IN_DEVELOPMENT' then 0
          else 1
        end,
        assignment.am_step,
        operator.promotion_readiness_score nulls first,
        operator.display_name
    ) as candidate_rank
  from public.equipment_assets equipment
  join public.operator_equipment_assignments assignment
    on assignment.equipment_id = equipment.id
  join public.operators operator
    on operator.id = assignment.operator_id
  join public.equipment_engineer_capabilities primary_sme
    on primary_sme.equipment_id = equipment.id
   and primary_sme.capability_role = 'PRIMARY_SME'
   and primary_sme.capability_status = 'ACTIVE'
  where equipment.site_id = '11000000-0000-0000-0000-000000000001'::uuid
),
selected as (
  select
    candidate.*,
    round(
      least(
        85,
        greatest(
          30,
          25
          + candidate.am_step * 13
          + coalesce(candidate.promotion_readiness_score, 40) * 0.25
        )
      ),
      0
    ) as calculated_readiness
  from ranked_candidates candidate
  where candidate.candidate_rank = 1
)
insert into public.operator_career_paths (
  operator_id,
  current_job_role,
  current_level,
  target_job_role,
  target_level,
  path_name,
  readiness_score,
  estimated_timeframe,
  status,
  equipment_id,
  target_capability_role,
  current_am_step,
  target_am_step,
  supervised_routines_required,
  supervised_routines_completed,
  evidence_items_required,
  evidence_items_completed,
  expected_risk_reduction,
  target_completion_date,
  development_summary,
  mentor_engineer_id
)
select
  selected.operator_id,
  selected.job_title,
  selected.operator_level,
  selected.equipment_name || ' AM Step ' || selected.target_am_step,
  least(selected.operator_level + 1, 4),
  selected.equipment_code || ' AM Step ' || selected.target_am_step || ' Development',
  selected.calculated_readiness,
  case
    when selected.calculated_readiness >= 70 then '6-8 weeks'
    when selected.calculated_readiness >= 55 then '8-12 weeks'
    else '3-4 months'
  end,
  'active',
  selected.equipment_id,
  'AM_STEP',
  selected.am_step,
  least(selected.target_am_step, 5),
  case when selected.criticality = 'critical' then 3 else 2 end,
  case when selected.am_step >= 2 then 1 else 0 end,
  2,
  case when selected.am_step >= 2 then 1 else 0 end,
  case selected.criticality
    when 'critical' then 8.0
    when 'high' then 6.0
    when 'medium' then 4.0
    else 2.0
  end,
  current_date + case
    when selected.calculated_readiness >= 70 then 56
    when selected.calculated_readiness >= 55 then 84
    else 120
  end,
  'Progress from AM Step '
    || selected.am_step
    || ' to AM Step '
    || least(selected.target_am_step, 5)
    || ' on '
    || selected.equipment_name
    || '. Complete the equipment AM standard, supervised routine evidence and supervisor validation.',
  selected.mentor_engineer_id
from selected
where not exists (
  select 1
  from public.operator_career_paths existing
  where existing.operator_id = selected.operator_id
    and existing.equipment_id = selected.equipment_id
    and existing.target_capability_role = 'AM_STEP'
    and existing.status = 'active'
);
