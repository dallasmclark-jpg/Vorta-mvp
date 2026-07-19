-- Wrexham demo backend expansion. Sequential, idempotent stage.
-- Do not reorder these six migrations.

select public.vorta_recalculate_equipment_risk_profiles();
select public.vorta_recalculate_equipment_risk_explanations();
select public.vorta_recalculate_area_risk_profiles();
select public.vorta_recalculate_area_site_risk_explanations();
select public.vorta_recalculate_site_risk_profile();
select public.vorta_refresh_risk_work_plan();
select public.vorta_sync_equipment_risk_counts();
select public.vorta_create_risk_timeline_snapshot(current_date,'demo_backend_expansion');

do $$
declare
  v_equipment_count integer;
  v_work_order_count integer;
  v_pm_count integer;
  v_component_count integer;
  v_document_count integer;
  v_confirmation_count integer;
  v_risk_profile_count integer;
begin
  select count(*) into v_equipment_count from public.equipment_assets where site_id='11000000-0000-0000-0000-000000000001'::uuid;
  select count(*) into v_work_order_count from public.work_orders where site_id='11000000-0000-0000-0000-000000000001'::uuid;
  select count(*) into v_pm_count from public.preventive_maintenance where site_id='11000000-0000-0000-0000-000000000001'::uuid;
  select count(*) into v_component_count from public.equipment_components where site_id='11000000-0000-0000-0000-000000000001'::uuid;
  select count(*) into v_document_count from public.knowledge_documents where site_id='11000000-0000-0000-0000-000000000001'::uuid;
  select count(*) into v_confirmation_count from public.work_order_confirmations where site_id='11000000-0000-0000-0000-000000000001'::uuid;
  select count(*) into v_risk_profile_count
  from public.equipment_risk_profiles profile
  join public.equipment_assets asset on asset.id=profile.equipment_id
  where asset.site_id='11000000-0000-0000-0000-000000000001'::uuid;

  if v_equipment_count<35 or v_work_order_count<208 or v_pm_count<124 or v_component_count<138
     or v_document_count<88 or v_confirmation_count<181 or v_risk_profile_count<35 then
    raise exception
      'Demo expansion verification failed: equipment %, work orders %, PM %, components %, documents %, confirmations %, risk profiles %',
      v_equipment_count,v_work_order_count,v_pm_count,v_component_count,v_document_count,v_confirmation_count,v_risk_profile_count;
  end if;
end
$$;

drop table if exists private.demo_wrexham_asset_seed;
