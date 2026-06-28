import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
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
    label: "Compliance Status",
    value: "96%",
    sub: "Overall profile",
    icon: ShieldCheck,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+1% this month",   positiveIsUp: true  },
  },
  {
    label: "Mandatory Complete",
    value: "9",
    sub: "Fully verified",
    icon: CheckCircle2,
    valueClass: "text-emerald-400",
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
    label: "Evidence Gaps",
    value: "1",
    sub: "Awaiting review",
    icon: FileText,
    valueClass: "text-orange-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: false },
  },
  {
    label: "Safety Actions",
    value: "3",
    sub: "Open items",
    icon: ClipboardList,
    valueClass: "text-yellow-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: false },
  },
];

const requirements = [
  { name: "Food Safety",                    type: "mandatory",     status: "complete", expiry: "2027-01-10", evidence: "Verified",          action: "View",           actionPrimary: false },
  { name: "Manual Handling",                type: "mandatory",     status: "complete", expiry: "2027-02-15", evidence: "Verified",          action: "View",           actionPrimary: false },
  { name: "Health & Safety Induction",      type: "mandatory",     status: "complete", expiry: "2027-03-20", evidence: "Verified",          action: "View",           actionPrimary: false },
  { name: "Quality Checks Refresher",       type: "mandatory",     status: "due-soon", expiry: "2026-08-05", evidence: "Verified",          action: "Start",          actionPrimary: true  },
  { name: "Line Changeover Sign-Off",       type: "role-required", status: "pending",  expiry: "2026-07-20", evidence: "Awaiting Manager",  action: "Request Review", actionPrimary: true  },
  { name: "SAP Production Confirmation",    type: "role-required", status: "complete", expiry: "2027-02-20", evidence: "Verified",          action: "View",           actionPrimary: false },
];

const safetyChecks = [
  { label: "PPE requirements",         status: "complete" },
  { label: "Line clearance awareness", status: "complete" },
  { label: "LOTO awareness",           status: "complete" },
  { label: "Food safety status",       status: "complete" },
  { label: "Quality documentation",    status: "pending"  },
  { label: "Escalation procedure",     status: "review"   },
];

const evidence = [
  { item: "Line Changeover observation",          submitted: "Yesterday",  reviewer: "Shift Manager",        status: "awaiting-review", action: "View" },
  { item: "Quality Checks refresher evidence",    submitted: "Last Week",  reviewer: "Training Coordinator", status: "verified",        action: "View" },
  { item: "SAP confirmation assessment",          submitted: "Last Month", reviewer: "Production Manager",   status: "verified",        action: "View" },
];

const alerts = [
  { text: "Quality Checks refresher is due soon — complete before 2026-08-05 to maintain full compliance.",  urgent: true  },
  { text: "Line Changeover sign-off is still awaiting manager review — follow up with your line lead.",       urgent: true  },
  { text: "Keep SAP confirmation evidence up to date following the latest Line 2 process change.",            urgent: false },
  { text: "No overdue mandatory training currently identified — all mandatory items are on track.",            urgent: false },
];

const aiActions: AiAction[] = [
  {
    label: "Request manager review for Line Changeover sign-off before your next planned changeover",
    description: "Your Line Changeover observation was submitted yesterday and is awaiting review. Following up with your shift manager now means you can complete the sign-off at the next available changeover rather than delaying your competency.",
    priority: "high",
    icon: ShieldCheck,
  },
  {
    label: "Complete the Quality Checks refresher before the due date to maintain full compliance",
    description: "The Quality Checks refresher expires on 2026-08-05 and is 0% complete. Starting now gives you enough lead time to finish before expiry and avoids a mandatory compliance gap on your profile.",
    priority: "critical",
    icon: ClipboardList,
  },
  {
    label: "Review the updated SAP confirmation process notes before your next Line 2 shift",
    description: "A process update was applied to SAP production confirmation on Line 2. Reviewing the updated steps keeps your evidence current and prevents a confirmation error being flagged during a future audit.",
    priority: "medium",
    icon: FileText,
  },
  {
    label: "Keep evidence records up to date for future validation and audit checks",
    description: "Your current evidence is mostly verified, but maintaining up-to-date records for all competencies reduces the risk of evidence gaps appearing during a scheduled audit or spot check.",
    priority: "low",
    icon: TrendingUp,
  },
];

