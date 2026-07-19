-- Keep area and site risk comparable as the equipment population grows.
-- Raw counts previously added fixed points per at-risk asset, which meant
-- duplicating an otherwise identical asset population increased the score.

create or replace function public.vorta_recalculate_area_risk_profiles()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  n integer := 0;
  operational_score numeric(5,1);
  labour_score numeric(5,1);
  score integer;
  lvl text;
  top_name text;
  top_score integer;
  v_site_id uuid;
begin
  select srp.site_id
  into v_site_id
  from public.site_risk_profile srp
  where srp.id = 1;

  if v_site_id is null then
    return 0;
  end if;

  for r in
    select
      ea.area,
      count(*)::int as asset_count,
      count(*) filter (where erp.risk_level = 'Critical')::int as critical_assets,
      count(*) filter (where erp.risk_level = 'High')::int as high_assets,
      max(erp.risk_score)::int as max_score,
      avg(erp.risk_score)::numeric as avg_score,
      max(erp.operational_risk_score)::numeric as max_operational_score,
      avg(erp.operational_risk_score)::numeric as avg_operational_score,
      count(*) filter (where erp.operational_risk_score >= 65)::int as operational_at_risk_assets,
      max(erp.labour_risk_score)::numeric as max_labour_score,
      sum(
        erp.labour_risk_score * case lower(coalesce(ea.criticality, ''))
          when 'critical' then 4
          when 'high' then 3
          when 'medium' then 2
          when 'low' then 1
          else 1
        end
      ) / nullif(sum(
        case lower(coalesce(ea.criticality, ''))
          when 'critical' then 4
          when 'high' then 3
          when 'medium' then 2
          when 'low' then 1
          else 1
        end
      ), 0) as weighted_labour_avg,
      max(erp.scheduled_engineer_count)::int as scheduled_engineers,
      bool_or(erp.no_engineer_override) as no_engineer_override,
      sum(coalesce(erp.overdue_pm_count, 0))::int as overdue_pm,
      sum(coalesce(erp.calibration_overdue_count, 0))::int as overdue_cal,
      sum(coalesce(erp.critical_spares_missing, 0))::int as missing_spares,
      sum(case when coalesce(erp.single_point_skill_gap, false) then 1 else 0 end)::int as skill_gaps
    from public.equipment_assets ea
    join public.equipment_risk_profiles erp on erp.equipment_id = ea.id
    where ea.site_id = v_site_id
      and ea.area is not null
    group by ea.area
  loop
    select ea.name, erp.risk_score
    into top_name, top_score
    from public.equipment_assets ea
    join public.equipment_risk_profiles erp on erp.equipment_id = ea.id
    where ea.site_id = v_site_id
      and ea.area = r.area
    order by erp.risk_score desc, ea.name
    limit 1;

    -- Severity contributes 85%; prevalence contributes a bounded 15%.
    -- Using a ratio rather than a raw count keeps the score population-neutral.
    operational_score := least(96, greatest(5, round(
      r.max_operational_score * 0.55
      + r.avg_operational_score * 0.30
      + (
          coalesce(r.operational_at_risk_assets, 0)::numeric
          / nullif(r.asset_count, 0)
        ) * 15
    , 1)));

    labour_score := round(
      least(100, greatest(0,
        coalesce(r.max_labour_score, 0) * 0.60
        + coalesce(r.weighted_labour_avg, 0) * 0.40
      )),
      1
    );

    score := round(operational_score * 0.85 + labour_score * 0.15)::int;

    if r.no_engineer_override then
      score := greatest(score, 85);
    end if;

    score := least(100, greatest(5, score));

    lvl := case
      when score >= 85 then 'Critical'
      when score >= 65 then 'High'
      when score >= 40 then 'Medium'
      when score >= 20 then 'Low'
      else 'Minimal'
    end;

    insert into public.area_risk_profiles(
      area, risk_score, risk_level, asset_count, critical_asset_count, high_asset_count,
      highest_asset_name, highest_asset_score, overdue_pm_count,
      calibration_overdue_count, critical_spares_missing,
      single_point_skill_gap_count, risk_summary, priority_action,
      operational_risk_score, labour_risk_score, scheduled_engineer_count,
      no_engineer_override
    )
    values(
      r.area, score, lvl, r.asset_count, r.critical_assets, r.high_assets,
      top_name, top_score, r.overdue_pm, r.overdue_cal, r.missing_spares, r.skill_gaps,
      case
        when r.no_engineer_override then
          'Area risk includes a critical current-shift labour override because no maintenance engineers are scheduled.'
        else
          'Area risk combines operational equipment exposure with current-shift labour and skill coverage.'
      end,
      case
        when r.no_engineer_override then
          'Arrange immediate engineering or contractor cover for the current shift.'
        when labour_score >= 65 then
          'Restore qualified labour coverage for the highest-risk equipment in this area.'
        else
          'Focus on the highest-risk asset and clear the largest leading risk driver.'
      end,
      operational_score, labour_score, r.scheduled_engineers, r.no_engineer_override
    )
    on conflict(area) do update set
      risk_score = excluded.risk_score,
      risk_level = excluded.risk_level,
      asset_count = excluded.asset_count,
      critical_asset_count = excluded.critical_asset_count,
      high_asset_count = excluded.high_asset_count,
      highest_asset_name = excluded.highest_asset_name,
      highest_asset_score = excluded.highest_asset_score,
      overdue_pm_count = excluded.overdue_pm_count,
      calibration_overdue_count = excluded.calibration_overdue_count,
      critical_spares_missing = excluded.critical_spares_missing,
      single_point_skill_gap_count = excluded.single_point_skill_gap_count,
      risk_summary = excluded.risk_summary,
      priority_action = excluded.priority_action,
      operational_risk_score = excluded.operational_risk_score,
      labour_risk_score = excluded.labour_risk_score,
      scheduled_engineer_count = excluded.scheduled_engineer_count,
      no_engineer_override = excluded.no_engineer_override,
      updated_at = now();

    n := n + 1;
  end loop;

  delete from public.area_risk_profiles arp
  where arp.area not in (
    select distinct ea.area
    from public.equipment_assets ea
    where ea.site_id = v_site_id
      and ea.area is not null
  );

  return n;
