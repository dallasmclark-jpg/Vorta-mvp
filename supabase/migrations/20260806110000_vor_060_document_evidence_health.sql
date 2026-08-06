-- VOR-060: strengthen the existing document evidence health authority.
-- This remains site scoped, read only and fail closed. Public HTTP references
-- are structurally validated but are never described as reachable unless a
-- separate network check has actually been performed.

begin;

create or replace function public.vorta_get_document_ingestion_health(p_site_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_result jsonb;
begin
  if not public.vorta_can_manage_site(p_site_id) then
    return null;
  end if;

  with approved_docs as (
    select
      d.*,
      e.site_id as equipment_site_id,
      e.equipment_code,
      e.name as equipment_name,
      coalesce(r.risk_score, 0) as equipment_risk_score,
      lower(regexp_replace(coalesce(nullif(d.source_document_id, ''), d.title), '\s+', '', 'g')) as revision_key,
      coalesce(
        nullif(btrim(d.source_url), ''),
        nullif(btrim(d.external_reference), ''),
        nullif(btrim(d.source_path), ''),
        nullif(btrim(d.source_document_id), '')
      ) as source_reference
    from public.knowledge_documents d
    left join public.equipment_assets e on e.id = d.equipment_id
    left join public.equipment_risk_profiles r on r.equipment_id = d.equipment_id
    where d.site_id = p_site_id
      and lower(coalesce(d.approval_status, '')) in ('approved', 'current')
  ),
  chunk_health as (
    select
      c.document_id,
      count(*)::integer as chunk_count,
      count(*) filter (
        where nullif(btrim(c.chunk_text), '') is not null
      )::integer as non_empty_chunk_count,
      count(*) filter (
        where lower(coalesce(c.metadata ->> 'coverageMode', '')) = 'summary_only'
           or lower(coalesce(c.metadata ->> 'fullDocumentIndexed', 'true')) = 'false'
      )::integer as summary_marker_count,
      count(*) filter (
        where not (
          lower(coalesce(c.metadata ->> 'coverageMode', '')) = 'summary_only'
          or lower(coalesce(c.metadata ->> 'fullDocumentIndexed', 'true')) = 'false'
        )
      )::integer as full_marker_count,
      bool_or(
        c.page_number is not null
        or nullif(btrim(c.drawing_number), '') is not null
        or nullif(btrim(c.sheet_number), '') is not null
        or nullif(btrim(c.external_reference), '') is not null
        or (
          nullif(btrim(c.section_title), '') is not null
          and lower(btrim(c.section_title)) not in (
            'summary',
            'document summary',
            'document summary (summary-only coverage)'
          )
          and lower(btrim(c.section_title)) not like '%summary-only coverage%'
        )
      ) as has_genuine_locator,
      count(*) filter (
        where c.equipment_id is not null
          and d.equipment_id is not null
          and c.equipment_id <> d.equipment_id
      )::integer as chunk_equipment_mismatch_count,
      count(*) filter (
        where c.equipment_id is not null
          and (ce.id is null or ce.site_id <> d.site_id)
      )::integer as chunk_site_mismatch_count
    from public.knowledge_chunks c
    join approved_docs d on d.id = c.document_id
    left join public.equipment_assets ce on ce.id = c.equipment_id
    group by c.document_id
  ),
  revision_groups as (
    select
      revision_key,
      count(*) filter (where is_current)::integer as current_count,
      max(coalesce(effective_date, updated_at::date)) filter (
        where is_current
      ) as latest_current_date,
      max(coalesce(effective_date, updated_at::date)) as latest_approved_date
    from approved_docs
    group by revision_key
  ),
  docs as (
    select
      d.*,
      coalesce(ch.chunk_count, 0) as chunk_count,
      coalesce(ch.non_empty_chunk_count, 0) as non_empty_chunk_count,
      coalesce(ch.summary_marker_count, 0) as summary_marker_count,
      coalesce(ch.full_marker_count, 0) as full_marker_count,
      coalesce(ch.has_genuine_locator, false)
        or d.page_number is not null
        or nullif(btrim(d.drawing_number), '') is not null
        or nullif(btrim(d.sheet_number), '') is not null
        or (
          nullif(btrim(d.manual_section), '') is not null
          and lower(btrim(d.manual_section)) not in (
            'summary',
            'document summary',
            'document summary (summary-only coverage)'
          )
          and lower(btrim(d.manual_section)) not like '%summary-only coverage%'
        )
        or nullif(btrim(d.external_reference), '') is not null as has_genuine_locator,
      coalesce(ch.chunk_equipment_mismatch_count, 0) as chunk_equipment_mismatch_count,
      coalesce(ch.chunk_site_mismatch_count, 0) as chunk_site_mismatch_count,
      case
        when coalesce(ch.chunk_count, 0) = 0 then 'unavailable'
        when coalesce(ch.summary_marker_count, 0) > 0 then 'summary_only'
        else 'full_text'
      end as coverage_mode,
      coalesce(ch.summary_marker_count, 0) > 0
        and coalesce(ch.full_marker_count, 0) > 0 as coverage_metadata_conflict,
      case
        when d.source_reference ~* '^https?://[^/[:space:]]+(/[^[:space:]]*)?$'
          then 'public_http'
        when d.source_reference ~* '^(easidoc-demo|ilearn-demo|sap-demo)://[^[:space:]]+$'
          then 'controlled_internal'
        when d.source_reference ~* '^/equipment/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/documents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\?[^[:space:]]*)?$'
          then 'controlled_internal'
        else 'malformed'
      end as source_reference_kind,
      rg.current_count,
      rg.latest_current_date,
      rg.latest_approved_date
    from approved_docs d
    left join chunk_health ch on ch.document_id = d.id
    left join revision_groups rg on rg.revision_key = d.revision_key
  ),
  current_docs as (
    select * from docs where is_current
  ),
  equipment_without_docs as (
    select
      e.id,
      e.equipment_code,
      e.name,
      coalesce(r.risk_score, 0) as risk_score
    from public.equipment_assets e
    left join public.equipment_risk_profiles r on r.equipment_id = e.id
    where e.site_id = p_site_id
      and not exists (
        select 1
        from current_docs d
        where d.equipment_id = e.id
      )
  ),
  issues as (
    select
      'DOCUMENT_MISSING_SOURCE'::text as issue_type,
      'fail'::text as severity,
      d.id as document_id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      'Approved current document has no usable source reference.'::text as detail
    from current_docs d
    where d.source_reference is null

    union all
    select
      'DOCUMENT_SOURCE_REFERENCE_MALFORMED',
      'fail',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      'Source reference uses an unsupported or structurally invalid scheme/path. Network reachability was not inferred.'
    from current_docs d
    where d.source_reference is not null
      and d.source_reference_kind = 'malformed'

    union all
    select
      'DOCUMENT_HAS_NO_CHUNKS',
      'fail',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      'Approved current document has no authorised evidence chunks.'
    from current_docs d
    where d.chunk_count = 0

    union all
    select
      'DOCUMENT_HAS_NO_CHUNK_TEXT',
      'fail',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      'Approved current document has chunks but none contain non-empty evidence text.'
    from current_docs d
    where d.chunk_count > 0
      and d.non_empty_chunk_count = 0

    union all
    select
      'DOCUMENT_NOT_INDEXED',
      'fail',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      'Approved current document has no completed indexing timestamp.'
    from current_docs d
    where d.last_indexed_at is null

    union all
    select
      'DOCUMENT_COVERAGE_METADATA_CONFLICT',
      'fail',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      'Evidence chunks mix summary-only and full-text coverage semantics.'
    from current_docs d
    where d.coverage_metadata_conflict

    union all
    select
      'DOCUMENT_LOCATOR_MISSING',
      'warn',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      'Document has no genuine page, drawing, sheet, section or external reference locator. Generic summary labels are excluded.'
    from current_docs d
    where not d.has_genuine_locator

    union all
    select
      'DOCUMENT_DUPLICATE_CURRENT_REVISION',
      'fail',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      format('Source identity has %s approved records marked current.', d.current_count)
    from current_docs d
    where d.current_count > 1

    union all
    select
      'DOCUMENT_CURRENT_HAS_NEWER_APPROVED_REVISION',
      'fail',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      'Document is marked current although a newer approved revision/date exists.'
    from current_docs d
    where d.latest_approved_date > coalesce(d.effective_date, d.updated_at::date)

    union all
    select
      'DOCUMENT_CURRENT_STATUS_CONFLICT',
      'fail',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      'Document is marked current while its status indicates obsolete or superseded.'
    from current_docs d
    where lower(coalesce(d.status, '')) ~ '(obsolete|superseded|withdrawn|retired)'

    union all
    select
      'DOCUMENT_NONCURRENT_STATUS_CONFLICT',
      'warn',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      'Approved document is not current while its status still claims current/active control.'
    from docs d
    where not d.is_current
      and lower(coalesce(d.status, '')) ~ '(current|active|approved)'

    union all
    select
      'DOCUMENT_EQUIPMENT_ORPHANED',
      'fail',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      'Document references an equipment identifier that does not exist.'
    from current_docs d
    where d.equipment_id is not null
      and d.equipment_site_id is null

    union all
    select
      'DOCUMENT_EQUIPMENT_SITE_MISMATCH',
      'fail',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      'Document site does not match the linked equipment site.'
    from current_docs d
    where d.equipment_id is not null
      and d.equipment_site_id is distinct from d.site_id

    union all
    select
      'DOCUMENT_CHUNK_EQUIPMENT_MISMATCH',
      'fail',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      format('%s evidence chunks reference a different equipment record.', d.chunk_equipment_mismatch_count)
    from current_docs d
    where d.chunk_equipment_mismatch_count > 0

    union all
    select
      'DOCUMENT_CHUNK_SITE_MISMATCH',
      'fail',
      d.id,
      d.equipment_id,
      d.title,
      d.equipment_code,
      format('%s evidence chunks reference missing or cross-site equipment.', d.chunk_site_mismatch_count)
    from current_docs d
    where d.chunk_site_mismatch_count > 0

    union all
    select
      'HIGH_RISK_EQUIPMENT_WITHOUT_DOCUMENTS',
      'warn',
      null::uuid,
      e.id,
      e.name,
      e.equipment_code,
      format('Equipment risk score %s has no approved current supporting document.', e.risk_score)
    from equipment_without_docs e
    where e.risk_score >= 50
  )
  select jsonb_build_object(
    'siteId', p_site_id,
    'generatedAt', now(),
    'status', case
      when count(*) filter (where severity = 'fail') > 0 then 'fail'
      when count(*) filter (where severity = 'warn') > 0 then 'warn'
      else 'pass'
    end,
    'summary', jsonb_build_object(
      'totalDocuments', (select count(*) from docs),
      'approvedCurrentDocuments', (select count(*) from current_docs),
      'currentDocuments', (select count(*) from current_docs),
      'indexedDocuments', (
        select count(*) from current_docs where last_indexed_at is not null
      ),
      'documentsWithoutChunks', (
        select count(*) from current_docs where chunk_count = 0
      ),
      'documentsWithoutChunkText', (
        select count(*)
        from current_docs
        where chunk_count > 0 and non_empty_chunk_count = 0
      ),
      'documentsMissingSource', (
        select count(*) from current_docs where source_reference is null
      ),
      'malformedSourceReferences', (
        select count(*)
        from current_docs
        where source_reference is not null and source_reference_kind = 'malformed'
      ),
      'publicHttpReferences', (
        select count(*) from current_docs where source_reference_kind = 'public_http'
      ),
      'publicHttpReachabilityChecked', false,
      'controlledInternalReferences', (
        select count(*)
        from current_docs
        where source_reference_kind = 'controlled_internal'
      ),
      'documentsMissingLocator', (
        select count(*) from current_docs where not has_genuine_locator
      ),
      'fullTextDocuments', (
        select count(*) from current_docs where coverage_mode = 'full_text'
      ),
      'summaryOnlyDocuments', (
        select count(*) from current_docs where coverage_mode = 'summary_only'
      ),
      'unavailableDocuments', (
        select count(*) from current_docs where coverage_mode = 'unavailable'
      ),
      'coverageMetadataConflicts', (
        select count(*) from current_docs where coverage_metadata_conflict
      ),
      'duplicateCurrentRevisionGroups', (
        select count(*) from revision_groups where current_count > 1
      ),
      'currentWithNewerApprovedRevision', (
        select count(*)
        from current_docs
        where latest_approved_date > coalesce(effective_date, updated_at::date)
      ),
      'obsoleteCurrentStatusConflicts', (
        select count(*)
        from current_docs
        where lower(coalesce(status, '')) ~ '(obsolete|superseded|withdrawn|retired)'
      ),
      'orphanEquipmentLinks', (
        select count(*)
        from current_docs
        where equipment_id is not null and equipment_site_id is null
      ),
      'crossSiteEquipmentLinks', (
        select count(*)
        from current_docs
        where equipment_id is not null and equipment_site_id is distinct from site_id
      ),
      'chunkEquipmentRelationshipFailures', (
        select coalesce(
          sum(chunk_equipment_mismatch_count + chunk_site_mismatch_count),
          0
        )
        from current_docs
      ),
      'equipmentWithoutDocuments', (select count(*) from equipment_without_docs),
      'highRiskEquipmentWithoutDocuments', (
        select count(*)
        from equipment_without_docs
        where risk_score >= 50
      ),
      'hardFailureCount', count(*) filter (where severity = 'fail'),
      'warningCount', count(*) filter (where severity = 'warn')
    ),
    'issues', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', issue_type,
          'severity', severity,
          'documentId', document_id,
          'equipmentId', equipment_id,
          'equipmentCode', equipment_code,
          'title', title,
          'detail', detail
        ) order by severity, issue_type, equipment_code, title
      ) filter (where issue_type is not null),
      '[]'::jsonb
    )
  ) into v_result
  from issues;

  return v_result;
