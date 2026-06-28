import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  Factory,
  GraduationCap,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { AnimatedProgress } from "../../components/AnimatedProgress";
import { CountUpNumber } from "../../components/CountUpNumber";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { SyncIndicator } from "../../components/SyncIndicator";
import { TrendIndicator } from "../../components/TrendIndicator";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";

// ─── Mock data ────────────────────────────────────────────────────────────────

const kpis = [
  {
    label: "Production Readiness",
    value: "87%",
    sub: "+4% vs previous shift",
    icon: Factory,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const, label: "+4% vs prev shift", positiveIsUp: true },
  },
  {
    label: "Shift Coverage",
    value: "94%",
    sub: "3 lines fully covered",
    icon: Users,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const, label: "+2% vs yesterday", positiveIsUp: true },
  },
  {
    label: "Competent Operators",
    value: "42",
    sub: "Available today",
    icon: ShieldCheck,
    valueClass: "text-slate-50",
    trend: { direction: "flat" as const, label: "No change", positiveIsUp: true },
  },
  {
    label: "Training Due",
    value: "8",
    sub: "Operators need action",
    icon: GraduationCap,
    valueClass: "text-yellow-400",
    trend: { direction: "down" as const, label: "-2 completed", positiveIsUp: false },
  },
  {
    label: "Critical Skill Gaps",
    value: "5",
    sub: "Across 3 process areas",
    icon: AlertTriangle,
    valueClass: "text-orange-400",
    trend: { direction: "flat" as const, label: "No change", positiveIsUp: false },
  },
  {
    label: "Overtime Risk",
    value: "Medium",
    sub: "Night shift forecast",
    icon: Clock,
    valueClass: "text-yellow-400",
    trend: { direction: "up" as const, label: "Increasing", positiveIsUp: false },
  },
];

const shiftCoverage = [
  { shift: "Early Shift",  area: "Line 1 Packing",       required: 8,  available: 8,  pct: 100, risk: "low"    },
  { shift: "Early Shift",  area: "Line 2 Filling",        required: 10, available: 9,  pct: 90,  risk: "medium" },
  { shift: "Late Shift",   area: "Line 3 Changeover",     required: 6,  available: 4,  pct: 67,  risk: "high"   },
  { shift: "Night Shift",  area: "Warehouse / Forklift",  required: 5,  available: 5,  pct: 100, risk: "low"    },
];

const skillsCoverage = [
  { skill: "Line Changeover",                pct: 72, risk: "medium" },
  { skill: "Quality Checks",                 pct: 91, risk: "low"    },
  { skill: "SAP Production Confirmations",   pct: 64, risk: "high"   },
  { skill: "Forklift",                       pct: 88, risk: "low"    },
  { skill: "Mixing",                         pct: 79, risk: "medium" },
  { skill: "Packing",                        pct: 84, risk: "low"    },
  { skill: "Filling",                        pct: 76, risk: "medium" },
  { skill: "First Response Maintenance",     pct: 58, risk: "high"   },
];

const trainingItems = [
  { label: "Refresher training needed — Line 3 changeovers",  count: 3,  badge: "high",     icon: GraduationCap  },
  { label: "Forklift licences expiring within 30 days",       count: 2,  badge: "medium",   icon: AlertTriangle  },
  { label: "New starters below independent operator level",   count: 4,  badge: "medium",   icon: BookOpen       },
  { label: "Competency sign-offs awaiting manager validation",count: 6,  badge: "low",      icon: CheckCircle2   },
];

const productionRisks = [
  {
    title: "Line 3 changeover understaffed",
    detail: "Only 2 validated operators available for the late shift. Cover required before handover.",
    level: "high",
  },
  {
    title: "SAP production confirmation coverage below target",
    detail: "64% coverage against 80% target. 6 operators yet to complete mandatory SAP training.",
    level: "high",
  },
  {
    title: "Night shift overtime forecast above normal",
    detail: "Current absence pattern projects 14% overtime uplift for Thursday–Friday night shift.",
    level: "medium",
  },
  {
    title: "Single point of failure — mixing process knowledge",
    detail: "One senior operator holds the majority of mixing procedure knowledge. No validated backup.",
    level: "medium",
  },
];

