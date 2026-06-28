import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ListChecks,
  ShieldCheck,
  Sparkles,
  TrendingUp,
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
    label: "Tasks Assigned",
    value: "8",
    sub: "This shift",
    icon: ListChecks,
    valueClass: "text-slate-50",
    trend: { direction: "flat" as const, label: "No change",     positiveIsUp: true  },
  },
  {
    label: "Completed",
    value: "4",
    sub: "So far today",
    icon: CheckCircle2,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+2 this hour",  positiveIsUp: true  },
  },
  {
    label: "High Priority",
    value: "3",
    sub: "Needs attention",
    icon: AlertTriangle,
    valueClass: "text-orange-400",
    trend: { direction: "flat" as const, label: "No change",     positiveIsUp: false },
  },
  {
    label: "Overdue",
    value: "1",
    sub: "Action required",
    icon: AlertTriangle,
    valueClass: "text-red-400",
    trend: { direction: "up" as const,   label: "Resolve now",   positiveIsUp: false },
  },
  {
    label: "Quality Actions",
    value: "2",
    sub: "Pending checks",
    icon: ClipboardList,
    valueClass: "text-yellow-400",
    trend: { direction: "flat" as const, label: "No change",     positiveIsUp: false },
  },
  {
    label: "Handover Items",
    value: "3",
    sub: "For next shift",
    icon: TrendingUp,
    valueClass: "text-blue-400",
    trend: { direction: "flat" as const, label: "No change",     positiveIsUp: true  },
  },
];

const tasks = [
  { name: "Complete pre-start checklist",       type: "safety",    area: "Line 2 Filling", priority: "high",   due: "06:15", status: "pending",   action: "Start",   actionPrimary: true  },
  { name: "Confirm product code and batch",      type: "quality",   area: "Line 2 Filling", priority: "high",   due: "06:20", status: "pending",   action: "Open",    actionPrimary: true  },
  { name: "Complete first quality check",        type: "quality",   area: "Line 2 Filling", priority: "high",   due: "06:30", status: "pending",   action: "Open",    actionPrimary: true  },
  { name: "Update SAP production confirmation",  type: "sap",       area: "Line 2 Filling", priority: "medium", due: "08:00", status: "scheduled", action: "View",    actionPrimary: false },
  { name: "Record minor label feed issue",       type: "handover",  area: "Line 2 Filling", priority: "medium", due: "10:00", status: "open",      action: "Update",  actionPrimary: true  },
  { name: "Support Line 3 changeover prep",      type: "support",   area: "Line 3",         priority: "medium", due: "11:30", status: "scheduled", action: "View",    actionPrimary: false },
  { name: "Complete final quality check",        type: "quality",   area: "Line 2 Filling", priority: "high",   due: "12:30", status: "scheduled", action: "Open",    actionPrimary: false },
  { name: "Submit end-of-shift handover",        type: "handover",  area: "Line 2 Filling", priority: "high",   due: "13:45", status: "scheduled", action: "Prepare", actionPrimary: false },
];

const priorityActions = [
  { text: "Pre-start checklist must be completed before production begins on Line 2.",              urgent: true  },
  { text: "Product code and batch must be confirmed before the first production run starts.",        urgent: true  },
  { text: "First quality check is due at 06:30 — do not delay past start of first run.",            urgent: true  },
  { text: "End-of-shift handover must include the label feed issue for the incoming shift team.",    urgent: false },
];

const taskCategories = [
  { label: "Safety Checks",    value: 50, color: "[&>div]:bg-emerald-500" },
  { label: "Quality Checks",   value: 33, color: "[&>div]:bg-blue-500"    },
  { label: "SAP Updates",      value: 0,  color: "[&>div]:bg-slate-700"   },
  { label: "Production Support",value: 0, color: "[&>div]:bg-slate-700"   },
  { label: "Handover Notes",   value: 33, color: "[&>div]:bg-yellow-400"  },
];

const aiActions: AiAction[] = [
  {
    label: "Complete the pre-start checklist before starting Line 2 production",
    description: "The pre-start checklist is mandatory before production begins and is currently overdue. Completing it now unblocks the line and ensures all safety requirements are met before the first run.",
    priority: "critical",
    icon: ShieldCheck,
  },
  {
    label: "Confirm the product code and batch before the first quality check",
    description: "Product code and batch confirmation must happen before the first quality check at 06:30. Missing this step means the quality check cannot be signed off and creates a downstream compliance gap.",
    priority: "high",
    icon: ClipboardList,
  },
  {
    label: "Record the label feed issue early so the next shift receives a clear handover",
    description: "The label feed issue was spotted at shift start. Logging it now means the handover note is accurate when submitted at 13:45 and avoids the incoming shift starting with an undocumented fault.",
    priority: "medium",
    icon: AlertTriangle,
  },
  {
    label: "Prepare Line 3 changeover support before 11:30 to avoid production delay",
    description: "Line 3 changeover support is scheduled for 11:30. Reviewing what is needed beforehand reduces the risk of a delayed changeover and helps the Line 3 team stay on schedule.",
    priority: "medium",
    icon: TrendingUp,
  },
];

