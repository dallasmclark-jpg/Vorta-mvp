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
  if not private.vorta_rls_has_equipment_access(p_equipment_id, false) then
    return;
  end if;

  return query
  select
    capability.id,
    engineer.id,
    engineer.full_name,
    engineer.discipline,
    coalesce(team.name, engineer.shift_pattern),
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
    career.id,
    career.target_job_role,
    career.readiness_score,
    career.mentor_engineer_name,
    coverage.required_skill_matches,
    coverage.required_skill_total,
    coverage.critical_skill_matches,
    coverage.critical_skill_total
  from public.equipment_engineer_capabilities capability
  join public.engineers engineer on engineer.id = capability.engineer_id
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
      path.id,
      path.target_job_role,
      path.readiness_score,
      mentor.full_name as mentor_engineer_name
    from public.engineer_career_paths path
    left join public.engineers mentor on mentor.id = path.mentor_engineer_id
    where path.engineer_id = engineer.id
      and path.equipment_id = capability.equipment_id
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
          and coalesce(skill.validated_rating, skill.manager_rating, 0)
            >= requirement.required_level
      )::integer as required_skill_matches,
      count(*)::integer as required_skill_total,
      count(*) filter (
        where lower(requirement.criticality) = 'critical'
          and skill.verification_status = 'validated'
          and coalesce(skill.validated_rating, skill.manager_rating, 0)
            >= requirement.required_level
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
