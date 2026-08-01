-- VOR-033: capture the current Wrexham dataset, remove user-facing seed identifiers and rebase dates.

do $$
declare
  v_site_id constant uuid := '11000000-0000-0000-0000-000000000001'::uuid;
  mapping record;
begin
  perform private.vorta_capture_demo_dataset_baseline_internal(
    v_site_id,
    'vor-033-before-credible-demo-refresh',
    current_date
  );

  for mapping in
    select old_code,new_code
    from private.vorta_demo_equipment_code_map
    where site_id=v_site_id
    order by old_code
  loop
    if exists (
      select 1
      from public.equipment_assets asset
      where asset.site_id=v_site_id
        and asset.equipment_code=mapping.new_code
        and asset.equipment_code<>mapping.old_code
    ) then
      raise exception 'Cannot rename equipment % to % because the target code exists',mapping.old_code,mapping.new_code;
    end if;

    update public.equipment_fault_codes fault
    set fault_code=replace(fault.fault_code,mapping.old_code,mapping.new_code),
        hmi_text_pattern=replace(fault.hmi_text_pattern,mapping.old_code,mapping.new_code),
        fault_name=replace(fault.fault_name,mapping.old_code,mapping.new_code),
        source_reference=replace(fault.source_reference,mapping.old_code,mapping.new_code),
        metadata=case when fault.metadata is null then null else replace(fault.metadata::text,mapping.old_code,mapping.new_code)::jsonb end,
        updated_at=now()
    from public.equipment_assets asset
    where asset.id=fault.equipment_id
      and asset.site_id=v_site_id
      and concat_ws(' ',fault.fault_code,fault.hmi_text_pattern,fault.fault_name,fault.source_reference,fault.metadata::text) like '%'||mapping.old_code||'%';

    update public.work_orders
    set description=replace(description,mapping.old_code,mapping.new_code),
        fault_code=replace(fault_code,mapping.old_code,mapping.new_code),
        functional_location_code=replace(functional_location_code,mapping.old_code,mapping.new_code),
        order_type_description=replace(order_type_description,mapping.old_code,mapping.new_code),
        maintenance_activity_type_description=replace(maintenance_activity_type_description,mapping.old_code,mapping.new_code),
        order_origin=replace(order_origin,mapping.old_code,mapping.new_code),
        updated_at=now()
    where site_id=v_site_id
      and concat_ws(' ',description,fault_code,functional_location_code,order_type_description,maintenance_activity_type_description,order_origin) like '%'||mapping.old_code||'%';

    update public.work_order_confirmations confirmation
    set confirmation_text=replace(confirmation.confirmation_text,mapping.old_code,mapping.new_code),
        updated_at=now()
    where confirmation.site_id=v_site_id
      and confirmation.confirmation_text like '%'||mapping.old_code||'%';

    update public.preventive_maintenance
    set title=replace(title,mapping.old_code,mapping.new_code),
        procedure_ref=replace(procedure_ref,mapping.old_code,mapping.new_code),
        checklist_ref=replace(checklist_ref,mapping.old_code,mapping.new_code),
        calibration_point=replace(calibration_point,mapping.old_code,mapping.new_code),
        certificate_reference=replace(certificate_reference,mapping.old_code,mapping.new_code),
        updated_at=now()
    where site_id=v_site_id
      and concat_ws(' ',title,procedure_ref,checklist_ref,calibration_point,certificate_reference) like '%'||mapping.old_code||'%';

    update public.equipment_components
    set component_name=replace(component_name,mapping.old_code,mapping.new_code),
        component_code=replace(component_code,mapping.old_code,mapping.new_code),
        functional_location_code=replace(functional_location_code,mapping.old_code,mapping.new_code),
        updated_at=now()
    where site_id=v_site_id
      and concat_ws(' ',component_name,component_code,functional_location_code) like '%'||mapping.old_code||'%';

    update public.site_material_stock
    set material_number=replace(material_number,mapping.old_code,mapping.new_code),
        material_description=replace(material_description,mapping.old_code,mapping.new_code),
        updated_at=now()
    where site_id=v_site_id
      and concat_ws(' ',material_number,material_description) like '%'||mapping.old_code||'%';

    update public.knowledge_documents
    set source_document_id=replace(source_document_id,mapping.old_code,mapping.new_code),
        title=replace(title,mapping.old_code,mapping.new_code),
        external_reference=replace(external_reference,mapping.old_code,mapping.new_code),
        drawing_number=replace(drawing_number,mapping.old_code,mapping.new_code),
        manual_section=replace(manual_section,mapping.old_code,mapping.new_code),
        summary=replace(summary,mapping.old_code,mapping.new_code),
        extracted_summary=replace(extracted_summary,mapping.old_code,mapping.new_code),
        metadata=case when metadata is null then null else replace(metadata::text,mapping.old_code,mapping.new_code)::jsonb end,
        updated_at=now()
    where site_id=v_site_id
      and concat_ws(' ',source_document_id,title,external_reference,drawing_number,manual_section,summary,extracted_summary,metadata::text) like '%'||mapping.old_code||'%';

    update public.knowledge_chunks chunk
    set chunk_ref=replace(chunk.chunk_ref,mapping.old_code,mapping.new_code),
        section_title=replace(chunk.section_title,mapping.old_code,mapping.new_code),
        chunk_text=replace(chunk.chunk_text,mapping.old_code,mapping.new_code),
        drawing_number=replace(chunk.drawing_number,mapping.old_code,mapping.new_code),
        external_reference=replace(chunk.external_reference,mapping.old_code,mapping.new_code),
        metadata=case when chunk.metadata is null then null else replace(chunk.metadata::text,mapping.old_code,mapping.new_code)::jsonb end,
        updated_at=now()
    from public.equipment_assets asset
    where asset.id=chunk.equipment_id
      and asset.site_id=v_site_id
      and concat_ws(' ',chunk.chunk_ref,chunk.section_title,chunk.chunk_text,chunk.drawing_number,chunk.external_reference,chunk.metadata::text) like '%'||mapping.old_code||'%';

    update public.maintenance_notifications
    set short_text=replace(short_text,mapping.old_code,mapping.new_code),
        long_text=replace(long_text,mapping.old_code,mapping.new_code),
        functional_location_code=replace(functional_location_code,mapping.old_code,mapping.new_code),
        updated_at=now()
    where site_id=v_site_id
      and concat_ws(' ',short_text,long_text,functional_location_code) like '%'||mapping.old_code||'%';

    update public.equipment_risk_profiles profile
    set risk_summary=replace(profile.risk_summary,mapping.old_code,mapping.new_code),
        priority_action=replace(profile.priority_action,mapping.old_code,mapping.new_code),
        updated_at=now()
    from public.equipment_assets asset
    where asset.id=profile.equipment_id
      and asset.site_id=v_site_id
      and concat_ws(' ',profile.risk_summary,profile.priority_action) like '%'||mapping.old_code||'%';

    update public.maintenance_risk_work_plan
    set risk_driver=replace(risk_driver,mapping.old_code,mapping.new_code),
        updated_at=now()
    where site_id=v_site_id and risk_driver like '%'||mapping.old_code||'%';

    update public.equipment_assets
    set equipment_code=mapping.new_code,updated_at=now()
    where site_id=v_site_id and equipment_code=mapping.old_code;
  end loop;

  update public.site_material_stock
  set material_number='CH1-GSK-015',updated_at=now()
  where site_id=v_site_id and material_number='CH1-GSK-SAMPLE';

  update public.equipment_fault_codes fault
  set source_reference=regexp_replace(fault.source_reference,'(?i)\s+rev\s+demo$',' Rev 4'),
      updated_at=now()
  from public.equipment_assets asset
  where asset.id=fault.equipment_id
    and asset.site_id=v_site_id
    and fault.source_reference ~* '\s+rev\s+demo$';

  update public.work_orders
  set order_type_description=regexp_replace(order_type_description,'(?i)^demo[ _-]*','','g'),
      maintenance_activity_type_description=regexp_replace(maintenance_activity_type_description,'(?i)^demo[ _-]*','','g'),
      user_status_codes=coalesce((
        select array_agg(value order by ordinal)
        from unnest(user_status_codes) with ordinality status(value,ordinal)
        where value !~* '(^|[-_ ])demo([-_ ]|$)'
      ),array[]::text[]),
      updated_at=now()
  where site_id=v_site_id;

  perform private.vorta_refresh_demo_dataset_dates_internal(v_site_id,current_date);
end;
$$;

do $$
declare
  v_report jsonb;
begin
  v_report := private.vorta_get_demo_dataset_credibility_internal(
    '11000000-0000-0000-0000-000000000001'::uuid,
    current_date
  );

  if not coalesce((v_report->>'healthy')::boolean,false) then
    raise exception 'VOR-033 demo dataset credibility contract failed: %',v_report;
  end if;
end;
$$;
