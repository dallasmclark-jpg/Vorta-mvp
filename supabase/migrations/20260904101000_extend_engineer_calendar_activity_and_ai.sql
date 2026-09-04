-- Extend the Engineer mobile calendar into a personal activity record.
-- Live-safe: existing calendar RPCs remain available while the client moves to the v2 save RPC.

alter table public.engineer_calendar_entries
  add column if not exists equipment_name text;

alter table public.engineer_calendar_entries
  drop constraint if exists engineer_calendar_entries_entry_type_check;

alter table public.engineer_calendar_entries
  add constraint engineer_calendar_entries_entry_type_check
  check (entry_type = any (array[
    'note'::text,
    'training'::text,
    'overtime'::text,
    'annual_leave'::text,
    'appointment'::text,
    'shift_cover'::text,
    'development'::text,
    'other'::text
  ]));

alter table public.engineer_calendar_entries
  drop constraint if exists engineer_calendar_entries_equipment_name_check;

alter table public.engineer_calendar_entries
  add constraint engineer_calendar_entries_equipment_name_check
  check (equipment_name is null or length(equipment_name) <= 160);

create or replace function public.vorta_get_my_engineer_calendar(
  p_site_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_engineer_id uuid;
  v_entries jsonb;
  v_formal_training jsonb;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date or p_end_date - p_start_date > 400 then
    raise exception 'Engineer calendar range must be between 1 and 401 days.';
  end if;

  if not public.vorta_has_site_access(p_site_id, false) then
    return null;
  end if;

  select e.id into v_engineer_id
  from public.engineers e
  where e.site_id = p_site_id
    and (
      e.profile_id = auth.uid()
      or e.id::text = coalesce(auth.jwt()->'app_metadata'->>'engineer_id', '')
    )
  limit 1;

  if v_engineer_id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', entry.id,
    'entryDate', entry.entry_date,
    'entryType', entry.entry_type,
    'title', entry.title,
    'notes', entry.notes,
    'hours', entry.hours,
    'shiftType', entry.shift_type,
    'status', entry.status,
    'courseId', entry.course_id,
    'equipmentName', entry.equipment_name,
    'createdAt', entry.created_at,
    'updatedAt', entry.updated_at
  ) order by entry.entry_date, entry.created_at), '[]'::jsonb)
  into v_entries
  from public.engineer_calendar_entries entry
  where entry.engineer_id = v_engineer_id
    and entry.entry_date between p_start_date and p_end_date;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', booking.id,
    'entryDate', coalesce(booking.booking_date, booking.requested_date),
    'entryType', 'training',
    'title', coalesce(course.title, 'Training booking'),
    'notes', booking.notes,
    'hours', case when course.duration_days is not null then course.duration_days * 12 else null end,
    'shiftType', null,
    'status', case when booking.status = 'completed' then 'completed' else 'planned' end,
    'courseId', booking.course_id,
    'equipmentName', null,
    'bookingStatus', booking.status,
    'source', 'training_booking'
  ) order by coalesce(booking.booking_date, booking.requested_date)), '[]'::jsonb)
  into v_formal_training
  from public.training_bookings booking
  left join public.training_courses course on course.id = booking.course_id
  where booking.engineer_id = v_engineer_id
    and coalesce(booking.booking_date, booking.requested_date) between p_start_date and p_end_date
    and booking.status <> 'cancelled';

  return jsonb_build_object(
    'engineerId', v_engineer_id,
    'startDate', p_start_date,
    'endDate', p_end_date,
    'entries', v_entries,
    'formalTraining', v_formal_training
  );
end;
$function$;

