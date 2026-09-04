create or replace function private.vorta_build_scope_labour_cards_for_site(
  p_site_id uuid,
  p_area text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'private'
as $$
declare
  v_shift_date date := current_date;
  v_shift_type text := 'day';
  v_labour_risk numeric := 0;
  v_scheduled integer := 0;
  v_cover_gaps integer := 0;
  v_single_points integer := 0;
  v_asset_count integer := 0;
  v_leave_count integer := 0;
  v_expiring integer := 0;
  v_expired integer := 0;
  v_next_expiry date;
  v_single_score numeric := 5;
  v_leave_score numeric := 5;
  v_training_score numeric := 5;
  v_shift_label text;
begin
  if p_site_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(lr.shift_date,current_date),
         case when lr.shift_type='night' then 'night' else 'day' end,
         coalesce(lr.labour_risk_score,0),
         coalesce(lr.scheduled_engineer_count,0)
  into v_shift_date,v_shift_type,v_labour_risk,v_scheduled
  from public.vorta_get_site_labour_risk_internal(p_site_id) lr
  limit 1;

  if p_area is null then
    select count(*)::int,
           count(*) filter(where coalesce(erp.missing_skill_count,0)>0)::int,
           count(*) filter(where coalesce(erp.single_point_skill_gap,false))::int
    into v_asset_count,v_cover_gaps,v_single_points
    from public.equipment_assets ea
    join public.equipment_risk_profiles erp on erp.equipment_id=ea.id
    where ea.site_id=p_site_id;
  else
    with area_labour as (
      select count(*)::int asset_count,
             count(*) filter(where coalesce(erp.missing_skill_count,0)>0)::int cover_gaps,
             count(*) filter(where coalesce(erp.single_point_skill_gap,false))::int single_points,
             max(coalesce(erp.labour_risk_score,0))::numeric max_labour,
             sum(coalesce(erp.labour_risk_score,0) * case lower(coalesce(ea.criticality,''))
               when 'critical' then 4 when 'high' then 3 when 'medium' then 2 else 1 end)
               / nullif(sum(case lower(coalesce(ea.criticality,''))
                 when 'critical' then 4 when 'high' then 3 when 'medium' then 2 else 1 end),0) weighted_labour,
             max(coalesce(erp.scheduled_engineer_count,0))::int scheduled
      from public.equipment_assets ea
      join public.equipment_risk_profiles erp on erp.equipment_id=ea.id
      where ea.site_id=p_site_id and ea.area=p_area
    )
    select asset_count,cover_gaps,single_points,
           round(least(100,greatest(0,coalesce(max_labour,0)*0.60+coalesce(weighted_labour,0)*0.40)),1),
           scheduled
    into v_asset_count,v_cover_gaps,v_single_points,v_labour_risk,v_scheduled
    from area_labour;
  end if;

  select count(distinct mse.engineer_id)::int
  into v_leave_count
  from public.maintenance_shift_exceptions mse
  where mse.site_id=p_site_id
    and mse.shift_date=v_shift_date
    and mse.shift_type=v_shift_type
    and not mse.is_available
    and lower(coalesce(mse.exception_type,'')) like '%leave%'
    and (p_area is null or exists (
      select 1
      from public.engineer_skills es
      join public.equipment_required_skills ers on ers.skill_id=es.skill_id
      join public.equipment_assets ea on ea.id=ers.equipment_id
      where es.engineer_id=mse.engineer_id
        and ea.site_id=p_site_id and ea.area=p_area
        and coalesce(es.validated_rating,es.manager_rating,es.self_rating,0)>=ers.required_level
    ));

  select count(*) filter(where es.expiry_date between v_shift_date and v_shift_date+30)::int,
         count(*) filter(where es.expiry_date < v_shift_date)::int,
         min(es.expiry_date) filter(where es.expiry_date>=v_shift_date)
  into v_expiring,v_expired,v_next_expiry
  from public.engineer_skills es
  join public.engineers eng on eng.id=es.engineer_id
  where eng.site_id=p_site_id
    and es.expiry_date is not null
    and (p_area is null or exists (
      select 1
      from public.equipment_required_skills ers
      join public.equipment_assets ea on ea.id=ers.equipment_id
      where ers.skill_id=es.skill_id and ea.site_id=p_site_id and ea.area=p_area
    ));

  v_single_score := case when coalesce(v_single_points,0)=0 then 5 else least(100,45+v_single_points*15) end;
  v_leave_score := case when coalesce(v_leave_count,0)=0 then 5 else least(100,35+v_leave_count*15+v_cover_gaps*5) end;
  v_training_score := case when coalesce(v_expiring,0)=0 and coalesce(v_expired,0)=0 then 5
                           else least(100,35+coalesce(v_expired,0)*20+coalesce(v_expiring,0)*10) end;
  v_shift_label := case when v_shift_type='night' then 'Night' else 'Day' end;

  return jsonb_build_array(
    jsonb_build_object(
      'title','Shift Cover','slug','shift-cover','score',round(v_labour_risk,1),
      'description',v_shift_label||' shift labour and equipment-skill coverage',
      'metricLabel','Engineers scheduled','metricValue',v_scheduled::text,
      'extraLabel','Equipment cover gaps','extraValue',v_cover_gaps::text,
      'statusLabel',case when v_scheduled=0 then 'Critical no-cover override'
                         when v_labour_risk>=65 then 'High labour exposure'
                         when v_labour_risk>=40 then 'Reduced labour resilience'
                         when v_labour_risk>=20 then 'Low labour exposure'
                         else 'Labour coverage stable' end
    ),
    jsonb_build_object(
      'title','Single Point Risk','slug','single-point-failure','score',round(v_single_score,1),
      'description',case when v_single_points=0 then 'Qualified backup coverage is available'
                         else v_single_points::text||case when v_single_points=1 then ' asset has' else ' assets have' end||' no qualified backup' end,
      'metricLabel','Single-point assets','metricValue',v_single_points::text,
      'extraLabel','Assets without gap','extraValue',greatest(v_asset_count-v_single_points,0)::text,
      'statusLabel',case when v_single_points=0 then 'Backup coverage stable' else 'No qualified backup available' end
    ),
    jsonb_build_object(
      'title','Annual Leave','slug','annual-leave','score',round(v_leave_score,1),
      'description',case when v_leave_count=0 then 'No current-shift leave conflict'
                         else v_leave_count::text||case when v_leave_count=1 then ' relevant engineer is' else ' relevant engineers are' end||' unavailable' end,
      'metricLabel','Engineers off','metricValue',v_leave_count::text,
      'extraLabel','Critical cover','extraValue',case when v_leave_count=0 then 'Not impacted' when v_cover_gaps>0 then 'Reduced' else 'Maintained' end,
      'statusLabel',case when v_leave_count=0 then 'No leave conflict' else 'Leave affects current cover' end
    ),
    jsonb_build_object(
      'title','Training Risk','slug','training-expiring','score',round(v_training_score,1),
      'description',case when v_expiring=0 and v_expired=0 then 'No relevant skill expiries due'
                         when v_expired>0 then v_expired::text||' expired and '||v_expiring::text||' expiring skill records'
                         else v_expiring::text||' relevant skill records expiring' end,
      'metricLabel','Skills expiring','metricValue',v_expiring::text,
      'extraLabel','Next expiry','extraValue',case when v_next_expiry is null then 'None' else greatest(v_next_expiry-v_shift_date,0)::text||' days' end,
      'statusLabel',case when v_expiring=0 and v_expired=0 then 'Training coverage current' else 'Expiry action required' end
    )
  );
end;
$$;

revoke all on function private.vorta_build_scope_labour_cards_for_site(uuid,text) from public,anon,authenticated;

create or replace function private.vorta_refresh_dashboard_scope_cache_for_site(p_site_id uuid)
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $$
declare
  v_inserted integer := 0;
  v_site_operational numeric := 0;
  v_site_labour numeric := 0;
  v_site_score numeric := 0;
  v_site_level text;
  v_shift_date date := current_date;
  v_shift_type text := 'day';
  v_scheduled integer := 0;
  v_no_engineer boolean := false;
begin
  if p_site_id is null or not exists(select 1 from public.sites s where s.id=p_site_id) then
    return 0;
  end if;

  delete from private.vorta_dashboard_scope_cache c where c.site_id=p_site_id;

  insert into private.vorta_dashboard_scope_cache(
    site_id,scope_key,scope_type,scope_label,area,display_order,risk_score,risk_level,
    operational_risk_score,labour_risk_score,highest_child_id,highest_child_code,
    highest_child_name,highest_child_score,highest_child_level,asset_count,at_risk_asset_count,
    critical_asset_count,high_asset_count,overdue_pm_count,calibration_backlog_count,cover_gap_count,
    critical_spares_missing,scheduled_engineer_count,labour_shift_date,labour_shift_type,
    no_engineer_override,priority_action,risk_summary,child_cards,labour_cards,refreshed_at
  )
  with base as (
    select ea.area,ea.id,ea.equipment_code,ea.name,ea.equipment_type,ea.criticality,
           erp.risk_score,erp.risk_level,erp.operational_risk_score,erp.labour_risk_score,
           erp.overdue_pm_count,erp.calibration_overdue_count,erp.critical_spares_missing,
           erp.missing_skill_count,erp.single_point_skill_gap,erp.scheduled_engineer_count,
           erp.qualified_engineer_count,erp.no_engineer_override,erp.pm_backlog_pct,
           erp.calibration_pct,erp.skills_pct,erp.spares_pct,erp.asset_criticality_pct,
           erp.priority_action,erp.risk_summary,erp.labour_shift_date,erp.labour_shift_type
    from public.equipment_assets ea
    join public.equipment_risk_profiles erp on erp.equipment_id=ea.id
    where ea.site_id=p_site_id and ea.area is not null
  ), stats as (
    select area,count(*)::int asset_count,
           count(*) filter(where risk_score>=40)::int at_risk_count,
           count(*) filter(where risk_level='Critical')::int critical_count,
           count(*) filter(where risk_level='High')::int high_count,
           coalesce(sum(overdue_pm_count),0)::int overdue_pm,
           coalesce(sum(calibration_overdue_count),0)::int overdue_cal,
           count(*) filter(where coalesce(missing_skill_count,0)>0)::int cover_gaps,
           coalesce(sum(critical_spares_missing),0)::int missing_spares,
           max(operational_risk_score)::numeric max_op,avg(operational_risk_score)::numeric avg_op,
           count(*) filter(where operational_risk_score>=65)::int op_at_risk,
           max(labour_risk_score)::numeric max_lab,
           sum(labour_risk_score * case lower(coalesce(criticality,'')) when 'critical' then 4 when 'high' then 3 when 'medium' then 2 else 1 end)
             / nullif(sum(case lower(coalesce(criticality,'')) when 'critical' then 4 when 'high' then 3 when 'medium' then 2 else 1 end),0) weighted_lab,
           max(scheduled_engineer_count)::int scheduled,bool_or(no_engineer_override) no_eng,
           max(labour_shift_date) labour_shift_date,max(labour_shift_type) labour_shift_type
    from base group by area
  ), scored as (
    select s.*,
      least(96,greatest(5,round(s.max_op*.55+s.avg_op*.30+(s.op_at_risk::numeric/nullif(s.asset_count,0))*15,1))) op_score,
      round(least(100,greatest(0,coalesce(s.max_lab,0)*.60+coalesce(s.weighted_lab,0)*.40)),1) lab_score
    from stats s
  ), final as (
    select s.*,
      least(100,greatest(5,case when s.no_eng then greatest(round(s.op_score*.85+s.lab_score*.15)::int,85)
                                else round(s.op_score*.85+s.lab_score*.15)::int end)) area_score
    from scored s
  ), ranked as (
    select f.*,row_number() over(order by f.area_score desc,f.area)::int display_order
    from final f
  )
  select p_site_id,'area:'||r.area,'area',r.area,r.area,r.display_order,
         r.area_score,private.vorta_risk_level(r.area_score),r.op_score,r.lab_score,
         top_asset.id,top_asset.equipment_code,top_asset.name,top_asset.risk_score,top_asset.risk_level,
         r.asset_count,r.at_risk_count,r.critical_count,r.high_count,r.overdue_pm,r.overdue_cal,
         r.cover_gaps,r.missing_spares,r.scheduled,coalesce(r.labour_shift_date,current_date),
         case when r.labour_shift_type='night' then 'night' else 'day' end,r.no_eng,
         case when r.no_eng then 'Arrange immediate engineering or contractor cover for the current shift.'
              when r.lab_score>=65 then 'Restore qualified labour coverage for the highest-risk equipment in this area.'
              else coalesce(top_asset.priority_action,'Focus on the highest-risk asset and clear the largest leading risk driver.') end,
         case when r.no_eng then 'Area risk includes a critical current-shift labour override because no maintenance engineers are scheduled.'
              else 'Area risk combines operational equipment exposure at 85% with current-shift labour and skill coverage at 15%.' end,
         coalesce(children.cards,'[]'::jsonb),private.vorta_build_scope_labour_cards_for_site(p_site_id,r.area),now()
  from ranked r
  left join lateral (
    select b.id,b.equipment_code,b.name,b.risk_score,b.risk_level,b.priority_action
    from base b where b.area=r.area order by b.risk_score desc,b.name limit 1
  ) top_asset on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'kind','equipment','id',x.id,'label',x.name,'code',x.equipment_code,'equipmentType',x.equipment_type,
      'riskScore',x.risk_score,'riskLevel',x.risk_level,
      'primaryDriver',case when x.pm_backlog_pct>=greatest(x.calibration_pct,x.skills_pct,x.spares_pct,x.asset_criticality_pct) and x.pm_backlog_pct>0 then 'PM backlog'
                           when x.calibration_pct>=greatest(x.skills_pct,x.spares_pct,x.asset_criticality_pct) and x.calibration_pct>0 then 'Calibration backlog'
                           when x.skills_pct>=greatest(x.spares_pct,x.asset_criticality_pct) and x.skills_pct>0 then 'Labour coverage'
                           when x.spares_pct>=x.asset_criticality_pct and x.spares_pct>0 then 'Critical spares'
                           else 'Asset criticality' end,
      'highestChildName',null,'highestChildScore',null,'overduePmCount',x.overdue_pm_count,
      'calibrationBacklogCount',x.calibration_overdue_count,'criticalSparesMissing',x.critical_spares_missing,
      'coverGapCount',x.missing_skill_count,'labourRiskScore',x.labour_risk_score,
      'operationalRiskScore',x.operational_risk_score,'scheduledEngineerCount',x.scheduled_engineer_count,
      'qualifiedEngineerCount',x.qualified_engineer_count,'noEngineerOverride',x.no_engineer_override
    ) order by x.risk_score desc,x.name) cards
    from (select * from base b where b.area=r.area order by b.risk_score desc,b.name limit 4) x
  ) children on true;

  select coalesce(lr.labour_risk_score,0),coalesce(lr.shift_date,current_date),
         case when lr.shift_type='night' then 'night' else 'day' end,
         coalesce(lr.scheduled_engineer_count,0),coalesce(lr.no_engineer_override,false)
  into v_site_labour,v_shift_date,v_shift_type,v_scheduled,v_no_engineer
  from public.vorta_get_site_labour_risk_internal(p_site_id) lr limit 1;

  select least(96,greatest(5,round(
           coalesce(max(c.operational_risk_score),0)*.60+
           coalesce(avg(c.operational_risk_score),0)*.25+
           (select count(*) filter(where erp.operational_risk_score>=65)::numeric/nullif(count(*),0)
            from public.equipment_assets ea join public.equipment_risk_profiles erp on erp.equipment_id=ea.id
            where ea.site_id=p_site_id)*15,1)))
  into v_site_operational
  from private.vorta_dashboard_scope_cache c where c.site_id=p_site_id and c.scope_type='area';

  v_site_score := least(100,greatest(5,case when v_no_engineer then greatest(round(v_site_operational*.85+v_site_labour*.15,1),90)
                                            else round(v_site_operational*.85+v_site_labour*.15,1) end));
  v_site_level := private.vorta_risk_level(v_site_score);

  insert into private.vorta_dashboard_scope_cache(
    site_id,scope_key,scope_type,scope_label,area,display_order,risk_score,risk_level,
    operational_risk_score,labour_risk_score,highest_child_id,highest_child_code,
    highest_child_name,highest_child_score,highest_child_level,asset_count,at_risk_asset_count,
    critical_asset_count,high_asset_count,overdue_pm_count,calibration_backlog_count,cover_gap_count,
    critical_spares_missing,scheduled_engineer_count,labour_shift_date,labour_shift_type,
    no_engineer_override,priority_action,risk_summary,child_cards,labour_cards,refreshed_at
  )
  select p_site_id,'site','site','Site Risk',null,0,v_site_score,v_site_level,v_site_operational,v_site_labour,
         null,null,highest.scope_label,highest.risk_score,highest.risk_level,
         coalesce(sum(a.asset_count),0)::int,coalesce(sum(a.at_risk_asset_count),0)::int,
         coalesce(sum(a.critical_asset_count),0)::int,coalesce(sum(a.high_asset_count),0)::int,
         coalesce(sum(a.overdue_pm_count),0)::int,coalesce(sum(a.calibration_backlog_count),0)::int,
         coalesce(sum(a.cover_gap_count),0)::int,coalesce(sum(a.critical_spares_missing),0)::int,
         v_scheduled,v_shift_date,v_shift_type,v_no_engineer,
         case when v_no_engineer then 'Arrange immediate engineering or contractor cover: no maintenance engineer is scheduled for the current shift.'
              when v_site_labour>=65 then 'Restore qualified current-shift cover for exposed high-risk equipment.'
              else 'Focus on the highest-risk area and clear the largest leading risk backlog.' end,
         case when v_no_engineer then 'Site risk is subject to a critical labour override because the current shift has zero scheduled maintenance engineers.'
              else 'Site risk combines operational asset exposure at 85% with current-shift labour and skill coverage at 15%.' end,
         (select coalesce(jsonb_agg(jsonb_build_object(
             'kind','area','id',c.area,'label',c.scope_label,'code',null,'riskScore',c.risk_score,'riskLevel',c.risk_level,
             'primaryDriver',case when c.overdue_pm_count>=greatest(c.calibration_backlog_count,c.critical_spares_missing,c.cover_gap_count) and c.overdue_pm_count>0 then 'PM backlog'
                                  when c.calibration_backlog_count>=greatest(c.critical_spares_missing,c.cover_gap_count) and c.calibration_backlog_count>0 then 'Calibration backlog'
                                  when c.critical_spares_missing>=c.cover_gap_count and c.critical_spares_missing>0 then 'Critical spares'
                                  when c.cover_gap_count>0 then 'Labour coverage' else 'Asset criticality' end,
             'highestChildName',c.highest_child_name,'highestChildScore',c.highest_child_score,
             'overduePmCount',c.overdue_pm_count,'calibrationBacklogCount',c.calibration_backlog_count,
             'criticalSparesMissing',c.critical_spares_missing,'coverGapCount',c.cover_gap_count,
             'labourRiskScore',c.labour_risk_score,'operationalRiskScore',c.operational_risk_score,
             'scheduledEngineerCount',c.scheduled_engineer_count,'noEngineerOverride',c.no_engineer_override
           ) order by c.risk_score desc,c.scope_label),'[]'::jsonb)
          from (select * from private.vorta_dashboard_scope_cache c where c.site_id=p_site_id and c.scope_type='area' order by c.risk_score desc,c.scope_label limit 4) c),
         private.vorta_build_scope_labour_cards_for_site(p_site_id,null),now()
  from private.vorta_dashboard_scope_cache a
  cross join lateral (select c.scope_label,c.risk_score,c.risk_level from private.vorta_dashboard_scope_cache c where c.site_id=p_site_id and c.scope_type='area' order by c.risk_score desc,c.scope_label limit 1) highest
  where a.site_id=p_site_id and a.scope_type='area'
  group by highest.scope_label,highest.risk_score,highest.risk_level;

  select count(*)::int into v_inserted from private.vorta_dashboard_scope_cache c where c.site_id=p_site_id;
  return v_inserted;
end;
$$;

revoke all on function private.vorta_refresh_dashboard_scope_cache_for_site(uuid) from public,anon,authenticated;

select private.vorta_refresh_dashboard_scope_cache_for_site('11000000-0000-0000-0000-000000000004'::uuid);
