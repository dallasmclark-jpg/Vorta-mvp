# Dashboard scope cache

This focused backend performance batch moves repeated Dashboard scope and labour-card construction off the page-load path while preserving the existing UI contract.

## Scope

- Preserve the complete eight-row site and area scope result.
- Preserve all labour-card wording, scoring and child-card content.
- Keep the existing scope calculator as the source of truth.
- Store its typed result in a private cache after site-risk refreshes.
- Read the cache in display order, with a live-calculation fallback if it is unexpectedly empty.
- Reject activation unless the cached JSON and final reader hash exactly match the legacy output.

## Refresh behaviour

A private trigger refreshes the cache after inserts or updates to `site_risk_profile`, which is updated by the existing risk-refresh workflow. Expensive labour and correlated equipment calculations therefore occur during deliberate risk recalculation rather than on every Dashboard page load.

## Security

The cache table and refresh functions remain private and are not granted to `anon` or `authenticated`. The existing public access-controlled wrapper remains unchanged.
