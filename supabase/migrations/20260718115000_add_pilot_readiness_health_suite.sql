revoke all on function public.vorta_get_capability_reconciliation_report(uuid, integer) from public;
revoke all on function public.vorta_get_capability_reconciliation_report(uuid, integer) from anon;
grant execute on function public.vorta_get_capability_reconciliation_report(uuid, integer) to authenticated;
grant execute on function public.vorta_get_capability_reconciliation_report(uuid, integer) to service_role;

create or replace function public.vorta_run_pilot_readiness_suite(
  p_anchor_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_suite_version constant text := '2.0.0';
  v_suite_started timestamptz := clock_timestamp();
  v_run_id uuid;
  v_site_id uuid;
  v_authorised_user_id uuid;
  v_other_site_id uuid;
  v_equipment_id uuid;
  v_equipment_code text;
  v_other_equipment_id uuid;
  v_original_role text := current_setting('request.jwt.claim.role', true);
  v_original_sub text := current_setting('request.jwt.claim.sub', true);
  v_started timestamptz;
  v_duration_ms numeric;
  v_endpoint_duration_ms numeric := 0;
  v_endpoint_error text;
  v_cross_site_error text;
  v_work_item_count integer := 0;
  v_notification_count integer := 0;
  v_notification_summary_count integer := 0;
  v_calibration_count integer := 0;
  v_skills_row_count integer := 0;
  v_required_skill_count integer := 0;
  v_knowledge_count integer := 0;
  v_other_work_item_count integer := 0;
  v_other_notification_count integer := 0;
  v_other_calibration_count integer := 0;
  v_other_skills_count integer := 0;
  v_other_knowledge_count integer := 0;
  v_other_capability_report jsonb;
  v_completed_order_count integer := 0;
  v_missing_confirmation_count integer := 0;
  v_completed_reserved_order_count integer := 0;
  v_completed_missing_movement_count integer := 0;
  v_invalid_document_source_count integer := 0;
  v_unindexed_document_count integer := 0;
  v_missing_locator_count integer := 0;
  v_capability_report jsonb;
  v_capability_action_count integer := 0;
  v_capability_backup_actions integer := 0;
  v_capability_am_actions integer := 0;
  v_capability_am_shift_gaps integer := 0;
  v_capability_skill_actions integer := 0;
  v_integrity_backup_count integer := 0;
  v_integrity_am_count integer := 0;
  v_invalid_candidate_state_count integer := 0;
  v_inactive_shift_output_count integer := 0;
  v_base_failed integer := 0;
  v_base_warned integer := 0;
  v_passed integer := 0;
  v_failed integer := 0;
  v_warned integer := 0;
  v_total integer := 0;
  v_total_duration_ms numeric := 0;
  v_overall_status text;
  v_result jsonb;
begin
  select base_run.run_id
  into v_run_id
  from public.vorta_run_backend_health_suite(p_anchor_date) base_run
  limit 1;

  if v_run_id is null then
    raise exception 'Pilot readiness suite could not resolve the baseline health run';
  end if;

  select run.demo_site_id, run.authorised_user_id
  into v_site_id, v_authorised_user_id
  from private.vorta_backend_health_runs run
  where run.id = v_run_id;

  select count(*) filter (where result.status = 'fail'),
         count(*) filter (where result.status = 'warn')
  into v_base_failed, v_base_warned
  from private.vorta_backend_health_results result
  where result.run_id = v_run_id;

  perform private.vorta_record_backend_health_result(
    v_run_id, 310, 'baseline_suite_passed', 'pilot_readiness',
    case when v_base_failed = 0 then 'pass' else 'fail' end,
    'The baseline backend suite has zero failed checks',
    format('failed=%s, warnings=%s', v_base_failed, v_base_warned),
    null,
    'The pilot suite extends the existing baseline rather than duplicating it.'
  );

  select site.id
  into v_other_site_id
  from public.sites site
  where site.id <> v_site_id
  order by site.name
  limit 1;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', coalesce(v_authorised_user_id::text, ''), true);

  select equipment.id, equipment.equipment_code
  into v_equipment_id, v_equipment_code
  from public.equipment_assets equipment
  left join public.equipment_risk_profiles risk on risk.equipment_id = equipment.id
  where equipment.site_id = v_site_id
  order by
    (
      exists (select 1 from public.work_orders work_order where work_order.equipment_id = equipment.id)
      and exists (select 1 from public.maintenance_notifications notification where notification.equipment_id = equipment.id)
      and exists (select 1 from public.knowledge_chunks chunk where chunk.equipment_id = equipment.id)
    ) desc,
    coalesce(risk.risk_score, 0) desc,
    equipment.equipment_code
  limit 1;

  select equipment.id
  into v_other_equipment_id
  from public.equipment_assets equipment
  where equipment.site_id = v_other_site_id
  order by equipment.equipment_code
  limit 1;

  perform private.vorta_record_backend_health_result(
    v_run_id, 320, 'representative_equipment_selected', 'configuration',
    case when v_equipment_id is not null then 'pass' else 'fail' end,
    'A Wrexham asset with maintenance, notification and knowledge data is selected dynamically',
    format('equipment=%s, code=%s', coalesce(v_equipment_id::text, 'null'), coalesce(v_equipment_code, 'null')),
    null,
    'The suite does not depend on a generated equipment UUID.'
  );

  perform private.vorta_record_backend_health_result(
    v_run_id, 330, 'pilot_rpc_execution_surface', 'security',
    case when
      not has_function_privilege('anon', 'public.vorta_get_equipment_work_items(uuid)'::regprocedure, 'EXECUTE')
      and not has_function_privilege('anon', 'public.vorta_get_equipment_notifications(uuid)'::regprocedure, 'EXECUTE')
      and not has_function_privilege('anon', 'public.vorta_get_equipment_calibrations(uuid)'::regprocedure, 'EXECUTE')
      and not has_function_privilege('anon', 'public.vorta_get_equipment_skills_showcase(uuid)'::regprocedure, 'EXECUTE')
      and not has_function_privilege('anon', 'public.vorta_search_equipment_knowledge(uuid,text,integer)'::regprocedure, 'EXECUTE')
      and not has_function_privilege('anon', 'public.vorta_get_capability_reconciliation_report(uuid,integer)'::regprocedure, 'EXECUTE')
      and has_function_privilege('authenticated', 'public.vorta_get_equipment_work_items(uuid)'::regprocedure, 'EXECUTE')
      and has_function_privilege('authenticated', 'public.vorta_get_equipment_notifications(uuid)'::regprocedure, 'EXECUTE')
      and has_function_privilege('authenticated', 'public.vorta_get_equipment_calibrations(uuid)'::regprocedure, 'EXECUTE')
      and has_function_privilege('authenticated', 'public.vorta_get_equipment_skills_showcase(uuid)'::regprocedure, 'EXECUTE')
      and has_function_privilege('authenticated', 'public.vorta_search_equipment_knowledge(uuid,text,integer)'::regprocedure, 'EXECUTE')
      and has_function_privilege('authenticated', 'public.vorta_get_capability_reconciliation_report(uuid,integer)'::regprocedure, 'EXECUTE')
    then 'pass' else 'fail' end,
    'Pilot RPCs are executable by authenticated users and not executable by anon',
    format(
      'anon[work=%s, notifications=%s, calibrations=%s, skills=%s, knowledge=%s, reconciliation=%s]',
      has_function_privilege('anon', 'public.vorta_get_equipment_work_items(uuid)'::regprocedure, 'EXECUTE'),
      has_function_privilege('anon', 'public.vorta_get_equipment_notifications(uuid)'::regprocedure, 'EXECUTE'),
      has_function_privilege('anon', 'public.vorta_get_equipment_calibrations(uuid)'::regprocedure, 'EXECUTE'),
      has_function_privilege('anon', 'public.vorta_get_equipment_skills_showcase(uuid)'::regprocedure, 'EXECUTE'),
      has_function_privilege('anon', 'public.vorta_search_equipment_knowledge(uuid,text,integer)'::regprocedure, 'EXECUTE'),
      has_function_privilege('anon', 'public.vorta_get_capability_reconciliation_report(uuid,integer)'::regprocedure, 'EXECUTE')
    ),
    null,
    'Row-level access checks remain mandatory inside every SECURITY DEFINER RPC.'
  );

  v_endpoint_error := null;
  v_started := clock_timestamp();
  begin
    if v_equipment_id is not null then
      select count(*) into v_work_item_count from public.vorta_get_equipment_work_items(v_equipment_id);
      select count(*) into v_notification_count from public.vorta_get_equipment_notifications(v_equipment_id);
      select count(*) into v_notification_summary_count from public.vorta_get_equipment_notification_summary(v_equipment_id);
      select count(*) into v_calibration_count from public.vorta_get_equipment_calibrations(v_equipment_id);
      select count(*), coalesce(max(showcase.required_skill_count), 0)
      into v_skills_row_count, v_required_skill_count
      from public.vorta_get_equipment_skills_showcase(v_equipment_id) showcase;
      select count(*) into v_knowledge_count
      from public.vorta_search_equipment_knowledge(v_equipment_id, 'manual', 8);
    end if;
  exception when others then
    v_endpoint_error := sqlerrm;
  end;
  v_endpoint_duration_ms := round((extract(epoch from clock_timestamp() - v_started) * 1000)::numeric, 3);

  perform private.vorta_record_backend_health_result(
    v_run_id, 340, 'pilot_equipment_endpoint_bundle_valid', 'functional',
    case when
      v_endpoint_error is null
      and v_equipment_id is not null
      and v_work_item_count > 0
      and v_notification_count > 0
      and v_notification_summary_count = 1
      and v_calibration_count > 0
      and v_skills_row_count = 1
      and v_required_skill_count > 0
      and v_knowledge_count > 0
    then 'pass' else 'fail' end,
    'Representative equipment returns work, notification, calibration, skills and knowledge data',
    format(
      'work=%s, notifications=%s, notification_summary=%s, calibrations=%s, skills_rows=%s, required_skills=%s, knowledge=%s, error=%s',
      v_work_item_count, v_notification_count, v_notification_summary_count, v_calibration_count,
      v_skills_row_count, v_required_skill_count, v_knowledge_count, coalesce(v_endpoint_error, 'none')
    ),
    v_endpoint_duration_ms,
    format('Representative equipment code: %s', coalesce(v_equipment_code, 'none'))
  );

  perform private.vorta_record_backend_health_result(
    v_run_id, 350, 'pilot_equipment_endpoint_bundle_performance', 'performance',
    case when v_endpoint_error is null and v_endpoint_duration_ms <= 1500 then 'pass' else 'fail' end,
    '<= 1500 ms for the combined representative equipment workflow',
    v_endpoint_duration_ms || ' ms',
    v_endpoint_duration_ms,
    'Measures the six principal Equipment page backend calls as one user journey.'
  );

  v_cross_site_error := null;
  begin
    if v_other_equipment_id is not null then
      select count(*) into v_other_work_item_count from public.vorta_get_equipment_work_items(v_other_equipment_id);
      select count(*) into v_other_notification_count from public.vorta_get_equipment_notifications(v_other_equipment_id);
      select count(*) into v_other_calibration_count from public.vorta_get_equipment_calibrations(v_other_equipment_id);
      select count(*) into v_other_skills_count from public.vorta_get_equipment_skills_showcase(v_other_equipment_id);
      select count(*) into v_other_knowledge_count from public.vorta_search_equipment_knowledge(v_other_equipment_id, 'manual', 8);
    end if;
    if v_other_site_id is not null then
      v_other_capability_report := public.vorta_get_capability_reconciliation_report(v_other_site_id, 10);
    end if;
  exception when others then
    v_cross_site_error := sqlerrm;
  end;

  perform private.vorta_record_backend_health_result(
    v_run_id, 360, 'pilot_cross_site_equipment_endpoints_blocked', 'security',
    case when
      v_cross_site_error is null
      and coalesce(v_other_work_item_count, 0) = 0
      and coalesce(v_other_notification_count, 0) = 0
      and coalesce(v_other_calibration_count, 0) = 0
      and coalesce(v_other_skills_count, 0) = 0
      and coalesce(v_other_knowledge_count, 0) = 0
      and v_other_capability_report is null
    then 'pass' else 'fail' end,
    'A Wrexham maintenance manager receives no Liverpool or Manchester equipment data',
    format(
      'work=%s, notifications=%s, calibrations=%s, skills=%s, knowledge=%s, reconciliation_null=%s, error=%s',
      coalesce(v_other_work_item_count, 0), coalesce(v_other_notification_count, 0),
      coalesce(v_other_calibration_count, 0), coalesce(v_other_skills_count, 0),
      coalesce(v_other_knowledge_count, 0), v_other_capability_report is null,
      coalesce(v_cross_site_error, 'none')
    ),
    null,
    'Exercises the actual pilot RPCs rather than testing only the access helper.'
  );

  select
    count(*)::integer,
    count(*) filter (
      where not exists (
        select 1 from public.work_order_confirmations confirmation
        where confirmation.work_order_id = work_order.id
          and not confirmation.reversal
          and nullif(btrim(confirmation.confirmation_text), '') is not null
      )
    )::integer
  into v_completed_order_count, v_missing_confirmation_count
  from public.work_orders work_order
  where work_order.site_id = v_site_id
    and (
      work_order.completed_date is not null
      or upper(coalesce(work_order.status, '')) in ('COMPLETED', 'CLOSED', 'TECO', 'TECHNICALLY COMPLETED')
    );

  perform private.vorta_record_backend_health_result(
    v_run_id, 370, 'completed_orders_have_confirmation_text', 'maintenance_integrity',
    case when v_completed_order_count > 0 and v_missing_confirmation_count = 0 then 'pass' else 'fail' end,
    'Every completed work order has non-reversed confirmation text',
    format('completed=%s, missing_confirmation=%s', v_completed_order_count, v_missing_confirmation_count),
    null,
    'Protects the engineer completion record displayed in the work-order detail panel.'
  );

  select
    count(*)::integer,
    count(*) filter (
      where not exists (
        select 1 from public.work_order_goods_movements movement
        where movement.work_order_id = completed_order.id
          and not movement.reversal
          and coalesce(movement.quantity, 0) <> 0
      )
    )::integer
  into v_completed_reserved_order_count, v_completed_missing_movement_count
  from public.work_orders completed_order
  where completed_order.site_id = v_site_id
    and (
      completed_order.completed_date is not null
      or upper(coalesce(completed_order.status, '')) in ('COMPLETED', 'CLOSED', 'TECO', 'TECHNICALLY COMPLETED')
    )
    and exists (
      select 1 from public.work_order_material_reservations reservation
      where reservation.work_order_id = completed_order.id
        and coalesce(reservation.required_quantity, 0) > 0
    );

  perform private.vorta_record_backend_health_result(
    v_run_id, 380, 'completed_material_orders_have_goods_movement', 'maintenance_integrity',
    case when v_completed_missing_movement_count = 0 then 'pass' else 'fail' end,
    'Completed orders with reserved material have a non-reversed goods movement',
    format('completed_with_material=%s, missing_goods_movement=%s', v_completed_reserved_order_count, v_completed_missing_movement_count),
    null,
    'Open and waiting-parts reservations are intentionally excluded.'
  );

  select
    count(*) filter (
      where nullif(btrim(document.source_url), '') is null
         or document.source_url !~* '^([a-z][a-z0-9+.-]*://|/)'
    )::integer,
    count(*) filter (where document.last_indexed_at is null)::integer,
    count(*) filter (
      where document.page_number is null
        and nullif(btrim(document.drawing_number), '') is null
        and nullif(btrim(document.manual_section), '') is null
    )::integer
  into v_invalid_document_source_count, v_unindexed_document_count, v_missing_locator_count
  from public.knowledge_documents document
  where document.site_id = v_site_id
    and document.is_current
    and lower(coalesce(document.status, 'active')) not in ('archived', 'inactive');

  perform private.vorta_record_backend_health_result(
    v_run_id, 390, 'current_documents_have_valid_source_reference', 'knowledge_integrity',
    case when v_invalid_document_source_count = 0 then 'pass' else 'fail' end,
    'Every current document has a valid absolute, connector or relative source reference',
    v_invalid_document_source_count::text,
    null,
    'Accepts HTTPS, connector schemes such as easidoc-demo:// and application-relative paths.'
  );

  perform private.vorta_record_backend_health_result(
    v_run_id, 400, 'document_indexing_and_locator_completeness', 'knowledge_integrity',
    case when v_unindexed_document_count = 0 and v_missing_locator_count = 0 then 'pass' else 'warn' end,
    'Current documents are indexed and have a page, drawing or manual-section locator',
    format('not_indexed=%s, missing_locator=%s', v_unindexed_document_count, v_missing_locator_count),
    null,
    'A warning preserves pilot visibility without misclassifying connector-level source records as broken links.'
  );

  v_started := clock_timestamp();
  v_capability_report := public.vorta_get_capability_reconciliation_report(v_site_id, 500);
  v_duration_ms := round((extract(epoch from clock_timestamp() - v_started) * 1000)::numeric, 3);

  v_capability_action_count := coalesce((v_capability_report->'summary'->>'actionCount')::integer, 0);
  v_capability_backup_actions := coalesce((v_capability_report->'summary'->>'backupSmeActions')::integer, 0);
  v_capability_am_actions := coalesce((v_capability_report->'summary'->>'amShiftActions')::integer, 0);
  v_capability_skill_actions := coalesce((v_capability_report->'summary'->>'skillCoverageActions')::integer, 0);

  select coalesce(sum(jsonb_array_length(coalesce(action.value->'affectedShifts', '[]'::jsonb))), 0)::integer
  into v_capability_am_shift_gaps
  from jsonb_array_elements(coalesce(v_capability_report->'actions', '[]'::jsonb)) action(value)
  where action.value->>'actionType' = 'AM_SHIFT_COVERAGE';

  select coalesce(integrity.actual_count, 0)::integer
  into v_integrity_backup_count
  from public.vorta_get_maintenance_workflow_integrity(v_site_id) integrity
  where integrity.check_key = 'equipment_without_backup_sme';

  select coalesce(integrity.actual_count, 0)::integer
  into v_integrity_am_count
  from public.vorta_get_maintenance_workflow_integrity(v_site_id) integrity
  where integrity.check_key = 'equipment_shift_am_coverage_gap';

  perform private.vorta_record_backend_health_result(
    v_run_id, 410, 'capability_reconciliation_matches_integrity', 'capability_integrity',
    case when
      v_capability_report is not null
      and v_capability_action_count = v_capability_backup_actions + v_capability_am_actions + v_capability_skill_actions
      and v_capability_backup_actions = v_integrity_backup_count
      and v_capability_am_shift_gaps = v_integrity_am_count
    then 'pass' else 'fail' end,
    'Reconciliation action totals match the independent maintenance integrity checks',
    format(
      'actions=%s, backup=%s/%s, am_actions=%s, am_shift_gaps=%s/%s, skills=%s',
      v_capability_action_count, v_capability_backup_actions, v_integrity_backup_count,
      v_capability_am_actions, v_capability_am_shift_gaps, v_integrity_am_count,
      v_capability_skill_actions
    ),
    v_duration_ms,
    'Prevents the dashboard and reconciliation queue from presenting conflicting risk counts.'
  );

  select count(*)::integer
  into v_invalid_candidate_state_count
  from jsonb_array_elements(coalesce(v_capability_report->'actions', '[]'::jsonb)) action(value)
  where action.value->>'actionType' = 'BACKUP_SME_DEVELOPMENT'
    and action.value->'candidate' is not null
    and action.value->'candidate'->>'status' = 'VALIDATED'
    and coalesce((action.value->'candidate'->>'requiredSkillTotal')::integer, 0) > 0
    and coalesce((action.value->'candidate'->>'requiredSkillMatches')::integer, 0)
      < coalesce((action.value->'candidate'->>'requiredSkillTotal')::integer, 0);

  perform private.vorta_record_backend_health_result(
    v_run_id, 420, 'capability_candidate_readiness_is_honest', 'capability_integrity',
    case when v_invalid_candidate_state_count = 0 then 'pass' else 'fail' end,
    'No backup candidate is labelled validated while missing mapped equipment skills',
    v_invalid_candidate_state_count::text,
    null,
    'A capability record alone cannot override incomplete equipment-skill coverage.'
  );

  select
    (
      select count(*)
      from public.equipment_assets equipment
      cross join lateral public.vorta_get_equipment_skills_showcase(equipment.id) showcase
      cross join lateral jsonb_array_elements(showcase.shift_coverage) shift_item(value)
      join public.maintenance_shift_teams shift_team
        on shift_team.site_id = v_site_id
       and shift_team.code = shift_item.value->>'shiftCode'
      where equipment.site_id = v_site_id
        and shift_team.active is false
    )
    +
    (
      select count(*)
      from jsonb_array_elements(coalesce(v_capability_report->'actions', '[]'::jsonb)) action(value)
      cross join lateral jsonb_array_elements(coalesce(action.value->'affectedShifts', '[]'::jsonb)) shift_item(value)
      join public.maintenance_shift_teams shift_team
        on shift_team.site_id = v_site_id
       and shift_team.code = shift_item.value->>'shiftCode'
      where shift_team.active is false
    )
  into v_inactive_shift_output_count;

  perform private.vorta_record_backend_health_result(
    v_run_id, 430, 'inactive_shifts_excluded_from_people_risk', 'capability_integrity',
    case when v_inactive_shift_output_count = 0 then 'pass' else 'fail' end,
    'Inactive shift teams never appear in equipment coverage or reconciliation actions',
    v_inactive_shift_output_count::text,
    null,
    'Prevents retired rota colours from creating artificial labour-risk gaps.'
  );

  perform private.vorta_record_backend_health_result(
    v_run_id, 440, 'capability_reconciliation_performance', 'performance',
    case when v_capability_report is not null and v_duration_ms <= 1000 then 'pass' else 'fail' end,
    '<= 1000 ms for the full Wrexham capability reconciliation report',
    v_duration_ms || ' ms',
    v_duration_ms,
    format('%s ranked actions returned', v_capability_action_count)
  );

  select count(*) filter (where result.status = 'pass'),
         count(*) filter (where result.status = 'fail'),
         count(*) filter (where result.status = 'warn'),
         count(*)
  into v_passed, v_failed, v_warned, v_total
  from private.vorta_backend_health_results result
  where result.run_id = v_run_id;

  v_total_duration_ms := round((extract(epoch from clock_timestamp() - v_suite_started) * 1000)::numeric, 3);
  v_overall_status := case when v_failed > 0 then 'fail' else 'pass' end;

  update private.vorta_backend_health_runs run
  set suite_version = v_suite_version,
      finished_at = now(),
      passed_count = v_passed,
      failed_count = v_failed,
      warning_count = v_warned,
      overall_status = v_overall_status,
      notes = format('%s checks completed in %s ms; representative equipment %s', v_total, v_total_duration_ms, coalesce(v_equipment_code, 'none'))
  where run.id = v_run_id;

  if v_failed > 0 then
    perform private.vorta_open_or_update_system_health_alert(
      v_site_id,
      'backend:pilot_readiness',
      'Pilot backend readiness checks failed',
      format('%s of %s backend readiness checks failed.', v_failed, v_total),
      case when v_failed >= 3 then 'critical' else 'high' end,
      'Pilot Readiness Health Suite',
      jsonb_build_object(
        'runId', v_run_id,
        'suiteVersion', v_suite_version,
        'checks', v_total,
        'passed', v_passed,
        'failed', v_failed,
        'warnings', v_warned,
        'durationMs', v_total_duration_ms,
        'observedAt', now()
      )
    );
  else
    perform private.vorta_resolve_system_health_alert(
      v_site_id,
      'backend:pilot_readiness',
      jsonb_build_object('recoveredAt', now(), 'runId', v_run_id, 'suiteVersion', v_suite_version)
    );
  end if;

  select jsonb_build_object(
    'status', v_overall_status,
    'runId', v_run_id,
    'suiteVersion', v_suite_version,
    'siteId', v_site_id,
    'checks', v_total,
    'passed', v_passed,
    'failed', v_failed,
    'warnings', v_warned,
    'durationMs', v_total_duration_ms,
    'representativeEquipment', jsonb_build_object('id', v_equipment_id, 'code', v_equipment_code),
    'failures', coalesce((
      select jsonb_agg(
        jsonb_build_object('checkKey', result.check_key, 'category', result.category, 'actual', result.actual, 'detail', result.detail)
        order by result.check_order
      )
      from private.vorta_backend_health_results result
      where result.run_id = v_run_id and result.status = 'fail'
    ), '[]'::jsonb),
    'warningDetails', coalesce((
      select jsonb_agg(
        jsonb_build_object('checkKey', result.check_key, 'category', result.category, 'actual', result.actual, 'detail', result.detail)
        order by result.check_order
      )
      from private.vorta_backend_health_results result
      where result.run_id = v_run_id and result.status = 'warn'
    ), '[]'::jsonb)
  ) into v_result;

  perform set_config('request.jwt.claim.role', coalesce(v_original_role, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_original_sub, ''), true);
  return v_result;
exception when others then
  perform set_config('request.jwt.claim.role', coalesce(v_original_role, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_original_sub, ''), true);
  if v_run_id is not null then
    update private.vorta_backend_health_runs run
    set suite_version = v_suite_version,
        finished_at = now(),
        overall_status = 'error',
        notes = sqlerrm
    where run.id = v_run_id;
  end if;
  raise;
end;
$function$;

revoke all on function public.vorta_run_pilot_readiness_suite(date) from public;
revoke all on function public.vorta_run_pilot_readiness_suite(date) from anon;
revoke all on function public.vorta_run_pilot_readiness_suite(date) from authenticated;
grant execute on function public.vorta_run_pilot_readiness_suite(date) to service_role;

comment on function public.vorta_run_pilot_readiness_suite(date) is
  'Runs the complete access-controlled Wrexham pilot backend readiness suite, stores every result and returns a compact JSON summary.';

create or replace function public.vorta_get_latest_pilot_readiness_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
  v_run private.vorta_backend_health_runs%rowtype;
begin
  if not public.vorta_can_manage_site(v_site_id) then
    return null;
  end if;

  select run.*
  into v_run
  from private.vorta_backend_health_runs run
  where run.demo_site_id = v_site_id
    and run.suite_version = '2.0.0'
  order by run.started_at desc
  limit 1;

  if v_run.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'status', v_run.overall_status,
    'runId', v_run.id,
    'suiteVersion', v_run.suite_version,
    'siteId', v_run.demo_site_id,
    'startedAt', v_run.started_at,
    'finishedAt', v_run.finished_at,
    'checks', v_run.passed_count + v_run.failed_count + v_run.warning_count,
    'passed', v_run.passed_count,
    'failed', v_run.failed_count,
    'warnings', v_run.warning_count,
    'notes', v_run.notes,
    'failures', coalesce((
      select jsonb_agg(
        jsonb_build_object('checkKey', result.check_key, 'category', result.category, 'actual', result.actual, 'detail', result.detail)
        order by result.check_order
      )
      from private.vorta_backend_health_results result
      where result.run_id = v_run.id and result.status = 'fail'
    ), '[]'::jsonb),
    'warningDetails', coalesce((
      select jsonb_agg(
        jsonb_build_object('checkKey', result.check_key, 'category', result.category, 'actual', result.actual, 'detail', result.detail)
        order by result.check_order
      )
      from private.vorta_backend_health_results result
      where result.run_id = v_run.id and result.status = 'warn'
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.vorta_get_latest_pilot_readiness_summary() from public;
revoke all on function public.vorta_get_latest_pilot_readiness_summary() from anon;
grant execute on function public.vorta_get_latest_pilot_readiness_summary() to authenticated;
grant execute on function public.vorta_get_latest_pilot_readiness_summary() to service_role;

comment on function public.vorta_get_latest_pilot_readiness_summary() is
  'Returns the latest pilot-readiness suite summary to authorised site-management roles.';
