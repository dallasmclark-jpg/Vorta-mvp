-- VOR-060: wrap the existing knowledge-quality suite with independent document
-- evidence checks. The original suite remains intact as a service-role-only base.

begin;

do $block$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'vorta_run_knowledge_quality_suite_base_vor060'
      and pg_get_function_identity_arguments(p.oid) = 'p_anchor_date date'
  ) then
    alter function public.vorta_run_knowledge_quality_suite(date)
      rename to vorta_run_knowledge_quality_suite_base_vor060;
  end if;
end;
$block$;

revoke all on function public.vorta_run_knowledge_quality_suite_base_vor060(date)
  from public, anon, authenticated;
grant execute on function public.vorta_run_knowledge_quality_suite_base_vor060(date)
  to service_role;

create or replace function public.vorta_run_knowledge_quality_suite(
  p_anchor_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_result jsonb;
  v_run_id uuid;
  v_site_id uuid;
  v_health jsonb;
  v_summary jsonb;
  v_passed integer;
  v_failed integer;
  v_warned integer;
  v_checks integer;
  v_suite_version text;
  v_failures jsonb;
  v_warning_details jsonb;
  v_alert record;
  v_role text := current_setting('request.jwt.claim.role', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
begin
  v_result := public.vorta_run_knowledge_quality_suite_base_vor060(p_anchor_date);
  v_run_id := nullif(v_result ->> 'runId', '')::uuid;
  v_site_id := nullif(v_result ->> 'siteId', '')::uuid;

  if v_run_id is null or v_site_id is null then
    raise exception 'VOR-060 could not resolve the knowledge-quality run or site';
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  v_health := public.vorta_get_document_ingestion_health(v_site_id);
  v_summary := coalesce(v_health -> 'summary', '{}'::jsonb);

  perform private.vorta_record_backend_health_result(
    v_run_id,
    400,
    'document_indexing_and_locator_completeness',
    'knowledge_integrity',
    case when
      coalesce((v_summary ->> 'indexedDocuments')::integer, -1)
        = coalesce((v_summary ->> 'approvedCurrentDocuments')::integer, -2)
      and coalesce((v_summary ->> 'documentsMissingLocator')::integer, 999) = 0
      then 'pass'
      else 'warn'
    end,
    'Every approved current document is indexed and retains a genuine document- or chunk-level locator',
    format(
      'not_indexed=%s, missing_locator=%s',
      greatest(
        coalesce((v_summary ->> 'approvedCurrentDocuments')::integer, 0)
          - coalesce((v_summary ->> 'indexedDocuments')::integer, 0),
        0
      ),
      coalesce(v_summary ->> 'documentsMissingLocator', 'null')
    ),
    null,
    'Generic Summary and Document summary labels are excluded; verified chunk page, section, drawing, sheet and external-reference locators count.'
  );

  perform private.vorta_record_backend_health_result(
    v_run_id,
    455,
    'document_chunk_coverage_integrity',
    'knowledge_integrity',
    case when
      coalesce((v_summary ->> 'documentsWithoutChunks')::integer, 999) = 0
      and coalesce((v_summary ->> 'documentsWithoutChunkText')::integer, 999) = 0
      and coalesce((v_summary ->> 'coverageMetadataConflicts')::integer, 999) = 0
      and coalesce((v_summary ->> 'unavailableDocuments')::integer, 999) = 0
      then 'pass'
      else 'fail'
    end,
    'Zero approved current documents without chunks or text, zero unavailable evidence and zero mixed coverage metadata',
    format(
      'withoutChunks=%s, withoutText=%s, unavailable=%s, coverageConflicts=%s, fullText=%s, summaryOnly=%s',
      coalesce(v_summary ->> 'documentsWithoutChunks', 'null'),
      coalesce(v_summary ->> 'documentsWithoutChunkText', 'null'),
      coalesce(v_summary ->> 'unavailableDocuments', 'null'),
      coalesce(v_summary ->> 'coverageMetadataConflicts', 'null'),
      coalesce(v_summary ->> 'fullTextDocuments', 'null'),
      coalesce(v_summary ->> 'summaryOnlyDocuments', 'null')
    ),
    null,
    'Coverage state is derived from stored chunk metadata; summary-only evidence remains allowed but explicit.'
  );

  perform private.vorta_record_backend_health_result(
    v_run_id,
    465,
    'document_source_reference_integrity',
    'knowledge_integrity',
    case when
      coalesce((v_summary ->> 'documentsMissingSource')::integer, 999) = 0
      and coalesce((v_summary ->> 'malformedSourceReferences')::integer, 999) = 0
      then 'pass'
      else 'fail'
    end,
    'Zero approved current documents with missing or structurally malformed source references',
    format(
      'missing=%s, malformed=%s, controlledInternal=%s, publicHttp=%s, publicHttpReachabilityChecked=%s',
      coalesce(v_summary ->> 'documentsMissingSource', 'null'),
      coalesce(v_summary ->> 'malformedSourceReferences', 'null'),
      coalesce(v_summary ->> 'controlledInternalReferences', 'null'),
      coalesce(v_summary ->> 'publicHttpReferences', 'null'),
      coalesce(v_summary ->> 'publicHttpReachabilityChecked', 'false')
    ),
    null,
    'Validates supported source-reference structure only. It does not claim unchecked HTTP reachability.'
  );

  perform private.vorta_record_backend_health_result(
    v_run_id,
    466,
    'document_revision_currency',
    'knowledge_integrity',
    case when
      coalesce((v_summary ->> 'duplicateCurrentRevisionGroups')::integer, 999) = 0
      and coalesce((v_summary ->> 'currentWithNewerApprovedRevision')::integer, 999) = 0
      and coalesce((v_summary ->> 'obsoleteCurrentStatusConflicts')::integer, 999) = 0
      then 'pass'
      else 'fail'
    end,
    'Zero duplicate-current groups, newer approved revisions behind current records or obsolete/current status conflicts',
    format(
      'duplicateCurrent=%s, currentWithNewerApproved=%s, obsoleteCurrent=%s',
      coalesce(v_summary ->> 'duplicateCurrentRevisionGroups', 'null'),
      coalesce(v_summary ->> 'currentWithNewerApprovedRevision', 'null'),
      coalesce(v_summary ->> 'obsoleteCurrentStatusConflicts', 'null')
    ),
    null,
    'Revision checks use approved source identity and verified effective/update dates; no revision value is inferred.'
  );

  perform private.vorta_record_backend_health_result(
    v_run_id,
    467,
    'document_equipment_relationship_integrity',
    'knowledge_integrity',
    case when
      coalesce((v_summary ->> 'orphanEquipmentLinks')::integer, 999) = 0
      and coalesce((v_summary ->> 'crossSiteEquipmentLinks')::integer, 999) = 0
      and coalesce((v_summary ->> 'chunkEquipmentRelationshipFailures')::integer, 999) = 0
      then 'pass'
      else 'fail'
    end,
    'Zero orphaned, cross-site or mismatched document/chunk equipment relationships',
    format(
      'orphan=%s, crossSite=%s, chunkRelationshipFailures=%s',
      coalesce(v_summary ->> 'orphanEquipmentLinks', 'null'),
      coalesce(v_summary ->> 'crossSiteEquipmentLinks', 'null'),
      coalesce(v_summary ->> 'chunkEquipmentRelationshipFailures', 'null')
    ),
    null,
    'Protects site and equipment evidence boundaries without changing any operational record.'
  );

  select
    count(*) filter (where status = 'pass'),
    count(*) filter (where status = 'fail'),
    count(*) filter (where status = 'warn')
  into v_passed, v_failed, v_warned
  from private.vorta_backend_health_results
  where run_id = v_run_id;

  v_checks := v_passed + v_failed + v_warned;

  select suite_version
  into v_suite_version
  from private.vorta_backend_health_runs
  where id = v_run_id;

  if coalesce(v_suite_version, '') not like '%vor060%' then
    v_suite_version := coalesce(v_suite_version, 'knowledge') || '+vor060';
  end if;

  update private.vorta_backend_health_runs
  set
    suite_version = v_suite_version,
    finished_at = now(),
    passed_count = v_passed,
    failed_count = v_failed,
    warning_count = v_warned,
    overall_status = case when v_failed > 0 then 'fail' else 'pass' end,
    notes = concat_ws(
      '; ',
      nullif(notes, ''),
      'VOR-060 permanent document evidence checks applied'
    )
  where id = v_run_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'checkKey', check_key,
        'category', category,
        'actual', actual,
        'detail', detail
      ) order by check_order
    ),
    '[]'::jsonb
  )
  into v_failures
  from private.vorta_backend_health_results
  where run_id = v_run_id
    and status = 'fail';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'checkKey', check_key,
        'category', category,
        'actual', actual,
        'detail', detail
      ) order by check_order
    ),
    '[]'::jsonb
  )
  into v_warning_details
  from private.vorta_backend_health_results
  where run_id = v_run_id
    and status = 'warn';

  if v_failed > 0 then
    select * into v_alert
    from private.vorta_open_or_update_system_health_alert(
      v_site_id,
      'backend:pilot_readiness',
      'Pilot backend readiness checks failed',
      format(
        '%s of %s checks failed after document evidence verification.',
        v_failed,
        v_checks
      ),
      'high',
      'Pilot Readiness Suite',
      jsonb_build_object(
        'runId', v_run_id,
        'suiteVersion', v_suite_version,
        'failed', v_failed,
        'documentHealth', v_health,
        'observedAt', now()
      )
    );
  else
    perform private.vorta_resolve_system_health_alert(
      v_site_id,
      'backend:pilot_readiness',
      jsonb_build_object(
        'recoveredAt', now(),
        'runId', v_run_id,
        'suiteVersion', v_suite_version
      )
    );
  end if;

  perform set_config('request.jwt.claim.role', coalesce(v_role, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);

  return v_result || jsonb_build_object(
    'suiteVersion', v_suite_version,
    'status', case when v_failed > 0 then 'fail' else 'pass' end,
    'checks', v_checks,
    'passed', v_passed,
    'failed', v_failed,
    'warnings', v_warned,
    'documentHealth', v_health,
    'failures', v_failures,
    'warningDetails', v_warning_details
  );
exception when others then
  perform set_config('request.jwt.claim.role', coalesce(v_role, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  raise;
end;
$function$;

revoke all on function public.vorta_run_knowledge_quality_suite(date)
  from public, anon, authenticated;
grant execute on function public.vorta_run_knowledge_quality_suite(date)
  to service_role;

commit;
