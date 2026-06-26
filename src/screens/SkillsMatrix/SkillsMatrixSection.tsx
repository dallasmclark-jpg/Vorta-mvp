import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  CircleUser as UserCircle,
  Download,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { supabase } from "../../lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbEngineer {
  id: string;
  full_name: string;
  discipline: string;
  shift_pattern: string;
  department_id: string;
  department_name: string | null;
  skills_score: number;
  risk_level: string;
  training_count: number;
  critical_knowledge_holder: boolean;
  retirement_risk: string | null;
  leaving_risk: string | null;
}

interface DbSkill {
  id: string;
  name: string;
  category: string;
  is_critical: boolean;
}

interface DbAssignment {
  engineer_id: string;
  skill_id: string;
  validated_rating: number | null;
  manager_rating: number | null;
  self_rating: number | null;
  training_required: boolean;
  verification_status?: string;
}

interface DbGapRow {
  id: string;
  skill_name: string;
  skill_category: string;
  department_name: string | null;
  target_rating: number;
  current_average_rating: number;
  engineers_at_or_above_target: number;
  engineers_below_target: number;
  single_point_of_failure: boolean;
  risk_level: string;
  recommendation: string;
  snapshot_date: string;
}

interface DbRiskProfile {
  engineer_id: string;
  retirement_risk: string;
  leaving_risk: string;
  critical_knowledge_holder: boolean;
}

interface MatrixStats {
  totalEngineers: number;
  skillsAssessed: number;
  criticalGaps: number;
  trainingRequired: number;
  criticalHolders: number;
}

interface HeatmapRow {
  id: string;
  name: string;
  discipline: string;
  riskLevel: string;
  skillsScore: number;
  trainingCount: number;
  knowledgeHolder: boolean;
  ratings: Record<string, { rating: number | null; trainingRequired: boolean; verificationStatus?: string }>;
}

type ChipKey = "critical" | "training" | "expired" | "spof";

