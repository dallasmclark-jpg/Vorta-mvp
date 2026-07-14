-- Vorta equipment-linked skills backend consolidation.
-- Live-first migration; mirror the applied migration version into GitHub after verification.

-- Promote one existing qualified support engineer to validated backup SME on a
-- representative subset of Wrexham assets. Developing backups remain in place,
-- preserving visible career paths and realistic single-SME gaps on other assets.
with ranked_candidates as (
  select
    capability.id,
    row_number() over (
      partition by capability.equipment_id
      order by capability.competency_level desc, capability.updated_at desc, capability.id
    ) as candidate_rank
  from public.equipment_engineer_capabilities capability
  join public.equipment_assets equipment on equipment.id = capability.equipment_id
  where equipment.site_id = '11000000-0000-0000-0000-000000000001'::uuid
    and equipment.equipment_code in (
      'DEMO-VF-001',
      'DEMO-HVAC-001',
      'DEMO-FD-001',
      'PAL-02',
      'CP-01',
      'DEMO-VIS-001',
      'PW-01',
      'DEMO-AUT-001'
    )
    and capability.capability_role = 'QUALIFIED_SUPPORT'
    and capability.capability_status = 'ACTIVE'
    and capability.validation_status = 'VALIDATED'
)
update public.equipment_engineer_capabilities capability
set
  capability_role = 'BACKUP_SME',
  competency_level = greatest(capability.competency_level, 4),
  practice_authority = 'INDEPENDENT',
  notes = concat_ws(
    ' ',
    nullif(btrim(capability.notes), ''),
    'Validated as backup SME for the Wrexham equipment-resilience showcase.'
  ),
  updated_at = now()
from ranked_candidates candidate
where candidate.id = capability.id
  and candidate.candidate_rank = 1;

