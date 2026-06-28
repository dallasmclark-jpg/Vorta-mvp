import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
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
    label: "Overall Competency Coverage",
    value: "82%",
    sub: "+3% vs last month",
    icon: BarChart2,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const, label: "+3% vs last month", positiveIsUp: true },
  },
  {
    label: "Validated Operators",
    value: "42",
    sub: "Fully signed off",
    icon: ShieldCheck,
    valueClass: "text-slate-50",
    trend: { direction: "flat" as const, label: "No change", positiveIsUp: true },
  },
  {
    label: "Critical Skill Gaps",
    value: "5",
    sub: "Require urgent action",
    icon: AlertTriangle,
    valueClass: "text-orange-400",
    trend: { direction: "flat" as const, label: "No change", positiveIsUp: false },
  },
  {
    label: "Expiring Competencies",
    value: "7",
    sub: "Within 30 days",
    icon: ClipboardList,
    valueClass: "text-yellow-400",
    trend: { direction: "up" as const, label: "+2 this week", positiveIsUp: false },
  },
  {
    label: "Single Point Dependencies",
    value: "4",
    sub: "Only 1 operator validated",
    icon: ShieldAlert,
    valueClass: "text-orange-400",
    trend: { direction: "flat" as const, label: "No change", positiveIsUp: false },
  },
  {
    label: "Sign-Offs Due",
    value: "6",
    sub: "Awaiting manager action",
    icon: CheckCircle2,
    valueClass: "text-yellow-400",
    trend: { direction: "up" as const, label: "+1 this week", positiveIsUp: false },
  },
];

const skillsCoverage = [
  { skill: "Line Changeover",              pct: 72, risk: "medium" },
  { skill: "Quality Checks",               pct: 91, risk: "low"    },
  { skill: "SAP Production Confirmations", pct: 64, risk: "high"   },
  { skill: "Forklift",                     pct: 88, risk: "low"    },
  { skill: "Mixing",                       pct: 79, risk: "medium" },
  { skill: "Packing",                      pct: 94, risk: "low"    },
  { skill: "Filling",                      pct: 81, risk: "medium" },
  { skill: "First Response Maintenance",   pct: 58, risk: "high"   },
];

const operators = [
  {
    name: "Sarah Hughes",   initials: "SH", shift: "Early", area: "Packing",     skills: ["Packing", "Quality Checks", "SAP"], status: "validated",   risk: "low"    },
  {
    name: "Mark Evans",     initials: "ME", shift: "Late",  area: "Filling",      skills: ["Filling", "Changeover"],            status: "needs-signoff",risk: "medium" },
  {
    name: "Aisha Khan",     initials: "AK", shift: "Nights",area: "Mixing",      skills: ["Mixing", "Forklift"],               status: "validated",   risk: "low"    },
  {
    name: "Tom Roberts",    initials: "TR", shift: "Late",  area: "Line 3",       skills: ["Changeover", "First Response"],      status: "gap-identified",risk: "high"  },
  {
    name: "James Miller",   initials: "JM", shift: "Early", area: "Warehouse",   skills: ["Forklift", "SAP"],                  status: "expiring",    risk: "medium" },
  {
    name: "Claire Wong",    initials: "CW", shift: "Early", area: "Packing",     skills: ["Packing", "Filling"],               status: "validated",   risk: "low"    },
  {
    name: "Dean Okafor",    initials: "DO", shift: "Nights",area: "Line 2",      skills: ["Quality Checks", "SAP"],            status: "needs-signoff",risk: "medium" },
];

const criticalGaps = [
  {
    title: "Line 3 changeover — limited late shift cover",
    detail: "Only 2 operators validated for changeover on the late shift. Any absence creates a single point of failure.",
    level: "high",
  },
  {
    title: "SAP production confirmations below target",
    detail: "Coverage is 64% against an 80% target. 6 operators are yet to complete the mandatory SAP module.",
    level: "high",
  },
  {
    title: "First response maintenance — concentrated knowledge",
    detail: "Only 2 operators hold validated first response maintenance capability across all shifts.",
    level: "medium",
  },
  {
    title: "Mixing process — senior operator dependency",
    detail: "The majority of mixing process knowledge is held by one senior operator. No validated backup exists.",
    level: "medium",
  },
];

