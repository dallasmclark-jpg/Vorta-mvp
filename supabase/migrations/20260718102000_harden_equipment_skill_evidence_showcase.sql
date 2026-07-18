create or replace function public.vorta_get_equipment_skills_showcase(p_equipment_id uuid)
returns table(
  equipment_id uuid,
  equipment_code text,
  equipment_name text,
  equipment_type text,
  area text,
  required_skill_count integer,
  primary_sme_count integer,
  backup_sme_count integer,
  developing_backup_count integer,
  active_am_operator_count integer,
  rotating_shift_coverage_count integer,
  rotating_shift_gap_count integer,
  people_resilience_score numeric,
  required_skills jsonb,
  engineers jsonb,
  operators jsonb,
  development_paths jsonb,
  shift_coverage jsonb
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  if not private.vorta_rls_has_equipment_access(p_equipment_id, false) then
    return;
  end if;

  return query
  with equipment_record as (
    select
      equipment.id,
      equipment.site_id,
      site.organisation_id,
      equipment.equipment_code,
      equipment.name,
      equipment.equipment_type,
      equipment.area
    from public.equipment_assets equipment
    join public.sites site on site.id = equipment.site_id
    where equipment.id = p_equipment_id
  ),
  resilience as (
    select *
    from private.vorta_get_equipment_people_resilience(p_equipment_id)
  ),
  requirement_rows as (
    select
      requirement.id,
      requirement.equipment_id,
      requirement.skill_id,
      skill.name,
      skill.category,
      requirement.required_level,
      greatest(coalesce(requirement.minimum_qualified_engineers, 1), 1) as minimum_qualified_engineers,
      requirement.criticality,
      requirement.execution_authority,
      requirement.validation_required,
      requirement.evidence_reference
    from public.equipment_required_skills requirement
    join public.skills skill on skill.id = requirement.skill_id
    where requirement.equipment_id = p_equipment_id
  ),
  candidate_rows as (
    select
      requirement.id as requirement_id,
      engineer.id as engineer_id,
      engineer.full_name as engineer_name,
      engineer.avatar_url,
      engineer.discipline,
      engineer.shift_pattern,
      engineer.availability_status,
      capability.capability_role,
      capability.capability_status,
      capability.validation_status as capability_validation_status,
      capability.valid_until as capability_valid_until,
      greatest(
        coalesce(engineer_skill.validated_rating, 0),
        coalesce(engineer_skill.manager_rating, 0),
        coalesce(engineer_skill.self_rating, 0),
        coalesce(capability.competency_level, 0)
      )::integer as rating,
      coalesce(engineer_skill.years_experience, 0)::numeric as years_experience,
      engineer_skill.verification_status,
      engineer_skill.expiry_date as skill_expiry_date,
      requirement.required_level,
      requirement.minimum_qualified_engineers,
      (
        capability.capability_status = 'ACTIVE'
        and capability.validation_status = 'VALIDATED'
        and (capability.valid_until is null or capability.valid_until >= current_date)
        and (engineer_skill.expiry_date is null or engineer_skill.expiry_date >= current_date)
        and greatest(
          coalesce(engineer_skill.validated_rating, 0),
          coalesce(engineer_skill.manager_rating, 0),
          coalesce(engineer_skill.self_rating, 0),
          coalesce(capability.competency_level, 0)
        ) >= requirement.required_level
      ) as is_qualified,
      case
        when
          capability.capability_status = 'ACTIVE'
          and capability.validation_status = 'VALIDATED'
          and (capability.valid_until is null or capability.valid_until >= current_date)
          and (engineer_skill.expiry_date is null or engineer_skill.expiry_date >= current_date)
          and greatest(
            coalesce(engineer_skill.validated_rating, 0),
            coalesce(engineer_skill.manager_rating, 0),
            coalesce(engineer_skill.self_rating, 0),
            coalesce(capability.competency_level, 0)
          ) >= requirement.required_level
          then 'QUALIFIED_VALIDATED'
        when
          (capability.valid_until is not null and capability.valid_until < current_date)
          or (engineer_skill.expiry_date is not null and engineer_skill.expiry_date < current_date)
          then 'EXPIRED'
        when
          greatest(
            coalesce(engineer_skill.validated_rating, 0),
            coalesce(engineer_skill.manager_rating, 0),
            coalesce(engineer_skill.self_rating, 0)
          ) >= requirement.required_level
          and (
            capability.id is null
            or capability.capability_status is distinct from 'ACTIVE'
            or capability.validation_status is distinct from 'VALIDATED'
          )
          then 'SKILL_VERIFIED_EQUIPMENT_AUTHORISATION_MISSING'
        when
          capability.id is not null
          and capability.capability_status = 'ACTIVE'
          and capability.validation_status = 'VALIDATED'
          and greatest(
            coalesce(engineer_skill.validated_rating, 0),
            coalesce(engineer_skill.manager_rating, 0),
            coalesce(engineer_skill.self_rating, 0),
            coalesce(capability.competency_level, 0)
          ) < requirement.required_level
          then 'EQUIPMENT_EXPERIENCE_SKILL_LEVEL_BELOW_REQUIREMENT'
        else 'DEVELOPING'
      end as qualification_state
    from requirement_rows requirement
    cross join equipment_record equipment
    join public.engineers engineer
      on engineer.site_id = equipment.site_id
     and engineer.organisation_id = equipment.organisation_id
    left join public.equipment_engineer_capabilities capability
      on capability.equipment_id = requirement.equipment_id
     and capability.engineer_id = engineer.id
    left join public.engineer_skills engineer_skill
      on engineer_skill.engineer_id = engineer.id
     and engineer_skill.skill_id = requirement.skill_id
    where capability.id is not null
       or greatest(
            coalesce(engineer_skill.validated_rating, 0),
            coalesce(engineer_skill.manager_rating, 0),
            coalesce(engineer_skill.self_rating, 0)
          ) > 0
  ),
  skill_rows as (
    select
      requirement.id,
      requirement.skill_id,
      requirement.name,
      requirement.category,
      requirement.required_level,
      requirement.minimum_qualified_engineers,
      requirement.criticality,
      requirement.execution_authority,
      requirement.validation_required,
      requirement.evidence_reference,
      count(*) filter (where candidate.is_qualified)::integer as qualified_engineer_count,
      count(*) filter (
        where not candidate.is_qualified
          and candidate.rating > 0
      )::integer as developing_engineer_count,
      greatest(
        requirement.minimum_qualified_engineers
          - count(*) filter (where candidate.is_qualified)::integer,
        0
      )::integer as validation_gap,
      (count(*) filter (where candidate.is_qualified) = 1) as single_point_of_failure,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'engineer_id', qualified.engineer_id,
            'engineer_name', qualified.engineer_name,
            'avatar_url', qualified.avatar_url,
            'discipline', qualified.discipline,
            'shift_pattern', qualified.shift_pattern,
            'availability_status', qualified.availability_status,
            'rating', qualified.rating,
            'years_experience', qualified.years_experience,
            'validation_status', coalesce(qualified.capability_validation_status, qualified.verification_status),
            'capability_role', qualified.capability_role,
            'qualification_state', qualified.qualification_state,
            'capability_valid_until', qualified.capability_valid_until,
            'skill_expiry_date', qualified.skill_expiry_date
          )
          order by
            case qualified.capability_role
              when 'PRIMARY_SME' then 1
              when 'BACKUP_SME' then 2
              when 'QUALIFIED_SUPPORT' then 3
              else 4
            end,
            qualified.rating desc,
            qualified.years_experience desc,
            qualified.engineer_name
        )
        from candidate_rows qualified
        where qualified.requirement_id = requirement.id
          and qualified.is_qualified
      ), '[]'::jsonb) as qualified_engineers,
      coalesce((
        select jsonb_agg(
          to_jsonb(nearest_row)
          order by nearest_row.rating desc,
                   nearest_row.years_experience desc,
                   nearest_row.engineer_name
        )
        from (
          select
            nearest.engineer_id,
            nearest.engineer_name,
            nearest.avatar_url,
            nearest.discipline,
            nearest.shift_pattern,
            nearest.availability_status,
            nearest.rating,
            nearest.years_experience,
            coalesce(nearest.capability_validation_status, nearest.verification_status) as validation_status,
            nearest.capability_role,
            nearest.qualification_state,
            nearest.capability_valid_until,
            nearest.skill_expiry_date
          from candidate_rows nearest
          where nearest.requirement_id = requirement.id
            and not nearest.is_qualified
            and nearest.rating > 0
          order by nearest.rating desc,
                   nearest.years_experience desc,
                   nearest.engineer_name
          limit 3
        ) nearest_row
      ), '[]'::jsonb) as nearest_engineers
    from requirement_rows requirement
    left join candidate_rows candidate on candidate.requirement_id = requirement.id
    group by
      requirement.id,
      requirement.skill_id,
      requirement.name,
      requirement.category,
      requirement.required_level,
      requirement.minimum_qualified_engineers,
      requirement.criticality,
      requirement.execution_authority,
      requirement.validation_required,
      requirement.evidence_reference
  ),
  engineer_rows as (
    select
      to_jsonb(engineer_capability)
      || jsonb_build_object('avatar_url', engineer.avatar_url) as item
    from public.vorta_get_equipment_engineer_capabilities(p_equipment_id) engineer_capability
    join public.engineers engineer on engineer.id = engineer_capability.engineer_id
  ),
  operator_rows as (
    select
      to_jsonb(operator_capability)
      || jsonb_build_object('avatar_url', operator.avatar_url) as item
    from public.vorta_get_equipment_operator_capabilities(p_equipment_id) operator_capability
    join public.operators operator on operator.id = operator_capability.operator_id
  ),
  path_rows as (
    select to_jsonb(development_path) as item
    from public.vorta_get_equipment_development_paths(p_equipment_id) development_path
  ),
  shift_codes as (
    select
      shift_team.id,
      shift_team.code,
      row_number() over (order by shift_team.code)::integer as sort_order
    from public.maintenance_shift_teams shift_team
    cross join equipment_record equipment
    where shift_team.site_id = equipment.site_id
  ),
  shift_rows as (
    select
      shift_code.code,
      count(distinct assignment.operator_id) filter (
        where assignment.assignment_status = 'ACTIVE'
          and assignment.am_step >= 1
          and assignment.am_validation_status = 'VALIDATED'
          and (assignment.valid_until is null or assignment.valid_until >= current_date)
      )::integer as validated_am_operator_count,
      shift_code.sort_order
    from shift_codes shift_code
    left join public.operators operator on operator.shift_team_id = shift_code.id
    left join public.operator_equipment_assignments assignment
      on assignment.operator_id = operator.id
     and assignment.equipment_id = p_equipment_id
    group by shift_code.code, shift_code.sort_order
  )
  select
    equipment_record.id,
    equipment_record.equipment_code,
    equipment_record.name,
    equipment_record.equipment_type,
    equipment_record.area,
    (select count(*)::integer from skill_rows),
    resilience.primary_sme_count,
    resilience.backup_sme_count,
    resilience.developing_backup_count,
    resilience.active_am_operator_count,
    (select count(*) filter (where shift_rows.validated_am_operator_count > 0)::integer from shift_rows),
    (select count(*) filter (where shift_rows.validated_am_operator_count = 0)::integer from shift_rows),
    resilience.people_resilience_score,
    coalesce((
      select jsonb_agg(
        to_jsonb(skill_row)
        order by
          case lower(coalesce(skill_row.criticality, ''))
            when 'critical' then 1
            when 'high' then 2
            when 'medium' then 3
            when 'low' then 4
            else 5
          end,
          skill_row.name
      )
      from skill_rows skill_row
    ), '[]'::jsonb),
    coalesce((select jsonb_agg(item) from engineer_rows), '[]'::jsonb),
    coalesce((select jsonb_agg(item) from operator_rows), '[]'::jsonb),
    coalesce((select jsonb_agg(item) from path_rows), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'shiftCode', shift_row.code,
          'validatedAmOperatorCount', shift_row.validated_am_operator_count,
          'covered', shift_row.validated_am_operator_count > 0
        )
        order by shift_row.sort_order
      )
      from shift_rows shift_row
    ), '[]'::jsonb)
  from equipment_record
  cross join resilience;
end;
$function$;

revoke all on function public.vorta_get_equipment_skills_showcase(uuid) from public;
grant execute on function public.vorta_get_equipment_skills_showcase(uuid) to authenticated;
grant execute on function public.vorta_get_equipment_skills_showcase(uuid) to service_role;

comment on function public.vorta_get_equipment_skills_showcase(uuid) is
  'Returns access-controlled equipment skill, engineer evidence, development and configured shift resilience data.';
