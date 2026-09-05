alter function public.vorta_get_engineer_rota_window(uuid,date,date)
  rename to vorta_get_engineer_rota_window_internal;

alter function public.vorta_get_engineer_rota_window_internal(uuid,date,date)
  set schema private;

revoke all on function private.vorta_get_engineer_rota_window_internal(uuid,date,date)
  from public, anon, authenticated;
grant execute on function private.vorta_get_engineer_rota_window_internal(uuid,date,date)
  to service_role;

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
  v_snapshot jsonb;
  v_calendar jsonb;
  v_caller_engineer_id uuid;
begin
  if p_engineer_id is null
    or p_start_date is null
    or p_end_date is null
    or p_end_date < p_start_date
    or p_end_date - p_start_date > 400 then
    raise exception 'Engineer rota window must use a valid engineer and a date range of 401 days or fewer.';
  end if;

  if auth.role() <> 'service_role' then
    if auth.uid() is null then
      raise exception 'Authentication required' using errcode = '28000';
    end if;

    select e.id
      into v_caller_engineer_id
    from public.engineers e
    where e.id = p_engineer_id
      and (
        e.profile_id = auth.uid()
        or e.id::text = coalesce(auth.jwt()->'app_metadata'->>'engineer_id', '')
      )
    limit 1;

    if v_caller_engineer_id is null then
      raise exception 'Engineer rota access is limited to the authenticated engineer.' using errcode = '42501';
    end if;
  end if;

  v_snapshot := private.vorta_get_engineer_rota_window_internal(
    p_engineer_id,
    p_start_date,
    p_end_date
  );

  if v_snapshot is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      (shift_item - 'holidayClashCount' - 'sicknessCount' - 'trainingCount' - 'colleagues')
      || jsonb_build_object(
        'holidayClashCount', 0,
        'sicknessCount', 0,
        'trainingCount', 0,
        'absenceReasonsRedacted', true,
        'colleagues', coalesce(
          (
            select jsonb_agg(
              (colleague_item - 'exceptionType')
              || jsonb_build_object(
                'exceptionType',
                case
                  when coalesce((colleague_item->>'isAvailable')::boolean, false)
                    then null
                  else 'unavailable'
                end
              )
              order by colleague_item->>'fullName'
            )
            from jsonb_array_elements(
              coalesce(shift_item->'colleagues', '[]'::jsonb)
            ) as colleague_item
          ),
          '[]'::jsonb
        )
      )
      order by shift_item->>'shiftDate', shift_item->>'shiftType'
    ),
    '[]'::jsonb
  )
    into v_calendar
  from jsonb_array_elements(
    coalesce(v_snapshot->'calendar', '[]'::jsonb)
  ) as shift_item;

  return (v_snapshot - 'calendar')
    || jsonb_build_object(
      'calendar', v_calendar,
      'absenceReasonsRedacted', true
    );
end;
$function$;

revoke all on function public.vorta_get_engineer_rota_window(uuid,date,date)
  from public, anon;
grant execute on function public.vorta_get_engineer_rota_window(uuid,date,date)
  to authenticated, service_role;
