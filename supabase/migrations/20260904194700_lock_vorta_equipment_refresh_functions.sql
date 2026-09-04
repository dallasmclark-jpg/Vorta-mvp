-- Refresh functions are server-side maintenance jobs, not client RPCs.
revoke all on function public.vorta_refresh_engineer_equipment_experience(uuid) from public, anon, authenticated;
revoke all on function public.vorta_refresh_engineer_equipment_scores(uuid) from public, anon, authenticated;

grant execute on function public.vorta_refresh_engineer_equipment_experience(uuid) to service_role;
grant execute on function public.vorta_refresh_engineer_equipment_scores(uuid) to service_role;
