-- VOR-033 Phase 2A: remove remaining visible seed language and establish six connected demonstration storylines.

create table if not exists private.vorta_demo_storylines (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id),
  story_key text not null,
  title text not null,
  summary text not null,
  manager_value text not null,
  equipment_code text not null,
  work_order_number text not null,
  notification_number text,
  pm_number text not null,
  component_code text not null,
  document_title text not null,
  skill_name text not null,
  engineer_name text not null,
  question_prompts text[] not null default '{}'::text[],
  expected_findings jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (site_id, story_key)
);

revoke all on table private.vorta_demo_storylines from public, anon, authenticated;
grant select, insert, update, delete on table private.vorta_demo_storylines to service_role;

select private.vorta_capture_demo_dataset_baseline_internal(
  '11000000-0000-0000-0000-000000000001'::uuid,
  'vor-033-before-storyline-enrichment',
  current_date
);

with asset_updates(equipment_code, model, description) as (
  values
    ('AGV-01',null,'Autonomous pallet transport vehicle serving finished-goods staging and warehouse movements, including navigation safety, battery health and fleet communications.'),
    ('AHU-01','Grade B Supply AHU','Primary supply and environmental-control asset for Grade B Fill-Finish rooms, maintaining airflow, temperature, humidity and the validated pressure cascade.'),
    ('AUT-01','AMSCO 1','Steam steriliser serving sterile preparation loads, with chamber pressure, temperature, door interlocks and cycle-recording controls.'),
    ('AUT-02','AMSCO 2','Steam steriliser serving sterile preparation loads, with chamber pressure, temperature, door interlocks and cycle-recording controls.'),
    ('BMS-01',null,'Site building-management platform supervising critical utilities, cleanroom environmental conditions, alarms and engineering trends.'),
    ('CART-02',null,'Secondary-packaging cartoner for Packaging Line 2, including product feed, leaflet insertion, coding, guarding and reject verification.'),
    ('CIP-01',null,'Four-tank clean-in-place skid supplying controlled cleaning cycles to production equipment, with flow, temperature, conductivity and return-path verification.'),
    ('COLD-01','Cold Chain Monitoring','Cold-store monitoring system providing dual-probe temperature measurement, local alarming, communications and continuous cold-chain records.'),
    ('FD-01','LYOSTAR 1','Production freeze dryer supporting lyophilised batches, with vacuum, refrigeration, shelf-temperature and condenser-defrost control.'),
    ('FD-02','LYOSTAR 2','Production freeze dryer supporting lyophilised batches, with vacuum, refrigeration, shelf-temperature and condenser-defrost control.'),
    ('GEN-01',null,'Standby generator protecting critical site services during mains failure, including automatic start, load transfer, fuel and battery systems.'),
    ('LB-01','Label Application System','Packaging-line labeller controlling label presentation, print verification, product detection, reject confirmation and guarding.'),
    ('LEAK-01',null,'Container leak-test system verifying closure integrity on Inspection Line 1 using controlled test pressure, reject logic and audit records.'),
    ('PSG-01','Pure Steam Generator','Pure-steam generator supporting sterile processing, with feedwater, separator, pressure, conductivity and quality-monitoring controls.'),
    ('RABS-01',null,'Restricted-access barrier system protecting the vial filling zone through glove integrity, door interlocks, airflow control and environmental monitoring.'),
    ('SC-01','Serialisation Cartoner','Serialisation cartoner combining product handling, coding, vision verification, aggregation, guarding and reject control.'),
    ('VF-01','FLC Line 1','Aseptic vial filling line with sterile product path, infeed handling, filling, stoppering, guarding, reject verification and batch controls.'),
    ('VF-02','FLC Line 2','Aseptic vial filling line with sterile product path, infeed handling, filling, stoppering, guarding, reject verification and batch controls.'),
    ('VI-01','Vision Inspection Line 1','Automated vial inspection system checking cosmetic and particulate defects through controlled handling, lighting, cameras and reject verification.'),
    ('WFI-01','WFI Generation Skid','Water-for-injection generation and recirculation plant controlling purification, temperature, conductivity, UV treatment and distribution-loop quality.'),
    ('WMS-02','Warehouse Barcode Platform','Warehouse barcode platform supporting receipt, location, picking and dispatch verification through scanners, printers, network services and SAP interfaces.')
)
update public.equipment_assets asset
set model = coalesce(asset_updates.model, asset.model),
    description = asset_updates.description,
    updated_at = now()
from asset_updates
where asset.site_id = '11000000-0000-0000-0000-000000000001'::uuid
  and asset.equipment_code = asset_updates.equipment_code;

