create or replace function public.vorta_get_engineer_rota_window(
  p_engineer_id uuid,
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
  v_site_id uuid;
  v_source_updated_at timestamptz;
  v_calendar jsonb;
begin
  if p_engineer_id is null
    or p_start_date is null
    or p_end_date is null
    or p_end_date < p_start_date
    or p_end_date - p_start_date > 400 then
    raise exception 'Engineer rota window must use a valid engineer and a date range of 401 days or fewer.';
  end if;

  select e.site_id
  into v_site_id
  from public.engineers e
  where e.id = p_engineer_id;

  if v_site_id is null then
    return null;
  end if;

  if not public.vorta_has_site_access(v_site_id, false) then
    return null;
  end if;

  select nullif(
    greatest(
      coalesce((select max(t.updated_at) from public.maintenance_shift_teams t where t.site_id = v_site_id), '-infinity'::timestamptz),
      coalesce((select max(m.created_at) from public.maintenance_shift_team_members m join public.maintenance_shift_teams t on t.id = m.team_id where t.site_id = v_site_id), '-infinity'::timestamptz),
      coalesce((select max(e.updated_at) from public.engineers e where e.site_id = v_site_id), '-infinity'::timestamptz),
      coalesce((select max(x.created_at) from public.maintenance_shift_exceptions x where x.site_id = v_site_id), '-infinity'::timestamptz)
    ),
    '-infinity'::timestamptz
  ) into v_source_updated_at;

  with shifts as (
    select
      d::date as shift_date,
      s.shift_type
    from generate_series(p_start_date, p_end_date, interval '1 day') d
    cross join (values ('day'::text), ('night'::text)) s(shift_type)
  ),
  scheduled_teams as (
    select
      shift.shift_date,
      shift.shift_type,
      team.id as team_id,
      team.name as team_name
    from shifts shift
    join public.maintenance_shift_teams team
      on team.site_id = v_site_id
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
  scheduled_people as (
    select
      scheduled.shift_date,
      scheduled.shift_type,
      engineer.id as engineer_id,
      engineer.full_name,
      engineer.discipline,
      engineer.employment_type,
      scheduled.team_name,
      'scheduled'::text as roster_source,
      exception.exception_type,
      coalesce(exception.is_available, true) as is_available,
      lower(coalesce(engineer.employment_type, '')) like '%contract%' as is_contractor
    from scheduled_teams scheduled
    join public.maintenance_shift_team_members member
      on member.team_id = scheduled.team_id
     and member.active_from <= scheduled.shift_date
     and (member.active_to is null or member.active_to >= scheduled.shift_date)
    join public.engineers engineer
      on engineer.id = member.engineer_id
    left join lateral (
      select x.exception_type, x.is_available
      from public.maintenance_shift_exceptions x
      where x.site_id = v_site_id
        and x.shift_date = scheduled.shift_date
        and x.shift_type = scheduled.shift_type
        and (
          x.engineer_id = engineer.id
          or (x.engineer_id is null and x.team_id = scheduled.team_id)
        )
      order by (x.engineer_id is not null) desc, x.created_at desc
      limit 1
    ) exception on true
  ),
  added_people as (
    select
      x.shift_date,
      x.shift_type,
      engineer.id as engineer_id,
      engineer.full_name,
      engineer.discipline,
      engineer.employment_type,
      coalesce(team.name, 'Additional cover') as team_name,
      x.exception_type as roster_source,
      x.exception_type,
      true as is_available,
      (
        x.exception_type = 'contractor_cover'
        or lower(coalesce(engineer.employment_type, '')) like '%contract%'
      ) as is_contractor
    from public.maintenance_shift_exceptions x
    join public.engineers engineer on engineer.id = x.engineer_id
    left join public.maintenance_shift_teams team on team.id = x.team_id
    where x.site_id = v_site_id
      and x.shift_date between p_start_date and p_end_date
      and x.is_available
      and x.exception_type in ('overtime', 'contractor_cover', 'manual_assignment')
  ),
  combined as (
    select * from scheduled_people
    union all
    select * from added_people
  ),
  people as materialized (
    select
      c.shift_date,
      c.shift_type,
      c.engineer_id,
      max(c.full_name) as full_name,
      max(c.discipline) as discipline,
      max(c.employment_type) as employment_type,
      coalesce(array_agg(distinct c.team_name order by c.team_name) filter (where c.team_name is not null), array[]::text[]) as team_names,
      case
        when bool_or(not c.is_available) then 'exception'
        when bool_or(c.roster_source <> 'scheduled') then max(c.roster_source) filter (where c.roster_source <> 'scheduled')
        else 'scheduled'
      end as roster_source,
      coalesce(
        max(c.exception_type) filter (where not c.is_available),
        max(c.exception_type) filter (where c.roster_source <> 'scheduled')
      ) as exception_type,
      not bool_or(not c.is_available) as is_available,
      bool_or(c.is_contractor) as is_contractor
    from combined c
    group by c.shift_date, c.shift_type, c.engineer_id
  ),
  shift_summary as (
    select
      p.shift_date,
      p.shift_type,
      count(*)::integer as shift_engineer_count,
      count(*) filter (where p.is_available)::integer as available_engineer_count,
      count(*) filter (
        where p.engineer_id <> p_engineer_id
          and not p.is_available
          and p.exception_type = 'annual_leave'
      )::integer as holiday_clash_count,
      count(*) filter (
        where p.engineer_id <> p_engineer_id
          and not p.is_available
          and p.exception_type = 'sickness'
      )::integer as sickness_count,
      count(*) filter (
        where p.engineer_id <> p_engineer_id
          and not p.is_available
          and p.exception_type = 'training'
      )::integer as training_count,
      count(*) filter (
        where p.engineer_id <> p_engineer_id
          and not p.is_available
      )::integer as unavailable_count,
      count(*) filter (where p.is_contractor)::integer as contractor_engineer_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'engineerId', p.engineer_id,
            'fullName', p.full_name,
            'discipline', p.discipline,
            'employmentType', p.employment_type,
            'teamNames', p.team_names,
            'rosterSource', p.roster_source,
            'exceptionType', p.exception_type,
            'isAvailable', p.is_available,
            'isContractor', p.is_contractor
          )
          order by p.full_name
        ) filter (where p.engineer_id <> p_engineer_id),
        '[]'::jsonb
      ) as colleagues
    from people p
    group by p.shift_date, p.shift_type
  ),
  personal as (
    select p.*
    from people p
    where p.engineer_id = p_engineer_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'shiftDate', personal.shift_date,
        'shiftType', personal.shift_type,
        'teamNames', personal.team_names,
        'personalStatus', case
          when personal.is_available then 'scheduled'
          else coalesce(personal.exception_type, 'unavailable')
        end,
        'shiftEngineerCount', summary.shift_engineer_count,
        'availableEngineerCount', summary.available_engineer_count,
        'holidayClashCount', summary.holiday_clash_count,
        'sicknessCount', summary.sickness_count,
        'trainingCount', summary.training_count,
        'unavailableCount', summary.unavailable_count,
        'contractorEngineerCount', summary.contractor_engineer_count,
        'colleagues', summary.colleagues
      )
      order by personal.shift_date, case personal.shift_type when 'day' then 1 else 2 end
    ),
    '[]'::jsonb
  ) into v_calendar
  from personal
  join shift_summary summary
    on summary.shift_date = personal.shift_date
   and summary.shift_type = personal.shift_type;

  return jsonb_build_object(
    'mode', 'live',
    'siteId', v_site_id,
    'engineerId', p_engineer_id,
    'generatedAt', now(),
    'sourceUpdatedAt', v_source_updated_at,
    'calendar', v_calendar
  );
end;
$function$;

revoke all on function public.vorta_get_engineer_rota_window(uuid, date, date) from public;
grant execute on function public.vorta_get_engineer_rota_window(uuid, date, date) to authenticated;
