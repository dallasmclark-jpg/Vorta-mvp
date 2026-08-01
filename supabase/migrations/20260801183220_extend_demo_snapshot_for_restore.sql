-- VOR-033 Phase 3A: extend snapshots to include connected execution and handover evidence.
create or replace function private.vorta_capture_demo_dataset_baseline_internal(
  p_site_id uuid,
  p_label text,
  p_anchor_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_id uuid;
begin
  if nullif(trim(p_label),'') is null then
    raise exception 'Baseline label is required';
  end if;

  insert into private.vorta_demo_dataset_baselines (site_id,label,anchor_date,payload,metrics)
  values (
    p_site_id,trim(p_label),p_anchor_date,
    jsonb_build_object(
      'equipmentAssets',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.equipment_assets row_value where row_value.site_id=p_site_id),
      'equipmentFaultCodes',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.equipment_fault_codes row_value join public.equipment_assets asset on asset.id=row_value.equipment_id where asset.site_id=p_site_id),
      'preventiveMaintenance',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.preventive_maintenance row_value where row_value.site_id=p_site_id),
      'equipmentComponents',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.equipment_components row_value where row_value.site_id=p_site_id),
      'siteMaterialStock',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.site_material_stock row_value where row_value.site_id=p_site_id),
      'knowledgeDocuments',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.knowledge_documents row_value where row_value.site_id=p_site_id),
      'maintenanceNotifications',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.maintenance_notifications row_value where row_value.site_id=p_site_id),
      'workOrders',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.work_orders row_value where row_value.site_id=p_site_id),
      'workOrderConfirmations',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.work_order_confirmations row_value where row_value.site_id=p_site_id),
      'knowledgeChunks',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.knowledge_chunks row_value join public.equipment_assets asset on asset.id=row_value.equipment_id where asset.site_id=p_site_id),
      'maintenanceOrderNotificationLinks',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.maintenance_order_notification_links row_value where row_value.site_id=p_site_id),
      'workOrderMaterialReservations',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.work_order_material_reservations row_value where row_value.site_id=p_site_id),
      'workOrderGoodsMovements',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.work_order_goods_movements row_value where row_value.site_id=p_site_id),
      'shiftHandoverActions',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.shift_handover_actions row_value where row_value.site_id=p_site_id)
    ),
    private.vorta_get_demo_dataset_credibility_internal(p_site_id,p_anchor_date)
  )
  on conflict (site_id,label) do update set
    anchor_date=excluded.anchor_date,captured_at=now(),captured_by=auth.uid(),payload=excluded.payload,metrics=excluded.metrics
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.vorta_capture_demo_dataset_baseline_internal(uuid,text,date) from public,anon,authenticated;
grant execute on function private.vorta_capture_demo_dataset_baseline_internal(uuid,text,date) to service_role;

create or replace function private.vorta_upsert_demo_snapshot_rows_internal(p_table regclass,p_rows jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_assignments text;
  v_count integer;
  v_allowed regclass[] := array[
    'public.equipment_assets'::regclass,'public.equipment_fault_codes'::regclass,
    'public.preventive_maintenance'::regclass,'public.equipment_components'::regclass,
    'public.site_material_stock'::regclass,'public.knowledge_documents'::regclass,
    'public.maintenance_notifications'::regclass,'public.work_orders'::regclass,
    'public.work_order_confirmations'::regclass,'public.knowledge_chunks'::regclass,
    'public.maintenance_order_notification_links'::regclass,'public.work_order_material_reservations'::regclass,
    'public.work_order_goods_movements'::regclass,'public.shift_handover_actions'::regclass
  ];
begin
  if not p_table=any(v_allowed) then raise exception 'Table % is not approved for demo restore',p_table; end if;
  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' then raise exception 'Snapshot rows for % must be an array',p_table; end if;
  if jsonb_array_length(coalesce(p_rows,'[]'::jsonb))=0 then return 0; end if;

  select string_agg(format('%I=excluded.%I',attribute.attname,attribute.attname),',' order by attribute.attnum)
  into v_assignments
  from pg_attribute attribute
  where attribute.attrelid=p_table and attribute.attnum>0 and not attribute.attisdropped
    and attribute.attname<>'id' and attribute.attgenerated='';

  execute format('insert into %s select * from jsonb_populate_recordset(null::%s,$1) on conflict (id) do update set %s',p_table,p_table,v_assignments)
    using p_rows;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function private.vorta_upsert_demo_snapshot_rows_internal(regclass,jsonb) from public,anon,authenticated;
grant execute on function private.vorta_upsert_demo_snapshot_rows_internal(regclass,jsonb) to service_role;

create or replace function private.vorta_get_demo_table_rows_internal(p_table regclass,p_site_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_rows jsonb;
  v_allowed regclass[] := array[
    'public.equipment_assets'::regclass,'public.equipment_fault_codes'::regclass,
    'public.preventive_maintenance'::regclass,'public.equipment_components'::regclass,
    'public.site_material_stock'::regclass,'public.knowledge_documents'::regclass,
    'public.maintenance_notifications'::regclass,'public.work_orders'::regclass,
    'public.work_order_confirmations'::regclass,'public.knowledge_chunks'::regclass,
    'public.maintenance_order_notification_links'::regclass,'public.work_order_material_reservations'::regclass,
    'public.work_order_goods_movements'::regclass,'public.shift_handover_actions'::regclass
  ];
begin
  if not p_table=any(v_allowed) then raise exception 'Table % is not approved for comparison',p_table; end if;
  if p_table in ('public.equipment_fault_codes'::regclass,'public.knowledge_chunks'::regclass) then
    execute format('select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),''[]''::jsonb) from %s row_value join public.equipment_assets asset on asset.id=row_value.equipment_id where asset.site_id=$1',p_table)
      into v_rows using p_site_id;
  else
    execute format('select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),''[]''::jsonb) from %s row_value where row_value.site_id=$1',p_table)
      into v_rows using p_site_id;
  end if;
  return coalesce(v_rows,'[]'::jsonb);
end;
$$;
revoke all on function private.vorta_get_demo_table_rows_internal(regclass,uuid) from public,anon,authenticated;
grant execute on function private.vorta_get_demo_table_rows_internal(regclass,uuid) to service_role;
