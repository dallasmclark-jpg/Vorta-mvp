create or replace function public.vorta_get_shift_calendar(
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
  select *
  from public.vorta_get_shift_calendar_internal(
    p_site_id,
    p_start_date,
    p_end_date
  );
end;
$function$;

create or replace function public.vorta_get_shift_roster(
  p_site_id uuid,
  p_shift_date date,
  p_shift_type text
)
returns table(
  engineer_id uuid,
  full_name text,
  discipline text,
  employment_type text,
  team_code text,
  team_name text,
  roster_source text,
  is_contractor boolean
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
  select *
  from public.vorta_get_shift_roster_internal(
    p_site_id,
    p_shift_date,
    p_shift_type
  );
end;
$function$;

create or replace function public.vorta_get_site_labour_risk(
  p_site_id uuid,
  p_shift_date date default null,
  p_shift_type text default null
)
returns table(
  site_id uuid,
  shift_date date,
  shift_type text,
  scheduled_engineer_count integer,
  contractor_engineer_count integer,
  equipment_with_missing_cover integer,
  high_critical_equipment_without_cover integer,
  missing_skill_count integer,
  labour_risk_score numeric,
  labour_risk_level text,
  no_engineer_override boolean,
  engineer_names text[]
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
  select *
  from public.vorta_get_site_labour_risk_internal(
    p_site_id,
    p_shift_date,
    p_shift_type
  );
end;
$function$;

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
        'memberCount', (
          select count(*)::integer
          from public.maintenance_shift_team_members member
          where member.team_id = team.id
            and member.active_from <= p_end_date
            and (member.active_to is null or member.active_to >= p_start_date)
        )
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

  return jsonb_build_object(
    'mode', 'live',
    'siteId', p_site_id,
    'generatedAt', now(),
    'sourceUpdatedAt', v_source_updated_at,
    'calendar', v_calendar,
    'teams', v_teams,
    'completeness', jsonb_build_object(
      'activeTeamCount', v_active_team_count,
      'activeMemberCount', v_active_member_count,
      'engineerCount', v_engineer_count,
      'skillRecordCount', v_skill_record_count
    )
  );
end;
$function$;

revoke all on function public.vorta_get_shift_cover_snapshot(uuid, date, date)
from public, anon;
grant execute on function public.vorta_get_shift_cover_snapshot(uuid, date, date)
to authenticated, service_role;

create or replace function private.vorta_test_site_isolation(
  p_user_id uuid,
  p_allowed_site_id uuid,
  p_denied_site_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_previous_claims text := current_setting('request.jwt.claims', true);
  v_previous_sub text := current_setting('request.jwt.claim.sub', true);
  v_previous_role text := current_setting('request.jwt.claim.role', true);
  v_allowed boolean;
  v_denied boolean;
  v_denied_calendar_rows integer;
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_user_id,
      'role', 'authenticated'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_allowed := public.vorta_has_site_access(p_allowed_site_id, false);
  v_denied := public.vorta_has_site_access(p_denied_site_id, false);

  select count(*)::integer
  into v_denied_calendar_rows
  from public.vorta_get_shift_calendar(
    p_denied_site_id,
    current_date,
    current_date + 6
  );

  perform set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(v_previous_role, ''), true);

  return jsonb_build_object(
    'userId', p_user_id,
    'allowedSiteId', p_allowed_site_id,
    'deniedSiteId', p_denied_site_id,
    'allowedSiteAccess', v_allowed,
    'deniedSiteAccess', v_denied,
    'deniedShiftCalendarRows', v_denied_calendar_rows,
    'passed', v_allowed and not v_denied and v_denied_calendar_rows = 0
  );
exception
  when others then
    perform set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);
    perform set_config('request.jwt.claim.role', coalesce(v_previous_role, ''), true);
    raise;
end;
$function$;

revoke all on function private.vorta_test_site_isolation(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function private.vorta_test_site_isolation(uuid, uuid, uuid)
to service_role;
