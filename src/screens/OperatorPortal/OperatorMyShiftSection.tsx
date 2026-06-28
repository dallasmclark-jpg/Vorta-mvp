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
} from "lucide-react";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
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
    sub: "All checks on track",
    icon: CheckCircle2,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+3% vs yesterday", positiveIsUp: true  },
  },
  {
    label: "Tasks Assigned",
    value: "6",
    sub: "Today",
    icon: ClipboardList,
    valueClass: "text-slate-50",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: true  },
  },
  {
    label: "Tasks Complete",
    value: "3",
    sub: "This shift",
    icon: CheckCircle2,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+2 vs start",      positiveIsUp: true  },
  },
  {
    label: "Safety Checks Due",
    value: "2",
    sub: "Require action",
    icon: ShieldCheck,
    valueClass: "text-yellow-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: false },
  },
  {
    label: "Handover Notes",
    value: "4",
    sub: "From previous shift",
    icon: BookOpen,
    valueClass: "text-blue-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: true  },
  },
  {
    label: "Production Priority",
    value: "High",
    sub: "Today's plan",
    icon: AlertTriangle,
    valueClass: "text-red-400",
    trend: { direction: "up" as const,   label: "Above baseline",   positiveIsUp: false },
  },
];

const timeline = [
  { time: "05:45", activity: "Arrive / clock in",           area: "Site",          status: "complete",  action: "View"    },
  { time: "06:00", activity: "Shift handover",              area: "Line 2 Filling", status: "complete",  action: "View"    },
  { time: "06:15", activity: "Pre-start checks",            area: "Line 2 Filling", status: "pending",   action: "Start"   },
  { time: "06:30", activity: "First quality check",         area: "Line 2 Filling", status: "pending",   action: "Open"    },
  { time: "08:00", activity: "SAP production confirmation", area: "Line 2 Filling", status: "scheduled", action: "View"    },
  { time: "10:00", activity: "Break cover handover",        area: "Line 2 Filling", status: "scheduled", action: "View"    },
  { time: "12:30", activity: "Final quality check",         area: "Line 2 Filling", status: "scheduled", action: "Open"    },
  { time: "13:45", activity: "End-of-shift handover",       area: "Line 2 Filling", status: "scheduled", action: "Prepare" },
];

const tasks = [
  { task: "Complete pre-start checklist",          priority: "high",   due: "06:15", status: "pending",   action: "Start"   },
  { task: "Confirm product code and batch",        priority: "high",   due: "06:20", status: "pending",   action: "Open"    },
  { task: "Complete first quality check",          priority: "high",   due: "06:30", status: "pending",   action: "Open"    },
  { task: "Update SAP production confirmations",   priority: "medium", due: "08:00", status: "scheduled", action: "View"    },
  { task: "Support Line 3 changeover prep",        priority: "medium", due: "11:30", status: "scheduled", action: "View"    },
  { task: "Submit end-of-shift handover",          priority: "high",   due: "13:45", status: "scheduled", action: "Prepare" },
];

const handoverNotes = [
  { text: "Previous shift reported minor label feed issues on Line 2.",                            urgent: true  },
  { text: "Quality hold remains active for Batch F-204 until supervisor approval.",               urgent: true  },
  { text: "Line 3 may request changeover support after 11:30.",                                   urgent: false },
  { text: "SAP confirmation must be completed before first break.",                                urgent: false },
];

const safetyChecks = [
  { label: "PPE check",              status: "complete" },
  { label: "Line clearance",         status: "pending"  },
  { label: "LOTO awareness",         status: "complete" },
  { label: "Quality documentation",  status: "pending"  },
  { label: "Food safety check",      status: "complete" },
  { label: "Escalation contact",     status: "review"   },
];

const aiActions: AiAction[] = [
  {
    label: "Complete Line 2 pre-start checks before production begins",
    description: "Pre-start checks must be signed off before the line can be cleared to run. Completing them by 06:15 keeps the shift on plan and avoids a late production start.",
    priority: "critical",
    icon: ClipboardList,
  },
  {
    label: "Review the label feed issue from the previous shift before first run",
    description: "The previous shift logged a minor label feed fault on Line 2. Confirming the issue is resolved before first product run avoids a potential quality hold or line stoppage.",
    priority: "critical",
    icon: AlertTriangle,
  },
  {
    label: "Confirm quality hold status before processing Batch F-204",
    description: "Batch F-204 is currently under a quality hold. Processing it before supervisor approval would be a compliance breach. Confirm status with the line lead before starting.",
    priority: "high",
    icon: ShieldCheck,
  },
  {
    label: "Ask for Line 3 changeover sign-off if supporting the planned changeover",
    description: "Your Line Changeover competency is at 65%. Today's planned Line 3 changeover is an opportunity to complete a supervised assessment. Confirm with the line lead at 11:30.",
    priority: "medium",
    icon: GraduationCap,
  },
];

