-- Give Ask Vorta one authorised, dated source for shift staffing, exceptions
-- and equipment-required skill exposure. The assistant must not infer absence
-- or future cover from the engineer's current availability flag.

create or replace function public.vorta_get_shift_cover_ai_brief(
  p_site_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_calendar jsonb;
  v_exceptions jsonb;
  v_skill_risks jsonb;
begin
  if p_start_date is null
    or p_end_date is null
    or p_end_date < p_start_date
    or p_end_date - p_start_date > 30 then
    raise exception 'Shift Cover AI date range must be between 1 and 31 days.';
  end if;

  if not public.vorta_has_site_access(p_site_id, false) then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'shiftDate', calendar.shift_date,
        'shiftType', calendar.shift_type,
        'teamNames', calendar.team_names,
        'engineerNames', calendar.engineer_names,
        'scheduledEngineerCount', calendar.scheduled_engineer_count,
        'contractorEngineerCount', calendar.contractor_engineer_count,
        'labourRiskScore', calendar.labour_risk_score,
        'labourRiskLevel', calendar.labour_risk_level,
        'coverageStatus', calendar.coverage_status,
        'equipmentWithMissingCover', calendar.equipment_with_missing_cover,
        'missingSkillCount', calendar.missing_skill_count
      )
      order by calendar.shift_date,
        case calendar.shift_type when 'day' then 1 else 2 end
    ),
    '[]'::jsonb
  )
  into v_calendar
  from public.vorta_get_shift_calendar_internal(
    p_site_id,
    p_start_date,
    p_end_date
  ) calendar;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'shiftDate', exception.shift_date,
        'shiftType', exception.shift_type,
        'engineerName', engineer.full_name,
        'teamName', team.name,
        'exceptionType', exception.exception_type,
        'isAvailable', exception.is_available,
        'notes', exception.notes
      )
      order by exception.shift_date,
        case exception.shift_type when 'day' then 1 else 2 end,
        engineer.full_name nulls last,
        team.name nulls last
    ),
    '[]'::jsonb
  )
  into v_exceptions
  from public.maintenance_shift_exceptions exception
  left join public.engineers engineer
    on engineer.id = exception.engineer_id
   and engineer.site_id = p_site_id
  left join public.maintenance_shift_teams team
    on team.id = exception.team_id
   and team.site_id = p_site_id
  where exception.site_id = p_site_id
    and exception.shift_date between p_start_date and p_end_date;

  with shifts as (
    select
      day_value::date as shift_date,
      shift_value.shift_type
    from pg_catalog.generate_series(
      p_start_date,
      p_end_date,
      interval '1 day'
    ) day_value
    cross join (
      values ('day'::text), ('night'::text)
    ) shift_value(shift_type)
  ),
  roster as (
    select
      shift.shift_date,
      shift.shift_type,
      roster_row.engineer_id,
      roster_row.full_name
    from shifts shift
    left join lateral public.vorta_get_shift_roster_internal(
      p_site_id,
      shift.shift_date,
      shift.shift_type
    ) roster_row on true
  ),
  requirements as (
    select
      asset.id as equipment_id,
      asset.name as equipment_name,
      asset.equipment_code,
      skill.id as skill_id,
      skill.name as skill_name,
      skill.category as skill_category,
      requirement.required_level,
      greatest(
        coalesce(requirement.minimum_qualified_engineers, 1),
        1
      )::integer as minimum_qualified_engineers
    from public.equipment_required_skills requirement
    join public.equipment_assets asset
      on asset.id = requirement.equipment_id
     and asset.site_id = p_site_id
    join public.skills skill
      on skill.id = requirement.skill_id
  ),
  coverage as (
    select
      shift.shift_date,
      shift.shift_type,
      requirement.equipment_id,
      requirement.equipment_name,
      requirement.equipment_code,
      requirement.skill_id,
      requirement.skill_name,
      requirement.skill_category,
      requirement.required_level,
      requirement.minimum_qualified_engineers,
      count(distinct engineer_skill.engineer_id)::integer
        as qualified_engineer_count,
      coalesce(
        array_agg(distinct roster.full_name order by roster.full_name)
          filter (where engineer_skill.engineer_id is not null),
        array[]::text[]
      ) as qualified_engineer_names
    from shifts shift
    join requirements requirement on true
    left join roster
      on roster.shift_date = shift.shift_date
     and roster.shift_type = shift.shift_type
    left join public.engineer_skills engineer_skill
      on engineer_skill.engineer_id = roster.engineer_id
     and engineer_skill.skill_id = requirement.skill_id
     and coalesce(
       engineer_skill.validated_rating,
       engineer_skill.manager_rating,
       engineer_skill.self_rating,
       0
     ) >= requirement.required_level
     and (
       engineer_skill.expiry_date is null
       or engineer_skill.expiry_date >= shift.shift_date
     )
    group by
      shift.shift_date,
      shift.shift_type,
      requirement.equipment_id,
      requirement.equipment_name,
      requirement.equipment_code,
      requirement.skill_id,
      requirement.skill_name,
      requirement.skill_category,
      requirement.required_level,
      requirement.minimum_qualified_engineers
  ),
  ranked_risks as (
    select
      coverage.*,
      case
        when coverage.qualified_engineer_count = 0 then 'critical'
        else 'high'
      end as risk_level
    from coverage
    where coverage.qualified_engineer_count
      < coverage.minimum_qualified_engineers
    order by
      case when coverage.qualified_engineer_count = 0 then 0 else 1 end,
      coverage.shift_date,
      case coverage.shift_type when 'day' then 1 else 2 end,
      coverage.equipment_name,
      coverage.skill_name
    limit 50
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'shiftDate', risk.shift_date,
        'shiftType', risk.shift_type,
        'skillName', risk.skill_name,
        'skillCategory', risk.skill_category,
        'equipmentName', risk.equipment_name,
        'equipmentCode', risk.equipment_code,
        'requiredLevel', risk.required_level,
        'minimumQualifiedEngineers', risk.minimum_qualified_engineers,
        'qualifiedEngineerCount', risk.qualified_engineer_count,
        'qualifiedEngineerNames', risk.qualified_engineer_names,
        'riskLevel', risk.risk_level
      )
      order by
        case risk.risk_level when 'critical' then 0 else 1 end,
        risk.shift_date,
        case risk.shift_type when 'day' then 1 else 2 end,
        risk.equipment_name,
        risk.skill_name
    ),
    '[]'::jsonb
  )
  into v_skill_risks
  from ranked_risks risk;

  return jsonb_build_object(
    'mode', 'live',
    'siteId', p_site_id,
    'generatedAt', now(),
    'startDate', p_start_date,
    'endDate', p_end_date,
    'calendar', v_calendar,
    'exceptions', v_exceptions,
    'skillRisks', v_skill_risks
  );
end;
$function$;

revoke all on function public.vorta_get_shift_cover_ai_brief(uuid, date, date)
from public, anon;
grant execute on function public.vorta_get_shift_cover_ai_brief(uuid, date, date)
to authenticated, service_role;

comment on function public.vorta_get_shift_cover_ai_brief(uuid, date, date) is
  'Returns authorised dated Shift Cover, absence/training exceptions and named required-skill exposure for Ask Vorta.';
