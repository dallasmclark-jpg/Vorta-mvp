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
      order by
        case
          when history_row.snapshot_date <= b.bucket_end then 0
          else 1
        end,
        case
          when history_row.snapshot_date <= b.bucket_end
            then history_row.snapshot_date
        end desc,
        case
          when history_row.snapshot_date > b.bucket_end
            then history_row.snapshot_date
        end asc
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
      else coalesce(s.snapshot_date, s.bucket_end)
    end as snapshot_date,
    coalesce(
      case
        when s.sort_order = v_bucket_count - 1
          then p.risk_score
        else s.risk_score
      end,
      s.risk_score,
      p.risk_score
    ) as risk_score,
    coalesce(
      case
        when s.sort_order = v_bucket_count - 1
          then p.risk_level
        else s.risk_level
      end,
      s.risk_level,
      p.risk_level,
      'Minimal'
    ) as risk_level,
    coalesce(
      case
        when s.sort_order = v_bucket_count - 1
          then p.primary_driver
        else s.primary_driver
      end,
      s.primary_driver,
      p.primary_driver
    ) as primary_driver,
    coalesce(
      case
        when s.sort_order = v_bucket_count - 1
          then p.main_driver_pct
        else s.main_driver_pct
      end,
      s.main_driver_pct,
      p.main_driver_pct,
      0
    ) as main_driver_pct,
    case
      when s.sort_order = v_bucket_count - 1
        then coalesce(
          p.risk_summary,
          'Current calculated equipment risk profile.'
        )
      when s.snapshot_date > s.bucket_end
        then 'Earliest verified equipment-risk snapshot used as the pre-history baseline.'
      when s.snapshot_date is null
        then 'Current calculated equipment risk used because no historical snapshot is available.'
      else s.change_reason
    end as change_reason,
    s.sort_order = v_bucket_count - 1 as is_live,
    s.sort_order
  from selected s
  cross join profile p
  order by s.sort_order;
end;
$function$;

comment on function public.vorta_get_equipment_risk_trend_internal(uuid, text, date)
is 'Returns complete equipment risk trend buckets. Buckets before the first stored snapshot use the earliest verified snapshot as a transparent baseline; the final bucket always uses the current calculated profile.';
