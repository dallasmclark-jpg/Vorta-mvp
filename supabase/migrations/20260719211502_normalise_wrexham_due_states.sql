-- Backfill the Wrexham demo records, then rebuild all risk aggregates.

update public.work_orders
set
  is_overdue = public.vorta_work_order_is_overdue(status, due_date),
  updated_at = now()
where site_id = '11000000-0000-0000-0000-000000000001'::uuid
  and is_overdue is distinct from public.vorta_work_order_is_overdue(status, due_date);

update public.preventive_maintenance
set
  status = public.vorta_effective_pm_status(status, next_due_date),
  updated_at = now()
where site_id = '11000000-0000-0000-0000-000000000001'::uuid
  and status is distinct from public.vorta_effective_pm_status(status, next_due_date);

select public.vorta_recalculate_equipment_risk_profiles();
select public.vorta_sync_equipment_risk_counts();
select public.vorta_recalculate_area_risk_profiles();
select public.vorta_recalculate_site_risk_profile();
select public.vorta_sync_maintenance_risk_work_plan();

do $$
begin
  if exists (
    select 1
    from public.work_orders
    where site_id = '11000000-0000-0000-0000-000000000001'::uuid
      and is_overdue is distinct from public.vorta_work_order_is_overdue(status, due_date)
  ) then
    raise exception 'Wrexham work-order overdue flags remain inconsistent with due dates';
  end if;

  if exists (
    select 1
    from public.preventive_maintenance
    where site_id = '11000000-0000-0000-0000-000000000001'::uuid
      and status is distinct from public.vorta_effective_pm_status(status, next_due_date)
  ) then
    raise exception 'Wrexham PM statuses remain inconsistent with due dates';
  end if;
end;
$$;
