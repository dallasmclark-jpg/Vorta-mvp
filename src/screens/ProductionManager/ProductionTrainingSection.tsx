import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
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
    label: "Competency Compliance",
    value: "91%",
    sub: "+2% vs last month",
    icon: ShieldCheck,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+2% vs last month", positiveIsUp: true  },
  },
  {
    label: "Training Due This Month",
    value: "12",
    sub: "Across all areas",
    icon: GraduationCap,
    valueClass: "text-yellow-400",
    trend: { direction: "down" as const, label: "-3 vs last month",  positiveIsUp: false },
  },
  {
    label: "Expiring Competencies",
    value: "7",
    sub: "Within 30 days",
    icon: AlertTriangle,
    valueClass: "text-orange-400",
    trend: { direction: "up" as const,   label: "+2 this week",      positiveIsUp: false },
  },
  {
    label: "Awaiting Validation",
    value: "9",
    sub: "Pending manager sign-off",
    icon: UserCheck,
    valueClass: "text-yellow-400",
    trend: { direction: "up" as const,   label: "+2 vs yesterday",   positiveIsUp: false },
  },
  {
    label: "New Starters",
    value: "4",
    sub: "In onboarding",
    icon: Users,
    valueClass: "text-slate-50",
    trend: { direction: "flat" as const, label: "No change",         positiveIsUp: true  },
  },
  {
    label: "Mandatory Overdue",
    value: "3",
    sub: "Require urgent action",
    icon: ClipboardList,
    valueClass: "text-red-400",
    trend: { direction: "flat" as const, label: "No change",         positiveIsUp: false },
  },
];

const mandatoryTraining = [
  { category: "Food Safety",                   pct: 96, due: 2, nextExpiry: "15 Jul 2026",  risk: "low"    },
  { category: "Health & Safety",               pct: 100,due: 0, nextExpiry: "22 Sep 2026",  risk: "low"    },
  { category: "Manual Handling",               pct: 88, due: 5, nextExpiry: "3 Aug 2026",   risk: "medium" },
  { category: "Lock Out / Tag Out",            pct: 94, due: 3, nextExpiry: "18 Jul 2026",  risk: "low"    },
  { category: "Forklift Licence",              pct: 72, due: 8, nextExpiry: "30 Jun 2026",  risk: "high"   },
  { category: "First Aid",                     pct: 83, due: 4, nextExpiry: "10 Aug 2026",  risk: "medium" },
  { category: "Fire Marshal",                  pct: 91, due: 2, nextExpiry: "5 Sep 2026",   risk: "low"    },
  { category: "SAP Production Confirmation",   pct: 64, due: 9, nextExpiry: "12 Jul 2026",  risk: "high"   },
  { category: "Changeover Procedure",          pct: 78, due: 6, nextExpiry: "20 Jul 2026",  risk: "medium" },
];

const validationQueue = [
  { operator: "Sarah Hughes", competency: "Line Changeover",          submitted: "Yesterday", assessor: "J. Smith", status: "awaiting" },
  { operator: "Mark Evans",   competency: "SAP Production Confirm.",  submitted: "Today",     assessor: "P. Jones", status: "review"   },
  { operator: "Tom Roberts",  competency: "Mixing Process",           submitted: "Monday",    assessor: "A. Brown", status: "pending"  },
  { operator: "Aisha Khan",   competency: "Forklift Refresher",       submitted: "Friday",    assessor: "J. Smith", status: "awaiting" },
  { operator: "Dean Okafor",  competency: "First Aid Renewal",        submitted: "Last Week", assessor: "P. Jones", status: "overdue"  },
];

const expiringCompetencies = [
  { operator: "James Miller", competency: "Forklift Licence",          expiry: "30 Jun 2026", window: "30",  priority: "high"   },
  { operator: "Claire Wong",  competency: "Food Safety Level 2",       expiry: "15 Jul 2026", window: "30",  priority: "high"   },
  { operator: "Tom Roberts",  competency: "SAP Production — Level 1",  expiry: "12 Jul 2026", window: "30",  priority: "high"   },
  { operator: "Sarah Hughes", competency: "First Aid",                 expiry: "10 Aug 2026", window: "60",  priority: "medium" },
  { operator: "Mark Evans",   competency: "Manual Handling",           expiry: "3 Aug 2026",  window: "60",  priority: "medium" },
  { operator: "Priya Nair",   competency: "Fire Marshal",              expiry: "5 Sep 2026",  window: "90",  priority: "low"    },
];

