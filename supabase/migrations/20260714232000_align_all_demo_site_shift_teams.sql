with team_templates (
  code,
  name,
  pattern_type,
  cycle_offset,
  active
) as (
  values
    ('RED', 'Red Shift', 'continental', 2::smallint, true),
    ('GREEN', 'Green Shift', 'continental', 4::smallint, true),
    ('BLUE', 'Blue Shift', 'continental', 6::smallint, true),
    ('YELLOW', 'Yellow Shift', 'continental', 0::smallint, true),
    ('DAYS', 'Days', 'days', 0::smallint, true),
    ('WHITE', 'White Shift', 'continental', 0::smallint, false)
)
insert into public.maintenance_shift_teams (
  site_id,
  code,
  name,
  pattern_type,
  cycle_offset,
  reference_date,
  active
)
select
  site.id,
  template.code,
  template.name,
  template.pattern_type,
  template.cycle_offset,
  date '2024-01-01',
  template.active
from public.sites site
cross join team_templates template
on conflict (site_id, code)
do update set
  name = excluded.name,
  pattern_type = excluded.pattern_type,
  cycle_offset = excluded.cycle_offset,
  reference_date = excluded.reference_date,
  active = excluded.active,
  updated_at = now();

with shift_map (legacy_shift, team_code) as (
  values
    ('A Shift', 'GREEN'),
    ('B Shift', 'RED'),
    ('C Shift', 'BLUE'),
    ('D Shift', 'YELLOW'),
    ('Green Shift', 'GREEN'),
    ('Red Shift', 'RED'),
    ('Blue Shift', 'BLUE'),
    ('Yellow Shift', 'YELLOW'),
    ('Days', 'DAYS')
)
update public.operators operator
set
  shift_team_id = team.id,
  shift = team.name,
  updated_at = now()
from shift_map mapping
join public.maintenance_shift_teams team
  on team.code = mapping.team_code
where operator.shift = mapping.legacy_shift
  and team.site_id = operator.site_id;

with day_engineers as (
  select
    engineer.id as engineer_id,
    team.id as team_id
  from public.engineers engineer
  join public.maintenance_shift_teams team
    on team.site_id = engineer.site_id
   and team.code = 'DAYS'
   and team.active
  where engineer.shift_pattern = 'Days'
)
insert into public.maintenance_shift_team_members (
  team_id,
  engineer_id,
  active_from
)
select
  day_engineer.team_id,
  day_engineer.engineer_id,
  current_date - 365
from day_engineers day_engineer
where not exists (
  select 1
  from public.maintenance_shift_team_members existing
  where existing.engineer_id = day_engineer.engineer_id
    and (existing.active_to is null or existing.active_to >= current_date)
);

with rotating_engineers as (
  select
    engineer.id as engineer_id,
    engineer.site_id,
    row_number() over (
      partition by engineer.site_id
      order by engineer.full_name
    ) as rotation_position
  from public.engineers engineer
  where engineer.shift_pattern in (
    '2 days / 2 nights',
    'Nights',
    'Shifts'
  )
    and not exists (
      select 1
      from public.maintenance_shift_team_members existing
      where existing.engineer_id = engineer.id
        and (existing.active_to is null or existing.active_to >= current_date)
    )
),
assigned as (
  select
    rotating.engineer_id,
    rotating.site_id,
    case mod(rotating.rotation_position - 1, 4)
      when 0 then 'RED'
      when 1 then 'GREEN'
      when 2 then 'BLUE'
      else 'YELLOW'
    end as team_code
  from rotating_engineers rotating
)
insert into public.maintenance_shift_team_members (
  team_id,
  engineer_id,
  active_from
)
select
  team.id,
  assigned.engineer_id,
  current_date - 365
from assigned
join public.maintenance_shift_teams team
  on team.site_id = assigned.site_id
 and team.code = assigned.team_code
 and team.active;
