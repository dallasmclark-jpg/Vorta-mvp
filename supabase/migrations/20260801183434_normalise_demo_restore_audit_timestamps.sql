-- VOR-033: ignore trigger-maintained updated_at values when checking semantic restore equality.
create or replace function private.vorta_normalise_demo_snapshot_rows_internal(p_rows jsonb)
returns jsonb
language sql
immutable
security definer
set search_path to 'pg_catalog','public','private'
as $$
  select coalesce(jsonb_agg(value - 'updated_at' order by value->>'id'),'[]'::jsonb)
  from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb));
$$;
revoke all on function private.vorta_normalise_demo_snapshot_rows_internal(jsonb) from public,anon,authenticated;
grant execute on function private.vorta_normalise_demo_snapshot_rows_internal(jsonb) to service_role;

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
  v_expected_raw jsonb;
  v_current_raw jsonb;
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
    v_expected_raw:=coalesce(v_baseline.payload->v_key,'[]'::jsonb);
    v_current_raw:=private.vorta_get_demo_table_rows_internal(v_table,v_baseline.site_id);
    v_expected:=private.vorta_normalise_demo_snapshot_rows_internal(v_expected_raw);
    v_current:=private.vorta_normalise_demo_snapshot_rows_internal(v_current_raw);
    v_healthy:=v_healthy and v_expected=v_current;
    v_details:=v_details||jsonb_build_object(v_key,jsonb_build_object(
      'equal',v_expected=v_current,
      'baselineCount',jsonb_array_length(v_expected_raw),
      'currentCount',jsonb_array_length(v_current_raw),
      'baselineHash',md5(v_expected::text),
      'currentHash',md5(v_current::text),
      'ignoredAuditFields',jsonb_build_array('updated_at')
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
