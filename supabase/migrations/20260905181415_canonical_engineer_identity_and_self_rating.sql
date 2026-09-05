with candidate_mappings as (
  select
    u.id as user_id,
    e.id as engineer_id
  from auth.users u
  join public.engineers e
    on e.id::text = nullif(u.raw_app_meta_data->>'engineer_id', '')
  join public.profiles p
    on p.id = u.id
   and p.organisation_id = e.organisation_id
  where e.profile_id is null
    and exists (
      select 1
      from public.user_site_access usa
      where usa.user_id = u.id
        and usa.organisation_id = e.organisation_id
        and usa.site_id = e.site_id
        and usa.active
    )
), unambiguous_mappings as (
  select user_id, engineer_id
  from candidate_mappings
  where not exists (
    select 1
    from candidate_mappings other
    where other.user_id = candidate_mappings.user_id
      and other.engineer_id <> candidate_mappings.engineer_id
  )
)
update public.engineers engineer
set profile_id = mapping.user_id,
    updated_at = now()
from unambiguous_mappings mapping
where engineer.id = mapping.engineer_id
  and engineer.profile_id is null;

create unique index if not exists engineers_profile_id_uidx
  on public.engineers(profile_id)
  where profile_id is not null;

revoke update on table public.engineer_skills from authenticated;
grant update(self_rating) on table public.engineer_skills to authenticated;

drop policy if exists engineer_skills_self_update on public.engineer_skills;
create policy engineer_skills_self_update
on public.engineer_skills
for update
to authenticated
using (
  exists (
    select 1
    from public.engineers engineer
    where engineer.id = engineer_skills.engineer_id
      and engineer.profile_id = (select auth.uid())
      and exists (
        select 1
        from public.user_site_access access_row
        where access_row.user_id = (select auth.uid())
          and access_row.organisation_id = engineer.organisation_id
          and access_row.site_id = engineer.site_id
          and access_row.active
      )
  )
)
with check (
  exists (
    select 1
    from public.engineers engineer
    where engineer.id = engineer_skills.engineer_id
      and engineer.profile_id = (select auth.uid())
      and exists (
        select 1
        from public.user_site_access access_row
        where access_row.user_id = (select auth.uid())
          and access_row.organisation_id = engineer.organisation_id
          and access_row.site_id = engineer.site_id
          and access_row.active
      )
  )
);
