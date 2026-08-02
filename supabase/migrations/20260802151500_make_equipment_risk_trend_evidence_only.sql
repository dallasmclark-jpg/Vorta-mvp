create or replace function public.vorta_get_equipment_risk_trend_internal(
  p_equipment_id uuid,
  p_period text default '30d'::text,
  p_anchor_date date default current_date
)
returns table (
  period_key text,
  period_label text,
  bucket_start date,
  bucket_end date,
  snapshot_date date,
  risk_score integer,
  risk_level text,
  primary_driver text,
  main_driver_pct integer,
  change_reason text,
  is_live boolean,
  sort_order integer
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_period text := lower(trim(coalesce(p_period, '30d')));
  v_anchor_date date := coalesce(p_anchor_date, current_date);
  v_history_start_date date;
  v_bucket_days integer;
  v_history_bucket_count integer;
begin
  if v_period = '7d' then
    v_history_start_date := v_anchor_date - 6;
    v_bucket_days := 1;
    v_history_bucket_count := 6;
  elsif v_period = '30d' then
    v_history_start_date := v_anchor_date - 29;
    v_bucket_days := 5;
    v_history_bucket_count := 6;
  elsif v_period = '90d' then
    v_history_start_date := v_anchor_date - 89;
    v_bucket_days := 15;
    v_history_bucket_count := 6;
  elsif v_period = 'ytd' then
    v_history_start_date := date_trunc('year', v_anchor_date)::date;
    v_bucket_days := null;
    v_history_bucket_count := greatest(
      extract(month from v_anchor_date)::integer - 1,
      0
    );
  else
    raise exception 'Unsupported equipment risk trend period: %', p_period
      using errcode = '22023';
  end if;

  return query
  with profile as (
    select
      p.risk_score,
      p.risk_level,
      p.risk_summary,
      case greatest(
        coalesce(p.pm_backlog_pct, 0),
        coalesce(p.asset_criticality_pct, 0),
        coalesce(p.calibration_pct, 0),
        coalesce(p.skills_pct, 0),
        coalesce(p.spares_pct, 0)
      )
        when coalesce(p.pm_backlog_pct, 0) then 'PM Backlog'
        when coalesce(p.asset_criticality_pct, 0) then 'Asset Criticality'
        when coalesce(p.calibration_pct, 0) then 'Calibration'
        when coalesce(p.skills_pct, 0) then 'Labour Coverage'
        else 'Spares'
      end as primary_driver,
      greatest(
        coalesce(p.pm_backlog_pct, 0),
        coalesce(p.asset_criticality_pct, 0),
        coalesce(p.calibration_pct, 0),
        coalesce(p.skills_pct, 0),
        coalesce(p.spares_pct, 0)
      ) as main_driver_pct
    from public.equipment_risk_profiles p
    where p.equipment_id = p_equipment_id
    limit 1
  ),
  earliest_history as (
    select min(h.snapshot_date) as first_snapshot_date
    from public.equipment_risk_history h
    where h.equipment_id = p_equipment_id
  ),
  history_buckets as (
    select
      series.index_value as sort_order,
      case
        when v_period = 'ytd' then (
          v_history_start_date
            + series.index_value * interval '1 month'
        )::date
        else
          v_history_start_date
            + series.index_value * v_bucket_days
      end as bucket_start,
      case
        when v_period = 'ytd' then (
          v_history_start_date
            + (series.index_value + 1) * interval '1 month'
            - interval '1 day'
        )::date
        else least(
          v_anchor_date - 1,
          v_history_start_date
            + ((series.index_value + 1) * v_bucket_days)
            - 1
        )
      end as bucket_end
    from generate_series(
      0,
      v_history_bucket_count - 1
    ) as series(index_value)
  ),
  verified_history as (
    select
      b.sort_order,
      b.bucket_start,
      b.bucket_end,
      h.snapshot_date,
      h.risk_score,
      h.risk_level,
      h.primary_driver,
      h.main_driver_pct,
      h.change_reason
    from history_buckets b
    join lateral (
      select history_row.*
      from public.equipment_risk_history history_row
      where history_row.equipment_id = p_equipment_id
        and history_row.snapshot_date between b.bucket_start and b.bucket_end
      order by history_row.snapshot_date desc
      limit 1
    ) h on true
  ),
  evidence_points as (
    select
      v_period as period_key,
      case
        when v_period = 'ytd' then to_char(h.bucket_start, 'Mon')
        else to_char(h.bucket_end, 'DD Mon')
      end as period_label,
      h.bucket_start,
      h.bucket_end,
      h.snapshot_date,
      h.risk_score,
      h.risk_level,
      h.primary_driver,
      h.main_driver_pct,
      h.change_reason,
      false as is_live,
      h.sort_order
    from verified_history h
  ),
  live_point as (
    select
      v_period as period_key,
      to_char(v_anchor_date, 'DD Mon') as period_label,
      v_anchor_date as bucket_start,
      v_anchor_date as bucket_end,
      v_anchor_date as snapshot_date,
      p.risk_score,
      p.risk_level,
      p.primary_driver,
      p.main_driver_pct,
      case
        when eh.first_snapshot_date is null then
          concat_ws(
            ' ',
            nullif(trim(coalesce(p.risk_summary, '')), ''),
            'No verified historical snapshots are available; showing the current calculated risk only.'
          )
        else
          concat_ws(
            ' ',
            nullif(trim(coalesce(p.risk_summary, '')), ''),
            format(
              'Verified history begins %s; earlier periods are not plotted.',
              to_char(eh.first_snapshot_date, 'DD Mon YYYY')
            )
          )
      end as change_reason,
      true as is_live,
      v_history_bucket_count as sort_order
    from profile p
    cross join earliest_history eh
  )
  select *
  from evidence_points

  union all

  select *
  from live_point

  order by sort_order;
end;
$function$;

comment on function public.vorta_get_equipment_risk_trend_internal(uuid, text, date)
is 'Returns only evidence-backed equipment risk history points plus one separate current live point. Empty and pre-history buckets are omitted rather than backfilled with copied scores.';