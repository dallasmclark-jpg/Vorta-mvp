-- VOR-033: add a recoverable baseline, deterministic rolling dates and a credibility report.

create table if not exists private.vorta_demo_dataset_baselines (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id),
  label text not null,
  anchor_date date not null,
  captured_at timestamptz not null default now(),
  captured_by uuid default auth.uid(),
  payload jsonb not null,
  metrics jsonb not null default '{}'::jsonb,
  unique (site_id,label)
);

revoke all on table private.vorta_demo_dataset_baselines from public,anon,authenticated;
grant select,insert,update on table private.vorta_demo_dataset_baselines to service_role;

create table if not exists private.vorta_demo_equipment_code_map (
  site_id uuid not null references public.sites(id),
  old_code text not null,
  new_code text not null,
  primary key (site_id,old_code),
  unique (site_id,new_code)
);

revoke all on table private.vorta_demo_equipment_code_map from public,anon,authenticated;
grant select,insert,update on table private.vorta_demo_equipment_code_map to service_role;

insert into private.vorta_demo_equipment_code_map (site_id,old_code,new_code) values
('11000000-0000-0000-0000-000000000001','DEMO-AUT-001','AUT-01'),
('11000000-0000-0000-0000-000000000001','DEMO-AUT-002','AUT-02'),
('11000000-0000-0000-0000-000000000001','DEMO-COLD-001','COLD-01'),
('11000000-0000-0000-0000-000000000001','DEMO-FD-001','FD-01'),
('11000000-0000-0000-0000-000000000001','DEMO-FD-002','FD-02'),
('11000000-0000-0000-0000-000000000001','DEMO-HVAC-001','AHU-01'),
('11000000-0000-0000-0000-000000000001','DEMO-LAB-001','LB-01'),
('11000000-0000-0000-0000-000000000001','DEMO-PSG-001','PSG-01'),
('11000000-0000-0000-0000-000000000001','DEMO-SER-001','SC-01'),
('11000000-0000-0000-0000-000000000001','DEMO-VF-001','VF-01'),
('11000000-0000-0000-0000-000000000001','DEMO-VF-002','VF-02'),
('11000000-0000-0000-0000-000000000001','DEMO-VIS-001','VI-01'),
('11000000-0000-0000-0000-000000000001','DEMO-WFI-001','WFI-01'),
('11000000-0000-0000-0000-000000000001','DEMO-WMS-001','WMS-02')
on conflict (site_id,old_code) do update set new_code=excluded.new_code;

