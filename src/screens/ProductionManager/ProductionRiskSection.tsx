import {
  Activity,
  AlertTriangle,
  BarChart2,
  BookOpen,
  ClipboardList,
  ShieldAlert,
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
    label: "Overall Production Risk",
    value: "Medium",
    sub: "Across all areas",
    icon: ShieldAlert,
    valueClass: "text-yellow-400",
    trend: { direction: "down" as const,  label: "Improving",          positiveIsUp: true  },
  },
  {
    label: "High Risk Areas",
    value: "4",
    sub: "Require immediate action",
    icon: AlertTriangle,
    valueClass: "text-red-400",
    trend: { direction: "flat" as const,  label: "No change",          positiveIsUp: false },
  },
  {
    label: "Critical Skill Gaps",
    value: "5",
    sub: "Identified this week",
    icon: Users,
    valueClass: "text-orange-400",
    trend: { direction: "up" as const,    label: "+1 this week",       positiveIsUp: false },
  },
  {
    label: "Single Point Dependencies",
    value: "3",
    sub: "Knowledge concentration risk",
    icon: Zap,
    valueClass: "text-orange-400",
    trend: { direction: "flat" as const,  label: "No change",          positiveIsUp: false },
  },
  {
    label: "Shift Coverage Risk",
    value: "Medium",
    sub: "Late shift most exposed",
    icon: ClipboardList,
    valueClass: "text-yellow-400",
    trend: { direction: "down" as const,  label: "Easing vs yesterday", positiveIsUp: true  },
  },
  {
    label: "AI Risk Score",
    value: "88%",
    sub: "Confidence",
    icon: Sparkles,
    valueClass: "text-blue-400",
    trend: { direction: "up" as const,    label: "+3% this week",      positiveIsUp: true  },
  },
];

const riskSummary = {
  score: 74,
  maxScore: 100,
  trend: "Improving",
  trendDirection: "down" as const,
  aiConfidence: 92,
  highestRisk: "Line 3 Changeover",
  action: "Validate additional changeover operators before late shift",
};

const workforceRisks = [
  { area: "Line 3 Changeover Coverage",   impact: "high",   likelihood: "high",   overall: "critical",  owner: "Production Manager",   status: "open"        },
  { area: "SAP Production Confirmations", impact: "medium", likelihood: "high",   overall: "high",      owner: "Shift Manager",        status: "in-progress" },
  { area: "Forklift Licence Expiry",      impact: "medium", likelihood: "medium", overall: "medium",    owner: "Training Coordinator", status: "planned"     },
  { area: "Mixing Process Knowledge",     impact: "high",   likelihood: "medium", overall: "high",      owner: "Production Manager",   status: "open"        },
  { area: "Night Shift Absence Cover",    impact: "medium", likelihood: "medium", overall: "medium",    owner: "Shift Manager",        status: "monitoring"  },
];

const criticalDependencies = [
  {
    title: "Line 3 changeover — single operator dependency",
    detail: "One operator holds the majority of Line 3 changeover knowledge. Any absence on late shift leaves the line uncovered.",
    level: "high",
  },
  {
    title: "Mixing process — senior operator retirement risk",
    detail: "The primary mixing process knowledge sits with one senior operator. No structured succession or knowledge capture plan is in place.",
    level: "high",
  },
  {
    title: "SAP confirmation capability — nights below target",
    detail: "Night shift SAP production confirmation coverage is at 64% against an 80% target. Only two operators are validated for this task.",
    level: "medium",
  },
  {
    title: "Overtime dependency increasing for three consecutive weeks",
    detail: "Overtime hours have risen week-on-week, indicating an underlying shift coverage shortfall rather than isolated absence.",
    level: "medium",
  },
];

const heatmapAreas = [
  { area: "Packing",      riskPct: 30, level: "low"    },
  { area: "Filling",      riskPct: 48, level: "medium" },
  { area: "Mixing",       riskPct: 72, level: "high"   },
  { area: "Warehouse",    riskPct: 55, level: "medium" },
  { area: "Changeovers",  riskPct: 84, level: "critical" },
  { area: "Quality",      riskPct: 38, level: "low"    },
  { area: "SAP Transactions", riskPct: 65, level: "high" },
];

