-- VOR-021: expose honest document coverage semantics to authenticated live readers.
-- The functions remain security-invoker, site/equipment scoped and read-only.

begin;

revoke all on function public.vorta_get_equipment_documents(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vorta_get_equipment_document(uuid, uuid) from public, anon, authenticated, service_role;

drop function public.vorta_get_equipment_documents(uuid);
drop function public.vorta_get_equipment_document(uuid, uuid);

create function public.vorta_get_equipment_documents(p_equipment_id uuid)
returns table(
  document_id uuid,
  title text,
  document_type text,
  revision text,
  approval_status text,
  is_current boolean,
  effective_date date,
  owner_department text,
  summary text,
  source_system text,
  source_document_id text,
  source_path text,
  source_url text,
  file_id text,
  external_reference text,
  drawing_number text,
  sheet_number text,
  manual_section text,
  page_number integer,
  fault_codes text[],
  component_tags text[],
  oem text,
  status text,
  last_indexed_at timestamptz,
  updated_at timestamptz,
  chunk_count bigint,
  first_section_title text,
  first_page_number integer,
  coverage_mode text,
  full_document_indexed boolean,
  has_verified_locator boolean,
  coverage_reason text
)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  with accessible_equipment as (
    select equipment.id, equipment.site_id
    from public.equipment_assets equipment
    where equipment.id = p_equipment_id
  )
  select
    document.id as document_id,
    document.title,
    document.document_type,
    document.revision,
    document.approval_status,
    document.is_current,
    document.effective_date,
    document.owner_department,
    coalesce(document.extracted_summary, document.summary) as summary,
    document.source_system,
    document.source_document_id,
    document.source_path,
    document.source_url,
    document.file_id,
    document.external_reference,
    document.drawing_number,
    document.sheet_number,
    document.manual_section,
    document.page_number,
    document.fault_codes,
    document.component_tags,
    document.oem,
    document.status,
    document.last_indexed_at,
    document.updated_at,
    coalesce(chunk_evidence.chunk_count, 0) as chunk_count,
    chunk_evidence.first_section_title,
    chunk_evidence.first_page_number,
    case
      when coalesce(chunk_evidence.chunk_count, 0) = 0 then 'unavailable'
      when coalesce(chunk_evidence.summary_only, false) then 'summary_only'
      else 'full_text'
    end as coverage_mode,
    coalesce(chunk_evidence.chunk_count, 0) > 0
      and not coalesce(chunk_evidence.summary_only, false) as full_document_indexed,
    (
      coalesce(chunk_evidence.has_verified_locator, false)
      or document.page_number is not null
      or nullif(btrim(document.manual_section), '') is not null
      or nullif(btrim(document.drawing_number), '') is not null
      or nullif(btrim(document.sheet_number), '') is not null
      or nullif(btrim(document.external_reference), '') is not null
    ) as has_verified_locator,
    case
      when coalesce(chunk_evidence.chunk_count, 0) = 0
        then 'No authorised evidence chunks are indexed for this document.'
      when coalesce(chunk_evidence.summary_only, false)
        then 'Only the approved document summary is indexed; the full source text is not indexed.'
      else 'Approved full-text evidence sections are indexed and citation-ready.'
    end as coverage_reason
  from accessible_equipment equipment
  join public.knowledge_documents document
    on document.equipment_id = equipment.id
    or (document.equipment_id is null and document.site_id = equipment.site_id)
  left join lateral (
    select
      count(*) as chunk_count,
      (array_agg(chunk.section_title order by chunk.page_number nulls last, chunk.chunk_ref))[1] as first_section_title,
      (array_agg(chunk.page_number order by chunk.page_number nulls last, chunk.chunk_ref))[1] as first_page_number,
      coalesce(
        bool_or(
          lower(coalesce(chunk.metadata ->> 'coverageMode', '')) = 'summary_only'
          or lower(coalesce(chunk.metadata ->> 'fullDocumentIndexed', 'true')) = 'false'
        ),
        false
      ) as summary_only,
      coalesce(
        bool_or(
          chunk.page_number is not null
          or nullif(btrim(chunk.drawing_number), '') is not null
          or nullif(btrim(chunk.sheet_number), '') is not null
          or nullif(btrim(chunk.external_reference), '') is not null
          or (
            nullif(btrim(chunk.section_title), '') is not null
            and lower(btrim(chunk.section_title)) not in ('summary', 'document summary', 'document summary (summary-only coverage)')
            and lower(btrim(chunk.section_title)) not like '%summary-only coverage%'
          )
        ),
        false
      ) as has_verified_locator
    from public.knowledge_chunks chunk
    where chunk.document_id = document.id
      and (chunk.equipment_id is null or chunk.equipment_id = equipment.id)
  ) chunk_evidence on true
  order by
    document.is_current desc,
    document.effective_date desc nulls last,
    document.updated_at desc,
    document.title;
$function$;

create function public.vorta_get_equipment_document(p_equipment_id uuid, p_document_id uuid)
returns table(
  document_id uuid,
  title text,
  document_type text,
  revision text,
  approval_status text,
  is_current boolean,
  effective_date date,
  owner_department text,
  summary text,
  source_system text,
  source_document_id text,
  source_path text,
  source_url text,
  file_id text,
  external_reference text,
  drawing_number text,
  sheet_number text,
  manual_section text,
  page_number integer,
  fault_codes text[],
  component_tags text[],
  oem text,
  status text,
  last_indexed_at timestamptz,
  updated_at timestamptz,
  coverage_mode text,
  full_document_indexed boolean,
  has_verified_locator boolean,
  coverage_reason text,
  chunks jsonb
)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  with accessible_equipment as (
    select equipment.id, equipment.site_id
    from public.equipment_assets equipment
    where equipment.id = p_equipment_id
  )
  select
    document.id as document_id,
    document.title,
    document.document_type,
    document.revision,
    document.approval_status,
    document.is_current,
    document.effective_date,
    document.owner_department,
    coalesce(document.extracted_summary, document.summary) as summary,
    document.source_system,
    document.source_document_id,
    document.source_path,
    document.source_url,
    document.file_id,
    document.external_reference,
    document.drawing_number,
    document.sheet_number,
    document.manual_section,
    document.page_number,
    document.fault_codes,
    document.component_tags,
    document.oem,
    document.status,
    document.last_indexed_at,
    document.updated_at,
    case
      when coalesce(chunk_evidence.chunk_count, 0) = 0 then 'unavailable'
      when coalesce(chunk_evidence.summary_only, false) then 'summary_only'
      else 'full_text'
    end as coverage_mode,
    coalesce(chunk_evidence.chunk_count, 0) > 0
      and not coalesce(chunk_evidence.summary_only, false) as full_document_indexed,
    (
      coalesce(chunk_evidence.has_verified_locator, false)
      or document.page_number is not null
      or nullif(btrim(document.manual_section), '') is not null
      or nullif(btrim(document.drawing_number), '') is not null
      or nullif(btrim(document.sheet_number), '') is not null
      or nullif(btrim(document.external_reference), '') is not null
    ) as has_verified_locator,
    case
      when coalesce(chunk_evidence.chunk_count, 0) = 0
        then 'No authorised evidence chunks are indexed for this document.'
      when coalesce(chunk_evidence.summary_only, false)
        then 'Only the approved document summary is indexed; the full source text is not indexed.'
      else 'Approved full-text evidence sections are indexed and citation-ready.'
    end as coverage_reason,
    coalesce(chunk_evidence.items, '[]'::jsonb) as chunks
  from accessible_equipment equipment
  join public.knowledge_documents document
    on document.id = p_document_id
   and (
     document.equipment_id = equipment.id
     or (document.equipment_id is null and document.site_id = equipment.site_id)
   )
  left join lateral (
    select
      count(*) as chunk_count,
      coalesce(
        bool_or(
          lower(coalesce(chunk.metadata ->> 'coverageMode', '')) = 'summary_only'
          or lower(coalesce(chunk.metadata ->> 'fullDocumentIndexed', 'true')) = 'false'
        ),
        false
      ) as summary_only,
      coalesce(
        bool_or(
          chunk.page_number is not null
          or nullif(btrim(chunk.drawing_number), '') is not null
          or nullif(btrim(chunk.sheet_number), '') is not null
          or nullif(btrim(chunk.external_reference), '') is not null
          or (
            nullif(btrim(chunk.section_title), '') is not null
            and lower(btrim(chunk.section_title)) not in ('summary', 'document summary', 'document summary (summary-only coverage)')
            and lower(btrim(chunk.section_title)) not like '%summary-only coverage%'
          )
        ),
        false
      ) as has_verified_locator,
      jsonb_agg(
        jsonb_build_object(
          'id', chunk.id,
          'reference', chunk.chunk_ref,
          'sectionTitle', chunk.section_title,
          'text', chunk.chunk_text,
          'pageNumber', chunk.page_number,
          'keywords', chunk.keywords,
          'drawingNumber', chunk.drawing_number,
          'sheetNumber', chunk.sheet_number,
          'faultCodes', chunk.fault_codes,
          'componentTags', chunk.component_tags,
          'sourceUrl', chunk.source_url,
          'externalReference', chunk.external_reference,
          'coverageMode', coalesce(chunk.metadata ->> 'coverageMode', 'full_text'),
          'fullDocumentIndexed', coalesce((chunk.metadata ->> 'fullDocumentIndexed')::boolean, true)
        )
        order by chunk.page_number nulls last, chunk.chunk_ref
      ) as items
    from public.knowledge_chunks chunk
    where chunk.document_id = document.id
      and (chunk.equipment_id is null or chunk.equipment_id = equipment.id)
  ) chunk_evidence on true;
$function$;

revoke all on function public.vorta_get_equipment_documents(uuid) from public, anon;
revoke all on function public.vorta_get_equipment_document(uuid, uuid) from public, anon;
grant execute on function public.vorta_get_equipment_documents(uuid) to authenticated, service_role;
grant execute on function public.vorta_get_equipment_document(uuid, uuid) to authenticated, service_role;

commit;
