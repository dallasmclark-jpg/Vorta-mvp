import { useState } from "react";
import {
  AlertTriangle,
  Award,
  Brain,
  CheckCircle2,
  Filter,
  GraduationCap,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { SyncIndicator } from "../../components/SyncIndicator";
import { EmptyState } from "../../components/EmptyState";

// ─── Mock data ────────────────────────────────────────────────────────────────

interface Engineer {
  id: number;
  name: string;
  initials: string;
  discipline: string;
  location: string;
  status: "Available" | "On Assignment" | "On Leave" | "Unavailable";
  assignment: string | null;
  utilisation: number;
  skills: string[];
  certStatus: "valid" | "expiring" | "expired";
  certCount: number;
  certExpiring: number;
  competency: number;
  aiScore: number;
}

const engineers: Engineer[] = [
  { id: 1, name: "Sarah Chen",    initials: "SC", discipline: "Electrical",     location: "Leeds",       status: "Available",     assignment: null,                          utilisation: 0,  skills: ["18th Edition", "PLC", "SCADA"],           certStatus: "valid",    certCount: 6, certExpiring: 0, competency: 94, aiScore: 91 },
  { id: 2, name: "James Patel",   initials: "JP", discipline: "Mechanical",     location: "Sheffield",   status: "On Assignment",  assignment: "Krones PM — Britvic",          utilisation: 85, skills: ["Hydraulics", "Krones", "Pneumatics"],      certStatus: "valid",    certCount: 5, certExpiring: 0, competency: 88, aiScore: 85 },
  { id: 3, name: "Kate Wilson",   initials: "KW", discipline: "Controls",       location: "Manchester",  status: "Available",     assignment: null,                          utilisation: 0,  skills: ["Siemens S7", "Allen Bradley", "HMI"],     certStatus: "expiring", certCount: 4, certExpiring: 1, competency: 82, aiScore: 78 },
  { id: 4, name: "Tom Briggs",    initials: "TB", discipline: "Electrical",     location: "Leeds",       status: "On Assignment",  assignment: "Siemens PLC — Heineken",       utilisation: 70, skills: ["HV Systems", "18th Edition", "EV"],        certStatus: "valid",    certCount: 7, certExpiring: 0, competency: 79, aiScore: 76 },
  { id: 5, name: "Priya Nair",    initials: "PN", discipline: "Mechanical",     location: "Bradford",    status: "On Leave",      assignment: null,                          utilisation: 0,  skills: ["Krones", "Filling Lines", "CIP"],          certStatus: "valid",    certCount: 4, certExpiring: 0, competency: 86, aiScore: 83 },
  { id: 6, name: "Dan Hurst",     initials: "DH", discipline: "HVAC",           location: "York",        status: "Available",     assignment: null,                          utilisation: 0,  skills: ["F-Gas", "Refrigeration", "HVAC"],          certStatus: "expired",  certCount: 3, certExpiring: 1, competency: 68, aiScore: 54 },
  { id: 7, name: "Amy Clarke",    initials: "AC", discipline: "Instrumentation",location: "Wakefield",   status: "Available",     assignment: null,                          utilisation: 0,  skills: ["ATEX", "Calibration", "Flow Meters"],      certStatus: "valid",    certCount: 5, certExpiring: 0, competency: 91, aiScore: 89 },
  { id: 8, name: "Raj Kumar",     initials: "RK", discipline: "Electrical",     location: "Huddersfield",status: "On Assignment",  assignment: "ABB Robot — Unilever",         utilisation: 100,skills: ["Robotics", "ABB", "PLC"],                  certStatus: "valid",    certCount: 6, certExpiring: 0, competency: 87, aiplatform: 84, aiScore: 84 },
  { id: 9, name: "Lisa Tong",     initials: "LT", discipline: "Mechanical",     location: "Doncaster",   status: "Unavailable",   assignment: null,                          utilisation: 0,  skills: ["Welding", "Fabrication", "Pumps"],         certStatus: "expiring", certCount: 3, certExpiring: 2, competency: 72, aiScore: 61 },
];

const aiActions: AiAction[] = [
  { label: "Book Dan Hurst F-Gas renewal",          description: "Dan's F-Gas certification has expired. He cannot be assigned to HVAC/refrigeration work until renewed.",       priority: "critical", icon: AlertTriangle },
  { label: "Kate Wilson — cert expiring in 12 days", description: "Book Kate's 18th Edition renewal before it lapses to keep her on electrical assignments.",                    priority: "high",     icon: ShieldCheck   },
  { label: "Lisa Tong — 2 certs expiring",          description: "Lisa has 2 certifications expiring within 30 days. Schedule renewals to maintain assignment readiness.",      priority: "high",     icon: GraduationCap },
  { label: "Grow automation bench depth",           description: "Only 3 engineers hold Siemens S7. Add cross-training for 2 more to reduce single-point-of-failure risk.",     priority: "medium",   icon: Brain         },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusBadge: Record<Engineer["status"], string> = {
  "Available":     "bg-[#10b98120] text-emerald-400",
  "On Assignment": "bg-[#3b82f620] text-blue-400",
  "On Leave":      "bg-[#ffffff0f] text-slate-400",
  "Unavailable":   "bg-[#ef444420] text-red-400",
};

const certBadge: Record<string, string> = {
  valid:    "bg-[#10b98120] text-emerald-400",
  expiring: "bg-[#facc1520] text-yellow-400",
  expired:  "bg-[#ef444420] text-red-400",
};

const certLabel: Record<string, string> = {
  valid:    "Certs OK",
  expiring: "Expiring",
  expired:  "Expired",
};

const scoreColor = (s: number) =>
  s >= 85 ? "text-emerald-400" : s >= 70 ? "text-yellow-400" : "text-orange-400";

const utilColor = (u: number) =>
  u >= 80 ? "[&>div]:bg-blue-500" : u >= 40 ? "[&>div]:bg-emerald-500" : "[&>div]:bg-slate-600";

const disciplines = ["All Disciplines", "Electrical", "Mechanical", "Controls", "HVAC", "Instrumentation"];
const statuses    = ["All Statuses", "Available", "On Assignment", "On Leave", "Unavailable"];

// ─── Drawer ───────────────────────────────────────────────────────────────────

function EngineerDrawer({ engineer, onClose }: { engineer: Engineer; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-gray-800 bg-[#090b10] shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            <span className="font-semibold text-slate-50">Engineer Profile</span>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {/* Identity */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-lg font-bold text-blue-300">
              {engineer.initials}
            </div>
            <div>
              <p className="font-semibold text-slate-50">{engineer.name}</p>
              <p className="text-sm text-slate-400">{engineer.discipline}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadge[engineer.status]}`}>
                  {engineer.status}
                </Badge>
                <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${certBadge[engineer.certStatus]}`}>
                  {certLabel[engineer.certStatus]}
                </Badge>
              </div>
            </div>
          </div>

          {/* Location / assignment */}
          <div className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-[#111620] p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="h-3.5 w-3.5 text-slate-600" />{engineer.location}
            </div>
            {engineer.assignment && (
              <div className="flex items-center gap-2 text-xs text-blue-400">
                <Zap className="h-3.5 w-3.5" />{engineer.assignment}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Competency", `${engineer.competency}%`],
              ["AI Score",   `${engineer.aiScore}%`   ],
              ["Certs Active", `${engineer.certCount}`],
              ["Utilisation", `${engineer.utilisation}%`],
            ].map(([l, v]) => (
              <div key={l} className="flex flex-col gap-0.5 rounded-lg border border-gray-800 bg-[#111620] p-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{l}</span>
                <span className="text-sm font-semibold text-slate-200">{v}</span>
              </div>
            ))}
          </div>

          {/* Competency bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Competency Score</span>
              <span className={`tabular-nums font-medium ${scoreColor(engineer.competency)}`}>{engineer.competency}%</span>
            </div>
            <Progress value={engineer.competency} className={`h-2 overflow-hidden rounded bg-gray-800 ${engineer.competency >= 85 ? "[&>div]:bg-emerald-500" : engineer.competency >= 70 ? "[&>div]:bg-yellow-400" : "[&>div]:bg-orange-400"}`} />
          </div>

          {/* Skills */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {engineer.skills.map((s) => (
                <span key={s} className="rounded bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-400">{s}</span>
              ))}
            </div>
          </div>

          {/* Cert warning */}
          {engineer.certStatus !== "valid" && (
            <div className={`flex items-start gap-2.5 rounded-lg border p-3 ${engineer.certStatus === "expired" ? "border-red-500/20 bg-[#ef444408]" : "border-yellow-500/20 bg-[#facc1508]"}`}>
              <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${engineer.certStatus === "expired" ? "text-red-400" : "text-yellow-400"}`} />
              <div>
                <p className={`text-xs font-semibold ${engineer.certStatus === "expired" ? "text-red-400" : "text-yellow-300"}`}>
                  {engineer.certStatus === "expired" ? "Certification expired" : `${engineer.certExpiring} certification${engineer.certExpiring > 1 ? "s" : ""} expiring soon`}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">Book renewal to maintain assignment readiness.</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-auto flex flex-col gap-2 border-t border-gray-800 pt-4">
            <Button className="w-full bg-blue-600 text-white hover:bg-blue-500">
              <Zap className="h-4 w-4" />Assign to Opportunity
            </Button>
            <Button variant="outline" className="w-full border-[#ffffff20] bg-[#ffffff1a] text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
              <GraduationCap className="h-4 w-4" />Book Training / Certification
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export const ContractorEngineersSection = (): JSX.Element => {
  const [search,     setSearch]     = useState("");
  const [discipline, setDiscipline] = useState("All Disciplines");
  const [statusFilter, setStatus]   = useState("All Statuses");
  const [selected,   setSelected]   = useState<Engineer | null>(null);

  const filtered = engineers.filter((e) => {
    const matchSearch = search === "" || e.name.toLowerCase().includes(search.toLowerCase()) || e.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));
    const matchDisc   = discipline === "All Disciplines" || e.discipline === discipline;
    const matchStatus = statusFilter === "All Statuses"  || e.status === statusFilter;
    return matchSearch && matchDisc && matchStatus;
  });

  const kpis = [
    { label: "Total Engineers",    value: String(engineers.length),                                                           valueClass: "text-slate-50",    icon: Users         },
    { label: "Available Today",    value: String(engineers.filter((e) => e.status === "Available").length),                   valueClass: "text-emerald-400", icon: CheckCircle2  },
    { label: "On Assignment",      value: String(engineers.filter((e) => e.status === "On Assignment").length),               valueClass: "text-blue-400",    icon: Zap           },
    { label: "Cert Issues",        value: String(engineers.filter((e) => e.certStatus !== "valid").length),                   valueClass: "text-orange-400",  icon: AlertTriangle },
  ];

  return (
    <>
      {selected && <EngineerDrawer engineer={selected} onClose={() => setSelected(null)} />}

      <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

        {/* Header */}
        <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
          <div>
            <p className="text-xs font-medium text-slate-500">Contractor Portal</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">Engineers</h1>
            <p className="mt-1 text-sm text-slate-400">Manage your contractor workforce, capability coverage and assignment readiness.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <SyncIndicator source="Vorta" confidence={92} syncedAt={new Date(Date.now() - 90000)} />
            <Button className="bg-blue-600 text-white hover:bg-blue-500">
              <Plus className="h-4 w-4" />Add Engineer
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name or skill…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-[#0b0e14] p-1">
            <Filter className="ml-2 h-3.5 w-3.5 text-slate-500" />
            {disciplines.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDiscipline(d)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${discipline === d ? "bg-[#1a2030] text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
              >
                {d === "All Disciplines" ? "All" : d}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-[#0b0e14] p-1">
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? "bg-[#1a2030] text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
              >
                {s === "All Statuses" ? "All" : s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No engineers found"
                description="No engineers match the current filters. Try adjusting your search."
                action={{ label: "Clear filters", onClick: () => { setSearch(""); setDiscipline("All Disciplines"); setStatus("All Statuses"); } }}
              />
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-[#0f1318]">
                      {["Engineer", "Discipline", "Location", "Status", "Skills", "Competency", "Utilisation", "Certs", ""].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e, idx) => (
                      <tr
                        key={e.id}
                        onClick={() => setSelected(e)}
                        className={`cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}
                      >
                        {/* Name */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-[10px] font-bold text-blue-300">
                              {e.initials}
                            </div>
                            <span className="font-medium text-slate-100">{e.name}</span>
                          </div>
                        </td>

                        {/* Discipline */}
                        <td className="px-4 py-2.5 text-slate-400">{e.discipline}</td>

                        {/* Location */}
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1 text-slate-400">
                            <MapPin className="h-3 w-3 text-slate-600" />{e.location}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-2.5">
                          <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadge[e.status]}`}>
                            {e.status}
                          </Badge>
                        </td>

                        {/* Skills */}
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {e.skills.slice(0, 2).map((s) => (
                              <span key={s} className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">{s}</span>
                            ))}
                            {e.skills.length > 2 && (
                              <span className="rounded bg-[#ffffff0a] px-1.5 py-0.5 text-[10px] text-slate-500">+{e.skills.length - 2}</span>
                            )}
                          </div>
                        </td>

                        {/* Competency */}
                        <td className="px-4 py-2.5">
                          <div className="flex min-w-[80px] flex-col gap-1">
                            <span className={`text-xs font-semibold tabular-nums ${scoreColor(e.competency)}`}>{e.competency}%</span>
                            <Progress value={e.competency} className={`h-1.5 overflow-hidden rounded bg-gray-800 ${e.competency >= 85 ? "[&>div]:bg-emerald-500" : e.competency >= 70 ? "[&>div]:bg-yellow-400" : "[&>div]:bg-orange-400"}`} />
                          </div>
                        </td>

                        {/* Utilisation */}
                        <td className="px-4 py-2.5">
                          {e.utilisation > 0 ? (
                            <div className="flex min-w-[64px] flex-col gap-1">
                              <span className="text-xs tabular-nums text-slate-400">{e.utilisation}%</span>
                              <Progress value={e.utilisation} className={`h-1.5 overflow-hidden rounded bg-gray-800 ${utilColor(e.utilisation)}`} />
                            </div>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </td>

                        {/* Certs */}
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col gap-1">
                            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${certBadge[e.certStatus]}`}>
                              {certLabel[e.certStatus]}
                            </Badge>
                            <span className="text-[10px] text-slate-600">{e.certCount} certs</span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={(ev) => { ev.stopPropagation(); setSelected(e); }}
                            className="rounded-lg border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coverage heatmap by discipline */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-4">
              <Award className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Discipline Coverage</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { disc: "Electrical",      count: 3, target: 4, color: "bg-yellow-400" },
                { disc: "Mechanical",      count: 3, target: 3, color: "bg-emerald-500" },
                { disc: "Controls",        count: 1, target: 2, color: "bg-yellow-400" },
                { disc: "HVAC",            count: 1, target: 2, color: "bg-orange-400" },
                { disc: "Instrumentation", count: 1, target: 2, color: "bg-yellow-400" },
              ].map(({ disc, count, target, color }) => (
                <div key={disc} className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-[#0f1318] p-3">
                  <p className="text-[11px] font-medium text-slate-400">{disc}</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-100">{count}<span className="text-xs font-normal text-slate-600">/{target}</span></p>
                  <Progress value={(count / target) * 100} className={`h-1.5 overflow-hidden rounded bg-gray-800 [&>div]:${color}`} />
                  <p className="text-[10px] text-slate-600">{count >= target ? "Target met" : `${target - count} needed`}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI recommendations */}
        <AiActionsPanel actions={aiActions} />

      </section>
    </>
  );
};
