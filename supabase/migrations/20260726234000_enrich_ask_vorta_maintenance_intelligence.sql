-- Turn the Shift Cover AI brief into a decision pack rather than a risk count.
-- It now distinguishes recorded absence from rota-off availability and ranks
-- competent cover options without claiming that an off-rota engineer has
-- accepted overtime or is safe to work.

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
  v_off_rota jsonb;
  v_cover_candidates jsonb;
  v_cover_packages jsonb;
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
    limit 80
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

  with target_shifts as (
    select
      calendar.shift_date,
      calendar.shift_type
    from public.vorta_get_shift_calendar_internal(
      p_site_id,
      p_start_date,
      p_end_date
    ) calendar
    where calendar.coverage_status <> 'covered'
       or calendar.labour_risk_score >= 40
  ),
  all_dates as (
    select
      day_value::date as shift_date,
      shift_value.shift_type
    from pg_catalog.generate_series(
      p_start_date - 1,
      p_end_date + 1,
      interval '1 day'
    ) day_value
    cross join (
      values ('day'::text), ('night'::text)
    ) shift_value(shift_type)
  ),
  all_roster as (
    select
      shift.shift_date,
      shift.shift_type,
      roster_row.engineer_id
    from all_dates shift
    left join lateral public.vorta_get_shift_roster_internal(
      p_site_id,
      shift.shift_date,
      shift.shift_type
    ) roster_row on true
  ),
  off_rota_rows as (
    select
      target.shift_date,
      target.shift_type,
      engineer.id as engineer_id,
      engineer.full_name,
      engineer.discipline,
      team.name as team_name,
      exists (
        select 1
        from all_roster adjacent
        where adjacent.engineer_id = engineer.id
          and (
            (
              target.shift_type = 'day'
              and adjacent.shift_date = target.shift_date - 1
              and adjacent.shift_type = 'night'
            )
            or (
              target.shift_type = 'night'
              and adjacent.shift_date = target.shift_date + 1
              and adjacent.shift_type = 'day'
            )
          )
      ) as adjacent_shift_conflict
    from target_shifts target
    join public.engineers engineer
      on engineer.site_id = p_site_id
     and coalesce(engineer.verified, false)
    left join lateral (
      select shift_team.id, shift_team.name
      from public.maintenance_shift_team_members member
      join public.maintenance_shift_teams shift_team
        on shift_team.id = member.team_id
       and shift_team.site_id = p_site_id
       and shift_team.active
      where member.engineer_id = engineer.id
        and member.active_from <= target.shift_date
        and (member.active_to is null or member.active_to >= target.shift_date)
      order by member.active_to nulls first, member.active_from desc
      limit 1
    ) team on true
    where not exists (
      select 1
      from all_roster scheduled
      where scheduled.shift_date = target.shift_date
        and scheduled.engineer_id = engineer.id
    )
      and not exists (
        select 1
        from public.maintenance_shift_exceptions exception
        left join public.maintenance_shift_team_members exception_member
          on exception_member.team_id = exception.team_id
         and exception_member.engineer_id = engineer.id
         and exception_member.active_from <= target.shift_date
         and (
           exception_member.active_to is null
           or exception_member.active_to >= target.shift_date
         )
        where exception.site_id = p_site_id
          and exception.shift_date = target.shift_date
          and not exception.is_available
          and (
            exception.engineer_id = engineer.id
            or exception_member.engineer_id is not null
          )
      )
  ),
  grouped_off_rota as (
    select
      off_rota.shift_date,
      off_rota.shift_type,
      coalesce(
        array_agg(distinct off_rota.team_name order by off_rota.team_name)
          filter (where off_rota.team_name is not null),
        array[]::text[]
      ) as team_names,
      coalesce(
        array_agg(off_rota.full_name order by off_rota.full_name)
          filter (where not off_rota.adjacent_shift_conflict),
        array[]::text[]
      ) as engineer_names,
      coalesce(
        array_agg(off_rota.full_name order by off_rota.full_name)
          filter (where off_rota.adjacent_shift_conflict),
        array[]::text[]
      ) as rest_conflict_engineer_names
    from off_rota_rows off_rota
    group by off_rota.shift_date, off_rota.shift_type
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'shiftDate', off_rota.shift_date,
        'shiftType', off_rota.shift_type,
        'teamNames', off_rota.team_names,
        'engineerNames', off_rota.engineer_names,
        'restConflictEngineerNames', off_rota.rest_conflict_engineer_names,
        'status', 'off_rota_not_confirmed_available'
      )
      order by off_rota.shift_date,
        case off_rota.shift_type when 'day' then 1 else 2 end
    ),
    '[]'::jsonb
  )
  into v_off_rota
  from grouped_off_rota off_rota;

  with target_shifts as (
    select
      calendar.shift_date,
      calendar.shift_type,
      calendar.missing_skill_count
    from public.vorta_get_shift_calendar_internal(
      p_site_id,
      p_start_date,
      p_end_date
    ) calendar
    where calendar.coverage_status <> 'covered'
       or calendar.labour_risk_score >= 40
  ),
  all_dates as (
    select
      day_value::date as shift_date,
      shift_value.shift_type
    from pg_catalog.generate_series(
      p_start_date - 1,
      p_end_date + 1,
      interval '1 day'
    ) day_value
    cross join (
      values ('day'::text), ('night'::text)
    ) shift_value(shift_type)
  ),
  all_roster as (
    select
      shift.shift_date,
      shift.shift_type,
      roster_row.engineer_id,
      roster_row.full_name
    from all_dates shift
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
      asset.criticality as equipment_criticality,
      skill.id as skill_id,
      skill.name as skill_name,
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
  gaps as (
    select
      target.shift_date,
      target.shift_type,
      target.missing_skill_count,
      requirement.*,
      count(distinct engineer_skill.engineer_id)::integer
        as qualified_engineer_count
    from target_shifts target
    join requirements requirement on true
    left join all_roster roster
      on roster.shift_date = target.shift_date
     and roster.shift_type = target.shift_type
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
       or engineer_skill.expiry_date >= target.shift_date
     )
    group by
      target.shift_date,
      target.shift_type,
      target.missing_skill_count,
      requirement.equipment_id,
      requirement.equipment_name,
      requirement.equipment_code,
      requirement.equipment_criticality,
      requirement.skill_id,
      requirement.skill_name,
      requirement.required_level,
      requirement.minimum_qualified_engineers
    having count(distinct engineer_skill.engineer_id)
      < requirement.minimum_qualified_engineers
  ),
  candidate_matches as (
    select
      gap.shift_date,
      gap.shift_type,
      gap.missing_skill_count,
      engineer.id as engineer_id,
      engineer.full_name,
      engineer.discipline,
      team.name as team_name,
      count(*)::integer as gaps_improved,
      count(*) filter (
        where gap.qualified_engineer_count + 1
          >= gap.minimum_qualified_engineers
      )::integer as gaps_closed,
      count(*) filter (
        where gap.qualified_engineer_count = 0
          and lower(coalesce(gap.equipment_criticality, '')) in ('critical', 'high')
      )::integer as critical_gaps_covered,
      count(distinct gap.equipment_id)::integer as assets_protected,
      count(distinct gap.skill_id)::integer as skills_supplied,
      (array_agg(
        distinct gap.skill_name
        order by gap.skill_name
      ))[1:6] as top_skills,
      (array_agg(
        distinct coalesce(gap.equipment_code, gap.equipment_name)
        order by coalesce(gap.equipment_code, gap.equipment_name)
      ))[1:8] as top_assets,
      exists (
        select 1
        from all_roster adjacent
        where adjacent.engineer_id = engineer.id
          and (
            (
              gap.shift_type = 'day'
              and adjacent.shift_date = gap.shift_date - 1
              and adjacent.shift_type = 'night'
            )
            or (
              gap.shift_type = 'night'
              and adjacent.shift_date = gap.shift_date + 1
              and adjacent.shift_type = 'day'
            )
          )
      ) as adjacent_shift_conflict
    from gaps gap
    join public.engineers engineer
      on engineer.site_id = p_site_id
     and coalesce(engineer.verified, false)
    join public.engineer_skills engineer_skill
      on engineer_skill.engineer_id = engineer.id
     and engineer_skill.skill_id = gap.skill_id
     and coalesce(
       engineer_skill.validated_rating,
       engineer_skill.manager_rating,
       engineer_skill.self_rating,
       0
     ) >= gap.required_level
     and (
       engineer_skill.expiry_date is null
       or engineer_skill.expiry_date >= gap.shift_date
     )
    left join lateral (
      select shift_team.id, shift_team.name
      from public.maintenance_shift_team_members member
      join public.maintenance_shift_teams shift_team
        on shift_team.id = member.team_id
       and shift_team.site_id = p_site_id
       and shift_team.active
      where member.engineer_id = engineer.id
        and member.active_from <= gap.shift_date
        and (member.active_to is null or member.active_to >= gap.shift_date)
      order by member.active_to nulls first, member.active_from desc
      limit 1
    ) team on true
    where not exists (
      select 1
      from all_roster scheduled
      where scheduled.shift_date = gap.shift_date
        and scheduled.engineer_id = engineer.id
    )
      and not exists (
        select 1
        from public.maintenance_shift_exceptions exception
        left join public.maintenance_shift_team_members exception_member
          on exception_member.team_id = exception.team_id
         and exception_member.engineer_id = engineer.id
         and exception_member.active_from <= gap.shift_date
         and (
           exception_member.active_to is null
           or exception_member.active_to >= gap.shift_date
         )
        where exception.site_id = p_site_id
          and exception.shift_date = gap.shift_date
          and not exception.is_available
          and (
            exception.engineer_id = engineer.id
            or exception_member.engineer_id is not null
          )
      )
    group by
      gap.shift_date,
      gap.shift_type,
      gap.missing_skill_count,
      engineer.id,
      engineer.full_name,
      engineer.discipline,
      team.name
  ),
  ranked_candidates as (
    select
      candidate.*,
      row_number() over (
        partition by candidate.shift_date, candidate.shift_type
        order by
          candidate.adjacent_shift_conflict,
          candidate.gaps_closed desc,
          candidate.critical_gaps_covered desc,
          candidate.assets_protected desc,
          candidate.full_name
      ) as candidate_rank
    from candidate_matches candidate
  ),
  shortlist as (
    select candidate.*
    from ranked_candidates candidate
    where candidate.candidate_rank <= 3
      and not candidate.adjacent_shift_conflict
  ),
  package_members as (
    select
      candidate.shift_date,
      candidate.shift_type,
      array_agg(candidate.full_name order by candidate.candidate_rank)
        as engineer_names,
      array_agg(
        coalesce(candidate.team_name, 'No shift team')
        order by candidate.candidate_rank
      ) as team_names
    from shortlist candidate
    group by candidate.shift_date, candidate.shift_type
  ),
  package_gap_impact as (
    select
      gap.shift_date,
      gap.shift_type,
      gap.missing_skill_count,
      gap.equipment_id,
      gap.equipment_name,
      gap.equipment_code,
      gap.skill_id,
      gap.skill_name,
      gap.qualified_engineer_count,
      gap.minimum_qualified_engineers,
      count(distinct candidate.engineer_id) filter (
        where engineer_skill.id is not null
      )::integer as added_qualified_engineers
    from gaps gap
    left join shortlist candidate
      on candidate.shift_date = gap.shift_date
     and candidate.shift_type = gap.shift_type
    left join public.engineer_skills engineer_skill
      on engineer_skill.engineer_id = candidate.engineer_id
     and engineer_skill.skill_id = gap.skill_id
     and coalesce(
       engineer_skill.validated_rating,
       engineer_skill.manager_rating,
       engineer_skill.self_rating,
       0
     ) >= gap.required_level
     and (
       engineer_skill.expiry_date is null
       or engineer_skill.expiry_date >= gap.shift_date
     )
    group by
      gap.shift_date,
      gap.shift_type,
      gap.missing_skill_count,
      gap.equipment_id,
      gap.equipment_name,
      gap.equipment_code,
      gap.skill_id,
      gap.skill_name,
      gap.qualified_engineer_count,
      gap.minimum_qualified_engineers
  ),
  package_impact as (
    select
      impact.shift_date,
      impact.shift_type,
      impact.missing_skill_count,
      count(*) filter (
        where impact.added_qualified_engineers > 0
      )::integer as gaps_improved,
      count(*) filter (
        where impact.qualified_engineer_count
          + impact.added_qualified_engineers
          >= impact.minimum_qualified_engineers
      )::integer as gaps_closed,
      count(*) filter (
        where impact.qualified_engineer_count = 0
          and impact.qualified_engineer_count
            + impact.added_qualified_engineers
            >= impact.minimum_qualified_engineers
      )::integer as missing_skills_closed,
      count(distinct impact.equipment_id) filter (
        where impact.qualified_engineer_count
          + impact.added_qualified_engineers
          >= impact.minimum_qualified_engineers
      )::integer as assets_with_closed_gaps,
      (array_agg(
        distinct impact.skill_name
        order by impact.skill_name
      ) filter (
        where impact.qualified_engineer_count
          + impact.added_qualified_engineers
          >= impact.minimum_qualified_engineers
      ))[1:8] as closed_skills,
      (array_agg(
        distinct coalesce(impact.equipment_code, impact.equipment_name)
        order by coalesce(impact.equipment_code, impact.equipment_name)
      ) filter (
        where impact.qualified_engineer_count
          + impact.added_qualified_engineers
          >= impact.minimum_qualified_engineers
      ))[1:10] as protected_assets
    from package_gap_impact impact
    group by
      impact.shift_date,
      impact.shift_type,
      impact.missing_skill_count
  ),
  cover_packages as (
    select
      impact.*,
      members.engineer_names,
      members.team_names
    from package_impact impact
    join package_members members
      on members.shift_date = impact.shift_date
     and members.shift_type = impact.shift_type
  )
  select
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'shiftDate', candidate.shift_date,
          'shiftType', candidate.shift_type,
          'engineerName', candidate.full_name,
          'discipline', candidate.discipline,
          'currentTeam', candidate.team_name,
          'candidateRank', candidate.candidate_rank,
          'gapsImproved', candidate.gaps_improved,
          'gapsClosed', candidate.gaps_closed,
          'remainingMissingSkills', greatest(
            candidate.missing_skill_count - candidate.gaps_closed,
            0
          ),
          'criticalGapsCovered', candidate.critical_gaps_covered,
          'assetsProtected', candidate.assets_protected,
          'skillsSupplied', candidate.skills_supplied,
          'topSkills', candidate.top_skills,
          'topAssets', candidate.top_assets,
          'restConflict', candidate.adjacent_shift_conflict,
          'availabilityStatus', case
            when candidate.adjacent_shift_conflict
              then 'rest_conflict_review_required'
            else 'off_rota_confirmation_required'
          end
        )
        order by
          candidate.shift_date,
          case candidate.shift_type when 'day' then 1 else 2 end,
          candidate.candidate_rank
      )
      from ranked_candidates candidate
      where candidate.candidate_rank <= 3
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'shiftDate', package.shift_date,
          'shiftType', package.shift_type,
          'engineerNames', package.engineer_names,
          'teamNames', package.team_names,
          'gapsImproved', package.gaps_improved,
          'gapsClosed', package.gaps_closed,
          'missingSkillsClosed', package.missing_skills_closed,
          'remainingMissingSkills', greatest(
            package.missing_skill_count - package.missing_skills_closed,
            0
          ),
          'assetsWithClosedGaps', package.assets_with_closed_gaps,
          'closedSkills', coalesce(package.closed_skills, array[]::text[]),
          'protectedAssets', coalesce(package.protected_assets, array[]::text[]),
          'status', 'provisional_confirm_availability_and_fatigue'
        )
        order by
          package.shift_date,
          case package.shift_type when 'day' then 1 else 2 end
      )
      from cover_packages package
    ), '[]'::jsonb)
  into v_cover_candidates, v_cover_packages;

  return jsonb_build_object(
    'mode', 'live',
    'siteId', p_site_id,
    'generatedAt', now(),
    'startDate', p_start_date,
    'endDate', p_end_date,
    'calendar', v_calendar,
    'exceptions', v_exceptions,
    'absenceSummary', jsonb_build_object(
      'recordedExceptionCount', jsonb_array_length(v_exceptions),
      'recordedUnavailableCount', (
        select count(*)::integer
        from public.maintenance_shift_exceptions exception
        where exception.site_id = p_site_id
          and exception.shift_date between p_start_date and p_end_date
          and not exception.is_available
      ),
      'recordedAvailableCoverCount', (
        select count(*)::integer
        from public.maintenance_shift_exceptions exception
        where exception.site_id = p_site_id
          and exception.shift_date between p_start_date and p_end_date
          and exception.is_available
      )
    ),
    'skillRisks', v_skill_risks,
    'offRota', v_off_rota,
    'coverCandidates', v_cover_candidates,
    'coverPackages', v_cover_packages,
    'decisionNotes', jsonb_build_array(
      'Off-rota does not mean confirmed available.',
      'Confirm overtime acceptance, fatigue controls and any unrecorded leave before changing cover.',
      'Candidate impact is based on validated Vorta skill evidence and the current equipment requirements.'
    )
  );
end;
$function$;

revoke all on function public.vorta_get_shift_cover_ai_brief(uuid, date, date)
from public, anon;
grant execute on function public.vorta_get_shift_cover_ai_brief(uuid, date, date)
to authenticated, service_role;

comment on function public.vorta_get_shift_cover_ai_brief(uuid, date, date) is
  'Returns authorised dated Shift Cover, absences, rota-off engineers, skill exposure and ranked competent cover candidates for Ask Vorta.';
