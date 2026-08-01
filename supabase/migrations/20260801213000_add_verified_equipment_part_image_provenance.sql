begin;

alter table public.equipment_assets
  add column if not exists image_source_url text,
  add column if not exists image_source_type text,
  add column if not exists image_match_basis text,
  add column if not exists image_attribution text,
  add column if not exists image_alt_text text,
  add column if not exists image_verified_at timestamptz,
  add column if not exists image_verification_status text not null default 'missing',
  add column if not exists image_verification_note text;

alter table public.equipment_components
  add column if not exists oem_part_number text,
  add column if not exists image_url text,
  add column if not exists image_source_url text,
  add column if not exists image_source_type text,
  add column if not exists image_match_basis text,
  add column if not exists image_attribution text,
  add column if not exists image_alt_text text,
  add column if not exists image_verified_at timestamptz,
  add column if not exists image_verification_status text not null default 'blocked_identity',
  add column if not exists image_verification_note text;

update public.equipment_assets
set
  image_verification_status = case
    when nullif(btrim(image_url), '') is null then 'missing'
    else 'legacy_unverified'
  end,
  image_verification_note = case
    when nullif(btrim(image_url), '') is null then 'No verified equipment image has been attached.'
    else 'Existing image requires provenance verification before it can be treated as operational evidence.'
  end
where image_verification_status in ('missing', 'legacy_unverified')
   or image_verification_status is null;

update public.equipment_components
set
  image_verification_status = case
    when nullif(btrim(oem_part_number), '') is null then 'blocked_identity'
    when nullif(btrim(image_url), '') is null then 'missing'
    else 'legacy_unverified'
  end,
  image_verification_note = case
    when nullif(btrim(oem_part_number), '') is null then 'Exact OEM manufacturer part number is not recorded; an exact product image cannot be verified.'
    when nullif(btrim(image_url), '') is null then 'No verified part image has been attached.'
    else 'Existing image requires provenance verification before it can be treated as operational evidence.'
  end
where image_verification_status in ('blocked_identity', 'missing', 'legacy_unverified')
   or image_verification_status is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'equipment_assets_image_verification_status_check'
  ) then
    alter table public.equipment_assets
      add constraint equipment_assets_image_verification_status_check
      check (image_verification_status in ('missing', 'blocked_identity', 'legacy_unverified', 'verified'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'equipment_assets_image_source_type_check'
  ) then
    alter table public.equipment_assets
      add constraint equipment_assets_image_source_type_check
      check (
        image_source_type is null
        or image_source_type in ('site_photo', 'manufacturer', 'authorised_supplier')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'equipment_assets_image_match_basis_check'
  ) then
    alter table public.equipment_assets
      add constraint equipment_assets_image_match_basis_check
      check (
        image_match_basis is null
        or image_match_basis in ('exact_asset', 'exact_model', 'product_family', 'software_product')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'equipment_assets_verified_image_evidence_check'
  ) then
    alter table public.equipment_assets
      add constraint equipment_assets_verified_image_evidence_check
      check (
        image_verification_status <> 'verified'
        or (
          nullif(btrim(image_url), '') is not null
          and nullif(btrim(image_source_url), '') is not null
          and image_source_type is not null
          and image_match_basis is not null
          and image_verified_at is not null
          and nullif(btrim(image_alt_text), '') is not null
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'equipment_components_image_verification_status_check'
  ) then
    alter table public.equipment_components
      add constraint equipment_components_image_verification_status_check
      check (image_verification_status in ('missing', 'blocked_identity', 'legacy_unverified', 'verified'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'equipment_components_image_source_type_check'
  ) then
    alter table public.equipment_components
      add constraint equipment_components_image_source_type_check
      check (
        image_source_type is null
        or image_source_type in ('site_photo', 'manufacturer', 'authorised_supplier')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'equipment_components_image_match_basis_check'
  ) then
    alter table public.equipment_components
      add constraint equipment_components_image_match_basis_check
      check (image_match_basis is null or image_match_basis = 'exact_part');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'equipment_components_verified_image_evidence_check'
  ) then
    alter table public.equipment_components
      add constraint equipment_components_verified_image_evidence_check
      check (
        image_verification_status <> 'verified'
        or (
          nullif(btrim(oem_part_number), '') is not null
          and nullif(btrim(image_url), '') is not null
          and nullif(btrim(image_source_url), '') is not null
          and image_source_type is not null
          and image_match_basis = 'exact_part'
          and image_verified_at is not null
          and nullif(btrim(image_alt_text), '') is not null
        )
      );
  end if;
end
$$;

create index if not exists equipment_assets_site_image_status_idx
  on public.equipment_assets (site_id, image_verification_status);

create index if not exists equipment_components_site_image_status_idx
  on public.equipment_components (site_id, image_verification_status);

comment on column public.equipment_assets.image_verification_status is
  'Whether equipment imagery is missing, blocked by insufficient identity, legacy/unverified, or backed by recorded provenance.';
comment on column public.equipment_components.oem_part_number is
  'Exact manufacturer catalogue or OEM service part number. Internal SAP/Vorta material references do not satisfy exact-image verification.';
comment on column public.equipment_components.image_verification_status is
  'A spare-part image may be verified only when the exact OEM part number and authoritative image provenance are recorded.';

commit;
