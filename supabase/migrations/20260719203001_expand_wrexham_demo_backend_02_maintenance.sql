-- Wrexham demo backend expansion. Sequential, idempotent stage.
-- Do not reorder these six migrations.

insert into public.equipment_fault_codes (
  equipment_id, fault_code, hmi_text_pattern, fault_name, fault_category, severity,
  likely_causes, recommended_actions, related_spare_keywords, related_knowledge_keywords,
  escalation_required, source_system, source_reference, metadata
)
select seed.equipment_id, seed.equipment_code || '-F0' || fault.seq,
  case fault.seq when 1 then upper(seed.equipment_code) || ' ' || upper(seed.issue_1) else upper(seed.equipment_code) || ' ' || upper(seed.issue_2) end,
  case fault.seq when 1 then initcap(seed.issue_1) else initcap(seed.issue_2) end,
  case fault.seq when 1 then 'Process / Performance' else 'Controls / Instrumentation' end,
  case when seed.risk_mode='high' and fault.seq=1 then 'Critical' when seed.criticality in ('critical','high') then 'High' else 'Medium' end,
  case fault.seq when 1 then ARRAY[seed.issue_1,'sensor drift or mechanical restriction','maintenance interval exceeded'] else ARRAY[seed.issue_2,'intermittent wiring or actuator response','control parameter outside baseline'] end,
  case fault.seq when 1 then ARRAY['Review current trend against the approved baseline','Inspect the linked component and verify calibration','Escalate to the equipment SME if the condition repeats'] else ARRAY['Check the electrical drawing and alarm history','Inspect connections and actuator feedback','Run the approved functional challenge before release'] end,
  ARRAY[seed.equipment_code||'-SEN-01',seed.equipment_code||'-ACT-01'], ARRAY[seed.equipment_code,seed.oem,'fault-finding','maintenance manual'],
  seed.criticality='critical','HMI Demo Expansion','WREXHAM-EXP-20260719-'||seed.equipment_code||'-FAULT-'||fault.seq,
  jsonb_build_object('demo_data',true,'demo_expansion','2026-07-19','risk_mode',seed.risk_mode)
from private.demo_wrexham_asset_seed seed cross join generate_series(1,2) fault(seq)
on conflict (equipment_id,fault_code) do update set
  hmi_text_pattern=excluded.hmi_text_pattern, fault_name=excluded.fault_name, severity=excluded.severity,
  likely_causes=excluded.likely_causes, recommended_actions=excluded.recommended_actions,
  related_spare_keywords=excluded.related_spare_keywords, related_knowledge_keywords=excluded.related_knowledge_keywords,
  escalation_required=excluded.escalation_required, source_reference=excluded.source_reference,
  metadata=excluded.metadata, updated_at=now();

