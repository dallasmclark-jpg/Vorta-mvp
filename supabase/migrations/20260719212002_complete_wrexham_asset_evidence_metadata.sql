-- Complete calibration metadata and completed-work outcomes, then verify evidence coverage.

update public.preventive_maintenance pm
set
  calibration_point = coalesce(pm.calibration_point, asset.equipment_code||' approved calibration reference point'),
  tolerance_specification = coalesce(
    pm.tolerance_specification,
    case
      when lower(pm.title) like '%temperature%' then '±0.5 °C across the approved operating range'
      when lower(pm.title) like '%pressure%' or lower(pm.title) like '%vacuum%' then '±1.0% of calibrated span'
      when lower(pm.title) like '%flow%' then '±1.5% of calibrated flow range'
      when lower(pm.title) like '%conductivity%' then '±1.0% against certified reference standard'
      else 'Within the approved OEM and process validation tolerance'
    end
  ),
  updated_at = now()
from public.equipment_assets asset
where asset.id=pm.equipment_id
  and asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
  and lower(coalesce(pm.pm_type,''))='calibration'
  and (pm.calibration_point is null or pm.tolerance_specification is null);

update public.work_orders
set outcome = case
  when upper(coalesce(work_type,''))='INSPECTION' then 'VERIFIED'
  else 'SUCCESS'
end,
updated_at=now()
where site_id='11000000-0000-0000-0000-000000000001'::uuid
  and upper(status)='COMPLETED'
  and outcome is null;

select public.vorta_recalculate_equipment_risk_profiles();
select public.vorta_sync_equipment_risk_counts();
select public.vorta_recalculate_area_risk_profiles();
select public.vorta_recalculate_site_risk_profile();
select public.vorta_sync_maintenance_risk_work_plan();

do $$
begin
  if exists (
    select 1 from public.equipment_assets asset
    where asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
      and not exists (select 1 from public.equipment_components component where component.equipment_id=asset.id)
  ) then raise exception 'Wrexham asset missing BOM component evidence'; end if;

  if exists (
    select 1 from public.equipment_assets asset
    where asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
      and not exists (select 1 from public.knowledge_documents document where document.equipment_id=asset.id and document.is_current)
  ) then raise exception 'Wrexham asset missing current controlled document'; end if;

  if exists (
    select 1 from public.equipment_assets asset
    where asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
      and not exists (select 1 from public.knowledge_chunks chunk where chunk.equipment_id=asset.id)
  ) then raise exception 'Wrexham asset missing searchable knowledge'; end if;

  if exists (
    select 1 from public.equipment_assets asset
    where asset.site_id='11000000-0000-0000-0000-000000000001'::uuid
      and not exists (select 1 from public.equipment_fault_codes fault where fault.equipment_id=asset.id and fault.is_active)
  ) then raise exception 'Wrexham asset missing fault-code evidence'; end if;

  if exists (
    select 1 from public.preventive_maintenance pm
    where pm.site_id='11000000-0000-0000-0000-000000000001'::uuid
      and lower(coalesce(pm.pm_type,''))='calibration'
      and (pm.calibration_point is null or pm.tolerance_specification is null)
  ) then raise exception 'Wrexham calibration missing point or tolerance'; end if;

  if exists (
    select 1 from public.work_orders work_order
    where work_order.site_id='11000000-0000-0000-0000-000000000001'::uuid
      and upper(work_order.status)='COMPLETED'
      and work_order.outcome is null
  ) then raise exception 'Completed Wrexham work order missing outcome'; end if;
end;
$$;

drop table if exists private.demo_wrexham_completion_seed;
