create or replace function public.vorta_run_knowledge_quality_suite(p_anchor_date date default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_version constant text := '2.1.0';
  v_started_at timestamptz := clock_timestamp();
  v_run_id uuid;
  v_site_id uuid := public.vorta_current_demo_site_id();
  v_user_id uuid;
  v_other_equipment_id uuid;
  v_original_role text := current_setting('request.jwt.claim.role', true);
  v_original_sub text := current_setting('request.jwt.claim.sub', true);
  v_health jsonb;
  v_packet jsonb;
  v_started timestamptz;
  v_duration numeric;
  v_supported integer := 0;
  v_evidence integer := 0;
  v_cross_site_packet jsonb;
  v_passed integer;
  v_failed integer;
  v_warned integer;
  v_alert record;
begin
  select (baseline.result->>'runId')::uuid
  into v_run_id
  from (
    select public.vorta_run_pilot_readiness_suite(p_anchor_date) as result
  ) baseline;

  if v_run_id is null then
    raise exception 'Knowledge quality suite could not resolve baseline run';
  end if;

  select access_row.user_id
  into v_user_id
  from public.user_site_access access_row
  join public.profiles profile on profile.id = access_row.user_id
  where access_row.site_id = v_site_id
    and access_row.active
    and lower(replace(replace(coalesce(profile.role, ''), '-', '_'), ' ', '_')) = 'maintenance_manager'
  order by access_row.is_default desc, access_row.created_at
  limit 1;

  if v_user_id is null then
    select access_row.user_id
    into v_user_id
    from public.user_site_access access_row
    where access_row.site_id = v_site_id
      and access_row.active
    order by access_row.is_default desc, access_row.created_at
    limit 1;
  end if;

  select equipment.id
  into v_other_equipment_id
  from public.equipment_assets equipment
  where equipment.site_id <> v_site_id
  order by equipment.equipment_code
  limit 1;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', coalesce(v_user_id::text, ''), true);

  v_started := clock_timestamp();
  v_health := public.vorta_get_document_ingestion_health(v_site_id);
  v_duration := round((extract(epoch from clock_timestamp() - v_started) * 1000)::numeric, 3);

  perform private.vorta_record_backend_health_result(
    v_run_id,
    450,
    'document_ingestion_integrity',
    'knowledge_integrity',
    case when coalesce((v_health->'summary'->>'hardFailureCount')::integer, 999) = 0 then 'pass' else 'fail' end,
    'Zero current documents missing sources, chunks or indexing timestamps',
    coalesce((v_health->'summary')::text, 'null'),
    v_duration,
    'Validates the source and indexing contract behind Ask Vorta.'
  );

  perform private.vorta_record_backend_health_result(
    v_run_id,
    460,
    'document_locator_completeness',
    'knowledge_integrity',
    case when coalesce((v_health->'summary'->>'documentsMissingLocator')::integer, 999) = 0 then 'pass' else 'warn' end,
    'Every current document has a page, drawing, section or external reference locator',
    coalesce(v_health->'summary'->>'documentsMissingLocator', 'null'),
    null,
    'Locators are derived only from existing document or chunk evidence.'
  );

  v_started := clock_timestamp();

  with scenarios(equipment_id, query_text) as (
    values
      ('40000000-0000-0000-0000-000000000007'::uuid, 'infeed sensor alignment repeat fault'::text),
      ('40000000-0000-0000-0000-000000000008'::uuid, 'vacuum seal pressure decay'::text),
      ('40000000-0000-0000-0000-000000000004'::uuid, 'conductivity sensor fault'::text),
      ('40000000-0000-0000-0000-000000000011'::uuid, 'environmental pressure humidity excursion'::text)
  ),
  results as (
    select public.vorta_get_ask_vorta_evidence(scenario.equipment_id, scenario.query_text, 5) as packet
    from scenarios scenario
  )
  select
    count(*) filter (where coalesce((packet->>'supported')::boolean, false))::integer,
    coalesce(sum((packet->>'evidenceCount')::integer), 0)::integer
  into v_supported, v_evidence
  from results;

  v_duration := round((extract(epoch from clock_timestamp() - v_started) * 1000)::numeric, 3);

  perform private.vorta_record_backend_health_result(
    v_run_id,
    470,
    'ask_vorta_grounded_fault_scenarios',
    'knowledge_retrieval',
    case when v_supported = 4 and v_evidence >= 4 then 'pass' else 'fail' end,
    'All four representative fault scenarios return grounded evidence',
    format('supported=%s/4, evidence=%s', v_supported, v_evidence),
    v_duration,
    'Scenarios cover vial filling, freeze drying, WFI and cleanroom HVAC.'
  );

  v_packet := public.vorta_get_ask_vorta_evidence(
    '40000000-0000-0000-0000-000000000001'::uuid,
    'quantum banana gearbox teleportation',
    5
  );

  perform private.vorta_record_backend_health_result(
    v_run_id,
    480,
    'ask_vorta_abstains_without_evidence',
    'knowledge_retrieval',
    case
      when v_packet->>'policy' = 'INSUFFICIENT_EVIDENCE'
        and coalesce((v_packet->>'evidenceCount')::integer, -1) = 0
      then 'pass'
      else 'fail'
    end,
    'Unsupported questions explicitly return INSUFFICIENT_EVIDENCE with zero sources',
    coalesce(v_packet::text, 'null'),
    null,
    'Prevents unsupported maintenance guidance from being presented as sourced advice.'
  );

  if v_other_equipment_id is not null then
    v_cross_site_packet := public.vorta_get_ask_vorta_evidence(
      v_other_equipment_id,
      'manual fault',
      5
    );
  end if;

  perform private.vorta_record_backend_health_result(
    v_run_id,
    490,
    'ask_vorta_cross_site_evidence_blocked',
    'security',
    case when v_other_equipment_id is null or v_cross_site_packet is null then 'pass' else 'fail' end,
    'Cross-site evidence packets return null',
    case when v_cross_site_packet is null then 'null' else 'data returned' end,
    null,
    'Protects connected manuals, drawings and work history across sites.'
  );

  perform private.vorta_record_backend_health_result(
    v_run_id,
    500,
    'ask_vorta_evidence_performance',
    'performance',
    case when coalesce(v_duration, 999999) <= 1500 then 'pass' else 'fail' end,
    '<= 1500 ms for four representative evidence searches',
    v_duration || ' ms',
    v_duration,
    null
  );

  select
    count(*) filter (where result.status = 'pass'),
    count(*) filter (where result.status = 'fail'),
    count(*) filter (where result.status = 'warn')
  into v_passed, v_failed, v_warned
  from private.vorta_backend_health_results result
  where result.run_id = v_run_id;

  update private.vorta_backend_health_runs run
  set
    suite_version = v_version,
    finished_at = now(),
    passed_count = v_passed,
    failed_count = v_failed,
    warning_count = v_warned,
    overall_status = case when v_failed > 0 then 'fail' else 'pass' end,
    notes = format(
      '%s checks completed in %s ms; document and Ask Vorta evidence quality included',
      v_passed + v_failed + v_warned,
      round((extract(epoch from clock_timestamp() - v_started_at) * 1000)::numeric, 3)
    )
  where run.id = v_run_id;

  if v_failed > 0 then
    select *
    into v_alert
    from private.vorta_open_or_update_system_health_alert(
      v_site_id,
      'backend:pilot_readiness',
      'Pilot backend readiness checks failed',
      format('%s of %s checks failed.', v_failed, v_passed + v_failed + v_warned),
      'high',
      'Pilot Readiness Suite',
      jsonb_build_object(
        'runId', v_run_id,
        'suiteVersion', v_version,
        'failed', v_failed,
        'observedAt', now()
      )
    );
  else
    perform private.vorta_resolve_system_health_alert(
      v_site_id,
      'backend:pilot_readiness',
      jsonb_build_object('recoveredAt', now(), 'runId', v_run_id)
    );
  end if;

  perform set_config('request.jwt.claim.role', coalesce(v_original_role, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_original_sub, ''), true);

  return jsonb_build_object(
    'runId', v_run_id,
    'suiteVersion', v_version,
    'siteId', v_site_id,
    'status', case when v_failed > 0 then 'fail' else 'pass' end,
    'checks', v_passed + v_failed + v_warned,
    'passed', v_passed,
    'failed', v_failed,
    'warnings', v_warned,
    'durationMs', round((extract(epoch from clock_timestamp() - v_started_at) * 1000)::numeric, 3),
    'documentHealth', v_health,
    'failures', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'checkKey', result.check_key,
          'category', result.category,
          'actual', result.actual,
          'detail', result.detail
        )
        order by result.check_order
      )
      from private.vorta_backend_health_results result
      where result.run_id = v_run_id
        and result.status = 'fail'
    ), '[]'::jsonb),
    'warningDetails', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'checkKey', result.check_key,
          'category', result.category,
          'actual', result.actual,
          'detail', result.detail
        )
        order by result.check_order
      )
      from private.vorta_backend_health_results result
      where result.run_id = v_run_id
        and result.status = 'warn'
    ), '[]'::jsonb)
  );
