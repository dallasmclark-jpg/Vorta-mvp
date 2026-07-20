-- Feed privileged-RPC review status into the existing integrity group so the
-- authenticated live backend health gate enforces it without a second checker.

create or replace function public.vorta_get_demo_backend_health()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
  v_report jsonb;
  v_unreviewed_count integer := 0;
  v_reviewed_count integer := 0;
begin
  if not public.vorta_has_site_access(v_site_id, false) then
    return null;
  end if;

  v_report := private.vorta_get_demo_backend_health_internal(v_site_id);

  select count(*)::integer
  into v_unreviewed_count
  from private.vorta_get_unreviewed_authenticated_mutation_rpcs();

  select count(*)::integer
  into v_reviewed_count
  from private.vorta_privileged_rpc_allowlist;

  return jsonb_set(
    v_report,
    '{integrity}',
    coalesce(v_report -> 'integrity', '{}'::jsonb)
      || jsonb_build_object(
        'unreviewed_authenticated_mutation_rpcs',
        v_unreviewed_count
      ),
    true
  ) || jsonb_build_object(
    'security', jsonb_build_object(
      'reviewedAuthenticatedMutationRpcCount', v_reviewed_count
    )
  );
end;
$function$;
