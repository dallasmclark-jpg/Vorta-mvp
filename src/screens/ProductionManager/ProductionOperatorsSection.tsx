import {
  AlertTriangle,
  BarChart2,
  ClipboardList,
  GraduationCap,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
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
    label: "Total Operators",
    value: "58",
    sub: "On active roster",
    icon: Users,
    valueClass: "text-slate-50",
    trend: { direction: "flat" as const,  label: "No change",        positiveIsUp: true  },
  },
  {
    label: "Available Today",
    value: "46",
    sub: "Confirmed for shifts",
    icon: UserCheck,
    valueClass: "text-emerald-400",
    trend: { direction: "down" as const,  label: "-3 vs yesterday",  positiveIsUp: true  },
  },
  {
    label: "Validated Operators",
    value: "42",
    sub: "Fully signed off",
    icon: ShieldCheck,
    valueClass: "text-emerald-400",
    trend: { direction: "flat" as const,  label: "No change",        positiveIsUp: true  },
  },
  {
    label: "On Training Plans",
    value: "12",
    sub: "Active programmes",
    icon: GraduationCap,
    valueClass: "text-yellow-400",
    trend: { direction: "up" as const,    label: "+2 this week",     positiveIsUp: true  },
  },
  {
    label: "Restricted Duties",
    value: "2",
    sub: "Limited task capability",
    icon: ClipboardList,
    valueClass: "text-orange-400",
    trend: { direction: "flat" as const,  label: "No change",        positiveIsUp: false },
  },
  {
    label: "High-Risk Dependencies",
    value: "4",
    sub: "Single operator knowledge",
    icon: ShieldAlert,
    valueClass: "text-orange-400",
    trend: { direction: "flat" as const,  label: "No change",        positiveIsUp: false },
  },
];

const operators = [
  {
    name: "Sarah Hughes",   initials: "SH", shift: "Early", area: "Packing",   skills: ["Packing", "Quality Checks", "SAP"],
    availability: "available",  status: "validated",    risk: "low",    action: "View",
  },
  {
    name: "Mark Evans",     initials: "ME", shift: "Late",  area: "Filling",   skills: ["Filling", "Changeover"],
    availability: "available",  status: "needs-signoff",risk: "medium", action: "Review",
  },
  {
    name: "Aisha Khan",     initials: "AK", shift: "Nights",area: "Mixing",   skills: ["Mixing", "Forklift"],
    availability: "available",  status: "validated",    risk: "low",    action: "View",
  },
  {
    name: "Tom Roberts",    initials: "TR", shift: "Late",  area: "Line 3",   skills: ["Changeover", "First Response"],
    availability: "available",  status: "gap-identified",risk: "high",  action: "Assign Training",
  },
  {
    name: "James Miller",   initials: "JM", shift: "Early", area: "Warehouse",skills: ["Forklift", "SAP"],
    availability: "restricted", status: "expiring",     risk: "medium", action: "Renew",
  },
  {
    name: "Emily Davies",   initials: "ED", shift: "Early", area: "Packing",  skills: ["Packing", "Food Safety"],
    availability: "training",   status: "in-progress",  risk: "medium", action: "Track",
  },
  {
    name: "Owen Price",     initials: "OP", shift: "Nights",area: "Filling",  skills: ["Filling", "SAP"],
    availability: "absent",     status: "validated",    risk: "medium", action: "Cover",
  },
  {
    name: "Chloe Williams", initials: "CW", shift: "Late",  area: "Mixing",   skills: ["Mixing", "Quality Checks"],
    availability: "available",  status: "validated",    risk: "low",    action: "View",
  },
];

const statusSummary = [
  { label: "Available operators",             count: 46, badge: "low",    icon: UserCheck     },
  { label: "Operators absent today",          count: 3,  badge: "high",   icon: AlertTriangle },
  { label: "Operators on training plans",     count: 12, badge: "medium", icon: GraduationCap },
  { label: "Expiring competencies",           count: 7,  badge: "medium", icon: ClipboardList },
  { label: "Awaiting validation",             count: 9,  badge: "medium", icon: ShieldCheck   },
  { label: "Operators on restricted duties",  count: 2,  badge: "medium", icon: Wrench        },
];

const workforceRisks = [
  {
    title: "Line 3 — limited validated changeover cover",
    detail: "Only 3 of the required 6 validated changeover operators are available on the late shift.",
    level: "high",
  },
  {
    title: "Mixing — senior operator single point of failure",
    detail: "The majority of mixing process knowledge is held by one senior operator with no validated backup.",
    level: "high",
  },
  {
    title: "Two operators on restricted duties",
    detail: "James Miller and one other are on restricted duties. Their task limitations must be confirmed before shift allocation.",
    level: "medium",
  },
  {
    title: "SAP confirmation coverage below target — late shift",
    detail: "Late shift SAP production confirmation coverage is 64% against an 80% target.",
    level: "medium",
  },
];

