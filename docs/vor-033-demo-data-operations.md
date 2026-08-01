# VOR-033 demo-data operations

The Wrexham Maintenance Manager demonstration dataset is synthetic, but every visible claim must be supported by connected operational evidence. All maintenance controls remain in the `private` schema and are executable only by `service_role`.

## Recovery baselines

Three production baselines protect the work:

- `vor-033-before-credible-demo-refresh`, ID `da1496d5-b170-480e-8463-eac3a61797af`, captured before the first date and identifier correction;
- `vor-033-before-storyline-enrichment`, ID `7109ceec-d00d-4d98-9f84-ede1b48431b7`, captured before narrative and storyline enrichment;
- `vor-033-credible-v2-restore-test`, ID `b1a899c5-8335-4837-b2b3-f434d5f06f30`, the complete credible state used to verify the restore path.

The current snapshot contains 14 evidence groups:

- equipment assets and fault codes;
- PM and calibration schedules;
- equipment components and site stock;
- documents and knowledge chunks;
- maintenance notifications and notification-to-order links;
- work orders and confirmations;
- material reservations and goods movements;
- shift-handover actions.

## Pre-demo date refresh

Run from a trusted service-role or database-administration context, never from the browser:

```sql
select private.vorta_refresh_demo_dataset_dates_internal(
  '11000000-0000-0000-0000-000000000001'::uuid,
  current_date
);
```

The refresh maintains controlled overdue, due-soon and future work populations, recent completion evidence, PM and calibration schedules, certificate dates, risk calculations, the work plan and the approved narrative for each connected storyline.

## Credibility gate

Run after every refresh and before a presentation:

```sql
select private.vorta_get_demo_dataset_credibility_internal(
  '11000000-0000-0000-0000-000000000001'::uuid,
  current_date
);
```

Do not present unless `healthy` is `true`. The report fails closed for visible seed language, implausible date distributions, inconsistent statuses, insufficient recent completions, repeated prominent work narratives, unresolved storyline evidence, incomplete top-ten asset coverage or a failing backend health contract.

Internal storage paths and metadata that identify the deployment as demonstration data are not treated as visible UI defects.

## Snapshot and restore

Capture or refresh a named baseline:

```sql
select private.vorta_capture_demo_dataset_baseline_internal(
  '11000000-0000-0000-0000-000000000001'::uuid,
  'pre-demo-2026-08-01',
  current_date
);
```

Verify current data against a baseline without changing it:

```sql
select private.vorta_get_demo_baseline_restore_health_internal(
  'b1a899c5-8335-4837-b2b3-f434d5f06f30'::uuid
);
```

Run the service-role-only restore:

```sql
select private.vorta_restore_demo_dataset_baseline_internal(
  'b1a899c5-8335-4837-b2b3-f434d5f06f30'::uuid
);
```

The restore:

- takes a site-specific transaction advisory lock;
- upserts captured rows in foreign-key dependency order;
- supports existing and missing captured row IDs;
- recalculates equipment, area and site risk;
- rebuilds the maintenance work plan;
- reapplies approved demonstration narratives;
- compares all 14 evidence groups with their baseline;
- raises an exception and rolls back when semantic equality is not achieved.

Trigger-maintained `updated_at` timestamps are excluded from equality because the upsert correctly refreshes them. Source-system timestamps and all operational values remain part of the comparison.

The complete restore function was executed against baseline `b1a899c5-8335-4837-b2b3-f434d5f06f30`. Every evidence group returned matching counts and hashes, and both the restore gate and combined dataset credibility gate remained healthy.

A deliberately destructive missing-row rehearsal was not performed in production because the deployment safety guard rejected deletion of live demonstration rows. The restore uses `INSERT ... ON CONFLICT` and is designed to recreate captured missing IDs, but that scenario should be rehearsed in an isolated Supabase branch before VOR-033 is marked complete.

## Connected demonstration storylines

The private `vorta_demo_storylines` registry contains six active, fully linked storylines and 24 prepared Maintenance Manager questions.

| Storyline | Work | PM / calibration | Spare | Controlled evidence | Validated capability |
| --- | --- | --- | --- | --- | --- |
| FD-03 vacuum and condenser recovery | `WO-260706`, `NT-26007` | `PM-260704` | `FD-03-PLC-01` | `FD-03 Approved Fault-Finding Guide` | Nia Roberts, Vacuum Systems |
| RABS-01 interlock recovery | `WO-261006`, `NT-26010` | `PM-261004` | `RABS-01-PLC-01` | `RABS-01 Approved Fault-Finding Guide` | Natalie Morgan, HVAC Validation |
| VF-02 reject sensor recovery | `WO-250467`, `N-260002` | `PM-VF02-SENSOR-CAL-M` | `VF02-SENS-014` | `VF-02 Reject Station Fault-Finding Guide` | James Mitchell, Bosch Vial Fillers |
| WFI-01 conductivity recovery | `WO-250414` | `PM-WFI-COND-WK` | `WFI1-COND-001` | `WFI Conductivity and Loop Temperature Fault-Finding Guide` | Priya Shah, Conductivity Monitoring |
| AHU-01 HEPA DP recovery | `WO-250447` | `PM-HVAC-HEPA-CAL` | `HVAC-DP-001` | `AHU-01 HEPA Differential Pressure Fault-Finding Guide` | Nia Roberts, Pressure Instrument Calibration |
| COLD-01 probe disagreement | `WO-T0302` | `PM-COLD-PROBE-CAL` | `COLD-01-SEN-C01` | `COLD-01 Approved Diagnostic and Recovery Guide` | Gareth Owen, Environmental Monitoring Systems |

## Ask Vorta golden evaluation

The repository contains a separate 24-question suite at `tests/evals/vor-033-demo-golden.json`. It checks expected tools, exact linked evidence, safe uncertainty, structured findings, action plans, evidence links and response traceability.

Run the established operational suite:

```bash
npm run eval:ask-vorta:live
```

Run the VOR-033 connected-storyline suite:

```bash
npm run eval:ask-vorta:vor033
```

Authentication can use `VORTA_EVAL_TOKEN`, or the protected Supabase URL, anon key and E2E account variables already supported by the evaluator. `VORTA_EVAL_LIMIT` can be used for a bounded diagnostic run.

The suite structure and tool references are covered by the normal contract gate. Actual live model response quality and latency have not yet been certified for all 24 questions.

## Current production health

On 1 August 2026:

- combined dataset credibility: healthy;
- restore equality: healthy across 14 evidence groups;
- six of six storylines fully linked;
- 24 prepared Maintenance Manager questions;
- zero visible seed identifiers in the expanded UI-field scan;
- zero work-order narrative groups repeated three or more times;
- complete evidence coverage for all ten highest-risk assets;
- 107 open and 156 completed work orders;
- 149 PM records and 40 calibration records;
- existing backend health contract: 8/8.

## Remaining verification

VOR-033 remains `In progress` until all of the following are recorded:

- the 24-question live Ask Vorta run and latency review;
- missing-row restore rehearsal in an isolated database branch;
- selected equipment imagery;
- complete phone, tablet and desktop demonstration rehearsal;
- merged deployment and production verification against every acceptance criterion.
