# Equipment pilot-evidence module boundaries

The live Equipment pilot-evidence UI is split by user workflow rather than kept in one combined implementation file.

## Boundaries

- `EquipmentPilotEvidenceShared.tsx` owns the request-state hook, trusted page frame, shared metrics, evidence states and formatting helpers.
- `EquipmentWorkEvidenceDetails.tsx` owns confirmation, reservation and goods-movement detail rendering shared by Work Orders and History.
- `LiveEquipmentWorkOrdersPilotView.tsx` owns execution readiness and the work-order register.
- `LiveEquipmentHistoryView.tsx` owns searchable maintenance history.
- `LiveEquipmentDocumentsView.tsx` owns the controlled-document register.
- `LiveEquipmentDocumentViewerView.tsx` owns controlled-source and indexed-section viewing.

`EquipmentLiveRoutes.tsx` imports each route implementation directly. The former combined `EquipmentPilotEvidenceViews.tsx` module is intentionally removed rather than retained as a compatibility barrel.

## Change rules

Keep site scoping, evidence loading and fail-closed behaviour in their existing service modules. Do not move data fetching into route registration or merge the workflow views back together. Any shared UI added to the shared module must be used by more than one workflow.
