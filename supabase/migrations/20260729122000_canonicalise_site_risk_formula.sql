-- VOR-020: use one canonical site operational-risk calculation for refresh and health checks.

create or replace function private.vorta_calculate_site_operational_risk(
  p_site_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  with area_stats as (
    select
      coalesce(max(profile.operational_risk_score), 0)::numeric as maximum_score,
      coalesce(avg(profile.operational_risk_score), 0)::numeric as average_score
    from public.area_risk_profiles profile
    where profile.area in (
      select distinct equipment.area
      from public.equipment_assets equipment
      where equipment.site_id = p_site_id
        and equipment.area is not null
    )
  ),
  asset_stats as (
    select
      count(*)::numeric as asset_count,
      count(*) filter (where risk.operational_risk_score >= 65)::numeric as at_risk_count
    from public.equipment_risk_profiles risk
    join public.equipment_assets equipment
      on equipment.id = risk.equipment_id
    where equipment.site_id = p_site_id
  )
  select least(
    96.0::numeric,
    greatest(
      5.0::numeric,
      round(
        area_stats.maximum_score * 0.60
        + area_stats.average_score * 0.25
        + coalesce(asset_stats.at_risk_count / nullif(asset_stats.asset_count, 0), 0) * 15,
        1
      )
    )
  )
  from area_stats, asset_stats;
$$;

revoke all on function private.vorta_calculate_site_operational_risk(uuid)
from public, anon, authenticated;
grant execute on function private.vorta_calculate_site_operational_risk(uuid)
to service_role;

comment on function private.vorta_calculate_site_operational_risk(uuid) is
  'Canonical operational component of Vorta site risk. Used by refresh and health verification.';

create or replace function public.vorta_recalculate_site_risk_profile()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_site_id uuid;
  operational_score numeric(5,1);
  labour_score numeric(5,1);
  score numeric(5,1);
  lvl text;
  h_area text;
  h_score integer;
  h_level text;
  total_assets integer;
  at_risk integer;
  operational_at_risk integer;
  critical_assets integer;
  high_assets integer;
  overdue_pms integer;
  overdue_cals integer;
  cover_gaps integer;
  missing_spares integer;
  lr record;
begin
  select coalesce(
    (select profile.site_id from public.site_risk_profile profile where profile.id = 1),
    (select site.id from public.sites site where site.name = 'Apex Wrexham Sterile Fill-Finish' limit 1)
  )
  into v_site_id;

  if v_site_id is null then
    return 0;
  end if;

  select profile.area, profile.risk_score, profile.risk_level
  into h_area, h_score, h_level
  from public.area_risk_profiles profile
  where profile.area in (
    select distinct equipment.area
    from public.equipment_assets equipment
    where equipment.site_id = v_site_id
      and equipment.area is not null
  )
  order by profile.risk_score desc, profile.area
  limit 1;

  select
    count(*)::int,
    count(*) filter (where risk.risk_level in ('Critical', 'High'))::int,
    count(*) filter (where risk.operational_risk_score >= 65)::int,
    count(*) filter (where risk.risk_level = 'Critical')::int,
    count(*) filter (where risk.risk_level = 'High')::int,
    coalesce(sum(risk.overdue_pm_count), 0)::int,
    coalesce(sum(risk.calibration_overdue_count), 0)::int,
    coalesce(sum(risk.critical_spares_missing), 0)::int
  into
    total_assets,
    at_risk,
    operational_at_risk,
    critical_assets,
    high_assets,
    overdue_pms,
    overdue_cals,
    missing_spares
  from public.equipment_risk_profiles risk
  join public.equipment_assets equipment
    on equipment.id = risk.equipment_id
  where equipment.site_id = v_site_id;

  operational_score := private.vorta_calculate_site_operational_risk(v_site_id);

  select *
  into lr
  from public.vorta_get_site_labour_risk_internal(v_site_id);

  labour_score := coalesce(lr.labour_risk_score, 0);
  cover_gaps := coalesce(lr.equipment_with_missing_cover, 0);

  score := round(operational_score * 0.85 + labour_score * 0.15, 1);

  if coalesce(lr.no_engineer_override, false) then
    score := greatest(score, 90.0);
  end if;

  score := least(100.0, greatest(5.0, score));

  lvl := case
    when score >= 85 then 'Critical'
    when score >= 65 then 'High'
    when score >= 40 then 'Medium'
    when score >= 20 then 'Low'
    else 'Minimal'
  end;

  insert into public.site_risk_profile(
    id,
    site_id,
    risk_score,
    risk_level,
    highest_area,
    highest_area_score,
    highest_area_level,
    total_assets,
    at_risk_assets,
    critical_assets,
    high_assets,
    overdue_pm_count,
    calibration_backlog_count,
    cover_gap_count,
    critical_spares_missing,
    priority_action,
    risk_summary,
    operational_risk_score,
    labour_risk_score,
    scheduled_engineer_count,
    labour_shift_date,
    labour_shift_type,
    no_engineer_override
  )
  values(
    1,
    v_site_id,
    score,
    lvl,
    h_area,
    h_score,
    h_level,
    total_assets,
    at_risk,
    critical_assets,
    high_assets,
    overdue_pms,
    overdue_cals,
    cover_gaps,
    missing_spares,
    case
      when coalesce(lr.no_engineer_override, false) then
        'Arrange immediate engineering or contractor cover: no maintenance engineer is scheduled for the current shift.'
      when labour_score >= 65 then
        'Restore qualified current-shift cover for exposed high-risk equipment.'
      else
        'Focus on the highest-risk area and clear the largest leading risk backlog.'
    end,
    case
      when coalesce(lr.no_engineer_override, false) then
        'Site risk is subject to a critical labour override because the current shift has zero scheduled maintenance engineers.'
      else
        'Site risk combines operational asset exposure at 85% with current-shift labour and skill coverage at 15%.'
    end,
    operational_score,
    labour_score,
    coalesce(lr.scheduled_engineer_count, 0),
    lr.shift_date,
    lr.shift_type,
    coalesce(lr.no_engineer_override, false)
  )
  on conflict(id) do update set
    site_id = excluded.site_id,
    risk_score = excluded.risk_score,
    risk_level = excluded.risk_level,
    highest_area = excluded.highest_area,
    highest_area_score = excluded.highest_area_score,
    highest_area_level = excluded.highest_area_level,
    total_assets = excluded.total_assets,
    at_risk_assets = excluded.at_risk_assets,
    critical_assets = excluded.critical_assets,
    high_assets = excluded.high_assets,
    overdue_pm_count = excluded.overdue_pm_count,
    calibration_backlog_count = excluded.calibration_backlog_count,
    cover_gap_count = excluded.cover_gap_count,
    critical_spares_missing = excluded.critical_spares_missing,
    priority_action = excluded.priority_action,
    risk_summary = excluded.risk_summary,
    operational_risk_score = excluded.operational_risk_score,
    labour_risk_score = excluded.labour_risk_score,
    scheduled_engineer_count = excluded.scheduled_engineer_count,
    labour_shift_date = excluded.labour_shift_date,
    labour_shift_type = excluded.labour_shift_type,
    no_engineer_override = excluded.no_engineer_override,
    updated_at = now();

  return 1;
end;
$$;

create or replace function private.vorta_record_backend_health_result(
  p_run_id uuid,
  p_check_order integer,
  p_check_key text,
  p_category text,
  p_status text,
  p_expected text,
  p_actual text,
  p_duration_ms numeric default null,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_status text := p_status;
  v_expected text := p_expected;
  v_actual text := p_actual;
  v_detail text := p_detail;
  v_site_id uuid;
  v_site_risk numeric;
  v_labour_risk numeric;
  v_no_engineer_override boolean;
  v_operational_risk numeric;
  v_expected_site_risk numeric;
begin
  if p_check_key = 'site_risk_formula_consistent' then
    select run.demo_site_id
    into v_site_id
    from private.vorta_backend_health_runs run
    where run.id = p_run_id;

    select
      profile.risk_score,
      profile.labour_risk_score,
      profile.no_engineer_override
    into
      v_site_risk,
      v_labour_risk,
      v_no_engineer_override
    from public.site_risk_profile profile
    where profile.site_id = v_site_id
    order by profile.updated_at desc nulls last
    limit 1;

    if v_site_id is not null and v_site_risk is not null then
      v_operational_risk := private.vorta_calculate_site_operational_risk(v_site_id);
      v_expected_site_risk := round(
        v_operational_risk * 0.85 + coalesce(v_labour_risk, 0) * 0.15,
        1
      );

      if coalesce(v_no_engineer_override, false) then
        v_expected_site_risk := greatest(v_expected_site_risk, 90.0);
      end if;

      v_expected_site_risk := least(100.0, greatest(5.0, v_expected_site_risk));
      v_expected := v_expected_site_risk::text;
      v_actual := v_site_risk::text;
      v_status := case
        when abs(v_site_risk - v_expected_site_risk) <= 0.1 then 'pass'
        else 'fail'
      end;
      v_detail := format(
        'Canonical operational component: %s; formula version: 2026-07-29-v1',
        v_operational_risk
      );
    end if;
  end if;

  insert into private.vorta_backend_health_results(
    run_id,
    check_order,
    check_key,
    category,
    status,
    expected,
    actual,
    duration_ms,
    detail
  )
  values(
    p_run_id,
    p_check_order,
    p_check_key,
    p_category,
    case when v_status in ('pass', 'fail', 'warn') then v_status else 'fail' end,
    v_expected,
    v_actual,
    p_duration_ms,
    v_detail
  )
  on conflict (run_id, check_key) do update
  set
    check_order = excluded.check_order,
    category = excluded.category,
    status = excluded.status,
    expected = excluded.expected,
    actual = excluded.actual,
    duration_ms = excluded.duration_ms,
    detail = excluded.detail,
    created_at = now();
end;
$$;

select public.vorta_recalculate_site_risk_profile();
