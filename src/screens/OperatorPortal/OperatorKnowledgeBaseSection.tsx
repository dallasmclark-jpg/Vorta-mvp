import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { CountUpNumber } from "../../components/CountUpNumber";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { Select } from "../../components/Select";
import { SyncIndicator } from "../../components/SyncIndicator";
import { TrendIndicator } from "../../components/TrendIndicator";
import { Card, CardContent } from "../../components/ui/card";

// ─── Mock data ────────────────────────────────────────────────────────────────

const kpis = [
  { label: "Knowledge Articles",    value: "48", sub: "Approved articles", icon: BookOpen,   valueClass: "text-slate-50",    trend: { direction: "up" as const,   label: "+3 this month", positiveIsUp: true  } },
  { label: "SOPs Available",        value: "16", sub: "Active procedures", icon: FileText,   valueClass: "text-blue-400",    trend: { direction: "flat" as const, label: "No change",     positiveIsUp: true  } },
  { label: "Troubleshooting Guides",value: "12", sub: "Fault resolution",  icon: Wrench,     valueClass: "text-yellow-400",  trend: { direction: "up" as const,   label: "+1 this week",  positiveIsUp: true  } },
  { label: "Training Resources",    value: "9",  sub: "Linked to modules", icon: BookOpen,   valueClass: "text-blue-400",    trend: { direction: "flat" as const, label: "No change",     positiveIsUp: true  } },
  { label: "Recently Updated",      value: "5",  sub: "Last 7 days",       icon: Clock,      valueClass: "text-orange-400",  trend: { direction: "up" as const,   label: "+2 this week",  positiveIsUp: true  } },
  { label: "AI Suggested Reads",    value: "4",  sub: "For your shift",    icon: Sparkles,   valueClass: "text-emerald-400", trend: { direction: "flat" as const, label: "No change",     positiveIsUp: true  } },
];

const categories = ["All", "SOPs", "Troubleshooting", "Quality", "Safety", "SAP", "Changeovers", "Training", "Handover"];
const areas      = ["All Areas", "Line 1 Packing", "Line 2 Filling", "Line 3 Changeover", "Mixing", "Warehouse / Forklift", "Quality Checks", "SAP", "Safety"];

const featured = [
  { title: "Line 2 Filling Start-Up Procedure",    category: "SOP",            area: "Line 2",    updated: "2 days ago",  status: "approved", icon: FileText   },
  { title: "Line 3 Changeover Checklist",          category: "Changeover",     area: "Line 3",    updated: "3 days ago",  status: "approved", icon: TrendingUp },
  { title: "SAP Production Confirmation Guide",    category: "SAP",            area: "All Lines", updated: "2 weeks ago", status: "approved", icon: FileText   },
  { title: "Quality Check Recording Procedure",    category: "Quality",        area: "All Lines", updated: "5 days ago",  status: "approved", icon: ShieldCheck},
  { title: "Label Feed Troubleshooting",           category: "Troubleshooting",area: "Line 2",    updated: "1 week ago",  status: "approved", icon: Wrench     },
  { title: "Food Safety Escalation Process",       category: "Safety",         area: "All Areas", updated: "1 month ago", status: "approved", icon: ShieldCheck},
];

const articles = [
  { title: "Line 2 Filling Start-Up Procedure",    category: "SOP",            area: "Line 2",    updated: "2 days ago",  status: "approved" },
  { title: "Label Feed Troubleshooting",           category: "Troubleshooting",area: "Line 2",    updated: "1 week ago",  status: "approved" },
  { title: "SAP Production Confirmation Guide",    category: "SAP",            area: "All Lines", updated: "2 weeks ago", status: "approved" },
  { title: "Line 3 Changeover Checklist",          category: "Changeover",     area: "Line 3",    updated: "3 days ago",  status: "approved" },
  { title: "Quality Check Recording Procedure",    category: "Quality",        area: "All Lines", updated: "5 days ago",  status: "approved" },
  { title: "Food Safety Escalation Process",       category: "Safety",         area: "All Areas", updated: "1 month ago", status: "approved" },
];

const aiActions: AiAction[] = [
  {
    label: "Review Label Feed Troubleshooting — a related issue was reported on your current line",
    description: "A label feed fault was flagged at the start of your shift. The troubleshooting guide covers the standard resolution steps and fault-reporting procedure used on Line 2, which will help you log the issue clearly in your handover.",
    priority: "high",
    icon: Wrench,
  },
  {
    label: "Open Line 2 Filling Start-Up Procedure before completing pre-start checks",
    description: "Your pre-start checklist is currently overdue. Opening the start-up procedure ensures you follow the correct sequence for Line 2 and don't miss any site-mandatory steps before production can begin.",
    priority: "high",
    icon: FileText,
  },
  {
    label: "Review SAP Production Confirmation Guide before your first batch confirmation",
    description: "A process update was applied to SAP production confirmation on Line 2. The guide has been updated to reflect the new confirmation steps, which differ from the previous procedure.",
    priority: "medium",
    icon: FileText,
  },
  {
    label: "Read Line 3 Changeover Checklist before supporting the planned changeover",
    description: "You have a Line 3 changeover support task scheduled for 11:30. Reading the checklist beforehand means you know the expected steps and can support the lead operator effectively without causing a changeover delay.",
    priority: "medium",
    icon: TrendingUp,
  },
];

