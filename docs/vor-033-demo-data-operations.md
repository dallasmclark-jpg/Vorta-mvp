# VOR-033 demo-data operations

The Wrexham maintenance-manager demonstration dataset is synthetic, but every visible claim must be supported by connected operational evidence. The controls in this change remain in the `private` schema and are executable only by `service_role`.

## Production baseline

Before the first credibility refresh, the migration captures a named baseline in `private.vorta_demo_dataset_baselines`:

```sql
select private.vorta_capture_demo_dataset_baseline_internal(
  '11000000-0000-0000-0000-000000000001'::uuid,
  'vor-033-before-credible-demo-refresh',
  current_date
);
```

The stored payload contains the site-scoped equipment, work orders, confirmations, PM and calibration schedules, components, stock, documents, knowledge chunks, fault codes and notifications needed for recovery work. Direct table and function access is restricted to `service_role`.

## Pre-demo date refresh

Run this from a trusted service-role or database-administration context, never from the browser:

```sql
select private.vorta_refresh_demo_dataset_dates_internal(
  '11000000-0000-0000-0000-000000000001'::uuid,
  current_date
);
```

The refresh deterministically maintains:

- a controlled overdue, due-soon and future open-work distribution;
- recent completed work and confirmation evidence for Shift Handover;
- overdue, due-soon and scheduled PM and calibration records;
- certificate dates for calibration evidence;
- recalculated equipment, area and site risk plus the maintenance work plan.

## Credibility gate

Run after every refresh and before a presentation:

```sql
select private.vorta_get_demo_dataset_credibility_internal(
  '11000000-0000-0000-0000-000000000001'::uuid,
  current_date
);
```

Do not present the demonstration unless `healthy` is `true`. The report fails closed when it finds visible seed identifiers, implausible work-order or PM date distributions, mismatched overdue/status flags, insufficient recent completions or a failing existing backend health contract.

## Current limitations

This phase creates and verifies a recoverable baseline but does not expose an automated restore operation. Restore must remain a controlled database-administration action until exact replacement and foreign-key sequencing have been tested independently. Equipment imagery, prominent narrative rewriting, the six cross-module demonstration storylines and the golden Ask Vorta question set remain later VOR-033 phases.
