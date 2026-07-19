-- Wrexham demo backend expansion. Sequential, idempotent stage.
-- Do not reorder these six migrations.

insert into public.work_orders (
  equipment_id,wo_number,priority,description,work_type,status,assigned_engineer,requested_date,due_date,
  completed_date,age_label,downtime_minutes,mttr_hours,outcome,is_overdue,fault_code,site_id,source_system,
  source_record_key,source_updated_at,preventive_maintenance_id,order_type_code,order_type_description,
  maintenance_activity_type_code,maintenance_activity_type_description,order_origin,priority_code,
  functional_location_code,maintenance_plant,planner_group,main_work_center,basic_start_date,basic_finish_date,
  scheduled_start_at,scheduled_finish_at,actual_start_at,actual_finish_at,technical_completion_at,
  business_completion_at,system_status_codes,user_status_codes,source_created_at
)
select seed.equipment_id,'WO-26'||lpad(seed.seed_order::text,2,'0')||lpad(work.seq::text,2,'0'),
  case when seed.criticality='critical' and work.seq in (1,5,6) then 'CRITICAL' when work.seq in (1,3,5,6) then 'HIGH' else 'MEDIUM' end,
  case work.seq
    when 1 then seed.equipment_code||': '||initcap(seed.issue_1)||'. Root cause confirmed, affected assembly restored and the approved functional challenge passed.'
    when 2 then seed.equipment_code||': Planned inspection completed. Safety devices, lubrication points, critical fasteners and operating trends checked against the approved procedure.'
    when 3 then seed.equipment_code||': Repeat condition involving '||seed.issue_3||'. The degraded component was replaced and post-maintenance verification returned to baseline.'
    when 4 then seed.equipment_code||': Annual calibration and measurement-loop verification completed against the approved tolerance specification.'
    when 5 then seed.equipment_code||': Investigation raised after '||seed.issue_2||'. Engineering assessment and controlled troubleshooting are required.'
    else seed.equipment_code||': Condition-monitoring follow-up for '||seed.issue_3||'. Parts, labour and procedure readiness recorded for planning.' end,
  case work.seq when 1 then 'Corrective' when 2 then 'Preventive' when 3 then 'Corrective' when 4 then 'Calibration' when 5 then 'Corrective' else 'Predictive' end,
  case when work.seq<=4 then 'COMPLETED' when work.seq=5 and seed.risk_mode='stable' then 'COMPLETED' when work.seq=5 then 'OPEN'
       when work.seq=6 and seed.risk_mode='stable' then 'OPEN' when work.seq=6 and seed.risk_mode='watch' then 'IN PROGRESS' else 'WAITING PARTS' end,
  engineer.full_name,
  current_date-case work.seq when 1 then 540 when 2 then 420 when 3 then 300 when 4 then 180 when 5 then 35 else 24 end,
  current_date-case work.seq when 1 then 530 when 2 then 410 when 3 then 290 when 4 then 170 when 5 then 21 else 10 end,
  case when work.seq<=4 then current_date-case work.seq when 1 then 533 when 2 then 414 when 3 then 294 else 174 end
       when work.seq=5 and seed.risk_mode='stable' then current_date-28 end,
  case when work.seq<=4 or (work.seq=5 and seed.risk_mode='stable') then 'Completed' when work.seq=5 then '35 days' else '24 days' end,
  case work.seq when 1 then 95 when 2 then 0 when 3 then 70 when 4 then 0 when 5 then 25 else 0 end,
  case work.seq when 1 then 2.4 when 2 then 3.5 when 3 then 2.0 when 4 then 2.5 when 5 then 1.2 else 0.8 end,
  case when work.seq<=4 or (work.seq=5 and seed.risk_mode='stable') then 'Work completed, verification passed and equipment released to service.' end,
  case when work.seq=5 and seed.risk_mode in ('watch','high') then true when work.seq=6 and seed.risk_mode='high' then true else false end,
  case when work.seq in (1,5) then seed.equipment_code||'-F01' when work.seq=3 then seed.equipment_code||'-F02' end,
  '11000000-0000-0000-0000-000000000001'::uuid,'demo-expansion','WREXHAM-EXP-20260719-'||seed.equipment_code||'-WO-'||work.seq,now(),
  case when work.seq=2 then pm_inspection.id when work.seq=4 then pm_calibration.id end,
  case work.seq when 2 then 'DM02' when 4 then 'DM03' else 'DM01' end,
  case work.seq when 2 then 'Demo preventive maintenance order' when 4 then 'Demo calibration order' else 'Demo corrective maintenance order' end,
  case work.seq when 2 then 'PM' when 4 then 'CAL' when 6 then 'PDM' else 'CORR' end,
  case work.seq when 2 then 'Preventive maintenance' when 4 then 'Calibration' when 6 then 'Predictive maintenance' else 'Corrective maintenance' end,
  case work.seq when 2 then 'Maintenance plan' when 4 then 'Calibration plan' else 'Maintenance notification / inspection' end,
  case when seed.criticality='critical' and work.seq in (1,5,6) then '1' when work.seq in (1,3,5,6) then '2' else '3' end,
  'WREX-'||upper(regexp_replace(seed.area,'[^A-Za-z0-9]+','-','g'))||'-'||seed.equipment_code,'WREX',
  case when seed.area='Utilities' then 'UTIL' when seed.area='Warehouse' then 'WHSE' else 'STER' end,
  case when work.seq=4 then 'CAL-WC' when seed.area='Utilities' then 'UTIL-WC' else 'MAINT-WC' end,
  current_date-case work.seq when 1 then 540 when 2 then 420 when 3 then 300 when 4 then 180 when 5 then 35 else 24 end,
  current_date-case work.seq when 1 then 530 when 2 then 410 when 3 then 290 when 4 then 170 when 5 then 21 else 10 end,
  (current_date-case work.seq when 1 then 540 when 2 then 420 when 3 then 300 when 4 then 180 when 5 then 35 else 24 end)::timestamp+interval '8 hours',
  (current_date-case work.seq when 1 then 540 when 2 then 420 when 3 then 300 when 4 then 180 when 5 then 35 else 24 end)::timestamp+interval '16 hours',
  case when work.seq<=4 or (work.seq=5 and seed.risk_mode='stable') then (current_date-case work.seq when 1 then 540 when 2 then 420 when 3 then 300 when 4 then 180 else 35 end)::timestamp+interval '8 hours' end,
  case when work.seq<=4 or (work.seq=5 and seed.risk_mode='stable') then (current_date-case work.seq when 1 then 533 when 2 then 414 when 3 then 294 when 4 then 174 else 28 end)::timestamp+interval '15 hours' end,
  case when work.seq<=4 or (work.seq=5 and seed.risk_mode='stable') then (current_date-case work.seq when 1 then 533 when 2 then 414 when 3 then 294 when 4 then 174 else 28 end)::timestamp+interval '16 hours' end,
  case when work.seq<=4 or (work.seq=5 and seed.risk_mode='stable') then (current_date-case work.seq when 1 then 532 when 2 then 413 when 3 then 293 when 4 then 173 else 27 end)::timestamp+interval '9 hours' end,
  case when work.seq<=4 or (work.seq=5 and seed.risk_mode='stable') then ARRAY['REL','CNF','TECO'] when work.seq=6 and seed.risk_mode='high' then ARRAY['REL','MSPT'] when work.seq=6 and seed.risk_mode='watch' then ARRAY['REL','PCNF'] else ARRAY['CRTD','REL'] end,
  ARRAY['DEMO'],(current_date-case work.seq when 1 then 540 when 2 then 420 when 3 then 300 when 4 then 180 when 5 then 35 else 24 end)::timestamp
