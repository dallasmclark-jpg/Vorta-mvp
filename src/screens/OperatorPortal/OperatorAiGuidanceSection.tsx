import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
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
    label: "AI Readiness Score",
    value: "89%",
    sub: "Your profile today",
    icon: Sparkles,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+2% this shift", positiveIsUp: true  },
  },
  {
    label: "Active Guidance Items",
    value: "6",
    sub: "Open actions",
    icon: ListChecks,
    valueClass: "text-blue-400",
    trend: { direction: "flat" as const, label: "No change",      positiveIsUp: true  },
  },
  {
    label: "High Priority Actions",
    value: "2",
    sub: "Act now",
    icon: AlertTriangle,
    valueClass: "text-orange-400",
    trend: { direction: "flat" as const, label: "No change",      positiveIsUp: false },
  },
  {
    label: "Training Suggestions",
    value: "3",
    sub: "Development",
    icon: BookOpen,
    valueClass: "text-yellow-400",
    trend: { direction: "flat" as const, label: "No change",      positiveIsUp: true  },
  },
  {
    label: "Compliance Reminders",
    value: "2",
    sub: "Action needed",
    icon: ShieldCheck,
    valueClass: "text-yellow-400",
    trend: { direction: "flat" as const, label: "No change",      positiveIsUp: false },
  },
  {
    label: "Shift Confidence",
    value: "92%",
    sub: "AI assessment",
    icon: TrendingUp,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+1% today",      positiveIsUp: true  },
  },
];

const aiActions: AiAction[] = [
  {
    label: "Complete your Line 2 pre-start checklist before production starts",
    description: "The pre-start checklist is mandatory before Line 2 can run. It is currently overdue by 15 minutes. Completing it immediately removes the production block and satisfies the site safety requirement for shift start.",
    priority: "critical",
    icon: ShieldCheck,
  },
  {
    label: "Confirm product code and batch before the first quality check",
    description: "Product code and batch confirmation must precede the first quality check at 06:30. Skipping this step means the quality check cannot be signed off and creates a downstream audit gap on today's batch record.",
    priority: "critical",
    icon: ClipboardList,
  },
  {
    label: "Request manager review for your Line Changeover sign-off",
    description: "Your Line Changeover observation was submitted yesterday. Following up with your shift manager now means the sign-off can be validated at the next available changeover rather than pushing the competency into next week.",
    priority: "high",
    icon: CheckCircle2,
  },
  {
    label: "Complete Quality Checks refresher before the due date",
    description: "The Quality Checks refresher expires on 2026-08-05 and is currently at 0% completion. Starting it now gives sufficient lead time to finish before expiry and prevents a mandatory compliance gap appearing on your profile.",
    priority: "high",
    icon: BookOpen,
  },
  {
    label: "Review SAP production confirmation steps before your next batch",
    description: "A process update was applied to SAP production confirmation on Line 2. Reviewing the updated steps before your next batch entry prevents a confirmation error being flagged during today's production run.",
    priority: "medium",
    icon: FileText,
  },
  {
    label: "Record the label feed issue clearly in the shift handover",
    description: "The label feed issue from this shift needs a clear handover note before 13:45. An incomplete handover risks the incoming shift starting the next run without awareness of the fault, causing a repeat stoppage.",
    priority: "medium",
    icon: AlertTriangle,
  },
];

const guidanceCategories = [
  { label: "Shift Readiness",  value: 88, color: "[&>div]:bg-emerald-500" },
  { label: "Safety Checks",    value: 75, color: "[&>div]:bg-yellow-400"  },
  { label: "Quality Actions",  value: 60, color: "[&>div]:bg-blue-500"    },
  { label: "SAP Updates",      value: 40, color: "[&>div]:bg-slate-500"   },
  { label: "Training",         value: 72, color: "[&>div]:bg-blue-500"    },
  { label: "Compliance",       value: 96, color: "[&>div]:bg-emerald-500" },
  { label: "Skill Development",value: 45, color: "[&>div]:bg-slate-500"   },
  { label: "Handover",         value: 33, color: "[&>div]:bg-yellow-400"  },
];

const priorityQueue = [
  { priority: "high",   guidance: "Complete pre-start checklist",                area: "Line 2 Filling", confidence: 94, status: "pending",     action: "Start",   actionPrimary: true  },
  { priority: "high",   guidance: "Confirm product code and batch",               area: "Quality",        confidence: 92, status: "pending",     action: "Open",    actionPrimary: true  },
  { priority: "medium", guidance: "Request Line Changeover sign-off",             area: "Skills",         confidence: 89, status: "open",        action: "Request", actionPrimary: true  },
  { priority: "medium", guidance: "Complete Quality Checks refresher",            area: "Training",       confidence: 87, status: "due-soon",    action: "Start",   actionPrimary: true  },
  { priority: "medium", guidance: "Review SAP confirmation steps",                area: "SAP",            confidence: 86, status: "recommended", action: "View",    actionPrimary: false },
  { priority: "low",    guidance: "Update handover note for label feed issue",    area: "Handover",       confidence: 82, status: "open",        action: "Update",  actionPrimary: false },
];

const whyReasons = [
  { icon: AlertTriangle, iconColor: "text-orange-400", title: "Task due before production can start",          body: "The pre-start checklist and batch confirmation are site-mandatory before Line 2 can run. These block the line until complete." },
  { icon: CheckCircle2,  iconColor: "text-yellow-400", title: "Competency awaiting manager validation",        body: "Your Line Changeover observation is submitted but requires manager sign-off. Following up now prevents the sign-off from slipping into next week." },
  { icon: BookOpen,      iconColor: "text-blue-400",   title: "Refresher is approaching expiry",               body: "The Quality Checks refresher expires on 2026-08-05. Starting early avoids a last-minute compliance gap on your profile." },
  { icon: ClipboardList, iconColor: "text-blue-400",   title: "Quality action linked to today's production plan", body: "A quality check is tied to the current production batch on Line 2. Completing it on time keeps the batch record clean." },
  { icon: FileText,      iconColor: "text-slate-400",  title: "Handover issue reported by previous shift",     body: "The label feed fault was flagged at shift start. Logging it clearly ensures the incoming shift receives an accurate handover." },
];

