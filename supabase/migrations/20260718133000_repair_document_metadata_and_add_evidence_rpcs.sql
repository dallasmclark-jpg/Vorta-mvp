with chunk_evidence as (
  select
    document.id as document_id,
    max(chunk.updated_at) as indexed_at,
    min(chunk.page_number) filter (where chunk.page_number is not null) as first_page,
    (array_agg(
      nullif(btrim(chunk.section_title), '')
      order by chunk.page_number nulls last, chunk.chunk_ref, chunk.id
    ) filter (where nullif(btrim(chunk.section_title), '') is not null))[1] as first_section
  from public.knowledge_documents document
  join public.knowledge_chunks chunk on chunk.document_id = document.id
  where document.site_id = '11000000-0000-0000-0000-000000000001'::uuid
    and document.is_current
    and document.last_indexed_at is null
  group by document.id
)
update public.knowledge_documents document
set
  last_indexed_at = evidence.indexed_at,
  page_number = coalesce(document.page_number, evidence.first_page),
  manual_section = coalesce(nullif(btrim(document.manual_section), ''), evidence.first_section),
  external_reference = coalesce(nullif(btrim(document.external_reference), ''), document.source_document_id),
  updated_at = now()
from chunk_evidence evidence
where document.id = evidence.document_id;

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

  with docs as (
    select
      document.*,
      equipment.equipment_code,
      equipment.name as equipment_name,
      coalesce(risk.risk_score, 0) as equipment_risk_score,
      (
        select count(*)::integer
        from public.knowledge_chunks chunk
        where chunk.document_id = document.id
      ) as chunk_count
    from public.knowledge_documents document
    left join public.equipment_assets equipment on equipment.id = document.equipment_id
    left join public.equipment_risk_profiles risk on risk.equipment_id = document.equipment_id
    where document.site_id = p_site_id
  ),
  equipment_without_docs as (
    select
      equipment.id,
      equipment.equipment_code,
      equipment.name,
      coalesce(risk.risk_score, 0) as risk_score
    from public.equipment_assets equipment
    left join public.equipment_risk_profiles risk on risk.equipment_id = equipment.id
    where equipment.site_id = p_site_id
      and not exists (
        select 1
        from docs document
        where document.equipment_id = equipment.id
          and document.is_current
      )
  ),
  issues as (
    select
      'DOCUMENT_MISSING_SOURCE'::text as issue_type,
      'fail'::text as severity,
      document.id as document_id,
      document.equipment_id,
      document.title,
      document.equipment_code,
      'Current document has no source URL.'::text as detail
    from docs document
    where document.is_current
      and nullif(btrim(document.source_url), '') is null

    union all

    select
      'DOCUMENT_HAS_NO_CHUNKS', 'fail', document.id, document.equipment_id,
      document.title, document.equipment_code,
      'Current document has no searchable knowledge chunks.'
    from docs document
    where document.is_current
      and document.chunk_count = 0

    union all

    select
      'DOCUMENT_NOT_INDEXED', 'fail', document.id, document.equipment_id,
      document.title, document.equipment_code,
      'Current document has no completed indexing timestamp.'
    from docs document
    where document.is_current
      and document.last_indexed_at is null

    union all

    select
      'DOCUMENT_LOCATOR_MISSING', 'warn', document.id, document.equipment_id,
      document.title, document.equipment_code,
      'Document has no page, drawing, section or external source locator.'
    from docs document
    where document.is_current
      and document.page_number is null
      and nullif(btrim(document.drawing_number), '') is null
      and nullif(btrim(document.manual_section), '') is null
      and nullif(btrim(document.external_reference), '') is null

    union all

    select
      'HIGH_RISK_EQUIPMENT_WITHOUT_DOCUMENTS', 'warn', null::uuid, equipment.id,
      equipment.name, equipment.equipment_code,
      format('Equipment risk score %s has no current supporting document.', equipment.risk_score)
    from equipment_without_docs equipment
    where equipment.risk_score >= 50
  )
  select jsonb_build_object(
    'siteId', p_site_id,
    'generatedAt', now(),
    'status', case
      when count(*) filter (where issue.severity = 'fail') > 0 then 'fail'
      when count(*) filter (where issue.severity = 'warn') > 0 then 'warn'
      else 'pass'
    end,
    'summary', jsonb_build_object(
      'totalDocuments', (select count(*) from docs),
      'currentDocuments', (select count(*) from docs where is_current),
      'indexedDocuments', (select count(*) from docs where is_current and last_indexed_at is not null),
      'documentsWithoutChunks', (select count(*) from docs where is_current and chunk_count = 0),
      'documentsMissingSource', (select count(*) from docs where is_current and nullif(btrim(source_url), '') is null),
      'documentsMissingLocator', (
        select count(*)
        from docs
        where is_current
          and page_number is null
          and nullif(btrim(drawing_number), '') is null
          and nullif(btrim(manual_section), '') is null
          and nullif(btrim(external_reference), '') is null
      ),
      'equipmentWithoutDocuments', (select count(*) from equipment_without_docs),
      'highRiskEquipmentWithoutDocuments', (select count(*) from equipment_without_docs where risk_score >= 50),
      'hardFailureCount', count(*) filter (where issue.severity = 'fail'),
      'warningCount', count(*) filter (where issue.severity = 'warn')
    ),
    'issues', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', issue.issue_type,
          'severity', issue.severity,
          'documentId', issue.document_id,
          'equipmentId', issue.equipment_id,
          'equipmentCode', issue.equipment_code,
          'title', issue.title,
          'detail', issue.detail
        )
        order by issue.severity, issue.issue_type, issue.equipment_code
      ) filter (where issue.issue_type is not null),
      '[]'::jsonb
    )
  )
  into v_result
  from issues issue;

  return v_result;
