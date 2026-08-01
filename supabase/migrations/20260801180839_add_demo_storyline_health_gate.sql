-- VOR-033 Phase 2B: verify connected storylines and extend the rolling credibility gate.
create or replace function private.vorta_get_demo_storyline_health_internal(p_site_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog','public','private'
as $$
with assets as (
  select id, equipment_code from public.equipment_assets where site_id = p_site_id
),
visible_seed as (
  select
    (select count(*) from public.equipment_assets asset
      where asset.site_id = p_site_id
        and concat_ws(' ', asset.equipment_code, asset.name, asset.model, asset.description)
          ~* '(^|[^A-Z0-9])(DEMO|MOCK|PLACEHOLDER)([^A-Z0-9]|$)')::int as equipment,
    (select count(*) from public.knowledge_documents document
      where document.site_id = p_site_id
        and concat_ws(' ', document.title, document.source_document_id, document.external_reference,
          document.drawing_number, document.manual_section, document.summary, document.extracted_summary,
          array_to_string(document.fault_codes, ' '), array_to_string(document.component_tags, ' '))
          ~* '(^|[^A-Z0-9])(DEMO|MOCK|PLACEHOLDER)([^A-Z0-9]|$)')::int as documents,
    (select count(*) from public.knowledge_chunks chunk
      join assets asset on asset.id = chunk.equipment_id
      where concat_ws(' ', chunk.chunk_ref, chunk.section_title, chunk.chunk_text, chunk.drawing_number,
          chunk.external_reference, array_to_string(chunk.keywords, ' '), array_to_string(chunk.fault_codes, ' '),
          array_to_string(chunk.component_tags, ' '))
          ~* '(^|[^A-Z0-9])(DEMO|MOCK|PLACEHOLDER)([^A-Z0-9]|$)')::int as knowledge_chunks
),
duplicate_narratives as (
  select count(*)::int as groups
  from (
    select description from public.work_orders
    where site_id = p_site_id and nullif(trim(description), '') is not null
    group by description having count(*) >= 3
  ) duplicate_group
),
story_resolution as (
  select storyline.story_key,
    cardinality(storyline.question_prompts) as prompt_count,
    asset.id as equipment_id,
    work_order.id as work_order_id,
    notification.id as notification_id,
    schedule.id as pm_id,
    component.id as component_id,
    document.id as document_id,
    skill.id as skill_id,
    engineer.id as engineer_id,
    requirement.required_level,
    coalesce(engineer_skill.validated_rating, engineer_skill.manager_rating, engineer_skill.self_rating, 0) as engineer_rating,
    engineer_skill.verification_status,
    (storyline.notification_number is null or notification.id is not null) as notification_resolved
  from private.vorta_demo_storylines storyline
  left join public.equipment_assets asset
    on asset.site_id = storyline.site_id and asset.equipment_code = storyline.equipment_code
  left join public.work_orders work_order
    on work_order.site_id = storyline.site_id and work_order.wo_number = storyline.work_order_number
      and work_order.equipment_id = asset.id
  left join public.maintenance_notifications notification
    on notification.site_id = storyline.site_id and notification.notification_number = storyline.notification_number
      and notification.equipment_id = asset.id
  left join public.preventive_maintenance schedule
    on schedule.site_id = storyline.site_id and schedule.pm_number = storyline.pm_number
      and schedule.equipment_id = asset.id
  left join public.equipment_components component
    on component.site_id = storyline.site_id and component.component_code = storyline.component_code
      and component.equipment_id = asset.id
  left join public.knowledge_documents document
    on document.site_id = storyline.site_id and document.title = storyline.document_title
      and document.equipment_id = asset.id and coalesce(document.is_current, true)
  left join public.skills skill on skill.name = storyline.skill_name
  left join public.equipment_required_skills requirement
    on requirement.equipment_id = asset.id and requirement.skill_id = skill.id
  left join public.engineers engineer
    on engineer.site_id = storyline.site_id and engineer.full_name = storyline.engineer_name
  left join public.engineer_skills engineer_skill
    on engineer_skill.engineer_id = engineer.id and engineer_skill.skill_id = skill.id
  where storyline.site_id = p_site_id and storyline.active
),
story_summary as (
  select count(*)::int as total,
    count(*) filter (where equipment_id is not null and work_order_id is not null and notification_resolved
      and pm_id is not null and component_id is not null and document_id is not null and skill_id is not null
      and engineer_id is not null and required_level is not null and engineer_rating >= required_level
      and lower(coalesce(verification_status, '')) = 'validated')::int as fully_linked,
    coalesce(sum(prompt_count), 0)::int as prompt_count
  from story_resolution
),
top_assets as (
  select asset.id, asset.equipment_code,
    row_number() over (order by profile.risk_score desc, asset.equipment_code) as risk_rank
  from public.equipment_assets asset
  join public.equipment_risk_profiles profile on profile.equipment_id = asset.id
  where asset.site_id = p_site_id
),
top_coverage as (
  select top_assets.equipment_code,
    exists(select 1 from public.work_orders work_order where work_order.equipment_id = top_assets.id) as has_work,
    exists(select 1 from public.preventive_maintenance schedule where schedule.equipment_id = top_assets.id) as has_pm,
    exists(select 1 from public.equipment_components component where component.equipment_id = top_assets.id) as has_components,
    exists(select 1 from public.knowledge_documents document where document.equipment_id = top_assets.id and coalesce(document.is_current, true)) as has_documents,
    exists(select 1 from public.equipment_required_skills requirement where requirement.equipment_id = top_assets.id) as has_skills,
    exists(select 1 from public.maintenance_risk_work_plan plan where plan.equipment_id = top_assets.id and plan.completed_at is null) as has_plan
  from top_assets where risk_rank <= 10
),
top_summary as (
  select count(*)::int as total,
    count(*) filter (where has_work and has_pm and has_components and has_documents and has_skills and has_plan)::int as complete
  from top_coverage
)
select jsonb_build_object(
  'siteId', p_site_id,
  'checkedAt', now(),
  'healthy', visible_seed.equipment + visible_seed.documents + visible_seed.knowledge_chunks = 0
    and duplicate_narratives.groups = 0
    and story_summary.total >= 6
    and story_summary.fully_linked = story_summary.total
    and story_summary.prompt_count >= 20
    and top_summary.total = 10
    and top_summary.complete = 10,
  'visibleSeedIdentifiers', jsonb_build_object(
    'equipment', visible_seed.equipment,
    'documents', visible_seed.documents,
    'knowledgeChunks', visible_seed.knowledge_chunks
  ),
  'duplicateNarrativeGroups', duplicate_narratives.groups,
  'storylines', jsonb_build_object(
    'active', story_summary.total,
    'fullyLinked', story_summary.fully_linked,
    'questionPrompts', story_summary.prompt_count
  ),
  'topTenEvidenceCoverage', jsonb_build_object(
    'assets', top_summary.total,
    'complete', top_summary.complete,
    'details', (select coalesce(jsonb_agg(to_jsonb(top_coverage) order by equipment_code), '[]'::jsonb) from top_coverage)
  ),
  'storylineDetails', (select coalesce(jsonb_agg(to_jsonb(story_resolution) order by story_key), '[]'::jsonb) from story_resolution)
)
from visible_seed, duplicate_narratives, story_summary, top_summary;
$$;

revoke all on function private.vorta_get_demo_storyline_health_internal(uuid) from public, anon, authenticated;
grant execute on function private.vorta_get_demo_storyline_health_internal(uuid) to service_role;

alter function private.vorta_get_demo_dataset_credibility_internal(uuid, date)
  rename to vorta_get_demo_dataset_credibility_phase1_internal;
revoke all on function private.vorta_get_demo_dataset_credibility_phase1_internal(uuid, date) from public, anon, authenticated;
grant execute on function private.vorta_get_demo_dataset_credibility_phase1_internal(uuid, date) to service_role;

create or replace function private.vorta_get_demo_dataset_credibility_internal(
  p_site_id uuid,
  p_anchor_date date default current_date
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog','public','private'
as $$
with base as (
  select private.vorta_get_demo_dataset_credibility_phase1_internal(p_site_id, p_anchor_date) as value
), story as (
  select private.vorta_get_demo_storyline_health_internal(p_site_id) as value
)
select base.value || jsonb_build_object(
  'healthy', coalesce((base.value->>'healthy')::boolean, false)
    and coalesce((story.value->>'healthy')::boolean, false),
  'storylineHealth', story.value
)
from base, story;
$$;

revoke all on function private.vorta_get_demo_dataset_credibility_internal(uuid, date) from public, anon, authenticated;
grant execute on function private.vorta_get_demo_dataset_credibility_internal(uuid, date) to service_role;

alter function private.vorta_refresh_demo_dataset_dates_internal(uuid, date)
  rename to vorta_refresh_demo_dataset_dates_phase1_internal;
revoke all on function private.vorta_refresh_demo_dataset_dates_phase1_internal(uuid, date) from public, anon, authenticated;
grant execute on function private.vorta_refresh_demo_dataset_dates_phase1_internal(uuid, date) to service_role;

create or replace function private.vorta_refresh_demo_dataset_dates_internal(
  p_site_id uuid,
  p_anchor_date date default current_date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'pg_catalog','public','private'
as $$
begin
  perform private.vorta_refresh_demo_dataset_dates_phase1_internal(p_site_id, p_anchor_date);
  perform private.vorta_apply_demo_storyline_narratives_internal(p_site_id);
  return private.vorta_get_demo_dataset_credibility_internal(p_site_id, p_anchor_date);
end;
$$;

revoke all on function private.vorta_refresh_demo_dataset_dates_internal(uuid, date) from public, anon, authenticated;
grant execute on function private.vorta_refresh_demo_dataset_dates_internal(uuid, date) to service_role;

select public.vorta_recalculate_equipment_risk_profiles();
select public.vorta_sync_equipment_risk_counts();
select public.vorta_recalculate_area_risk_profiles();
select public.vorta_recalculate_site_risk_profile();
select public.vorta_sync_maintenance_risk_work_plan();
select private.vorta_apply_demo_storyline_narratives_internal('11000000-0000-0000-0000-000000000001'::uuid);

do $$
declare report jsonb;
begin
  report := private.vorta_get_demo_dataset_credibility_internal(
    '11000000-0000-0000-0000-000000000001'::uuid,
    current_date
  );
  if not coalesce((report->>'healthy')::boolean, false) then
    raise exception 'VOR-033 Phase 2 demo storyline credibility contract failed: %', report;
  end if;
end;
$$;
