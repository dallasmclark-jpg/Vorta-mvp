# VOR-020 to VOR-024 change summary

This batch repairs the two pilot-trust failures found by VOR-006 and implements the three related engineering improvements.

## Database

- Canonicalises site operational risk and uses it in refresh and monitoring.
- Backfills honest summary-only knowledge chunks for documents whose extracted summaries were already stored.
- Adds an internal site-scoped Engineers evidence bundle and three measured composite indexes.

## Edge Function

- Updates `engineers-data` to one bundle RPC and exposes privacy-safe evidence load timing.

## Frontend

- Preserves Equipment tab vertical position in the actual PortalShell scroller.
- Preserves route-specific position across back and forward navigation.
- Scopes selected-tab CSS to the Vorta portal and removes global `!important` escalation.

## Tests

- Adds VOR-020 to VOR-024 source contracts.
- Corrects Equipment continuity browser coverage to test the actual nested scroller.
- Updates selected-tab and Engineers evidence contracts for the new architecture.
