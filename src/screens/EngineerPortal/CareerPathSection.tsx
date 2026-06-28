import { useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Shield,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { SyncIndicator } from "../../components/SyncIndicator";

// ─── Types ────────────────────────────────────────────────────────────────────

type GapStatus = "met" | "partial" | "missing";

interface RoleRequirement {
  skill: string;
  category: string;
  current_level: number | null;
  required_level: number;
  status: GapStatus;
  action: string;
}

interface TrainingItem {
  course: string;
  priority: "critical" | "high" | "medium" | "low";
  linked_skill: string;
  status: "not_started" | "in_progress" | "completed" | "booked";
  due_date: string | null;
}

interface CertItem {
  cert: string;
  status: "valid" | "expired" | "not_held" | "pending";
  required_by: string | null;
  action: string;
}

interface PathStep {
  role: string;
  readiness: number;
  state: "current" | "next" | "future" | "locked";
}

// ─── Static data ─────────────────────────────────────────────────────────────

const PATHWAY: PathStep[] = [
  { role: "Maintenance Engineer",          readiness: 100, state: "current" },
  { role: "Senior Maintenance Engineer",   readiness: 87,  state: "next"    },
  { role: "Shift Lead",                    readiness: 72,  state: "future"  },
  { role: "Maintenance Planner",           readiness: 68,  state: "future"  },
  { role: "Reliability Engineer",          readiness: 55,  state: "future"  },
  { role: "Maintenance Manager",           readiness: 41,  state: "locked"  },
];

const REQUIREMENTS: RoleRequirement[] = [
  { skill: "Allen Bradley PLC",         category: "Automation & Controls",          current_level: 4, required_level: 4, status: "met",     action: "None required"      },
  { skill: "Hydraulic Systems",         category: "Mechanical Maintenance",          current_level: 5, required_level: 4, status: "met",     action: "None required"      },
  { skill: "GMP Fundamentals",          category: "Pharmaceutical Compliance",       current_level: 4, required_level: 4, status: "met",     action: "None required"      },
  { skill: "SAP PM",                    category: "CMMS / Maintenance Systems",      current_level: 3, required_level: 4, status: "partial", action: "Attend SAP PM Advanced workshop" },
  { skill: "Electrical Safety LV",      category: "Electrical Maintenance",          current_level: 4, required_level: 4, status: "met",     action: "None required"      },
  { skill: "ATEX Zone Classification",  category: "Electrical Maintenance",          current_level: 2, required_level: 3, status: "partial", action: "Book ATEX certification course" },
  { skill: "Vibration Analysis Level I", category: "Reliability Engineering",        current_level: 3, required_level: 3, status: "partial", action: "Request manager validation" },
  { skill: "Condition Monitoring",       category: "Reliability Engineering",        current_level: null, required_level: 3, status: "missing", action: "Book CBM Level I course" },
];

const TRAINING_PLAN: TrainingItem[] = [
  { course: "ATEX Zone Classification Certification",   priority: "high",     linked_skill: "ATEX Zone Classification",  status: "not_started", due_date: "2025-09-01" },
  { course: "SAP PM Advanced Workshop",                  priority: "medium",   linked_skill: "SAP PM",                    status: "not_started", due_date: "2025-10-15" },
  { course: "Vibration Analysis Level II",               priority: "medium",   linked_skill: "Vibration Analysis",        status: "not_started", due_date: "2025-11-01" },
  { course: "CBM Level I (online, self-paced)",          priority: "low",      linked_skill: "Condition Monitoring",      status: "not_started", due_date: "2025-12-01" },
  { course: "GMP Advanced (Pharma Compliance Track)",    priority: "low",      linked_skill: "GMP Fundamentals",          status: "completed",   due_date: null         },
];

const CERT_PLAN: CertItem[] = [
  { cert: "ATEX Zone Classification",   status: "not_held", required_by: "2025-09-01", action: "Book Training"   },
  { cert: "Manual Handling Renewal",    status: "expired",  required_by: "2024-11-01", action: "Book Renewal"    },
  { cert: "Confined Space Entry",       status: "valid",    required_by: "2025-07-30", action: "Book Refresher"  },
  { cert: "SAP PM User Certification",  status: "not_held", required_by: "2025-10-15", action: "Complete Course" },
];

const AI_ACTIONS: AiAction[] = [
  { label: "Book ATEX Certification course",               description: "Critical gap for Senior role. ATEX is required for zone 1/2 work orders and lifts your readiness from 87% to 93%.",  priority: "critical", icon: Zap          },
  { label: "Attend SAP PM Advanced workshop",              description: "Current level 3 vs required 4. Improves match score and unlocks Maintenance Planner pathway.",                          priority: "high",     icon: TrendingUp   },
  { label: "Request manager validation for Vibration L1", description: "Self-rated 3/5 but unvalidated. Manager sign-off counts immediately toward Senior role readiness.",                    priority: "high",     icon: Shield       },
  { label: "Renew Manual Handling certificate",            description: "Expired. Required for compliance and blocks senior site access permissions.",                                           priority: "high",     icon: Award        },
  { label: "Apply for Senior Mechanical Engineer",         description: "87% match — strong fit. Applying now builds visibility with hiring managers and accelerates progression.",             priority: "medium",   icon: Briefcase    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RATING_LABELS: Record<number, string> = {
  5: "Competent", 4: "Proficient", 3: "Developing", 2: "Basic", 1: "Gap",
};

function ratingStyle(r: number | null): { bg: string; text: string } {
  switch (r) {
    case 5:  return { bg: "bg-emerald-500/20", text: "text-emerald-400" };
    case 4:  return { bg: "bg-blue-500/20",    text: "text-blue-400"    };
    case 3:  return { bg: "bg-yellow-400/20",  text: "text-yellow-300"  };
    case 2:  return { bg: "bg-orange-500/20",  text: "text-orange-400"  };
    case 1:  return { bg: "bg-red-500/20",     text: "text-red-400"     };
    default: return { bg: "bg-gray-800",       text: "text-slate-600"   };
  }
}

function readinessColor(r: number): string {
  if (r >= 85) return "text-emerald-400";
  if (r >= 70) return "text-blue-400";
  if (r >= 55) return "text-yellow-400";
  return "text-red-400";
}

function readinessBg(r: number): string {
  if (r >= 85) return "[&>div]:bg-emerald-500";
  if (r >= 70) return "[&>div]:bg-blue-500";
  if (r >= 55) return "[&>div]:bg-yellow-400";
  return "[&>div]:bg-red-500";
}

function gapBadge(s: GapStatus): JSX.Element {
  if (s === "met")     return <Badge className="inline-flex h-auto rounded bg-[#10b98120] px-2 py-0.5 text-[10px] font-medium text-emerald-400 shadow-none hover:bg-[#10b98120]">Met</Badge>;
  if (s === "partial") return <Badge className="inline-flex h-auto rounded bg-[#facc1520] px-2 py-0.5 text-[10px] font-medium text-yellow-400 shadow-none hover:bg-[#facc1520]">Partial</Badge>;
  return               <Badge className="inline-flex h-auto rounded bg-[#ef444420] px-2 py-0.5 text-[10px] font-medium text-red-400 shadow-none hover:bg-[#ef444420]">Missing</Badge>;
}

function priorityClass(p: TrainingItem["priority"]): string {
  switch (p) {
    case "critical": return "bg-[#ef444420] text-red-400";
    case "high":     return "bg-[#f9731620] text-orange-400";
    case "medium":   return "bg-[#facc1520] text-yellow-400";
    case "low":      return "bg-[#3b82f620] text-blue-400";
  }
}

function trainingStatusClass(s: TrainingItem["status"]): string {
  switch (s) {
    case "completed":   return "bg-[#10b98120] text-emerald-400";
    case "in_progress": return "bg-[#3b82f620] text-blue-400";
    case "booked":      return "bg-[#facc1520] text-yellow-400";
    default:            return "bg-gray-800 text-slate-500";
  }
}

function trainingStatusLabel(s: TrainingItem["status"]): string {
  if (s === "not_started") return "Not Started";
  if (s === "in_progress") return "In Progress";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function certStatusClass(s: CertItem["status"]): string {
  switch (s) {
    case "valid":    return "bg-[#10b98120] text-emerald-400";
    case "expired":  return "bg-[#ef444420] text-red-400";
    case "pending":  return "bg-[#facc1520] text-yellow-400";
    default:         return "bg-gray-800 text-slate-500";
  }
}

function certStatusLabel(s: CertItem["status"]): string {
  if (s === "not_held") return "Not Held";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function SkelLine({ w = "w-24", h = "h-3" }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} animate-pulse rounded bg-gray-800`} />;
}

function SectionCard({ title, sub, badge, children }: {
  title: string; sub?: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex min-w-0 flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
            {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
          </div>
          {badge}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CareerPathSection(): JSX.Element {
  const [loading] = useState(false);

  const gapCount     = useMemo(() => REQUIREMENTS.filter((r) => r.status !== "met").length, []);
  const trainingReq  = useMemo(() => TRAINING_PLAN.filter((t) => t.status !== "completed").length, []);
  const certReq      = useMemo(() => CERT_PLAN.filter((c) => c.status !== "valid").length, []);
  const nextRole     = PATHWAY.find((p) => p.state === "next")!;
  const currentRole  = PATHWAY.find((p) => p.state === "current")!;

  const kpis = [
    { label: "Current Role",         value: currentRole.role,          sub: "Your active position",          icon: Briefcase,  cls: "text-slate-200 text-sm leading-snug" },
    { label: "Next Suggested Role",  value: nextRole.role,             sub: "AI-recommended next step",      icon: TrendingUp, cls: "text-blue-400 text-sm leading-snug"  },
    { label: "Readiness",            value: `${nextRole.readiness}%`,  sub: "Towards next role",             icon: Sparkles,   cls: readinessColor(nextRole.readiness)    },
    { label: "Skill Gaps",           value: String(gapCount),          sub: "Skills below target",           icon: Zap,        cls: gapCount > 0 ? "text-orange-400" : "text-emerald-400" },
    { label: "Training Required",    value: String(trainingReq),       sub: "Courses to complete",           icon: GraduationCap, cls: trainingReq > 0 ? "text-yellow-400" : "text-emerald-400" },
    { label: "Certs Needed",         value: String(certReq),           sub: "For next role",                 icon: Shield,     cls: certReq > 0 ? "text-yellow-400" : "text-emerald-400" },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-5 md:px-6 xl:px-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl font-semibold text-slate-50">Career Path</h1>
          <p className="text-sm text-slate-400">Track your progression, next role readiness and development plan.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SyncIndicator />
          <ExplainWithAi pageId="engineer-career-path" />
          <Button size="sm" variant="outline"
            className="h-8 gap-1.5 border-gray-700 bg-transparent text-slate-400 hover:border-blue-500/40 hover:text-blue-400 text-xs">
            <PlusCircle className="h-3.5 w-3.5" />Update Career Goals
          </Button>
        </div>
      </header>

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map(({ label, value, sub, icon: Icon, cls }) => (
          <Card key={label} className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-medium text-slate-400">{label}</p>
                <Icon className="h-4 w-4 shrink-0 text-slate-600" />
              </div>
              <p className={`truncate font-semibold tabular-nums ${cls}`}>{value}</p>
              <p className="truncate text-[11px] text-slate-500">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Career Progress card ─────────────────────────────────────────────── */}
      <SectionCard
        title="Career Progress"
        sub={`${currentRole.role} → ${nextRole.role}`}
        badge={
          <Badge className="inline-flex h-auto items-center gap-1.5 shrink-0 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />AI Score
          </Badge>
        }
      >
        <div className="flex flex-col gap-4 rounded-xl border border-gray-800 bg-[#0f1318] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Current</p>
              <p className="text-base font-semibold text-slate-200">{currentRole.role}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className={`text-3xl font-bold tabular-nums ${readinessColor(nextRole.readiness)}`}>{nextRole.readiness}%</p>
              <p className="text-[11px] text-slate-500">Readiness</p>
            </div>
            <div className="flex flex-col items-end gap-1 min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Next Role</p>
              <p className="text-base font-semibold text-blue-400">{nextRole.role}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Progress value={nextRole.readiness} className={`h-3 rounded-full bg-gray-800 ${readinessBg(nextRole.readiness)}`} />
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{nextRole.readiness}% ready</span>
              <span>{100 - nextRole.readiness}% remaining</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-gray-800/60 pt-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-400" />
              <span className="text-[11px] text-slate-400">{gapCount} skill gaps to close</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              <span className="text-[11px] text-slate-400">{trainingReq} training courses</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span className="text-[11px] text-slate-400">{certReq} certificates needed</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── AI Actions ──────────────────────────────────────────────────────── */}
      <AiActionsPanel actions={AI_ACTIONS} />

      {/* ── Role Pathway ────────────────────────────────────────────────────── */}
      <SectionCard title="Role Pathway" sub="Full career progression from current position to Maintenance Manager">
        <div className="relative flex flex-col gap-0">
          {/* Connecting line */}
          <div className="absolute left-4 top-5 bottom-5 w-px bg-gray-800" />
          {PATHWAY.map((step, i) => {
            const isCurrent = step.state === "current";
            const isNext    = step.state === "next";
            const isLocked  = step.state === "locked";
            const dotCls    = isCurrent ? "bg-emerald-500 ring-2 ring-emerald-500/30"
              : isNext    ? "bg-blue-500 ring-2 ring-blue-500/30"
              : isLocked  ? "bg-gray-700"
              : "bg-gray-600";
            const labelCls  = isCurrent ? "text-emerald-400" : isNext ? "text-blue-400" : isLocked ? "text-slate-600" : "text-slate-400";
            const cardCls   = isCurrent ? "border-[#10b98130] bg-[#10b98108]"
              : isNext    ? "border-[#3b82f630] bg-[#3b82f608]"
              : isLocked  ? "border-gray-800/50 bg-[#0b0e1480]"
              : "border-gray-800 bg-[#0f1318]";
            return (
              <div key={step.role} className="relative flex items-start gap-4 py-2">
                <div className={`relative z-10 mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${dotCls}`}>
                  {isCurrent ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : isLocked ? (
                    <Shield className="h-3.5 w-3.5 text-gray-600" />
                  ) : (
                    <span className="text-xs font-bold text-white">{i + 1}</span>
                  )}
                </div>
                <div className={`flex flex-1 min-w-0 flex-col gap-2 rounded-xl border ${cardCls} p-4`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className={`text-xs font-semibold ${labelCls}`}>{step.role}</p>
                      {isCurrent && <Badge className="inline-flex h-auto rounded bg-[#10b98120] px-1.5 py-0.5 text-[9px] font-medium text-emerald-400 shadow-none hover:bg-[#10b98120]">Current</Badge>}
                      {isNext    && <Badge className="inline-flex h-auto rounded bg-[#3b82f620] px-1.5 py-0.5 text-[9px] font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">Next</Badge>}
                      {isLocked  && <Badge className="inline-flex h-auto rounded bg-gray-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 shadow-none hover:bg-gray-800">Locked</Badge>}
                    </div>
                    {!isCurrent && (
                      <span className={`shrink-0 text-sm font-bold tabular-nums ${readinessColor(step.readiness)}`}>{step.readiness}%</span>
                    )}
                  </div>
                  {!isCurrent && (
                    <Progress value={step.readiness} className={`h-1 bg-gray-800 ${readinessBg(step.readiness)}`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* ── Requirements for Next Role ───────────────────────────────────────── */}
      <SectionCard
        title={`Requirements for ${nextRole.role}`}
        sub="Skills needed and your current progress against each"
        badge={
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[11px] text-emerald-400">{REQUIREMENTS.filter((r) => r.status === "met").length} met</span>
            <span className="text-[11px] text-slate-600">/</span>
            <span className="text-[11px] text-slate-400">{REQUIREMENTS.length} total</span>
          </div>
        }
      >
        <div className="w-full overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-max min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0f1318]">
                {["Skill", "Category", "Current", "Required", "Status", "Suggested Action"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><SkelLine /></td>
                      ))}
                    </tr>
                  ))
                : REQUIREMENTS.map((req, i) => {
                    const cur = ratingStyle(req.current_level);
                    const reqS = ratingStyle(req.required_level);
                    return (
                      <tr key={req.skill} className={`border-b border-gray-800/40 transition-colors hover:bg-[#1a2030] ${i % 2 === 0 ? "bg-[#141820]" : "bg-[#111520]"}`}>
                        <td className="px-4 py-2.5 max-w-[180px]">
                          <span className="block truncate text-xs font-medium text-slate-200">{req.skill}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{req.category}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex h-6 w-8 items-center justify-center rounded text-xs font-semibold tabular-nums ${cur.bg} ${cur.text}`}>
                              {req.current_level ?? "—"}
                            </span>
                            {req.current_level !== null && (
                              <span className={`hidden text-[10px] sm:block ${cur.text}`}>{RATING_LABELS[req.current_level]}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex h-6 w-8 items-center justify-center rounded text-xs font-semibold tabular-nums ${reqS.bg} ${reqS.text}`}>
                            {req.required_level}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">{gapBadge(req.status)}</td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-400 max-w-[200px]">
                          <span className="block truncate">{req.action}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {req.status !== "met" && (
                            <div className="flex items-center gap-1">
                              <button type="button"
                                className="rounded border border-gray-700 px-2 py-0.5 text-[9px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
                                {req.status === "missing" ? "Book" : "Update"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Training + Certs (2-col on xl) ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Training Plan */}
        <SectionCard
          title="Training Plan"
          sub={`Linked to ${nextRole.role}`}
          badge={
            <Badge className="inline-flex h-auto shrink-0 rounded bg-[#facc1520] px-2 py-0.5 text-[10px] font-medium text-yellow-400 shadow-none hover:bg-[#facc1520]">
              {trainingReq} pending
            </Badge>
          }
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-800" />)}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {TRAINING_PLAN.map((t) => (
                <div key={t.course} className="flex items-start gap-3 rounded-lg border border-gray-800 bg-[#0f1318] px-4 py-3 transition-colors hover:border-gray-700">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${t.status === "completed" ? "bg-[#10b98120]" : "bg-[#3b82f615]"}`}>
                    <GraduationCap className={`h-3.5 w-3.5 ${t.status === "completed" ? "text-emerald-400" : "text-blue-400"}`} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-xs font-medium text-slate-200">{t.course}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${priorityClass(t.priority)}`}>
                        {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                      </Badge>
                      <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${trainingStatusClass(t.status)}`}>
                        {trainingStatusLabel(t.status)}
                      </Badge>
                      <span className="text-[11px] text-slate-500">{t.linked_skill}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {t.due_date && <span className="text-[11px] text-slate-500">{fmtDate(t.due_date)}</span>}
                    {t.status !== "completed" && (
                      <button type="button"
                        className="rounded border border-gray-700 px-2.5 py-0.5 text-[9px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
                        Book
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Certification Plan */}
        <SectionCard
          title="Certification Plan"
          sub={`Certificates needed for ${nextRole.role}`}
          badge={
            <Badge className="inline-flex h-auto shrink-0 rounded bg-[#ef444420] px-2 py-0.5 text-[10px] font-medium text-red-400 shadow-none hover:bg-[#ef444420]">
              {certReq} needed
            </Badge>
          }
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-800" />)}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {CERT_PLAN.map((c) => {
                const borderCls = c.status === "expired" ? "border-[#ef444430] bg-[#ef444408]"
                  : c.status === "not_held" ? "border-[#f9731630] bg-[#f9731608]"
                  : c.status === "valid" ? "border-gray-800 bg-[#0f1318]"
                  : "border-[#facc1530] bg-[#facc1508]";
                const iconCls = c.status === "expired" ? "text-red-400 bg-[#ef444420]"
                  : c.status === "not_held" ? "text-orange-400 bg-[#f9731620]"
                  : c.status === "valid" ? "text-emerald-400 bg-[#10b98120]"
                  : "text-yellow-400 bg-[#facc1520]";
                return (
                  <div key={c.cert} className={`flex items-start gap-3 rounded-lg border ${borderCls} px-4 py-3`}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconCls}`}>
                      <Shield className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="truncate text-xs font-medium text-slate-200">{c.cert}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${certStatusClass(c.status)}`}>
                          {certStatusLabel(c.status)}
                        </Badge>
                        {c.required_by && (
                          <span className="text-[11px] text-slate-500">Required by {fmtDate(c.required_by)}</span>
                        )}
                      </div>
                    </div>
                    {c.status !== "valid" && (
                      <button type="button"
                        className="shrink-0 rounded border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
                        {c.action}
                      </button>
                    )}
                    {c.status === "valid" && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 self-center" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── AI Career Recommendations ────────────────────────────────────────── */}
      <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex min-w-0 flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-slate-200">AI Career Recommendations</h2>
              <p className="text-[11px] text-slate-500">Personalised actions to accelerate your progression to {nextRole.role}</p>
            </div>
            <Badge className="inline-flex h-auto shrink-0 items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
            </Badge>
          </div>
          <AiActionsPanel actions={AI_ACTIONS} />
        </CardContent>
      </Card>

      {/* ── Quick Actions ────────────────────────────────────────────────────── */}
      <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Update Skills",       icon: Sparkles      },
              { label: "Book Training",        icon: GraduationCap },
              { label: "Upload Certificate",   icon: Upload        },
              { label: "View Opportunities",   icon: ShoppingBag   },
              { label: "Contact Manager",      icon: MessageSquare },
            ].map(({ label, icon: Icon }) => (
              <Button key={label} size="sm" variant="outline"
                className="h-8 gap-1.5 border-gray-700 bg-transparent text-slate-400 hover:border-blue-500/40 hover:text-blue-400 text-xs">
                <Icon className="h-3.5 w-3.5 shrink-0" />{label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

    </section>
  );
}