create or replace function private.vorta_get_demo_dataset_credibility_internal(
  p_site_id uuid,
  p_anchor_date date default current_date
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog','public','private'
as $$
with assets as (
  select id from public.equipment_assets where site_id=p_site_id
),
visible_identifiers as (
  select
    (select count(*) from public.equipment_assets a
      where a.site_id=p_site_id and a.equipment_code ~* '(^|[-_ ])(DEMO|TEST|MOCK|SAMPLE)([-_ ]|$)')::int as equipment,
    (select count(*) from public.work_orders w
      where w.site_id=p_site_id and concat_ws(' ',w.wo_number,w.description,w.order_type_description,w.maintenance_activity_type_description,w.order_origin,w.functional_location_code,array_to_string(w.user_status_codes,' ')) ~* '(^|[^A-Z0-9])(DEMO)([-_ ]|$)')::int as work_orders,
    (select count(*) from public.preventive_maintenance p
      where p.site_id=p_site_id and concat_ws(' ',p.pm_number,p.title,p.procedure_ref,p.checklist_ref,p.calibration_point,p.certificate_reference) ~* '(^|[^A-Z0-9])(DEMO)([-_ ]|$)')::int as preventive_maintenance,
    (select count(*) from public.knowledge_documents d
      where d.site_id=p_site_id and concat_ws(' ',d.title,d.source_document_id,d.external_reference,d.drawing_number,d.manual_section) ~* '(^|[^A-Z0-9])(DEMO)([-_ ]|$)')::int as documents,
    (select count(*) from public.site_material_stock s
      where s.site_id=p_site_id and s.material_number ~* '(^|[-_ ])(DEMO|TEST|MOCK|SAMPLE)([-_ ]|$)')::int as stock,
    (select count(*) from public.equipment_components c
      join assets a on a.id=c.equipment_id
      where concat_ws(' ',c.component_code,c.component_name,c.functional_location_code) ~* '(^|[^A-Z0-9])(DEMO)([-_ ]|$)')::int as components,
    (select count(*) from public.equipment_fault_codes f
      join assets a on a.id=f.equipment_id
      where concat_ws(' ',f.fault_code,f.fault_name,f.source_reference) ~* '(^|[^A-Z0-9])(DEMO)([-_ ]|$)')::int as fault_codes,
    (select count(*) from public.knowledge_chunks k
      join assets a on a.id=k.equipment_id
      where concat_ws(' ',k.section_title,k.chunk_text,k.external_reference,k.drawing_number) ~* '(^|[^A-Z0-9])(DEMO)([-_ ]|$)')::int as knowledge_chunks
),
open_work as (
  select
    count(*)::int as total,
    count(*) filter (where due_date<p_anchor_date)::int as overdue,
    count(*) filter (where due_date between p_anchor_date and p_anchor_date+7)::int as due_0_7,
    count(*) filter (where due_date between p_anchor_date+8 and p_anchor_date+30)::int as due_8_30,
    count(*) filter (where due_date between p_anchor_date+31 and p_anchor_date+90)::int as due_31_90,
    count(*) filter (where due_date is null)::int as no_due_date,
    count(*) filter (where is_overdue is distinct from public.vorta_work_order_is_overdue(status,due_date))::int as overdue_flag_mismatches
  from public.work_orders
  where site_id=p_site_id and upper(status)<>'COMPLETED'
),
completed_work as (
  select
    count(*)::int as total,
    count(*) filter (where completed_date>=p_anchor_date-14)::int as completed_14d,
    count(*) filter (where completed_date>=p_anchor_date-60)::int as completed_60d,
    max(completed_date) as latest_completed
  from public.work_orders
  where site_id=p_site_id and upper(status)='COMPLETED'
),
pm as (
  select
    count(*)::int as total,
    count(*) filter (where next_due_date<p_anchor_date)::int as overdue,
    count(*) filter (where next_due_date between p_anchor_date and p_anchor_date+7)::int as due_0_7,
    count(*) filter (where next_due_date between p_anchor_date+8 and p_anchor_date+30)::int as due_8_30,
    count(*) filter (where next_due_date between p_anchor_date+31 and p_anchor_date+90)::int as due_31_90,
    count(*) filter (where next_due_date>p_anchor_date+90)::int as later,
    count(*) filter (where status is distinct from public.vorta_effective_pm_status(status,next_due_date))::int as status_mismatches
  from public.preventive_maintenance
  where site_id=p_site_id
),
calibration as (
  select
    count(*)::int as total,
    count(*) filter (where next_due_date<p_anchor_date)::int as overdue,
    count(*) filter (where next_due_date between p_anchor_date and p_anchor_date+30)::int as due_30d,
    count(*) filter (where certificate_reference is not null and calibration_result_at is not null)::int as with_certificate
  from public.preventive_maintenance
  where site_id=p_site_id and lower(pm_type)='calibration'
),
backend as (
  select private.vorta_get_demo_backend_health_internal(p_site_id) as value
),
summary as (
  select visible_identifiers.*,open_work.*,completed_work.total as completed_total,
    completed_work.completed_14d,completed_work.completed_60d,completed_work.latest_completed,
    pm.total as pm_total,pm.overdue as pm_overdue,pm.due_0_7 as pm_due_0_7,
    pm.due_8_30 as pm_due_8_30,pm.due_31_90 as pm_due_31_90,pm.later as pm_later,
    pm.status_mismatches as pm_status_mismatches,
    calibration.total as calibration_total,calibration.overdue as calibration_overdue,
    calibration.due_30d as calibration_due_30d,calibration.with_certificate as calibration_with_certificate,
    backend.value as backend_health
  from visible_identifiers,open_work,completed_work,pm,calibration,backend
)
select jsonb_build_object(
  'siteId',p_site_id,
  'anchorDate',p_anchor_date,
  'checkedAt',now(),
  'healthy',
    (equipment+work_orders+preventive_maintenance+documents+stock+components+fault_codes+knowledge_chunks)=0
    and total>=80
    and overdue between 20 and 45
    and due_0_7>=10
    and due_8_30>=15
    and due_31_90>=20
    and no_due_date=0
    and overdue_flag_mismatches=0
    and completed_14d>=10
    and completed_60d>=40
    and pm_overdue between 20 and 50
    and pm_due_0_7>=10
    and pm_due_8_30>=20
    and pm_due_31_90>=20
    and pm_later>=15
    and pm_status_mismatches=0
    and coalesce((backend_health->>'healthy')::boolean,false),
  'visibleSeedIdentifiers',jsonb_build_object(
    'equipment',equipment,'workOrders',work_orders,'preventiveMaintenance',preventive_maintenance,
    'documents',documents,'stock',stock,'components',components,'faultCodes',fault_codes,
    'knowledgeChunks',knowledge_chunks
  ),
  'openWorkOrders',jsonb_build_object(
    'total',total,'overdue',overdue,'due0To7Days',due_0_7,'due8To30Days',due_8_30,
    'due31To90Days',due_31_90,'withoutDueDate',no_due_date,
    'overdueFlagMismatches',overdue_flag_mismatches
  ),
  'completedWorkOrders',jsonb_build_object(
    'total',completed_total,'completedLast14Days',completed_14d,
    'completedLast60Days',completed_60d,'latestCompletedDate',latest_completed
  ),
  'preventiveMaintenance',jsonb_build_object(
    'total',pm_total,'overdue',pm_overdue,'due0To7Days',pm_due_0_7,
    'due8To30Days',pm_due_8_30,'due31To90Days',pm_due_31_90,
    'laterThan90Days',pm_later,'statusMismatches',pm_status_mismatches
  ),
  'calibration',jsonb_build_object(
    'total',calibration_total,'overdue',calibration_overdue,
    'dueWithin30Days',calibration_due_30d,'withCertificate',calibration_with_certificate
  ),
  'backendHealth',backend_health
)
from summary;
$$;

revoke all on function private.vorta_get_demo_dataset_credibility_internal(uuid,date) from public;
grant execute on function private.vorta_get_demo_dataset_credibility_internal(uuid,date) to service_role;

create or replace function private.vorta_capture_demo_dataset_baseline_internal(
  p_site_id uuid,
  p_label text,
  p_anchor_date date default current_date
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_id uuid;
begin
  if nullif(trim(p_label),'') is null then
    raise exception 'Baseline label is required';
  end if;

  insert into private.vorta_demo_dataset_baselines (
    site_id,label,anchor_date,payload,metrics
  )
  values (
    p_site_id,trim(p_label),p_anchor_date,
    jsonb_build_object(
      'equipmentAssets',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.equipment_assets row_value where row_value.site_id=p_site_id),
      'workOrders',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.work_orders row_value where row_value.site_id=p_site_id),
      'workOrderConfirmations',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.work_order_confirmations row_value where row_value.site_id=p_site_id),
      'preventiveMaintenance',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.preventive_maintenance row_value where row_value.site_id=p_site_id),
      'equipmentComponents',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.equipment_components row_value where row_value.site_id=p_site_id),
      'siteMaterialStock',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.site_material_stock row_value where row_value.site_id=p_site_id),
      'knowledgeDocuments',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.knowledge_documents row_value where row_value.site_id=p_site_id),
      'knowledgeChunks',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.knowledge_chunks row_value join public.equipment_assets asset on asset.id=row_value.equipment_id where asset.site_id=p_site_id),
      'equipmentFaultCodes',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.equipment_fault_codes row_value join public.equipment_assets asset on asset.id=row_value.equipment_id where asset.site_id=p_site_id),
      'maintenanceNotifications',(select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.id),'[]'::jsonb) from public.maintenance_notifications row_value where row_value.site_id=p_site_id)
    ),
    private.vorta_get_demo_dataset_credibility_internal(p_site_id,p_anchor_date)
  )
  on conflict (site_id,label) do update set
    anchor_date=excluded.anchor_date,
    captured_at=now(),
    captured_by=auth.uid(),
    payload=excluded.payload,
    metrics=excluded.metrics
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.vorta_capture_demo_dataset_baseline_internal(uuid,text,date) from public;
grant execute on function private.vorta_capture_demo_dataset_baseline_internal(uuid,text,date) to service_role;