const recentActivity = [
  { time: "05:45", activity: "Shift dashboard opened",                status: "complete" },
  { time: "06:00", activity: "Handover notes reviewed",              status: "complete"  },
  { time: "06:15", activity: "Pre-start checklist assigned",         status: "pending"   },
  { time: "06:30", activity: "First quality check reminder issued",  status: "pending"   },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const priorityBadge: Record<string, string> = {
  high:   "bg-[#ef444418] text-red-400 border border-red-500/20",
  medium: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
};

const timelineStatusBadge: Record<string, string> = {
  complete:  "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  pending:   "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  scheduled: "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const taskStatusBadge: Record<string, string> = {
  pending:   "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  scheduled: "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  complete:  "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
};

const safetyBadge: Record<string, string> = {
  complete: "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  pending:  "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  review:   "bg-[#ef444418] text-red-400 border border-red-500/20",
  required: "bg-[#ef444418] text-red-400 border border-red-500/20",
};

const safetyLabel: Record<string, string> = {
  complete: "Complete", pending: "Pending", review: "Review", required: "Required",
};

const activityStatusBadge: Record<string, string> = {
  complete: "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  pending:  "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  open:     "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const safetyIcon = (status: string) =>
  status === "complete"
    ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
    : status === "review"
    ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden="true" />
    : <Clock className="h-3.5 w-3.5 shrink-0 text-yellow-400" aria-hidden="true" />;

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

export const OperatorMyShiftSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Operator Portal</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">My Shift</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          View your shift details, assigned production area, tasks, handover notes and readiness actions for today's production plan.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={92} syncedAt={new Date(Date.now() - 90000)} />
        <ExplainWithAi pageId="operator-my-shift" />
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

    {/* ── Shift Summary ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "520ms" }}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-2 pb-4">
          <Clock className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Shift Summary</h2>
          <span className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#10b98118] text-emerald-400 border border-emerald-500/20">
            Ready
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: "Shift",         value: "Early Shift"              },
            { label: "Time",          value: "06:00 – 14:00"            },
            { label: "Assigned Area", value: "Line 2 Filling"           },
            { label: "Role",          value: "Filling Operator"         },
            { label: "Line Lead",     value: "Sarah Hughes"             },
            { label: "Status",        value: "Ready"                    },
            { label: "Main Focus",    value: "Quality & SAP"            },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="text-sm font-semibold text-slate-200">{value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── Shift Timeline ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "600ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <Activity className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Shift Timeline</h2>
          <span className="ml-auto text-[11px] text-slate-500">
            {timeline.filter((t) => t.status === "complete").length} of {timeline.length} complete
          </span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Time</th>
                <th className="px-4 py-3 font-medium text-slate-500">Activity</th>
                <th className="px-4 py-3 font-medium text-slate-500">Area</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                >
                  <td className="px-5 py-3 tabular-nums font-medium text-slate-400">{row.time}</td>
                  <td className="px-4 py-3 font-medium text-slate-300">{row.activity}</td>
                  <td className="px-4 py-3 text-slate-500">{row.area}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${timelineStatusBadge[row.status]}`}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        row.status === "pending"
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
          {timeline.map((row, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300">{row.activity}</p>
                <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">{row.time} · {row.area}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${timelineStatusBadge[row.status]}`}>
                {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── Tasks + Handover (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Assigned Tasks */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "680ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <ClipboardList className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Assigned Tasks</h2>
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
                    <td className="px-5 py-3 font-medium text-slate-300 max-w-[180px]">{row.task}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadge[row.priority]}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-400">{row.due}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${taskStatusBadge[row.status]}`}>
                        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          row.status === "pending"
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
                  <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">Due {row.due}</p>
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

      {/* Handover Notes + Safety (stacked) */}
      <div className="flex flex-col gap-6">

        {/* Handover Notes */}
        <Card
          className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
          style={{ animationDelay: "760ms" }}
        >
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
              <BookOpen className="h-4 w-4 text-yellow-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-200">Handover Notes</h2>
              <span className="ml-auto text-[11px] text-slate-500">Previous shift</span>
            </div>
            <div className="flex flex-col gap-2">
              {handoverNotes.map((note, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                    note.urgent
                      ? "border-yellow-500/20 bg-[#facc1508]"
                      : "border-gray-800 bg-[#0f1318]"
                  }`}
                >
                  <AlertTriangle
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${note.urgent ? "text-yellow-400" : "text-slate-600"}`}
                    aria-hidden="true"
                  />
                  <p className="text-[11px] leading-relaxed text-slate-400">{note.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Safety & Compliance Checks */}
        <Card
          className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
          style={{ animationDelay: "840ms" }}
        >
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
              <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-200">Safety &amp; Compliance</h2>
              <span className="ml-auto text-[11px] text-slate-500">
                {safetyChecks.filter((s) => s.status === "complete").length} of {safetyChecks.length} complete
              </span>
            </div>
            <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
              {safetyChecks.map((check, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between border-b border-gray-800/60 px-5 py-2.5 last:border-b-0 sm:even:border-l sm:even:border-gray-800/60"
                >
                  <div className="flex items-center gap-2">
                    {safetyIcon(check.status)}
                    <span className="text-xs text-slate-300">{check.label}</span>
                  </div>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${safetyBadge[check.status]}`}>
                    {safetyLabel[check.status]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    {/* ── AI Guidance ── */}
    <div className="motion-safe:animate-card-enter" style={{ animationDelay: "920ms" }}>
      <AiActionsPanel actions={aiActions} />
    </div>

    {/* ── Recent Shift Activity ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "1000ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Recent Shift Activity</h2>
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
