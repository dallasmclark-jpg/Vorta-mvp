import {
  AlertTriangle,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { SyncIndicator } from "../../components/SyncIndicator";
import { ExplainWithAi } from "../../components/ExplainWithAi";

// ─── Types ────────────────────────────────────────────────────────────────────

type AvailStatus = "Available" | "Assigned" | "On Call" | "Training" | "Unavailable";
type DayStatus   = "available" | "assigned" | "oncall" | "training" | "leave" | "unavailable" | "off";

interface Engineer {
  id: number;
  name: string;
  initials: string;
  discipline: string;
  region: string;
  status: AvailStatus;
  nextAvailable: string | null;
  assignment: string | null;
  skills: string[];
  certOk: boolean;
  week: DayStatus[]; // Mon–Sun
}

interface Conflict {
  severity: "critical" | "high" | "medium";
  engineer: string;
  description: string;
}

interface Opportunity {
  name: string;
  discipline: string;
  skills: string[];
  matchEngineers: number;
  earliestStart: string;
  readiness: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const engineers: Engineer[] = [
  { id: 1, name: "Sarah Chen",    initials: "SC", discipline: "Electrical",      region: "Leeds",        status: "Available",  nextAvailable: "Today",      assignment: null,                     skills: ["18th Edition", "PLC"],       certOk: true,  week: ["available","available","available","available","available","off","off"] },
  { id: 2, name: "James Patel",   initials: "JP", discipline: "Mechanical",      region: "Sheffield",    status: "Assigned",   nextAvailable: "07 Jul",     assignment: "Krones PM — Britvic",    skills: ["Hydraulics", "Krones"],      certOk: true,  week: ["assigned","assigned","assigned","assigned","assigned","off","off"] },
  { id: 3, name: "Kate Wilson",   initials: "KW", discipline: "Controls",        region: "Manchester",   status: "Available",  nextAvailable: "Today",      assignment: null,                     skills: ["Siemens S7", "HMI"],         certOk: false, week: ["available","available","oncall","available","available","off","off"] },
  { id: 4, name: "Tom Briggs",    initials: "TB", discipline: "Electrical",      region: "Leeds",        status: "Assigned",   nextAvailable: "05 Jul",     assignment: "Siemens PLC — Heineken", skills: ["HV Systems", "EV"],          certOk: true,  week: ["assigned","assigned","assigned","off","off","off","off"] },
  { id: 5, name: "Priya Nair",    initials: "PN", discipline: "Mechanical",      region: "Bradford",     status: "Unavailable",nextAvailable: "14 Jul",     assignment: null,                     skills: ["Krones", "CIP"],             certOk: true,  week: ["leave","leave","leave","leave","leave","leave","leave"] },
  { id: 6, name: "Dan Hurst",     initials: "DH", discipline: "HVAC",            region: "York",         status: "Unavailable",nextAvailable: "TBC",        assignment: null,                     skills: ["F-Gas", "HVAC"],             certOk: false, week: ["unavailable","unavailable","unavailable","unavailable","unavailable","off","off"] },
  { id: 7, name: "Amy Clarke",    initials: "AC", discipline: "Instrumentation", region: "Wakefield",    status: "On Call",    nextAvailable: "Tomorrow",   assignment: null,                     skills: ["ATEX", "Calibration"],       certOk: true,  week: ["oncall","oncall","available","available","available","off","off"] },
  { id: 8, name: "Raj Kumar",     initials: "RK", discipline: "Electrical",      region: "Huddersfield", status: "Assigned",   nextAvailable: "10 Jul",     assignment: "ABB Robot — Unilever",   skills: ["Robotics", "ABB"],           certOk: true,  week: ["assigned","assigned","assigned","assigned","assigned","assigned","off"] },
  { id: 9, name: "Lisa Tong",     initials: "LT", discipline: "Mechanical",      region: "Doncaster",    status: "Training",   nextAvailable: "02 Jul",     assignment: null,                     skills: ["Welding", "Pumps"],          certOk: false, week: ["training","training","available","available","available","off","off"] },
];

const conflicts: Conflict[] = [
  { severity: "critical", engineer: "Dan Hurst",   description: "F-Gas certification expired. Cannot be assigned to any HVAC/refrigeration work until renewed." },
  { severity: "high",     engineer: "Kate Wilson",  description: "18th Edition cert expires 10 Jul — before her next potential assignment on 14 Jul." },
  { severity: "high",     engineer: "Lisa Tong",    description: "2 certifications expiring within 30 days. Renewal needed before new assignments." },
  { severity: "medium",   engineer: "Raj Kumar",    description: "Utilisation at 100% this week. Risk of fatigue if new assignment requested before 10 Jul." },
];

const opportunities: Opportunity[] = [
  { name: "Krones Line 3 Overhaul",   discipline: "Mechanical",     skills: ["Krones", "Hydraulics"], matchEngineers: 2, earliestStart: "29 Jun", readiness: 92 },
  { name: "ABB Robot Calibration",    discipline: "Electrical",     skills: ["Robotics", "ABB"],      matchEngineers: 1, earliestStart: "30 Jun", readiness: 78 },
  { name: "HVAC Annual Inspection",   discipline: "HVAC",           skills: ["F-Gas", "HVAC"],        matchEngineers: 0, earliestStart: "TBC",    readiness: 0  },
  { name: "Siemens PLC Upgrade",      discipline: "Controls",       skills: ["Siemens S7", "HMI"],    matchEngineers: 1, earliestStart: "01 Jul", readiness: 68 },
  { name: "Instrumentation Survey",   discipline: "Instrumentation",skills: ["ATEX", "Calibration"],  matchEngineers: 1, earliestStart: "03 Jul", readiness: 81 },
];

const aiActions: AiAction[] = [
  { label: "Assign Sarah Chen to Krones overhaul",      description: "Sarah is available today with a 92% match for the Krones Line 3 opportunity — highest readiness in your pool.", priority: "critical", icon: Zap         },
  { label: "Resolve Dan Hurst certification block",     description: "Dan is blocked from all HVAC assignments until his F-Gas cert is renewed. Book renewal this week.",              priority: "critical", icon: ShieldCheck  },
  { label: "Keep Amy Clarke on call through Wednesday", description: "3 breakdown opportunities are open this week. Amy's on-call cover maximises rapid response capability.",          priority: "medium",   icon: Clock        },
  { label: "Plan Kate Wilson cert renewal",             description: "Book Kate's 18th Edition renewal before 10 Jul to prevent an assignment gap on the Diageo contract.",            priority: "high",     icon: Brain        },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusConfig: Record<AvailStatus, { badge: string; bg: string; border: string }> = {
  "Available":   { badge: "bg-[#10b98120] text-emerald-400", bg: "bg-[#10b98108]", border: "border-emerald-500/15" },
  "Assigned":    { badge: "bg-[#3b82f620] text-blue-400",    bg: "bg-[#3b82f608]", border: "border-blue-500/15"    },
  "On Call":     { badge: "bg-[#facc1520] text-yellow-400",  bg: "bg-[#facc1508]", border: "border-yellow-400/15"  },
  "Training":    { badge: "bg-[#f9731620] text-orange-400",  bg: "bg-[#f9731608]", border: "border-orange-400/15"  },
  "Unavailable": { badge: "bg-[#ef444420] text-red-400",     bg: "bg-[#ef444408]", border: "border-red-500/15"     },
};

const dayConfig: Record<DayStatus, { label: string; cls: string }> = {
  available:   { label: "Free",    cls: "bg-[#10b98120] text-emerald-400" },
  assigned:    { label: "Asgn",   cls: "bg-[#3b82f620] text-blue-400"    },
  oncall:      { label: "Call",   cls: "bg-[#facc1520] text-yellow-400"  },
  training:    { label: "Train",  cls: "bg-[#f9731620] text-orange-400"  },
  leave:       { label: "Leave",  cls: "bg-[#ffffff0f] text-slate-400"   },
  unavailable: { label: "N/A",    cls: "bg-[#ef444415] text-red-400"     },
  off:         { label: "Off",    cls: "bg-transparent text-slate-700"   },
};

const conflictBg: Record<Conflict["severity"], string> = {
  critical: "border-red-500/20 bg-[#ef444408]",
  high:     "border-orange-400/20 bg-[#f9731608]",
  medium:   "border-yellow-400/20 bg-[#facc1508]",
};

const conflictIcon: Record<Conflict["severity"], string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-yellow-400",
};

const readinessColor = (r: number) =>
  r >= 80 ? "text-emerald-400" : r >= 50 ? "text-yellow-400" : "text-red-400";

const readinessBar = (r: number) =>
  r >= 80 ? "[&>div]:bg-emerald-500" : r >= 50 ? "[&>div]:bg-yellow-400" : "[&>div]:bg-red-500";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS_ORDER: AvailStatus[] = ["Available", "On Call", "Training", "Assigned", "Unavailable"];

// ─── Engineer availability card ───────────────────────────────────────────────

function EngCard({ e }: { e: Engineer }) {
  const cfg = statusConfig[e.status];
  return (
    <div className={`flex flex-col gap-2.5 rounded-lg border ${cfg.border} ${cfg.bg} p-3`}>
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1a2030] text-[10px] font-bold text-blue-300">
          {e.initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-100">{e.name}</p>
          <p className="text-[10px] text-slate-500">{e.discipline}</p>
        </div>
        {!e.certOk && (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-400" title="Cert issue" />
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {e.skills.map((s) => (
          <span key={s} className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">{s}</span>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <MapPin className="h-3 w-3 text-slate-700" />{e.region}
        {e.assignment && (
          <>
            <span className="text-slate-700">·</span>
            <span className="truncate text-blue-400">{e.assignment}</span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${cfg.badge}`}>
          {e.status}
        </Badge>
        {e.nextAvailable && (
          <span className="text-[10px] text-slate-500">
            {e.status === "Available" ? "" : "Free "}{e.nextAvailable}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export const ContractorAvailabilitySection = (): JSX.Element => {
  const kpis = [
    { label: "Available Today",   value: String(engineers.filter((e) => e.status === "Available").length),   valueClass: "text-emerald-400", icon: CheckCircle2  },
    { label: "Assigned",          value: String(engineers.filter((e) => e.status === "Assigned").length),    valueClass: "text-blue-400",    icon: Zap           },
    { label: "On Call",           value: String(engineers.filter((e) => e.status === "On Call").length),     valueClass: "text-yellow-400",  icon: Clock         },
    { label: "Unavailable",       value: String(engineers.filter((e) => e.status === "Unavailable" || e.status === "Training").length), valueClass: "text-slate-400", icon: Users },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

      {/* Header */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-medium text-slate-500">Contractor Portal</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Availability</h1>
          <p className="mt-1 text-sm text-slate-400">Monitor engineer availability, utilisation and assignment readiness.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <SyncIndicator source="Vorta" confidence={89} syncedAt={new Date(Date.now() - 60000)} />
          <ExplainWithAi pageId="contractor-availability" />
          <Button className="bg-blue-600 text-white hover:bg-blue-500">
            <RefreshCw className="h-4 w-4" />Update Availability
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ label, value, valueClass, icon: Icon }) => (
          <Card key={label} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-400">{label}</p>
                <Icon className="h-4 w-4 shrink-0 text-slate-600" />
              </div>
              <p className={`text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Availability board */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Availability Board</span>
            </div>
            <span className="text-[11px] text-slate-500">{engineers.length} engineers</span>
          </div>

          <div className="flex flex-col gap-5">
            {STATUS_ORDER.map((status) => {
              const group = engineers.filter((e) => e.status === status);
              if (group.length === 0) return null;
              return (
                <div key={status}>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusConfig[status].badge}`}>
                      {status}
                    </Badge>
                    <span className="text-[11px] text-slate-600">{group.length} engineer{group.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.map((e) => <EngCard key={e.id} e={e} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Weekly grid */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Weekly View</span>
              <span className="text-[11px] text-slate-500">w/c 30 Jun 2026</span>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              {(["available","assigned","oncall","training","leave"] as DayStatus[]).map((d) => (
                <span key={d} className="flex items-center gap-1">
                  <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${dayConfig[d].cls}`}>{dayConfig[d].label}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-[#0f1318]">
                  <th className="w-36 px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Engineer</th>
                  {DAYS.map((d) => (
                    <th key={d} className="px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {engineers.map((e, idx) => (
                  <tr key={e.id} className={`border-b border-gray-800/50 ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-500/20 text-[9px] font-bold text-blue-300">
                          {e.initials}
                        </div>
                        <span className="font-medium text-slate-200">{e.name.split(" ")[0]}</span>
                      </div>
                    </td>
                    {e.week.map((day, di) => {
                      const cfg = dayConfig[day as DayStatus] ?? dayConfig["off"];
                      return (
                        <td key={di} className="px-1 py-2.5 text-center">
                          {day !== "off" && (
                            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${cfg.cls}`}>
                              {cfg.label}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Conflicts + Opportunity readiness */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Conflicts */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-semibold text-slate-200">Assignment Conflicts</span>
              </div>
              <Badge className="inline-flex h-auto rounded bg-[#f9731620] px-2 py-0.5 text-[10px] font-medium text-orange-400 shadow-none">
                {conflicts.length} issues
              </Badge>
            </div>
            <div className="flex flex-col gap-2">
              {conflicts.map((c, i) => (
                <div key={i} className={`flex items-start gap-2.5 rounded-lg border p-3 ${conflictBg[c.severity]}`}>
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${conflictIcon[c.severity]}`} />
                  <div>
                    <p className={`text-xs font-semibold ${conflictIcon[c.severity]}`}>
                      {c.severity.charAt(0).toUpperCase() + c.severity.slice(1)} — {c.engineer}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{c.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Opportunity readiness */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-semibold text-slate-200">Opportunity Readiness</span>
              </div>
              <span className="text-[11px] text-slate-500">{opportunities.length} open</span>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0f1318]">
                    {["Opportunity", "Discipline", "Matches", "Earliest Start", "Readiness"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((o, idx) => (
                    <tr key={o.name} className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-200">{o.name}</p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {o.skills.map((s) => (
                            <span key={s} className="rounded bg-blue-500/10 px-1 py-0.5 text-[9px] font-medium text-blue-400">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">{o.discipline}</td>
                      <td className="px-4 py-2.5">
                        {o.matchEngineers === 0
                          ? <span className="font-semibold text-red-400">None</span>
                          : <span className="font-semibold text-emerald-400">{o.matchEngineers}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 tabular-nums">{o.earliestStart}</td>
                      <td className="px-4 py-2.5">
                        {o.readiness === 0
                          ? <span className="text-xs font-semibold text-red-400">Blocked</span>
                          : (
                            <div className="flex items-center gap-2">
                              <div className="relative h-1.5 w-16 overflow-hidden rounded bg-gray-800">
                                <div
                                  className={`absolute left-0 top-0 h-full rounded transition-all ${o.readiness >= 80 ? "bg-emerald-500" : o.readiness >= 50 ? "bg-yellow-400" : "bg-red-500"}`}
                                  style={{ width: `${o.readiness}%` }}
                                />
                              </div>
                              <span className={`text-xs font-semibold tabular-nums ${readinessColor(o.readiness)}`}>{o.readiness}%</span>
                            </div>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI recommendations */}
      <AiActionsPanel actions={aiActions} />

    </section>
  );
};
