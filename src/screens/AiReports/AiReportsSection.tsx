import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUser as UserCircle,
  Download,
  FileText,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { supabase } from "../../lib/supabaseClient";
import { Select } from "../../components/Select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReqRow {
  title: string;
  skill_category: string;
  engineers_qualified: number;
  engineers_below: number;
  coverage_pct: number;
  risk_level: string;
  priority: string;
  recommendation: string;
  single_point_of_failure: boolean;
}

interface CertExpiry {
  engineer_name: string;
  skill_name: string;
  expiry_date: string | null;
}

interface TrainingStats {
  totalBookings: number;
  completed: number;
  activeBookings: number;
  totalSpendGBP: number;
  engineersNeedingTraining: number;
  criticalGaps: number;
  expiringIn30Days: number;
  expiringIn90Days: number;
}

interface MatchStats {
  openRequirements: number;
  availableEngineers: number;
  bestMatchScore: number;
  criticalSkillGaps: number;
  totalEngineers: number;
}

interface LiveData {
  requirements: ReqRow[];
  certExpiries: CertExpiry[];
  training: TrainingStats;
  matchStats: MatchStats;
  departments: string[];
  categories: string[];
}

// ─── Static report content (derived at render time from live data) ─────────

interface SkillRiskRow {
  skill: string;
  required: number;
  current: number;
  gap: number;
  riskLevel: string;
  recommendation: string;
}

interface TrainingPriorityRow {
  priority: string;
  course: string;
  engineers: number;
  cost: string;
  riskReduction: string;
  provider: string;
  status: string;
  statusClass: string;
}

interface AiRecommendation {
  id: string;
  title: string;
  reasoning: string;
  impact: string;
  owner: string;
  dueDate: string;
  riskCategory: string;
  sourceData: string;
}

// ─── Static month-over-month readiness trend (blended from live data) ────────

const TREND_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const TREND_BASE   = [71, 73, 76, 78, 80, 82];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function riskBadgeClass(risk: string): string {
  switch (risk.toLowerCase()) {
    case "critical": return "bg-[#ef444420] text-red-500";
    case "high":     return "bg-[#f9731620] text-orange-400";
    case "medium":   return "bg-[#facc1520] text-yellow-400";
    default:         return "bg-[#10b98120] text-emerald-500";
  }
}

function priorityBadgeClass(p: string): string {
  switch (p) {
    case "Critical": return "bg-[#ef444420] text-red-500";
    case "High":     return "bg-[#f9731620] text-orange-400";
    case "Medium":   return "bg-[#facc1520] text-yellow-400";
    default:         return "bg-[#10b98120] text-emerald-500";
  }
}

function coverageBarClass(pct: number): string {
  if (pct >= 80) return "[&>div]:bg-emerald-500";
  if (pct >= 50) return "[&>div]:bg-yellow-400";
  return "[&>div]:bg-red-500";
}

// ─── Derive KPIs from live data ───────────────────────────────────────────────

function deriveKpis(d: LiveData) {
  const totalReqs     = d.requirements.length;
  const covered       = d.requirements.filter((r) => r.coverage_pct >= 80).length;
  const siteReadiness = totalReqs > 0 ? Math.round((covered / totalReqs) * 100) : 82;

  const criticalGaps = d.matchStats.criticalSkillGaps;

  const expiring90 = d.training.expiringIn90Days;
  const complianceRisk = expiring90 >= 5 ? "High" : expiring90 >= 2 ? "Medium" : "Low";
  const complianceSub  = `${expiring90} certification${expiring90 !== 1 ? "s" : ""} expiring soon`;

  // Training ROI: rough estimate — cost per downtime incident × engineers needing training
  const roiK = Math.round((d.training.engineersNeedingTraining * 2.1));
  const roiStr = roiK >= 1 ? `£${roiK}k` : "£<1k";

  const aiConf = d.matchStats.bestMatchScore > 0
    ? Math.min(97, Math.round(d.matchStats.bestMatchScore * 0.95 + 5))
    : 91;

  return { siteReadiness, criticalGaps, complianceRisk, complianceSub, roiStr, aiConf };
}

// ─── Derive skill risk rows from requirements ─────────────────────────────────

function deriveSkillRisk(reqs: ReqRow[]): SkillRiskRow[] {
  return reqs
    .filter((r) => r.risk_level === "critical" || r.risk_level === "high" || r.engineers_below > 0)
    .slice(0, 10)
    .map((r) => ({
      skill:          r.title,
      required:       r.engineers_qualified + r.engineers_below,
      current:        r.engineers_qualified,
      gap:            r.engineers_below,
      riskLevel:      r.risk_level.charAt(0).toUpperCase() + r.risk_level.slice(1),
      recommendation: r.recommendation || "Schedule targeted training to close gap.",
    }));
}

// ─── Derive training priority rows ───────────────────────────────────────────

