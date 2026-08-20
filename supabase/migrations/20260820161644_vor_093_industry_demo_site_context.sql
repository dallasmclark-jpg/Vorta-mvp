create or replace function private.vorta_current_authorized_site_id()
returns uuid
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'private'
as $$
declare
  v_role text := coalesce(auth.role(), '');
  v_user_id uuid := auth.uid();
  v_site_id uuid;
begin
  if v_role = 'authenticated' and v_user_id is not null then
    select access_row.site_id
    into v_site_id
    from public.user_site_access access_row
    join public.sites site
      on site.id = access_row.site_id
     and site.organisation_id = access_row.organisation_id
    join public.profiles profile
      on profile.id = access_row.user_id
     and profile.organisation_id = access_row.organisation_id
    where access_row.user_id = v_user_id
      and access_row.active
    order by access_row.is_default desc, access_row.created_at asc, access_row.site_id
    limit 1;

    if v_site_id is not null then
      return v_site_id;
    end if;
  end if;

  return public.vorta_current_demo_site_id();
end;
$$;

revoke all on function private.vorta_current_authorized_site_id() from public, anon, authenticated;

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
set search_path = 'pg_catalog', 'public', 'private'
as $$
declare
  v_site_id uuid := private.vorta_current_authorized_site_id();
begin
  if v_site_id is null then
    return;
  end if;

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

  if v_site_id = public.vorta_current_demo_site_id() then
    return query
    select *
    from private.vorta_calculate_risk_dashboard_scopes();
  end if;
end;
$$;

create or replace function private.vorta_get_risk_dashboard_scopes()
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
set search_path = 'pg_catalog', 'public', 'private'
as $$
declare
  v_site_id uuid := private.vorta_current_authorized_site_id();
begin
  if not public.vorta_has_site_access(v_site_id, true) then
    return;
  end if;

  return query
  select * from public.vorta_get_risk_dashboard_scopes_internal();
end;
$$;

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
set search_path = 'pg_catalog', 'public', 'private'
as $$
declare
  v_site_id uuid := private.vorta_current_authorized_site_id();
begin
  if v_site_id is null then
    return;
  end if;

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

  if v_site_id = public.vorta_current_demo_site_id() then
    return query
    select calculated.*
    from private.vorta_calculate_risk_dashboard_scope_plans() calculated;
  end if;
end;
$$;

create or replace function private.vorta_get_risk_dashboard_scope_plans()
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
set search_path = 'pg_catalog', 'public', 'private'
as $$
declare
  v_site_id uuid := private.vorta_current_authorized_site_id();
begin
  if not public.vorta_has_site_access(v_site_id, true) then
    return;
  end if;

  return query
  select * from public.vorta_get_risk_dashboard_scope_plans_internal();
end;
$$;

