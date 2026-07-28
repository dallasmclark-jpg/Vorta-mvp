-- Repair the projection regression introduced when the current area/site risk
-- model moved from raw at-risk counts to prevalence ratios. The intervention
-- plan functions still used the retired count-based formula, so current and
-- projected values were being calculated on different scales.

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

do $patch$
declare
  v_signature regprocedure;
  v_original text;
  v_definition text;
  v_site_prevalence text := $replacement$
+ (
          v_projected_operational_at_risk::numeric
          / nullif((
              select count(*)
              from public.equipment_risk_profiles projected_profile
              join public.equipment_assets projected_asset
                on projected_asset.id = projected_profile.equipment_id
              where projected_asset.site_id = v_site.site_id
            ), 0)
        ) * 15$replacement$;
begin
  foreach v_signature in array array[
    'public.vorta_get_area_risk_reduction_plan_internal(text)'::regprocedure,
    'public.vorta_get_area_equipment_base_plan(text,uuid)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_signature::oid)
    into v_original;

    if (length(v_original) - length(replace(v_original, ') * 5', '')))
         / length(') * 5') <> 1
       or strpos(v_original, 'v_projected_site_area_operational_max * 0.65') = 0
       or strpos(v_original, '+ v_projected_operational_at_risk * 3') = 0 then
      raise exception 'Unexpected projection function shape for %', v_signature;
    end if;

    v_definition := replace(
      v_original,
      ') * 5',
      ')::numeric / nullif(count(*), 0) * 15'
    );

    v_definition := replace(
      v_definition,
      'v_projected_site_area_operational_max * 0.65',
      'v_projected_site_area_operational_max * 0.60'
    );

    v_definition := replace(
      v_definition,
      '+ v_projected_operational_at_risk * 3',
      v_site_prevalence
    );

    execute v_definition;
  end loop;
end;
$patch$;

comment on function public.vorta_get_area_risk_reduction_plan_internal(text) is
  'Projects area and site risk after the listed intervention using the same prevalence-based scoring scale as the current risk snapshot.';

comment on function public.vorta_get_area_equipment_base_plan(text, uuid) is
  'Projects selected-equipment intervention impact using the same prevalence-based area and site scoring scale as the current risk snapshot.';

select private.vorta_refresh_dashboard_scope_plan_cache();

do $validation$
declare
  v_plan record;
  v_scope_count integer;
begin
  select *
  into v_plan
  from public.vorta_get_site_risk_reduction_plan_internal();

  if not found then
    raise exception 'Risk-reduction plan validation returned no row';
  end if;

  if v_plan.projected_area_risk > v_plan.current_area_risk
     or v_plan.projected_site_risk > v_plan.current_site_risk then
    raise exception 'Projected risk still exceeds current risk: area % -> %, site % -> %',
      v_plan.current_area_risk,
      v_plan.projected_area_risk,
      v_plan.current_site_risk,
      v_plan.projected_site_risk;
  end if;

  if v_plan.projected_area_risk = v_plan.current_area_risk
     and v_plan.projected_site_risk = v_plan.current_site_risk
     and jsonb_array_length(coalesce(v_plan.actions, '[]'::jsonb)) > 0 then
    raise exception 'Intervention plan still produces no projected area or site change';
  end if;

  select count(*)
  into v_scope_count
  from private.vorta_dashboard_scope_plan_cache cache
  where cache.site_id = public.vorta_current_demo_site_id();

  if v_scope_count < 1 then
    raise exception 'Dashboard scope-plan cache was not refreshed';
  end if;
end;
$validation$;
