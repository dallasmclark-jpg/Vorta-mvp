create table public.engineer_calendar_entries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  engineer_id uuid not null references public.engineers(id) on delete cascade,
  entry_date date not null,
  entry_type text not null check (entry_type in ('note','training','overtime','annual_leave','appointment','other')),
  title text not null,
  notes text,
  hours numeric(5,2) check (hours is null or (hours >= 0 and hours <= 24)),
  shift_type text check (shift_type is null or shift_type in ('day','night')),
  status text not null default 'planned' check (status in ('planned','completed','cancelled')),
  course_id uuid references public.training_courses(id) on delete set null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index engineer_calendar_entries_engineer_date_idx on public.engineer_calendar_entries(engineer_id, entry_date);
create index engineer_calendar_entries_site_date_idx on public.engineer_calendar_entries(site_id, entry_date);

alter table public.engineer_calendar_entries enable row level security;

create policy engineer_calendar_entries_select_own on public.engineer_calendar_entries
for select to authenticated
using (exists (
  select 1 from public.engineers e
  where e.id = engineer_calendar_entries.engineer_id
    and e.site_id = engineer_calendar_entries.site_id
    and (e.profile_id = auth.uid() or e.id::text = coalesce(auth.jwt()->'app_metadata'->>'engineer_id', ''))
));

create policy engineer_calendar_entries_insert_own on public.engineer_calendar_entries
for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.engineers e
    where e.id = engineer_calendar_entries.engineer_id
      and e.site_id = engineer_calendar_entries.site_id
      and e.organisation_id = engineer_calendar_entries.organisation_id
      and (e.profile_id = auth.uid() or e.id::text = coalesce(auth.jwt()->'app_metadata'->>'engineer_id', ''))
  )
);

create policy engineer_calendar_entries_update_own on public.engineer_calendar_entries
for update to authenticated
using (exists (
  select 1 from public.engineers e
  where e.id = engineer_calendar_entries.engineer_id
    and (e.profile_id = auth.uid() or e.id::text = coalesce(auth.jwt()->'app_metadata'->>'engineer_id', ''))
))
with check (exists (
  select 1 from public.engineers e
  where e.id = engineer_calendar_entries.engineer_id
    and e.site_id = engineer_calendar_entries.site_id
    and e.organisation_id = engineer_calendar_entries.organisation_id
    and (e.profile_id = auth.uid() or e.id::text = coalesce(auth.jwt()->'app_metadata'->>'engineer_id', ''))
));

create policy engineer_calendar_entries_delete_own on public.engineer_calendar_entries
for delete to authenticated
using (exists (
  select 1 from public.engineers e
  where e.id = engineer_calendar_entries.engineer_id
    and (e.profile_id = auth.uid() or e.id::text = coalesce(auth.jwt()->'app_metadata'->>'engineer_id', ''))
));

create or replace function public.vorta_get_my_engineer_calendar(p_site_id uuid, p_start_date date, p_end_date date)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog','public'
as $function$
declare
  v_engineer_id uuid;
  v_entries jsonb;
  v_formal_training jsonb;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date or p_end_date - p_start_date > 400 then
    raise exception 'Engineer calendar range must be between 1 and 401 days.';
  end if;
  if not public.vorta_has_site_access(p_site_id, false) then return null; end if;

  select e.id into v_engineer_id from public.engineers e
  where e.site_id = p_site_id
    and (e.profile_id = auth.uid() or e.id::text = coalesce(auth.jwt()->'app_metadata'->>'engineer_id', ''))
  limit 1;
  if v_engineer_id is null then return null; end if;

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
    'createdAt', entry.created_at,
    'updatedAt', entry.updated_at
  ) order by entry.entry_date, entry.created_at), '[]'::jsonb)
  into v_entries
  from public.engineer_calendar_entries entry
  where entry.engineer_id = v_engineer_id and entry.entry_date between p_start_date and p_end_date;

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

create or replace function public.vorta_save_my_engineer_calendar_entry(
  p_site_id uuid,
  p_entry_date date,
  p_entry_type text,
  p_title text,
  p_notes text default null,
  p_hours numeric default null,
  p_shift_type text default null,
  p_status text default 'planned',
  p_course_id uuid default null,
  p_entry_id uuid default null
) returns jsonb
language plpgsql security definer set search_path to 'pg_catalog','public'
as $function$
declare
  v_engineer public.engineers%rowtype;
  v_entry public.engineer_calendar_entries%rowtype;
begin
  if not public.vorta_has_site_access(p_site_id, false) then raise exception 'No authorised site access.'; end if;
  if p_entry_date is null then raise exception 'Entry date is required.'; end if;
  if p_entry_type not in ('note','training','overtime','annual_leave','appointment','other') then raise exception 'Unsupported entry type.'; end if;
  if p_status not in ('planned','completed','cancelled') then raise exception 'Unsupported entry status.'; end if;
  if p_shift_type is not null and p_shift_type not in ('day','night') then raise exception 'Unsupported shift type.'; end if;
  if p_hours is not null and (p_hours < 0 or p_hours > 24) then raise exception 'Hours must be between 0 and 24.'; end if;
  if p_title is null or not length(trim(p_title)) between 1 and 160 then raise exception 'Title is required and must be 160 characters or fewer.'; end if;

  select e.* into v_engineer from public.engineers e
  where e.site_id = p_site_id
    and (e.profile_id = auth.uid() or e.id::text = coalesce(auth.jwt()->'app_metadata'->>'engineer_id', ''))
  limit 1;
  if v_engineer.id is null then raise exception 'Engineer profile could not be resolved.'; end if;

  if p_entry_id is null then
    insert into public.engineer_calendar_entries (
      organisation_id, site_id, engineer_id, entry_date, entry_type, title, notes, hours, shift_type, status, course_id, created_by
    ) values (
      v_engineer.organisation_id, v_engineer.site_id, v_engineer.id, p_entry_date, p_entry_type, trim(p_title),
      nullif(trim(coalesce(p_notes,'')),''), p_hours, p_shift_type, p_status, p_course_id, auth.uid()
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
        updated_at = now()
    where entry.id = p_entry_id and entry.engineer_id = v_engineer.id and entry.site_id = v_engineer.site_id
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
    'createdAt', v_entry.created_at,
    'updatedAt', v_entry.updated_at
  );
end;
$function$;

create or replace function public.vorta_delete_my_engineer_calendar_entry(p_site_id uuid, p_entry_id uuid)
returns boolean language plpgsql security definer set search_path to 'pg_catalog','public'
as $function$
declare
  v_engineer_id uuid;
  v_deleted integer;
begin
  if not public.vorta_has_site_access(p_site_id, false) then return false; end if;
  select e.id into v_engineer_id from public.engineers e
  where e.site_id = p_site_id
    and (e.profile_id = auth.uid() or e.id::text = coalesce(auth.jwt()->'app_metadata'->>'engineer_id', ''))
  limit 1;
  if v_engineer_id is null then return false; end if;

  delete from public.engineer_calendar_entries
  where id = p_entry_id and engineer_id = v_engineer_id and site_id = p_site_id;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$function$;

grant execute on function public.vorta_get_my_engineer_calendar(uuid,date,date) to authenticated;
grant execute on function public.vorta_save_my_engineer_calendar_entry(uuid,date,text,text,text,numeric,text,text,uuid,uuid) to authenticated;
grant execute on function public.vorta_delete_my_engineer_calendar_entry(uuid,uuid) to authenticated;