const aiActions: AiAction[] = [
  {
    label: "Reassign one validated packing operator to support Line 3 changeover",
    description: "Sarah Hughes is validated for changeover and is scheduled on early shift in Packing, which is fully covered. Moving her closes the Line 3 late-shift gap.",
    priority: "critical",
    icon: TrendingUp,
  },
  {
    label: "Prioritise sign-off for Mark Evans before late shift",
    description: "Mark is awaiting manager validation for changeover. Completing the sign-off today ensures he is deployable on Line 2 for the late shift without a coverage risk.",
    priority: "critical",
    icon: ShieldCheck,
  },
  {
    label: "Create a training plan for two operators on SAP production confirmations",
    description: "Dean Okafor and one other are unvalidated for SAP confirmations. A structured plan with a completion deadline would close the late shift coverage gap within 2 weeks.",
    priority: "high",
    icon: GraduationCap,
  },
  {
    label: "Capture mixing process knowledge from the senior operator",
    description: "Assign two operators to shadow the senior mixing operator this week and create a documented procedure. This removes the single-point-of-failure risk before it escalates.",
    priority: "high",
    icon: Wrench,
  },
  {
    label: "Review restricted-duty operators before finalising the rota",
    description: "Confirm which tasks James Miller and the other restricted operator can perform before the rota is locked. Misallocation to restricted tasks creates a compliance risk.",
    priority: "medium",
    icon: ClipboardList,
  },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const riskBadge: Record<string, string> = {
  low:    "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  medium: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  high:   "bg-[#ef444418] text-red-400 border border-red-500/20",
};

const availBadge: Record<string, string> = {
  available:  "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  restricted: "bg-[#f9731618] text-orange-400 border border-orange-500/20",
  training:   "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
  absent:     "bg-[#ef444418] text-red-400 border border-red-500/20",
};

const availLabel: Record<string, string> = {
  available:  "Available",
  restricted: "Restricted",
  training:   "Training",
  absent:     "Absent",
};

const statusBadge: Record<string, string> = {
  "validated":      "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  "needs-signoff":  "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  "expiring":       "bg-[#f9731618] text-orange-400 border border-orange-500/20",
  "gap-identified": "bg-[#ef444418] text-red-400 border border-red-500/20",
  "in-progress":    "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const statusLabel: Record<string, string> = {
  "validated":      "Validated",
  "needs-signoff":  "Needs Sign-Off",
  "expiring":       "Expiring Soon",
  "gap-identified": "Gap Identified",
  "in-progress":    "In Progress",
};

const summaryBadge: Record<string, string> = {
  low:    "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  medium: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  high:   "bg-[#ef444418] text-red-400 border border-red-500/20",
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

export const ProductionOperatorsSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Production Manager</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Operators</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          View operator availability, primary production areas, competency status and workforce risk so shift plans can be adjusted before production is affected.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={92} syncedAt={new Date(Date.now() - 90000)} />
        <ExplainWithAi pageId="production-operators" />
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

    {/* ── Operators table ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "520ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <Users className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">All Operators</h2>
          <span className="ml-auto text-[11px] text-slate-500">{operators.length} shown</span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Operator</th>
                <th className="px-4 py-3 font-medium text-slate-500">Shift</th>
                <th className="px-4 py-3 font-medium text-slate-500">Primary Area</th>
                <th className="px-4 py-3 font-medium text-slate-500">Key Skills</th>
                <th className="px-4 py-3 font-medium text-slate-500">Availability</th>
                <th className="px-4 py-3 font-medium text-slate-500">Competency</th>
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
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${availBadge[op.availability]}`}>
                      {availLabel[op.availability]}
                    </span>
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
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${availBadge[op.availability]}`}>
                  {availLabel[op.availability]}
                </span>
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[op.status]}`}>
                  {statusLabel[op.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── Status summary + Workforce risks (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Operator Status Summary */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "600ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <BarChart2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Operator Status Summary</h2>
          </div>
          <div className="flex flex-col divide-y divide-gray-800">
            {statusSummary.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#1a2030]">
                  <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <p className="flex-1 text-xs font-medium text-slate-300">{item.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-sm font-semibold text-slate-200">{item.count}</span>
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${summaryBadge[item.badge]}`}>
                      {item.badge}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Workforce Risks */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "680ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <ShieldAlert className="h-4 w-4 text-orange-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Workforce Risk</h2>
            <span className="ml-auto text-[11px] text-slate-500">
              {workforceRisks.filter((r) => r.level === "high").length} high-risk
            </span>
          </div>
          <div className="flex flex-col divide-y divide-gray-800">
            {workforceRisks.map((risk, idx) => (
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
    </div>

    {/* ── AI Recommendations ── */}
    <div className="motion-safe:animate-card-enter" style={{ animationDelay: "760ms" }}>
      <AiActionsPanel actions={aiActions} />
    </div>
  </section>
);