end;
$function$;

create or replace function public.vorta_recalculate_site_risk_profile()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    (select srp.site_id from public.site_risk_profile srp where srp.id = 1),
    (select s.id from public.sites s where s.name = 'Apex Wrexham Sterile Fill-Finish' limit 1)
  )
  into v_site_id;

  select arp.area, arp.risk_score, arp.risk_level
  into h_area, h_score, h_level
  from public.area_risk_profiles arp
  where arp.area in (
    select distinct ea.area
    from public.equipment_assets ea
    where ea.site_id = v_site_id and ea.area is not null
  )
  order by arp.risk_score desc, arp.area
  limit 1;

  select
    count(*)::int,
    count(*) filter (where erp.risk_level in ('Critical', 'High'))::int,
    count(*) filter (where erp.operational_risk_score >= 65)::int,
    count(*) filter (where erp.risk_level = 'Critical')::int,
    count(*) filter (where erp.risk_level = 'High')::int,
    coalesce(sum(erp.overdue_pm_count), 0)::int,
    coalesce(sum(erp.calibration_overdue_count), 0)::int,
    coalesce(sum(erp.critical_spares_missing), 0)::int
  into
    total_assets,
    at_risk,
    operational_at_risk,
    critical_assets,
    high_assets,
    overdue_pms,
    overdue_cals,
    missing_spares
  from public.equipment_risk_profiles erp
  join public.equipment_assets ea on ea.id = erp.equipment_id
  where ea.site_id = v_site_id;

  -- Site severity contributes 85%; site-wide prevalence contributes 15%.
  -- The prevalence ratio is invariant when an identical asset population is
  -- duplicated, unlike the previous fixed three-points-per-asset term.
  operational_score := least(
    96.0::numeric,
    greatest(
      5.0::numeric,
      round((
        coalesce((
          select max(arp.operational_risk_score)
          from public.area_risk_profiles arp
          where arp.area in (
            select distinct ea.area
            from public.equipment_assets ea
            where ea.site_id = v_site_id and ea.area is not null
          )
        ), 0) * 0.60
        + coalesce((
          select avg(arp.operational_risk_score)
          from public.area_risk_profiles arp
          where arp.area in (
            select distinct ea.area
            from public.equipment_assets ea
            where ea.site_id = v_site_id and ea.area is not null
          )
        ), 0) * 0.25
        + (
            coalesce(operational_at_risk, 0)::numeric
            / nullif(total_assets, 0)
          ) * 15
      )::numeric, 1)
    )
  );

  select *
  into lr
  from public.vorta_get_site_labour_risk_internal(v_site_id);

  labour_score := lr.labour_risk_score;
  cover_gaps := lr.equipment_with_missing_cover;

  score := round(operational_score * 0.85 + labour_score * 0.15, 1);

  if lr.no_engineer_override then
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
    id, site_id, risk_score, risk_level, highest_area, highest_area_score,
    highest_area_level, total_assets, at_risk_assets, critical_assets,
    high_assets, overdue_pm_count, calibration_backlog_count, cover_gap_count,
    critical_spares_missing, priority_action, risk_summary,
    operational_risk_score, labour_risk_score, scheduled_engineer_count,
    labour_shift_date, labour_shift_type, no_engineer_override
  )
  values(
    1, v_site_id, score, lvl, h_area, h_score, h_level, total_assets, at_risk,
    critical_assets, high_assets, overdue_pms, overdue_cals, cover_gaps,
    missing_spares,
    case
      when lr.no_engineer_override then
        'Arrange immediate engineering or contractor cover: no maintenance engineer is scheduled for the current shift.'
      when labour_score >= 65 then
        'Restore qualified current-shift cover for exposed high-risk equipment.'
      else
        'Focus on the highest-risk area and clear the largest leading risk backlog.'
    end,
    case
      when lr.no_engineer_override then
        'Site risk is subject to a critical labour override because the current shift has zero scheduled maintenance engineers.'
      else
        'Site risk combines operational asset exposure at 85% with current-shift labour and skill coverage at 15%.'
    end,
    operational_score, labour_score, lr.scheduled_engineer_count,
    lr.shift_date, lr.shift_type, lr.no_engineer_override
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
$function$;

comment on function public.vorta_recalculate_area_risk_profiles() is
  'Recalculates area risk using population-neutral severity and prevalence ratios.';

comment on function public.vorta_recalculate_site_risk_profile() is
  'Recalculates site risk using population-neutral severity and prevalence ratios.';

-- Refresh the stored aggregate profiles immediately after the model changes.
select public.vorta_recalculate_area_risk_profiles();
select public.vorta_recalculate_site_risk_profile();
