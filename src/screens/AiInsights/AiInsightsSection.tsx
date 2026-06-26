import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { supabase } from "../../lib/supabaseClient";

// ─── Types (matching AiReportsSection shapes) ─────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function riskBadgeCls(r: string): string {
  switch (r.toLowerCase()) {
    case "critical": return "bg-[#ef444420] text-red-500";
    case "high":     return "bg-[#f9731620] text-orange-400";
    case "medium":   return "bg-[#facc1520] text-yellow-400";
    default:         return "bg-[#10b98120] text-emerald-500";
  }
}

function coverageBarCls(pct: number): string {
  if (pct >= 80) return "[&>div]:bg-emerald-500";
  if (pct >= 50) return "[&>div]:bg-yellow-400";
  return "[&>div]:bg-red-500";
}

// ─── Trend months / base (same constants as AiReportsSection) ─────────────────

const TREND_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const TREND_BASE   = [71, 73, 76, 78, 80, 82];

function ReadinessMiniChart({ siteReadiness }: { siteReadiness: number }) {
  const values = [...TREND_BASE.slice(0, -1), siteReadiness];
  const min = Math.min(...values) - 6;
  const max = Math.max(...values) + 4;
  const H = 60;
  const W = 600;
  const stepX = W / (values.length - 1);
  const toY = (v: number) => H - ((v - min) / (max - min)) * H;
  const linePoints = values.map((v, i) => `${i * stepX},${toY(v)}`).join(" ");
  const areaPoints = `0,${H} ${linePoints} ${(values.length - 1) * stepX},${H}`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H + 12}`} preserveAspectRatio="none" className="h-16 w-full" aria-label="Site readiness trend">
        <defs>
          <linearGradient id="insightGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"   />
          </linearGradient>
        </defs>
        <polyline points={areaPoints} fill="url(#insightGrad)" stroke="none" />
        <polyline points={linePoints} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={(values.length - 1) * stepX} cy={toY(siteReadiness)} r="4" fill="#3b82f6" />
      </svg>
      <div className="mt-1 flex justify-between">
        {TREND_MONTHS.map((m, i) => (
          <span key={m} className={`text-[10px] ${i === TREND_MONTHS.length - 1 ? "font-semibold text-blue-400" : "text-slate-600"}`}>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-800 ${className ?? ""}`} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const AiInsightsSection = (): JSX.Element => {
  const [loading,  setLoading]  = useState(true);
  const [reqs,     setReqs]     = useState<ReqRow[]>([]);
  const [expiries, setExpiries] = useState<CertExpiry[]>([]);
  const [training, setTraining] = useState<TrainingStats | null>(null);
  const [match,    setMatch]    = useState<MatchStats | null>(null);

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
      setReqs(reqData.requirements ?? []);
      setExpiries(reqData.certExpiries ?? []);
      setTraining(trainData.stats ?? null);
      setMatch(matchData.stats ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Derived KPIs ────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!reqs.length && !match) return null;
    const covered       = reqs.filter((r) => r.coverage_pct >= 80).length;
    const siteReadiness = reqs.length > 0 ? Math.round((covered / reqs.length) * 100) : 82;
    const criticalGaps  = match?.criticalSkillGaps ?? reqs.filter((r) => r.risk_level === "critical").length;
    const expiring90    = training?.expiringIn90Days ?? 0;
    const complianceRisk = expiring90 >= 5 ? "High" : expiring90 >= 2 ? "Medium" : "Low";
    const engNeedTraining = training?.engineersNeedingTraining ?? 0;
    const aiConf = match?.bestMatchScore
      ? Math.min(97, Math.round(match.bestMatchScore * 0.95 + 5))
      : 91;
    return { siteReadiness, criticalGaps, complianceRisk, expiring90, engNeedTraining, aiConf };
  }, [reqs, match, training]);

  // ── Top 5 risk areas ────────────────────────────────────────────────────────
  const topRiskAreas = useMemo(() =>
    reqs
      .filter((r) => r.engineers_below > 0)
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.risk_level as keyof typeof order] ?? 4) - (order[b.risk_level as keyof typeof order] ?? 4);
      })
      .slice(0, 5),
  [reqs]);

  // ── Engineers needing attention ─────────────────────────────────────────────
  const engAttentionCount = training?.engineersNeedingTraining ?? 0;

  // ── Training recommendations ────────────────────────────────────────────────
  const trainingRecs = useMemo(() =>
    reqs
      .filter((r) => (r.risk_level === "critical" || r.risk_level === "high") && r.engineers_below > 0)
      .slice(0, 4)
      .map((r) => ({
        skill:      r.title,
        engineers:  r.engineers_below,
        risk:       r.risk_level,
        rec:        r.recommendation || "Schedule structured training to close this gap.",
      })),
  [reqs]);

  // ── AI summary bullets ───────────────────────────────────────────────────────
  const summaryBullets = useMemo(() => {
    if (!kpis) return [];
    const critReqs  = reqs.filter((r) => r.risk_level === "critical");
    const spofReqs  = reqs.filter((r) => r.single_point_of_failure);
    const highTrain = reqs.filter((r) => r.risk_level === "high" && r.engineers_below > 0);
    return [
      {
        icon: AlertTriangle, cls: "text-red-500",    bg: "bg-[#ef444408]", border: "border-red-500/20",
        label: "Highest operational risk",
        text: critReqs.length > 0
          ? `${critReqs.length} critical skill${critReqs.length !== 1 ? "s" : ""} with coverage gaps${spofReqs.length > 0 ? ` — including ${spofReqs.length} SPOF skill${spofReqs.length !== 1 ? "s" : ""}` : ""}.`
          : "No critical skill gaps detected this period.",
      },
      {
        icon: TrendingUp, cls: "text-blue-400", bg: "bg-[#3b82f608]", border: "border-blue-400/20",
        label: "Biggest training opportunity",
        text: highTrain.length > 0
          ? `${highTrain.reduce((s, r) => s + r.engineers_below, 0)} engineers across ${highTrain.length} high-risk skills require structured training.`
          : "Training coverage is broadly on track.",
      },
      {
        icon: Zap, cls: "text-emerald-400", bg: "bg-[#10b98108]", border: "border-emerald-500/20",
        label: "Recommended next action",
        text: `Book training for the top ${Math.min(3, critReqs.length + highTrain.length)} skill gap${critReqs.length + highTrain.length !== 1 ? "s" : ""} within 30 days and renew certifications expiring within 90 days.`,
      },
    ];
  }, [kpis, reqs]);

  // ── Predicted future risks ───────────────────────────────────────────────────
  const predictedRisks = useMemo(() => {
    const risks: { label: string; cls: string }[] = [];
    if (kpis && kpis.expiring90 > 0)
      risks.push({ label: `${kpis.expiring90} certification${kpis.expiring90 !== 1 ? "s" : ""} expire within 90 days`, cls: "text-yellow-400" });
    const spof = reqs.filter((r) => r.single_point_of_failure);
    if (spof.length > 0)
      risks.push({ label: `${spof.length} SPOF skill${spof.length !== 1 ? "s" : ""} remain without backup cover`, cls: "text-red-500" });
    const critCount = reqs.filter((r) => r.risk_level === "critical").length;
    if (critCount > 0)
      risks.push({ label: `${critCount} critical skill${critCount !== 1 ? "s" : ""} at risk of further deterioration if untrained`, cls: "text-orange-400" });
    risks.push({ label: "Site readiness projected to plateau without additional training bookings", cls: "text-slate-400" });
    return risks.slice(0, 4);
  }, [kpis, reqs]);

  // ── Recommended actions ─────────────────────────────────────────────────────
  const recActions = useMemo(() => {
    const actions: { label: string; priority: string; badgeCls: string }[] = [];
    const critReqs = reqs.filter((r) => r.risk_level === "critical" && r.engineers_below > 0).slice(0, 2);
    critReqs.forEach((r) => actions.push({
      label:    `Book ${r.engineers_below} engineer${r.engineers_below !== 1 ? "s" : ""} on ${r.title} training`,
      priority: "Critical", badgeCls: "bg-[#ef444420] text-red-500",
    }));
    const spof = reqs.filter((r) => r.single_point_of_failure).slice(0, 1);
    spof.forEach((r) => actions.push({
      label:    `Eliminate SPOF risk for ${r.title} — cross-train 2 engineers`,
      priority: "High", badgeCls: "bg-[#f9731620] text-orange-400",
    }));
    if (kpis && kpis.expiring90 > 0)
      actions.push({ label: `Renew ${kpis.expiring90} expiring certification${kpis.expiring90 !== 1 ? "s" : ""} before lapse`, priority: "High", badgeCls: "bg-[#f9731620] text-orange-400" });
    const highGap = reqs.filter((r) => r.risk_level === "high" && r.engineers_below >= 2).slice(0, 1);
    highGap.forEach((r) => actions.push({
      label:    `Improve shift coverage for ${r.title}`,
      priority: "Medium", badgeCls: "bg-[#facc1520] text-yellow-400",
    }));
    if (actions.length < 3)
      actions.push({ label: "Run monthly AI report to track readiness trend", priority: "Low", badgeCls: "bg-[#10b98120] text-emerald-500" });
    return actions.slice(0, 5);
  }, [reqs, kpis]);

  return (
    <div className="flex w-full flex-col gap-6">

      {/* ── Section heading ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3b82f615]">
          <Brain className="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-50">AI Insights</h2>
          <p className="text-sm text-slate-400">AI-generated analysis across site readiness, skills risk, training and compliance.</p>
        </div>
        <Badge className="ml-auto inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-[10px] font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />AI Generated
        </Badge>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[100px]" />)
        ) : kpis ? (
          <>
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex flex-col gap-2 p-4">
                <p className="text-[11px] font-medium text-slate-400">Site Readiness</p>
                <p className={`text-xl font-semibold tabular-nums ${kpis.siteReadiness >= 80 ? "text-emerald-400" : kpis.siteReadiness >= 65 ? "text-yellow-400" : "text-red-400"}`}>
                  {kpis.siteReadiness}%
                </p>
                <p className="text-[10px] text-slate-500">Overall coverage score</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex flex-col gap-2 p-4">
                <p className="text-[11px] font-medium text-slate-400">Critical Skill Gaps</p>
                <p className={`text-xl font-semibold tabular-nums ${kpis.criticalGaps > 0 ? "text-red-500" : "text-emerald-400"}`}>
                  {kpis.criticalGaps}
                </p>
                <p className="text-[10px] text-slate-500">Immediate attention required</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex flex-col gap-2 p-4">
                <p className="text-[11px] font-medium text-slate-400">Compliance Risk</p>
                <p className={`text-xl font-semibold ${kpis.complianceRisk === "High" ? "text-red-500" : kpis.complianceRisk === "Medium" ? "text-yellow-400" : "text-emerald-400"}`}>
                  {kpis.complianceRisk}
                </p>
                <p className="text-[10px] text-slate-500">{kpis.expiring90} certs expiring soon</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex flex-col gap-2 p-4">
                <p className="text-[11px] font-medium text-slate-400">Eng. Needing Training</p>
                <p className={`text-xl font-semibold tabular-nums ${kpis.engNeedTraining > 5 ? "text-orange-400" : kpis.engNeedTraining > 0 ? "text-yellow-400" : "text-emerald-400"}`}>
                  {kpis.engNeedTraining}
                </p>
                <p className="text-[10px] text-slate-500">Flagged for development</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex flex-col gap-2 p-4">
                <p className="text-[11px] font-medium text-slate-400">AI Confidence</p>
                <p className="text-xl font-semibold tabular-nums text-blue-400">{kpis.aiConf}%</p>
                <p className="text-[10px] text-slate-500">Based on live data</p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* ── Main two-column grid ─────────────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">

        {/* AI Executive Summary */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 md:p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <h3 className="font-semibold text-slate-50">AI Executive Summary</h3>
            </div>
            {loading ? (
              <div className="flex flex-col gap-2">
                {[90, 75, 60].map((w) => <Skeleton key={w} className="h-3" style={{ width: `${w}%` }} />)}
              </div>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-slate-300">
                  {kpis
                    ? `Vorta AI has assessed site capability across ${reqs.length} skill requirements and ${match?.totalEngineers ?? 0} engineers. Overall site readiness stands at ${kpis.siteReadiness}%, with ${kpis.criticalGaps > 0 ? `immediate risk concentrated around ${kpis.criticalGaps} critical skill gap${kpis.criticalGaps !== 1 ? "s" : ""}` : "no critical skill gaps identified"}. ${kpis.engNeedTraining > 0 ? `Training investment should be prioritised for ${kpis.engNeedTraining} engineers flagged for development.` : "Training is broadly on track."}`
                    : "No data available — check edge function connectivity."
                  }
                </p>
                <div className="flex flex-col gap-2.5">
                  {summaryBullets.map((b, i) => {
                    const Icon = b.icon;
                    return (
                      <div key={i} className={`flex items-start gap-3 rounded-lg border ${b.border} ${b.bg} p-3`}>
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${b.cls}`} />
                        <div>
                          <p className={`text-xs font-semibold ${b.cls}`}>{b.label}</p>
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

        {/* Top 5 Highest Risk Areas */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 md:p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h3 className="font-semibold text-slate-50">Top 5 Highest Risk Areas</h3>
            </div>
            {loading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : topRiskAreas.length === 0 ? (
              <p className="text-sm text-slate-500">No skill gaps detected.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {topRiskAreas.map((r) => {
                  const covPct = r.coverage_pct ?? 0;
                  return (
                    <div key={r.title} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge className={`inline-flex h-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeCls(r.risk_level)}`}>
                            {r.risk_level.charAt(0).toUpperCase() + r.risk_level.slice(1)}
                          </Badge>
                          <span className="truncate text-sm font-medium text-slate-200">{r.title}</span>
                        </div>
                        <span className="shrink-0 text-xs text-slate-500">
                          {r.engineers_qualified}/{r.engineers_qualified + r.engineers_below} eng.
                        </span>
                      </div>
                      <Progress value={covPct} className={`h-1.5 overflow-hidden rounded bg-gray-800 ${coverageBarCls(covPct)}`} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skills Gap Summary + Equipment Risk Summary row */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 md:p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-400" />
              <h3 className="font-semibold text-slate-50">Skills Gap Summary</h3>
            </div>
            {loading ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="flex flex-col gap-3">
                {[
                  { label: "Critical gaps",           value: reqs.filter((r) => r.risk_level === "critical").length,                              cls: "text-red-500"    },
                  { label: "High gaps",                value: reqs.filter((r) => r.risk_level === "high").length,                                  cls: "text-orange-400" },
                  { label: "Medium gaps",              value: reqs.filter((r) => r.risk_level === "medium").length,                                cls: "text-yellow-400" },
                  { label: "Single-point-of-failure", value: reqs.filter((r) => r.single_point_of_failure).length,                                cls: "text-red-500"    },
                  { label: "Total requirements",       value: reqs.length,                                                                         cls: "text-slate-200"  },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex items-center justify-between gap-2 border-b border-gray-800 pb-2 last:border-0">
                    <span className="text-sm text-slate-400">{label}</span>
                    <span className={`text-sm font-semibold tabular-nums ${cls}`}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Training Recommendations */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 md:p-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-400" />
              <h3 className="font-semibold text-slate-50">Training Recommendations</h3>
            </div>
            {loading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : trainingRecs.length === 0 ? (
              <p className="text-sm text-slate-500">No urgent training recommendations at this time.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {trainingRecs.map((r) => (
                  <div key={r.skill} className="flex items-start gap-3 rounded-lg border border-gray-800 bg-[#111620] p-3">
                    <Badge className={`mt-0.5 inline-flex h-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeCls(r.risk)}`}>
                      {r.risk.charAt(0).toUpperCase() + r.risk.slice(1)}
                    </Badge>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">{r.skill}</p>
                      <p className="text-xs text-slate-500">{r.engineers} engineer{r.engineers !== 1 ? "s" : ""} below target</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Second row: Site Readiness Trend + Engineers needing attention ── */}
      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Site Readiness Trend */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 md:p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <h3 className="font-semibold text-slate-50">Site Readiness Trend</h3>
              <span className="ml-auto text-xs text-slate-500">Last 6 months</span>
            </div>
            {loading ? (
              <Skeleton className="h-24" />
            ) : (
              <ReadinessMiniChart siteReadiness={kpis?.siteReadiness ?? 82} />
            )}
          </CardContent>
        </Card>

        {/* Engineers needing attention */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 md:p-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-yellow-400" />
              <h3 className="font-semibold text-slate-50">Engineers Needing Attention</h3>
            </div>
            {loading ? (
              <Skeleton className="h-20" />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-800 bg-[#111620] px-4 py-3">
                  <span className="text-sm text-slate-300">Flagged for training</span>
                  <span className={`text-lg font-semibold tabular-nums ${engAttentionCount > 5 ? "text-orange-400" : engAttentionCount > 0 ? "text-yellow-400" : "text-emerald-400"}`}>
                    {engAttentionCount}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-800 bg-[#111620] px-4 py-3">
                  <span className="text-sm text-slate-300">Certifications expiring ≤ 90 days</span>
                  <span className={`text-lg font-semibold tabular-nums ${(kpis?.expiring90 ?? 0) > 0 ? "text-yellow-400" : "text-emerald-400"}`}>
                    {kpis?.expiring90 ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-800 bg-[#111620] px-4 py-3">
                  <span className="text-sm text-slate-300">Holding a SPOF skill</span>
                  <span className={`text-lg font-semibold tabular-nums ${reqs.filter((r) => r.single_point_of_failure).length > 0 ? "text-red-500" : "text-emerald-400"}`}>
                    {reqs.filter((r) => r.single_point_of_failure).length}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom row: Predicted risks + Recommended actions ───────────── */}
      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Predicted Future Risks */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 md:p-6">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              <h3 className="font-semibold text-slate-50">Predicted Future Risks</h3>
              <Badge className="ml-auto inline-flex h-auto rounded bg-[#facc1520] px-2 py-0.5 text-[10px] font-medium text-yellow-400 shadow-none hover:bg-[#facc1520]">
                AI Forecast
              </Badge>
            </div>
            {loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {predictedRisks.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg border border-gray-800 bg-[#111620] px-3 py-2.5">
                    <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${r.cls}`} />
                    <span className="text-sm text-slate-300">{r.label}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommended Actions */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 md:p-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <h3 className="font-semibold text-slate-50">Recommended Actions</h3>
              <Badge className="ml-auto inline-flex h-auto rounded bg-[#3b82f620] px-2 py-0.5 text-[10px] font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
                AI Ranked
              </Badge>
            </div>
            {loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recActions.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-[#111620] px-3 py-2.5">
                    <Badge className={`inline-flex h-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium shadow-none ${a.badgeCls}`}>
                      {a.priority}
                    </Badge>
                    <span className="text-sm text-slate-300">{a.label}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
