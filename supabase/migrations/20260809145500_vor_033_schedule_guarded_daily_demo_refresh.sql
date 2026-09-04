-- VOR-033 rolling demo maintenance.
-- Run only after the VOR-069 historical-backtest exclusion is protected.

drop function if exists private.vorta_refresh_demo_dataset_dates_phase1_pre_backtest_guard_inte(uuid, date);

select cron.unschedule(jobid)
from cron.job
where jobname = 'refresh-vorta-demo-dataset-daily';

select cron.schedule(
  'refresh-vorta-demo-dataset-daily',
  '17 1 * * *',
  $cron$select private.vorta_refresh_demo_dataset_dates_internal(
    '11000000-0000-0000-0000-000000000001'::uuid,
    (now() at time zone 'Europe/London')::date
  );$cron$
);
