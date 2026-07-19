-- Add a read-only, site-authorised health report for demo backend trust.

create or replace function private.vorta_get_demo_backend_health_internal(p_site_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $$
with assets as (
  select asset.id,asset.equipment_code
  from public.equipment_assets asset
  where asset.site_id=p_site_id
),
coverage as (
  select
    count(*)::int as asset_count,
    coalesce(sum(case when not exists (select 1 from public.equipment_components component where component.equipment_id=asset.id) then 1 else 0 end),0)::int as assets_without_components,
    coalesce(sum(case when not exists (select 1 from public.knowledge_documents document where document.equipment_id=asset.id and document.is_current) then 1 else 0 end),0)::int as assets_without_documents,
    coalesce(sum(case when not exists (select 1 from public.knowledge_chunks chunk where chunk.equipment_id=asset.id) then 1 else 0 end),0)::int as assets_without_chunks,
    coalesce(sum(case when not exists (select 1 from public.equipment_fault_codes fault where fault.equipment_id=asset.id and fault.is_active) then 1 else 0 end),0)::int as assets_without_fault_codes,
    coalesce(sum(case when not exists (select 1 from public.equipment_required_skills skill where skill.equipment_id=asset.id) then 1 else 0 end),0)::int as assets_without_required_skills,
    coalesce(sum(case when not exists (
      select 1 from public.equipment_engineer_capabilities capability
      where capability.equipment_id=asset.id
        and capability.capability_status='ACTIVE'
        and capability.capability_role='PRIMARY_SME'
    ) then 1 else 0 end),0)::int as assets_without_primary_sme,
    coalesce(sum(case when not exists (select 1 from public.equipment_risk_profiles profile where profile.equipment_id=asset.id) then 1 else 0 end),0)::int as assets_without_risk_profile
  from assets asset
),
work_quality as (
  select
    coalesce(sum(case when work_order.is_overdue is distinct from public.vorta_work_order_is_overdue(work_order.status,work_order.due_date) then 1 else 0 end),0)::int as work_order_overdue_mismatches,
    coalesce(sum(case when upper(work_order.status)='COMPLETED' and work_order.outcome is null then 1 else 0 end),0)::int as completed_work_orders_without_outcome
  from public.work_orders work_order
  join assets asset on asset.id=work_order.equipment_id
),
pm_quality as (
  select
    coalesce(sum(case when schedule.status is distinct from public.vorta_effective_pm_status(schedule.status,schedule.next_due_date) then 1 else 0 end),0)::int as pm_status_mismatches,
    coalesce(sum(case when lower(coalesce(schedule.pm_type,''))='calibration' and (schedule.calibration_point is null or schedule.tolerance_specification is null) then 1 else 0 end),0)::int as calibrations_without_metadata
  from public.preventive_maintenance schedule
  join assets asset on asset.id=schedule.equipment_id
),
integrity as (
  select
    (select count(*)::int
     from public.work_orders work_order
     left join public.equipment_assets asset on asset.id=work_order.equipment_id
     where work_order.site_id=p_site_id and (asset.id is null or asset.site_id<>work_order.site_id)) as invalid_work_order_site_links,
    (select count(*)::int
     from public.work_order_confirmations confirmation
     left join public.work_orders work_order on work_order.id=confirmation.work_order_id
     where confirmation.site_id=p_site_id and (work_order.id is null or work_order.site_id<>confirmation.site_id)) as invalid_confirmation_site_links,
    (select count(*)::int
     from public.work_order_goods_movements movement
     left join public.work_orders work_order on work_order.id=movement.work_order_id
     where movement.site_id=p_site_id and (work_order.id is null or work_order.site_id<>movement.site_id)) as invalid_goods_movement_site_links,
    (select count(*)::int
     from public.knowledge_documents document
     left join public.equipment_assets asset on asset.id=document.equipment_id
     where document.site_id=p_site_id and document.equipment_id is not null
       and (asset.id is null or asset.site_id<>document.site_id)) as invalid_document_site_links,
    (select count(*)::int from (
      select lower(trim(work_order.source_system)),lower(trim(work_order.source_record_key))
      from public.work_orders work_order
      where work_order.site_id=p_site_id and work_order.source_record_key is not null
      group by 1,2 having count(*)>1
    ) duplicate_work_order) as duplicate_work_order_source_keys,
    (select count(*)::int from (
      select lower(trim(schedule.source_system)),lower(trim(schedule.source_record_key))
      from public.preventive_maintenance schedule
      where schedule.site_id=p_site_id and schedule.source_record_key is not null
      group by 1,2 having count(*)>1
    ) duplicate_pm) as duplicate_pm_source_keys,
    (select count(*)::int
     from public.equipment_risk_profiles profile
     join assets asset on asset.id=profile.equipment_id
     where profile.pm_backlog_pct+profile.asset_criticality_pct+profile.calibration_pct+
           profile.skills_pct+profile.spares_pct+profile.notification_pct<>100) as invalid_risk_driver_totals
),
signatures as (
  select
    asset.id,
    (select count(*) from public.work_orders work_order where work_order.equipment_id=asset.id) as work_order_count,
    (select count(*) from public.preventive_maintenance schedule where schedule.equipment_id=asset.id) as pm_count,
    (select count(*) from public.equipment_components component where component.equipment_id=asset.id) as component_count,
    (select count(*) from public.knowledge_documents document where document.equipment_id=asset.id and document.is_current) as document_count,
    (select count(*) from public.knowledge_chunks chunk where chunk.equipment_id=asset.id) as chunk_count,
    (select count(*) from public.equipment_fault_codes fault where fault.equipment_id=asset.id and fault.is_active) as fault_count,
    (select count(*) from public.equipment_engineer_capabilities capability where capability.equipment_id=asset.id and capability.capability_status='ACTIVE') as capability_count
  from assets asset
),
signature_groups as (
  select count(*)::int as asset_count
  from signatures
  group by work_order_count,pm_count,component_count,document_count,chunk_count,fault_count,capability_count
),
realism as (
  select coalesce(max(asset_count),0)::int as largest_identical_signature_group
  from signature_groups
),
summary as (
  select coverage.*,work_quality.*,pm_quality.*,integrity.*,realism.*
  from coverage,work_quality,pm_quality,integrity,realism
)
select jsonb_build_object(
  'siteId',p_site_id,
  'checkedAt',now(),
  'healthy',
    asset_count>=35
    and assets_without_components=0
    and assets_without_documents=0
    and assets_without_chunks=0
    and assets_without_fault_codes=0
    and assets_without_required_skills=0
    and assets_without_primary_sme=0
    and assets_without_risk_profile=0
    and work_order_overdue_mismatches=0
    and completed_work_orders_without_outcome=0
    and pm_status_mismatches=0
    and calibrations_without_metadata=0
    and invalid_work_order_site_links=0
    and invalid_confirmation_site_links=0
    and invalid_goods_movement_site_links=0
    and invalid_document_site_links=0
    and duplicate_work_order_source_keys=0
    and duplicate_pm_source_keys=0
    and invalid_risk_driver_totals=0
    and largest_identical_signature_group<=1,
  'assetCount',asset_count,
  'coverage',jsonb_build_object(
    'assetsWithoutComponents',assets_without_components,
    'assetsWithoutDocuments',assets_without_documents,
    'assetsWithoutChunks',assets_without_chunks,
    'assetsWithoutFaultCodes',assets_without_fault_codes,
    'assetsWithoutRequiredSkills',assets_without_required_skills,
    'assetsWithoutPrimarySme',assets_without_primary_sme,
    'assetsWithoutRiskProfile',assets_without_risk_profile
  ),
  'maintenanceTruth',jsonb_build_object(
    'workOrderOverdueMismatches',work_order_overdue_mismatches,
    'completedWorkOrdersWithoutOutcome',completed_work_orders_without_outcome,
    'pmStatusMismatches',pm_status_mismatches,
    'calibrationsWithoutMetadata',calibrations_without_metadata
  ),
  'integrity',jsonb_build_object(
    'invalidWorkOrderSiteLinks',invalid_work_order_site_links,
    'invalidConfirmationSiteLinks',invalid_confirmation_site_links,
    'invalidGoodsMovementSiteLinks',invalid_goods_movement_site_links,
    'invalidDocumentSiteLinks',invalid_document_site_links,
    'duplicateWorkOrderSourceKeys',duplicate_work_order_source_keys,
    'duplicatePmSourceKeys',duplicate_pm_source_keys,
    'invalidRiskDriverTotals',invalid_risk_driver_totals
  ),
  'realism',jsonb_build_object(
    'largestIdenticalSignatureGroup',largest_identical_signature_group
  )
)
from summary;
$$;

revoke all on function private.vorta_get_demo_backend_health_internal(uuid) from public;

create or replace function public.vorta_get_demo_backend_health()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
begin
  if not public.vorta_has_site_access(v_site_id,false) then
    return null;
  end if;
  return private.vorta_get_demo_backend_health_internal(v_site_id);
end;
$$;

revoke all on function public.vorta_get_demo_backend_health() from public,anon;
grant execute on function public.vorta_get_demo_backend_health() to authenticated,service_role;

do $$
declare
  v_health jsonb;
begin
  v_health := private.vorta_get_demo_backend_health_internal(
    '11000000-0000-0000-0000-000000000001'::uuid
  );
  if not coalesce((v_health->>'healthy')::boolean,false) then
    raise exception 'Wrexham demo backend health contract failed: %',v_health;
  end if;
end;
$$;
