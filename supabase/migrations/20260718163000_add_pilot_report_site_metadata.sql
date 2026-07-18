alter function public.vorta_get_pilot_value_report(uuid, date, date)
  rename to vorta_get_pilot_value_report_core;

alter function public.vorta_get_pilot_value_report_core(uuid, date, date)
  set schema private;

revoke all on function private.vorta_get_pilot_value_report_core(uuid, date, date) from public;
revoke all on function private.vorta_get_pilot_value_report_core(uuid, date, date) from anon;
revoke all on function private.vorta_get_pilot_value_report_core(uuid, date, date) from authenticated;
revoke all on function private.vorta_get_pilot_value_report_core(uuid, date, date) from service_role;

create or replace function public.vorta_get_pilot_value_report(
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
  v_report jsonb;
  v_site_name text;
  v_site_region text;
  v_site_timezone text;
begin
  if not public.vorta_can_manage_site(p_site_id) then
    return null;
  end if;

  select
    site.name,
    site.region,
    site.timezone
  into
    v_site_name,
    v_site_region,
    v_site_timezone
  from public.sites site
  where site.id = p_site_id;

  if v_site_name is null then
    return null;
  end if;

  v_report := private.vorta_get_pilot_value_report_core(
    p_site_id,
    p_start_date,
    p_end_date
  );

  if v_report is null then
    return null;
  end if;

  return v_report || jsonb_build_object(
    'reportVersion', '1.1.0',
    'site', jsonb_build_object(
      'id', p_site_id,
      'name', v_site_name,
      'region', v_site_region,
      'timezone', coalesce(nullif(v_site_timezone, ''), 'UTC')
    )
  );
end;
$function$;

revoke all on function public.vorta_get_pilot_value_report(uuid, date, date) from public;
revoke all on function public.vorta_get_pilot_value_report(uuid, date, date) from anon;
grant execute on function public.vorta_get_pilot_value_report(uuid, date, date) to authenticated;
grant execute on function public.vorta_get_pilot_value_report(uuid, date, date) to service_role;

comment on function private.vorta_get_pilot_value_report_core(uuid, date, date) is
  'Internal evidence aggregation used by the manager-scoped pilot value report wrapper.';

comment on function public.vorta_get_pilot_value_report(uuid, date, date) is
  'Returns manager-scoped pilot value evidence with authorised site metadata for interactive and printable reporting.';
