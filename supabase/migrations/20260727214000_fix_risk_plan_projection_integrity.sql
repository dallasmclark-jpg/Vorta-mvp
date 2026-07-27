-- Keep risk-reduction projections aligned with the verified current snapshot.
--
-- The intervention engine can legitimately lower an equipment score while an
-- area or site score stays unchanged because another asset remains the leading
-- exposure. It must never present an increased area/site score as a reduction.

create or replace function private.vorta_safe_projected_risk(
  p_current numeric,
  p_projected numeric
)
returns numeric
language sql
immutable
set search_path = pg_catalog
as $function$
  select case
    when p_current is null then null
    when p_projected is null then p_current
    when p_projected::text = 'NaN' then p_current
    when p_projected < 0 or p_projected > 100 then p_current
    else least(p_current, p_projected)
  end;
$function$;

create or replace function private.vorta_risk_level(
  p_score numeric
)
returns text
language sql
immutable
set search_path = pg_catalog
as $function$
  select case
    when p_score is null then 'Unknown'
    when p_score >= 85 then 'Critical'
    when p_score >= 65 then 'High'
    when p_score >= 40 then 'Medium'
    when p_score >= 20 then 'Low'
    else 'Minimal'
  end;
$function$;

create or replace function public.vorta_get_site_risk_reduction_plan()
returns table(
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
  actions jsonb
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
begin
  if not public.vorta_has_site_access(v_site_id, true) then
    return;
  end if;

  return query
  select
    plan.current_site_risk,
    plan.current_site_level,
    private.vorta_safe_projected_risk(
      plan.current_site_risk,
      plan.projected_site_risk
    ),
    private.vorta_risk_level(
      private.vorta_safe_projected_risk(
        plan.current_site_risk,
        plan.projected_site_risk
      )
    ),
    plan.highest_area,
    plan.current_area_risk,
    plan.current_area_level,
    private.vorta_safe_projected_risk(
      plan.current_area_risk,
      plan.projected_area_risk
    )::integer,
    private.vorta_risk_level(
      private.vorta_safe_projected_risk(
        plan.current_area_risk,
        plan.projected_area_risk
      )
    ),
    plan.equipment_id,
    plan.equipment_name,
    plan.equipment_code,
    greatest(plan.estimated_duration_minutes, 0),
    greatest(plan.current_pm_backlog, 0),
    least(
      greatest(plan.current_pm_backlog, 0),
      greatest(plan.projected_pm_backlog, 0)
    ),
    greatest(plan.current_calibration_backlog, 0),
    least(
      greatest(plan.current_calibration_backlog, 0),
      greatest(plan.projected_calibration_backlog, 0)
    ),
    greatest(plan.current_stockouts, 0),
    least(
      greatest(plan.current_stockouts, 0),
      greatest(plan.projected_stockouts, 0)
    ),
    plan.next_area,
    plan.next_area_risk,
    plan.next_area_level,
    coalesce(plan.actions, '[]'::jsonb)
  from public.vorta_get_site_risk_reduction_plan_internal() plan;
end;
$function$;

create or replace function public.vorta_get_area_risk_reduction_plan(
  p_area text
)
returns table(
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
  actions jsonb
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
begin
  if not public.vorta_has_site_access(v_site_id, true) then
    return;
  end if;

  return query
  select
    plan.current_site_risk,
    plan.current_site_level,
    private.vorta_safe_projected_risk(
      plan.current_site_risk,
      plan.projected_site_risk
    ),
    private.vorta_risk_level(
      private.vorta_safe_projected_risk(
        plan.current_site_risk,
        plan.projected_site_risk
      )
    ),
    plan.highest_area,
    plan.current_area_risk,
    plan.current_area_level,
    private.vorta_safe_projected_risk(
      plan.current_area_risk,
      plan.projected_area_risk
    )::integer,
    private.vorta_risk_level(
      private.vorta_safe_projected_risk(
        plan.current_area_risk,
        plan.projected_area_risk
      )
    ),
    plan.equipment_id,
    plan.equipment_name,
    plan.equipment_code,
    greatest(plan.estimated_duration_minutes, 0),
    greatest(plan.current_pm_backlog, 0),
    least(
      greatest(plan.current_pm_backlog, 0),
      greatest(plan.projected_pm_backlog, 0)
    ),
    greatest(plan.current_calibration_backlog, 0),
    least(
      greatest(plan.current_calibration_backlog, 0),
      greatest(plan.projected_calibration_backlog, 0)
    ),
    greatest(plan.current_stockouts, 0),
    least(
      greatest(plan.current_stockouts, 0),
      greatest(plan.projected_stockouts, 0)
    ),
    plan.next_area,
    plan.next_area_risk,
    plan.next_area_level,
    coalesce(plan.actions, '[]'::jsonb)
  from public.vorta_get_area_risk_reduction_plan_internal(p_area) plan;
end;
$function$;

create or replace function public.vorta_get_area_equipment_risk_reduction_plan(
  p_area text,
  p_equipment_id uuid default null::uuid
)
returns table(
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
  v_site_id uuid := public.vorta_current_demo_site_id();
begin
  if not public.vorta_has_site_access(v_site_id, true) then
    return;
  end if;

  return query
  select
    plan.current_site_risk,
    plan.current_site_level,
    private.vorta_safe_projected_risk(
      plan.current_site_risk,
      plan.projected_site_risk
    ),
    private.vorta_risk_level(
      private.vorta_safe_projected_risk(
        plan.current_site_risk,
        plan.projected_site_risk
      )
    ),
    plan.highest_area,
    plan.current_area_risk,
    plan.current_area_level,
    private.vorta_safe_projected_risk(
      plan.current_area_risk,
      plan.projected_area_risk
    )::integer,
    private.vorta_risk_level(
      private.vorta_safe_projected_risk(
        plan.current_area_risk,
        plan.projected_area_risk
      )
    ),
    plan.equipment_id,
    plan.equipment_name,
    plan.equipment_code,
    greatest(plan.estimated_duration_minutes, 0),
    greatest(plan.current_pm_backlog, 0),
    least(
      greatest(plan.current_pm_backlog, 0),
      greatest(plan.projected_pm_backlog, 0)
    ),
    greatest(plan.current_calibration_backlog, 0),
    least(
      greatest(plan.current_calibration_backlog, 0),
      greatest(plan.projected_calibration_backlog, 0)
    ),
    greatest(plan.current_stockouts, 0),
    least(
      greatest(plan.current_stockouts, 0),
      greatest(plan.projected_stockouts, 0)
    ),
    plan.next_area,
    plan.next_area_risk,
    plan.next_area_level,
    plan.equipment_rank,
    plan.equipment_count,
    plan.next_equipment_id,
    plan.next_equipment_code,
    plan.next_equipment_name,
    plan.next_equipment_risk,
    plan.next_equipment_level,
    coalesce(plan.actions, '[]'::jsonb)
  from public.vorta_get_area_equipment_risk_reduction_plan_internal(
    p_area,
    p_equipment_id
  ) plan;
end;
$function$;

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
    private.vorta_safe_projected_risk(
      site_plan.current_site_risk,
      site_plan.projected_site_risk
    ),
    private.vorta_risk_level(
      private.vorta_safe_projected_risk(
        site_plan.current_site_risk,
        site_plan.projected_site_risk
      )
    ),
    site_plan.highest_area,
    site_plan.current_area_risk,
    site_plan.current_area_level,
    private.vorta_safe_projected_risk(
      site_plan.current_area_risk,
      site_plan.projected_area_risk
    )::integer,
    private.vorta_risk_level(
      private.vorta_safe_projected_risk(
        site_plan.current_area_risk,
        site_plan.projected_area_risk
      )
    ),
    site_plan.equipment_id,
    site_plan.equipment_name,
    site_plan.equipment_code,
    greatest(site_plan.estimated_duration_minutes, 0),
    greatest(site_plan.current_pm_backlog, 0),
    least(
      greatest(site_plan.current_pm_backlog, 0),
      greatest(site_plan.projected_pm_backlog, 0)
    ),
    greatest(site_plan.current_calibration_backlog, 0),
    least(
      greatest(site_plan.current_calibration_backlog, 0),
      greatest(site_plan.projected_calibration_backlog, 0)
    ),
    greatest(site_plan.current_stockouts, 0),
    least(
      greatest(site_plan.current_stockouts, 0),
      greatest(site_plan.projected_stockouts, 0)
    ),
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
    coalesce(site_plan.actions, '[]'::jsonb)
  from site_plan

  union all

  select
    'area:' || area_plans.area,
    'area'::text,
    area_plans.area,
    area_plans.current_site_risk,
    area_plans.current_site_level,
    private.vorta_safe_projected_risk(
      area_plans.current_site_risk,
      area_plans.projected_site_risk
    ),
    private.vorta_risk_level(
      private.vorta_safe_projected_risk(
        area_plans.current_site_risk,
        area_plans.projected_site_risk
      )
    ),
    area_plans.highest_area,
    area_plans.current_area_risk,
    area_plans.current_area_level,
    private.vorta_safe_projected_risk(
      area_plans.current_area_risk,
      area_plans.projected_area_risk
    )::integer,
    private.vorta_risk_level(
      private.vorta_safe_projected_risk(
        area_plans.current_area_risk,
        area_plans.projected_area_risk
      )
    ),
    area_plans.equipment_id,
    area_plans.equipment_name,
    area_plans.equipment_code,
    greatest(area_plans.estimated_duration_minutes, 0),
    greatest(area_plans.current_pm_backlog, 0),
    least(
      greatest(area_plans.current_pm_backlog, 0),
      greatest(area_plans.projected_pm_backlog, 0)
    ),
    greatest(area_plans.current_calibration_backlog, 0),
    least(
      greatest(area_plans.current_calibration_backlog, 0),
      greatest(area_plans.projected_calibration_backlog, 0)
    ),
    greatest(area_plans.current_stockouts, 0),
    least(
      greatest(area_plans.current_stockouts, 0),
      greatest(area_plans.projected_stockouts, 0)
    ),
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
    coalesce(area_plans.actions, '[]'::jsonb)
  from area_plans;
$function$;

do $validation$
begin
  if private.vorta_safe_projected_risk(68.4, 87.7) <> 68.4
     or private.vorta_safe_projected_risk(80, 82) <> 80
     or private.vorta_safe_projected_risk(70, 62) <> 62
     or private.vorta_risk_level(68.4) <> 'High' then
    raise exception 'Risk projection integrity helpers failed validation';
  end if;
end;
$validation$;
