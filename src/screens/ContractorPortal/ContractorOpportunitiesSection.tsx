import { useState } from "react";
import {
  AlertTriangle,
  Brain,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { SyncIndicator } from "../../components/SyncIndicator";
import { ExplainWithAi } from "../../components/ExplainWithAi";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority   = "urgent" | "high" | "medium" | "low";
type OppStatus  = "New Match" | "Reviewing" | "Engineer Allocated" | "Response Sent" | "Accepted" | "Declined";

interface Opportunity {
  id: number;
  title: string;
  customer: string;
  location: string;
  discipline: string;
  skills: string[];
  matchScore: number;
  priority: Priority;
  durationDays: number;
  startDate: string;
  recommendedEngineer: string;
  recommendedInitials: string;
  engineerAvailability: string;
  engineerCertOk: boolean;
  engineerUtilisation: number;
  matchExplanation: string;
  status: OppStatus;
}

interface ShortlistEngineer {
  name: string;
  initials: string;
  discipline: string;
  availability: string;
  matchScore: number;
  skills: string[];
  certOk: boolean;
  utilisation: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const opportunities: Opportunity[] = [
  {
    id: 1,
    title: "Krones Filling Line 3 — Preventative Maintenance",
    customer: "Britvic PLC",
    location: "Hemel Hempstead",
    discipline: "Mechanical",
    skills: ["Krones", "Hydraulics", "Filling Lines"],
    matchScore: 94,
    priority: "urgent",
    durationDays: 5,
    startDate: "30 Jun",
    recommendedEngineer: "James Patel",
    recommendedInitials: "JP",
    engineerAvailability: "07 Jul",
    engineerCertOk: true,
    engineerUtilisation: 85,
    matchExplanation: "James holds 3 of 3 required skills and has completed 4 prior Krones jobs. Becomes available 07 Jul.",
    status: "New Match",
  },
  {
    id: 2,
    title: "Siemens S7 PLC Upgrade — Lager Line",
    customer: "Heineken UK",
    location: "Manchester",
    discipline: "Controls",
    skills: ["Siemens S7", "HMI", "Allen Bradley"],
    matchScore: 82,
    priority: "high",
    durationDays: 3,
    startDate: "01 Jul",
    recommendedEngineer: "Kate Wilson",
    recommendedInitials: "KW",
    engineerAvailability: "Today",
    engineerCertOk: false,
    engineerUtilisation: 0,
    matchExplanation: "Kate matches 2 of 3 skills and is available immediately, but her 18th Edition cert expires 10 Jul — within range of this engagement.",
    status: "Reviewing",
  },
  {
    id: 3,
    title: "ABB Robot Cell Calibration",
    customer: "Unilever — Port Sunlight",
    location: "Wirral",
    discipline: "Electrical",
    skills: ["Robotics", "ABB", "PLC"],
    matchScore: 91,
    priority: "high",
    durationDays: 2,
    startDate: "03 Jul",
    recommendedEngineer: "Raj Kumar",
    recommendedInitials: "RK",
    engineerAvailability: "10 Jul",
    engineerCertOk: true,
    engineerUtilisation: 100,
    matchExplanation: "Raj is a near-perfect match with prior ABB experience. Currently 100% utilised — schedule after 10 Jul.",
    status: "Engineer Allocated",
  },
  {
    id: 4,
    title: "HVAC Annual Compliance Inspection",
    customer: "Diageo — Leven Distillery",
    location: "Fife, Scotland",
    discipline: "HVAC",
    skills: ["F-Gas", "Refrigeration", "HVAC"],
    matchScore: 0,
    priority: "urgent",
    durationDays: 1,
    startDate: "29 Jun",
    recommendedEngineer: "Dan Hurst",
    recommendedInitials: "DH",
    engineerAvailability: "TBC",
    engineerCertOk: false,
    engineerUtilisation: 0,
    matchExplanation: "Dan is the only HVAC engineer but his F-Gas cert is expired. This opportunity is blocked until cert is renewed.",
    status: "Reviewing",
  },
  {
    id: 5,
    title: "Instrumentation Survey — Distillery Process",
    customer: "William Grant & Sons",
    location: "Girvan, Scotland",
    discipline: "Instrumentation",
    skills: ["ATEX", "Calibration", "Flow Meters"],
    matchScore: 89,
    priority: "medium",
    durationDays: 4,
    startDate: "03 Jul",
    recommendedEngineer: "Amy Clarke",
    recommendedInitials: "AC",
    engineerAvailability: "Tomorrow",
    engineerCertOk: true,
    engineerUtilisation: 0,
    matchExplanation: "Amy matches all 3 required skills with full ATEX qualification and is on-call / available from tomorrow.",
    status: "New Match",
  },
  {
    id: 6,
    title: "Electrical Installation — New EV Charging Bay",
    customer: "Coca-Cola Europacific",
    location: "East Kilbride",
    discipline: "Electrical",
    skills: ["18th Edition", "EV", "HV Systems"],
    matchScore: 76,
    priority: "low",
    durationDays: 3,
    startDate: "07 Jul",
    recommendedEngineer: "Sarah Chen",
    recommendedInitials: "SC",
    engineerAvailability: "Today",
    engineerCertOk: true,
    engineerUtilisation: 0,
    matchExplanation: "Sarah holds 18th Edition and EV qualifications and is available immediately. HV Systems is a stretch — confirm competency.",
    status: "Response Sent",
  },
];

const shortlist: ShortlistEngineer[] = [
  { name: "James Patel",  initials: "JP", discipline: "Mechanical",     availability: "07 Jul",   matchScore: 94, skills: ["Krones", "Hydraulics"],   certOk: true,  utilisation: 85 },
  { name: "Sarah Chen",   initials: "SC", discipline: "Electrical",     availability: "Today",    matchScore: 71, skills: ["18th Edition", "PLC"],    certOk: true,  utilisation: 0  },
  { name: "Priya Nair",   initials: "PN", discipline: "Mechanical",     availability: "14 Jul",   matchScore: 58, skills: ["Krones", "CIP"],          certOk: true,  utilisation: 0  },
];

const aiActions: AiAction[] = [
  { label: "Assign Amy Clarke to Instrumentation Survey",   description: "Amy is an exact 3/3 skill match, fully compliant and available from tomorrow. Highest readiness in pool for this opportunity.", priority: "critical", icon: Zap          },
  { label: "HVAC inspection blocked — renew Dan's F-Gas",   description: "The Diageo HVAC opportunity is urgent but Dan's cert is expired. Renew this week or the opportunity will be lost.",              priority: "critical", icon: AlertTriangle },
  { label: "Prioritise Raj Kumar for ABB Robot job",         description: "Raj is a 91% match. Schedule him for the ABB calibration after 10 Jul before a competing contractor fills the slot.",            priority: "high",    icon: Star         },
  { label: "Review Kate Wilson cert before PLC upgrade",    description: "Kate's cert expires during the Heineken engagement. Confirm with customer or book renewal before allocating.",                    priority: "high",    icon: ShieldCheck  },
];

// ─── Config maps (exhaustive — avoids undefined crashes) ─────────────────────

const priorityConfig: Record<Priority, { badge: string; label: string }> = {
  urgent: { badge: "bg-[#ef444420] text-red-400",    label: "Urgent" },
  high:   { badge: "bg-[#f9731620] text-orange-400", label: "High"   },
  medium: { badge: "bg-[#facc1520] text-yellow-400", label: "Medium" },
  low:    { badge: "bg-[#ffffff0f] text-slate-400",  label: "Low"    },
};

const statusConfig: Record<OppStatus, { badge: string }> = {
  "New Match":          { badge: "bg-[#3b82f620] text-blue-400"    },
  "Reviewing":          { badge: "bg-[#facc1520] text-yellow-400"  },
  "Engineer Allocated": { badge: "bg-[#10b98120] text-emerald-400" },
  "Response Sent":      { badge: "bg-[#3b82f620] text-blue-300"    },
  "Accepted":           { badge: "bg-[#10b98120] text-emerald-400" },
  "Declined":           { badge: "bg-[#ef444420] text-red-400"     },
};

const scoreColor = (s: number): string => {
  if (s >= 85) return "text-emerald-400";
  if (s >= 65) return "text-yellow-400";
  if (s > 0)   return "text-orange-400";
  return "text-red-400";
};

const scoreBg = (s: number): string => {
  if (s >= 85) return "bg-emerald-500";
  if (s >= 65) return "bg-yellow-400";
  if (s > 0)   return "bg-orange-400";
  return "bg-red-500";
};

const DISCIPLINES = ["All", "Mechanical", "Electrical", "Controls", "HVAC", "Instrumentation"];
const PRIORITIES: Array<"All" | Priority> = ["All", "urgent", "high", "medium", "low"];
const STATUSES: Array<"All" | OppStatus> = ["All", "New Match", "Reviewing", "Engineer Allocated", "Response Sent", "Accepted", "Declined"];

// ─── Workflow steps ───────────────────────────────────────────────────────────

const WORKFLOW: OppStatus[] = ["New Match", "Reviewing", "Engineer Allocated", "Response Sent", "Accepted"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-16 overflow-hidden rounded bg-gray-800">
        <div
          className={`absolute left-0 top-0 h-full rounded ${scoreBg(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${scoreColor(score)}`}>
        {score > 0 ? `${score}%` : "—"}
      </span>
    </div>
  );
}

function WorkflowBar({ current }: { current: OppStatus }) {
  const idx = WORKFLOW.indexOf(current);
  return (
    <div className="flex items-center gap-0.5">
      {WORKFLOW.map((step, i) => {
        const done    = i < idx;
        const active  = i === idx;
        return (
          <div key={step} className="flex items-center gap-0.5">
            <div className={`flex h-6 items-center rounded px-2 text-[10px] font-medium transition-colors ${
              done   ? "bg-[#10b98120] text-emerald-400" :
              active ? "bg-blue-500/20 text-blue-300"    :
                       "bg-[#ffffff08] text-slate-600"
            }`}>
              {done && <CheckCircle2 className="mr-1 h-3 w-3" />}
              {step}
            </div>
            {i < WORKFLOW.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-700" />}
          </div>
        );
      })}
    </div>
  );
}

function DetailPanel({ opp }: { opp: Opportunity }) {
  const pCfg = priorityConfig[opp.priority];
  const sCfg = statusConfig[opp.status];
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start gap-2 border-b border-gray-800 pb-4">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-slate-200">Recommended Match</p>
            <p className="text-[11px] text-slate-500">AI-selected best fit for this opportunity</p>
          </div>
        </div>

        {/* Opportunity summary */}
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-100">{opp.title}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{opp.customer}</span>
            <span className="text-slate-700">·</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-600" />{opp.location}</span>
            <span className="text-slate-700">·</span>
            <span>{opp.durationDays}d from {opp.startDate}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {opp.skills.map((s) => (
              <span key={s} className="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">{s}</span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${pCfg.badge}`}>{pCfg.label}</Badge>
            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${sCfg.badge}`}>{opp.status}</Badge>
          </div>
        </div>

        {/* Recommended engineer */}
        <div className="mb-4 rounded-lg border border-gray-800 bg-[#0f1318] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recommended Engineer</p>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-xs font-bold text-blue-300">
              {opp.recommendedInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100">{opp.recommendedEngineer}</p>
              <p className="text-[11px] text-slate-500">{opp.discipline} · {opp.engineerAvailability === "Today" ? "Available now" : `Free from ${opp.engineerAvailability}`}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <ScoreBar score={opp.matchScore} />
              {opp.engineerCertOk
                ? <span className="text-[10px] text-emerald-400">Certs OK</span>
                : <span className="text-[10px] text-red-400">Cert issue</span>}
            </div>
          </div>
        </div>

        {/* Match explanation */}
        <div className="mb-4 rounded-lg border border-blue-500/10 bg-blue-500/5 p-3">
          <div className="flex items-start gap-2">
            <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
            <p className="text-[11px] leading-relaxed text-slate-300">{opp.matchExplanation}</p>
          </div>
        </div>

        {/* Workflow */}
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Progress</p>
          <div className="overflow-x-auto pb-1">
            <WorkflowBar current={opp.status} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-gray-800 pt-4">
          <Button className="w-full bg-blue-600 text-white hover:bg-blue-500">
            <Zap className="h-4 w-4" />Allocate Engineer
          </Button>
          <Button variant="outline" className="w-full border-[#ffffff20] bg-[#ffffff0a] text-slate-200 hover:bg-[#ffffff18] hover:text-slate-50">
            <CheckCircle2 className="h-4 w-4" />Send Response
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export const ContractorOpportunitiesSection = (): JSX.Element => {
  const [search,     setSearch]     = useState("");
  const [discipline, setDiscipline] = useState("All");
  const [priority,   setPriority]   = useState<"All" | Priority>("All");
  const [selected,   setSelected]   = useState<Opportunity>(opportunities[0]);

  const filtered = opportunities.filter((o) => {
    const q   = search.toLowerCase();
    const mQ  = q === "" || o.title.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.skills.some((s) => s.toLowerCase().includes(q));
    const mD  = discipline === "All" || o.discipline === discipline;
    const mP  = priority   === "All" || o.priority === priority;
    return mQ && mD && mP;
  });

  const kpis = [
    { label: "Open Opportunities", value: String(opportunities.filter((o) => o.status !== "Accepted" && o.status !== "Declined").length), valueClass: "text-slate-50",    icon: Briefcase    },
    { label: "High Match (≥80%)",  value: String(opportunities.filter((o) => o.matchScore >= 80).length),                                 valueClass: "text-emerald-400", icon: Star         },
    { label: "Ready to Assign",    value: String(opportunities.filter((o) => o.matchScore >= 80 && o.engineerCertOk).length),             valueClass: "text-blue-400",    icon: CheckCircle2 },
    { label: "Response Required",  value: String(opportunities.filter((o) => o.priority === "urgent" || o.priority === "high").length),   valueClass: "text-orange-400",  icon: Clock        },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 px-4 pb-16 pt-0 md:px-6 xl:px-8">

      {/* Header */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-medium text-slate-500">Contractor Portal</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Opportunities</h1>
          <p className="mt-1 text-sm text-slate-400">Review matched customer requirements and allocate the best available engineer.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <SyncIndicator source="Vorta" confidence={96} syncedAt={new Date(Date.now() - 45000)} />
          <ExplainWithAi pageId="contractor-opportunities" />
          <Button className="bg-blue-600 text-white hover:bg-blue-500">
            <Sparkles className="h-4 w-4" />Review New Matches
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
            placeholder="Search opportunities, customers, skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-[#0b0e14] p-1">
          <Filter className="ml-1.5 h-3.5 w-3.5 text-slate-500" />
          {DISCIPLINES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDiscipline(d)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${discipline === d ? "bg-[#1a2030] text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-[#0b0e14] p-1">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${priority === p ? "bg-[#1a2030] text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Main content: table + detail */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">

        {/* Opportunities table */}
        <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0f1318]">
                    {["Opportunity", "Discipline", "Match", "Priority", "Start", "Engineer", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                        No opportunities match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((opp, idx) => {
                      const isSelected = selected.id === opp.id;
                      const pCfg = priorityConfig[opp.priority];
                      const sCfg = statusConfig[opp.status];
                      return (
                        <tr
                          key={opp.id}
                          onClick={() => setSelected(opp)}
                          className={`cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${
                            isSelected ? "bg-[#1a2030] ring-1 ring-inset ring-blue-500/20" :
                            idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <p className="max-w-[220px] truncate font-medium text-slate-100">{opp.title}</p>
                            <p className="text-[10px] text-slate-500">{opp.customer}</p>
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600">
                              <MapPin className="h-2.5 w-2.5" />{opp.location}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-slate-400">{opp.discipline}</td>
                          <td className="px-4 py-2.5">
                            <ScoreBar score={opp.matchScore} />
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${pCfg.badge}`}>
                              {pCfg.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-slate-400">{opp.startDate}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-500/20 text-[9px] font-bold text-blue-300">
                                {opp.recommendedInitials}
                              </div>
                              <span className="text-xs text-slate-300">{opp.recommendedEngineer.split(" ")[0]}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${sCfg.badge}`}>
                              {opp.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={(ev) => { ev.stopPropagation(); setSelected(opp); }}
                              className="rounded-lg border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200"
                            >
                              Review
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
        <DetailPanel opp={selected} />
      </div>

      {/* Engineer shortlist */}
      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Engineer Shortlist</span>
              <span className="text-[11px] text-slate-500">for {selected.title.split("—")[0].trim()}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-[#0f1318]">
                  {["Engineer", "Discipline", "Availability", "Match", "Key Skills", "Certs", "Utilisation"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shortlist.map((e, idx) => (
                  <tr key={e.name} className={`border-b border-gray-800/50 ${idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]"}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-[10px] font-bold text-blue-300">
                          {e.initials}
                        </div>
                        <span className="font-medium text-slate-100">{e.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">{e.discipline}</td>
                    <td className="px-4 py-2.5">
                      <span className={e.availability === "Today" ? "text-emerald-400 text-xs" : "text-slate-400 text-xs"}>{e.availability}</span>
                    </td>
                    <td className="px-4 py-2.5"><ScoreBar score={e.matchScore} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {e.skills.map((s) => (
                          <span key={s} className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {e.certOk
                        ? <span className="text-[10px] font-medium text-emerald-400">OK</span>
                        : <span className="text-[10px] font-medium text-red-400">Issue</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="relative h-1.5 w-14 overflow-hidden rounded bg-gray-800">
                          <div
                            className={`absolute left-0 top-0 h-full rounded ${e.utilisation >= 80 ? "bg-blue-500" : "bg-emerald-500"}`}
                            style={{ width: `${e.utilisation}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-slate-400">{e.utilisation}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI recommendations */}
      <AiActionsPanel actions={aiActions} />

    </section>
  );
};
