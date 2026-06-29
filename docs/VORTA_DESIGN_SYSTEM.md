# Vorta Design System

The single source of truth for colours, typography, spacing, and components. See also `/design-system` (internal route) for a live interactive reference.

---

## Colour Palette

All colours are Tailwind utilities applied directly. No CSS variables in JSX.

### Backgrounds (darkest → lightest)

| Token | Hex | Usage |
|---|---|---|
| `bg-[#090b10]` | `#090b10` | Sidebar, drawer, modal overlay |
| `bg-[#0b0e14]` | `#0b0e14` | Page background (`PortalShell` root) |
| `bg-[#0d1118]` | `#0d1118` | Today's Priorities panel, AI panels |
| `bg-[#0d1523]` | `#0d1523` | `AiActionsPanel` background |
| `bg-[#111620]` | `#111620` | Action card bodies, list row alternates |
| `bg-[#141820]` | `#141820` | All `Card` components |
| `bg-[#1a2030]` | `#1a2030` | Hover state for interactive rows/cards |

### Borders

| Class | Usage |
|---|---|
| `border-gray-800` | Default card and table borders |
| `border-gray-700` | Secondary/hover borders |
| `border-[#ffffff20]` | Button outline borders |
| `border-blue-500/30` | AI panel active ring |

### Semantic colours

| Semantic | Text class | Background class | Border class |
|---|---|---|---|
| Critical | `text-red-500` | `bg-[#ef444420]` | `border-red-500/20` |
| High | `text-orange-400` | `bg-[#f9731620]` | `border-orange-500/20` |
| Medium | `text-yellow-400` | `bg-[#facc1520]` | `border-yellow-500/20` |
| Low / Success | `text-emerald-400` | `bg-[#10b98120]` | `border-emerald-500/20` |
| Info / AI / Live | `text-blue-400` | `bg-[#3b82f620]` | `border-blue-500/20` |

### AI confidence colour rule (`SyncIndicator`)

```
>= 80  → text-emerald-500
>= 60  → text-yellow-400
< 60   → text-red-400
```

---

## Typography

Three weights only: `font-medium` (400/500), `font-semibold` (600), no bold (700) except data values and initials.

| Use | Class |
|---|---|
| Page heading | `text-xl font-semibold text-slate-50` |
| Card / section heading | `text-sm font-semibold text-slate-200` (or `text-base`) |
| Body strong | `text-sm font-medium text-slate-200` |
| Body regular | `text-sm text-slate-400` |
| Label (field, column) | `text-xs font-medium text-slate-400` |
| Section label (ALL CAPS) | `text-[11px] font-semibold uppercase tracking-wider text-slate-500` |
| Caption / meta | `text-[10px] text-slate-500` |
| KPI metric value | `text-xl font-semibold tabular-nums` + semantic colour |
| Table header | `text-[10px] font-semibold uppercase tracking-wider text-slate-500` |

---

## Spacing System

Base unit: **8px**. Use Tailwind scale only.

- Page outer padding: `px-4 md:px-6 xl:px-8`
- Page top padding: `pt-0` (header handles it via `py-5`)
- Page bottom padding: `pb-12`
- Card internal padding: `p-5` (use `p-4` for compact cards)
- Gap between major sections: `gap-6 md:gap-8`
- Gap between cards in a row: `gap-4`
- Gap between items in a list: `gap-3` (rows), `gap-0.5` (tight lists with `divide-y`)

---

## Cards

All cards use the same base. Never create ad-hoc `div` panels that look like cards.

```tsx
<Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
  <CardContent className="flex flex-col gap-4 p-5">
    …
  </CardContent>
</Card>
```

**Clickable card** — add:

```tsx
role="button" tabIndex={0}
onClick={() => navigate(route)}
onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(route); }}
className="… cursor-pointer transition-all hover:border-blue-500/40 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
```

**Staggered entrance animation:**

```tsx
className="motion-safe:animate-card-enter"
style={{ animationDelay: `${i * 80}ms` }}
```

---

## Badges

Never use `variant="default"` or `variant="secondary"` Shadcn defaults — always override with Vorta semantic classes.

```tsx
// Status
<Badge className="inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none bg-[#10b98120] text-emerald-400">Available</Badge>

// Risk (with coloured dot)
<Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#ef444420] px-2 py-1 text-xs font-medium text-red-500 shadow-none">
  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />Critical
</Badge>

// Priority (with border)
<Badge className="… bg-[#ef444418] text-red-400 border border-red-500/20">Critical</Badge>
```

---

## Buttons

**Primary:**
```tsx
<Button className="bg-blue-600 text-white hover:bg-blue-500">Action</Button>
```

**Secondary / outline:**
```tsx
<Button variant="outline" className="border-[#ffffff20] bg-[#ffffff1a] text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">Secondary</Button>
```

