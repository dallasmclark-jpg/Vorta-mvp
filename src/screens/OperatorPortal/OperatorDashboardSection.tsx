import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
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
    label: "Shift Readiness",
    value: "92%",
    sub: "Ready for today",
    icon: CheckCircle2,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+3% vs yesterday", positiveIsUp: true  },
  },
  {
    label: "Active Competencies",
    value: "14",
    sub: "Validated",
    icon: ShieldCheck,
    valueClass: "text-emerald-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: true  },
  },
  {
    label: "Training Due",
    value: "2",
    sub: "Actions pending",
    icon: GraduationCap,
    valueClass: "text-yellow-400",
    trend: { direction: "up" as const,   label: "1 due this week",  positiveIsUp: false },
  },
  {
    label: "Compliance Status",
    value: "96%",
    sub: "1 item needs attention",
    icon: ClipboardList,
    valueClass: "text-emerald-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: true  },
  },
  {
    label: "Assigned Actions",
    value: "3",
    sub: "Today",
    icon: AlertTriangle,
    valueClass: "text-yellow-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: false },
  },
  {
    label: "AI Readiness Score",
    value: "89%",
    sub: "Confidence",
    icon: Sparkles,
    valueClass: "text-blue-400",
    trend: { direction: "up" as const,   label: "+2% this week",    positiveIsUp: true  },
  },
];

const tasks = [
  { task: "Complete pre-start checks",         area: "Line 2 Filling", priority: "high",   status: "pending",   action: "Start"  },
  { task: "Confirm production order in SAP",   area: "Line 2 Filling", priority: "medium", status: "pending",   action: "View"   },
  { task: "Complete quality check record",     area: "Line 2 Filling", priority: "high",   status: "pending",   action: "Open"   },
  { task: "Support changeover preparation",    area: "Line 3",         priority: "medium", status: "scheduled", action: "View"   },
];

const competencies = [
  { name: "Line 2 Filling",            level: 100, status: "validated"       },
  { name: "Packing",                   level: 100, status: "validated"       },
  { name: "SAP Production Confirmation",level: 100, status: "validated"      },
  { name: "Quality Checks",            level: 100, status: "validated"       },
  { name: "Line Changeover",           level: 65,  status: "in-progress"     },
  { name: "First Response Maintenance",level: 20,  status: "training-needed" },
];

const trainingItems = [
  { item: "Line Changeover refresher",  dueIn: "14 days", status: "due",      urgent: true  },
  { item: "Food Safety refresher",      dueIn: "—",        status: "complete", urgent: false },
  { item: "Competency manager sign-off",dueIn: "Pending",  status: "pending",  urgent: false },
  { item: "Forklift licence",           dueIn: "N/A",      status: "n-a",      urgent: false },
];

const aiActions: AiAction[] = [
  {
    label: "Complete the Line 2 pre-start checklist before production begins",
    description: "The pre-start checklist is required before the line can be cleared for production. Completing it now avoids a delay at shift start and keeps the line on schedule.",
    priority: "critical",
    icon: ClipboardList,
  },
  {
    label: "Review SAP production confirmation steps before your first batch",
    description: "Your last SAP confirmation was 3 days ago. A quick review of the confirmation workflow ensures accuracy on today's first batch and avoids a production order discrepancy.",
    priority: "high",
    icon: BookOpen,
  },
  {
    label: "Ask for Line Changeover sign-off during today's planned changeover",
    description: "Your Line Changeover competency is at 65% completion. Today's scheduled changeover on Line 3 is an ideal opportunity to complete a supervised assessment and progress to validation.",
    priority: "high",
    icon: TrendingUp,
  },
  {
    label: "Complete the Line Changeover refresher before the expiry window closes",
    description: "The refresher is due in 14 days. Completing it early avoids a compliance gap on your record and keeps your competency profile current for upcoming shift planning.",
    priority: "medium",
    icon: GraduationCap,
  },
];

