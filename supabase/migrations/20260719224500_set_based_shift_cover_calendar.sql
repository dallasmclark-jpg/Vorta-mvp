-- Calculate the full Shift Cover period in one set-based pass.
-- The previous implementation called site labour risk once per shift, which in
-- turn recalculated every equipment skill requirement and roster repeatedly.

create or replace function public.vorta_get_shift_calendar_internal(
  p_site_id uuid,
  p_start_date date,
  p_end_date date
)
returns table(
  shift_date date,
  shift_type text,
  team_names text[],
  engineer_names text[],
  scheduled_engineer_count integer,
  contractor_engineer_count integer,
  labour_risk_score numeric,
  labour_risk_level text,
  coverage_status text,
  equipment_with_missing_cover integer,
  missing_skill_count integer
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  with shifts as (
    select
      day_value::date as shift_date,
      shift_value.shift_type
    from generate_series(
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
      roster_row.full_name,
      roster_row.team_name,
      roster_row.is_contractor
    from shifts shift
    left join lateral public.vorta_get_shift_roster_internal(
      p_site_id,
      shift.shift_date,
      shift.shift_type
    ) roster_row on true
  ),
  roster_summary as (
    select
      roster.shift_date,
      roster.shift_type,
      coalesce(
        array_agg(distinct roster.team_name order by roster.team_name)
          filter (where roster.team_name is not null),
        array[]::text[]
      ) as team_names,
      coalesce(
        array_agg(distinct roster.full_name order by roster.full_name)
          filter (where roster.full_name is not null),
        array[]::text[]
      ) as engineer_names,
      count(distinct roster.engineer_id)::integer as scheduled_engineer_count,
      count(distinct roster.engineer_id)
        filter (where roster.is_contractor)::integer as contractor_engineer_count
    from roster
    group by roster.shift_date, roster.shift_type
  ),
  equipment as (
    select
      asset.id as equipment_id,
      asset.criticality,
      case lower(coalesce(asset.criticality, ''))
        when 'critical' then 4::numeric
        when 'high' then 3::numeric
        when 'medium' then 2::numeric
        when 'low' then 1::numeric
        else 1::numeric
      end as equipment_weight,
      coalesce(resilience.people_resilience_score, 50)::numeric
        as people_resilience_score
    from public.equipment_assets asset
    left join lateral private.vorta_get_equipment_people_resilience(
      asset.id
    ) resilience on true
    where asset.site_id = p_site_id
  ),
  requirements as (
    select
      requirement.equipment_id,
      requirement.skill_id,
      requirement.required_level,
      greatest(
        coalesce(requirement.minimum_qualified_engineers, 1),
        1
      )::integer as minimum_qualified
    from public.equipment_required_skills requirement
    join equipment
      on equipment.equipment_id = requirement.equipment_id
  ),
  requirement_coverage as (
    select
      shift.shift_date,
      shift.shift_type,
      requirement.equipment_id,
      requirement.skill_id,
      requirement.minimum_qualified,
      count(distinct engineer_skill.engineer_id)::integer as qualified_count
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
      requirement.skill_id,
      requirement.minimum_qualified
  ),
  coverage_summary as (
    select
      coverage.shift_date,
      coverage.shift_type,
      coverage.equipment_id,
      count(*)::integer as required_skill_count,
      count(*) filter (
        where coverage.qualified_count >= coverage.minimum_qualified
      )::integer as fully_covered_skill_count,
      count(*) filter (
        where coverage.qualified_count = 0
      )::integer as missing_skill_count,
      coalesce(avg(
        case
          when coverage.qualified_count = 0 then 100::numeric
          when coverage.qualified_count < coverage.minimum_qualified
            then 60::numeric
          else 5::numeric
        end
      ), 0)::numeric as requirement_risk
    from requirement_coverage coverage
    group by
      coverage.shift_date,
      coverage.shift_type,
      coverage.equipment_id
  ),
  equipment_labour_inputs as (
    select
      shift.shift_date,
      shift.shift_type,
      equipment.equipment_id,
      equipment.criticality,
      equipment.equipment_weight,
      equipment.people_resilience_score,
      roster_summary.scheduled_engineer_count,
      coalesce(coverage.required_skill_count, 0) as required_skill_count,
      coalesce(coverage.fully_covered_skill_count, 0)
        as fully_covered_skill_count,
      coalesce(coverage.missing_skill_count, 0) as missing_skill_count,
      coalesce(coverage.requirement_risk, 0)::numeric as requirement_risk,
      case
        when roster_summary.scheduled_engineer_count = 0 then 100::numeric
        when roster_summary.scheduled_engineer_count = 1 then 55::numeric
        when roster_summary.scheduled_engineer_count = 2 then 20::numeric
        else 5::numeric
      end as staffing_risk
    from shifts shift
    cross join equipment
    join roster_summary
      on roster_summary.shift_date = shift.shift_date
     and roster_summary.shift_type = shift.shift_type
    left join coverage_summary coverage
      on coverage.shift_date = shift.shift_date
     and coverage.shift_type = shift.shift_type
     and coverage.equipment_id = equipment.equipment_id
  ),
  equipment_labour as (
    select
      input.shift_date,
      input.shift_type,
      input.equipment_id,
      input.criticality,
      input.equipment_weight,
      input.missing_skill_count,
      case
        when input.scheduled_engineer_count = 0 then 100.0::numeric
        when input.required_skill_count = 0 then round(
          least(
            100::numeric,
            greatest(
              0::numeric,
              input.staffing_risk * 0.70
              + input.people_resilience_score * 0.30
            )
          ),
          1
        )
        else round(
          least(
            100::numeric,
            greatest(
              0::numeric,
              input.requirement_risk * 0.65
              + input.staffing_risk * 0.20
              + input.people_resilience_score * 0.15
            )
          ),
          1
        )
      end as equipment_labour_score
    from equipment_labour_inputs input
  ),
  site_labour as (
    select
      shift.shift_date,
      shift.shift_type,
      roster_summary.team_names,
      roster_summary.engineer_names,
      roster_summary.scheduled_engineer_count,
      roster_summary.contractor_engineer_count,
      count(*) filter (
        where equipment_labour.missing_skill_count > 0
      )::integer as equipment_with_missing_cover,
      coalesce(sum(equipment_labour.missing_skill_count), 0)::integer
        as missing_skill_count,
      coalesce(max(equipment_labour.equipment_labour_score), 0)::numeric
        as maximum_labour_score,
      coalesce(
        sum(
          equipment_labour.equipment_labour_score
          * equipment_labour.equipment_weight
        ) / nullif(sum(equipment_labour.equipment_weight), 0),
        0
      )::numeric as weighted_labour_score
    from shifts shift
    join roster_summary
      on roster_summary.shift_date = shift.shift_date
     and roster_summary.shift_type = shift.shift_type
    left join equipment_labour
      on equipment_labour.shift_date = shift.shift_date
     and equipment_labour.shift_type = shift.shift_type
    group by
      shift.shift_date,
      shift.shift_type,
      roster_summary.team_names,
      roster_summary.engineer_names,
      roster_summary.scheduled_engineer_count,
      roster_summary.contractor_engineer_count
  ),
  scored as (
    select
      site_labour.*,
      case
        when site_labour.scheduled_engineer_count = 0 then 100.0::numeric
        else round(
          least(
            100::numeric,
            greatest(
              0::numeric,
              site_labour.maximum_labour_score * 0.60
              + site_labour.weighted_labour_score * 0.40
            )
          ),
          1
        )
      end as calculated_labour_risk_score
    from site_labour
  )
  select
    scored.shift_date,
    scored.shift_type,
    scored.team_names,
    scored.engineer_names,
    scored.scheduled_engineer_count,
    scored.contractor_engineer_count,
    scored.calculated_labour_risk_score as labour_risk_score,
    case
      when scored.calculated_labour_risk_score >= 85 then 'Critical'
      when scored.calculated_labour_risk_score >= 65 then 'High'
      when scored.calculated_labour_risk_score >= 40 then 'Medium'
      when scored.calculated_labour_risk_score >= 20 then 'Low'
      else 'Minimal'
    end as labour_risk_level,
    case
      when scored.scheduled_engineer_count = 0 then 'gap'
      when scored.contractor_engineer_count > 0 then 'contractor'
      when scored.calculated_labour_risk_score >= 65 then 'partial'
      when scored.calculated_labour_risk_score >= 40 then 'reduced'
      else 'covered'
    end as coverage_status,
    scored.equipment_with_missing_cover,
    scored.missing_skill_count
  from scored
  order by
    scored.shift_date,
    case scored.shift_type when 'day' then 1 else 2 end;
$function$;

comment on function public.vorta_get_shift_calendar_internal(uuid, date, date) is
  'Returns Shift Cover calendar data using one set-based roster and skill coverage calculation for the full requested period.';