const validationQueue = [
  { operator: "Mark Evans",   competency: "Line Changeover",          evidence: "OJT Log",        submitted: "24 Jun 2026", status: "pending"    },
  { operator: "Dean Okafor",  competency: "SAP Production — Level 2", evidence: "Course Record",  submitted: "22 Jun 2026", status: "pending"    },
  { operator: "James Miller", competency: "Forklift Refresher",       evidence: "Licence Copy",   submitted: "20 Jun 2026", status: "in-review"  },
  { operator: "Priya Nair",   competency: "Quality Check — Level 3",  evidence: "Assessment",     submitted: "18 Jun 2026", status: "in-review"  },
  { operator: "Tom Roberts",  competency: "First Response Maint.",    evidence: "Workshop Sign-off",submitted:"15 Jun 2026", status: "overdue"    },
  { operator: "Lucy Chen",    competency: "Filling — Independent",    evidence: "OJT Log",        submitted: "12 Jun 2026", status: "overdue"    },
];

const aiActions: AiAction[] = [
  {
    label: "Prioritise Line 3 changeover sign-offs this week",
    description: "Two operators are awaiting manager validation for changeover. Completing sign-offs would eliminate the late shift single-point-of-failure risk.",
    priority: "critical",
    icon: ClipboardList,
  },
  {
    label: "Cross-train two packing operators on filling",
    description: "Sarah Hughes and Claire Wong have capacity. Cross-training would increase filling coverage from 81% to an estimated 89% and reduce shift risk.",
    priority: "high",
    icon: TrendingUp,
  },
  {
    label: "Schedule SAP production confirmation refresher",
    description: "A half-day group session for 6 operators on Line 2 would close the SAP coverage gap and bring the metric above the 80% target.",
    priority: "high",
    icon: GraduationCap,
  },
  {
    label: "Capture mixing process knowledge — senior operator risk",
    description: "Create a documented mixing procedure with the senior operator. Identify two operators to shadow and work toward validated independence.",
    priority: "medium",
    icon: Wrench,
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

const statusBadge: Record<string, string> = {
  "validated":      "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  "needs-signoff":  "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  "expiring":       "bg-[#f9731618] text-orange-400 border border-orange-500/20",
  "gap-identified": "bg-[#ef444418] text-red-400 border border-red-500/20",
};

const statusLabel: Record<string, string> = {
  "validated":      "Validated",
  "needs-signoff":  "Needs Sign-Off",
  "expiring":       "Expiring Soon",
  "gap-identified": "Gap Identified",
};

const operatorAction: Record<string, string> = {
  "validated":      "View",
  "needs-signoff":  "Review",
  "expiring":       "Renew",
  "gap-identified": "Assign Training",
};

const queueStatusBadge: Record<string, string> = {
  "pending":   "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  "in-review": "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  "overdue":   "bg-[#ef444418] text-red-400 border border-red-500/20",
};

const queueStatusLabel: Record<string, string> = {
  "pending":   "Pending",
  "in-review": "In Review",
  "overdue":   "Overdue",
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

export const ProductionSkillsMatrixSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Production Manager</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Operator Skills Matrix</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          Track operator competency coverage by production line, process and shift so critical skill gaps can be closed before they affect production.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={89} syncedAt={new Date(Date.now() - 240000)} />
        <ExplainWithAi pageId="production-skills-matrix" />
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

    {/* ── Skills Coverage + Critical Gaps (2-column on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Skills Coverage Overview */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "520ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <BarChart2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Skills Coverage by Process</h2>
            <span className="ml-auto text-[11px] text-slate-500">
              {skillsCoverage.filter((s) => s.risk === "low").length} on target
            </span>
          </div>
          <div className="flex flex-col gap-4 px-5 py-4">
            {skillsCoverage.map((item) => (
              <div key={item.skill} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-medium text-slate-300">{item.skill}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-xs font-semibold text-slate-300">{item.pct}%</span>
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

      {/* Critical Skill Gaps */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "600ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <ShieldAlert className="h-4 w-4 text-orange-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Critical Skill Gaps</h2>
            <span className="ml-auto text-[11px] text-slate-500">{criticalGaps.length} identified</span>
          </div>
          <div className="flex flex-col divide-y divide-gray-800">
            {criticalGaps.map((gap, idx) => (
              <div key={idx} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[#1a2030]">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${gap.level === "high" ? "bg-red-500" : "bg-yellow-400"}`} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-200">{gap.title}</p>
                    <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[gap.level]}`}>
                      {gap.level}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">{gap.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* ── Operator Competency Table ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "680ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <Users className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Operator Competency</h2>
          <span className="ml-auto text-[11px] text-slate-500">{operators.length} operators</span>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Operator</th>
                <th className="px-4 py-3 font-medium text-slate-500">Shift</th>
                <th className="px-4 py-3 font-medium text-slate-500">Primary Area</th>
                <th className="px-4 py-3 font-medium text-slate-500">Key Skills</th>
                <th className="px-4 py-3 font-medium text-slate-500">Validation Status</th>
                <th className="px-4 py-3 font-medium text-slate-500">Risk</th>
                <th className="px-4 py-3 font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e2535] text-[10px] font-bold text-slate-300">
                        {op.initials}
                      </div>
                      <span className="font-medium text-slate-300">{op.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{op.shift}</td>
                  <td className="px-4 py-3 text-slate-400">{op.area}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {op.skills.map((s) => (
                        <span key={s} className="inline-flex items-center rounded bg-[#ffffff08] px-1.5 py-0.5 text-[10px] text-slate-400">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[op.status]}`}>
                      {statusLabel[op.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[op.risk]}`}>
                      {op.risk}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="rounded border border-gray-700 bg-transparent px-2.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
                    >
                      {operatorAction[op.status]}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked */}
        <div className="flex flex-col divide-y divide-gray-800 md:hidden">
          {operators.map((op, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e2535] text-[10px] font-bold text-slate-300">
                  {op.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-300">{op.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{op.shift} · {op.area}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[op.status]}`}>
                  {statusLabel[op.status]}
                </span>
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[op.risk]}`}>
                  {op.risk}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── Manager Validation Queue ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "760ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <CheckCircle2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Manager Validation Queue</h2>
          <span className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#ef444418] text-red-400 border border-red-500/20">
            {validationQueue.filter((q) => q.status === "overdue").length} overdue
          </span>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Operator</th>
                <th className="px-4 py-3 font-medium text-slate-500">Competency</th>
                <th className="px-4 py-3 font-medium text-slate-500">Evidence</th>
                <th className="px-4 py-3 font-medium text-slate-500">Submitted</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {validationQueue.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                >
                  <td className="px-5 py-3 font-medium text-slate-300">{row.operator}</td>
                  <td className="px-4 py-3 text-slate-400">{row.competency}</td>
                  <td className="px-4 py-3 text-slate-500">{row.evidence}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">{row.submitted}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${queueStatusBadge[row.status]}`}>
                      {queueStatusLabel[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="rounded border border-gray-700 bg-transparent px-2.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
                    >
                      {row.status === "overdue" ? "Review Now" : "Sign Off"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked */}
        <div className="flex flex-col divide-y divide-gray-800 md:hidden">
          {validationQueue.map((row, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300">{row.competency}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{row.operator} · {row.submitted}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${queueStatusBadge[row.status]}`}>
                {queueStatusLabel[row.status]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── AI Recommendations ── */}
    <div className="motion-safe:animate-card-enter" style={{ animationDelay: "840ms" }}>
      <AiActionsPanel actions={aiActions} />
    </div>
  </section>
);