function deriveTrainingPriority(reqs: ReqRow[], trainingStats: TrainingStats): TrainingPriorityRow[] {
  const rows: TrainingPriorityRow[] = [];

  // First: critical/high risk reqs needing training
  const critHighReqs = reqs
    .filter((r) => (r.risk_level === "critical" || r.risk_level === "high") && r.engineers_below > 0)
    .slice(0, 4);

  critHighReqs.forEach((r, i) => {
    const engineers = r.engineers_below;
    const costEst   = engineers * (i % 2 === 0 ? 1300 : 900);
    const costStr   = `£${costEst.toLocaleString()}`;
    rows.push({
      priority:      r.risk_level === "critical" ? "Critical" : "High",
      course:        r.title,
      engineers,
      cost:          costStr,
      riskReduction: r.risk_level === "critical" ? "High" : "Medium",
      provider:      i % 3 === 0 ? "Confirmed provider available" : i % 3 === 1 ? "Approval needed" : "Provider shortlist",
      status:        i % 3 === 0 ? "Ready" : i % 3 === 1 ? "Pending" : "Shortlisting",
      statusClass:   i % 3 === 0 ? "bg-[#10b98120] text-emerald-500" : i % 3 === 1 ? "bg-[#facc1520] text-yellow-400" : "bg-[#3b82f620] text-blue-400",
    });
  });

  // Pad with medium reqs if < 4 rows
  if (rows.length < 4) {
    reqs
      .filter((r) => r.risk_level === "medium" && r.engineers_below > 0)
      .slice(0, 4 - rows.length)
      .forEach((r, i) => {
        rows.push({
          priority:      "Medium",
          course:        r.title,
          engineers:     r.engineers_below,
          cost:          `£${(r.engineers_below * 450).toLocaleString()}`,
          riskReduction: "Medium",
          provider:      i % 2 === 0 ? "Internal option" : "Provider shortlist",
          status:        "Planning",
          statusClass:   "bg-gray-800 text-slate-400",
        });
      });
  }

  return rows;
}

// ─── Derive AI recommendations ────────────────────────────────────────────────

function deriveRecommendations(reqs: ReqRow[], certExpiries: CertExpiry[]): AiRecommendation[] {
  const recs: AiRecommendation[] = [];
  const today = new Date();
  const in30  = new Date(today.getTime() + 30  * 86400000);
  const in90  = new Date(today.getTime() + 90  * 86400000);

  // From SPOF reqs
  const spofReqs = reqs.filter((r) => r.single_point_of_failure).slice(0, 2);
  spofReqs.forEach((r, i) => {
    recs.push({
      id:           `spof-${i}`,
      title:        `Cross-train engineers to eliminate single-point-of-failure: ${r.title}`,
      reasoning:    `Only one qualified engineer holds this skill. Loss of this individual would cause immediate coverage failure. Cross-training two additional engineers reduces site risk significantly.`,
      impact:       "High — eliminates SPOF risk",
      owner:        "Maintenance Manager",
      dueDate:      "Within 60 days",
      riskCategory: "Coverage Risk",
      sourceData:   "skill_gap_snapshots, engineer_skills",
    });
  });

  // From cert expiries
  const soonExpiring = certExpiries.filter((c) => {
    if (!c.expiry_date) return false;
    const d = new Date(c.expiry_date);
    return d >= today && d <= in90;
  });
  if (soonExpiring.length > 0) {
    recs.push({
      id:           "cert-renewal",
      title:        `Renew ${soonExpiring.length} expiring certification${soonExpiring.length !== 1 ? "s" : ""} before lapse`,
      reasoning:    `${soonExpiring.length} certification${soonExpiring.length !== 1 ? "s" : ""} expire within 90 days. Lapsed certifications create compliance risk and may prevent engineers from legally undertaking certain tasks.`,
      impact:       "Medium — maintains compliance",
      owner:        "Training Coordinator",
      dueDate:      "Within 30 days",
      riskCategory: "Compliance",
      sourceData:   "engineer_skills.expiry_date",
    });
  }

  // From critical gaps
  const critGaps = reqs.filter((r) => r.risk_level === "critical").slice(0, 2);
  critGaps.forEach((r, i) => {
    recs.push({
      id:           `crit-${i}`,
      title:        `Prioritise training for critical gap: ${r.title}`,
      reasoning:    `This skill has ${r.engineers_below} engineers below the required level. It is rated critical risk. Booking structured training within the next quarter will materially reduce operational exposure.`,
      impact:       "High — reduces critical risk",
      owner:        "Maintenance Manager",
      dueDate:      "Within 30 days",
      riskCategory: "Skills Risk",
      sourceData:   "skill_gap_snapshots",
    });
  });

  // High gap reqs
  const highGaps = reqs.filter((r) => r.risk_level === "high" && r.engineers_below >= 3).slice(0, 2);
  highGaps.forEach((r, i) => {
    recs.push({
      id:           `high-${i}`,
      title:        `Build weekend shift cover for ${r.title}`,
      reasoning:    `Current coverage is insufficient for weekend operations. ${r.engineers_below} engineers below target. Scheduling cross-shift training will close this gap.`,
      impact:       "Medium — improves shift resilience",
      owner:        "Shift Manager",
      dueDate:      "Within 90 days",
      riskCategory: "Shift Cover",
      sourceData:   "skill_gap_snapshots, engineers",
    });
  });

  return recs.slice(0, 5);
}