end;
$function$;

revoke all on function public.vorta_get_document_ingestion_health(uuid)
  from public, anon;
grant execute on function public.vorta_get_document_ingestion_health(uuid)
  to authenticated, service_role;

create or replace function private.vorta_run_document_ingestion_health_monitor()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
  v_report jsonb;
  v_summary jsonb;
  v_failures integer;
  v_warnings integer;
  v_high integer;
  v_alert record;
  v_opened integer := 0;
  v_updated integer := 0;
  v_resolved integer := 0;
  v_role text := current_setting('request.jwt.claim.role', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);

  v_report := public.vorta_get_document_ingestion_health(v_site_id);
  v_summary := coalesce(v_report -> 'summary', '{}'::jsonb);

  perform set_config('request.jwt.claim.role', coalesce(v_role, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);

  v_failures := coalesce((v_summary ->> 'hardFailureCount')::integer, 999);
  v_warnings := coalesce((v_summary ->> 'warningCount')::integer, 999);
  v_high := coalesce(
    (v_summary ->> 'highRiskEquipmentWithoutDocuments')::integer,
    999
  );

  if v_failures > 0 or v_high > 0 then
    select * into v_alert
    from private.vorta_open_or_update_system_health_alert(
      v_site_id,
      'knowledge:document_ingestion',
      'Document knowledge ingestion requires attention',
      format(
        '%s hard evidence failures, %s warnings and %s high-risk assets without approved current documents.',
        v_failures,
        v_warnings,
        v_high
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
    'status', v_report ->> 'status',
    'hardFailures', v_failures,
    'warnings', v_warnings,
    'highRiskEquipmentWithoutDocuments', v_high,
    'coverage', jsonb_build_object(
      'fullText', coalesce((v_summary ->> 'fullTextDocuments')::integer, 0),
      'summaryOnly', coalesce((v_summary ->> 'summaryOnlyDocuments')::integer, 0),
      'unavailable', coalesce((v_summary ->> 'unavailableDocuments')::integer, 0)
    ),
    'openedIncidents', v_opened,
    'updatedIncidents', v_updated,
    'resolvedIncidents', v_resolved
  );
exception when others then
  perform set_config('request.jwt.claim.role', coalesce(v_role, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  raise;
end;
$function$;

revoke all on function private.vorta_run_document_ingestion_health_monitor()
  from public, anon, authenticated;
grant execute on function private.vorta_run_document_ingestion_health_monitor()
  to service_role;

commit;
