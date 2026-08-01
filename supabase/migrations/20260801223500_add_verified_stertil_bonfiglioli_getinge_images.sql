begin;

update public.equipment_assets
set
  image_url = 'https://a.storyblok.com/f/331954/1200x900/797132c5b3/s-series_pe-bumpers.jpg',
  image_source_url = 'https://stertil-dockproducts.com/products/stertil-dock-products/Levellers/Swing-Lip-Dock-Levellers-S-Series',
  image_source_type = 'manufacturer',
  image_match_basis = 'exact_model',
  image_attribution = 'Stertil Dock Products S-Series swing-lip dock leveller media',
  image_alt_text = 'Stertil S-Series swing-lip dock leveller',
  image_verified_at = now(),
  image_verification_status = 'verified',
  image_verification_note = 'Official Stertil S-Series product media. The exact installed platform size, frame and accessories require an approved site photograph.'
where site_id = '11000000-0000-0000-0000-000000000001'
  and equipment_code = 'DOCK-01'
  and lower(btrim(oem)) = 'stertil'
  and lower(btrim(model)) = 's-series';

update public.equipment_assets
set
  image_url = 'https://www.bonfiglioliengineering.com/hubfs/PK-V_FRONT_NEW_Path.original.png',
  image_source_url = 'https://www.bonfiglioliengineering.com/products/pk-v',
  image_source_type = 'manufacturer',
  image_match_basis = 'exact_model',
  image_attribution = 'Bonfiglioli Engineering PK-V product media',
  image_alt_text = 'Bonfiglioli Engineering PK-V in-line vial and bottle closure-integrity tester',
  image_verified_at = now(),
  image_verification_status = 'verified',
  image_verification_note = 'Official Bonfiglioli Engineering product media matched to model PK-V. The image is not represented as the exact installed serial asset.'
where site_id = '11000000-0000-0000-0000-000000000001'
  and equipment_code = 'LEAK-01'
  and lower(btrim(oem)) = 'bonfiglioli engineering'
  and upper(btrim(model)) = 'PK-V';

update public.equipment_assets
set
  image_url = 'https://www.getinge.com/siteassets/start/product-catalog/gew-cgmp-washerdryer/gew-cgmp-washer-dryer-1280x1280-2.jpg/constrain-0x640--2078645017.jpg',
  image_source_url = 'https://www.getinge.com/cn/products/gew-cgmp-/',
  image_source_type = 'manufacturer',
  image_match_basis = 'exact_model',
  image_attribution = 'Getinge GEW 888 cGMP washer/dryer product media',
  image_alt_text = 'Getinge GEW 888 cGMP washer and dryer',
  image_verified_at = now(),
  image_verification_status = 'verified',
  image_verification_note = 'Official Getinge product media explicitly labelled GEW 888. It is not represented as the exact installed site serial asset or configuration.'
where site_id = '11000000-0000-0000-0000-000000000001'
  and equipment_code = 'PW-01'
  and lower(btrim(oem)) = 'getinge'
  and upper(btrim(model)) = 'GEW 888';

commit;
