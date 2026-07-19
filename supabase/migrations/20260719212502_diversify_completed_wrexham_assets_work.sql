-- Give the formerly sparse assets distinct work and maintenance histories.

drop table if exists private.demo_wrexham_thin_realism_seed;

create unlogged table private.demo_wrexham_thin_realism_seed (
  seed_order integer primary key,
  equipment_code text unique not null,
  story text not null,
  extra_work_orders integer not null,
  extra_pm_records integer not null,
  extra_documents integer not null,
  extra_chunks integer not null,
  extra_fault_codes integer not null
);

insert into private.demo_wrexham_thin_realism_seed values
(1,'CC-01','container-closure integrity and vacuum-decay repeatability',1,0,0,0,0),
(2,'CP-01','case-packing flow, pick reliability and guarding integrity',2,0,0,1,0),
(3,'DEMO-COLD-001','cold-chain monitoring continuity and probe agreement',3,0,0,0,1),
(4,'DEMO-LAB-001','label registration and reject verification',0,1,0,1,0),
(5,'DEMO-PSG-001','pure-steam quality and separator control',1,1,0,0,0),
(6,'DEMO-SER-001','serialisation read quality and aggregation continuity',2,1,0,1,1),
(7,'DEMO-VIS-001','inspection illumination, focus and reject timing',3,1,0,0,0),
(8,'DEMO-WMS-001','goods-in scanning, printing and wireless availability',0,2,1,1,0),
(9,'DOCK-01','dock hydraulic holding and vehicle-restraint proving',1,2,1,0,1),
(10,'PAL-02','robot mastering, gripper vacuum and pallet detection',2,2,1,1,0),
(11,'RI-01','manual inspection lighting and batch reconciliation',3,2,1,0,0),
(12,'VI-03','automatic inspection transport and camera triggering',0,0,1,1,1),
(13,'WMS-01','warehouse interface queues and dispatch transaction latency',1,0,1,2,1);

insert into public.work_orders (
  equipment_id,wo_number,priority,description,work_type,status,assigned_engineer,requested_date,due_date,
  completed_date,age_label,downtime_minutes,mttr_hours,outcome,is_overdue,fault_code,site_id,source_system,
  source_record_key,source_updated_at,order_type_code,order_type_description,maintenance_activity_type_code,
  maintenance_activity_type_description,order_origin,priority_code,functional_location_code,maintenance_plant,
  planner_group,main_work_center,basic_start_date,basic_finish_date,scheduled_start_at,scheduled_finish_at,
  actual_start_at,actual_finish_at,technical_completion_at,business_completion_at,system_status_codes,
  user_status_codes,source_created_at
)
select asset.id,'WO-T'||lpad(seed.seed_order::text,2,'0')||lpad(work.seq::text,2,'0'),
  case when asset.criticality='critical' then 'HIGH' when work.seq=1 then 'MEDIUM' else 'HIGH' end,
  case work.seq
    when 1 then asset.equipment_code||': Historical verification completed for '||seed.story||'. Findings and measured values were recorded against the approved baseline.'
    when 2 then asset.equipment_code||': Corrective follow-up raised after a recurring deviation in '||seed.story||'. Troubleshooting evidence and spare readiness were reviewed.'
    else asset.equipment_code||': Reliability inspection planned to confirm sustained performance of '||seed.story||' after the previous intervention.'
  end,
  case work.seq when 1 then 'Inspection' when 2 then 'Corrective' else 'Predictive' end,
  case when work.seq=1 then 'COMPLETED' when work.seq=2 then 'IN PROGRESS' else 'OPEN' end,
  coalesce(engineer.full_name,'Apex Engineering'),
  current_date-(seed.seed_order*8+work.seq*37+70),
  current_date-(seed.seed_order*6+work.seq*29+48),
  case when work.seq=1 then current_date-(seed.seed_order*6+work.seq*29+43) end,
  case when work.seq=1 then 'Completed' else (seed.seed_order+work.seq+3)::text||' days' end,
  case when work.seq=2 then 45 else 0 end,
  case work.seq when 1 then 1.4 when 2 then 2.8 else 1.1 end,
  case when work.seq=1 then 'VERIFIED' end,
  public.vorta_work_order_is_overdue(
    case when work.seq=1 then 'COMPLETED' when work.seq=2 then 'IN PROGRESS' else 'OPEN' end,
    current_date-(seed.seed_order*6+work.seq*29+48)
  ),
  asset.equipment_code||'-A0'||case when work.seq%2=0 then '2' else '1' end,
  asset.site_id,'demo-realism-thin','WREXHAM-THIN-REALISM-20260719-'||asset.equipment_code||'-WO-'||work.seq,now(),
  case when work.seq=1 then 'DM04' else 'DM01' end,
  case when work.seq=1 then 'Demo inspection order' else 'Demo corrective maintenance order' end,
  case when work.seq=1 then 'INSP' when work.seq=3 then 'PDM' else 'CORR' end,
  case when work.seq=1 then 'Condition inspection' when work.seq=3 then 'Predictive maintenance' else 'Corrective maintenance' end,
  'Maintenance history / reliability review',case when work.seq=1 then '3' else '2' end,
  'WREX-'||upper(regexp_replace(asset.area,'[^A-Za-z0-9]+','-','g'))||'-'||asset.equipment_code,'WREX',
  case when asset.area='Utilities' then 'UTIL' when asset.area='Warehouse' then 'WHSE' else 'STER' end,
  case when asset.area='Utilities' then 'UTIL-WC' else 'MAINT-WC' end,
  current_date-(seed.seed_order*8+work.seq*37+70),current_date-(seed.seed_order*6+work.seq*29+48),
  (current_date-(seed.seed_order*8+work.seq*37+70))::timestamp+interval '8 hours',
  (current_date-(seed.seed_order*6+work.seq*29+48))::timestamp+interval '16 hours',
  case when work.seq=1 then (current_date-(seed.seed_order*8+work.seq*37+70))::timestamp+interval '8 hours' end,
  case when work.seq=1 then (current_date-(seed.seed_order*6+work.seq*29+43))::timestamp+interval '13 hours' end,
  case when work.seq=1 then (current_date-(seed.seed_order*6+work.seq*29+43))::timestamp+interval '14 hours' end,
  case when work.seq=1 then (current_date-(seed.seed_order*6+work.seq*29+42))::timestamp+interval '9 hours' end,
  case when work.seq=1 then ARRAY['REL','CNF','TECO'] when work.seq=2 then ARRAY['REL','PCNF'] else ARRAY['CRTD','REL'] end,
  ARRAY['DEMO-THIN-REALISM'],(current_date-(seed.seed_order*8+work.seq*37+70))::timestamp