const newStarters = [
  {
    name: "Liam O'Brien",   initials: "LO", line: "Line 2",
    steps: [
      { label: "Induction",             done: true  },
      { label: "Mandatory Training",    done: true  },
      { label: "Line Training",         done: true  },
      { label: "Supervised Operation",  done: false },
      { label: "Independent Validation",done: false },
    ],
  },
  {
    name: "Fatima Al-Hassan", initials: "FA", line: "Line 1",
    steps: [
      { label: "Induction",             done: true  },
      { label: "Mandatory Training",    done: true  },
      { label: "Line Training",         done: false },
      { label: "Supervised Operation",  done: false },
      { label: "Independent Validation",done: false },
    ],
  },
  {
    name: "Jake Morrison",  initials: "JM", line: "Mixing",
    steps: [
      { label: "Induction",             done: true  },
      { label: "Mandatory Training",    done: false },
      { label: "Line Training",         done: false },
      { label: "Supervised Operation",  done: false },
      { label: "Independent Validation",done: false },
    ],
  },
  {
    name: "Yuki Tanaka",    initials: "YT", line: "Line 3",
    steps: [
      { label: "Induction",             done: true  },
      { label: "Mandatory Training",    done: true  },
      { label: "Line Training",         done: true  },
      { label: "Supervised Operation",  done: true  },
      { label: "Independent Validation",done: false },
    ],
  },
];

const recentActivity = [
  { time: "08:10", operator: "Sarah Hughes",  activity: "Changeover Validation Completed", status: "complete",   trainer: "J. Smith"  },
  { time: "09:25", operator: "James Miller",  activity: "Forklift Refresher Booked",        status: "scheduled",  trainer: "P. Jones"  },
  { time: "10:45", operator: "Emily Davies",  activity: "Food Safety Level 2 Completed",    status: "complete",   trainer: "A. Brown"  },
  { time: "11:30", operator: "Tom Roberts",   activity: "SAP Production Training Assigned", status: "pending",    trainer: "P. Jones"  },
];

