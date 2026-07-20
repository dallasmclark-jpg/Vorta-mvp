-- Calculate every dashboard scope and period from one shared fact set instead of
-- invoking the scoped KPI calculator twice for every scope-period combination.

create or replace function private.vorta_get_risk_dashboard_scope_kpis_set_based(
  p_anchor_date date default null
)
returns table(
  scope_key text,
  scope_type text,
  area text,
  period_key text,
  period_label text,
  period_start date,
  period_end date,
  comparison_label text,
  kpis jsonb
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  with site_context as materialized (
    select
      profile.site_id,
      coalesce(site.fiscal_year_start_month, 1)::integer as fiscal_month,
      coalesce(
        p_anchor_date,
        (now() at time zone coalesce(site.timezone, 'Europe/London'))::date
      ) as requested_anchor_date,
      (
        extract(year from coalesce(
          p_anchor_date,
          (now() at time zone coalesce(site.timezone, 'Europe/London'))::date
        ))::integer
        - case
            when extract(month from coalesce(
              p_anchor_date,
              (now() at time zone coalesce(site.timezone, 'Europe/London'))::date
            ))::integer < coalesce(site.fiscal_year_start_month, 1)
              then 1
            else 0
          end
      )::integer as fiscal_year
    from public.site_risk_profile profile
    join public.sites site on site.id = profile.site_id
    where profile.id = 1
  ),
  scopes as materialized (
    select
      'site'::text as scope_key,
      'site'::text as scope_type,
      null::text as area,
      0::integer as display_order
    from site_context

    union all

    select
      'area:' || profile.area,
      'area'::text,
      profile.area,
      row_number() over (
        order by profile.risk_score desc, profile.area
      )::integer
    from public.area_risk_profiles profile
  ),
  anchor_plan_facts as materialized (
    select
      plan.id,
      plan.equipment_id,
      equipment.area,
      plan.planned_date,
      coalesce(plan.completed_at::date, work_order.completed_date) as completion_date,
      plan.risk_level_before,
      plan.risk_level_after
    from site_context context
    join public.maintenance_risk_work_plan plan
      on plan.site_id = context.site_id
     and plan.is_risk_priority
    join public.equipment_assets equipment on equipment.id = plan.equipment_id
    left join public.work_orders work_order on work_order.id = plan.work_order_id
  ),
  plan_facts as materialized (
    select
      plan.id,
      plan.equipment_id,
      equipment.area,
      plan.planned_date,
      coalesce(plan.completed_at::date, work_order.completed_date) as completion_date,
      coalesce(plan.actual_risk_reduction, 0)::numeric as actual_risk_reduction,
      plan.planned_risk_reduction::numeric as planned_risk_reduction,
      plan.risk_level_before,
      plan.risk_level_after,
      case lower(plan.risk_level_before)
        when 'critical' then 4
        when 'high' then 3
        when 'medium' then 2
        when 'low' then 1
        else 0
      end::integer as before_rank,
      case lower(plan.risk_level_after)
        when 'critical' then 4
        when 'high' then 3
        when 'medium' then 2
        when 'low' then 1
        else 0
      end::integer as after_rank
    from site_context context
    join public.maintenance_risk_work_plan plan
      on plan.site_id = context.site_id
     and plan.is_risk_priority
    join public.work_orders work_order on work_order.id = plan.work_order_id
    join public.equipment_assets equipment on equipment.id = plan.equipment_id
  ),
  daily_anchor_candidates as materialized (
    select
      scope.scope_key,
      scope.scope_type,
      scope.area,
      scope.display_order,
      context.requested_anchor_date,
      coalesce(
        max(plan.planned_date) filter (
          where plan.completion_date is not null
            and lower(coalesce(plan.risk_level_before, '')) in ('critical', 'high')
            and plan.risk_level_after is not null
        ),
        max(plan.planned_date) filter (
          where plan.completion_date is not null
        ),
        max(plan.planned_date),
        context.requested_anchor_date
      )::date as daily_anchor_date
    from scopes scope
    cross join site_context context
    left join anchor_plan_facts plan
      on plan.planned_date <= context.requested_anchor_date
     and (scope.area is null or plan.area = scope.area)
    group by
      scope.scope_key,
      scope.scope_type,
      scope.area,
      scope.display_order,
      context.requested_anchor_date
  ),
  daily_dates as materialized (
    select
      candidate.scope_key,
      candidate.scope_type,
      candidate.area,
      candidate.display_order,
      candidate.requested_anchor_date,
      candidate.daily_anchor_date,
      coalesce(
        max(plan.planned_date) filter (
          where plan.completion_date is not null
        ),
        candidate.daily_anchor_date - 1
      )::date as previous_daily_date
    from daily_anchor_candidates candidate
    left join anchor_plan_facts plan
      on plan.planned_date < candidate.daily_anchor_date
     and (candidate.area is null or plan.area = candidate.area)
    group by
      candidate.scope_key,
      candidate.scope_type,
      candidate.area,
      candidate.display_order,
      candidate.requested_anchor_date,
      candidate.daily_anchor_date
  ),
  period_definitions(period_key, display_order) as (
    values
      ('daily'::text, 1),
      ('weekly'::text, 2),
      ('monthly'::text, 3),
      ('ytd'::text, 4)
  ),
  scope_periods as materialized (
    select
      daily.scope_key,
      daily.scope_type,
      daily.area,
      daily.display_order as scope_display_order,
      period.period_key,
      period.display_order as period_display_order,
      case period.period_key
        when 'daily' then daily.daily_anchor_date
        when 'weekly' then daily.requested_anchor_date - 6
        when 'monthly' then date_trunc('month', daily.requested_anchor_date)::date
        when 'ytd' then make_date(context.fiscal_year, context.fiscal_month, 1)
      end::date as period_start,
      case period.period_key
        when 'daily' then daily.daily_anchor_date
        else daily.requested_anchor_date
      end::date as period_end,
      case period.period_key
        when 'daily' then daily.previous_daily_date
        when 'weekly' then daily.requested_anchor_date - 13
        when 'monthly' then date_trunc(
          'month',
          date_trunc('month', daily.requested_anchor_date)::date - 1
        )::date
        when 'ytd' then (
          make_date(context.fiscal_year, context.fiscal_month, 1) - interval '1 year'
        )::date
      end::date as previous_start,
      case period.period_key
        when 'daily' then daily.previous_daily_date
        when 'weekly' then daily.requested_anchor_date - 7
        when 'monthly' then least(
          date_trunc(
            'month',
            date_trunc('month', daily.requested_anchor_date)::date - 1
          )::date
            + (
              daily.requested_anchor_date
              - date_trunc('month', daily.requested_anchor_date)::date
            ),
          date_trunc('month', daily.requested_anchor_date)::date - 1
        )
        when 'ytd' then (daily.requested_anchor_date - interval '1 year')::date
      end::date as previous_end,
      case period.period_key
        when 'daily' then case
          when daily.daily_anchor_date = daily.requested_anchor_date then 'Daily'
          else 'Latest reporting day'
        end
        when 'weekly' then 'Rolling 7 days'
        when 'monthly' then 'Month to date'
        when 'ytd' then 'Year to date'
      end::text as period_label,
      case period.period_key
        when 'daily' then 'vs previous reporting day'
        when 'weekly' then 'vs previous 7 days'
        when 'monthly' then 'vs previous month to date'
        when 'ytd' then 'vs same period last year'
      end::text as comparison_label
    from daily_dates daily
    cross join period_definitions period
    cross join site_context context
  ),
  windows as materialized (
    select
      scope_period.scope_key,
      scope_period.scope_type,
      scope_period.area,
      scope_period.scope_display_order,
      scope_period.period_key,
      scope_period.period_display_order,
      scope_period.period_label,
      scope_period.comparison_label,
      scope_period.period_start,
      scope_period.period_end,
      'current'::text as window_kind,
      scope_period.period_start as window_start,
      scope_period.period_end as window_end
    from scope_periods scope_period

    union all

    select
      scope_period.scope_key,
      scope_period.scope_type,
      scope_period.area,
      scope_period.scope_display_order,
      scope_period.period_key,
      scope_period.period_display_order,
      scope_period.period_label,
      scope_period.comparison_label,
      scope_period.period_start,
      scope_period.period_end,
      'previous'::text,
      scope_period.previous_start,
      scope_period.previous_end
    from scope_periods scope_period
  ),
  plan_aggregates as materialized (
    select
      period_window.scope_key,
      period_window.period_key,
      period_window.window_kind,
      coalesce(sum(plan.actual_risk_reduction) filter (
        where plan.completion_date <= period_window.window_end
      ), 0)::numeric as actual_risk_reduction,
      coalesce(sum(plan.planned_risk_reduction), 0)::numeric as planned_risk_reduction,
      count(plan.id) filter (
        where plan.completion_date <= plan.planned_date
      )::numeric as actions_completed_on_time,
      count(plan.id)::numeric as actions_total
    from windows period_window
    left join plan_facts plan
      on plan.planned_date between period_window.window_start and period_window.window_end
     and (period_window.area is null or plan.area = period_window.area)
    group by period_window.scope_key, period_window.period_key, period_window.window_kind
  ),
  transition_per_equipment as materialized (
    select
      period_window.scope_key,
      period_window.period_key,
      period_window.window_kind,
      plan.equipment_id,
      max(plan.before_rank)::integer as before_rank,
      min(plan.after_rank)::integer as after_rank
    from windows period_window
    join plan_facts plan
      on plan.planned_date between period_window.window_start and period_window.window_end
     and plan.completion_date <= period_window.window_end
     and plan.risk_level_before is not null
     and plan.risk_level_after is not null
     and (period_window.area is null or plan.area = period_window.area)
    group by
      period_window.scope_key,
      period_window.period_key,
      period_window.window_kind,
      plan.equipment_id
  ),
  transition_aggregates as materialized (
    select
      period_window.scope_key,
      period_window.period_key,
      period_window.window_kind,
      count(transition.equipment_id) filter (
        where transition.before_rank >= 3
          and transition.after_rank < transition.before_rank
      )::numeric as risks_eliminated,
      count(transition.equipment_id) filter (
        where transition.before_rank >= 3
      )::numeric as risks_assessed
    from windows period_window
    left join transition_per_equipment transition
      on transition.scope_key = period_window.scope_key
     and transition.period_key = period_window.period_key
     and transition.window_kind = period_window.window_kind
    group by period_window.scope_key, period_window.period_key, period_window.window_kind
  ),
  skill_event_facts as materialized (
    select
      event.id,
      event.occurred_at::date as occurred_date,
      event.risk_change_points,
      equipment.area
    from site_context context
    join public.maintenance_skill_risk_events event
      on event.site_id = context.site_id
    left join public.equipment_assets equipment on equipment.id = event.equipment_id
  ),
  skill_event_aggregates as materialized (
    select
      period_window.scope_key,
      period_window.period_key,
      period_window.window_kind,
      count(event.id) filter (
        where event.risk_change_points > 0
      )::integer as positive_events,
      count(event.id) filter (
        where event.risk_change_points < 0
      )::integer as negative_events
    from windows period_window
    left join skill_event_facts event
      on event.occurred_date between period_window.window_start and period_window.window_end
     and (period_window.area is null or event.area = period_window.area)
    group by period_window.scope_key, period_window.period_key, period_window.window_kind
  ),
  window_evidence as materialized (
    select
      period_window.*,
      open_snapshot.risk_score as open_skill_risk,
      close_snapshot.risk_score as close_skill_risk,
      parts_snapshot.snapshot_date as parts_snapshot_date,
      parts_snapshot.critical_parts_ready,
      parts_snapshot.critical_parts_total,
      parts_snapshot.readiness_percent,
      parts_snapshot.critical_stockouts,
      parts_snapshot.reserved_part_lines,
      parts_snapshot.work_orders_fully_reserved,
      parts_snapshot.work_orders_requiring_parts
    from windows period_window
    cross join site_context context
    left join lateral (
      select snapshot.risk_score
      from public.maintenance_skill_risk_snapshots snapshot
      where snapshot.site_id = context.site_id
        and snapshot.area is not distinct from period_window.area
        and snapshot.snapshot_date <= period_window.window_start - 1
      order by snapshot.snapshot_date desc
      limit 1
    ) open_snapshot on true
    left join lateral (
      select snapshot.risk_score
      from public.maintenance_skill_risk_snapshots snapshot
      where snapshot.site_id = context.site_id
        and snapshot.area is not distinct from period_window.area
        and snapshot.snapshot_date <= period_window.window_end
      order by snapshot.snapshot_date desc
      limit 1
    ) close_snapshot on true
    left join lateral (
      select
        snapshot.snapshot_date,
        snapshot.critical_parts_ready,
        snapshot.critical_parts_total,
        snapshot.readiness_percent,
        snapshot.critical_stockouts,
        snapshot.reserved_part_lines,
        snapshot.work_orders_fully_reserved,
        snapshot.work_orders_requiring_parts
      from public.maintenance_parts_readiness_snapshots snapshot
      where snapshot.site_id = context.site_id
        and snapshot.area is not distinct from period_window.area
        and snapshot.snapshot_date <= period_window.window_end
      order by snapshot.snapshot_date desc
      limit 1
    ) parts_snapshot on true
  ),
  metric_rows as materialized (
    select
      evidence.scope_key,
      evidence.period_key,
      evidence.window_kind,
      'risk_reduction_achieved'::text as metric_key,
      round(plan.actual_risk_reduction, 1) as metric_value,
      round(plan.actual_risk_reduction, 1) as numerator,
      round(plan.planned_risk_reduction, 1) as denominator,
      case
        when plan.planned_risk_reduction = 0
          then 'No risk-reduction work was planned in this period.'
        else trim(to_char(plan.actual_risk_reduction, 'FM999990.0'))
          || ' risk points removed against '
          || trim(to_char(plan.planned_risk_reduction, 'FM999990.0'))
          || ' planned'
      end::text as detail,
      false as critical_override,
      plan.planned_risk_reduction = 0 as no_data
    from window_evidence evidence
    join plan_aggregates plan
      on plan.scope_key = evidence.scope_key
     and plan.period_key = evidence.period_key
     and plan.window_kind = evidence.window_kind

    union all

    select
      evidence.scope_key,
      evidence.period_key,
      evidence.window_kind,
      'risk_reduction_plan_attainment'::text,
      case
        when plan.planned_risk_reduction > 0
          then round(plan.actual_risk_reduction / plan.planned_risk_reduction * 100, 1)
        else null
      end,
      round(plan.actual_risk_reduction, 1),
      round(plan.planned_risk_reduction, 1),
      case
        when plan.planned_risk_reduction = 0
          then 'No planned risk reduction was available for this period.'
        else trim(to_char(plan.actual_risk_reduction, 'FM999990.0'))
          || ' of '
          || trim(to_char(plan.planned_risk_reduction, 'FM999990.0'))
          || ' planned risk points achieved'
      end,
      false,
      plan.planned_risk_reduction = 0
    from window_evidence evidence
    join plan_aggregates plan
      on plan.scope_key = evidence.scope_key
     and plan.period_key = evidence.period_key
     and plan.window_kind = evidence.window_kind

    union all

    select
      evidence.scope_key,
      evidence.period_key,
      evidence.window_kind,
      'high_critical_risks_eliminated'::text,
      transition.risks_eliminated,
      transition.risks_eliminated,
      transition.risks_assessed,
      case
        when transition.risks_assessed = 0
          then 'No completed high or critical equipment exposures were assessed in this period.'
        else trim(to_char(transition.risks_eliminated, 'FM999990'))
          || ' of '
          || trim(to_char(transition.risks_assessed, 'FM999990'))
          || ' high or critical equipment exposures moved to a lower risk band'
      end,
      false,
      transition.risks_assessed = 0
    from window_evidence evidence
    join transition_aggregates transition
      on transition.scope_key = evidence.scope_key
     and transition.period_key = evidence.period_key
     and transition.window_kind = evidence.window_kind

    union all

    select
      evidence.scope_key,
      evidence.period_key,
      evidence.window_kind,
      'priority_actions_completed_on_time'::text,
      case
        when plan.actions_total > 0
          then round(plan.actions_completed_on_time / plan.actions_total * 100, 1)
        else null
      end,
      plan.actions_completed_on_time,
      plan.actions_total,
      case
        when plan.actions_total = 0
          then 'No priority risk actions were scheduled in this period.'
        else trim(to_char(plan.actions_completed_on_time, 'FM999990'))
          || ' of '
          || trim(to_char(plan.actions_total, 'FM999990'))
          || ' priority actions completed on time'
      end,
      false,
      plan.actions_total = 0
    from window_evidence evidence
    join plan_aggregates plan
      on plan.scope_key = evidence.scope_key
     and plan.period_key = evidence.period_key
     and plan.window_kind = evidence.window_kind

    union all

    select
      evidence.scope_key,
      evidence.period_key,
      evidence.window_kind,
      'skills_risk_change'::text,
      case
        when evidence.open_skill_risk is null or evidence.close_skill_risk is null
          then null
        when evidence.open_skill_risk > 0
          then round(
            (evidence.open_skill_risk - evidence.close_skill_risk)
              / evidence.open_skill_risk * 100,
            1
          )
        when evidence.close_skill_risk = 0 then 0
        else -100
      end::numeric,
      case
        when evidence.open_skill_risk is null or evidence.close_skill_risk is null
          then null
        else round(evidence.open_skill_risk - evidence.close_skill_risk, 2)
      end::numeric,
      evidence.open_skill_risk,
      case
        when evidence.open_skill_risk is null or evidence.close_skill_risk is null
          then 'Skills-risk snapshots are not available for both ends of this period.'
        when round(evidence.open_skill_risk - evidence.close_skill_risk, 2) > 0
          then 'Skills risk decreased by '
            || trim(to_char(
              round(evidence.open_skill_risk - evidence.close_skill_risk, 2),
              'FM999990.0'
            ))
            || ' points; '
            || event_aggregate.positive_events
            || ' capability improvements and '
            || event_aggregate.negative_events
            || ' expiry or availability losses recorded'
        when round(evidence.open_skill_risk - evidence.close_skill_risk, 2) < 0
          then 'Skills risk increased by '
            || trim(to_char(
              abs(round(evidence.open_skill_risk - evidence.close_skill_risk, 2)),
              'FM999990.0'
            ))
            || ' points; '
            || event_aggregate.positive_events
            || ' capability improvements and '
            || event_aggregate.negative_events
            || ' expiry or availability losses recorded'
        else 'Skills risk was unchanged; '
          || event_aggregate.positive_events
          || ' capability improvements and '
          || event_aggregate.negative_events
          || ' expiry or availability losses recorded'
      end,
      false,
      evidence.open_skill_risk is null or evidence.close_skill_risk is null
    from window_evidence evidence
    join skill_event_aggregates event_aggregate
      on event_aggregate.scope_key = evidence.scope_key
     and event_aggregate.period_key = evidence.period_key
     and event_aggregate.window_kind = evidence.window_kind

    union all

    select
      evidence.scope_key,
      evidence.period_key,
      evidence.window_kind,
      'critical_parts_readiness'::text,
      evidence.readiness_percent,
      evidence.critical_parts_ready,
      evidence.critical_parts_total,
      case
        when evidence.parts_snapshot_date is null
          or coalesce(evidence.critical_parts_total, 0) = 0
          then 'No critical-parts readiness snapshot is available for this period.'
        else trim(to_char(evidence.critical_parts_ready, 'FM999990'))
          || ' of '
          || trim(to_char(evidence.critical_parts_total, 'FM999990'))
          || ' critical parts ready; '
          || evidence.critical_stockouts
          || ' stockouts, '
          || evidence.reserved_part_lines
          || ' reservation lines and '
          || evidence.work_orders_fully_reserved
          || ' of '
          || evidence.work_orders_requiring_parts
          || ' part-requiring work orders fully reserved'
      end,
      coalesce(evidence.critical_stockouts, 0) > 0,
      evidence.parts_snapshot_date is null
        or coalesce(evidence.critical_parts_total, 0) = 0
    from window_evidence evidence
  ),
  assembled as materialized (
    select
      scope_period.scope_key,
      scope_period.scope_type,
      scope_period.area,
      scope_period.scope_display_order,
      scope_period.period_key,
      scope_period.period_display_order,
      scope_period.period_label,
      scope_period.period_start,
      scope_period.period_end,
      scope_period.comparison_label,
      target.metric_key,
      target.label,
      target.description,
      case
        when target.metric_key = 'risk_reduction_achieved'
          then current_metric.denominator
        else target.target_value
      end::numeric as effective_target,
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
      previous_metric.no_data as previous_no_data
    from scope_periods scope_period
    cross join site_context context
    join public.maintenance_risk_kpi_targets target
      on target.site_id = context.site_id
     and target.active
    join metric_rows current_metric
      on current_metric.scope_key = scope_period.scope_key
     and current_metric.period_key = scope_period.period_key
     and current_metric.window_kind = 'current'
     and current_metric.metric_key = target.metric_key
    left join metric_rows previous_metric
      on previous_metric.scope_key = scope_period.scope_key
     and previous_metric.period_key = scope_period.period_key
     and previous_metric.window_kind = 'previous'
     and previous_metric.metric_key = target.metric_key
  ),
  scored as materialized (
    select
      assembled.*,
      case
        when assembled.no_data then 'neutral'
        when assembled.critical_override then 'red'
        when assembled.metric_key = 'risk_reduction_achieved'
          and assembled.denominator > 0
          and assembled.numerator / assembled.denominator >= 0.90 then 'green'
        when assembled.metric_key = 'risk_reduction_achieved'
          and assembled.denominator > 0
          and assembled.numerator / assembled.denominator >= 0.75 then 'amber'
        when assembled.metric_key = 'risk_reduction_achieved' then 'red'
        when assembled.direction = 'higher'
          and assembled.metric_value >= assembled.effective_target then 'green'
        when assembled.direction = 'higher'
          and assembled.metric_value >= assembled.effective_target - assembled.amber_tolerance
          then 'amber'
        when assembled.direction = 'lower'
          and assembled.metric_value <= assembled.effective_target then 'green'
        when assembled.direction = 'lower'
          and assembled.metric_value <= assembled.effective_target + assembled.amber_tolerance
          then 'amber'
        else 'red'
      end::text as rag_status,
      case
        when assembled.no_data
          or coalesce(assembled.previous_no_data, true)
          or assembled.previous_value is null then null
        else round(assembled.metric_value - assembled.previous_value, 1)
      end::numeric as trend_delta,
      case assembled.metric_key
        when 'risk_reduction_achieved' then 'risk_points'
        when 'high_critical_risks_eliminated' then 'count'
        else 'percent'
      end::text as unit,
      case assembled.metric_key
        when 'risk_reduction_achieved' then 'decimal'
        when 'high_critical_risks_eliminated' then 'integer'
        else 'percentage'
      end::text as value_type,
      case
        when assembled.display_order <= 4 then 'performance'
        else 'resilience'
      end::text as display_group
    from assembled
  )
  select
    scored.scope_key,
    scored.scope_type,
    scored.area,
    scored.period_key,
    scored.period_label,
    scored.period_start,
    scored.period_end,
    scored.comparison_label,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key', scored.metric_key,
          'label', scored.label,
          'description', scored.description,
          'value', scored.metric_value,
          'target', scored.effective_target,
          'targetIsDynamic', scored.metric_key = 'risk_reduction_achieved',
          'unit', scored.unit,
          'valueType', scored.value_type,
          'displayGroup', scored.display_group,
          'ragStatus', scored.rag_status,
          'numerator', scored.numerator,
          'denominator', scored.denominator,
          'detail', scored.detail,
          'noData', scored.no_data,
          'criticalOverride', scored.critical_override,
          'previousValue', scored.previous_value,
          'trendDelta', scored.trend_delta,
          'trendDirection', case
            when scored.trend_delta is null then null
            when scored.trend_delta > 0 then 'up'
            when scored.trend_delta < 0 then 'down'
            else 'flat'
          end,
          'favourableTrend', case
            when scored.trend_delta is null then null
            when scored.trend_delta = 0 then true
            when scored.direction = 'higher' then scored.trend_delta > 0
            else scored.trend_delta < 0
          end,
          'comparisonLabel', scored.comparison_label,
          'drilldownRoute', scored.drilldown_route
        )
        order by scored.display_order
      ),
      '[]'::jsonb
    ) as kpis
  from scored
  group by
    scored.scope_key,
    scored.scope_type,
    scored.area,
    scored.scope_display_order,
    scored.period_key,
    scored.period_display_order,
    scored.period_label,
    scored.period_start,
    scored.period_end,
    scored.comparison_label
  order by scored.scope_display_order, scored.period_display_order;
