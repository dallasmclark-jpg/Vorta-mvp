create table private.vorta_pilot_programs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null unique references public.sites(id) on delete cascade,
  pilot_owner_user_id uuid references auth.users(id) on delete set null,
  manager_contact_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'DRAFT'
    check (status = any (array['DRAFT','DATA_PREPARATION','REHEARSAL','READY','LIVE','PAUSED','COMPLETED']::text[])),
  objective text,
  planned_start_date date,
  planned_end_date date,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  known_limitations text,
  success_criteria jsonb not null default '[]'::jsonb,
  baseline_snapshot_date date,
  launch_confirmed_by uuid references auth.users(id) on delete set null,
  launch_confirmed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vorta_pilot_programs_dates_check check (
    planned_start_date is null
    or planned_end_date is null
    or planned_end_date >= planned_start_date
  ),
  constraint vorta_pilot_programs_success_criteria_array_check
    check (jsonb_typeof(success_criteria) = 'array')
);

create table private.vorta_pilot_manual_checks (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references private.vorta_pilot_programs(id) on delete cascade,
  item_key text not null,
  stage text not null
    check (stage = any (array['SITE_SETUP','USER_READINESS','LAUNCH']::text[])),
  label text not null,
  description text not null,
  blocking boolean not null default true,
  status text not null default 'pending'
    check (status = any (array['pending','pass','warning','fail','not_applicable']::text[])),
  evidence text,
  checked_at timestamptz,
  checked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilot_id, item_key)
);

create table private.vorta_pilot_rehearsal_scenarios (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references private.vorta_pilot_programs(id) on delete cascade,
  scenario_key text not null,
  scenario_order integer not null,
  title text not null,
  objective text not null,
  expected_outcome text not null,
  required_clean_passes integer not null default 2 check (required_clean_passes between 1 and 5),
  blocking boolean not null default true,
  created_at timestamptz not null default now(),
  unique (pilot_id, scenario_key),
  unique (pilot_id, scenario_order)
);

create table private.vorta_pilot_rehearsal_attempts (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references private.vorta_pilot_programs(id) on delete cascade,
  scenario_id uuid not null references private.vorta_pilot_rehearsal_scenarios(id) on delete cascade,
  result text not null
    check (result = any (array['pass','fail','blocked']::text[])),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 0 and 1440),
  intervention_required boolean not null default false,
  notes text,
  evidence text,
  issue_reference text,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);

create table private.vorta_pilot_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references private.vorta_pilot_programs(id) on delete cascade,
  week_number integer not null check (week_number between 0 and 52),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft'
    check (status = any (array['draft','complete']::text[])),
  manager_value_score numeric(4,1) check (manager_value_score is null or manager_value_score between 0 and 10),
  data_accuracy_percent numeric(5,1) check (data_accuracy_percent is null or data_accuracy_percent between 0 and 100),
  estimated_time_saved_minutes integer check (estimated_time_saved_minutes is null or estimated_time_saved_minutes >= 0),
  risks_identified integer not null default 0 check (risks_identified >= 0),
  follow_through_actions integer not null default 0 check (follow_through_actions >= 0),
  summary text,
  blockers text,
  next_actions text,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vorta_pilot_weekly_reviews_dates_check check (period_end >= period_start),
  unique (pilot_id, week_number)
);

create index vorta_pilot_manual_checks_pilot_stage_idx
  on private.vorta_pilot_manual_checks (pilot_id, stage, item_key);
create index vorta_pilot_rehearsal_scenarios_pilot_order_idx
  on private.vorta_pilot_rehearsal_scenarios (pilot_id, scenario_order);
create index vorta_pilot_rehearsal_attempts_scenario_time_idx
  on private.vorta_pilot_rehearsal_attempts (scenario_id, recorded_at desc);
create index vorta_pilot_rehearsal_attempts_pilot_time_idx
  on private.vorta_pilot_rehearsal_attempts (pilot_id, recorded_at desc);
create index vorta_pilot_weekly_reviews_pilot_week_idx
  on private.vorta_pilot_weekly_reviews (pilot_id, week_number);

alter table private.vorta_pilot_programs enable row level security;
alter table private.vorta_pilot_manual_checks enable row level security;
alter table private.vorta_pilot_rehearsal_scenarios enable row level security;
alter table private.vorta_pilot_rehearsal_attempts enable row level security;
alter table private.vorta_pilot_weekly_reviews enable row level security;

create policy vorta_pilot_programs_deny_anon
  on private.vorta_pilot_programs for all to anon using (false) with check (false);
create policy vorta_pilot_programs_deny_authenticated
  on private.vorta_pilot_programs for all to authenticated using (false) with check (false);
create policy vorta_pilot_manual_checks_deny_anon
  on private.vorta_pilot_manual_checks for all to anon using (false) with check (false);
create policy vorta_pilot_manual_checks_deny_authenticated
  on private.vorta_pilot_manual_checks for all to authenticated using (false) with check (false);
create policy vorta_pilot_rehearsal_scenarios_deny_anon
  on private.vorta_pilot_rehearsal_scenarios for all to anon using (false) with check (false);
create policy vorta_pilot_rehearsal_scenarios_deny_authenticated
  on private.vorta_pilot_rehearsal_scenarios for all to authenticated using (false) with check (false);
create policy vorta_pilot_rehearsal_attempts_deny_anon
  on private.vorta_pilot_rehearsal_attempts for all to anon using (false) with check (false);
create policy vorta_pilot_rehearsal_attempts_deny_authenticated
  on private.vorta_pilot_rehearsal_attempts for all to authenticated using (false) with check (false);
