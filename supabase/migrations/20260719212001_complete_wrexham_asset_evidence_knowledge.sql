-- Complete controlled-document and searchable knowledge evidence for the completion seed.

insert into public.knowledge_documents (
  equipment_id,source_system,source_document_id,source_path,source_url,title,document_type,revision,
  approval_status,is_current,effective_date,owner_department,summary,metadata,site_id,file_id,
  external_reference,drawing_number,sheet_number,manual_section,page_number,fault_codes,component_tags,
  oem,status,extracted_summary,last_indexed_at,allowed_roles
)
select asset.id,'EasiDoc Demo',
  case document.seq
    when 1 then 'AUD-'||asset.equipment_code||'-OM-001'
    when 2 then 'AUD-'||asset.equipment_code||'-EL-100'
    else 'AUD-TSG-'||asset.equipment_code
  end,
  '/Apex Wrexham/'||asset.area||'/'||asset.equipment_code||'/'||
    case document.seq when 1 then 'Manuals/' when 2 then 'Drawings/' else 'Troubleshooting/' end||
    case document.seq when 1 then asset.equipment_code||' Maintenance Manual.pdf'
      when 2 then asset.equipment_code||' Electrical Drawings.pdf'
      else asset.equipment_code||' Diagnostic Guide.pdf' end,
  'easidoc-demo://apex-wrexham/'||lower(asset.equipment_code)||'/'||
    case document.seq when 1 then 'manual' when 2 then 'drawings' else 'diagnostics' end,
  case document.seq
    when 1 then asset.oem||' '||asset.equipment_code||' Operating and Maintenance Manual'
    when 2 then asset.equipment_code||' Electrical, Controls and Instrument Drawings'
    else asset.equipment_code||' Approved Diagnostic and Recovery Guide'
  end,
  case document.seq when 1 then 'OEM Manual' when 2 then 'Electrical Drawing' else 'Fault-Finding Guide' end,
  '01','Approved',true,current_date-120,
  case when asset.area='Warehouse' then 'Warehouse Engineering'
       when asset.area='Utilities' then 'Engineering Utilities'
       else 'Manufacturing Engineering' end,
  case document.seq
    when 1 then 'Controlled operation, isolation, maintenance limits and replaceable-component information for '||asset.name||'.'
    when 2 then 'Controlled power, safety, control I/O, instrumentation and approved test-point information for '||asset.name||'.'
    else 'Approved diagnosis covering '||seed.issue_1||', '||seed.issue_2||' and '||seed.issue_3||'.'
  end,
  jsonb_build_object('demo_document',true,'audit_completion','2026-07-19','document_sequence',document.seq),
  asset.site_id,
  case document.seq when 1 then asset.equipment_code||'-AUD-OM.pdf'
    when 2 then asset.equipment_code||'-AUD-EL.pdf'
    else asset.equipment_code||'-AUD-TSG.pdf' end,
  case document.seq when 1 then 'AUD-'||asset.equipment_code||'-OM-001'
    when 2 then 'AUD-'||asset.equipment_code||'-EL-100'
    else 'AUD-TSG-'||asset.equipment_code end,
  case when document.seq=2 then 'AUD-'||asset.equipment_code||'-EL-100' end,
  case when document.seq=2 then '1-10' end,
  case when document.seq=1 then 'Maintenance and troubleshooting' end,
  case document.seq when 1 then 36 when 2 then 1 else 7 end,
  ARRAY[asset.equipment_code||'-A01',asset.equipment_code||'-A02'],
  ARRAY[asset.equipment_code||'-SEN-C01',asset.equipment_code||'-ACT-C01',asset.equipment_code||'-KIT-C01'],
  asset.oem,'active',
  case document.seq
    when 1 then 'Use the approved isolation sequence before maintenance. Confirm critical measurements, replaceable assemblies and the required release checks.'
    when 2 then 'Use the drawing references to prove supplies, safety circuits, control I/O and field feedback before replacing components.'
    else 'Start with the alarm sequence and current trend. Verify measurement, wiring, actuator feedback and spare readiness, then document the functional challenge.'
  end,
  now(),ARRAY['maintenance_manager','maintenance-manager','planner','engineer','production_manager','production-manager']