-- Complete code replacement across arrays and JSON evidence that the initial migration did not inspect.
do $$
declare mapping record;
begin
  for mapping in
    select old_code, new_code
    from private.vorta_demo_equipment_code_map
    where site_id = '11000000-0000-0000-0000-000000000001'::uuid
  loop
    update public.knowledge_documents
    set source_document_id = replace(coalesce(source_document_id,''), mapping.old_code, mapping.new_code),
        source_path = nullif(replace(coalesce(source_path,''), mapping.old_code, mapping.new_code),''),
        source_url = nullif(replace(coalesce(source_url,''), mapping.old_code, mapping.new_code),''),
        file_id = nullif(replace(coalesce(file_id,''), mapping.old_code, mapping.new_code),''),
        external_reference = nullif(replace(coalesce(external_reference,''), mapping.old_code, mapping.new_code),''),
        drawing_number = nullif(replace(coalesce(drawing_number,''), mapping.old_code, mapping.new_code),''),
        title = replace(title, mapping.old_code, mapping.new_code),
        summary = nullif(replace(coalesce(summary,''), mapping.old_code, mapping.new_code),''),
        extracted_summary = nullif(replace(coalesce(extracted_summary,''), mapping.old_code, mapping.new_code),''),
        manual_section = nullif(replace(coalesce(manual_section,''), mapping.old_code, mapping.new_code),''),
        fault_codes = case when fault_codes is null then null else array(select replace(value,mapping.old_code,mapping.new_code) from unnest(fault_codes) item(value)) end,
        component_tags = case when component_tags is null then null else array(select replace(value,mapping.old_code,mapping.new_code) from unnest(component_tags) item(value)) end,
        metadata = case when metadata is null then null else replace(metadata::text,mapping.old_code,mapping.new_code)::jsonb end,
        updated_at = now()
    where site_id = '11000000-0000-0000-0000-000000000001'::uuid
      and concat_ws(' ',source_document_id,source_path,source_url,file_id,external_reference,drawing_number,title,summary,extracted_summary,manual_section,array_to_string(fault_codes,' '),array_to_string(component_tags,' '),metadata::text) like '%'||mapping.old_code||'%';

    update public.knowledge_chunks chunk
    set chunk_ref = replace(chunk_ref,mapping.old_code,mapping.new_code),
        section_title = nullif(replace(coalesce(section_title,''),mapping.old_code,mapping.new_code),''),
        chunk_text = replace(chunk_text,mapping.old_code,mapping.new_code),
        drawing_number = nullif(replace(coalesce(drawing_number,''),mapping.old_code,mapping.new_code),''),
        source_url = nullif(replace(coalesce(source_url,''),mapping.old_code,mapping.new_code),''),
        external_reference = nullif(replace(coalesce(external_reference,''),mapping.old_code,mapping.new_code),''),
        keywords = case when keywords is null then null else array(select replace(value,mapping.old_code,mapping.new_code) from unnest(keywords) item(value)) end,
        fault_codes = case when fault_codes is null then null else array(select replace(value,mapping.old_code,mapping.new_code) from unnest(fault_codes) item(value)) end,
        component_tags = case when component_tags is null then null else array(select replace(value,mapping.old_code,mapping.new_code) from unnest(component_tags) item(value)) end,
        metadata = case when metadata is null then null else replace(metadata::text,mapping.old_code,mapping.new_code)::jsonb end,
        updated_at = now()
    from public.equipment_assets asset
    where asset.id = chunk.equipment_id
      and asset.site_id = '11000000-0000-0000-0000-000000000001'::uuid
      and concat_ws(' ',chunk.chunk_ref,chunk.section_title,chunk.chunk_text,chunk.drawing_number,chunk.source_url,chunk.external_reference,array_to_string(chunk.keywords,' '),array_to_string(chunk.fault_codes,' '),array_to_string(chunk.component_tags,' '),chunk.metadata::text) like '%'||mapping.old_code||'%';
  end loop;
end;
$$;