const recentActivity = [
  { when: "05:45", activity: "Tasks loaded for early shift",            status: "complete" },
  { when: "06:00", activity: "Shift handover reviewed",                 status: "complete" },
  { when: "06:15", activity: "Pre-start checklist assigned",            status: "pending"  },
  { when: "06:30", activity: "First quality check reminder issued",     status: "pending"  },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const typeBadge: Record<string, string> = {
  safety:   "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  quality:  "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  sap:      "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  handover: "bg-[#f9731618] text-orange-400 border border-orange-500/20",
  support:  "bg-[#ffffff10] text-slate-400 border border-gray-700",
};

const typeLabel: Record<string, string> = {
  safety: "Safety", quality: "Quality", sap: "SAP", handover: "Handover", support: "Production Support",
};

const priorityBadge: Record<string, string> = {
  high:   "bg-[#ef444418] text-red-400 border border-red-500/20",
  medium: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
};

const priorityLabel: Record<string, string> = {
  high: "High", medium: "Medium",
};

const statusBadge: Record<string, string> = {
  pending:   "bg-[#ef444418] text-red-400 border border-red-500/20",
  open:      "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  scheduled: "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  complete:  "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
};

const statusLabel: Record<string, string> = {
  pending: "Pending", open: "Open", scheduled: "Scheduled", complete: "Complete",
};

const activityStatusBadge: Record<string, string> = {
  complete: "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  pending:  "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
};

const activityStatusLabel: Record<string, string> = {
  complete: "Complete", pending: "Pending",
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

export const OperatorTasksSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Operator Portal</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Tasks</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          Track your assigned production tasks, safety checks, quality actions and handover items so the shift runs safely and efficiently.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={92} syncedAt={new Date(Date.now() - 90000)} />
        <ExplainWithAi pageId="operator-tasks" />
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

    {/* ── Task Summary ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "520ms" }}
    >
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
          <ListChecks className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Task Summary</h2>
          <span className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#ef444418] text-red-400 border border-red-500/20">
            Action Required
          </span>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-28 shrink-0">Shift Completion</span>
            <div className="flex flex-1 items-center gap-3">
              <AnimatedProgress value={50} className="h-2 flex-1 bg-gray-800 [&>div]:bg-blue-500" />
              <span className="w-8 text-right text-xs font-semibold tabular-nums text-blue-400">50%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-1 sm:grid-cols-4">
            {[
              { label: "Shift",           value: "Early Shift",             valueClass: "text-slate-50"     },
              { label: "Assigned Area",   value: "Line 2 Filling",          valueClass: "text-slate-50"     },
              { label: "Highest Priority",value: "Pre-start checklist",     valueClass: "text-orange-400"   },
              { label: "Next Due",        value: "Quality check at 06:30",  valueClass: "text-yellow-400"   },
            ].map(({ label, value, valueClass }) => (
              <div key={label} className="flex flex-col gap-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
                <p className={`text-sm font-semibold ${valueClass}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>

    {/* ── My Tasks Table ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "600ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <ClipboardList className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">My Tasks</h2>
          <span className="ml-auto text-[11px] text-slate-500">
            {tasks.filter((t) => t.status === "complete").length} of {tasks.length} complete
          </span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Task</th>
                <th className="px-4 py-3 font-medium text-slate-500">Type</th>
                <th className="px-4 py-3 font-medium text-slate-500">Area</th>
                <th className="px-4 py-3 font-medium text-slate-500">Priority</th>
                <th className="px-4 py-3 font-medium text-slate-500">Due</th>
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
                  <td className="px-5 py-3 font-medium text-slate-300">{row.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${typeBadge[row.type]}`}>
                      {typeLabel[row.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.area}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadge[row.priority]}`}>
                      {priorityLabel[row.priority]}
                    </span>
                  </td>
                  <td className={`px-4 py-3 tabular-nums font-semibold ${row.status === "pending" ? "text-orange-400" : "text-slate-400"}`}>
                    {row.due}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[row.status]}`}>
                      {statusLabel[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        row.actionPrimary
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
                <p className="text-xs font-medium text-slate-300">{row.name}</p>
                <p className={`mt-0.5 text-[11px] tabular-nums ${row.status === "pending" ? "text-orange-400" : "text-slate-500"}`}>
                  {row.area} · Due {row.due}
                </p>
              </div>
              <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[row.status]}`}>
                {statusLabel[row.status]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── Priority Actions + Task Categories (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Priority Actions */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "680ms" }}
      >
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <AlertTriangle className="h-4 w-4 text-orange-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Priority Actions</h2>
            <span className="ml-auto text-[11px] text-slate-500">
              {priorityActions.filter((a) => a.urgent).length} urgent
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {priorityActions.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                  item.urgent
                    ? "border-orange-500/20 bg-[#f9731608]"
                    : "border-gray-800 bg-[#0f1318]"
                }`}
              >
                <AlertTriangle
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.urgent ? "text-orange-400" : "text-slate-600"}`}
                  aria-hidden="true"
                />
                <p className="text-[11px] leading-relaxed text-slate-400">{item.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Task Categories */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "760ms" }}
      >
        <CardContent className="p-5">
          <div className="mb-5 flex items-center gap-2 border-b border-gray-800 pb-4">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Task Categories</h2>
          </div>
          <div className="flex flex-col gap-4">
            {taskCategories.map(({ label, value, color }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">{label}</span>
                  <span className="text-[11px] tabular-nums font-semibold text-slate-400">{value}%</span>
                </div>
                <AnimatedProgress value={value} className={`h-2 bg-gray-800 ${color}`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* ── AI Guidance ── */}
    <div className="motion-safe:animate-card-enter" style={{ animationDelay: "840ms" }}>
      <AiActionsPanel actions={aiActions} />
    </div>

    {/* ── Recent Task Activity ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "920ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Recent Task Activity</h2>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Time</th>
                <th className="px-4 py-3 font-medium text-slate-500">Task Activity</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                >
                  <td className="px-5 py-3 tabular-nums font-medium text-slate-500">{row.when}</td>
                  <td className="px-4 py-3 font-medium text-slate-300">{row.activity}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${activityStatusBadge[row.status]}`}>
                      {activityStatusLabel[row.status]}
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
                <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">{row.when}</p>
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
