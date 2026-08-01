-- VOR-033 Phase 3C: capture the complete credible state used for exact restore verification.
select private.vorta_capture_demo_dataset_baseline_internal(
  '11000000-0000-0000-0000-000000000001'::uuid,
  'vor-033-credible-v2-restore-test',
  current_date
);
