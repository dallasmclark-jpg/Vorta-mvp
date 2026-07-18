do $migration$
declare
  v_site_id uuid;
begin
  select coalesce(
    (
      select profile.site_id
      from public.site_risk_profile profile
      where profile.site_id is not null
      order by profile.updated_at desc
      limit 1
    ),
    public.vorta_current_demo_site_id()
  )
  into v_site_id;

  if v_site_id is null then
    raise exception 'Unable to resolve site for existing risk history';
  end if;

  update public.site_risk_history
  set site_id = v_site_id
  where site_id is null;
end;
$migration$;

alter table public.site_risk_history
  drop constraint if exists site_risk_history_snapshot_date_key;

alter table public.site_risk_history
  alter column site_id set not null;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.site_risk_history'::regclass
      and conname = 'site_risk_history_site_id_snapshot_date_key'
  ) then
    alter table public.site_risk_history
      add constraint site_risk_history_site_id_snapshot_date_key
      unique (site_id, snapshot_date);
  end if;
end;
$migration$;

create or replace function public.vorta_create_risk_history_snapshot(
  p_snapshot_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_equipment_rows integer := 0;
  v_site_rows integer := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  insert into public.equipment_risk_history (
    equipment_id,
    snapshot_date,
    risk_score,
    risk_level,
    pm_backlog_pct,
    asset_criticality_pct,
    calibration_pct,
    skills_pct,
    spares_pct,
    overdue_pm_count,
    calibration_overdue_count,
    critical_spares_missing,
    snapshot_label,
    source_event,
    primary_driver,
    main_driver_pct,
    change_reason,
    captured_at,
    operational_risk_score,
    labour_risk_score,
    scheduled_engineer_count,
    labour_shift_type
  )
  select
    profile.equipment_id,
    p_snapshot_date,
    profile.risk_score,
    profile.risk_level,
    coalesce(profile.pm_backlog_pct, 0),
    coalesce(profile.asset_criticality_pct, 0),
    coalesce(profile.calibration_pct, 0),
    coalesce(profile.skills_pct, 0),
    coalesce(profile.spares_pct, 0),
    coalesce(profile.overdue_pm_count, 0),
    coalesce(profile.calibration_overdue_count, 0),
    coalesce(profile.critical_spares_missing, 0),
    to_char(p_snapshot_date, 'DD Mon'),
    'daily capability and risk snapshot',
    case greatest(
      coalesce(profile.pm_backlog_pct, 0),
      coalesce(profile.asset_criticality_pct, 0),
      coalesce(profile.calibration_pct, 0),
      coalesce(profile.skills_pct, 0),
      coalesce(profile.spares_pct, 0)
    )
      when coalesce(profile.pm_backlog_pct, 0) then 'PM Backlog'
      when coalesce(profile.asset_criticality_pct, 0) then 'Asset Criticality'
      when coalesce(profile.calibration_pct, 0) then 'Calibration'
      when coalesce(profile.skills_pct, 0) then 'Skills'
      else 'Spares'
    end,
    greatest(
      coalesce(profile.pm_backlog_pct, 0),
      coalesce(profile.asset_criticality_pct, 0),
      coalesce(profile.calibration_pct, 0),
      coalesce(profile.skills_pct, 0),
      coalesce(profile.spares_pct, 0)
    ),
    'Snapshot captured after risk recalculation from the latest available leading indicators.',
    now(),
    profile.operational_risk_score,
    profile.labour_risk_score,
    profile.scheduled_engineer_count,
    profile.labour_shift_type
  from public.equipment_risk_profiles profile
  on conflict (equipment_id, snapshot_date) do update set
    risk_score = excluded.risk_score,
    risk_level = excluded.risk_level,
    pm_backlog_pct = excluded.pm_backlog_pct,
    asset_criticality_pct = excluded.asset_criticality_pct,
    calibration_pct = excluded.calibration_pct,
    skills_pct = excluded.skills_pct,
    spares_pct = excluded.spares_pct,
    overdue_pm_count = excluded.overdue_pm_count,
    calibration_overdue_count = excluded.calibration_overdue_count,
    critical_spares_missing = excluded.critical_spares_missing,
    snapshot_label = excluded.snapshot_label,
    source_event = excluded.source_event,
    primary_driver = excluded.primary_driver,
    main_driver_pct = excluded.main_driver_pct,
    change_reason = excluded.change_reason,
    captured_at = excluded.captured_at,
    operational_risk_score = excluded.operational_risk_score,
    labour_risk_score = excluded.labour_risk_score,
    scheduled_engineer_count = excluded.scheduled_engineer_count,
    labour_shift_type = excluded.labour_shift_type;

  get diagnostics v_equipment_rows = row_count;

  insert into public.site_risk_history (
    site_id,
    snapshot_date,
    risk_score,
    risk_level,
    highest_area,
    highest_area_score,
    at_risk_assets,
    overdue_pm_count,
    calibration_backlog_count,
    cover_gap_count,
    operational_risk_score,
    labour_risk_score,
    scheduled_engineer_count,
    labour_shift_type
  )
  select
    profile.site_id,
    p_snapshot_date,
    profile.risk_score,
    profile.risk_level,
    profile.highest_area,
    profile.highest_area_score,
    profile.at_risk_assets,
    profile.overdue_pm_count,
    profile.calibration_backlog_count,
    profile.cover_gap_count,
    profile.operational_risk_score,
    profile.labour_risk_score,
    profile.scheduled_engineer_count,
    profile.labour_shift_type
  from public.site_risk_profile profile
  where profile.site_id is not null
  on conflict (site_id, snapshot_date) do update set
    risk_score = excluded.risk_score,
    risk_level = excluded.risk_level,
    highest_area = excluded.highest_area,
    highest_area_score = excluded.highest_area_score,
    at_risk_assets = excluded.at_risk_assets,
    overdue_pm_count = excluded.overdue_pm_count,
    calibration_backlog_count = excluded.calibration_backlog_count,
    cover_gap_count = excluded.cover_gap_count,
    operational_risk_score = excluded.operational_risk_score,
    labour_risk_score = excluded.labour_risk_score,
    scheduled_engineer_count = excluded.scheduled_engineer_count,
    labour_shift_type = excluded.labour_shift_type;

  get diagnostics v_site_rows = row_count;
  return v_equipment_rows + v_site_rows;
end;
$function$;

revoke all on function public.vorta_create_risk_history_snapshot(date) from public;
revoke all on function public.vorta_create_risk_history_snapshot(date) from anon;
revoke all on function public.vorta_create_risk_history_snapshot(date) from authenticated;
grant execute on function public.vorta_create_risk_history_snapshot(date) to service_role;

comment on function public.vorta_create_risk_history_snapshot(date) is
  'Captures service-role-only site-scoped equipment and site risk history for a date.';