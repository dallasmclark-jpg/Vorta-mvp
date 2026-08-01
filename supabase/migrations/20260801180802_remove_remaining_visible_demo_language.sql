-- VOR-033: remove three remaining visible demo phrases from current knowledge-document summaries.
update public.knowledge_documents
set summary = case source_document_id
    when 'ILEARN-BOSCH-VF-OEM-2026' then 'Training record summarising validated Bosch vial filler competency, refresher status and skill gaps for engineering support.'
    when 'EDOC-GEA-FD-MAN-5.1' then 'Approved OEM manual covering vacuum leak checks, condenser performance, shelf-temperature deviation and CIP/SIP readiness for the freeze dryer.'
    when 'SAPWO-VF-REPEAT-INFEED-2026' then 'Summarised SAP PM history showing repeat infeed sensor faults and previous corrective actions for Bosch Vial Filler VF-01.'
    else summary
  end,
  extracted_summary = case source_document_id
    when 'ILEARN-BOSCH-VF-OEM-2026' then 'Training record summarising validated Bosch vial filler competency, refresher status and skill gaps for engineering support.'
    when 'EDOC-GEA-FD-MAN-5.1' then 'Approved OEM manual covering vacuum leak checks, condenser performance, shelf-temperature deviation and CIP/SIP readiness for the freeze dryer.'
    when 'SAPWO-VF-REPEAT-INFEED-2026' then 'Summarised SAP PM history showing repeat infeed sensor faults and previous corrective actions for Bosch Vial Filler VF-01.'
    else extracted_summary
  end,
  updated_at = now()
where site_id = '11000000-0000-0000-0000-000000000001'::uuid
  and source_document_id in ('ILEARN-BOSCH-VF-OEM-2026','EDOC-GEA-FD-MAN-5.1','SAPWO-VF-REPEAT-INFEED-2026');
