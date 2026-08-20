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

  select max(cache.refreshed_at)
  into v_risk_calculated_at
  from private.vorta_dashboard_scope_cache cache
  where cache.site_id = p_site_id;

  if v_risk_calculated_at is null then
    select srp.updated_at
    into v_risk_calculated_at
    from public.site_risk_profile srp
    where srp.site_id = p_site_id
    order by srp.updated_at desc nulls last
    limit 1;
  end if;

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
    coalesce(
      (
        select jsonb_build_object(
          'riskScore', coalesce(cache.risk_score, 0),
          'riskLevel', coalesce(cache.risk_level, 'Minimal'),
          'highestArea', cache.highest_child_name,
          'highestAreaScore', cache.highest_child_score,
          'highestAreaLevel', cache.highest_child_level,
          'totalAssets', coalesce(cache.asset_count, 0),
          'atRiskAssets', coalesce(cache.at_risk_asset_count, 0),
          'criticalAssets', coalesce(cache.critical_asset_count, 0),
          'highAssets', coalesce(cache.high_asset_count, 0),
          'overduePmCount', coalesce(cache.overdue_pm_count, 0),
          'calibrationBacklogCount', coalesce(cache.calibration_backlog_count, 0),
          'coverGapCount', coalesce(cache.cover_gap_count, 0),
          'criticalSparesMissing', coalesce(cache.critical_spares_missing, 0),
          'priorityAction', cache.priority_action,
          'riskSummary', cache.risk_summary,
          'siteId', cache.site_id,
          'operationalRiskScore', coalesce(cache.operational_risk_score, 0),
          'labourRiskScore', coalesce(cache.labour_risk_score, 0),
          'scheduledEngineerCount', coalesce(cache.scheduled_engineer_count, 0),
          'labourShiftDate', cache.labour_shift_date,
          'labourShiftType', cache.labour_shift_type,
          'noEngineerOverride', coalesce(cache.no_engineer_override, false)
        )
        from private.vorta_dashboard_scope_cache cache
        where cache.site_id = p_site_id
          and cache.scope_key = 'site'
        limit 1
      ),
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
      )
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
