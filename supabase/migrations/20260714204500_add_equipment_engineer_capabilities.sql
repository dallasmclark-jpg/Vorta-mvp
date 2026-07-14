create table public.equipment_engineer_capabilities (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  engineer_id uuid not null references public.engineers(id) on delete cascade,
  capability_role text not null,
  capability_status text not null default 'ACTIVE',
  competency_level smallint not null,
  practice_authority text not null,
  validation_status text not null,
  specialism text,
  evidence_reference text,
  valid_from date not null default current_date,
  valid_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_engineer_capabilities_equipment_engineer_key
    unique (equipment_id, engineer_id),
  constraint equipment_engineer_capabilities_role_check
    check (
      capability_role in (
        'PRIMARY_SME',
        'BACKUP_SME',
        'DEVELOPING_BACKUP',
        'QUALIFIED_SUPPORT'
      )
    ),
  constraint equipment_engineer_capabilities_status_check
    check (
      capability_status in (
        'ACTIVE',
        'IN_DEVELOPMENT',
        'INACTIVE',
        'EXPIRED'
      )
    ),
  constraint equipment_engineer_capabilities_level_check
    check (competency_level between 1 and 5),
  constraint equipment_engineer_capabilities_authority_check
    check (
      practice_authority in (
        'OBSERVE',
        'SUPERVISED',
        'INDEPENDENT',
        'AUTHORISER'
      )
    ),
  constraint equipment_engineer_capabilities_validation_check
    check (
      validation_status in (
        'VALIDATED',
        'MANAGER_REVIEW',
        'DEVELOPING',
        'EXPIRED'
      )
    ),
  constraint equipment_engineer_capabilities_validity_check
    check (valid_until is null or valid_until >= valid_from)
);

comment on table public.equipment_engineer_capabilities is
  'Equipment-specific engineer designations including SMEs, developing backups and qualified support.';

create unique index equipment_engineer_capabilities_one_primary_sme_idx
  on public.equipment_engineer_capabilities (equipment_id)
  where capability_role = 'PRIMARY_SME'
    and capability_status = 'ACTIVE';

create index equipment_engineer_capabilities_equipment_role_idx
  on public.equipment_engineer_capabilities (
    equipment_id,
    capability_role,
    capability_status
  );

create index equipment_engineer_capabilities_engineer_idx
  on public.equipment_engineer_capabilities (engineer_id);

create or replace function private.vorta_validate_equipment_engineer_capability()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_equipment_site_id uuid;
  v_engineer_site_id uuid;
begin
  select equipment.site_id
  into v_equipment_site_id
  from public.equipment_assets equipment
  where equipment.id = new.equipment_id;

  if not found then
    raise exception 'Equipment % does not exist', new.equipment_id
      using errcode = '23503';
  end if;

  select engineer.site_id
  into v_engineer_site_id
  from public.engineers engineer
  where engineer.id = new.engineer_id;

  if not found then
    raise exception 'Engineer % does not exist', new.engineer_id
      using errcode = '23503';
  end if;

  if v_equipment_site_id is distinct from v_engineer_site_id then
    raise exception 'Equipment and engineer must belong to the same site'
      using errcode = '23514';
  end if;

  if new.capability_role = 'PRIMARY_SME'
     and (
       new.competency_level < 4
       or new.practice_authority not in ('INDEPENDENT', 'AUTHORISER')
       or new.validation_status <> 'VALIDATED'
       or new.capability_status <> 'ACTIVE'
     ) then
    raise exception 'Primary SME must be active, validated, level 4 or above, and independently authorised'
      using errcode = '23514';
  end if;

  if new.capability_role = 'DEVELOPING_BACKUP'
     and new.capability_status <> 'IN_DEVELOPMENT' then
    raise exception 'Developing backup must have IN_DEVELOPMENT status'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function private.vorta_validate_equipment_engineer_capability()
  from public, anon, authenticated;
grant execute on function private.vorta_validate_equipment_engineer_capability()
  to postgres, service_role;

create trigger equipment_engineer_capabilities_integrity
before insert or update
on public.equipment_engineer_capabilities
for each row
execute function private.vorta_validate_equipment_engineer_capability();

create trigger equipment_engineer_capabilities_set_updated_at
before update
on public.equipment_engineer_capabilities
for each row
execute function public.set_updated_at();

alter table public.equipment_engineer_capabilities enable row level security;

drop policy if exists equipment_engineer_capabilities_site_read
  on public.equipment_engineer_capabilities;

create policy equipment_engineer_capabilities_site_read
on public.equipment_engineer_capabilities
for select
to authenticated
using (
  private.vorta_rls_has_equipment_access(equipment_id, false)
);

revoke all on table public.equipment_engineer_capabilities
  from anon, authenticated;
grant select on table public.equipment_engineer_capabilities
  to authenticated;
grant all on table public.equipment_engineer_capabilities
  to postgres, service_role;

