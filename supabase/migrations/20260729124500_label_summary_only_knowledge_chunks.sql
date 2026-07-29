-- VOR-021 follow-up for environments where summary chunks were already created.
update public.knowledge_chunks chunk
set
  section_title = case
    when chunk.section_title ilike '%summary-only%'
      then chunk.section_title
    when nullif(btrim(coalesce(chunk.section_title, '')), '') is not null
      then chunk.section_title || ' · summary-only coverage'
    else 'Document summary (summary-only coverage)'
  end,
  metadata = coalesce(chunk.metadata, '{}'::jsonb) || jsonb_build_object(
    'coverageMode', 'summary_only',
    'fullDocumentIndexed', false,
    'provenanceLabelVerifiedAt', now()
  )
where chunk.metadata ->> 'coverageMode' = 'summary_only';
