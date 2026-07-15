create or replace function private.vorta_rls_current_organisation_id()
returns uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  select profile.organisation_id
  from public.profiles profile
  where profile.id = auth.uid();
$function$;

create or replace function private.vorta_rls_has_training_partner_access(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  select exists (
    select 1
    from public.training_partners partner
    where partner.id = p_partner_id
      and (
        partner.organisation_id = private.vorta_rls_current_organisation_id()
        or private.vorta_rls_current_role() = 'vorta_admin'
      )
  );
$function$;

revoke all on function private.vorta_rls_current_organisation_id() from public;
revoke all on function private.vorta_rls_has_training_partner_access(uuid) from public;
grant execute on function private.vorta_rls_current_organisation_id() to authenticated;
grant execute on function private.vorta_rls_has_training_partner_access(uuid) to authenticated;

grant select on table public.training_partners to authenticated;
grant select on table public.training_courses to authenticated;
grant select on table public.training_bookings to authenticated;
grant select on table public.training_enquiries to authenticated;
grant select on table public.skill_gap_snapshots to authenticated;

drop policy if exists training_partners_org_read on public.training_partners;
create policy training_partners_org_read
on public.training_partners
for select
to authenticated
using (
  organisation_id = private.vorta_rls_current_organisation_id()
  or private.vorta_rls_current_role() = 'vorta_admin'
);

drop policy if exists training_courses_partner_read on public.training_courses;
create policy training_courses_partner_read
on public.training_courses
for select
to authenticated
using (private.vorta_rls_has_training_partner_access(training_partner_id));

drop policy if exists training_bookings_org_read on public.training_bookings;
create policy training_bookings_org_read
on public.training_bookings
for select
to authenticated
using (
  organisation_id = private.vorta_rls_current_organisation_id()
  or private.vorta_rls_current_role() = 'vorta_admin'
);

drop policy if exists training_enquiries_org_read on public.training_enquiries;
create policy training_enquiries_org_read
on public.training_enquiries
for select
to authenticated
using (
  organisation_id = private.vorta_rls_current_organisation_id()
  or private.vorta_rls_current_role() = 'vorta_admin'
);

drop policy if exists skill_gap_snapshots_org_read on public.skill_gap_snapshots;
create policy skill_gap_snapshots_org_read
on public.skill_gap_snapshots
for select
to authenticated
using (
  organisation_id = private.vorta_rls_current_organisation_id()
  or private.vorta_rls_current_role() = 'vorta_admin'
);
