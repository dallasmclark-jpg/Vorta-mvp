-- Complete BOM, stock and fault-code evidence for previously thin Wrexham assets.

drop table if exists private.demo_wrexham_completion_seed;

create unlogged table private.demo_wrexham_completion_seed (
  seed_order integer primary key,
  equipment_code text unique not null,
  issue_1 text not null,
  issue_2 text not null,
  issue_3 text not null,
  risk_mode text not null check (risk_mode in ('stable','watch','high'))
);

insert into private.demo_wrexham_completion_seed values
(1,'CC-01','vacuum-decay verification drifted above the validated baseline','chamber sealing pressure decayed during the test hold','reference-container recognition became intermittent','watch'),
(2,'CP-01','case infeed timing produced intermittent carton jams','vacuum pick confirmation dropped during high-speed operation','guard-door interlock feedback bounced after washdown','watch'),
(3,'DEMO-COLD-001','dual temperature probes disagreed during defrost recovery','monitoring gateway communications dropped intermittently','local alarm backup battery capacity tested below target','high'),
(4,'DEMO-LAB-001','label registration drift increased across long production runs','web tension oscillated after reel changes','reject verification sensor response became intermittent','stable'),
(5,'DEMO-PSG-001','pure-steam dryness approached the validated lower limit','separator level control oscillated during peak demand','feed-water conductivity indication drifted from reference','high'),
(6,'DEMO-SER-001','serialisation camera code-read failures increased after format change','aggregation communications paused during batch closeout','reject-gate confirmation was delayed at maximum line speed','watch'),
(7,'DEMO-VIS-001','inspection illumination intensity trended below baseline','camera focus stability reduced after extended runtime','reject timing verification failed intermittently','watch'),
(8,'DEMO-WMS-001','handheld scanner sessions disconnected in the goods-in zone','label-printer queues stalled during peak receipts','wireless coverage dropped near the cold-store entrance','stable'),
(9,'DOCK-01','hydraulic platform pressure decayed while holding a loaded trailer','dock-lip position sensing became intermittent','vehicle restraint safety feedback failed to prove first time','stable'),
(10,'PAL-02','robot gripper vacuum recovery slowed between pallet layers','robot mastering offset drifted after a collision stop','pallet-presence sensor produced nuisance faults','watch'),
(11,'RI-01','inspection-booth light intensity fell below the qualified setting','turntable speed varied outside the operator target','manual reject-count reconciliation did not match the batch record','stable'),
(12,'VI-03','cosmetic reject rate increased without a confirmed product shift','inspection transport servo vibration rose above baseline','camera trigger timing became unstable at maximum throughput','high'),
(13,'WMS-01','ERP interface messages accumulated in the outbound queue','radio-frequency transaction latency increased in dispatch','shipping-label print jobs remained in the spooler','watch');

insert into public.equipment_components (
  equipment_id,component_name,component_code,vendor_name,maker_name,quantity_available,quantity_target,
  minimum_quantity,unit_cost,lead_days,storage_location,availability_status,criticality,site_id,
  source_system,source_record_key,source_updated_at,is_bom_item,bom_item_number,bom_quantity,bom_unit,
  bom_item_category,functional_location_code
)
select asset.id,
  case component.seq
    when 1 then asset.equipment_code||' critical measurement assembly'
    when 2 then asset.equipment_code||' control actuator and feedback assembly'
    else asset.equipment_code||' planned service and wear-parts kit'
  end,
  asset.equipment_code||case component.seq when 1 then '-SEN-C01' when 2 then '-ACT-C01' else '-KIT-C01' end,
  asset.oem||' authorised supply',asset.oem,
  case
    when seed.risk_mode='high' and component.seq=1 then 0
    when seed.risk_mode='watch' and component.seq=2 then 1
    else case component.seq when 1 then 2 when 2 then 2 else 4 end
  end,
  case component.seq when 1 then 2 when 2 then 2 else 4 end,
  case component.seq when 3 then 2 else 1 end,
  case component.seq when 1 then 1250 when 2 then 2850 else 360 end,
  case component.seq when 1 then 28 when 2 then 56 else 14 end,
  case when component.seq=1 then 'CRIB-CRIT' else 'ENG-STORES' end,
  case
    when seed.risk_mode='high' and component.seq=1 then 'Out of Stock'
    when seed.risk_mode='watch' and component.seq=2 then 'Low Stock'
    else 'OK'
  end,
  case component.seq when 1 then 'Critical' when 2 then 'High' else 'Medium' end,
  asset.site_id,'demo-audit-completion',
  'WREXHAM-AUDIT-20260719-'||asset.equipment_code||'-COMP-'||component.seq,now(),true,
  lpad(component.seq::text,4,'0'),1,'EA','L',
  'WREX-'||upper(regexp_replace(asset.area,'[^A-Za-z0-9]+','-','g'))||'-'||asset.equipment_code
