import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
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
    label: "Compliance Score",
    value: "93%",
    sub: "Across all operators",
    icon: ShieldCheck,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+1% vs last week",  positiveIsUp: true  },
  },
  {
    label: "Mandatory Training",
    value: "91%",
    sub: "Complete",
    icon: GraduationCap,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+2% this month",    positiveIsUp: true  },
  },
  {
    label: "Expiring Licences",
    value: "5",
    sub: "Within 30 days",
    icon: CalendarDays,
    valueClass: "text-orange-400",
    trend: { direction: "up" as const,   label: "+2 this week",      positiveIsUp: false },
  },
  {
    label: "Overdue Actions",
    value: "3",
    sub: "Require immediate action",
    icon: AlertTriangle,
    valueClass: "text-red-400",
    trend: { direction: "flat" as const, label: "No change",         positiveIsUp: false },
  },
  {
    label: "Audit Risks",
    value: "4",
    sub: "Identified this week",
    icon: ShieldAlert,
    valueClass: "text-orange-400",
    trend: { direction: "up" as const,   label: "+1 vs yesterday",   positiveIsUp: false },
  },
  {
    label: "Non-Compliant",
    value: "2",
    sub: "Operators",
    icon: Users,
    valueClass: "text-red-400",
    trend: { direction: "flat" as const, label: "No change",         positiveIsUp: false },
  },
];

const complianceOverview = [
  { area: "Forklift Licences",            requirement: "Valid licence required",         pct: 88, dueNote: "2 expire in 30 days",  risk: "medium", action: "Renew"    },
  { area: "Food Safety",                  requirement: "Mandatory annual refresher",     pct: 94, dueNote: "3 due this month",      risk: "low",    action: "Review"   },
  { area: "Health & Safety",              requirement: "Site mandatory training",        pct: 97, dueNote: "1 overdue",             risk: "low",    action: "View"     },
  { area: "Lock Out / Tag Out",           requirement: "Required for authorised ops",    pct: 82, dueNote: "4 due",                 risk: "medium", action: "Schedule" },
  { area: "Line Changeover Validation",   requirement: "Manager sign-off required",      pct: 76, dueNote: "5 pending",             risk: "high",   action: "Validate" },
  { area: "Manual Handling",              requirement: "Mandatory refresher",            pct: 91, dueNote: "2 due",                 risk: "low",    action: "Review"   },
];

const operatorCompliance = [
  { name: "Sarah Hughes", initials: "SH", shift: "Early", area: "Packing",   status: "compliant",   missingItem: "None",                   risk: "low",    action: "View"     },
  { name: "Mark Evans",   initials: "ME", shift: "Late",  area: "Filling",   status: "action",      missingItem: "Changeover sign-off",     risk: "medium", action: "Review"   },
  { name: "Aisha Khan",   initials: "AK", shift: "Nights",area: "Mixing",    status: "compliant",   missingItem: "None",                   risk: "low",    action: "View"     },
  { name: "Tom Roberts",  initials: "TR", shift: "Late",  area: "Line 3",    status: "noncompliant",missingItem: "LOTO refresher overdue",  risk: "high",   action: "Schedule" },
  { name: "James Miller", initials: "JM", shift: "Early", area: "Warehouse", status: "expiring",    missingItem: "Forklift licence",        risk: "medium", action: "Renew"    },
  { name: "Emily Davies", initials: "ED", shift: "Early", area: "Packing",   status: "inprogress",  missingItem: "New starter onboarding",  risk: "medium", action: "Track"    },
];

const auditRisks = [
  { title: "Operators scheduled with incomplete LOTO status", detail: "Two operators are allocated to authorised LOTO tasks on the late shift without a current refresher. This is a direct compliance breach.", level: "high" },
  { title: "Line 3 changeover — 5 pending manager sign-offs", detail: "Five validation sign-offs remain outstanding. Unvalidated operators on changeover tasks will fail an audit check.", level: "high" },
  { title: "Forklift licence renewals due before month end",  detail: "Two licences expire within 30 days. Failure to renew before expiry removes the operator from authorised forklift tasks.", level: "medium" },
  { title: "New starter compliance evidence incomplete",       detail: "One new starter's evidence pack is missing mandatory documents. This creates a gap if audited before completion.", level: "medium" },
];

