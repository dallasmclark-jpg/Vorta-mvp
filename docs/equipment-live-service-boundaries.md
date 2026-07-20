# Equipment live evidence and service boundaries

## Audit outcome

The live evidence view module duplicated the request-state hook, page frame, metrics, loading state, evidence warning, refresh control, Ask Vorta control, date formatting and risk tone already owned by `EquipmentPilotEvidenceShared.tsx`. Those foundations are now shared.

The unused `LiveEquipmentWorkOrdersView` implementation was removed. The live Work Orders route remains owned by `LiveEquipmentWorkOrdersPilotView.tsx`, including execution readiness and SAP evidence.

## equipmentService decision

`equipmentService.ts` remains a compatibility surface for this batch. It mixes legacy/demo adapters, operational dashboard readers, risk planning, knowledge search and older Equipment tabs, so splitting it by line count would create broad import churn without improving pilot behaviour.

New readers must not be added there by default. Prefer focused service modules such as `equipmentLiveTrust.ts` and `equipmentPilotEvidence.ts`. A future service extraction should be domain-led and preserve the existing public exports until consumers move deliberately.

## Fallback language

Service diagnostics must describe what the function actually returns. Work Orders and PM readers return empty verified states on failure, not mock rows. Skills retains legacy compatibility data for older demo routes and labels that behaviour explicitly.

## Protected behaviour

- Live Equipment routes remain site-scoped and fail closed.
- The pilot Work Orders, History and Documents modules are unchanged.
- No Supabase queries, RPC names, risk calculations or fallback return values changed.
- Shift Cover and the Maintenance Manager dashboard are outside this change.
