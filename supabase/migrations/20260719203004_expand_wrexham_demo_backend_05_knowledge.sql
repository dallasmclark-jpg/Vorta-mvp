-- Wrexham demo backend expansion. Sequential, idempotent stage.
-- Do not reorder these six migrations.

insert into public.knowledge_documents (
  equipment_id,source_system,source_document_id,source_path,source_url,title,document_type,revision,
  approval_status,is_current,effective_date,owner_department,summary,metadata,site_id,file_id,
  external_reference,drawing_number,sheet_number,manual_section,page_number,fault_codes,component_tags,
  oem,status,extracted_summary,last_indexed_at,allowed_roles
)
select seed.equipment_id,'EasiDoc Demo',
  case document.seq when 1 then seed.equipment_code||'-OM-001' when 2 then seed.equipment_code||'-EL-100' else 'TSG-'||seed.equipment_code||'-FAULTS' end,
  '/Apex Wrexham/'||seed.area||'/'||seed.equipment_code||'/'||case document.seq when 1 then 'Manuals/' when 2 then 'Drawings/' else 'Troubleshooting/' end||
    case document.seq when 1 then seed.equipment_code||' Operating Manual.pdf' when 2 then seed.equipment_code||' Electrical Drawings.pdf' else seed.equipment_code||' Fault Finding Guide.pdf' end,
  'easidoc-demo://apex-wrexham/'||lower(seed.equipment_code)||'/'||case document.seq when 1 then seed.equipment_code||'-OM-001' when 2 then seed.equipment_code||'-EL-100' else 'TSG-'||seed.equipment_code||'-FAULTS' end,
  case document.seq when 1 then seed.oem||' '||seed.equipment_code||' Operating and Maintenance Manual' when 2 then seed.equipment_code||' Electrical and Control Drawings' else seed.equipment_code||' Approved Fault-Finding Guide' end,
  case document.seq when 1 then 'OEM Manual' when 2 then 'Electrical Drawing' else 'Fault-Finding Guide' end,
  '01','Approved',true,current_date-180,
  case when seed.area='Utilities' then 'Engineering' when seed.area='Warehouse' then 'Warehouse Engineering' else 'Sterile Manufacturing Engineering' end,
  case document.seq when 1 then 'Controlled operating, maintenance, isolation and component information for '||seed.equipment_name||'.'
       when 2 then 'Controlled power, safety, PLC I/O and instrumentation drawings for '||seed.equipment_name||'.'
       else 'Approved diagnostic sequence covering '||seed.issue_1||', '||seed.issue_2||' and '||seed.issue_3||'.' end,
  jsonb_build_object('demo_document',true,'demo_expansion','2026-07-19','document_class',case document.seq when 1 then 'controlled_oem_manual' when 2 then 'controlled_drawing' else 'approved_troubleshooting_guide' end),
  '11000000-0000-0000-0000-000000000001'::uuid,
  case document.seq when 1 then seed.equipment_code||'-OM-001.pdf' when 2 then seed.equipment_code||'-EL-100.pdf' else 'TSG-'||seed.equipment_code||'-FAULTS.pdf' end,
  case document.seq when 1 then seed.equipment_code||'-OM-001' when 2 then seed.equipment_code||'-EL-100' else 'TSG-'||seed.equipment_code||'-FAULTS' end,
  case when document.seq=2 then seed.equipment_code||'-EL-100' end,case when document.seq=2 then '1-12' end,
  case when document.seq=1 then 'Maintenance and troubleshooting' end,case document.seq when 1 then 42 when 2 then 1 else 8 end,
  ARRAY[seed.equipment_code||'-F01',seed.equipment_code||'-F02'],
  ARRAY[seed.equipment_code||'-SEN-01',seed.equipment_code||'-ACT-01',seed.equipment_code||'-PLC-01'],
  seed.oem,'active',
  case document.seq when 1 then 'Use the approved isolation sequence before maintenance. The manual identifies critical sensors, actuators, control modules, adjustment limits and post-maintenance release tests.'
       when 2 then 'The drawings identify power distribution, safety circuits, PLC I/O, field instrumentation, actuator feedback and approved test points.'
       else 'Start with alarm history and current trend evidence. Confirm calibration and physical condition before replacing parts, then complete the functional challenge and document the result.' end,
  now(),ARRAY['maintenance_manager','maintenance-manager','planner','engineer','production_manager','production-manager']
from private.demo_wrexham_asset_seed seed cross join generate_series(1,3) document(seq)
on conflict (source_system,source_document_id) do update set
  equipment_id=excluded.equipment_id,source_path=excluded.source_path,source_url=excluded.source_url,
  title=excluded.title,document_type=excluded.document_type,revision=excluded.revision,
  approval_status=excluded.approval_status,is_current=excluded.is_current,effective_date=excluded.effective_date,
  owner_department=excluded.owner_department,summary=excluded.summary,metadata=excluded.metadata,
  site_id=excluded.site_id,file_id=excluded.file_id,external_reference=excluded.external_reference,
  drawing_number=excluded.drawing_number,fault_codes=excluded.fault_codes,component_tags=excluded.component_tags,
  oem=excluded.oem,status=excluded.status,extracted_summary=excluded.extracted_summary,
  last_indexed_at=excluded.last_indexed_at,allowed_roles=excluded.allowed_roles,updated_at=now();

insert into public.knowledge_chunks (
  document_id,equipment_id,chunk_ref,section_title,chunk_text,page_number,keywords,metadata,
  drawing_number,sheet_number,fault_codes,component_tags,source_url,external_reference
)
select document.id,seed.equipment_id,'section-'||chunk.seq,
  case chunk.seq when 1 then 'Operating symptoms and first checks' else 'Repair, spares and release verification' end,
  case chunk.seq when 1 then seed.equipment_code||' diagnostic guidance: '||seed.issue_1||'. Review the current process trend, alarm sequence, operating state and last successful cycle. Inspect the primary sensor and verify the measurement against an approved reference before changing control parameters.'
       else seed.equipment_code||' maintenance guidance: '||seed.issue_2||'; '||seed.issue_3||'. Use the electrical drawing to verify field feedback, inspect the actuator and control I/O module, confirm spare availability, then complete the approved functional challenge and record the confirmation text.' end,
  case chunk.seq when 1 then 8 else 18 end,
  ARRAY[seed.equipment_code,seed.oem,'fault finding','maintenance','spares','verification'],
  jsonb_build_object('demo_document',true,'demo_expansion','2026-07-19','source_document_id',document.source_document_id),
  document.drawing_number,document.sheet_number,ARRAY[seed.equipment_code||'-F01',seed.equipment_code||'-F02'],
  ARRAY[seed.equipment_code||'-SEN-01',seed.equipment_code||'-ACT-01',seed.equipment_code||'-PLC-01'],
  document.source_url,document.external_reference
from private.demo_wrexham_asset_seed seed
join public.knowledge_documents document on document.source_system='EasiDoc Demo' and document.source_document_id='TSG-'||seed.equipment_code||'-FAULTS'
cross join generate_series(1,2) chunk(seq)
on conflict (document_id,chunk_ref) do update set
  section_title=excluded.section_title,chunk_text=excluded.chunk_text,page_number=excluded.page_number,
  keywords=excluded.keywords,metadata=excluded.metadata,fault_codes=excluded.fault_codes,
  component_tags=excluded.component_tags,source_url=excluded.source_url,
  external_reference=excluded.external_reference,updated_at=now();