create or replace function private.vorta_get_equipment_people_resilience(
  p_equipment_id uuid
)
returns table (
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
          and (capability.valid_until is null or capability.valid_until >= current_date)
      )::integer as primary_sme_count,
      count(*) filter (
        where capability.capability_role = 'BACKUP_SME'
          and capability.capability_status = 'ACTIVE'
          and capability.validation_status = 'VALIDATED'
          and (capability.valid_until is null or capability.valid_until >= current_date)
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
          and (assignment.valid_until is null or assignment.valid_until >= current_date)
      )::integer as active_am_operator_count,
      count(distinct shift_team.code) filter (
        where assignment.assignment_status = 'ACTIVE'
          and assignment.am_step >= 1
          and assignment.am_validation_status = 'VALIDATED'
          and (assignment.valid_until is null or assignment.valid_until >= current_date)
          and shift_team.code in ('RED', 'GREEN', 'BLUE', 'YELLOW')
      )::integer as rotating_shift_coverage_count,
      count(*) filter (
        where assignment.assignment_status = 'ACTIVE'
          and assignment.am_step >= 1
          and assignment.am_validation_status = 'VALIDATED'
          and (assignment.valid_until is null or assignment.valid_until >= current_date)
          and shift_team.code = 'DAYS'
      )::integer as days_coverage_count
    from public.operator_equipment_assignments assignment
    join public.operators operator on operator.id = assignment.operator_id
    left join public.maintenance_shift_teams shift_team on shift_team.id = operator.shift_team_id
    where assignment.equipment_id = p_equipment_id
  ),
  scored as (
    select
      engineer_coverage.*,
      operator_coverage.*,
      case
        when engineer_coverage.primary_sme_count = 0 then 100.0
        when engineer_coverage.backup_sme_count > 0 then 10.0
        when engineer_coverage.developing_backup_count > 0 then 55.0
        else 80.0
      end::numeric as sme_resilience_score,
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

revoke all on function private.vorta_get_equipment_people_resilience(uuid)
  from public, anon, authenticated;
grant execute on function private.vorta_get_equipment_people_resilience(uuid)
  to postgres, service_role;

create or replace function public.vorta_get_equipment_labour_risk_internal(
  p_equipment_id uuid,
  p_shift_date date default null,
  p_shift_type text default null
)
returns table (
  equipment_id uuid,
  site_id uuid,
  shift_date date,
  shift_type text,
  scheduled_engineer_count integer,
  qualified_engineer_count integer,
  required_skill_count integer,
  fully_covered_skill_count integer,
  single_point_skill_count integer,
  missing_skill_count integer,
  labour_risk_score numeric,
  labour_risk_level text,
  no_engineer_override boolean,
  missing_skill_names text[],
  single_point_skill_names text[]
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid;
  v_shift_date date;
  v_shift_type text;
  v_roster_count integer := 0;
  v_required_count integer := 0;
  v_fully_covered integer := 0;
  v_single_point integer := 0;
  v_missing integer := 0;
  v_qualified_engineers integer := 0;
  v_requirement_risk numeric := 0;
  v_staffing_risk numeric := 0;
  v_people_resilience numeric := 0;
  v_labour_score numeric(5,1) := 0;
  v_missing_names text[] := array[]::text[];
  v_single_names text[] := array[]::text[];
begin
  select equipment.site_id
  into v_site_id
  from public.equipment_assets equipment
  where equipment.id = p_equipment_id;

  if v_site_id is null then
    return;
  end if;

  if p_shift_date is null or p_shift_type is null then
    select context.shift_date, context.shift_type
    into v_shift_date, v_shift_type
    from public.vorta_resolve_shift_context_internal(v_site_id) context;
  else
    v_shift_date := p_shift_date;
    v_shift_type := lower(p_shift_type);
  end if;

  if v_shift_type not in ('day', 'night') then
    raise exception 'Invalid shift type: %', v_shift_type;
  end if;

  select count(*)::integer
  into v_roster_count
  from public.vorta_get_shift_roster_internal(v_site_id, v_shift_date, v_shift_type);

  with requirements as (
    select
      requirement.skill_id,
      skill.name as skill_name,
      requirement.required_level,
      greatest(coalesce(requirement.minimum_qualified_engineers, 1), 1) as minimum_qualified
    from public.equipment_required_skills requirement
    join public.skills skill on skill.id = requirement.skill_id
    where requirement.equipment_id = p_equipment_id
  ),
  coverage as (
    select
      requirement.skill_id,
      requirement.skill_name,
      requirement.required_level,
      requirement.minimum_qualified,
      count(distinct roster.engineer_id) filter (
        where coalesce(engineer_skill.validated_rating, engineer_skill.manager_rating, engineer_skill.self_rating, 0)
          >= requirement.required_level
          and (engineer_skill.expiry_date is null or engineer_skill.expiry_date >= v_shift_date)
      )::integer as qualified_count
    from requirements requirement
    left join public.engineer_skills engineer_skill on engineer_skill.skill_id = requirement.skill_id
    left join public.vorta_get_shift_roster_internal(v_site_id, v_shift_date, v_shift_type) roster
      on roster.engineer_id = engineer_skill.engineer_id
    group by
      requirement.skill_id,
      requirement.skill_name,
      requirement.required_level,
      requirement.minimum_qualified
  )
  select
    count(*)::integer,
    count(*) filter (where qualified_count >= minimum_qualified)::integer,
    count(*) filter (where qualified_count = 1 and minimum_qualified > 1)::integer,
    count(*) filter (where qualified_count = 0)::integer,
    coalesce(avg(
      case
        when qualified_count = 0 then 100
        when qualified_count < minimum_qualified then 60
        else 5
      end
    ), 0),
    coalesce(array_agg(skill_name order by skill_name) filter (where qualified_count = 0), array[]::text[]),
    coalesce(array_agg(skill_name order by skill_name) filter (
      where qualified_count = 1 and minimum_qualified > 1
    ), array[]::text[])
  into
    v_required_count,
    v_fully_covered,
    v_single_point,
    v_missing,
    v_requirement_risk,
    v_missing_names,
    v_single_names
  from coverage;

  select count(distinct roster.engineer_id)::integer
  into v_qualified_engineers
  from public.vorta_get_shift_roster_internal(v_site_id, v_shift_date, v_shift_type) roster
  where exists (
    select 1
    from public.equipment_required_skills requirement
    join public.engineer_skills engineer_skill
      on engineer_skill.skill_id = requirement.skill_id
     and engineer_skill.engineer_id = roster.engineer_id
    where requirement.equipment_id = p_equipment_id
      and coalesce(engineer_skill.validated_rating, engineer_skill.manager_rating, engineer_skill.self_rating, 0)
        >= requirement.required_level
      and (engineer_skill.expiry_date is null or engineer_skill.expiry_date >= v_shift_date)
  );

  v_staffing_risk := case
    when v_roster_count = 0 then 100
    when v_roster_count = 1 then 55
    when v_roster_count = 2 then 20
    else 5
  end;

  select resilience.people_resilience_score
  into v_people_resilience
  from private.vorta_get_equipment_people_resilience(p_equipment_id) resilience;

  v_people_resilience := coalesce(v_people_resilience, 50);

  if v_roster_count = 0 then
    v_labour_score := 100.0;
  elsif v_required_count = 0 then
    v_labour_score := round(
      least(100, greatest(0, v_staffing_risk * 0.70 + v_people_resilience * 0.30)),
      1
    );
  else
    v_labour_score := round(
      least(
        100,
        greatest(
          0,
          v_requirement_risk * 0.65
          + v_staffing_risk * 0.20
          + v_people_resilience * 0.15
        )
      ),
      1
    );
  end if;

  return query
  select
    p_equipment_id,
    v_site_id,
    v_shift_date,
    v_shift_type,
    v_roster_count,
    v_qualified_engineers,
    v_required_count,
    v_fully_covered,
    v_single_point,
    v_missing,
    v_labour_score,
    case
      when v_labour_score >= 85 then 'Critical'
      when v_labour_score >= 65 then 'High'
      when v_labour_score >= 40 then 'Medium'
      when v_labour_score >= 20 then 'Low'
      else 'Minimal'
    end,
    v_roster_count = 0,
    v_missing_names,
    v_single_names;
end;
$function$;

revoke all on function public.vorta_get_equipment_labour_risk_internal(uuid, date, text)
  from public, anon, authenticated;
grant execute on function public.vorta_get_equipment_labour_risk_internal(uuid, date, text)
  to postgres, service_role;

create or replace function public.vorta_get_equipment_skills_showcase(
  p_equipment_id uuid
)
returns table (
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
    select equipment.id, equipment.equipment_code, equipment.name, equipment.equipment_type, equipment.area
    from public.equipment_assets equipment
    where equipment.id = p_equipment_id
  ),
  resilience as (
    select * from private.vorta_get_equipment_people_resilience(p_equipment_id)
  ),
  skill_rows as (
    select
      requirement.id,
      skill.id as skill_id,
      skill.name,
      skill.category,
      requirement.required_level,
      requirement.minimum_qualified_engineers,
      requirement.criticality,
      requirement.execution_authority,
      requirement.validation_required,
      requirement.evidence_reference,
      count(distinct capability.engineer_id) filter (
        where capability.capability_status = 'ACTIVE'
          and capability.validation_status = 'VALIDATED'
          and coalesce(engineer_skill.validated_rating, engineer_skill.manager_rating, 0)
            >= requirement.required_level
      )::integer as qualified_engineer_count
    from public.equipment_required_skills requirement
    join public.skills skill on skill.id = requirement.skill_id
    left join public.equipment_engineer_capabilities capability
      on capability.equipment_id = requirement.equipment_id
    left join public.engineer_skills engineer_skill
      on engineer_skill.engineer_id = capability.engineer_id
     and engineer_skill.skill_id = requirement.skill_id
    where requirement.equipment_id = p_equipment_id
    group by requirement.id, skill.id, skill.name, skill.category
  ),
  engineer_rows as (
    select to_jsonb(engineer_capability) as item
    from public.vorta_get_equipment_engineer_capabilities(p_equipment_id) engineer_capability
  ),
  operator_rows as (
    select to_jsonb(operator_capability) as item
    from public.vorta_get_equipment_operator_capabilities(p_equipment_id) operator_capability
  ),
  path_rows as (
    select to_jsonb(development_path) as item
    from public.vorta_get_equipment_development_paths(p_equipment_id) development_path
  ),
  shift_codes(code, sort_order) as (
    values ('RED'::text, 1), ('GREEN'::text, 2), ('BLUE'::text, 3), ('YELLOW'::text, 4)
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
    left join public.maintenance_shift_teams shift_team
      on shift_team.code = shift_code.code
     and shift_team.site_id = (
       select equipment.site_id from public.equipment_assets equipment where equipment.id = p_equipment_id
     )
    left join public.operators operator on operator.shift_team_id = shift_team.id
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
    resilience.rotating_shift_coverage_count,
    greatest(4 - resilience.rotating_shift_coverage_count, 0),
    resilience.people_resilience_score,
    coalesce((
      select jsonb_agg(to_jsonb(skill_row) order by skill_row.criticality, skill_row.name)
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

revoke all on function public.vorta_get_equipment_skills_showcase(uuid)
  from public, anon;
grant execute on function public.vorta_get_equipment_skills_showcase(uuid)
  to authenticated, postgres, service_role;

create or replace function public.vorta_get_equipment_skills_backend_health()
returns table (
  check_key text,
  status text,
  expected text,
  actual text,
  detail text
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  with site as (
    select '11000000-0000-0000-0000-000000000001'::uuid as id
  ),
  equipment as (
    select asset.id
    from public.equipment_assets asset
    join site on site.id = asset.site_id
  ),
  checks as (
    select
      'equipment_required_skills_complete'::text as check_key,
      count(*) filter (
        where not exists (
          select 1 from public.equipment_required_skills requirement
          where requirement.equipment_id = equipment.id
        )
      )::integer as failure_count,
      'Every Wrexham asset has at least one required skill'::text as expected,
      'Assets without required skills'::text as detail
    from equipment
    union all
    select
      'equipment_primary_sme_complete',
      count(*) filter (
        where not exists (
          select 1 from public.equipment_engineer_capabilities capability
          where capability.equipment_id = equipment.id
            and capability.capability_role = 'PRIMARY_SME'
            and capability.capability_status = 'ACTIVE'
            and capability.validation_status = 'VALIDATED'
        )
      )::integer,
      'Every Wrexham asset has one validated primary SME',
      'Assets without validated primary SME'
    from equipment
    union all
    select
      'equipment_operator_assignment_complete',
      count(*) filter (
        where not exists (
          select 1 from public.operator_equipment_assignments assignment
          where assignment.equipment_id = equipment.id
            and assignment.assignment_status = 'ACTIVE'
        )
      )::integer,
      'Every Wrexham asset has an active operator assignment',
      'Assets without active operator assignment'
    from equipment
    union all
    select
      'equipment_engineer_path_complete',
      count(*) filter (
        where not exists (
          select 1 from public.engineer_career_paths path
          where path.equipment_id = equipment.id and path.status = 'active'
        )
      )::integer,
      'Every Wrexham asset has an active engineer development path',
      'Assets without active engineer development path'
    from equipment
    union all
    select
      'equipment_operator_path_complete',
      count(*) filter (
        where not exists (
          select 1 from public.operator_career_paths path
          where path.equipment_id = equipment.id and path.status = 'active'
        )
      )::integer,
      'Every Wrexham asset has an active operator development path',
      'Assets without active operator development path'
    from equipment
    union all
    select
      'duplicate_equipment_capabilities',
      count(*)::integer,
      'No duplicate equipment/engineer capability pairs',
      'Duplicate equipment/engineer pairs'
    from (
      select capability.equipment_id, capability.engineer_id
      from public.equipment_engineer_capabilities capability
      group by capability.equipment_id, capability.engineer_id
      having count(*) > 1
    ) duplicates
    union all
    select
      'duplicate_operator_assignments',
      count(*)::integer,
      'No duplicate equipment/operator assignments',
      'Duplicate equipment/operator pairs'
    from (
      select assignment.equipment_id, assignment.operator_id
      from public.operator_equipment_assignments assignment
      group by assignment.equipment_id, assignment.operator_id
      having count(*) > 1
    ) duplicates
  )
  select
    checks.check_key,
    case when checks.failure_count = 0 then 'pass' else 'fail' end,
    checks.expected,
    checks.failure_count::text,
    checks.detail
  from checks
  order by checks.check_key;
$function$;

revoke all on function public.vorta_get_equipment_skills_backend_health()
  from public, anon;
grant execute on function public.vorta_get_equipment_skills_backend_health()
  to authenticated, postgres, service_role;

-- Refresh all risk caches so the explicit SME and AM resilience factor is live.
select public.vorta_refresh_current_risk_internal();
