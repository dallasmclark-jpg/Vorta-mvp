-- Diversify the evidence depth and maintenance chronology of the original expanded assets.

drop table if exists private.demo_wrexham_realism_seed;

create unlogged table private.demo_wrexham_realism_seed (
  seed_order integer primary key,
  equipment_code text unique not null,
  operating_story text not null,
  recurring_condition text not null,
  risk_mode text not null check (risk_mode in ('stable','watch','high')),
  extra_work_orders integer not null,
  extra_pm_records integer not null,
  extra_documents integer not null,
  extra_chunks integer not null,
  extra_fault_codes integer not null
);

insert into private.demo_wrexham_realism_seed values
(1,'AGV-01','warehouse route availability and safety-scanner reliability','scanner contamination during cold-store transfers','stable',1,0,1,1,0),
(2,'ALUS-01','freeze-dryer loading repeatability and tray-transfer alignment','tray-presence signal loss at the chamber interface','watch',2,1,0,2,1),
(3,'BMS-01','cleanroom pressure monitoring and field-controller resilience','controller communication resets during peak polling','stable',3,0,1,0,0),
(4,'CART-02','carton erecting quality and main-drive condition','torque increase during long packaging campaigns','watch',4,1,0,1,1),
(5,'CDA-01','oil-free compressed-air quality and element vibration','high-pressure element vibration after extended loading','watch',1,2,1,2,0),
(6,'CHW-01','process-cooling capacity and refrigerant-circuit stability','refrigerant circuit vibration under high ambient demand','watch',2,0,0,0,1),
(7,'CIP-01','recipe endpoint repeatability and route-valve proving','route-valve position disagreement during caustic return','watch',3,1,1,1,0),
(8,'DEMO-AUT-001','sterilisation cycle repeatability and chamber temperature agreement','temperature-channel disagreement during heat-up','stable',4,2,0,2,1),
(9,'DH-01','depyrogenation-zone recovery and conveyor synchronisation','conveyor speed feedback instability at sterilisation temperature','high',1,0,1,0,0),
(10,'FD-03','vacuum integrity and condenser recovery','pressure-rise results trending toward the leak-rate limit','high',2,1,0,1,1),
(11,'GEN-01','standby-power readiness and transfer stability','delayed voltage stabilisation after automatic transfer','stable',3,2,1,2,0),
(12,'LEAK-01','container integrity test repeatability and reject confirmation','reject confirmation response slowing after washdown','watch',4,0,0,0,1),
(13,'PW-01','thermal-disinfection performance and door-seal integrity','door-seal leakage during thermal disinfection','watch',1,1,1,1,0),
(14,'RABS-01','barrier integrity and airflow control','glove-leak pressure decay above the validated limit','high',2,2,0,2,1),
(15,'VF-03','crimp-force repeatability and capper synchronisation','star-wheel servo synchronisation faults after format change','high',3,0,1,0,0);

