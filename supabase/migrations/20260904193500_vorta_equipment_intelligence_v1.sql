-- Vorta Equipment Intelligence v1
-- Separates self-assessment, authorised competency, evidence depth and workforce resilience.

create table if not exists public.engineer_equipment_experience_snapshots (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  engineer_id uuid not null references public.engineers(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  experience_type text not null,
  confirmed_order_count integer not null default 0,
  confirmation_line_count integer not null default 0,
  unique_task_count integer not null default 0,
  final_confirmation_count integer not null default 0,
  confirmation_text_count integer not null default 0,
  total_actual_work numeric not null default 0,
  work_unit text,
  depth_score numeric(5,2) not null default 0,
  breadth_score numeric(5,2) not null default 0,
  experience_score numeric(5,2) not null default 0,
  first_completed_at date,
  last_completed_at date,
  evidence_quality text not null default 'partial',
  recency_status text not null default 'unknown',
  recency_factor numeric(5,4) not null default 0,
  source_systems text[] not null default '{}',
  source_updated_at timestamptz,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, engineer_id, equipment_id, experience_type)
);

create index if not exists engineer_equipment_experience_lookup_idx
  on public.engineer_equipment_experience_snapshots(site_id, engineer_id, equipment_id);
create index if not exists engineer_equipment_experience_type_idx
  on public.engineer_equipment_experience_snapshots(equipment_id, experience_type, experience_score desc);
alter table public.engineer_equipment_experience_snapshots enable row level security;

create table if not exists public.engineer_equipment_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  engineer_id uuid not null references public.engineers(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  score_version text not null default 'vorta-equipment-v1',
  vorta_score numeric(5,2) not null default 0,
  score_status text not null,
  evidence_confidence text not null,
  confidence_score numeric(5,2) not null default 0,
  evidence_coverage_pct numeric(5,2) not null default 0,
  skill_score numeric(5,2),
  training_score numeric(5,2),
  corrective_score numeric(5,2),
  pm_score numeric(5,2),
  calibration_score numeric(5,2),
  skill_authority_factor numeric(5,4),
  required_skill_count integer not null default 0,
  completed_training_skill_count integer not null default 0,
  mapped_training_skill_count integer not null default 0,
  corrective_order_count integer not null default 0,
  pm_order_count integer not null default 0,
  calibration_order_count integer not null default 0,
  latest_evidence_at date,
  component_detail jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, engineer_id, equipment_id, score_version)
);

create index if not exists engineer_equipment_score_engineer_idx
  on public.engineer_equipment_score_snapshots(site_id, engineer_id, vorta_score desc);
create index if not exists engineer_equipment_score_equipment_idx
  on public.engineer_equipment_score_snapshots(site_id, equipment_id, vorta_score desc);
alter table public.engineer_equipment_score_snapshots enable row level security;

create table if not exists public.equipment_competency_assessments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  engineer_id uuid not null references public.engineers(id) on delete cascade,
  assessor_profile_id uuid references public.profiles(id) on delete set null,
  assessor_engineer_id uuid references public.engineers(id) on delete set null,
  assessment_level integer not null check (assessment_level between 1 and 5),
  assessment_status text not null default 'validated',
  assessor_authority text not null,
  evidence_reference text,
  notes text,
  supersedes_assessment_id uuid references public.equipment_competency_assessments(id) on delete set null,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists equipment_competency_assessment_history_idx
  on public.equipment_competency_assessments(equipment_id, engineer_id, assessed_at desc);
alter table public.equipment_competency_assessments enable row level security;

alter table public.equipment_engineer_capabilities
  add column if not exists verified_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists verified_by_engineer_id uuid references public.engineers(id) on delete set null,
  add column if not exists verified_at timestamptz;

