alter table public.engineers
  add column if not exists avatar_url text;

comment on column public.engineers.avatar_url is
  'Customer-controlled profile portrait URL. Prefer a private Supabase Storage signed URL or approved identity-provider image.';

comment on column public.operators.avatar_url is
  'Customer-controlled profile portrait URL. Prefer a private Supabase Storage signed URL or approved identity-provider image.';

with portraits(full_name, avatar_url) as (
  values
    ('Alex Turner', 'https://randomuser.me/api/portraits/men/11.jpg'),
    ('Amelia Fox', 'https://randomuser.me/api/portraits/women/11.jpg'),
    ('Andrew Patel', 'https://randomuser.me/api/portraits/men/12.jpg'),
    ('Ben Cooper', 'https://randomuser.me/api/portraits/men/13.jpg'),
    ('Ben Harrison', 'https://randomuser.me/api/portraits/men/14.jpg'),
    ('Callum Scott', 'https://randomuser.me/api/portraits/men/15.jpg'),
    ('Charlotte Reed', 'https://randomuser.me/api/portraits/women/12.jpg'),
    ('Chloe Williams', 'https://randomuser.me/api/portraits/women/13.jpg'),
    ('Chris Morgan', 'https://randomuser.me/api/portraits/men/16.jpg'),
    ('Daniel Roberts', 'https://randomuser.me/api/portraits/men/17.jpg'),
    ('Dylan Morris', 'https://randomuser.me/api/portraits/men/18.jpg'),
    ('Emma Clarke', 'https://randomuser.me/api/portraits/women/14.jpg'),
    ('Ethan White', 'https://randomuser.me/api/portraits/men/19.jpg'),
    ('Gareth Owen', 'https://randomuser.me/api/portraits/men/20.jpg'),
    ('Grace Murphy', 'https://randomuser.me/api/portraits/women/15.jpg'),
    ('Hannah Lewis', 'https://randomuser.me/api/portraits/women/16.jpg'),
    ('Hannah Roberts', 'https://randomuser.me/api/portraits/women/17.jpg'),
    ('Isla Green', 'https://randomuser.me/api/portraits/women/18.jpg'),
    ('Jack Price', 'https://randomuser.me/api/portraits/men/21.jpg'),
    ('James Mitchell', 'https://randomuser.me/api/portraits/men/22.jpg'),
    ('Josh Edwards', 'https://randomuser.me/api/portraits/men/23.jpg'),
    ('Laura Davies', 'https://randomuser.me/api/portraits/women/19.jpg'),
    ('Leanne Carter', 'https://randomuser.me/api/portraits/women/20.jpg'),
    ('Luke Harrison', 'https://randomuser.me/api/portraits/men/24.jpg'),
    ('Matthew Evans', 'https://randomuser.me/api/portraits/men/25.jpg'),
    ('Matthew Lewis', 'https://randomuser.me/api/portraits/men/26.jpg'),
    ('Megan Ellis', 'https://randomuser.me/api/portraits/women/21.jpg'),
    ('Mohammed Khan', 'https://randomuser.me/api/portraits/men/27.jpg'),
    ('Natalie Morgan', 'https://randomuser.me/api/portraits/women/22.jpg'),
    ('Nathan Brooks', 'https://randomuser.me/api/portraits/men/28.jpg'),
    ('Nia Roberts', 'https://randomuser.me/api/portraits/women/23.jpg'),
    ('Oliver Clarke', 'https://randomuser.me/api/portraits/men/29.jpg'),
    ('Olivia Bennett', 'https://randomuser.me/api/portraits/women/24.jpg'),
    ('Owen Griffiths', 'https://randomuser.me/api/portraits/men/30.jpg'),
    ('Priya Shah', 'https://randomuser.me/api/portraits/women/25.jpg'),
    ('Rebecca Hughes', 'https://randomuser.me/api/portraits/women/26.jpg'),
    ('Rhys Thomas', 'https://randomuser.me/api/portraits/men/31.jpg'),
    ('Sophie Bennett', 'https://randomuser.me/api/portraits/women/27.jpg'),
    ('Sophie Williams', 'https://randomuser.me/api/portraits/women/28.jpg'),
    ('Zara Ahmed', 'https://randomuser.me/api/portraits/women/29.jpg')
)
update public.engineers engineer
set avatar_url = portraits.avatar_url,
    updated_at = now()
from portraits
where engineer.full_name = portraits.full_name
  and engineer.avatar_url is distinct from portraits.avatar_url;