create or replace function private.vorta_get_operational_dashboard_snapshot_for_site(p_site_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'private'
as $$
declare
  v_risk_calculated_at timestamptz;
  v_maintenance_data_at timestamptz;
  v_workforce_data_at timestamptz;
begin
  if p_site_id is null or not public.vorta_has_site_access(p_site_id, false) then
    return null;
  end if;

  select srp.updated_at
  into v_risk_calculated_at
  from public.site_risk_profile srp
  where srp.site_id = p_site_id
  order by srp.updated_at desc nulls last
  limit 1;

  select max(source_time)
  into v_maintenance_data_at
  from (
    select max(greatest(wo.source_updated_at, wo.updated_at, wo.source_created_at, wo.created_at)) as source_time
    from public.work_orders wo
    where wo.site_id = p_site_id

    union all

    select max(greatest(mn.source_updated_at, mn.updated_at, mn.source_created_at, mn.created_at))
    from public.maintenance_notifications mn
    where mn.site_id = p_site_id

    union all

    select max(greatest(mpi.source_updated_at, mpi.updated_at, mpi.source_created_at, mpi.created_at))
    from public.maintenance_plan_items mpi
    where mpi.site_id = p_site_id

    union all

    select max(greatest(ec.source_updated_at, ec.updated_at, ec.created_at))
    from public.equipment_components ec
    where ec.site_id = p_site_id
  ) maintenance_sources;

  select max(source_time)
  into v_workforce_data_at
  from (
    select max(greatest(es.updated_at, es.created_at)) as source_time
    from public.engineer_skills es
    join public.engineers e
      on e.id = es.engineer_id
     and e.site_id = p_site_id

    union all

    select max(greatest(ers.updated_at, ers.created_at))
    from public.equipment_required_skills ers
    join public.equipment_assets ea
      on ea.id = ers.equipment_id
     and ea.site_id = p_site_id

    union all

    select max(greatest(tb.updated_at, tb.created_at))
    from public.training_bookings tb
    join public.engineers e
      on e.id = tb.engineer_id
     and e.site_id = p_site_id
  ) workforce_sources;

  return jsonb_build_object(
    'areaProfiles',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'area', cache.area,
          'riskScore', coalesce(cache.risk_score, 0),
          'riskLevel', coalesce(cache.risk_level, 'Minimal'),
          'assetCount', coalesce(cache.asset_count, 0),
          'criticalAssetCount', coalesce(cache.critical_asset_count, 0),
          'highAssetCount', coalesce(cache.high_asset_count, 0),
          'highestAssetName', cache.highest_child_name,
          'highestAssetScore', cache.highest_child_score,
          'overduePmCount', coalesce(cache.overdue_pm_count, 0),
          'calibrationOverdueCount', coalesce(cache.calibration_backlog_count, 0),
          'criticalSparesMissing', coalesce(cache.critical_spares_missing, 0),
          'singlePointSkillGapCount', coalesce((
            select count(*)::integer
            from public.equipment_assets ea
            join public.equipment_risk_profiles erp on erp.equipment_id = ea.id
            where ea.site_id = p_site_id
              and ea.area = cache.area
              and erp.single_point_skill_gap
          ), 0),
          'riskSummary', cache.risk_summary,
          'priorityAction', cache.priority_action,
          'operationalRiskScore', coalesce(cache.operational_risk_score, 0),
          'labourRiskScore', coalesce(cache.labour_risk_score, 0),
          'scheduledEngineerCount', coalesce(cache.scheduled_engineer_count, 0),
          'noEngineerOverride', coalesce(cache.no_engineer_override, false)
        )
        order by cache.display_order
      )
      from private.vorta_dashboard_scope_cache cache
      where cache.site_id = p_site_id
        and cache.scope_type = 'area'
    ), '[]'::jsonb),
    'siteRisk',
    (
      select jsonb_build_object(
        'riskScore', coalesce(srp.risk_score, 0),
        'riskLevel', coalesce(srp.risk_level, 'Minimal'),
        'highestArea', srp.highest_area,
        'highestAreaScore', srp.highest_area_score,
        'highestAreaLevel', srp.highest_area_level,
        'totalAssets', coalesce(srp.total_assets, 0),
        'atRiskAssets', coalesce(srp.at_risk_assets, 0),
        'criticalAssets', coalesce(srp.critical_assets, 0),
        'highAssets', coalesce(srp.high_assets, 0),
        'overduePmCount', coalesce(srp.overdue_pm_count, 0),
        'calibrationBacklogCount', coalesce(srp.calibration_backlog_count, 0),
        'coverGapCount', coalesce(srp.cover_gap_count, 0),
        'criticalSparesMissing', coalesce(srp.critical_spares_missing, 0),
        'priorityAction', srp.priority_action,
        'riskSummary', srp.risk_summary,
        'siteId', srp.site_id,
        'operationalRiskScore', coalesce(srp.operational_risk_score, 0),
        'labourRiskScore', coalesce(srp.labour_risk_score, 0),
        'scheduledEngineerCount', coalesce(srp.scheduled_engineer_count, 0),
        'labourShiftDate', srp.labour_shift_date,
        'labourShiftType', srp.labour_shift_type,
        'noEngineerOverride', coalesce(srp.no_engineer_override, false)
      )
      from public.site_risk_profile srp
      where srp.site_id = p_site_id
      order by srp.updated_at desc nulls last
      limit 1
    ),
    'scopes',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'scopeKey', cache.scope_key,
          'scopeType', cache.scope_type,
          'scopeLabel', cache.scope_label,
          'area', cache.area,
          'displayOrder', coalesce(cache.display_order, 0),
          'riskScore', coalesce(cache.risk_score, 0),
          'riskLevel', coalesce(cache.risk_level, 'Minimal'),
          'operationalRiskScore', coalesce(cache.operational_risk_score, 0),
          'labourRiskScore', coalesce(cache.labour_risk_score, 0),
          'highestChildId', cache.highest_child_id,
          'highestChildCode', cache.highest_child_code,
          'highestChildName', cache.highest_child_name,
          'highestChildScore', cache.highest_child_score,
          'highestChildLevel', cache.highest_child_level,
          'assetCount', coalesce(cache.asset_count, 0),
          'atRiskAssetCount', coalesce(cache.at_risk_asset_count, 0),
          'criticalAssetCount', coalesce(cache.critical_asset_count, 0),
          'highAssetCount', coalesce(cache.high_asset_count, 0),
          'overduePmCount', coalesce(cache.overdue_pm_count, 0),
          'calibrationBacklogCount', coalesce(cache.calibration_backlog_count, 0),
          'coverGapCount', coalesce(cache.cover_gap_count, 0),
          'criticalSparesMissing', coalesce(cache.critical_spares_missing, 0),
          'scheduledEngineerCount', coalesce(cache.scheduled_engineer_count, 0),
          'labourShiftDate', cache.labour_shift_date,
          'labourShiftType', cache.labour_shift_type,
          'noEngineerOverride', coalesce(cache.no_engineer_override, false),
          'priorityAction', cache.priority_action,
          'riskSummary', cache.risk_summary,
          'childCards', coalesce(cache.child_cards, '[]'::jsonb),
          'labourCards', coalesce(cache.labour_cards, '[]'::jsonb)
        )
        order by cache.display_order
      )
      from private.vorta_dashboard_scope_cache cache
      where cache.site_id = p_site_id
    ), '[]'::jsonb),
    'freshness', jsonb_build_object(
      'maintenanceDataAt', v_maintenance_data_at,
      'workforceDataAt', v_workforce_data_at,
      'riskCalculatedAt', v_risk_calculated_at
    )
  );
end;
$$;

revoke all on function private.vorta_get_operational_dashboard_snapshot_for_site(uuid) from public, anon, authenticated;

create or replace function private.vorta_get_operational_dashboard_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'private'
as $$
  select private.vorta_get_operational_dashboard_snapshot_for_site(
    private.vorta_current_authorized_site_id()
  );
$$;
