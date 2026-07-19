-- Add asset-specific strategy, recurrence and resilience evidence to the realism seed.

insert into public.knowledge_documents (
  equipment_id,source_system,source_document_id,source_path,source_url,title,document_type,revision,
  approval_status,is_current,effective_date,owner_department,summary,metadata,site_id,file_id,
  external_reference,oem,status,extracted_summary,last_indexed_at,allowed_roles
)
select asset.id,'EasiDoc Demo','REAL-'||asset.equipment_code||'-STRATEGY',
  '/Apex Wrexham/'||asset.area||'/'||asset.equipment_code||'/Reliability/'||asset.equipment_code||' Asset Strategy.pdf',
  'easidoc-demo://apex-wrexham/'||lower(asset.equipment_code)||'/asset-strategy',
  asset.equipment_code||' Reliability and Asset Strategy','Asset Strategy','01','Approved',true,current_date-90,
  'Reliability Engineering',
  'Asset strategy for '||asset.name||' covering '||seed.operating_story||', recurring-condition control, maintenance intervals and evidence requirements.',
  jsonb_build_object('demo_document',true,'demo_realism','2026-07-19','operating_story',seed.operating_story),
  asset.site_id,asset.equipment_code||'-REAL-STRATEGY.pdf','REAL-'||asset.equipment_code||'-STRATEGY',
  asset.oem,'active',
  'The strategy records dominant failure modes, monitoring evidence, PM rationale, critical spares, specialist support and release criteria.',
  now(),ARRAY['maintenance_manager','maintenance-manager','planner','engineer','production_manager','production-manager']
from private.demo_wrexham_realism_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
 and asset.equipment_code=seed.equipment_code
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
select document.id,asset.id,'realism-'||chunk.seq,
  case chunk.seq when 1 then 'Recurrence pattern and operating context' when 2 then 'Condition limits and escalation' else 'Long-term reliability action' end,
  case chunk.seq
    when 1 then asset.equipment_code||' recurrence evidence: '||seed.recurring_condition||'. Compare the event sequence with production mode, cleaning state, campaign length and the most recent maintenance confirmation.'
    when 2 then asset.equipment_code||' condition limits: assess '||seed.operating_story||' using the approved trend limits. Escalate when repeat frequency or process impact exceeds the asset-strategy threshold.'
    else asset.equipment_code||' reliability action: verify root-cause evidence, confirm the relevant spare and specialist availability, then update the PM interval only after the post-maintenance trend is stable.'
  end,
  20+chunk.seq,
  ARRAY[asset.equipment_code,asset.oem,'reliability','recurrence','condition monitoring'],
  jsonb_build_object('demo_document',true,'demo_realism','2026-07-19','operating_story',seed.operating_story),
  ARRAY[asset.equipment_code||'-F01',asset.equipment_code||'-F02'],
  ARRAY[asset.equipment_code||'-SEN-01',asset.equipment_code||'-ACT-01',asset.equipment_code||'-PLC-01'],
  document.source_url,document.external_reference
from private.demo_wrexham_realism_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
 and asset.equipment_code=seed.equipment_code
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
select asset.id,asset.equipment_code||'-F03',upper(asset.equipment_code||' RECURRING CONDITION'),
  initcap(seed.recurring_condition),'Reliability / Recurrence',
  case when seed.risk_mode='high' then 'Critical' else 'High' end,
  ARRAY[seed.recurring_condition,'incomplete elimination of the original failure mode','operating condition outside the previous repair verification'],
  ARRAY['Compare the current event with the previous confirmation evidence','Inspect the previously affected component and associated measurement','Escalate to the primary SME and reliability review if recurrence is confirmed'],
  ARRAY[asset.equipment_code||'-SEN-01',asset.equipment_code||'-ACT-01'],
  ARRAY[asset.equipment_code,'recurrence','asset strategy','fault finding'],
  true,'HMI Demo Realism','WREXHAM-REALISM-20260719-'||asset.equipment_code||'-FAULT-3',
  jsonb_build_object('demo_data',true,'demo_realism','2026-07-19','operating_story',seed.operating_story)
from private.demo_wrexham_realism_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
 and asset.equipment_code=seed.equipment_code
where seed.extra_fault_codes>0
on conflict (equipment_id,fault_code) do update set
  fault_name=excluded.fault_name,severity=excluded.severity,likely_causes=excluded.likely_causes,
  recommended_actions=excluded.recommended_actions,source_reference=excluded.source_reference,
  metadata=excluded.metadata,updated_at=now();

insert into public.maintenance_notifications (
  site_id,equipment_id,notification_number,notification_type_code,notification_type_description,short_text,long_text,
  priority_code,priority_description,status,malfunction_start_at,breakdown_indicator,reported_by,required_start_date,
  required_end_date,planner_group,maintenance_plant,main_work_center,functional_location_code,system_status_codes,
  user_status_codes,source_system,source_record_key,source_created_at,source_updated_at,workflow_status,
  risk_points,risk_reason
)
select asset.site_id,asset.id,'NT-R'||lpad(seed.seed_order::text,3,'0'),'M2','Malfunction report',
  asset.equipment_code||': '||initcap(seed.recurring_condition),
  'Repeat operating report concerning '||seed.recurring_condition||'. The equipment history and asset strategy must be reviewed before work-scope approval.',
  case when seed.risk_mode='high' then '1' else '2' end,
  case when seed.risk_mode='high' then 'Very high' else 'High' end,
  'OPEN',now()-(seed.seed_order+4)*interval '1 day',seed.risk_mode='high','Production shift team',
  current_date-seed.seed_order,current_date+case when seed.risk_mode='high' then 2 else 7 end,
  case when asset.area='Utilities' then 'UTIL' when asset.area='Warehouse' then 'WHSE' else 'STER' end,
  'WREX',case when asset.area='Utilities' then 'UTIL-WC' else 'MAINT-WC' end,
  'WREX-'||upper(regexp_replace(asset.area,'[^A-Za-z0-9]+','-','g'))||'-'||asset.equipment_code,
  ARRAY['OSNO'],ARRAY['DEMO-REALISM'],'demo-realism',
  'WREXHAM-REALISM-20260719-'||asset.equipment_code||'-NOTIF',
  now()-(seed.seed_order+4)*interval '1 day',now(),'AWAITING_WORK_ORDER',
  case when seed.risk_mode='high' then 70 else 38 end,
  'Repeated condition supported by linked work history, controlled guidance and an asset-specific reliability strategy.'
from private.demo_wrexham_realism_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
 and asset.equipment_code=seed.equipment_code
where seed.risk_mode='high' or seed.seed_order%4=0
on conflict do nothing;

update public.equipment_engineer_capabilities capability
set
  capability_role='BACKUP_SME',
  capability_status='ACTIVE',
  competency_level=greatest(capability.competency_level,4),
  practice_authority='INDEPENDENT',
  validation_status='VALIDATED',
  notes='Validated additional backup created from completed supervised evidence and recurrence-review participation.',
  updated_at=now()
from public.equipment_assets asset
where asset.id=capability.equipment_id
  and asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
  and asset.equipment_code in ('AGV-01','BMS-01','GEN-01')
  and capability.capability_status='IN_DEVELOPMENT';

select public.vorta_recalculate_equipment_risk_profiles();
select public.vorta_sync_equipment_risk_counts();
select public.vorta_recalculate_area_risk_profiles();
select public.vorta_recalculate_site_risk_profile();
select public.vorta_sync_maintenance_risk_work_plan();

drop table if exists private.demo_wrexham_realism_seed;
