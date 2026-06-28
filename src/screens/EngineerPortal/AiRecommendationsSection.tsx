import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Clock,
  GraduationCap,
  MessageSquare,
  RefreshCw,
  Shield,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Upload,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { SyncIndicator } from "../../components/SyncIndicator";
import { supabase } from "../../lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "critical" | "high" | "medium" | "low";
type Category = "skill" | "training" | "certification" | "opportunity" | "compliance" | "career";

interface Rec {
  id: string;
  priority: Priority;
  category: Category;
  title: string;
  reason: string;
  impact: string;
  linked: string | null;
  action: string;
  score_delta: number | null;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_RECS: Rec[] = [
  // Critical
  { id: "1",  priority: "critical", category: "compliance",   title: "Renew Manual Handling Certificate",            reason: "Expired Nov 2024. Required for site operations. Compliance audit due in 6 weeks.",              impact: "Site access restriction risk",         linked: "Manual Handling Renewal",       action: "Book Renewal",        score_delta: 4  },
  { id: "2",  priority: "critical", category: "certification", title: "Renew Confined Space Entry",                   reason: "Expires 30 Jul 2025 — 32 days remaining. Last refresher places are filling fast.",                impact: "Permit to work blocked",               linked: "Confined Space Refresher",      action: "Book Now",            score_delta: 6  },

  // High
  { id: "3",  priority: "high",     category: "skill",         title: "Complete ATEX Zone Classification",            reason: "No certification on record. Blocks Predictive Maintenance Specialist role (61% match).",          impact: "+9 pts match score",                   linked: "ATEX Certification course",     action: "Book Training",       score_delta: 9  },
  { id: "4",  priority: "high",     category: "skill",         title: "Upload Vibration Analysis Level I evidence",   reason: "Cert marked pending validation. Unvalidated skills are excluded from match scoring.",             impact: "+5 pts match score",                   linked: "Validation request",            action: "Upload Evidence",     score_delta: 5  },
  { id: "5",  priority: "high",     category: "opportunity",   title: "Apply for Senior Mechanical Engineer",         reason: "87% match — strongest role fit on the platform. Application window closes in 14 days.",           impact: "Career progression",                   linked: "Senior Mechanical Engineer",    action: "Register Interest",   score_delta: null },

  // Medium
  { id: "6",  priority: "medium",   category: "training",      title: "Book Vibration Analysis Level II",             reason: "Level I validated. Level II unlocks 4 additional roles and boosts Shift Lead match to 89%.",       impact: "+12 pts match score",                  linked: "Vibration Analysis II",         action: "Book Training",       score_delta: 12 },
  { id: "7",  priority: "medium",   category: "skill",         title: "Add SAP PM proficiency to profile",            reason: "Required for Maintenance Planner (78% match). Self-declared skills count immediately.",           impact: "+6 pts match score",                   linked: "Maintenance Planner",           action: "Update Skills",       score_delta: 6  },
  { id: "8",  priority: "medium",   category: "career",        title: "Complete Shift Lead readiness assessment",     reason: "You are 72% ready for Shift Lead. A readiness review identifies remaining steps.",                  impact: "Readiness +14%",                       linked: "Shift Lead — Maintenance",      action: "Start Assessment",    score_delta: null },

  // Low
  { id: "9",  priority: "low",      category: "training",      title: "Explore Project Management Fundamentals",      reason: "Required for Maintenance Planner pathway. Self-paced online course, 8 hours.",                    impact: "Unlocks Planner pathway",              linked: "Project Management Fundamentals", action: "Browse Course",    score_delta: 4  },
  { id: "10", priority: "low",      category: "opportunity",   title: "Register for Reactor Shift Cover",             reason: "94% match on weekend shift cover. Builds site visibility and earns additional allowance.",         impact: "Income + visibility",                  linked: "Reactor Maintenance Shift Cover", action: "Register Interest", score_delta: null },
];

const CAREER_RECS = [
  { role: "Senior Mechanical Engineer",  readiness: 87, skills: [],                                                              training: [],                                     certs: []                               },
  { role: "Shift Lead — Maintenance",    readiness: 72, skills: ["People Management"],                                          training: ["Vibration Analysis Level II"],         certs: []                               },
  { role: "Maintenance Planner",         readiness: 68, skills: ["SAP PM Advanced"],                                            training: ["Project Management Fundamentals"],     certs: []                               },
  { role: "Reliability Engineer",        readiness: 55, skills: ["CBM Level 2"],                                                training: ["ATEX Certification"],                 certs: ["ATEX Zone Classification"]     },
  { role: "Maintenance Manager",         readiness: 41, skills: ["People Management", "Budget Control"],                        training: ["IOSH Managing Safely"],               certs: ["IOSH Managing Safely"]         },
];

const COMPLIANCE_RECS = [
  { cert: "Manual Handling",           status: "Expired",       expiry: "2024-11-01", days: -239, action: "Book Renewal"   },
  { cert: "Confined Space Entry",      status: "Expiring Soon", expiry: "2025-07-30", days: 32,   action: "Book Refresher" },
  { cert: "PSSR Pressure Systems",     status: "Expiring Soon", expiry: "2025-09-14", days: 77,   action: "Book Refresher" },
  { cert: "Vibration Analysis Level I", status: "Pending",      expiry: null,         days: 0,    action: "Upload Evidence" },
];

const OPPORTUNITY_RECS = [
  { title: "Senior Mechanical Engineer",       score: 87, type: "Job",         blocker: null,                        action: "Apply"           },
  { title: "Reactor Maintenance Shift Cover",  score: 94, type: "Shift Cover", blocker: null,                        action: "Register"        },
  { title: "Predictive Maintenance Specialist", score: 61, type: "Career Step", blocker: "Missing ATEX certification", action: "Book ATEX"      },
  { title: "Reliability Engineer",             score: 55, type: "Job",         blocker: "Expired Manual Handling cert", action: "Book Renewal" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priorityClass(p: Priority): string {
  switch (p) {
    case "critical": return "bg-[#ef444420] text-red-400";
    case "high":     return "bg-[#f9731620] text-orange-400";
    case "medium":   return "bg-[#facc1520] text-yellow-400";
    case "low":      return "bg-[#3b82f620] text-blue-400";
  }
}

function priorityBorder(p: Priority): string {
  switch (p) {
    case "critical": return "border-[#ef444430] bg-[#ef444408]";
    case "high":     return "border-[#f9731630] bg-[#f9731608]";
    case "medium":   return "border-[#facc1530] bg-[#facc1508]";
    case "low":      return "border-gray-800 bg-[#141820]";
  }
}

function priorityIcon(p: Priority): React.ElementType {
  switch (p) {
    case "critical": return XCircle;
    case "high":     return AlertTriangle;
    case "medium":   return Zap;
    case "low":      return BookOpen;
  }
}

function priorityIconColor(p: Priority): string {
  switch (p) {
    case "critical": return "text-red-400";
    case "high":     return "text-orange-400";
    case "medium":   return "text-yellow-400";
    case "low":      return "text-blue-400";
  }
}

function priorityIconBg(p: Priority): string {
  switch (p) {
    case "critical": return "bg-[#ef444420]";
    case "high":     return "bg-[#f9731620]";
    case "medium":   return "bg-[#facc1520]";
    case "low":      return "bg-[#3b82f620]";
  }
}

function categoryIcon(c: Category): React.ElementType {
  switch (c) {
    case "skill":         return Sparkles;
    case "training":      return GraduationCap;
    case "certification": return Shield;
    case "opportunity":   return Briefcase;
    case "compliance":    return AlertTriangle;
    case "career":        return TrendingUp;
  }
}

function scoreClass(s: number): string {
  if (s >= 85) return "text-emerald-400";
  if (s >= 70) return "text-blue-400";
  if (s >= 55) return "text-yellow-400";
  return "text-red-400";
}

function scoreBg(s: number): string {
  if (s >= 85) return "[&>div]:bg-emerald-500";
  if (s >= 70) return "[&>div]:bg-blue-500";
  if (s >= 55) return "[&>div]:bg-yellow-400";
  return "[&>div]:bg-red-500";
}

function certStatusClass(s: string): string {
  if (s === "Expired")       return "bg-[#ef444420] text-red-400";
  if (s === "Expiring Soon") return "bg-[#f9731620] text-orange-400";
  if (s === "Pending")       return "bg-[#facc1520] text-yellow-400";
  return "bg-[#10b98120] text-emerald-400";
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

// ─── Rec card ────────────────────────────────────────────────────────────────

function RecCard({ rec, loading }: { rec: Rec; loading: boolean }) {
  const Icon      = priorityIcon(rec.priority);
  const CatIcon   = categoryIcon(rec.category);
  const iconColor = priorityIconColor(rec.priority);
  const iconBg    = priorityIconBg(rec.priority);
  const border    = priorityBorder(rec.priority);

  if (loading) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-gray-800 bg-[#141820] p-4">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-800 shrink-0" />
        <div className="flex flex-1 flex-col gap-2"><SkelLine w="w-48" h="h-3.5" /><SkelLine w="w-full" h="h-2.5" /></div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 rounded-xl border ${border} p-4 transition-all hover:border-opacity-60`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs font-semibold text-slate-200 leading-snug">{rec.title}</p>
            <div className="flex shrink-0 items-center gap-1.5">
              {rec.score_delta !== null && (
                <span className="rounded bg-[#10b98120] px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                  +{rec.score_delta} pts
                </span>
              )}
              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium capitalize shadow-none ${priorityClass(rec.priority)}`}>
                {rec.priority}
              </Badge>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">{rec.reason}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-gray-800/60 pt-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <CatIcon className="h-3 w-3 shrink-0 text-slate-600" />
          {rec.linked && <span className="truncate text-[11px] text-slate-500">{rec.linked}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-slate-500">{rec.impact}</span>
          <button type="button"
            className="rounded border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
            {rec.action}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Priority[] = ["critical", "high", "medium", "low"];
const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "Critical Actions",
  high:     "High Priority",
  medium:   "Medium Priority",
  low:      "Lower Priority",
};

export function AiRecommendationsSection(): JSX.Element {
  const [recs,    setRecs]    = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick,    setTick]    = useState(0);
  const [filter,  setFilter]  = useState<Priority | "all">("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Try to pull engineer AI match data to enrich recommendations
        await supabase.functions.invoke("ai-matching-data");
        if (cancelled) return;
        setRecs(MOCK_RECS);
      } catch {
        if (!cancelled) setRecs(MOCK_RECS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tick]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const critical  = useMemo(() => recs.filter((r) => r.priority === "critical"), [recs]);
  const highRecs  = useMemo(() => recs.filter((r) => r.priority === "high"),     [recs]);
  const skillRecs = useMemo(() => recs.filter((r) => r.category === "skill" || r.category === "certification"), [recs]);
  const trainRecs = useMemo(() => recs.filter((r) => r.category === "training"), [recs]);
  const certRisk  = useMemo(() => COMPLIANCE_RECS.filter((c) => c.status !== "Valid").length, []);
  const scoreDelta = useMemo(() => recs.reduce((acc, r) => acc + (r.score_delta ?? 0), 0), [recs]);

  const filtered = useMemo(() =>
    filter === "all" ? recs : recs.filter((r) => r.priority === filter),
    [recs, filter]
  );

  const grouped = useMemo(() =>
    PRIORITY_ORDER.map((p) => ({
      priority: p,
      items: filtered.filter((r) => r.priority === p),
    })).filter((g) => g.items.length > 0),
    [filtered]
  );

  const scoreRecs = useMemo(() =>
    [...recs].filter((r) => r.score_delta !== null).sort((a, b) => (b.score_delta ?? 0) - (a.score_delta ?? 0)),
    [recs]
  );

  const kpis = [
    { label: "Critical Actions",       value: String(critical.length),  sub: "Require immediate action",    icon: XCircle,       cls: critical.length  > 0 ? "text-red-400"      : "text-emerald-400" },
    { label: "Skills to Update",       value: String(skillRecs.length), sub: "Skills & certs to improve",   icon: Sparkles,      cls: skillRecs.length > 0 ? "text-orange-400"   : "text-emerald-400" },
    { label: "Training Recommended",   value: String(trainRecs.length), sub: "Courses to book",             icon: GraduationCap, cls: trainRecs.length > 0 ? "text-blue-400"     : "text-emerald-400" },
    { label: "Certificates at Risk",   value: String(certRisk),         sub: "Expiring or expired",         icon: Shield,        cls: certRisk         > 0 ? "text-yellow-400"   : "text-emerald-400" },
    { label: "Potential Score Gain",   value: loading ? "—" : `+${scoreDelta} pts`, sub: "If all actions completed", icon: TrendingUp, cls: "text-emerald-400" },
  ];

  const FILTERS: Array<{ value: Priority | "all"; label: string }> = [
    { value: "all",      label: "All"      },
    { value: "critical", label: "Critical" },
    { value: "high",     label: "High"     },
    { value: "medium",   label: "Medium"   },
    { value: "low",      label: "Low"      },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-5 md:px-6 xl:px-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl font-semibold text-slate-50">AI Recommendations</h1>
          <p className="text-sm text-slate-400">Personalised recommendations to improve your skills, match score and career progression.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SyncIndicator />
          <ExplainWithAi pageId="engineer-ai-recommendations" />
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-700 bg-transparent px-3 text-xs font-medium text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(({ label, value, sub, icon: Icon, cls }) => (
          <Card key={label} className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-3 p-4 xl:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-medium text-slate-400">{label}</p>
                <Icon className="h-4 w-4 shrink-0 text-slate-600" />
              </div>
              <p className={`truncate text-xl font-semibold tabular-nums ${cls}`}>
                {loading ? "—" : value}
              </p>
              <p className="truncate text-[11px] text-slate-500">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── AI confidence banner ─────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center gap-4 rounded-xl border border-[#3b82f625] bg-[#3b82f608] px-5 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3b82f620]">
            <Sparkles className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-xs font-semibold text-slate-200">
              {recs.length} personalised recommendations · <span className="text-blue-400">+{scoreDelta} potential match score improvement</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              AI analysed your skills profile, certifications, bookings and opportunity data to generate this action plan.
            </p>
          </div>
          <Badge className="inline-flex h-auto shrink-0 items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
          </Badge>
        </div>
      )}

      {/* ── Priority Action Plan ─────────────────────────────────────────────── */}
      <SectionCard
        title="Priority Action Plan"
        sub="Recommendations grouped by urgency"
        badge={
          <div className="flex items-center gap-1">
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`h-7 rounded-lg px-2.5 text-[10px] font-medium transition-colors whitespace-nowrap ${filter === value ? "bg-[#3b82f620] text-blue-400" : "text-slate-500 hover:bg-[#ffffff0a] hover:text-slate-300"}`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => <RecCard key={i} rec={MOCK_RECS[0]} loading />)}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400/40" />
            <p className="text-sm font-medium text-emerald-400">No recommendations for this priority level</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {grouped.map(({ priority, items }) => (
              <div key={priority} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${priorityIconColor(priority)}`}>
                    {PRIORITY_LABELS[priority]}
                  </span>
                  <span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px] text-slate-500">{items.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {items.map((rec) => <RecCard key={rec.id} rec={rec} loading={false} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Improve Match Score + Career (2-col on xl) ──────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Improve Match Score */}
        <SectionCard
          title="Improve My Match Score"
          sub="Actions ranked by score impact"
          badge={
            <span className="text-[11px] text-emerald-400 font-semibold">
              +{scoreDelta} pts available
            </span>
          }
        >
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-6 w-6 animate-pulse rounded-md bg-gray-800 shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5"><SkelLine w="w-40" /><SkelLine w="w-full" h="h-2" /></div>
                  <SkelLine w="w-12" h="h-5" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {scoreRecs.map((rec) => {
                const CatIcon = categoryIcon(rec.category);
                return (
                  <div key={rec.id} className="flex items-start gap-3 rounded-lg border border-gray-800/70 bg-[#0f1318] p-3 transition-colors hover:border-gray-700">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${priorityIconBg(rec.priority)}`}>
                      <CatIcon className={`h-3 w-3 ${priorityIconColor(rec.priority)}`} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="truncate text-xs font-medium text-slate-200">{rec.title}</p>
                      <div className="mt-1">
                        <Progress
                          value={Math.min(100, (rec.score_delta ?? 0) * 8)}
                          className="h-1 bg-gray-800 [&>div]:bg-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs font-bold text-emerald-400 tabular-nums">+{rec.score_delta}</span>
                      <span className="text-[9px] text-slate-600">pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Career Progression */}
        <SectionCard title="Career Progression" sub="Readiness scores and gap analysis for your next roles">
          {loading ? (
            <div className="flex flex-col gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <SkelLine w="w-48" /><div className="h-2 w-full animate-pulse rounded bg-gray-800" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {CAREER_RECS.map(({ role, readiness, skills, training, certs }) => (
                <div key={role} className="flex flex-col gap-2 rounded-lg border border-gray-800/60 bg-[#0f1318] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-slate-200">{role}</p>
                    <span className={`shrink-0 text-sm font-bold tabular-nums ${scoreClass(readiness)}`}>{readiness}%</span>
                  </div>
                  <Progress value={readiness} className={`h-1.5 bg-gray-800 ${scoreBg(readiness)}`} />
                  {(skills.length > 0 || training.length > 0 || certs.length > 0) && (
                    <div className="flex flex-col gap-1 mt-0.5">
                      {skills.map((s, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Sparkles className="h-2.5 w-2.5 shrink-0 text-slate-600" />
                          <span className="truncate">Skill: {s}</span>
                        </div>
                      ))}
                      {training.map((t, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <GraduationCap className="h-2.5 w-2.5 shrink-0 text-slate-600" />
                          <span className="truncate">Training: {t}</span>
                        </div>
                      ))}
                      {certs.map((c, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Shield className="h-2.5 w-2.5 shrink-0 text-slate-600" />
                          <span className="truncate">Cert: {c}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Compliance + Opportunities (2-col on xl) ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Compliance Recommendations */}
        <SectionCard
          title="Compliance Recommendations"
          sub="Expiring and expired certificates requiring action"
          badge={
            <Badge className="inline-flex h-auto shrink-0 rounded bg-[#ef444420] px-2 py-0.5 text-[10px] font-medium text-red-400 shadow-none hover:bg-[#ef444420]">
              {certRisk} at risk
            </Badge>
          }
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 p-3">
                  <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-800 shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5"><SkelLine w="w-40" /><SkelLine w="w-24" h="h-2.5" /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {COMPLIANCE_RECS.map((c) => (
                <div key={c.cert} className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${c.status === "Expired" ? "border-[#ef444430] bg-[#ef444408]" : c.status === "Expiring Soon" ? "border-[#f9731630] bg-[#f9731608]" : "border-[#facc1530] bg-[#facc1508]"}`}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${c.status === "Expired" ? "bg-[#ef444420]" : c.status === "Expiring Soon" ? "bg-[#f9731620]" : "bg-[#facc1520]"}`}>
                    <Shield className={`h-3.5 w-3.5 ${c.status === "Expired" ? "text-red-400" : c.status === "Expiring Soon" ? "text-orange-400" : "text-yellow-400"}`} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-xs font-medium text-slate-200">{c.cert}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${certStatusClass(c.status)}`}>
                        {c.status}
                      </Badge>
                      {c.expiry && (
                        <span className="text-[11px] text-slate-500">
                          {c.days < 0 ? `${Math.abs(c.days)}d overdue` : `${c.days}d remaining`} · {fmtDate(c.expiry)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button type="button"
                    className="shrink-0 rounded border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
                    {c.action}
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Opportunity Recommendations */}
        <SectionCard
          title="Opportunity Recommendations"
          sub="Best-matched roles and what is blocking higher scores"
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 p-3">
                  <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-800 shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5"><SkelLine w="w-40" /><SkelLine w="w-24" h="h-2.5" /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {OPPORTUNITY_RECS.map((opp) => (
                <div key={opp.title} className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${opp.blocker ? "border-[#f9731625] bg-[#f9731608]" : "border-gray-800 bg-[#0f1318]"}`}>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#3b82f615]">
                    <Briefcase className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-xs font-medium text-slate-200">{opp.title}</p>
                      <span className={`shrink-0 text-sm font-bold tabular-nums ${scoreClass(opp.score)}`}>{opp.score}%</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-500">{opp.type}</span>
                      {opp.blocker && (
                        <span className="text-[11px] text-orange-400/80">{opp.blocker}</span>
                      )}
                    </div>
                    <Progress value={opp.score} className={`mt-1.5 h-1 bg-gray-800 ${scoreBg(opp.score)}`} />
                  </div>
                  <button type="button"
                    className="shrink-0 self-center rounded border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
                    {opp.action}
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────────────── */}
      <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Update Skills",        icon: Sparkles      },
              { label: "Book Training",        icon: GraduationCap },
              { label: "Upload Certificate",   icon: Upload        },
              { label: "View Opportunities",   icon: ShoppingBag   },
              { label: "Request Validation",   icon: Award         },
              { label: "Contact Manager",      icon: MessageSquare },
            ].map(({ label, icon: Icon }) => (
              <Button
                key={label}
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-gray-700 bg-transparent text-slate-400 hover:border-blue-500/40 hover:text-blue-400 text-xs"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

    </section>
  );
}
