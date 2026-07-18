create or replace function public.vorta_get_pilot_adoption_report(
  p_site_id uuid,
  p_start_date date default null,
  p_end_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_end_date date := coalesce(p_end_date, current_date);
  v_start_date date;
begin
  if not public.vorta_can_manage_site(p_site_id) then
    return null;
  end if;

  v_start_date := coalesce(
    p_start_date,
    (
      select min(snapshot.snapshot_date)
      from private.vorta_capability_risk_snapshots snapshot
      where snapshot.site_id = p_site_id
        and snapshot.snapshot_date <= v_end_date
    ),
    v_end_date
  );

  return private.vorta_get_pilot_adoption_report_core(
    p_site_id,
    least(v_start_date, v_end_date),
    greatest(v_start_date, v_end_date)
  );
end;
$function$;

revoke all on function public.vorta_get_pilot_adoption_report(uuid, date, date) from public;
revoke all on function public.vorta_get_pilot_adoption_report(uuid, date, date) from anon;
grant execute on function public.vorta_get_pilot_adoption_report(uuid, date, date) to authenticated;
grant execute on function public.vorta_get_pilot_adoption_report(uuid, date, date) to service_role;

comment on function public.vorta_get_pilot_adoption_report(uuid, date, date) is
  'Returns manager-scoped, date-filtered Maintenance Manager adoption evidence without exposing raw usage events.';