const recentActivity = [
  { when: "Today",      activity: "Compliance dashboard reviewed",            status: "complete"       },
  { when: "Yesterday",  activity: "Line Changeover evidence submitted",        status: "awaiting-review" },
  { when: "Last week",  activity: "Quality Checks refresher assigned",        status: "open"            },
  { when: "Last month", activity: "SAP Production Confirmation verified",     status: "complete"        },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const typeBadge: Record<string, string> = {
  mandatory:      "bg-[#ef444418] text-red-400 border border-red-500/20",
  "role-required":"bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
};

const typeLabel: Record<string, string> = {
  mandatory: "Mandatory", "role-required": "Role Required",
};

const statusBadge: Record<string, string> = {
  complete:       "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  "due-soon":     "bg-[#f9731618] text-orange-400 border border-orange-500/20",
  pending:        "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
};

const statusLabel: Record<string, string> = {
  complete: "Complete", "due-soon": "Due Soon", pending: "Pending",
};

const evidenceStatusBadge: Record<string, string> = {
  verified:         "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  "awaiting-review":"bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
};

const evidenceStatusLabel: Record<string, string> = {
  verified: "Verified", "awaiting-review": "Awaiting Review",
};

const safetyBadge: Record<string, string> = {
  complete: "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  pending:  "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  review:   "bg-[#ef444418] text-red-400 border border-red-500/20",
};

const safetyLabel: Record<string, string> = {
  complete: "Complete", pending: "Pending", review: "Review",
};

const safetyIcon = (status: string) =>
  status === "complete"
    ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
    : status === "review"
    ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden="true" />
    : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-400" aria-hidden="true" />;

const activityStatusBadge: Record<string, string> = {
  complete:         "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  "awaiting-review":"bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  open:             "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const activityStatusLabel: Record<string, string> = {
  complete: "Complete", "awaiting-review": "Awaiting Review", open: "Open",
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

export const OperatorComplianceSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Operator Portal</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Compliance</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          Track your mandatory training, safety requirements, licences, competency evidence and compliance actions so you remain safe, validated and ready for production.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={96} syncedAt={new Date(Date.now() - 120000)} />
        <ExplainWithAi pageId="operator-compliance" />
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

    {/* ── Personal Compliance Summary ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "520ms" }}
    >
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
          <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Personal Compliance Summary</h2>
          <span className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#10b98118] text-emerald-400 border border-emerald-500/20">
            Compliant
          </span>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-32 shrink-0">Overall Compliance</span>
            <div className="flex flex-1 items-center gap-3">
              <AnimatedProgress value={96} className="h-2 flex-1 bg-gray-800 [&>div]:bg-emerald-500" />
              <span className="w-8 text-right text-xs font-semibold tabular-nums text-emerald-400">96%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-1 sm:grid-cols-4">
            {[
              { label: "Highest Risk",    value: "Line Changeover sign-off pending", valueClass: "text-yellow-400" },
              { label: "Next Expiry",     value: "Quality Checks in 30 days",        valueClass: "text-orange-400" },
              { label: "Manager Review",  value: "1 item pending",                   valueClass: "text-yellow-400" },
              { label: "Current Status",  value: "Compliant",                        valueClass: "text-emerald-400" },
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

    {/* ── Requirements Table ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "600ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <ClipboardList className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Compliance Requirements</h2>
          <span className="ml-auto text-[11px] text-slate-500">
            {requirements.filter((r) => r.status === "complete").length} of {requirements.length} complete
          </span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Requirement</th>
                <th className="px-4 py-3 font-medium text-slate-500">Type</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500">Due / Expiry</th>
                <th className="px-4 py-3 font-medium text-slate-500">Evidence</th>
                <th className="px-4 py-3 font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((row, idx) => (
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
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[row.status]}`}>
                      {statusLabel[row.status]}
                    </span>
                  </td>
                  <td className={`px-4 py-3 tabular-nums ${row.status === "due-soon" ? "font-semibold text-orange-400" : "text-slate-400"}`}>
                    {row.expiry}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{row.evidence}</td>
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
          {requirements.map((row, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300">{row.name}</p>
                <p className={`mt-0.5 text-[11px] tabular-nums ${row.status === "due-soon" ? "text-orange-400" : "text-slate-500"}`}>
                  {row.expiry}
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

    {/* ── Safety Readiness + Evidence (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Safety Readiness */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "680ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Safety Readiness</h2>
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

      {/* Evidence & Sign-Offs */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "760ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <FileText className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Evidence &amp; Sign-Offs</h2>
          </div>

          {/* Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Evidence Item</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Submitted</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Reviewer</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-300">{row.item}</td>
                    <td className="px-4 py-3 text-slate-500">{row.submitted}</td>
                    <td className="px-4 py-3 text-slate-400">{row.reviewer}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${evidenceStatusBadge[row.status]}`}>
                        {evidenceStatusLabel[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="rounded border border-gray-700 bg-transparent px-2.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
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
            {evidence.map((row, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-300">{row.item}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{row.submitted} · {row.reviewer}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${evidenceStatusBadge[row.status]}`}>
                  {evidenceStatusLabel[row.status]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* ── Compliance Alerts ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "840ms" }}
    >
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
          <AlertTriangle className="h-4 w-4 text-yellow-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Compliance Alerts</h2>
          <span className="ml-auto text-[11px] text-slate-500">
            {alerts.filter((a) => a.urgent).length} urgent
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                alert.urgent
                  ? "border-yellow-500/20 bg-[#facc1508]"
                  : "border-gray-800 bg-[#0f1318]"
              }`}
            >
              <AlertTriangle
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${alert.urgent ? "text-yellow-400" : "text-slate-600"}`}
                aria-hidden="true"
              />
              <p className="text-[11px] leading-relaxed text-slate-400">{alert.text}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── AI Guidance ── */}
    <div className="motion-safe:animate-card-enter" style={{ animationDelay: "920ms" }}>
      <AiActionsPanel actions={aiActions} />
    </div>

    {/* ── Recent Compliance Activity ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "1000ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Recent Compliance Activity</h2>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">When</th>
                <th className="px-4 py-3 font-medium text-slate-500">Compliance Activity</th>
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
