import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Clock,
  GraduationCap,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  UserX,
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
    label: "Shift Coverage",
    value: "94%",
    sub: "Across all lines today",
    icon: ShieldCheck,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+2% vs yesterday", positiveIsUp: true  },
  },
  {
    label: "Operators Scheduled",
    value: "46",
    sub: "Confirmed for today",
    icon: Users,
    valueClass: "text-slate-50",
    trend: { direction: "flat" as const,  label: "No change",        positiveIsUp: true  },
  },
  {
    label: "Open Gaps",
    value: "4",
    sub: "Require action now",
    icon: AlertTriangle,
    valueClass: "text-orange-400",
    trend: { direction: "up" as const,   label: "+1 vs yesterday",  positiveIsUp: false },
  },
  {
    label: "Absences Today",
    value: "3",
    sub: "Notified this morning",
    icon: UserX,
    valueClass: "text-yellow-400",
    trend: { direction: "up" as const,   label: "+1 vs yesterday",  positiveIsUp: false },
  },
  {
    label: "Overtime Risk",
    value: "Medium",
    sub: "Late shift forecast",
    icon: Clock,
    valueClass: "text-yellow-400",
    trend: { direction: "up" as const,   label: "Increasing",       positiveIsUp: false },
  },
  {
    label: "High-Risk Lines",
    value: "2",
    sub: "Need coverage action",
    icon: ShieldAlert,
    valueClass: "text-orange-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: false },
  },
];

const shiftRows = [
  { shift: "Early", area: "Line 1 Packing",       required: 8, scheduled: 8, validated: 8, gap: 0, risk: "low",    action: "View"     },
  { shift: "Early", area: "Line 2 Filling",        required: 10, scheduled: 9, validated: 8, gap: 1, risk: "medium", action: "Review"   },
  { shift: "Late",  area: "Line 3 Changeover",     required: 6,  scheduled: 4, validated: 3, gap: 2, risk: "high",   action: "Reassign" },
  { shift: "Late",  area: "Mixing",                required: 5,  scheduled: 5, validated: 4, gap: 0, risk: "medium", action: "Monitor"  },
  { shift: "Night", area: "Warehouse / Forklift",  required: 5,  scheduled: 5, validated: 5, gap: 0, risk: "low",    action: "View"     },
];

const availabilityItems = [
  { label: "Operators absent today",                 count: 3,  badge: "high",   icon: UserX         },
  { label: "Operators available for overtime",       count: 5,  badge: "low",    icon: Zap           },
  { label: "Operators on restricted duties",         count: 2,  badge: "medium", icon: ClipboardList  },
  { label: "Shift confirmations pending",            count: 4,  badge: "medium", icon: CalendarDays   },
];

const coverageRisks = [
  {
    title: "Late shift Line 3 short by 2 validated operators",
    detail: "Only 3 of the required 6 validated changeover operators are confirmed. Any further absence creates a production stop risk.",
    level: "high",
  },
  {
    title: "Line 2 Filling — SAP production cover gap",
    detail: "Headcount is one below target. The available operators also lack validated SAP production confirmation coverage.",
    level: "high",
  },
  {
    title: "Mixing — limited backup if senior operator unavailable",
    detail: "The validated mixing team is thin. One unplanned absence would reduce cover to a single-point-of-failure level.",
    level: "medium",
  },
  {
    title: "Night shift forklift coverage is stable",
    detail: "All 5 scheduled night shift operators hold valid forklift certification. No action required.",
    level: "low",
  },
];