create or replace function public.vorta_save_my_engineer_calendar_entry_v2(
  p_site_id uuid,
  p_entry_date date,
  p_entry_type text,
  p_title text,
  p_notes text default null,
  p_hours numeric default null,
  p_shift_type text default null,
  p_status text default 'planned',
  p_course_id uuid default null,
  p_entry_id uuid default null,
  p_equipment_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_engineer public.engineers%rowtype;
  v_entry public.engineer_calendar_entries%rowtype;
  v_equipment_name text;
begin
  if not public.vorta_has_site_access(p_site_id, false) then
    raise exception 'No authorised site access.';
  end if;

  if p_entry_date is null then raise exception 'Entry date is required.'; end if;
  if p_entry_type not in ('note','training','overtime','annual_leave','appointment','shift_cover','development','other') then raise exception 'Unsupported entry type.'; end if;
  if p_status not in ('planned','completed','cancelled') then raise exception 'Unsupported entry status.'; end if;
  if p_shift_type is not null and p_shift_type not in ('day','night') then raise exception 'Unsupported shift type.'; end if;
  if p_hours is not null and (p_hours < 0 or p_hours > 24) then raise exception 'Hours must be between 0 and 24.'; end if;
  if p_title is null or not length(trim(p_title)) between 1 and 160 then raise exception 'Title is required and must be 160 characters or fewer.'; end if;

  v_equipment_name := nullif(trim(coalesce(p_equipment_name, '')), '');
  if v_equipment_name is not null and length(v_equipment_name) > 160 then
    raise exception 'Equipment name must be 160 characters or fewer.';
  end if;

  select e.* into v_engineer
  from public.engineers e
  where e.site_id = p_site_id
    and (
      e.profile_id = auth.uid()
      or e.id::text = coalesce(auth.jwt()->'app_metadata'->>'engineer_id', '')
    )
  limit 1;

  if v_engineer.id is null then raise exception 'Engineer profile could not be resolved.'; end if;

  if p_entry_id is null then
    insert into public.engineer_calendar_entries (
      organisation_id, site_id, engineer_id, entry_date, entry_type, title, notes, hours, shift_type, status, course_id, equipment_name, created_by
    ) values (
      v_engineer.organisation_id, v_engineer.site_id, v_engineer.id, p_entry_date, p_entry_type, trim(p_title), nullif(trim(coalesce(p_notes,'')),''), p_hours, p_shift_type, p_status, p_course_id, v_equipment_name, auth.uid()
    ) returning * into v_entry;
  else
    update public.engineer_calendar_entries entry
    set entry_date = p_entry_date,
        entry_type = p_entry_type,
        title = trim(p_title),
        notes = nullif(trim(coalesce(p_notes,'')),''),
        hours = p_hours,
        shift_type = p_shift_type,
        status = p_status,
        course_id = p_course_id,
        equipment_name = v_equipment_name,
        updated_at = now()
    where entry.id = p_entry_id
      and entry.engineer_id = v_engineer.id
      and entry.site_id = v_engineer.site_id
    returning entry.* into v_entry;

    if v_entry.id is null then raise exception 'Calendar entry was not found for this engineer.'; end if;
  end if;

  return jsonb_build_object(
    'id', v_entry.id,
    'entryDate', v_entry.entry_date,
    'entryType', v_entry.entry_type,
    'title', v_entry.title,
    'notes', v_entry.notes,
    'hours', v_entry.hours,
    'shiftType', v_entry.shift_type,
    'status', v_entry.status,
    'courseId', v_entry.course_id,
    'equipmentName', v_entry.equipment_name,
    'createdAt', v_entry.created_at,
    'updatedAt', v_entry.updated_at
  );
end;
$function$;

create or replace function public.vorta_ask_my_calendar(
  p_site_id uuid,
  p_question text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_engineer_id uuid;
  v_question text := lower(trim(coalesce(p_question, '')));
  v_year integer := extract(year from current_date)::integer;
  v_answer text;
  v_count integer := 0;
  v_hours numeric := 0;
  v_items text;
  v_next_date date;
  v_next_title text;
  v_next_equipment text;
begin
  if v_question = '' then
    raise exception 'Question is required.';
  end if;

  if not public.vorta_has_site_access(p_site_id, false) then
    raise exception 'No authorised site access.';
  end if;

  select e.id into v_engineer_id
  from public.engineers e
  where e.site_id = p_site_id
    and (
      e.profile_id = auth.uid()
      or e.id::text = coalesce(auth.jwt()->'app_metadata'->>'engineer_id', '')
    )
  limit 1;

  if v_engineer_id is null then
    raise exception 'Engineer profile could not be resolved.';
  end if;

  if v_question like '%next%training%' then
    with training_items as (
      select entry.entry_date, entry.title, entry.equipment_name, entry.status
      from public.engineer_calendar_entries entry
      where entry.engineer_id = v_engineer_id
        and entry.site_id = p_site_id
        and entry.entry_type = 'training'
      union all
      select coalesce(booking.booking_date, booking.requested_date),
             coalesce(course.title, 'Training booking'),
             null::text,
             case when booking.status = 'completed' then 'completed' else 'planned' end
      from public.training_bookings booking
      left join public.training_courses course on course.id = booking.course_id
      where booking.engineer_id = v_engineer_id
        and booking.status <> 'cancelled'
    )
    select entry_date, title, equipment_name
    into v_next_date, v_next_title, v_next_equipment
    from training_items
    where status = 'planned'
      and entry_date >= current_date
    order by entry_date, title
    limit 1;

    if v_next_date is null then
      v_answer := 'You have no upcoming training planned.';
    else
      v_answer := 'Your next planned training is ' || v_next_title || ' on ' || to_char(v_next_date, 'FMDD Mon YYYY') ||
        case when v_next_equipment is not null then ' for ' || v_next_equipment else '' end || '.';
    end if;

  elsif v_question like '%training%' then
    with training_items as (
      select entry.entry_date, entry.title, entry.equipment_name, entry.status
      from public.engineer_calendar_entries entry
      where entry.engineer_id = v_engineer_id
        and entry.site_id = p_site_id
        and entry.entry_type = 'training'
      union all
      select coalesce(booking.booking_date, booking.requested_date),
             coalesce(course.title, 'Training booking'),
             null::text,
             case when booking.status = 'completed' then 'completed' else 'planned' end
      from public.training_bookings booking
      left join public.training_courses course on course.id = booking.course_id
      where booking.engineer_id = v_engineer_id
        and booking.status <> 'cancelled'
    )
    select count(*), string_agg(
      to_char(entry_date, 'FMDD Mon') || ' · ' || title || case when equipment_name is not null then ' · ' || equipment_name else '' end,
      E'\n' order by entry_date, title
    )
    into v_count, v_items
    from training_items
    where extract(year from entry_date) = v_year
      and case
        when v_question like '%completed%' or v_question like '%done%' then status = 'completed'
        when v_question like '%planned%' or v_question like '%plan%' then status = 'planned'
        else status <> 'cancelled'
      end;

    v_answer := case
      when v_count = 0 then 'You have no matching training entries for ' || v_year || '.'
      else 'You have ' || v_count || ' matching training ' || case when v_count = 1 then 'entry' else 'entries' end || ' in ' || v_year || ':' || E'\n' || v_items
    end;

  elsif v_question like '%overtime%' then
    select count(*), coalesce(sum(hours), 0)
    into v_count, v_hours
    from public.engineer_calendar_entries
    where engineer_id = v_engineer_id
      and site_id = p_site_id
      and entry_type = 'overtime'
      and extract(year from entry_date) = v_year
      and case
        when v_question like '%planned%' or v_question like '%plan%' then status = 'planned'
        when v_question like '%done%' or v_question like '%worked%' or v_question like '%completed%' then status = 'completed'
        else status <> 'cancelled'
      end;

    v_answer := 'In ' || v_year || ' you have ' || v_count || ' matching overtime ' || case when v_count = 1 then 'shift' else 'shifts' end ||
      case when v_hours > 0 then ', totalling ' || trim(to_char(v_hours, 'FM999990.##')) || ' hours' else '' end || '.';

  elsif v_question like '%development%' then
    select count(*), string_agg(to_char(entry_date, 'FMDD Mon') || ' · ' || title, E'\n' order by entry_date, created_at)
    into v_count, v_items
    from public.engineer_calendar_entries
    where engineer_id = v_engineer_id
      and site_id = p_site_id
      and entry_type = 'development'
      and extract(year from entry_date) = v_year
      and status <> 'cancelled';

    v_answer := case when v_count = 0 then 'You have no development entries for ' || v_year || '.' else 'Your development activity for ' || v_year || ':' || E'\n' || v_items end;

  elsif v_question like '%shift cover%' or v_question like '%shift_cover%' then
    select count(*), string_agg(to_char(entry_date, 'FMDD Mon') || ' · ' || title, E'\n' order by entry_date, created_at)
    into v_count, v_items
    from public.engineer_calendar_entries
    where engineer_id = v_engineer_id
      and site_id = p_site_id
      and entry_type = 'shift_cover'
      and extract(year from entry_date) = v_year
      and status <> 'cancelled';

    v_answer := case when v_count = 0 then 'You have no shift-cover entries for ' || v_year || '.' else 'Your shift-cover activity for ' || v_year || ':' || E'\n' || v_items end;

  else
    select count(*) into v_count
    from public.engineer_calendar_entries
    where engineer_id = v_engineer_id
      and site_id = p_site_id
      and extract(year from entry_date) = v_year
      and status <> 'cancelled';

    v_answer := 'You have ' || v_count || ' personal calendar entries in ' || v_year || '. Ask about training, overtime, your next training, shift cover, or development activity for a more specific answer.';
  end if;

  return jsonb_build_object(
    'answer', v_answer,
    'year', v_year,
    'engineerId', v_engineer_id,
    'scope', 'self'
  );
end;
$function$;

revoke all on function public.vorta_save_my_engineer_calendar_entry_v2(uuid,date,text,text,text,numeric,text,text,uuid,uuid,text) from public;
grant execute on function public.vorta_save_my_engineer_calendar_entry_v2(uuid,date,text,text,text,numeric,text,text,uuid,uuid,text) to authenticated;

revoke all on function public.vorta_ask_my_calendar(uuid,text) from public;
grant execute on function public.vorta_ask_my_calendar(uuid,text) to authenticated;
