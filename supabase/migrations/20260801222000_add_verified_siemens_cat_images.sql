begin;

-- Siemens publishes this as valid promotional product media for Desigo CC.
-- The record represents a software platform, so it is classified separately
-- from photographs of installed physical assets.
update public.equipment_assets
set
  image_url = 'https://sid.siemens.com/api/khub/documents/W1n8RRkjQUJAKChpkTPcog/content',
  image_source_url = 'https://sid.siemens.com/v/u/A6V13263127',
  image_source_type = 'manufacturer',
  image_match_basis = 'software_product',
  image_attribution = 'Siemens Desigo CC promotional product media, download A6V13263127',
  image_alt_text = 'Siemens Desigo CC building-management software promotional image',
  image_verified_at = now(),
  image_verification_status = 'verified',
  image_verification_note = 'Official Siemens Desigo CC product media. This represents the software platform and is not a photograph of the installed site workstation or panels.'
where site_id = '11000000-0000-0000-0000-000000000001'
  and equipment_code = 'BMS-01'
  and lower(btrim(oem)) = 'siemens'
  and lower(btrim(model)) = 'desigo cc';

-- The database records the engine family and prime rating but not a complete
-- generator package variant. Use the official C18 DE660E0 50 Hz family image
-- as product-family evidence and do not imply it is the installed enclosure.
update public.equipment_assets
set
  image_url = 'https://s7d2.scene7.com/is/image/Caterpillar/CM20200320-7f5d8-ddd82?$hero-cc-t1$',
  image_source_url = 'https://www.cat.com/en_GB/products/new/power-systems/electric-power/diesel-generator-sets/116978.html',
  image_source_type = 'manufacturer',
  image_match_basis = 'product_family',
  image_attribution = 'Caterpillar C18 DE660E0 50 Hz diesel generator product media',
  image_alt_text = 'Caterpillar C18 diesel generator product-family image',
  image_verified_at = now(),
  image_verification_status = 'verified',
  image_verification_note = 'Official Caterpillar C18 DE660E0 product media matched to the recorded C18 600 kVA family/rating. The exact site enclosure and package options require an approved site photograph.'
where site_id = '11000000-0000-0000-0000-000000000001'
  and equipment_code = 'GEN-01'
  and lower(btrim(oem)) = 'caterpillar'
  and upper(btrim(model)) = 'C18 600 KVA';

commit;
