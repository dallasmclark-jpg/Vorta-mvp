create or replace function public.vorta_rank_operational_actions_internal(
  p_site_id uuid,
  p_equipment_id uuid default null,
  p_limit integer default 10
)
returns table(
  action_rank integer,
  action_id uuid,
  equipment_id uuid,
  equipment_code text,
  equipment_name text,
  area text,
  asset_criticality text,
  work_order_id uuid,
  work_order_number text,
  action_title text,
  risk_driver text,
  current_risk_score numeric,
  projected_risk_score numeric,
  calculated_risk_reduction numeric,
  risk_projection_basis text,
  operational_value_score numeric,
  risk_reduction_points numeric,
  urgency_points numeric,
  readiness_points numeric,
  criticality_points numeric,
  efficiency_points numeric,
  confidence_points numeric,
  feasibility_state text,
  ready boolean,
  labour_ready boolean,
  spares_ready boolean,
  procedure_ready boolean,
  requires_parts boolean,
  hard_dependencies text[],
  advisory_dependencies text[],
  work_order_priority text,
  work_order_status text,
  due_date date,
  days_overdue integer,
  estimated_duration_minutes integer,
  duration_source text,
  risk_reduction_per_hour numeric,
  recorded_downtime_minutes integer,
  owner text,
  confidence_score integer,
  confidence_basis text,
  calculation_source text,
  snapshot_locked boolean,
  evidence_updated_at timestamptz,
  ranking_model_version text,
  scoring_basis text,
  verification text
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with candidates as (
    select
      plan.id as action_id,
      asset.id as equipment_id,
      asset.equipment_code,
      asset.name as equipment_name,
      asset.area,
      lower(coalesce(asset.criticality, 'unknown')) as asset_criticality,
      work_order.id as work_order_id,
      work_order.wo_number as work_order_number,
      coalesce(
        nullif(btrim(work_order.description), ''),
        nullif(btrim(pm.title), ''),
        plan.risk_driver || ' intervention'
      ) as action_title,
      plan.risk_driver,
      coalesce(plan.risk_before, risk_profile.risk_score::numeric, 0::numeric) as current_risk_score,
      greatest(
        0::numeric,
        coalesce(
          plan.risk_after,
          coalesce(plan.risk_before, risk_profile.risk_score::numeric, 0::numeric)
            - coalesce(plan.planned_risk_reduction, 0::numeric)
        )
      ) as projected_risk_score,
      greatest(
        0::numeric,
        coalesce(
          plan.actual_risk_reduction,
          case
            when plan.risk_before is not null and plan.risk_after is not null
              then plan.risk_before - plan.risk_after
            else plan.planned_risk_reduction
          end,
          0::numeric
        )
      ) as calculated_risk_reduction,
      case
        when plan.risk_before is not null and plan.risk_after is not null then 'recorded_before_after'
        when risk_profile.risk_score is not null and plan.planned_risk_reduction is not null then 'current_profile_minus_calculated_reduction'
        else 'partial_calculated_evidence'
      end as risk_projection_basis,
      coalesce(plan.ready, false) as ready,
      coalesce(plan.labour_ready, false) as labour_ready,
      coalesce(plan.spares_ready, false) as spares_ready,
      coalesce(plan.procedure_ready, false) as procedure_ready,
      coalesce(plan.requires_parts, false) as requires_parts,
      coalesce(work_order.priority, work_order.priority_code, 'Not recorded') as work_order_priority,
      coalesce(work_order.status, pm.status, 'OPEN') as work_order_status,
      coalesce(work_order.due_date, pm.next_due_date, plan.planned_date) as due_date,
      greatest(
        current_date - coalesce(work_order.due_date, pm.next_due_date, plan.planned_date),
        0
      )::integer as days_overdue,
      coalesce(nullif(pm.estimated_duration_minutes, 0), nullif(work_order.downtime_minutes, 0)) as estimated_duration_minutes,
      case
        when nullif(pm.estimated_duration_minutes, 0) is not null then 'preventive_maintenance_estimate'
        when nullif(work_order.downtime_minutes, 0) is not null then 'recorded_work_order_downtime_proxy'
        else 'not_recorded'
      end as duration_source,
      coalesce(work_order.downtime_minutes, 0) as recorded_downtime_minutes,
      coalesce(nullif(btrim(work_order.assigned_engineer), ''), nullif(btrim(pm.assigned_engineer), '')) as owner,
      coalesce(plan.calculation_source, 'not_recorded') as calculation_source,
      coalesce(plan.snapshot_locked, false) as snapshot_locked,
      risk_profile.updated_at as risk_updated_at,
      greatest(plan.updated_at, risk_profile.updated_at, work_order.updated_at, pm.updated_at) as evidence_updated_at
    from public.maintenance_risk_work_plan plan
    join public.equipment_assets asset
      on asset.id = plan.equipment_id
     and asset.site_id = p_site_id
    left join public.equipment_risk_profiles risk_profile
      on risk_profile.equipment_id = asset.id
    left join public.work_orders work_order
      on work_order.id = plan.work_order_id
    left join public.preventive_maintenance pm
      on pm.id = work_order.preventive_maintenance_id
    where plan.site_id = p_site_id
      and (p_equipment_id is null or plan.equipment_id = p_equipment_id)
      and plan.completed_at is null
      and upper(coalesce(work_order.status, pm.status, 'OPEN')) <> 'COMPLETED'
      and greatest(coalesce(plan.planned_risk_reduction, 0), coalesce(plan.actual_risk_reduction, 0)) > 0
  ),
  components as (
    select
      candidate.*,
      round(least(40::numeric, candidate.calculated_risk_reduction * (10::numeric / 3::numeric)), 1) as risk_reduction_points,
      round(least(
        20::numeric,
        case
          when upper(candidate.work_order_priority) in ('CRITICAL', '1') then 10
          when upper(candidate.work_order_priority) in ('HIGH', '2') then 7
          when upper(candidate.work_order_priority) in ('MEDIUM', '3') then 4
          when upper(candidate.work_order_priority) in ('LOW', '4') then 1
          else 2
        end
        + case
            when candidate.days_overdue >= 90 then 10
            when candidate.days_overdue >= 30 then 8
            when candidate.days_overdue >= 14 then 6
            when candidate.days_overdue > 0 then 4
            when candidate.due_date <= current_date + 7 then 2
            else 0
          end
        + case when upper(candidate.work_order_status) = 'IN PROGRESS' then 2 else 0 end
      ), 1) as urgency_points,
      case
        when candidate.ready
          and candidate.labour_ready
          and candidate.spares_ready
          and candidate.procedure_ready then 15::numeric
        else (
          (case when candidate.labour_ready then 3 else 0 end)
          + (case when candidate.spares_ready then 3 else 0 end)
          + (case when candidate.procedure_ready then 3 else 0 end)
        )::numeric
      end as readiness_points,
      least(
        10::numeric,
        case candidate.asset_criticality
          when 'critical' then 6
          when 'high' then 5
          when 'medium' then 3
          when 'low' then 1
          else 0
        end
        + case
            when candidate.current_risk_score >= 75 then 4
            when candidate.current_risk_score >= 60 then 3
            when candidate.current_risk_score >= 40 then 2
            when candidate.current_risk_score >= 20 then 1
            else 0
          end
      )::numeric as criticality_points,
      case
        when candidate.estimated_duration_minutes is null then 0::numeric
        when candidate.calculated_risk_reduction / greatest(candidate.estimated_duration_minutes / 60.0, 0.25) >= 8 then 5::numeric
        when candidate.calculated_risk_reduction / greatest(candidate.estimated_duration_minutes / 60.0, 0.25) >= 4 then 4::numeric
        when candidate.calculated_risk_reduction / greatest(candidate.estimated_duration_minutes / 60.0, 0.25) >= 2 then 3::numeric
        when candidate.calculated_risk_reduction / greatest(candidate.estimated_duration_minutes / 60.0, 0.25) >= 1 then 2::numeric
        else 1::numeric
      end as efficiency_points,
      case
        when candidate.snapshot_locked
          and candidate.risk_projection_basis = 'recorded_before_after' then 10::numeric
        when candidate.snapshot_locked then 9::numeric
        when candidate.calculation_source in ('linked_pm_risk_model', 'linked_component_risk_model')
          and candidate.risk_updated_at is not null then 8::numeric
        when candidate.calculation_source like 'live_demo%' then 7::numeric
        when candidate.risk_updated_at is not null then 6::numeric
        else 4::numeric
      end as confidence_points,
      case
        when candidate.ready
          and candidate.labour_ready
          and candidate.spares_ready
          and candidate.procedure_ready then 'ready_now'
        when not candidate.labour_ready
          and (not candidate.spares_ready or not candidate.procedure_ready) then 'blocked_multiple'
        when candidate.requires_parts and not candidate.spares_ready then 'blocked_spares'
        when not candidate.labour_ready then 'blocked_labour'
        when not candidate.procedure_ready then 'blocked_procedure'
        else 'conditional'
      end as feasibility_state,
      array_remove(array[
        case when not candidate.labour_ready then 'Validated labour is not ready' end,
        case when candidate.requires_parts and not candidate.spares_ready then 'Required spares are not ready' end,
        case when not candidate.procedure_ready then 'Approved procedure is not ready' end
      ], null)::text[] as hard_dependencies,
      array_remove(array[
        case when candidate.owner is null then 'Work owner is not assigned' end,
        case when candidate.estimated_duration_minutes is null then 'Execution duration is not recorded' end,
        case when candidate.due_date is null then 'Due date is not recorded' end
      ], null)::text[] as advisory_dependencies
    from candidates candidate
  ),
  scored as (
    select
      component.*,
      round(
        component.risk_reduction_points
        + component.urgency_points
        + component.readiness_points
        + component.criticality_points
        + component.efficiency_points
        + component.confidence_points,
        1
      ) as operational_value_score,
      case
        when component.estimated_duration_minutes is null then null
        else round(
          component.calculated_risk_reduction
            / greatest(component.estimated_duration_minutes / 60.0, 0.25),
          2
        )
      end as risk_reduction_per_hour,
      least(95, greatest(40, round(
        40
        + component.confidence_points * 5
        + case when component.owner is not null then 3 else 0 end
        + case when component.estimated_duration_minutes is not null then 2 else 0 end
      )))::integer as confidence_score,
      case
        when component.snapshot_locked then 'Locked work-plan snapshot with calculated intervention evidence'
        when component.calculation_source in ('linked_pm_risk_model', 'linked_component_risk_model') then 'Linked work, equipment risk and readiness evidence'
        when component.calculation_source like 'live_demo%' then 'Seeded live-demo work-plan evidence'
        else 'Partial calculated work-plan evidence'
      end as confidence_basis
    from components component
  ),
  ranked as (
    select
      row_number() over (
        order by
          case when scored.feasibility_state = 'ready_now' then 0 else 1 end,
          scored.operational_value_score desc,
          scored.calculated_risk_reduction desc,
          scored.days_overdue desc,
          scored.action_id
      )::integer as action_rank,
      scored.*
    from scored
  )
  select
    ranked.action_rank,
    ranked.action_id,
    ranked.equipment_id,
    ranked.equipment_code,
    ranked.equipment_name,
    ranked.area,
    ranked.asset_criticality,
    ranked.work_order_id,
    ranked.work_order_number,
    ranked.action_title,
    ranked.risk_driver,
    round(ranked.current_risk_score, 1),
    round(ranked.projected_risk_score, 1),
    round(ranked.calculated_risk_reduction, 1),
    ranked.risk_projection_basis,
    ranked.operational_value_score,
    ranked.risk_reduction_points,
    ranked.urgency_points,
    ranked.readiness_points,
    ranked.criticality_points,
    ranked.efficiency_points,
    ranked.confidence_points,
    ranked.feasibility_state,
    ranked.ready,
    ranked.labour_ready,
    ranked.spares_ready,
    ranked.procedure_ready,
    ranked.requires_parts,
    ranked.hard_dependencies,
    ranked.advisory_dependencies,
    ranked.work_order_priority,
    ranked.work_order_status,
    ranked.due_date,
    ranked.days_overdue,
    ranked.estimated_duration_minutes,
    ranked.duration_source,
    ranked.risk_reduction_per_hour,
    ranked.recorded_downtime_minutes,
    coalesce(ranked.owner, 'Maintenance Manager to assign') as owner,
    ranked.confidence_score,
    ranked.confidence_basis,
    ranked.calculation_source,
    ranked.snapshot_locked,
    ranked.evidence_updated_at,
    'operational_value_v1'::text as ranking_model_version,
    '100 points: risk reduction 40, urgency 20, readiness 15, asset criticality/current risk 10, risk-reduction efficiency 5, evidence confidence 10; ready work is ordered before blocked work.'::text as scoring_basis,
    concat_ws(
      ' · ',
      case when ranked.work_order_number is not null then 'Verify ' || ranked.work_order_number || ' completion' end,
      'confirm readiness dependencies',
      'recalculate equipment risk after completion'
    ) as verification
  from ranked
  order by ranked.action_rank
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$function$;

create or replace function public.vorta_get_ranked_operational_actions(
  p_equipment_id uuid default null,
  p_limit integer default 10
)
returns table(
  action_rank integer,
  action_id uuid,
  equipment_id uuid,
  equipment_code text,
  equipment_name text,
  area text,
  asset_criticality text,
  work_order_id uuid,
  work_order_number text,
  action_title text,
  risk_driver text,
  current_risk_score numeric,
  projected_risk_score numeric,
  calculated_risk_reduction numeric,
  risk_projection_basis text,
  operational_value_score numeric,
  risk_reduction_points numeric,
  urgency_points numeric,
  readiness_points numeric,
  criticality_points numeric,
  efficiency_points numeric,
  confidence_points numeric,
  feasibility_state text,
  ready boolean,
  labour_ready boolean,
  spares_ready boolean,
  procedure_ready boolean,
  requires_parts boolean,
  hard_dependencies text[],
  advisory_dependencies text[],
  work_order_priority text,
  work_order_status text,
  due_date date,
  days_overdue integer,
  estimated_duration_minutes integer,
  duration_source text,
  risk_reduction_per_hour numeric,
  recorded_downtime_minutes integer,
  owner text,
  confidence_score integer,
  confidence_basis text,
  calculation_source text,
  snapshot_locked boolean,
  evidence_updated_at timestamptz,
  ranking_model_version text,
  scoring_basis text,
  verification text
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
begin
  if not public.vorta_has_site_access(v_site_id, false) then
    return;
  end if;

  if p_equipment_id is not null and not exists (
    select 1
    from public.equipment_assets asset
    where asset.id = p_equipment_id
      and asset.site_id = v_site_id
  ) then
    return;
  end if;

  return query
  select *
  from public.vorta_rank_operational_actions_internal(
    v_site_id,
    p_equipment_id,
    p_limit
  );
end;
$function$;

revoke all on function public.vorta_get_ranked_operational_actions(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.vorta_get_ranked_operational_actions(uuid, integer)
  to authenticated, service_role;

revoke all on function public.vorta_rank_operational_actions_internal(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.vorta_rank_operational_actions_internal(uuid, uuid, integer)
  to service_role;

comment on function public.vorta_get_ranked_operational_actions(uuid, integer) is
  'Authorised Ask Vorta operational-value ranking. Ready actions are ordered before blocked actions, then compared through transparent risk reduction, urgency, readiness, exposure, efficiency and evidence-confidence components.';
comment on function public.vorta_rank_operational_actions_internal(uuid, uuid, integer) is
  'Service-role ranking engine for VOR-044. Returns exact score components, feasibility dependencies, owner, evidence freshness and verification route without using model prose as ranking evidence.';

notify pgrst, 'reload schema';
