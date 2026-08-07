-- VOR-068: make Shift Cover staffing status use each team's configured headcount.
-- The Engineers rota must never render a scheduled team as fully covered when
-- the authorised roster contains fewer engineers than the configured minimum.

alter table public.maintenance_shift_teams
  add column if not exists required_headcount integer;

update public.maintenance_shift_teams team
set required_headcount = greatest(
  1,
  coalesce((
    select count(*)::integer
    from public.maintenance_shift_team_members member
    where member.team_id = team.id
      and member.active_from <= current_date
      and (member.active_to is null or member.active_to >= current_date)
  ), 0)
)
where team.required_headcount is null;

alter table public.maintenance_shift_teams
  alter column required_headcount set default 1,
  alter column required_headcount set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'maintenance_shift_teams_required_headcount_check'
      and conrelid = 'public.maintenance_shift_teams'::regclass
  ) then
    alter table public.maintenance_shift_teams
      add constraint maintenance_shift_teams_required_headcount_check
      check (required_headcount > 0);
  end if;
end
$$;

comment on column public.maintenance_shift_teams.required_headcount is
  'Configured minimum engineers required whenever this maintenance team is scheduled.';

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
  scheduled_teams as (
    select
      shift.shift_date,
      shift.shift_type,
      team.id as team_id,
      team.required_headcount
    from shifts shift
    join public.maintenance_shift_teams team
      on team.site_id = p_site_id
     and team.active
     and (
       (
         team.pattern_type = 'days'
         and shift.shift_type = 'day'
         and extract(isodow from shift.shift_date) between 1 and 5
       )
       or
       (
         team.pattern_type = 'continental'
         and (
           case
             when mod(mod((shift.shift_date - team.reference_date) + team.cycle_offset, 8) + 8, 8) in (0, 1)
               then 'day'
             when mod(mod((shift.shift_date - team.reference_date) + team.cycle_offset, 8) + 8, 8) in (2, 3)
               then 'night'
             else 'off'
           end
         ) = shift.shift_type
       )
     )
  ),
  staffing_requirements as (
    select
      shift.shift_date,
      shift.shift_type,
      coalesce(sum(scheduled_team.required_headcount), 0)::integer
        as required_engineer_count
    from shifts shift
    left join scheduled_teams scheduled_team
      on scheduled_team.shift_date = shift.shift_date
     and scheduled_team.shift_type = shift.shift_type
    group by shift.shift_date, shift.shift_type
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
      staffing_requirements.required_engineer_count,
      coalesce(coverage.required_skill_count, 0) as required_skill_count,
      coalesce(coverage.fully_covered_skill_count, 0)
        as fully_covered_skill_count,
      coalesce(coverage.missing_skill_count, 0) as missing_skill_count,
      coalesce(coverage.requirement_risk, 0)::numeric as requirement_risk,
      case
        when roster_summary.scheduled_engineer_count = 0 then 100::numeric
        when staffing_requirements.required_engineer_count > 0
          and roster_summary.scheduled_engineer_count < staffing_requirements.required_engineer_count
          then round(
            greatest(
              20::numeric,
              (
                (staffing_requirements.required_engineer_count - roster_summary.scheduled_engineer_count)::numeric
                / staffing_requirements.required_engineer_count::numeric
              ) * 100::numeric
            ),
            1
          )
        when roster_summary.scheduled_engineer_count = 1 then 55::numeric
        when roster_summary.scheduled_engineer_count = 2 then 20::numeric
        else 5::numeric
      end as staffing_risk
    from shifts shift
    cross join equipment
    join roster_summary
      on roster_summary.shift_date = shift.shift_date
     and roster_summary.shift_type = shift.shift_type
    join staffing_requirements
      on staffing_requirements.shift_date = shift.shift_date
     and staffing_requirements.shift_type = shift.shift_type
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
      staffing_requirements.required_engineer_count,
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
    join staffing_requirements
      on staffing_requirements.shift_date = shift.shift_date
     and staffing_requirements.shift_type = shift.shift_type
    left join equipment_labour
      on equipment_labour.shift_date = shift.shift_date
     and equipment_labour.shift_type = shift.shift_type
    group by
      shift.shift_date,
      shift.shift_type,
      roster_summary.team_names,
      roster_summary.engineer_names,
      roster_summary.scheduled_engineer_count,
      roster_summary.contractor_engineer_count,
      staffing_requirements.required_engineer_count
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
      when scored.required_engineer_count > 0
        and scored.scheduled_engineer_count * 2 <= scored.required_engineer_count
        then 'partial'
      when scored.required_engineer_count > 0
        and scored.scheduled_engineer_count < scored.required_engineer_count
        then 'reduced'
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
  'Returns Shift Cover calendar data using one set-based roster and skill coverage calculation for the full requested period. Coverage cannot be fully covered below the configured team headcount.';

create or replace function public.vorta_get_shift_cover_snapshot(
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
  v_source_updated_at timestamptz;
  v_calendar jsonb;
  v_teams jsonb;
  v_active_team_count integer;
  v_active_member_count integer;
  v_engineer_count integer;
  v_skill_record_count integer;
  v_sme_dependency_count integer;
begin
  if p_start_date is null
    or p_end_date is null
    or p_end_date < p_start_date
    or p_end_date - p_start_date > 62 then
    raise exception 'Shift Cover date range must be between 1 and 63 days.';
  end if;

  if not public.vorta_has_site_access(p_site_id, false) then
    return null;
  end if;

  select nullif(
    greatest(
      coalesce((
        select max(team.updated_at)
        from public.maintenance_shift_teams team
        where team.site_id = p_site_id
      ), '-infinity'::timestamptz),
      coalesce((
        select max(member.created_at)
        from public.maintenance_shift_team_members member
        join public.maintenance_shift_teams team
          on team.id = member.team_id
        where team.site_id = p_site_id
      ), '-infinity'::timestamptz),
      coalesce((
        select max(engineer.updated_at)
        from public.engineers engineer
        where engineer.site_id = p_site_id
      ), '-infinity'::timestamptz),
      coalesce((
        select max(availability.last_updated_at)
        from public.engineer_availability availability
        where availability.site_id = p_site_id
      ), '-infinity'::timestamptz),
      coalesce((
        select max(skill.updated_at)
        from public.engineer_skills skill
        join public.engineers engineer
          on engineer.id = skill.engineer_id
        where engineer.site_id = p_site_id
      ), '-infinity'::timestamptz),
      coalesce((
        select max(exception.created_at)
        from public.maintenance_shift_exceptions exception
        where exception.site_id = p_site_id
      ), '-infinity'::timestamptz)
    ),
    '-infinity'::timestamptz
  )
  into v_source_updated_at;

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
        'id', team.id,
        'code', team.code,
        'name', team.name,
        'patternType', team.pattern_type,
        'cycleOffset', team.cycle_offset,
        'referenceDate', team.reference_date,
        'requiredHeadcount', team.required_headcount,
        'memberCount', (
          select count(*)::integer
          from public.maintenance_shift_team_members member
          where member.team_id = team.id
            and member.active_from <= p_end_date
            and (member.active_to is null or member.active_to >= p_start_date)
        ),
        'memberNames', coalesce((
          select jsonb_agg(engineer.full_name order by engineer.full_name)
          from public.maintenance_shift_team_members member
          join public.engineers engineer
            on engineer.id = member.engineer_id
          where member.team_id = team.id
            and member.active_from <= p_end_date
            and (member.active_to is null or member.active_to >= p_start_date)
        ), '[]'::jsonb)
      )
      order by team.name
    ),
    '[]'::jsonb
  )
  into v_teams
  from public.maintenance_shift_teams team
  where team.site_id = p_site_id
    and team.active;

  select count(*)::integer
  into v_active_team_count
  from public.maintenance_shift_teams team
  where team.site_id = p_site_id
    and team.active;

  select count(*)::integer
  into v_active_member_count
  from public.maintenance_shift_team_members member
  join public.maintenance_shift_teams team
    on team.id = member.team_id
  where team.site_id = p_site_id
    and team.active
    and member.active_from <= p_end_date
    and (member.active_to is null or member.active_to >= p_start_date);

  select count(*)::integer
  into v_engineer_count
  from public.engineers engineer
  where engineer.site_id = p_site_id;

  select count(*)::integer
  into v_skill_record_count
  from public.engineer_skills skill
  join public.engineers engineer
    on engineer.id = skill.engineer_id
  where engineer.site_id = p_site_id;

  with capability_counts as (
    select
      capability.equipment_id,
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
    from public.equipment_engineer_capabilities capability
    join public.equipment_assets equipment
      on equipment.id = capability.equipment_id
    where equipment.site_id = p_site_id
    group by capability.equipment_id
  )
  select count(*) filter (
    where primary_sme_count = 1 and backup_sme_count = 0
  )::integer
  into v_sme_dependency_count
  from capability_counts;

  return jsonb_build_object(
    'mode', 'live',
    'siteId', p_site_id,
    'generatedAt', now(),
    'sourceUpdatedAt', v_source_updated_at,
    'calendar', v_calendar,
    'teams', v_teams,
    'smeDependencyCount', coalesce(v_sme_dependency_count, 0),
    'completeness', jsonb_build_object(
      'activeTeamCount', v_active_team_count,
      'activeMemberCount', v_active_member_count,
      'engineerCount', v_engineer_count,
      'skillRecordCount', v_skill_record_count
    )
  );
end;
$function$;

comment on function public.vorta_get_shift_cover_snapshot(uuid, date, date) is
  'Returns authorised Shift Cover evidence plus configured team headcounts and active member names for verified rota presentation.';
