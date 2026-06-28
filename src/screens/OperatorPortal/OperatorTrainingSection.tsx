import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
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
    label: "Training Complete",
    value: "86%",
    sub: "Overall profile",
    icon: CheckCircle2,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+4% this month",   positiveIsUp: true  },
  },
  {
    label: "Required Courses",
    value: "6",
    sub: "Assigned to you",
    icon: BookOpen,
    valueClass: "text-slate-50",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: true  },
  },
  {
    label: "Due Soon",
    value: "2",
    sub: "Within 30 days",
    icon: AlertTriangle,
    valueClass: "text-yellow-400",
    trend: { direction: "up" as const,   label: "Action needed",    positiveIsUp: false },
  },
  {
    label: "Overdue",
    value: "0",
    sub: "All on track",
    icon: CheckCircle2,
    valueClass: "text-emerald-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: true  },
  },
  {
    label: "In Progress",
    value: "3",
    sub: "Active courses",
    icon: TrendingUp,
    valueClass: "text-blue-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: true  },
  },
  {
    label: "Recommended",
    value: "4",
    sub: "Development options",
    icon: Sparkles,
    valueClass: "text-blue-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: true  },
  },
];

const requiredTraining = [
  { name: "Food Safety Refresher",                  type: "mandatory",    due: "2026-08-15", status: "complete",    progress: 100, action: "View",     actionPrimary: false },
  { name: "Manual Handling",                        type: "mandatory",    due: "2026-09-10", status: "complete",    progress: 100, action: "View",     actionPrimary: false },
  { name: "Line Changeover Refresher",              type: "role-required",due: "2026-07-20", status: "in-progress", progress: 65,  action: "Continue", actionPrimary: true  },
  { name: "SAP Production Confirmation",            type: "role-required",due: "2026-07-30", status: "complete",    progress: 100, action: "View",     actionPrimary: false },
  { name: "First Response Maintenance Awareness",   type: "recommended",  due: "Not Set",    status: "not-started", progress: 0,   action: "Start",    actionPrimary: true  },
  { name: "Quality Checks Refresher",               type: "mandatory",    due: "2026-08-05", status: "due-soon",    progress: 20,  action: "Start",    actionPrimary: true  },
];

const progressAreas = [
  { label: "Mandatory Compliance",  value: 94, color: "[&>div]:bg-emerald-500" },
  { label: "Role-Specific Training",value: 78, color: "[&>div]:bg-blue-500"    },
  { label: "Line Training",         value: 88, color: "[&>div]:bg-emerald-500" },
  { label: "Refresher Training",    value: 72, color: "[&>div]:bg-yellow-400"  },
  { label: "Development Training",  value: 35, color: "[&>div]:bg-slate-500"   },
];

const upcomingActions = [
  { text: "Quality Checks refresher due within 30 days — start now to avoid a compliance gap.",                          urgent: true  },
  { text: "Line Changeover refresher requires completion before next planned supervisor sign-off.",                       urgent: true  },
  { text: "First Response Maintenance awareness recommended to improve your shift flexibility score.",                    urgent: false },
  { text: "SAP Production Confirmation complete but a review is suggested following the recent Line 2 process update.",  urgent: false },
];

const developmentPlan = [
  { text: "Complete the Line Changeover refresher module to progress toward sign-off.",                urgency: "high"   },
  { text: "Request manager validation after your next supervised changeover on Line 3.",               urgency: "high"   },
  { text: "Start First Response Maintenance awareness to improve your overall readiness profile.",      urgency: "medium" },
  { text: "Shadow a senior operator on the Mixing process to build future production flexibility.",    urgency: "medium" },
  { text: "Build toward a Line Lead role by broadening your competency coverage across all process areas.", urgency: "low" },
];

const aiActions: AiAction[] = [
  {
    label: "Complete the Quality Checks refresher before the due date to maintain compliance",
    description: "The Quality Checks refresher is due on 2026-08-05 and is only 20% complete. Starting it now gives you enough time to finish before the deadline and prevents a mandatory compliance gap.",
    priority: "critical",
    icon: ClipboardList,
  },
  {
    label: "Prioritise the Line Changeover refresher before requesting manager sign-off",
    description: "Your Line Changeover sign-off is pending. Completing the refresher module first gives your manager the evidence they need to approve the competency and removes a current profile blocker.",
    priority: "high",
    icon: GraduationCap,
  },
  {
    label: "Start First Response Maintenance awareness to improve your production readiness score",
    description: "You are the only Line 2 operator without First Response Maintenance awareness. Completing the module raises your shift readiness score and reduces a team-level dependency flagged by the Production Manager.",
    priority: "high",
    icon: AlertTriangle,
  },
  {
    label: "Shadow a senior operator on Mixing to broaden future shift coverage options",
    description: "You currently have no Mixing exposure. One shadowing session during a planned run starts building evidence toward a future competency and increases your overall site flexibility profile.",
    priority: "medium",
    icon: TrendingUp,
  },
];