const recentActivity = [
  { time: "05:45", activity: "Shift dashboard opened",        status: "complete" },
  { time: "05:50", activity: "Pre-start checklist assigned",  status: "pending"  },
  { time: "06:10", activity: "Quality check reminder issued", status: "pending"  },
  { time: "06:30", activity: "Training reminder updated",     status: "open"     },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const priorityBadge: Record<string, string> = {
  high:   "bg-[#ef444418] text-red-400 border border-red-500/20",
  medium: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  low:    "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
};

const taskStatusBadge: Record<string, string> = {
  pending:   "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  scheduled: "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  complete:  "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
};

const compStatusBadge: Record<string, string> = {
  "validated":       "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  "in-progress":     "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  "training-needed": "bg-[#ef444418] text-red-400 border border-red-500/20",
};

const compStatusLabel: Record<string, string> = {
  "validated":       "Validated",
  "in-progress":     "In Progress",
  "training-needed": "Training Needed",
};

const compBarColor: Record<string, string> = {
  "validated":       "[&>div]:bg-emerald-500",
  "in-progress":     "[&>div]:bg-yellow-400",
  "training-needed": "[&>div]:bg-red-500",
};

const trainingStatusBadge: Record<string, string> = {
  due:      "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  complete: "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  pending:  "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  "n-a":    "bg-[#ffffff10] text-slate-500 border border-gray-700",
};

const trainingStatusLabel: Record<string, string> = {
  due: "Due", complete: "Complete", pending: "Pending", "n-a": "N/A",
};

const activityStatusBadge: Record<string, string> = {
  complete: "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  pending:  "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  open:     "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
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

export const OperatorDashboardSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Operator Portal</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Dashboard</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          View today's shift, assigned production area, training actions, competency status and AI guidance so you can stay ready, compliant and productive.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={89} syncedAt={new Date(Date.now() - 120000)} />
        <ExplainWithAi pageId="operator-dashboard" />
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

    {/* ── Today's Shift Summary ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "520ms" }}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-2 pb-4">
          <Clock className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Today's Shift</h2>
          <span className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#10b98118] text-emerald-400 border border-emerald-500/20">
            Ready
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Shift",         value: "Early Shift"              },
            { label: "Time",          value: "06:00 – 14:00"            },
            { label: "Assigned Area", value: "Line 2 Filling"           },
            { label: "Line Lead",     value: "R. Thompson"              },
            { label: "Status",        value: "Ready"                    },
            { label: "Main Focus",    value: "Quality checks & SAP"     },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="text-sm font-semibold text-slate-200">{value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── Tasks + Competencies (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Assigned Tasks */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "600ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <ClipboardList className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">My Assigned Tasks</h2>
            <span className="ml-auto text-[11px] text-slate-500">
              {tasks.filter((t) => t.status === "pending").length} pending
            </span>
          </div>

          {/* Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Task</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Area</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Priority</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-300">{row.task}</td>
                    <td className="px-4 py-3 text-slate-500">{row.area}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadge[row.priority]}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${taskStatusBadge[row.status]}`}>
                        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          row.priority === "high"
                            ? "border-emerald-500/30 bg-[#10b98110] text-emerald-400 hover:border-emerald-500/50 hover:text-emerald-300"
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
            {tasks.map((row, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-300">{row.task}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{row.area}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadge[row.priority]}`}>
                    {row.priority}
                  </span>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${taskStatusBadge[row.status]}`}>
                    {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* My Competencies */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "680ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">My Competencies</h2>
            <span className="ml-auto text-[11px] text-slate-500">
              {competencies.filter((c) => c.status === "validated").length} validated
            </span>
          </div>
          <div className="flex flex-col gap-4 p-5">
            {competencies.map((comp) => (
              <div key={comp.name} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">{comp.name}</span>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${compStatusBadge[comp.status]}`}>
                    {compStatusLabel[comp.status]}
                  </span>
                </div>
                <AnimatedProgress value={comp.level} className={`h-1.5 bg-gray-800 ${compBarColor[comp.status]}`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* ── Training & Compliance ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "760ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <GraduationCap className="h-4 w-4 text-yellow-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Training &amp; Compliance</h2>
          <span className="ml-auto text-[11px] text-slate-500">
            {trainingItems.filter((t) => t.urgent).length} item{trainingItems.filter((t) => t.urgent).length !== 1 ? "s" : ""} need attention
          </span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Item</th>
                <th className="px-4 py-3 font-medium text-slate-500">Due</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {trainingItems.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                >
                  <td className="px-5 py-3 font-medium text-slate-300">{row.item}</td>
                  <td className={`px-4 py-3 tabular-nums ${row.urgent ? "text-yellow-400 font-semibold" : "text-slate-500"}`}>
                    {row.dueIn}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${trainingStatusBadge[row.status]}`}>
                      {trainingStatusLabel[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.status !== "complete" && row.status !== "n-a" && (
                      <button
                        type="button"
                        className="rounded border border-gray-700 px-2.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="flex flex-col divide-y divide-gray-800 md:hidden">
          {trainingItems.map((row, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300">{row.item}</p>
                <p className={`mt-0.5 text-[11px] ${row.urgent ? "text-yellow-400 font-semibold" : "text-slate-500"}`}>
                  Due: {row.dueIn}
                </p>
              </div>
              <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${trainingStatusBadge[row.status]}`}>
                {trainingStatusLabel[row.status]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── AI Guidance ── */}
    <div className="motion-safe:animate-card-enter" style={{ animationDelay: "840ms" }}>
      <AiActionsPanel actions={aiActions} />
    </div>

    {/* ── Recent Activity ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "920ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <Activity className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Recent Activity</h2>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Time</th>
                <th className="px-4 py-3 font-medium text-slate-500">Activity</th>
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
                  <td className="px-4 py-3 font-medium text-slate-300">{row.activity}</td>
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
                <p className="text-xs font-medium text-slate-300">{row.activity}</p>
                <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">{row.time}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${activityStatusBadge[row.status]}`}>
                {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </section>
);
