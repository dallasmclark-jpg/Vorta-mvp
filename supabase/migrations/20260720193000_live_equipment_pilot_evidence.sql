-- Live Equipment pilot evidence readers
--
-- These RPCs deliberately remain SECURITY INVOKER. Existing table grants and
-- row-level security policies therefore remain the authority for site, equipment
-- and document-role access. The public functions only shape already-authorised
-- evidence for the Maintenance Manager client.

create or replace function public.vorta_get_equipment_history(
  p_equipment_id uuid
)
returns table (
  work_order_id uuid,
  work_order_number text,
  event_date date,
  description text,
  work_type text,
  priority text,
  status text,
  assigned_engineer text,
  requested_date date,
  due_date date,
  completed_date date,
  downtime_minutes integer,
  mttr_hours numeric,
  outcome text,
  fault_code text,
  source_system text,
  source_updated_at timestamptz,
  confirmation_count bigint,
  latest_confirmation_text text,
  latest_confirmed_by text,
  latest_confirmation_at timestamptz,
  reservation_count bigint,
  goods_movement_count bigint,
  confirmations jsonb,
  reservations jsonb,
  goods_movements jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $function$
  with accessible_equipment as (
    select equipment.id, equipment.site_id
    from public.equipment_assets equipment
    where equipment.id = p_equipment_id
  ),
  scoped_orders as (
    select work_order.*
    from public.work_orders work_order
    join accessible_equipment equipment
      on equipment.id = work_order.equipment_id
     and equipment.site_id = work_order.site_id
  )
  select
    work_order.id as work_order_id,
    work_order.wo_number as work_order_number,
    coalesce(
      work_order.completed_date,
      work_order.actual_finish_at::date,
      work_order.technical_completion_at::date,
      work_order.due_date,
      work_order.requested_date,
      work_order.created_at::date
    ) as event_date,
    work_order.description,
    work_order.work_type,
    work_order.priority,
    work_order.status,
    work_order.assigned_engineer,
    work_order.requested_date,
    work_order.due_date,
    work_order.completed_date,
    work_order.downtime_minutes,
    work_order.mttr_hours,
    work_order.outcome,
    work_order.fault_code,
    work_order.source_system,
    work_order.source_updated_at,
    coalesce(confirmation.confirmation_count, 0) as confirmation_count,
    confirmation.latest_confirmation_text,
    confirmation.latest_confirmed_by,
    confirmation.latest_confirmation_at,
    coalesce(reservation.reservation_count, 0) as reservation_count,
    coalesce(movement.goods_movement_count, 0) as goods_movement_count,
    coalesce(confirmation.items, '[]'::jsonb) as confirmations,
    coalesce(reservation.items, '[]'::jsonb) as reservations,
    coalesce(movement.items, '[]'::jsonb) as goods_movements
  from scoped_orders work_order
  left join lateral (
    select
      count(*) filter (where not confirmation_row.reversal) as confirmation_count,
      (
        array_agg(confirmation_row.confirmation_text order by
          coalesce(confirmation_row.confirmation_timestamp, confirmation_row.posting_date::timestamptz, confirmation_row.created_at) desc
        ) filter (
          where not confirmation_row.reversal
            and nullif(btrim(confirmation_row.confirmation_text), '') is not null
        )
      )[1] as latest_confirmation_text,
      (
        array_agg(confirmation_row.confirmed_by order by
          coalesce(confirmation_row.confirmation_timestamp, confirmation_row.posting_date::timestamptz, confirmation_row.created_at) desc
        ) filter (where not confirmation_row.reversal)
      )[1] as latest_confirmed_by,
      max(
        coalesce(confirmation_row.confirmation_timestamp, confirmation_row.posting_date::timestamptz, confirmation_row.created_at)
      ) filter (where not confirmation_row.reversal) as latest_confirmation_at,
      jsonb_agg(
        jsonb_build_object(
          'id', confirmation_row.id,
          'confirmationNumber', confirmation_row.confirmation_number,
          'confirmationCounter', confirmation_row.confirmation_counter,
          'operationNumber', confirmation_row.operation_number,
          'suboperationNumber', confirmation_row.suboperation_number,
          'text', confirmation_row.confirmation_text,
          'confirmedBy', confirmation_row.confirmed_by,
          'workCenter', confirmation_row.work_center,
          'postingDate', confirmation_row.posting_date,
          'confirmedAt', confirmation_row.confirmation_timestamp,
          'actualWork', confirmation_row.actual_work,
          'workUnit', confirmation_row.work_unit,
          'actualDuration', confirmation_row.actual_duration,
          'durationUnit', confirmation_row.duration_unit,
          'finalConfirmation', confirmation_row.final_confirmation,
          'sourceSystem', confirmation_row.source_system,
          'sourceUpdatedAt', confirmation_row.source_updated_at
        )
        order by coalesce(confirmation_row.confirmation_timestamp, confirmation_row.posting_date::timestamptz, confirmation_row.created_at) desc
      ) filter (where not confirmation_row.reversal) as items
    from public.work_order_confirmations confirmation_row
    where confirmation_row.work_order_id = work_order.id
  ) confirmation on true
  left join lateral (
    select
      count(*) as reservation_count,
      jsonb_agg(
        jsonb_build_object(
          'id', reservation_row.id,
          'materialNumber', reservation_row.material_number,
          'reservationNumber', reservation_row.reservation_number,
          'reservationItem', reservation_row.reservation_item,
          'requirementDate', reservation_row.requirement_date,
          'requiredQuantity', reservation_row.required_quantity,
          'reservedQuantity', reservation_row.reserved_quantity,
          'withdrawnQuantity', reservation_row.withdrawn_quantity,
          'baseUnit', reservation_row.base_unit,
          'storageLocation', reservation_row.storage_location,
          'status', reservation_row.reservation_status,
          'finalIssue', reservation_row.final_issue,
          'sourceSystem', reservation_row.source_system,
          'sourceUpdatedAt', reservation_row.source_updated_at
        )
        order by reservation_row.requirement_date nulls last, reservation_row.material_number
      ) as items
    from public.work_order_material_reservations reservation_row
    where reservation_row.work_order_id = work_order.id
  ) reservation on true
  left join lateral (
    select
      count(*) filter (where not movement_row.reversal) as goods_movement_count,
      jsonb_agg(
        jsonb_build_object(
          'id', movement_row.id,
          'materialDocumentNumber', movement_row.material_document_number,
          'materialDocumentYear', movement_row.material_document_year,
          'documentItem', movement_row.document_item,
          'movementType', movement_row.movement_type,
          'postingDate', movement_row.posting_date,
          'documentDate', movement_row.document_date,
          'enteredAt', movement_row.entry_timestamp,
          'materialNumber', movement_row.material_number,
          'materialDescription', movement_row.material_description,
          'quantity', movement_row.quantity,
          'baseUnit', movement_row.base_unit,
          'storageLocation', movement_row.storage_location,
          'batchNumber', movement_row.batch_number,
          'reservationNumber', movement_row.reservation_number,
          'reservationItem', movement_row.reservation_item,
          'enteredBy', movement_row.entered_by,
          'sourceSystem', movement_row.source_system,
          'sourceUpdatedAt', movement_row.source_updated_at
        )
        order by coalesce(movement_row.entry_timestamp, movement_row.posting_date::timestamptz, movement_row.created_at) desc
      ) filter (where not movement_row.reversal) as items
    from public.work_order_goods_movements movement_row
    where movement_row.work_order_id = work_order.id
  ) movement on true
  order by
    coalesce(
      work_order.completed_date,
      work_order.actual_finish_at::date,
      work_order.technical_completion_at::date,
      work_order.due_date,
      work_order.requested_date,
      work_order.created_at::date
    ) desc,
    work_order.wo_number desc;
$function$;

create or replace function public.vorta_get_equipment_documents(
  p_equipment_id uuid
)
returns table (
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
  first_page_number integer
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
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
    chunk_evidence.first_page_number
  from accessible_equipment equipment
  join public.knowledge_documents document
    on document.equipment_id = equipment.id
    or (document.equipment_id is null and document.site_id = equipment.site_id)
  left join lateral (
    select
      count(*) as chunk_count,
      (array_agg(chunk.section_title order by chunk.page_number nulls last, chunk.chunk_ref))[1] as first_section_title,
      (array_agg(chunk.page_number order by chunk.page_number nulls last, chunk.chunk_ref))[1] as first_page_number
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

create or replace function public.vorta_get_equipment_document(
  p_equipment_id uuid,
  p_document_id uuid
)
returns table (
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
  chunks jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
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
    coalesce(chunk_evidence.items, '[]'::jsonb) as chunks
  from accessible_equipment equipment
  join public.knowledge_documents document
    on document.id = p_document_id
   and (
     document.equipment_id = equipment.id
     or (document.equipment_id is null and document.site_id = equipment.site_id)
   )
  left join lateral (
    select jsonb_agg(
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
        'externalReference', chunk.external_reference
      )
      order by chunk.page_number nulls last, chunk.chunk_ref
    ) as items
    from public.knowledge_chunks chunk
    where chunk.document_id = document.id
      and (chunk.equipment_id is null or chunk.equipment_id = equipment.id)
  ) chunk_evidence on true;
$function$;

revoke all on function public.vorta_get_equipment_history(uuid) from public;
revoke all on function public.vorta_get_equipment_history(uuid) from anon;
grant execute on function public.vorta_get_equipment_history(uuid) to authenticated;

revoke all on function public.vorta_get_equipment_documents(uuid) from public;
revoke all on function public.vorta_get_equipment_documents(uuid) from anon;
grant execute on function public.vorta_get_equipment_documents(uuid) to authenticated;

revoke all on function public.vorta_get_equipment_document(uuid, uuid) from public;
revoke all on function public.vorta_get_equipment_document(uuid, uuid) from anon;
grant execute on function public.vorta_get_equipment_document(uuid, uuid) to authenticated;

comment on function public.vorta_get_equipment_history(uuid) is
  'Authenticated SECURITY INVOKER reader for site-scoped work-order history, confirmations, reservations and goods movements.';
comment on function public.vorta_get_equipment_documents(uuid) is
  'Authenticated SECURITY INVOKER reader for controlled equipment and site documents allowed by RLS.';
comment on function public.vorta_get_equipment_document(uuid, uuid) is
  'Authenticated SECURITY INVOKER reader for one controlled document and its indexed citation chunks.';
