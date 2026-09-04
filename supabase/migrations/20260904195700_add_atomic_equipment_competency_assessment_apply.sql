create or replace function public.vorta_apply_equipment_competency_assessment(
  p_site_id uuid,
  p_equipment_id uuid,
  p_engineer_id uuid,
  p_assessor_profile_id uuid,
  p_assessor_engineer_id uuid,
  p_assessment_level integer,
  p_assessor_authority text,
  p_evidence_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_existing public.equipment_engineer_capabilities%rowtype;
  v_assessment_id uuid;
  v_capability_id uuid;
  v_previous_assessment_id uuid;
begin
  if p_assessment_level < 1 or p_assessment_level > 5 then
    raise exception 'Assessment level must be between 1 and 5' using errcode = '22023';
  end if;

  if not exists (select 1 from public.equipment_assets e where e.id = p_equipment_id and e.site_id = p_site_id) then
    raise exception 'Equipment is not in the supplied site' using errcode = '23514';
  end if;
  if not exists (select 1 from public.engineers e where e.id = p_engineer_id and e.site_id = p_site_id) then
    raise exception 'Engineer is not in the supplied site' using errcode = '23514';
  end if;

  select * into v_existing
  from public.equipment_engineer_capabilities c
  where c.equipment_id = p_equipment_id and c.engineer_id = p_engineer_id
  for update;

  if found and v_existing.capability_role = 'PRIMARY_SME' and p_assessment_level < 4 then
    raise exception 'Primary SME competency cannot be validated below level 4 without changing the capability role first' using errcode = '23514';
  end if;

  select id into v_previous_assessment_id
  from public.equipment_competency_assessments
  where equipment_id = p_equipment_id and engineer_id = p_engineer_id
  order by assessed_at desc, created_at desc
  limit 1;

  insert into public.equipment_competency_assessments (
    site_id, equipment_id, engineer_id, assessor_profile_id, assessor_engineer_id,
    assessment_level, assessment_status, assessor_authority, evidence_reference,
    notes, supersedes_assessment_id, assessed_at, created_at
  ) values (
    p_site_id, p_equipment_id, p_engineer_id, p_assessor_profile_id, p_assessor_engineer_id,
    p_assessment_level, 'validated', p_assessor_authority, nullif(btrim(p_evidence_reference), ''),
    nullif(btrim(p_notes), ''), v_previous_assessment_id, now(), now()
  ) returning id into v_assessment_id;

  if v_existing.id is null then
    insert into public.equipment_engineer_capabilities (
      equipment_id, engineer_id, capability_role, capability_status, competency_level,
      practice_authority, validation_status, specialism, evidence_reference,
      valid_from, valid_until, notes, verified_by_profile_id, verified_by_engineer_id,
      verified_at, created_at, updated_at
    ) values (
      p_equipment_id, p_engineer_id, 'QUALIFIED_SUPPORT', 'ACTIVE', p_assessment_level,
      'SUPERVISED', 'VALIDATED', null, nullif(btrim(p_evidence_reference), ''),
      current_date, null, 'Competency validated; execution authority remains supervised until separately authorised.',
      p_assessor_profile_id, p_assessor_engineer_id, now(), now(), now()
    ) returning id into v_capability_id;
  else
    update public.equipment_engineer_capabilities
    set competency_level = p_assessment_level,
        validation_status = 'VALIDATED',
        evidence_reference = coalesce(nullif(btrim(p_evidence_reference), ''), evidence_reference),
        verified_by_profile_id = p_assessor_profile_id,
        verified_by_engineer_id = p_assessor_engineer_id,
        verified_at = now(),
        valid_from = least(valid_from, current_date),
        updated_at = now()
    where id = v_existing.id
    returning id into v_capability_id;
  end if;

  return jsonb_build_object(
    'assessmentId', v_assessment_id,
    'capabilityId', v_capability_id,
    'equipmentId', p_equipment_id,
    'engineerId', p_engineer_id,
    'assessmentLevel', p_assessment_level,
    'assessmentStatus', 'validated',
    'assessorAuthority', p_assessor_authority,
    'verifiedAt', now()
  );
end;
$$;

revoke all on function public.vorta_apply_equipment_competency_assessment(uuid,uuid,uuid,uuid,uuid,integer,text,text,text) from public, anon, authenticated;
grant execute on function public.vorta_apply_equipment_competency_assessment(uuid,uuid,uuid,uuid,uuid,integer,text,text,text) to service_role;
