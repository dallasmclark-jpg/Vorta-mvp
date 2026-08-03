do $migration$
declare
  v_internal_definition text;
  v_public_signature text := 'public.vorta_search_equipment_knowledge(uuid,text,integer)';
  v_internal_signature text := 'public.vorta_search_equipment_knowledge_internal(uuid,text,integer)';
begin
  select pg_get_functiondef(to_regprocedure(v_internal_signature))
  into v_internal_definition;

  if v_internal_definition is null then
    raise exception 'VOR-043 internal document search function is missing';
  end if;

  if position('summary_only_no_verified_locator' in v_internal_definition) = 0
    or position('summary_only_with_recorded_locator' in v_internal_definition) = 0
    or position('Stored document summary only; the full source text is not indexed.' in v_internal_definition) = 0
    or position('citation_label' in v_internal_definition) = 0
    or position('coverage_mode' in v_internal_definition) = 0
    or position('full_document_indexed' in v_internal_definition) = 0 then
    raise exception 'VOR-043 fail-closed document evidence contract is incomplete';
  end if;

  if has_function_privilege('anon', v_public_signature, 'EXECUTE') then
    raise exception 'Anonymous users must not execute the VOR-043 document search wrapper';
  end if;

  if not has_function_privilege('authenticated', v_public_signature, 'EXECUTE') then
    raise exception 'Authenticated users require the authorised VOR-043 document search wrapper';
  end if;

  if has_function_privilege('authenticated', v_internal_signature, 'EXECUTE') then
    raise exception 'Authenticated users must not execute the VOR-043 internal document search directly';
  end if;

  if not has_function_privilege('service_role', v_internal_signature, 'EXECUTE') then
    raise exception 'Service role requires the VOR-043 internal document search';
  end if;
end;
$migration$;

notify pgrst, 'reload schema';