interface InsightItem {
  severity: "critical" | "high" | "medium";
  title: string;
  text: string;
  icon: React.ElementType;
  action?: { label: string; chipKey?: ChipKey; skillName?: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABLE_PAGE_SIZE = 10;

const CHIP_CONFIG: { key: ChipKey; label: string; activeClass: string; dotClass: string }[] = [
  { key: "critical",  label: "Critical Risk",           activeClass: "border-red-500/50 bg-red-500/10 text-red-400",      dotClass: "bg-red-500"     },
  { key: "training",  label: "Training Required",        activeClass: "border-orange-400/50 bg-orange-400/10 text-orange-300", dotClass: "bg-orange-400" },
  { key: "expired",   label: "Validation Expired",       activeClass: "border-yellow-400/50 bg-yellow-400/10 text-yellow-300", dotClass: "bg-yellow-400" },
  { key: "spof",      label: "Single Point of Failure",  activeClass: "border-blue-400/50 bg-blue-400/10 text-blue-300",    dotClass: "bg-blue-400"   },
];

const RATING_LABELS: Record<number, string> = {
  5: "Competent", 4: "Proficient", 3: "Developing", 2: "Basic", 1: "Gap",
};

const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskBadgeClass(level: string): string {
  switch (level) {
    case "critical": return "bg-[#ef444420] text-red-500";
    case "high":     return "bg-[#f9731620] text-orange-400";
    case "medium":   return "bg-[#facc1520] text-yellow-400";
    default:         return "bg-[#10b98120] text-emerald-500";
  }
}

function riskLabel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function ratingStyle(r: number | null): { bg: string; text: string } {
  switch (r) {
    case 5:  return { bg: "bg-emerald-500/20", text: "text-emerald-400" };
    case 4:  return { bg: "bg-blue-500/20",    text: "text-blue-400"    };
    case 3:  return { bg: "bg-yellow-400/20",  text: "text-yellow-300"  };
    case 2:  return { bg: "bg-orange-500/20",  text: "text-orange-400"  };
    case 1:  return { bg: "bg-red-500/20",     text: "text-red-400"     };
    default: return { bg: "bg-transparent",    text: "text-slate-700"   };
  }
}

function abbrev(name: string): string {
  const map: Record<string, string> = {
    "GMP": "GMP", "Data Integrity": "Data Int.", "SAP PM": "SAP PM",
    "Freeze Dryers": "Freeze Dry.", "Electrical Fault Finding": "Elec. Fault",
    "Allen Bradley PLC": "A-B PLC", "Groninger Filling Lines": "Groninger",
    "Bausch+Stroebel Filling Lines": "B+S Lines", "Bosch Vial Fillers": "Bosch Fill.",
    "Hydraulic Systems": "Hydraulics", "18th Edition": "18th Ed.",
    "Condition Monitoring": "Cond. Mon.",
  };
  return map[name] ?? (name.length > 10 ? `${name.slice(0, 9)}…` : name);
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchMatrix(): Promise<{
  engineers: DbEngineer[];
  heatmapSkills: DbSkill[];
  heatmapAssignments: DbAssignment[];
  skillGaps: DbGapRow[];
  riskProfiles: DbRiskProfile[];
  stats: MatrixStats;
}> {
  const { data, error } = await supabase.functions.invoke("skills-matrix-data");
  if (error || !data) {
    return {
      engineers: [], heatmapSkills: [], heatmapAssignments: [],
      skillGaps: [], riskProfiles: [],
      stats: { totalEngineers: 0, skillsAssessed: 0, criticalGaps: 0, trainingRequired: 0, criticalHolders: 0 },
    };
  }
  return {
    engineers:          (data.engineers          ?? []) as DbEngineer[],
    heatmapSkills:      (data.heatmapSkills      ?? []) as DbSkill[],
    heatmapAssignments: (data.heatmapAssignments ?? []) as DbAssignment[],
    skillGaps:          (data.skillGaps          ?? []) as DbGapRow[],
    riskProfiles:       (data.riskProfiles       ?? []) as DbRiskProfile[],
    stats: data.stats as MatrixStats,
  };
}

// ─── Build heatmap rows ───────────────────────────────────────────────────────

function buildHeatmap(engineers: DbEngineer[], assignments: DbAssignment[]): HeatmapRow[] {
  return [...engineers]
    .sort(
      (a, b) =>
        (RISK_ORDER[a.risk_level] ?? 9) - (RISK_ORDER[b.risk_level] ?? 9) ||
        a.full_name.localeCompare(b.full_name)
    )
    .map((eng) => {
      const ratings: HeatmapRow["ratings"] = {};
      for (const a of assignments) {
        if (a.engineer_id !== eng.id) continue;
        ratings[a.skill_id] = {
          rating: a.validated_rating ?? a.manager_rating ?? a.self_rating ?? null,
          trainingRequired: a.training_required,
          verificationStatus: a.verification_status,
        };
      }
      return {
        id: eng.id, name: eng.full_name, discipline: eng.discipline,
        riskLevel: eng.risk_level, skillsScore: eng.skills_score,
        trainingCount: eng.training_count, knowledgeHolder: eng.critical_knowledge_holder,
        ratings,
      };
    });
}

// ─── Skill Detail Drawer ──────────────────────────────────────────────────────

interface DrawerProps {
  skill: DbSkill | null;
  heatmapRows: HeatmapRow[];
  skillGaps: DbGapRow[];
  onClose: () => void;
}

function SkillDrawer({ skill, heatmapRows, skillGaps, onClose }: DrawerProps) {
  const isOpen = skill !== null;

  const { ratings, trainingCount, gapInfo, sorted } = useMemo(() => {
    if (!skill) return { ratings: [], trainingCount: 0, gapInfo: undefined, sorted: [] };
    const vals = heatmapRows
      .map((r) => ({ row: r, entry: r.ratings[skill.id] }))
      .filter((x) => x.entry?.rating != null);
    const ratingValues = vals.map((x) => x.entry.rating as number);
    const tc = heatmapRows.filter((r) => r.ratings[skill.id]?.trainingRequired).length;
    const gap = skillGaps.find((g) => g.skill_name === skill.name);
    const sortedVals = [...vals].sort(
      (a, b) => (b.entry.rating ?? 0) - (a.entry.rating ?? 0)
    );
    return { ratings: ratingValues, trainingCount: tc, gapInfo: gap, sorted: sortedVals };
  }, [skill, heatmapRows, skillGaps]);

  const avgRating =
    ratings.length > 0 ? (ratings.reduce((s, v) => s + v, 0) / ratings.length) : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((r) => ({
    r,
    count: ratings.filter((v) => v === r).length,
  }));

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-gray-800 bg-[#0d1117] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-800 p-5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-50">{skill?.name}</h2>
              {skill?.is_critical && (
                <Badge className="inline-flex h-auto rounded bg-[#ef444420] px-1.5 py-0.5 text-[10px] font-medium text-red-500 shadow-none hover:bg-[#ef444420]">
                  Critical
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-400">{skill?.category}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#ffffff10] hover:text-slate-200"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
          {[
            {
              label: "Avg Rating",
              value: avgRating > 0 ? avgRating.toFixed(1) : "—",
              sub: avgRating > 0 ? `/ 5.0` : "",
              valueClass:
                avgRating >= 4 ? "text-emerald-400"
                : avgRating >= 3 ? "text-yellow-400"
                : "text-red-400",
            },
            { label: "Assessed",     value: String(ratings.length),  sub: "engineers",  valueClass: "text-slate-50"   },
            { label: "Need Training", value: String(trainingCount),  sub: "engineers",  valueClass: trainingCount > 0 ? "text-orange-400" : "text-slate-50" },
          ].map(({ label, value, sub, valueClass }) => (
            <div key={label} className="flex flex-col gap-0.5 p-4">
              <p className="text-[11px] font-medium text-slate-500">{label}</p>
              <p className={`text-xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
              <p className="text-[10px] text-slate-600">{sub}</p>
            </div>
          ))}
        </div>

        {/* Rating distribution */}
        <div className="border-b border-gray-800 p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Rating Distribution
          </p>
          <div className="flex flex-col gap-1.5">
            {ratingDistribution.map(({ r, count }) => {
              const pct = ratings.length > 0 ? (count / ratings.length) * 100 : 0;
              const { bg, text } = ratingStyle(r);
              return (
                <div key={r} className="flex items-center gap-2">
                  <span className={`w-4 text-right text-xs font-semibold tabular-nums ${text}`}>{r}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-gray-800 h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${bg.replace('/20', '')}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-[11px] tabular-nums text-slate-500">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gap info */}
        {gapInfo && (
          <div className="border-b border-gray-800 bg-[#ef444408] p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-sm font-semibold text-red-500">Critical Skill Gap</p>
              {gapInfo.single_point_of_failure && (
                <Badge className="inline-flex h-auto rounded bg-[#ef444420] px-1.5 py-0.5 text-[10px] font-medium text-red-500 shadow-none hover:bg-[#ef444420]">
                  SPOF
                </Badge>
              )}
            </div>
            <p className="text-xs leading-relaxed text-slate-400">{gapInfo.recommendation}</p>
            <div className="mt-3 flex gap-4">
              <div>
                <p className="text-[10px] text-slate-600">Target</p>
                <p className="text-sm font-semibold text-slate-300">{gapInfo.target_rating}/5</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-600">Current Avg</p>
                <p className="text-sm font-semibold text-red-400">
                  {Number(gapInfo.current_average_rating).toFixed(1)}/5
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-600">Below Target</p>
                <p className="text-sm font-semibold text-orange-400">{gapInfo.engineers_below_target}</p>
              </div>
            </div>
          </div>
        )}

        {/* Engineer list */}
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-gray-800 bg-[#0d1117] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Engineers · sorted by rating
            </p>
          </div>
          <div className="flex flex-col divide-y divide-gray-800/50">
            {sorted.map(({ row, entry }) => {
              const { bg, text } = ratingStyle(entry?.rating ?? null);
              const isExpired =
                entry?.verificationStatus && entry.verificationStatus !== "validated";
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#ffffff05]"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${bg} ${text}`}
                    title={RATING_LABELS[entry?.rating ?? 0] ?? ""}
                  >
                    {entry?.rating ?? "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">{row.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{row.discipline}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {entry?.trainingRequired && (
                      <span className="rounded-full bg-orange-400/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
                        Training
                      </span>
                    )}
                    {isExpired && (
                      <span className="rounded-full bg-yellow-400/15 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">
                        Expired
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const SkillsMatrixSection = (): JSX.Element => {
  const [engineers,     setEngineers]     = useState<DbEngineer[]>([]);
  const [heatmapSkills, setHeatmapSkills] = useState<DbSkill[]>([]);
  const [heatmapRows,   setHeatmapRows]   = useState<HeatmapRow[]>([]);
  const [rawAssignments, setRawAssignments] = useState<DbAssignment[]>([]);
  const [skillGaps,     setSkillGaps]     = useState<DbGapRow[]>([]);
  const [riskProfiles,  setRiskProfiles]  = useState<DbRiskProfile[]>([]);
  const [stats,         setStats]         = useState<MatrixStats>({
    totalEngineers: 0, skillsAssessed: 0, criticalGaps: 0, trainingRequired: 0, criticalHolders: 0,
  });
  const [loading,       setLoading]       = useState(true);
  const [tick,          setTick]          = useState(0);

  // Drawer
  const [selectedSkill, setSelectedSkill] = useState<DbSkill | null>(null);

  // Filters
  const [search,       setSearch]       = useState("");
  const [filterRisk,   setFilterRisk]   = useState("all");
  const [filterDept,   setFilterDept]   = useState("all");
  const [activeChips,  setActiveChips]  = useState<Set<ChipKey>>(new Set());

  // Table pagination
  const [tablePage, setTablePage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMatrix().then(({ engineers: engs, heatmapSkills: sk, heatmapAssignments, skillGaps: gaps, riskProfiles: rp, stats: st }) => {
      if (cancelled) return;
      setEngineers(engs);
      setHeatmapSkills(sk);
      setHeatmapRows(buildHeatmap(engs, heatmapAssignments));
      setRawAssignments(heatmapAssignments);
      setSkillGaps(gaps);
      setRiskProfiles(rp);
      setStats(st);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tick]);

  // ── Chip filter sets ──────────────────────────────────────────────────────

  const expiredEngineerIds = useMemo(() => {
    const s = new Set<string>();
    for (const a of rawAssignments) {
      if (a.verification_status && a.verification_status !== "validated") s.add(a.engineer_id);
    }
    return s;
  }, [rawAssignments]);

  const spofDeptNames = useMemo(
    () => new Set(skillGaps.filter((g) => g.single_point_of_failure && g.department_name).map((g) => g.department_name!)),
    [skillGaps]
  );

  const engineerDeptMap = useMemo(
    () => new Map(engineers.map((e) => [e.id, e.department_name ?? ""])),
    [engineers]
  );

  // ── Filtered rows (heatmap + table) ─────────────────────────────────────

  const filteredRows = useMemo(() => {
    const lc = search.toLowerCase();
    return heatmapRows.filter((row) => {
      if (search && !row.name.toLowerCase().includes(lc) && !row.discipline.toLowerCase().includes(lc)) return false;
      if (filterRisk !== "all" && row.riskLevel !== filterRisk) return false;
      if (filterDept !== "all" && engineerDeptMap.get(row.id) !== filterDept) return false;
      if (activeChips.has("critical")  && row.riskLevel !== "critical")          return false;
      if (activeChips.has("training")  && row.trainingCount === 0)               return false;
      if (activeChips.has("expired")   && !expiredEngineerIds.has(row.id))       return false;
      if (activeChips.has("spof")      && !spofDeptNames.has(engineerDeptMap.get(row.id) ?? "")) return false;
      return true;
    });
  }, [heatmapRows, search, filterRisk, filterDept, engineerDeptMap, activeChips, expiredEngineerIds, spofDeptNames]);

  const filteredEngineers = useMemo(() => {
    const lc = search.toLowerCase();
    return engineers
      .filter((eng) => {
        if (search && !eng.full_name.toLowerCase().includes(lc) && !eng.discipline.toLowerCase().includes(lc)) return false;
        if (filterRisk !== "all" && eng.risk_level !== filterRisk) return false;
        if (filterDept !== "all" && eng.department_name !== filterDept) return false;
        if (activeChips.has("critical") && eng.risk_level !== "critical")             return false;
        if (activeChips.has("training") && eng.training_count === 0)                  return false;
        if (activeChips.has("expired")  && !expiredEngineerIds.has(eng.id))           return false;
        if (activeChips.has("spof")     && !spofDeptNames.has(eng.department_name ?? "")) return false;
        return true;
      })
      .sort((a, b) => (RISK_ORDER[a.risk_level] ?? 9) - (RISK_ORDER[b.risk_level] ?? 9) || a.full_name.localeCompare(b.full_name));
  }, [engineers, search, filterRisk, filterDept, activeChips, expiredEngineerIds, spofDeptNames]);

  // Chip counts (unfiltered, just by chip criteria)
  const chipCounts = useMemo<Record<ChipKey, number>>(() => ({
    critical: heatmapRows.filter((r) => r.riskLevel === "critical").length,
    training: heatmapRows.filter((r) => r.trainingCount > 0).length,
    expired:  heatmapRows.filter((r) => expiredEngineerIds.has(r.id)).length,
    spof:     heatmapRows.filter((r) => spofDeptNames.has(engineerDeptMap.get(r.id) ?? "")).length,
  }), [heatmapRows, expiredEngineerIds, spofDeptNames, engineerDeptMap]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const toggleChip = (chip: ChipKey) => {
    setTablePage(0);
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip); else next.add(chip);
      return next;
    });
  };

  const resetFilters = () => {
    setSearch(""); setFilterRisk("all"); setFilterDept("all");
    setActiveChips(new Set()); setTablePage(0);
  };

  const departments = useMemo(
    () => [...new Set(engineers.map((e) => e.department_name).filter(Boolean))].sort() as string[],
    [engineers]
  );

  const totalTablePages = Math.ceil(filteredEngineers.length / TABLE_PAGE_SIZE);
  const pagedEngineers  = filteredEngineers.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);

  const teamAvg = filteredRows.length > 0
    ? Math.round(filteredRows.reduce((s, r) => s + r.skillsScore, 0) / filteredRows.length)
    : 0;

  // Group heatmap skills by category
  const categoryGroups = heatmapSkills.reduce<Record<string, DbSkill[]>>((acc, sk) => {
    (acc[sk.category] ??= []).push(sk);
    return acc;
  }, {});

  // ── AI Insights with actions ──────────────────────────────────────────────

  const insights = useMemo<InsightItem[]>(() => {
    const items: InsightItem[] = [];

    const spof = skillGaps.filter((g) => g.single_point_of_failure);
    if (spof.length > 0) {
      const names = spof.slice(0, 2).map((g) => g.skill_name).join(", ");
      items.push({
        severity: "critical",
        title: `${spof.length} single points of failure detected`,
        text: `${names}${spof.length > 2 ? ` +${spof.length - 2} more` : ""} — loss of one engineer creates a critical coverage gap.`,
        icon: Zap,
        action: { label: "Filter Engineers", chipKey: "spof" },
      });
    }

    const highRiskHolders = riskProfiles.filter(
      (p) => p.critical_knowledge_holder && (p.retirement_risk === "high" || p.leaving_risk === "high")
    );
    if (highRiskHolders.length > 0) {
      items.push({
        severity: "critical",
        title: `${highRiskHolders.length} knowledge holders at high attrition risk`,
        text: `Critical expertise may exit without succession cover. Initiate knowledge transfer plans within 30 days.`,
        icon: Shield,
        action: { label: "View Critical Risk", chipKey: "critical" },
      });
    }

    const trainingPct =
      stats.skillsAssessed > 0
        ? Math.round((stats.trainingRequired / stats.skillsAssessed) * 100)
        : 0;
    if (trainingPct > 0) {
      items.push({
        severity: trainingPct > 70 ? "high" : "medium",
        title: `${trainingPct}% of skill assessments require training`,
        text: `${stats.trainingRequired.toLocaleString()} training needs logged. Prioritise SPOF and critical gap areas first to reduce site risk.`,
        icon: Brain,
        action: { label: "Filter Training", chipKey: "training" },
      });
    }

    const worst = [...skillGaps].sort(
      (a, b) => Number(a.current_average_rating) - Number(b.current_average_rating)
    )[0];
    if (worst) {
      items.push({
        severity: "critical",
        title: `${worst.skill_name} is the lowest-rated critical skill`,
        text: `Avg ${Number(worst.current_average_rating).toFixed(1)}/5 vs target ${worst.target_rating} — ${worst.engineers_below_target} engineers below level. ${worst.recommendation}`,
        icon: TrendingUp,
        action: { label: "View Skill", skillName: worst.skill_name },
      });
    }

    return items.slice(0, 4);
  }, [skillGaps, riskProfiles, stats]);

  // Action dispatcher
  const handleInsightAction = (ins: InsightItem) => {
    if (ins.action?.chipKey) {
      toggleChip(ins.action.chipKey);
    } else if (ins.action?.skillName) {
      const sk = heatmapSkills.find((s) => s.name === ins.action!.skillName);
      if (sk) setSelectedSkill(sk);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="relative flex w-full flex-1 grow flex-col items-start gap-8 px-6 pb-12 pt-0 lg:px-8">

      {/* Skill Detail Drawer */}
      <SkillDrawer
        skill={selectedSkill}
        heatmapRows={heatmapRows}
        skillGaps={skillGaps}
        onClose={() => setSelectedSkill(null)}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-1">
          <p className="text-xs font-medium text-slate-500">Alpha Manufacturing</p>
          <h1 className="mt-[-1.00px] font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50">
            Skills Matrix
          </h1>
          <p className="text-sm text-slate-400">Engineer Skills &amp; Coverage Overview</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Sparkles className="h-4 w-4" /> Generate AI Report
          </Button>
          <button type="button" onClick={() => setTick((t) => t + 1)} disabled={loading} className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-50">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <UserCircle className="h-8 w-8" />
          </button>
        </div>
      </header>

      <div className="flex w-full flex-col items-start gap-6">

        {/* ── KPI cards ──────────────────────────────────────────────────────── */}
        <section className="grid w-full grid-cols-2 gap-4 xl:grid-cols-5">
          {[
            { label: "Total Engineers",    value: String(stats.totalEngineers),                 sub: `${stats.criticalHolders} knowledge holders`,   icon: Users,          valueClass: "text-slate-50"   },
            { label: "Skills Assessed",    value: stats.skillsAssessed.toLocaleString(),        sub: "Individual skill records",                       icon: BookOpen,       valueClass: "text-slate-50"   },
            { label: "Critical Skill Gaps", value: String(stats.criticalGaps),                 sub: "Across all departments",                         icon: AlertTriangle,  valueClass: stats.criticalGaps > 0 ? "text-red-500" : "text-emerald-400" },
            { label: "Training Required",  value: stats.trainingRequired.toLocaleString(),      sub: `${stats.skillsAssessed > 0 ? Math.round((stats.trainingRequired / stats.skillsAssessed) * 100) : 0}% of records`, icon: TrendingUp, valueClass: "text-orange-400" },
            { label: "Knowledge Holders",  value: String(stats.criticalHolders),                sub: "Critical SMEs",                                  icon: Shield,         valueClass: "text-blue-400"   },
          ].map(({ label, value, sub, icon: Icon, valueClass }) => (
            <Card key={label} className="h-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">{label}</p>
                  <Icon className="h-4 w-4 text-slate-600" />
                </div>
                <p className={`text-xl font-semibold ${valueClass}`}>{loading ? "—" : value}</p>
                <p className="text-[11px] text-slate-500">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── Critical Gaps + AI Insights ────────────────────────────────────── */}
        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">

          {/* Critical Skill Gaps */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-50">Critical Skill Gaps</h2>
                <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#ef444420] px-2 py-1 text-xs font-medium text-red-500 shadow-none hover:bg-[#ef444420]">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {loading ? "…" : `${stats.criticalGaps} critical`}
                </Badge>
              </div>
              <div className="flex flex-col divide-y divide-gray-800">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 py-3">
                        <div className="h-4 w-40 animate-pulse rounded bg-gray-800" />
                        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-800" />
                      </div>
                    ))
                  : skillGaps.slice(0, 8).map((gap) => (
                      <div key={gap.id} className="flex flex-wrap items-start gap-3 py-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const sk = heatmapSkills.find((s) => s.name === gap.skill_name);
                                if (sk) setSelectedSkill(sk);
                              }}
                              className="text-sm font-semibold text-slate-50 transition-colors hover:text-blue-400"
                            >
                              {gap.skill_name}
                            </button>
                            {gap.single_point_of_failure && (
                              <Badge className="inline-flex h-auto rounded bg-[#ef444420] px-1.5 py-0.5 text-[10px] font-medium text-red-500 shadow-none hover:bg-[#ef444420]">
                                SPOF
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {gap.department_name ?? gap.skill_category} · {gap.engineers_below_target} below target
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <p className="text-sm font-semibold text-red-400 tabular-nums">
                            {Number(gap.current_average_rating).toFixed(1)}
                            <span className="text-xs text-slate-600">/{gap.target_rating}</span>
                          </p>
                          <p className="text-[10px] text-slate-600">avg/target</p>
                        </div>
                      </div>
                    ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-50">AI Insights</h2>
                <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
                </Badge>
              </div>
              <div className="flex flex-col gap-3">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-lg border border-gray-800 p-4">
                        <div className="h-4 w-48 animate-pulse rounded bg-gray-800" />
                        <div className="mt-2 h-3 w-full animate-pulse rounded bg-gray-800/60" />
                      </div>
                    ))
                  : insights.map((ins, i) => {
                      const conf =
                        ins.severity === "critical"
                          ? { bg: "bg-[#ef444408]", border: "border-red-500/20",    icon: "text-red-500",    title: "text-red-400"    }
                          : ins.severity === "high"
                          ? { bg: "bg-[#f9731608]", border: "border-orange-400/20", icon: "text-orange-400", title: "text-orange-300" }
                          : { bg: "bg-[#facc1508]", border: "border-yellow-400/20", icon: "text-yellow-400", title: "text-yellow-300" };
                      const Icon = ins.icon;
                      return (
                        <div key={i} className={`flex flex-col gap-3 rounded-lg border ${conf.border} ${conf.bg} p-4`}>
                          <div className="flex items-start gap-2.5">
                            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${conf.icon}`} />
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-semibold ${conf.title}`}>{ins.title}</p>
                              <p className="mt-1 text-xs leading-relaxed text-slate-400">{ins.text}</p>
                            </div>
                          </div>
                          {ins.action && (
                            <button
                              type="button"
                              onClick={() => handleInsightAction(ins)}
                              className={`self-start rounded-lg border ${conf.border} px-3 py-1.5 text-xs font-medium ${conf.title} transition-colors hover:bg-[#ffffff08]`}
                            >
                              {ins.action.label} →
                            </button>
                          )}
                        </div>
                      );
                    })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Heatmap ─────────────────────────────────────────────────────────── */}
        <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-4 p-5">

            {/* Card header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-50">Engineer Skills Heatmap</h2>
                <p className="text-sm text-slate-400">
                  {heatmapSkills.length} core skills · {filteredRows.length}/{heatmapRows.length} engineers shown
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(search || filterRisk !== "all" || filterDept !== "all" || activeChips.size > 0) && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-200"
                  >
                    Clear filters
                  </button>
                )}
                <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
                </Badge>
              </div>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search engineer…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setTablePage(0); }}
                  className="h-8 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
              <select
                value={filterRisk}
                onChange={(e) => { setFilterRisk(e.target.value); setTablePage(0); }}
                className="h-8 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-300 focus:outline-none"
              >
                <option value="all">All Risk Levels</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                value={filterDept}
                onChange={(e) => { setFilterDept(e.target.value); setTablePage(0); }}
                className="h-8 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-300 focus:outline-none"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Quick filter chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-slate-600">Quick filters:</span>
              {CHIP_CONFIG.map(({ key, label, activeClass, dotClass }) => {
                const isActive = activeChips.has(key);
                const count = chipCounts[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleChip(key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      isActive
                        ? activeClass
                        : "border-gray-800 bg-transparent text-slate-500 hover:border-gray-700 hover:text-slate-300"
                    }`}
                  >
                    {isActive && <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />}
                    {label}
                    {count > 0 && (
                      <span className={`rounded-full px-1 text-[10px] tabular-nums ${isActive ? "bg-white/10" : "bg-gray-800"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Heatmap — bounded height, dual scroll, sticky headers + sticky first col */}
            <div className="max-h-[56vh] overflow-x-auto overflow-y-auto rounded-lg border border-gray-800">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  {/* Row 1: category group headers — sticky at top */}
                  <tr className="sticky top-0 z-30">
                    <th className="sticky left-0 top-0 z-40 min-w-[180px] bg-[#0f1318] px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Engineer
                    </th>
                    <th className="min-w-[76px] bg-[#0f1318] px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Risk</th>
                    <th className="min-w-[56px] bg-[#0f1318] px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Score</th>
                    {Object.entries(categoryGroups).map(([cat, catSkills]) => (
                      <th key={cat} colSpan={catSkills.length} className="border-l border-gray-800 bg-[#0f1318] px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-blue-400/70">
                        {cat}
                      </th>
                    ))}
                  </tr>
                  {/* Row 2: individual skill name headers — sticky below row 1 */}
                  <tr className="sticky top-10 z-30">
                    <th className="sticky left-0 top-10 z-40 bg-[#0b0e14] px-4 py-2" />
                    <th className="bg-[#0b0e14] px-2 py-2" />
                    <th className="bg-[#0b0e14] px-2 py-2" />
                    {heatmapSkills.map((sk, i) => {
                      const isFirst = i === 0 || heatmapSkills[i - 1].category !== sk.category;
                      return (
                        <th
                          key={sk.id}
                          title={sk.name}
                          onClick={() => setSelectedSkill(sk)}
                          className={`min-w-[56px] cursor-pointer bg-[#0b0e14] px-1 py-2 text-center text-[10px] font-medium text-slate-400 transition-colors hover:bg-[#1a2030] hover:text-blue-400 ${
                            isFirst ? "border-l border-gray-800" : ""
                          }`}
                        >
                          {abbrev(sk.name)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {loading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                          <td className="sticky left-0 z-10 bg-[#141820] px-4 py-3">
                            <div className="h-4 w-36 animate-pulse rounded bg-gray-800" />
                            <div className="mt-1 h-3 w-24 animate-pulse rounded bg-gray-800/50" />
                          </td>
                          <td className="px-2 py-3"><div className="mx-auto h-5 w-14 animate-pulse rounded bg-gray-800" /></td>
                          <td className="px-2 py-3"><div className="mx-auto h-4 w-10 animate-pulse rounded bg-gray-800" /></td>
                          {Array.from({ length: heatmapSkills.length || 10 }).map((_, j) => (
                            <td key={j} className="px-1 py-3"><div className="mx-auto h-7 w-10 animate-pulse rounded bg-gray-800/40" /></td>
                          ))}
                        </tr>
                      ))
                    : filteredRows.length === 0
                    ? (
                        <tr>
                          <td colSpan={3 + heatmapSkills.length} className="py-12 text-center text-sm text-slate-500">
                            No engineers match the current filters.{" "}
                            <button type="button" onClick={resetFilters} className="font-medium text-blue-400 hover:underline">
                              Clear filters
                            </button>
                          </td>
                        </tr>
                      )
                    : filteredRows.map((row, idx) => {
                        const rowBg = idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                        const scoreColor = row.skillsScore >= 80 ? "text-emerald-400" : row.skillsScore >= 68 ? "text-yellow-400" : "text-red-400";
                        return (
                          <tr key={row.id} className={`border-b border-gray-800/50 ${rowBg} transition-colors hover:bg-[#1a2030]`}>
                            {/* Sticky engineer name */}
                            <td className={`sticky left-0 z-10 min-w-[180px] px-4 py-2.5 ${rowBg}`}>
                              <div className="flex items-center gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-medium leading-tight text-slate-200">{row.name}</p>
                                  <p className="mt-0.5 truncate text-[11px] leading-tight text-slate-500">{row.discipline}</p>
                                </div>
                                {row.knowledgeHolder && (
                                  <Shield className="ml-auto h-3 w-3 shrink-0 text-blue-400" title="Critical knowledge holder" />
                                )}
                              </div>
                            </td>

                            <td className="px-2 py-2.5 text-center">
                              <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeClass(row.riskLevel)}`}>
                                {riskLabel(row.riskLevel)}
                              </Badge>
                            </td>

                            <td className={`px-2 py-2.5 text-center text-xs font-semibold tabular-nums ${scoreColor}`}>
                              {row.skillsScore}%
                            </td>

                            {/* Skill rating cells with tooltips */}
                            {heatmapSkills.map((sk, i) => {
                              const isFirst = i === 0 || heatmapSkills[i - 1].category !== sk.category;
                              const entry = row.ratings[sk.id];
                              const { bg, text } = ratingStyle(entry?.rating ?? null);
                              const label = entry?.rating != null ? String(entry.rating) : "—";
                              const ratingDesc = entry?.rating != null ? RATING_LABELS[entry.rating] : "Not assessed";
                              const isExpired =
                                entry?.verificationStatus &&
                                entry.verificationStatus !== "validated";

                              return (
                                <td
                                  key={sk.id}
                                  className={`px-1 py-2 text-center ${isFirst ? "border-l border-gray-800" : ""}`}
                                >
                                  {/* Cell with tooltip */}
                                  <div className="group/cell relative mx-auto inline-flex">
                                    <div
                                      onClick={() => setSelectedSkill(sk)}
                                      className={`relative flex h-7 w-10 cursor-pointer items-center justify-center rounded text-xs font-semibold tabular-nums transition-opacity hover:opacity-80 ${bg} ${text}`}
                                    >
                                      {label}
                                      {entry?.trainingRequired && entry.rating != null && (
                                        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-orange-400" />
                                      )}
                                      {isExpired && (
                                        <span className="absolute -bottom-0.5 -left-0.5 h-1.5 w-1.5 rounded-full bg-yellow-400" />
                                      )}
                                    </div>
                                    {/* Tooltip */}
                                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-gray-700 bg-[#1a2030] px-3 py-2 text-left shadow-xl opacity-0 transition-opacity group-hover/cell:opacity-100">
                                      <p className="text-xs font-semibold text-slate-100">{sk.name}</p>
                                      <p className="mt-0.5 text-[11px] text-slate-400">{row.name}</p>
                                      <div className="mt-1.5 flex items-center gap-2">
                                        <span className={`text-xs font-semibold ${text}`}>{label}/5</span>
                                        <span className="text-[11px] text-slate-500">{ratingDesc}</span>
                                      </div>
                                      {entry?.trainingRequired && (
                                        <p className="mt-0.5 text-[10px] text-orange-400">Training required</p>
                                      )}
                                      {isExpired && (
                                        <p className="mt-0.5 text-[10px] text-yellow-400">Validation expired</p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                </tbody>

                {/* Team average footer */}
                {!loading && filteredRows.length > 0 && (
                  <tfoot>
                    <tr className="sticky bottom-0 z-20 border-t border-gray-800 bg-[#0f1318]">
                      <td className="sticky left-0 z-30 bg-[#0f1318] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Team Avg</td>
                      <td className="px-2 py-2" />
                      <td className="px-2 py-2 text-center text-xs font-semibold tabular-nums text-slate-400">{teamAvg}%</td>
                      {heatmapSkills.map((sk, i) => {
                        const isFirst = i === 0 || heatmapSkills[i - 1].category !== sk.category;
                        const vals = filteredRows.map((r) => r.ratings[sk.id]?.rating ?? null).filter((v): v is number => v !== null);
                        const avg = vals.length > 0 ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : "—";
                        const num = parseFloat(avg);
                        const color = isNaN(num) ? "text-slate-600" : num >= 4 ? "text-blue-400" : num >= 3 ? "text-yellow-400" : "text-red-400";
                        return (
                          <td key={sk.id} className={`px-1 py-2 text-center text-xs font-semibold tabular-nums ${color} ${isFirst ? "border-l border-gray-800" : ""}`}>
                            {avg}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
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
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="relative inline-flex h-5 w-7 items-center justify-center rounded bg-yellow-400/20 text-[11px] font-semibold text-yellow-300">
                  3<span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-orange-400" />
                </span>
                Training
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="relative inline-flex h-5 w-7 items-center justify-center rounded bg-yellow-300/20 text-[11px] font-semibold text-yellow-300">
                  3<span className="absolute -bottom-0.5 -left-0.5 h-1.5 w-1.5 rounded-full bg-yellow-400" />
                </span>
                Expired
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Shield className="h-3.5 w-3.5 text-blue-400" /> SME
              </span>
              <span className="ml-auto text-[11px] text-slate-600">Click any cell or header to view skill details</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Engineer Detail Table ──────────────────────────────────────────── */}
        <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-50">Engineer Detail</h2>
                <p className="text-sm text-slate-400">
                  {filteredEngineers.length} engineers · page {Math.min(tablePage + 1, totalTablePages || 1)} of {totalTablePages || 1}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setTablePage((p) => Math.max(0, p - 1))} disabled={tablePage === 0 || loading} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setTablePage((p) => Math.min(totalTablePages - 1, p + 1))} disabled={tablePage >= totalTablePages - 1 || loading} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0f1318]">
                    {["Engineer", "Discipline", "Department", "Shift", "Score", "Risk", "Training Gaps", "SME"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 first:sticky first:left-0 first:z-10 first:bg-[#0f1318] first:min-w-[150px]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: TABLE_PAGE_SIZE }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-gray-800" /></td>
                          ))}
                        </tr>
                      ))
                    : pagedEngineers.map((eng, idx) => {
                        const rowBg = idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                        const scoreColor = eng.skills_score >= 80 ? "text-emerald-400" : eng.skills_score >= 68 ? "text-yellow-400" : "text-red-400";
                        return (
                          <tr key={eng.id} className={`border-b border-gray-800/50 ${rowBg} transition-colors hover:bg-[#1a2030]`}>
                            <td className={`sticky left-0 z-10 min-w-[150px] px-4 py-2.5 ${rowBg}`}>
                              <span className="font-medium text-slate-200">{eng.full_name}</span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-400">{eng.discipline}</td>
                            <td className="px-4 py-2.5 text-slate-400">{eng.department_name ?? "—"}</td>
                            <td className="px-4 py-2.5 text-slate-400">{eng.shift_pattern}</td>
                            <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${scoreColor}`}>{eng.skills_score}%</td>
                            <td className="px-4 py-2.5">
                              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeClass(eng.risk_level)}`}>
                                {riskLabel(eng.risk_level)}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {eng.training_count > 0
                                ? <span className="font-semibold text-orange-400">{eng.training_count}</span>
                                : <span className="text-slate-600">0</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {eng.critical_knowledge_holder
                                ? <Shield className="mx-auto h-4 w-4 text-blue-400" title="Critical knowledge holder" />
                                : <span className="text-slate-700">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            {/* Pagination dots */}
            {!loading && totalTablePages > 1 && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {tablePage * TABLE_PAGE_SIZE + 1}–{Math.min((tablePage + 1) * TABLE_PAGE_SIZE, filteredEngineers.length)} of {filteredEngineers.length}
                </span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalTablePages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTablePage(i)}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
                        i === tablePage
                          ? "bg-blue-500/20 font-semibold text-blue-400"
                          : "text-slate-500 hover:bg-[#ffffff1a]"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </section>
  );
};
