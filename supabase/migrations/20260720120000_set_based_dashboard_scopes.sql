-- Build dashboard scope cards and labour cards from shared fact sets instead of
-- repeating correlated equipment, leave and expiry queries for every area.

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

create temporary table legacy_dashboard_scopes
on commit drop
as
select scope.*
from public.vorta_get_risk_dashboard_scopes_internal() scope;

create temporary table legacy_scope_labour_cards
on commit drop
as
select
  requested.area,
  public.vorta_get_scope_labour_cards(
    '11000000-0000-0000-0000-000000000001'::uuid,
    requested.area
  ) as cards
from (
  select null::text as area
  union all
  select profile.area
  from public.area_risk_profiles profile
) requested;

create or replace function private.vorta_get_scope_labour_cards_set(
  p_site_id uuid
)
returns table(
  area text,
  cards jsonb
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  with shift_context as materialized (
    select
      coalesce(profile.labour_shift_date, current_date) as shift_date,
      case when profile.labour_shift_type = 'night' then 'night' else 'day' end as shift_type,
      case when profile.labour_shift_type = 'night' then 'Night' else 'Day' end as shift_label
    from public.site_risk_profile profile
    where profile.id = 1
      and profile.site_id = p_site_id
  ),
  scope_metrics as materialized (
    select
      null::text as area,
      coalesce(site_profile.labour_risk_score, 0)::numeric as labour_risk,
      coalesce(site_profile.scheduled_engineer_count, 0)::integer as scheduled_engineers,
      coalesce(site_profile.cover_gap_count, 0)::integer as cover_gaps,
      coalesce(site_profile.total_assets, 0)::integer as asset_count,
      coalesce((
        select sum(area_profile.single_point_skill_gap_count)
        from public.area_risk_profiles area_profile
      ), 0)::integer as single_point_count
    from public.site_risk_profile site_profile
    where site_profile.id = 1
      and site_profile.site_id = p_site_id

    union all

    select
      area_profile.area,
      coalesce(area_profile.labour_risk_score, 0)::numeric,
      coalesce(area_profile.scheduled_engineer_count, 0)::integer,
      coalesce(equipment_summary.cover_gaps, 0)::integer,
      coalesce(area_profile.asset_count, 0)::integer,
      coalesce(area_profile.single_point_skill_gap_count, 0)::integer
    from public.area_risk_profiles area_profile
    left join (
      select
        asset.area,
        count(*) filter (
          where coalesce(risk_profile.missing_skill_count, 0) > 0
        )::integer as cover_gaps
      from public.equipment_assets asset
      join public.equipment_risk_profiles risk_profile
        on risk_profile.equipment_id = asset.id
      where asset.site_id = p_site_id
      group by asset.area
    ) equipment_summary on equipment_summary.area = area_profile.area
  ),
  leave_exceptions as materialized (
    select distinct exception.engineer_id
    from public.maintenance_shift_exceptions exception
    cross join shift_context context
    where exception.site_id = p_site_id
      and exception.shift_date = context.shift_date
      and exception.shift_type = context.shift_type
      and not exception.is_available
      and lower(coalesce(exception.exception_type, '')) like '%leave%'
  ),
  qualified_engineer_areas as materialized (
    select distinct
      asset.area,
      engineer_skill.engineer_id
    from public.engineer_skills engineer_skill
    join public.equipment_required_skills requirement
      on requirement.skill_id = engineer_skill.skill_id
    join public.equipment_assets asset
      on asset.id = requirement.equipment_id
    where asset.site_id = p_site_id
      and coalesce(
        engineer_skill.validated_rating,
        engineer_skill.manager_rating,
        engineer_skill.self_rating,
        0
      ) >= requirement.required_level
  ),
  leave_counts as materialized (
    select
      null::text as area,
      count(distinct exception.engineer_id)::integer as leave_count
    from leave_exceptions exception

    union all

    select
      qualified.area,
      count(distinct exception.engineer_id)::integer
    from qualified_engineer_areas qualified
    join leave_exceptions exception
      on exception.engineer_id = qualified.engineer_id
    group by qualified.area
  ),
  required_area_skills as materialized (
    select distinct
      asset.area,
      requirement.skill_id
    from public.equipment_required_skills requirement
    join public.equipment_assets asset
      on asset.id = requirement.equipment_id
    where asset.site_id = p_site_id
  ),
  site_expiry as materialized (
    select
      count(*) filter (
        where engineer_skill.expiry_date between context.shift_date and context.shift_date + 30
      )::integer as expiring_count,
      count(*) filter (
        where engineer_skill.expiry_date < context.shift_date
      )::integer as expired_count,
      min(engineer_skill.expiry_date) filter (
        where engineer_skill.expiry_date >= context.shift_date
      ) as next_expiry
    from public.engineer_skills engineer_skill
    join public.engineers engineer
      on engineer.id = engineer_skill.engineer_id
    cross join shift_context context
    where engineer.site_id = p_site_id
      and engineer_skill.expiry_date is not null
  ),
  area_expiry as materialized (
    select
      required.area,
      count(*) filter (
        where engineer_skill.expiry_date between context.shift_date and context.shift_date + 30
      )::integer as expiring_count,
      count(*) filter (
        where engineer_skill.expiry_date < context.shift_date
      )::integer as expired_count,
      min(engineer_skill.expiry_date) filter (
        where engineer_skill.expiry_date >= context.shift_date
      ) as next_expiry
    from required_area_skills required
    join public.engineer_skills engineer_skill
      on engineer_skill.skill_id = required.skill_id
    join public.engineers engineer
      on engineer.id = engineer_skill.engineer_id
     and engineer.site_id = p_site_id
    cross join shift_context context
    where engineer_skill.expiry_date is not null
    group by required.area
  ),
  assembled as materialized (
    select
      metric.area,
      metric.labour_risk,
      metric.scheduled_engineers,
      metric.cover_gaps,
      metric.asset_count,
      metric.single_point_count,
      coalesce(leave_count.leave_count, 0)::integer as leave_count,
      case
        when metric.area is null then coalesce(site_expiry.expiring_count, 0)
        else coalesce(area_expiry.expiring_count, 0)
      end::integer as expiring_count,
      case
        when metric.area is null then coalesce(site_expiry.expired_count, 0)
        else coalesce(area_expiry.expired_count, 0)
      end::integer as expired_count,
      case
        when metric.area is null then site_expiry.next_expiry
        else area_expiry.next_expiry
      end as next_expiry,
      context.shift_date,
      context.shift_label
    from scope_metrics metric
    cross join shift_context context
    cross join site_expiry
    left join leave_counts leave_count
      on leave_count.area is not distinct from metric.area
    left join area_expiry
      on area_expiry.area = metric.area
  ),
  scored as materialized (
    select
      assembled.*,
      case
        when assembled.single_point_count = 0 then 5
        else least(100, 45 + assembled.single_point_count * 15)
      end::numeric as single_point_score,
      case
        when assembled.leave_count = 0 then 5
        else least(100, 35 + assembled.leave_count * 15 + assembled.cover_gaps * 5)
      end::numeric as leave_score,
      case
        when assembled.expiring_count = 0 and assembled.expired_count = 0 then 5
        else least(100, 35 + assembled.expired_count * 20 + assembled.expiring_count * 10)
      end::numeric as training_score
    from assembled
  )
  select
    scored.area,
    jsonb_build_array(
      jsonb_build_object(
        'title', 'Shift Cover',
        'slug', 'shift-cover',
        'score', round(scored.labour_risk, 1),
        'description', scored.shift_label || ' shift labour and equipment-skill coverage',
        'metricLabel', 'Engineers scheduled',
        'metricValue', scored.scheduled_engineers::text,
        'extraLabel', 'Equipment cover gaps',
        'extraValue', scored.cover_gaps::text,
        'statusLabel', case
          when scored.scheduled_engineers = 0 then 'Critical no-cover override'
          when scored.labour_risk >= 65 then 'High labour exposure'
          when scored.labour_risk >= 40 then 'Reduced labour resilience'
          when scored.labour_risk >= 20 then 'Low labour exposure'
          else 'Labour coverage stable'
        end
      ),
      jsonb_build_object(
        'title', 'Single Point Risk',
        'slug', 'single-point-failure',
        'score', round(scored.single_point_score, 1),
        'description', case
          when scored.single_point_count = 0 then 'Qualified backup coverage is available'
          else scored.single_point_count::text
            || case when scored.single_point_count = 1 then ' asset has' else ' assets have' end
            || ' no qualified backup'
        end,
        'metricLabel', 'Single-point assets',
        'metricValue', scored.single_point_count::text,
        'extraLabel', 'Assets without gap',
        'extraValue', greatest(scored.asset_count - scored.single_point_count, 0)::text,
        'statusLabel', case
          when scored.single_point_count = 0 then 'Backup coverage stable'
          else 'No qualified backup available'
        end
      ),
      jsonb_build_object(
        'title', 'Annual Leave',
        'slug', 'annual-leave',
        'score', round(scored.leave_score, 1),
        'description', case
          when scored.leave_count = 0 then 'No current-shift leave conflict'
          else scored.leave_count::text
            || case when scored.leave_count = 1 then ' relevant engineer is' else ' relevant engineers are' end
            || ' unavailable'
        end,
        'metricLabel', 'Engineers off',
        'metricValue', scored.leave_count::text,
        'extraLabel', 'Critical cover',
        'extraValue', case
          when scored.leave_count = 0 then 'Not impacted'
          when scored.cover_gaps > 0 then 'Reduced'
          else 'Maintained'
        end,
        'statusLabel', case
          when scored.leave_count = 0 then 'No leave conflict'
          else 'Leave affects current cover'
        end
      ),
      jsonb_build_object(
        'title', 'Training Risk',
        'slug', 'training-expiring',
        'score', round(scored.training_score, 1),
        'description', case
          when scored.expiring_count = 0 and scored.expired_count = 0
            then 'No relevant skill expiries due'
          when scored.expired_count > 0
            then scored.expired_count::text || ' expired and '
              || scored.expiring_count::text || ' expiring skill records'
          else scored.expiring_count::text || ' relevant skill records expiring'
        end,
        'metricLabel', 'Skills expiring',
        'metricValue', scored.expiring_count::text,
        'extraLabel', 'Next expiry',
        'extraValue', case
          when scored.next_expiry is null then 'None'
          else greatest(scored.next_expiry - scored.shift_date, 0)::text || ' days'
        end,
        'statusLabel', case
          when scored.expiring_count = 0 and scored.expired_count = 0
            then 'Training coverage current'
          else 'Expiry action required'
        end
      )
    ) as cards
  from scored
  order by scored.area nulls first;
$function$;

revoke all on function private.vorta_get_scope_labour_cards_set(uuid)
  from public, anon, authenticated;
grant execute on function private.vorta_get_scope_labour_cards_set(uuid)
  to service_role;

create or replace function private.vorta_get_risk_dashboard_scopes_set_based()
returns table(
  scope_key text,
  scope_type text,
  scope_label text,
  area text,
  display_order integer,
  risk_score numeric,
  risk_level text,
  operational_risk_score numeric,
  labour_risk_score numeric,
  highest_child_id uuid,
  highest_child_code text,
  highest_child_name text,
  highest_child_score numeric,
  highest_child_level text,
  asset_count integer,
  at_risk_asset_count integer,
  critical_asset_count integer,
  high_asset_count integer,
  overdue_pm_count integer,
  calibration_backlog_count integer,
  cover_gap_count integer,
  critical_spares_missing integer,
  scheduled_engineer_count integer,
  labour_shift_date date,
  labour_shift_type text,
  no_engineer_override boolean,
  priority_action text,
  risk_summary text,
  child_cards jsonb,
  labour_cards jsonb
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  with site_context as materialized (
    select profile.*
    from public.site_risk_profile profile
    where profile.id = 1
  ),
  equipment_rows as materialized (
    select
      asset.area,
      asset.id as equipment_id,
      asset.equipment_code,
      asset.name as equipment_name,
      asset.equipment_type,
      risk_profile.risk_score,
      risk_profile.risk_level,
      risk_profile.overdue_pm_count,
      risk_profile.calibration_overdue_count,
      risk_profile.critical_spares_missing,
      risk_profile.missing_skill_count,
      risk_profile.labour_risk_score,
      risk_profile.operational_risk_score,
      risk_profile.scheduled_engineer_count,
      risk_profile.qualified_engineer_count,
      risk_profile.no_engineer_override,
      case
        when risk_profile.pm_backlog_pct >= greatest(
          risk_profile.calibration_pct,
          risk_profile.skills_pct,
          risk_profile.spares_pct,
          risk_profile.asset_criticality_pct
        ) and risk_profile.pm_backlog_pct > 0 then 'PM backlog'
        when risk_profile.calibration_pct >= greatest(
          risk_profile.skills_pct,
          risk_profile.spares_pct,
          risk_profile.asset_criticality_pct
        ) and risk_profile.calibration_pct > 0 then 'Calibration backlog'
        when risk_profile.skills_pct >= greatest(
          risk_profile.spares_pct,
          risk_profile.asset_criticality_pct
        ) and risk_profile.skills_pct > 0 then 'Labour coverage'
        when risk_profile.spares_pct >= risk_profile.asset_criticality_pct
          and risk_profile.spares_pct > 0 then 'Critical spares'
        else 'Asset criticality'
      end::text as primary_driver,
      row_number() over (
        partition by asset.area
        order by risk_profile.risk_score desc, asset.name
      )::integer as area_rank
    from site_context context
    join public.equipment_assets asset
      on asset.site_id = context.site_id
    join public.equipment_risk_profiles risk_profile
      on risk_profile.equipment_id = asset.id
  ),
  area_equipment as materialized (
    select
      equipment.area,
      count(*) filter (
        where equipment.risk_score >= 40
      )::integer as at_risk_asset_count,
      count(*) filter (
        where coalesce(equipment.missing_skill_count, 0) > 0
      )::integer as cover_gap_count,
      max(equipment.equipment_id) filter (
        where equipment.area_rank = 1
      ) as highest_equipment_id,
      max(equipment.equipment_code) filter (
        where equipment.area_rank = 1
      ) as highest_equipment_code,
      max(equipment.equipment_name) filter (
        where equipment.area_rank = 1
      ) as highest_equipment_name,
      max(equipment.risk_score) filter (
        where equipment.area_rank = 1
      )::numeric as highest_equipment_score,
      max(equipment.risk_level) filter (
        where equipment.area_rank = 1
      ) as highest_equipment_level,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'kind', 'equipment',
            'id', equipment.equipment_id,
            'label', equipment.equipment_name,
            'code', equipment.equipment_code,
            'equipmentType', equipment.equipment_type,
            'riskScore', equipment.risk_score,
            'riskLevel', equipment.risk_level,
            'primaryDriver', equipment.primary_driver,
            'highestChildName', null,
            'highestChildScore', null,
            'overduePmCount', equipment.overdue_pm_count,
            'calibrationBacklogCount', equipment.calibration_overdue_count,
            'criticalSparesMissing', equipment.critical_spares_missing,
            'coverGapCount', equipment.missing_skill_count,
            'labourRiskScore', equipment.labour_risk_score,
            'operationalRiskScore', equipment.operational_risk_score,
            'scheduledEngineerCount', equipment.scheduled_engineer_count,
            'qualifiedEngineerCount', equipment.qualified_engineer_count,
            'noEngineerOverride', equipment.no_engineer_override
          )
          order by equipment.risk_score desc, equipment.equipment_name
        ) filter (where equipment.area_rank <= 4),
        '[]'::jsonb
      ) as child_cards
    from equipment_rows equipment
    group by equipment.area
  ),
  area_rows as materialized (
    select
      area_profile.area,
      row_number() over (
        order by area_profile.risk_score desc, area_profile.area
      )::integer as display_order,
      area_profile.risk_score::numeric as risk_score,
      area_profile.risk_level,
      area_profile.operational_risk_score,
      area_profile.labour_risk_score,
      area_profile.asset_count,
      area_equipment.at_risk_asset_count,
      area_profile.critical_asset_count,
      area_profile.high_asset_count,
      area_profile.overdue_pm_count,
      area_profile.calibration_overdue_count,
      area_equipment.cover_gap_count,
      area_profile.critical_spares_missing,
      area_profile.scheduled_engineer_count,
      area_profile.no_engineer_override,
      area_profile.priority_action,
      area_profile.risk_summary,
      area_equipment.highest_equipment_id,
      area_equipment.highest_equipment_code,
      area_equipment.highest_equipment_name,
      area_equipment.highest_equipment_score,
      area_equipment.highest_equipment_level,
      area_equipment.child_cards,
      case
        when area_profile.overdue_pm_count >= greatest(
          area_profile.calibration_overdue_count,
          area_profile.critical_spares_missing,
          area_profile.single_point_skill_gap_count
        ) and area_profile.overdue_pm_count > 0 then 'PM backlog'
        when area_profile.calibration_overdue_count >= greatest(
          area_profile.critical_spares_missing,
          area_profile.single_point_skill_gap_count
        ) and area_profile.calibration_overdue_count > 0 then 'Calibration backlog'
        when area_profile.critical_spares_missing >= area_profile.single_point_skill_gap_count
          and area_profile.critical_spares_missing > 0 then 'Critical spares'
        when area_profile.single_point_skill_gap_count > 0 then 'Labour coverage'
        else 'Asset criticality'
      end::text as primary_driver
    from public.area_risk_profiles area_profile
    join area_equipment on area_equipment.area = area_profile.area
  ),
  site_children as materialized (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'kind', 'area',
          'id', child.area,
          'label', child.area,
          'code', null,
          'riskScore', child.risk_score,
          'riskLevel', child.risk_level,
          'primaryDriver', child.primary_driver,
          'highestChildName', child.highest_equipment_name,
          'highestChildScore', child.highest_equipment_score,
          'overduePmCount', child.overdue_pm_count,
          'calibrationBacklogCount', child.calibration_overdue_count,
          'criticalSparesMissing', child.critical_spares_missing,
          'coverGapCount', child.cover_gap_count,
          'labourRiskScore', child.labour_risk_score,
          'operationalRiskScore', child.operational_risk_score,
          'scheduledEngineerCount', child.scheduled_engineer_count,
          'noEngineerOverride', child.no_engineer_override
        )
        order by child.risk_score desc, child.area
      ),
      '[]'::jsonb
    ) as cards
    from area_rows child
    where child.display_order <= 4
  ),
  labour_cards as materialized (
    select labour.area, labour.cards
    from site_context context
    cross join lateral private.vorta_get_scope_labour_cards_set(context.site_id) labour
  ),
  combined as (
    select
      'site'::text as scope_key,
      'site'::text as scope_type,
      'Site Risk'::text as scope_label,
      null::text as area,
      0::integer as display_order,
      site.risk_score,
      site.risk_level,
      site.operational_risk_score,
      site.labour_risk_score,
      null::uuid as highest_child_id,
      null::text as highest_child_code,
      site.highest_area as highest_child_name,
      site.highest_area_score::numeric as highest_child_score,
      site.highest_area_level as highest_child_level,
      site.total_assets as asset_count,
      site.at_risk_assets as at_risk_asset_count,
      site.critical_assets as critical_asset_count,
      site.high_assets as high_asset_count,
      site.overdue_pm_count,
      site.calibration_backlog_count,
      site.cover_gap_count,
      site.critical_spares_missing,
      site.scheduled_engineer_count,
      site.labour_shift_date,
      site.labour_shift_type,
      site.no_engineer_override,
      site.priority_action,
      site.risk_summary,
      site_children.cards as child_cards,
      site_labour.cards as labour_cards
    from site_context site
    cross join site_children
    join labour_cards site_labour on site_labour.area is null

    union all

    select
      'area:' || area_row.area,
      'area'::text,
      area_row.area,
      area_row.area,
      area_row.display_order,
      area_row.risk_score,
      area_row.risk_level,
      area_row.operational_risk_score,
      area_row.labour_risk_score,
      area_row.highest_equipment_id,
      area_row.highest_equipment_code,
      area_row.highest_equipment_name,
      area_row.highest_equipment_score,
      area_row.highest_equipment_level,
      area_row.asset_count,
      area_row.at_risk_asset_count,
      area_row.critical_asset_count,
      area_row.high_asset_count,
      area_row.overdue_pm_count,
      area_row.calibration_overdue_count,
      area_row.cover_gap_count,
      area_row.critical_spares_missing,
      area_row.scheduled_engineer_count,
      site.labour_shift_date,
      site.labour_shift_type,
      area_row.no_engineer_override,
      area_row.priority_action,
      area_row.risk_summary,
      area_row.child_cards,
      area_labour.cards
    from area_rows area_row
    cross join site_context site
    join labour_cards area_labour on area_labour.area = area_row.area
  )
  select *
  from combined
  order by display_order;