with portraits(display_name, avatar_url) as (
  values
    ('Aisha Khan', 'https://randomuser.me/api/portraits/women/50.jpg'),
    ('Amelia Green', 'https://randomuser.me/api/portraits/women/51.jpg'),
    ('Archie Wood', 'https://randomuser.me/api/portraits/men/50.jpg'),
    ('Bethan Hughes', 'https://randomuser.me/api/portraits/women/52.jpg'),
    ('Callum Davies', 'https://randomuser.me/api/portraits/men/51.jpg'),
    ('Carys Morgan', 'https://randomuser.me/api/portraits/women/53.jpg'),
    ('Chris Morgan', 'https://randomuser.me/api/portraits/men/16.jpg'),
    ('David Roberts', 'https://randomuser.me/api/portraits/men/53.jpg'),
    ('Dylan Jones', 'https://randomuser.me/api/portraits/men/54.jpg'),
    ('Ella Parker', 'https://randomuser.me/api/portraits/women/54.jpg'),
    ('Emma Williams', 'https://randomuser.me/api/portraits/women/55.jpg'),
    ('Ethan Brooks', 'https://randomuser.me/api/portraits/men/55.jpg'),
    ('Evie Richardson', 'https://randomuser.me/api/portraits/women/56.jpg'),
    ('Freya Nelson', 'https://randomuser.me/api/portraits/women/57.jpg'),
    ('Grace Morris', 'https://randomuser.me/api/portraits/women/58.jpg'),
    ('Harry Bell', 'https://randomuser.me/api/portraits/men/56.jpg'),
    ('Isla Foster', 'https://randomuser.me/api/portraits/women/59.jpg'),
    ('Jack Turner', 'https://randomuser.me/api/portraits/men/57.jpg'),
    ('Jacob Bailey', 'https://randomuser.me/api/portraits/men/58.jpg'),
    ('Joshua Walker', 'https://randomuser.me/api/portraits/men/59.jpg'),
    ('Liam Edwards', 'https://randomuser.me/api/portraits/men/60.jpg'),
    ('Lily Carter', 'https://randomuser.me/api/portraits/women/60.jpg'),
    ('Lucas Adams', 'https://randomuser.me/api/portraits/men/61.jpg'),
    ('Mason Clark', 'https://randomuser.me/api/portraits/men/62.jpg'),
    ('Megan Price', 'https://randomuser.me/api/portraits/women/61.jpg'),
    ('Megan Roberts', 'https://randomuser.me/api/portraits/women/62.jpg'),
    ('Michael Evans', 'https://randomuser.me/api/portraits/men/63.jpg'),
    ('Nia Williams', 'https://randomuser.me/api/portraits/women/63.jpg'),
    ('Noah Ward', 'https://randomuser.me/api/portraits/men/64.jpg'),
    ('Olivia Reed', 'https://randomuser.me/api/portraits/women/64.jpg'),
    ('Oscar Hill', 'https://randomuser.me/api/portraits/men/65.jpg'),
    ('Owen Price', 'https://randomuser.me/api/portraits/men/42.jpg'),
    ('Rhys Evans', 'https://randomuser.me/api/portraits/men/66.jpg'),
    ('Ruby Cook', 'https://randomuser.me/api/portraits/women/65.jpg'),
    ('Ryan Bennett', 'https://randomuser.me/api/portraits/men/67.jpg'),
    ('Samuel Robinson', 'https://randomuser.me/api/portraits/men/68.jpg'),
    ('Sarah Jones', 'https://randomuser.me/api/portraits/women/66.jpg'),
    ('Sienna Hall', 'https://randomuser.me/api/portraits/women/67.jpg'),
    ('Sophie Clarke', 'https://randomuser.me/api/portraits/women/68.jpg'),
    ('Tom Hughes', 'https://randomuser.me/api/portraits/men/69.jpg'),
    ('Willow Thompson', 'https://randomuser.me/api/portraits/women/69.jpg')
)
update public.operators operator
set avatar_url = portraits.avatar_url,
    updated_at = now()
from portraits
where operator.display_name = portraits.display_name
  and operator.avatar_url is distinct from portraits.avatar_url;

