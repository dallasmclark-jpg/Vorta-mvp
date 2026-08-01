begin;

-- Records whose current identity is too broad, internally named or inconsistent
-- remain image-blocked until a site photograph or exact manufacturer model is
-- recorded. This is intentional: no generic category image is substituted.
update public.equipment_assets
set
  image_verification_status = 'blocked_identity',
  image_verification_note = case equipment_code
    when 'FD-01' then 'OEM/model conflict requires correction or an approved site photograph before imagery can be verified.'
    when 'FD-02' then 'OEM/model conflict requires correction or an approved site photograph before imagery can be verified.'
    else 'Current model describes a site configuration or broad system rather than a uniquely verifiable manufacturer product. Supply an approved site photograph or exact model.'
  end
where site_id = '11000000-0000-0000-0000-000000000001'
  and equipment_code in (
    'AHU-01','AUT-01','AUT-02','CIP-01','COLD-01','FD-01','FD-02','LB-01',
    'PSG-01','RABS-01','SC-01','VF-01','VF-02','VI-01','WFI-01','WMS-02'
  );

-- Exact MiR600 product image supplied by an authorised MiR distributor.
update public.equipment_assets
set
  image_url = 'https://idec-fs.com/mir-assets/image/products/img_products-2_mir600-detail.png',
  image_source_url = 'https://www.idec-fs.com/en/mir/Products/mir600/',
  image_source_type = 'authorised_supplier',
  image_match_basis = 'exact_model',
  image_attribution = 'MiR600 product media, IDEC Factory Solutions / Mobile Industrial Robots',
  image_alt_text = 'MiR600 autonomous mobile robot product image',
  image_verified_at = now(),
  image_verification_status = 'verified',
  image_verification_note = 'Manufacturer and model match MiR MiR600. Product image is not represented as the exact installed site vehicle.'
where site_id = '11000000-0000-0000-0000-000000000001'
  and equipment_code = 'AGV-01'
  and lower(btrim(oem)) = 'mir'
  and lower(btrim(model)) = 'mir600';

-- GEA ALUS product-family media. ALUS systems are configured to each line, so
-- the provenance explicitly avoids claiming this is the installed arrangement.
update public.equipment_assets
set
  image_url = 'https://images.folloze.com/image/upload/c_lfill%2Cw_486/c_limit%2Ch_1800%2Cw_1800/f_auto/q_auto/e_sharpen/ptys5p7wrshql5ihsmkn.png',
  image_source_url = 'https://explore.gea.com/simply-better2/items/alus-automatic-loading--unloading-for-lyophilizers',
  image_source_type = 'manufacturer',
  image_match_basis = 'product_family',
  image_attribution = 'GEA ALUS automatic loading and unloading systems product media',
  image_alt_text = 'GEA ALUS automatic loading and unloading system product-family image',
  image_verified_at = now(),
  image_verification_status = 'verified',
  image_verification_note = 'Official GEA ALUS product-family media. Exact installed layout may differ and should be replaced by an approved site photograph when available.'
where site_id = '11000000-0000-0000-0000-000000000001'
  and equipment_code = 'ALUS-01'
  and lower(btrim(oem)) = 'gea'
  and upper(btrim(model)) = 'ALUS';

-- GEA LYOVAC systems are custom configured. The official family image is
-- therefore labelled product_family rather than exact_asset.
update public.equipment_assets
set
  image_url = 'https://cdn.gea.com/-/media/migratedfromtridion/products/lyovac-freeze-dryer-overview-4163.jpg?h=1350&hash=5C89B7F75D3A06AA1C30F6ACF599C532&iar=0&rev=aefea1702a724849bf0723d4db8c5dd2&w=2400',
  image_source_url = 'https://www.gea.com/en/products/dryers-particle-processing/lyophilizers/lyovac-freeze-dryer/',
  image_source_type = 'manufacturer',
  image_match_basis = 'product_family',
  image_attribution = 'GEA LYOVAC pharmaceutical freeze dryer product media',
  image_alt_text = 'GEA LYOVAC pharmaceutical freeze dryer product-family image',
  image_verified_at = now(),
  image_verification_status = 'verified',
  image_verification_note = 'Official GEA LYOVAC product-family media. LYOVAC systems are customer configured; this is not claimed to be the exact installed FD-03 arrangement.'
where site_id = '11000000-0000-0000-0000-000000000001'
  and equipment_code = 'FD-03'
  and lower(btrim(oem)) = 'gea'
  and upper(btrim(model)) like 'LYOVAC%';

-- Exact Fedegari FOD product media.
update public.equipment_assets
set
  image_url = 'https://fedegari.com/wp-content/uploads/2019/03/fod_top.jpg',
  image_source_url = 'https://fedegari.com/en/prodotto/fod-dry-heat-sterilization/',
  image_source_type = 'manufacturer',
  image_match_basis = 'exact_model',
  image_attribution = 'Fedegari FOD dry-heat sterilizer product media',
  image_alt_text = 'Fedegari FOD dry-heat sterilizer and depyrogenation oven',
  image_verified_at = now(),
  image_verification_status = 'verified',
  image_verification_note = 'Official manufacturer product media matched to Fedegari model FOD. It is not claimed to show the site-specific installed serial asset.'
where site_id = '11000000-0000-0000-0000-000000000001'
  and equipment_code = 'DH-01'
  and lower(btrim(oem)) = 'fedegari'
  and upper(btrim(model)) = 'FOD';

commit;