from private.demo_wrexham_thin_realism_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid and asset.equipment_code=seed.equipment_code
cross join lateral generate_series(1,seed.extra_work_orders) work(seq)
left join lateral (
  select engineer.full_name
  from public.equipment_engineer_capabilities capability
  join public.engineers engineer on engineer.id=capability.engineer_id
  where capability.equipment_id=asset.id and capability.capability_status='ACTIVE'
  order by case capability.capability_role when 'PRIMARY_SME' then 1 else 2 end limit 1
) engineer on true
on conflict do nothing;

insert into public.work_order_confirmations (
  site_id,work_order_id,confirmation_number,confirmation_counter,operation_number,confirmation_text,
  confirmed_by,personnel_number,work_center,posting_date,confirmation_timestamp,actual_work,work_unit,
  actual_duration,duration_unit,final_confirmation,source_system,source_record_key,source_updated_at
)
select work_order.site_id,work_order.id,'CNF-'||work_order.wo_number,'001','0010',
  work_order.description||' Engineering confirmation: checks were completed to the controlled procedure, results met the release criteria and the equipment was accepted for service.',
  work_order.assigned_engineer,'THIN-'||right(work_order.wo_number,4),work_order.main_work_center,
  work_order.completed_date,work_order.actual_finish_at,coalesce(work_order.mttr_hours,1),'H',coalesce(work_order.mttr_hours,1),'H',
  true,'demo-realism-thin','WREXHAM-THIN-REALISM-20260719-CONF-'||work_order.wo_number,now()
from public.work_orders work_order
where work_order.site_id='11000000-0000-0000-0000-000000000001'::uuid
  and work_order.source_system='demo-realism-thin' and work_order.status='COMPLETED'
on conflict (site_id,source_system,source_record_key) do update set
  confirmation_text=excluded.confirmation_text,confirmed_by=excluded.confirmed_by,
  posting_date=excluded.posting_date,confirmation_timestamp=excluded.confirmation_timestamp,
  actual_work=excluded.actual_work,actual_duration=excluded.actual_duration,
  final_confirmation=excluded.final_confirmation,source_updated_at=excluded.source_updated_at,updated_at=now();

insert into public.preventive_maintenance (
  equipment_id,pm_number,title,frequency,frequency_unit,pm_type,estimated_duration_minutes,
  last_completed_date,next_due_date,status,assigned_engineer,completion_percentage,criticality,
  procedure_ref,checklist_ref,site_id,source_system,source_record_key,source_updated_at,
  calibration_point,tolerance_specification
)
select asset.id,'PM-T'||lpad(seed.seed_order::text,2,'0')||lpad(pm.seq::text,2,'0'),
  case pm.seq when 1 then asset.equipment_code||' condition and evidence review' else asset.equipment_code||' control-loop verification' end,
  case pm.seq when 1 then 'Quarterly' else 'Annual' end,
  case pm.seq when 1 then 'quarter' else 'year' end,
  case pm.seq when 1 then 'Inspection' else 'Calibration' end,
  case pm.seq when 1 then 120 else 180 end,
  current_date-(150+seed.seed_order*4+pm.seq*20),
  current_date+case when asset.criticality='critical' then -5*pm.seq else 12+seed.seed_order+pm.seq*10 end,
  public.vorta_effective_pm_status('PLANNED',current_date+case when asset.criticality='critical' then -5*pm.seq else 12+seed.seed_order+pm.seq*10 end),
  coalesce(engineer.full_name,'Apex Engineering'),0,
  case when asset.criticality='critical' then 'Critical' else initcap(asset.criticality) end,
  'PROC-THIN-'||asset.equipment_code||'-'||pm.seq,'CHK-THIN-'||asset.equipment_code||'-'||pm.seq,
  asset.site_id,'demo-realism-thin','WREXHAM-THIN-REALISM-20260719-'||asset.equipment_code||'-PM-'||pm.seq,now(),
  case when pm.seq=2 then asset.equipment_code||' approved control-loop reference' end,
  case when pm.seq=2 then 'Within approved OEM and process validation tolerance' end
from private.demo_wrexham_thin_realism_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid and asset.equipment_code=seed.equipment_code
cross join lateral generate_series(1,seed.extra_pm_records) pm(seq)
left join lateral (
  select engineer.full_name
  from public.equipment_engineer_capabilities capability
  join public.engineers engineer on engineer.id=capability.engineer_id
  where capability.equipment_id=asset.id and capability.capability_status='ACTIVE'
  order by case capability.capability_role when 'PRIMARY_SME' then 1 else 2 end limit 1
) engineer on true
on conflict do nothing;