from private.demo_wrexham_asset_seed seed cross join generate_series(1,6) work(seq)
left join public.engineers engineer on engineer.id=seed.engineer_ids[((work.seq-1)%3)+1]
left join public.preventive_maintenance pm_inspection on pm_inspection.site_id='11000000-0000-0000-0000-000000000001'::uuid and pm_inspection.pm_number='PM-26'||lpad(seed.seed_order::text,2,'0')||'01'
left join public.preventive_maintenance pm_calibration on pm_calibration.site_id='11000000-0000-0000-0000-000000000001'::uuid and pm_calibration.pm_number='PM-26'||lpad(seed.seed_order::text,2,'0')||'03'
on conflict do nothing;

insert into public.work_order_confirmations (
  site_id,work_order_id,confirmation_number,confirmation_counter,operation_number,confirmation_text,
  confirmed_by,personnel_number,work_center,posting_date,confirmation_timestamp,actual_work,work_unit,
  actual_duration,duration_unit,final_confirmation,source_system,source_record_key,source_updated_at
)
select work_order.site_id,work_order.id,'CNF-'||work_order.wo_number,'001','0010',
  work_order.description||' Engineering confirmation: isolations applied, task completed to the approved procedure, functional checks passed and the area owner accepted return to service.',
  work_order.assigned_engineer,'DEMO-'||right(work_order.wo_number,4),work_order.main_work_center,work_order.completed_date,
  work_order.actual_finish_at,coalesce(work_order.mttr_hours,1),'H',coalesce(work_order.mttr_hours,1),'H',true,
  'demo-expansion','WREXHAM-EXP-20260719-CONF-'||work_order.wo_number,now()