from private.demo_wrexham_completion_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
 and asset.equipment_code=seed.equipment_code
cross join generate_series(1,3) component(seq)
on conflict do nothing;

insert into public.site_material_stock (
  site_id,material_number,material_description,plant_code,storage_location,base_unit,unrestricted_quantity,
  quality_inspection_quantity,blocked_quantity,returns_quantity,stock_in_transfer_quantity,total_stock_value,
  currency_code,source_system,source_record_key,source_updated_at
)
select component.site_id,component.component_code,component.component_name,'WREX',component.storage_location,'EA',
  component.quantity_available,0,0,0,0,component.quantity_available*coalesce(component.unit_cost,0),'GBP',
  'demo-audit-completion','WREXHAM-AUDIT-20260719-STOCK-'||component.component_code,now()
from public.equipment_components component
where component.site_id='11000000-0000-0000-0000-000000000001'::uuid
  and component.source_system='demo-audit-completion'
on conflict (site_id,material_number,plant_code,storage_location) do update set
  material_description=excluded.material_description,
  unrestricted_quantity=excluded.unrestricted_quantity,
  total_stock_value=excluded.total_stock_value,
  source_system=excluded.source_system,
  source_record_key=excluded.source_record_key,
  source_updated_at=excluded.source_updated_at,
  updated_at=now();

insert into public.equipment_fault_codes (
  equipment_id,fault_code,hmi_text_pattern,fault_name,fault_category,severity,
  likely_causes,recommended_actions,related_spare_keywords,related_knowledge_keywords,
  escalation_required,source_system,source_reference,metadata
)
select asset.id,asset.equipment_code||'-A0'||fault.seq,
  upper(asset.equipment_code||' '||case fault.seq when 1 then seed.issue_1 else seed.issue_2 end),
  initcap(case fault.seq when 1 then seed.issue_1 else seed.issue_2 end),
  case fault.seq when 1 then 'Process / Performance' else 'Controls / Instrumentation' end,
  case when asset.criticality in ('critical','high') then 'High' else 'Medium' end,
  case fault.seq
    when 1 then ARRAY[seed.issue_1,'measurement drift or process restriction','maintenance interval exceeded']
    else ARRAY[seed.issue_2,'intermittent wiring or actuator feedback','control parameter outside the approved baseline']
  end,
  case fault.seq
    when 1 then ARRAY['Compare the live trend with the approved reference','Verify the critical measurement assembly','Escalate repeated deviation to the equipment SME']
    else ARRAY['Review alarm history and the electrical drawing','Inspect actuator feedback and field wiring','Complete the approved functional challenge before release']
  end,
  ARRAY[asset.equipment_code||'-SEN-C01',asset.equipment_code||'-ACT-C01'],
  ARRAY[asset.equipment_code,asset.oem,'fault finding','maintenance manual'],
  asset.criticality='critical','HMI Demo Audit',
  'WREXHAM-AUDIT-20260719-'||asset.equipment_code||'-FAULT-'||fault.seq,
  jsonb_build_object('demo_data',true,'audit_completion','2026-07-19','risk_mode',seed.risk_mode)
from private.demo_wrexham_completion_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
 and asset.equipment_code=seed.equipment_code
cross join generate_series(1,2) fault(seq)
on conflict (equipment_id,fault_code) do update set
  hmi_text_pattern=excluded.hmi_text_pattern,
  fault_name=excluded.fault_name,
  severity=excluded.severity,
  likely_causes=excluded.likely_causes,
  recommended_actions=excluded.recommended_actions,
  related_spare_keywords=excluded.related_spare_keywords,
  related_knowledge_keywords=excluded.related_knowledge_keywords,
  escalation_required=excluded.escalation_required,
  source_reference=excluded.source_reference,
  metadata=excluded.metadata,
  updated_at=now();
