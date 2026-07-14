alter table public.engineer_career_paths
  add column equipment_id uuid references public.equipment_assets(id) on delete cascade,
  add column target_capability_role text,
  add column supervised_interventions_required smallint not null default 0,
  add column supervised_interventions_completed smallint not null default 0,
  add column evidence_items_required smallint not null default 0,
  add column evidence_items_completed smallint not null default 0,
  add column expected_risk_reduction numeric(5,1) not null default 0,
  add column target_completion_date date,
  add column development_summary text;

alter table public.engineer_career_paths
  add constraint engineer_career_paths_capability_role_check
    check (
      target_capability_role is null
      or target_capability_role in (
        'PRIMARY_SME',
        'BACKUP_SME',
        'QUALIFIED_SUPPORT',
        'INDEPENDENT_MAINTAINER'
      )
    ),
  add constraint engineer_career_paths_equipment_role_check
    check (equipment_id is null or target_capability_role is not null),
  add constraint engineer_career_paths_interventions_check
    check (
      supervised_interventions_required >= 0
      and supervised_interventions_completed >= 0
      and supervised_interventions_completed <= supervised_interventions_required
    ),
  add constraint engineer_career_paths_evidence_check
    check (
      evidence_items_required >= 0
      and evidence_items_completed >= 0
      and evidence_items_completed <= evidence_items_required
    ),
  add constraint engineer_career_paths_risk_reduction_check
    check (expected_risk_reduction between 0 and 100);

create unique index engineer_career_paths_active_equipment_target_idx
  on public.engineer_career_paths (
    engineer_id,
    equipment_id,
    target_capability_role
  )
  where equipment_id is not null
    and status = 'active';

create index engineer_career_paths_equipment_idx
  on public.engineer_career_paths (equipment_id, status, readiness_score desc);

alter table public.operator_career_paths
  add column equipment_id uuid references public.equipment_assets(id) on delete cascade,
  add column target_capability_role text,
  add column current_am_step smallint,
  add column target_am_step smallint,
  add column supervised_routines_required smallint not null default 0,
  add column supervised_routines_completed smallint not null default 0,
  add column evidence_items_required smallint not null default 0,
  add column evidence_items_completed smallint not null default 0,
  add column expected_risk_reduction numeric(5,1) not null default 0,
  add column target_completion_date date,
  add column development_summary text,
  add column mentor_engineer_id uuid references public.engineers(id) on delete set null;

alter table public.operator_career_paths
  add constraint operator_career_paths_capability_role_check
    check (
      target_capability_role is null
      or target_capability_role in (
        'AM_STEP',
        'LEAD_AM_OPERATOR',
        'RELIEF_AM_OPERATOR'
      )
    ),
  add constraint operator_career_paths_equipment_role_check
    check (equipment_id is null or target_capability_role is not null),
  add constraint operator_career_paths_am_steps_check
    check (
      (current_am_step is null and target_am_step is null)
      or (
        current_am_step between 0 and 7
        and target_am_step between 0 and 7
        and target_am_step >= current_am_step
      )
    ),
  add constraint operator_career_paths_routines_check
    check (
      supervised_routines_required >= 0
      and supervised_routines_completed >= 0
      and supervised_routines_completed <= supervised_routines_required
    ),
  add constraint operator_career_paths_evidence_check
    check (
      evidence_items_required >= 0
      and evidence_items_completed >= 0
      and evidence_items_completed <= evidence_items_required
    ),
  add constraint operator_career_paths_risk_reduction_check
    check (expected_risk_reduction between 0 and 100);

create unique index operator_career_paths_active_equipment_target_idx
  on public.operator_career_paths (
    operator_id,
    equipment_id,
    target_capability_role
  )
  where equipment_id is not null
    and status = 'active';

create index operator_career_paths_equipment_idx
  on public.operator_career_paths (equipment_id, status, readiness_score desc);

create or replace function private.vorta_validate_equipment_linked_engineer_path()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_engineer_site_id uuid;
  v_equipment_site_id uuid;
  v_mentor_site_id uuid;
