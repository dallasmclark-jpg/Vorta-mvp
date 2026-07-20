# Live Equipment pilot evidence

This release enables the Maintenance Manager live-data workflow for Equipment History, controlled Documents and linked work execution evidence.

## Evidence readers

The client uses three authenticated, `SECURITY INVOKER` RPCs:

- `vorta_get_equipment_history(uuid)`
- `vorta_get_equipment_documents(uuid)`
- `vorta_get_equipment_document(uuid, uuid)`

The functions shape authorised records but do not bypass row-level security. Existing equipment, site and document-role policies remain the access authority. `anon` and `public` execution are revoked.

## Work execution evidence

Equipment History can return:

- Work-order identity, dates, status, outcome and fault code
- SAP confirmation text and engineer evidence
- Material reservations and required/reserved/withdrawn quantities
- Posted goods movements and material-document references

Reversed confirmations and goods movements are excluded from the evidence counts.

## Controlled documents

Documents are returned only when they are linked to the authorised equipment or its active site and the current user satisfies the document-role policy. The document viewer presents indexed source sections as the citation boundary for Ask Vorta.

External source links are opened only for valid HTTP or HTTPS URLs.

## Truth-safe states

Evidence sources are tracked independently as loading, available, empty or unavailable. A failed source does not erase successfully loaded evidence. Readiness values are not calculated when their required source is unavailable, and an empty backlog is not represented as 100% readiness.

Overdue work is derived from completion state and a valid due date earlier than the current local date. Imported overdue flags are supporting evidence rather than the final authority.

## Ask Vorta citations

Work-order prompts include available work-order, confirmation, reservation and material-document references. Document prompts include title, revision, controlled reference and indexed page or section references. Missing evidence is stated explicitly and is not replaced with demonstration records.

## Validation performed

- Authorised Maintenance Manager access returned site-scoped history and documents.
- The same user received zero rows for equipment belonging to another site.
- Maintenance Manager TypeScript checking passed.
- The complete static contract suite passed after updating the former live-tab lock contract.