create or replace function public.vorta_refresh_engineer_equipment_experience(p_site_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_count integer := 0;
begin
  delete from public.engineer_equipment_experience_snapshots snapshot
  where p_site_id is null or snapshot.site_id = p_site_id;

  with mapped_lines as (
    select confirmation.site_id, identity.engineer_id, work_order.equipment_id,
      work_order.id as work_order_id, work_order.preventive_maintenance_id,
      lower(coalesce(work_order.work_type, 'maintenance')) as raw_work_type,
      work_order.order_type_description, work_order.maintenance_activity_type_code,
      work_order.maintenance_activity_type_description, work_order.fault_code,
      coalesce(confirmation.posting_date, confirmation.confirmation_timestamp::date, work_order.completed_date) as evidence_date,
      confirmation.final_confirmation,
      nullif(btrim(confirmation.confirmation_text), '') is not null as has_confirmation_text,
      greatest(coalesce(confirmation.actual_work, 0), 0) as actual_work,
      nullif(btrim(confirmation.work_unit), '') as work_unit,
      confirmation.source_system, confirmation.updated_at
    from public.work_order_confirmations confirmation
    join public.work_orders work_order on work_order.id = confirmation.work_order_id and work_order.site_id = confirmation.site_id
    join public.engineer_source_identities identity
      on identity.site_id = confirmation.site_id
      and identity.source_system = 'SAP'
      and identity.identity_type = 'personnel_number'
      and identity.source_identity = upper(btrim(confirmation.personnel_number))
      and identity.mapping_status = 'verified'
      and (identity.valid_from is null or coalesce(confirmation.posting_date, confirmation.confirmation_timestamp::date, current_date) >= identity.valid_from)
      and (identity.valid_until is null or coalesce(confirmation.posting_date, confirmation.confirmation_timestamp::date, current_date) <= identity.valid_until)
    where confirmation.reversal = false
      and confirmation.personnel_number is not null
      and work_order.equipment_id is not null
      and (p_site_id is null or confirmation.site_id = p_site_id)
  ), normalised as (
    select *, case
      when raw_work_type like '%calibr%' or lower(coalesce(order_type_description, '')) like '%calibr%' or lower(coalesce(maintenance_activity_type_description, '')) like '%calibr%' then 'calibration'
      when raw_work_type in ('corrective', 'diagnostic') or lower(coalesce(order_type_description, '')) like '%corrective%' then 'corrective'
      when raw_work_type = 'preventive' or lower(coalesce(order_type_description, '')) like '%preventive%' then 'preventive'
      when raw_work_type = 'inspection' then 'inspection'
      when raw_work_type = 'predictive' then 'predictive'
      else raw_work_type end as experience_type
    from mapped_lines
  ), events as (
    select site_id, engineer_id, equipment_id, experience_type, work_order_id, preventive_maintenance_id,
      fault_code, maintenance_activity_type_code, min(evidence_date) as evidence_date,
      count(*)::integer as line_count, bool_or(final_confirmation) as has_final_confirmation,
      bool_or(has_confirmation_text) as has_confirmation_text, sum(actual_work) as actual_work,
      case when count(distinct work_unit) filter (where work_unit is not null) = 1 then max(work_unit) else null end as work_unit,
      array_agg(distinct source_system order by source_system) as source_systems, max(updated_at) as source_updated_at
    from normalised
    group by site_id, engineer_id, equipment_id, experience_type, work_order_id, preventive_maintenance_id, fault_code, maintenance_activity_type_code
  ), aggregated as (
    select site_id, engineer_id, equipment_id, experience_type,
      count(*)::integer as confirmed_order_count, sum(line_count)::integer as confirmation_line_count,
      greatest(count(distinct case
        when experience_type = 'corrective' then coalesce(nullif(btrim(fault_code), ''), nullif(btrim(maintenance_activity_type_code), ''))
        when experience_type in ('preventive','calibration') then coalesce(preventive_maintenance_id::text, nullif(btrim(maintenance_activity_type_code), ''))
        else nullif(btrim(maintenance_activity_type_code), '') end)::integer,
        case when count(*) > 0 then 1 else 0 end) as unique_task_count,
      count(*) filter (where has_final_confirmation)::integer as final_confirmation_count,
      count(*) filter (where has_confirmation_text)::integer as confirmation_text_count,
      sum(actual_work) as total_actual_work,
      case when count(distinct work_unit) filter (where work_unit is not null) = 1 then max(work_unit) else null end as work_unit,
      min(evidence_date) as first_completed_at, max(evidence_date) as last_completed_at,
      case when count(*) filter (where has_final_confirmation) = count(*) and count(*) filter (where has_confirmation_text) = count(*) then 'strong'
        when count(*) filter (where has_final_confirmation) > 0 then 'standard' else 'partial' end as evidence_quality,
      case when max(evidence_date) is null then 'unknown' when max(evidence_date) >= current_date - interval '6 months' then 'current'
        when max(evidence_date) >= current_date - interval '12 months' then 'aging' else 'stale' end as recency_status,
      case when max(evidence_date) is null then 0 when max(evidence_date) >= current_date - interval '6 months' then 1
        when max(evidence_date) >= current_date - interval '12 months' then 0.85
        when max(evidence_date) >= current_date - interval '24 months' then 0.65 else 0.4 end::numeric(5,4) as recency_factor,
      array(select distinct source_name from events e2 cross join unnest(e2.source_systems) source_name
        where e2.site_id = events.site_id and e2.engineer_id = events.engineer_id and e2.equipment_id = events.equipment_id
          and e2.experience_type = events.experience_type order by source_name) as source_systems,
      max(source_updated_at) as source_updated_at
    from events group by site_id, engineer_id, equipment_id, experience_type
  ), scored as (
    select *,
      case when confirmed_order_count = 0 then 0 when confirmed_order_count = 1 then 20 when confirmed_order_count = 2 then 35
        when confirmed_order_count = 3 then 50 when confirmed_order_count <= 5 then 65 when confirmed_order_count <= 9 then 75
        when confirmed_order_count <= 14 then 85 when confirmed_order_count <= 24 then 92 else 100 end::numeric(5,2) as depth_score,
      case when unique_task_count = 0 then 0 when unique_task_count = 1 then 25 when unique_task_count = 2 then 40
        when unique_task_count = 3 then 55 when unique_task_count = 4 then 65 when unique_task_count = 5 then 75
        when unique_task_count <= 7 then 85 when unique_task_count <= 9 then 92 else 100 end::numeric(5,2) as breadth_score
    from aggregated
  )
  insert into public.engineer_equipment_experience_snapshots (
    site_id, engineer_id, equipment_id, experience_type, confirmed_order_count, confirmation_line_count,
    unique_task_count, final_confirmation_count, confirmation_text_count, total_actual_work, work_unit,
    depth_score, breadth_score, experience_score, first_completed_at, last_completed_at, evidence_quality,
    recency_status, recency_factor, source_systems, source_updated_at, calculated_at, created_at, updated_at
  )
  select site_id, engineer_id, equipment_id, experience_type, confirmed_order_count, confirmation_line_count,
    unique_task_count, final_confirmation_count, confirmation_text_count, total_actual_work, work_unit,
    depth_score, breadth_score,
    round(least(100, greatest(0, (depth_score * 0.65 + breadth_score * 0.35) * recency_factor
      * case evidence_quality when 'strong' then 1.0 when 'standard' then 0.9 else 0.75 end)), 2),
    first_completed_at, last_completed_at, evidence_quality, recency_status, recency_factor, source_systems,
    source_updated_at, now(), now(), now()
  from scored;

  get diagnostics v_count = row_count;
  return jsonb_build_object('siteId', p_site_id, 'snapshotCount', v_count, 'refreshedAt', now());
end;
$$;

create or replace function public.vorta_refresh_engineer_equipment_scores(p_site_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_count integer := 0;
begin
  perform public.vorta_refresh_engineer_equipment_experience(p_site_id);
  delete from public.engineer_equipment_score_snapshots snapshot
  where p_site_id is null or snapshot.site_id = p_site_id;

  with pairs as (
    select engineer.site_id, engineer.id as engineer_id, equipment.id as equipment_id
    from public.engineers engineer join public.equipment_assets equipment on equipment.site_id = engineer.site_id
    where p_site_id is null or engineer.site_id = p_site_id
  ), req_rows as (
    select pair.site_id, pair.engineer_id, pair.equipment_id, greatest(requirement.required_level,1) as required_level,
      case lower(coalesce(requirement.criticality,'medium')) when 'critical' then 4 when 'high' then 3 when 'medium' then 2 else 1 end::numeric as requirement_weight,
      case when lower(coalesce(es.verification_status,''))='validated' and es.validated_rating is not null and (es.expiry_date is null or es.expiry_date >= current_date) then es.validated_rating
        when es.manager_rating is not null and lower(coalesce(es.verification_status,'')) not in ('expired','rejected') and (es.expiry_date is null or es.expiry_date >= current_date) then es.manager_rating
        else coalesce(es.self_rating,0) end::numeric as effective_rating,
      case when lower(coalesce(es.verification_status,''))='validated' and es.validated_rating is not null and (es.expiry_date is null or es.expiry_date >= current_date) then 1.0
        when es.manager_rating is not null and lower(coalesce(es.verification_status,'')) not in ('expired','rejected') and (es.expiry_date is null or es.expiry_date >= current_date) then 0.80
        when es.self_rating is not null then 0.45 else 0 end::numeric as authority_factor
    from pairs pair join public.equipment_required_skills requirement on requirement.equipment_id=pair.equipment_id
    left join public.engineer_skills es on es.engineer_id=pair.engineer_id and es.skill_id=requirement.skill_id
  ), req_scores as (
    select site_id,engineer_id,equipment_id,count(*)::integer required_skill_count,
      round(100*sum(least(effective_rating/required_level,1)*authority_factor*requirement_weight)/nullif(sum(requirement_weight),0),2) requirement_skill_score,
      round(sum(authority_factor*requirement_weight)/nullif(sum(requirement_weight),0),4) skill_authority_factor
    from req_rows group by site_id,engineer_id,equipment_id
  ), capability_scores as (
    select equipment_id,engineer_id,
      case when capability_status='ACTIVE' and validation_status='VALIDATED' and (valid_until is null or valid_until>=current_date)
        then least(competency_level::numeric/5,1)*100 else least(coalesce(competency_level,0)::numeric/5,1)*50 end capability_score,
      case when capability_status='ACTIVE' and validation_status='VALIDATED' and (valid_until is null or valid_until>=current_date) then 1.0 else 0.5 end::numeric capability_authority
    from public.equipment_engineer_capabilities
  ), training_catalogue as (
    select r.equipment_id,count(distinct r.skill_id)::integer mapped_training_skill_count
    from public.equipment_required_skills r where exists(select 1 from public.course_skills cs where cs.skill_id=r.skill_id)
    group by r.equipment_id
  ), training_completed as (
    select b.engineer_id,r.equipment_id,count(distinct r.skill_id)::integer completed_training_skill_count
    from public.training_bookings b join public.course_skills cs on cs.course_id=b.course_id
    join public.equipment_required_skills r on r.skill_id=cs.skill_id
    left join public.engineer_skills es on es.engineer_id=b.engineer_id and es.skill_id=r.skill_id
    where lower(b.status)='completed' and (es.expiry_date is null or es.expiry_date>=current_date)
    group by b.engineer_id,r.equipment_id
  ), order_population as (
    select wo.site_id,wo.equipment_id,wo.id,
      case when lower(coalesce(wo.work_type,'')) like '%calibr%' or lower(coalesce(wo.order_type_description,'')) like '%calibr%' or lower(coalesce(wo.maintenance_activity_type_description,'')) like '%calibr%' then 'calibration'
        when lower(coalesce(wo.work_type,'')) in ('corrective','diagnostic') or lower(coalesce(wo.order_type_description,'')) like '%corrective%' then 'corrective'
        when lower(coalesce(wo.work_type,''))='preventive' or lower(coalesce(wo.order_type_description,'')) like '%preventive%' then 'preventive' else null end experience_type
    from public.work_orders wo where wo.equipment_id is not null and (p_site_id is null or wo.site_id=p_site_id)
  ), history_total as (
    select equipment_id,experience_type,count(*)::numeric total_orders from order_population where experience_type is not null group by equipment_id,experience_type
  ), history_mapped as (
    select op.equipment_id,op.experience_type,count(distinct op.id)::numeric mapped_orders
    from order_population op join public.work_order_confirmations wc on wc.work_order_id=op.id and wc.site_id=op.site_id and wc.reversal=false and wc.personnel_number is not null
    join public.engineer_source_identities esi on esi.site_id=wc.site_id and esi.source_system='SAP' and esi.identity_type='personnel_number'
      and esi.source_identity=upper(btrim(wc.personnel_number)) and esi.mapping_status='verified'
    where op.experience_type is not null group by op.equipment_id,op.experience_type
  ), history_coverage as (
    select ht.equipment_id,
      coalesce(max(least(1,hm.mapped_orders/nullif(ht.total_orders,0))) filter(where ht.experience_type='corrective'),0)::numeric as corrective_coverage,
      coalesce(max(least(1,hm.mapped_orders/nullif(ht.total_orders,0))) filter(where ht.experience_type='preventive'),0)::numeric as pm_coverage,
      coalesce(max(least(1,hm.mapped_orders/nullif(ht.total_orders,0))) filter(where ht.experience_type='calibration'),0)::numeric as calibration_coverage,
      coalesce(max(ht.total_orders) filter(where ht.experience_type='corrective'),0)::integer as corrective_total_orders,
      coalesce(max(ht.total_orders) filter(where ht.experience_type='preventive'),0)::integer as pm_total_orders,
      coalesce(max(ht.total_orders) filter(where ht.experience_type='calibration'),0)::integer as calibration_total_orders
    from history_total ht left join history_mapped hm on hm.equipment_id=ht.equipment_id and hm.experience_type=ht.experience_type group by ht.equipment_id
  ), applicability as (
    select equipment.id equipment_id,coalesce(hc.corrective_coverage,0) corrective_coverage,
      case when exists(select 1 from public.preventive_maintenance pm where pm.equipment_id=equipment.id) then greatest(coalesce(hc.pm_coverage,0),0.15) else coalesce(hc.pm_coverage,0) end pm_coverage,
      case when exists(select 1 from public.preventive_maintenance pm where pm.equipment_id=equipment.id and (nullif(btrim(pm.calibration_point),'') is not null or lower(coalesce(pm.pm_type,'')) like '%calibr%')) then greatest(coalesce(hc.calibration_coverage,0),0.15) else coalesce(hc.calibration_coverage,0) end calibration_coverage,
      coalesce(hc.corrective_total_orders,0) corrective_total_orders,coalesce(hc.pm_total_orders,0) pm_total_orders,coalesce(hc.calibration_total_orders,0) calibration_total_orders
    from public.equipment_assets equipment left join history_coverage hc on hc.equipment_id=equipment.id where p_site_id is null or equipment.site_id=p_site_id
  ), experience as (
    select engineer_id,equipment_id,max(experience_score) filter(where experience_type='corrective') corrective_score,
      max(experience_score) filter(where experience_type='preventive') pm_score,max(experience_score) filter(where experience_type='calibration') calibration_score,
      max(confirmed_order_count) filter(where experience_type='corrective')::integer corrective_order_count,
      max(confirmed_order_count) filter(where experience_type='preventive')::integer pm_order_count,
      max(confirmed_order_count) filter(where experience_type='calibration')::integer calibration_order_count,max(last_completed_at) latest_evidence_at
    from public.engineer_equipment_experience_snapshots where p_site_id is null or site_id=p_site_id group by engineer_id,equipment_id
  ), components as (
    select pair.site_id,pair.engineer_id,pair.equipment_id,coalesce(req.required_skill_count,0) required_skill_count,
      coalesce(tc.mapped_training_skill_count,0) mapped_training_skill_count,coalesce(tdone.completed_training_skill_count,0) completed_training_skill_count,
      case when req.requirement_skill_score is not null and cap.capability_score is not null then round(req.requirement_skill_score*.80+cap.capability_score*.20,2) else coalesce(req.requirement_skill_score,cap.capability_score) end skill_score,
      least(1,coalesce(req.skill_authority_factor,0)*.80+coalesce(cap.capability_authority,0)*.20) skill_authority_factor,
      case when coalesce(tc.mapped_training_skill_count,0)>0 then round(100*coalesce(tdone.completed_training_skill_count,0)::numeric/tc.mapped_training_skill_count,2) end training_score,
      case when ap.corrective_coverage>0 then coalesce(exp.corrective_score,0) end corrective_score,
      case when ap.pm_coverage>0 then coalesce(exp.pm_score,0) end pm_score,
      case when ap.calibration_coverage>0 then coalesce(exp.calibration_score,0) end calibration_score,
      coalesce(exp.corrective_order_count,0) corrective_order_count,coalesce(exp.pm_order_count,0) pm_order_count,coalesce(exp.calibration_order_count,0) calibration_order_count,
      exp.latest_evidence_at,ap.corrective_coverage,ap.pm_coverage,ap.calibration_coverage,
      (case when coalesce(req.required_skill_count,0)>0 or cap.capability_score is not null then .25 else 0 end)::numeric skill_weight,
      (case when coalesce(tc.mapped_training_skill_count,0)>0 then .20 else 0 end)::numeric training_weight,
      (.25*ap.corrective_coverage)::numeric corrective_weight,(.20*ap.pm_coverage)::numeric pm_weight,(.10*ap.calibration_coverage)::numeric calibration_weight
    from pairs pair left join req_scores req on req.engineer_id=pair.engineer_id and req.equipment_id=pair.equipment_id
    left join capability_scores cap on cap.engineer_id=pair.engineer_id and cap.equipment_id=pair.equipment_id
    left join training_catalogue tc on tc.equipment_id=pair.equipment_id left join training_completed tdone on tdone.engineer_id=pair.engineer_id and tdone.equipment_id=pair.equipment_id
    join applicability ap on ap.equipment_id=pair.equipment_id left join experience exp on exp.engineer_id=pair.engineer_id and exp.equipment_id=pair.equipment_id
  ), scored as (
    select *, (skill_weight+training_weight+corrective_weight+pm_weight+calibration_weight) applicable_weight,
      case when (skill_weight+training_weight+corrective_weight+pm_weight+calibration_weight)>0 then round(
        (coalesce(skill_score,0)*skill_weight+coalesce(training_score,0)*training_weight+coalesce(corrective_score,0)*corrective_weight+coalesce(pm_score,0)*pm_weight+coalesce(calibration_score,0)*calibration_weight)/(skill_weight+training_weight+corrective_weight+pm_weight+calibration_weight),2) else 0 end vorta_score
    from components
  ), confident as (
    select *,round(100*applicable_weight,2) evidence_coverage_pct,
      case when applicable_weight>0 then round(50*((skill_weight*greatest(coalesce(skill_authority_factor,0),.25)+training_weight+corrective_weight+pm_weight+calibration_weight)/applicable_weight)+50*least(1,applicable_weight),2) else 0 end confidence_score
    from scored
  )
  insert into public.engineer_equipment_score_snapshots(site_id,engineer_id,equipment_id,score_version,vorta_score,score_status,evidence_confidence,confidence_score,evidence_coverage_pct,
    skill_score,training_score,corrective_score,pm_score,calibration_score,skill_authority_factor,required_skill_count,completed_training_skill_count,mapped_training_skill_count,
    corrective_order_count,pm_order_count,calibration_order_count,latest_evidence_at,component_detail,calculated_at,created_at,updated_at)
  select site_id,engineer_id,equipment_id,'vorta-equipment-v1',vorta_score,
    case when vorta_score>=90 then 'Expert' when vorta_score>=75 then 'Advanced' when vorta_score>=60 then 'Competent' when vorta_score>=40 then 'Developing' else 'Foundation' end,
    case when confidence_score>=80 then 'High' when confidence_score>=55 then 'Medium' else 'Low' end,
    confidence_score,evidence_coverage_pct,skill_score,training_score,corrective_score,pm_score,calibration_score,skill_authority_factor,required_skill_count,
    completed_training_skill_count,mapped_training_skill_count,corrective_order_count,pm_order_count,calibration_order_count,latest_evidence_at,
    jsonb_build_object('weights',jsonb_build_object('verifiedSkills',25,'training',20,'corrective',25,'pm',20,'calibration',10),
      'effectiveWeights',jsonb_build_object('skills',skill_weight*100,'training',training_weight*100,'corrective',corrective_weight*100,'pm',pm_weight*100,'calibration',calibration_weight*100),
      'historyCoverage',jsonb_build_object('corrective',corrective_coverage,'pm',pm_coverage,'calibration',calibration_coverage),
      'authorityOrder',jsonb_build_array('validated','manager','self'),'selfEvidenceFactor',.45,'managerEvidenceFactor',.80,'validatedEvidenceFactor',1.0,
      'recencyAppliedInsideExperience',true,'hoursUsedAsSupportingEvidenceOnly',true,'missingHistoryReducesConfidenceNotCompetence',true),now(),now(),now()
  from confident;
  get diagnostics v_count=row_count;
  return jsonb_build_object('siteId',p_site_id,'scoreVersion','vorta-equipment-v1','snapshotCount',v_count,'refreshedAt',now());
end;
$$;
