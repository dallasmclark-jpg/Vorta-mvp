-- Move repeated Dashboard scope and labour-card calculation off the page-load path.
-- Preserve the complete typed eight-row contract and refresh it whenever the site
-- risk profile changes. The original calculator remains available as a fallback.

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

create temporary table legacy_dashboard_scopes
on commit drop
as
select scope.*
from public.vorta_get_risk_dashboard_scopes_internal() scope;

alter function public.vorta_get_risk_dashboard_scopes_internal()
  set schema private;

alter function private.vorta_get_risk_dashboard_scopes_internal()
  rename to vorta_calculate_risk_dashboard_scopes;

revoke all on function private.vorta_calculate_risk_dashboard_scopes()
  from public, anon, authenticated;
grant execute on function private.vorta_calculate_risk_dashboard_scopes()
  to service_role;

create table if not exists private.vorta_dashboard_scope_cache (
  site_id uuid not null,
  scope_key text not null,
  scope_type text not null,
  scope_label text not null,
  area text,
  display_order integer not null,
  risk_score numeric,
  risk_level text,
  operational_risk_score numeric,
  labour_risk_score numeric,
  highest_child_id uuid,
  highest_child_code text,
  highest_child_name text,
  highest_child_score numeric,
  highest_child_level text,
  asset_count integer,
  at_risk_asset_count integer,
  critical_asset_count integer,
  high_asset_count integer,
  overdue_pm_count integer,
  calibration_backlog_count integer,
  cover_gap_count integer,
  critical_spares_missing integer,
  scheduled_engineer_count integer,
  labour_shift_date date,
  labour_shift_type text,
  no_engineer_override boolean,
  priority_action text,
  risk_summary text,
  child_cards jsonb not null default '[]'::jsonb,
  labour_cards jsonb not null default '[]'::jsonb,
  refreshed_at timestamp with time zone not null default now(),
  primary key (site_id, scope_key),
  unique (site_id, display_order)
);

create index if not exists vorta_dashboard_scope_cache_refreshed_idx
  on private.vorta_dashboard_scope_cache(site_id, refreshed_at desc);

revoke all on private.vorta_dashboard_scope_cache
  from public, anon, authenticated;
grant select, insert, update, delete
  on private.vorta_dashboard_scope_cache
  to service_role;

create or replace function private.vorta_refresh_dashboard_scope_cache(
  p_site_id uuid default public.vorta_current_demo_site_id()
)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_demo_site_id uuid := public.vorta_current_demo_site_id();
  v_inserted integer := 0;
begin
  if p_site_id is null or p_site_id is distinct from v_demo_site_id then
    return 0;
  end if;

  delete from private.vorta_dashboard_scope_cache cache
  where cache.site_id = p_site_id;

  insert into private.vorta_dashboard_scope_cache (
    site_id,
    scope_key,
    scope_type,
    scope_label,
    area,
    display_order,
    risk_score,
    risk_level,
    operational_risk_score,
    labour_risk_score,
    highest_child_id,
    highest_child_code,
    highest_child_name,
    highest_child_score,
    highest_child_level,
    asset_count,
    at_risk_asset_count,
    critical_asset_count,
    high_asset_count,
    overdue_pm_count,
    calibration_backlog_count,
    cover_gap_count,
    critical_spares_missing,
    scheduled_engineer_count,
    labour_shift_date,
    labour_shift_type,
    no_engineer_override,
    priority_action,
    risk_summary,
    child_cards,
    labour_cards,
    refreshed_at
  )
  select
    p_site_id,
    calculated.scope_key,
    calculated.scope_type,
    calculated.scope_label,
    calculated.area,
    calculated.display_order,
    calculated.risk_score,
    calculated.risk_level,
    calculated.operational_risk_score,
    calculated.labour_risk_score,
    calculated.highest_child_id,
    calculated.highest_child_code,
    calculated.highest_child_name,
    calculated.highest_child_score,
    calculated.highest_child_level,
    calculated.asset_count,
    calculated.at_risk_asset_count,
    calculated.critical_asset_count,
    calculated.high_asset_count,
    calculated.overdue_pm_count,
    calculated.calibration_backlog_count,
    calculated.cover_gap_count,
    calculated.critical_spares_missing,
    calculated.scheduled_engineer_count,
    calculated.labour_shift_date,
    calculated.labour_shift_type,
    calculated.no_engineer_override,
    calculated.priority_action,
    calculated.risk_summary,
    coalesce(calculated.child_cards, '[]'::jsonb),
    coalesce(calculated.labour_cards, '[]'::jsonb),
    now()
  from private.vorta_calculate_risk_dashboard_scopes() calculated;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$function$;

revoke all on function private.vorta_refresh_dashboard_scope_cache(uuid)
  from public, anon, authenticated;
grant execute on function private.vorta_refresh_dashboard_scope_cache(uuid)
  to service_role;

select private.vorta_refresh_dashboard_scope_cache();

do $validation$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
  v_legacy jsonb;
  v_cached jsonb;
