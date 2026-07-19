-- Add distinct reliability evidence for the formerly sparse assets.

insert into public.knowledge_documents (
  equipment_id,source_system,source_document_id,source_path,source_url,title,document_type,revision,
  approval_status,is_current,effective_date,owner_department,summary,metadata,site_id,file_id,
  external_reference,oem,status,extracted_summary,last_indexed_at,allowed_roles
)
select asset.id,'EasiDoc Demo','THIN-'||asset.equipment_code||'-REVIEW',
  '/Apex Wrexham/'||asset.area||'/'||asset.equipment_code||'/Reliability/'||asset.equipment_code||' Performance Review.pdf',
  'easidoc-demo://apex-wrexham/'||lower(asset.equipment_code)||'/performance-review',
  asset.equipment_code||' Equipment Performance Review','Reliability Review','01','Approved',true,current_date-60,
  'Reliability Engineering','Review of '||seed.story||' with event history, condition limits, PM rationale and current actions.',
  jsonb_build_object('demo_document',true,'thin_asset_realism','2026-07-19','story',seed.story),
  asset.site_id,asset.equipment_code||'-THIN-REVIEW.pdf','THIN-'||asset.equipment_code||'-REVIEW',asset.oem,'active',
  'The review connects failure history, current risk, skill resilience, critical spares and the next planned intervention for the equipment.',
  now(),ARRAY['maintenance_manager','maintenance-manager','planner','engineer','production_manager','production-manager']
from private.demo_wrexham_thin_realism_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid and asset.equipment_code=seed.equipment_code
where seed.extra_documents>0
on conflict (source_system,source_document_id) do update set
  equipment_id=excluded.equipment_id,source_path=excluded.source_path,source_url=excluded.source_url,
  title=excluded.title,summary=excluded.summary,metadata=excluded.metadata,site_id=excluded.site_id,
  file_id=excluded.file_id,external_reference=excluded.external_reference,
  extracted_summary=excluded.extracted_summary,last_indexed_at=excluded.last_indexed_at,updated_at=now();

insert into public.knowledge_chunks (
  document_id,equipment_id,chunk_ref,section_title,chunk_text,page_number,keywords,metadata,
  fault_codes,component_tags,source_url,external_reference
)
select document.id,asset.id,'thin-realism-'||chunk.seq,
  case chunk.seq when 1 then 'Performance pattern and first checks' else 'Sustaining action and release evidence' end,
  case chunk.seq
    when 1 then asset.equipment_code||' performance context: '||seed.story||'. Compare the latest event with operating mode, environmental conditions, previous confirmations and the approved baseline.'
    else asset.equipment_code||' sustaining action: confirm the relevant measurement, component and specialist support, then record the functional challenge and post-maintenance trend evidence.'
  end,
  24+chunk.seq,
  ARRAY[asset.equipment_code,asset.oem,'performance','reliability','verification'],
  jsonb_build_object('demo_document',true,'thin_asset_realism','2026-07-19','story',seed.story),
  ARRAY[asset.equipment_code||'-A01',asset.equipment_code||'-A02'],
  ARRAY[asset.equipment_code||'-SEN-C01',asset.equipment_code||'-ACT-C01',asset.equipment_code||'-KIT-C01'],
  document.source_url,document.external_reference
from private.demo_wrexham_thin_realism_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid and asset.equipment_code=seed.equipment_code
join public.knowledge_documents document
  on document.equipment_id=asset.id and document.is_current and document.document_type='Fault-Finding Guide'
cross join lateral generate_series(1,seed.extra_chunks) chunk(seq)
on conflict (document_id,chunk_ref) do update set
  section_title=excluded.section_title,chunk_text=excluded.chunk_text,page_number=excluded.page_number,
  keywords=excluded.keywords,metadata=excluded.metadata,fault_codes=excluded.fault_codes,
  component_tags=excluded.component_tags,source_url=excluded.source_url,
  external_reference=excluded.external_reference,updated_at=now();

insert into public.equipment_fault_codes (
  equipment_id,fault_code,hmi_text_pattern,fault_name,fault_category,severity,
  likely_causes,recommended_actions,related_spare_keywords,related_knowledge_keywords,
  escalation_required,source_system,source_reference,metadata
)
select asset.id,asset.equipment_code||'-A03',upper(asset.equipment_code||' PERFORMANCE RECURRENCE'),
  initcap(seed.story||' recurrence'),'Reliability / Recurrence',
  case when asset.criticality='critical' then 'Critical' else 'High' end,
  ARRAY['repeat condition after previous intervention','operating mode outside the original verification','measurement or component deterioration'],
  ARRAY['Review previous confirmation and current operating context','Verify the linked measurement and critical component','Escalate to the equipment SME if recurrence is confirmed'],
  ARRAY[asset.equipment_code||'-SEN-C01',asset.equipment_code||'-ACT-C01'],
  ARRAY[asset.equipment_code,'performance review','recurrence','fault finding'],
  asset.criticality in ('critical','high'),'HMI Demo Realism',
  'WREXHAM-THIN-REALISM-20260719-'||asset.equipment_code||'-FAULT-3',
  jsonb_build_object('demo_data',true,'thin_asset_realism','2026-07-19','story',seed.story)
from private.demo_wrexham_thin_realism_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid and asset.equipment_code=seed.equipment_code
where seed.extra_fault_codes>0
on conflict (equipment_id,fault_code) do update set
  fault_name=excluded.fault_name,severity=excluded.severity,likely_causes=excluded.likely_causes,
  recommended_actions=excluded.recommended_actions,source_reference=excluded.source_reference,
  metadata=excluded.metadata,updated_at=now();

select public.vorta_recalculate_equipment_risk_profiles();
select public.vorta_sync_equipment_risk_counts();
select public.vorta_recalculate_area_risk_profiles();
select public.vorta_recalculate_site_risk_profile();
select public.vorta_sync_maintenance_risk_work_plan();

drop table if exists private.demo_wrexham_thin_realism_seed;