with work_updates(wo_number, description) as (
  values
    ('WO-26-0001','CC-01: Investigate closure-test pressure drift, verify the calibrated reference and repeat the approved leak-standard challenge.'),
    ('WO-26-0002','VI-01: Review camera focus and illumination drift, then challenge particle and cosmetic-defect detection with qualified standards.'),
    ('WO-26-0003','RI-01: Completed inspection-booth lighting and magnification verification; measured lux levels and reject recording met the approved standard.'),
    ('WO-26-0004','VI-03: Check vial rotation, camera timing and reject tracking after an increase in unclassified inspection rejects.'),
    ('WO-26-0005','CP-01: Check case-transfer guides, guard switches and carton-presence sensors after intermittent product skew at the discharge conveyor.'),
    ('WO-26-0006','LB-01: Investigate label-web tracking drift and verify product sensor, peel-plate alignment and reject confirmation before the next packaging campaign.'),
    ('WO-26-0007','SC-01: Verify serialisation camera trigger, carton handling and reject confirmation following two unread-code stops during line clearance.'),
    ('WO-26-0008','PAL-02: Completed robot-cell guard, pallet-presence sensor and gripper inspection; challenge test passed with no repeat handling faults.'),
    ('WO-26-0009','COLD-01: Calibrate the reference temperature channel, compare both store probes and confirm alarm transmission after intermittent probe disagreement.'),
    ('WO-26-0010','WMS-02: Trace intermittent handheld-scanner disconnects through access-point coverage, device logs and SAP message acknowledgements.'),
    ('WO-26-0011','DOCK-01: Inspect platform hinge, hydraulic power pack, lip sensors and vehicle-restraint interlock after slow leveller return.'),
    ('WO-26-0012','WMS-01: Completed outbound-interface reconciliation and queue recovery test; delayed warehouse confirmations cleared without duplicate postings.'),
    ('WO-260705','FD-03: Condenser defrost time increased from 34 to 49 minutes across three batches. Inspect refrigeration performance, defrost-valve feedback and condenser temperature recovery before the next campaign.'),
    ('WO-260706','FD-03: Vacuum-pump motor current reached 18.6 A against a 15.0 A baseline. Complete pump-condition checks and replace the vacuum-pump control I/O module when FD-03-PLC-01 is available.'),
    ('WO-261005','RABS-01: Door-interlock input dropped out twice after cleaning. Inspect switch alignment, cable continuity and safety-logic diagnostics before line release.'),
    ('WO-261006','RABS-01: Replace the intermittent door-interlock safety I/O module and repeat the validated interlock and airflow recovery challenge when RABS-01-PLC-01 is available.'),
    ('WO-250467','VF-02: Replace reject-station sensor VF02-SENS-014, restore minimum stock and repeat the ten-vial reject challenge before the next sterile campaign.'),
    ('WO-250414','WFI-01: Replace conductivity sensor WFI1-COND-001 after repeated positive bias against the grab sample; recalibrate the loop and confirm USP alarm response.'),
    ('WO-250447','AHU-01: Replace HEPA differential-pressure transmitter HVAC-DP-001 after upper-range drift; verify BMS indication and the Grade B pressure cascade.'),
    ('WO-T0302','COLD-01: Dual store probes differed by 1.3 °C during defrost recovery. Compare both channels with the calibrated reference and replace the probe assembly if the deviation repeats.')
)
update public.work_orders work_order
set description = work_updates.description,
    updated_at = now(),
    source_updated_at = now()
from work_updates
where work_order.site_id = '11000000-0000-0000-0000-000000000001'::uuid
  and work_order.wo_number = work_updates.wo_number;

with component_updates(component_code, component_name) as (
  values
    ('FD-03-PLC-01','Vacuum Pump Control I/O Module'),
    ('RABS-01-PLC-01','Door Interlock Safety I/O Module'),
    ('COLD-01-SEN-C01','Dual-Channel Temperature Probe Assembly')
)
update public.equipment_components component
set component_name = component_updates.component_name, updated_at = now()
from component_updates
where component.site_id = '11000000-0000-0000-0000-000000000001'::uuid
  and component.component_code = component_updates.component_code;