exception
  when others then
    perform set_config('request.jwt.claim.role', coalesce(v_original_role, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(v_original_sub, ''), true);
    raise;
end;
$function$;

revoke all on function public.vorta_run_knowledge_quality_suite(date) from public;
revoke all on function public.vorta_run_knowledge_quality_suite(date) from anon;
revoke all on function public.vorta_run_knowledge_quality_suite(date) from authenticated;
grant execute on function public.vorta_run_knowledge_quality_suite(date) to service_role;

create or replace function private.vorta_run_document_ingestion_health_monitor()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
  v_report jsonb;
  v_failures integer;
  v_high_risk_missing integer;
  v_alert record;
  v_opened integer := 0;
  v_updated integer := 0;
  v_resolved integer := 0;
  v_original_role text := current_setting('request.jwt.claim.role', true);
  v_original_sub text := current_setting('request.jwt.claim.sub', true);
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  v_report := public.vorta_get_document_ingestion_health(v_site_id);
  perform set_config('request.jwt.claim.role', coalesce(v_original_role, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_original_sub, ''), true);

  v_failures := coalesce((v_report->'summary'->>'hardFailureCount')::integer, 999);
  v_high_risk_missing := coalesce(
    (v_report->'summary'->>'highRiskEquipmentWithoutDocuments')::integer,
    999
  );

  if v_failures > 0 or v_high_risk_missing > 0 then
    select *
    into v_alert
    from private.vorta_open_or_update_system_health_alert(
      v_site_id,
      'knowledge:document_ingestion',
      'Document knowledge ingestion requires attention',
      format(
        '%s hard document failures and %s high-risk assets without documents.',
        v_failures,
        v_high_risk_missing
      ),
      case when v_failures > 0 then 'high' else 'medium' end,
      'Document Knowledge Monitor',
      v_report || jsonb_build_object('observedAt', now())
    );

    if v_alert.action_taken = 'opened' then
      v_opened := 1;
    else
      v_updated := 1;
    end if;
  else
    v_resolved := private.vorta_resolve_system_health_alert(
      v_site_id,
      'knowledge:document_ingestion',
      jsonb_build_object('recoveredAt', now(), 'report', v_report)
    );
  end if;

  return jsonb_build_object(
    'siteId', v_site_id,
    'status', v_report->>'status',
    'hardFailures', v_failures,
    'highRiskEquipmentWithoutDocuments', v_high_risk_missing,
    'openedIncidents', v_opened,
    'updatedIncidents', v_updated,
    'resolvedIncidents', v_resolved
  );
exception
  when others then
    perform set_config('request.jwt.claim.role', coalesce(v_original_role, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(v_original_sub, ''), true);
    raise;
end;
$function$;

revoke all on function private.vorta_run_document_ingestion_health_monitor() from public;
revoke all on function private.vorta_run_document_ingestion_health_monitor() from anon;
revoke all on function private.vorta_run_document_ingestion_health_monitor() from authenticated;
grant execute on function private.vorta_run_document_ingestion_health_monitor() to service_role;

do $migration$
declare
  v_job_id bigint;
  v_definition text;
begin
  select job.jobid
  into v_job_id
  from cron.job job
  where job.jobname = 'vorta-pilot-readiness-daily'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'vorta-pilot-readiness-daily',
    '27 4 * * *',
    'select public.vorta_run_knowledge_quality_suite(current_date);'
  );

  v_definition := pg_get_functiondef(
    'public.vorta_get_latest_pilot_readiness_summary()'::regprocedure
  );
  v_definition := replace(
    v_definition,
    $old$run.suite_version = '2.0.0'$old$,
    $new$run.suite_version = '2.1.0'$new$
  );
  execute v_definition;

  v_definition := pg_get_functiondef(
    'private.vorta_run_pilot_readiness_schedule_monitor()'::regprocedure
  );
  v_definition := replace(
    v_definition,
    $old$run.suite_version = '2.0.0'$old$,
    $new$run.suite_version = '2.1.0'$new$
  );
  execute v_definition;
end;
$migration$;

create or replace function public.vorta_run_operational_monitoring_cycle()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_operational_result jsonb;
  v_scheduler_result jsonb;
  v_recovery_result jsonb;
  v_pilot_readiness_result jsonb;
  v_document_result jsonb;
begin
  v_operational_result := public.vorta_run_operational_monitoring();
  v_scheduler_result := private.vorta_run_scheduler_health_monitor();
  v_recovery_result := private.vorta_run_recovery_manifest_health_monitor();
  v_pilot_readiness_result := private.vorta_run_pilot_readiness_schedule_monitor();
  v_document_result := private.vorta_run_document_ingestion_health_monitor();

  return jsonb_build_object(
    'operationalMonitoring', v_operational_result,
    'schedulerMonitoring', v_scheduler_result,
    'recoveryMonitoring', v_recovery_result,
    'pilotReadinessMonitoring', v_pilot_readiness_result,
    'documentKnowledgeMonitoring', v_document_result,
    'completedAt', now()
  );
end;
$function$;