# Vorta typography system

**Governance:** VOR-100  
**Brand audit finding:** FIND-003  
**Status:** implementation baseline

## Intent

Vorta typography should feel precise, technical and industrial without sacrificing the dense readability required by maintenance and risk workflows. The system deliberately keeps Inter as the stable UI/body workhorse and introduces Inter Tight only where a more authored Vorta display voice adds value.

The typography system is a hierarchy, not a page-by-page styling exercise. New product and brand surfaces should use the named roles below instead of inventing local font sizes, weights or tracking.

## Font families

- **UI / body:** Inter
- **Display / page headings / major KPIs:** Inter Tight, with Inter as the fallback
- **Monospace:** not part of the core brand system. Use only where genuine code or machine-readable content requires it.

## Weight policy

- **400:** body copy and long-form reading
- **500:** controls, metadata, technical values and subordinate UI emphasis
- **600:** page titles, section titles, card headings, KPIs and technical labels
- **700:** reserved for exceptional marketing/display emphasis. It is not the normal product hierarchy.

Avoid 800/900 weights in the operational product.

## Canonical roles

| Role | Family | Size | Weight | Line height | Tracking | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Product page title | Inter Tight | 28px | 600 | 34px | -0.025em | Mobile 26/32 |
| Section title | Inter Tight | 20px | 600 | 26px | -0.018em | Primary section hierarchy |
| Card title | Inter | 16px | 600 | 22px | -0.01em | Keep card hierarchy quieter than page/section titles |
| Body | Inter | 14px | 400 | 21px | 0 | Default operational reading size |
| UI / control | Inter | 14px | 500 | 20px | -0.005em | Buttons, tabs, filters, navigation |
| Metadata | Inter | 12px | 500 | 18px | 0 | Supporting context only |
| Technical eyebrow | Inter | 11px | 600 | 16px | +0.08em | Uppercase. Use sparingly for genuine technical/section labels |
| Large KPI | Inter Tight | 32px | 600 | 36px | -0.025em | Mobile 28/32 |
| Compact KPI | Inter Tight | 26px | 600 | 30px | -0.025em | Mobile 24/28 |
| Marketing display | Inter Tight | 64px | 600 | 64px | -0.04em | Mobile 42/44; marketing only |

## Numerals

Operational numerals use **lining tabular figures** so values do not jump horizontally when data refreshes. This is the default inside the Vorta product page shell and is mandatory for comparable metrics such as:

- risk scores and risk reduction
- percentages and OEE
- work-order counts
- stock and spares quantities
- PM/calibration counts and overdue days
- labour/skills counts
- historical comparisons and trends

Units are subordinate to the value. Use `data-vorta-unit="true"` or `.vorta-type-unit` when a component needs an explicit unit treatment.

## Technical labels and values

Uppercase tracked labels are reserved for deliberate technical/section cues such as **RISK INTELLIGENCE**. Do not convert ordinary navigation, body copy or every card label to uppercase.

Identifiers and timestamps use the normal Inter UI family with medium weight, tabular numerals and restrained tracking. General product copy must not become monospace.

## Implementation hooks

The runtime baseline is defined in `src/typography-system.ts`. Available explicit role classes/attributes include:

- `.vorta-type-page-title`
- `.vorta-type-section-title`
- `.vorta-type-card-title`
- `.vorta-type-body`
- `.vorta-type-control`
- `.vorta-type-metadata`
- `.vorta-type-eyebrow`
- `.vorta-type-kpi`
- `.vorta-type-kpi-compact`
- `.vorta-type-marketing-display`
- `.vorta-type-unit`
- `.vorta-type-technical-value`
- `data-vorta-kpi="true"`
- `data-vorta-technical-label="true"`
- `data-vorta-eyebrow="true"`
- `data-vorta-unit="true"`
- `data-vorta-identifier="true"`
- `data-vorta-timestamp="true"`

Existing carefully tuned responsive font sizes remain authoritative. The shared typography layer supplies family, weight, tracking and numeral behaviour without flattening page-specific responsive work.

## Accessibility and release rules

- Do not reduce established body sizes to create visual density.
- Avoid light font weights on the dark navy product environment.
- Do not use tracking that makes long labels clip or wrap unexpectedly.
- Long labels, tables, Ask Vorta answers, loading/empty/error states and phone layouts must be checked after typography changes.
- Inter Tight remains a display layer only if responsive visual verification proves it improves character without harming readability or reflow.
- Any future family replacement requires a dedicated snag and side-by-side review. Do not silently replace the body/UI family.
