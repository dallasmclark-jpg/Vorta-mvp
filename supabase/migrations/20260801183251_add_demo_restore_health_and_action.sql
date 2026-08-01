-- VOR-033 Phase 3B: compare a baseline with current rows and restore in dependency order.
create or replace function private.vorta_get_demo_baseline_restore_health_internal(p_baseline_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_baseline private.vorta_demo_dataset_baselines%rowtype;
  v_config jsonb := jsonb_build_array(
    jsonb_build_object('key','equipmentAssets','table','public.equipment_assets'),
    jsonb_build_object('key','equipmentFaultCodes','table','public.equipment_fault_codes'),
    jsonb_build_object('key','preventiveMaintenance','table','public.preventive_maintenance'),
    jsonb_build_object('key','equipmentComponents','table','public.equipment_components'),
    jsonb_build_object('key','siteMaterialStock','table','public.site_material_stock'),
    jsonb_build_object('key','knowledgeDocuments','table','public.knowledge_documents'),
    jsonb_build_object('key','maintenanceNotifications','table','public.maintenance_notifications'),
    jsonb_build_object('key','workOrders','table','public.work_orders'),
    jsonb_build_object('key','workOrderConfirmations','table','public.work_order_confirmations'),
    jsonb_build_object('key','knowledgeChunks','table','public.knowledge_chunks'),
    jsonb_build_object('key','maintenanceOrderNotificationLinks','table','public.maintenance_order_notification_links'),
    jsonb_build_object('key','workOrderMaterialReservations','table','public.work_order_material_reservations'),
    jsonb_build_object('key','workOrderGoodsMovements','table','public.work_order_goods_movements'),
    jsonb_build_object('key','shiftHandoverActions','table','public.shift_handover_actions')
  );
  v_item jsonb;
  v_key text;
  v_table regclass;
  v_expected jsonb;
  v_current jsonb;
  v_details jsonb := '{}'::jsonb;
  v_healthy boolean := true;
begin
  select * into v_baseline from private.vorta_demo_dataset_baselines where id=p_baseline_id;
  if not found then raise exception 'Demo baseline % was not found',p_baseline_id; end if;

  for v_item in select value from jsonb_array_elements(v_config)
  loop
    v_key:=v_item->>'key';
    v_table:=(v_item->>'table')::regclass;
    v_expected:=coalesce(v_baseline.payload->v_key,'[]'::jsonb);
    v_current:=private.vorta_get_demo_table_rows_internal(v_table,v_baseline.site_id);
    v_healthy:=v_healthy and v_expected=v_current;
    v_details:=v_details||jsonb_build_object(v_key,jsonb_build_object(
      'equal',v_expected=v_current,
      'baselineCount',jsonb_array_length(v_expected),
      'currentCount',jsonb_array_length(v_current),
      'baselineHash',md5(v_expected::text),
      'currentHash',md5(v_current::text)
    ));
  end loop;

  return jsonb_build_object(
    'healthy',v_healthy,'baselineId',v_baseline.id,'label',v_baseline.label,
    'siteId',v_baseline.site_id,'anchorDate',v_baseline.anchor_date,'checkedAt',now(),'tables',v_details
  );
end;
$$;
revoke all on function private.vorta_get_demo_baseline_restore_health_internal(uuid) from public,anon,authenticated;
grant execute on function private.vorta_get_demo_baseline_restore_health_internal(uuid) to service_role;

create or replace function private.vorta_restore_demo_dataset_baseline_internal(p_baseline_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_baseline private.vorta_demo_dataset_baselines%rowtype;
  v_report jsonb;
begin
  select * into v_baseline from private.vorta_demo_dataset_baselines where id=p_baseline_id for update;
  if not found then raise exception 'Demo baseline % was not found',p_baseline_id; end if;

  perform pg_advisory_xact_lock(hashtextextended('vorta-demo-restore:'||v_baseline.site_id::text,0));

  perform private.vorta_upsert_demo_snapshot_rows_internal('public.equipment_assets'::regclass,v_baseline.payload->'equipmentAssets');
  perform private.vorta_upsert_demo_snapshot_rows_internal('public.equipment_fault_codes'::regclass,v_baseline.payload->'equipmentFaultCodes');
  perform private.vorta_upsert_demo_snapshot_rows_internal('public.preventive_maintenance'::regclass,v_baseline.payload->'preventiveMaintenance');
  perform private.vorta_upsert_demo_snapshot_rows_internal('public.equipment_components'::regclass,v_baseline.payload->'equipmentComponents');
  perform private.vorta_upsert_demo_snapshot_rows_internal('public.site_material_stock'::regclass,v_baseline.payload->'siteMaterialStock');
  perform private.vorta_upsert_demo_snapshot_rows_internal('public.knowledge_documents'::regclass,v_baseline.payload->'knowledgeDocuments');
  perform private.vorta_upsert_demo_snapshot_rows_internal('public.maintenance_notifications'::regclass,v_baseline.payload->'maintenanceNotifications');
  perform private.vorta_upsert_demo_snapshot_rows_internal('public.work_orders'::regclass,v_baseline.payload->'workOrders');
  perform private.vorta_upsert_demo_snapshot_rows_internal('public.work_order_confirmations'::regclass,v_baseline.payload->'workOrderConfirmations');
  perform private.vorta_upsert_demo_snapshot_rows_internal('public.knowledge_chunks'::regclass,v_baseline.payload->'knowledgeChunks');
  perform private.vorta_upsert_demo_snapshot_rows_internal('public.maintenance_order_notification_links'::regclass,v_baseline.payload->'maintenanceOrderNotificationLinks');
  perform private.vorta_upsert_demo_snapshot_rows_internal('public.work_order_material_reservations'::regclass,v_baseline.payload->'workOrderMaterialReservations');
  perform private.vorta_upsert_demo_snapshot_rows_internal('public.work_order_goods_movements'::regclass,v_baseline.payload->'workOrderGoodsMovements');
  perform private.vorta_upsert_demo_snapshot_rows_internal('public.shift_handover_actions'::regclass,v_baseline.payload->'shiftHandoverActions');

  perform public.vorta_recalculate_equipment_risk_profiles();
  perform public.vorta_sync_equipment_risk_counts();
  perform public.vorta_recalculate_area_risk_profiles();
  perform public.vorta_recalculate_site_risk_profile();
  perform public.vorta_sync_maintenance_risk_work_plan();
  if to_regprocedure('private.vorta_apply_demo_storyline_narratives_internal(uuid)') is not null then
    perform private.vorta_apply_demo_storyline_narratives_internal(v_baseline.site_id);
  end if;

  v_report:=private.vorta_get_demo_baseline_restore_health_internal(p_baseline_id);
  if not coalesce((v_report->>'healthy')::boolean,false) then
    raise exception 'Demo restore did not reproduce baseline %: %',p_baseline_id,v_report;
  end if;
  return v_report;
end;
$$;
revoke all on function private.vorta_restore_demo_dataset_baseline_internal(uuid) from public,anon,authenticated;
grant execute on function private.vorta_restore_demo_dataset_baseline_internal(uuid) to service_role;
