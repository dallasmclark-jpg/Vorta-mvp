do $migration$
declare
  v_existing_job_id bigint;
begin
  select job.jobid
  into v_existing_job_id
  from cron.job job
  where job.jobname = 'vorta-pilot-readiness-daily'
  limit 1;

  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  perform cron.schedule(
    'vorta-pilot-readiness-daily',
    '27 4 * * *',
    'select public.vorta_run_pilot_readiness_suite(current_date);'
  );
end;
$migration$;

create or replace function private.vorta_run_pilot_readiness_schedule_monitor()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'cron'
as $function$
declare
  v_site_id uuid := public.vorta_current_demo_site_id();
  v_job_id bigint;
  v_job_active boolean;
  v_latest_run private.vorta_backend_health_runs%rowtype;
  v_age_hours integer;
  v_cron_status text;
  v_cron_message text;
  v_cron_started_at timestamptz;
  v_alert record;
  v_opened integer := 0;
  v_updated integer := 0;
  v_resolved integer := 0;
begin
  if v_site_id is null then
    raise exception 'Pilot readiness monitoring requires a configured pilot site';
  end if;

  select job.jobid, job.active
  into v_job_id, v_job_active
  from cron.job job
  where job.jobname = 'vorta-pilot-readiness-daily'
  limit 1;

  if v_job_id is null or not coalesce(v_job_active, false) then
    select *
    into v_alert
    from private.vorta_open_or_update_system_health_alert(
      v_site_id,
      'scheduler:pilot_readiness_job',
      'Pilot readiness suite is not scheduled',
      'The daily Vorta pilot-readiness health suite is missing or disabled.',
      'critical',
      'Pilot Readiness Scheduler Monitor',
      jsonb_build_object(
        'jobName', 'vorta-pilot-readiness-daily',
        'jobId', v_job_id,
        'active', coalesce(v_job_active, false),
        'observedAt', now()
      )
    );

    if v_alert.action_taken = 'opened' then
      v_opened := v_opened + 1;
    else
      v_updated := v_updated + 1;
    end if;
  else
    v_resolved := v_resolved + private.vorta_resolve_system_health_alert(
      v_site_id,
      'scheduler:pilot_readiness_job',
      jsonb_build_object('recoveredAt', now(), 'jobId', v_job_id, 'active', true)
    );
  end if;

  select run.*
  into v_latest_run
  from private.vorta_backend_health_runs run
  where run.demo_site_id = v_site_id
    and run.suite_version = '2.0.0'
  order by run.started_at desc
  limit 1;

  v_age_hours := case
    when v_latest_run.id is null then null
    else greatest(
      0,
      floor(extract(epoch from now() - v_latest_run.started_at) / 3600)::integer
    )
  end;

  if v_latest_run.id is null
     or v_latest_run.overall_status <> 'pass'
     or v_latest_run.started_at < now() - interval '36 hours' then
    select *
    into v_alert
    from private.vorta_open_or_update_system_health_alert(
      v_site_id,
      'scheduler:pilot_readiness_status',
      case
        when v_latest_run.id is null then 'Pilot readiness result is missing'
        when v_latest_run.overall_status <> 'pass' then 'Pilot readiness checks are failing'
        else 'Pilot readiness checks are overdue'
      end,
      case
        when v_latest_run.id is null then
          'No completed pilot-readiness health result exists for the Wrexham pilot.'
        when v_latest_run.overall_status <> 'pass' then
          format(
            'The latest pilot-readiness run status is %s with %s failed check(s).',
            v_latest_run.overall_status,
            coalesce(v_latest_run.failed_count, 0)
          )
        else
          format('The latest pilot-readiness result was recorded %s hours ago.', v_age_hours)
      end,
      case
        when v_latest_run.id is null or v_latest_run.overall_status <> 'pass' then 'critical'
        else 'high'
      end,
      'Pilot Readiness Scheduler Monitor',
      jsonb_build_object(
        'runId', v_latest_run.id,
        'status', v_latest_run.overall_status,
        'startedAt', v_latest_run.started_at,
        'finishedAt', v_latest_run.finished_at,
        'ageHours', v_age_hours,
        'passed', v_latest_run.passed_count,
        'failed', v_latest_run.failed_count,
        'warnings', v_latest_run.warning_count,
        'observedAt', now()
      )
    );

    if v_alert.action_taken = 'opened' then
      v_opened := v_opened + 1;
    else
      v_updated := v_updated + 1;
    end if;
  else
    v_resolved := v_resolved + private.vorta_resolve_system_health_alert(
      v_site_id,
      'scheduler:pilot_readiness_status',
      jsonb_build_object(
        'recoveredAt', now(),
        'runId', v_latest_run.id,
        'status', v_latest_run.overall_status,
        'startedAt', v_latest_run.started_at
      )
    );
  end if;

  if v_job_id is not null then
    select run.status, run.return_message, run.start_time
    into v_cron_status, v_cron_message, v_cron_started_at
    from cron.job_run_details run
    where run.jobid = v_job_id
    order by run.start_time desc nulls last, run.runid desc
    limit 1;
  end if;

  if v_cron_status is not null and lower(v_cron_status) <> 'succeeded' then
    select *
    into v_alert
    from private.vorta_open_or_update_system_health_alert(
      v_site_id,
      'scheduler:pilot_readiness_last_run',
      'Pilot readiness cron job failed',
      coalesce(
        nullif(v_cron_message, ''),
        'The latest scheduled pilot-readiness run did not succeed.'
      ),
      'critical',
      'Pilot Readiness Scheduler Monitor',
      jsonb_build_object(
        'jobId', v_job_id,
        'status', v_cron_status,
        'returnMessage', v_cron_message,
        'startedAt', v_cron_started_at,
        'observedAt', now()
      )
    );

    if v_alert.action_taken = 'opened' then
      v_opened := v_opened + 1;
    else
      v_updated := v_updated + 1;
    end if;
  else
    v_resolved := v_resolved + private.vorta_resolve_system_health_alert(
      v_site_id,
      'scheduler:pilot_readiness_last_run',
      jsonb_build_object(
        'recoveredAt', now(),
        'jobId', v_job_id,
        'latestStatus', v_cron_status,
        'latestStartedAt', v_cron_started_at
      )
    );
  end if;

  return jsonb_build_object(
    'siteId', v_site_id,
    'jobId', v_job_id,
    'jobActive', coalesce(v_job_active, false),
    'latestHealthRunId', v_latest_run.id,
    'latestHealthStatus', v_latest_run.overall_status,
    'latestHealthRunAt', v_latest_run.started_at,
    'latestHealthAgeHours', v_age_hours,
    'latestCronStatus', v_cron_status,
    'latestCronStartedAt', v_cron_started_at,
    'openedIncidents', v_opened,
    'updatedIncidents', v_updated,
    'resolvedIncidents', v_resolved
  );
end;
$function$;

revoke all on function private.vorta_run_pilot_readiness_schedule_monitor() from public;
revoke all on function private.vorta_run_pilot_readiness_schedule_monitor() from anon;
revoke all on function private.vorta_run_pilot_readiness_schedule_monitor() from authenticated;
grant execute on function private.vorta_run_pilot_readiness_schedule_monitor() to service_role;

create or replace function public.vorta_run_operational_monitoring_cycle()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_operational_result jsonb;
  v_scheduler_result jsonb;
  v_recovery_result jsonb;
  v_pilot_readiness_result jsonb;
begin
  v_operational_result := public.vorta_run_operational_monitoring();
  v_scheduler_result := private.vorta_run_scheduler_health_monitor();
  v_recovery_result := private.vorta_run_recovery_manifest_health_monitor();
  v_pilot_readiness_result := private.vorta_run_pilot_readiness_schedule_monitor();

  return jsonb_build_object(
    'operationalMonitoring', v_operational_result,
    'schedulerMonitoring', v_scheduler_result,
    'recoveryMonitoring', v_recovery_result,
    'pilotReadinessMonitoring', v_pilot_readiness_result,
    'completedAt', now()
  );
end;
$function$;
