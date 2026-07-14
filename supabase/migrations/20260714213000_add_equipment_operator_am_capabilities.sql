alter table public.operator_equipment_assignments
  add column assignment_status text not null default 'ACTIVE',
  add column am_step smallint not null default 0,
  add column target_am_step smallint,
  add column am_validation_status text not null default 'NOT_ASSESSED',
  add column am_authority text not null default 'OBSERVE',
  add column permitted_activities text[] not null default '{}'::text[],
  add column validation_evidence text,
  add column validated_at timestamptz,
  add column valid_until date,
  add column notes text,
  add column updated_at timestamptz not null default now();

alter table public.operator_equipment_assignments
  add constraint operator_equipment_assignments_status_check
    check (
      assignment_status in (
        'ACTIVE',
        'IN_DEVELOPMENT',
        'INACTIVE',
        'EXPIRED'
      )
    ),
  add constraint operator_equipment_assignments_am_step_check
    check (am_step between 0 and 7),
  add constraint operator_equipment_assignments_target_am_step_check
    check (
      target_am_step is null
      or (
        target_am_step between 0 and 7
        and target_am_step >= am_step
      )
    ),
  add constraint operator_equipment_assignments_am_validation_check
    check (
      am_validation_status in (
        'VALIDATED',
        'SUPERVISOR_REVIEW',
        'IN_TRAINING',
        'NOT_ASSESSED',
        'EXPIRED'
      )
    ),
  add constraint operator_equipment_assignments_am_authority_check
    check (
      am_authority in (
        'OBSERVE',
        'CLEAN_INSPECT_TAG',
        'CILT_STANDARD',
        'BASIC_INSPECTION',
        'AUTONOMOUS_INSPECTION',
        'AM_COACH',
        'AM_OWNER'
      )
    ),
  add constraint operator_equipment_assignments_validity_check
    check (valid_until is null or valid_until >= assigned_at::date),
  add constraint operator_equipment_assignments_validated_evidence_check
    check (
      am_validation_status <> 'VALIDATED'
      or (
        validation_evidence is not null
        and btrim(validation_evidence) <> ''
        and validated_at is not null
      )
    ),
  add constraint operator_equipment_assignments_development_check
    check (
      assignment_status <> 'IN_DEVELOPMENT'
      or (
        target_am_step is not null
        and target_am_step > am_step
      )
    );

create index operator_equipment_assignments_equipment_shift_am_idx
  on public.operator_equipment_assignments (
    equipment_id,
    assignment_status,
    am_validation_status,
    am_step desc
  );

create or replace function private.vorta_validate_operator_equipment_assignment()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_equipment_site_id uuid;
  v_operator_site_id uuid;
begin
  select equipment.site_id
  into v_equipment_site_id
  from public.equipment_assets equipment
  where equipment.id = new.equipment_id;

  if not found then
    raise exception 'Equipment % does not exist', new.equipment_id
      using errcode = '23503';
  end if;

  select operator.site_id
  into v_operator_site_id
  from public.operators operator
  where operator.id = new.operator_id;

  if not found then
    raise exception 'Operator % does not exist', new.operator_id
      using errcode = '23503';
  end if;

  if v_equipment_site_id is distinct from v_operator_site_id then
    raise exception 'Equipment and operator must belong to the same site'
      using errcode = '23514';
  end if;

  if new.am_validation_status = 'VALIDATED'
     and new.assignment_status <> 'ACTIVE' then
    raise exception 'Validated AM capability must have ACTIVE assignment status'
      using errcode = '23514';
  end if;

  if new.am_validation_status = 'VALIDATED'
     and new.am_authority = 'OBSERVE'
     and new.am_step > 0 then
    raise exception 'Validated AM Step 1 or above requires execution authority'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function private.vorta_validate_operator_equipment_assignment()
  from public, anon, authenticated;
grant execute on function private.vorta_validate_operator_equipment_assignment()
  to postgres, service_role;

create trigger operator_equipment_assignments_integrity
before insert or update
on public.operator_equipment_assignments
for each row
execute function private.vorta_validate_operator_equipment_assignment();

create trigger operator_equipment_assignments_set_updated_at
before update
on public.operator_equipment_assignments
for each row
execute function public.set_updated_at();

drop policy if exists operator_equipment_assignments_site_read
  on public.operator_equipment_assignments;

