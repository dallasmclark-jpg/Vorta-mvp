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
