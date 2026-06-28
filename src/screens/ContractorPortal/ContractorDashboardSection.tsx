import {
  AlertTriangle,
  Briefcase,
  Building2,
  ClipboardList,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { SyncIndicator } from "../../components/SyncIndicator";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { TrendIndicator } from "../../components/TrendIndicator";

// ─── Mock data ────────────────────────────────────────────────────────────────

const kpis = [
  { label: "Active Engineers",   value: "24",  sub: "+2 this month",        icon: Users,         valueClass: "text-slate-50",    trend: { direction: "up" as const, label: "+2 this month",  positiveIsUp: true  } },
  { label: "Available Today",    value: "9",   sub: "Ready to deploy",      icon: Zap,           valueClass: "text-emerald-400", trend: { direction: "up" as const, label: "+3 vs yesterday", positiveIsUp: true  } },
  { label: "Open Opportunities", value: "6",   sub: "Awaiting match",       icon: Briefcase,     valueClass: "text-blue-400",    trend: { direction: "flat" as const, label: "No change",     positiveIsUp: true  } },
  { label: "Active Assignments", value: "11",  sub: "Across 4 sites",       icon: ClipboardList, valueClass: "text-slate-50",    trend: { direction: "down" as const, label: "-1 completed",  positiveIsUp: false } },
];

const opportunities = [
  { id: 1, name: "Krones Line 3 Overhaul",    customer: "Britvic — Sheffield",     skills: ["PLC", "Mechanical"],       matchScore: 94, priority: "critical", engineer: "Sarah Chen",    status: "Matched"    },
  { id: 2, name: "ABB Robot Calibration",      customer: "Unilever — Leeds",        skills: ["Robotics", "Controls"],    matchScore: 88, priority: "high",     engineer: "James Patel",   status: "Pending"    },
  { id: 3, name: "Compressor Maintenance PM",  customer: "Heineken — Manchester",   skills: ["Mechanical", "HVAC"],      matchScore: 79, priority: "medium",   engineer: "Tom Briggs",    status: "Reviewing"  },
  { id: 4, name: "Electrical Safety Audit",    customer: "Diageo — Edinburgh",      skills: ["18th Edition", "EV"],      matchScore: 71, priority: "medium",   engineer: "Kate Wilson",   status: "Reviewing"  },
  { id: 5, name: "Conveyor System Upgrade",    customer: "Müller — Telford",        skills: ["Mechanical", "Hydraulics"],matchScore: 65, priority: "low",      engineer: "Unassigned",    status: "Open"       },
];

const engineers = [
  { name: "Sarah Chen",   initials: "SC", discipline: "Electrical",  status: "Available",   assignment: "—",                   utilisation: 0,  certStatus: "valid"   },
  { name: "James Patel",  initials: "JP", discipline: "Mechanical",  status: "On Assignment",assignment: "Krones PM — Sheffield", utilisation: 85, certStatus: "valid"   },
  { name: "Kate Wilson",  initials: "KW", discipline: "Controls",    status: "Available",   assignment: "—",                   utilisation: 0,  certStatus: "expiring" },
  { name: "Tom Briggs",   initials: "TB", discipline: "Electrical",  status: "On Assignment",assignment: "Siemens PLC — Leeds",  utilisation: 70, certStatus: "valid"   },
  { name: "Priya Nair",   initials: "PN", discipline: "Mechanical",  status: "On Leave",    assignment: "—",                   utilisation: 0,  certStatus: "valid"   },
  { name: "Dan Hurst",    initials: "DH", discipline: "HVAC",        status: "Available",   assignment: "—",                   utilisation: 0,  certStatus: "expired"  },
];

const assignments = [
  { id: 1, title: "Krones Line 3 PM",       customer: "Britvic — Sheffield",   engineer: "James Patel",  start: "23 Jun 2026", status: "In Progress", progress: 60 },
  { id: 2, title: "Siemens PLC Upgrade",    customer: "Heineken — Leeds",      engineer: "Tom Briggs",   start: "17 Jun 2026", status: "In Progress", progress: 35 },
  { id: 3, title: "ABB Robot Service",      customer: "Unilever — Manchester", engineer: "Sarah Chen",   start: "28 Jun 2026", status: "Starting",    progress: 5  },
  { id: 4, title: "HVAC Inspection",        customer: "Diageo — Edinburgh",    engineer: "Dan Hurst",    start: "01 Jul 2026", status: "Scheduled",   progress: 0  },
];

const aiActions: AiAction[] = [
  { label: "Deploy Sarah Chen to Krones Overhaul",     description: "Sarah is available and has a 94% match for the urgent Krones Line 3 opportunity in Sheffield.",           priority: "critical", icon: Zap          },
  { label: "Kate Wilson certification expiring",       description: "Kate's 18th Edition cert expires in 12 days. Book renewal to keep her deployable.",                       priority: "high",     icon: ShieldCheck  },
  { label: "Dan Hurst — expired certification",        description: "Dan's HVAC F-Gas card has expired. He cannot be assigned until renewed.",                                 priority: "critical", icon: AlertTriangle },
  { label: "Low utilisation: 5 engineers under 20%",  description: "Consider proactively marketing availability to 3 open tenders that match your team's skills.",            priority: "medium",   icon: TrendingUp   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const priorityBadge: Record<string, string> = {
  critical: "bg-[#ef444418] text-red-400 border border-red-500/20",
  high:     "bg-[#f9731618] text-orange-400 border border-orange-500/20",
  medium:   "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",
  low:      "bg-[#10b98118] text-emerald-400 border border-emerald-500/20",
};

const statusBadge: Record<string, string> = {
  Matched:    "bg-[#3b82f620] text-blue-400",
  Pending:    "bg-[#facc1520] text-yellow-400",
  Reviewing:  "bg-[#3b82f620] text-blue-400",
  Open:       "bg-[#ffffff0f] text-slate-400",
};

const availBadge: Record<string, string> = {
  "Available":    "bg-[#10b98120] text-emerald-400",
  "On Assignment":"bg-[#3b82f620] text-blue-400",
  "On Leave":     "bg-[#ffffff0f] text-slate-400",
};

const certBadge: Record<string, string> = {
  valid:    "bg-[#10b98120] text-emerald-400",
  expiring: "bg-[#facc1520] text-yellow-400",
  expired:  "bg-[#ef444420] text-red-400",
};

const assignStatusBadge: Record<string, string> = {
  "In Progress": "bg-[#3b82f620] text-blue-400",
  "Starting":    "bg-[#10b98120] text-emerald-400",
  "Scheduled":   "bg-[#ffffff0f] text-slate-400",
};

const scoreColor = (s: number) =>
  s >= 85 ? "text-emerald-400" : s >= 70 ? "text-yellow-400" : "text-orange-400";

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, valueClass, trend }: typeof kpis[number]) {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <Icon className="h-4 w-4 shrink-0 text-slate-600" />
        </div>
        <p className={`text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
        <div className="flex items-center gap-2">
          <TrendIndicator direction={trend.direction} label={trend.label} positiveIsUp={trend.positiveIsUp} />
          <span className="text-[11px] text-slate-600">·</span>
          <p className="text-[11px] text-slate-500">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export const ContractorDashboardSection = (): JSX.Element => (
  <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

    {/* Header */}
    <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
      <div>
        <p className="text-xs font-medium text-slate-500">Contractor Portal</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Contractor Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Manage workforce availability, matched opportunities and active assignments.</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SyncIndicator source="Vorta" confidence={91} syncedAt={new Date(Date.now() - 120000)} />
        <ExplainWithAi pageId="contractor-dashboard" />
      </div>
    </header>

    {/* KPI row */}
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
    </div>

    {/* Opportunity Centre */}
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">Opportunity Centre</span>
            <Badge className="ml-1 inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />AI Ranked
            </Badge>
          </div>
          <span className="text-[11px] text-slate-500">{opportunities.length} opportunities</span>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0f1318]">
                {["Opportunity", "Customer / Site", "Required Skills", "Match", "Priority", "Recommended Engineer", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {opportunities.map((o, idx) => (
                <tr key={o.id} className={`cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}>
                  <td className="px-4 py-2.5 font-medium text-slate-100">{o.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin className="h-3 w-3 text-slate-600" />{o.customer}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {o.skills.map((s) => (
                        <span key={s} className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-semibold tabular-nums ${scoreColor(o.matchScore)}`}>{o.matchScore}%</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${priorityBadge[o.priority]}`}>
                      {o.priority.charAt(0).toUpperCase() + o.priority.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {o.engineer === "Unassigned"
                      ? <span className="text-slate-500">Unassigned</span>
                      : (
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-500/20 text-[9px] font-bold text-blue-300">
                            {o.engineer.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <span className="text-slate-300">{o.engineer}</span>
                        </div>
                      )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadge[o.status] ?? "bg-[#ffffff0f] text-slate-400"}`}>
                      {o.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    {/* Engineer Availability + Active Assignments */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Engineer Availability */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Engineer Availability</span>
            </div>
            <span className="text-[11px] text-slate-500">{engineers.length} engineers</span>
          </div>
          <div className="divide-y divide-gray-800/60">
            {engineers.map((e) => (
              <div key={e.name} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#1a2030]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-[10px] font-bold text-blue-300">
                  {e.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{e.name}</p>
                  <p className="text-[11px] text-slate-500">{e.discipline}{e.assignment !== "—" ? ` · ${e.assignment}` : ""}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${availBadge[e.status] ?? "bg-[#ffffff0f] text-slate-400"}`}>
                    {e.status}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    {e.utilisation > 0 && (
                      <span className="text-[10px] tabular-nums text-slate-500">{e.utilisation}% util</span>
                    )}
                    <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[10px] font-medium shadow-none ${certBadge[e.certStatus]}`}>
                      {e.certStatus === "valid" ? "Certs OK" : e.certStatus === "expiring" ? "Expiring" : "Expired"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Assignments */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Active Assignments</span>
            </div>
            <span className="text-[11px] text-slate-500">{assignments.length} assignments</span>
          </div>
          <div className="flex flex-col gap-0 divide-y divide-gray-800/60">
            {assignments.map((a) => (
              <div key={a.id} className="flex flex-col gap-2.5 px-5 py-4 transition-colors hover:bg-[#1a2030]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{a.title}</p>
                    <span className="flex items-center gap-1 text-[11px] text-slate-500">
                      <MapPin className="h-3 w-3 text-slate-600" />{a.customer}
                    </span>
                  </div>
                  <Badge className={`inline-flex h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${assignStatusBadge[a.status] ?? "bg-[#ffffff0f] text-slate-400"}`}>
                    {a.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-500/20 text-[9px] font-bold text-blue-300">
                    {a.engineer.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <span className="text-[11px] text-slate-400">{a.engineer}</span>
                  <span className="text-[11px] text-slate-600">·</span>
                  <span className="text-[11px] text-slate-500">From {a.start}</span>
                </div>
                {a.progress > 0 && (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Progress</span>
                      <span className="tabular-nums text-slate-500">{a.progress}%</span>
                    </div>
                    <Progress
                      value={a.progress}
                      className={`h-1.5 overflow-hidden rounded bg-gray-800 ${a.progress >= 60 ? "[&>div]:bg-emerald-500" : a.progress >= 30 ? "[&>div]:bg-blue-500" : "[&>div]:bg-slate-500"}`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* AI Workforce Recommendations */}
    <AiActionsPanel actions={aiActions} />

    {/* Workforce snapshot footer */}
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-800 bg-[#0f1318] px-5 py-4">
      <Building2 className="h-4 w-4 shrink-0 text-slate-600" />
      <span className="text-xs font-medium text-slate-500">Workforce Snapshot</span>
      <span className="text-slate-700">·</span>
      {[
        { label: "9 available",      cls: "text-emerald-400" },
        { label: "11 on assignment", cls: "text-blue-400"    },
        { label: "1 on leave",       cls: "text-slate-400"   },
        { label: "2 cert issues",    cls: "text-red-400"     },
      ].map(({ label, cls }) => (
        <span key={label} className={`text-xs font-medium ${cls}`}>{label}</span>
      ))}
      <span className="ml-auto">
        <GraduationCap className="h-4 w-4 text-slate-700" />
      </span>
    </div>

  </section>
);
