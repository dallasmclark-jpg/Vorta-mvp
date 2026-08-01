begin;

-- Official Körber Pharma / Seidenader VI-S machine-platform media.
-- The manufacturer's page identifies the displayed machine as the VI-S platform.
update public.equipment_assets
set
  image_url = 'https://www.koerber-pharma.com/fileadmin/_processed_/7/5/csm_Jpgpro_out_29b943ff1237a9145fce5cb314bb2c74_281ce490b2.jpg',
  image_source_url = 'https://www.koerber-pharma.com/en/solutions/inspection/automatic-inspection/machine-platforms',
  image_source_type = 'manufacturer',
  image_match_basis = 'exact_model',
  image_attribution = 'Körber Pharma / Seidenader VI-S product media',
  image_alt_text = 'Seidenader VI-S automatic pharmaceutical inspection machine',
  image_verified_at = now(),
  image_verification_status = 'verified',
  image_verification_note = 'Official Körber Pharma machine-platform media matched to Seidenader VI-S. It is not represented as the exact installed serial asset or customer configuration.'
where site_id = '11000000-0000-0000-0000-000000000001'
  and equipment_code = 'VI-03'
  and lower(btrim(oem)) = 'seidenader'
  and upper(btrim(model)) = 'VI-S';

commit;