const recentActivity = [
  { time: "07:20", activity: "Operator absence logged",           area: "Line 2 Filling",        status: "action",   owner: "Shift Manager"      },
  { time: "08:05", activity: "Competency sign-off completed",     area: "Forklift",               status: "complete", owner: "Production Manager" },
  { time: "09:15", activity: "Training due reminder issued",      area: "Line 3 Changeover",      status: "pending",  owner: "Training Coordinator"},
  { time: "10:30", activity: "Shift swap approved",               area: "Packing",                status: "complete", owner: "Shift Manager"      },
  { time: "11:10", activity: "AI risk score updated",             area: "Production Readiness",   status: "reviewed", owner: "Production Manager" },
];

const aiActions: AiAction[] = [
  {
    label: "Redeploy a Line 1 operator to Line 3 changeover",
    description: "Line 3 late shift has only 4 of 6 required operators validated for changeover. A qualified Line 1 operator can cover the shortfall.",
    priority: "critical",
    icon: Factory,
  },
  {
    label: "Prioritise SAP training for Line 2 operators",
    description: "Coverage is 64% against the 80% target. Scheduling a half-day SAP session for 4 Line 2 operators would close the gap this week.",
    priority: "high",
    icon: GraduationCap,
  },
  {
    label: "Schedule forklift refresher before licence expiry",
    description: "Two forklift licences expire within 30 days. Book refresher training now to avoid losing certified operators.",
    priority: "high",
    icon: ShieldCheck,
  },
  {
    label: "Cross-train packing operators on filling",
    description: "Two experienced packing operators have capacity. Cross-training reduces single-point dependency and improves shift flexibility.",
    priority: "medium",
    icon: TrendingUp,
  },
  {
    label: "Consider contractor support for late shift absence risk",
    description: "If current absence trend continues, Friday night shift will require contractor operators with validated Line 3 changeover experience.",
    priority: "medium",
    icon: Users,
  },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const riskBadge: Record<string, string> = {
  low:    "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  medium: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  high:   "bg-[#ef444418] text-red-400 border border-red-500/20",
};

const riskBar: Record<string, string> = {
  low:    "[&>div]:bg-emerald-500",
  medium: "[&>div]:bg-yellow-400",
  high:   "[&>div]:bg-red-500",
};

const activityStatus: Record<string, string> = {
  action:   "bg-[#ef444418] text-red-400 border border-red-500/20",
  pending:  "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  complete: "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  reviewed: "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const activityStatusLabel: Record<string, string> = {
  action:   "Action needed",
  pending:  "Pending",
  complete: "Complete",
  reviewed: "Reviewed",
};

const trainingBadge: Record<string, string> = {
  high:   "bg-[#ef444418] text-red-400 border border-red-500/20",
  medium: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  low:    "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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

export const ProductionManagerDashboard = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Production Manager</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Production Manager Dashboard</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          Monitor operator readiness, shift coverage, competency gaps and production risk so today's production plan can be delivered safely and efficiently.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={91} syncedAt={new Date(Date.now() - 180000)} />
        <ExplainWithAi pageId="production-manager-dashboard" />
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

    {/* ── Production Readiness Summary ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "520ms" }}
    >
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Factory className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Production Readiness Summary</h2>
          <span className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[#10b98118] text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            On Track
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Readiness Score</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-emerald-400 tabular-nums">87%</span>
              <span className="mb-1 text-xs text-emerald-500">+4% vs prev shift</span>
            </div>
            <AnimatedProgress value={87} className={`h-2 bg-gray-800 ${riskBar.low}`} />
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Risk &amp; Confidence</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${riskBadge.medium}`}>
                Medium Risk
              </span>
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-[#3b82f618] text-blue-400 border border-blue-500/20">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                91% AI Confidence
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Top Constraint</p>
            <p className="text-sm font-medium text-slate-200">Line 3 changeover coverage</p>
            <p className="text-[11px] text-slate-500">Late shift shortfall — 2 operators required</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Readiness Trend</p>
            <svg viewBox="0 0 200 40" className="h-10 w-full" aria-hidden="true">
              <polyline
                points="0,34 33,30 66,28 100,24 133,20 166,16 200,12"
                stroke="#10b981"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-[11px] text-emerald-500">Improving over last 7 shifts</p>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* ── Shift Coverage + Skills Matrix (2-column on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Shift Coverage Overview */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "600ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <ClipboardList className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Shift Coverage Overview</h2>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Shift</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Area / Line</th>
                  <th className="px-4 py-3 font-medium text-slate-500 text-right">Required</th>
                  <th className="px-4 py-3 font-medium text-slate-500 text-right">Available</th>
                  <th className="px-4 py-3 font-medium text-slate-500 text-right">Coverage</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Risk</th>
                </tr>
              </thead>
              <tbody>
                {shiftCoverage.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-300">{row.shift}</td>
                    <td className="px-4 py-3 text-slate-400">{row.area}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">{row.required}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-300 font-medium">{row.available}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: row.pct === 100 ? "#10b981" : row.pct >= 80 ? "#facc15" : "#ef4444" }}>
                      {row.pct}%
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[row.risk]}`}>
                        {row.risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked */}
          <div className="flex flex-col divide-y divide-gray-800 md:hidden">
            {shiftCoverage.map((row, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-xs font-medium text-slate-300">{row.area}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{row.shift}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold tabular-nums`} style={{ color: row.pct === 100 ? "#10b981" : row.pct >= 80 ? "#facc15" : "#ef4444" }}>
                    {row.available}/{row.required}
                  </span>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[row.risk]}`}>
                    {row.risk}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Operator Skills Matrix Summary */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "680ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <BarChart2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Operator Skills Coverage</h2>
          </div>
          <div className="flex flex-col gap-4 px-5 py-4">
            {skillsCoverage.map((item) => (
              <div key={item.skill} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300 truncate min-w-0">{item.skill}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs tabular-nums font-semibold text-slate-300">{item.pct}%</span>
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[item.risk]}`}>
                      {item.risk}
                    </span>
                  </div>
                </div>
                <AnimatedProgress value={item.pct} className={`h-1.5 bg-gray-800 ${riskBar[item.risk]}`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* ── Training & Competency + Production Risks (2-column on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Training & Competency */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "760ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <GraduationCap className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Training &amp; Competency</h2>
            <span className="ml-auto text-[11px] text-slate-500">4 items requiring action</span>
          </div>
          <div className="flex flex-col divide-y divide-gray-800">
            {trainingItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[#1a2030]">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-xs font-medium text-slate-300">{item.label}</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${trainingBadge[item.badge]}`}>
                        {item.badge}
                      </span>
                      <span className="text-[11px] text-slate-500">{item.count} operator{item.count !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Production Risk */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "840ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <ShieldAlert className="h-4 w-4 text-orange-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Production Risks</h2>
            <span className="ml-auto text-[11px] text-slate-500">{productionRisks.length} active</span>
          </div>
          <div className="flex flex-col divide-y divide-gray-800">
            {productionRisks.map((risk, idx) => (
              <div key={idx} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[#1a2030]">
                <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${risk.level === "high" ? "bg-red-500" : "bg-yellow-400"}`} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-200">{risk.title}</p>
                    <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[risk.level]}`}>
                      {risk.level}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">{risk.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* ── AI Recommendations ── */}
    <div className="motion-safe:animate-card-enter" style={{ animationDelay: "920ms" }}>
      <AiActionsPanel actions={aiActions} />
    </div>

    {/* ── Recent Activity ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "1000ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <Settings2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Recent Activity</h2>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Time</th>
                <th className="px-4 py-3 font-medium text-slate-500">Activity</th>
                <th className="px-4 py-3 font-medium text-slate-500">Area</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500">Owner</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                >
                  <td className="px-5 py-3 tabular-nums text-slate-500 font-mono text-[11px]">{row.time}</td>
                  <td className="px-4 py-3 font-medium text-slate-300">{row.activity}</td>
                  <td className="px-4 py-3 text-slate-400">{row.area}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${activityStatus[row.status]}`}>
                      {activityStatusLabel[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked */}
        <div className="flex flex-col divide-y divide-gray-800 md:hidden">
          {recentActivity.map((row, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">{row.activity}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{row.area} · {row.time}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${activityStatus[row.status]}`}>
                {activityStatusLabel[row.status]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </section>
);
