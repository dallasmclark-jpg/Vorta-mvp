import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Network,
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
    label: "Validated Skills",
    value: "14",
    sub: "Fully approved",
    icon: CheckCircle2,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+1 this month",    positiveIsUp: true  },
  },
  {
    label: "Skills In Progress",
    value: "3",
    sub: "Partially complete",
    icon: TrendingUp,
    valueClass: "text-blue-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: true  },
  },
  {
    label: "Expiring Soon",
    value: "2",
    sub: "Within 90 days",
    icon: AlertTriangle,
    valueClass: "text-yellow-400",
    trend: { direction: "up" as const,   label: "Action needed",    positiveIsUp: false },
  },
  {
    label: "Training Actions",
    value: "4",
    sub: "Open items",
    icon: GraduationCap,
    valueClass: "text-yellow-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: false },
  },
  {
    label: "Manager Sign-Offs",
    value: "1",
    sub: "Awaiting approval",
    icon: ShieldCheck,
    valueClass: "text-orange-400",
    trend: { direction: "flat" as const, label: "No change",        positiveIsUp: false },
  },
  {
    label: "Skill Readiness",
    value: "88%",
    sub: "Overall profile",
    icon: Network,
    valueClass: "text-emerald-400",
    trend: { direction: "up" as const,   label: "+3% this quarter", positiveIsUp: true  },
  },
];

const skillSummary = [
  { name: "Line 2 Filling",              status: "validated",        level: 100 },
  { name: "Packing",                     status: "validated",        level: 100 },
  { name: "Quality Checks",              status: "validated",        level: 100 },
  { name: "SAP Production Confirmation", status: "validated",        level: 100 },
  { name: "Line Changeover",             status: "in-progress",      level: 65  },
  { name: "Forklift",                    status: "not-required",     level: 0   },
  { name: "First Response Maintenance",  status: "training-needed",  level: 25  },
  { name: "Mixing",                      status: "future-dev",       level: 10  },
];

const competencies = [
  { skill: "Line 2 Filling",              area: "Production",           status: "validated",       validation: "Manager Approved", expiry: "2027-06-30", action: "View",            actionPrimary: false },
  { skill: "Quality Checks",              area: "Quality",              status: "validated",       validation: "Manager Approved", expiry: "2027-04-15", action: "View",            actionPrimary: false },
  { skill: "SAP Production Confirmation", area: "SAP",                  status: "validated",       validation: "Manager Approved", expiry: "2027-02-20", action: "View",            actionPrimary: false },
  { skill: "Line Changeover",             area: "Line 3",               status: "in-progress",     validation: "Awaiting Sign-Off",expiry: "2026-08-15", action: "Request Sign-Off",actionPrimary: true  },
  { skill: "Food Safety",                 area: "Compliance",           status: "validated",       validation: "Complete",        expiry: "2027-01-10", action: "View",            actionPrimary: false },
  { skill: "First Response Maintenance",  area: "Maintenance Support",  status: "training-needed", validation: "Not Started",     expiry: "Not Set",    action: "Start Training",  actionPrimary: true  },
];

const developmentPlan = [
  { text: "Complete Line Changeover sign-off with your line lead during the next planned changeover.",                    urgency: "high"   },
  { text: "Start First Response Maintenance awareness module to improve your shift resilience profile.",                   urgency: "high"   },
  { text: "Refresh SAP Production Confirmation steps before your next rota cycle to prevent confirmation errors.",         urgency: "medium" },
  { text: "Shadow a senior operator during the next planned Line 3 changeover to build supervised evidence.",              urgency: "medium" },
  { text: "Begin Mixing process familiarisation to broaden future production flexibility across the site.",                urgency: "low"    },
];

const expiryAlerts = [
  { text: "Line Changeover training requires manager sign-off before competency can be validated.",           urgent: true  },
  { text: "Food Safety refresher due within 90 days — book before expiry to avoid a compliance gap.",         urgent: true  },
  { text: "SAP Production Confirmation review recommended following a recent process change on Line 2.",      urgent: false },
  { text: "First Response Maintenance training not yet started — recommended for all Line 2 operators.",      urgent: false },
];

const aiActions: AiAction[] = [
  {
    label: "Request manager sign-off for Line Changeover during the next planned changeover",
    description: "Your Line Changeover evidence was submitted 2 days ago. Requesting a sign-off review during today's planned Line 3 changeover keeps your competency on track and avoids a further delay.",
    priority: "high",
    icon: ShieldCheck,
  },
  {
    label: "Prioritise First Response Maintenance awareness to improve shift resilience",
    description: "You are the only operator on your regular Line 2 team without First Response Maintenance awareness. Starting the module now reduces a single-point dependency risk flagged by the Production Manager.",
    priority: "high",
    icon: AlertTriangle,
  },
  {
    label: "Review SAP confirmation process before your next Line 2 shift",
    description: "A process change was recently applied to SAP production confirmation on Line 2. Reviewing the updated steps before your next shift prevents a confirmation error on the first batch.",
    priority: "medium",
    icon: BookOpen,
  },
  {
    label: "Shadow a senior operator on Mixing to broaden future production flexibility",
    description: "You currently have no Mixing exposure. Shadowing a senior operator during a planned run will start building evidence for a future competency and increases your overall site flexibility score.",
    priority: "low",
    icon: TrendingUp,
  },
];