insert into public.work_orders (
  equipment_id,wo_number,priority,description,work_type,status,assigned_engineer,requested_date,due_date,
  completed_date,age_label,downtime_minutes,mttr_hours,outcome,is_overdue,fault_code,site_id,source_system,
  source_record_key,source_updated_at,order_type_code,order_type_description,
  maintenance_activity_type_code,maintenance_activity_type_description,order_origin,priority_code,
  functional_location_code,maintenance_plant,planner_group,main_work_center,basic_start_date,basic_finish_date,
  scheduled_start_at,scheduled_finish_at,actual_start_at,actual_finish_at,technical_completion_at,
  business_completion_at,system_status_codes,user_status_codes,source_created_at
)
select asset.id,
  'WO-R'||lpad(seed.seed_order::text,2,'0')||lpad(work.seq::text,2,'0'),
  case when seed.risk_mode='high' and work.seq=seed.extra_work_orders then 'CRITICAL'
       when work.seq%3=0 then 'HIGH' when work.seq%3=1 then 'MEDIUM' else 'LOW' end,
  case work.seq
    when 1 then asset.equipment_code||': Historical condition review for '||seed.operating_story||'. Inspection evidence was compared with the previous campaign and the approved baseline.'
    when 2 then asset.equipment_code||': Corrective intervention following '||seed.recurring_condition||'. The affected assembly was repaired and the release challenge passed.'
    when 3 then asset.equipment_code||': Reliability follow-up created after recurrence of '||seed.recurring_condition||'. Engineering ownership, spares and diagnostic evidence were confirmed.'
    else asset.equipment_code||': Planned outage task to improve '||seed.operating_story||'. Scope includes measurement verification, wear inspection and post-maintenance trending.'
  end,
  case work.seq when 1 then 'Inspection' when 2 then 'Corrective' when 3 then 'Predictive' else 'Preventive' end,
  case
    when work.seq<=2 then 'COMPLETED'
    when seed.risk_mode='high' and work.seq=seed.extra_work_orders then 'WAITING PARTS'
    when work.seq%2=0 then 'IN PROGRESS'
    else 'OPEN'
  end,
  coalesce(engineer.full_name,'Apex Engineering'),
  current_date-(seed.seed_order*9+work.seq*41+120),
  current_date-(seed.seed_order*7+work.seq*33+96),
  case when work.seq<=2 then current_date-(seed.seed_order*7+work.seq*33+90) end,
  case when work.seq<=2 then 'Completed' else (seed.seed_order+work.seq+5)::text||' days' end,
  case work.seq when 1 then 0 when 2 then 75 when 3 then 20 else 0 end,
  case work.seq when 1 then 1.5 when 2 then 3.2 when 3 then 1.0 else 4.5 end,
  case when work.seq<=2 then case work.seq when 1 then 'VERIFIED' else 'SUCCESS' end end,
  public.vorta_work_order_is_overdue(
    case when work.seq<=2 then 'COMPLETED' when seed.risk_mode='high' and work.seq=seed.extra_work_orders then 'WAITING PARTS' when work.seq%2=0 then 'IN PROGRESS' else 'OPEN' end,
    current_date-(seed.seed_order*7+work.seq*33+96)
  ),
  asset.equipment_code||'-F0'||case when work.seq%2=0 then '2' else '1' end,
  asset.site_id,'demo-realism','WREXHAM-REALISM-20260719-'||asset.equipment_code||'-WO-'||work.seq,now(),
  case when work.seq=1 then 'DM04' when work.seq=4 then 'DM02' else 'DM01' end,
  case when work.seq=1 then 'Demo inspection order' when work.seq=4 then 'Demo preventive maintenance order' else 'Demo corrective maintenance order' end,
  case when work.seq=1 then 'INSP' when work.seq=3 then 'PDM' when work.seq=4 then 'PM' else 'CORR' end,
  case when work.seq=1 then 'Condition inspection' when work.seq=3 then 'Predictive maintenance' when work.seq=4 then 'Preventive maintenance' else 'Corrective maintenance' end,
  case when work.seq=4 then 'Reliability improvement plan' else 'Maintenance history / notification' end,
  case when seed.risk_mode='high' and work.seq=seed.extra_work_orders then '1' when work.seq in (2,3) then '2' else '3' end,
  'WREX-'||upper(regexp_replace(asset.area,'[^A-Za-z0-9]+','-','g'))||'-'||asset.equipment_code,'WREX',
  case when asset.area='Utilities' then 'UTIL' when asset.area='Warehouse' then 'WHSE' else 'STER' end,
  case when asset.area='Utilities' then 'UTIL-WC' else 'MAINT-WC' end,
  current_date-(seed.seed_order*9+work.seq*41+120),
  current_date-(seed.seed_order*7+work.seq*33+96),
  (current_date-(seed.seed_order*9+work.seq*41+120))::timestamp+interval '8 hours',
  (current_date-(seed.seed_order*7+work.seq*33+96))::timestamp+interval '16 hours',
  case when work.seq<=2 then (current_date-(seed.seed_order*9+work.seq*41+120))::timestamp+interval '8 hours' end,
  case when work.seq<=2 then (current_date-(seed.seed_order*7+work.seq*33+90))::timestamp+interval '14 hours' end,
  case when work.seq<=2 then (current_date-(seed.seed_order*7+work.seq*33+90))::timestamp+interval '15 hours' end,
  case when work.seq<=2 then (current_date-(seed.seed_order*7+work.seq*33+89))::timestamp+interval '9 hours' end,
  case when work.seq<=2 then ARRAY['REL','CNF','TECO'] when seed.risk_mode='high' and work.seq=seed.extra_work_orders then ARRAY['REL','MSPT'] when work.seq%2=0 then ARRAY['REL','PCNF'] else ARRAY['CRTD','REL'] end,
  ARRAY['DEMO-REALISM'],
  (current_date-(seed.seed_order*9+work.seq*41+120))::timestamp
from private.demo_wrexham_realism_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
 and asset.equipment_code=seed.equipment_code
cross join lateral generate_series(1,seed.extra_work_orders) work(seq)
left join lateral (
  select engineer.full_name
  from public.equipment_engineer_capabilities capability
  join public.engineers engineer on engineer.id=capability.engineer_id
  where capability.equipment_id=asset.id
    and capability.capability_status='ACTIVE'
  order by case capability.capability_role when 'PRIMARY_SME' then 1 when 'BACKUP_SME' then 2 else 3 end
  limit 1
) engineer on true
on conflict do nothing;

