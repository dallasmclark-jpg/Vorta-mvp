create or replace function public.vorta_get_capability_reconciliation_report(
  p_site_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_result jsonb;
begin
  if not public.vorta_has_site_access(p_site_id, false) then
    return null;
  end if;

  with equipment_data as (
    select
      equipment.id,
      equipment.equipment_code,
      equipment.name,
      equipment.area,
      lower(coalesce(equipment.criticality, 'medium')) as equipment_criticality,
      coalesce(risk.risk_score::numeric, risk.operational_risk_score, 0::numeric) as equipment_risk_score,
      showcase.required_skills,
      showcase.engineers,
      showcase.operators,
      showcase.shift_coverage
    from public.equipment_assets equipment
    left join public.equipment_risk_profiles risk
      on risk.equipment_id = equipment.id
    cross join lateral public.vorta_get_equipment_skills_showcase(equipment.id) showcase
    where equipment.site_id = p_site_id
  ),
  active_shifts as (
    select shift_team.code
    from public.maintenance_shift_teams shift_team
    where shift_team.site_id = p_site_id
      and shift_team.active is true
  ),
  people as (
    select
      equipment.id as equipment_id,
      primary_sme.value as primary_sme,
      backup_sme.value as backup_sme,
      candidate.value as candidate
    from equipment_data equipment
    left join lateral (
      select item.value
      from jsonb_array_elements(equipment.engineers) item(value)
      where item.value->>'capability_role' = 'PRIMARY_SME'
        and item.value->>'capability_status' = 'ACTIVE'
        and item.value->>'validation_status' = 'VALIDATED'
        and (
          nullif(item.value->>'valid_until', '') is null
          or (item.value->>'valid_until')::date >= current_date
        )
      order by coalesce((item.value->>'competency_level')::numeric, 0) desc
      limit 1
    ) primary_sme on true
    left join lateral (
      select item.value
      from jsonb_array_elements(equipment.engineers) item(value)
      where item.value->>'capability_role' = 'BACKUP_SME'
        and item.value->>'capability_status' = 'ACTIVE'
        and item.value->>'validation_status' = 'VALIDATED'
        and (
          nullif(item.value->>'valid_until', '') is null
          or (item.value->>'valid_until')::date >= current_date
        )
      order by coalesce((item.value->>'competency_level')::numeric, 0) desc
      limit 1
    ) backup_sme on true
    left join lateral (
      select item.value
      from jsonb_array_elements(equipment.engineers) item(value)
      where item.value->>'capability_role' not in ('PRIMARY_SME', 'BACKUP_SME')
      order by
        case item.value->>'validation_status'
          when 'VALIDATED' then 1
          when 'MANAGER_REVIEW' then 2
          else 3
        end,
        coalesce((item.value->>'competency_level')::numeric, 0) desc,
        item.value->>'engineer_name'
      limit 1
    ) candidate on true
  ),
  shift_gaps as (
    select
      equipment.id as equipment_id,
      count(*)::integer as gap_count,
      jsonb_agg(shift_item.value order by shift_item.value->>'shiftCode') as affected_shifts
    from equipment_data equipment
    cross join lateral jsonb_array_elements(equipment.shift_coverage) shift_item(value)
    join active_shifts active_shift
      on active_shift.code = shift_item.value->>'shiftCode'
    where coalesce((shift_item.value->>'covered')::boolean, false) is false
    group by equipment.id
  ),
  operator_candidates as (
    select
      equipment.id as equipment_id,
      candidate.value as candidate
    from equipment_data equipment
    join shift_gaps gap on gap.equipment_id = equipment.id
    left join lateral (
      select item.value
      from jsonb_array_elements(equipment.operators) item(value)
      where item.value->>'am_validation_status' in ('IN_TRAINING', 'NOT_ASSESSED')
         or item.value->>'assignment_status' = 'IN_DEVELOPMENT'
      order by
        case item.value->>'am_validation_status'
          when 'IN_TRAINING' then 1
          when 'NOT_ASSESSED' then 2
          else 3
        end,
        coalesce((item.value->>'am_step')::numeric, 0) desc,
        item.value->>'operator_name'
      limit 1
    ) candidate on true
  ),
  skill_actions as (
    select
      'SKILL_COVERAGE'::text as action_type,
      equipment.id,
      equipment.equipment_code,
      equipment.name,
      equipment.area,
      equipment.equipment_criticality,
      equipment.equipment_risk_score,
      skill.value as requirement,
      people.primary_sme,
      people.backup_sme,
      skill.value->'nearest_engineers'->0 as candidate,
      coalesce(gap.affected_shifts, '[]'::jsonb) as affected_shifts,
      30::numeric as severity,
      case lower(coalesce(skill.value->>'criticality', 'medium'))
        when 'critical' then 15
        when 'high' then 10
        when 'medium' then 5
        else 2
      end::numeric as requirement_weight,
      case
        when skill.value->'nearest_engineers'->0 is null then 0
        when coalesce((skill.value->'nearest_engineers'->0->>'rating')::numeric, 0)
          >= coalesce((skill.value->>'required_level')::numeric, 0) then 10
        when coalesce((skill.value->'nearest_engineers'->0->>'rating')::numeric, 0)
          = coalesce((skill.value->>'required_level')::numeric, 0) - 1 then 6
        else 2
      end::numeric as readiness,
      case
        when skill.value->'nearest_engineers'->0 is null
          then 'Source internal or contractor capability for the required skill.'
        when coalesce((skill.value->'nearest_engineers'->0->>'rating')::numeric, 0)
          >= coalesce((skill.value->>'required_level')::numeric, 0)
          then 'Complete equipment-specific validation and evidence for the nearest engineer.'
        else 'Create supervised training and equipment experience to reach the required level, then validate authorisation.'
      end as recommended_action,
      'Maintenance Manager'::text as action_owner,
      format(
        '%s has %s validated engineer(s) against a minimum of %s for %s.',
        equipment.equipment_code,
        coalesce((skill.value->>'qualified_engineer_count')::integer, 0),
        coalesce((skill.value->>'minimum_qualified_engineers')::integer, 1),
        skill.value->>'name'
      ) as rationale,
      to_jsonb(array_remove(array[
        case when skill.value->'nearest_engineers'->0 is null then 'candidate_not_identified' end,
        case
          when skill.value->'nearest_engineers'->0->>'qualification_state'
            in ('SKILL_VERIFIED_EQUIPMENT_AUTHORISATION_MISSING', 'DEVELOPING')
          then 'equipment_authorisation_or_validation'
        end,
        case
          when coalesce((skill.value->'nearest_engineers'->0->>'rating')::numeric, 0)
            < coalesce((skill.value->>'required_level')::numeric, 0)
          then 'required_skill_level'
        end
      ]::text[], null)) as missing_evidence
    from equipment_data equipment
    join people on people.equipment_id = equipment.id
    cross join lateral jsonb_array_elements(equipment.required_skills) skill(value)
    left join shift_gaps gap on gap.equipment_id = equipment.id
    where coalesce((skill.value->>'validation_gap')::integer, 0) > 0
  ),
  backup_actions as (
    select
      'BACKUP_SME_DEVELOPMENT'::text as action_type,
      equipment.id,
      equipment.equipment_code,
      equipment.name,
      equipment.area,
      equipment.equipment_criticality,
      equipment.equipment_risk_score,
      limiting.value as requirement,
      people.primary_sme,
      people.backup_sme,
      people.candidate,
      coalesce(gap.affected_shifts, '[]'::jsonb) as affected_shifts,
      22::numeric as severity,
      10::numeric as requirement_weight,
      case
        when people.candidate is null then 0
        when coalesce((people.candidate->>'required_skill_total')::numeric, 0) > 0
          and coalesce((people.candidate->>'required_skill_matches')::numeric, 0)
            >= coalesce((people.candidate->>'required_skill_total')::numeric, 0)
          then 10
        else 4
      end::numeric as readiness,
      case
        when people.candidate is null
          then 'Source internal or contractor backup capability for this asset.'
        when people.candidate->>'validation_status' = 'VALIDATED'
          and people.candidate->>'capability_status' = 'ACTIVE'
          and coalesce((people.candidate->>'required_skill_total')::numeric, 0) > 0
          and coalesce((people.candidate->>'required_skill_matches')::numeric, 0)
            >= coalesce((people.candidate->>'required_skill_total')::numeric, 0)
          then 'Designate the selected qualified engineer as the validated backup SME.'
        else 'Complete the selected engineer''s limiting skills, evidence and manager validation, then designate backup SME.'
      end as recommended_action,
      'Maintenance Manager'::text as action_owner,
      format(
        '%s has a primary SME but no active validated backup; the nearest candidate matches %s of %s mapped requirements.',
        equipment.equipment_code,
        coalesce((people.candidate->>'required_skill_matches')::numeric, 0),
        coalesce((people.candidate->>'required_skill_total')::numeric, 0)
      ) as rationale,
      to_jsonb(array_remove(array[
        case when people.candidate is null then 'candidate_not_identified' end,
        case
          when people.candidate is not null
            and coalesce((people.candidate->>'required_skill_matches')::numeric, 0)
              < coalesce((people.candidate->>'required_skill_total')::numeric, 0)
          then 'equipment_skill_coverage'
        end,
        case
          when people.candidate is not null
            and coalesce(people.candidate->>'validation_status', '') <> 'VALIDATED'
          then 'equipment_validation'
        end,
        case
          when people.candidate is not null
            and nullif(people.candidate->>'evidence_reference', '') is null
          then 'validation_evidence'
        end
      ]::text[], null)) as missing_evidence
    from equipment_data equipment
    join people on people.equipment_id = equipment.id
    left join lateral (
      select item.value
      from jsonb_array_elements(equipment.required_skills) item(value)
      order by
        case lower(coalesce(item.value->>'criticality', 'medium'))
          when 'critical' then 1
          when 'high' then 2
          when 'medium' then 3
          else 4
        end,
        greatest(
          coalesce((item.value->>'required_level')::numeric, 0)
          - coalesce((item.value->'nearest_engineers'->0->>'rating')::numeric, 0),
          0
        ) desc,
        item.value->>'name'
      limit 1
    ) limiting on true
    left join shift_gaps gap on gap.equipment_id = equipment.id
    where people.backup_sme is null
  ),
  am_actions as (
    select
      'AM_SHIFT_COVERAGE'::text as action_type,
      equipment.id,
      equipment.equipment_code,
      equipment.name,
      equipment.area,
      equipment.equipment_criticality,
      equipment.equipment_risk_score,
      jsonb_build_object(
        'skill_id', null,
        'name', 'Autonomous Maintenance Step 1',
        'criticality', 'high',
        'required_level', 1,
        'qualified_engineer_count', null,
        'minimum_qualified_engineers', gap.gap_count
      ) as requirement,
      people.primary_sme,
      people.backup_sme,
      operator.candidate,
      gap.affected_shifts,
      (18 + least(gap.gap_count * 3, 15))::numeric as severity,
      4::numeric as requirement_weight,
      case when operator.candidate is null then 0 else 4 end::numeric as readiness,
      case
        when operator.candidate is null
          then 'Nominate and train an operator on each uncovered shift to validated AM Step 1.'
        when operator.candidate->>'am_validation_status' = 'IN_TRAINING'
          then 'Complete the selected operator''s AM assessment and validation.'
        else 'Assign or assess the selected operator and validate AM Step 1 on this asset.'
      end as recommended_action,
      'Production Manager / Maintenance Manager'::text as action_owner,
      format(
        '%s has %s active shift-team combination(s) without a validated AM operator.',
        equipment.equipment_code,
        gap.gap_count
      ) as rationale,
      to_jsonb(array_remove(array[
        case when operator.candidate is null then 'candidate_not_identified' end,
        case
          when operator.candidate is not null
            and coalesce(operator.candidate->>'am_validation_status', '') <> 'VALIDATED'
          then 'am_validation'
        end,
        case
          when operator.candidate is not null
            and nullif(operator.candidate->>'validation_evidence', '') is null
          then 'validation_evidence'
        end
      ]::text[], null)) as missing_evidence
    from equipment_data equipment
    join people on people.equipment_id = equipment.id
    join shift_gaps gap on gap.equipment_id = equipment.id
    left join operator_candidates operator on operator.equipment_id = equipment.id
    where gap.gap_count > 0
  ),
  actions as (
    select * from skill_actions
    union all
    select * from backup_actions
    union all
    select * from am_actions
  ),
  ranked as (
    select
      row_number() over (
        order by priority_score desc, equipment_risk_score desc, equipment_code, action_type
      ) as priority_rank,
      scored.*
    from (
      select
        action.*,
        least(
          100::numeric,
          round(
            action.severity
            + action.requirement_weight
            + action.readiness
            + case action.equipment_criticality
                when 'critical' then 25
                when 'high' then 18
                when 'medium' then 10
                else 5
              end
            + least(greatest(action.equipment_risk_score, 0), 100) * 0.25,
            1
          )
        ) as priority_score
      from actions action
    ) scored
  ),
  limited as (
    select *
    from ranked
    where priority_rank <= v_limit
  ),
  action_json as (
    select
      limited.priority_rank,
      jsonb_build_object(
        'priorityRank', limited.priority_rank,
        'actionId', lower(limited.action_type) || ':' || limited.id::text
          || case when limited.action_type = 'SKILL_COVERAGE'
             then ':' || coalesce(limited.requirement->>'skill_id', '')
             else '' end,
        'actionType', limited.action_type,
        'priorityScore', limited.priority_score,
        'priorityLevel', case
          when limited.priority_score >= 75 then 'CRITICAL'
          when limited.priority_score >= 55 then 'HIGH'
          when limited.priority_score >= 35 then 'MEDIUM'
          else 'LOW'
        end,
        'equipment', jsonb_build_object(
          'id', limited.id,
          'code', limited.equipment_code,
          'name', limited.name,
          'area', limited.area,
          'criticality', limited.equipment_criticality,
          'riskScore', limited.equipment_risk_score
        ),
        'requirement', jsonb_build_object(
          'skillId', limited.requirement->>'skill_id',
          'skillName', limited.requirement->>'name',
          'criticality', limited.requirement->>'criticality',
          'requiredLevel', limited.requirement->'required_level',
          'currentQualifiedCount', limited.requirement->'qualified_engineer_count',
          'minimumQualified', limited.requirement->'minimum_qualified_engineers'
        ),
        'primarySme', case when limited.primary_sme is null then null else jsonb_build_object(
          'id', limited.primary_sme->>'engineer_id',
          'name', limited.primary_sme->>'engineer_name'
        ) end,
        'backupSme', case when limited.backup_sme is null then null else jsonb_build_object(
          'id', limited.backup_sme->>'engineer_id',
          'name', limited.backup_sme->>'engineer_name'
        ) end,
        'candidate', case when limited.candidate is null then null else jsonb_build_object(
          'personType', case when limited.action_type = 'AM_SHIFT_COVERAGE'
            then 'OPERATOR' else 'ENGINEER' end,
          'id', coalesce(limited.candidate->>'engineer_id', limited.candidate->>'operator_id'),
          'name', coalesce(limited.candidate->>'engineer_name', limited.candidate->>'operator_name'),
          'currentLevel', coalesce(
            limited.candidate->'rating',
            limited.candidate->'competency_level',
            limited.candidate->'am_step'
          ),
          'requiredSkillMatches', limited.candidate->'required_skill_matches',
          'requiredSkillTotal', limited.candidate->'required_skill_total',
          'status', case
            when limited.action_type = 'AM_SHIFT_COVERAGE'
              then coalesce(limited.candidate->>'am_validation_status', 'DEVELOPING')
            when limited.action_type = 'BACKUP_SME_DEVELOPMENT'
              and coalesce((limited.candidate->>'required_skill_total')::numeric, 0) > 0
              and coalesce((limited.candidate->>'required_skill_matches')::numeric, 0)
                >= coalesce((limited.candidate->>'required_skill_total')::numeric, 0)
              and limited.candidate->>'validation_status' = 'VALIDATED'
              and limited.candidate->>'capability_status' = 'ACTIVE'
              then 'QUALIFIED_VALIDATED'
            when limited.action_type = 'BACKUP_SME_DEVELOPMENT'
              then 'DEVELOPING'
            else coalesce(
              limited.candidate->>'qualification_state',
              limited.candidate->>'validation_status',
              'DEVELOPING'
            )
          end
        ) end,
        'affectedShifts', limited.affected_shifts,
        'missingEvidence', limited.missing_evidence,
        'recommendedAction', limited.recommended_action,
        'actionOwner', limited.action_owner,
        'rationale', limited.rationale
      ) as action
    from limited
  )
  select jsonb_build_object(
    'siteId', p_site_id,
    'generatedAt', statement_timestamp(),
    'scoringModel', jsonb_build_object(
      'description', 'Transparent operational priority score using action severity, requirement criticality, candidate readiness, equipment criticality and current equipment risk.',
      'maximumScore', 100
    ),
    'summary', jsonb_build_object(
      'actionCount', count(*),
      'criticalCount', count(*) filter (where action->>'priorityLevel' = 'CRITICAL'),
      'highCount', count(*) filter (where action->>'priorityLevel' = 'HIGH'),
      'mediumCount', count(*) filter (where action->>'priorityLevel' = 'MEDIUM'),
      'lowCount', count(*) filter (where action->>'priorityLevel' = 'LOW'),
      'backupSmeActions', count(*) filter (where action->>'actionType' = 'BACKUP_SME_DEVELOPMENT'),
      'skillCoverageActions', count(*) filter (where action->>'actionType' = 'SKILL_COVERAGE'),
      'amShiftActions', count(*) filter (where action->>'actionType' = 'AM_SHIFT_COVERAGE')
    ),
    'actions', coalesce(jsonb_agg(action order by priority_rank), '[]'::jsonb)
  )
  into v_result
  from action_json;

  return v_result;
end;
$function$;

revoke all on function public.vorta_get_capability_reconciliation_report(uuid, integer) from public;
grant execute on function public.vorta_get_capability_reconciliation_report(uuid, integer) to authenticated;
grant execute on function public.vorta_get_capability_reconciliation_report(uuid, integer) to service_role;

comment on function public.vorta_get_capability_reconciliation_report(uuid, integer) is
  'Returns an access-controlled ranked capability reconciliation report covering skill, backup SME and active-shift AM actions for a site.';
