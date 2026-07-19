-- One site-capability qualification contract for required equipment skills.
-- Current-shift labour coverage remains a separate, explicitly time-bound risk.

create or replace function private.vorta_get_equipment_skill_resilience(
  p_equipment_id uuid,
  p_anchor_date date default current_date
)
returns table(
  required_skill_count integer,
  covered_skill_count integer,
  below_minimum_skill_count integer,
  missing_skill_count integer,
  single_person_skill_count integer,
  qualified_engineer_count integer,
  skill_resilience_score numeric
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  with requirements as (
    select
      requirement.skill_id,
      requirement.required_level,
      greatest(
        coalesce(requirement.minimum_qualified_engineers, 1),
        1
      )::integer as minimum_qualified,
      requirement.validation_required,
      lower(coalesce(requirement.execution_authority, 'independent'))
        as execution_authority
    from public.equipment_required_skills requirement
    where requirement.equipment_id = p_equipment_id
  ),
  qualification as (
    select
      requirement.skill_id,
      requirement.minimum_qualified,
      count(distinct engineer.id) filter (
        where engineer.verified
          and capability.id is not null
          and capability.capability_status = 'ACTIVE'
          and capability.validation_status = 'VALIDATED'
          and capability.valid_from <= p_anchor_date
          and (
            capability.valid_until is null
            or capability.valid_until >= p_anchor_date
          )
          and engineer_skill.id is not null
          and greatest(
            coalesce(engineer_skill.validated_rating, 0),
            coalesce(engineer_skill.manager_rating, 0),
            coalesce(engineer_skill.self_rating, 0),
            coalesce(capability.competency_level, 0)
          ) >= requirement.required_level
          and (
            engineer_skill.expiry_date is null
            or engineer_skill.expiry_date >= p_anchor_date
          )
          and lower(coalesce(engineer_skill.verification_status, ''))
            not in ('expired', 'rejected')
          and (
            not requirement.validation_required
            or lower(coalesce(engineer_skill.verification_status, ''))
              in ('validated', 'manager_review')
          )
          and case requirement.execution_authority
            when 'authoriser' then
              lower(coalesce(engineer_skill.practice_authority, '')) = 'authoriser'
              and lower(capability.practice_authority) = 'authoriser'
            when 'independent' then
              lower(coalesce(engineer_skill.practice_authority, ''))
                in ('independent', 'authoriser')
              and lower(capability.practice_authority)
                in ('independent', 'authoriser')
            else true
          end
      )::integer as qualified_count
    from requirements requirement
    join public.equipment_assets equipment
      on equipment.id = p_equipment_id
    join public.engineers engineer
      on engineer.site_id = equipment.site_id
    left join public.engineer_skills engineer_skill
      on engineer_skill.engineer_id = engineer.id
     and engineer_skill.skill_id = requirement.skill_id
    left join public.equipment_engineer_capabilities capability
      on capability.equipment_id = p_equipment_id
     and capability.engineer_id = engineer.id
    group by requirement.skill_id, requirement.minimum_qualified
  ),
  metrics as (
    select
      count(*)::integer as required_skill_count,
      count(*) filter (
        where qualification.qualified_count >= qualification.minimum_qualified
      )::integer as covered_skill_count,
      count(*) filter (
        where qualification.qualified_count < qualification.minimum_qualified
      )::integer as below_minimum_skill_count,
      count(*) filter (
        where qualification.qualified_count = 0
      )::integer as missing_skill_count,
      count(*) filter (
        where qualification.qualified_count = 1
      )::integer as single_person_skill_count,
      coalesce(sum(qualification.qualified_count), 0)::integer
        as qualified_engineer_count
    from qualification
  )
  select
    metrics.required_skill_count,
    metrics.covered_skill_count,
    metrics.below_minimum_skill_count,
    metrics.missing_skill_count,
    metrics.single_person_skill_count,
    metrics.qualified_engineer_count,
    case
      when metrics.required_skill_count = 0 then 50.0::numeric
      when metrics.missing_skill_count > 0 then 100.0::numeric
      when metrics.below_minimum_skill_count > 0 then 75.0::numeric
      when metrics.single_person_skill_count > 0 then 55.0::numeric
      else 10.0::numeric
    end as skill_resilience_score
  from metrics;
$function$;

revoke all on function private.vorta_get_equipment_skill_resilience(uuid, date)
  from public, anon, authenticated;
grant execute on function private.vorta_get_equipment_skill_resilience(uuid, date)
  to service_role;

comment on function private.vorta_get_equipment_skill_resilience(uuid, date) is
  'Canonical site-capability resilience for required equipment skills. Current-shift coverage is reported separately.';