$function$;

revoke all on function private.vorta_get_risk_dashboard_scope_kpis_set_based(date)
  from public, anon, authenticated;
grant execute on function private.vorta_get_risk_dashboard_scope_kpis_set_based(date)
  to service_role;

do $validation$
declare
  anchor_date date;
  legacy_output jsonb;
  candidate_output jsonb;
begin
  foreach anchor_date in array array[
    current_date,
    current_date - 14,
    date '2026-06-30'
  ]
  loop
    select coalesce(
      jsonb_agg(to_jsonb(result_row) order by
        result_row.scope_key,
        result_row.period_start,
        result_row.period_key
      ),
      '[]'::jsonb
    )
    into legacy_output
    from public.vorta_get_risk_dashboard_scope_kpis_internal(anchor_date) result_row;

    select coalesce(
      jsonb_agg(to_jsonb(result_row) order by
        result_row.scope_key,
        result_row.period_start,
        result_row.period_key
      ),
      '[]'::jsonb
    )
    into candidate_output
    from private.vorta_get_risk_dashboard_scope_kpis_set_based(anchor_date) result_row;

    if legacy_output is distinct from candidate_output then
      raise exception 'Set-based dashboard KPI output differs for anchor date %', anchor_date;
    end if;
  end loop;
end;
$validation$;

create or replace function public.vorta_get_risk_dashboard_scope_kpis_internal(
  p_anchor_date date default null
)
returns table(
  scope_key text,
  scope_type text,
  area text,
  period_key text,
  period_label text,
  period_start date,
  period_end date,
  comparison_label text,
  kpis jsonb
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  select *
  from private.vorta_get_risk_dashboard_scope_kpis_set_based(p_anchor_date);
$function$;
