create or replace function private.vorta_refresh_dashboard_scope_plan_cache_for_site(p_site_id uuid)
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $$
declare
  r_area record;
  v_site record;
  v_equipment record;
  v_next_equipment record;
  v_next_area record;
  v_actions jsonb := '[]'::jsonb;
  v_total_reduction numeric := 0;
  v_pm_actions integer := 0;
  v_cal_actions integer := 0;
  v_spares_actions integer := 0;
  v_projected_equipment_op numeric := 0;
  v_projected_area_op numeric := 0;
  v_projected_area_risk numeric := 0;
  v_projected_site_op numeric := 0;
  v_projected_site_risk numeric := 0;
  v_op_at_risk numeric := 0;
  v_asset_count numeric := 0;
  v_equipment_count integer := 0;
  v_inserted integer := 0;
begin
  if p_site_id is null or not exists(select 1 from public.sites s where s.id=p_site_id) then
    return 0;
  end if;

  if not exists(select 1 from private.vorta_dashboard_scope_cache c where c.site_id=p_site_id) then
    perform private.vorta_refresh_dashboard_scope_cache_for_site(p_site_id);
  end if;

  delete from private.vorta_dashboard_scope_plan_cache p where p.site_id=p_site_id;

  select * into v_site
  from private.vorta_dashboard_scope_cache c
  where c.site_id=p_site_id and c.scope_type='site'
  limit 1;

  for r_area in
    select * from private.vorta_dashboard_scope_cache c
    where c.site_id=p_site_id and c.scope_type='area'
    order by c.display_order
  loop
    select ea.id,ea.equipment_code,ea.name,erp.risk_score,erp.risk_level,
           erp.operational_risk_score,erp.labour_risk_score
    into v_equipment
    from public.equipment_assets ea
    join public.equipment_risk_profiles erp on erp.equipment_id=ea.id
    where ea.site_id=p_site_id and ea.area=r_area.area
    order by erp.risk_score desc,ea.name
    limit 1;

    if v_equipment.id is null then
      continue;
    end if;

    with ranked as (
      select ea.id,ea.equipment_code,ea.name,erp.risk_score,erp.risk_level,
             row_number() over(order by erp.risk_score desc,ea.name)::int rn,
             count(*) over()::int cnt
      from public.equipment_assets ea
      join public.equipment_risk_profiles erp on erp.equipment_id=ea.id
      where ea.site_id=p_site_id and ea.area=r_area.area
    )
    select n.id as id,n.equipment_code as equipment_code,n.name as name,
           n.risk_score as risk_score,n.risk_level as risk_level,c.cnt as cnt
    into v_next_equipment
    from ranked c
    left join ranked n on n.rn=2
    where c.rn=1;
    v_equipment_count := coalesce(v_next_equipment.cnt,1);

    select c.area as area,c.risk_score as risk_score,c.risk_level as risk_level
    into v_next_area
    from private.vorta_dashboard_scope_cache c
    where c.site_id=p_site_id and c.scope_type='area' and c.display_order=r_area.display_order+1
    limit 1;

    with chosen as (
      select p.*,wo.wo_number,wo.description,
             row_number() over(order by case when p.planned_date>=current_date then 0 else 1 end,
                                      p.risk_rank nulls last,p.planned_risk_reduction desc nulls last,
                                      p.planned_date desc,p.id)::int priority
      from public.maintenance_risk_work_plan p
      left join public.work_orders wo on wo.id=p.work_order_id
      where p.site_id=p_site_id and p.equipment_id=v_equipment.id and p.completed_at is null
      order by case when p.planned_date>=current_date then 0 else 1 end,
               p.risk_rank nulls last,p.planned_risk_reduction desc nulls last,p.planned_date desc,p.id
      limit 3
    ), cumulative as (
      select *,sum(coalesce(planned_risk_reduction,0)) over(order by priority) running_reduction
      from chosen
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'priority',priority,
             'driver',risk_driver,
             'action',coalesce(description,risk_driver||' intervention'),
             'detail',coalesce(wo_number||' — '||description,description,wo_number,risk_driver),
             'workOrderNumber',wo_number,
             'plannedDate',planned_date,
             'plannedShift',planned_shift,
             'ready',ready,
             'labourReady',labour_ready,
             'sparesReady',spares_ready,
             'procedureReady',procedure_ready,
             'calculatedReduction',round(coalesce(planned_risk_reduction,0),1),
             'projectedScore',greatest(5,round(v_equipment.risk_score-running_reduction,1)),
             'calculationType','calculated'
           ) order by priority),'[]'::jsonb),
           coalesce(sum(planned_risk_reduction),0),
           count(*) filter(where risk_driver='PM Backlog')::int,
           count(*) filter(where risk_driver='Calibration')::int,
           count(*) filter(where risk_driver in ('Spares','Out of Stock Part'))::int
    into v_actions,v_total_reduction,v_pm_actions,v_cal_actions,v_spares_actions
    from cumulative;

    v_projected_equipment_op := greatest(5,coalesce(v_equipment.operational_risk_score,0)-v_total_reduction);

    select least(96,greatest(5,round(
             max(case when erp.equipment_id=v_equipment.id then v_projected_equipment_op else erp.operational_risk_score end)*.55+
             avg(case when erp.equipment_id=v_equipment.id then v_projected_equipment_op else erp.operational_risk_score end)*.30+
             count(*) filter(where case when erp.equipment_id=v_equipment.id then v_projected_equipment_op else erp.operational_risk_score end>=65)::numeric/nullif(count(*),0)*15,1)))
    into v_projected_area_op
    from public.equipment_assets ea
    join public.equipment_risk_profiles erp on erp.equipment_id=ea.id
    where ea.site_id=p_site_id and ea.area=r_area.area;

    v_projected_area_risk := least(100,greatest(5,
      case when r_area.no_engineer_override then greatest(round(v_projected_area_op*.85+r_area.labour_risk_score*.15),85)
           else round(v_projected_area_op*.85+r_area.labour_risk_score*.15) end));

    select count(*)::numeric,
           count(*) filter(where case when erp.equipment_id=v_equipment.id then v_projected_equipment_op else erp.operational_risk_score end>=65)::numeric
    into v_asset_count,v_op_at_risk
    from public.equipment_assets ea
    join public.equipment_risk_profiles erp on erp.equipment_id=ea.id
    where ea.site_id=p_site_id;

    select least(96,greatest(5,round(
             max(case when c.area=r_area.area then v_projected_area_op else c.operational_risk_score end)*.60+
             avg(case when c.area=r_area.area then v_projected_area_op else c.operational_risk_score end)*.25+
             (v_op_at_risk/nullif(v_asset_count,0))*15,1)))
    into v_projected_site_op
    from private.vorta_dashboard_scope_cache c
    where c.site_id=p_site_id and c.scope_type='area';

    v_projected_site_risk := least(100,greatest(5,
      case when v_site.no_engineer_override then greatest(round(v_projected_site_op*.85+v_site.labour_risk_score*.15,1),90)
           else round(v_projected_site_op*.85+v_site.labour_risk_score*.15,1) end));

    insert into private.vorta_dashboard_scope_plan_cache(
      site_id,display_order,scope_key,scope_type,area,current_site_risk,current_site_level,
      projected_site_risk,projected_site_level,highest_area,current_area_risk,current_area_level,
      projected_area_risk,projected_area_level,equipment_id,equipment_name,equipment_code,
      estimated_duration_minutes,current_pm_backlog,projected_pm_backlog,current_calibration_backlog,
      projected_calibration_backlog,current_stockouts,projected_stockouts,next_area,next_area_risk,
      next_area_level,equipment_rank,equipment_count,next_equipment_id,next_equipment_code,
      next_equipment_name,next_equipment_risk,next_equipment_level,actions,refreshed_at
    ) values (
      p_site_id,r_area.display_order,r_area.scope_key,'area',r_area.area,v_site.risk_score,v_site.risk_level,
      v_projected_site_risk,private.vorta_risk_level(v_projected_site_risk),v_site.highest_child_name,
      r_area.risk_score::int,r_area.risk_level,v_projected_area_risk::int,private.vorta_risk_level(v_projected_area_risk),
      v_equipment.id,v_equipment.name,v_equipment.equipment_code,0,
      r_area.overdue_pm_count,greatest(r_area.overdue_pm_count-v_pm_actions,0),
      r_area.calibration_backlog_count,greatest(r_area.calibration_backlog_count-v_cal_actions,0),
      r_area.critical_spares_missing,greatest(r_area.critical_spares_missing-v_spares_actions,0),
      v_next_area.area,v_next_area.risk_score::int,v_next_area.risk_level,1,v_equipment_count,
      v_next_equipment.id,v_next_equipment.equipment_code,v_next_equipment.name,
      v_next_equipment.risk_score::int,v_next_equipment.risk_level,v_actions,now()
    );
  end loop;

  insert into private.vorta_dashboard_scope_plan_cache(
    site_id,display_order,scope_key,scope_type,area,current_site_risk,current_site_level,
    projected_site_risk,projected_site_level,highest_area,current_area_risk,current_area_level,
    projected_area_risk,projected_area_level,equipment_id,equipment_name,equipment_code,
    estimated_duration_minutes,current_pm_backlog,projected_pm_backlog,current_calibration_backlog,
    projected_calibration_backlog,current_stockouts,projected_stockouts,next_area,next_area_risk,
    next_area_level,equipment_rank,equipment_count,next_equipment_id,next_equipment_code,
    next_equipment_name,next_equipment_risk,next_equipment_level,actions,refreshed_at
  )
  select p_site_id,0,'site','site',null,p.current_site_risk,p.current_site_level,p.projected_site_risk,
         p.projected_site_level,p.area,p.current_area_risk,p.current_area_level,p.projected_area_risk,
         p.projected_area_level,p.equipment_id,p.equipment_name,p.equipment_code,p.estimated_duration_minutes,
         v_site.overdue_pm_count,greatest(v_site.overdue_pm_count-(p.current_pm_backlog-p.projected_pm_backlog),0),
         v_site.calibration_backlog_count,greatest(v_site.calibration_backlog_count-(p.current_calibration_backlog-p.projected_calibration_backlog),0),
         v_site.critical_spares_missing,greatest(v_site.critical_spares_missing-(p.current_stockouts-p.projected_stockouts),0),
         p.next_area,p.next_area_risk,p.next_area_level,p.equipment_rank,p.equipment_count,p.next_equipment_id,
         p.next_equipment_code,p.next_equipment_name,p.next_equipment_risk,p.next_equipment_level,p.actions,now()
  from private.vorta_dashboard_scope_plan_cache p
  where p.site_id=p_site_id and p.scope_type='area'
  order by p.current_area_risk desc,p.area
  limit 1;

  select count(*)::int into v_inserted from private.vorta_dashboard_scope_plan_cache p where p.site_id=p_site_id;
  return v_inserted;
end;
$$;

revoke all on function private.vorta_refresh_dashboard_scope_plan_cache_for_site(uuid) from public,anon,authenticated;

select private.vorta_refresh_dashboard_scope_plan_cache_for_site('11000000-0000-0000-0000-000000000004'::uuid);