const recentActivity = [
  { when: "05:45", activity: "AI generated today's shift guidance",  confidence: 91, status: "complete" },
  { when: "06:00", activity: "Pre-start checklist priority updated", confidence: 94, status: "open"     },
  { when: "06:10", activity: "Quality check reminder created",       confidence: 92, status: "pending"  },
  { when: "06:20", activity: "Training reminder refreshed",          confidence: 87, status: "open"     },
  { when: "06:30", activity: "Handover risk reviewed",               confidence: 82, status: "open"     },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const priorityBadge: Record<string, string> = {
  high:   "bg-[#ef444418] text-red-400 border border-red-500/20",
  medium: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  low:    "bg-[#ffffff10] text-slate-500 border border-gray-700",
};

const priorityLabel: Record<string, string> = {
  high: "High", medium: "Medium", low: "Low",
};

const statusBadge: Record<string, string> = {
  pending:     "bg-[#ef444418] text-red-400 border border-red-500/20",
  open:        "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  "due-soon":  "bg-[#f9731618] text-orange-400 border border-orange-500/20",
  recommended: "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const statusLabel: Record<string, string> = {
  pending: "Pending", open: "Open", "due-soon": "Due Soon", recommended: "Recommended",
};

const activityStatusBadge: Record<string, string> = {
  complete: "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  pending:  "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  open:     "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const activityStatusLabel: Record<string, string> = {
  complete: "Complete", pending: "Pending", open: "Open",
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

export const OperatorAiGuidanceSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Operator Portal</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">AI Guidance</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          Review personalised AI guidance for your shift tasks, training actions, compliance reminders and skill development priorities.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta AI" confidence={91} syncedAt={new Date(Date.now() - 60000)} />
        <ExplainWithAi pageId="operator-ai-guidance" />
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

    {/* ── AI Guidance Summary ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "520ms" }}
    >
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
          <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">AI Guidance Summary</h2>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#3b82f618] text-blue-400 border border-blue-500/20">
            <Sparkles className="h-2.5 w-2.5" />
            AI Confidence 91%
          </span>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400">AI Readiness Score</span>
                <span className="text-xs font-semibold tabular-nums text-emerald-400">89%</span>
              </div>
              <AnimatedProgress value={89} className="h-2 bg-gray-800 [&>div]:bg-emerald-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400">Shift Confidence</span>
                <span className="text-xs font-semibold tabular-nums text-emerald-400">92%</span>
              </div>
              <AnimatedProgress value={92} className="h-2 bg-gray-800 [&>div]:bg-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-1 sm:grid-cols-3">
            {[
              { label: "Highest Priority",      value: "Complete pre-start checks", valueClass: "text-orange-400" },
              { label: "AI Confidence",          value: "91%",                       valueClass: "text-blue-400"   },
              { label: "Main Improvement Area",  value: "Line Changeover sign-off",  valueClass: "text-yellow-400" },
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

    {/* ── Personal AI Recommendations ── */}
    <div className="motion-safe:animate-card-enter" style={{ animationDelay: "600ms" }}>
      <AiActionsPanel actions={aiActions} />
    </div>

    {/* ── Priority Action Queue ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "680ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <ListChecks className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Priority Action Queue</h2>
          <span className="ml-auto text-[11px] text-slate-500">{priorityQueue.length} items</span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Priority</th>
                <th className="px-4 py-3 font-medium text-slate-500">Guidance</th>
                <th className="px-4 py-3 font-medium text-slate-500">Area</th>
                <th className="px-4 py-3 font-medium text-slate-500">Confidence</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {priorityQueue.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                >
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadge[row.priority]}`}>
                      {priorityLabel[row.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-300">{row.guidance}</td>
                  <td className="px-4 py-3 text-slate-500">{row.area}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums text-blue-400">
                      <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                      {row.confidence}%
                    </span>
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
          {priorityQueue.map((row, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300">{row.guidance}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{row.area} · AI {row.confidence}%</p>
              </div>
              <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadge[row.priority]}`}>
                {priorityLabel[row.priority]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── Guidance Categories + Why AI Recommends (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Guidance Categories */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "760ms" }}
      >
        <CardContent className="p-5">
          <div className="mb-5 flex items-center gap-2 border-b border-gray-800 pb-4">
            <TrendingUp className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Guidance Categories</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {guidanceCategories.map(({ label, value, color }) => (
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

      {/* Why AI Is Recommending This */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "840ms" }}
      >
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Why AI Is Recommending This</h2>
          </div>
          <div className="flex flex-col gap-2.5">
            {whyReasons.map(({ icon: Icon, iconColor, title, body }, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-gray-800 bg-[#0f1318] px-3 py-3">
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${iconColor}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-300">{title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{body}</p>
                </div>
              </div>
            ))}
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
          <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Recent AI Activity</h2>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Time</th>
                <th className="px-4 py-3 font-medium text-slate-500">AI Activity</th>
                <th className="px-4 py-3 font-medium text-slate-500">Confidence</th>
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
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums text-blue-400">
                      <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                      {row.confidence}%
                    </span>
                  </td>
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
                <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">{row.when} · AI {row.confidence}%</p>
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
