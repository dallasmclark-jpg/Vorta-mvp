# VOR-033 demo-data operations

The Wrexham Maintenance Manager demonstration dataset is synthetic, but every visible claim must be supported by connected operational evidence. The maintenance controls remain in the `private` schema and are executable only by `service_role`.

## Recovery baselines

Two production baselines protect the work:

- `vor-033-before-credible-demo-refresh`, ID `da1496d5-b170-480e-8463-eac3a61797af`, captured before the first date and identifier correction;
- `vor-033-before-storyline-enrichment`, ID `7109ceec-d00d-4d98-9f84-ede1b48431b7`, captured before narrative and storyline enrichment.

The baseline payload includes site-scoped equipment, work orders, confirmations, PM and calibration schedules, components, stock, documents, knowledge chunks, fault codes and notifications. Direct table and function access is restricted to `service_role`.

## Pre-demo date refresh

Run this from a trusted service-role or database-administration context, never from the browser:

```sql
select private.vorta_refresh_demo_dataset_dates_internal(
  '11000000-0000-0000-0000-000000000001'::uuid,
  current_date
);
```

The refresh deterministically maintains:

- controlled overdue, due-soon and future open-work populations;
- recent completed work and confirmation evidence for Shift Handover;
- overdue, due-soon and scheduled PM and calibration records;
- current calibration certificate dates;
- recalculated equipment, area and site risk plus the maintenance work plan;
- the approved narrative and priority action for each connected demonstration storyline.

## Credibility gate

Run after every refresh and before a presentation:

```sql
select private.vorta_get_demo_dataset_credibility_internal(
  '11000000-0000-0000-0000-000000000001'::uuid,
  current_date
);
```

Do not present unless `healthy` is `true`. The report fails closed when it finds:

- visible seed language in asset, document or knowledge fields shown by the interface;
- implausible work-order or PM date distributions;
- mismatched overdue or status flags;
- insufficient recent completions;
- repeated prominent work-order narratives;
- a storyline with an unresolved work order, notification, PM, spare, document, skill or qualified engineer;
- incomplete operational evidence for any of the ten highest-risk assets;
- a failing existing backend health contract.

Internal storage paths and metadata that deliberately identify the deployment as demonstration data are not treated as user-visible defects.

## Connected demonstration storylines

The private `vorta_demo_storylines` registry contains six active, fully linked storylines and 24 prepared Maintenance Manager questions.

### FD-03 vacuum and condenser recovery

- Work order: `WO-260706`
- Notification: `NT-26007`
- PM: `PM-260704`
- Spare: `FD-03-PLC-01`
- Document: `FD-03 Approved Fault-Finding Guide`
- Skill and engineer: Vacuum Systems, Nia Roberts
- Measured evidence: vacuum-pump current 18.6 A against a 15.0 A baseline

### RABS-01 interlock recovery

- Work order: `WO-261006`
- Notification: `NT-26010`
- PM: `PM-261004`
- Spare: `RABS-01-PLC-01`
- Document: `RABS-01 Approved Fault-Finding Guide`
- Skill and engineer: HVAC Validation, Natalie Morgan
- Measured evidence: the door-interlock input dropped out twice after cleaning

### VF-02 reject sensor recovery

- Work order: `WO-250467`
- Notification: `N-260002`
- PM: `PM-VF02-SENSOR-CAL-M`
- Spare: `VF02-SENS-014`
- Document: `VF-02 Reject Station Fault-Finding Guide`
- Skill and engineer: Bosch Vial Fillers, James Mitchell
- Fault evidence: recurring `F-204` false rejects

### WFI-01 conductivity recovery

- Work order: `WO-250414`
- PM: `PM-WFI-COND-WK`
- Spare: `WFI1-COND-001`
- Document: `WFI Conductivity and Loop Temperature Fault-Finding Guide`
- Skill and engineer: Conductivity Monitoring, Priya Shah
- Fault evidence: repeated positive bias against the grab sample

### AHU-01 HEPA differential-pressure recovery

- Work order: `WO-250447`
- PM: `PM-HVAC-HEPA-CAL`
- Spare: `HVAC-DP-001`
- Document: `AHU-01 HEPA Differential Pressure Fault-Finding Guide`
- Skill and engineer: Pressure Instrument Calibration, Nia Roberts
- Fault evidence: upper-range transmitter drift while the calibrated reference remains stable

### COLD-01 probe disagreement and handover

- Work order: `WO-T0302`
- PM: `PM-COLD-PROBE-CAL`
- Spare: `COLD-01-SEN-C01`
- Document: `COLD-01 Approved Diagnostic and Recovery Guide`
- Skill and engineer: Environmental Monitoring Systems, Gareth Owen
- Measured evidence: dual probes differed by 1.3 °C during defrost recovery

## Current production health

On 1 August 2026 the combined gate reported:

- overall `healthy: true`;
- six active and six fully linked storylines;
- 24 prepared Maintenance Manager questions;
- zero visible seed identifiers in the expanded interface-field scan;
- zero work-order narrative groups repeated three or more times;
- complete evidence coverage for all ten highest-risk assets;
- 107 open work orders distributed across overdue, due-soon and future windows;
- 156 completed work orders, including recent shift-handover evidence;
- 149 PM records with a controlled backlog and forward schedule;
- 40 calibration records with certificate evidence;
- the existing backend health contract passing all eight checks.

## Current limitations

The baseline is captured but automated restore has not yet been approved. Restore remains a controlled database-administration action until exact replacement and foreign-key sequencing are independently validated.

The 24 questions are a grounded demonstration set, but real Ask Vorta response quality and latency still require live evaluation. Selected asset imagery and complete phone, tablet and desktop presentation rehearsals also remain outstanding. VOR-033 must remain `In progress` until those checks and production verification are recorded.