begin
  select engineer.site_id
  into v_engineer_site_id
  from public.engineers engineer
  where engineer.id = new.engineer_id;

  if new.equipment_id is not null then
    select equipment.site_id
    into v_equipment_site_id
    from public.equipment_assets equipment
    where equipment.id = new.equipment_id;

    if v_engineer_site_id is distinct from v_equipment_site_id then
      raise exception 'Engineer career path equipment must belong to the same site'
        using errcode = '23514';
    end if;
  end if;

  if new.mentor_engineer_id is not null then
    select mentor.site_id
    into v_mentor_site_id
    from public.engineers mentor
    where mentor.id = new.mentor_engineer_id;

    if v_engineer_site_id is distinct from v_mentor_site_id then
      raise exception 'Engineer career path mentor must belong to the same site'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.vorta_validate_equipment_linked_operator_path()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_operator_site_id uuid;
  v_equipment_site_id uuid;
  v_mentor_site_id uuid;
begin
  select operator.site_id
  into v_operator_site_id
  from public.operators operator
  where operator.id = new.operator_id;

  if new.equipment_id is not null then
    select equipment.site_id
    into v_equipment_site_id
    from public.equipment_assets equipment
    where equipment.id = new.equipment_id;

    if v_operator_site_id is distinct from v_equipment_site_id then
      raise exception 'Operator career path equipment must belong to the same site'
        using errcode = '23514';
    end if;
  end if;

  if new.mentor_engineer_id is not null then
    select mentor.site_id
    into v_mentor_site_id
    from public.engineers mentor
    where mentor.id = new.mentor_engineer_id;

    if v_operator_site_id is distinct from v_mentor_site_id then
      raise exception 'Operator career path mentor must belong to the same site'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.vorta_validate_equipment_linked_engineer_path()
  from public, anon, authenticated;
revoke all on function private.vorta_validate_equipment_linked_operator_path()
  from public, anon, authenticated;
grant execute on function private.vorta_validate_equipment_linked_engineer_path()
  to postgres, service_role;
grant execute on function private.vorta_validate_equipment_linked_operator_path()
  to postgres, service_role;

create trigger engineer_career_paths_equipment_integrity
before insert or update of engineer_id, equipment_id, mentor_engineer_id
on public.engineer_career_paths
for each row
execute function private.vorta_validate_equipment_linked_engineer_path();

create trigger operator_career_paths_equipment_integrity
before insert or update of operator_id, equipment_id, mentor_engineer_id
on public.operator_career_paths
for each row
execute function private.vorta_validate_equipment_linked_operator_path();

drop policy if exists engineer_career_paths_site_read
  on public.engineer_career_paths;
create policy engineer_career_paths_site_read
on public.engineer_career_paths
for select
to authenticated
using (
  case
    when equipment_id is not null
      then private.vorta_rls_has_equipment_access(equipment_id, false)
    else public.vorta_has_site_access(
      (
        select engineer.site_id
        from public.engineers engineer
        where engineer.id = engineer_career_paths.engineer_id
      ),
      false
    )
  end
);

drop policy if exists engineer_career_path_requirements_site_read
  on public.engineer_career_path_requirements;
create policy engineer_career_path_requirements_site_read
on public.engineer_career_path_requirements
for select
to authenticated
using (
  exists (
    select 1
    from public.engineer_career_paths path
    where path.id = engineer_career_path_requirements.career_path_id
  )
);

drop policy if exists operator_career_paths_site_read
  on public.operator_career_paths;
create policy operator_career_paths_site_read
on public.operator_career_paths
for select
to authenticated
using (
  case
    when equipment_id is not null
      then private.vorta_rls_has_equipment_access(equipment_id, false)
    else public.vorta_has_site_access(
      (
        select operator.site_id
        from public.operators operator
        where operator.id = operator_career_paths.operator_id
      ),
      false
    )
  end
);

drop policy if exists operator_career_path_requirements_site_read
  on public.operator_career_path_requirements;
create policy operator_career_path_requirements_site_read
on public.operator_career_path_requirements
for select
to authenticated
using (
  exists (
    select 1
    from public.operator_career_paths path
    where path.id = operator_career_path_requirements.career_path_id
  )
);

revoke all on table public.engineer_career_paths from anon, authenticated;
revoke all on table public.engineer_career_path_requirements from anon, authenticated;
revoke all on table public.operator_career_paths from anon, authenticated;
revoke all on table public.operator_career_path_requirements from anon, authenticated;
grant select on table public.engineer_career_paths to authenticated;
grant select on table public.engineer_career_path_requirements to authenticated;
grant select on table public.operator_career_paths to authenticated;
grant select on table public.operator_career_path_requirements to authenticated;
grant all on table public.engineer_career_paths to postgres, service_role;
grant all on table public.engineer_career_path_requirements to postgres, service_role;
grant all on table public.operator_career_paths to postgres, service_role;
grant all on table public.operator_career_path_requirements to postgres, service_role;

