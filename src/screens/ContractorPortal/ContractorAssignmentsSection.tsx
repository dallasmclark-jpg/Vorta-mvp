import { useState } from "react";
import {
  AlertTriangle,
  Brain,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  MapPin,
  Search,
  ShieldCheck,
  UserCheck,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { SyncIndicator } from "../../components/SyncIndicator";
import { ExplainWithAi } from "../../components/ExplainWithAi";

// ─── Types ────────────────────────────────────────────────────────────────────

type AssignStatus = "In Progress" | "Starting Soon" | "Awaiting Report" | "Complete" | "At Risk" | "On Hold";
type RiskLevel    = "low" | "medium" | "high" | "critical";
type ReportStatus = "Submitted" | "Due Soon" | "Overdue" | "Not Required";

interface Assignment {
  id: number;
  title: string;
  customer: string;
  location: string;
  engineer: string;
  engineerInitials: string;
  discipline: string;
  startDate: string;
  endDate: string;
  status: AssignStatus;
  progress: number;
  risk: RiskLevel;
  reportStatus: ReportStatus;
  timesheetOk: boolean;
  certOk: boolean;
  siteContact: string;
  skills: string[];
  nextMilestone: string;
}

interface Risk {
  severity: "critical" | "high" | "medium";
  assignment: string;
  description: string;
}

type TimelineStep = "Requested" | "Matched" | "Engineer Allocated" | "Site Confirmed" | "In Progress" | "Report Due" | "Complete";

// ─── Mock data ────────────────────────────────────────────────────────────────

const assignments: Assignment[] = [
  {
    id: 1,
    title: "Krones Filling Line 3 — Preventative Maintenance",
    customer: "Britvic PLC",
    location: "Hemel Hempstead",
    engineer: "James Patel",
    engineerInitials: "JP",
    discipline: "Mechanical",
    startDate: "07 Jul",
    endDate: "11 Jul",
    status: "Starting Soon",
    progress: 0,
    risk: "low",
    reportStatus: "Not Required",
    timesheetOk: true,
    certOk: true,
    siteContact: "Helen Ward",
    skills: ["Krones", "Hydraulics", "Filling Lines"],
    nextMilestone: "Engineer briefing 05 Jul",
  },
  {
    id: 2,
    title: "Siemens S7 PLC Upgrade — Lager Line",
    customer: "Heineken UK",
    location: "Manchester",
    engineer: "Tom Briggs",
    engineerInitials: "TB",
    discipline: "Controls",
    startDate: "23 Jun",
    endDate: "05 Jul",
    status: "In Progress",
    progress: 62,
    risk: "medium",
    reportStatus: "Due Soon",
    timesheetOk: true,
    certOk: true,
    siteContact: "Mark Owens",
    skills: ["Siemens S7", "HMI", "PLC"],
    nextMilestone: "UAT sign-off 03 Jul",
  },
  {
    id: 3,
    title: "ABB Robot Cell Calibration",
    customer: "Unilever — Port Sunlight",
    location: "Wirral",
    engineer: "Raj Kumar",
    engineerInitials: "RK",
    discipline: "Electrical",
    startDate: "16 Jun",
    endDate: "27 Jun",
    status: "Awaiting Report",
    progress: 100,
    risk: "medium",
    reportStatus: "Overdue",
    timesheetOk: false,
    certOk: true,
    siteContact: "Donna Price",
    skills: ["Robotics", "ABB", "PLC"],
    nextMilestone: "Submit job report",
  },
  {
    id: 4,
    title: "Instrumentation Survey — Distillery Process",
    customer: "William Grant & Sons",
    location: "Girvan, Scotland",
    engineer: "Amy Clarke",
    engineerInitials: "AC",
    discipline: "Instrumentation",
    startDate: "03 Jul",
    endDate: "07 Jul",
    status: "Starting Soon",
    progress: 0,
    risk: "low",
    reportStatus: "Not Required",
    timesheetOk: true,
    certOk: true,
    siteContact: "Fergus McAllister",
    skills: ["ATEX", "Calibration", "Flow Meters"],
    nextMilestone: "Travel depart 02 Jul",
  },
  {
    id: 5,
    title: "Electrical Installation — EV Charging Bay",
    customer: "Coca-Cola Europacific",
    location: "East Kilbride",
    engineer: "Sarah Chen",
    engineerInitials: "SC",
    discipline: "Electrical",
    startDate: "07 Jul",
    endDate: "09 Jul",
    status: "Starting Soon",
    progress: 0,
    risk: "low",
    reportStatus: "Not Required",
    timesheetOk: true,
    certOk: true,
    siteContact: "Paul Hughes",
    skills: ["18th Edition", "EV"],
    nextMilestone: "Site induction 07 Jul",
  },
  {
    id: 6,
    title: "CIP System Overhaul — Dairy Processing",
    customer: "Müller UK",
    location: "Market Drayton",
    engineer: "Lisa Tong",
    engineerInitials: "LT",
    discipline: "Mechanical",
    startDate: "02 Jul",
    endDate: "08 Jul",
    status: "At Risk",
    progress: 0,
    risk: "high",
    reportStatus: "Not Required",
    timesheetOk: true,
    certOk: false,
    siteContact: "Claire Bennett",
    skills: ["CIP", "Pumps", "Welding"],
    nextMilestone: "Cert renewal before start",
  },
];

const risks: Risk[] = [
  { severity: "critical", assignment: "ABB Robot Cell Calibration",      description: "Job report 2 days overdue. Timesheet also missing. Invoicing is blocked until both are submitted." },
  { severity: "high",     assignment: "CIP System Overhaul — Müller",    description: "Lisa Tong's 2 certifications expire before assignment start on 02 Jul. Renewal is not yet booked." },
  { severity: "medium",   assignment: "Siemens S7 PLC Upgrade",          description: "Job report due in 2 days. UAT sign-off still pending from customer — risk of overrun." },
];

const aiActions: AiAction[] = [
  { label: "Chase Raj Kumar's overdue report",            description: "ABB calibration report is 2 days overdue. Invoicing is blocked — send automated reminder now.", priority: "critical", icon: FileText   },
  { label: "Book Lisa Tong cert renewal before 02 Jul",   description: "Lisa has 2 certs expiring before the Müller start date. If not renewed, assignment must be reallocated.", priority: "critical", icon: ShieldCheck },
  { label: "Prepare backup for Müller CIP overhaul",      description: "Priya Nair returns 14 Jul — if Lisa's certs aren't renewed in time, Priya is the closest match.",        priority: "high",    icon: UserCheck  },
  { label: "Confirm UAT sign-off for Heineken PLC job",   description: "UAT sign-off from Mark Owens is blocking completion. Escalate to contractor account manager today.",       priority: "high",    icon: Brain      },
];

// ─── Config maps (exhaustive — every key present, no undefined crashes) ───────

const statusConfig: Record<AssignStatus, { badge: string }> = {
  "In Progress":      { badge: "bg-[#3b82f620] text-blue-400"    },
  "Starting Soon":    { badge: "bg-[#facc1520] text-yellow-400"  },
  "Awaiting Report":  { badge: "bg-[#f9731620] text-orange-400"  },
  "Complete":         { badge: "bg-[#10b98120] text-emerald-400" },
  "At Risk":          { badge: "bg-[#ef444420] text-red-400"     },
  "On Hold":          { badge: "bg-[#ffffff0f] text-slate-400"   },
};

const riskConfig: Record<RiskLevel, { badge: string; dot: string }> = {
  low:      { badge: "bg-[#10b98120] text-emerald-400", dot: "bg-emerald-500" },
  medium:   { badge: "bg-[#facc1520] text-yellow-400",  dot: "bg-yellow-400"  },
  high:     { badge: "bg-[#f9731620] text-orange-400",  dot: "bg-orange-400"  },
  critical: { badge: "bg-[#ef444420] text-red-400",     dot: "bg-red-500"     },
};

const reportConfig: Record<ReportStatus, { cls: string }> = {
  "Submitted":     { cls: "text-emerald-400" },
  "Due Soon":      { cls: "text-yellow-400"  },
  "Overdue":       { cls: "text-red-400"     },
  "Not Required":  { cls: "text-slate-500"   },
};

const conflictSeverityCls: Record<Risk["severity"], { card: string; icon: string; label: string }> = {
  critical: { card: "border-red-500/20 bg-[#ef444408]",   icon: "text-red-400",    label: "Critical" },
  high:     { card: "border-orange-400/20 bg-[#f9731608]", icon: "text-orange-400", label: "High"     },
  medium:   { card: "border-yellow-400/20 bg-[#facc1508]", icon: "text-yellow-400", label: "Medium"   },
};

const progressBarCls = (p: number): string => {
  if (p === 100) return "bg-emerald-500";
  if (p >= 60)   return "bg-blue-500";
  if (p >= 30)   return "bg-yellow-400";
  return "bg-orange-400";
};

const TIMELINE_STEPS: TimelineStep[] = [
  "Requested", "Matched", "Engineer Allocated", "Site Confirmed", "In Progress", "Report Due", "Complete",
];

const STATUS_TIMELINE_IDX: Record<AssignStatus, number> = {
  "On Hold":         0,
  "Starting Soon":   3,
  "In Progress":     4,
  "Awaiting Report": 5,
  "At Risk":         4,
  "Complete":        6,
};

const ALL_STATUSES: Array<"All" | AssignStatus> = ["All", "In Progress", "Starting Soon", "Awaiting Report", "At Risk", "Complete", "On Hold"];
const ALL_RISKS:    Array<"All" | RiskLevel>     = ["All", "low", "medium", "high", "critical"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-16 overflow-hidden rounded bg-gray-800">
        <div
          className={`absolute left-0 top-0 h-full rounded ${progressBarCls(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-400">{value}%</span>
    </div>
  );
}

function Timeline({ status }: { status: AssignStatus }) {
  const activeIdx = STATUS_TIMELINE_IDX[status] ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {TIMELINE_STEPS.map((step, i) => {
        const done   = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={step} className="flex items-center gap-0.5">
            <div className={`flex h-6 items-center rounded px-2 text-[10px] font-medium ${
              done   ? "bg-[#10b98120] text-emerald-400" :
              active ? "bg-blue-500/20 text-blue-300"    :
                       "bg-[#ffffff08] text-slate-600"
            }`}>
              {done && <CheckCircle2 className="mr-1 h-3 w-3" />}
              {step}
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3 shrink-0 text-slate-700" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetailPanel({ a }: { a: Assignment }) {
  const sCfg = statusConfig[a.status];
  const rCfg = riskConfig[a.risk];
  const rpCfg = reportConfig[a.reportStatus];
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start gap-2 border-b border-gray-800 pb-4">
          <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-slate-200">Assignment Detail</p>
            <p className="text-[11px] text-slate-500">Active assignment overview</p>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-100">{a.title}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{a.customer}</span>
            <span className="text-slate-700">·</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-600" />{a.location}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {a.skills.map((s) => (
              <span key={s} className="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">{s}</span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${sCfg.badge}`}>{a.status}</Badge>
            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${rCfg.badge}`}>{a.risk} risk</Badge>
          </div>
        </div>

        {/* Engineer */}
        <div className="mb-4 rounded-lg border border-gray-800 bg-[#0f1318] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Assigned Engineer</p>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-xs font-bold text-blue-300">
              {a.engineerInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100">{a.engineer}</p>
              <p className="text-[11px] text-slate-500">{a.discipline} · Site contact: {a.siteContact}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {a.certOk
                ? <span className="text-[10px] text-emerald-400">Certs OK</span>
                : <span className="text-[10px] text-red-400">Cert issue</span>}
            </div>
          </div>
        </div>

        {/* Progress & dates */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-800 bg-[#0f1318] p-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Progress</p>
            <ProgressBar value={a.progress} />
          </div>
          <div className="rounded-lg border border-gray-800 bg-[#0f1318] p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Dates</p>
            <p className="text-xs text-slate-300">{a.startDate} – {a.endDate}</p>
          </div>
        </div>

        {/* Status items */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex items-center justify-between py-1.5 border-b border-gray-800/60">
            <span className="text-xs text-slate-500">Job Report</span>
            <span className={`text-xs font-medium ${rpCfg.cls}`}>{a.reportStatus}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-gray-800/60">
            <span className="text-xs text-slate-500">Timesheet</span>
            <span className={`text-xs font-medium ${a.timesheetOk ? "text-emerald-400" : "text-red-400"}`}>
              {a.timesheetOk ? "Submitted" : "Missing"}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-slate-500">Next Milestone</span>
            <span className="text-xs font-medium text-blue-300">{a.nextMilestone}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Timeline</p>
          <div className="overflow-x-auto pb-1">
            <Timeline status={a.status} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-gray-800 pt-4">
          <Button className="w-full bg-blue-600 text-white hover:bg-blue-500">
            <FileText className="h-4 w-4" />View Job Report
          </Button>
          <Button variant="outline" className="w-full border-[#ffffff20] bg-[#ffffff0a] text-slate-200 hover:bg-[#ffffff18] hover:text-slate-50">
            <UserCheck className="h-4 w-4" />Reassign Engineer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export const ContractorAssignmentsSection = (): JSX.Element => {
  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState<"All" | AssignStatus>("All");
  const [risk,     setRisk]     = useState<"All" | RiskLevel>("All");
  const [selected, setSelected] = useState<Assignment>(assignments[0]);

  const filtered = assignments.filter((a) => {
    const q  = search.toLowerCase();
    const mQ = q === "" || a.title.toLowerCase().includes(q) || a.customer.toLowerCase().includes(q) || a.engineer.toLowerCase().includes(q);
    const mS = status === "All" || a.status === status;
    const mR = risk   === "All" || a.risk   === risk;
    return mQ && mS && mR;
  });

  const kpis = [
    { label: "Active Assignments",  value: String(assignments.filter((a) => a.status === "In Progress").length),                          valueClass: "text-blue-400",    icon: Briefcase   },
    { label: "Starting This Week",  value: String(assignments.filter((a) => a.status === "Starting Soon").length),                        valueClass: "text-yellow-400",  icon: Clock       },
    { label: "Awaiting Reports",    value: String(assignments.filter((a) => a.status === "Awaiting Report" || a.reportStatus === "Overdue").length), valueClass: "text-orange-400",  icon: FileText    },
    { label: "At Risk",             value: String(assignments.filter((a) => a.risk === "high" || a.risk === "critical" || a.status === "At Risk").length), valueClass: "text-red-400", icon: AlertTriangle },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

      {/* Header */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-medium text-slate-500">Contractor Portal</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Assignments</h1>
          <p className="mt-1 text-sm text-slate-400">Track contractor engineer assignments, progress and site delivery status.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <SyncIndicator source="Vorta" confidence={91} syncedAt={new Date(Date.now() - 90000)} />
          <ExplainWithAi pageId="contractor-assignments" />
          <Button className="bg-blue-600 text-white hover:bg-blue-500">
            <Zap className="h-4 w-4" />Create Assignment
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
            placeholder="Search assignments, engineers, customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-[#0b0e14] p-1">
          <Filter className="ml-1.5 h-3.5 w-3.5 text-slate-500" />
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${status === s ? "bg-[#1a2030] text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-[#0b0e14] p-1">
          {ALL_RISKS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRisk(r)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${risk === r ? "bg-[#1a2030] text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Main: table + detail panel */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">

        {/* Table */}
        <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0f1318]">
                    {["Assignment", "Engineer", "Dates", "Progress", "Risk", "Report", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                        No assignments match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((a, idx) => {
                      const isSelected = selected.id === a.id;
                      const sCfg  = statusConfig[a.status];
                      const rCfg  = riskConfig[a.risk];
                      const rpCfg = reportConfig[a.reportStatus];
                      return (
                        <tr
                          key={a.id}
                          onClick={() => setSelected(a)}
                          className={`cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${
                            isSelected ? "bg-[#1a2030] ring-1 ring-inset ring-blue-500/20" :
                            idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <p className="max-w-[200px] truncate font-medium text-slate-100">{a.title}</p>
                            <p className="text-[10px] text-slate-500">{a.customer}</p>
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600">
                              <MapPin className="h-2.5 w-2.5" />{a.location}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-500/20 text-[9px] font-bold text-blue-300">
                                {a.engineerInitials}
                              </div>
                              <span className="text-xs text-slate-300">{a.engineer.split(" ")[0]}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs tabular-nums text-slate-400">
                            <span>{a.startDate}</span>
                            <span className="mx-1 text-slate-700">–</span>
                            <span>{a.endDate}</span>
                          </td>
                          <td className="px-4 py-2.5"><ProgressBar value={a.progress} /></td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${rCfg.dot}`} />
                              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none capitalize ${rCfg.badge}`}>
                                {a.risk}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${rpCfg.cls}`}>{a.reportStatus}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${sCfg.badge}`}>
                              {a.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={(ev) => { ev.stopPropagation(); setSelected(a); }}
                              className="rounded-lg border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Detail panel */}
        <DetailPanel a={selected} />
      </div>

      {/* Delivery risks */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold text-slate-200">Delivery Risks</span>
            </div>
            <Badge className="inline-flex h-auto rounded bg-[#f9731620] px-2 py-0.5 text-[10px] font-medium text-orange-400 shadow-none">
              {risks.length} issues
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {risks.map((r, i) => {
              const cfg = conflictSeverityCls[r.severity];
              return (
                <div key={i} className={`flex items-start gap-2.5 rounded-lg border p-3 ${cfg.card}`}>
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.icon}`} />
                  <div>
                    <p className={`text-xs font-semibold ${cfg.icon}`}>{cfg.label} — {r.assignment}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{r.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI recommendations */}
      <AiActionsPanel actions={aiActions} />

    </section>
  );
};