end;
$function$;

revoke all on function public.vorta_get_document_ingestion_health(uuid) from public;
revoke all on function public.vorta_get_document_ingestion_health(uuid) from anon;
grant execute on function public.vorta_get_document_ingestion_health(uuid) to authenticated;
grant execute on function public.vorta_get_document_ingestion_health(uuid) to service_role;

comment on function public.vorta_get_document_ingestion_health(uuid) is
  'Returns access-controlled document ingestion, source, locator and equipment coverage health for a site.';

create or replace function public.vorta_get_ask_vorta_evidence(
  p_equipment_id uuid,
  p_query text,
  p_limit integer default 5
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_site_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 20);
  v_result jsonb;
begin
  select equipment.site_id
  into v_site_id
  from public.equipment_assets equipment
  where equipment.id = p_equipment_id;

  if v_site_id is null or not public.vorta_has_site_access(v_site_id, false) then
    return null;
  end if;

  with evidence_rows as (
    select *
    from public.vorta_search_equipment_knowledge(p_equipment_id, p_query, v_limit)
  )
  select jsonb_build_object(
    'equipmentId', p_equipment_id,
    'query', p_query,
    'supported', count(*) > 0,
    'policy', case when count(*) > 0 then 'EVIDENCE_AVAILABLE' else 'INSUFFICIENT_EVIDENCE' end,
    'evidenceCount', count(*),
    'topRank', max(evidence.rank),
    'evidence', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'chunkId', evidence.chunk_id,
          'documentId', evidence.document_id,
          'title', evidence.title,
          'documentType', evidence.document_type,
          'revision', evidence.revision,
          'sourceSystem', evidence.source_system,
          'sourceUrl', evidence.source_url,
          'sourceLocator', coalesce(
            case when evidence.page_number is not null then 'Page ' || evidence.page_number::text end,
            nullif(evidence.drawing_number, ''),
            nullif(evidence.external_reference, ''),
            nullif(evidence.chunk_ref, '')
          ),
          'chunkRef', evidence.chunk_ref,
          'sectionTitle', evidence.section_title,
          'pageNumber', evidence.page_number,
          'drawingNumber', evidence.drawing_number,
          'sheetNumber', evidence.sheet_number,
          'faultCodes', evidence.fault_codes,
          'componentTags', evidence.component_tags,
          'excerpt', left(evidence.chunk_text, 500),
          'rank', evidence.rank
        )
        order by evidence.rank desc, evidence.title, evidence.chunk_ref
      ) filter (where evidence.chunk_id is not null),
      '[]'::jsonb
    )
  )
  into v_result
  from evidence_rows evidence;

  return v_result;
end;
$function$;

revoke all on function public.vorta_get_ask_vorta_evidence(uuid, text, integer) from public;
revoke all on function public.vorta_get_ask_vorta_evidence(uuid, text, integer) from anon;
grant execute on function public.vorta_get_ask_vorta_evidence(uuid, text, integer) to authenticated;
grant execute on function public.vorta_get_ask_vorta_evidence(uuid, text, integer) to service_role;

comment on function public.vorta_get_ask_vorta_evidence(uuid, text, integer) is
  'Returns grounded document evidence for Ask Vorta or an explicit insufficient-evidence policy result.';