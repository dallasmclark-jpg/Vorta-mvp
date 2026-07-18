create or replace function private.vorta_insert_capability_action_snapshots(
  p_snapshot_id uuid,
  p_site_id uuid,
  p_snapshot_date date,
  p_report jsonb
)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_rows integer := 0;
begin
  delete from private.vorta_capability_action_snapshots
  where snapshot_id = p_snapshot_id;

  insert into private.vorta_capability_action_snapshots (
    snapshot_id,
    site_id,
    snapshot_date,
    action_id,
    action_type,
    priority_rank,
    priority_score,
    priority_level,
    equipment_id,
    equipment_code,
    equipment_name,
    area,
    equipment_risk_score,
    requirement_skill_id,
    requirement_name,
    primary_sme_id,
    primary_sme_name,
    backup_sme_id,
    backup_sme_name,
    candidate_person_type,
    candidate_id,
    candidate_name,
    candidate_status,
    candidate_skill_matches,
    candidate_skill_total,
    affected_shift_count,
    affected_shift_codes,
    missing_evidence,
    action_owner,
    recommended_action,
    rationale,
    state_hash,
    action_payload
  )
  select
    p_snapshot_id,
    p_site_id,
    p_snapshot_date,
    action.value->>'actionId',
    action.value->>'actionType',
    nullif(action.value->>'priorityRank', '')::integer,
    (action.value->>'priorityScore')::numeric,
    action.value->>'priorityLevel',
    nullif(action.value->'equipment'->>'id', '')::uuid,
    action.value->'equipment'->>'code',
    action.value->'equipment'->>'name',
    action.value->'equipment'->>'area',
    nullif(action.value->'equipment'->>'riskScore', '')::numeric,
    nullif(action.value->'requirement'->>'skillId', '')::uuid,
    action.value->'requirement'->>'skillName',
    nullif(action.value->'primarySme'->>'id', '')::uuid,
    action.value->'primarySme'->>'name',
    nullif(action.value->'backupSme'->>'id', '')::uuid,
    action.value->'backupSme'->>'name',
    action.value->'candidate'->>'personType',
    nullif(action.value->'candidate'->>'id', '')::uuid,
    action.value->'candidate'->>'name',
    action.value->'candidate'->>'status',
    nullif(action.value->'candidate'->>'requiredSkillMatches', '')::integer,
    nullif(action.value->'candidate'->>'requiredSkillTotal', '')::integer,
    jsonb_array_length(coalesce(action.value->'affectedShifts', '[]'::jsonb)),
    coalesce((
      select array_agg(
        shift_item.value->>'shiftCode'
        order by shift_item.value->>'shiftCode'
      )
      from jsonb_array_elements(
        coalesce(action.value->'affectedShifts', '[]'::jsonb)
      ) shift_item(value)
    ), '{}'::text[]),
    coalesce((
      select array_agg(evidence_item.value order by evidence_item.value)
      from jsonb_array_elements_text(
        coalesce(action.value->'missingEvidence', '[]'::jsonb)
      ) evidence_item(value)
    ), '{}'::text[]),
    action.value->>'actionOwner',
    action.value->>'recommendedAction',
    action.value->>'rationale',
    encode(extensions.digest(action.value::text, 'sha256'), 'hex'),
    action.value
  from jsonb_array_elements(
    coalesce(p_report->'actions', '[]'::jsonb)
  ) action(value);

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

revoke all on function private.vorta_insert_capability_action_snapshots(uuid, uuid, date, jsonb) from public;
revoke all on function private.vorta_insert_capability_action_snapshots(uuid, uuid, date, jsonb) from anon;
revoke all on function private.vorta_insert_capability_action_snapshots(uuid, uuid, date, jsonb) from authenticated;
grant execute on function private.vorta_insert_capability_action_snapshots(uuid, uuid, date, jsonb) to service_role;

