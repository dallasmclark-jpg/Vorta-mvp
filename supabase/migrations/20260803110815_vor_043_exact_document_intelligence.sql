drop function if exists public.vorta_search_equipment_knowledge(uuid, text, integer);
drop function if exists public.vorta_search_equipment_knowledge_internal(uuid, text, integer);

create function public.vorta_search_equipment_knowledge_internal(
  p_equipment_id uuid,
  p_query text,
  p_limit integer default 8
)
returns table(
  chunk_id uuid,
  document_id uuid,
  title text,
  document_type text,
  revision text,
  revision_status text,
  is_current boolean,
  document_status text,
  effective_date date,
  source_system text,
  source_path text,
  source_url text,
  source_link_status text,
  approval_status text,
  coverage_mode text,
  full_document_indexed boolean,
  chunk_ref text,
  section_title text,
  chunk_text text,
  verified_excerpt text,
  page_number integer,
  drawing_number text,
  sheet_number text,
  locator_status text,
  citation_label text,
  external_reference text,
  fault_codes text[],
  component_tags text[],
  last_indexed_at timestamptz,
  rank real
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with q as (
    select
      trim(coalesce(p_query, '')) as raw,
      websearch_to_tsquery('english', trim(coalesce(p_query, ''))) as tsq,
      coalesce(
        array_remove(
          array_remove(
            regexp_split_to_array(
              lower(regexp_replace(coalesce(p_query, ''), '[^a-zA-Z0-9\-]+', ' ', 'g')),
              '\s+'
            ),
            ''
          ),
          'the'
        ),
        '{}'::text[]
      ) as terms
  ),
  base as (
    select
      kc.id as chunk_id,
      kd.id as document_id,
      kd.title,
      kd.document_type,
      kd.revision,
      case
        when kd.is_current and kd.approval_status = 'Approved' then 'approved_current'
        when kd.approval_status = 'Approved' then 'approved_superseded'
        else 'not_approved'
      end as revision_status,
      kd.is_current,
      coalesce(kd.status, 'active') as document_status,
      kd.effective_date,
      kd.source_system,
      kd.source_path,
      coalesce(kc.source_url, kd.source_url) as source_url,
      case
        when nullif(btrim(coalesce(kc.source_url, kd.source_url, '')), '') is null then 'missing'
        when coalesce(kc.source_url, kd.source_url) ~* '^https?://' then 'web_link'
        when coalesce(kc.source_url, kd.source_url) like '/%' then 'vorta_route'
        else 'recorded_reference'
      end as source_link_status,
      kd.approval_status,
      coalesce(
        nullif(kc.metadata ->> 'coverageMode', ''),
        nullif(kd.metadata ->> 'knowledgeCoverage', ''),
        case
          when coalesce(kc.chunk_ref, '') = 'VORTA-SUMMARY-001' then 'summary_only'
          else 'full_text'
        end
      ) as coverage_mode,
      case
        when coalesce(
          nullif(kc.metadata ->> 'coverageMode', ''),
          nullif(kd.metadata ->> 'knowledgeCoverage', ''),
          case
            when coalesce(kc.chunk_ref, '') = 'VORTA-SUMMARY-001' then 'summary_only'
            else 'full_text'
          end
        ) = 'summary_only' then false
        when lower(coalesce(kd.metadata ->> 'fullDocumentIndexed', '')) = 'false' then false
        when lower(coalesce(kd.metadata ->> 'fullDocumentIndexed', '')) = 'true' then true
        else true
      end as full_document_indexed,
      kc.chunk_ref,
      nullif(btrim(kc.section_title), '') as section_title,
      kc.chunk_text,
      coalesce(kc.page_number, kd.page_number) as page_number,
      nullif(btrim(coalesce(kc.drawing_number, kd.drawing_number)), '') as drawing_number,
      nullif(btrim(coalesce(kc.sheet_number, kd.sheet_number)), '') as sheet_number,
      coalesce(kc.external_reference, kd.external_reference, kd.source_document_id) as external_reference,
      coalesce(nullif(kc.fault_codes, '{}'::text[]), kd.fault_codes, '{}'::text[]) as fault_codes,
      coalesce(nullif(kc.component_tags, '{}'::text[]), kd.component_tags, '{}'::text[]) as component_tags,
      kd.last_indexed_at,
      to_tsvector(
        'english',
        coalesce(kc.section_title, '') || ' ' ||
        coalesce(kc.chunk_text, '') || ' ' ||
        array_to_string(kc.keywords, ' ') || ' ' ||
        coalesce(kc.drawing_number, '') || ' ' ||
        coalesce(kd.drawing_number, '') || ' ' ||
        coalesce(kd.manual_section, '') || ' ' ||
        array_to_string(coalesce(kc.fault_codes, '{}'::text[]), ' ') || ' ' ||
        array_to_string(coalesce(kd.fault_codes, '{}'::text[]), ' ') || ' ' ||
        array_to_string(coalesce(kc.component_tags, '{}'::text[]), ' ') || ' ' ||
        array_to_string(coalesce(kd.component_tags, '{}'::text[]), ' ')
      ) as chunk_tsv,
      to_tsvector(
        'english',
        kd.title || ' ' ||
        kd.document_type || ' ' ||
        coalesce(kd.summary, '') || ' ' ||
        coalesce(kd.extracted_summary, '') || ' ' ||
        coalesce(kd.external_reference, '') || ' ' ||
        coalesce(kd.drawing_number, '') || ' ' ||
        coalesce(kd.manual_section, '')
      ) as doc_tsv,
      lower(
        kd.title || ' ' ||
        kd.document_type || ' ' ||
        coalesce(kd.summary, '') || ' ' ||
        coalesce(kd.extracted_summary, '') || ' ' ||
        coalesce(kd.external_reference, '') || ' ' ||
        coalesce(kd.drawing_number, '') || ' ' ||
        coalesce(kd.sheet_number, '') || ' ' ||
        coalesce(kd.manual_section, '') || ' ' ||
        coalesce(kc.section_title, '') || ' ' ||
        coalesce(kc.chunk_text, '') || ' ' ||
        coalesce(kc.drawing_number, '') || ' ' ||
        coalesce(kc.sheet_number, '') || ' ' ||
        array_to_string(kc.keywords, ' ') || ' ' ||
        array_to_string(coalesce(kd.fault_codes, '{}'::text[]), ' ') || ' ' ||
        array_to_string(coalesce(kc.fault_codes, '{}'::text[]), ' ') || ' ' ||
        array_to_string(coalesce(kd.component_tags, '{}'::text[]), ' ') || ' ' ||
        array_to_string(coalesce(kc.component_tags, '{}'::text[]), ' ')
      ) as haystack
    from public.knowledge_chunks kc
    join public.knowledge_documents kd on kd.id = kc.document_id
    where
      (kc.equipment_id = p_equipment_id or kd.equipment_id = p_equipment_id)
      and kd.is_current = true
      and kd.approval_status = 'Approved'
      and coalesce(kd.status, 'active') in ('active', 'review_due')
  ),
  scored as (
    select
      b.*,
      case
        when q.raw = '' then 0::real
        else (
          case when b.chunk_tsv @@ q.tsq then 2.0 else 0.0 end
          + case when b.doc_tsv @@ q.tsq then 1.0 else 0.0 end
          + coalesce((
              select count(*)::real * 0.35
              from unnest(q.terms) term
              where length(term) >= 2
                and b.haystack ilike '%' || term || '%'
            ), 0::real)
        )::real
      end as score
    from base b cross join q
    where
      q.raw = ''
      or b.chunk_tsv @@ q.tsq
      or b.doc_tsv @@ q.tsq
      or exists (
        select 1
        from unnest(q.terms) term
        where length(term) >= 2
          and b.haystack ilike '%' || term || '%'
      )
  )
  select
    s.chunk_id,
    s.document_id,
    s.title,
    s.document_type,
    s.revision,
    s.revision_status,
    s.is_current,
    s.document_status,
    s.effective_date,
    s.source_system,
    s.source_path,
    s.source_url,
    s.source_link_status,
    s.approval_status,
    s.coverage_mode,
    s.full_document_indexed,
    s.chunk_ref,
    s.section_title,
    s.chunk_text,
    left(
      case
        when s.coverage_mode = 'summary_only'
          then 'Stored document summary only; the full source text is not indexed. ' ||
            regexp_replace(btrim(coalesce(s.chunk_text, '')), '[[:space:]]+', ' ', 'g')
        else regexp_replace(btrim(coalesce(s.chunk_text, '')), '[[:space:]]+', ' ', 'g')
      end,
      900
    ) as verified_excerpt,
    s.page_number,
    s.drawing_number,
    s.sheet_number,
    case
      when s.coverage_mode = 'summary_only' and (
        s.drawing_number is not null
        or s.page_number is not null
        or (
          s.section_title is not null
          and s.section_title !~* 'summary-only coverage|^document summary'
        )
      ) then 'summary_only_with_recorded_locator'
      when s.coverage_mode = 'summary_only' then 'summary_only_no_verified_locator'
      when s.drawing_number is not null and s.page_number is not null then 'drawing_and_page'
      when s.drawing_number is not null then 'drawing'
      when s.page_number is not null and s.section_title is not null then 'page_and_section'
      when s.page_number is not null then 'page'
      when s.section_title is not null then 'section'
      else 'no_verified_locator'
    end as locator_status,
    concat_ws(
      ' · ',
      nullif(btrim(s.title), ''),
      case
        when nullif(btrim(coalesce(s.revision, '')), '') is null then null
        when btrim(s.revision) ~* '^(rev|revision)(\s|\.|:|$)' then btrim(s.revision)
        else 'Revision ' || btrim(s.revision)
      end,
      case when s.coverage_mode = 'summary_only' then 'Summary-only coverage' end,
      case when s.drawing_number is not null then 'Drawing ' || s.drawing_number end,
      case when s.sheet_number is not null then 'Sheet ' || s.sheet_number end,
      case
        when s.section_title is null then null
        when s.coverage_mode = 'summary_only'
          and s.section_title ~* 'summary-only coverage|^document summary' then null
        when s.section_title ~* '^(section|task|step|fault tree)(\s|\.|:|$)' then s.section_title
        else 'Section ' || s.section_title
      end,
      case when s.page_number is not null then 'Page ' || s.page_number::text end
    ) as citation_label,
    s.external_reference,
    s.fault_codes,
    s.component_tags,
    s.last_indexed_at,
    s.score as rank
  from scored s
  order by s.score desc, s.document_type, s.chunk_ref
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$function$;

create function public.vorta_search_equipment_knowledge(
  p_equipment_id uuid,
  p_query text,
  p_limit integer default 8
)
returns table(
  chunk_id uuid,
  document_id uuid,
  title text,
  document_type text,
  revision text,
  revision_status text,
  is_current boolean,
  document_status text,
  effective_date date,
  source_system text,
  source_path text,
  source_url text,
  source_link_status text,
  approval_status text,
  coverage_mode text,
  full_document_indexed boolean,
  chunk_ref text,
  section_title text,
  chunk_text text,
  verified_excerpt text,
  page_number integer,
  drawing_number text,
  sheet_number text,
  locator_status text,
  citation_label text,
  external_reference text,
  fault_codes text[],
  component_tags text[],
  last_indexed_at timestamptz,
  rank real
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_site_id uuid;
begin
  select equipment.site_id
  into v_site_id
  from public.equipment_assets equipment
  where equipment.id = p_equipment_id;

  if not public.vorta_has_site_access(v_site_id, false) then
    return;
  end if;

  return query
  select *
  from public.vorta_search_equipment_knowledge_internal(
    p_equipment_id,
    p_query,
    p_limit
  );
end;
$function$;

revoke all on function public.vorta_search_equipment_knowledge(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.vorta_search_equipment_knowledge(uuid, text, integer)
  to authenticated, service_role;

revoke all on function public.vorta_search_equipment_knowledge_internal(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.vorta_search_equipment_knowledge_internal(uuid, text, integer)
  to service_role;

comment on function public.vorta_search_equipment_knowledge(uuid, text, integer) is
  'Authorised Ask Vorta document search. Returns exact stored revision, locator, bounded excerpt, coverage mode and source-link status without inventing missing document evidence.';
comment on function public.vorta_search_equipment_knowledge_internal(uuid, text, integer) is
  'Internal document ranking for Ask Vorta. Full-text chunks return bounded stored excerpts; summary-only chunks are explicitly labelled and never imply complete source coverage or a verified locator.';

notify pgrst, 'reload schema';