create policy operator_equipment_assignments_site_read
on public.operator_equipment_assignments
for select
to authenticated
using (
  private.vorta_rls_has_equipment_access(equipment_id, false)
);

revoke all on table public.operator_equipment_assignments
  from anon, authenticated;
grant select on table public.operator_equipment_assignments
  to authenticated;
grant all on table public.operator_equipment_assignments
  to postgres, service_role;

create or replace function public.vorta_get_equipment_operator_capabilities(
  p_equipment_id uuid
)
returns table (
  assignment_id uuid,
  operator_id uuid,
  operator_name text,
  job_title text,
  operator_level integer,
  area text,
  line text,
  shift_name text,
  team_leader_name text,
  role_on_equipment text,
  is_primary boolean,
  equipment_competency_level integer,
  assignment_status text,
  am_step integer,
  target_am_step integer,
  am_validation_status text,
  am_authority text,
  permitted_activities text[],
  validation_evidence text,
  validated_at timestamptz,
  valid_until date,
  notes text,
  career_path_id uuid,
  career_path_name text,
  career_target_role text,
  career_readiness_score numeric,
  validated_am_skill_count integer,
  am_training_gap_count integer
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  if not private.vorta_rls_has_equipment_access(
    p_equipment_id,
    false
  ) then
    return;
  end if;

  return query
  select
    assignment.id as assignment_id,
    operator.id as operator_id,
    operator.display_name as operator_name,
    operator.job_title,
    operator.operator_level,
    operator.area,
    operator.line,
    operator.shift as shift_name,
    operator.team_leader_name,
    assignment.role_on_equipment,
    assignment.is_primary,
    assignment.competency_level as equipment_competency_level,
    assignment.assignment_status,
    assignment.am_step::integer,
    assignment.target_am_step::integer,
    assignment.am_validation_status,
    assignment.am_authority,
    assignment.permitted_activities,
    assignment.validation_evidence,
    assignment.validated_at,
    assignment.valid_until,
    assignment.notes,
    career.id as career_path_id,
    career.path_name as career_path_name,
    career.target_job_role as career_target_role,
    career.readiness_score as career_readiness_score,
    am_skills.validated_am_skill_count,
    am_skills.am_training_gap_count
  from public.operator_equipment_assignments assignment
  join public.operators operator
    on operator.id = assignment.operator_id
  left join lateral (
    select
      path.id,
      path.path_name,
      path.target_job_role,
      path.readiness_score
    from public.operator_career_paths path
    where path.operator_id = operator.id
      and path.status = 'active'
    order by
      path.readiness_score desc nulls last,
      path.updated_at desc
    limit 1
  ) career on true
  left join lateral (
    select
      count(*) filter (
        where skill.category = 'Autonomous Maintenance'
          and skill_assignment.verification_status = 'validated'
          and coalesce(skill_assignment.validated_rating, 0) >= 3
      )::integer as validated_am_skill_count,
      count(*) filter (
        where skill.category = 'Autonomous Maintenance'
          and skill_assignment.training_required
      )::integer as am_training_gap_count
    from public.operator_skill_assignments skill_assignment
    join public.operator_skills skill
      on skill.id = skill_assignment.skill_id
    where skill_assignment.operator_id = operator.id
  ) am_skills on true
  where assignment.equipment_id = p_equipment_id
  order by
    case operator.shift
      when 'A Shift' then 1
      when 'B Shift' then 2
      when 'C Shift' then 3
      when 'D Shift' then 4
      else 5
    end,
    assignment.is_primary desc,
    assignment.am_step desc,
    operator.display_name;
end;
$function$;

revoke all on function public.vorta_get_equipment_operator_capabilities(uuid)
  from public, anon;
grant execute on function public.vorta_get_equipment_operator_capabilities(uuid)
  to authenticated, postgres, service_role;

with target_equipment as (
  select equipment.id, equipment.site_id
  from public.equipment_assets equipment
  where equipment.equipment_code = 'DEMO-VF-002'
  limit 1
),
capability_seed (
  operator_name,
  role_on_equipment,
  is_primary,
  competency_level,
  assignment_status,
  am_step,
  target_am_step,
  am_validation_status,
  am_authority,
  permitted_activities,
  validation_evidence,
  validated_at,
  valid_until,
  notes
) as (
  values
    (
      'Ruby Cook',
      'lead_operator',
      true,
      4,
      'ACTIVE',
      4,
      5,
      'VALIDATED',
      'BASIC_INSPECTION',
      array[
        'Initial cleaning and abnormality tagging',
        'CILT checks and contamination countermeasures',
        'Cleaning, inspection and lubrication standards',
        'Basic mechanical, pneumatic and sensor inspection'
      ]::text[],
      'Validated CILT completion, defect tag management and centreline deviation escalation; senior Vial Line 2 operator.',
      now() - interval '60 days',
      current_date + 365,
      'A Shift lead AM operator for Bosch Vial Filler VF-02.'
    ),
    (
      'Sophie Clarke',
      'relief_operator',
      false,
      3,
      'ACTIVE',
      2,
      3,
      'VALIDATED',
      'CLEAN_INSPECT_TAG',
      array[
        'Initial cleaning and abnormality tagging',
        'CILT checks',
        'Contamination source identification and countermeasures'
      ]::text[],
      'Validated CILT completion, defect tag management and centreline deviation escalation.',
      now() - interval '45 days',
      current_date + 365,
      'A Shift relief AM coverage for Bosch Vial Filler VF-02.'
    ),
    (
      'Olivia Reed',
      'primary_operator',
      true,
      3,
      'ACTIVE',
      3,
      4,
      'VALIDATED',
      'CILT_STANDARD',
      array[
        'Initial cleaning and abnormality tagging',
        'CILT checks and contamination countermeasures',
        'Cleaning, inspection and lubrication standards'
      ]::text[],
      'Validated CILT completion, defect tag management and centreline deviation escalation.',
      now() - interval '40 days',
      current_date + 365,
      'B Shift primary AM operator for Bosch Vial Filler VF-02.'
    ),
    (
      'Freya Nelson',
      'primary_operator',
      true,
      3,
      'ACTIVE',
      2,
      3,
      'VALIDATED',
      'CLEAN_INSPECT_TAG',
      array[
        'Initial cleaning and abnormality tagging',
        'CILT checks',
        'Contamination source identification and countermeasures'
      ]::text[],
      'Validated CILT completion, defect tag management and centreline deviation escalation.',
      now() - interval '35 days',
      current_date + 365,
      'C Shift primary AM operator for Bosch Vial Filler VF-02.'
    ),
    (
      'Michael Evans',
      'trainee_operator',
      false,
      1,
      'IN_DEVELOPMENT',
      0,
      1,
      'IN_TRAINING',
      'OBSERVE',
      array[
        'Observe initial cleaning',
        'Identify and escalate abnormalities under supervision'
      ]::text[],
      'AM Step 1 abnormality tagging and initial cleaning remain under supervisor review.',
      null,
      null,
      'D Shift currently has no validated AM Step 1 coverage; Michael is the development candidate.'
    )
)
insert into public.operator_equipment_assignments (
  operator_id,
  equipment_id,
  role_on_equipment,
  is_primary,
  competency_level,
  assignment_status,
  am_step,
  target_am_step,
  am_validation_status,
  am_authority,
  permitted_activities,
  validation_evidence,
  validated_at,
  valid_until,
  notes
)
select
  operator.id,
  target.id,
  seed.role_on_equipment,
  seed.is_primary,
  seed.competency_level,
  seed.assignment_status,
  seed.am_step,
  seed.target_am_step,
  seed.am_validation_status,
  seed.am_authority,
  seed.permitted_activities,
  seed.validation_evidence,
  seed.validated_at,
  seed.valid_until,
  seed.notes
from target_equipment target
join capability_seed seed on true
join public.operators operator
  on operator.display_name = seed.operator_name
 and operator.site_id = target.site_id
 and operator.line = 'Vial Line 2'
on conflict (operator_id, equipment_id)
do update set
  role_on_equipment = excluded.role_on_equipment,
  is_primary = excluded.is_primary,
  competency_level = excluded.competency_level,
  assignment_status = excluded.assignment_status,
  am_step = excluded.am_step,
  target_am_step = excluded.target_am_step,
  am_validation_status = excluded.am_validation_status,
  am_authority = excluded.am_authority,
  permitted_activities = excluded.permitted_activities,
  validation_evidence = excluded.validation_evidence,
  validated_at = excluded.validated_at,
  valid_until = excluded.valid_until,
  notes = excluded.notes,
  updated_at = now();
