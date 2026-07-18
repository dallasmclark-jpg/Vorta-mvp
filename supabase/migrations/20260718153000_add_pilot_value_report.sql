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
  v_start_date date;
  v_end_date date;
  v_earliest_snapshot date;
  v_history jsonb;
  v_history_summary jsonb;
  v_document_health jsonb;
  v_document_summary jsonb;
  v_top_changes jsonb := '[]'::jsonb;
  v_snapshot_count integer := 0;
  v_baseline_date date;
  v_latest_date date;
  v_observed_days integer := 0;
  v_claim_eligible boolean := false;
  v_report_status text;
  v_site_risk_baseline numeric;
  v_site_risk_latest numeric;
  v_site_risk_reduction numeric;
  v_operational_risk_baseline numeric;
  v_operational_risk_latest numeric;
  v_labour_risk_baseline numeric;
  v_labour_risk_latest numeric;
  v_action_baseline integer := 0;
  v_action_latest integer := 0;
  v_high_critical_baseline integer := 0;
  v_high_critical_latest integer := 0;
  v_backup_baseline integer := 0;
  v_backup_latest integer := 0;
  v_am_baseline integer := 0;
  v_am_latest integer := 0;
  v_skill_baseline integer := 0;
  v_skill_latest integer := 0;
  v_closed_actions integer := 0;
  v_improved_actions integer := 0;
  v_worsened_actions integer := 0;
  v_new_actions integer := 0;
  v_all_completed integer := 0;
  v_all_confirmed integer := 0;
  v_all_material_orders integer := 0;
  v_all_material_posted integer := 0;
  v_period_completed integer := 0;
  v_period_confirmed integer := 0;
  v_period_material_orders integer := 0;
  v_period_material_posted integer := 0;
  v_all_confirmation_pct numeric;
  v_all_material_pct numeric;
  v_period_confirmation_pct numeric;
  v_period_material_pct numeric;
  v_total_equipment integer := 0;
  v_equipment_with_docs integer := 0;
  v_high_risk_equipment integer := 0;
  v_high_risk_with_docs integer := 0;
  v_current_documents integer := 0;
  v_usable_documents integer := 0;
  v_equipment_document_pct numeric;
  v_high_risk_document_pct numeric;
  v_document_usability_pct numeric;
  v_validated_engineer_skills integer := 0;
  v_active_validated_capabilities integer := 0;
  v_primary_smes integer := 0;
  v_backup_smes integer := 0;
  v_validated_am_assignments integer := 0;
  v_am_assignments_in_training integer := 0;
  v_period_engineer_validations integer := 0;
  v_period_engineers_validated integer := 0;
  v_period_capability_validations integer := 0;
  v_period_operator_validations integer := 0;
  v_period_operators_validated integer := 0;
  v_latest_snapshot_id uuid;
  v_expected_action_rows integer := 0;
  v_actual_action_rows integer := 0;
  v_latest_suite_version text;
  v_latest_health_status text;
  v_latest_health_finished_at timestamptz;
  v_latest_passed integer := 0;
  v_latest_failed integer := 0;
  v_latest_warnings integer := 0;
  v_health_run_count integer := 0;
  v_health_pass_count integer := 0;
  v_health_pass_rate numeric;
  v_open_health_incidents integer := 0;
  v_critical_health_incidents integer := 0;
  v_high_health_incidents integer := 0;
  v_maintenance_score numeric := 0;
  v_knowledge_score numeric := 0;
  v_capability_score numeric := 0;
  v_backend_score numeric := 0;
  v_trend_score numeric := 0;
  v_completeness_score numeric := 0;
  v_confidence_score numeric := 0;
  v_confidence_status text;
  v_limitations jsonb;