insert into public.work_order_confirmations (
  site_id,work_order_id,confirmation_number,confirmation_counter,operation_number,confirmation_text,
  confirmed_by,personnel_number,work_center,posting_date,confirmation_timestamp,actual_work,work_unit,
  actual_duration,duration_unit,final_confirmation,source_system,source_record_key,source_updated_at
)
select work_order.site_id,work_order.id,'CNF-'||work_order.wo_number,'001','0010',
  work_order.description||' Engineering confirmation: isolation and permit controls were applied, the recorded task was completed, functional verification passed and the equipment was accepted back into service.',
  work_order.assigned_engineer,'REAL-'||right(work_order.wo_number,4),work_order.main_work_center,
  work_order.completed_date,work_order.actual_finish_at,coalesce(work_order.mttr_hours,1),'H',
  coalesce(work_order.mttr_hours,1),'H',true,'demo-realism',
  'WREXHAM-REALISM-20260719-CONF-'||work_order.wo_number,now()
from public.work_orders work_order
where work_order.site_id='11000000-0000-0000-0000-000000000001'::uuid
  and work_order.source_system='demo-realism'
  and work_order.status='COMPLETED'
on conflict (site_id,source_system,source_record_key) do update set
  confirmation_text=excluded.confirmation_text,
  confirmed_by=excluded.confirmed_by,
  posting_date=excluded.posting_date,
  confirmation_timestamp=excluded.confirmation_timestamp,
  actual_work=excluded.actual_work,
  actual_duration=excluded.actual_duration,
  final_confirmation=excluded.final_confirmation,
  source_updated_at=excluded.source_updated_at,
  updated_at=now();

insert into public.preventive_maintenance (
  equipment_id,pm_number,title,frequency,frequency_unit,pm_type,estimated_duration_minutes,
  last_completed_date,next_due_date,status,assigned_engineer,completion_percentage,criticality,
  procedure_ref,checklist_ref,site_id,source_system,source_record_key,source_updated_at,
  calibration_point,tolerance_specification,last_calibration_result,certificate_reference,calibration_result_at
)
select asset.id,'PM-R'||lpad(seed.seed_order::text,2,'0')||lpad(pm.seq::text,2,'0'),
  case pm.seq when 1 then asset.equipment_code||' reliability-condition review' else asset.equipment_code||' measurement-system verification' end,
  case pm.seq when 1 then 'Biannual' else 'Annual' end,
  case pm.seq when 1 then 'half-year' else 'year' end,
  case pm.seq when 1 then 'Inspection' else 'Calibration' end,
  case pm.seq when 1 then 150 else 210 end,
  current_date-(180+seed.seed_order*3+pm.seq*15),
  current_date+case when seed.risk_mode='high' then -seed.seed_order when seed.risk_mode='watch' then 7+seed.seed_order else 45+seed.seed_order end,
  public.vorta_effective_pm_status(
    'PLANNED',
    current_date+case when seed.risk_mode='high' then -seed.seed_order when seed.risk_mode='watch' then 7+seed.seed_order else 45+seed.seed_order end
  ),
  coalesce(engineer.full_name,'Apex Engineering'),0,
  case when asset.criticality='critical' then 'Critical' else 'High' end,
  'PROC-REAL-'||asset.equipment_code||'-'||pm.seq,
  'CHK-REAL-'||asset.equipment_code||'-'||pm.seq,
  asset.site_id,'demo-realism','WREXHAM-REALISM-20260719-'||asset.equipment_code||'-PM-'||pm.seq,now(),
  case when pm.seq=2 then asset.equipment_code||' critical measurement loop' end,
  case when pm.seq=2 then 'Within approved OEM and process validation tolerance' end,
  case when pm.seq=2 and seed.risk_mode='stable' then 'PASS' end,
  case when pm.seq=2 and seed.risk_mode='stable' then 'CAL-REAL-'||asset.equipment_code||'-2026' end,
  case when pm.seq=2 and seed.risk_mode='stable' then now()-interval '60 days' end
from private.demo_wrexham_realism_seed seed
join public.equipment_assets asset
  on asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
 and asset.equipment_code=seed.equipment_code
cross join lateral generate_series(1,seed.extra_pm_records) pm(seq)
left join lateral (
  select engineer.full_name
  from public.equipment_engineer_capabilities capability
  join public.engineers engineer on engineer.id=capability.engineer_id
  where capability.equipment_id=asset.id and capability.capability_status='ACTIVE'
  order by case capability.capability_role when 'PRIMARY_SME' then 1 else 2 end
  limit 1
) engineer on true
on conflict do nothing;
