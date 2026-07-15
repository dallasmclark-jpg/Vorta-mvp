create or replace function public.vorta_get_scoped_risk_reduction_kpis_internal(
  p_period text default 'daily'::text,
  p_anchor_date date default null::date,
  p_area text default null::text
)
returns table(
  period_key text,
  period_label text,
  period_start date,
  period_end date,
  comparison_label text,
  kpis jsonb
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_site_id uuid;
  v_period_key text;
  v_anchor_date date;
  v_requested_anchor_date date;
  v_period_start date;
  v_period_end date;
  v_previous_start date;
  v_previous_end date;
  v_period_label text;
  v_comparison_label text;
  v_fiscal_month integer := 1;
  v_fiscal_year integer;
  v_latest_operational_date date;
  v_previous_operational_date date;
  v_kpis jsonb := '[]'::jsonb;
begin
  v_period_key := lower(coalesce(p_period, 'daily'));

  if v_period_key not in ('daily','weekly','monthly','ytd') then
    raise exception 'Invalid KPI period: %', p_period;
  end if;

  select profile.site_id
  into v_site_id
  from public.site_risk_profile profile
  where profile.id = 1;

  if v_site_id is null then
    return;
  end if;

  if p_area is not null and not exists (
    select 1
    from public.equipment_assets equipment
    where equipment.site_id = v_site_id
      and equipment.area = p_area
  ) then
    return;
  end if;

  select
    coalesce(site.fiscal_year_start_month, 1),
    coalesce(
      p_anchor_date,
      (now() at time zone coalesce(site.timezone, 'Europe/London'))::date
    )
  into v_fiscal_month, v_requested_anchor_date
  from public.sites site
  where site.id = v_site_id;

  v_anchor_date := v_requested_anchor_date;

  case v_period_key
    when 'daily' then
      /*
       * Daily performance should not collapse to an empty dashboard before
       * the current day's work has completed. Use the latest reporting day
       * with a completed high/critical assessment, then progressively fall
       * back to any completed priority work or any planned priority work.
       * The returned date and label make the fallback explicit.
       */
      select max(plan.planned_date)
      into v_latest_operational_date
      from public.maintenance_risk_work_plan plan
      join public.work_orders work_order
        on work_order.id = plan.work_order_id
      join public.equipment_assets equipment
        on equipment.id = plan.equipment_id
      where plan.site_id = v_site_id
        and plan.is_risk_priority
        and plan.planned_date <= v_requested_anchor_date
        and coalesce(plan.completed_at::date, work_order.completed_date) is not null
        and lower(coalesce(plan.risk_level_before, '')) in ('critical', 'high')
        and plan.risk_level_after is not null
        and (p_area is null or equipment.area = p_area);

      if v_latest_operational_date is null then
        select max(plan.planned_date)
        into v_latest_operational_date
        from public.maintenance_risk_work_plan plan
        join public.work_orders work_order
          on work_order.id = plan.work_order_id
        join public.equipment_assets equipment
          on equipment.id = plan.equipment_id
        where plan.site_id = v_site_id
          and plan.is_risk_priority
          and plan.planned_date <= v_requested_anchor_date
          and coalesce(plan.completed_at::date, work_order.completed_date) is not null
          and (p_area is null or equipment.area = p_area);
      end if;

      if v_latest_operational_date is null then
        select max(plan.planned_date)
        into v_latest_operational_date
        from public.maintenance_risk_work_plan plan
        join public.equipment_assets equipment
          on equipment.id = plan.equipment_id
        where plan.site_id = v_site_id
          and plan.is_risk_priority
          and plan.planned_date <= v_requested_anchor_date
          and (p_area is null or equipment.area = p_area);
      end if;

      v_anchor_date := coalesce(v_latest_operational_date, v_requested_anchor_date);
      v_period_start := v_anchor_date;
      v_period_end := v_anchor_date;

      select max(plan.planned_date)
      into v_previous_operational_date
      from public.maintenance_risk_work_plan plan
      join public.work_orders work_order
        on work_order.id = plan.work_order_id
      join public.equipment_assets equipment
        on equipment.id = plan.equipment_id
      where plan.site_id = v_site_id
        and plan.is_risk_priority
        and plan.planned_date < v_anchor_date
        and coalesce(plan.completed_at::date, work_order.completed_date) is not null
        and (p_area is null or equipment.area = p_area);

      v_previous_start := coalesce(v_previous_operational_date, v_anchor_date - 1);
      v_previous_end := v_previous_start;
      v_period_label := case
        when v_anchor_date = v_requested_anchor_date then 'Daily'
        else 'Latest reporting day'
      end;
      v_comparison_label := 'vs previous reporting day';

    when 'weekly' then
      v_period_start := v_anchor_date - 6;
      v_period_end := v_anchor_date;
      v_previous_start := v_anchor_date - 13;
      v_previous_end := v_anchor_date - 7;
      v_period_label := 'Rolling 7 days';
      v_comparison_label := 'vs previous 7 days';

    when 'monthly' then
      v_period_start := date_trunc('month', v_anchor_date)::date;
      v_period_end := v_anchor_date;
      v_previous_start := date_trunc('month', v_period_start - 1)::date;
      v_previous_end := least(
        v_previous_start + (v_period_end - v_period_start),
        v_period_start - 1
      );
      v_period_label := 'Month to date';
      v_comparison_label := 'vs previous month to date';

    when 'ytd' then
      v_fiscal_year := extract(year from v_anchor_date)::integer;
      if extract(month from v_anchor_date)::integer < v_fiscal_month then
        v_fiscal_year := v_fiscal_year - 1;
      end if;
      v_period_start := make_date(v_fiscal_year, v_fiscal_month, 1);
      v_period_end := v_anchor_date;
      v_previous_start := (v_period_start - interval '1 year')::date;
      v_previous_end := (v_period_end - interval '1 year')::date;
      v_period_label := 'Year to date';
      v_comparison_label := 'vs same period last year';
  end case;

  with current_metrics as (
    select *
    from public.vorta_calculate_scoped_risk_reduction_kpis(
      v_site_id, v_period_start, v_period_end, p_area
    )
  ),
  previous_metrics as (
    select *
    from public.vorta_calculate_scoped_risk_reduction_kpis(
      v_site_id, v_previous_start, v_previous_end, p_area
    )
  ),
  assembled as (
    select
      target.metric_key,
      target.label,
      target.description,
      case
        when target.metric_key = 'risk_reduction_achieved'
          then current_metric.denominator
        else target.target_value
      end as effective_target,
      target.amber_tolerance,
      target.direction,
      target.display_order,
      target.drilldown_route,
      current_metric.metric_value,
      current_metric.numerator,
      current_metric.denominator,
      current_metric.detail,
      current_metric.critical_override,
      current_metric.no_data,
      previous_metric.metric_value as previous_value,
      previous_metric.no_data as previous_no_data,
      case
        when current_metric.no_data then 'neutral'
        when current_metric.critical_override then 'red'
        when target.metric_key = 'risk_reduction_achieved'
          and current_metric.denominator > 0
          and current_metric.numerator / current_metric.denominator >= 0.90 then 'green'
        when target.metric_key = 'risk_reduction_achieved'
          and current_metric.denominator > 0
          and current_metric.numerator / current_metric.denominator >= 0.75 then 'amber'
        when target.metric_key = 'risk_reduction_achieved' then 'red'
        when target.direction = 'higher'
          and current_metric.metric_value >= target.target_value then 'green'
        when target.direction = 'higher'
          and current_metric.metric_value >= target.target_value - target.amber_tolerance then 'amber'
        when target.direction = 'lower'
          and current_metric.metric_value <= target.target_value then 'green'
        when target.direction = 'lower'
          and current_metric.metric_value <= target.target_value + target.amber_tolerance then 'amber'
        else 'red'
      end as rag_status,
      case
        when current_metric.no_data
          or coalesce(previous_metric.no_data, true)
          or previous_metric.metric_value is null then null
        else round(current_metric.metric_value - previous_metric.metric_value, 1)
      end as trend_delta,
      case target.metric_key
        when 'risk_reduction_achieved' then 'risk_points'
        when 'high_critical_risks_eliminated' then 'count'
        else 'percent'
      end as unit,
      case target.metric_key
        when 'risk_reduction_achieved' then 'decimal'
        when 'high_critical_risks_eliminated' then 'integer'
        else 'percentage'
      end as value_type,
      case when target.display_order <= 4 then 'performance' else 'resilience' end as display_group
    from public.maintenance_risk_kpi_targets target
    join current_metrics current_metric
      on current_metric.metric_key = target.metric_key
    left join previous_metrics previous_metric
      on previous_metric.metric_key = target.metric_key
    where target.site_id = v_site_id
      and target.active
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', assembled.metric_key,
        'label', assembled.label,
        'description', assembled.description,
        'value', assembled.metric_value,
        'target', assembled.effective_target,
        'targetIsDynamic', assembled.metric_key = 'risk_reduction_achieved',
        'unit', assembled.unit,
        'valueType', assembled.value_type,
        'displayGroup', assembled.display_group,
        'ragStatus', assembled.rag_status,
        'numerator', assembled.numerator,
        'denominator', assembled.denominator,
        'detail', assembled.detail,
        'noData', assembled.no_data,
        'criticalOverride', assembled.critical_override,
        'previousValue', assembled.previous_value,
        'trendDelta', assembled.trend_delta,
        'trendDirection', case
          when assembled.trend_delta is null then null
          when assembled.trend_delta > 0 then 'up'
          when assembled.trend_delta < 0 then 'down'
          else 'flat'
        end,
        'favourableTrend', case
          when assembled.trend_delta is null then null
          when assembled.trend_delta = 0 then true
          when assembled.direction = 'higher' then assembled.trend_delta > 0
          else assembled.trend_delta < 0
        end,
        'comparisonLabel', v_comparison_label,
        'drilldownRoute', assembled.drilldown_route
      )
      order by assembled.display_order
    ),
    '[]'::jsonb
  )
  into v_kpis
  from assembled;

  return query
  select
    v_period_key,
    v_period_label,
    v_period_start,
    v_period_end,
    v_comparison_label,
    v_kpis;
end;
$function$;
