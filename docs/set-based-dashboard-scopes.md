# Set-based dashboard scopes

This focused backend performance batch replaces repeated per-area Dashboard scope and labour-card calculations with shared set-based facts.

## Scope

- Preserve the existing eight-row site and area scope contract.
- Preserve all existing labour-card wording and scoring semantics.
- Build highest-equipment, at-risk counts, cover gaps and top-four child cards from one ranked equipment set.
- Build site and all area labour cards from shared shift, leave, required-skill and expiry facts.
- Reject the migration unless the complete legacy and candidate JSON outputs match exactly.

## Expected impact

The existing scope builder accounts for most of the remaining operational Dashboard snapshot latency. This migration removes repeated correlated scans and repeated calls to the labour-card helper without changing the UI contract.
