-- Move expensive intervention-plan construction off the dashboard read path.
-- The cache stores the exact typed scope-plan contract and is refreshed only
-- after successful risk/work-plan recalculation.

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

create temporary table legacy_dashboard_scope_plans
on commit drop
as
select
  row_number() over ()::integer as display_order,
  plan.*
from public.vorta_get_risk_dashboard_scope_plans_internal() plan;

create table if not exists private.vorta_dashboard_scope_plan_cache (
  site_id uuid not null,
  display_order integer not null,
  scope_key text not null,
  scope_type text not null,
  area text,
  current_site_risk numeric,
  current_site_level text,
  projected_site_risk numeric,
  projected_site_level text,
  highest_area text,
  current_area_risk integer,
  current_area_level text,
  projected_area_risk integer,
  projected_area_level text,
  equipment_id uuid,
  equipment_name text,
  equipment_code text,
  estimated_duration_minutes integer,
  current_pm_backlog integer,
  projected_pm_backlog integer,
  current_calibration_backlog integer,
  projected_calibration_backlog integer,
  current_stockouts integer,
  projected_stockouts integer,
  next_area text,
  next_area_risk integer,
  next_area_level text,
  equipment_rank integer,
  equipment_count integer,
  next_equipment_id uuid,
  next_equipment_code text,
  next_equipment_name text,
  next_equipment_risk integer,
  next_equipment_level text,
  actions jsonb not null default '[]'::jsonb,
  refreshed_at timestamp with time zone not null default now(),
  primary key (site_id, scope_key),
  unique (site_id, display_order)
);

create index if not exists vorta_dashboard_scope_plan_cache_refreshed_idx
  on private.vorta_dashboard_scope_plan_cache(site_id, refreshed_at desc);

revoke all on private.vorta_dashboard_scope_plan_cache
  from public, anon, authenticated;
grant select, insert, update, delete
  on private.vorta_dashboard_scope_plan_cache
  to service_role;

