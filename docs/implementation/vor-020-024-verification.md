# VOR-020 to VOR-024 verification evidence

Audited base: `e409b83144ff07a51f9c0d021cfdce9679b94c83`

## VOR-020 canonical site risk

- Added `private.vorta_calculate_site_operational_risk(uuid)` as the shared operational component.
- Site refresh and backend health verification now use the same calculation.
- Supabase baseline health rerun: `site_risk_formula_consistent` passed with expected `68.2`, actual `68.2`, canonical operational component `73.8`.
- The current profile stores operational `73.8` and total site risk `68.2`.

## VOR-021 document knowledge coverage

- Repaired all current documents that had an extracted summary but no retrievable chunks.
- Summary-derived chunks are explicitly labelled `summary_only` and `fullDocumentIndexed=false`.
- Current evidence: 147 current documents, zero without chunks, 72 summary-only, 75 full-text.
- All 72 summary-only chunks expose an explicit summary-only provenance label.
- Pilot readiness rerun `d696ac32-178a-4463-ab8d-53574a0d4eed`: pass, 43 checks passed, zero failed, one warning for 14 source records without locators. No locators were invented.

## VOR-023 Engineers evidence performance

- Replaced three sequential Edge Function query waves with one service-role-only site and organisation scoped bundle RPC.
- Added only measured composite indexes for the bundle's hot filters.
- Direct database benchmark on the pilot site: 40.620 ms for 19 engineers, 720 assignments, 8 gaps and 27 bookings.
- Anonymous and authenticated direct execution are revoked; service role execution is granted.
- `engineers-data` Edge Function version 13 is active with JWT verification enabled.

## VOR-024 Equipment tab continuity

- Equipment tabs now locate and preserve the actual PortalShell overflow container rather than `window.scrollY`.
- Positions are stored per equipment and route, including browser back and forward navigation.
- Horizontal tab position and keyboard focus behavior are retained.
- The browser regression now scrolls and asserts the real PortalShell container.

## VOR-022 selected-tab hardening

- Selected-state CSS is scoped to `data-vorta-portal-shell` rather than leaking to all application ARIA tabs.
- Removed all `!important` declarations from the selected-tab stylesheet.
- Equipment tabs now declare `data-vorta-tab-outline` intent explicitly.
- The portal role-based fallback remains temporarily to preserve the agreed site-wide treatment while remaining raw tab implementations are migrated.

## Remaining verification

- Run the complete TypeScript, contract, route smoke, production build and performance suites.
- Run authenticated Playwright across phone, tablet portrait, tablet landscape, laptop and desktop.
- Verify production and the separate live-pilot context.
- Observe at least 24 consecutive hourly site-risk health passes before VOR-020 can be marked Complete.