const actionsQueue = [
  { priority: "high",   action: "Complete LOTO refresher for Tom Roberts",        owner: "Training Coordinator", due: "Today",     status: "overdue",     btn: "Schedule" },
  { priority: "high",   action: "Validate Line 3 changeover operators",           owner: "Production Manager",   due: "This Week", status: "pending",     btn: "Review"   },
  { priority: "medium", action: "Renew forklift licences",                        owner: "Shift Manager",        due: "30 Days",   status: "scheduled",   btn: "View"     },
  { priority: "medium", action: "Complete new starter evidence pack",             owner: "Line Lead",            due: "This Week", status: "in-progress", btn: "Track"    },
];

const aiActions: AiAction[] = [
  {
    label: "Remove LOTO-non-compliant operators from authorised coverage until refresher is complete",
    description: "Tom Roberts and one other are currently allocated to LOTO-authorised tasks with an expired refresher. Removing them from that coverage list closes the compliance gap immediately.",
    priority: "critical",
    icon: ShieldAlert,
  },
  {
    label: "Prioritise Line 3 changeover sign-offs before the late shift plan is finalised",
    description: "Five outstanding sign-offs are blocking validation of the late shift changeover team. Clearing these before shift start prevents non-compliant operators being deployed.",
    priority: "critical",
    icon: CheckCircle2,
  },
  {
    label: "Renew forklift licences before the warehouse night shift is exposed",
    description: "Two forklift licences expire within 30 days. Scheduling renewals this week eliminates the risk of an unplanned coverage gap on the night shift.",
    priority: "high",
    icon: CalendarDays,
  },
  {
    label: "Complete new starter evidence packs before the next internal audit",
    description: "One operator's compliance file is missing mandatory induction documents. Completing it now avoids an audit finding that could escalate to a corrective action.",
    priority: "high",
    icon: ClipboardList,
  },
  {
    label: "Cross-check compliance risk against shift coverage before confirming today's rota",
    description: "Two non-compliant operators are currently in the rota for tasks that require their outstanding sign-offs. Running a combined check removes the risk before plans are locked.",
    priority: "medium",
    icon: TrendingUp,
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

const opStatusBadge: Record<string, string> = {
  compliant:    "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  action:       "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  noncompliant: "bg-[#ef444418] text-red-400 border border-red-500/20",
  expiring:     "bg-[#f9731618] text-orange-400 border border-orange-500/20",
  inprogress:   "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const opStatusLabel: Record<string, string> = {
  compliant:    "Compliant",
  action:       "Action Required",
  noncompliant: "Non-Compliant",
  expiring:     "Expiring Soon",
  inprogress:   "In Progress",
};

const actionStatusBadge: Record<string, string> = {
  overdue:     "bg-[#ef444418] text-red-400 border border-red-500/20",
  pending:     "bg-[#ffffff10] text-slate-400 border border-gray-700",
  scheduled:   "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  "in-progress":"bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
};

const priorityBadge: Record<string, string> = {
  high:   "bg-[#ef444418] text-red-400 border border-red-500/20",
  medium: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  low:    "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
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

export const ProductionComplianceSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Production Manager</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Compliance</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          Monitor operator compliance, mandatory training, licence expiry, safety requirements and validation gaps before they create production or audit risk.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={93} syncedAt={new Date(Date.now() - 150000)} />
        <ExplainWithAi pageId="production-compliance" />
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

    {/* ── Compliance Overview Table ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "520ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <ShieldCheck className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Compliance Overview</h2>
          <span className="ml-auto text-[11px] text-slate-500">
            {complianceOverview.filter((r) => r.risk === "low").length} of {complianceOverview.length} areas on target
          </span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Compliance Area</th>
                <th className="px-4 py-3 font-medium text-slate-500">Requirement</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-right">Complete</th>
                <th className="px-4 py-3 font-medium text-slate-500">Due / Expiry</th>
                <th className="px-4 py-3 font-medium text-slate-500">Risk</th>
                <th className="px-4 py-3 font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {complianceOverview.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                >
                  <td className="px-5 py-2.5">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-medium text-slate-300">{row.area}</span>
                      <AnimatedProgress value={row.pct} className={`h-1 bg-gray-800 ${riskBar[row.risk]}`} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{row.requirement}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: row.pct >= 90 ? "#10b981" : row.pct >= 80 ? "#facc15" : "#ef4444" }}>
                    {row.pct}%
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{row.dueNote}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[row.risk]}`}>
                      {row.risk}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        row.risk === "high"
                          ? "border-red-500/30 bg-[#ef444410] text-red-400 hover:border-red-500/50 hover:text-red-300"
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
        <div className="flex flex-col gap-3 px-5 py-4 md:hidden">
          {complianceOverview.map((row) => (
            <div key={row.area} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-300">{row.area}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-xs font-semibold" style={{ color: row.pct >= 90 ? "#10b981" : row.pct >= 80 ? "#facc15" : "#ef4444" }}>{row.pct}%</span>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[row.risk]}`}>{row.risk}</span>
                </div>
              </div>
              <AnimatedProgress value={row.pct} className={`h-1.5 bg-gray-800 ${riskBar[row.risk]}`} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── Operator Compliance Table ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "600ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <UserCheck className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Operator Compliance</h2>
          <span className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#ef444418] text-red-400 border border-red-500/20">
            {operatorCompliance.filter((o) => o.status === "noncompliant").length} non-compliant
          </span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Operator</th>
                <th className="px-4 py-3 font-medium text-slate-500">Shift</th>
                <th className="px-4 py-3 font-medium text-slate-500">Area</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500">Expiring / Missing</th>
                <th className="px-4 py-3 font-medium text-slate-500">Risk</th>
                <th className="px-4 py-3 font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {operatorCompliance.map((op, idx) => (
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
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${opStatusBadge[op.status]}`}>
                      {opStatusLabel[op.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{op.missingItem}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[op.risk]}`}>
                      {op.risk}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        op.risk === "high"
                          ? "border-red-500/30 bg-[#ef444410] text-red-400 hover:border-red-500/50 hover:text-red-300"
                          : "border-gray-700 bg-transparent text-slate-400 hover:border-gray-600 hover:text-slate-200"
                      }`}
                    >
                      {op.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="flex flex-col divide-y divide-gray-800 md:hidden">
          {operatorCompliance.map((op, idx) => (
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
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${opStatusBadge[op.status]}`}>
                  {opStatusLabel[op.status]}
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

    {/* ── Audit Risks + Actions Queue (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Audit Risk */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "680ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <ShieldAlert className="h-4 w-4 text-orange-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Audit Risk</h2>
            <span className="ml-auto text-[11px] text-slate-500">
              {auditRisks.filter((r) => r.level === "high").length} high-risk
            </span>
          </div>
          <div className="flex flex-col divide-y divide-gray-800">
            {auditRisks.map((risk, idx) => (
              <div key={idx} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[#1a2030]">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${risk.level === "high" ? "bg-red-500" : "bg-yellow-400"}`} />
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

      {/* Compliance Actions Queue */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "760ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <ClipboardList className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Compliance Actions Queue</h2>
            <span className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#ef444418] text-red-400 border border-red-500/20">
              {actionsQueue.filter((a) => a.status === "overdue").length} overdue
            </span>
          </div>

          {/* Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Priority</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Action</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Owner</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Due</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                {actionsQueue.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                  >
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadge[row.priority]}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-300">{row.action}</td>
                    <td className="px-4 py-3 text-slate-500">{row.owner}</td>
                    <td className="px-4 py-3 text-slate-500">{row.due}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${actionStatusBadge[row.status]}`}>
                        {row.status.charAt(0).toUpperCase() + row.status.slice(1).replace("-", " ")}
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
                        {row.btn}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="flex flex-col divide-y divide-gray-800 md:hidden">
            {actionsQueue.map((row, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-300">{row.action}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{row.owner} · {row.due}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadge[row.priority]}`}>
                    {row.priority}
                  </span>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${actionStatusBadge[row.status]}`}>
                    {row.status.charAt(0).toUpperCase() + row.status.slice(1).replace("-", " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* ── AI Recommendations ── */}
    <div className="motion-safe:animate-card-enter" style={{ animationDelay: "840ms" }}>
      <AiActionsPanel actions={aiActions} />
    </div>
  </section>
);