create or replace function public.vorta_get_equipment_engineer_capabilities(
  p_equipment_id uuid
)
returns table (
  capability_id uuid,
  engineer_id uuid,
  engineer_name text,
  discipline text,
  shift_pattern text,
  availability_status text,
  capability_role text,
  capability_status text,
  competency_level integer,
  practice_authority text,
  validation_status text,
  specialism text,
  evidence_reference text,
  valid_from date,
  valid_until date,
  notes text,
  career_path_id uuid,
  career_target_role text,
  career_readiness_score numeric,
  mentor_engineer_name text,
  required_skill_matches integer,
  required_skill_total integer,
  critical_skill_matches integer,
  critical_skill_total integer
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
    capability.id as capability_id,
    engineer.id as engineer_id,
    engineer.full_name as engineer_name,
    engineer.discipline,
    engineer.shift_pattern,
    engineer.availability_status,
    capability.capability_role,
    capability.capability_status,
    capability.competency_level::integer,
    capability.practice_authority,
    capability.validation_status,
    capability.specialism,
    capability.evidence_reference,
    capability.valid_from,
    capability.valid_until,
    capability.notes,
    career.id as career_path_id,
    career.target_job_role as career_target_role,
    career.readiness_score as career_readiness_score,
    career.mentor_engineer_name,
    coverage.required_skill_matches,
    coverage.required_skill_total,
    coverage.critical_skill_matches,
    coverage.critical_skill_total
  from public.equipment_engineer_capabilities capability
  join public.engineers engineer
    on engineer.id = capability.engineer_id
  left join lateral (
    select
      path.id,
      path.target_job_role,
      path.readiness_score,
      mentor.full_name as mentor_engineer_name
    from public.engineer_career_paths path
    left join public.engineers mentor
      on mentor.id = path.mentor_engineer_id
    where path.engineer_id = engineer.id
      and path.status = 'active'
    order by
      path.readiness_score desc nulls last,
      path.updated_at desc
    limit 1
  ) career on true
  left join lateral (
    select
      count(*) filter (
        where skill.verification_status = 'validated'
          and coalesce(
            skill.validated_rating,
            skill.manager_rating,
            0
          ) >= requirement.required_level
      )::integer as required_skill_matches,
      count(*)::integer as required_skill_total,
      count(*) filter (
        where lower(requirement.criticality) = 'critical'
          and skill.verification_status = 'validated'
          and coalesce(
            skill.validated_rating,
            skill.manager_rating,
            0
          ) >= requirement.required_level
      )::integer as critical_skill_matches,
      count(*) filter (
        where lower(requirement.criticality) = 'critical'
      )::integer as critical_skill_total
    from public.equipment_required_skills requirement
    left join public.engineer_skills skill
      on skill.engineer_id = engineer.id
     and skill.skill_id = requirement.skill_id
    where requirement.equipment_id = capability.equipment_id
  ) coverage on true
  where capability.equipment_id = p_equipment_id
  order by
    case capability.capability_role
      when 'PRIMARY_SME' then 1
      when 'BACKUP_SME' then 2
      when 'DEVELOPING_BACKUP' then 3
      when 'QUALIFIED_SUPPORT' then 4
      else 5
    end,
    capability.competency_level desc,
    engineer.full_name;
end;
$function$;

revoke all on function public.vorta_get_equipment_engineer_capabilities(uuid)
  from public, anon;
grant execute on function public.vorta_get_equipment_engineer_capabilities(uuid)
  to authenticated, postgres, service_role;

with target_equipment as (
  select equipment.id, equipment.site_id
  from public.equipment_assets equipment
  where equipment.equipment_code = 'DEMO-VF-002'
  limit 1
),
capability_seed (
  engineer_name,
  capability_role,
  capability_status,
  competency_level,
  practice_authority,
  validation_status,
  specialism,
  evidence_reference,
  notes
) as (
  values
    (
      'James Mitchell',
      'PRIMARY_SME',
      'ACTIVE',
      5,
      'AUTHORISER',
      'VALIDATED',
      'Bosch vial filler controls, servo systems and machine safety',
      'Bosch Vial Fillers skill validated at level 5',
      'Primary SME and authorised technical escalation point for Bosch Vial Filler VF-02.'
    ),
    (
      'Rebecca Hughes',
      'DEVELOPING_BACKUP',
      'IN_DEVELOPMENT',
      3,
      'SUPERVISED',
      'MANAGER_REVIEW',
      'Night-shift electrical and controls support',
      'Controls SME career path mentored by James Mitchell',
      'Developing night-shift backup SME; currently matches two of the three critical equipment skills.'
    ),
    (
      'Alex Turner',
      'QUALIFIED_SUPPORT',
      'ACTIVE',
      4,
      'INDEPENDENT',
      'VALIDATED',
      'Servo systems and HMI programming',
      'Validated equipment-required automation skills',
      'Independent automation support for servo and HMI faults.'
    ),
    (
      'Isla Green',
      'QUALIFIED_SUPPORT',
      'ACTIVE',
      4,
      'INDEPENDENT',
      'VALIDATED',
      'Pharmaceutical calibration and electrical fault finding',
      'Validated calibration and electrical skills',
      'Independent instrumentation and calibration support.'
    ),
    (
      'Gareth Owen',
      'QUALIFIED_SUPPORT',
      'ACTIVE',
      4,
      'INDEPENDENT',
      'VALIDATED',
      'Pneumatic systems and mechanical maintenance',
      'Validated pneumatic systems skill',
      'Independent mechanical and pneumatic support.'
    )
)
insert into public.equipment_engineer_capabilities (
  equipment_id,
  engineer_id,
  capability_role,
  capability_status,
  competency_level,
  practice_authority,
  validation_status,
  specialism,
  evidence_reference,
  notes
)
select
  target.id,
  engineer.id,
  seed.capability_role,
  seed.capability_status,
  seed.competency_level,
  seed.practice_authority,
  seed.validation_status,
  seed.specialism,
  seed.evidence_reference,
  seed.notes
from target_equipment target
join capability_seed seed on true
join public.engineers engineer
  on engineer.full_name = seed.engineer_name
 and engineer.site_id = target.site_id
on conflict (equipment_id, engineer_id)
do update set
  capability_role = excluded.capability_role,
  capability_status = excluded.capability_status,
  competency_level = excluded.competency_level,
  practice_authority = excluded.practice_authority,
  validation_status = excluded.validation_status,
  specialism = excluded.specialism,
  evidence_reference = excluded.evidence_reference,
  notes = excluded.notes,
  updated_at = now();