begin
  select coalesce(
    jsonb_agg(to_jsonb(scope) order by scope.display_order),
    '[]'::jsonb
  )
  into v_legacy
  from legacy_dashboard_scopes scope;

  select coalesce(
    jsonb_agg(
      to_jsonb(cache) - 'site_id' - 'refreshed_at'
      order by cache.display_order
    ),
    '[]'::jsonb
  )
  into v_cached
  from private.vorta_dashboard_scope_cache cache
  where cache.site_id = v_site_id;

  if v_legacy is distinct from v_cached then
    raise exception 'Dashboard scope cache differs from the legacy output';
  end if;

  if jsonb_array_length(v_cached) <> 8 then
    raise exception 'Expected 8 cached dashboard scope rows, found %',
      jsonb_array_length(v_cached);
  end if;
end;
$validation$;

create or replace function public.vorta_get_risk_dashboard_scopes_internal()
returns table(
  scope_key text,
  scope_type text,
  scope_label text,
  area text,
  display_order integer,
  risk_score numeric,
  risk_level text,
  operational_risk_score numeric,
  labour_risk_score numeric,
  highest_child_id uuid,
  highest_child_code text,
  highest_child_name text,
  highest_child_score numeric,
  highest_child_level text,
  asset_count integer,
  at_risk_asset_count integer,
  critical_asset_count integer,
  high_asset_count integer,
  overdue_pm_count integer,
  calibration_backlog_count integer,
  cover_gap_count integer,
  critical_spares_missing integer,
  scheduled_engineer_count integer,
  labour_shift_date date,
  labour_shift_type text,
  no_engineer_override boolean,
  priority_action text,
  risk_summary text,
  child_cards jsonb,
  labour_cards jsonb
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
begin
  if exists (
    select 1
    from private.vorta_dashboard_scope_cache cache
    where cache.site_id = v_site_id
  ) then
    return query
    select
      cache.scope_key,
      cache.scope_type,
      cache.scope_label,
      cache.area,
      cache.display_order,
      cache.risk_score,
      cache.risk_level,
      cache.operational_risk_score,
      cache.labour_risk_score,
      cache.highest_child_id,
      cache.highest_child_code,
      cache.highest_child_name,
      cache.highest_child_score,
      cache.highest_child_level,
      cache.asset_count,
      cache.at_risk_asset_count,
      cache.critical_asset_count,
      cache.high_asset_count,
      cache.overdue_pm_count,
      cache.calibration_backlog_count,
      cache.cover_gap_count,
      cache.critical_spares_missing,
      cache.scheduled_engineer_count,
      cache.labour_shift_date,
      cache.labour_shift_type,
      cache.no_engineer_override,
      cache.priority_action,
      cache.risk_summary,
      cache.child_cards,
      cache.labour_cards
    from private.vorta_dashboard_scope_cache cache
    where cache.site_id = v_site_id
    order by cache.display_order;

    return;
  end if;

  return query
  select *
  from private.vorta_calculate_risk_dashboard_scopes();
end;
$function$;

revoke all on function public.vorta_get_risk_dashboard_scopes_internal()
  from public, anon, authenticated;
grant execute on function public.vorta_get_risk_dashboard_scopes_internal()
  to service_role;

create or replace function private.vorta_refresh_dashboard_scope_cache_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  perform private.vorta_refresh_dashboard_scope_cache(new.site_id);
  return new;
end;
$function$;

revoke all on function private.vorta_refresh_dashboard_scope_cache_trigger()
  from public, anon, authenticated;

drop trigger if exists vorta_refresh_dashboard_scope_cache_after_risk
  on public.site_risk_profile;

create trigger vorta_refresh_dashboard_scope_cache_after_risk
after insert or update on public.site_risk_profile
for each row
execute function private.vorta_refresh_dashboard_scope_cache_trigger();

do $reader_validation$
declare
  v_rows integer;
  v_legacy_hash text;
  v_reader_hash text;
begin
  select count(*)::integer
  into v_rows
  from public.vorta_get_risk_dashboard_scopes_internal();

  if v_rows <> 8 then
    raise exception 'Expected 8 dashboard scope reader rows, found %', v_rows;
  end if;

  select md5(jsonb_agg(to_jsonb(scope) order by scope.display_order)::text)
  into v_legacy_hash
  from legacy_dashboard_scopes scope;

  select md5(jsonb_agg(to_jsonb(scope) order by scope.display_order)::text)
  into v_reader_hash
  from public.vorta_get_risk_dashboard_scopes_internal() scope;

  if v_legacy_hash is distinct from v_reader_hash then
    raise exception 'Dashboard scope reader hash differs after cache activation';
  end if;
end;
$reader_validation$;

-- Remove temporary activation scaffolding and the UUID aggregate compatibility
-- shim, which is no longer needed by the typed cache implementation.
drop table if exists private.vorta_migration_sql_stage;
drop aggregate if exists private.max(uuid);
drop function if exists private.vorta_uuid_max(uuid, uuid);
