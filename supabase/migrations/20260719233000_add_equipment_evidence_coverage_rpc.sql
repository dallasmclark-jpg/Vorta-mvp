-- Return one aggregate evidence row per authorised equipment asset.
-- This replaces five client-side table scans that downloaded every matching
-- evidence record merely to calculate counts in the browser.

create or replace function public.vorta_get_equipment_evidence_coverage(
  p_equipment_ids uuid[]
)
returns table(
  equipment_id uuid,
  component_count integer,
  document_count integer,
  fault_code_count integer,
  work_order_count integer,
  maintenance_schedule_count integer,
  evidence_score integer,
  evidence_complete boolean
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if p_equipment_ids is null
    or cardinality(p_equipment_ids) = 0 then
    return;
  end if;

  if cardinality(p_equipment_ids) > 500 then
    raise exception 'Equipment evidence coverage is limited to 500 assets per request.';
  end if;

  return query
  with requested as (
    select distinct requested_id as equipment_id
    from unnest(p_equipment_ids) requested_id
  ),
  authorised as (
    select equipment.id as equipment_id
    from requested
    join public.equipment_assets equipment
      on equipment.id = requested.equipment_id
    where public.vorta_has_site_access(equipment.site_id, false)
  ),
  component_counts as (
    select component.equipment_id, count(*)::integer as count
    from public.equipment_components component
    join authorised on authorised.equipment_id = component.equipment_id
    group by component.equipment_id
  ),
  document_counts as (
    select document.equipment_id, count(*)::integer as count
    from public.knowledge_documents document
    join authorised on authorised.equipment_id = document.equipment_id
    where document.is_current
    group by document.equipment_id
  ),
  fault_code_counts as (
    select fault.equipment_id, count(*)::integer as count
    from public.equipment_fault_codes fault
    join authorised on authorised.equipment_id = fault.equipment_id
    where fault.is_active
    group by fault.equipment_id
  ),
  work_order_counts as (
    select work_order.equipment_id, count(*)::integer as count
    from public.work_orders work_order
    join authorised on authorised.equipment_id = work_order.equipment_id
    group by work_order.equipment_id
  ),
  schedule_counts as (
    select maintenance.equipment_id, count(*)::integer as count
    from public.preventive_maintenance maintenance
    join authorised on authorised.equipment_id = maintenance.equipment_id
    group by maintenance.equipment_id
  ),
  assembled as (
    select
      authorised.equipment_id,
      coalesce(component_counts.count, 0)::integer as component_count,
      coalesce(document_counts.count, 0)::integer as document_count,
      coalesce(fault_code_counts.count, 0)::integer as fault_code_count,
      coalesce(work_order_counts.count, 0)::integer as work_order_count,
      coalesce(schedule_counts.count, 0)::integer as maintenance_schedule_count
    from authorised
    left join component_counts using (equipment_id)
    left join document_counts using (equipment_id)
    left join fault_code_counts using (equipment_id)
    left join work_order_counts using (equipment_id)
    left join schedule_counts using (equipment_id)
  )
  select
    assembled.equipment_id,
    assembled.component_count,
    assembled.document_count,
    assembled.fault_code_count,
    assembled.work_order_count,
    assembled.maintenance_schedule_count,
    (
      (assembled.component_count > 0)::integer
      + (assembled.document_count > 0)::integer
      + (assembled.fault_code_count > 0)::integer
      + (assembled.work_order_count > 0)::integer
      + (assembled.maintenance_schedule_count > 0)::integer
    )::integer as evidence_score,
    assembled.component_count > 0
      and assembled.document_count > 0
      and assembled.fault_code_count > 0
      and assembled.work_order_count > 0
      and assembled.maintenance_schedule_count > 0
      as evidence_complete
  from assembled
  order by assembled.equipment_id;
end;
$function$;

revoke all on function public.vorta_get_equipment_evidence_coverage(uuid[])
  from public, anon;
grant execute on function public.vorta_get_equipment_evidence_coverage(uuid[])
  to authenticated, service_role;

comment on function public.vorta_get_equipment_evidence_coverage(uuid[]) is
  'Returns set-based evidence counts for authorised equipment assets without exposing underlying evidence rows.';
