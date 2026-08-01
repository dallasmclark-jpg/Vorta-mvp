begin;

-- Official KUKA KR QUANTEC family media. The record identifies the robot family
-- but not the exact payload/reach variant, end effector or palletising cell, so
-- the image is deliberately classified as product_family rather than exact_asset.
update public.equipment_assets
set
  image_url = 'https://www.kuka.com/-/media/kuka-corporate/images/products/robots/cta-images/kr-quantec.png?hash=E0EA4800C0D37AC774EE89BD1E4F2758&rev=-1&w=767',
  image_source_url = 'https://www.kuka.com/en-gb/products/robotics-systems/industrial-robots/kr-quantec',
  image_source_type = 'manufacturer',
  image_match_basis = 'product_family',
  image_attribution = 'KUKA KR QUANTEC product-family media',
  image_alt_text = 'KUKA KR QUANTEC industrial robot product-family image',
  image_verified_at = now(),
  image_verification_status = 'verified',
  image_verification_note = 'Official KUKA KR QUANTEC product-family media. The exact robot variant, gripper and installed palletising cell require an approved site photograph for exact-asset representation.'
where site_id = '11000000-0000-0000-0000-000000000001'
  and equipment_code = 'PAL-02'
  and lower(btrim(oem)) = 'kuka'
  and upper(btrim(model)) = 'KR QUANTEC';

commit;
