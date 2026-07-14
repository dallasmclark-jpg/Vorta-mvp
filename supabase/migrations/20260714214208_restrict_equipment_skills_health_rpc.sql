revoke all on function public.vorta_get_equipment_skills_backend_health()
  from public, anon, authenticated;
grant execute on function public.vorta_get_equipment_skills_backend_health()
  to postgres, service_role;

comment on function public.vorta_get_equipment_skills_showcase(uuid) is
  'Authenticated equipment-skills read model. SECURITY DEFINER is intentional; the function returns immediately unless private.vorta_rls_has_equipment_access authorises the requested equipment. Anonymous execution is revoked.';

comment on function public.vorta_get_equipment_skills_backend_health() is
  'Service-role-only integrity checks for equipment-linked skills, SME, AM and career-path data.';