insert into public.preventive_maintenance (
  equipment_id,pm_number,title,frequency,frequency_unit,pm_type,estimated_duration_minutes,
  last_completed_date,next_due_date,status,assigned_engineer,completion_percentage,criticality,
  procedure_ref,checklist_ref,site_id,source_system,source_record_key,source_updated_at,
  calibration_point,tolerance_specification,last_calibration_result,certificate_reference,calibration_result_at
)
select seed.equipment_id,'PM-26'||lpad(seed.seed_order::text,2,'0')||lpad(pm.seq::text,2,'0'),
  case pm.seq when 1 then seed.equipment_code||' monthly condition inspection' when 2 then seed.equipment_code||' quarterly planned service' when 3 then seed.equipment_code||' annual instrument calibration' else seed.equipment_code||' annual major maintenance and qualification' end,
  case pm.seq when 1 then 'Monthly' when 2 then 'Quarterly' else 'Annual' end,
  case pm.seq when 1 then 'month' when 2 then 'quarter' else 'year' end,
  case pm.seq when 1 then 'Inspection' when 2 then 'Preventive' when 3 then 'Calibration' else 'Qualification' end,
  case pm.seq when 1 then 90 when 2 then 240 when 3 then 180 else 480 end,
  case pm.seq when 1 then current_date-20 when 2 then current_date-70 when 3 then current_date-370 else current_date-340 end,
  case when pm.seq=1 then current_date+case seed.risk_mode when 'stable' then 10 when 'watch' then 5 else 2 end
       when pm.seq=2 then current_date+case seed.risk_mode when 'stable' then 20 when 'watch' then 8 else -8 end
       when pm.seq=3 then current_date+case seed.risk_mode when 'stable' then 25 when 'watch' then -18 else -42 end
       else current_date+case seed.risk_mode when 'stable' then 60 when 'watch' then 30 else -15 end end,
  case when pm.seq=1 and seed.risk_mode='high' then 'DUE SOON' when pm.seq=1 then 'ON TRACK'
       when pm.seq=2 and seed.risk_mode='high' then 'OVERDUE' when pm.seq=2 and seed.risk_mode='watch' then 'DUE SOON' when pm.seq=2 then 'ON TRACK'
       when pm.seq=3 and seed.risk_mode in ('watch','high') then 'OVERDUE' when pm.seq=3 then 'ON TRACK'
       when pm.seq=4 and seed.risk_mode='high' then 'OVERDUE' else 'PLANNED' end,
  engineer.full_name,case when pm.seq in (1,2) then 0 when pm.seq=3 and seed.risk_mode='stable' then 100 else 0 end,
  case when seed.criticality='critical' then 'Critical' else 'High' end,
  'PROC-'||seed.equipment_code||'-'||lpad(pm.seq::text,2,'0'),'CHK-'||seed.equipment_code||'-'||lpad(pm.seq::text,2,'0'),
  '11000000-0000-0000-0000-000000000001'::uuid,'demo-expansion','WREXHAM-EXP-20260719-'||seed.equipment_code||'-PM-'||pm.seq,now(),
  case when pm.seq=3 then seed.equipment_code||' critical measurement loop' end,
  case when pm.seq=3 then 'Within approved instrument and process tolerance' end,
  case when pm.seq=3 and seed.risk_mode='stable' then 'PASS' end,
  case when pm.seq=3 and seed.risk_mode='stable' then 'CAL-'||seed.equipment_code||'-2026' end,
  case when pm.seq=3 and seed.risk_mode='stable' then now()-interval '25 days' end
from private.demo_wrexham_asset_seed seed cross join generate_series(1,4) pm(seq)
left join public.engineers engineer on engineer.id=seed.engineer_ids[((pm.seq-1)%3)+1]
on conflict do nothing;

insert into public.equipment_components (
  equipment_id,component_name,component_code,vendor_name,maker_name,quantity_available,quantity_target,
  minimum_quantity,unit_cost,lead_days,storage_location,availability_status,criticality,site_id,
  source_system,source_record_key,source_updated_at,is_bom_item,bom_item_number,bom_quantity,bom_unit,
  bom_item_category,functional_location_code
)
select seed.equipment_id,
  case component.seq when 1 then seed.equipment_code||' primary process sensor' when 2 then seed.equipment_code||' actuator or servo assembly' when 3 then seed.equipment_code||' seal and gasket kit' when 4 then seed.equipment_code||' control I/O module' else seed.equipment_code||' filter and bearing service kit' end,
  seed.equipment_code||'-'||case component.seq when 1 then 'SEN-01' when 2 then 'ACT-01' when 3 then 'SEAL-01' when 4 then 'PLC-01' else 'SRV-01' end,
  seed.oem||' authorised supply',case component.seq when 4 then 'Siemens / OEM approved' else seed.oem end,
  case when seed.risk_mode='high' and component.seq=4 then 0 when seed.risk_mode='high' and component.seq in (1,3) then 1 when seed.risk_mode='watch' and component.seq in (1,5) then 1 else case component.seq when 1 then 3 when 2 then 2 when 3 then 5 when 4 then 1 else 4 end end,
  case component.seq when 1 then 3 when 2 then 2 when 3 then 5 when 4 then 1 else 4 end,
  case component.seq when 4 then 1 else 2 end,
  case component.seq when 1 then 850 when 2 then 2400 when 3 then 280 when 4 then 3200 else 420 end,
  case component.seq when 1 then 21 when 2 then 45 when 3 then 14 when 4 then 90 else 21 end,
  case when component.seq in (1,4) then 'CRIB-CRIT' else 'ENG-STORES' end,
  case when seed.risk_mode='high' and component.seq=4 then 'Out of Stock' when seed.risk_mode='high' and component.seq in (1,3) then 'Low Stock' when seed.risk_mode='watch' and component.seq in (1,5) then 'Low Stock' else 'OK' end,
  case component.seq when 1 then 'Critical' when 4 then 'Critical' when 2 then 'High' when 3 then 'High' else 'Medium' end,
  '11000000-0000-0000-0000-000000000001'::uuid,'demo-expansion','WREXHAM-EXP-20260719-'||seed.equipment_code||'-COMP-'||component.seq,now(),true,
  lpad(component.seq::text,4,'0'),1,'EA','L','WREX-'||upper(regexp_replace(seed.area,'[^A-Za-z0-9]+','-','g'))||'-'||seed.equipment_code
