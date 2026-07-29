-- VOR-023: collapse the Engineers page's three Edge Function query waves into
-- one explicitly site- and organisation-scoped service-role RPC.

create index if not exists engineers_site_org_name_idx
  on public.engineers(site_id, organisation_id, full_name);

create index if not exists skill_gap_snapshots_site_org_idx
  on public.skill_gap_snapshots(site_id, organisation_id);

create index if not exists training_bookings_org_engineer_idx
  on public.training_bookings(organisation_id, engineer_id);

create or replace function public.vorta_get_engineers_evidence_bundle_internal(
  p_site_id uuid,
  p_organisation_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with authorised_site as (
    select site.id, site.name, site.region
    from public.sites site
    where site.id = p_site_id
      and site.organisation_id = p_organisation_id
  ),
  engineer_rows as materialized (
    select
      engineer.id,
      engineer.full_name,
      engineer.employment_type,
      engineer.discipline,
      engineer.availability_status,
      engineer.verified,
      engineer.shift_pattern,
      engineer.department_id,
      engineer.site_id,
      engineer.avatar_url
    from public.engineers engineer
    join authorised_site site on site.id = engineer.site_id
    where engineer.organisation_id = p_organisation_id
    order by engineer.full_name
  ),
  department_rows as (
    select department.id, department.name
    from public.departments department
    join authorised_site site on site.id = department.site_id
  ),
  gap_rows as materialized (
    select
      gap.id,
      gap.skill_id,
      gap.department_id,
      gap.target_rating,
      gap.current_average_rating,
      gap.engineers_at_or_above_target,
      gap.engineers_below_target,
      gap.single_point_of_failure,
      gap.risk_level,
      gap.recommendation,
      gap.snapshot_date
    from public.skill_gap_snapshots gap
    join authorised_site site on site.id = gap.site_id
    where gap.organisation_id = p_organisation_id
  ),
  assignment_rows as materialized (
    select
      assignment.engineer_id,
      assignment.skill_id,
      assignment.self_rating,
      assignment.manager_rating,
      assignment.validated_rating,
      assignment.training_required,
      assignment.verification_status,
      assignment.last_validated_at,
      assignment.expiry_date,
      assignment.years_experience
    from public.engineer_skills assignment
    join engineer_rows engineer on engineer.id = assignment.engineer_id
  ),
  risk_rows as (
    select
      risk.engineer_id,
      risk.retirement_risk,
      risk.leaving_risk,
      risk.critical_knowledge_holder
    from public.engineer_risk_profiles risk
    join engineer_rows engineer on engineer.id = risk.engineer_id
  ),
  booking_rows as materialized (
    select
      booking.engineer_id,
      booking.course_id,
      booking.status,
      booking.booking_date
    from public.training_bookings booking
    join engineer_rows engineer on engineer.id = booking.engineer_id
    where booking.organisation_id = p_organisation_id
  ),
  referenced_skill_ids as (
    select assignment.skill_id from assignment_rows assignment
    union
    select gap.skill_id from gap_rows gap
  ),
  skill_rows as (
    select
      skill.id,
      skill.name,
      skill.category,
      skill.is_critical,
      skill.certification_required,
      skill.skill_type
    from public.skills skill
    join referenced_skill_ids reference on reference.skill_id = skill.id
  ),
  referenced_course_ids as (
    select distinct booking.course_id
    from booking_rows booking
    where booking.course_id is not null
  ),
  course_rows as (
    select course.id, course.title
    from public.training_courses course
    join referenced_course_ids reference on reference.course_id = course.id
  )
  select jsonb_build_object(
    'engineers', coalesce(
      (select jsonb_agg(to_jsonb(engineer) order by engineer.full_name) from engineer_rows engineer),
      '[]'::jsonb
    ),
    'departments', coalesce(
      (select jsonb_agg(to_jsonb(department) order by department.name) from department_rows department),
      '[]'::jsonb
    ),
    'sites', coalesce(
      (select jsonb_agg(to_jsonb(site) order by site.name) from authorised_site site),
      '[]'::jsonb
    ),
    'gaps', coalesce(
      (select jsonb_agg(to_jsonb(gap) order by gap.snapshot_date desc, gap.id) from gap_rows gap),
      '[]'::jsonb
    ),
    'assignments', coalesce(
      (select jsonb_agg(to_jsonb(assignment) order by assignment.engineer_id, assignment.skill_id) from assignment_rows assignment),
      '[]'::jsonb
    ),
    'risks', coalesce(
      (select jsonb_agg(to_jsonb(risk) order by risk.engineer_id) from risk_rows risk),
      '[]'::jsonb
    ),
    'bookings', coalesce(
      (select jsonb_agg(to_jsonb(booking) order by booking.booking_date desc nulls last, booking.engineer_id) from booking_rows booking),
      '[]'::jsonb
    ),
    'skills', coalesce(
      (select jsonb_agg(to_jsonb(skill) order by skill.name) from skill_rows skill),
      '[]'::jsonb
    ),
    'courses', coalesce(
      (select jsonb_agg(to_jsonb(course) order by course.title) from course_rows course),
      '[]'::jsonb
    )
  )
  from authorised_site;
$$;

revoke all on function public.vorta_get_engineers_evidence_bundle_internal(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.vorta_get_engineers_evidence_bundle_internal(uuid, uuid)
to service_role;

comment on function public.vorta_get_engineers_evidence_bundle_internal(uuid, uuid) is
  'Service-role-only site and organisation scoped evidence bundle for the Engineers Edge Function.';
