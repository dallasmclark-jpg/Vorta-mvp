-- Preserve the existing calculation as a private base function, then expose a
-- wrapper that adds source freshness and exact skill-by-asset closure keys.

alter function public.vorta_get_shift_cover_ai_brief(uuid, date, date)
  rename to vorta_get_shift_cover_ai_brief_base;

revoke all on function public.vorta_get_shift_cover_ai_brief_base(uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.vorta_get_shift_cover_ai_brief_base(uuid, date, date)
  to service_role;

create or replace function public.vorta_get_shift_cover_ai_brief(
  p_site_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_base jsonb;
  v_skill_risks jsonb;
  v_cover_packages jsonb;
  v_source_updated_at timestamptz;
begin
  if p_start_date is null
    or p_end_date is null
    or p_end_date < p_start_date
    or p_end_date - p_start_date > 30 then
    raise exception 'Shift Cover AI date range must be between 1 and 31 days.';
  end if;

  if not public.vorta_has_site_access(p_site_id, false) then
    return null;
  end if;

  v_base := public.vorta_get_shift_cover_ai_brief_base(
    p_site_id,
    p_start_date,
    p_end_date
  );

  if v_base is null then
    return null;
  end if;

  select min(source_timestamp)
  into v_source_updated_at
  from (
    select max(coalesce(engineer.updated_at, engineer.created_at)) as source_timestamp
    from public.engineers engineer
    where engineer.site_id = p_site_id

    union all

    select max(coalesce(engineer_skill.updated_at, engineer_skill.created_at))
    from public.engineer_skills engineer_skill
    join public.engineers engineer
      on engineer.id = engineer_skill.engineer_id
     and engineer.site_id = p_site_id

    union all

    select max(coalesce(team.updated_at, team.created_at))
    from public.maintenance_shift_teams team
    where team.site_id = p_site_id

    union all

    select max(member.created_at)
    from public.maintenance_shift_team_members member
    join public.maintenance_shift_teams team
      on team.id = member.team_id
     and team.site_id = p_site_id

    union all

    select max(coalesce(asset.updated_at, asset.created_at))
    from public.equipment_assets asset
    where asset.site_id = p_site_id

    union all

    select max(coalesce(requirement.updated_at, requirement.created_at))
    from public.equipment_required_skills requirement
    join public.equipment_assets asset
      on asset.id = requirement.equipment_id
     and asset.site_id = p_site_id

    union all

    select max(coalesce(skill.updated_at, skill.created_at))
    from public.skills skill
    where exists (
      select 1
      from public.equipment_required_skills requirement
      join public.equipment_assets asset
        on asset.id = requirement.equipment_id
       and asset.site_id = p_site_id
      where requirement.skill_id = skill.id
    )
  ) source_rows;

  select coalesce(
    jsonb_agg(
      risk || jsonb_build_object(
        'gapKey',
        lower(risk ->> 'skillName') || '::' || lower(
          coalesce(
            nullif(risk ->> 'equipmentCode', ''),
            risk ->> 'equipmentName'
          )
        )
      )
      order by risk_row.ordinality
    ),
    '[]'::jsonb
  )
  into v_skill_risks
  from jsonb_array_elements(coalesce(v_base -> 'skillRisks', '[]'::jsonb))
    with ordinality as risk_row(risk, ordinality);

  select coalesce(
    jsonb_agg(
      package || jsonb_build_object(
        'closedGapKeys',
        coalesce((
          select jsonb_agg(to_jsonb(closed_gap.gap_key) order by closed_gap.gap_key)
          from (
            select distinct risk ->> 'gapKey' as gap_key
            from jsonb_array_elements(v_skill_risks) risk
            where risk ->> 'shiftDate' = package ->> 'shiftDate'
              and risk ->> 'shiftType' = package ->> 'shiftType'
              and (
                coalesce((risk ->> 'qualifiedEngineerCount')::integer, 0)
                + (
                  select count(distinct engineer.id)::integer
                  from jsonb_array_elements_text(
                    coalesce(package -> 'engineerNames', '[]'::jsonb)
                  ) as package_engineer(engineer_name)
                  join public.engineers engineer
                    on engineer.site_id = p_site_id
                   and engineer.full_name = package_engineer.engineer_name
                  join public.skills skill
                    on lower(skill.name) = lower(risk ->> 'skillName')
                  join public.engineer_skills engineer_skill
                    on engineer_skill.engineer_id = engineer.id
                   and engineer_skill.skill_id = skill.id
                  where coalesce(
                    engineer_skill.validated_rating,
                    engineer_skill.manager_rating,
                    engineer_skill.self_rating,
                    0
                  ) >= coalesce((risk ->> 'requiredLevel')::integer, 0)
                    and (
                      engineer_skill.expiry_date is null
                      or engineer_skill.expiry_date >= (risk ->> 'shiftDate')::date
                    )
                )
              ) >= coalesce((risk ->> 'minimumQualifiedEngineers')::integer, 1)
          ) closed_gap
        ), '[]'::jsonb)
      )
      order by package_row.ordinality
    ),
    '[]'::jsonb
  )
  into v_cover_packages
  from jsonb_array_elements(coalesce(v_base -> 'coverPackages', '[]'::jsonb))
    with ordinality as package_row(package, ordinality);

  return v_base || jsonb_build_object(
    'checkedAt', now(),
    'sourceUpdatedAt', v_source_updated_at,
    'skillRisks', v_skill_risks,
    'coverPackages', v_cover_packages
  );
end;
$function$;

revoke all on function public.vorta_get_shift_cover_ai_brief(uuid, date, date)
  from public, anon;
grant execute on function public.vorta_get_shift_cover_ai_brief(uuid, date, date)
  to authenticated, service_role;

comment on function public.vorta_get_shift_cover_ai_brief(uuid, date, date) is
  'Returns authorised Shift Cover evidence with source freshness and exact skill-by-asset closure keys for Ask Vorta.';
