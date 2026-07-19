-- Wrexham demo backend expansion. Sequential, idempotent stage.
-- Do not reorder these six migrations.

-- Expand the Apex Wrexham demo backend with coherent, linked maintenance data.
-- Scope: demo data only. No schema, RLS, auth or production-user changes.

drop table if exists private.demo_wrexham_asset_seed;

create unlogged table private.demo_wrexham_asset_seed (
  seed_order integer primary key,
  equipment_id uuid not null,
  is_new boolean not null,
  equipment_code text not null,
  equipment_name text not null,
  department_id uuid not null,
  equipment_type text not null,
  category text not null,
  area text not null,
  line text not null,
  oem text not null,
  model text not null,
  criticality text not null,
  risk_mode text not null check (risk_mode in ('stable','watch','high')),
  issue_1 text not null,
  issue_2 text not null,
  issue_3 text not null,
  asset_description text not null,
  skill_names text[] not null,
  engineer_ids uuid[] not null
);

insert into private.demo_wrexham_asset_seed values
(1,'25862bbb-e6b7-47d0-b987-f1985d8a4a81'::uuid,false,'CDA-01','Atlas Copco Clean Air Compressor CDA-01','12000000-0000-0000-0000-000000000002'::uuid,'Oil-free compressor','Clean Utilities','Utilities','Clean Utilities','Atlas Copco','ZT 55 VSD','high','watch','interstage temperature drift caused by a fouled aftercooler','dew-point excursions traced to dryer purge-valve leakage','increased vibration at the high-pressure element','Atlas Copco Clean Air Compressor CDA-01 supporting the Clean Utilities operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['Compressed Air Systems','Electrical Fault Finding','Mechanical Fault Finding','Pharmaceutical Calibration','Allen Bradley PLC']::text[],ARRAY['20000000-0000-0000-0000-000000000002'::uuid,'20000000-0000-0000-0000-000000000019'::uuid,'20000000-0000-0000-0000-000000000003'::uuid]::uuid[]),
(2,'7d75a300-3299-4d81-8833-98be8ac90c0e'::uuid,false,'CHW-01','Trane Process Chiller CHW-01','12000000-0000-0000-0000-000000000002'::uuid,'Process chiller','Utilities','Utilities','Clean Utilities','Trane','Sintesis RTAF','high','watch','low evaporator approach temperature caused by restricted water flow','condenser fan drive alarms during high ambient load','refrigerant circuit vibration above baseline','Trane Process Chiller CHW-01 supporting the Clean Utilities operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['Refrigeration','HVAC','Electrical Fault Finding','Mechanical Fault Finding','Pharmaceutical Calibration']::text[],ARRAY['20000000-0000-0000-0000-000000000038'::uuid,'20000000-0000-0000-0000-000000000008'::uuid,'20000000-0000-0000-0000-000000000004'::uuid]::uuid[]),
(3,'40000000-0000-0000-0000-000000000009'::uuid,false,'DEMO-AUT-001','Steris Autoclave A-01','12000000-0000-0000-0000-000000000002'::uuid,'Steam steriliser','Sterile Manufacturing','Sterile Prep','Autoclave Bay','Steris','AMSCO Demo 1','high','stable','door-lock proving delayed after washdown','vacuum pull-down time increased during porous-load cycles','chamber temperature channel disagreement during heat-up','Steris Autoclave A-01 supporting the Autoclave Bay operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['Steris Autoclaves','Clean Steam Systems','Pharmaceutical Calibration','Electrical Fault Finding','Mechanical Fault Finding']::text[],ARRAY['20000000-0000-0000-0000-000000000003'::uuid,'20000000-0000-0000-0000-000000000021'::uuid,'20000000-0000-0000-0000-000000000006'::uuid]::uuid[]),
(4,'7c09b1b6-bffc-437a-8895-ae15b640eb70'::uuid,false,'ALUS-01','GEA Automatic Loading System ALUS-01','12000000-0000-0000-0000-000000000001'::uuid,'Automatic loading system','Lyophilisation','Lyophilisation','Lyophilisation Suite','GEA','ALUS','high','watch','carrier-position tolerance drift at the freeze-dryer interface','transfer shuttle servo following error during high-speed loading','intermittent tray-presence sensor loss','GEA Automatic Loading System ALUS-01 supporting the Lyophilisation Suite operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['GEA Freeze Dryers','Robotics','Siemens PLC','Electrical Fault Finding','Mechanical Fault Finding']::text[],ARRAY['20000000-0000-0000-0000-000000000001'::uuid,'20000000-0000-0000-0000-000000000003'::uuid,'20000000-0000-0000-0000-000000000020'::uuid]::uuid[]),
(5,'40000000-0000-0000-0000-000000000002'::uuid,false,'DEMO-FD-001','GEA Freeze Dryer FD-01','12000000-0000-0000-0000-000000000001'::uuid,'Freeze dryer','Lyophilisation','Lyophilisation','Freeze Dryer Suite','GEA','Lyostar Demo 1','high','stable','vacuum pull-down slowed by condenser ice loading','shelf-temperature uniformity approached the validated limit','hydraulic stoppering pressure decayed during hold','GEA Freeze Dryer FD-01 supporting the Freeze Dryer Suite operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['GEA Freeze Dryers','Pharmaceutical Calibration','Siemens PLC','Electrical Fault Finding','Mechanical Fault Finding']::text[],ARRAY['20000000-0000-0000-0000-000000000003'::uuid,'20000000-0000-0000-0000-000000000021'::uuid,'20000000-0000-0000-0000-000000000020'::uuid]::uuid[]),
(6,'46a2317f-ec89-4b70-bbcb-ae8624a3e220'::uuid,false,'DH-01','Fedegari Depyrogenation Oven DO-01','12000000-0000-0000-0000-000000000001'::uuid,'Depyrogenation oven','Sterile Manufacturing','Sterile Prep','Sterile Preparation Suite','Fedegari','FOD','critical','high','heating-zone recovery time exceeded the established baseline','HEPA differential pressure approached the action limit','conveyor speed feedback became unstable during sterilisation','Fedegari Depyrogenation Oven DO-01 supporting the Sterile Preparation Suite operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['HVAC Validation','Pharmaceutical Calibration','Siemens PLC','Electrical Fault Finding','Mechanical Fault Finding']::text[],ARRAY['20000000-0000-0000-0000-000000000006'::uuid,'20000000-0000-0000-0000-000000000021'::uuid,'20000000-0000-0000-0000-000000000004'::uuid]::uuid[]),
(7,'3ac1ed76-90a9-4ebd-97d6-3898b7ecad33'::uuid,false,'FD-03','GEA Freeze Dryer FD-03','12000000-0000-0000-0000-000000000001'::uuid,'Freeze dryer','Lyophilisation','Lyophilisation','Lyophilisation Suite','GEA','LYOVAC FCM','critical','high','pressure-rise test results trended toward the leak-rate limit','condenser defrost duration increased over successive batches','vacuum-pump current rose above the seasonal baseline','GEA Freeze Dryer FD-03 supporting the Lyophilisation Suite operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['GEA Freeze Dryers','Pharmaceutical Calibration','Siemens PLC','Electrical Fault Finding','Mechanical Fault Finding']::text[],ARRAY['20000000-0000-0000-0000-000000000003'::uuid,'20000000-0000-0000-0000-000000000020'::uuid,'20000000-0000-0000-0000-000000000021'::uuid]::uuid[]),
(8,'9be188fa-eb22-4893-92c7-28c33fab1afc'::uuid,false,'PW-01','Getinge Parts Washer PW-01','12000000-0000-0000-0000-000000000001'::uuid,'Parts washer','Sterile Manufacturing','Sterile Prep','Sterile Preparation Suite','Getinge','GEW 888','high','watch','final-rinse conductivity clearance was delayed','rotary spray-arm pressure fell below target','door-seal leakage appeared during thermal disinfection','Getinge Parts Washer PW-01 supporting the Sterile Preparation Suite operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['Steris Washer Disinfectors','Purified Water Systems','Pharmaceutical Calibration','Electrical Fault Finding','Mechanical Fault Finding']::text[],ARRAY['20000000-0000-0000-0000-000000000002'::uuid,'20000000-0000-0000-0000-000000000003'::uuid,'20000000-0000-0000-0000-000000000021'::uuid]::uuid[]),
(9,'9e3cdf0f-94a5-47a8-b369-d3712a27309b'::uuid,false,'VF-03','Syntegon Vial Capper VC-01','12000000-0000-0000-0000-000000000001'::uuid,'Vial capper','Sterile Filling','Fill-Finish','Vial Filling Line 1','Syntegon','VRK 4010','critical','high','cap-presence rejects increased after format change','crimp-force variation approached the validated limit','star-wheel servo synchronisation faulted intermittently','Syntegon Vial Capper VC-01 supporting the Vial Filling Line 1 operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['Bosch Vial Fillers','Machine Vision','Siemens PLC','Electrical Fault Finding','Mechanical Fault Finding']::text[],ARRAY['20000000-0000-0000-0000-000000000001'::uuid,'20000000-0000-0000-0000-000000000016'::uuid,'20000000-0000-0000-0000-000000000003'::uuid]::uuid[]),
(10,'41000000-0000-0000-0000-000000000001'::uuid,true,'RABS-01','SKAN RABS Isolator RABS-01','12000000-0000-0000-0000-000000000001'::uuid,'Restricted access barrier system','Sterile Filling','Fill-Finish','Vial Line 1','SKAN','RABS 700','critical','high','glove-leak test pressure decayed above the validated limit','door-interlock sequencing became intermittent after cleaning','unidirectional airflow velocity trended low at the transfer zone','SKAN RABS Isolator RABS-01 supporting the Vial Line 1 operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['HVAC Validation','Pharmaceutical Calibration','Siemens PLC','Electrical Fault Finding','Mechanical Fault Finding']::text[],ARRAY['20000000-0000-0000-0000-000000000006'::uuid,'20000000-0000-0000-0000-000000000021'::uuid,'20000000-0000-0000-0000-000000000001'::uuid]::uuid[]),
(11,'41000000-0000-0000-0000-000000000002'::uuid,true,'CIP-01','GEA Clean-in-Place Skid CIP-01','12000000-0000-0000-0000-000000000002'::uuid,'CIP skid','Clean Utilities','Utilities','Clean Utilities','GEA','CIP 4-Tank','high','watch','return conductivity endpoint was reached later than baseline','caustic dosing flow oscillated during recipe execution','route-valve feedback disagreed with commanded position','GEA Clean-in-Place Skid CIP-01 supporting the Clean Utilities operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['GEA Process Systems','Purified Water Systems','Flow Instrument Calibration','Siemens PLC','Electrical Fault Finding']::text[],ARRAY['20000000-0000-0000-0000-000000000002'::uuid,'20000000-0000-0000-0000-000000000019'::uuid,'20000000-0000-0000-0000-000000000007'::uuid]::uuid[]),
(12,'41000000-0000-0000-0000-000000000003'::uuid,true,'BMS-01','Siemens Building Management System BMS-01','12000000-0000-0000-0000-000000000002'::uuid,'Building management system','Facilities','Utilities','Site Infrastructure','Siemens','Desigo CC','high','stable','cleanroom pressure trend data dropped intermittently','AHU alarm acknowledgement was delayed at the operator station','field-controller communications reset during network loading','Siemens Building Management System BMS-01 supporting the Site Infrastructure operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['HVAC','HVAC Validation','Siemens PLC','Electrical Fault Finding','Pharmaceutical Calibration']::text[],ARRAY['20000000-0000-0000-0000-000000000038'::uuid,'20000000-0000-0000-0000-000000000008'::uuid,'20000000-0000-0000-0000-000000000016'::uuid]::uuid[]),
(13,'41000000-0000-0000-0000-000000000004'::uuid,true,'GEN-01','Caterpillar Standby Generator GEN-01','12000000-0000-0000-0000-000000000002'::uuid,'Standby generator','Site Infrastructure','Utilities','Site Infrastructure','Caterpillar','C18 600 kVA','high','stable','battery charger output drifted below target','jacket-water heater current became intermittent','automatic transfer test showed delayed voltage stabilisation','Caterpillar Standby Generator GEN-01 supporting the Site Infrastructure operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['Electrical Testing','Switchgear','Electrical Fault Finding','Mechanical Fault Finding','Steam Boilers']::text[],ARRAY['20000000-0000-0000-0000-000000000004'::uuid,'20000000-0000-0000-0000-000000000017'::uuid,'20000000-0000-0000-0000-000000000003'::uuid]::uuid[]),
(14,'41000000-0000-0000-0000-000000000005'::uuid,true,'LEAK-01','Bonfiglioli Container Leak Tester LT-01','12000000-0000-0000-0000-000000000003'::uuid,'Container leak tester','Inspection','Inspection','Inspection Line 1','Bonfiglioli Engineering','PK-V','high','watch','vacuum decay baseline shifted during the morning challenge','reference-container verification failed intermittently','reject confirmation sensor response slowed after washdown','Bonfiglioli Container Leak Tester LT-01 supporting the Inspection Line 1 operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['Vision Inspection Systems','Pharmaceutical Calibration','Siemens PLC','Electrical Fault Finding','Mechanical Fault Finding']::text[],ARRAY['20000000-0000-0000-0000-000000000021'::uuid,'20000000-0000-0000-0000-000000000007'::uuid,'20000000-0000-0000-0000-000000000016'::uuid]::uuid[]),
(15,'41000000-0000-0000-0000-000000000006'::uuid,true,'CART-02','Marchesini Cartoner CART-02','12000000-0000-0000-0000-000000000001'::uuid,'Cartoner','Packaging','Packaging','Packaging Line 2','Marchesini','MA 155','high','watch','carton pick failures increased at nominal line speed','leaflet-present verification produced intermittent false rejects','main drive torque trended upward during long campaigns','Marchesini Cartoner CART-02 supporting the Packaging Line 2 operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['Marchesini Packaging Lines','High Speed Packaging','Machine Vision','Electrical Fault Finding','Mechanical Fault Finding']::text[],ARRAY['20000000-0000-0000-0000-000000000016'::uuid,'20000000-0000-0000-0000-000000000001'::uuid,'20000000-0000-0000-0000-000000000003'::uuid]::uuid[]),
(16,'41000000-0000-0000-0000-000000000007'::uuid,true,'AGV-01','MiR Autonomous Warehouse Vehicle AGV-01','12000000-0000-0000-0000-000000000004'::uuid,'Autonomous mobile robot','Warehouse Automation','Warehouse','Finished Goods Warehouse','MiR','MiR600','medium','stable','navigation confidence reduced near the cold-store transfer point','battery capacity fell below the expected shift profile','safety-scanner contamination generated nuisance stops','MiR Autonomous Warehouse Vehicle AGV-01 supporting the Finished Goods Warehouse operation. Demo history includes linked maintenance, PM, calibration, spares, skills, documentation and engineer evidence.',ARRAY['Autonomous Mobile Robots','Robotics','Electrical Fault Finding','Mechanical Fault Finding','Machine Vision']::text[],ARRAY['20000000-0000-0000-0000-000000000016'::uuid,'20000000-0000-0000-0000-000000000036'::uuid,'20000000-0000-0000-0000-000000000003'::uuid]::uuid[]);

do $$
declare
  v_missing_assets text;
  v_missing_skills text;
  v_missing_engineers text;
begin
  select string_agg(seed.equipment_code, ', ' order by seed.seed_order)
    into v_missing_assets
  from private.demo_wrexham_asset_seed seed
  left join public.equipment_assets asset
    on asset.id = seed.equipment_id
  where not seed.is_new
    and asset.id is null;

  if v_missing_assets is not null then
    raise exception 'Demo expansion aborted: existing equipment missing: %', v_missing_assets;
  end if;

  select string_agg(distinct skill_name, ', ' order by skill_name)
    into v_missing_skills
  from private.demo_wrexham_asset_seed seed
  cross join lateral unnest(seed.skill_names) skill_name
  left join public.skills skill
    on lower(skill.name) = lower(skill_name)
   and skill.is_active
  where skill.id is null;

  if v_missing_skills is not null then
    raise exception 'Demo expansion aborted: skills missing: %', v_missing_skills;
  end if;

  select string_agg(distinct engineer_id::text, ', ' order by engineer_id::text)
    into v_missing_engineers
  from private.demo_wrexham_asset_seed seed
  cross join lateral unnest(seed.engineer_ids) engineer_id
  left join public.engineers engineer
    on engineer.id = engineer_id
   and engineer.site_id = '11000000-0000-0000-0000-000000000001'::uuid
  where engineer.id is null;

  if v_missing_engineers is not null then
    raise exception 'Demo expansion aborted: engineers missing or out of site scope: %', v_missing_engineers;
  end if;
end
$$;

insert into public.equipment_assets (
  id,
  site_id,
  department_id,
  equipment_code,
  name,
  equipment_type,
  category,
  area,
  line,
  oem,
  model,
  criticality,
  status,
  am_strategy,
  operators_required,
  description,
  source_system,
  source_record_key,
  source_updated_at
)
select
  seed.equipment_id,
  '11000000-0000-0000-0000-000000000001'::uuid,
  seed.department_id,
  seed.equipment_code,
  seed.equipment_name,
  seed.equipment_type,
  seed.category,
  seed.area,
  seed.line,
  seed.oem,
  seed.model,
  seed.criticality,
  'operational',
  case
    when seed.area in ('Fill-Finish','Packaging','Warehouse') then 'Operator autonomous maintenance step 1 with engineering escalation'
    else 'Engineering-led preventive maintenance with operator condition checks'
  end,
  case when seed.area = 'Warehouse' then 1 else 2 end,
  seed.asset_description,
  'demo-expansion',
  'WREXHAM-EXP-20260719-EQ-' || seed.equipment_code,
  now()
from private.demo_wrexham_asset_seed seed
where seed.is_new
on conflict do nothing;

do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
  from private.demo_wrexham_asset_seed seed
  join public.equipment_assets asset
    on asset.id = seed.equipment_id
   and asset.site_id = '11000000-0000-0000-0000-000000000001'::uuid;

  if v_count <> 16 then
    raise exception 'Demo expansion aborted: expected 16 scoped assets, found %', v_count;
  end if;
end
$$;