const recentActivity = [
  { time: "07:15", event: "Operator absence reported",         area: "Line 2",    change: "increased", status: "open"     },
  { time: "08:40", event: "Competency signed off",             area: "Line 3",    change: "reduced",   status: "complete" },
  { time: "09:30", event: "Forklift licence renewed",          area: "Warehouse", change: "reduced",   status: "complete" },
  { time: "10:20", event: "AI recalculated workforce risk",    area: "All Areas", change: "updated",   status: "reviewed" },
];

const aiActions: AiAction[] = [
  {
    label: "Cross-train two operators for Line 3 changeovers within two weeks",
    description: "Sarah Hughes and Chloe Williams both have the prerequisite competencies and capacity. A structured 3-shift shadow programme closes the critical dependency before the next shift rotation.",
    priority: "critical",
    icon: TrendingUp,
  },
  {
    label: "Capture knowledge from senior mixing operator before planned retirement",
    description: "Create a documented mixing process procedure and assign two operators to shadow shifts this week. This removes the single-point-of-failure before the planned retirement date.",
    priority: "critical",
    icon: BookOpen,
  },
  {
    label: "Reduce overtime by rebalancing shift allocation",
    description: "Three weeks of increasing overtime signal a structural gap in shift cover rather than isolated absence. A rota review now prevents the overtime cost compounding further.",
    priority: "high",
    icon: BarChart2,
  },
  {
    label: "Increase SAP production confirmation training for night shift",
    description: "Training two additional operators to SAP confirmation level closes the night shift gap within two weeks and removes the current compliance and coverage risk.",
    priority: "high",
    icon: Wrench,
  },
  {
    label: "Prioritise manager validation of pending competencies",
    description: "Nine operators are awaiting sign-off. Each unvalidated operator represents a hidden coverage risk. Clearing the queue this week prevents validation gaps carrying into the next planning period.",
    priority: "medium",
    icon: ClipboardList,
  },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const riskBadge: Record<string, string> = {
  low:      "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  medium:   "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  high:     "bg-[#ef444418] text-red-400 border border-red-500/20",
  critical: "bg-[#dc262618] text-red-300 border border-red-400/30",
};

const riskBarColor: Record<string, string> = {
  low:      "[&>div]:bg-emerald-500",
  medium:   "[&>div]:bg-yellow-400",
  high:     "[&>div]:bg-red-500",
  critical: "[&>div]:bg-red-400",
};

const statusBadge: Record<string, string> = {
  open:         "bg-[#ef444418] text-red-400 border border-red-500/20",
  "in-progress":"bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  planned:      "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  monitoring:   "bg-[#ffffff10] text-slate-400 border border-gray-700",
};

const statusLabel: Record<string, string> = {
  open:         "Open",
  "in-progress":"In Progress",
  planned:      "Planned",
  monitoring:   "Monitoring",
};

const changeBadge: Record<string, string> = {
  increased: "bg-[#ef444418] text-red-400 border border-red-500/20",
  reduced:   "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  updated:   "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const activityStatusBadge: Record<string, string> = {
  open:     "bg-[#ef444418] text-red-400 border border-red-500/20",
  complete: "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  reviewed: "bg-[#ffffff10] text-slate-400 border border-gray-700",
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

export const ProductionRiskSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Production Manager</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Production Risk</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          Identify workforce risks before they affect production by monitoring operator capability, shift resilience, compliance, training and knowledge dependencies.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={88} syncedAt={new Date(Date.now() - 240000)} />
        <ExplainWithAi pageId="production-risk" />
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

    {/* ── Risk Summary ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "520ms" }}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-2 pb-4">
          <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Production Risk Summary</h2>
          <span className="ml-auto text-[11px] text-slate-500">AI Confidence: {riskSummary.aiConfidence}%</span>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Score */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Risk Score</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-yellow-400 tabular-nums">{riskSummary.score}</span>
              <span className="mb-0.5 text-sm text-slate-500">/ {riskSummary.maxScore}</span>
            </div>
            <AnimatedProgress value={riskSummary.score} className="h-2 bg-gray-800 [&>div]:bg-yellow-400" />
          </div>
          {/* Trend */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Current Trend</p>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-emerald-400">{riskSummary.trend}</span>
            </div>
            <TrendIndicator direction={riskSummary.trendDirection} label="Improving vs yesterday" positiveIsUp={true} />
          </div>
          {/* Highest Risk */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Highest Risk Area</p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-sm font-semibold text-slate-200">{riskSummary.highestRisk}</span>
            </div>
            <span className={`inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge["critical"]}`}>
              Critical
            </span>
          </div>
          {/* Immediate Action */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Immediate Action</p>
            <p className="text-xs font-medium leading-relaxed text-slate-300">{riskSummary.action}</p>
            <button
              type="button"
              className="inline-flex w-fit items-center rounded border border-red-500/30 bg-[#ef444410] px-2.5 py-1 text-[11px] font-medium text-red-400 transition-colors hover:border-red-500/50 hover:text-red-300"
            >
              Take Action
            </button>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* ── Workforce Risk Table + Critical Dependencies (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Workforce Risk Table */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "600ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <AlertTriangle className="h-4 w-4 text-orange-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Workforce Risk Register</h2>
            <span className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#ef444418] text-red-400 border border-red-500/20">
              {workforceRisks.filter((r) => r.overall === "critical").length} critical
            </span>
          </div>

          {/* Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Risk Area</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Impact</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Likelihood</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Overall</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Owner</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {workforceRisks.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-300">{row.area}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[row.impact]}`}>
                        {row.impact}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[row.likelihood]}`}>
                        {row.likelihood}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[row.overall]}`}>
                        {row.overall}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.owner}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[row.status]}`}>
                        {statusLabel[row.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="flex flex-col divide-y divide-gray-800 md:hidden">
            {workforceRisks.map((row, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-300">{row.area}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{row.owner}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[row.overall]}`}>
                    {row.overall}
                  </span>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[row.status]}`}>
                    {statusLabel[row.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Critical Dependencies */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "680ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <Zap className="h-4 w-4 text-orange-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Critical Dependencies</h2>
            <span className="ml-auto text-[11px] text-slate-500">
              {criticalDependencies.filter((d) => d.level === "high").length} high-priority
            </span>
          </div>
          <div className="flex flex-col divide-y divide-gray-800">
            {criticalDependencies.map((dep, idx) => (
              <div key={idx} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[#1a2030]">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dep.level === "high" ? "bg-red-500" : "bg-yellow-400"}`} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-200">{dep.title}</p>
                    <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[dep.level]}`}>
                      {dep.level}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">{dep.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* ── Risk Heat Map ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "760ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <BarChart2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Production Area Risk Levels</h2>
          <div className="ml-auto flex items-center gap-3 text-[10px]">
            {(["low","medium","high","critical"] as const).map((lvl) => (
              <span key={lvl} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide ${riskBadge[lvl]}`}>
                {lvl}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {heatmapAreas.map((item) => (
            <div key={item.area} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-300">{item.area}</span>
                <div className="flex items-center gap-1.5">
                  <span className="tabular-nums text-xs font-semibold" style={{
                    color: item.level === "critical" ? "#fca5a5"
                      : item.level === "high" ? "#ef4444"
                      : item.level === "medium" ? "#facc15"
                      : "#10b981",
                  }}>
                    {item.riskPct}%
                  </span>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[item.level]}`}>
                    {item.level}
                  </span>
                </div>
              </div>
              <AnimatedProgress value={item.riskPct} className={`h-2 bg-gray-800 ${riskBarColor[item.level]}`} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── AI Recommendations ── */}
    <div className="motion-safe:animate-card-enter" style={{ animationDelay: "840ms" }}>
      <AiActionsPanel actions={aiActions} />
    </div>

    {/* ── Recent Risk Activity ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "920ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <Activity className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Recent Risk Activity</h2>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Time</th>
                <th className="px-4 py-3 font-medium text-slate-500">Event</th>
                <th className="px-4 py-3 font-medium text-slate-500">Area</th>
                <th className="px-4 py-3 font-medium text-slate-500">Risk Change</th>
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
                  <td className="px-4 py-3 font-medium text-slate-300">{row.event}</td>
                  <td className="px-4 py-3 text-slate-400">{row.area}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${changeBadge[row.change]}`}>
                      {row.change === "increased" ? <TrendingUp className="h-2.5 w-2.5" /> : row.change === "reduced" ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                      {row.change.charAt(0).toUpperCase() + row.change.slice(1)}
                    </span>
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
                <p className="text-xs font-medium text-slate-300">{row.event}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{row.area} · {row.time}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${changeBadge[row.change]}`}>
                  {row.change.charAt(0).toUpperCase() + row.change.slice(1)}
                </span>
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