from public.work_orders work_order
join private.demo_wrexham_asset_seed seed on seed.equipment_id=work_order.equipment_id
where work_order.source_system='demo-expansion' and work_order.status='COMPLETED'
on conflict (site_id,source_system,source_record_key) do update set
  confirmation_text=excluded.confirmation_text,confirmed_by=excluded.confirmed_by,posting_date=excluded.posting_date,
  confirmation_timestamp=excluded.confirmation_timestamp,actual_work=excluded.actual_work,
  actual_duration=excluded.actual_duration,final_confirmation=excluded.final_confirmation,
  source_updated_at=excluded.source_updated_at,updated_at=now();

insert into public.maintenance_notifications (
  site_id,equipment_id,notification_number,notification_type_code,notification_type_description,short_text,long_text,
  priority_code,priority_description,status,malfunction_start_at,breakdown_indicator,reported_by,required_start_date,
  required_end_date,planner_group,maintenance_plant,main_work_center,functional_location_code,system_status_codes,
  user_status_codes,source_system,source_record_key,source_created_at,source_updated_at,workflow_status,converted_at,
  risk_points,risk_reason
)
select '11000000-0000-0000-0000-000000000001'::uuid,seed.equipment_id,'NT-26'||lpad(seed.seed_order::text,3,'0'),'M2','Malfunction report',
  seed.equipment_code||': '||initcap(seed.issue_2),
  'Operator report: '||seed.issue_2||'. The condition has repeated and requires engineering triage using the linked history, procedure and spare-parts evidence.',
  case when seed.risk_mode='high' then '1' else '2' end,case when seed.risk_mode='high' then 'Very high' else 'High' end,'OPEN',
  now()-interval '18 days',seed.risk_mode='high','Production shift team',current_date-14,current_date+3,
  case when seed.area='Utilities' then 'UTIL' when seed.area='Warehouse' then 'WHSE' else 'STER' end,'WREX',
  case when seed.area='Utilities' then 'UTIL-WC' else 'MAINT-WC' end,
  'WREX-'||upper(regexp_replace(seed.area,'[^A-Za-z0-9]+','-','g'))||'-'||seed.equipment_code,
  ARRAY['OSNO'],ARRAY['DEMO'],'demo-expansion','WREXHAM-EXP-20260719-'||seed.equipment_code||'-NOTIF',
  now()-interval '18 days',now(),case when seed.risk_mode='watch' then 'CONVERTED' else 'AWAITING_WORK_ORDER' end,
  case when seed.risk_mode='watch' then now()-interval '16 days' end,case when seed.risk_mode='high' then 72 else 42 end,
  case when seed.risk_mode='high' then 'Critical/high asset with a repeated condition awaiting executable work.' else 'Repeated condition converted to a linked corrective work order.' end
from private.demo_wrexham_asset_seed seed where seed.risk_mode in ('watch','high')
on conflict do nothing;

insert into public.maintenance_order_notification_links (
  site_id,work_order_id,maintenance_notification_id,is_primary_notification,source_system,source_record_key,source_updated_at
)
select notification.site_id,work_order.id,notification.id,true,'demo-expansion','WREXHAM-EXP-20260719-LINK-'||seed.equipment_code,now()
from private.demo_wrexham_asset_seed seed
join public.maintenance_notifications notification on notification.site_id='11000000-0000-0000-0000-000000000001'::uuid and notification.notification_number='NT-26'||lpad(seed.seed_order::text,3,'0')
join public.work_orders work_order on work_order.site_id=notification.site_id and work_order.wo_number='WO-26'||lpad(seed.seed_order::text,2,'0')||'05'
where seed.risk_mode='watch'
on conflict (work_order_id,maintenance_notification_id) do nothing;

update public.work_orders work_order set primary_notification_number=notification.notification_number,updated_at=now()
from private.demo_wrexham_asset_seed seed
join public.maintenance_notifications notification on notification.site_id='11000000-0000-0000-0000-000000000001'::uuid and notification.notification_number='NT-26'||lpad(seed.seed_order::text,3,'0')
where seed.risk_mode='watch' and work_order.site_id=notification.site_id and work_order.wo_number='WO-26'||lpad(seed.seed_order::text,2,'0')||'05';
