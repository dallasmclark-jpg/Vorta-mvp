create or replace function public.vorta_get_capability_risk_history(
  p_site_id uuid,
  p_start_date date default (current_date - 90),
  p_end_date date default current_date,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_start_date date := least(
    coalesce(p_start_date, current_date - 90),
    coalesce(p_end_date, current_date)
  );
  v_end_date date := greatest(
    coalesce(p_start_date, current_date - 90),
    coalesce(p_end_date, current_date)
  );
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_baseline private.vorta_capability_risk_snapshots%rowtype;
  v_latest private.vorta_capability_risk_snapshots%rowtype;
  v_result jsonb;
begin
  if not public.vorta_can_manage_site(p_site_id) then
    return null;
  end if;

  select snapshot.*
  into v_baseline
  from private.vorta_capability_risk_snapshots snapshot
  where snapshot.site_id = p_site_id
    and snapshot.snapshot_date between v_start_date and v_end_date
  order by snapshot.snapshot_date, snapshot.captured_at
  limit 1;

  select snapshot.*
  into v_latest
  from private.vorta_capability_risk_snapshots snapshot
  where snapshot.site_id = p_site_id
    and snapshot.snapshot_date between v_start_date and v_end_date
  order by snapshot.snapshot_date desc, snapshot.captured_at desc
  limit 1;

  if v_baseline.id is null or v_latest.id is null then
    return jsonb_build_object(
      'siteId', p_site_id,
      'generatedAt', now(),
      'period', jsonb_build_object(
        'startDate', v_start_date,
        'endDate', v_end_date
      ),
      'summary', jsonb_build_object(
        'snapshotCount', 0,
        'status', 'NO_SNAPSHOT_DATA'
      ),
      'trend', '[]'::jsonb,
      'actionChanges', '[]'::jsonb
    );
  end if;

  with baseline_actions as (
    select *
    from private.vorta_capability_action_snapshots
    where snapshot_id = v_baseline.id
  ),
  latest_actions as (
    select *
    from private.vorta_capability_action_snapshots
    where snapshot_id = v_latest.id
  ),
  action_comparison as (
    select
      coalesce(latest.action_id, baseline.action_id) as action_id,
      coalesce(latest.action_type, baseline.action_type) as action_type,
      coalesce(latest.equipment_id, baseline.equipment_id) as equipment_id,
      coalesce(latest.equipment_code, baseline.equipment_code) as equipment_code,
      coalesce(latest.equipment_name, baseline.equipment_name) as equipment_name,
      coalesce(latest.area, baseline.area) as area,
      baseline.priority_score as baseline_priority_score,
      latest.priority_score as latest_priority_score,
      case
        when baseline.priority_score is null then null
        when latest.priority_score is null then -baseline.priority_score
        else latest.priority_score - baseline.priority_score
      end as priority_score_change,
      baseline.candidate_skill_matches as baseline_skill_matches,
      latest.candidate_skill_matches as latest_skill_matches,
      baseline.affected_shift_count as baseline_affected_shifts,
      latest.affected_shift_count as latest_affected_shifts,
      coalesce(latest.candidate_name, baseline.candidate_name) as candidate_name,
      coalesce(latest.candidate_status, baseline.candidate_status) as candidate_status,
      coalesce(latest.recommended_action, baseline.recommended_action) as recommended_action,
      coalesce(latest.action_payload, baseline.action_payload) as action_payload,
      case
        when baseline.action_id is not null and latest.action_id is null then 'CLOSED'
        when baseline.action_id is null and latest.action_id is not null then 'NEW'
        when latest.priority_score < baseline.priority_score
          or coalesce(latest.affected_shift_count, 0)
             < coalesce(baseline.affected_shift_count, 0)
          or coalesce(latest.candidate_skill_matches, -1)
             > coalesce(baseline.candidate_skill_matches, -1)
          then 'IMPROVED'
        when latest.priority_score > baseline.priority_score
          or coalesce(latest.affected_shift_count, 0)
             > coalesce(baseline.affected_shift_count, 0)
          or coalesce(latest.candidate_skill_matches, -1)
             < coalesce(baseline.candidate_skill_matches, -1)
          then 'WORSENED'
        else 'UNCHANGED'
      end as change_type
    from baseline_actions baseline
    full join latest_actions latest using (action_id)
  ),
  ranked_changes as (
    select
      comparison.*,
      row_number() over (
        order by
          case comparison.change_type
            when 'CLOSED' then 1
            when 'IMPROVED' then 2
            when 'WORSENED' then 3
            when 'NEW' then 4
            else 5
          end,
          abs(coalesce(comparison.priority_score_change, 0)) desc,
          comparison.equipment_code,
          comparison.action_type
      ) as change_rank
    from action_comparison comparison
  )
  select jsonb_build_object(
    'siteId', p_site_id,
    'generatedAt', now(),
    'interpretation',
      'Observed changes show association between capability evidence and risk movement; they do not assert causal attribution.',
    'period', jsonb_build_object(
      'startDate', v_start_date,
      'endDate', v_end_date,
      'baselineDate', v_baseline.snapshot_date,
      'latestDate', v_latest.snapshot_date
    ),
    'summary', jsonb_build_object(
      'snapshotCount', (
        select count(*)
        from private.vorta_capability_risk_snapshots snapshot
        where snapshot.site_id = p_site_id
          and snapshot.snapshot_date between v_start_date and v_end_date
      ),
      'siteRisk', jsonb_build_object(
        'baseline', v_baseline.site_risk_score,
        'latest', v_latest.site_risk_score,
        'change', v_latest.site_risk_score - v_baseline.site_risk_score,
        'reduction', v_baseline.site_risk_score - v_latest.site_risk_score
      ),
      'operationalRisk', jsonb_build_object(
        'baseline', v_baseline.operational_risk_score,
        'latest', v_latest.operational_risk_score,
        'change',
          v_latest.operational_risk_score - v_baseline.operational_risk_score
      ),
      'labourRisk', jsonb_build_object(
        'baseline', v_baseline.labour_risk_score,
        'latest', v_latest.labour_risk_score,
        'change', v_latest.labour_risk_score - v_baseline.labour_risk_score
      ),
      'capabilityActions', jsonb_build_object(
        'baseline', v_baseline.capability_action_count,
        'latest', v_latest.capability_action_count,
        'change',
          v_latest.capability_action_count - v_baseline.capability_action_count
      ),
      'highAndCriticalActions', jsonb_build_object(
        'baseline',
          v_baseline.high_action_count + v_baseline.critical_action_count,
        'latest',
          v_latest.high_action_count + v_latest.critical_action_count,
        'change',
          (v_latest.high_action_count + v_latest.critical_action_count)
          - (v_baseline.high_action_count + v_baseline.critical_action_count)
      ),
      'backupSmeActions', jsonb_build_object(
        'baseline', v_baseline.backup_sme_action_count,
        'latest', v_latest.backup_sme_action_count,
        'change',
          v_latest.backup_sme_action_count - v_baseline.backup_sme_action_count
      ),
      'amShiftActions', jsonb_build_object(
        'baseline', v_baseline.am_shift_action_count,
        'latest', v_latest.am_shift_action_count,
        'change',
          v_latest.am_shift_action_count - v_baseline.am_shift_action_count
      ),
      'skillCoverageActions', jsonb_build_object(
        'baseline', v_baseline.skill_coverage_action_count,
        'latest', v_latest.skill_coverage_action_count,
        'change',
          v_latest.skill_coverage_action_count
          - v_baseline.skill_coverage_action_count
      ),
      'closedActions', (
        select count(*)
        from action_comparison
        where change_type = 'CLOSED'
      ),
      'newActions', (
        select count(*)
        from action_comparison
        where change_type = 'NEW'
      ),
      'improvedActions', (
        select count(*)
        from action_comparison
        where change_type = 'IMPROVED'
      ),
      'worsenedActions', (
        select count(*)
        from action_comparison
        where change_type = 'WORSENED'
      ),
      'unchangedActions', (
        select count(*)
        from action_comparison
        where change_type = 'UNCHANGED'
      )
    ),
    'trend', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'snapshotDate', snapshot.snapshot_date,
          'capturedAt', snapshot.captured_at,
          'sourceEvent', snapshot.source_event,
          'siteRiskScore', snapshot.site_risk_score,
          'siteRiskLevel', snapshot.site_risk_level,
          'operationalRiskScore', snapshot.operational_risk_score,
          'labourRiskScore', snapshot.labour_risk_score,
          'capabilityActionCount', snapshot.capability_action_count,
          'highActionCount', snapshot.high_action_count,
          'criticalActionCount', snapshot.critical_action_count,
          'backupSmeActionCount', snapshot.backup_sme_action_count,
          'amShiftActionCount', snapshot.am_shift_action_count,
          'skillCoverageActionCount', snapshot.skill_coverage_action_count,
          'maximumPriorityScore', snapshot.maximum_priority_score,
          'averagePriorityScore', snapshot.average_priority_score
        )
        order by snapshot.snapshot_date
      )
      from private.vorta_capability_risk_snapshots snapshot
      where snapshot.site_id = p_site_id
        and snapshot.snapshot_date between v_start_date and v_end_date
    ), '[]'::jsonb),
    'actionChanges', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'changeType', change.change_type,
          'actionId', change.action_id,
          'actionType', change.action_type,
          'equipmentId', change.equipment_id,
          'equipmentCode', change.equipment_code,
          'equipmentName', change.equipment_name,
          'area', change.area,
          'baselinePriorityScore', change.baseline_priority_score,
          'latestPriorityScore', change.latest_priority_score,
          'priorityScoreChange', change.priority_score_change,
          'baselineSkillMatches', change.baseline_skill_matches,
          'latestSkillMatches', change.latest_skill_matches,
          'baselineAffectedShifts', change.baseline_affected_shifts,
          'latestAffectedShifts', change.latest_affected_shifts,
          'candidateName', change.candidate_name,
          'candidateStatus', change.candidate_status,
          'recommendedAction', change.recommended_action,
          'action', change.action_payload
        )
        order by change.change_rank
      )
      from ranked_changes change
      where change.change_rank <= v_limit
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$function$;

revoke all on function public.vorta_get_capability_risk_history(uuid, date, date, integer) from public;
revoke all on function public.vorta_get_capability_risk_history(uuid, date, date, integer) from anon;
grant execute on function public.vorta_get_capability_risk_history(uuid, date, date, integer) to authenticated;
grant execute on function public.vorta_get_capability_risk_history(uuid, date, date, integer) to service_role;

comment on function public.vorta_get_capability_risk_history(uuid, date, date, integer) is
  'Returns manager-scoped capability and risk history with new, improved, worsened, unchanged and closed action classifications.';