const recentActivity = [
  { when: "Yesterday",  activity: "Quality Checks validation reviewed",           status: "complete"         },
  { when: "2 days ago", activity: "Line Changeover evidence submitted",           status: "awaiting-signoff" },
  { when: "Last week",  activity: "SAP Production Confirmation refresher complete",status: "complete"        },
  { when: "Last week",  activity: "First Response Maintenance recommended",        status: "open"            },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const statusBadge: Record<string, string> = {
  "validated":       "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  "in-progress":     "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  "training-needed": "bg-[#ef444418] text-red-400 border border-red-500/20",
  "not-required":    "bg-[#ffffff10] text-slate-500 border border-gray-700",
  "future-dev":      "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const statusLabel: Record<string, string> = {
  "validated":       "Validated",
  "in-progress":     "In Progress",
  "training-needed": "Training Needed",
  "not-required":    "Not Required",
  "future-dev":      "Future Dev",
};

const barColor: Record<string, string> = {
  "validated":       "[&>div]:bg-emerald-500",
  "in-progress":     "[&>div]:bg-yellow-400",
  "training-needed": "[&>div]:bg-red-500",
  "not-required":    "[&>div]:bg-slate-700",
  "future-dev":      "[&>div]:bg-blue-500",
};

const activityStatusBadge: Record<string, string> = {
  "complete":          "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
  "awaiting-signoff":  "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  "open":              "bg-[#3b82f618] text-blue-400 border border-blue-500/20",
};

const activityStatusLabel: Record<string, string> = {
  "complete": "Complete", "awaiting-signoff": "Awaiting Sign-Off", "open": "Open",
};

const urgencyCls: Record<string, string> = {
  high:   "text-orange-400",
  medium: "text-yellow-400",
  low:    "text-slate-400",
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

export const OperatorMySkillsSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* ── Header ── */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Operator Portal</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">My Skills</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          Track your validated production skills, competency progress, expiry dates and recommended training actions so you stay ready for current and future production needs.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={88} syncedAt={new Date(Date.now() - 60000)} />
        <ExplainWithAi pageId="operator-my-skills" />
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

    {/* ── Skills Summary ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "520ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <Network className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Skills Summary</h2>
          <span className="ml-auto text-[11px] text-slate-500">
            {skillSummary.filter((s) => s.status === "validated").length} of {skillSummary.length} validated
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {skillSummary.map((skill) => (
            <div key={skill.name} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-300 truncate">{skill.name}</span>
                <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[skill.status]}`}>
                  {statusLabel[skill.status]}
                </span>
              </div>
              <AnimatedProgress value={skill.level} className={`h-1.5 bg-gray-800 ${barColor[skill.status]}`} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── Competency Table ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "600ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <ClipboardList className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">My Competencies</h2>
          <span className="ml-auto text-[11px] text-slate-500">
            {competencies.filter((c) => c.status === "validated").length} validated
          </span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">Skill / Competency</th>
                <th className="px-4 py-3 font-medium text-slate-500">Area</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500">Validation</th>
                <th className="px-4 py-3 font-medium text-slate-500">Expiry</th>
                <th className="px-4 py-3 font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {competencies.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                >
                  <td className="px-5 py-3 font-medium text-slate-300">{row.skill}</td>
                  <td className="px-4 py-3 text-slate-500">{row.area}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[row.status]}`}>
                      {statusLabel[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{row.validation}</td>
                  <td className={`px-4 py-3 tabular-nums ${row.expiry === "Not Set" ? "text-slate-600" : "text-slate-400"}`}>
                    {row.expiry}
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
          {competencies.map((row, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300">{row.skill}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{row.area} · {row.expiry}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[row.status]}`}>
                {statusLabel[row.status]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* ── Development Plan + Expiry Alerts (2-col on XL) ── */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Skills Development Plan */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "680ms" }}
      >
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <TrendingUp className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Skills Development Plan</h2>
          </div>
          <div className="flex flex-col gap-2">
            {developmentPlan.map(({ text, urgency }, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg border border-gray-800 bg-[#0f1318] px-3 py-2.5">
                <GraduationCap className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${urgencyCls[urgency]}`} aria-hidden="true" />
                <p className="text-[11px] leading-relaxed text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Expiry / Review Alerts */}
      <Card
        className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
        style={{ animationDelay: "760ms" }}
      >
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
            <AlertTriangle className="h-4 w-4 text-yellow-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Expiring / Review Required</h2>
            <span className="ml-auto text-[11px] text-slate-500">
              {expiryAlerts.filter((a) => a.urgent).length} urgent
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {expiryAlerts.map((alert, i) => (
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
    </div>

    {/* ── AI Guidance ── */}
    <div className="motion-safe:animate-card-enter" style={{ animationDelay: "840ms" }}>
      <AiActionsPanel actions={aiActions} />
    </div>

    {/* ── Recent Skill Activity ── */}
    <Card
      className="rounded-xl border border-gray-800 bg-[#141820] shadow-none motion-safe:animate-card-enter"
      style={{ animationDelay: "920ms" }}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Recent Skill Activity</h2>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 font-medium text-slate-500">When</th>
                <th className="px-4 py-3 font-medium text-slate-500">Skill Activity</th>
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
