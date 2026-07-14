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
  v_start_date date;
  v_bucket_days integer;
  v_bucket_count integer;
begin
  if v_period = '7d' then
    v_start_date := v_anchor_date - 6;
    v_bucket_days := 1;
    v_bucket_count := 7;
  elsif v_period = '30d' then
    v_start_date := v_anchor_date - 29;
    v_bucket_days := 5;
    v_bucket_count := 6;
  elsif v_period = '90d' then
    v_start_date := v_anchor_date - 89;
    v_bucket_days := 15;
    v_bucket_count := 6;
  elsif v_period = 'ytd' then
    v_start_date := date_trunc('year', v_anchor_date)::date;
    v_bucket_days := null;
    v_bucket_count :=
      extract(month from age(v_anchor_date, v_start_date))::integer
      + 1;
  else
    raise exception 'Unsupported equipment risk trend period: %', p_period
      using errcode = '22023';
  end if;

  return query
  with profile as (
    select
      p.risk_score,
      p.risk_level,
      p.pm_backlog_pct,
      p.asset_criticality_pct,
      p.calibration_pct,
      p.skills_pct,
      p.spares_pct,
      p.risk_summary
    from public.equipment_risk_profiles p
    where p.equipment_id = p_equipment_id
    limit 1
  ),
  buckets as (
    select
      series.index_value as sort_order,
      case
        when v_period = 'ytd'
          then (
            v_start_date
              + series.index_value * interval '1 month'
          )::date
        else
          v_start_date
            + series.index_value * v_bucket_days
      end as bucket_start,
      case
        when v_period = 'ytd'
          then least(
            v_anchor_date,
            (
              v_start_date
                + (series.index_value + 1) * interval '1 month'
                - interval '1 day'
            )::date
          )
        else
          least(
            v_anchor_date,
            v_start_date
              + ((series.index_value + 1) * v_bucket_days)
              - 1
          )
      end as bucket_end
    from generate_series(
      0,
      v_bucket_count - 1
    ) as series(index_value)
  ),
  selected as (
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
    from buckets b
    left join lateral (
      select history_row.*
      from public.equipment_risk_history history_row
      where history_row.equipment_id = p_equipment_id
        and history_row.snapshot_date <= b.bucket_end
      order by history_row.snapshot_date desc
      limit 1
    ) h on true
  )
  select
    v_period as period_key,
    case
      when v_period = 'ytd'
        then to_char(s.bucket_start, 'Mon')
      else to_char(s.bucket_end, 'DD Mon')
    end as period_label,
    s.bucket_start,
    s.bucket_end,
    case
      when s.sort_order = v_bucket_count - 1
        then v_anchor_date
      else s.snapshot_date
    end as snapshot_date,
    case
      when s.sort_order = v_bucket_count - 1
        then p.risk_score
      else s.risk_score
    end as risk_score,
    case
      when s.sort_order = v_bucket_count - 1
        then p.risk_level
      else s.risk_level
    end as risk_level,
    case
      when s.sort_order = v_bucket_count - 1 then
        case greatest(
          p.pm_backlog_pct,
          p.asset_criticality_pct,
          p.calibration_pct,
          p.skills_pct,
          p.spares_pct
        )
          when p.pm_backlog_pct then 'PM Backlog'
          when p.asset_criticality_pct then 'Asset Criticality'
          when p.calibration_pct then 'Calibration'
          when p.skills_pct then 'Labour Coverage'
          else 'Spares'
        end
      else s.primary_driver
    end as primary_driver,
    case
      when s.sort_order = v_bucket_count - 1
        then greatest(
          p.pm_backlog_pct,
          p.asset_criticality_pct,
          p.calibration_pct,
          p.skills_pct,
          p.spares_pct
        )
      else s.main_driver_pct
    end as main_driver_pct,
    case
      when s.sort_order = v_bucket_count - 1
        then coalesce(
          p.risk_summary,
          'Current calculated equipment risk profile.'
        )
      else s.change_reason
    end as change_reason,
    s.sort_order = v_bucket_count - 1 as is_live,
    s.sort_order
  from selected s
  cross join profile p
  order by s.sort_order;
end;
$function$;