from private.demo_wrexham_asset_seed seed cross join generate_series(1,5) component(seq)
on conflict do nothing;

insert into public.site_material_stock (
  site_id,material_number,material_description,plant_code,storage_location,base_unit,unrestricted_quantity,
  quality_inspection_quantity,blocked_quantity,returns_quantity,stock_in_transfer_quantity,total_stock_value,
  currency_code,source_system,source_record_key,source_updated_at
)
select component.site_id,component.component_code,component.component_name,'WREX',coalesce(component.storage_location,'ENG-STORES'),'EA',
  component.quantity_available,0,0,0,0,component.quantity_available*coalesce(component.unit_cost,0),'GBP','demo-expansion',
  'WREXHAM-EXP-20260719-STOCK-'||component.component_code,now()
from public.equipment_components component
join private.demo_wrexham_asset_seed seed on seed.equipment_id=component.equipment_id
where component.source_system='demo-expansion'
on conflict (site_id,material_number,plant_code,storage_location) do update set
  material_description=excluded.material_description,unrestricted_quantity=excluded.unrestricted_quantity,
  total_stock_value=excluded.total_stock_value,source_system=excluded.source_system,
  source_record_key=excluded.source_record_key,source_updated_at=excluded.source_updated_at,updated_at=now();

insert into public.equipment_required_skills (
  equipment_id,skill_id,required_level,criticality,notes,minimum_qualified_engineers,
  execution_authority,validation_required,evidence_reference
)
select seed.equipment_id,skill.id,case when skill_position.ordinality=1 then 4 else 3 end,
  case when skill_position.ordinality<=2 then 'critical' else 'high' end,
  'Required for independent maintenance and fault diagnosis on '||seed.equipment_code||'.',
  case when skill_position.ordinality<=2 then 2 else 1 end,
  case when skill_position.ordinality=1 then 'authoriser' else 'independent' end,true,
  'DEMO-EVIDENCE-'||seed.equipment_code||'-'||lpad(skill_position.ordinality::text,2,'0')
from private.demo_wrexham_asset_seed seed
cross join lateral unnest(seed.skill_names) with ordinality skill_position(skill_name,ordinality)
join public.skills skill on lower(skill.name)=lower(skill_position.skill_name) and skill.is_active
on conflict (equipment_id,skill_id) do nothing;

insert into public.equipment_engineer_capabilities (
  equipment_id,engineer_id,capability_role,capability_status,competency_level,practice_authority,
  validation_status,specialism,evidence_reference,valid_from,valid_until,notes
)
select seed.equipment_id,engineer_position.engineer_id,
  case engineer_position.ordinality when 1 then 'PRIMARY_SME' when 2 then 'BACKUP_SME' else 'DEVELOPING_BACKUP' end,
  case when engineer_position.ordinality=3 then 'IN_DEVELOPMENT' else 'ACTIVE' end,
  case engineer_position.ordinality when 1 then 5 when 2 then 4 else 3 end,
  case engineer_position.ordinality when 1 then 'AUTHORISER' when 2 then 'INDEPENDENT' else 'SUPERVISED' end,
  case when engineer_position.ordinality=3 then 'DEVELOPING' else 'VALIDATED' end,
  seed.oem||' '||seed.equipment_type,'DEMO-CAP-'||seed.equipment_code||'-'||engineer_position.ordinality,
  current_date-365,case when engineer_position.ordinality=3 then current_date+180 else current_date+730 end,
  case when engineer_position.ordinality=1 then 'Primary equipment SME for demo escalation and authorisation.' when engineer_position.ordinality=2 then 'Validated backup providing resilience across shifts.' else 'Structured developing backup with supervised practical evidence.' end
from private.demo_wrexham_asset_seed seed
cross join lateral unnest(seed.engineer_ids) with ordinality engineer_position(engineer_id,ordinality)
where seed.is_new
on conflict (equipment_id,engineer_id) do nothing;
