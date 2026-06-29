# Vorta Build Standard

Concise rules every Vorta page must follow. No exceptions without a documented reason.

---

## 1. Shell & Routing

Every portal uses `PortalShell` as its outer layout. Never build a custom layout wrapper.

```tsx
<PortalShell homeRoute="/dashboard" nav={primaryNav} secondaryNav={secondaryNav}>
  <Routes>…</Routes>
</PortalShell>
```

- `nav` accepts flat `NavItem[]` or grouped `NavGroup[]`.
- Pass `accentColor="emerald"` for operator/production portals; default `"blue"` for all others.
- `PortalShell` owns scroll-to-top on route change and mobile sidebar — do not re-implement these.
- `PageTransition` wraps children inside `PortalShell` automatically. Do not add extra fade wrappers.

Sidebar widths: `w-14` (icon-only, `<xl`) → `w-56` (expanded, `xl+`). Match these breakpoints in page content padding.

---

## 2. Page Structure

Every section component follows this outer wrapper:

```tsx
<section className="relative flex min-w-0 w-full flex-1 grow flex-col items-start gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
  <header …>…</header>
  {/* content */}
</section>
```

**Page header pattern** (required on every full-page section):

```tsx
<header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
  <div className="flex flex-col items-start gap-1">
    <div className="flex items-center gap-2">
      <h1 className="text-xl font-semibold text-slate-50">Page Title</h1>
      <ContextHelp content={…} />
    </div>
    <p className="text-sm text-slate-400">Subtitle — site / context</p>
  </div>
  <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
    {/* SyncIndicator is NOT in the header — place it below in its own row */}
    <ExplainWithAi pageId="…" />
    {/* refresh, bell, avatar buttons */}
  </div>
</header>
```

**Below the header, before any content:**

```tsx
<div className="flex w-full flex-col gap-4">
  <SyncIndicator loading={loading} source="Supabase" confidence={aiConfidence} />
  {!loading && <AiActionsPanel actions={aiActions} onReview={…} />}
</div>
```

---

## 3. Data Fetching

- Always call Supabase edge functions via `supabase.functions.invoke("function-name")`.
- Never query Supabase tables directly from dashboard/overview pages — use edge functions.
- Sub-pages (Engineers, Training, etc.) may query tables directly where they have RLS policies.
- Always run fetches in `useEffect` with a `cancelled` guard and a `finally` block that sets `loading = false`.
- Always provide a fallback/empty state — never render `undefined` values into the UI.
- Use a `tick` state counter to trigger refetch: `setTick(t => t + 1)`.

```tsx
useEffect(() => {
  let cancelled = false;
  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("my-function");
      if (cancelled || error || !data) return;
      setData(data);
    } catch { /* set safe fallback */ }
    finally { if (!cancelled) setLoading(false); }
  }
  load();
  return () => { cancelled = true; };
}, [tick]);
```

---

## 4. Component Usage Rules

| Need | Use | Never use |
|---|---|---|
| Animated KPI value | `CountUpNumber` | raw `<span>` with static value |
| Animated progress bar | `AnimatedProgress` | unstyled `<progress>` |
| Data sync status | `SyncIndicator` | custom "last updated" text |
| AI suggested actions | `AiActionsPanel` | hand-rolled action list |
| AI loading state | `AiAnalysing` | generic spinner |
| Empty list | `EmptyState` | blank or null |
| Page contextual help | `ContextHelp` | tooltip from scratch |
| AI narrative explainer | `ExplainWithAi` | — |
| Select/dropdown | `Select` component | native `<select>` |
| Trend arrow | `TrendIndicator` | hand-coded chevron + colour logic |

**Detail panel:** Use the overlay modal pattern already in `DashboardOverviewSection` (fixed inset backdrop + centered card). Do not import `DetailDrawer` for modal-style detail — `DetailDrawer` is a slide-over for full record editing.

---

## 5. AI Actions Panel

Always derive `AiAction[]` from live data, not hardcoded strings. Limit to 4 actions.

```tsx
const aiActions: AiAction[] = (() => {
  const actions: AiAction[] = [];
  if (topRisk) actions.push({ label: `…`, description: "…", priority: "critical", icon: AlertTriangle, href: "/requirements" });
  actions.push({ label: "Book training for top gaps", description: "…", priority: "high", icon: GraduationCap, href: "/training" });
  // …
  return actions.slice(0, 4);
})();
```

---

## 6. Today's Priorities Panel

Include on any dashboard that has live risk/action data. Pattern:

- Rendered below `AiActionsPanel`, above KPI cards.
- Max 3 items. Each item: severity badge, icon with coloured dot, short title, one-line reason, "Take Action" button routing to the relevant page.
- Border/background: `border-[#facc1520] bg-[#0d1118]` (amber-tinted).
- Falls back safely: if no urgent items, render nothing (not an empty state card).

---

## 7. KPI Cards

- Dashboard pages: 4 cards maximum. Grid: `sm:grid-cols-2 lg:grid-cols-4`.
- Always use `CountUpNumber` for the metric value.
- Always provide a sparkline or icon on the right.
- Cards are clickable — `role="button"`, `tabIndex={0}`, navigate on click.
- Animation: `motion-safe:animate-card-enter` with staggered `animationDelay`.

---

## 8. Deep AI Content

Do not render detailed AI insight sections on first load. Collapse them behind a toggle:

```tsx
<div className="border-t border-gray-800 pt-6">
  <button onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-2 …">
    <Sparkles className="h-4 w-4 text-blue-400" />
    <span className="text-sm font-semibold text-slate-200">Full AI Report</span>
    {open ? <ChevronUp … /> : <ChevronDown … />}
  </button>
  {open && <div className="mt-4"><AiInsightsSection /></div>}
</div>
```

---

## 9. Loading States

- Show `animate-pulse rounded bg-gray-800` skeleton elements during loading.
- Match the skeleton shape to the real content (same height, approximate width).
- Never show a blank screen — always have a loading fallback rendered.
- Use `AiAnalysing` for AI-specific loading states inside cards.

---

## 10. Responsive Behaviour

- All grids must have a single-column mobile base: `grid-cols-1`.
- Two-column splits at `sm:` or `lg:` depending on card width.
- Tables: wrap in `overflow-x-auto`. Provide a mobile card-list alternative for tables with > 4 columns.
- Page padding: `px-4 md:px-6 xl:px-8`. Never use fixed widths for page sections.

---

## 11. Supabase & Edge Functions

- Never create new Supabase tables without running the `bolt-database` skill first.
- RLS: every table needs 4 policies (SELECT, INSERT, UPDATE, DELETE). Never use `FOR ALL`.
- Edge functions live in `supabase/functions/<slug>/index.ts`. Always write to disk before deploying.
- Every edge function response must include the CORS headers block.

---

## 12. Build

Run `npm run build` before marking any task complete. The build must produce zero TypeScript errors.