create or replace function private.vorta_capture_capability_risk_snapshot(
  p_site_id uuid,
  p_snapshot_date date default current_date,
  p_source_event text default 'daily scheduled snapshot'
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_report jsonb;
  v_site_risk public.site_risk_profile%rowtype;
  v_snapshot_id uuid;
  v_action_count integer;
  v_max_score numeric;
  v_avg_score numeric;
  v_action_rows integer;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);

  select profile.*
  into v_site_risk
  from public.site_risk_profile profile
  where profile.site_id = p_site_id
  order by profile.updated_at desc
  limit 1;

  if not found then
    raise exception 'No current site risk profile for site %', p_site_id;
  end if;

  v_report := public.vorta_get_capability_reconciliation_report(p_site_id, 500);

  if v_report is null then
    raise exception 'Capability report unavailable for site %', p_site_id;
  end if;

  select
    count(*)::integer,
    max((item.value->>'priorityScore')::numeric),
    round(avg((item.value->>'priorityScore')::numeric), 2)
  into v_action_count, v_max_score, v_avg_score
  from jsonb_array_elements(
    coalesce(v_report->'actions', '[]'::jsonb)
  ) item(value);

  insert into private.vorta_capability_risk_snapshots (
    site_id,
    snapshot_date,
    captured_at,
    source_event,
    site_risk_score,
    site_risk_level,
    operational_risk_score,
    labour_risk_score,
    total_assets,
    at_risk_assets,
    high_assets,
    critical_assets,
    overdue_pm_count,
    calibration_backlog_count,
    cover_gap_count,
    critical_spares_missing,
    scheduled_engineer_count,
    capability_action_count,
    critical_action_count,
    high_action_count,
    medium_action_count,
    low_action_count,
    backup_sme_action_count,
    skill_coverage_action_count,
    am_shift_action_count,
    maximum_priority_score,
    average_priority_score,
    capability_summary,
    source_hash,
    updated_at
  )
  values (
    p_site_id,
    p_snapshot_date,
    now(),
    coalesce(nullif(btrim(p_source_event), ''), 'daily scheduled snapshot'),
    v_site_risk.risk_score,
    v_site_risk.risk_level,
    v_site_risk.operational_risk_score,
    v_site_risk.labour_risk_score,
    coalesce(v_site_risk.total_assets, 0),
    coalesce(v_site_risk.at_risk_assets, 0),
    coalesce(v_site_risk.high_assets, 0),
    coalesce(v_site_risk.critical_assets, 0),
    coalesce(v_site_risk.overdue_pm_count, 0),
    coalesce(v_site_risk.calibration_backlog_count, 0),
    coalesce(v_site_risk.cover_gap_count, 0),
    coalesce(v_site_risk.critical_spares_missing, 0),
    coalesce(v_site_risk.scheduled_engineer_count, 0),
    v_action_count,
    coalesce((v_report->'summary'->>'criticalCount')::integer, 0),
    coalesce((v_report->'summary'->>'highCount')::integer, 0),
    coalesce((v_report->'summary'->>'mediumCount')::integer, 0),
    coalesce((v_report->'summary'->>'lowCount')::integer, 0),
    coalesce((v_report->'summary'->>'backupSmeActions')::integer, 0),
    coalesce((v_report->'summary'->>'skillCoverageActions')::integer, 0),
    coalesce((v_report->'summary'->>'amShiftActions')::integer, 0),
    v_max_score,
    v_avg_score,
    coalesce(v_report->'summary', '{}'::jsonb),
    encode(
      extensions.digest(
        (v_report || to_jsonb(v_site_risk))::text,
        'sha256'
      ),
      'hex'
    ),
    now()
  )
  on conflict (site_id, snapshot_date) do update set
    captured_at = excluded.captured_at,
    source_event = excluded.source_event,
    site_risk_score = excluded.site_risk_score,
    site_risk_level = excluded.site_risk_level,
    operational_risk_score = excluded.operational_risk_score,
    labour_risk_score = excluded.labour_risk_score,
    total_assets = excluded.total_assets,
    at_risk_assets = excluded.at_risk_assets,
    high_assets = excluded.high_assets,
    critical_assets = excluded.critical_assets,
    overdue_pm_count = excluded.overdue_pm_count,
    calibration_backlog_count = excluded.calibration_backlog_count,
    cover_gap_count = excluded.cover_gap_count,
    critical_spares_missing = excluded.critical_spares_missing,
    scheduled_engineer_count = excluded.scheduled_engineer_count,
    capability_action_count = excluded.capability_action_count,
    critical_action_count = excluded.critical_action_count,
    high_action_count = excluded.high_action_count,
    medium_action_count = excluded.medium_action_count,
    low_action_count = excluded.low_action_count,
    backup_sme_action_count = excluded.backup_sme_action_count,
    skill_coverage_action_count = excluded.skill_coverage_action_count,
    am_shift_action_count = excluded.am_shift_action_count,
    maximum_priority_score = excluded.maximum_priority_score,
    average_priority_score = excluded.average_priority_score,
    capability_summary = excluded.capability_summary,
    source_hash = excluded.source_hash,
    updated_at = now()
  returning id into v_snapshot_id;

  v_action_rows := private.vorta_insert_capability_action_snapshots(
    v_snapshot_id,
    p_site_id,
    p_snapshot_date,
    v_report
  );

  return jsonb_build_object(
    'status', 'captured',
    'snapshotId', v_snapshot_id,
    'siteId', p_site_id,
    'snapshotDate', p_snapshot_date,
    'siteRiskScore', v_site_risk.risk_score,
    'capabilityActions', v_action_rows,
    'maximumPriorityScore', v_max_score,
    'averagePriorityScore', v_avg_score,
    'capturedAt', now()
  );
