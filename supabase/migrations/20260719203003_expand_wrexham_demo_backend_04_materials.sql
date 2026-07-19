-- Wrexham demo backend expansion. Sequential, idempotent stage.
-- Do not reorder these six migrations.

insert into public.work_order_material_reservations (
  site_id,work_order_id,component_id,material_number,reservation_number,reservation_item,requirement_date,
  required_quantity,reserved_quantity,withdrawn_quantity,base_unit,storage_location,reservation_status,
  final_issue,source_system,source_record_key,source_updated_at
)
select '11000000-0000-0000-0000-000000000001'::uuid,work_order.id,component.id,component.component_code,
  'RSV-26'||lpad(seed.seed_order::text,3,'0'),'0010',work_order.due_date,1,1,1,'EA',component.storage_location,
  'issued',true,'demo-expansion','WREXHAM-EXP-20260719-RSV-HIST-'||seed.equipment_code,now()
from private.demo_wrexham_asset_seed seed
join public.work_orders work_order on work_order.site_id='11000000-0000-0000-0000-000000000001'::uuid and work_order.wo_number='WO-26'||lpad(seed.seed_order::text,2,'0')||'03'
join public.equipment_components component on component.equipment_id=seed.equipment_id and component.component_code=seed.equipment_code||'-SEN-01'
on conflict do nothing;

insert into public.work_order_material_reservations (
  site_id,work_order_id,component_id,material_number,reservation_number,reservation_item,requirement_date,
  required_quantity,reserved_quantity,withdrawn_quantity,base_unit,storage_location,reservation_status,
  final_issue,source_system,source_record_key,source_updated_at
)
select '11000000-0000-0000-0000-000000000001'::uuid,work_order.id,component.id,component.component_code,
  'RSV-26'||lpad(seed.seed_order::text,3,'0'),'0020',work_order.due_date,1,
  case when seed.risk_mode='high' then 0 else 1 end,0,'EA',component.storage_location,
  case when seed.risk_mode='high' then 'shortage' else 'reserved' end,false,'demo-expansion',
  'WREXHAM-EXP-20260719-RSV-CURR-'||seed.equipment_code,now()
from private.demo_wrexham_asset_seed seed
join public.work_orders work_order on work_order.site_id='11000000-0000-0000-0000-000000000001'::uuid and work_order.wo_number='WO-26'||lpad(seed.seed_order::text,2,'0')||'06'
join public.equipment_components component on component.equipment_id=seed.equipment_id and component.component_code=seed.equipment_code||'-PLC-01'
where seed.risk_mode in ('watch','high')
on conflict do nothing;

insert into public.work_order_goods_movements (
  site_id,work_order_id,work_order_reservation_id,component_id,material_document_number,material_document_year,
  document_item,movement_type,posting_date,document_date,entry_timestamp,material_number,material_description,
  quantity,base_unit,debit_credit_indicator,plant_code,storage_location,reservation_number,reservation_item,
  entered_by,source_system,source_record_key,source_updated_at
)
select reservation.site_id,reservation.work_order_id,reservation.id,reservation.component_id,
  '49'||lpad(seed.seed_order::text,8,'0'),extract(year from current_date)::text,'0001','261',
  work_order.completed_date,work_order.completed_date,work_order.actual_finish_at,reservation.material_number,
  component.component_name,reservation.withdrawn_quantity,reservation.base_unit,'S','WREX',reservation.storage_location,
  reservation.reservation_number,reservation.reservation_item,work_order.assigned_engineer,'demo-expansion',
  'WREXHAM-EXP-20260719-GM-'||seed.equipment_code,now()
from private.demo_wrexham_asset_seed seed
join public.work_orders work_order on work_order.site_id='11000000-0000-0000-0000-000000000001'::uuid and work_order.wo_number='WO-26'||lpad(seed.seed_order::text,2,'0')||'03'
join public.work_order_material_reservations reservation on reservation.work_order_id=work_order.id and reservation.reservation_item='0010'
join public.equipment_components component on component.id=reservation.component_id
on conflict (site_id,source_system,source_record_key) do nothing;