$function$;

revoke all on function private.vorta_get_risk_dashboard_scopes_set_based()
  from public, anon, authenticated;
grant execute on function private.vorta_get_risk_dashboard_scopes_set_based()
  to service_role;

do $validation$
declare
  v_legacy_scopes jsonb;
  v_candidate_scopes jsonb;
  v_legacy_labour jsonb;
  v_candidate_labour jsonb;
begin
  select coalesce(
    jsonb_agg(to_jsonb(scope) order by scope.scope_key),
    '[]'::jsonb
  )
  into v_legacy_scopes
  from legacy_dashboard_scopes scope;

  select coalesce(
    jsonb_agg(to_jsonb(scope) order by scope.scope_key),
    '[]'::jsonb
  )
  into v_candidate_scopes
  from private.vorta_get_risk_dashboard_scopes_set_based() scope;

  if v_legacy_scopes is distinct from v_candidate_scopes then
    raise exception 'Set-based dashboard scope output differs from the legacy output';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(labour) order by labour.area nulls first),
    '[]'::jsonb
  )
  into v_legacy_labour
  from legacy_scope_labour_cards labour;

  select coalesce(
    jsonb_agg(to_jsonb(labour) order by labour.area nulls first),
    '[]'::jsonb
  )
  into v_candidate_labour
  from private.vorta_get_scope_labour_cards_set(
    '11000000-0000-0000-0000-000000000001'::uuid
  ) labour;

  if v_legacy_labour is distinct from v_candidate_labour then
    raise exception 'Set-based dashboard labour-card output differs from the legacy output';
  end if;
end;
$validation$;

create or replace function public.vorta_get_scope_labour_cards(
  p_site_id uuid,
  p_area text default null
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  select labour.cards
  from private.vorta_get_scope_labour_cards_set(p_site_id) labour
  where labour.area is not distinct from p_area;
$function$;

create or replace function public.vorta_get_risk_dashboard_scopes_internal()
returns table(
  scope_key text,
  scope_type text,
  scope_label text,
  area text,
  display_order integer,
  risk_score numeric,
  risk_level text,
  operational_risk_score numeric,
  labour_risk_score numeric,
  highest_child_id uuid,
  highest_child_code text,
  highest_child_name text,
  highest_child_score numeric,
  highest_child_level text,
  asset_count integer,
  at_risk_asset_count integer,
  critical_asset_count integer,
  high_asset_count integer,
  overdue_pm_count integer,
  calibration_backlog_count integer,
  cover_gap_count integer,
  critical_spares_missing integer,
  scheduled_engineer_count integer,
  labour_shift_date date,
  labour_shift_type text,
  no_engineer_override boolean,
  priority_action text,
  risk_summary text,
  child_cards jsonb,
  labour_cards jsonb
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  select *
  from private.vorta_get_risk_dashboard_scopes_set_based();
$function$;