insert into private.vorta_demo_storylines (
  site_id, story_key, title, summary, manager_value, equipment_code, work_order_number,
  notification_number, pm_number, component_code, document_title, skill_name, engineer_name,
  question_prompts, expected_findings, active, updated_at
)
values
('11000000-0000-0000-0000-000000000001','fd03-vacuum-and-defrost-recovery','FD-03 vacuum and condenser recovery','A critical freeze dryer has worsening condenser recovery, elevated vacuum-pump current, five overdue maintenance activities and a 90-day stockout on the required control module.','Shows how Vorta connects an operating trend, notification backlog, PM exposure, specialist capability and a blocked spare into one executable intervention.','FD-03','WO-260706','NT-26007','PM-260704','FD-03-PLC-01','FD-03 Approved Fault-Finding Guide','Vacuum Systems','Nia Roberts',array['Why is FD-03 the highest-risk asset?','What is blocking the FD-03 intervention?','Who is qualified to diagnose the FD-03 vacuum system?','Which document and maintenance history should the engineer use?'],jsonb_build_object('primaryDriver','Spares','measuredFinding','Vacuum-pump current 18.6 A versus 15.0 A baseline','expectedAction','Release the module purchase and execute WO-260706 with the approved fault guide'),true,now()),
('11000000-0000-0000-0000-000000000001','rabs01-interlock-recovery','RABS-01 interlock recovery','The filling barrier has an intermittent door-interlock input, overdue qualification work and no spare safety I/O module, while validated HVAC and calibration capability is available.','Demonstrates that a high asset score is traceable through notification, work order, qualification, specialist capability, controlled guidance and spare readiness.','RABS-01','WO-261006','NT-26010','PM-261004','RABS-01-PLC-01','RABS-01 Approved Fault-Finding Guide','HVAC Validation','Natalie Morgan',array['What is driving RABS-01 risk?','Can RABS-01 be safely released for the next campaign?','Who can authorise the RABS airflow and interlock verification?','What action gives the largest immediate risk reduction?'],jsonb_build_object('primaryDriver','Spares','measuredFinding','Interlock input dropped out twice after cleaning','expectedAction','Procure RABS-01-PLC-01 and repeat the validated interlock and airflow challenge'),true,now()),
('11000000-0000-0000-0000-000000000001','vf02-reject-sensor-recovery','VF-02 reject sensor recovery','The vial filler has recurring F-204 false rejects, overdue reject-system work and an out-of-stock replacement sensor, but the fault history, PM instruction, calibration record and qualified engineers are connected.','Provides the clearest end-to-end demonstration from dashboard risk through repeat-fault evidence, stock constraint, work plan, documents and qualified labour.','VF-02','WO-250467','N-260002','PM-VF02-SENSOR-CAL-M','VF02-SENS-014','VF-02 Reject Station Fault-Finding Guide','Bosch Vial Fillers','James Mitchell',array['Why does VF-02 keep generating false rejects?','Which spare is preventing a permanent VF-02 repair?','Which engineer can lead the VF-02 intervention?','What evidence confirms the repair before production restart?'],jsonb_build_object('primaryDriver','Spares','faultCode','F-204','expectedAction','Replace VF02-SENS-014 and pass the ten-vial reject challenge'),true,now()),
('11000000-0000-0000-0000-000000000001','wfi01-conductivity-recovery','WFI-01 conductivity recovery','The WFI loop has recurring positive conductivity bias, a waiting-parts corrective order and zero stock of the approved USP sensor, with current calibration and fault guidance available.','Shows how quality-critical process evidence, instrument calibration, stock exposure and authorised clean-utilities capability combine into a defensible decision.','WFI-01','WO-250414',null,'PM-WFI-COND-WK','WFI1-COND-001','WFI Conductivity and Loop Temperature Fault-Finding Guide','Conductivity Monitoring','Priya Shah',array['What caused the WFI conductivity excursion?','Is the WFI-01 reading or the grab sample more credible?','Who can replace and verify the WFI conductivity sensor?','What checks are required before returning the loop to normal monitoring?'],jsonb_build_object('primaryDriver','Spares','faultCode','WFI-COND-301','expectedAction','Replace WFI1-COND-001, recalibrate and verify USP alarm response'),true,now()),
('11000000-0000-0000-0000-000000000001','ahu01-hepa-dp-recovery','AHU-01 HEPA differential-pressure recovery','The Grade B AHU has a drifting HEPA differential-pressure transmitter, overdue environmental verification and no replacement transmitter, while independent reference monitoring protects the immediate operating decision.','Demonstrates risk control rather than alarmism: Vorta distinguishes the failed indication from the stable reference and shows the controlled corrective path.','AHU-01','WO-250447',null,'PM-HVAC-HEPA-CAL','HVAC-DP-001','AHU-01 HEPA Differential Pressure Fault-Finding Guide','Pressure Instrument Calibration','Nia Roberts',array['Is the Grade B room currently at risk or is the transmitter faulty?','What is blocking permanent correction of AHU-01?','Who can calibrate and verify the replacement DP transmitter?','What evidence is required to confirm the pressure cascade after repair?'],jsonb_build_object('primaryDriver','Spares','faultCode','AHU-DP-104','expectedAction','Replace HVAC-DP-001 and verify BMS indication against the calibrated reference'),true,now()),
('11000000-0000-0000-0000-000000000001','cold01-probe-and-handover','COLD-01 probe disagreement and handover','Cold-store probes disagree during defrost recovery, the calibration task is overdue and the replacement dual-channel assembly is out of stock, creating a concise handover and calibration story.','Connects an in-progress investigation to calibration evidence, specialist ownership, spare readiness and the next-shift action without inventing a breakdown.','COLD-01','WO-T0302',null,'PM-COLD-PROBE-CAL','COLD-01-SEN-C01','COLD-01 Approved Diagnostic and Recovery Guide','Environmental Monitoring Systems','Gareth Owen',array['What should the next shift know about COLD-01?','How large was the probe disagreement and when did it occur?','Who can verify the cold-store monitoring system?','What is the next safe action if the probe deviation repeats?'],jsonb_build_object('primaryDriver','Calibration','measuredFinding','Dual probes differed by 1.3 °C during defrost recovery','expectedAction','Compare both channels with the calibrated reference and replace COLD-01-SEN-C01 if repeated'),true,now())
on conflict (site_id, story_key) do update set
  title=excluded.title, summary=excluded.summary, manager_value=excluded.manager_value,
  equipment_code=excluded.equipment_code, work_order_number=excluded.work_order_number,
  notification_number=excluded.notification_number, pm_number=excluded.pm_number,
  component_code=excluded.component_code, document_title=excluded.document_title,
  skill_name=excluded.skill_name, engineer_name=excluded.engineer_name,
  question_prompts=excluded.question_prompts, expected_findings=excluded.expected_findings,
  active=excluded.active, updated_at=now();

