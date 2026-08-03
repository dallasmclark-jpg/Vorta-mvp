begin;

alter table public.ask_vorta_interactions
  add column if not exists route_key text,
  add column if not exists routing_mode text,
  add column if not exists planner_ms integer,
  add column if not exists evidence_ms integer,
  add column if not exists answer_ms integer,
  add column if not exists tool_count smallint,
  add column if not exists tool_round_count smallint,
  add column if not exists failure_stage text,
  add column if not exists feedback_category text;

update public.ask_vorta_interactions
set route_key = left(
      trim(both '_' from regexp_replace(lower(coalesce(intent_label, 'general')), '[^a-z0-9]+', '_', 'g')),
      64
    )
where route_key is null;

update public.ask_vorta_interactions
set route_key = 'general'
where route_key is null or route_key = '';

update public.ask_vorta_interactions
set routing_mode = 'semantic'
where routing_mode is null;

update public.ask_vorta_interactions
set planner_ms = 0,
    evidence_ms = 0,
    answer_ms = coalesce(duration_ms, 0),
    tool_count = least(cardinality(coalesce(tools_used, array[]::text[])), 32767)::smallint,
    tool_round_count = case
      when cardinality(coalesce(tools_used, array[]::text[])) > 0 then 1
      else 0
    end
where planner_ms is null
   or evidence_ms is null
   or answer_ms is null
   or tool_count is null
   or tool_round_count is null;

alter table public.ask_vorta_interactions
  alter column route_key set default 'general',
  alter column route_key set not null,
  alter column routing_mode set default 'semantic',
  alter column routing_mode set not null,
  alter column planner_ms set default 0,
  alter column planner_ms set not null,
  alter column evidence_ms set default 0,
  alter column evidence_ms set not null,
  alter column answer_ms set default 0,
  alter column answer_ms set not null,
  alter column tool_count set default 0,
  alter column tool_count set not null,
  alter column tool_round_count set default 0,
  alter column tool_round_count set not null;

alter table public.ask_vorta_interactions
  drop constraint if exists ask_vorta_interactions_status_check,
  drop constraint if exists ask_vorta_interactions_route_key_check,
  drop constraint if exists ask_vorta_interactions_routing_mode_check,
  drop constraint if exists ask_vorta_interactions_planner_ms_check,
  drop constraint if exists ask_vorta_interactions_evidence_ms_check,
  drop constraint if exists ask_vorta_interactions_answer_ms_check,
  drop constraint if exists ask_vorta_interactions_tool_count_check,
  drop constraint if exists ask_vorta_interactions_tool_round_count_check,
  drop constraint if exists ask_vorta_interactions_failure_stage_check,
  drop constraint if exists ask_vorta_interactions_feedback_category_check;

alter table public.ask_vorta_interactions
  add constraint ask_vorta_interactions_status_check
    check (status = any (array[
      'started'::text,
      'completed'::text,
      'fallback'::text,
      'failed'::text,
      'rate_limited'::text,
      'timed_out'::text
    ])),
  add constraint ask_vorta_interactions_route_key_check
    check (route_key ~ '^[a-z0-9_]{1,64}$'),
  add constraint ask_vorta_interactions_routing_mode_check
    check (routing_mode = any (array['deterministic'::text, 'semantic'::text, 'fallback'::text])),
  add constraint ask_vorta_interactions_planner_ms_check
    check (planner_ms >= 0),
  add constraint ask_vorta_interactions_evidence_ms_check
    check (evidence_ms >= 0),
  add constraint ask_vorta_interactions_answer_ms_check
    check (answer_ms >= 0),
  add constraint ask_vorta_interactions_tool_count_check
    check (tool_count >= 0),
  add constraint ask_vorta_interactions_tool_round_count_check
    check (tool_round_count >= 0),
  add constraint ask_vorta_interactions_failure_stage_check
    check (failure_stage is null or failure_stage = any (array['planner'::text, 'evidence'::text, 'answer'::text])),
  add constraint ask_vorta_interactions_feedback_category_check
    check (
      feedback_category is null
      or feedback_category = any (array[
        'wrong_route'::text,
        'missing_evidence'::text,
        'too_slow'::text,
        'unclear'::text,
        'incorrect'::text,
        'too_much_detail'::text,
        'other'::text
      ])
    );

create index if not exists ask_vorta_interactions_site_route_created_idx
  on public.ask_vorta_interactions (site_id, route_key, created_at desc);

revoke all on table public.ask_vorta_interactions from public;
revoke all on table public.ask_vorta_interactions from anon;
revoke all on table public.ask_vorta_interactions from authenticated;
grant select, insert, update on table public.ask_vorta_interactions to authenticated;
grant all on table public.ask_vorta_interactions to service_role;

comment on column public.ask_vorta_interactions.route_key is
  'Bounded canonical Ask Vorta route key. Raw questions and evidence payloads are not stored.';
comment on column public.ask_vorta_interactions.routing_mode is
  'Routing path used: deterministic, semantic planner, or fallback.';
comment on column public.ask_vorta_interactions.planner_ms is
  'Privacy-safe semantic planning phase duration in milliseconds.';
comment on column public.ask_vorta_interactions.evidence_ms is
  'Privacy-safe authorised Vorta evidence phase duration in milliseconds.';
comment on column public.ask_vorta_interactions.answer_ms is
  'Privacy-safe final answer phase duration in milliseconds.';
comment on column public.ask_vorta_interactions.feedback_category is
  'Optional bounded user-selected reason for a not-helpful response.';

commit;
