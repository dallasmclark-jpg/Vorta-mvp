create or replace function private.vorta_run_capability_snapshot_health_monitor()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
  v_latest_snapshot private.vorta_capability_risk_snapshots%rowtype;
  v_job_id bigint;
  v_job_active boolean := false;
  v_latest_cron_status text;
  v_latest_cron_started_at timestamptz;
  v_snapshot_age_hours numeric;
  v_alert record;
  v_opened integer := 0;
  v_updated integer := 0;
  v_resolved integer := 0;
begin
  select snapshot.*
  into v_latest_snapshot
  from private.vorta_capability_risk_snapshots snapshot
  where snapshot.site_id = v_site_id
  order by snapshot.snapshot_date desc, snapshot.captured_at desc
  limit 1;

  select job.jobid, job.active
  into v_job_id, v_job_active
  from cron.job job
  where job.jobname = 'vorta-capability-risk-snapshot-daily'
  limit 1;

  if v_job_id is not null then
    select run.status, run.start_time
    into v_latest_cron_status, v_latest_cron_started_at
    from cron.job_run_details run
    where run.jobid = v_job_id
    order by run.start_time desc
    limit 1;
  end if;

  v_snapshot_age_hours := case
    when v_latest_snapshot.captured_at is null then null
    else round(
      (extract(epoch from now() - v_latest_snapshot.captured_at) / 3600)::numeric,
      2
    )
  end;

  if coalesce(v_job_active, false) is false
     or v_latest_snapshot.id is null
     or coalesce(v_snapshot_age_hours, 999999) > 36
     or coalesce(v_latest_cron_status, 'succeeded')
        not in ('succeeded', 'running') then
    select *
    into v_alert
    from private.vorta_open_or_update_system_health_alert(
      v_site_id,
      'capability:daily_snapshot',
      'Capability and risk history snapshot requires attention',
      format(
        'Job active=%s, latest snapshot=%s, age hours=%s, latest cron status=%s.',
        coalesce(v_job_active, false),
        coalesce(v_latest_snapshot.snapshot_date::text, 'missing'),
        coalesce(v_snapshot_age_hours::text, 'missing'),
        coalesce(v_latest_cron_status, 'not yet run')
      ),
      'high',
      'Capability Snapshot Monitor',
      jsonb_build_object(
        'jobId', v_job_id,
        'jobActive', v_job_active,
        'latestSnapshotId', v_latest_snapshot.id,
        'latestSnapshotDate', v_latest_snapshot.snapshot_date,
        'latestCapturedAt', v_latest_snapshot.captured_at,
        'snapshotAgeHours', v_snapshot_age_hours,
        'latestCronStatus', v_latest_cron_status,
        'latestCronStartedAt', v_latest_cron_started_at,
        'observedAt', now()
      )
    );

    if v_alert.action_taken = 'opened' then
      v_opened := 1;
    else
      v_updated := 1;
    end if;
  else
    v_resolved := private.vorta_resolve_system_health_alert(
      v_site_id,
      'capability:daily_snapshot',
      jsonb_build_object(
        'recoveredAt', now(),
        'latestSnapshotId', v_latest_snapshot.id,
        'latestSnapshotDate', v_latest_snapshot.snapshot_date,
        'snapshotAgeHours', v_snapshot_age_hours,
        'jobId', v_job_id,
        'jobActive', v_job_active
      )
    );
  end if;

  return jsonb_build_object(
    'siteId', v_site_id,
    'jobId', v_job_id,
    'jobActive', v_job_active,
    'latestSnapshotId', v_latest_snapshot.id,
    'latestSnapshotDate', v_latest_snapshot.snapshot_date,
    'latestCapturedAt', v_latest_snapshot.captured_at,
    'snapshotAgeHours', v_snapshot_age_hours,
    'latestCronStatus', v_latest_cron_status,
    'latestCronStartedAt', v_latest_cron_started_at,
    'openedIncidents', v_opened,
    'updatedIncidents', v_updated,
    'resolvedIncidents', v_resolved
  );
end;
$function$;

revoke all on function private.vorta_run_capability_snapshot_health_monitor() from public;
revoke all on function private.vorta_run_capability_snapshot_health_monitor() from anon;
revoke all on function private.vorta_run_capability_snapshot_health_monitor() from authenticated;
grant execute on function private.vorta_run_capability_snapshot_health_monitor() to service_role;

do $migration$
declare
  v_job_id bigint;
begin
  select job.jobid
  into v_job_id
  from cron.job job
  where job.jobname = 'vorta-capability-risk-snapshot-daily'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'vorta-capability-risk-snapshot-daily',
    '37 4 * * *',
    'select private.vorta_capture_all_capability_risk_snapshots(current_date, ''daily scheduled snapshot'');'
  );
end;
$migration$;

create or replace function public.vorta_run_operational_monitoring_cycle()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_operational jsonb;
  v_scheduler jsonb;
  v_recovery jsonb;
  v_pilot jsonb;
  v_documents jsonb;
  v_capability_history jsonb;
begin
  v_operational := public.vorta_run_operational_monitoring();
  v_scheduler := private.vorta_run_scheduler_health_monitor();
  v_recovery := private.vorta_run_recovery_manifest_health_monitor();
  v_pilot := private.vorta_run_pilot_readiness_schedule_monitor();
  v_documents := private.vorta_run_document_ingestion_health_monitor();
  v_capability_history := private.vorta_run_capability_snapshot_health_monitor();

  return jsonb_build_object(
    'operationalMonitoring', v_operational,
    'schedulerMonitoring', v_scheduler,
    'recoveryMonitoring', v_recovery,
    'pilotReadinessMonitoring', v_pilot,
    'documentKnowledgeMonitoring', v_documents,
    'capabilityHistoryMonitoring', v_capability_history,
    'completedAt', now()
  );
end;
$function$;

comment on function private.vorta_run_capability_snapshot_health_monitor() is
  'Monitors daily capability snapshot freshness and raises or resolves a system health incident.';

comment on function public.vorta_run_operational_monitoring_cycle() is
  'Runs operational, scheduler, recovery, pilot-readiness, document and capability-history monitoring.';