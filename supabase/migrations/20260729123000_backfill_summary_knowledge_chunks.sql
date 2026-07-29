-- VOR-021: make current summary evidence retrievable without pretending that a
-- full document has been chunked. Existing extracted summaries remain the source
-- of truth and each backfilled chunk is explicitly labelled summary-only.

with candidates as (
  select document.*
  from public.knowledge_documents document
  where document.is_current = true
    and nullif(btrim(coalesce(document.extracted_summary, document.summary, '')), '') is not null
    and not exists (
      select 1
      from public.knowledge_chunks chunk
      where chunk.document_id = document.id
    )
),
inserted as (
  insert into public.knowledge_chunks(
    id,
    document_id,
    equipment_id,
    chunk_ref,
    section_title,
    chunk_text,
    page_number,
    keywords,
    metadata,
    drawing_number,
    sheet_number,
    fault_codes,
    component_tags,
    source_url,
    external_reference
  )
  select
    gen_random_uuid(),
    document.id,
    document.equipment_id,
    'VORTA-SUMMARY-001',
    coalesce(
      nullif(btrim(document.manual_section), ''),
      'Document summary (summary-only coverage)'
    ),
    coalesce(document.extracted_summary, document.summary),
    document.page_number,
    array(
      select distinct token
      from unnest(
        array[
          'summary',
          'summary-only',
          lower(coalesce(document.document_type, 'document')),
          lower(coalesce(document.oem, ''))
        ]
        || coalesce(document.fault_codes, '{}'::text[])
        || coalesce(document.component_tags, '{}'::text[])
      ) token
      where nullif(btrim(token), '') is not null
    ),
    coalesce(document.metadata, '{}'::jsonb) || jsonb_build_object(
      'coverageMode', 'summary_only',
      'sourceField', case
        when nullif(btrim(coalesce(document.extracted_summary, '')), '') is not null
          then 'extracted_summary'
        else 'summary'
      end,
      'backfillVersion', 'VOR-021-2026-07-29',
      'fullDocumentIndexed', false
    ),
    document.drawing_number,
    document.sheet_number,
    coalesce(document.fault_codes, '{}'::text[]),
    coalesce(document.component_tags, '{}'::text[]),
    document.source_url,
    coalesce(document.external_reference, document.source_document_id)
  from candidates document
  on conflict (document_id, chunk_ref) do nothing
  returning document_id
)
update public.knowledge_documents document
set
  metadata = coalesce(document.metadata, '{}'::jsonb) || jsonb_build_object(
    'knowledgeCoverage', 'summary_only',
    'coverageVerifiedAt', now(),
    'fullDocumentIndexed', false
  ),
  last_indexed_at = now(),
  updated_at = now()
where document.id in (select inserted.document_id from inserted);

-- Existing documents with non-summary chunks are explicitly marked full-text.
update public.knowledge_documents document
set
  metadata = coalesce(document.metadata, '{}'::jsonb) || jsonb_build_object(
    'knowledgeCoverage', case
      when exists (
        select 1
        from public.knowledge_chunks chunk
        where chunk.document_id = document.id
          and chunk.metadata ->> 'coverageMode' = 'summary_only'
      )
      and not exists (
        select 1
        from public.knowledge_chunks chunk
        where chunk.document_id = document.id
          and coalesce(chunk.metadata ->> 'coverageMode', 'full_text') <> 'summary_only'
      )
        then 'summary_only'
      else 'full_text'
    end,
    'coverageVerifiedAt', now(),
    'fullDocumentIndexed', exists (
      select 1
      from public.knowledge_chunks chunk
      where chunk.document_id = document.id
        and coalesce(chunk.metadata ->> 'coverageMode', 'full_text') <> 'summary_only'
    )
  ),
  last_indexed_at = coalesce(document.last_indexed_at, now()),
  updated_at = now()
where document.is_current = true
  and exists (
    select 1
    from public.knowledge_chunks chunk
    where chunk.document_id = document.id
  );

comment on column public.knowledge_documents.metadata is
  'Document metadata including Vorta knowledgeCoverage: full_text or summary_only. Summary-only never implies the complete source was indexed.';