create or replace function private.vorta_apply_demo_storyline_narratives_internal(p_site_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path to 'pg_catalog','public','private'
as $$
begin
  update public.equipment_risk_profiles profile
  set risk_summary = case asset.equipment_code
      when 'FD-03' then 'Condenser recovery and vacuum-pump current have worsened while five maintenance activities are overdue. The leading intervention is blocked by a 90-day stockout on the vacuum-pump control I/O module.'
      when 'RABS-01' then 'Intermittent door-interlock input, overdue qualification and an unavailable safety I/O module combine to create a critical barrier-system risk.'
      when 'VF-02' then 'Recurring F-204 false rejects, overdue reject-system work and zero stock of sensor VF02-SENS-014 are preventing a permanent repair.'
      when 'WFI-01' then 'Repeated positive conductivity bias has been confirmed against the grab sample. Permanent correction is waiting for USP sensor WFI1-COND-001.'
      when 'AHU-01' then 'The HEPA DP indication drifts at the upper range while the calibrated reference remains stable. Permanent correction is blocked by transmitter HVAC-DP-001.'
      when 'COLD-01' then 'The dual cold-store probes differed by 1.3 °C during defrost recovery. Calibration is overdue and the replacement probe assembly is unavailable.'
      else profile.risk_summary end,
    priority_action = case asset.equipment_code
      when 'FD-03' then 'Release the FD-03-PLC-01 purchase, then complete WO-260706 using the approved vacuum-system fault guide.'
      when 'RABS-01' then 'Procure RABS-01-PLC-01 and repeat the validated interlock and airflow recovery challenge.'
      when 'VF-02' then 'Restore VF02-SENS-014 stock, replace the sensor and pass the ten-vial reject challenge.'
      when 'WFI-01' then 'Replace WFI1-COND-001, recalibrate the conductivity loop and verify USP alarm response.'
      when 'AHU-01' then 'Replace HVAC-DP-001 and verify the BMS indication and Grade B pressure cascade against the calibrated reference.'
      when 'COLD-01' then 'Compare both probe channels with the calibrated reference and replace COLD-01-SEN-C01 if the deviation repeats.'
      else profile.priority_action end,
    updated_at = now()
  from public.equipment_assets asset
  where asset.id = profile.equipment_id
    and asset.site_id = p_site_id
    and asset.equipment_code in ('FD-03','RABS-01','VF-02','WFI-01','AHU-01','COLD-01');
end;
$$;

revoke all on function private.vorta_apply_demo_storyline_narratives_internal(uuid) from public, anon, authenticated;
grant execute on function private.vorta_apply_demo_storyline_narratives_internal(uuid) to service_role;

select public.vorta_recalculate_equipment_risk_profiles();
select public.vorta_sync_equipment_risk_counts();
select public.vorta_recalculate_area_risk_profiles();
select public.vorta_recalculate_site_risk_profile();
select public.vorta_sync_maintenance_risk_work_plan();
select private.vorta_apply_demo_storyline_narratives_internal('11000000-0000-0000-0000-000000000001'::uuid);