create policy vorta_pilot_weekly_reviews_deny_anon
  on private.vorta_pilot_weekly_reviews for all to anon using (false) with check (false);
create policy vorta_pilot_weekly_reviews_deny_authenticated
  on private.vorta_pilot_weekly_reviews for all to authenticated using (false) with check (false);

revoke all on private.vorta_pilot_programs from public, anon, authenticated;
revoke all on private.vorta_pilot_manual_checks from public, anon, authenticated;
revoke all on private.vorta_pilot_rehearsal_scenarios from public, anon, authenticated;
revoke all on private.vorta_pilot_rehearsal_attempts from public, anon, authenticated;
revoke all on private.vorta_pilot_weekly_reviews from public, anon, authenticated;

create or replace function private.vorta_ensure_pilot_program(
  p_site_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
volatile
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_pilot_id uuid;
begin
  insert into private.vorta_pilot_programs (
    site_id,
    pilot_owner_user_id,
    manager_contact_user_id,
    success_criteria,
    created_by,
    updated_by
  )
  values (
    p_site_id,
    p_actor_user_id,
    p_actor_user_id,
    jsonb_build_array(
      jsonb_build_object('key','active_usage','label','Active usage','target',3,'unit','days/week'),
      jsonb_build_object('key','repeat_usage','label','Repeat usage','target',2,'unit','sessions/week'),
      jsonb_build_object('key','equipment_reviews','label','Equipment reviewed','target',10,'unit','reviews'),
      jsonb_build_object('key','ask_vorta_queries','label','Ask Vorta','target',5,'unit','queries'),
      jsonb_build_object('key','follow_through','label','Follow-through','target',5,'unit','actions'),
      jsonb_build_object('key','data_accuracy','label','Data accuracy','target',90,'unit','percent'),
      jsonb_build_object('key','user_value','label','User value rating','target',7,'unit','out of 10')
    ),
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict (site_id) do update set
    pilot_owner_user_id = coalesce(private.vorta_pilot_programs.pilot_owner_user_id, excluded.pilot_owner_user_id),
    manager_contact_user_id = coalesce(private.vorta_pilot_programs.manager_contact_user_id, excluded.manager_contact_user_id)
  returning id into v_pilot_id;

  insert into private.vorta_pilot_manual_checks (
    pilot_id,
    item_key,
    stage,
    label,
    description,
    blocking
  ) values
    (v_pilot_id,'PILOT_OWNER_CONFIRMED','SITE_SETUP','Pilot owner confirmed','The person responsible for the pilot, decisions and follow-up is confirmed.',true),
    (v_pilot_id,'SUCCESS_CRITERIA_AGREED','SITE_SETUP','Success criteria agreed','The site and Vorta have agreed how pilot value will be judged before launch.',true),
    (v_pilot_id,'LOGIN_TESTED','USER_READINESS','Maintenance Manager login tested','The pilot account has signed in successfully using the intended production URL.',true),
    (v_pilot_id,'DEVICE_BROWSER_TESTED','USER_READINESS','Device and browser tested','The manager has tested the intended laptop or tablet and supported browser.',true),
    (v_pilot_id,'USAGE_SCOPE_EXPLAINED','USER_READINESS','Read-only scope explained','The manager understands that SAP remains the system of record and Vorta does not write back to SAP.',true),
    (v_pilot_id,'KNOWN_LIMITATIONS_REVIEWED','USER_READINESS','Known limitations reviewed','Current data gaps and pilot limitations have been explained and accepted.',true),
    (v_pilot_id,'FIRST_SESSION_SCHEDULED','LAUNCH','First session scheduled','A guided first-use session is scheduled with the pilot manager.',true),
    (v_pilot_id,'WEEKLY_REVIEW_SCHEDULED','LAUNCH','Weekly review scheduled','A recurring pilot review cadence is agreed for the trial period.',true)
  on conflict (pilot_id, item_key) do nothing;

  insert into private.vorta_pilot_rehearsal_scenarios (
    pilot_id,
    scenario_key,
    scenario_order,
    title,
    objective,
    expected_outcome
  ) values
    (v_pilot_id,'MORNING_RISK_REVIEW',1,'Morning risk review','Identify the highest-risk area and its top recommended action.','The manager can move from site risk to the correct action without assistance.'),
    (v_pilot_id,'EQUIPMENT_INVESTIGATION',2,'Equipment investigation','Review a high-risk asset across work orders, history, skills, spares and documents.','The correct asset context remains visible and each linked workflow opens reliably.'),
    (v_pilot_id,'WORK_ORDER_EVIDENCE',3,'Work-order evidence','Open a completed order and verify confirmation text, reservations and goods movements.','All expected SAP evidence is visible in the work-order overlay.'),
    (v_pilot_id,'ASK_VORTA_FAULT',4,'Ask Vorta fault query','Ask a realistic machine-fault question using the equipment context.','The answer links to relevant documents, history and spares without unsupported claims.'),
    (v_pilot_id,'SKILLS_GAP_REVIEW',5,'Skills gap review','Find equipment with weak SME or shift coverage.','The skills gap and responsible engineers are clear enough to support action.'),
    (v_pilot_id,'TRAINING_ACTION',6,'Training action','Move from a capability gap to an engineer, requirement or training plan.','The workflow identifies a practical development action without losing context.'),
    (v_pilot_id,'PM_CALIBRATION_RISK',7,'PM or calibration risk','Locate an overdue or upcoming maintenance requirement.','The due date, equipment and risk context agree across views.'),
    (v_pilot_id,'SPARES_RISK',8,'Spare-parts risk','Find a critical stock-out or unreserved part linked to maintenance demand.','The part, stock and work-order relationship is understandable and evidence-backed.'),
    (v_pilot_id,'PILOT_REPORT',9,'Pilot report','Change the Pilot Impact date range and create the report.','The selected period is preserved and the report remains honest about evidence maturity.'),
    (v_pilot_id,'ACCESS_FAILURE_TEST',10,'Access and failure test','Verify site isolation, role isolation and graceful error behaviour.','The manager cannot access another site, another portal or raw private data.')
  on conflict (pilot_id, scenario_key) do nothing;

  return v_pilot_id;
end;
$function$;

revoke all on function private.vorta_ensure_pilot_program(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.vorta_get_pilot_setup_core(
  p_site_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_pilot_id uuid;
  v_program private.vorta_pilot_programs%rowtype;
  v_site_name text;
  v_site_region text;
  v_site_timezone text;
  v_value_report jsonb;
  v_equipment_count integer := 0;
  v_work_order_count integer := 0;
  v_pm_count integer := 0;
  v_calibration_count integer := 0;
  v_material_count integer := 0;
  v_manager_access_count integer := 0;
  v_engineer_count integer := 0;
  v_validated_skill_count integer := 0;
  v_snapshot_count integer := 0;
  v_automated_checks jsonb := '[]'::jsonb;
  v_manual_checks jsonb := '[]'::jsonb;
  v_scenarios jsonb := '[]'::jsonb;
  v_weekly_reviews jsonb := '[]'::jsonb;
  v_total_units numeric := 0;
  v_earned_units numeric := 0;
  v_readiness_score numeric := 0;
  v_automated_blockers integer := 0;
  v_manual_blockers integer := 0;
  v_rehearsal_blockers integer := 0;
  v_launch_eligible boolean := false;
  v_rehearsal_complete boolean := false;
  v_recommended_next_action text;
  v_completed_scenarios integer := 0;
  v_total_scenarios integer := 0;
  v_clean_passes integer := 0;
begin
  v_pilot_id := private.vorta_ensure_pilot_program(p_site_id, p_actor_user_id);
  select * into v_program
  from private.vorta_pilot_programs
  where id = v_pilot_id;

  select site.name, site.region, site.timezone
  into v_site_name, v_site_region, v_site_timezone
  from public.sites site
  where site.id = p_site_id;

  select count(*)::integer into v_equipment_count
  from public.equipment_assets where site_id = p_site_id;

  select count(*)::integer into v_work_order_count
  from public.work_orders where site_id = p_site_id;

  select
    count(*) filter (
      where lower(coalesce(pm_type, '')) <> 'calibration'
        and calibration_point is null
    )::integer,
    count(*) filter (
      where lower(coalesce(pm_type, '')) = 'calibration'
        or calibration_point is not null
    )::integer
  into v_pm_count, v_calibration_count
  from public.preventive_maintenance
  where site_id = p_site_id;

  select count(*)::integer into v_material_count
  from public.site_material_stock where site_id = p_site_id;

  select count(*)::integer into v_manager_access_count
  from public.user_site_access access_row
  where access_row.site_id = p_site_id
    and access_row.active
    and lower(replace(replace(access_row.app_role, '-', '_'), ' ', '_')) = 'maintenance_manager';

  select count(*)::integer into v_engineer_count
  from public.engineers
  where site_id = p_site_id and verified;

  select count(*)::integer into v_validated_skill_count
  from public.engineer_skills engineer_skill
  join public.engineers engineer on engineer.id = engineer_skill.engineer_id
  where engineer.site_id = p_site_id
    and engineer_skill.verification_status = 'validated';

  select count(distinct snapshot.snapshot_date)::integer into v_snapshot_count
  from private.vorta_capability_risk_snapshots snapshot
  where snapshot.site_id = p_site_id;

  v_value_report := public.vorta_get_pilot_value_report(p_site_id, null, current_date);

  v_automated_checks := jsonb_build_array(
    jsonb_build_object(
      'key','PILOT_DATES_SET','stage','SITE_SETUP','label','Pilot dates set','blocking',true,
      'status',case when v_program.planned_start_date is not null and v_program.planned_end_date is not null then 'pass' else 'pending' end,
      'evidence',case when v_program.planned_start_date is not null and v_program.planned_end_date is not null then format('%s to %s',v_program.planned_start_date,v_program.planned_end_date) else 'Add the planned pilot start and end dates.' end
    ),
    jsonb_build_object(
      'key','PILOT_OBJECTIVE_SET','stage','SITE_SETUP','label','Pilot objective set','blocking',true,
      'status',case when nullif(trim(coalesce(v_program.objective,'')),'') is not null then 'pass' else 'pending' end,
      'evidence',case when nullif(trim(coalesce(v_program.objective,'')),'') is not null then 'A pilot objective is recorded.' else 'Define the operational problem this pilot must prove.' end
    ),
    jsonb_build_object(
      'key','MANAGER_ACCESS_READY','stage','USER_READINESS','label','Maintenance Manager access ready','blocking',true,
      'status',case when v_manager_access_count > 0 then 'pass' else 'fail' end,
      'evidence',format('%s active Maintenance Manager site access record%s.',v_manager_access_count,case when v_manager_access_count = 1 then '' else 's' end)
    ),
    jsonb_build_object(
      'key','EQUIPMENT_LOADED','stage','DATA_READINESS','label','Equipment hierarchy loaded','blocking',true,
      'status',case when v_equipment_count > 0 then 'pass' else 'fail' end,
      'evidence',format('%s equipment asset%s loaded.',v_equipment_count,case when v_equipment_count = 1 then '' else 's' end)
    ),
    jsonb_build_object(
      'key','WORK_ORDERS_LOADED','stage','DATA_READINESS','label','Work orders loaded','blocking',true,
      'status',case when v_work_order_count > 0 then 'pass' else 'fail' end,
      'evidence',format('%s work order%s loaded.',v_work_order_count,case when v_work_order_count = 1 then '' else 's' end)
    ),
    jsonb_build_object(
      'key','CONFIRMATION_TEXT_COMPLETE','stage','DATA_READINESS','label','Confirmation text complete','blocking',true,
      'status',case
        when coalesce((v_value_report #>> '{maintenanceData,currentDataset,completedOrders}')::integer,0) = 0 then 'fail'
        when coalesce((v_value_report #>> '{maintenanceData,currentDataset,confirmationCompletenessPct}')::numeric,0) >= 95 then 'pass'
        when coalesce((v_value_report #>> '{maintenanceData,currentDataset,confirmationCompletenessPct}')::numeric,0) >= 80 then 'warning'
        else 'fail'
      end,
      'evidence',format('%s of %s completed orders contain confirmation text (%s%%).',
        coalesce(v_value_report #>> '{maintenanceData,currentDataset,ordersWithConfirmationText}','0'),
        coalesce(v_value_report #>> '{maintenanceData,currentDataset,completedOrders}','0'),
        coalesce(v_value_report #>> '{maintenanceData,currentDataset,confirmationCompletenessPct}','0'))
    ),
    jsonb_build_object(
      'key','PM_DATA_LOADED','stage','DATA_READINESS','label','Preventive maintenance loaded','blocking',true,
      'status',case when v_pm_count > 0 then 'pass' else 'fail' end,
      'evidence',format('%s preventive maintenance item%s loaded.',v_pm_count,case when v_pm_count = 1 then '' else 's' end)
    ),
    jsonb_build_object(
      'key','CALIBRATION_DATA_LOADED','stage','DATA_READINESS','label','Calibrations loaded','blocking',true,
      'status',case when v_calibration_count > 0 then 'pass' else 'fail' end,
      'evidence',format('%s calibration item%s loaded.',v_calibration_count,case when v_calibration_count = 1 then '' else 's' end)
    ),
    jsonb_build_object(
      'key','MATERIAL_STOCK_LOADED','stage','DATA_READINESS','label','Parts and stock loaded','blocking',true,
      'status',case when v_material_count > 0 then 'pass' else 'fail' end,
      'evidence',format('%s site material stock row%s loaded.',v_material_count,case when v_material_count = 1 then '' else 's' end)
    ),
    jsonb_build_object(
      'key','GOODS_MOVEMENT_LINKED','stage','DATA_READINESS','label','Goods movements linked','blocking',true,
      'status',case
        when coalesce((v_value_report #>> '{maintenanceData,currentDataset,completedOrdersWithMaterialReservations}')::integer,0) = 0 then 'warning'
        when coalesce((v_value_report #>> '{maintenanceData,currentDataset,goodsMovementCompletenessPct}')::numeric,0) >= 95 then 'pass'
        else 'fail'
      end,
      'evidence',format('%s of %s completed material-linked orders have goods movements (%s%%).',
        coalesce(v_value_report #>> '{maintenanceData,currentDataset,materialOrdersWithGoodsMovement}','0'),
        coalesce(v_value_report #>> '{maintenanceData,currentDataset,completedOrdersWithMaterialReservations}','0'),
        coalesce(v_value_report #>> '{maintenanceData,currentDataset,goodsMovementCompletenessPct}','No sample'))
    ),
    jsonb_build_object(
      'key','SKILLS_ENGINEERS_MAPPED','stage','DATA_READINESS','label','Engineers and skills mapped','blocking',true,
      'status',case when v_engineer_count > 0 and v_validated_skill_count > 0 then 'pass' else 'fail' end,
      'evidence',format('%s verified engineers and %s validated skill records.',v_engineer_count,v_validated_skill_count)
    ),
    jsonb_build_object(
      'key','DOCUMENTS_READY','stage','DATA_READINESS','label','Documents linked and usable','blocking',true,
      'status',case
        when coalesce((v_value_report #>> '{knowledgeCoverage,currentDocuments}')::integer,0) = 0 then 'fail'
        when coalesce((v_value_report #>> '{knowledgeCoverage,documentUsabilityPct}')::numeric,0) >= 90 then 'pass'
        else 'warning'
      end,
      'evidence',format('%s current documents; %s%% usable; %s%% equipment coverage.',
        coalesce(v_value_report #>> '{knowledgeCoverage,currentDocuments}','0'),
        coalesce(v_value_report #>> '{knowledgeCoverage,documentUsabilityPct}','0'),
        coalesce(v_value_report #>> '{knowledgeCoverage,equipmentDocumentCoveragePct}','0'))
    ),
    jsonb_build_object(
      'key','BASELINE_CAPTURED','stage','DATA_READINESS','label','Baseline risk snapshot captured','blocking',true,
      'status',case when v_snapshot_count > 0 then 'pass' else 'fail' end,
      'evidence',format('%s distinct daily capability-risk snapshot%s.',v_snapshot_count,case when v_snapshot_count = 1 then '' else 's' end)
    ),
    jsonb_build_object(
      'key','BACKEND_HEALTH_READY','stage','DATA_READINESS','label','Backend readiness suite passed','blocking',true,
      'status',case
        when coalesce(v_value_report #>> '{backendReliability,latestStatus}','') = 'pass'
          and coalesce((v_value_report #>> '{backendReliability,latestFailedChecks}')::integer,0) = 0
        then 'pass'
        else 'fail'
      end,
      'evidence',format('Suite %s: %s passed, %s failed, %s warnings.',
        coalesce(v_value_report #>> '{backendReliability,currentSuiteVersion}','Not run'),
        coalesce(v_value_report #>> '{backendReliability,latestPassedChecks}','0'),
        coalesce(v_value_report #>> '{backendReliability,latestFailedChecks}','0'),
        coalesce(v_value_report #>> '{backendReliability,latestWarnings}','0'))
    )
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key',manual_check.item_key,
        'stage',manual_check.stage,
        'label',manual_check.label,
        'description',manual_check.description,
        'blocking',manual_check.blocking,
        'status',manual_check.status,
        'evidence',manual_check.evidence,
        'checkedAt',manual_check.checked_at,
        'checkedBy',manual_check.checked_by
      )
      order by case manual_check.stage
        when 'SITE_SETUP' then 1
        when 'USER_READINESS' then 2
        else 3
      end, manual_check.created_at
    ),
    '[]'::jsonb
  )
  into v_manual_checks
  from private.vorta_pilot_manual_checks manual_check
  where manual_check.pilot_id = v_pilot_id;

  with scenario_progress as (
    select
      scenario.id,
      scenario.scenario_key,
      scenario.scenario_order,
      scenario.title,
      scenario.objective,
      scenario.expected_outcome,
      scenario.required_clean_passes,
      scenario.blocking,
      count(attempt.id)::integer as attempts,
      count(attempt.id) filter (
        where attempt.result = 'pass' and not attempt.intervention_required
      )::integer as clean_passes,
      count(attempt.id) filter (where attempt.result = 'fail')::integer as failures,
      count(attempt.id) filter (where attempt.result = 'blocked')::integer as blocked_attempts,
      max(attempt.recorded_at) as last_attempt_at,
      (array_agg(attempt.result order by attempt.recorded_at desc) filter (where attempt.id is not null))[1] as latest_result,
      (array_agg(attempt.notes order by attempt.recorded_at desc) filter (where attempt.id is not null))[1] as latest_notes,
      (array_agg(attempt.evidence order by attempt.recorded_at desc) filter (where attempt.id is not null))[1] as latest_evidence,
      (array_agg(attempt.issue_reference order by attempt.recorded_at desc) filter (where attempt.id is not null))[1] as latest_issue_reference
    from private.vorta_pilot_rehearsal_scenarios scenario
    left join private.vorta_pilot_rehearsal_attempts attempt
      on attempt.scenario_id = scenario.id
    where scenario.pilot_id = v_pilot_id
    group by scenario.id
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key',progress.scenario_key,
          'order',progress.scenario_order,
          'title',progress.title,
          'objective',progress.objective,
          'expectedOutcome',progress.expected_outcome,
          'requiredCleanPasses',progress.required_clean_passes,
          'blocking',progress.blocking,
          'attempts',progress.attempts,
          'cleanPasses',progress.clean_passes,
          'failures',progress.failures,
          'blockedAttempts',progress.blocked_attempts,
          'complete',progress.clean_passes >= progress.required_clean_passes,
          'latestResult',progress.latest_result,
          'latestNotes',progress.latest_notes,
          'latestEvidence',progress.latest_evidence,
          'latestIssueReference',progress.latest_issue_reference,
          'lastAttemptAt',progress.last_attempt_at
        ) order by progress.scenario_order
      ),
      '[]'::jsonb
    ),
    count(*)::integer,
    count(*) filter (
      where progress.clean_passes >= progress.required_clean_passes
    )::integer,
    coalesce(sum(progress.clean_passes),0)::integer,
    count(*) filter (
      where progress.blocking
        and progress.clean_passes < progress.required_clean_passes
    )::integer
  into
    v_scenarios,
    v_total_scenarios,
    v_completed_scenarios,
    v_clean_passes,
    v_rehearsal_blockers
  from scenario_progress progress;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'weekNumber',review.week_number,
        'periodStart',review.period_start,
        'periodEnd',review.period_end,
        'status',review.status,
        'managerValueScore',review.manager_value_score,
        'dataAccuracyPercent',review.data_accuracy_percent,
        'estimatedTimeSavedMinutes',review.estimated_time_saved_minutes,
        'risksIdentified',review.risks_identified,
        'followThroughActions',review.follow_through_actions,
        'summary',review.summary,
        'blockers',review.blockers,
        'nextActions',review.next_actions,
        'completedAt',review.completed_at
      ) order by review.week_number
    ),
    '[]'::jsonb
  )
  into v_weekly_reviews
  from private.vorta_pilot_weekly_reviews review
  where review.pilot_id = v_pilot_id;

  select
    count(*) filter (
      where check_value ->> 'blocking' = 'true'
        and check_value ->> 'status' <> 'pass'
    )::integer,
    coalesce(sum(case check_value ->> 'status'
      when 'pass' then 1
      when 'warning' then 0.5
      else 0
    end),0),
    count(*)::numeric
  into v_automated_blockers, v_earned_units, v_total_units
  from jsonb_array_elements(v_automated_checks) check_value;

  select
    count(*) filter (
      where check_value ->> 'blocking' = 'true'
        and check_value ->> 'status' <> 'pass'
    )::integer,
    v_earned_units + coalesce(sum(case check_value ->> 'status'
      when 'pass' then 1
      when 'not_applicable' then 1
      when 'warning' then 0.5
      else 0
    end),0),
    v_total_units + count(*)::numeric
  into v_manual_blockers, v_earned_units, v_total_units
  from jsonb_array_elements(v_manual_checks) check_value;

  v_earned_units := v_earned_units + v_completed_scenarios;
  v_total_units := v_total_units + v_total_scenarios;
  v_readiness_score := case
    when v_total_units = 0 then 0
    else round(v_earned_units * 100.0 / v_total_units,1)
  end;
  v_rehearsal_complete := v_total_scenarios > 0
    and v_completed_scenarios = v_total_scenarios;
  v_launch_eligible := v_automated_blockers = 0
    and v_manual_blockers = 0
    and v_rehearsal_blockers = 0
    and v_rehearsal_complete;

  v_recommended_next_action := case
    when v_automated_blockers > 0 then 'Resolve the blocking configuration or data-readiness checks.'
    when v_manual_blockers > 0 then 'Complete the remaining manual readiness confirmations.'
    when v_rehearsal_blockers > 0 then 'Complete two clean passes for every rehearsal scenario.'
    when v_program.status in ('DRAFT','DATA_PREPARATION','REHEARSAL','READY')
      and v_launch_eligible then 'The pilot is ready to launch.'
    when v_program.status = 'LIVE' then 'Run the first session and complete the next weekly pilot review.'
    when v_program.status = 'PAUSED' then 'Resolve the pause reason before resuming the pilot.'
    when v_program.status = 'COMPLETED' then 'Review the final evidence and commercial next step.'
    else 'Review the current pilot stage.'
  end;

  if v_program.baseline_snapshot_date is null and v_snapshot_count > 0 then
    select min(snapshot.snapshot_date)
    into v_program.baseline_snapshot_date
    from private.vorta_capability_risk_snapshots snapshot
    where snapshot.site_id = p_site_id;

    update private.vorta_pilot_programs
    set baseline_snapshot_date = v_program.baseline_snapshot_date,
        updated_at = now(),
        updated_by = p_actor_user_id
    where id = v_pilot_id;
  end if;

  if v_program.status not in ('LIVE','PAUSED','COMPLETED') then
    update private.vorta_pilot_programs
    set status = case
          when v_launch_eligible then 'READY'
          when v_completed_scenarios > 0 then 'REHEARSAL'
          when v_automated_blockers = 0 then 'REHEARSAL'
          when nullif(trim(coalesce(v_program.objective,'')),'') is not null then 'DATA_PREPARATION'
          else 'DRAFT'
        end,
        updated_at = now(),
        updated_by = p_actor_user_id
    where id = v_pilot_id
    returning * into v_program;
  end if;

  return jsonb_build_object(
    'reportVersion','1.0.0',
    'generatedAt',now(),
    'site',jsonb_build_object(
      'id',p_site_id,
      'name',v_site_name,
      'region',v_site_region,
      'timezone',coalesce(nullif(v_site_timezone,''),'UTC')
    ),
    'pilot',jsonb_build_object(
      'id',v_program.id,
      'status',v_program.status,
      'objective',v_program.objective,
      'plannedStartDate',v_program.planned_start_date,
      'plannedEndDate',v_program.planned_end_date,
      'actualStartAt',v_program.actual_start_at,
      'actualEndAt',v_program.actual_end_at,
      'knownLimitations',v_program.known_limitations,
      'successCriteria',v_program.success_criteria,
      'baselineSnapshotDate',v_program.baseline_snapshot_date,
      'pilotOwnerUserId',v_program.pilot_owner_user_id,
      'managerContactUserId',v_program.manager_contact_user_id,
      'launchConfirmedAt',v_program.launch_confirmed_at
    ),
    'readiness',jsonb_build_object(
      'score',v_readiness_score,
      'launchEligible',v_launch_eligible,
      'automatedBlockers',v_automated_blockers,
      'manualBlockers',v_manual_blockers,
      'rehearsalBlockers',v_rehearsal_blockers,
      'recommendedNextAction',v_recommended_next_action,
      'automatedChecks',v_automated_checks,
      'manualChecks',v_manual_checks
    ),
    'rehearsal',jsonb_build_object(
      'complete',v_rehearsal_complete,
      'totalScenarios',v_total_scenarios,
      'completedScenarios',v_completed_scenarios,
      'cleanPasses',v_clean_passes,
      'scenarios',v_scenarios
    ),
    'weeklyReviews',v_weekly_reviews
  );
end;
$function$;

revoke all on function private.vorta_get_pilot_setup_core(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.vorta_get_pilot_setup(p_site_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor_user_id uuid := auth.uid();
begin
  if v_actor_user_id is null or not public.vorta_can_manage_site(p_site_id) then
    return null;
  end if;
  return private.vorta_get_pilot_setup_core(p_site_id, v_actor_user_id);
end;
$function$;

create or replace function public.vorta_update_pilot_configuration(
  p_site_id uuid,
  p_objective text,
  p_planned_start_date date,
  p_planned_end_date date,
  p_known_limitations text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_pilot_id uuid;
begin
  if v_actor_user_id is null or not public.vorta_can_manage_site(p_site_id) then
    return null;
  end if;
  if p_planned_start_date is not null
    and p_planned_end_date is not null
    and p_planned_end_date < p_planned_start_date then
    raise exception 'Pilot end date must be on or after the start date.';
  end if;
  if length(coalesce(p_objective,'')) > 2000 then
    raise exception 'Pilot objective must be 2000 characters or fewer.';
  end if;
  if length(coalesce(p_known_limitations,'')) > 5000 then
    raise exception 'Known limitations must be 5000 characters or fewer.';
  end if;

  v_pilot_id := private.vorta_ensure_pilot_program(p_site_id, v_actor_user_id);
  update private.vorta_pilot_programs
  set objective = nullif(trim(coalesce(p_objective,'')),''),
      planned_start_date = p_planned_start_date,
      planned_end_date = p_planned_end_date,
      known_limitations = nullif(trim(coalesce(p_known_limitations,'')),''),
      pilot_owner_user_id = coalesce(pilot_owner_user_id, v_actor_user_id),
      manager_contact_user_id = coalesce(manager_contact_user_id, v_actor_user_id),
      updated_by = v_actor_user_id,
      updated_at = now()
  where id = v_pilot_id;

  return private.vorta_get_pilot_setup_core(p_site_id, v_actor_user_id);
end;
$function$;

create or replace function public.vorta_update_pilot_manual_check(
  p_site_id uuid,
  p_item_key text,
  p_status text,
  p_evidence text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_pilot_id uuid;
  v_status text := lower(trim(coalesce(p_status,'')));
begin
  if v_actor_user_id is null or not public.vorta_can_manage_site(p_site_id) then
    return null;
  end if;
  if v_status <> all(array['pending','pass','warning','fail','not_applicable']::text[]) then
    raise exception 'Invalid manual check status.';
  end if;
  if length(coalesce(p_evidence,'')) > 2000 then
    raise exception 'Manual-check evidence must be 2000 characters or fewer.';
  end if;

  v_pilot_id := private.vorta_ensure_pilot_program(p_site_id, v_actor_user_id);
  update private.vorta_pilot_manual_checks
  set status = v_status,
      evidence = nullif(trim(coalesce(p_evidence,'')),''),
      checked_at = case when v_status = 'pending' then null else now() end,
      checked_by = case when v_status = 'pending' then null else v_actor_user_id end,
      updated_at = now()
  where pilot_id = v_pilot_id
    and item_key = upper(trim(coalesce(p_item_key,'')));

  if not found then
    raise exception 'Unknown pilot readiness item.';
  end if;
  return private.vorta_get_pilot_setup_core(p_site_id, v_actor_user_id);
end;
$function$;

create or replace function public.vorta_record_pilot_rehearsal_attempt(
  p_site_id uuid,
  p_scenario_key text,
  p_result text,
  p_duration_minutes integer default null,
  p_intervention_required boolean default false,
  p_notes text default null,
  p_evidence text default null,
  p_issue_reference text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_pilot_id uuid;
  v_scenario_id uuid;
  v_result text := lower(trim(coalesce(p_result,'')));
begin
  if v_actor_user_id is null or not public.vorta_can_manage_site(p_site_id) then
    return null;
  end if;
  if v_result <> all(array['pass','fail','blocked']::text[]) then
    raise exception 'Invalid rehearsal result.';
  end if;
  if p_duration_minutes is not null
    and (p_duration_minutes < 0 or p_duration_minutes > 1440) then
    raise exception 'Rehearsal duration must be between 0 and 1440 minutes.';
  end if;
  if length(coalesce(p_notes,'')) > 3000
    or length(coalesce(p_evidence,'')) > 2000
    or length(coalesce(p_issue_reference,'')) > 500 then
    raise exception 'Rehearsal evidence exceeds the allowed length.';
  end if;

  v_pilot_id := private.vorta_ensure_pilot_program(p_site_id, v_actor_user_id);
  select scenario.id into v_scenario_id
  from private.vorta_pilot_rehearsal_scenarios scenario
  where scenario.pilot_id = v_pilot_id
    and scenario.scenario_key = upper(trim(coalesce(p_scenario_key,'')));

  if v_scenario_id is null then
    raise exception 'Unknown rehearsal scenario.';
  end if;

  insert into private.vorta_pilot_rehearsal_attempts (
    pilot_id,
    scenario_id,
    result,
    duration_minutes,
    intervention_required,
    notes,
    evidence,
    issue_reference,
    recorded_by
  ) values (
    v_pilot_id,
    v_scenario_id,
    v_result,
    p_duration_minutes,
    coalesce(p_intervention_required,false),
    nullif(trim(coalesce(p_notes,'')),''),
    nullif(trim(coalesce(p_evidence,'')),''),
    nullif(trim(coalesce(p_issue_reference,'')),''),
    v_actor_user_id
  );

  return private.vorta_get_pilot_setup_core(p_site_id, v_actor_user_id);
end;
$function$;

create or replace function public.vorta_upsert_pilot_weekly_review(
  p_site_id uuid,
  p_week_number integer,
  p_period_start date,
  p_period_end date,
  p_status text default 'draft',
  p_manager_value_score numeric default null,
  p_data_accuracy_percent numeric default null,
  p_estimated_time_saved_minutes integer default null,
  p_risks_identified integer default 0,
  p_follow_through_actions integer default 0,
  p_summary text default null,
  p_blockers text default null,
  p_next_actions text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_pilot_id uuid;
  v_status text := lower(trim(coalesce(p_status,'draft')));
begin
  if v_actor_user_id is null or not public.vorta_can_manage_site(p_site_id) then
    return null;
  end if;
  if p_week_number < 0 or p_week_number > 52 then
    raise exception 'Week number must be between 0 and 52.';
  end if;
  if p_period_end < p_period_start then
    raise exception 'Weekly review end date must be on or after the start date.';
  end if;
  if v_status <> all(array['draft','complete']::text[]) then
    raise exception 'Invalid weekly review status.';
  end if;
  if p_manager_value_score is not null
    and (p_manager_value_score < 0 or p_manager_value_score > 10) then
    raise exception 'Manager value score must be between 0 and 10.';
  end if;
  if p_data_accuracy_percent is not null
    and (p_data_accuracy_percent < 0 or p_data_accuracy_percent > 100) then
    raise exception 'Data accuracy must be between 0 and 100.';
  end if;
  if coalesce(p_estimated_time_saved_minutes,0) < 0
    or coalesce(p_risks_identified,0) < 0
    or coalesce(p_follow_through_actions,0) < 0 then
    raise exception 'Weekly review counts cannot be negative.';
  end if;
  if length(coalesce(p_summary,'')) > 5000
    or length(coalesce(p_blockers,'')) > 3000
    or length(coalesce(p_next_actions,'')) > 3000 then
    raise exception 'Weekly review text exceeds the allowed length.';
  end if;

  v_pilot_id := private.vorta_ensure_pilot_program(p_site_id, v_actor_user_id);
  insert into private.vorta_pilot_weekly_reviews (
    pilot_id,
    week_number,
    period_start,
    period_end,
    status,
    manager_value_score,
    data_accuracy_percent,
    estimated_time_saved_minutes,
    risks_identified,
    follow_through_actions,
    summary,
    blockers,
    next_actions,
    completed_at,
    completed_by,
    created_by,
    updated_by
  ) values (
    v_pilot_id,
    p_week_number,
    p_period_start,
    p_period_end,
    v_status,
    p_manager_value_score,
    p_data_accuracy_percent,
    p_estimated_time_saved_minutes,
    coalesce(p_risks_identified,0),
    coalesce(p_follow_through_actions,0),
    nullif(trim(coalesce(p_summary,'')),''),
    nullif(trim(coalesce(p_blockers,'')),''),
    nullif(trim(coalesce(p_next_actions,'')),''),
    case when v_status = 'complete' then now() else null end,
    case when v_status = 'complete' then v_actor_user_id else null end,
    v_actor_user_id,
    v_actor_user_id
  )
  on conflict (pilot_id, week_number) do update set
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    status = excluded.status,
    manager_value_score = excluded.manager_value_score,
    data_accuracy_percent = excluded.data_accuracy_percent,
    estimated_time_saved_minutes = excluded.estimated_time_saved_minutes,
    risks_identified = excluded.risks_identified,
    follow_through_actions = excluded.follow_through_actions,
    summary = excluded.summary,
    blockers = excluded.blockers,
    next_actions = excluded.next_actions,
    completed_at = case
      when excluded.status = 'complete'
        then coalesce(private.vorta_pilot_weekly_reviews.completed_at,now())
      else null
    end,
    completed_by = case
      when excluded.status = 'complete' then v_actor_user_id
      else null
    end,
    updated_by = v_actor_user_id,
    updated_at = now();

  return private.vorta_get_pilot_setup_core(p_site_id, v_actor_user_id);
end;
$function$;

create or replace function public.vorta_launch_pilot(p_site_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_pilot_id uuid;
  v_report jsonb;
begin
  if v_actor_user_id is null or not public.vorta_can_manage_site(p_site_id) then
    return null;
  end if;

  v_pilot_id := private.vorta_ensure_pilot_program(p_site_id, v_actor_user_id);
  v_report := private.vorta_get_pilot_setup_core(p_site_id, v_actor_user_id);
  if coalesce((v_report #>> '{readiness,launchEligible}')::boolean,false) is not true then
    raise exception 'Pilot launch is blocked until every required readiness gate and rehearsal scenario passes.';
  end if;

  update private.vorta_pilot_programs
  set status = 'LIVE',
      actual_start_at = coalesce(actual_start_at,now()),
      launch_confirmed_by = v_actor_user_id,
      launch_confirmed_at = now(),
      updated_by = v_actor_user_id,
      updated_at = now()
  where id = v_pilot_id;

  return private.vorta_get_pilot_setup_core(p_site_id, v_actor_user_id);
end;
$function$;

revoke all on function public.vorta_get_pilot_setup(uuid) from public, anon;
revoke all on function public.vorta_update_pilot_configuration(uuid,text,date,date,text) from public, anon;
revoke all on function public.vorta_update_pilot_manual_check(uuid,text,text,text) from public, anon;
revoke all on function public.vorta_record_pilot_rehearsal_attempt(uuid,text,text,integer,boolean,text,text,text) from public, anon;
revoke all on function public.vorta_upsert_pilot_weekly_review(uuid,integer,date,date,text,numeric,numeric,integer,integer,integer,text,text,text) from public, anon;
revoke all on function public.vorta_launch_pilot(uuid) from public, anon;

grant execute on function public.vorta_get_pilot_setup(uuid) to authenticated;
grant execute on function public.vorta_update_pilot_configuration(uuid,text,date,date,text) to authenticated;
grant execute on function public.vorta_update_pilot_manual_check(uuid,text,text,text) to authenticated;
grant execute on function public.vorta_record_pilot_rehearsal_attempt(uuid,text,text,integer,boolean,text,text,text) to authenticated;
grant execute on function public.vorta_upsert_pilot_weekly_review(uuid,integer,date,date,text,numeric,numeric,integer,integer,integer,text,text,text) to authenticated;
grant execute on function public.vorta_launch_pilot(uuid) to authenticated;

comment on table private.vorta_pilot_programs is
  'Internal pilot configuration and lifecycle state for a site-scoped Vorta pilot.';
comment on table private.vorta_pilot_manual_checks is
  'Manager-confirmed pilot readiness checks that cannot be derived reliably from source data.';
comment on table private.vorta_pilot_rehearsal_scenarios is
  'Canonical pilot rehearsal scenarios required before launch.';
comment on table private.vorta_pilot_rehearsal_attempts is
  'Append-only evidence of pilot rehearsal attempts, including intervention and issue context.';
comment on table private.vorta_pilot_weekly_reviews is
  'Structured weekly pilot reviews for adoption, data quality, time saving, blockers and next actions.';
comment on function public.vorta_get_pilot_setup(uuid) is
  'Returns and initialises manager-scoped pilot setup, readiness, rehearsal and weekly review evidence.';
comment on function public.vorta_launch_pilot(uuid) is
  'Moves a site pilot to LIVE only when every blocking readiness and rehearsal requirement passes.';