const recentActivity = [
  { when: "Today",     activity: "Line Changeover refresher opened",             status: "in-progress" },
  { when: "Yesterday", activity: "SAP Production Confirmation completed",         status: "complete"    },
  { when: "Last week", activity: "Manual Handling refresher completed",           status: "complete"    },
  { when: "Last week", activity: "First Response Maintenance recommended",        status: "open"        },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const typeBadge: Record<string, string> = {
  mandatory:     "bg-[#ef444418] text-red-400 border border-red-500/20",
  "role-required":"bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  recommended:   "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const typeLabel: Record<string, string> = {
  mandatory: "Mandatory", "role-required": "Role Required", recommended: "Recommended",
};

const statusBadge: Record<string, string> = {
  complete:     "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  "in-progress":"bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  "due-soon":   "bg-[#f9731618] text-orange-400 border border-orange-500/20",
  "not-started":"bg-[#ffffff10] text-slate-500 border border-gray-700",
};

const statusLabel: Record<string, string> = {
  complete: "Complete", "in-progress": "In Progress", "due-soon": "Due Soon", "not-started": "Not Started",
};

const progressBarColor: Record<string, string> = {
  complete:      "[&>div]:bg-emerald-500",
  "in-progress": "[&>div]:bg-yellow-400",
  "due-soon":    "[&>div]:bg-orange-400",
  "not-started": "[&>div]:bg-slate-700",
};

const activityStatusBadge: Record<string, string> = {
  complete:      "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  "in-progress": "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  open:          "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const activityStatusLabel: Record<string, string> = {
  complete: "Complete", "in-progress": "In Progress", open: "Open",
};

const urgencyCls: Record<string, string> = {
  high: "text-orange-400", medium: "text-yellow-400", low: "text-slate-400",
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

export const OperatorTrainingSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Operator Portal</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Training</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          Track required training, refresher courses, competency actions and recommended development so you stay compliant and ready for future production roles.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={86} syncedAt={new Date(Date.now() - 180000)} />
        <ExplainWithAi pageId="operator-training" />
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

    {/* ── Required Training Table ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "520ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <GraduationCap className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Required Training</h2>
          <span className="ml-auto text-[11px] text-slate-500">
            {requiredTraining.filter((t) => t.status === "complete").length} of {requiredTraining.length} complete
          </span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Training</th>
                <th className="px-4 py-3 font-medium text-slate-500">Type</th>
                <th className="px-4 py-3 font-medium text-slate-500">Due Date</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500 w-32">Progress</th>
                <th className="px-4 py-3 font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {requiredTraining.map((row, idx) => (
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
                  <td className={`px-4 py-3 tabular-nums ${row.due === "Not Set" ? "text-slate-600" : row.status === "due-soon" ? "text-orange-400 font-semibold" : "text-slate-400"}`}>
                    {row.due}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[row.status]}`}>
                      {statusLabel[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <AnimatedProgress value={row.progress} className={`h-1.5 w-20 bg-gray-800 ${progressBarColor[row.status]}`} />
                      <span className="tabular-nums text-slate-500">{row.progress}%</span>
                    </div>
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
          {requiredTraining.map((row, idx) => (
            <div key={idx} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-300">{row.name}</p>
                  <p className={`mt-0.5 text-[11px] tabular-nums ${row.due === "Not Set" ? "text-slate-600" : "text-slate-500"}`}>
                    Due: {row.due}
                  </p>
                </div>
                <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[row.status]}`}>
                  {statusLabel[row.status]}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <AnimatedProgress value={row.progress} className={`h-1 flex-1 bg-gray-800 ${progressBarColor[row.status]}`} />
                <span className="text-[10px] tabular-nums text-slate-500">{row.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── Training Progress + Upcoming Actions (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Training Progress */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "600ms" }}
      >
        <CardContent className="p-5">
          <div className="mb-5 flex items-center gap-2 border-b border-gray-800 pb-4">
            <TrendingUp className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Training Progress</h2>
          </div>
          <div className="flex flex-col gap-4">
            {progressAreas.map(({ label, value, color }) => (
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

      {/* Upcoming Training Actions */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "680ms" }}
      >
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <AlertTriangle className="h-4 w-4 text-yellow-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Upcoming Training Actions</h2>
            <span className="ml-auto text-[11px] text-slate-500">
              {upcomingActions.filter((a) => a.urgent).length} urgent
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {upcomingActions.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                  item.urgent
                    ? "border-yellow-500/20 bg-[#facc1508]"
                    : "border-gray-800 bg-[#0f1318]"
                }`}
              >
                <AlertTriangle
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.urgent ? "text-yellow-400" : "text-slate-600"}`}
                  aria-hidden="true"
                />
                <p className="text-[11px] leading-relaxed text-slate-400">{item.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* ── Development Plan ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "760ms" }}
    >
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
          <BookOpen className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">My Development Plan</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {developmentPlan.map(({ text, urgency }, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-lg border border-gray-800 bg-[#0f1318] px-3 py-2.5">
              <GraduationCap className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${urgencyCls[urgency]}`} aria-hidden="true" />
              <p className="text-[11px] leading-relaxed text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── AI Guidance ── */}
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
          <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Recent Training Activity</h2>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">When</th>
                <th className="px-4 py-3 font-medium text-slate-500">Training Activity</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                >
                  <td className="px-5 py-3 text-slate-500">{row.when}</td>
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
                <p className="mt-0.5 text-[11px] text-slate-500">{row.when}</p>
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