const recentItems = [
  { when: "Today",      item: "Line 2 Filling Start-Up Procedure", category: "SOP",            status: "viewed"   },
  { when: "Yesterday",  item: "SAP Production Confirmation Guide",  category: "SAP",            status: "updated"  },
  { when: "2 days ago", item: "Line 3 Changeover Checklist",        category: "Changeover",     status: "updated"  },
  { when: "Last week",  item: "Label Feed Troubleshooting",         category: "Troubleshooting",status: "viewed"   },
];

const quickLinks = [
  { label: "Line 1 Packing",          icon: MapPin     },
  { label: "Line 2 Filling",          icon: MapPin     },
  { label: "Line 3 Changeover",       icon: MapPin     },
  { label: "Mixing",                  icon: MapPin     },
  { label: "Warehouse / Forklift",    icon: MapPin     },
  { label: "Quality Checks",          icon: ShieldCheck},
  { label: "SAP",                     icon: FileText   },
  { label: "Safety",                  icon: AlertTriangle},
];

// ─── Style helpers ────────────────────────────────────────────────────────────

const categoryColor: Record<string, string> = {
  SOP:            "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  Troubleshooting:"bg-[#f9731618] text-orange-400 border border-orange-500/20",
  Quality:        "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  Safety:         "bg-[#ef444418] text-red-400 border border-red-500/20",
  SAP:            "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  Changeover:     "bg-[#ffffff10] text-slate-400 border border-gray-700",
  Training:       "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  Handover:       "bg-[#f9731618] text-orange-400 border border-orange-500/20",
};

const recentStatusBadge: Record<string, string> = {
  viewed:  "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  updated: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
};

const recentStatusLabel: Record<string, string> = {
  viewed: "Viewed", updated: "Updated",
};

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, valueClass, trend, index = 0 }: typeof kpis[number] & { index?: number }) {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <Icon className="h-4 w-4 shrink-0 text-slate-600" />
        </div>
        <CountUpNumber value={value} className={`text-2xl font-semibold tabular-nums ${valueClass}`} delay={index * 80 + 200} />
        <div className="flex items-center gap-2">
          <TrendIndicator direction={trend.direction} label={trend.label} positiveIsUp={trend.positiveIsUp} />
          <span className="text-[11px] text-slate-600">·</span>
          <p className="text-[11px] text-slate-500">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const OperatorKnowledgeBaseSection = (): JSX.Element => {
  const [query, setQuery]       = useState("");
  const [category, setCategory] = useState("All");
  const [area, setArea]         = useState("All Areas");

  const filteredArticles = articles.filter((a) => {
    const matchesQuery    = query === "" || a.title.toLowerCase().includes(query.toLowerCase()) || a.category.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "All" || a.category === category;
    const matchesArea     = area === "All Areas" || a.area === area || a.area === "All Lines" || a.area === "All Areas";
    return matchesQuery && matchesCategory && matchesArea;
  });

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

      {/* ── Header ── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-medium text-slate-500">Operator Portal</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Knowledge Base</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Search approved production guidance, troubleshooting steps, training resources and shift knowledge so you can complete work safely and consistently.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <SyncIndicator source="Vorta" confidence={95} syncedAt={new Date(Date.now() - 180000)} />
          <ExplainWithAi pageId="operator-knowledge-base" />
        </div>
      </header>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => (
          <div key={k.label} className="motion-safe:animate-card-enter" style={{ animationDelay: `${i * 80}ms` }}>
            <KpiCard {...k} index={i} />
          </div>
        ))}
      </div>

      {/* ── Search & Filter ── */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "520ms" }}
      >
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <Search className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Search Knowledge Base</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search articles, SOPs, guides..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-[#0f1318] py-2 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-600 outline-none transition-colors focus:border-blue-500/50 focus:ring-0"
              />
            </div>
            <Select
              value={category}
              onChange={setCategory}
              options={categories.map((c) => ({ value: c, label: c }))}
              className="w-full sm:w-44"
            />
            <Select
              value={area}
              onChange={setArea}
              options={areas.map((a) => ({ value: a, label: a }))}
              className="w-full sm:w-52"
            />
            {(query || category !== "All" || area !== "All Areas") && (
              <button
                type="button"
                onClick={() => { setQuery(""); setCategory("All"); setArea("All Areas"); }}
                className="shrink-0 rounded-lg border border-gray-700 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
          {(query || category !== "All" || area !== "All Areas") && (
            <p className="mt-2 text-[11px] text-slate-500">
              Showing {filteredArticles.length} of {articles.length} articles
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Featured Knowledge Cards ── */}
      {query === "" && category === "All" && area === "All Areas" && (
        <div
          className="motion-safe:animate-card-enter"
          style={{ animationDelay: "600ms" }}
        >
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Featured Articles</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featured.map((card, i) => (
              <Card
                key={i}
                className="rounded-xl border border-gray-800 bg-[#141820] shadow-none transition-colors hover:border-gray-700"
              >
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-800 bg-[#0f1318]">
                      <card.icon className="h-4 w-4 text-blue-400" aria-hidden="true" />
                    </div>
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${categoryColor[card.category] ?? "bg-[#ffffff10] text-slate-400 border border-gray-700"}`}>
                      {card.category}
                    </span>
                  </div>
                  <p className="text-xs font-semibold leading-snug text-slate-200">{card.title}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[10px] text-slate-500">{card.area}</p>
                      <p className="text-[10px] text-slate-600">Updated {card.updated}</p>
                    </div>
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#10b98118] text-emerald-400 border border-emerald-500/20">
                      Approved
                    </span>
                  </div>
                  <button
                    type="button"
                    className="mt-1 w-full rounded border border-gray-700 px-3 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
                  >
                    Open Article
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Knowledge Articles Table ── */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "680ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <BookOpen className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Knowledge Articles</h2>
            <span className="ml-auto text-[11px] text-slate-500">{filteredArticles.length} articles</span>
          </div>

          {/* Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Article</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Category</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Area</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Updated</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredArticles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-xs text-slate-500">
                      No articles match your search.
                    </td>
                  </tr>
                ) : (
                  filteredArticles.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                    >
                      <td className="px-5 py-3 font-medium text-slate-300">{row.title}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${categoryColor[row.category] ?? "bg-[#ffffff10] text-slate-400 border border-gray-700"}`}>
                          {row.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{row.area}</td>
                      <td className="px-4 py-3 text-slate-500">{row.updated}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#10b98118] text-emerald-400 border border-emerald-500/20">
                          Approved
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border border-gray-700 bg-transparent px-2.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
                        >
                          <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="flex flex-col divide-y divide-gray-800 md:hidden">
            {filteredArticles.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-slate-500">No articles match your search.</p>
            ) : (
              filteredArticles.map((row, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-300">{row.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{row.area} · {row.updated}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${categoryColor[row.category] ?? "bg-[#ffffff10] text-slate-400 border border-gray-700"}`}>
                    {row.category}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── AI Suggested Knowledge ── */}
      <div className="motion-safe:animate-card-enter" style={{ animationDelay: "760ms" }}>
        <AiActionsPanel actions={aiActions} />
      </div>

      {/* ── Recently Viewed + Quick Links (2-col on XL) ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Recently Viewed / Updated */}
        <Card
          className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
          style={{ animationDelay: "840ms" }}
        >
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
              <Clock className="h-4 w-4 text-blue-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-200">Recently Viewed / Updated</h2>
            </div>

            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-left">
                    <th className="px-5 py-3 font-medium text-slate-500">Time</th>
                    <th className="px-4 py-3 font-medium text-slate-500">Knowledge Item</th>
                    <th className="px-4 py-3 font-medium text-slate-500">Category</th>
                    <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentItems.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                    >
                      <td className="px-5 py-3 text-slate-500">{row.when}</td>
                      <td className="px-4 py-3 font-medium text-slate-300">{row.item}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${categoryColor[row.category] ?? "bg-[#ffffff10] text-slate-400 border border-gray-700"}`}>
                          {row.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${recentStatusBadge[row.status]}`}>
                          {recentStatusLabel[row.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="flex flex-col divide-y divide-gray-800 md:hidden">
              {recentItems.map((row, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-300">{row.item}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{row.when} · {row.category}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${recentStatusBadge[row.status]}`}>
                    {recentStatusLabel[row.status]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Production Area Quick Links */}
        <Card
          className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
          style={{ animationDelay: "920ms" }}
        >
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
              <MapPin className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-200">Production Area Quick Links</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map(({ label, icon: Icon }, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setArea(label)}
                  className="flex items-center gap-2 rounded-lg border border-gray-800 bg-[#0f1318] px-3 py-2.5 text-[11px] font-medium text-slate-400 transition-colors hover:border-gray-700 hover:text-slate-200"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