create or replace function private.vorta_calculate_risk_dashboard_scope_plans()
returns table(
  scope_key text,
  scope_type text,
  area text,
  current_site_risk numeric,
  current_site_level text,
  projected_site_risk numeric,
  projected_site_level text,
  highest_area text,
  current_area_risk integer,
  current_area_level text,
  projected_area_risk integer,
  projected_area_level text,
  equipment_id uuid,
  equipment_name text,
  equipment_code text,
  estimated_duration_minutes integer,
  current_pm_backlog integer,
  projected_pm_backlog integer,
  current_calibration_backlog integer,
  projected_calibration_backlog integer,
  current_stockouts integer,
  projected_stockouts integer,
  next_area text,
  next_area_risk integer,
  next_area_level text,
  equipment_rank integer,
  equipment_count integer,
  next_equipment_id uuid,
  next_equipment_code text,
  next_equipment_name text,
  next_equipment_risk integer,
  next_equipment_level text,
  actions jsonb
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  with site_plan as (
    select plan.*
    from public.vorta_get_site_risk_reduction_plan_internal() plan
  ),
  area_plans as (
    select
      area_profile.area,
      plan.*
    from public.area_risk_profiles area_profile
    cross join lateral public.vorta_get_area_equipment_risk_reduction_plan_internal(
      area_profile.area,
      null
    ) plan
  )
  select
    'site'::text,
    'site'::text,
    null::text,
    site_plan.current_site_risk,
    site_plan.current_site_level,
    site_plan.projected_site_risk,
    site_plan.projected_site_level,
    site_plan.highest_area,
    site_plan.current_area_risk,
    site_plan.current_area_level,
    site_plan.projected_area_risk,
    site_plan.projected_area_level,
    site_plan.equipment_id,
    site_plan.equipment_name,
    site_plan.equipment_code,
    site_plan.estimated_duration_minutes,
    site_plan.current_pm_backlog,
    site_plan.projected_pm_backlog,
    site_plan.current_calibration_backlog,
    site_plan.projected_calibration_backlog,
    site_plan.current_stockouts,
    site_plan.projected_stockouts,
    site_plan.next_area,
    site_plan.next_area_risk,
    site_plan.next_area_level,
    null::integer,
    null::integer,
    null::uuid,
    null::text,
    null::text,
    null::integer,
    null::text,
    site_plan.actions
  from site_plan

  union all

  select
    'area:' || area_plans.area,
    'area'::text,
    area_plans.area,
    area_plans.current_site_risk,
    area_plans.current_site_level,
    area_plans.projected_site_risk,
    area_plans.projected_site_level,
    area_plans.highest_area,
    area_plans.current_area_risk,
    area_plans.current_area_level,
    area_plans.projected_area_risk,
    area_plans.projected_area_level,
    area_plans.equipment_id,
    area_plans.equipment_name,
    area_plans.equipment_code,
    area_plans.estimated_duration_minutes,
    area_plans.current_pm_backlog,
    area_plans.projected_pm_backlog,
    area_plans.current_calibration_backlog,
    area_plans.projected_calibration_backlog,
    area_plans.current_stockouts,
    area_plans.projected_stockouts,
    area_plans.next_area,
    area_plans.next_area_risk,
    area_plans.next_area_level,
    area_plans.equipment_rank,
    area_plans.equipment_count,
    area_plans.next_equipment_id,
    area_plans.next_equipment_code,
    area_plans.next_equipment_name,
    area_plans.next_equipment_risk,
    area_plans.next_equipment_level,
    area_plans.actions
  from area_plans;
$function$;

revoke all on function private.vorta_calculate_risk_dashboard_scope_plans()
  from public, anon, authenticated;
grant execute on function private.vorta_calculate_risk_dashboard_scope_plans()
  to service_role;

create or replace function private.vorta_refresh_dashboard_scope_plan_cache()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid;
  v_inserted integer := 0;
begin
  select risk_profile.site_id
  into v_site_id
  from public.site_risk_profile risk_profile
  where risk_profile.id = 1;

  if v_site_id is null then
    return 0;
  end if;

  delete from private.vorta_dashboard_scope_plan_cache cache
  where cache.site_id = v_site_id;

  insert into private.vorta_dashboard_scope_plan_cache (
    site_id,
    display_order,
    scope_key,
    scope_type,
    area,
    current_site_risk,
    current_site_level,
    projected_site_risk,
    projected_site_level,
    highest_area,
    current_area_risk,
    current_area_level,
    projected_area_risk,
    projected_area_level,
    equipment_id,
    equipment_name,
    equipment_code,
    estimated_duration_minutes,
    current_pm_backlog,
    projected_pm_backlog,
    current_calibration_backlog,
    projected_calibration_backlog,
    current_stockouts,
    projected_stockouts,
    next_area,
    next_area_risk,
    next_area_level,
    equipment_rank,
    equipment_count,
    next_equipment_id,
    next_equipment_code,
    next_equipment_name,
    next_equipment_risk,
    next_equipment_level,
    actions,
    refreshed_at
  )
  select
    v_site_id,
    row_number() over ()::integer,
    calculated.scope_key,
    calculated.scope_type,
    calculated.area,
    calculated.current_site_risk,
    calculated.current_site_level,
    calculated.projected_site_risk,
    calculated.projected_site_level,
    calculated.highest_area,
    calculated.current_area_risk,
    calculated.current_area_level,
    calculated.projected_area_risk,
    calculated.projected_area_level,
    calculated.equipment_id,
    calculated.equipment_name,
    calculated.equipment_code,
    calculated.estimated_duration_minutes,
    calculated.current_pm_backlog,
    calculated.projected_pm_backlog,
    calculated.current_calibration_backlog,
    calculated.projected_calibration_backlog,
    calculated.current_stockouts,
    calculated.projected_stockouts,
    calculated.next_area,
    calculated.next_area_risk,
    calculated.next_area_level,
    calculated.equipment_rank,
    calculated.equipment_count,
    calculated.next_equipment_id,
    calculated.next_equipment_code,
    calculated.next_equipment_name,
    calculated.next_equipment_risk,
    calculated.next_equipment_level,
    coalesce(calculated.actions, '[]'::jsonb),
    now()
  from private.vorta_calculate_risk_dashboard_scope_plans() calculated;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$function$;

revoke all on function private.vorta_refresh_dashboard_scope_plan_cache()
  from public, anon, authenticated;
grant execute on function private.vorta_refresh_dashboard_scope_plan_cache()
  to service_role;

select private.vorta_refresh_dashboard_scope_plan_cache();

do $validation$
declare
  v_site_id uuid;
  v_legacy jsonb;
  v_cached jsonb;
begin
  select risk_profile.site_id
  into v_site_id
  from public.site_risk_profile risk_profile
  where risk_profile.id = 1;

  select coalesce(
    jsonb_agg(
      to_jsonb(legacy) - 'display_order'
      order by legacy.display_order
    ),
    '[]'::jsonb
  )
  into v_legacy
  from legacy_dashboard_scope_plans legacy;

  select coalesce(
    jsonb_agg(
      to_jsonb(cache)
        - 'site_id'
        - 'display_order'
        - 'refreshed_at'
      order by cache.display_order
    ),
    '[]'::jsonb
  )
  into v_cached
  from private.vorta_dashboard_scope_plan_cache cache
  where cache.site_id = v_site_id;

  if v_legacy is distinct from v_cached then
    raise exception 'Dashboard scope-plan cache differs from the legacy output';
  end if;

  if jsonb_array_length(v_cached) <> 8 then
    raise exception 'Expected 8 cached scope-plan rows, found %',
      jsonb_array_length(v_cached);
  end if;
end;
$validation$;

create or replace function public.vorta_get_risk_dashboard_scope_plans_internal()
returns table(
  scope_key text,
  scope_type text,
  area text,
  current_site_risk numeric,
  current_site_level text,
  projected_site_risk numeric,
  projected_site_level text,
  highest_area text,
  current_area_risk integer,
  current_area_level text,
  projected_area_risk integer,
  projected_area_level text,
  equipment_id uuid,
  equipment_name text,
  equipment_code text,
  estimated_duration_minutes integer,
  current_pm_backlog integer,
  projected_pm_backlog integer,
  current_calibration_backlog integer,
  projected_calibration_backlog integer,
  current_stockouts integer,
  projected_stockouts integer,
  next_area text,
  next_area_risk integer,
  next_area_level text,
  equipment_rank integer,
  equipment_count integer,
  next_equipment_id uuid,
  next_equipment_code text,
  next_equipment_name text,
  next_equipment_risk integer,
  next_equipment_level text,
  actions jsonb
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid;
begin
  select risk_profile.site_id
  into v_site_id
  from public.site_risk_profile risk_profile
  where risk_profile.id = 1;

  if exists (
    select 1
    from private.vorta_dashboard_scope_plan_cache cache
    where cache.site_id = v_site_id
  ) then
    return query
    select
      cache.scope_key,
      cache.scope_type,
      cache.area,
      cache.current_site_risk,
      cache.current_site_level,
      cache.projected_site_risk,
      cache.projected_site_level,
      cache.highest_area,
      cache.current_area_risk,
      cache.current_area_level,
      cache.projected_area_risk,
      cache.projected_area_level,
      cache.equipment_id,
      cache.equipment_name,
      cache.equipment_code,
      cache.estimated_duration_minutes,
      cache.current_pm_backlog,
      cache.projected_pm_backlog,
      cache.current_calibration_backlog,
      cache.projected_calibration_backlog,
      cache.current_stockouts,
      cache.projected_stockouts,
      cache.next_area,
      cache.next_area_risk,
      cache.next_area_level,
      cache.equipment_rank,
      cache.equipment_count,
      cache.next_equipment_id,
      cache.next_equipment_code,
      cache.next_equipment_name,
      cache.next_equipment_risk,
      cache.next_equipment_level,
      cache.actions
    from private.vorta_dashboard_scope_plan_cache cache
    where cache.site_id = v_site_id
    order by cache.display_order;

    return;
  end if;

  return query
  select calculated.*
  from private.vorta_calculate_risk_dashboard_scope_plans() calculated;
end;
$function$;

create or replace function public.vorta_refresh_current_risk()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
  v_result integer;
begin
  if not public.vorta_can_manage_site(v_site_id) then
    return 0;
  end if;

  v_result := public.vorta_refresh_current_risk_internal();

  if v_result = 1 then
    perform private.vorta_refresh_dashboard_scope_plan_cache();
  end if;

  return v_result;
end;
$function$;

create or replace function private.vorta_run_scheduled_risk_refresh()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_started timestamp with time zone := clock_timestamp();
  v_refresh_result integer;
  v_cache_rows integer;
  v_duration_ms numeric(12,3);
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);

  v_refresh_result := public.vorta_refresh_current_risk_internal();

  if v_refresh_result <> 1 then
    raise exception 'Scheduled Vorta risk refresh did not complete successfully';
  end if;

  v_cache_rows := private.vorta_refresh_dashboard_scope_plan_cache();

  if v_cache_rows <= 0 then
    raise exception 'Scheduled Vorta scope-plan cache refresh returned no rows';
  end if;

  v_duration_ms := round(
    (extract(epoch from clock_timestamp() - v_started) * 1000)::numeric,
    3
  );

  return jsonb_build_object(
    'status', 'success',
    'refreshResult', v_refresh_result,
    'scopePlanCacheRows', v_cache_rows,
    'durationMs', v_duration_ms,
    'completedAt', now()
  );
end;
$function$;

create or replace function public.vorta_recalculate_risk_work_plan()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
begin
  if not public.vorta_can_manage_site(v_site_id) then
    return 0;
  end if;

  perform public.vorta_sync_maintenance_risk_work_plan();
  perform private.vorta_refresh_dashboard_scope_plan_cache();
  return 1;
end;
$function$;
