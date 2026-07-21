revoke all on function public.vorta_get_system_health_summary() from public, anon;
revoke all on function public.vorta_get_system_health_incidents(integer) from public, anon;
revoke all on function public.vorta_get_latest_recovery_manifest() from public, anon;

grant execute on function public.vorta_get_system_health_summary() to authenticated;
grant execute on function public.vorta_get_system_health_incidents(integer) to authenticated;
grant execute on function public.vorta_get_latest_recovery_manifest() to authenticated;

comment on function public.vorta_get_system_health_summary() is
  'Read-only active-site system health summary. SECURITY DEFINER access remains constrained by vorta_has_site_access.';
comment on function public.vorta_get_system_health_incidents(integer) is
  'Read-only active-site system health incidents. SECURITY DEFINER access remains constrained by vorta_has_site_access.';
comment on function public.vorta_get_latest_recovery_manifest() is
  'Read-only active-site recovery evidence. SECURITY DEFINER access remains constrained by vorta_has_site_access.';