from private.demo_wrexham_completion_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
 and asset.equipment_code=seed.equipment_code
cross join generate_series(1,3) document(seq)
on conflict (source_system,source_document_id) do update set
  equipment_id=excluded.equipment_id,
  source_path=excluded.source_path,
  source_url=excluded.source_url,
  title=excluded.title,
  document_type=excluded.document_type,
  revision=excluded.revision,
  approval_status=excluded.approval_status,
  is_current=excluded.is_current,
  effective_date=excluded.effective_date,
  owner_department=excluded.owner_department,
  summary=excluded.summary,
  metadata=excluded.metadata,
  site_id=excluded.site_id,
  file_id=excluded.file_id,
  external_reference=excluded.external_reference,
  drawing_number=excluded.drawing_number,
  fault_codes=excluded.fault_codes,
  component_tags=excluded.component_tags,
  oem=excluded.oem,
  status=excluded.status,
  extracted_summary=excluded.extracted_summary,
  last_indexed_at=excluded.last_indexed_at,
  allowed_roles=excluded.allowed_roles,
  updated_at=now();

insert into public.knowledge_chunks (
  document_id,equipment_id,chunk_ref,section_title,chunk_text,page_number,keywords,metadata,
  drawing_number,sheet_number,fault_codes,component_tags,source_url,external_reference
)
select document.id,asset.id,'audit-section-'||chunk.seq,
  case chunk.seq
    when 1 then 'Operating symptom and evidence capture'
    when 2 then 'Electrical and mechanical fault isolation'
    else 'Repair, spares and release verification'
  end,
  case chunk.seq
    when 1 then asset.equipment_code||' operating guidance: '||seed.issue_1||'. Review the current trend, alarm sequence, operating state and last successful cycle. Verify the critical measurement assembly against an approved reference before changing settings.'
    when 2 then asset.equipment_code||' isolation guidance: '||seed.issue_2||'. Use the electrical and control drawings to verify supplies, safety circuits, field wiring, actuator feedback and the associated I/O channel.'
    else asset.equipment_code||' recovery guidance: '||seed.issue_3||'. Confirm the service kit and critical spare are available, complete the approved repair, run the functional challenge and record confirmation text and any material movement.'
  end,
  case chunk.seq when 1 then 7 when 2 then 12 else 19 end,
  ARRAY[asset.equipment_code,asset.oem,'fault finding','maintenance','spares','verification'],
  jsonb_build_object('demo_document',true,'audit_completion','2026-07-19','source_document_id',document.source_document_id),
  document.drawing_number,document.sheet_number,
  ARRAY[asset.equipment_code||'-A01',asset.equipment_code||'-A02'],
  ARRAY[asset.equipment_code||'-SEN-C01',asset.equipment_code||'-ACT-C01',asset.equipment_code||'-KIT-C01'],
  document.source_url,document.external_reference
from private.demo_wrexham_completion_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
 and asset.equipment_code=seed.equipment_code
join public.knowledge_documents document
  on document.source_system='EasiDoc Demo'
 and document.source_document_id='AUD-TSG-'||asset.equipment_code
cross join generate_series(1,3) chunk(seq)
on conflict (document_id,chunk_ref) do update set
  section_title=excluded.section_title,
  chunk_text=excluded.chunk_text,
  page_number=excluded.page_number,
  keywords=excluded.keywords,
  metadata=excluded.metadata,
  fault_codes=excluded.fault_codes,
  component_tags=excluded.component_tags,
  source_url=excluded.source_url,
  external_reference=excluded.external_reference,
  updated_at=now();