**Destructive:**
```tsx
<Button className="bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/20">Delete</Button>
```

**Icon-only:**
```tsx
<button className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 hover:bg-[#ffffff1a] hover:text-slate-200 transition-colors">
  <Icon className="h-5 w-5" />
</button>
```

---

## Form Inputs

```tsx
<input className="h-9 w-full rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
```

With icon: wrap in `relative`, add `pl-9`, position icon with `absolute left-3 top-1/2 -translate-y-1/2`.

Error state: replace border with `border-red-500/50 ring-1 ring-red-500/30`.

---

## Tables

```tsx
<div className="w-full overflow-x-auto rounded-xl border border-gray-800">
  <table className="w-full min-w-[600px] border-collapse text-sm">
    <thead>
      <tr className="border-b border-gray-800 bg-[#0f1318]">
        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Column</th>
      </tr>
    </thead>
    <tbody>
      <tr className={`cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}>
        …
      </tr>
    </tbody>
  </table>
</div>
```

---

## Drawers / Slide-overs

Right-side panel for detailed record views. Pattern:

```tsx
<div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
<aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-gray-800 bg-[#090b10] shadow-2xl">
  <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">…</header>
  <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">…</div>
</aside>
```

---

## Modal / Detail Overlay

For short contextual detail (not full record editing). Centered over a darkened backdrop.

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.72)" }} onClick={onClose}>
  <div className="w-full max-w-md rounded-xl border border-gray-700 bg-[#0d1523] shadow-[0_16px_48px_rgba(0,0,0,0.6)]" onClick={e => e.stopPropagation()}>
    {/* header / body / footer */}
  </div>
</div>
```

---

## Tabs

```tsx
<div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-[#0b0e14] p-1">
  {tabs.map(t => (
    <button
      key={t}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active === t ? "bg-[#1a2030] text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {t}
    </button>
  ))}
</div>
```

---

## Tooltips

CSS-only pattern — no external library.

```tsx
<div className="group relative inline-flex">
  {children}
  <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-gray-700 bg-[#1a2030] px-2.5 py-1.5 text-[11px] text-slate-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
    Tooltip text
    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
  </div>
</div>
```

---

## Loading Skeletons

Single utility class — always animate-pulse, always `bg-gray-800`, always `rounded`.

```tsx
<div className="h-4 w-28 animate-pulse rounded bg-gray-800" />
```

Match height to the content it represents:
- KPI value: `h-7 w-16`
- Body text: `h-3 w-3/4`
- Sub-text: `h-2.5 w-1/2`
- Avatar/icon: `h-8 w-8 rounded-lg`
- Badge: `h-5 w-14 rounded`

---

## Shared AI Components

### SyncIndicator

Place directly below the page header, before any cards.

```tsx
<SyncIndicator loading={loading} source="Supabase" confidence={aiConfidence} />
```

Props: `loading`, `source`, `confidence` (0–100), `syncedAt` (Date).

### AiActionsPanel

```tsx
<AiActionsPanel actions={aiActions} onReview={(a) => setDetailItem(aiActionToDetail(a))} />
```

Always 4 actions max. Each action: `label`, `description`, `priority`, `icon`, optional `href`.

### AiAnalysing

```tsx
<AiAnalysing message="AI is analysing skill gaps…" />          // inline
<AiAnalysing block message="Generating report…" className="w-full" />  // block
```

### CountUpNumber

```tsx
<CountUpNumber value="74%" className="text-xl font-semibold text-slate-50" delay={200} />
```

Parses numeric prefix/suffix automatically. Respects `prefers-reduced-motion`.

### AnimatedProgress

```tsx
<AnimatedProgress value={74} className="h-2 overflow-hidden rounded bg-gray-800 [&>div]:bg-emerald-500" />
```

---

## Icons

Library: **Lucide React** only. No other icon sets.

Standard sizes:
- `h-3.5 w-3.5` — badge / tight list icons
- `h-4 w-4` — inline / card icons
- `h-5 w-5` — navigation, featured icons
- `h-8 w-8` — avatar-area icons

Default colour: `text-slate-400` (inactive), semantic colour (active/alert).

Always add `aria-hidden="true"` to decorative icons. Add `aria-label` to icon-only buttons.

---

## Animations

Defined in `tailwind.config.js`. Use only these:

| Class | Effect |
|---|---|
| `motion-safe:animate-card-enter` | Fade-in + slide-up on mount |
| `motion-safe:animate-fade-in` | Simple opacity fade |
| `animate-pulse` | Loading skeleton pulse |
| `animate-spin` | Spinner (RefreshCw loading state) |
| `animate-ai-pulse` | Blue glow pulse on AI buttons |
| `animate-ai-spin` | Sparkles icon spin during analysis |

All motion animations are guarded with `motion-safe:` prefix to respect `prefers-reduced-motion`.
