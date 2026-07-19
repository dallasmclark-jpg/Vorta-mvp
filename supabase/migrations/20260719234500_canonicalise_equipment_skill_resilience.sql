-- Establish one site-capability qualification contract for equipment skills.
-- Current-shift labour coverage remains a separate, explicitly time-bound risk.

-- Critical and high-risk assets with a declared backup SME need at least one
-- backup who can act as the authorising alternate rather than merely assist.
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

-- Align the skill evidence with the equipment capability roles already shown
-- in the product. Ratings are never reduced and existing evidence is retained.
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

create or replace function private.vorta_get_equipment_people_resilience(
  p_equipment_id uuid
)
returns table(
  primary_sme_count integer,
  backup_sme_count integer,
  developing_backup_count integer,
  am_authorised_operator_count integer,
  primary_sme_names text[],
  backup_sme_names text[],
  developing_backup_names text[],
  am_authorised_operator_names text[],
  sme_resilience_score numeric,
  am_resilience_score numeric,
  people_resilience_score numeric
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_primary_count integer := 0;
  v_backup_count integer := 0;
  v_developing_count integer := 0;
  v_am_count integer := 0;
  v_primary_names text[] := array[]::text[];
  v_backup_names text[] := array[]::text[];
  v_developing_names text[] := array[]::text[];
  v_am_names text[] := array[]::text[];
  v_role_resilience_score numeric := 50;
  v_skill_resilience_score numeric := 50;
  v_sme_score numeric := 50;
  v_am_score numeric := 50;
  v_people_score numeric := 50;
begin
  select
    count(*) filter (where capability.capability_role = 'PRIMARY_SME')::integer,
    count(*) filter (where capability.capability_role = 'BACKUP_SME')::integer,
    count(*) filter (where capability.capability_role = 'DEVELOPING_BACKUP')::integer,
    coalesce(array_agg(engineer.full_name order by engineer.full_name)
      filter (where capability.capability_role = 'PRIMARY_SME'), array[]::text[]),
    coalesce(array_agg(engineer.full_name order by engineer.full_name)
      filter (where capability.capability_role = 'BACKUP_SME'), array[]::text[]),
    coalesce(array_agg(engineer.full_name order by engineer.full_name)
      filter (where capability.capability_role = 'DEVELOPING_BACKUP'), array[]::text[])
  into
    v_primary_count,
    v_backup_count,
    v_developing_count,
    v_primary_names,
    v_backup_names,
    v_developing_names
  from public.equipment_engineer_capabilities capability
  join public.engineers engineer on engineer.id = capability.engineer_id
  where capability.equipment_id = p_equipment_id
    and capability.capability_status = 'ACTIVE'
    and capability.validation_status = 'VALIDATED'
    and (
      capability.valid_until is null
      or capability.valid_until >= current_date
    );

  select
    count(*)::integer,
    coalesce(array_agg(operator.full_name order by operator.full_name), array[]::text[])
  into v_am_count, v_am_names
  from public.equipment_operator_capabilities capability
  join public.operators operator on operator.id = capability.operator_id
  where capability.equipment_id = p_equipment_id
    and capability.capability_status = 'ACTIVE'
    and capability.validation_status = 'VALIDATED'
    and capability.am_step >= 2
    and (
      capability.valid_until is null
      or capability.valid_until >= current_date
    );

  select resilience.skill_resilience_score
  into v_skill_resilience_score
  from private.vorta_get_equipment_skill_resilience(
    p_equipment_id,
    current_date
  ) resilience;

  v_role_resilience_score := case
    when v_primary_count = 0 then 100
    when v_backup_count > 0 then 10
    when v_developing_count > 0 then 55
    else 80
  end;

  v_sme_score := greatest(
    v_role_resilience_score,
    coalesce(v_skill_resilience_score, 50)
  );

  v_am_score := case
    when v_am_count >= 4 then 5
    when v_am_count = 3 then 15
    when v_am_count = 2 then 30
    when v_am_count = 1 then 55
    else 85
  end;

  v_people_score := round(
    least(100, greatest(0, v_sme_score * 0.65 + v_am_score * 0.35)),
    1
  );

  return query
  select
    v_primary_count,
    v_backup_count,
    v_developing_count,
    v_am_count,
    v_primary_names,
    v_backup_names,
    v_developing_names,
    v_am_names,
    v_sme_score,
    v_am_score,
    v_people_score;
end;
$function$;

create or replace function public.vorta_sync_equipment_risk_counts()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  affected integer;
begin
  update public.equipment_risk_profiles risk_profile
  set
    overdue_pm_count = (
      select count(*)::integer
      from public.preventive_maintenance maintenance
      where maintenance.equipment_id = risk_profile.equipment_id
        and public.vorta_effective_pm_status(
          maintenance.status,
          maintenance.next_due_date
        ) = 'OVERDUE'
        and lower(coalesce(maintenance.pm_type, '')) <> 'calibration'
    ),
    calibration_overdue_count = (
      select count(*)::integer
      from public.preventive_maintenance maintenance
      where maintenance.equipment_id = risk_profile.equipment_id
        and public.vorta_effective_pm_status(
          maintenance.status,
          maintenance.next_due_date
        ) = 'OVERDUE'
        and lower(coalesce(maintenance.pm_type, '')) = 'calibration'
    ),
    open_work_order_count = (
      select count(*)::integer
      from public.work_orders work_order
      where work_order.equipment_id = risk_profile.equipment_id
        and upper(coalesce(work_order.status, 'OPEN')) <> 'COMPLETED'
    ),
    repeat_breakdown_count = coalesce((
      select sum(repeated.recurrences)::integer
      from (
        select greatest(count(*) - 1, 0) as recurrences
        from public.work_orders work_order
        where work_order.equipment_id = risk_profile.equipment_id
          and upper(coalesce(work_order.work_type, '')) = 'CORRECTIVE'
          and work_order.requested_date >= current_date - 90
          and work_order.fault_code is not null
        group by work_order.fault_code
        having count(*) > 1
      ) repeated
    ), 0),
    single_point_skill_gap = exists (
      select 1
      from private.vorta_get_equipment_skill_resilience(
        risk_profile.equipment_id,
        current_date
      ) resilience
      where resilience.missing_skill_count > 0
        or resilience.below_minimum_skill_count > 0
        or resilience.single_person_skill_count > 0
    ),
    critical_spares_missing = (
      select count(*)::integer
      from public.equipment_components component
      where component.equipment_id = risk_profile.equipment_id
        and coalesce(component.quantity_available, 0) <= 0
        and lower(component.criticality) in ('critical', 'high')
    ),
    updated_at = now()
  where risk_profile.equipment_id is not null;

  get diagnostics affected = row_count;
  return affected;
end;
$function$;

comment on function private.vorta_get_equipment_skill_resilience(uuid, date) is
  'Canonical site-capability resilience for required equipment skills. Current-shift coverage is reported separately.';

comment on function private.vorta_get_equipment_people_resilience(uuid) is
  'Combines canonical skill resilience, declared SME-role resilience and operator AM coverage.';

do $migration$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
  v_asset_count integer;
  v_missing_assets integer;
  v_gap_assets integer;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform public.vorta_refresh_current_risk_internal();

  select
    count(*)::integer,
    count(*) filter (
      where resilience.missing_skill_count > 0
    )::integer,
    count(*) filter (
      where risk_profile.single_point_skill_gap
    )::integer
  into v_asset_count, v_missing_assets, v_gap_assets
  from public.equipment_assets equipment
  join public.equipment_risk_profiles risk_profile
    on risk_profile.equipment_id = equipment.id
  cross join lateral private.vorta_get_equipment_skill_resilience(
    equipment.id,
    current_date
  ) resilience
  where equipment.site_id = v_site_id;

  if v_missing_assets <> 0 then
    raise exception 'Canonical Wrexham skill resilience still has % assets with missing required skills',
      v_missing_assets;
  end if;

  if v_gap_assets <= 0 or v_gap_assets >= v_asset_count then
    raise exception 'Canonical Wrexham skill resilience did not produce a credible mixed distribution: % of % assets flagged',
      v_gap_assets,
      v_asset_count;
  end if;
end;
$migration$;