create or replace function public.vorta_get_equipment_development_paths(
  p_equipment_id uuid
)
returns table (
  person_type text,
  path_id uuid,
  person_id uuid,
  person_name text,
  shift_name text,
  current_job_role text,
  target_job_role text,
  target_capability_role text,
  current_level integer,
  target_level integer,
  current_am_step integer,
  target_am_step integer,
  readiness_score numeric,
  estimated_timeframe text,
  mentor_name text,
  supervised_completed integer,
  supervised_required integer,
  evidence_completed integer,
  evidence_required integer,
  expected_risk_reduction numeric,
  target_completion_date date,
  development_summary text,
  requirement_count integer,
  completed_requirement_count integer,
  high_priority_remaining integer
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  if not private.vorta_rls_has_equipment_access(p_equipment_id, false) then
    return;
  end if;

  return query
  select
    'ENGINEER'::text,
    path.id,
    engineer.id,
    engineer.full_name,
    coalesce(team.name, engineer.shift_pattern),
    path.current_job_role,
    path.target_job_role,
    path.target_capability_role,
    path.current_level,
    path.target_level,
    null::integer,
    null::integer,
    path.readiness_score,
    path.estimated_timeframe,
    mentor.full_name,
    path.supervised_interventions_completed::integer,
    path.supervised_interventions_required::integer,
    path.evidence_items_completed::integer,
    path.evidence_items_required::integer,
    path.expected_risk_reduction,
    path.target_completion_date,
    path.development_summary,
    coalesce(requirements.requirement_count, 0),
    coalesce(requirements.completed_requirement_count, 0),
    coalesce(requirements.high_priority_remaining, 0)
  from public.engineer_career_paths path
  join public.engineers engineer on engineer.id = path.engineer_id
  left join public.engineers mentor on mentor.id = path.mentor_engineer_id
  left join lateral (
    select shift_team.name
    from public.maintenance_shift_team_members member
    join public.maintenance_shift_teams shift_team on shift_team.id = member.team_id
    where member.engineer_id = engineer.id
      and shift_team.active
      and member.active_from <= current_date
      and (member.active_to is null or member.active_to >= current_date)
    order by member.active_from desc
    limit 1
  ) team on true
  left join lateral (
    select
      count(*)::integer as requirement_count,
      count(*) filter (where requirement.status = 'completed')::integer as completed_requirement_count,
      count(*) filter (
        where requirement.status <> 'completed'
          and requirement.priority = 'high'
      )::integer as high_priority_remaining
    from public.engineer_career_path_requirements requirement
    where requirement.career_path_id = path.id
  ) requirements on true
  where path.equipment_id = p_equipment_id
    and path.status = 'active'

  union all

  select
    'OPERATOR'::text,
    path.id,
    operator.id,
    operator.display_name,
    coalesce(team.name, operator.shift),
    path.current_job_role,
    path.target_job_role,
    path.target_capability_role,
    path.current_level,
    path.target_level,
    path.current_am_step::integer,
    path.target_am_step::integer,
    path.readiness_score,
    path.estimated_timeframe,
    mentor.full_name,
    path.supervised_routines_completed::integer,
    path.supervised_routines_required::integer,
    path.evidence_items_completed::integer,
    path.evidence_items_required::integer,
    path.expected_risk_reduction,
    path.target_completion_date,
    path.development_summary,
    coalesce(requirements.requirement_count, 0),
    coalesce(requirements.completed_requirement_count, 0),
    coalesce(requirements.high_priority_remaining, 0)
  from public.operator_career_paths path
  join public.operators operator on operator.id = path.operator_id
  left join public.engineers mentor on mentor.id = path.mentor_engineer_id
  left join public.maintenance_shift_teams team on team.id = operator.shift_team_id
  left join lateral (
    select
      count(*)::integer as requirement_count,
      count(*) filter (where requirement.status = 'completed')::integer as completed_requirement_count,
      count(*) filter (
        where requirement.status <> 'completed'
          and requirement.priority = 'high'
      )::integer as high_priority_remaining
    from public.operator_career_path_requirements requirement
    where requirement.career_path_id = path.id
  ) requirements on true
  where path.equipment_id = p_equipment_id
    and path.status = 'active'

  order by person_type, readiness_score desc, person_name;
end;
$function$;

revoke all on function public.vorta_get_equipment_development_paths(uuid)
  from public, anon;
grant execute on function public.vorta_get_equipment_development_paths(uuid)
  to authenticated, postgres, service_role;