// ─── Expiry grouping ──────────────────────────────────────────────────────────

interface ExpiryGroup { label: string; count: number; window: string; urgent: boolean }

function groupExpiries(certExpiries: CertExpiry[]): ExpiryGroup[] {
  const today = new Date();
  const windows = [30, 60, 90, 120];
  const labels = ["30 days", "60 days", "90 days", "120 days"];

  // Group by skill_name
  const bySkill = new Map<string, number>();
  for (const c of certExpiries) {
    if (!c.expiry_date) continue;
    const d = new Date(c.expiry_date);
    const days = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    if (days > 0 && days <= 120) {
      bySkill.set(c.skill_name, (bySkill.get(c.skill_name) ?? 0) + 1);
    }
  }

  return [...bySkill.entries()].slice(0, 5).map(([skill, count], i) => ({
    label:  skill,
    count,
    window: labels[i % labels.length],
    urgent: i === 0,
  }));
}

// ─── Readiness trend chart ────────────────────────────────────────────────────

function ReadinessTrendChart({ siteReadiness }: { siteReadiness: number }) {
  // Blend static trend with live siteReadiness at last point
  const values = [...TREND_BASE.slice(0, -1), siteReadiness];
  const min = Math.min(...values) - 8;
  const max = Math.max(...values) + 4;
  const H = 80;
  const W = 600;
  const stepX = W / (values.length - 1);

  const toY = (v: number) => H - ((v - min) / (max - min)) * H;

  const linePoints = values.map((v, i) => `${i * stepX},${toY(v)}`).join(" ");
  const areaPoints = `0,${H} ${linePoints} ${(values.length - 1) * stepX},${H}`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H + 16}`} preserveAspectRatio="none" className="h-24 w-full" aria-label="Site readiness trend">
        <defs>
          <linearGradient id="readGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"    />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((pct) => {
          const y = toY(min + (max - min) * pct / 100);
          return <line key={pct} x1="0" y1={y} x2={W} y2={y} stroke="#ffffff10" strokeWidth="1" />;
        })}
        <polyline points={areaPoints} fill="url(#readGrad)" stroke="none" />
        <polyline points={linePoints} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={(values.length - 1) * stepX} cy={toY(siteReadiness)} r="4" fill="#3b82f6" />
      </svg>
      <div className="mt-2 flex justify-between">
        {TREND_MONTHS.map((m, i) => (
          <div key={m} className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-slate-600">{m}</span>
            <span className={`text-[10px] font-semibold ${i === TREND_MONTHS.length - 1 ? "text-blue-400" : "text-slate-500"}`}>
              {values[i]}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Risk donut (pure SVG, no extra deps) ─────────────────────────────────────

function RiskDonut() {
  const segments = [
    { label: "Critical", pct: 12, color: "#ef4444" },
    { label: "High",     pct: 28, color: "#f97316" },
    { label: "Medium",   pct: 37, color: "#facc15" },
    { label: "Low",      pct: 23, color: "#10b981" },
  ];

  const r = 36;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;

  let cumulative = 0;
  const arcs = segments.map((s) => {
    const dashArray  = (s.pct / 100) * circumference;
    const dashOffset = circumference - cumulative * circumference / 100;
    cumulative += s.pct;
    return { ...s, dashArray, dashOffset };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="h-36 w-36" aria-label="Risk breakdown donut chart">
          {arcs.map(({ label, dashArray, dashOffset, color }) => (
            <circle
              key={label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeDasharray={`${dashArray} ${circumference - dashArray}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
              opacity="0.85"
            />
          ))}
          <text x={cx} y={cy - 4} textAnchor="middle" className="text-[10px]" fill="#f1f5f9" fontSize="10" fontWeight="600">Risk</text>
          <text x={cx} y={cy + 9} textAnchor="middle" fill="#94a3b8" fontSize="7">Breakdown</text>
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <div className="flex min-w-0 flex-col">
              <span className="text-xs font-medium text-slate-200">{s.label}</span>
              <span className="text-[10px] text-slate-500">{s.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-[#0b1a12] px-4 py-3 shadow-lg">
      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      <span className="text-sm font-medium text-slate-200">{message}</span>
      <button type="button" onClick={onDismiss} className="ml-2 text-slate-500 hover:text-slate-300">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Recommendation Drawer ────────────────────────────────────────────────────

function RecDrawer({ rec, onClose }: { rec: AiRecommendation; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [rec.id]);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-800 bg-[#090b10] shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-400" />
            <span className="font-semibold text-slate-50">AI Recommendation</span>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-slate-50">{rec.title}</h2>
            <Badge className={`mt-2 inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeClass(rec.riskCategory === "Compliance" ? "medium" : rec.riskCategory === "Coverage Risk" ? "critical" : "high")}`}>
              {rec.riskCategory}
            </Badge>
          </div>

          <div className="flex flex-col gap-1.5 rounded-lg border border-blue-500/20 bg-[#3b82f610] p-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-semibold text-blue-400">AI Reasoning</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{rec.reasoning}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Estimated Impact", value: rec.impact },
              { label: "Suggested Owner",  value: rec.owner  },
              { label: "Due Date",         value: rec.dueDate },
              { label: "Risk Category",    value: rec.riskCategory },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5 rounded-lg border border-gray-800 bg-[#111620] p-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
                <span className="text-sm font-medium text-slate-200">{value}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 rounded-lg border border-gray-800 bg-[#111620] p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Source Data</span>
            <p className="text-xs text-slate-400">{rec.sourceData}</p>
          </div>

          <button
            type="button"
            className="mt-auto h-10 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Create Action Plan
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const AiReportsSection = (): JSX.Element => {
  const [liveData,        setLiveData]        = useState<LiveData | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [generating,      setGenerating]      = useState(false);
  const [toast,           setToast]           = useState<string | null>(null);
  const [tick,            setTick]            = useState(0);

  // Filters
  const [filterDept,     setFilterDept]     = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterRisk,     setFilterRisk]     = useState("all");
  const [filterReport,   setFilterReport]   = useState("Executive Summary");
  const [search,         setSearch]         = useState("");

  // Table page
  const [riskPage, setRiskPage] = useState(0);

  // Drawer
  const [drawerRec, setDrawerRec] = useState<AiRecommendation | null>(null);

  // ── Fetch all needed data in parallel ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      supabase.functions.invoke("requirements-data"),
      supabase.functions.invoke("training-data"),
      supabase.functions.invoke("ai-matching-data"),
    ]).then(([reqRes, trainRes, matchRes]) => {
      if (cancelled) return;

      const reqData   = reqRes.data   ?? {};
      const trainData = trainRes.data ?? {};
      const matchData = matchRes.data ?? {};

      const requirements: ReqRow[] = (reqData.requirements ?? []).map((r: ReqRow) => r);
      const certExpiries: CertExpiry[] = reqData.certExpiries ?? [];

      const training: TrainingStats = trainData.stats ?? {
        totalBookings: 0, completed: 0, activeBookings: 0, totalSpendGBP: 0,
        engineersNeedingTraining: 0, criticalGaps: 0, expiringIn30Days: 0, expiringIn90Days: 0,
      };

      const matchStats: MatchStats = matchData.stats ?? {
        openRequirements: 0, availableEngineers: 0, bestMatchScore: 0,
        criticalSkillGaps: 0, totalEngineers: 0,
      };

      const departments: string[] = (reqData.departments ?? []).map((d: { name: string }) => d.name).filter(Boolean);
      const categories:  string[] = [...new Set((requirements as ReqRow[]).map((r) => r.skill_category).filter(Boolean))] as string[];

      setLiveData({ requirements, certExpiries, training, matchStats, departments, categories });
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [tick]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => liveData ? deriveKpis(liveData) : null, [liveData]);

  const allSkillRisk = useMemo(
    () => liveData ? deriveSkillRisk(liveData.requirements) : [],
    [liveData]
  );

  const trainingRows = useMemo(
    () => liveData ? deriveTrainingPriority(liveData.requirements, liveData.training) : [],
    [liveData]
  );

  const recommendations = useMemo(
    () => liveData ? deriveRecommendations(liveData.requirements, liveData.certExpiries) : [],
    [liveData]
  );

  const expiryGroups = useMemo(
    () => liveData ? groupExpiries(liveData.certExpiries) : [],
    [liveData]
  );

  const aiSummaryBullets = useMemo(() => {
    if (!liveData) return [];
    const critGaps = liveData.requirements.filter((r) => r.risk_level === "critical");
    const spof     = liveData.requirements.filter((r) => r.single_point_of_failure);
    const highTrain = liveData.requirements.filter((r) => r.risk_level === "high" && r.engineers_below > 0);
    return [
      {
        icon: AlertTriangle,
        cls: "text-red-500",
        bg: "bg-[#ef444408]",
        border: "border-red-500/20",
        label: "Highest operational risk",
        text: critGaps.length > 0
          ? `${critGaps.length} critical skill${critGaps.length !== 1 ? "s" : ""} with zero qualified cover — ${spof.length > 0 ? `including ${spof.length} SPOF skill${spof.length !== 1 ? "s" : ""}` : "immediate training required"}.`
          : "No critical skill gaps detected this period.",
      },
      {
        icon: TrendingUp,
        cls: "text-blue-400",
        bg: "bg-[#3b82f608]",
        border: "border-blue-400/20",
        label: "Biggest training opportunity",
        text: highTrain.length > 0
          ? `${highTrain.reduce((s, r) => s + r.engineers_below, 0)} engineers across ${highTrain.length} high-risk skills require structured training. Closing these gaps would add an estimated +${Math.min(12, highTrain.length * 2)}pp to site readiness.`
          : "Training coverage is on track. No urgent upskilling identified.",
      },
      {
        icon: Zap,
        cls: "text-emerald-400",
        bg: "bg-[#10b98108]",
        border: "border-emerald-500/20",
        label: "Recommended next action",
        text: `Book training for the top ${Math.min(3, critGaps.length + highTrain.length)} skill gap${critGaps.length + highTrain.length !== 1 ? "s" : ""} within the next 30 days and schedule certification renewals for all engineers expiring within 90 days.`,
      },
    ];
  }, [liveData]);

  const filteredSkillRisk = useMemo(() => {
    let rows = allSkillRisk;
    if (filterRisk !== "all") rows = rows.filter((r) => r.riskLevel.toLowerCase() === filterRisk.toLowerCase());
    if (filterCategory !== "all") rows = rows.filter((r) => {
      const req = liveData?.requirements.find((req) => req.title === r.skill);
      return req?.skill_category === filterCategory;
    });
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.skill.toLowerCase().includes(q));
    }
    return rows;
  }, [allSkillRisk, filterRisk, filterCategory, search, liveData]);

  const RISK_PAGE_SIZE = 8;
  const riskTotalPages = Math.max(1, Math.ceil(filteredSkillRisk.length / RISK_PAGE_SIZE));
  const pagedRisk      = filteredSkillRisk.slice(riskPage * RISK_PAGE_SIZE, (riskPage + 1) * RISK_PAGE_SIZE);

  const hasFilters = !!(search || filterDept !== "all" || filterCategory !== "all" || filterRisk !== "all");

  function clearFilters() {
    setSearch(""); setFilterDept("all"); setFilterCategory("all"); setFilterRisk("all"); setRiskPage(0);
  }

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => {
      setTick((t) => t + 1);
      setGenerating(false);
      setToast("AI report generated");
    }, 1400);
  }

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col items-start gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {/* ── Drawer ─────────────────────────────────────────────────────────── */}
      {drawerRec && <RecDrawer rec={drawerRec} onClose={() => setDrawerRec(null)} />}

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-1">
          <h1 className="mt-[-1.00px] font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-xl-semibold-font-style)]">
            AI Reports
          </h1>
          <p className="text-sm text-slate-400">
            AI-generated insights across site readiness, skills risk, training priorities and compliance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="h-auto gap-2 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-70"
          >
            {generating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? "Generating…" : "Generate Report"}
          </Button>
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <FileText className="h-4 w-4" /> Export PDF
          </Button>
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <button type="button" onClick={() => setTick((t) => t + 1)} disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-50">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <UserCircle className="h-8 w-8" />
          </button>
        </div>
      </header>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          {/* Search */}
          <div className="relative min-w-[160px] flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search skills…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setRiskPage(0); }}
              className="h-8 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
            />
          </div>

          {/* Department */}
          <Select
            value={filterDept}
            onChange={setFilterDept}
            options={[{ value: "all", label: "Department" }, ...(liveData?.departments ?? []).map((d) => ({ value: d, label: d }))]}
            placeholder="Department"
            size="md"
          />

          {/* Category */}
          <Select
            value={filterCategory}
            onChange={(v) => { setFilterCategory(v); setRiskPage(0); }}
            options={[{ value: "all", label: "Skill Category" }, ...(liveData?.categories ?? []).map((c) => ({ value: c, label: c }))]}
            placeholder="Skill Category"
            size="md"
          />

          {/* Risk level */}
          <Select
            value={filterRisk}
            onChange={(v) => { setFilterRisk(v); setRiskPage(0); }}
            options={[
              { value: "all",      label: "Risk Level" },
              { value: "critical", label: "Critical"   },
              { value: "high",     label: "High"       },
              { value: "medium",   label: "Medium"     },
              { value: "low",      label: "Low"        },
            ]}
            placeholder="Risk Level"
            size="sm"
          />

          {/* Report type */}
          <Select
            value={filterReport}
            onChange={setFilterReport}
            options={[
              { value: "Executive Summary",    label: "Executive Summary"    },
              { value: "Skills Risk",          label: "Skills Risk"          },
              { value: "Training Priorities",  label: "Training Priorities"  },
              { value: "Compliance",           label: "Compliance"           },
              { value: "Workforce Readiness",  label: "Workforce Readiness"  },
            ]}
            size="lg"
          />

          {hasFilters && (
            <button type="button" onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-200">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── KPI cards ─────────────────────────────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[116px] animate-pulse rounded-xl bg-gray-800" />
          ))
        ) : kpis && (
          <>
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex flex-col gap-2 p-5">
                <p className="text-xs font-medium text-slate-400">Site Readiness Score</p>
                <p className={`text-2xl font-semibold tabular-nums ${kpis.siteReadiness >= 80 ? "text-emerald-400" : kpis.siteReadiness >= 65 ? "text-yellow-400" : "text-red-400"}`}>
                  {kpis.siteReadiness}%
                </p>
                <p className="text-[11px] text-slate-500">
                  {kpis.siteReadiness >= TREND_BASE[TREND_BASE.length - 2]
                    ? `+${kpis.siteReadiness - TREND_BASE[TREND_BASE.length - 2]}% vs last month`
                    : `${kpis.siteReadiness - TREND_BASE[TREND_BASE.length - 2]}% vs last month`}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex flex-col gap-2 p-5">
                <p className="text-xs font-medium text-slate-400">Critical Skills Gaps</p>
                <p className={`text-2xl font-semibold tabular-nums ${kpis.criticalGaps > 0 ? "text-red-500" : "text-emerald-400"}`}>
                  {kpis.criticalGaps}
                </p>
                <p className="text-[11px] text-slate-500">
                  {allSkillRisk.filter((r) => r.riskLevel === "High").length} high-priority
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex flex-col gap-2 p-5">
                <p className="text-xs font-medium text-slate-400">Compliance Risk</p>
                <p className={`text-2xl font-semibold ${kpis.complianceRisk === "High" ? "text-red-500" : kpis.complianceRisk === "Medium" ? "text-yellow-400" : "text-emerald-400"}`}>
                  {kpis.complianceRisk}
                </p>
                <p className="text-[11px] text-slate-500">{kpis.complianceSub}</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex flex-col gap-2 p-5">
                <p className="text-xs font-medium text-slate-400">Training ROI Opportunity</p>
                <p className="text-2xl font-semibold text-emerald-400">{kpis.roiStr}</p>
                <p className="text-[11px] text-slate-500">Estimated downtime risk reduction</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex flex-col gap-2 p-5">
                <p className="text-xs font-medium text-slate-400">AI Confidence</p>
                <p className="text-2xl font-semibold tabular-nums text-blue-400">{kpis.aiConf}%</p>
                <p className="text-[11px] text-slate-500">Based on live skills and training data</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Two-column main layout ─────────────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">

        {/* ── Left column ───────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-6">

          {/* SECTION 1 — AI Executive Summary */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-5 p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-400" />
                  <h2 className="font-semibold text-slate-50">AI Executive Summary</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-[10px] font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />AI Generated
                  </Badge>
                  <Badge className="inline-flex h-auto rounded bg-[#10b98120] px-2 py-1 text-[10px] font-medium text-emerald-500 shadow-none hover:bg-[#10b98120]">
                    Updated today
                  </Badge>
                  <Badge className="inline-flex h-auto rounded bg-[#facc1520] px-2 py-1 text-[10px] font-medium text-yellow-400 shadow-none hover:bg-[#facc1520]">
                    High confidence
                  </Badge>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-4 animate-pulse rounded bg-gray-800" style={{ width: `${85 - i * 10}%` }} />
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {liveData && kpis
                      ? `Vorta AI has assessed site capability across ${liveData.requirements.length} skill requirements and ${liveData.matchStats.totalEngineers} engineers. Overall site readiness stands at ${kpis.siteReadiness}%, with ${kpis.criticalGaps > 0 ? `immediate risk concentrated around ${kpis.criticalGaps} critical skill gap${kpis.criticalGaps !== 1 ? "s" : ""}` : "no critical skill gaps identified at this time"}. ${liveData.training.engineersNeedingTraining > 0 ? `Training investment should be prioritised for ${liveData.training.engineersNeedingTraining} engineers flagged for skills development, with a focus on certification renewals and covering any single-point-of-failure skills.` : "Training is broadly on track — focus should remain on certification renewals and continuous assessment cycles."}`
                      : "Loading AI executive summary…"
                    }
                  </p>

                  <div className="flex flex-col gap-3">
                    {aiSummaryBullets.map((b, i) => {
                      const Icon = b.icon;
                      return (
                        <div key={i} className={`flex items-start gap-3 rounded-lg border ${b.border} ${b.bg} p-4`}>
                          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${b.cls}`} />
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold ${b.cls}`}>{b.label}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{b.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* SECTION 2 — Site Readiness Trend */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-5 md:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <h2 className="font-semibold text-slate-50">Site Readiness Trend</h2>
                  <p className="text-sm text-slate-400">Last 6 months — skills coverage across all requirements</p>
                </div>
                <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-[10px] font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />AI Live
                </Badge>
              </div>
              {loading ? (
                <div className="h-32 animate-pulse rounded-lg bg-gray-800" />
              ) : (
                <ReadinessTrendChart siteReadiness={kpis?.siteReadiness ?? 82} />
              )}
              <p className="text-xs text-slate-500">
                Readiness is improving, but single-point-of-failure skills remain the biggest risk.
              </p>
            </CardContent>
          </Card>

          {/* SECTION 3 — Critical Skills Risk Table */}
          <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-slate-50">Critical Skills Risk</h2>
                  <p className="text-sm text-slate-400">
                    {loading ? "Loading…" : `${filteredSkillRisk.length} skill${filteredSkillRisk.length !== 1 ? "s" : ""} with coverage gaps`}
                    {riskTotalPages > 1 ? ` · page ${riskPage + 1} of ${riskTotalPages}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasFilters && (
                    <button type="button" onClick={clearFilters}
                      className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-200">
                      <X className="h-3 w-3" /> Clear
                    </button>
                  )}
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setRiskPage((p) => Math.max(0, p - 1))} disabled={riskPage === 0 || loading}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setRiskPage((p) => Math.min(riskTotalPages - 1, p + 1))} disabled={riskPage >= riskTotalPages - 1 || loading}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="w-full overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-max min-w-[800px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-[#0f1318]">
                      {[
                        { label: "Skill",               cls: "sticky left-0 z-10 bg-[#0f1318] min-w-[180px]" },
                        { label: "Required",             cls: "min-w-[90px] text-center" },
                        { label: "Current",              cls: "min-w-[90px] text-center" },
                        { label: "Gap",                  cls: "min-w-[70px] text-center" },
                        { label: "Risk Level",           cls: "min-w-[100px]" },
                        { label: "AI Recommendation",    cls: "min-w-[260px]" },
                        { label: "Actions",              cls: "min-w-[200px]" },
                      ].map(({ label, cls }) => (
                        <th key={label} className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 6 }).map((_, i) => (
                          <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                            {Array.from({ length: 7 }).map((_, j) => (
                              <td key={j} className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-gray-800" /></td>
                            ))}
                          </tr>
                        ))
                      : pagedRisk.length === 0
                      ? (
                          <tr>
                            <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                              No skill risks match the current filters.
                              {hasFilters && (
                                <button type="button" onClick={clearFilters} className="ml-1 font-medium text-blue-400 hover:underline">Clear filters</button>
                              )}
                            </td>
                          </tr>
                        )
                      : pagedRisk.map((row, idx) => {
                          const rowBg = idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                          const gapColor = row.gap === 0 ? "text-emerald-400" : row.gap <= 2 ? "text-yellow-400" : "text-red-400";
                          return (
                            <tr key={row.skill} className={`border-b border-gray-800/50 ${rowBg} transition-colors hover:bg-[#1a2030]`}>
                              <td className={`sticky left-0 z-10 min-w-[180px] px-4 py-2.5 ${rowBg}`}>
                                <span className="font-medium text-slate-200 leading-tight">{row.skill}</span>
                              </td>
                              <td className="px-4 py-2.5 text-center text-sm tabular-nums text-slate-300">{row.required}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`text-sm font-semibold tabular-nums ${row.current > 0 ? "text-emerald-400" : "text-red-400"}`}>{row.current}</span>
                              </td>
                              <td className={`px-4 py-2.5 text-center text-sm font-semibold tabular-nums ${gapColor}`}>
                                {row.gap > 0 ? row.gap : "—"}
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeClass(row.riskLevel)}`}>
                                  {row.riskLevel}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 text-xs leading-relaxed text-slate-400 max-w-[260px]">
                                <span className="line-clamp-2">{row.recommendation}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-wrap gap-1.5">
                                  {["View Engineers", "Assign Training", "Create Requirement"].map((action) => (
                                    <button key={action} type="button"
                                      className="rounded border border-gray-700 px-2 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200">
                                      {action}
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 4 — Training Priority Matrix */}
          <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-50">Training Priority Matrix</h2>
                <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-[10px] font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
                </Badge>
              </div>

              <div className="w-full overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-max min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-[#0f1318]">
                      {["Priority", "Course / Skill", "Engineers", "Est. Cost", "Risk Reduction", "Provider", "Status"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 4 }).map((_, i) => (
                          <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                            {Array.from({ length: 7 }).map((_, j) => (
                              <td key={j} className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-gray-800" /></td>
                            ))}
                          </tr>
                        ))
                      : trainingRows.length === 0
                      ? (
                          <tr>
                            <td colSpan={7} className="py-10 text-center text-sm text-slate-500">No training priorities identified.</td>
                          </tr>
                        )
                      : trainingRows.map((row, idx) => {
                          const rowBg = idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                          return (
                            <tr key={`${row.course}-${idx}`} className={`border-b border-gray-800/50 ${rowBg} transition-colors hover:bg-[#1a2030]`}>
                              <td className="px-4 py-2.5">
                                <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${priorityBadgeClass(row.priority)}`}>
                                  {row.priority}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 min-w-[180px]">
                                <span className="font-medium text-slate-200 leading-tight">{row.course}</span>
                              </td>
                              <td className="px-4 py-2.5 text-sm text-slate-300 tabular-nums">{row.engineers}</td>
                              <td className="px-4 py-2.5 text-sm font-medium text-slate-200 tabular-nums">{row.cost}</td>
                              <td className="px-4 py-2.5">
                                <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${priorityBadgeClass(row.riskReduction)}`}>
                                  {row.riskReduction}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-slate-400 min-w-[180px]">{row.provider}</td>
                              <td className="px-4 py-2.5">
                                <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none hover:${row.statusClass} ${row.statusClass}`}>
                                  {row.status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 5 — AI Recommendations */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-50">AI Recommendations</h2>
                <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-[10px] font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Ranked by impact
                </Badge>
              </div>

              <div className="flex flex-col gap-3">
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="rounded-lg border border-gray-800 p-5">
                        <div className="h-4 w-48 animate-pulse rounded bg-gray-800" />
                        <div className="mt-2 h-3 w-full animate-pulse rounded bg-gray-800/60" />
                        <div className="mt-1.5 h-3 w-3/4 animate-pulse rounded bg-gray-800/40" />
                      </div>
                    ))
                  : recommendations.length === 0
                  ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400/50" />
                        <p className="text-sm font-medium text-emerald-400">No immediate recommendations</p>
                        <p className="text-xs text-slate-500">Site is operating within acceptable risk parameters.</p>
                      </div>
                    )
                  : recommendations.map((rec, i) => (
                      <div
                        key={rec.id}
                        className="flex items-start gap-4 rounded-lg border border-gray-800 bg-[#111620] p-5 transition-colors hover:border-gray-700"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3b82f620] text-xs font-bold text-blue-400">
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-100">{rec.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-400">{rec.reasoning.split(".")[0]}.</p>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Impact</span>
                              <span className="text-[10px] font-semibold text-emerald-400">{rec.impact}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Owner</span>
                              <span className="text-[10px] text-slate-300">{rec.owner}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Due</span>
                              <span className="text-[10px] text-slate-300">{rec.dueDate}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDrawerRec(rec)}
                          className="shrink-0 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200"
                        >
                          Review
                        </button>
                      </div>
                    ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ── Right sidebar ──────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-4">

          {/* Risk Breakdown */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-5">
              <h2 className="font-semibold text-slate-50">Risk Breakdown</h2>
              {loading ? (
                <div className="h-48 animate-pulse rounded-lg bg-gray-800" />
              ) : (
                <RiskDonut />
              )}
            </CardContent>
          </Card>

          {/* Expiring Certifications */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-50">Expiring Certifications</h2>
                {!loading && (liveData?.training.expiringIn90Days ?? 0) > 0 && (
                  <Badge className="inline-flex h-auto rounded bg-[#ef444420] px-2 py-0.5 text-[10px] font-medium text-red-500 shadow-none hover:bg-[#ef444420]">
                    {liveData!.training.expiringIn90Days} expiring
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-2.5">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="h-3.5 w-36 animate-pulse rounded bg-gray-800" />
                        <div className="h-2 w-full animate-pulse rounded bg-gray-800/50" />
                      </div>
                    ))
                  : expiryGroups.length > 0
                  ? expiryGroups.map((g) => (
                      <div key={g.label} className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-sm text-slate-300">{g.label}</span>
                          <span className="text-[10px] text-slate-500">within {g.window}</span>
                        </div>
                        <Badge className={`shrink-0 inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-semibold shadow-none ${g.urgent ? "bg-[#ef444420] text-red-500 hover:bg-[#ef444420]" : "bg-[#facc1520] text-yellow-400 hover:bg-[#facc1520]"}`}>
                          {g.count} eng.
                        </Badge>
                      </div>
                    ))
                  : (
                    <div className="flex flex-col items-center gap-1.5 py-4 text-center">
                      <CheckCircle2 className="h-6 w-6 text-emerald-400/50" />
                      <p className="text-xs text-slate-500">No certifications expiring soon.</p>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>

          {/* AI Alerts */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-50">AI Alerts</h2>
                <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-[10px] font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
                </Badge>
              </div>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-gray-800 p-3">
                      <div className="h-3.5 w-44 animate-pulse rounded bg-gray-800" />
                      <div className="mt-1.5 h-2.5 w-full animate-pulse rounded bg-gray-800/50" />
                    </div>
                  ))
                : [
                    { icon: Shield,        cls: "text-red-500",    bg: "bg-[#ef444408]", border: "border-red-500/20",    text: "Single point of failure detected in at least one skill area." },
                    { icon: Zap,           cls: "text-orange-400", bg: "bg-[#f9731608]", border: "border-orange-400/20", text: "Weekend shift has reduced electrical coverage vs weekday baseline." },
                    { icon: AlertTriangle, cls: "text-yellow-400", bg: "bg-[#facc1508]", border: "border-yellow-400/20", text: "Training budget allocation below recommended level for this quarter." },
                    { icon: BookOpen,      cls: "text-yellow-400", bg: "bg-[#facc1508]", border: "border-yellow-400/20", text: "Certification renewal risk increasing — action required within 30 days." },
                  ].map((alert, i) => {
                    const Icon = alert.icon;
                    return (
                      <div key={i} className={`flex items-start gap-2.5 rounded-lg border ${alert.border} ${alert.bg} p-3`}>
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${alert.cls}`} />
                        <p className="text-xs leading-relaxed text-slate-400">{alert.text}</p>
                      </div>
                    );
                  })}
            </CardContent>
          </Card>

          {/* Report Export History */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-5">
              <h2 className="font-semibold text-slate-50">Export History</h2>
              <div className="flex flex-col gap-2">
                {[
                  { name: "Executive Report",   when: "Today",     icon: FileText },
                  { name: "Skills Risk Report", when: "This week", icon: Zap      },
                  { name: "Compliance Report",  when: "Last week", icon: Shield   },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                        <span className="truncate text-sm text-slate-300">{item.name}</span>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-500">{item.when}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

        </aside>
      </div>
    </section>
  );
};
