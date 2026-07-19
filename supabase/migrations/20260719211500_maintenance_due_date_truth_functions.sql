-- Make maintenance due dates authoritative for risk and UI calculations.
-- Stored status labels remain presentation data; effective status is derived from dates.

create or replace function public.vorta_effective_pm_status(
  p_status text,
  p_next_due_date date
)
returns text
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  select case
    when upper(coalesce(p_status, '')) = 'COMPLETED' then 'COMPLETED'
    when p_next_due_date is not null and p_next_due_date < current_date then 'OVERDUE'
    when p_next_due_date is not null and p_next_due_date <= current_date + 14 then 'DUE SOON'
    when upper(coalesce(p_status, '')) in ('OVERDUE', 'DUE SOON') then 'ON TRACK'
    else coalesce(nullif(p_status, ''), 'PLANNED')
  end;
$$;

create or replace function public.vorta_work_order_is_overdue(
  p_status text,
  p_due_date date
)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(
    upper(coalesce(p_status, 'OPEN')) <> 'COMPLETED'
      and p_due_date is not null
      and p_due_date < current_date,
    false
  );
$$;

create or replace function public.vorta_pm_backlog_score(p_equipment_id uuid)
returns integer
language sql
stable
set search_path to 'public'
as $$
  select least(
    100,
    (count(*) filter (
      where public.vorta_effective_pm_status(status, next_due_date) = 'OVERDUE'
        and lower(coalesce(pm_type, '')) <> 'calibration'
    ))::int * 28
    + (count(*) filter (
      where public.vorta_effective_pm_status(status, next_due_date) = 'DUE SOON'
        and lower(coalesce(pm_type, '')) <> 'calibration'
    ))::int * 10
  )
  from public.preventive_maintenance
  where equipment_id = p_equipment_id;
$$;

create or replace function public.vorta_calibration_score(p_equipment_id uuid)
returns integer
language sql
stable
set search_path to 'public'
as $$
  select least(
    100,
    (count(*) filter (
      where public.vorta_effective_pm_status(status, next_due_date) = 'OVERDUE'
    ))::int * 35
    + (count(*) filter (
      where public.vorta_effective_pm_status(status, next_due_date) = 'DUE SOON'
    ))::int * 12
  )
  from public.preventive_maintenance
  where equipment_id = p_equipment_id
    and lower(coalesce(pm_type, '')) = 'calibration';
$$;
