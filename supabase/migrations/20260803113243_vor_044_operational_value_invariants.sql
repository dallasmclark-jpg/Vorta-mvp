do $migration$
declare
  v_public_signature text := 'public.vorta_get_ranked_operational_actions(uuid,integer)';
  v_internal_signature text := 'public.vorta_rank_operational_actions_internal(uuid,uuid,integer)';
  v_internal_definition text;
  v_first_blocked_rank integer;
  v_last_ready_rank integer;
  v_top_feasibility text;
begin
  select pg_get_functiondef(to_regprocedure(v_internal_signature))
  into v_internal_definition;

  if v_internal_definition is null then
    raise exception 'VOR-044 operational-value ranking function is missing';
  end if;

  if position('operational_value_v1' in v_internal_definition) = 0
    or position('risk_reduction_points' in v_internal_definition) = 0
    or position('urgency_points' in v_internal_definition) = 0
    or position('readiness_points' in v_internal_definition) = 0
    or position('criticality_points' in v_internal_definition) = 0
    or position('efficiency_points' in v_internal_definition) = 0
    or position('confidence_points' in v_internal_definition) = 0
    or position('ready_now' in v_internal_definition) = 0 then
    raise exception 'VOR-044 transparent score contract is incomplete';
  end if;

  if has_function_privilege('anon', v_public_signature, 'EXECUTE') then
    raise exception 'Anonymous users must not execute the VOR-044 ranking wrapper';
  end if;

  if not has_function_privilege('authenticated', v_public_signature, 'EXECUTE') then
    raise exception 'Authenticated users require the authorised VOR-044 ranking wrapper';
  end if;

  if has_function_privilege('authenticated', v_internal_signature, 'EXECUTE') then
    raise exception 'Authenticated users must not execute the VOR-044 internal ranking engine';
  end if;

  if not has_function_privilege('service_role', v_internal_signature, 'EXECUTE') then
    raise exception 'Service role requires the VOR-044 internal ranking engine';
  end if;

  with ranked as (
    select *
    from public.vorta_rank_operational_actions_internal(
      public.vorta_current_demo_site_id(),
      null,
      50
    )
  )
  select
    min(action_rank) filter (where feasibility_state <> 'ready_now'),
    max(action_rank) filter (where feasibility_state = 'ready_now'),
    min(feasibility_state) filter (where action_rank = 1)
  into v_first_blocked_rank, v_last_ready_rank, v_top_feasibility
  from ranked;

  if v_first_blocked_rank is not null
    and v_last_ready_rank is not null
    and v_first_blocked_rank <= v_last_ready_rank then
    raise exception 'VOR-044 blocked work outranked executable work';
  end if;

  if v_last_ready_rank is not null and v_top_feasibility <> 'ready_now' then
    raise exception 'VOR-044 top action is not executable despite ready work being available';
  end if;

  if exists (
    select 1
    from public.vorta_rank_operational_actions_internal(
      public.vorta_current_demo_site_id(),
      null,
      50
    ) ranked
    where abs(
      ranked.operational_value_score
      - (
        ranked.risk_reduction_points
        + ranked.urgency_points
        + ranked.readiness_points
        + ranked.criticality_points
        + ranked.efficiency_points
        + ranked.confidence_points
      )
    ) > 0.11
  ) then
    raise exception 'VOR-044 operational-value score does not equal its returned components';
  end if;
end;
$migration$;

notify pgrst, 'reload schema';