create or replace function public.vorta_get_equipment_skills_showcase(p_equipment_id uuid)
returns table(
  equipment_id uuid,
  equipment_code text,
  equipment_name text,
  equipment_type text,
  area text,
  required_skill_count integer,
  primary_sme_count integer,
  backup_sme_count integer,
  developing_backup_count integer,
  active_am_operator_count integer,
  rotating_shift_coverage_count integer,
  rotating_shift_gap_count integer,
  people_resilience_score numeric,
  required_skills jsonb,
  engineers jsonb,
  operators jsonb,
  development_paths jsonb,
  shift_coverage jsonb
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
  with equipment_record as (
    select equipment.id, equipment.equipment_code, equipment.name, equipment.equipment_type, equipment.area
    from public.equipment_assets equipment
    where equipment.id = p_equipment_id
  ),
  resilience as (
    select * from private.vorta_get_equipment_people_resilience(p_equipment_id)
  ),
  skill_rows as (
    select
      requirement.id,
      skill.id as skill_id,
      skill.name,
      skill.category,
      requirement.required_level,
      requirement.minimum_qualified_engineers,
      requirement.criticality,
      requirement.execution_authority,
      requirement.validation_required,
      requirement.evidence_reference,
      count(distinct capability.engineer_id) filter (
        where capability.capability_status = 'ACTIVE'
          and capability.validation_status = 'VALIDATED'
          and coalesce(engineer_skill.validated_rating, engineer_skill.manager_rating, 0)
            >= requirement.required_level
      )::integer as qualified_engineer_count
    from public.equipment_required_skills requirement
    join public.skills skill on skill.id = requirement.skill_id
    left join public.equipment_engineer_capabilities capability
      on capability.equipment_id = requirement.equipment_id
    left join public.engineer_skills engineer_skill
      on engineer_skill.engineer_id = capability.engineer_id
     and engineer_skill.skill_id = requirement.skill_id
    where requirement.equipment_id = p_equipment_id
    group by requirement.id, skill.id, skill.name, skill.category
  ),
  engineer_rows as (
    select
      to_jsonb(engineer_capability)
      || jsonb_build_object('avatar_url', engineer.avatar_url) as item
    from public.vorta_get_equipment_engineer_capabilities(p_equipment_id) engineer_capability
    join public.engineers engineer on engineer.id = engineer_capability.engineer_id
  ),
  operator_rows as (
    select
      to_jsonb(operator_capability)
      || jsonb_build_object('avatar_url', operator.avatar_url) as item
    from public.vorta_get_equipment_operator_capabilities(p_equipment_id) operator_capability
    join public.operators operator on operator.id = operator_capability.operator_id
  ),
  path_rows as (
    select to_jsonb(development_path) as item
    from public.vorta_get_equipment_development_paths(p_equipment_id) development_path
  ),
  shift_codes(code, sort_order) as (
    values ('RED'::text, 1), ('GREEN'::text, 2), ('BLUE'::text, 3), ('YELLOW'::text, 4)
  ),
  shift_rows as (
    select
      shift_code.code,
      count(distinct assignment.operator_id) filter (
        where assignment.assignment_status = 'ACTIVE'
          and assignment.am_step >= 1
          and assignment.am_validation_status = 'VALIDATED'
          and (assignment.valid_until is null or assignment.valid_until >= current_date)
      )::integer as validated_am_operator_count,
      shift_code.sort_order
    from shift_codes shift_code
    left join public.maintenance_shift_teams shift_team
      on shift_team.code = shift_code.code
     and shift_team.site_id = (
       select equipment.site_id from public.equipment_assets equipment where equipment.id = p_equipment_id
     )
    left join public.operators operator on operator.shift_team_id = shift_team.id
    left join public.operator_equipment_assignments assignment
      on assignment.operator_id = operator.id
     and assignment.equipment_id = p_equipment_id
    group by shift_code.code, shift_code.sort_order
  )
  select
    equipment_record.id,
    equipment_record.equipment_code,
    equipment_record.name,
    equipment_record.equipment_type,
    equipment_record.area,
    (select count(*)::integer from skill_rows),
    resilience.primary_sme_count,
    resilience.backup_sme_count,
    resilience.developing_backup_count,
    resilience.active_am_operator_count,
    resilience.rotating_shift_coverage_count,
    greatest(4 - resilience.rotating_shift_coverage_count, 0),
    resilience.people_resilience_score,
    coalesce((
      select jsonb_agg(to_jsonb(skill_row) order by skill_row.criticality, skill_row.name)
      from skill_rows skill_row
    ), '[]'::jsonb),
    coalesce((select jsonb_agg(item) from engineer_rows), '[]'::jsonb),
    coalesce((select jsonb_agg(item) from operator_rows), '[]'::jsonb),
    coalesce((select jsonb_agg(item) from path_rows), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'shiftCode', shift_row.code,
          'validatedAmOperatorCount', shift_row.validated_am_operator_count,
          'covered', shift_row.validated_am_operator_count > 0
        )
        order by shift_row.sort_order
      )
      from shift_rows shift_row
    ), '[]'::jsonb)
  from equipment_record
  cross join resilience;
end;
$function$;
