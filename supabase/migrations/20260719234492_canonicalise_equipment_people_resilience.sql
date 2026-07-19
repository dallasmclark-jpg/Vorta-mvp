-- Preserve the existing nine-column function contract used by Equipment Skills
-- while feeding the SME score from the canonical required-skill calculation.

create or replace function private.vorta_get_equipment_people_resilience(
  p_equipment_id uuid
)
returns table(
  primary_sme_count integer,
  backup_sme_count integer,
  developing_backup_count integer,
  active_am_operator_count integer,
  rotating_shift_coverage_count integer,
  days_coverage_count integer,
  sme_resilience_score numeric,
  am_coverage_score numeric,
  people_resilience_score numeric
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  with engineer_coverage as (
    select
      count(*) filter (
        where capability.capability_role = 'PRIMARY_SME'
          and capability.capability_status = 'ACTIVE'
          and capability.validation_status = 'VALIDATED'
          and (
            capability.valid_until is null
            or capability.valid_until >= current_date
          )
      )::integer as primary_sme_count,
      count(*) filter (
        where capability.capability_role = 'BACKUP_SME'
          and capability.capability_status = 'ACTIVE'
          and capability.validation_status = 'VALIDATED'
          and (
            capability.valid_until is null
            or capability.valid_until >= current_date
          )
      )::integer as backup_sme_count,
      count(*) filter (
        where capability.capability_role = 'DEVELOPING_BACKUP'
          and capability.capability_status = 'IN_DEVELOPMENT'
      )::integer as developing_backup_count
    from public.equipment_engineer_capabilities capability
    where capability.equipment_id = p_equipment_id
  ),
  operator_coverage as (
    select
      count(*) filter (
        where assignment.assignment_status = 'ACTIVE'
          and assignment.am_step >= 1
          and assignment.am_validation_status = 'VALIDATED'
          and (
            assignment.valid_until is null
            or assignment.valid_until >= current_date
          )
      )::integer as active_am_operator_count,
      count(distinct shift_team.code) filter (
        where assignment.assignment_status = 'ACTIVE'
          and assignment.am_step >= 1
          and assignment.am_validation_status = 'VALIDATED'
          and (
            assignment.valid_until is null
            or assignment.valid_until >= current_date
          )
          and shift_team.code in ('RED', 'GREEN', 'BLUE', 'YELLOW')
      )::integer as rotating_shift_coverage_count,
      count(*) filter (
        where assignment.assignment_status = 'ACTIVE'
          and assignment.am_step >= 1
          and assignment.am_validation_status = 'VALIDATED'
          and (
            assignment.valid_until is null
            or assignment.valid_until >= current_date
          )
          and shift_team.code = 'DAYS'
      )::integer as days_coverage_count
    from public.operator_equipment_assignments assignment
    join public.operators operator
      on operator.id = assignment.operator_id
    left join public.maintenance_shift_teams shift_team
      on shift_team.id = operator.shift_team_id
    where assignment.equipment_id = p_equipment_id
  ),
  skill_resilience as (
    select resilience.skill_resilience_score
    from private.vorta_get_equipment_skill_resilience(
      p_equipment_id,
      current_date
    ) resilience
  ),
  scored as (
    select
      engineer_coverage.*,
      operator_coverage.*,
      greatest(
        case
          when engineer_coverage.primary_sme_count = 0 then 100.0
          when engineer_coverage.backup_sme_count > 0 then 10.0
          when engineer_coverage.developing_backup_count > 0 then 55.0
          else 80.0
        end::numeric,
        coalesce(skill_resilience.skill_resilience_score, 50.0)
      ) as sme_resilience_score,
      case
        when operator_coverage.active_am_operator_count = 0 then 90.0
        when operator_coverage.rotating_shift_coverage_count >= 4 then 10.0
        when operator_coverage.rotating_shift_coverage_count = 3 then 30.0
        when operator_coverage.rotating_shift_coverage_count = 2 then 55.0
        when operator_coverage.rotating_shift_coverage_count = 1 then 75.0
        when operator_coverage.days_coverage_count > 0 then 45.0
        else 90.0
      end::numeric as am_coverage_score
    from engineer_coverage
    cross join operator_coverage
    cross join skill_resilience
  )
  select
    scored.primary_sme_count,
    scored.backup_sme_count,
    scored.developing_backup_count,
    scored.active_am_operator_count,
    scored.rotating_shift_coverage_count,
    scored.days_coverage_count,
    scored.sme_resilience_score,
    scored.am_coverage_score,
    round(
      scored.sme_resilience_score * 0.65
      + scored.am_coverage_score * 0.35,
      1
    ) as people_resilience_score
  from scored;
$function$;

comment on function private.vorta_get_equipment_people_resilience(uuid) is
  'Combines canonical required-skill resilience, declared SME-role resilience and operator AM shift coverage without changing the Equipment Skills contract.';
