do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.vorta_get_equipment_skills_showcase(uuid)'::regprocedure)
  into function_definition;

  function_definition := replace(
    function_definition,
    E'equipment.site_id,\n      equipment.organisation_id,\n      equipment.equipment_code,',
    E'equipment.site_id,\n      site.organisation_id,\n      equipment.equipment_code,'
  );

  function_definition := replace(
    function_definition,
    E'from public.equipment_assets equipment\n    where equipment.id = p_equipment_id\n  ),\n  resilience as (',
    E'from public.equipment_assets equipment\n    join public.sites site on site.id = equipment.site_id\n    where equipment.id = p_equipment_id\n  ),\n  resilience as ('
  );

  execute function_definition;
end;
$migration$;
