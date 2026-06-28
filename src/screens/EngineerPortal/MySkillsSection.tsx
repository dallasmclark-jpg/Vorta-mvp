import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Shield,
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
import { supabase } from "../../lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Skill {
  id: string;
  name: string;
  category: string;
  self_rating: number | null;
  manager_rating: number | null;
  validated_rating: number | null;
  final_rating: number | null;
  verification_status: "validated" | "pending" | "expired" | "not_uploaded";
  training_required: boolean;
  is_critical: boolean;
  years_exp: number | null;
  last_updated: string | null;
}

interface Gap {
  skill: string;
  category: string;
  required_level: number;
  current_level: number | null;
  recommendation: string;
}

interface HistoryEvent {
  date: string;
  event: string;
  detail: string;
  type: "added" | "improved" | "validated" | "cert";
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_SKILLS: Skill[] = [
  { id: "1",  name: "Allen Bradley PLC",       category: "Automation & Controls",          self_rating: 4, manager_rating: 4, validated_rating: 4, final_rating: 4, verification_status: "validated",    training_required: false, is_critical: true,  years_exp: 6,  last_updated: "2025-01-15" },
  { id: "2",  name: "Hydraulic Systems",        category: "Mechanical Maintenance",          self_rating: 5, manager_rating: 5, validated_rating: 5, final_rating: 5, verification_status: "validated",    training_required: false, is_critical: true,  years_exp: 8,  last_updated: "2025-02-20" },
  { id: "3",  name: "GMP Fundamentals",         category: "Pharmaceutical Compliance",       self_rating: 4, manager_rating: 4, validated_rating: 4, final_rating: 4, verification_status: "validated",    training_required: false, is_critical: false, years_exp: 5,  last_updated: "2024-11-10" },
  { id: "4",  name: "SAP PM",                  category: "CMMS / Maintenance Systems",      self_rating: 3, manager_rating: 3, validated_rating: 3, final_rating: 3, verification_status: "validated",    training_required: true,  is_critical: false, years_exp: 3,  last_updated: "2024-10-01" },
  { id: "5",  name: "Vibration Analysis L1",   category: "Reliability Engineering",         self_rating: 3, manager_rating: null, validated_rating: null, final_rating: 3, verification_status: "pending",  training_required: false, is_critical: false, years_exp: 2,  last_updated: "2025-05-01" },
  { id: "6",  name: "Electrical Safety LV",    category: "Electrical Maintenance",          self_rating: 4, manager_rating: 4, validated_rating: 4, final_rating: 4, verification_status: "validated",    training_required: false, is_critical: true,  years_exp: 7,  last_updated: "2025-01-08" },
  { id: "7",  name: "ATEX Zone Classification", category: "Electrical Maintenance",         self_rating: 2, manager_rating: null, validated_rating: null, final_rating: 2, verification_status: "not_uploaded", training_required: true, is_critical: true, years_exp: 1, last_updated: "2024-06-01" },
  { id: "8",  name: "Confined Space Entry",    category: "Certifications & Qualifications", self_rating: 4, manager_rating: 4, validated_rating: 4, final_rating: 4, verification_status: "validated",    training_required: false, is_critical: true,  years_exp: 5,  last_updated: "2025-03-14" },
  { id: "9",  name: "Manual Handling",         category: "Certifications & Qualifications", self_rating: 4, manager_rating: 4, validated_rating: null, final_rating: 4, verification_status: "expired",    training_required: true,  is_critical: false, years_exp: 8,  last_updated: "2024-11-01" },
  { id: "10", name: "Condition Monitoring",    category: "Reliability Engineering",         self_rating: 2, manager_rating: 2, validated_rating: null, final_rating: 2, verification_status: "pending",    training_required: true,  is_critical: false, years_exp: 1,  last_updated: "2024-08-15" },
];

const MOCK_GAPS: Gap[] = [
  { skill: "ATEX Zone Classification", category: "Electrical Maintenance",    required_level: 4, current_level: 2, recommendation: "Book ATEX certification course. Required for zone 1 & 2 work orders." },
  { skill: "Vibration Analysis II",    category: "Reliability Engineering",   required_level: 4, current_level: null, recommendation: "Level I validated. Book Level II to meet Predictive Maintenance pathway target." },
  { skill: "SAP PM Advanced",          category: "CMMS / Maintenance Systems", required_level: 4, current_level: 3, recommendation: "Attend SAP PM Advanced workshop. Improves work order efficiency score." },
  { skill: "Condition Monitoring",     category: "Reliability Engineering",   required_level: 3, current_level: 2, recommendation: "Enrol in CBM Level I online course. Self-paced, 6 hours." },
];

const MOCK_HISTORY: HistoryEvent[] = [
  { date: "2025-05-01", event: "Skill added",        detail: "Vibration Analysis Level I — self-rated 3/5",          type: "added"     },
  { date: "2025-03-14", event: "Cert validated",     detail: "Confined Space Entry — manager validation approved",   type: "cert"      },
  { date: "2025-02-20", event: "Rating improved",    detail: "Hydraulic Systems — 4 → 5 (validated by manager)",    type: "improved"  },
  { date: "2025-01-15", event: "Rating validated",   detail: "Allen Bradley PLC — 4/5 manager validated",           type: "validated" },
  { date: "2024-11-10", event: "Skill added",        detail: "GMP Fundamentals — 4/5 validated",                    type: "added"     },
  { date: "2024-10-01", event: "Skill added",        detail: "SAP PM — self-rated 3/5, training required",          type: "added"     },
];

const AI_ACTIONS: AiAction[] = [
  { label: "Upload ATEX Certification evidence",        description: "Rating 2/5 with no evidence. Blocks zone 1/2 work orders and reduces AI match score.",  priority: "critical", icon: AlertTriangle },
  { label: "Request validation for Vibration Analysis", description: "Self-rated 3/5 but no manager sign-off. Unvalidated skills are excluded from matching.", priority: "high",     icon: Shield        },
  { label: "Renew Manual Handling certificate",         description: "Cert expired Nov 2024. Required for compliance audit. Book renewal training now.",        priority: "high",     icon: Zap           },
  { label: "Improve SAP PM to level 4",                description: "Level 3 self-rated. Training Required flag active. Enrol in SAP PM Advanced workshop.",    priority: "medium",   icon: TrendingUp    },
  { label: "Book Vibration Analysis Level II",         description: "Level I complete. Level II unlocks Predictive Maintenance Specialist pathway (+12 pts).",  priority: "medium",   icon: GraduationCap },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RATING_LABELS: Record<number, string> = {
  5: "Competent", 4: "Proficient", 3: "Developing", 2: "Basic", 1: "Gap",
};

function ratingStyle(r: number | null): { bg: string; text: string; bar: string } {
  switch (r) {
    case 5:  return { bg: "bg-emerald-500/20", text: "text-emerald-400", bar: "[&>div]:bg-emerald-500" };
    case 4:  return { bg: "bg-blue-500/20",    text: "text-blue-400",    bar: "[&>div]:bg-blue-500"    };
    case 3:  return { bg: "bg-yellow-400/20",  text: "text-yellow-300",  bar: "[&>div]:bg-yellow-400"  };
    case 2:  return { bg: "bg-orange-500/20",  text: "text-orange-400",  bar: "[&>div]:bg-orange-500"  };
    case 1:  return { bg: "bg-red-500/20",     text: "text-red-400",     bar: "[&>div]:bg-red-500"     };
    default: return { bg: "bg-gray-800",       text: "text-slate-600",   bar: "[&>div]:bg-gray-600"    };
  }
}

function validationClass(v: string): string {
  if (v === "validated")    return "bg-[#10b98120] text-emerald-400";
  if (v === "pending")      return "bg-[#facc1520] text-yellow-400";
  if (v === "expired")      return "bg-[#ef444420] text-red-400";
  return "bg-gray-800 text-slate-500";
}

function validationLabel(v: string): string {
  if (v === "validated")    return "Validated";
  if (v === "pending")      return "Pending";
  if (v === "expired")      return "Expired";
  return "Not uploaded";
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function historyTypeIcon(t: HistoryEvent["type"]): React.ElementType {
  switch (t) {
    case "added":     return PlusCircle;
    case "improved":  return TrendingUp;
    case "validated": return CheckCircle2;
    case "cert":      return Award;
  }
}

function historyTypeColor(t: HistoryEvent["type"]): string {
  switch (t) {
    case "added":     return "text-blue-400 bg-[#3b82f620]";
    case "improved":  return "text-emerald-400 bg-[#10b98120]";
    case "validated": return "text-emerald-400 bg-[#10b98120]";
    case "cert":      return "text-orange-400 bg-[#f9731620]";
  }
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

export function MySkillsSection(): JSX.Element {
  const [skills,  setSkills]  = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick,    setTick]    = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase.functions.invoke("skills-matrix-data");
        if (cancelled) return;
        const assignments = (data?.heatmapAssignments ?? []) as Array<{
          engineer_id: string; skill_id: string;
          self_rating: number | null; manager_rating: number | null; validated_rating: number | null;
          verification_status?: string; training_required: boolean;
        }>;
        const skillMeta = (data?.heatmapSkills ?? []) as Array<{ id: string; name: string; category: string; is_critical: boolean }>;
        if (assignments.length && skillMeta.length) {
          // Take first engineer's assignments as "mine"
          const myEngId = (data?.engineers?.[0]?.id) as string | undefined;
          const mine = myEngId ? assignments.filter((a) => a.engineer_id === myEngId) : assignments.slice(0, 10);
          const mapped: Skill[] = mine.slice(0, 15).map((a) => {
            const meta = skillMeta.find((s) => s.id === a.skill_id);
            const finalRating = a.validated_rating ?? a.manager_rating ?? a.self_rating ?? null;
            const vs = a.verification_status ?? "not_uploaded";
            return {
              id: a.skill_id,
              name: meta?.name ?? "Unknown Skill",
              category: meta?.category ?? "General",
              self_rating: a.self_rating,
              manager_rating: a.manager_rating,
              validated_rating: a.validated_rating,
              final_rating: finalRating,
              verification_status: (["validated","pending","expired","not_uploaded"].includes(vs) ? vs : "not_uploaded") as Skill["verification_status"],
              training_required: a.training_required,
              is_critical: meta?.is_critical ?? false,
              years_exp: null,
              last_updated: null,
            };
          });
          setSkills(mapped);
        } else {
          setSkills(MOCK_SKILLS);
        }
      } catch {
        if (!cancelled) setSkills(MOCK_SKILLS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tick]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const validated  = useMemo(() => skills.filter((s) => s.verification_status === "validated"),  [skills]);
  const pending    = useMemo(() => skills.filter((s) => s.verification_status === "pending"),    [skills]);
  const expired    = useMemo(() => skills.filter((s) => s.verification_status === "expired"),    [skills]);
  const critical   = useMemo(() => skills.filter((s) => s.is_critical),                          [skills]);
  const avgScore   = useMemo(() => {
    const rated = skills.filter((s) => s.final_rating !== null);
    if (!rated.length) return 0;
    return Math.round((rated.reduce((s, x) => s + (x.final_rating ?? 0), 0) / rated.length) * 20);
  }, [skills]);
  const topSkills  = useMemo(() => [...skills].filter((s) => s.final_rating !== null).sort((a, b) => (b.final_rating ?? 0) - (a.final_rating ?? 0)).slice(0, 5), [skills]);
  const needsAttn  = useMemo(() => skills.filter((s) => s.verification_status !== "validated" || s.training_required), [skills]);

  const categories = useMemo(() => [...new Set(skills.map((s) => s.category))].sort(), [skills]);

  const kpis = [
    { label: "Overall Score",       value: loading ? "—" : `${avgScore}%`, sub: `${skills.length} skills tracked`,     icon: Sparkles,     cls: avgScore >= 75 ? "text-emerald-400" : avgScore >= 55 ? "text-yellow-400" : "text-red-400" },
    { label: "Validated Skills",    value: String(validated.length),        sub: "Manager / cert verified",             icon: CheckCircle2, cls: "text-emerald-400"    },
    { label: "Awaiting Validation", value: String(pending.length),          sub: "Pending manager sign-off",            icon: Clock,        cls: pending.length > 0 ? "text-yellow-400" : "text-emerald-400" },
    { label: "Critical Skills",     value: String(critical.length),         sub: "Site-critical competencies",          icon: Shield,       cls: "text-blue-400"       },
    { label: "AI Match Impact",     value: loading ? "—" : "+36 pts",       sub: "Potential if all validated",          icon: TrendingUp,   cls: "text-emerald-400"    },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-5 md:px-6 xl:px-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl font-semibold text-slate-50">My Skills</h1>
          <p className="text-sm text-slate-400">View, manage and develop your engineering skills profile.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SyncIndicator />
          <ExplainWithAi pageId="engineer-skills" />
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-700 bg-transparent px-3 text-xs font-medium text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Button size="sm" className="h-8 gap-1.5 bg-blue-600 text-xs font-medium text-white hover:bg-blue-500">
            <PlusCircle className="h-3.5 w-3.5" /> Update Skills
          </Button>
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

      {/* ── AI Actions ──────────────────────────────────────────────────────── */}
      {!loading && <AiActionsPanel actions={AI_ACTIONS} />}

      {/* ── Skills Matrix Table ──────────────────────────────────────────────── */}
      <SectionCard
        title="Skills Matrix"
        sub="Your full skills profile with ratings and validation status"
        badge={<span className="text-[11px] text-slate-500">{loading ? "—" : `${skills.length} skills`}</span>}
      >
        <div className="w-full overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-max min-w-[740px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0f1318]">
                {["Skill", "Category", "Self", "Manager", "Final Rating", "Validation", "Last Updated", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><SkelLine /></td>
                      ))}
                    </tr>
                  ))
                : (() => {
                    const rows: JSX.Element[] = [];
                    let lastCat = "";
                    const sorted = [...skills].sort((a, b) => a.category.localeCompare(b.category) || (b.final_rating ?? 0) - (a.final_rating ?? 0));
                    sorted.forEach((skill, i) => {
                      if (skill.category !== lastCat) {
                        lastCat = skill.category;
                        rows.push(
                          <tr key={`cat-${skill.category}`} className="bg-[#0b0e14]">
                            <td colSpan={8} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400/70">
                              {skill.category}
                            </td>
                          </tr>
                        );
                      }
                      const final = ratingStyle(skill.final_rating);
                      const selfS = ratingStyle(skill.self_rating);
                      const mgrS  = ratingStyle(skill.manager_rating);
                      rows.push(
                        <tr key={skill.id} className={`border-b border-gray-800/40 transition-colors hover:bg-[#1a2030] ${i % 2 === 0 ? "bg-[#141820]" : "bg-[#111520]"}`}>
                          <td className="px-4 py-2.5 max-w-[200px]">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="truncate text-xs font-medium text-slate-200">{skill.name}</span>
                              {skill.is_critical && (
                                <Badge className="shrink-0 inline-flex h-auto rounded bg-[#ef444415] px-1 py-0.5 text-[9px] font-medium text-red-400 shadow-none hover:bg-[#ef444415]">
                                  Critical
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{skill.category}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex h-6 w-8 items-center justify-center rounded text-xs font-semibold tabular-nums ${selfS.bg} ${selfS.text}`}>
                              {skill.self_rating ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex h-6 w-8 items-center justify-center rounded text-xs font-semibold tabular-nums ${mgrS.bg} ${mgrS.text}`}>
                              {skill.manager_rating ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <span className={`inline-flex h-6 w-8 items-center justify-center rounded text-xs font-semibold tabular-nums ${final.bg} ${final.text}`}>
                                {skill.final_rating ?? "—"}
                              </span>
                              {skill.final_rating !== null && (
                                <span className={`text-[10px] ${final.text}`}>{RATING_LABELS[skill.final_rating]}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${validationClass(skill.verification_status)}`}>
                              {validationLabel(skill.verification_status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                            {fmtDate(skill.last_updated)}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {skill.training_required && (
                                <span className="rounded bg-[#f9731620] px-1.5 py-0.5 text-[9px] font-medium text-orange-400 whitespace-nowrap">
                                  Training
                                </span>
                              )}
                              {skill.verification_status !== "validated" && (
                                <button type="button"
                                  className="text-[10px] font-medium text-slate-500 transition-colors hover:text-blue-400 whitespace-nowrap">
                                  {skill.verification_status === "not_uploaded" ? "Upload" : "Chase"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                    return rows;
                  })()}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        {!loading && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Rating</span>
            {([5, 4, 3, 2, 1] as const).map((r) => {
              const { bg, text } = ratingStyle(r);
              return (
                <span key={r} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className={`inline-flex h-5 w-7 items-center justify-center rounded text-[11px] font-semibold ${bg} ${text}`}>{r}</span>
                  {RATING_LABELS[r]}
                </span>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Needs Attention + Top Skills (2-col on xl) ───────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Needs Attention */}
        <SectionCard
          title="Skills Requiring Attention"
          sub="Unvalidated, expired or training-flagged skills"
          badge={
            needsAttn.length > 0 ? (
              <Badge className="inline-flex h-auto shrink-0 rounded bg-[#f9731620] px-2 py-0.5 text-[10px] font-medium text-orange-400 shadow-none hover:bg-[#f9731620]">
                {needsAttn.length} items
              </Badge>
            ) : null
          }
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 p-3">
                  <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-800 shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5"><SkelLine w="w-40" /><SkelLine w="w-28" h="h-2.5" /></div>
                </div>
              ))}
            </div>
          ) : needsAttn.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400/40" />
              <p className="text-sm font-medium text-emerald-400">All skills validated and up to date</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {needsAttn.map((skill) => {
                const isExpired = skill.verification_status === "expired";
                const isPending = skill.verification_status === "pending";
                const noEvidence = skill.verification_status === "not_uploaded";
                const borderCls = isExpired ? "border-[#ef444430] bg-[#ef444408]" : isPending ? "border-[#facc1530] bg-[#facc1508]" : "border-[#f9731630] bg-[#f9731608]";
                const iconCls   = isExpired ? "text-red-400 bg-[#ef444420]" : isPending ? "text-yellow-400 bg-[#facc1520]" : "text-orange-400 bg-[#f9731620]";
                const Icon = isExpired ? Zap : isPending ? Clock : AlertTriangle;
                return (
                  <div key={skill.id} className={`flex items-start gap-3 rounded-lg border ${borderCls} px-4 py-3`}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconCls}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-medium text-slate-200">{skill.name}</p>
                        {skill.is_critical && (
                          <Badge className="shrink-0 inline-flex h-auto rounded bg-[#ef444415] px-1 py-0.5 text-[9px] text-red-400 shadow-none hover:bg-[#ef444415]">Critical</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500">{skill.category}</span>
                        <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${validationClass(skill.verification_status)}`}>
                          {validationLabel(skill.verification_status)}
                        </Badge>
                        {skill.training_required && (
                          <span className="text-[11px] text-orange-400">Training required</span>
                        )}
                      </div>
                    </div>
                    <button type="button"
                      className="shrink-0 rounded border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
                      {noEvidence ? "Upload" : isExpired ? "Renew" : "Chase"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Top Skills */}
        <SectionCard title="Top Skills" sub="Your strongest validated competencies">
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5"><SkelLine w="w-40" /><div className="h-2 w-full animate-pulse rounded bg-gray-800" /></div>
              ))}
            </div>
          ) : topSkills.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <BookOpen className="h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-500">No rated skills on record.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {topSkills.map((skill) => {
                const { text, bar } = ratingStyle(skill.final_rating);
                return (
                  <div key={skill.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="truncate text-xs font-medium text-slate-200">{skill.name}</p>
                        {skill.is_critical && (
                          <Badge className="shrink-0 inline-flex h-auto rounded bg-[#3b82f620] px-1 py-0.5 text-[9px] font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">SME</Badge>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {skill.years_exp !== null && (
                          <span className="text-[11px] text-slate-500">{skill.years_exp}yr</span>
                        )}
                        <span className={`text-sm font-bold tabular-nums ${text}`}>{skill.final_rating}/5</span>
                      </div>
                    </div>
                    <Progress value={(skill.final_rating ?? 0) * 20} className={`h-1.5 bg-gray-800 ${bar}`} />
                    <p className="text-[10px] text-slate-600">{skill.category}</p>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Skill Gaps ───────────────────────────────────────────────────────── */}
      <SectionCard
        title="Skill Gaps"
        sub="Missing or below-target skills with AI recommendations"
        badge={
          <Badge className="inline-flex h-auto shrink-0 rounded bg-[#ef444420] px-2 py-0.5 text-[10px] font-medium text-red-400 shadow-none hover:bg-[#ef444420]">
            {MOCK_GAPS.length} gaps
          </Badge>
        }
      >
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-800" />)}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {MOCK_GAPS.map((gap) => {
              const reqStyle = ratingStyle(gap.required_level);
              const curStyle = ratingStyle(gap.current_level);
              return (
                <div key={gap.skill} className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-[#0f1318] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-200">{gap.skill}</p>
                      <p className="text-[11px] text-slate-500">{gap.category}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`inline-flex h-7 w-8 items-center justify-center rounded text-xs font-semibold tabular-nums ${curStyle.bg} ${curStyle.text}`}>
                          {gap.current_level ?? "—"}
                        </span>
                        <span className="text-[9px] text-slate-600">Current</span>
                      </div>
                      <span className="text-slate-700">→</span>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`inline-flex h-7 w-8 items-center justify-center rounded text-xs font-semibold tabular-nums ${reqStyle.bg} ${reqStyle.text}`}>
                          {gap.required_level}
                        </span>
                        <span className="text-[9px] text-slate-600">Target</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">{gap.recommendation}</p>
                  <div className="flex items-center gap-2">
                    <button type="button"
                      className="rounded border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
                      Book Training
                    </button>
                    <button type="button"
                      className="rounded border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-400 whitespace-nowrap">
                      Request Validation
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── AI Recommendations + Skills History (2-col on xl) ───────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* AI Recommendations */}
        <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex min-w-0 flex-col gap-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-semibold text-slate-200">AI Recommendations</h2>
                <p className="text-[11px] text-slate-500">Personalised skill actions to maximise your match score</p>
              </div>
              <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
              </Badge>
            </div>
            {loading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-gray-800 p-3">
                    <SkelLine w="w-48" h="h-3.5" /><div className="mt-2"><SkelLine w="w-full" h="h-2.5" /></div>
                  </div>
                ))}
              </div>
            ) : (
              <AiActionsPanel actions={AI_ACTIONS} />
            )}
          </CardContent>
        </Card>

        {/* Skills History */}
        <SectionCard title="Skills History" sub="Recent updates, validations and improvements">
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 py-2">
                  <div className="h-6 w-6 animate-pulse rounded-full bg-gray-800 shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5 pt-0.5"><SkelLine w="w-32" h="h-3" /><SkelLine w="w-48" h="h-2.5" /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative flex flex-col gap-0">
              <div className="absolute left-3 top-3 bottom-3 w-px bg-gray-800" />
              {MOCK_HISTORY.map((ev, i) => {
                const Icon = historyTypeIcon(ev.type);
                const cls  = historyTypeColor(ev.type);
                return (
                  <div key={i} className="relative flex items-start gap-3 py-3 pl-0">
                    <div className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${cls}`}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-slate-200">{ev.event}</p>
                        <span className="text-[11px] text-slate-600">{fmtDate(ev.date)}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-400">{ev.detail}</p>
                    </div>
                  </div>
                );
              })}
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
              { label: "Update Skill",       icon: Sparkles      },
              { label: "Add New Skill",      icon: PlusCircle    },
              { label: "Upload Evidence",    icon: Upload        },
              { label: "Request Validation", icon: Award         },
              { label: "Book Training",      icon: GraduationCap },
              { label: "Contact Manager",    icon: MessageSquare },
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
