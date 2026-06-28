import {
  Activity,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { AnimatedProgress } from "../../components/AnimatedProgress";
import { CountUpNumber } from "../../components/CountUpNumber";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { SyncIndicator } from "../../components/SyncIndicator";
import { TrendIndicator } from "../../components/TrendIndicator";
import { Card, CardContent } from "../../components/ui/card";

// ─── Mock data ────────────────────────────────────────────────────────────────

const kpis = [
  {
    label: "Improvement Opportunities",
    value: "18",
    sub: "Identified by AI",
    icon: Sparkles,
    valueClass: "text-blue-400",
    trend: { direction: "up" as const,   label: "+3 this week",    positiveIsUp: true  },
  },
  {
    label: "High Priority Actions",
    value: "5",
    sub: "Require prompt attention",
    icon: Zap,
    valueClass: "text-red-400",
    trend: { direction: "flat" as const, label: "No change",       positiveIsUp: false },
  },
  {
    label: "Estimated Risk Reduction",
    value: "22%",
    sub: "If all actions completed",
    icon: TrendingDown,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+4% vs last week", positiveIsUp: true  },
  },
  {
    label: "Training Actions",
    value: "7",
    sub: "Suggested",
    icon: GraduationCap,
    valueClass: "text-yellow-400",
    trend: { direction: "up" as const,   label: "+2 this week",    positiveIsUp: true  },
  },
  {
    label: "Shift Optimisations",
    value: "4",
    sub: "Recommended",
    icon: ClipboardList,
    valueClass: "text-yellow-400",
    trend: { direction: "flat" as const, label: "No change",       positiveIsUp: true  },
  },
  {
    label: "AI Confidence",
    value: "91%",
    sub: "Across all recommendations",
    icon: Sparkles,
    valueClass: "text-blue-400",
    trend: { direction: "up" as const,   label: "+2% this week",   positiveIsUp: true  },
  },
];

const summary = {
  score: 86,
  maxScore: 100,
  highestArea: "Line 3 Changeover Coverage",
  riskReduction: 22,
  confidence: 91,
  nextAction: "Validate two additional changeover operators before the late shift",
};

const opportunities = [
  { opportunity: "Validate additional Line 3 changeover operators", area: "Line 3",          impact: "high",   confidence: 94, priority: "high",   status: "open",   action: "Review"   },
  { opportunity: "Cross-train packing operators on filling",         area: "Packing / Filling",impact: "medium", confidence: 89, priority: "medium", status: "plan",   action: "Plan"     },
  { opportunity: "Schedule SAP production confirmation refresher",   area: "Line 2",          impact: "high",   confidence: 91, priority: "high",   status: "open",   action: "Assign"   },
  { opportunity: "Renew forklift licences before expiry",            area: "Warehouse",       impact: "medium", confidence: 87, priority: "medium", status: "scheduled",action: "Schedule"},
  { opportunity: "Reduce overtime dependency on late shift",         area: "Late Shift",      impact: "high",   confidence: 88, priority: "high",   status: "open",   action: "Review"   },
  { opportunity: "Capture senior operator mixing knowledge",         area: "Mixing",          impact: "high",   confidence: 92, priority: "high",   status: "open",   action: "Start"    },
];

const aiActions: AiAction[] = [
  {
    label: "Prioritise Line 3 changeover validation to reduce the highest production readiness risk",
    description: "Line 3 is the most exposed area in the current rota. Validating two additional operators eliminates the critical single-point dependency and reduces overall production risk by an estimated 9%.",
    priority: "critical",
    icon: ShieldCheck,
  },
  {
    label: "Cross-train two packing operators on filling to improve shift resilience",
    description: "Packing is fully covered on all shifts. Moving two validated packing operators into a filling cross-training programme improves flexibility across the busiest production lines with minimal disruption.",
    priority: "critical",
    icon: Users,
  },
  {
    label: "Schedule SAP refresher training for late shift operators before the next rota cycle",
    description: "Late shift SAP confirmation coverage is at 64% against an 80% target. Scheduling a targeted refresher for three operators closes the gap within two weeks and removes the compliance risk.",
    priority: "high",
    icon: GraduationCap,
  },
  {
    label: "Capture mixing process knowledge from the senior operator to reduce single-point dependency",
    description: "Assign two operators to shadow shifts and document the mixing process this week. This removes the retirement knowledge risk before it escalates to a production-critical gap.",
    priority: "high",
    icon: BookOpen,
  },
  {
    label: "Rebalance late shift allocation to reduce overtime risk",
    description: "Overtime hours have increased for three consecutive weeks. A rota rebalance that spreads validated operators more evenly across late shift eliminates the structural coverage gap driving the overtime.",
    priority: "medium",
    icon: BarChart2,
  },
];

const categories = [
  { label: "Skills Coverage",        pct: 76, opportunities: 5, icon: Users        },
  { label: "Shift Coverage",         pct: 68, opportunities: 4, icon: ClipboardList },
  { label: "Training",               pct: 82, opportunities: 7, icon: GraduationCap },
  { label: "Compliance",             pct: 88, opportunities: 3, icon: ShieldCheck   },
  { label: "Overtime",               pct: 60, opportunities: 2, icon: TrendingDown  },
  { label: "Knowledge Risk",         pct: 55, opportunities: 3, icon: BookOpen      },
  { label: "New Starter Readiness",  pct: 72, opportunities: 2, icon: Wrench        },
];

const expectedBenefits = [
  { label: "Better shift coverage",               icon: ClipboardList, color: "text-blue-400"    },
  { label: "Lower production risk",               icon: ShieldCheck,   color: "text-emerald-400" },
  { label: "Reduced overtime dependency",         icon: TrendingDown,  color: "text-emerald-400" },
  { label: "Fewer compliance gaps",               icon: CheckCircle2,  color: "text-emerald-400" },
  { label: "Improved operator flexibility",       icon: Users,         color: "text-blue-400"    },
  { label: "Reduced single-point knowledge risk", icon: Zap,           color: "text-yellow-400"  },
];

const recentActivity = [
  { time: "07:30", insight: "Shift risk recalculated after absence update", area: "Line 2",           confidence: 90, status: "reviewed"  },
  { time: "08:15", insight: "Training priority updated",                    area: "Line 3 Changeover",confidence: 94, status: "open"      },
  { time: "09:05", insight: "Compliance expiry risk flagged",               area: "Warehouse",        confidence: 87, status: "scheduled" },
  { time: "10:20", insight: "Knowledge dependency detected",                area: "Mixing",           confidence: 92, status: "open"      },
  { time: "11:10", insight: "Overtime optimisation suggested",              area: "Late Shift",       confidence: 88, status: "review"    },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const impactBadge: Record<string, string> = {
  low:    "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  medium: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  high:   "bg-[#ef444418] text-red-400 border border-red-500/20",
};

const priorityBadge: Record<string, string> = {
  high:   "bg-[#ef444418] text-red-400 border border-red-500/20",
  medium: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  low:    "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
};

const oppStatusBadge: Record<string, string> = {
  open:      "bg-[#ef444418] text-red-400 border border-red-500/20",
  plan:      "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  scheduled: "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const oppStatusLabel: Record<string, string> = {
  open: "Open", plan: "Plan", scheduled: "Scheduled",
};

const activityStatusBadge: Record<string, string> = {
  reviewed:  "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  open:      "bg-[#ef444418] text-red-400 border border-red-500/20",
  scheduled: "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  review:    "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
};

const catBarColor = (pct: number) =>
  pct >= 85 ? "[&>div]:bg-emerald-500" : pct >= 70 ? "[&>div]:bg-yellow-400" : "[&>div]:bg-red-500";

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

export const ProductionAiImprovementsSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Production Manager</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">AI Improvements</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          Review AI-generated improvement opportunities across operator readiness, skills coverage, shift planning, compliance and production risk.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta AI" confidence={91} syncedAt={new Date(Date.now() - 180000)} />
        <ExplainWithAi pageId="production-ai-improvements" />
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

    {/* ── AI Improvement Summary ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "520ms" }}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-2 pb-4">
          <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">AI Improvement Summary</h2>
          <span className="ml-auto text-[11px] text-slate-500">AI Confidence: {summary.confidence}%</span>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Score */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Improvement Score</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-blue-400 tabular-nums">{summary.score}</span>
              <span className="mb-0.5 text-sm text-slate-500">/ {summary.maxScore}</span>
            </div>
            <AnimatedProgress value={summary.score} className="h-2 bg-gray-800 [&>div]:bg-blue-500" />
          </div>
          {/* Highest Area */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Highest Opportunity</p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-sm font-semibold text-slate-200">{summary.highestArea}</span>
            </div>
            <span className="inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[#ef444418] text-red-400 border border-red-500/20">
              High Impact
            </span>
          </div>
          {/* Risk Reduction */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Est. Risk Reduction</p>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              <span className="text-2xl font-bold text-emerald-400 tabular-nums">{summary.riskReduction}%</span>
            </div>
            <TrendIndicator direction="up" label="If all actions completed" positiveIsUp={true} />
          </div>
          {/* Next Action */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Recommended Next Action</p>
            <p className="text-xs font-medium leading-relaxed text-slate-300">{summary.nextAction}</p>
            <button
              type="button"
              className="inline-flex w-fit items-center rounded border border-blue-500/30 bg-[#3b82f610] px-2.5 py-1 text-[11px] font-medium text-blue-400 transition-colors hover:border-blue-500/50 hover:text-blue-300"
            >
              View Details
            </button>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* ── Improvement Opportunities Table ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "600ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <TrendingUp className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Improvement Opportunities</h2>
          <span className="ml-auto text-[11px] text-slate-500">
            {opportunities.filter((o) => o.priority === "high").length} high-priority
          </span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Opportunity</th>
                <th className="px-4 py-3 font-medium text-slate-500">Area</th>
                <th className="px-4 py-3 font-medium text-slate-500">Impact</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-right">Confidence</th>
                <th className="px-4 py-3 font-medium text-slate-500">Priority</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                >
                  <td className="px-5 py-3 font-medium text-slate-300 max-w-[220px]">{row.opportunity}</td>
                  <td className="px-4 py-3 text-slate-500">{row.area}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${impactBadge[row.impact]}`}>
                      {row.impact}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums font-semibold text-blue-400">{row.confidence}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadge[row.priority]}`}>
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${oppStatusBadge[row.status]}`}>
                      {oppStatusLabel[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        row.priority === "high"
                          ? "border-blue-500/30 bg-[#3b82f610] text-blue-400 hover:border-blue-500/50 hover:text-blue-300"
                          : "border-gray-700 bg-transparent text-slate-400 hover:border-gray-600 hover:text-slate-200"
                      }`}
                    >
                      {row.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="flex flex-col divide-y divide-gray-800 md:hidden">
          {opportunities.map((row, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300">{row.opportunity}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{row.area} · {row.confidence}% confidence</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadge[row.priority]}`}>
                  {row.priority}
                </span>
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${oppStatusBadge[row.status]}`}>
                  {oppStatusLabel[row.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── AI Recommendations ── */}
    <div className="motion-safe:animate-card-enter" style={{ animationDelay: "680ms" }}>
      <AiActionsPanel actions={aiActions} />
    </div>

    {/* ── Improvement Categories + Expected Benefits (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Improvement Categories */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "760ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <BarChart2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Improvement Categories</h2>
          </div>
          <div className="flex flex-col gap-4 p-5">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                      <span className="text-xs font-medium text-slate-300">{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">{cat.opportunities} opportunities</span>
                      <span
                        className="tabular-nums text-xs font-semibold"
                        style={{ color: cat.pct >= 85 ? "#10b981" : cat.pct >= 70 ? "#facc15" : "#ef4444" }}
                      >
                        {cat.pct}%
                      </span>
                    </div>
                  </div>
                  <AnimatedProgress value={cat.pct} className={`h-1.5 bg-gray-800 ${catBarColor(cat.pct)}`} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Expected Benefits */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "840ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Expected Benefits</h2>
            <span className="ml-auto text-[11px] text-slate-500">On completion of all AI actions</span>
          </div>
          <div className="flex flex-col divide-y divide-gray-800">
            {expectedBenefits.map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <div key={idx} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#1a2030]">
                  <Icon className={`h-4 w-4 shrink-0 ${benefit.color}`} aria-hidden="true" />
                  <p className="flex-1 text-xs font-medium text-slate-300">{benefit.label}</p>
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500/50" aria-hidden="true" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* ── Recent AI Activity ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "920ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <Activity className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Recent AI Activity</h2>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Time</th>
                <th className="px-4 py-3 font-medium text-slate-500">AI Insight</th>
                <th className="px-4 py-3 font-medium text-slate-500">Area</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-right">Confidence</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                >
                  <td className="px-5 py-3 tabular-nums text-slate-500">{row.time}</td>
                  <td className="px-4 py-3 font-medium text-slate-300">{row.insight}</td>
                  <td className="px-4 py-3 text-slate-400">{row.area}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums font-semibold text-blue-400">{row.confidence}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${activityStatusBadge[row.status]}`}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="flex flex-col divide-y divide-gray-800 md:hidden">
          {recentActivity.map((row, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300">{row.insight}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{row.area} · {row.time}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="tabular-nums text-xs font-semibold text-blue-400">{row.confidence}%</span>
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${activityStatusBadge[row.status]}`}>
                  {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </section>
);