const aiActions: AiAction[] = [
  {
    label: "Move one validated packing operator to Line 2 Filling — early shift",
    description: "Line 1 Packing is fully covered at 8 of 8. Moving one validated operator to Line 2 closes the headcount gap without creating a new risk.",
    priority: "critical",
    icon: TrendingUp,
  },
  {
    label: "Reassign a Line 1 operator to support Line 3 changeover — late shift",
    description: "Line 3 has a 2-operator shortfall for the late shift. A cross-trained Line 1 operator can cover the gap if reassigned before the handover.",
    priority: "critical",
    icon: Users,
  },
  {
    label: "Authorise targeted overtime for one validated changeover operator",
    description: "One operator from the early shift has the changeover validation and has indicated availability. Overtime authorisation would close the Line 3 gap.",
    priority: "high",
    icon: Clock,
  },
  {
    label: "Confirm restricted-duty operators before finalising the late shift plan",
    description: "Two operators on restricted duties are scheduled for late shift. Confirm their permitted tasks with their line manager before shift start.",
    priority: "medium",
    icon: ShieldAlert,
  },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const riskBadge: Record<string, string> = {
  low:    "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  medium: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  high:   "bg-[#ef444418] text-red-400 border border-red-500/20",
};

const availBadge: Record<string, string> = {
  high:   "bg-[#ef444418] text-red-400 border border-red-500/20",
  medium: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  low:    "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
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

export const ProductionShiftCoverageSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Production Manager</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Shift Coverage</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          Monitor operator availability, absence risk, production line coverage and shift gaps before they impact today's production plan.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={93} syncedAt={new Date(Date.now() - 120000)} />
        <ExplainWithAi pageId="production-shift-coverage" />
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

    {/* ── Main shift coverage table ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "520ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <ClipboardList className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Shift Coverage by Line</h2>
          <span className="ml-auto text-[11px] text-slate-500">
            {shiftRows.filter((r) => r.risk === "low").length} of {shiftRows.length} lines on target
          </span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Shift</th>
                <th className="px-4 py-3 font-medium text-slate-500">Area / Line</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-right">Required</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-right">Scheduled</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-right">Validated</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-right">Gap</th>
                <th className="px-4 py-3 font-medium text-slate-500">Risk</th>
                <th className="px-4 py-3 font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {shiftRows.map((row, idx) => {
                const coveragePct = Math.round((row.scheduled / row.required) * 100);
                return (
                  <tr
                    key={idx}
                    className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-300">{row.shift}</td>
                    <td className="px-4 py-3 text-slate-400">{row.area}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">{row.required}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: coveragePct >= 100 ? "#10b981" : coveragePct >= 80 ? "#facc15" : "#ef4444" }}>
                      {row.scheduled}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">{row.validated}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: row.gap === 0 ? "#10b981" : row.gap === 1 ? "#facc15" : "#ef4444" }}>
                      {row.gap === 0 ? "—" : `-${row.gap}`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[row.risk]}`}>
                        {row.risk}
                      </span>
                    </td>
                    <td className="px-4 py-3">
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
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked */}
        <div className="flex flex-col divide-y divide-gray-800 md:hidden">
          {shiftRows.map((row, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-xs font-medium text-slate-300">{row.area}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {row.shift} · {row.scheduled}/{row.required} scheduled
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {row.gap > 0 && (
                  <span className="tabular-nums text-xs font-semibold text-red-400">-{row.gap}</span>
                )}
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadge[row.risk]}`}>
                  {row.risk}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── Absence & availability + Coverage risks (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Absence & Availability */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "600ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <Users className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Absence &amp; Availability</h2>
          </div>
          <div className="flex flex-col divide-y divide-gray-800">
            {availabilityItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#1a2030]">
                  <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <p className="flex-1 text-xs font-medium text-slate-300">{item.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-sm font-semibold text-slate-200">{item.count}</span>
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${availBadge[item.badge]}`}>
                      {item.badge}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Coverage Risks */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "680ms" }}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <ShieldAlert className="h-4 w-4 text-orange-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Coverage Risks</h2>
            <span className="ml-auto text-[11px] text-slate-500">
              {coverageRisks.filter((r) => r.level === "high").length} high-risk
            </span>
          </div>
          <div className="flex flex-col divide-y divide-gray-800">
            {coverageRisks.map((risk, idx) => (
              <div key={idx} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[#1a2030]">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${risk.level === "high" ? "bg-red-500" : risk.level === "medium" ? "bg-yellow-400" : "bg-emerald-500"}`} />
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