const aiActions: AiAction[] = [
  {
    label: "Prioritise Line 3 changeover refresher training this week",
    description: "Three operators are overdue for the changeover refresher. Running a targeted session this week closes the validation gap before the next shift rotation.",
    priority: "critical",
    icon: ClipboardList,
  },
  {
    label: "Schedule forklift renewals before licence expiry",
    description: "Two forklift licences expire within 2 days. Scheduling renewal sessions now prevents an immediate compliance breach on the warehouse and Line 3 teams.",
    priority: "critical",
    icon: AlertTriangle,
  },
  {
    label: "Accelerate onboarding for two new operators assigned to Line 2",
    description: "Liam O'Brien and Fatima Al-Hassan are both in supervised operation stage. Assigning a dedicated trainer for 3 shifts would complete their independent validations.",
    priority: "high",
    icon: TrendingUp,
  },
  {
    label: "Complete outstanding competency sign-offs before next shift rotation",
    description: "9 operators are awaiting manager validation. Clearing the queue before the next rotation prevents competency gaps from carrying into the new shift.",
    priority: "high",
    icon: UserCheck,
  },
  {
    label: "Cross-train packing operators to reduce overtime dependency",
    description: "Two packing operators with capacity can be cross-trained on filling. This reduces reliance on overtime to cover Line 2 and builds redundancy into the roster.",
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

const queueStatusBadge: Record<string, string> = {
  awaiting: "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  review:   "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  pending:  "bg-[#ffffff10] text-slate-400 border border-gray-700",
  overdue:  "bg-[#ef444418] text-red-400 border border-red-500/20",
};

const queueStatusLabel: Record<string, string> = {
  awaiting: "Awaiting Sign-Off",
  review:   "Review Required",
  pending:  "Pending",
  overdue:  "Overdue",
};

const activityStatusBadge: Record<string, string> = {
  complete:  "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  scheduled: "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  pending:   "bg-[#ffffff10] text-slate-400 border border-gray-700",
};

const activityStatusLabel: Record<string, string> = {
  complete:  "Complete",
  scheduled: "Scheduled",
  pending:   "Pending",
};

const windowBadge: Record<string, string> = {
  "30": "bg-[#ef444418] text-red-400 border border-red-500/20",
  "60": "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  "90": "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
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

export const ProductionTrainingSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Production Manager</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Training &amp; Competency</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          Monitor mandatory training, competency validation, refresher requirements and onboarding progress to maintain a safe and capable production workforce.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={91} syncedAt={new Date(Date.now() - 180000)} />
        <ExplainWithAi pageId="production-training" />
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

    {/* ── Mandatory Training + Validation Queue (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Mandatory Training Overview */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "520ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <BookOpen className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Mandatory Training Overview</h2>
            <span className="ml-auto text-[11px] text-slate-500">
              {mandatoryTraining.filter((t) => t.risk === "low").length} on target
            </span>
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Category</th>
                  <th className="px-4 py-3 font-medium text-slate-500 text-right">Complete</th>
                  <th className="px-4 py-3 font-medium text-slate-500 text-right">Due</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Next Expiry</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Risk</th>
                </tr>
              </thead>
              <tbody>
                {mandatoryTraining.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-medium text-slate-300">{row.category}</span>
                        <AnimatedProgress value={row.pct} className={`h-1 bg-gray-800 ${riskBar[row.risk]}`} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: row.pct >= 90 ? "#10b981" : row.pct >= 75 ? "#facc15" : "#ef4444" }}>
                      {row.pct}%
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: row.due === 0 ? "#64748b" : row.due <= 3 ? "#facc15" : "#ef4444" }}>
                      {row.due === 0 ? "—" : row.due}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-500">{row.nextExpiry}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[row.risk]}`}>
                        {row.risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="flex flex-col gap-3 px-5 py-4 md:hidden">
            {mandatoryTraining.map((row) => (
              <div key={row.category} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">{row.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-xs font-semibold" style={{ color: row.pct >= 90 ? "#10b981" : row.pct >= 75 ? "#facc15" : "#ef4444" }}>{row.pct}%</span>
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[row.risk]}`}>{row.risk}</span>
                  </div>
                </div>
                <AnimatedProgress value={row.pct} className={`h-1.5 bg-gray-800 ${riskBar[row.risk]}`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Competency Validation Queue */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "600ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <CheckCircle2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Competency Validation Queue</h2>
            <span className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#ef444418] text-red-400 border border-red-500/20">
              {validationQueue.filter((q) => q.status === "overdue").length} overdue
            </span>
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Operator</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Competency</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Submitted</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Assessor</th>
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
                    <td className="px-4 py-3 text-slate-500">{row.submitted}</td>
                    <td className="px-4 py-3 text-slate-500">{row.assessor}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${queueStatusBadge[row.status]}`}>
                        {queueStatusLabel[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          row.status === "overdue"
                            ? "border-red-500/30 bg-[#ef444410] text-red-400 hover:border-red-500/50 hover:text-red-300"
                            : "border-gray-700 bg-transparent text-slate-400 hover:border-gray-600 hover:text-slate-200"
                        }`}
                      >
                        {row.status === "overdue" ? "Review Now" : "Sign Off"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
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
    </div>

    {/* ── Expiring Competencies + New Starters (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Expiring Competencies */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "680ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <AlertTriangle className="h-4 w-4 text-orange-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Expiring Competencies</h2>
            <span className="ml-auto text-[11px] text-slate-500">{expiringCompetencies.length} operators</span>
          </div>
          <div className="flex flex-col divide-y divide-gray-800">
            {expiringCompetencies.map((row, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3 transition-colors hover:bg-[#1a2030]">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-300">{row.operator}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{row.competency}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="tabular-nums text-[11px] text-slate-400">{row.expiry}</span>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${windowBadge[row.window]}`}>
                    {row.window}d
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* New Starter Progress */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "760ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <Users className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">New Starter Progress</h2>
            <span className="ml-auto text-[11px] text-slate-500">{newStarters.length} in onboarding</span>
          </div>
          <div className="flex flex-col divide-y divide-gray-800">
            {newStarters.map((starter) => {
              const doneCount = starter.steps.filter((s) => s.done).length;
              const pct = Math.round((doneCount / starter.steps.length) * 100);
              return (
                <div key={starter.name} className="flex flex-col gap-2.5 px-5 py-3.5 transition-colors hover:bg-[#1a2030]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e2535] text-[10px] font-bold text-slate-300">
                        {starter.initials}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-300">{starter.name}</p>
                        <p className="text-[10px] text-slate-500">{starter.line}</p>
                      </div>
                    </div>
                    <span className="tabular-nums text-xs font-semibold" style={{ color: pct === 100 ? "#10b981" : pct >= 60 ? "#facc15" : "#94a3b8" }}>{pct}%</span>
                  </div>
                  <div className="flex gap-1">
                    {starter.steps.map((step) => (
                      <div
                        key={step.label}
                        title={step.label}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${step.done ? "bg-emerald-500" : "bg-gray-700"}`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {starter.steps.map((step) => (
                      <span
                        key={step.label}
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${
                          step.done
                            ? "bg-[#10b98118] text-emerald-400 border border-emerald-500/20"
                            : "bg-[#ffffff08] text-slate-500 border border-gray-800"
                        }`}
                      >
                        {step.label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* ── AI Recommendations ── */}
    <div className="motion-safe:animate-card-enter" style={{ animationDelay: "840ms" }}>
      <AiActionsPanel actions={aiActions} />
    </div>

    {/* ── Recent Training Activity ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "920ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <Zap className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Recent Training Activity</h2>
        </div>
        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Time</th>
                <th className="px-4 py-3 font-medium text-slate-500">Operator</th>
                <th className="px-4 py-3 font-medium text-slate-500">Activity</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500">Trainer</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                >
                  <td className="px-5 py-3 tabular-nums text-slate-500">{row.time}</td>
                  <td className="px-4 py-3 font-medium text-slate-300">{row.operator}</td>
                  <td className="px-4 py-3 text-slate-400">{row.activity}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${activityStatusBadge[row.status]}`}>
                      {activityStatusLabel[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.trainer}</td>
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
                <p className="text-xs font-medium text-slate-300">{row.activity}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{row.operator} · {row.time}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${activityStatusBadge[row.status]}`}>
                {activityStatusLabel[row.status]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </section>
);
