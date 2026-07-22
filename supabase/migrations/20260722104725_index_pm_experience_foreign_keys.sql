create index if not exists engineer_pm_experience_engineer_fk_idx
  on public.engineer_pm_experience_snapshots (engineer_id);
create index if not exists engineer_pm_experience_equipment_fk_idx
  on public.engineer_pm_experience_snapshots (equipment_id);
create index if not exists engineer_source_identities_verified_by_idx
  on public.engineer_source_identities (verified_by)
  where verified_by is not null;
create index if not exists engineer_source_identities_import_batch_idx
  on public.engineer_source_identities (import_batch_id)
  where import_batch_id is not null;
