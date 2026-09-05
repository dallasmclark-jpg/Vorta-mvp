drop policy if exists engineer_calendar_entries_select_own on public.engineer_calendar_entries;
create policy engineer_calendar_entries_select_own
on public.engineer_calendar_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.engineers e
    where e.id = engineer_calendar_entries.engineer_id
      and e.site_id = engineer_calendar_entries.site_id
      and (
        e.profile_id = (select auth.uid())
        or e.id::text = coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'engineer_id'), '')
      )
  )
);

drop policy if exists engineer_calendar_entries_insert_own on public.engineer_calendar_entries;
create policy engineer_calendar_entries_insert_own
on public.engineer_calendar_entries
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.engineers e
    where e.id = engineer_calendar_entries.engineer_id
      and e.site_id = engineer_calendar_entries.site_id
      and e.organisation_id = engineer_calendar_entries.organisation_id
      and (
        e.profile_id = (select auth.uid())
        or e.id::text = coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'engineer_id'), '')
      )
  )
);

drop policy if exists engineer_calendar_entries_update_own on public.engineer_calendar_entries;
create policy engineer_calendar_entries_update_own
on public.engineer_calendar_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.engineers e
    where e.id = engineer_calendar_entries.engineer_id
      and (
        e.profile_id = (select auth.uid())
        or e.id::text = coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'engineer_id'), '')
      )
  )
)
with check (
  exists (
    select 1
    from public.engineers e
    where e.id = engineer_calendar_entries.engineer_id
      and e.site_id = engineer_calendar_entries.site_id
      and e.organisation_id = engineer_calendar_entries.organisation_id
      and (
        e.profile_id = (select auth.uid())
        or e.id::text = coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'engineer_id'), '')
      )
  )
);

drop policy if exists engineer_calendar_entries_delete_own on public.engineer_calendar_entries;
create policy engineer_calendar_entries_delete_own
on public.engineer_calendar_entries
for delete
to authenticated
using (
  exists (
    select 1
    from public.engineers e
    where e.id = engineer_calendar_entries.engineer_id
      and (
        e.profile_id = (select auth.uid())
        or e.id::text = coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'engineer_id'), '')
      )
  )
);
