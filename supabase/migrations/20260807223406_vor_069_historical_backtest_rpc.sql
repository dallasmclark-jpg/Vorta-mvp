create or replace function public.vorta_get_historical_backtest(
  p_site_id uuid,
  p_equipment_id uuid default null,
  p_dataset_version text default 'vor069-historical-backtest-v1',
  p_validation_days integer default 45
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_result jsonb;
begin
  if p_site_id is null or not public.vorta_has_site_access(p_site_id, false) then
    raise exception 'Not authorised for requested site' using errcode = '42501';
  end if;

  if p_validation_days < 1 or p_validation_days > 365 then
    raise exception 'Validation window must be between 1 and 365 days' using errcode = '22023';
  end if;

  if p_equipment_id is not null and not exists (
    select 1
    from public.equipment_assets a
    where a.id = p_equipment_id
      and a.site_id = p_site_id
  ) then
    raise exception 'Equipment is not in the authorised site' using errcode = '22023';
  end if;

  with scenarios as (
    select
      s.*,
      a.equipment_code,
      a.name as equipment_name,
      a.area,
      coalesce(s.failure_at, s.intervention_at, s.warning_start_at + make_interval(days => least(p_validation_days, 21))) as outcome_at
    from private.vorta_demo_backtest_scenarios s
    join public.equipment_assets a
      on a.id = s.equipment_id
     and a.site_id = s.site_id
    where s.site_id = p_site_id
      and s.dataset_version = p_dataset_version
      and s.active
      and (p_equipment_id is null or s.equipment_id = p_equipment_id)
  ), evidence as (
    select
      s.*,
      wr.captured_at as warning_captured_at,
      wr.risk_score as warning_risk_score,
      wr.risk_level as warning_risk_level,
      wr.primary_driver as warning_primary_driver,
      wr.pm_backlog_pct as warning_pm_backlog_pct,
      wr.asset_criticality_pct as warning_asset_criticality_pct,
      wr.calibration_pct as warning_calibration_pct,
      wr.skills_pct as warning_skills_pct,
      wr.spares_pct as warning_spares_pct,
      wr.overdue_pm_count as warning_overdue_pm_count,
      wr.calibration_overdue_count as warning_calibration_overdue_count,
      wr.critical_spares_missing as warning_critical_spares_missing,
      pr.captured_at as pre_outcome_captured_at,
      pr.risk_score as pre_outcome_risk_score,
      pr.risk_level as pre_outcome_risk_level,
      pr.primary_driver as pre_outcome_primary_driver,
      pr.pm_backlog_pct as pre_outcome_pm_backlog_pct,
      pr.asset_criticality_pct as pre_outcome_asset_criticality_pct,
      pr.calibration_pct as pre_outcome_calibration_pct,
      pr.skills_pct as pre_outcome_skills_pct,
      pr.spares_pct as pre_outcome_spares_pct,
      postr.captured_at as post_intervention_captured_at,
      postr.risk_score as post_intervention_risk_score,
      postr.risk_level as post_intervention_risk_level,
      sh.snapshot_at as stock_snapshot_at,
      sh.material_description,
      sh.available_quantity as stock_available_quantity,
      sh.minimum_quantity as stock_minimum_quantity,
      sh.target_quantity as stock_target_quantity,
      sh.stock_status as stock_status,
      sh.source_record_key as stock_source_record_key,
      res.id as reservation_id,
      res.reservation_number,
      res.reservation_item,
      res.required_quantity,
      res.reserved_quantity,
      res.withdrawn_quantity,
      res.reservation_status,
      res.source_record_key as reservation_source_record_key,
      gm.id as movement_id,
      gm.material_document_number,
      gm.document_item as movement_document_item,
      gm.movement_type,
      gm.entry_timestamp as movement_at,
      gm.quantity as movement_quantity,
      gm.source_record_key as movement_source_record_key,
      w.wo_number,
      w.description as work_order_description,
      w.work_type,
      w.priority as work_order_priority,
      w.outcome as work_order_outcome,
      w.actual_start_at,
      w.actual_finish_at,
      w.downtime_minutes,
      w.source_record_key as work_order_source_record_key,
      coalesce(fp.breakdowns_in_window, 0) as breakdowns_in_validation_window
    from scenarios s
    left join lateral (
      select r.*
      from public.equipment_risk_event_history r
      where r.site_id = s.site_id
        and r.equipment_id = s.equipment_id
        and r.dataset_version = s.dataset_version
        and r.scenario_key = s.scenario_key
        and r.source_event = 'scenario_warning_start'
      order by r.captured_at desc
      limit 1
    ) wr on true
    left join lateral (
      select r.*
      from public.equipment_risk_event_history r
      where r.site_id = s.site_id
        and r.equipment_id = s.equipment_id
        and r.dataset_version = s.dataset_version
        and r.scenario_key = s.scenario_key
        and r.source_event = 'scenario_pre_outcome'
      order by r.captured_at desc
      limit 1
    ) pr on true
    left join lateral (
      select r.*
      from public.equipment_risk_event_history r
      where r.site_id = s.site_id
        and r.equipment_id = s.equipment_id
        and r.dataset_version = s.dataset_version
        and r.scenario_key = s.scenario_key
        and r.source_event = 'scenario_post_intervention'
      order by r.captured_at asc
      limit 1
    ) postr on true
    left join lateral (
      select h.*
      from public.site_material_stock_history h
      where h.site_id = s.site_id
        and h.equipment_id = s.equipment_id
        and h.dataset_version = s.dataset_version
        and h.scenario_key = s.scenario_key
        and h.material_number = s.material_number
        and h.snapshot_at <= s.outcome_at
      order by h.snapshot_at desc
      limit 1
    ) sh on true
    left join public.work_orders w
      on w.id = s.work_order_id
     and w.site_id = s.site_id
    left join lateral (
      select r.*
      from public.work_order_material_reservations r
      where r.site_id = s.site_id
        and r.work_order_id = s.work_order_id
        and (s.material_number is null or r.material_number = s.material_number)
      order by r.created_at asc
      limit 1
    ) res on true
    left join lateral (
      select g.*
      from public.work_order_goods_movements g
      where g.site_id = s.site_id
        and g.work_order_id = s.work_order_id
        and (s.material_number is null or g.material_number = s.material_number)
        and g.movement_type = '261'
        and coalesce(g.reversal, false) = false
      order by g.entry_timestamp asc nulls last, g.created_at asc
      limit 1
    ) gm on true
    left join lateral (
      select count(*)::integer as breakdowns_in_window
      from public.work_orders wb
      where wb.site_id = s.site_id
        and wb.equipment_id = s.equipment_id
        and upper(coalesce(wb.work_type, '')) like '%BREAKDOWN%'
        and coalesce(wb.actual_start_at, wb.source_created_at, wb.created_at) > s.warning_start_at
        and coalesce(wb.actual_start_at, wb.source_created_at, wb.created_at) <= s.warning_start_at + make_interval(days => p_validation_days)
        and (s.work_order_id is null or wb.id <> s.work_order_id)
    ) fp on true
  ), classified as (
    select
      e.*,
      (e.failure_at is not null and e.warning_risk_score >= 60 and e.warning_captured_at < e.failure_at) as elevated_risk_preceded_breakdown,
      (e.failure_at is not null and e.stockout_start_at is not null and e.stockout_start_at < e.failure_at and coalesce(e.stock_available_quantity, 0) <= 0) as stockout_preceded_breakdown,
      (e.failure_at is not null and e.pre_outcome_primary_driver is not null) as intervention_plausibly_relevant,
      false as stockout_constrained_preventive_intervention,
      (
        e.failure_at is not null
        and coalesce(e.stock_available_quantity, 0) <= 0
        and e.reservation_id is not null
        and e.movement_id is not null
        and e.movement_at >= e.failure_at
        and e.actual_finish_at is not null
        and e.actual_finish_at >= e.movement_at
        and coalesce(e.downtime_minutes, 0) > 0
      ) as stockout_materially_extended_recovery,
      (
        e.intervention_at is not null
        and e.failure_at is null
        and e.pre_outcome_risk_score is not null
        and e.post_intervention_risk_score is not null
        and e.post_intervention_risk_score < e.pre_outcome_risk_score
        and e.breakdowns_in_validation_window = 0
      ) as successful_intervention,
      (
        e.intervention_at is null
        and e.failure_at is null
        and e.warning_risk_score >= 60
        and e.breakdowns_in_validation_window = 0
      ) as false_positive,
      false as preventability_supported,
      case lower(coalesce(e.pre_outcome_primary_driver, e.warning_primary_driver, ''))
        when 'pm backlog' then 'Prioritise the overdue PM work contributing to the historical risk score.'
        when 'spares' then 'Restore the critical spare position and confirm the required material is available before planned intervention.'
        when 'calibration' then 'Complete the overdue or at-risk calibration contributing to the historical risk score.'
        when 'labour coverage' then 'Restore competent labour coverage for the equipment before the risk window progresses.'
        when 'skills' then 'Restore competent labour coverage for the equipment before the risk window progresses.'
        when 'asset criticality' then 'Escalate the high-criticality asset for prioritised maintenance review and control.'
        else 'Review the historical risk drivers and prioritise the highest verified contributor.'
      end as recommended_action,
      case
        when e.failure_at is not null then round(extract(epoch from (e.failure_at - e.warning_start_at)) / 3600.0, 1)
        when e.intervention_at is not null then round(extract(epoch from (e.intervention_at - e.warning_start_at)) / 3600.0, 1)
        else round(p_validation_days * 24.0, 1)
      end as warning_lead_hours,
      case
        when e.failure_at is not null and e.movement_at is not null and e.movement_at >= e.failure_at
          then greatest(0, round(extract(epoch from (e.movement_at - e.failure_at)) / 60.0))::integer
        else null
      end as verified_material_wait_minutes
    from evidence e
  ), case_rows as (
    select
      c.*,
      coalesce((
        select jsonb_agg(x.item order by x.sort_order)
        from (
          select 10 as sort_order, jsonb_build_object('code','elevated_risk_preceded_breakdown','label','Elevated risk preceded breakdown','evidenceLevel','verified_sequence','confidence',96) as item where c.elevated_risk_preceded_breakdown
          union all
          select 20, jsonb_build_object('code','stockout_preceded_breakdown','label','Critical stock-out preceded breakdown','evidenceLevel','verified_sequence','confidence',98) where c.stockout_preceded_breakdown
          union all
          select 30, jsonb_build_object('code','intervention_plausibly_relevant','label','Risk-driver intervention plausibly relevant','evidenceLevel','plausible_relevance','confidence',74) where c.intervention_plausibly_relevant
          union all
          select 40, jsonb_build_object('code','stockout_constrained_preventive_intervention','label','Stock-out constrained preventive intervention','evidenceLevel','supported_impact','confidence',90) where c.stockout_constrained_preventive_intervention
          union all
          select 50, jsonb_build_object('code','stockout_materially_extended_recovery','label','Stock-out materially extended recovery','evidenceLevel','supported_impact','confidence',97) where c.stockout_materially_extended_recovery
          union all
          select 60, jsonb_build_object('code','successful_intervention','label','Risk reduced after completed intervention with no breakdown in validation window','evidenceLevel','verified_sequence','confidence',94) where c.successful_intervention
          union all
          select 70, jsonb_build_object('code','false_positive','label','Elevated risk without subsequent breakdown in validation window','evidenceLevel','validation_counterexample','confidence',95) where c.false_positive
          union all
          select 80, jsonb_build_object('code','preventability_supported','label','Preventability supported by evidence','evidenceLevel','supported_counterfactual','confidence',90) where c.preventability_supported
        ) x
      ), '[]'::jsonb) as classifications
    from classified c
  ), cases_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'scenarioKey', c.scenario_key,
        'scenarioType', c.scenario_type,
        'equipment', jsonb_build_object(
          'id', c.equipment_id,
          'code', c.equipment_code,
          'name', c.equipment_name,
          'area', c.area
        ),
        'timeframe', jsonb_build_object(
          'warningStartAt', c.warning_start_at,
          'interventionAt', c.intervention_at,
          'failureAt', c.failure_at,
          'validationWindowEnd', c.warning_start_at + make_interval(days => p_validation_days),
          'warningLeadHours', c.warning_lead_hours,
          'warningLeadDays', round(c.warning_lead_hours / 24.0, 1)
        ),
        'risk', jsonb_build_object(
          'warningCapturedAt', c.warning_captured_at,
          'warningScore', c.warning_risk_score,
          'warningLevel', c.warning_risk_level,
          'preOutcomeCapturedAt', c.pre_outcome_captured_at,
          'preOutcomeScore', c.pre_outcome_risk_score,
          'preOutcomeLevel', c.pre_outcome_risk_level,
          'postInterventionCapturedAt', c.post_intervention_captured_at,
          'postInterventionScore', c.post_intervention_risk_score,
          'postInterventionLevel', c.post_intervention_risk_level,
          'primaryDriver', coalesce(c.pre_outcome_primary_driver, c.warning_primary_driver),
          'drivers', jsonb_build_object(
            'pmBacklogPct', coalesce(c.pre_outcome_pm_backlog_pct, c.warning_pm_backlog_pct),
            'assetCriticalityPct', coalesce(c.pre_outcome_asset_criticality_pct, c.warning_asset_criticality_pct),
            'calibrationPct', coalesce(c.pre_outcome_calibration_pct, c.warning_calibration_pct),
            'skillsPct', coalesce(c.pre_outcome_skills_pct, c.warning_skills_pct),
            'sparesPct', coalesce(c.pre_outcome_spares_pct, c.warning_spares_pct)
          ),
          'warningCounts', jsonb_build_object(
            'overduePm', c.warning_overdue_pm_count,
            'overdueCalibration', c.warning_calibration_overdue_count,
            'criticalSparesMissing', c.warning_critical_spares_missing
          ),
          'recommendedActionAtTime', c.recommended_action,
          'observedPostInterventionReduction', case when c.post_intervention_risk_score is not null and c.pre_outcome_risk_score is not null then c.pre_outcome_risk_score - c.post_intervention_risk_score else null end,
          'modelVersion', c.risk_model_version
        ),
        'stock', jsonb_build_object(
          'materialNumber', c.material_number,
          'description', c.material_description,
          'snapshotAt', c.stock_snapshot_at,
          'availableQuantity', c.stock_available_quantity,
          'minimumQuantity', c.stock_minimum_quantity,
          'targetQuantity', c.stock_target_quantity,
          'status', c.stock_status,
          'stockoutStartAt', c.stockout_start_at,
          'replenishedAt', c.stock_replenished_at,
          'reservationNumber', c.reservation_number,
          'reservationItem', c.reservation_item,
          'requiredQuantity', c.required_quantity,
          'reservedQuantity', c.reserved_quantity,
          'withdrawnQuantity', c.withdrawn_quantity,
          'reservationStatus', c.reservation_status,
          'materialDocumentNumber', c.material_document_number,
          'movementDocumentItem', c.movement_document_item,
          'movementType', c.movement_type,
          'movementAt', c.movement_at,
          'movementQuantity', c.movement_quantity,
          'verifiedMaterialWaitMinutes', c.verified_material_wait_minutes
        ),
        'workOrder', case when c.work_order_id is null then null else jsonb_build_object(
          'id', c.work_order_id,
          'number', c.wo_number,
          'description', c.work_order_description,
          'type', c.work_type,
          'priority', c.work_order_priority,
          'outcome', c.work_order_outcome,
          'actualStartAt', c.actual_start_at,
          'actualFinishAt', c.actual_finish_at,
          'downtimeMinutes', c.downtime_minutes
        ) end,
        'validation', jsonb_build_object(
          'windowDays', p_validation_days,
          'subsequentBreakdowns', c.breakdowns_in_validation_window,
          'noBreakdownInWindow', c.breakdowns_in_validation_window = 0
        ),
        'classifications', c.classifications,
        'confidence', case
          when c.stockout_materially_extended_recovery then 97
          when c.successful_intervention then 94
          when c.false_positive then 95
          when c.elevated_risk_preceded_breakdown then 92
          else 70
        end,
        'evidenceRecords', jsonb_strip_nulls(jsonb_build_object(
          'warningRisk', case when c.warning_captured_at is not null then jsonb_build_object('table','equipment_risk_event_history','scenarioKey',c.scenario_key,'timestamp',c.warning_captured_at,'sourceEvent','scenario_warning_start') end,
          'preOutcomeRisk', case when c.pre_outcome_captured_at is not null then jsonb_build_object('table','equipment_risk_event_history','scenarioKey',c.scenario_key,'timestamp',c.pre_outcome_captured_at,'sourceEvent','scenario_pre_outcome') end,
          'postInterventionRisk', case when c.post_intervention_captured_at is not null then jsonb_build_object('table','equipment_risk_event_history','scenarioKey',c.scenario_key,'timestamp',c.post_intervention_captured_at,'sourceEvent','scenario_post_intervention') end,
          'stock', case when c.stock_snapshot_at is not null then jsonb_build_object('table','site_material_stock_history','sourceRecordKey',c.stock_source_record_key,'timestamp',c.stock_snapshot_at) end,
          'workOrder', case when c.work_order_id is not null then jsonb_build_object('table','work_orders','id',c.work_order_id,'sourceRecordKey',c.work_order_source_record_key,'number',c.wo_number) end,
          'reservation', case when c.reservation_id is not null then jsonb_build_object('table','work_order_material_reservations','id',c.reservation_id,'sourceRecordKey',c.reservation_source_record_key,'number',c.reservation_number) end,
          'goodsMovement', case when c.movement_id is not null then jsonb_build_object('table','work_order_goods_movements','id',c.movement_id,'sourceRecordKey',c.movement_source_record_key,'materialDocumentNumber',c.material_document_number,'timestamp',c.movement_at) end
        )),
        'provenance', jsonb_build_object(
          'evidenceProvenance', c.evidence_provenance,
          'datasetVersion', c.dataset_version,
          'riskModelVersion', c.risk_model_version,
          'syntheticDemo', c.evidence_provenance = 'synthetic_demo'
        ),
        'limitations', jsonb_build_array(
          'Temporal sequence does not by itself prove causation.',
          'Preventability is not asserted unless a separate preventability-supported classification is present.',
          case when c.evidence_provenance = 'synthetic_demo' then 'This is explicitly synthetic demonstration history, not imported SAP production evidence.' else 'Evidence provenance must be reviewed before operational use.' end
        )
      ) order by coalesce(c.failure_at, c.intervention_at, c.warning_start_at) desc
    ), '[]'::jsonb) as cases
    from case_rows c
  ), summary_json as (
    select jsonb_build_object(
      'scenarioCount', count(*)::integer,
      'breakdownCount', count(*) filter (where c.failure_at is not null)::integer,
      'elevatedRiskPrecededBreakdownCount', count(*) filter (where c.elevated_risk_preceded_breakdown)::integer,
      'interventionPlausiblyRelevantCount', count(*) filter (where c.intervention_plausibly_relevant)::integer,
      'preFailureStockoutCount', count(*) filter (where c.stockout_preceded_breakdown)::integer,
      'stockoutExtendedRecoveryCount', count(*) filter (where c.stockout_materially_extended_recovery)::integer,
      'stockoutConstrainedPreventiveInterventionCount', count(*) filter (where c.stockout_constrained_preventive_intervention)::integer,
      'successfulInterventionCount', count(*) filter (where c.successful_intervention)::integer,
      'falsePositiveCount', count(*) filter (where c.false_positive)::integer,
      'preventabilitySupportedCount', count(*) filter (where c.preventability_supported)::integer,
      'evidenceSupportedPreventabilityRate', case when count(*) filter (where c.failure_at is not null) > 0 then round(100.0 * (count(*) filter (where c.preventability_supported)) / (count(*) filter (where c.failure_at is not null)), 1) else null end,
      'unmitigatedWarningBreakdownRate', case when count(*) filter (where c.failure_at is not null or c.false_positive) > 0 then round(100.0 * (count(*) filter (where c.failure_at is not null)) / (count(*) filter (where c.failure_at is not null or c.false_positive)), 1) else null end,
      'medianWarningDays', round((percentile_cont(0.5) within group (order by c.warning_lead_hours) / 24.0)::numeric, 1),
      'medianVerifiedMaterialWaitMinutes', round(percentile_cont(0.5) within group (order by c.verified_material_wait_minutes) filter (where c.verified_material_wait_minutes is not null))::integer,
      'riskModelVersions', coalesce((select jsonb_agg(distinct x.risk_model_version) from case_rows x where x.risk_model_version is not null), '[]'::jsonb),
      'evidenceProvenance', coalesce((select jsonb_agg(distinct x.evidence_provenance) from case_rows x where x.evidence_provenance is not null), '[]'::jsonb),
      'preventabilityStatus', 'not_established_from_sequence_alone'
    ) as summary
    from case_rows c
  )
  select jsonb_build_object(
    'status', case when jsonb_array_length(cj.cases) > 0 then 'ready' else 'empty' end,
    'siteId', p_site_id,
    'equipmentId', p_equipment_id,
    'datasetVersion', p_dataset_version,
    'validationWindowDays', p_validation_days,
    'generatedAt', now(),
    'summary', sj.summary,
    'cases', cj.cases,
    'methodology', jsonb_build_object(
      'riskThreshold', 60,
      'riskSequence', 'Exact timestamped warning and pre-outcome risk events are used where available.',
      'stockSequence', 'Last authorised stock snapshot at or before the outcome is used.',
      'recoveryImpact', 'Recovery extension requires zero stock plus linked reservation, non-reversed 261 goods movement after failure, and repair completion at or after material issue.',
      'falsePositiveRule', format('Elevated-risk scenario with no intervention and no subsequent breakdown within %s days.', p_validation_days),
      'causationBoundary', 'Temporal sequence alone is never treated as proof of breakdown causation or preventability.'
    )
  ) into v_result
  from cases_json cj
  cross join summary_json sj;

  return v_result;
end;
$$;

comment on function public.vorta_get_historical_backtest(uuid, uuid, text, integer) is
  'VOR-069 authorised historical equipment/spares backtest. Returns evidence-backed site metrics and case timelines while preserving explicit causation and synthetic-demo provenance boundaries.';

revoke all on function public.vorta_get_historical_backtest(uuid, uuid, text, integer) from public;
revoke all on function public.vorta_get_historical_backtest(uuid, uuid, text, integer) from anon;
grant execute on function public.vorta_get_historical_backtest(uuid, uuid, text, integer) to authenticated;
grant execute on function public.vorta_get_historical_backtest(uuid, uuid, text, integer) to service_role;