end;
$function$;

revoke all on function private.vorta_capture_capability_risk_snapshot(uuid, date, text) from public;
revoke all on function private.vorta_capture_capability_risk_snapshot(uuid, date, text) from anon;
revoke all on function private.vorta_capture_capability_risk_snapshot(uuid, date, text) from authenticated;
grant execute on function private.vorta_capture_capability_risk_snapshot(uuid, date, text) to service_role;

create or replace function private.vorta_capture_all_capability_risk_snapshots(
  p_snapshot_date date default current_date,
  p_source_event text default 'daily scheduled snapshot'
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site record;
  v_results jsonb := '[]'::jsonb;
  v_risk_rows integer := 0;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);

  v_risk_rows := public.vorta_create_risk_history_snapshot(p_snapshot_date);

  for v_site in
    select distinct profile.site_id
    from public.site_risk_profile profile
    where profile.site_id is not null
    order by profile.site_id
  loop
    v_results := v_results || jsonb_build_array(
      private.vorta_capture_capability_risk_snapshot(
        v_site.site_id,
        p_snapshot_date,
        p_source_event
      )
    );
  end loop;

  return jsonb_build_object(
    'status', 'captured',
    'snapshotDate', p_snapshot_date,
    'riskHistoryRows', v_risk_rows,
    'siteCount', jsonb_array_length(v_results),
    'sites', v_results,
    'completedAt', now()
  );
end;
$function$;

revoke all on function private.vorta_capture_all_capability_risk_snapshots(date, text) from public;
revoke all on function private.vorta_capture_all_capability_risk_snapshots(date, text) from anon;
revoke all on function private.vorta_capture_all_capability_risk_snapshots(date, text) from authenticated;
grant execute on function private.vorta_capture_all_capability_risk_snapshots(date, text) to service_role;

comment on function private.vorta_insert_capability_action_snapshots(uuid, uuid, date, jsonb) is
  'Replaces the action-level evidence rows for one daily capability snapshot.';

comment on function private.vorta_capture_capability_risk_snapshot(uuid, date, text) is
  'Captures one site daily capability and risk snapshot from live derived analytics.';

comment on function private.vorta_capture_all_capability_risk_snapshots(date, text) is
  'Captures risk history and capability action evidence for every site with a current risk profile.';