create or replace function private.vorta_refresh_demo_dataset_dates_internal(
  p_site_id uuid,
  p_anchor_date date default current_date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog','public','private'
as $$
begin
  with ranked as (
    select work_order.id,
      row_number() over (
        order by
          case upper(work_order.priority) when 'CRITICAL' then 1 when 'HIGH' then 2 when 'MEDIUM' then 3 else 4 end,
          case upper(work_order.status) when 'WAITING PARTS' then 1 when 'IN PROGRESS' then 2 when 'ON HOLD' then 3 else 4 end,
          coalesce(profile.risk_score,0) desc,
          work_order.id
      ) as rn
    from public.work_orders work_order
    left join public.equipment_risk_profiles profile on profile.equipment_id=work_order.equipment_id
    where work_order.site_id=p_site_id and upper(work_order.status)<>'COMPLETED'
  ),
  proposed as (
    select id,rn,
      case
        when rn<=28 then p_anchor_date-(1+((rn-1)%28))::int
        when rn<=46 then p_anchor_date+((rn-29)%8)::int
        when rn<=70 then p_anchor_date+8+((rn-47)%23)::int
        else p_anchor_date+31+((rn-71)%45)::int
      end as new_due_date
    from ranked
  ),
  dates as (
    select id,rn,new_due_date,
      least(p_anchor_date-((rn-1)%12)::int,new_due_date-(5+((rn-1)%12))::int) as new_requested_date
    from proposed
  )
  update public.work_orders work_order
  set requested_date=dates.new_requested_date,
      due_date=dates.new_due_date,
      completed_date=null,
      basic_start_date=dates.new_requested_date,
      basic_finish_date=dates.new_due_date,
      scheduled_start_at=dates.new_requested_date::timestamp+interval '8 hours',
      scheduled_finish_at=dates.new_due_date::timestamp+interval '16 hours',
      actual_start_at=case when upper(work_order.status) in ('IN PROGRESS','WAITING PARTS','ON HOLD') then (p_anchor_date-((dates.rn-1)%5)::int)::timestamp+interval '7 hours' else null end,
      actual_finish_at=null,
      technical_completion_at=null,
      business_completion_at=null,
      source_created_at=dates.new_requested_date::timestamp+interval '8 hours',
      age_label=case
        when dates.new_due_date<p_anchor_date then (p_anchor_date-dates.new_due_date)::text||' days overdue'
        when dates.new_due_date=p_anchor_date then 'Due today'
        else 'Due in '||(dates.new_due_date-p_anchor_date)::text||' days'
      end,
      is_overdue=public.vorta_work_order_is_overdue(work_order.status,dates.new_due_date),
      source_updated_at=now(),updated_at=now()
  from dates
  where work_order.id=dates.id;

  with ranked as (
    select work_order.id,
      row_number() over (order by coalesce(work_order.completed_date,work_order.due_date,work_order.requested_date) desc nulls last,work_order.id) as rn
    from public.work_orders work_order
    where work_order.site_id=p_site_id and upper(work_order.status)='COMPLETED'
  ),
  dates as (
    select id,rn,
      case
        when rn<=24 then p_anchor_date-(1+((rn-1)%14))::int
        when rn<=72 then p_anchor_date-(15+((rn-25)%46))::int
        else p_anchor_date-(61+((rn-73)%300))::int
      end as new_completed_date
    from ranked
  )
  update public.work_orders work_order
  set completed_date=dates.new_completed_date,
      due_date=dates.new_completed_date-(2+((dates.rn-1)%5))::int,
      requested_date=dates.new_completed_date-(10+((dates.rn-1)%20))::int,
      basic_start_date=dates.new_completed_date-(10+((dates.rn-1)%20))::int,
      basic_finish_date=dates.new_completed_date-(2+((dates.rn-1)%5))::int,
      scheduled_start_at=(dates.new_completed_date-(2+((dates.rn-1)%5))::int)::timestamp+interval '8 hours',
      scheduled_finish_at=dates.new_completed_date::timestamp+interval '16 hours',
      actual_start_at=(dates.new_completed_date-1)::timestamp+interval '7 hours',
      actual_finish_at=dates.new_completed_date::timestamp+interval '14 hours',
      technical_completion_at=dates.new_completed_date::timestamp+interval '15 hours',
      business_completion_at=(dates.new_completed_date+1)::timestamp+interval '9 hours',
      source_created_at=(dates.new_completed_date-(10+((dates.rn-1)%20))::int)::timestamp+interval '8 hours',
      age_label='Completed',is_overdue=false,source_updated_at=now(),updated_at=now()
  from dates
  where work_order.id=dates.id;

  with open_order_rank as (
    select work_order.id,
      row_number() over (
        order by case upper(work_order.priority) when 'CRITICAL' then 1 when 'HIGH' then 2 when 'MEDIUM' then 3 else 4 end,
          coalesce(profile.risk_score,0) desc,work_order.id
      ) as rn
    from public.work_orders work_order
    left join public.equipment_risk_profiles profile on profile.equipment_id=work_order.equipment_id
    where work_order.site_id=p_site_id
      and upper(work_order.status)<>'COMPLETED'
      and exists (select 1 from public.work_order_confirmations confirmation where confirmation.work_order_id=work_order.id)
  ),
  ranked as (
    select confirmation.id,work_order.status,work_order.completed_date,work_order.requested_date,
      coalesce(open_order_rank.rn,0) as open_rn,
      row_number() over (partition by confirmation.work_order_id order by confirmation.confirmation_counter,confirmation.id) as seq,
      count(*) over (partition by confirmation.work_order_id) as total
    from public.work_order_confirmations confirmation
    join public.work_orders work_order on work_order.id=confirmation.work_order_id
    left join open_order_rank on open_order_rank.id=work_order.id
    where confirmation.site_id=p_site_id
  ),
  dates as (
    select id,status,seq,total,
      case
        when upper(status)='COMPLETED' then completed_date::timestamp+interval '10 hours'-(total-seq)*interval '3 hours'
        when open_rn between 1 and 24 then (p_anchor_date-((open_rn-1)%4)::int)::timestamp+interval '9 hours'-(total-seq)*interval '4 hours'
        else least((p_anchor_date-5)::timestamp+interval '10 hours',requested_date::timestamp+interval '1 day'+seq*interval '6 hours')
      end as new_confirmation_at
    from ranked
  )
  update public.work_order_confirmations confirmation
  set posting_date=dates.new_confirmation_at::date,
      confirmation_timestamp=dates.new_confirmation_at,
      final_confirmation=case when upper(dates.status)='COMPLETED' and dates.seq=dates.total then true else false end,
      source_updated_at=now(),updated_at=now()
  from dates
  where confirmation.id=dates.id;

  with ranked as (
    select schedule.id,schedule.pm_type,schedule.criticality,
      row_number() over (
        order by case lower(coalesce(schedule.criticality,'')) when 'critical' then 1 when 'high' then 2 else 3 end,
          case when lower(schedule.pm_type)='calibration' then 1 else 2 end,
          schedule.id
      ) as rn
    from public.preventive_maintenance schedule
    where schedule.site_id=p_site_id
  ),
  proposed as (
    select id,rn,pm_type,
      case
        when rn<=35 then p_anchor_date-(1+((rn-1)%35))::int
        when rn<=53 then p_anchor_date+((rn-36)%8)::int
        when rn<=88 then p_anchor_date+8+((rn-54)%23)::int
        when rn<=123 then p_anchor_date+31+((rn-89)%60)::int
        else p_anchor_date+91+((rn-124)%180)::int
      end as new_due_date
    from ranked
  ),
  dates as (
    select proposed.*,
      proposed.new_due_date-case
        when lower(schedule.frequency) like '%week%' then 7
        when lower(schedule.frequency) like '%month%' then 30
        when lower(schedule.frequency) like '%quarter%' then 90
        when lower(schedule.frequency) like '%biannual%' or lower(schedule.frequency) like '%half%' then 180
        when lower(schedule.frequency) like '%annual%' or lower(schedule.frequency) like '%year%' then 365
        else 90
      end as new_last_completed_date
    from proposed
    join public.preventive_maintenance schedule on schedule.id=proposed.id
  )
  update public.preventive_maintenance schedule
  set next_due_date=dates.new_due_date,
      last_completed_date=dates.new_last_completed_date,
      status=public.vorta_effective_pm_status(schedule.status,dates.new_due_date),
      calibration_result_at=case when lower(schedule.pm_type)='calibration' then dates.new_last_completed_date::timestamp+interval '10 hours' else schedule.calibration_result_at end,
      last_calibration_result=case when lower(schedule.pm_type)='calibration' then coalesce(schedule.last_calibration_result,'PASS') else schedule.last_calibration_result end,
      certificate_reference=case when lower(schedule.pm_type)='calibration' then coalesce(nullif(schedule.certificate_reference,''),'CAL-'||regexp_replace(asset.equipment_code,'[^A-Z0-9]','','g')||'-'||to_char(dates.new_last_completed_date,'YYYYMM')) else schedule.certificate_reference end,
      source_updated_at=now(),updated_at=now()
  from dates,public.equipment_assets asset
  where schedule.id=dates.id
    and asset.id=schedule.equipment_id;

  perform public.vorta_recalculate_equipment_risk_profiles();
  perform public.vorta_sync_equipment_risk_counts();
  perform public.vorta_recalculate_area_risk_profiles();
  perform public.vorta_recalculate_site_risk_profile();
  perform public.vorta_sync_maintenance_risk_work_plan();

  return private.vorta_get_demo_dataset_credibility_internal(p_site_id,p_anchor_date);
end;
$$;

revoke all on function private.vorta_refresh_demo_dataset_dates_internal(uuid,date) from public;
grant execute on function private.vorta_refresh_demo_dataset_dates_internal(uuid,date) to service_role;