begin
  if not public.vorta_can_manage_site(p_site_id) then
    return null;
  end if;

  v_end_date := coalesce(p_end_date, current_date);

  select min(snapshot.snapshot_date)
  into v_earliest_snapshot
  from private.vorta_capability_risk_snapshots snapshot
  where snapshot.site_id = p_site_id;

  v_start_date := coalesce(p_start_date, v_earliest_snapshot, v_end_date);

  if v_start_date > v_end_date then
    select v_end_date, v_start_date into v_start_date, v_end_date;
  end if;

  v_history := public.vorta_get_capability_risk_history(
    p_site_id,
    v_start_date,
    v_end_date,
    200
  );
  v_document_health := public.vorta_get_document_ingestion_health(p_site_id);
  v_history_summary := coalesce(v_history->'summary', '{}'::jsonb);
  v_document_summary := coalesce(v_document_health->'summary', '{}'::jsonb);

  v_snapshot_count := coalesce((v_history_summary->>'snapshotCount')::integer, 0);
  v_baseline_date := nullif(v_history#>>'{period,baselineDate}', '')::date;
  v_latest_date := nullif(v_history#>>'{period,latestDate}', '')::date;
  v_observed_days := case
    when v_baseline_date is null or v_latest_date is null then 0
    else greatest(1, v_latest_date - v_baseline_date + 1)
  end;
  v_claim_eligible := v_snapshot_count >= 2
    and v_baseline_date is not null
    and v_latest_date is not null
    and v_latest_date > v_baseline_date;

  v_site_risk_baseline := nullif(v_history_summary#>>'{siteRisk,baseline}', '')::numeric;
  v_site_risk_latest := nullif(v_history_summary#>>'{siteRisk,latest}', '')::numeric;
  v_site_risk_reduction := case
    when v_claim_eligible then v_site_risk_baseline - v_site_risk_latest
    else null
  end;
  v_operational_risk_baseline := nullif(v_history_summary#>>'{operationalRisk,baseline}', '')::numeric;
  v_operational_risk_latest := nullif(v_history_summary#>>'{operationalRisk,latest}', '')::numeric;
  v_labour_risk_baseline := nullif(v_history_summary#>>'{labourRisk,baseline}', '')::numeric;
  v_labour_risk_latest := nullif(v_history_summary#>>'{labourRisk,latest}', '')::numeric;
  v_action_baseline := coalesce((v_history_summary#>>'{capabilityActions,baseline}')::integer, 0);
  v_action_latest := coalesce((v_history_summary#>>'{capabilityActions,latest}')::integer, 0);
  v_high_critical_baseline := coalesce((v_history_summary#>>'{highAndCriticalActions,baseline}')::integer, 0);
  v_high_critical_latest := coalesce((v_history_summary#>>'{highAndCriticalActions,latest}')::integer, 0);
  v_backup_baseline := coalesce((v_history_summary#>>'{backupSmeActions,baseline}')::integer, 0);
  v_backup_latest := coalesce((v_history_summary#>>'{backupSmeActions,latest}')::integer, 0);
  v_am_baseline := coalesce((v_history_summary#>>'{amShiftActions,baseline}')::integer, 0);
  v_am_latest := coalesce((v_history_summary#>>'{amShiftActions,latest}')::integer, 0);
  v_skill_baseline := coalesce((v_history_summary#>>'{skillCoverageActions,baseline}')::integer, 0);
  v_skill_latest := coalesce((v_history_summary#>>'{skillCoverageActions,latest}')::integer, 0);
  v_closed_actions := coalesce((v_history_summary->>'closedActions')::integer, 0);
  v_improved_actions := coalesce((v_history_summary->>'improvedActions')::integer, 0);
  v_worsened_actions := coalesce((v_history_summary->>'worsenedActions')::integer, 0);
  v_new_actions := coalesce((v_history_summary->>'newActions')::integer, 0);

  select coalesce(jsonb_agg(change_item.value), '[]'::jsonb)
  into v_top_changes
  from (
    select item.value
    from jsonb_array_elements(coalesce(v_history->'actionChanges', '[]'::jsonb)) item(value)
    where item.value->>'changeType' <> 'UNCHANGED'
    limit 10
  ) change_item;

  with completed_orders as (
    select
      work_order.id,
      work_order.site_id,
      coalesce(
        work_order.business_completion_at::date,
        work_order.technical_completion_at::date,
        work_order.actual_finish_at::date,
        work_order.completed_date
      ) as completion_date,
      exists (
        select 1
        from public.work_order_confirmations confirmation
        where confirmation.work_order_id = work_order.id
          and confirmation.site_id = work_order.site_id
          and confirmation.reversal is false
          and nullif(btrim(confirmation.confirmation_text), '') is not null
      ) as has_confirmation,
      exists (
        select 1
        from public.work_order_material_reservations reservation
        where reservation.work_order_id = work_order.id
          and reservation.site_id = work_order.site_id
      ) as has_material_reservation,
      exists (
        select 1
        from public.work_order_goods_movements movement
        where movement.work_order_id = work_order.id
          and movement.site_id = work_order.site_id
          and movement.reversal is false
          and movement.quantity <> 0
      ) as has_goods_movement
    from public.work_orders work_order
    where work_order.site_id = p_site_id
      and upper(work_order.status) = 'COMPLETED'
  )
  select
    count(*)::integer,
    count(*) filter (where has_confirmation)::integer,
    count(*) filter (where has_material_reservation)::integer,
    count(*) filter (where has_material_reservation and has_goods_movement)::integer,
    count(*) filter (where completion_date between v_start_date and v_end_date)::integer,
    count(*) filter (where completion_date between v_start_date and v_end_date and has_confirmation)::integer,
    count(*) filter (where completion_date between v_start_date and v_end_date and has_material_reservation)::integer,
    count(*) filter (where completion_date between v_start_date and v_end_date and has_material_reservation and has_goods_movement)::integer
  into
    v_all_completed,
    v_all_confirmed,
    v_all_material_orders,
    v_all_material_posted,
    v_period_completed,
    v_period_confirmed,
    v_period_material_orders,
    v_period_material_posted
  from completed_orders;

  v_all_confirmation_pct := case when v_all_completed = 0 then null else round(v_all_confirmed * 100.0 / v_all_completed, 1) end;
  v_all_material_pct := case when v_all_material_orders = 0 then null else round(v_all_material_posted * 100.0 / v_all_material_orders, 1) end;
  v_period_confirmation_pct := case when v_period_completed = 0 then null else round(v_period_confirmed * 100.0 / v_period_completed, 1) end;
  v_period_material_pct := case when v_period_material_orders = 0 then null else round(v_period_material_posted * 100.0 / v_period_material_orders, 1) end;

  select
    count(*)::integer,
    count(*) filter (
      where exists (
        select 1
        from public.knowledge_documents document
        where document.equipment_id = equipment.id
          and document.site_id = p_site_id
          and document.is_current
      )
    )::integer,
    count(*) filter (where coalesce(risk.risk_score, 0) >= 50)::integer,
    count(*) filter (
      where coalesce(risk.risk_score, 0) >= 50
        and exists (
          select 1
          from public.knowledge_documents document
          where document.equipment_id = equipment.id
            and document.site_id = p_site_id
            and document.is_current
        )
    )::integer
  into v_total_equipment, v_equipment_with_docs, v_high_risk_equipment, v_high_risk_with_docs
  from public.equipment_assets equipment
  left join public.equipment_risk_profiles risk on risk.equipment_id = equipment.id
  where equipment.site_id = p_site_id;

  select
    count(*)::integer,
    count(*) filter (
      where nullif(btrim(document.source_url), '') is not null
        and document.last_indexed_at is not null
        and exists (select 1 from public.knowledge_chunks chunk where chunk.document_id = document.id)
        and (
          document.page_number is not null
          or nullif(btrim(document.drawing_number), '') is not null
          or nullif(btrim(document.manual_section), '') is not null
          or nullif(btrim(document.external_reference), '') is not null
        )
    )::integer
  into v_current_documents, v_usable_documents
  from public.knowledge_documents document
  where document.site_id = p_site_id
    and document.is_current;

  v_equipment_document_pct := case when v_total_equipment = 0 then null else round(v_equipment_with_docs * 100.0 / v_total_equipment, 1) end;
  v_high_risk_document_pct := case when v_high_risk_equipment = 0 then 100 else round(v_high_risk_with_docs * 100.0 / v_high_risk_equipment, 1) end;
  v_document_usability_pct := case when v_current_documents = 0 then null else round(v_usable_documents * 100.0 / v_current_documents, 1) end;

  select
    count(*) filter (where lower(skill.verification_status) = 'validated')::integer,
    count(*) filter (
      where lower(skill.verification_status) = 'validated'
        and coalesce(skill.verified_at, skill.last_validated_at, skill.updated_at)::date between v_start_date and v_end_date
    )::integer,
    count(distinct skill.engineer_id) filter (
      where lower(skill.verification_status) = 'validated'
        and coalesce(skill.verified_at, skill.last_validated_at, skill.updated_at)::date between v_start_date and v_end_date
    )::integer
  into v_validated_engineer_skills, v_period_engineer_validations, v_period_engineers_validated
  from public.engineer_skills skill
  join public.engineers engineer on engineer.id = skill.engineer_id
  where engineer.site_id = p_site_id;

  select
    count(*) filter (
      where capability.capability_status = 'ACTIVE'
        and capability.validation_status = 'VALIDATED'
        and (capability.valid_until is null or capability.valid_until >= current_date)
    )::integer,
    count(*) filter (
      where capability.capability_role = 'PRIMARY_SME'
        and capability.capability_status = 'ACTIVE'
        and capability.validation_status = 'VALIDATED'
        and (capability.valid_until is null or capability.valid_until >= current_date)
    )::integer,
    count(*) filter (
      where capability.capability_role = 'BACKUP_SME'
        and capability.capability_status = 'ACTIVE'
        and capability.validation_status = 'VALIDATED'
        and (capability.valid_until is null or capability.valid_until >= current_date)
    )::integer,
    count(*) filter (
      where capability.validation_status = 'VALIDATED'
        and coalesce(capability.updated_at, capability.created_at)::date between v_start_date and v_end_date
    )::integer
  into v_active_validated_capabilities, v_primary_smes, v_backup_smes, v_period_capability_validations
  from public.equipment_engineer_capabilities capability
  join public.equipment_assets equipment on equipment.id = capability.equipment_id
  where equipment.site_id = p_site_id;

  select
    count(*) filter (
      where assignment.assignment_status = 'ACTIVE'
        and assignment.am_step >= 1
        and assignment.am_validation_status = 'VALIDATED'
        and (assignment.valid_until is null or assignment.valid_until >= current_date)
    )::integer,
    count(*) filter (where assignment.am_validation_status = 'IN_TRAINING')::integer,
    count(*) filter (
      where assignment.am_validation_status = 'VALIDATED'
        and assignment.validated_at::date between v_start_date and v_end_date
    )::integer,
    count(distinct assignment.operator_id) filter (
      where assignment.am_validation_status = 'VALIDATED'
        and assignment.validated_at::date between v_start_date and v_end_date
    )::integer
  into v_validated_am_assignments, v_am_assignments_in_training, v_period_operator_validations, v_period_operators_validated
  from public.operator_equipment_assignments assignment
  join public.operators operator on operator.id = assignment.operator_id
  where operator.site_id = p_site_id;

  select snapshot.id, snapshot.capability_action_count
  into v_latest_snapshot_id, v_expected_action_rows
  from private.vorta_capability_risk_snapshots snapshot
  where snapshot.site_id = p_site_id
    and snapshot.snapshot_date between v_start_date and v_end_date
  order by snapshot.snapshot_date desc, snapshot.captured_at desc
  limit 1;

  if v_latest_snapshot_id is not null then
    select count(*)::integer
    into v_actual_action_rows
    from private.vorta_capability_action_snapshots action
    where action.snapshot_id = v_latest_snapshot_id;
  end if;

  select
    run.suite_version,
    run.overall_status,
    run.finished_at,
    run.passed_count,
    run.failed_count,
    run.warning_count
  into
    v_latest_suite_version,
    v_latest_health_status,
    v_latest_health_finished_at,
    v_latest_passed,
    v_latest_failed,
    v_latest_warnings
  from private.vorta_backend_health_runs run
  where run.demo_site_id = p_site_id
  order by
    coalesce(nullif(substring(split_part(run.suite_version, '.', 1) from '^[0-9]+'), '')::integer, 0) desc,
    coalesce(nullif(substring(split_part(run.suite_version, '.', 2) from '^[0-9]+'), '')::integer, 0) desc,
    coalesce(nullif(substring(split_part(run.suite_version, '.', 3) from '^[0-9]+'), '')::integer, 0) desc,
    run.started_at desc
  limit 1;

  if v_latest_suite_version is not null then
    select
      count(*)::integer,
      count(*) filter (where run.overall_status = 'pass')::integer
    into v_health_run_count, v_health_pass_count
    from private.vorta_backend_health_runs run
    where run.demo_site_id = p_site_id
      and run.suite_version = v_latest_suite_version
      and coalesce(run.anchor_date, run.started_at::date) between v_start_date and v_end_date;
  end if;

  v_health_pass_rate := case when v_health_run_count = 0 then null else round(v_health_pass_count * 100.0 / v_health_run_count, 1) end;

  select
    count(*)::integer,
    count(*) filter (where alert.severity = 'critical')::integer,
    count(*) filter (where alert.severity = 'high')::integer
  into v_open_health_incidents, v_critical_health_incidents, v_high_health_incidents
  from public.vorta_alerts alert
  where alert.site_id = p_site_id
    and alert.category = 'system_health'
    and alert.status in ('open', 'acknowledged');

  v_maintenance_score := case
    when v_all_completed = 0 then 0
    when v_all_material_orders = 0 then coalesce(v_all_confirmation_pct, 0)
    else round(coalesce(v_all_confirmation_pct, 0) * 0.65 + coalesce(v_all_material_pct, 0) * 0.35, 1)
  end;
  v_knowledge_score := round(
    coalesce(v_document_usability_pct, 0) * 0.50
    + coalesce(v_equipment_document_pct, 0) * 0.25
    + coalesce(v_high_risk_document_pct, 0) * 0.25,
    1
  );
  v_capability_score := case
    when v_latest_snapshot_id is null then 0
    when v_expected_action_rows = 0 and v_actual_action_rows = 0 then 100
    when v_expected_action_rows = 0 then 50
    else round(50 + least(50, v_actual_action_rows * 50.0 / v_expected_action_rows), 1)
  end;
  v_backend_score := case
    when v_health_run_count = 0 then 0
    else greatest(0, least(
      100,
      coalesce(v_health_pass_rate, 0)
      - v_critical_health_incidents * 30
      - v_high_health_incidents * 10
      - case when v_latest_health_status <> 'pass' then 25 else 0 end
    ))
  end;
  v_trend_score := case
    when v_snapshot_count = 0 then 0
    else round(
      least(100::numeric, v_snapshot_count * 100.0 / 14) * 0.60
      + least(100::numeric, v_observed_days * 100.0 / 14) * 0.40,
      1
    )
  end;
  v_completeness_score := round(
    v_maintenance_score * 0.30
    + v_knowledge_score * 0.25
    + v_capability_score * 0.25
    + v_backend_score * 0.20,
    1
  );
  v_confidence_score := round(v_completeness_score * 0.70 + v_trend_score * 0.30, 1);
  v_confidence_status := case
    when v_confidence_score >= 85 then 'HIGH'
    when v_confidence_score >= 60 then 'MODERATE'
    else 'LOW'
  end;
  v_report_status := case
    when v_snapshot_count = 0 then 'NO_BASELINE'
    when not v_claim_eligible then 'BASELINE_ONLY'
    when v_snapshot_count < 7 or v_observed_days < 7 then 'EARLY_SIGNAL'
    when v_snapshot_count < 14 or v_observed_days < 14 then 'MEASURED_TREND'
    else 'PILOT_EVIDENCE_READY'
  end;

  v_limitations := to_jsonb(array_remove(array[
    case when v_snapshot_count = 0 then 'No capability-risk baseline has been captured.' end,
    case when v_snapshot_count = 1 then 'Only one distinct daily snapshot exists; risk movement is not yet claimable.' end,
    case when v_snapshot_count between 2 and 6 then 'Fewer than seven daily snapshots exist; changes are early signals only.' end,
    case when v_period_completed = 0 then 'No work orders completed within the selected period; period maintenance percentages have no sample.' end,
    case when v_period_material_orders = 0 then 'No completed material-reservation orders fall within the selected period.' end,
    case when v_equipment_with_docs < v_total_equipment then format('%s equipment assets do not yet have a current dedicated document.', v_total_equipment - v_equipment_with_docs) end,
    case when v_health_run_count = 0 then 'No current-suite backend health run falls within the selected period.' end
  ]::text[], null));

  return jsonb_build_object(
    'reportVersion', '1.0.0',
    'siteId', p_site_id,
    'generatedAt', now(),
    'status', v_report_status,
    'interpretation', 'Observed changes are evidence-backed associations. The report does not claim causal attribution without sufficient distinct daily snapshots.',
    'period', jsonb_build_object(
      'requestedStartDate', v_start_date,
      'requestedEndDate', v_end_date,
      'baselineDate', v_baseline_date,
      'latestSnapshotDate', v_latest_date,
      'snapshotCount', v_snapshot_count,
      'observedDays', v_observed_days
    ),
    'risk', jsonb_build_object(
      'claimEligible', v_claim_eligible,
      'siteRisk', jsonb_build_object(
        'baseline', v_site_risk_baseline,
        'latest', v_site_risk_latest,
        'observedDifference', case when v_site_risk_baseline is null or v_site_risk_latest is null then null else v_site_risk_latest - v_site_risk_baseline end,
        'claimableReduction', v_site_risk_reduction
      ),
      'operationalRisk', jsonb_build_object(
        'baseline', v_operational_risk_baseline,
        'latest', v_operational_risk_latest,
        'observedDifference', case when v_operational_risk_baseline is null or v_operational_risk_latest is null then null else v_operational_risk_latest - v_operational_risk_baseline end
      ),
      'labourRisk', jsonb_build_object(
        'baseline', v_labour_risk_baseline,
        'latest', v_labour_risk_latest,
        'observedDifference', case when v_labour_risk_baseline is null or v_labour_risk_latest is null then null else v_labour_risk_latest - v_labour_risk_baseline end
      )
    ),
    'capability', jsonb_build_object(
      'claimEligible', v_claim_eligible,
      'actions', jsonb_build_object(
        'baseline', v_action_baseline,
        'latest', v_action_latest,
        'reducedBy', case when v_claim_eligible then v_action_baseline - v_action_latest else null end,
        'closed', v_closed_actions,
        'improved', v_improved_actions,
        'worsened', v_worsened_actions,
        'new', v_new_actions
      ),
      'highAndCriticalActions', jsonb_build_object(
        'baseline', v_high_critical_baseline,
        'latest', v_high_critical_latest,
        'reducedBy', case when v_claim_eligible then v_high_critical_baseline - v_high_critical_latest else null end
      ),
      'backupSmeGaps', jsonb_build_object(
        'baseline', v_backup_baseline,
        'latest', v_backup_latest,
        'reducedBy', case when v_claim_eligible then v_backup_baseline - v_backup_latest else null end
      ),
      'amShiftGaps', jsonb_build_object(
        'baseline', v_am_baseline,
        'latest', v_am_latest,
        'reducedBy', case when v_claim_eligible then v_am_baseline - v_am_latest else null end
      ),
      'skillCoverageGaps', jsonb_build_object(
        'baseline', v_skill_baseline,
        'latest', v_skill_latest,
        'reducedBy', case when v_claim_eligible then v_skill_baseline - v_skill_latest else null end
      ),
      'topValueChanges', v_top_changes
    ),
    'trainingAndValidation', jsonb_build_object(
      'periodActivity', jsonb_build_object(
        'engineerSkillValidations', v_period_engineer_validations,
        'engineersValidated', v_period_engineers_validated,
        'equipmentCapabilityValidations', v_period_capability_validations,
        'operatorAmValidations', v_period_operator_validations,
        'operatorsValidated', v_period_operators_validated
      ),
      'currentState', jsonb_build_object(
        'validatedEngineerSkillRecords', v_validated_engineer_skills,
        'activeValidatedEquipmentCapabilities', v_active_validated_capabilities,
        'validatedPrimarySmes', v_primary_smes,
        'validatedBackupSmes', v_backup_smes,
        'validatedAmAssignments', v_validated_am_assignments,
        'amAssignmentsInTraining', v_am_assignments_in_training
      )
    ),
    'maintenanceData', jsonb_build_object(
      'currentDataset', jsonb_build_object(
        'completedOrders', v_all_completed,
        'ordersWithConfirmationText', v_all_confirmed,
        'confirmationCompletenessPct', v_all_confirmation_pct,
        'completedOrdersWithMaterialReservations', v_all_material_orders,
        'materialOrdersWithGoodsMovement', v_all_material_posted,
        'goodsMovementCompletenessPct', v_all_material_pct
      ),
      'periodActivity', jsonb_build_object(
        'completedOrders', v_period_completed,
        'ordersWithConfirmationText', v_period_confirmed,
        'confirmationCompletenessPct', v_period_confirmation_pct,
        'completedOrdersWithMaterialReservations', v_period_material_orders,
        'materialOrdersWithGoodsMovement', v_period_material_posted,
        'goodsMovementCompletenessPct', v_period_material_pct
      )
    ),
    'knowledgeCoverage', jsonb_build_object(
      'status', v_document_health->>'status',
      'equipmentAssets', v_total_equipment,
      'equipmentWithCurrentDocuments', v_equipment_with_docs,
      'equipmentDocumentCoveragePct', v_equipment_document_pct,
      'highRiskEquipment', v_high_risk_equipment,
      'highRiskEquipmentWithDocuments', v_high_risk_with_docs,
      'highRiskDocumentCoveragePct', v_high_risk_document_pct,
      'currentDocuments', v_current_documents,
      'fullyUsableDocuments', v_usable_documents,
      'documentUsabilityPct', v_document_usability_pct,
      'hardFailureCount', coalesce((v_document_summary->>'hardFailureCount')::integer, 0),
      'warningCount', coalesce((v_document_summary->>'warningCount')::integer, 0)
    ),
    'backendReliability', jsonb_build_object(
      'currentSuiteVersion', v_latest_suite_version,
      'currentSuiteRunsInPeriod', v_health_run_count,
      'passedRunsInPeriod', v_health_pass_count,
      'healthSuitePassRatePct', v_health_pass_rate,
      'latestStatus', v_latest_health_status,
      'latestFinishedAt', v_latest_health_finished_at,
      'latestPassedChecks', v_latest_passed,
      'latestFailedChecks', v_latest_failed,
      'latestWarnings', v_latest_warnings,
      'openSystemHealthIncidents', v_open_health_incidents,
      'criticalIncidents', v_critical_health_incidents,
      'highIncidents', v_high_health_incidents
    ),
    'confidence', jsonb_build_object(
      'score', v_confidence_score,
      'status', v_confidence_status,
      'completenessScore', v_completeness_score,
      'trendMaturityScore', v_trend_score,
      'components', jsonb_build_object(
        'maintenanceData', v_maintenance_score,
        'knowledgeCoverage', v_knowledge_score,
        'capabilitySnapshotIntegrity', v_capability_score,
        'backendReliability', v_backend_score
      ),
      'limitations', v_limitations
    ),
    'sourceEvidence', jsonb_build_object(
      'capabilityHistory', jsonb_build_object(
        'latestSnapshotId', v_latest_snapshot_id,
        'expectedActionRows', v_expected_action_rows,
        'actualActionRows', v_actual_action_rows
      ),
      'documentHealthGeneratedAt', v_document_health->>'generatedAt',
      'latestBackendHealthFinishedAt', v_latest_health_finished_at
    )
  );
end;
$function$;

revoke all on function public.vorta_get_pilot_value_report(uuid, date, date) from public;
revoke all on function public.vorta_get_pilot_value_report(uuid, date, date) from anon;
grant execute on function public.vorta_get_pilot_value_report(uuid, date, date) to authenticated;
grant execute on function public.vorta_get_pilot_value_report(uuid, date, date) to service_role;

comment on function public.vorta_get_pilot_value_report(uuid, date, date) is
  'Returns manager-scoped pilot value evidence across risk, capability, maintenance data, knowledge coverage and backend reliability, with explicit confidence and claim eligibility.';
