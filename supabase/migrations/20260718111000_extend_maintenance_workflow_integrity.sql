create or replace function public.vorta_get_maintenance_workflow_integrity(p_site_id uuid)
returns table(
  check_key text,
  status text,
  actual_count bigint,
  detail text
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if not public.vorta_has_site_access(p_site_id, false) then
    return;
  end if;

  return query
  with site_context as (
    select site.id, site.organisation_id
    from public.sites site
    where site.id = p_site_id
  ),
  site_equipment as (
    select equipment.id
    from public.equipment_assets equipment
    where equipment.site_id = p_site_id
  ),
  requirement_rows as (
    select
      requirement.id,
      requirement.equipment_id,
      requirement.skill_id,
      requirement.required_level,
      greatest(coalesce(requirement.minimum_qualified_engineers, 1), 1) as minimum_qualified_engineers
    from public.equipment_required_skills requirement
    join site_equipment equipment on equipment.id = requirement.equipment_id
  ),
  candidate_rows as (
    select
      requirement.id as requirement_id,
      engineer.id as engineer_id,
      greatest(
        coalesce(engineer_skill.validated_rating, 0),
        coalesce(engineer_skill.manager_rating, 0),
        coalesce(engineer_skill.self_rating, 0),
        coalesce(capability.competency_level, 0)
      )::integer as rating,
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
      (
        greatest(
          coalesce(engineer_skill.validated_rating, 0),
          coalesce(engineer_skill.manager_rating, 0),
          coalesce(engineer_skill.self_rating, 0)
        ) >= requirement.required_level
        and (
          capability.id is null
          or capability.capability_status is distinct from 'ACTIVE'
          or capability.validation_status is distinct from 'VALIDATED'
          or (capability.valid_until is not null and capability.valid_until < current_date)
        )
      ) as equipment_authorisation_missing
    from requirement_rows requirement
    cross join site_context site
    join public.engineers engineer
      on engineer.site_id = site.id
     and engineer.organisation_id = site.organisation_id
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
  requirement_coverage as (
    select
      requirement.id,
      requirement.equipment_id,
      requirement.minimum_qualified_engineers,
      count(*) filter (where candidate.is_qualified)::integer as qualified_engineer_count
    from requirement_rows requirement
    left join candidate_rows candidate on candidate.requirement_id = requirement.id
    group by
      requirement.id,
      requirement.equipment_id,
      requirement.minimum_qualified_engineers
  ),
  equipment_roles as (
    select
      equipment.id as equipment_id,
      count(*) filter (
        where capability.capability_role = 'PRIMARY_SME'
          and capability.capability_status = 'ACTIVE'
          and capability.validation_status = 'VALIDATED'
          and (capability.valid_until is null or capability.valid_until >= current_date)
      )::integer as primary_sme_count,
      count(*) filter (
        where capability.capability_role = 'BACKUP_SME'
          and capability.capability_status = 'ACTIVE'
          and capability.validation_status = 'VALIDATED'
          and (capability.valid_until is null or capability.valid_until >= current_date)
      )::integer as backup_sme_count
    from site_equipment equipment
    left join public.equipment_engineer_capabilities capability
      on capability.equipment_id = equipment.id
    group by equipment.id
  ),
  equipment_shift_coverage as (
    select
      equipment.id as equipment_id,
      shift_team.id as shift_team_id,
      count(distinct assignment.operator_id) filter (
        where assignment.assignment_status = 'ACTIVE'
          and assignment.am_step >= 1
          and assignment.am_validation_status = 'VALIDATED'
          and (assignment.valid_until is null or assignment.valid_until >= current_date)
      )::integer as validated_am_operator_count
    from site_equipment equipment
    join public.maintenance_shift_teams shift_team
      on shift_team.site_id = p_site_id
     and shift_team.active is true
    left join public.operators operator
      on operator.shift_team_id = shift_team.id
    left join public.operator_equipment_assignments assignment
      on assignment.operator_id = operator.id
     and assignment.equipment_id = equipment.id
    group by equipment.id, shift_team.id
  )
  select
    'due_pm_without_work_order'::text,
    case when count(*) = 0 then 'pass' else 'fail' end,
    count(*)::bigint,
    'Due or overdue preventive-maintenance items require an executable work order.'::text
  from public.preventive_maintenance pm
  where pm.site_id = p_site_id
    and upper(pm.status) in ('OVERDUE', 'DUE SOON')
    and not exists (
      select 1
      from public.work_orders work_order
      where work_order.preventive_maintenance_id = pm.id
    )

  union all

  select
    'awaiting_high_risk_notifications',
    case when count(*) = 0 then 'pass' else 'warning' end,
    count(*)::bigint,
    'High-risk maintenance notifications are still awaiting work-order conversion.'
  from public.maintenance_notifications notification
  where notification.site_id = p_site_id
    and notification.workflow_status = 'AWAITING_WORK_ORDER'
    and notification.risk_points >= 25

  union all

  select
    'completed_order_stale_pm_status',
    case when count(*) = 0 then 'pass' else 'warning' end,
    count(*)::bigint,
    'Completed linked work orders should advance the corresponding PM schedule.'
  from public.preventive_maintenance pm
  join public.work_orders work_order
    on work_order.preventive_maintenance_id = pm.id
  where pm.site_id = p_site_id
    and upper(work_order.status) = 'COMPLETED'
    and work_order.completed_date is not null
    and upper(pm.status) = 'OVERDUE'
    and pm.next_due_date <= work_order.completed_date

  union all

  select
    'equipment_without_required_skills',
    case when count(*) = 0 then 'pass' else 'fail' end,
    count(*)::bigint,
    'Every pilot asset should have at least one mapped maintenance skill requirement.'
  from site_equipment equipment
  where not exists (
    select 1
    from requirement_rows requirement
    where requirement.equipment_id = equipment.id
  )

  union all

  select
    'required_skills_below_minimum',
    case when count(*) = 0 then 'pass' else 'fail' end,
    count(*)::bigint,
    'Required equipment skills must meet their configured minimum validated engineer coverage.'
  from requirement_coverage coverage
  where coverage.qualified_engineer_count < coverage.minimum_qualified_engineers

  union all

  select
    'equipment_without_primary_sme',
    case when count(*) = 0 then 'pass' else 'fail' end,
    count(*)::bigint,
    'Every pilot asset should have an active, validated primary SME.'
  from equipment_roles role
  where role.primary_sme_count = 0

  union all

  select
    'equipment_without_backup_sme',
    case when count(*) = 0 then 'pass' else 'warning' end,
    count(*)::bigint,
    'Assets without an active validated backup SME remain exposed to leave, shift conflict and role movement.'
  from equipment_roles role
  where role.backup_sme_count = 0

  union all

  select
    'skill_verified_equipment_authorisation_missing',
    case when count(*) = 0 then 'pass' else 'warning' end,
    count(*)::bigint,
    'Engineer-skill evidence meets the required level but equipment-specific authorisation is missing, inactive or unvalidated.'
  from candidate_rows candidate
  where candidate.equipment_authorisation_missing

  union all

  select
    'equipment_shift_am_coverage_gap',
    case when count(*) = 0 then 'pass' else 'warning' end,
    count(*)::bigint,
    'Equipment and active shift-team combinations require at least one validated AM operator assignment.'
  from equipment_shift_coverage coverage
  where coverage.validated_am_operator_count = 0;
end;
$function$;

revoke all on function public.vorta_get_maintenance_workflow_integrity(uuid) from public;
grant execute on function public.vorta_get_maintenance_workflow_integrity(uuid) to authenticated;
grant execute on function public.vorta_get_maintenance_workflow_integrity(uuid) to service_role;

comment on function public.vorta_get_maintenance_workflow_integrity(uuid) is
  'Returns access-controlled maintenance execution, equipment skill, SME and AM shift coverage integrity checks for a site.';
