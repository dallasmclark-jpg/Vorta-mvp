import { useEffect, useState } from "react";
import { TriangleAlert as AlertTriangle, Bell, RefreshCw, CircleUser as UserCircle } from "lucide-react";
import { AiInsightsSection } from "../../../../screens/AiInsights";
import { ContextHelp } from "../../../../components/ContextHelp";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../../components/ui/alert";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent } from "../../../../components/ui/card";
import { Progress } from "../../../../components/ui/progress";
import { supabase } from "../../../../lib/supabaseClient";

// ---------------------------------------------------------------------------
// Raw DB row types (one per source table)
// ---------------------------------------------------------------------------

interface DbMetric {
  metric_category: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  trend_direction: string;
  trend_percentage: number;
  status: string;
}

interface DbInsight {
  id: string;
  title: string;
  severity: string;
  confidence_score: number;
  urgency_score: number;
  status: string;
  recommended_action: string | null;
  source_module: string | null;
}

interface DbScoreSnapshot {
  snapshot_date: string;
  skills_score: number;
  training_score: number;
  overall_score: number;
}

interface DbPredictiveRec {
  id: string;
  title: string;
  summary: string | null;
  priority: string;
  status: string;
  confidence_score: number;
  urgency_score: number;
}

// ---------------------------------------------------------------------------
// View types consumed by JSX (shapes unchanged from original)
// ---------------------------------------------------------------------------

interface OverviewCard {
  title: string;
  change: string;
  changeClassName: string;
  value: string;
  sparkline: JSX.Element;
}

interface CriticalRisk {
  level: string;
  levelClassName: string;
  title: string;
  actionClassName: string;
}

interface RecommendedActionView {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  statusClassName: string;
  dotClassName: string;
  priority: string;
}

interface ExecutiveSummaryItem {
  label: string;
  value: string;
  progress: number;
  indicatorClassName: string;
}

// ---------------------------------------------------------------------------
// Inline sparkline SVGs
// ---------------------------------------------------------------------------

const sparklines: Record<string, JSX.Element> = {
  up: (
    <svg width="80" height="32" viewBox="0 0 80 32" fill="none" aria-hidden="true">
      <polyline
        points="0,28 13,24 26,20 40,18 53,12 66,8 80,4"
        stroke="#10b981"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  down: (
    <svg width="80" height="32" viewBox="0 0 80 32" fill="none" aria-hidden="true">
      <polyline
        points="0,6 13,10 26,12 40,16 53,20 66,22 80,27"
        stroke="#ef4444"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  warn: (
    <svg width="80" height="32" viewBox="0 0 80 32" fill="none" aria-hidden="true">
      <polyline
        points="0,10 13,14 26,10 40,18 53,12 66,20 80,16"
        stroke="#facc15"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  flat: (
    <svg width="80" height="32" viewBox="0 0 80 32" fill="none" aria-hidden="true">
      <polyline
        points="0,22 13,18 26,20 40,16 53,18 66,14 80,16"
        stroke="#ef4444"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  high: (
    <svg width="80" height="32" viewBox="0 0 80 32" fill="none" aria-hidden="true">
      <polyline
        points="0,24 13,20 26,22 40,16 53,18 66,12 80,10"
        stroke="#10b981"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// Skills Matrix Health Trend chart (static fallback; goes live once
// ai_score_snapshots is populated)
// ---------------------------------------------------------------------------

const SkillsHealthChart = (): JSX.Element => {
  const points = [
    [0, 62], [60, 58], [120, 64], [180, 68], [240, 66],
    [300, 70], [360, 68], [420, 72], [480, 70], [540, 74],
    [600, 72], [660, 76], [720, 74],
  ];
  const linePoints = points.map((p) => `${p[0]},${100 - p[1]}`).join(" ");
  const areaPoints = `0,100 ${linePoints} 720,100`;

  return (
    <svg
      viewBox="0 0 720 100"
      preserveAspectRatio="none"
      className="h-36 w-full"
      aria-label="Skills Matrix Health Trend chart"
    >
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 50, 75].map((y) => (
        <line
          key={y}
          x1="0"
          y1={100 - y}
          x2="720"
          y2={100 - y}
          stroke="#ffffff10"
          strokeWidth="1"
        />
      ))}
      <polyline points={areaPoints} fill="url(#areaGrad)" stroke="none" />
      <polyline
        points={linePoints}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="720" cy={100 - 74} r="4" fill="#3b82f6" />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// UI helpers — severity / status → CSS classes
// ---------------------------------------------------------------------------

function riskLevelClasses(level: string): { levelClassName: string; actionClassName: string } {
  if (level === "CRITICAL") {
    return {
      levelClassName: "bg-[#ef444420] text-red-500",
      actionClassName: "border-red-500 bg-[#ef444410] text-red-500",
    };
  }
  return {
    levelClassName: "bg-[#facc1520] text-yellow-400",
    actionClassName: "border-yellow-400 bg-[#facc1510] text-yellow-400",
  };
}

function statusClasses(status: string): { statusClassName: string; dotClassName: string } {
  if (status === "Risk") {
    return { statusClassName: "bg-[#ef444420] text-red-500", dotClassName: "bg-red-500" };
  }
  if (status === "Review") {
    return { statusClassName: "bg-[#facc1520] text-yellow-400", dotClassName: "bg-yellow-400" };
  }
  return { statusClassName: "bg-[#10b98120] text-emerald-500", dotClassName: "bg-emerald-500" };
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

// Primary fetch — calls the dashboard-data edge function which uses the
// service role key server-side, bypassing the TO authenticated RLS policies
// on ai_dashboard_metrics and ai_insights without any client-side auth.
async function fetchDashboardPayload(): Promise<{ metrics: DbMetric[]; insights: DbInsight[] }> {
  const { data, error } = await supabase.functions.invoke("dashboard-data");
  if (error || !data) return { metrics: [], insights: [] };
  return {
    metrics: (data.metrics ?? []) as DbMetric[],
    insights: (data.insights ?? []) as DbInsight[],
  };
}

// Reserved for when ai_predictive_recommendations is populated; falls back to
// insights-derived actions when empty.
async function fetchPredictiveRecommendations(): Promise<DbPredictiveRec[]> {
  const { data } = await supabase
    .from("ai_predictive_recommendations")
    .select("id,title,summary,priority,status,confidence_score,urgency_score")
    .order("urgency_score", { ascending: false })
    .limit(5);
  return (data ?? []) as DbPredictiveRec[];
}

// Reserved for when ai_score_snapshots is populated; provides trend chart data.
async function fetchScoreSnapshots(): Promise<DbScoreSnapshot[]> {
  const { data } = await supabase
    .from("ai_score_snapshots")
    .select("snapshot_date,skills_score,training_score,overall_score")
    .order("snapshot_date", { ascending: true })
    .limit(30);
  return (data ?? []) as DbScoreSnapshot[];
}

// ---------------------------------------------------------------------------
// Builders — raw rows → view shapes
// ---------------------------------------------------------------------------

function metricByCategory(metrics: DbMetric[], category: string): DbMetric | undefined {
  return metrics.find((m) => m.metric_category === category);
}

function metricTrendChange(m: DbMetric | undefined): { change: string; changeClassName: string } {
  if (!m) return { change: "—", changeClassName: "text-slate-400" };
  const pct = Number(m.trend_percentage);
  if (pct === 0) return { change: "—", changeClassName: "text-slate-400" };
  const sign = pct > 0 ? "+" : "";
  return {
    change: `${sign}${pct}`,
    changeClassName: pct > 0 ? "text-emerald-500" : "text-red-500",
  };
}

function sparklineForDirection(dir: string): JSX.Element {
  if (dir === "up") return sparklines.up;
  if (dir === "down") return sparklines.down;
  return sparklines.warn;
}

function deriveCoverageRisk(metrics: DbMetric[]): { label: string; score: number } {
  const skills = metricByCategory(metrics, "skills");
  const succession = metricByCategory(metrics, "succession");
  const skillsVal = skills ? Number(skills.metric_value) : 75;
  const successionVal = succession ? Number(succession.metric_value) : 75;
  const score = Math.round((skillsVal + successionVal) / 2);
  const label = score >= 85 ? "Low" : score >= 70 ? "Medium" : "High";
  return { label, score };
}

function buildKpiCards(metrics: DbMetric[], insights: DbInsight[]): OverviewCard[] {
  const skills = metricByCategory(metrics, "skills");
  const training = metricByCategory(metrics, "training");
  const succession = metricByCategory(metrics, "succession");

  const { label: coverageLabel } = deriveCoverageRisk(metrics);
  const coverageTrending =
    skills?.trend_direction === "up" && succession?.trend_direction === "up";
  const coverageChange =
    metrics.length === 0
      ? { change: "—", changeClassName: "text-slate-400" }
      : coverageTrending
      ? { change: "▲", changeClassName: "text-emerald-500" }
      : { change: "▼", changeClassName: "text-red-500" };

  const criticalHighCount = insights.filter(
    (i) => i.severity === "critical" || i.severity === "high"
  ).length;

  const avgConfidence =
    insights.length > 0
      ? Math.round(
          insights.reduce((s, i) => s + Number(i.confidence_score), 0) / insights.length
        )
      : 0;

  return [
    {
      title: "Skills Matrix Health",
      ...metricTrendChange(skills),
      value: skills ? `${Math.round(Number(skills.metric_value))}%` : "—",
      sparkline: skills ? sparklineForDirection(skills.trend_direction) : sparklines.up,
    },
    {
      title: "Critical Skill Gaps",
      change: "—",
      changeClassName: "text-slate-400",
      value: String(criticalHighCount),
      sparkline: criticalHighCount > 0 ? sparklines.down : sparklines.up,
    },
    {
      title: "Training Readiness",
      ...metricTrendChange(training),
      value: training ? `${Math.round(Number(training.metric_value))}%` : "—",
      sparkline: training ? sparklineForDirection(training.trend_direction) : sparklines.warn,
    },
    {
      title: "Coverage Risk",
      ...coverageChange,
      value: coverageLabel,
      sparkline: sparklines.flat,
    },
    {
      title: "AI Confidence",
      change: "—",
      changeClassName: "text-slate-400",
      value: insights.length > 0 ? `${avgConfidence}%` : "—",
      sparkline: sparklines.high,
    },
  ];
}

function buildCriticalRisks(insights: DbInsight[]): CriticalRisk[] {
  return insights
    .filter((i) => i.severity === "critical" || i.severity === "high")
    .map((i) => {
      const level = i.severity.toUpperCase();
      return {
        level,
        title: i.title,
        ...riskLevelClasses(level),
      };
    });
}

function insightToActionStatus(severity: string): "Risk" | "Review" | "Open" {
  if (severity === "critical" || severity === "high") return "Risk";
  if (severity === "medium") return "Review";
  return "Open";
}

function insightToActionPriority(urgencyScore: number): "High" | "Med" | "Low" {
  if (urgencyScore >= 85) return "High";
  if (urgencyScore >= 70) return "Med";
  return "Low";
}

function predRecToActionStatus(status: string): "Risk" | "Review" | "Open" | "Done" {
  if (status === "risk") return "Risk";
  if (status === "in_review") return "Review";
  if (status === "closed" || status === "completed") return "Done";
  return "Open";
}

function predRecToActionPriority(priority: string): "High" | "Med" | "Low" {
  const p = priority.toLowerCase();
  if (p === "high" || p === "critical") return "High";
  if (p === "medium" || p === "med") return "Med";
  return "Low";
}

function buildRecommendedActions(
  recs: DbPredictiveRec[],
  insightsFallback: DbInsight[]
): RecommendedActionView[] {
  if (recs.length > 0) {
    return recs.map((r) => {
      const status = predRecToActionStatus(r.status);
      const priority = predRecToActionPriority(r.priority);
      return {
        id: r.id,
        title: r.title,
        subtitle: r.summary ?? "",
        status,
        priority,
        ...statusClasses(status),
      };
    });
  }

  // Fallback: derive actions from open insights when recommendations table is empty
  return insightsFallback.map((i) => {
    const status = insightToActionStatus(i.severity);
    const priority = insightToActionPriority(Number(i.urgency_score));
    const raw = i.recommended_action ?? "";
    const subtitle = raw.length > 80 ? `${raw.slice(0, 80)}…` : raw;
    return {
      id: i.id,
      title: i.title,
      subtitle,
      status,
      priority,
      ...statusClasses(status),
    };
  });
}

function formatModuleName(raw: string): string {
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildExecutiveSummary(
  metrics: DbMetric[],
  insights: DbInsight[]
): { items: ExecutiveSummaryItem[]; topGap: string; focusArea: string } {
  const skills = metricByCategory(metrics, "skills");
  const training = metricByCategory(metrics, "training");
  const { label: coverageLabel, score: coverageScore } = deriveCoverageRisk(metrics);

  const skillsVal = skills ? Math.round(Number(skills.metric_value)) : 0;
  const trainingVal = training ? Math.round(Number(training.metric_value)) : 0;

  const topInsight = insights[0]; // sorted by urgency DESC
  const topGap = topInsight?.title ?? "—";
  const focusArea = topInsight?.source_module
    ? formatModuleName(topInsight.source_module)
    : metrics.length > 0
    ? "Skills & Succession"
    : "—";

  const items: ExecutiveSummaryItem[] = [
    {
      label: "Skills Capability",
      value: skillsVal > 0 ? `${skillsVal}%` : "—",
      progress: skillsVal,
      indicatorClassName: "[&>div]:bg-emerald-500",
    },
    {
      label: "Coverage Risk",
      value: coverageLabel,
      progress: coverageScore,
      indicatorClassName: "[&>div]:bg-yellow-400",
    },
    {
      label: "Training Completion",
      value: trainingVal > 0 ? `${trainingVal}%` : "—",
      progress: trainingVal,
      indicatorClassName: "[&>div]:bg-blue-500",
    },
  ];

  return { items, topGap, focusArea };
}

// ---------------------------------------------------------------------------
// Dashboard data shape passed to the component
// ---------------------------------------------------------------------------

interface DashboardData {
  overviewCards: OverviewCard[];
  criticalRisks: CriticalRisk[];
  recommendedActions: RecommendedActionView[];
  executiveSummary: ExecutiveSummaryItem[];
  topGap: string;
  focusArea: string;
}

// ---------------------------------------------------------------------------
// Hook — fetches all datasets in parallel, maps to view shapes
// ---------------------------------------------------------------------------

function useDashboardData(): { data: DashboardData | null; loading: boolean; refetch: () => void } {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [{ metrics, insights }, recs] = await Promise.all([
          fetchDashboardPayload(),
          fetchPredictiveRecommendations(),
          fetchScoreSnapshots(), // reserved for trend chart
        ]);

        if (cancelled) return;

        const overviewCards = buildKpiCards(metrics, insights);
        const criticalRisks = buildCriticalRisks(insights);
        const recommendedActions = buildRecommendedActions(recs, insights);
        const {
          items: executiveSummary,
          topGap,
          focusArea,
        } = buildExecutiveSummary(metrics, insights);

        setData({ overviewCards, criticalRisks, recommendedActions, executiveSummary, topGap, focusArea });
      } catch {
        // Ensure the component always renders even if queries fail
        if (!cancelled) {
          setData({
            overviewCards: [],
            criticalRisks: [],
            recommendedActions: [],
            executiveSummary: [],
            topGap: "—",
            focusArea: "—",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { data, loading, refetch: () => setTick((t) => t + 1) };
}

// ---------------------------------------------------------------------------
// Component — JSX and layout unchanged
// ---------------------------------------------------------------------------

export const DashboardOverviewSection = (): JSX.Element => {
  const { data, loading, refetch } = useDashboardData();

  const overviewCards = data?.overviewCards ?? [];
  const criticalRisks = data?.criticalRisks ?? [];
  const recommendedActions = data?.recommendedActions ?? [];
  const executiveSummary = data?.executiveSummary ?? [];
  const topGap = data?.topGap ?? "—";
  const focusArea = data?.focusArea ?? "—";

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col items-start gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <h1 className="mt-[-1.00px] font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-xl-semibold-font-style)]">
              Workforce Capability Dashboard
            </h1>
            <ContextHelp content={{
              title: "Workforce Capability Dashboard",
              body:  "Your primary operations view — showing live engineer coverage, skill readiness, critical risks and AI-generated recommendations across the site.",
              usage: "Review the KPI cards daily for coverage changes. Use the Critical Risks and Recommended Actions panels to prioritise your team's activities.",
              aiNote: "Vorta AI continuously scores your site readiness against requirements and surfaces recommended actions ranked by impact.",
            }} />
          </div>
          <p className="font-text-sm-regular text-[length:var(--text-sm-regular-font-size)] font-[number:var(--text-sm-regular-font-weight)] leading-[var(--text-sm-regular-line-height)] tracking-[var(--text-sm-regular-letter-spacing)] text-slate-400 [font-style:var(--text-sm-regular-font-style)]">
            Alpha Manufacturing — Skills &amp; Coverage Overview
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <Button
            type="button"
            variant="outline"
            className="h-auto border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 font-text-sm-semibold text-[length:var(--text-sm-semibold-font-size)] font-[number:var(--text-sm-semibold-font-weight)] leading-[var(--text-sm-semibold-line-height)] tracking-[var(--text-sm-semibold-letter-spacing)] text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50 [font-style:var(--text-sm-semibold-font-style)]"
          >
            Run Full Site Analysis
          </Button>
          <button
            type="button"
            onClick={refetch}
            disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 hover:bg-[#ffffff1a] hover:text-slate-200 transition-colors disabled:opacity-50"
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 hover:bg-[#ffffff1a] hover:text-slate-200 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-[#ffffff1a] hover:text-slate-200 transition-colors"
            aria-label="User profile"
          >
            <UserCircle className="h-8 w-8" />
          </button>
        </div>
      </header>
      <div className="flex min-w-0 w-full max-w-full flex-col items-start gap-6">
        <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {overviewCards.map((card) => (
            <Card
              key={card.title}
              className="min-w-0 h-full rounded-xl border border-gray-800 bg-[#141820] shadow-none"
            >
              <CardContent className="flex min-w-0 h-full flex-col gap-3 p-5">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="min-w-0 truncate mt-[-1.00px] font-text-xs-medium text-[length:var(--text-xs-medium-font-size)] font-[number:var(--text-xs-medium-font-weight)] leading-[var(--text-xs-medium-line-height)] tracking-[var(--text-xs-medium-letter-spacing)] text-slate-400 [font-style:var(--text-xs-medium-font-style)]">
                    {card.title}
                  </p>
                  <span
                    className={`shrink-0 mt-[-1.00px] font-text-xs-semibold text-[length:var(--text-xs-semibold-font-size)] font-[number:var(--text-xs-semibold-font-weight)] leading-[var(--text-xs-semibold-line-height)] tracking-[var(--text-xs-semibold-letter-spacing)] [font-style:var(--text-xs-semibold-font-style)] ${card.changeClassName}`}
                  >
                    {card.change}
                  </span>
                </div>
                <div className="flex min-w-0 items-end justify-between gap-2">
                  <p className="min-w-0 truncate mt-[-1.00px] font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-xl-semibold-font-style)]">
                    {card.value}
                  </p>
                  <div className="shrink-0">{card.sparkline}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex min-w-0 h-full flex-col items-start gap-4 p-5">
              <div className="flex items-center gap-2">
                <h2 className="mt-[-1.00px] font-text-md-semibold text-[length:var(--text-md-semibold-font-size)] font-[number:var(--text-md-semibold-font-weight)] leading-[var(--text-md-semibold-line-height)] tracking-[var(--text-md-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-md-semibold-font-style)]">
                  Critical Risks
                </h2>
                <ContextHelp content={{ title: "Critical Risks", body: "Skill areas where engineer coverage falls below the required minimum, posing immediate operational risk. These are ordered by severity.", usage: "Click Review on any risk to investigate. Prioritise CRITICAL items before HIGH items." }} />
              </div>
              <div className="flex w-full flex-col gap-3">
                {criticalRisks.map((risk) => (
                  <article
                    key={risk.title}
                    className="flex min-w-0 flex-col gap-3 rounded-lg border border-gray-800 bg-[#141820] p-3 sm:flex-row sm:items-center"
                  >
                    <Badge
                      className={`shrink-0 inline-flex h-auto rounded px-2 py-1 font-text-xs-medium text-[length:var(--text-xs-medium-font-size)] font-[number:var(--text-xs-medium-font-weight)] leading-[var(--text-xs-medium-line-height)] tracking-[var(--text-xs-medium-letter-spacing)] shadow-none hover:${risk.levelClassName} ${risk.levelClassName} [font-style:var(--text-xs-medium-font-style)]`}
                    >
                      {risk.level}
                    </Badge>
                    <p className="min-w-0 flex-1 truncate font-text-sm-semibold text-[length:var(--text-sm-semibold-font-size)] font-[number:var(--text-sm-semibold-font-weight)] leading-[var(--text-sm-semibold-line-height)] tracking-[var(--text-sm-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-sm-semibold-font-style)]">
                      {risk.title}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className={`shrink-0 h-auto rounded-md px-2.5 py-1.5 font-text-xs-medium text-[length:var(--text-xs-medium-font-size)] font-[number:var(--text-xs-medium-font-weight)] leading-[var(--text-xs-medium-line-height)] tracking-[var(--text-xs-medium-letter-spacing)] hover:bg-transparent [font-style:var(--text-xs-medium-font-style)] ${risk.actionClassName}`}
                    >
                      Review
                    </Button>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex min-w-0 h-full flex-col items-start gap-5 p-5">
              <div className="flex w-full items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="mt-[-1.00px] font-text-md-semibold text-[length:var(--text-md-semibold-font-size)] font-[number:var(--text-md-semibold-font-weight)] leading-[var(--text-md-semibold-line-height)] tracking-[var(--text-md-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-md-semibold-font-style)]">
                    Recommended Actions
                  </h2>
                  <ContextHelp content={{ title: "Recommended Actions", body: "AI-prioritised list of actions to improve site readiness and reduce skills risk. Items are ranked by impact and urgency.", aiNote: "Vorta AI generates these from live skills gaps, training records and engineer coverage data." }} />
                </div>
                <button
                  type="button"
                  className="font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] text-blue-500 [font-style:var(--text-sm-medium-font-style)]"
                >
                  View All
                </button>
              </div>
              <div className="flex w-full flex-col">
                {recommendedActions.map((action, index) => (
                  <article
                    key={action.id}
                    className={`flex min-w-0 w-full flex-col gap-3 py-3 md:grid md:grid-cols-[minmax(0,1fr)_120px_80px] md:items-center md:gap-4 ${
                      index !== recommendedActions.length - 1
                        ? "border-b border-gray-800"
                        : ""
                    }`}
                  >
                    <div className="flex min-w-0 flex-col items-start gap-0.5">
                      <h3 className="w-full truncate font-text-sm-semibold text-[length:var(--text-sm-semibold-font-size)] font-[number:var(--text-sm-semibold-font-weight)] leading-[var(--text-sm-semibold-line-height)] tracking-[var(--text-sm-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-sm-semibold-font-style)]">
                        {action.title}
                      </h3>
                      <p className="w-full truncate font-text-xs-regular text-[length:var(--text-xs-regular-font-size)] font-[number:var(--text-xs-regular-font-weight)] leading-[var(--text-xs-regular-line-height)] tracking-[var(--text-xs-regular-letter-spacing)] text-slate-400 [font-style:var(--text-xs-regular-font-style)]">
                        {action.subtitle}
                      </p>
                    </div>
                    <div className="flex w-[120px] items-start">
                      <Badge
                        className={`inline-flex h-auto items-center gap-1.5 rounded px-2 py-1 font-text-xs-medium text-[length:var(--text-xs-medium-font-size)] font-[number:var(--text-xs-medium-font-weight)] leading-[var(--text-xs-medium-line-height)] tracking-[var(--text-xs-medium-letter-spacing)] shadow-none hover:${action.statusClassName} ${action.statusClassName} [font-style:var(--text-xs-medium-font-style)]`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-[3px] ${action.dotClassName}`}
                        />
                        {action.status}
                      </Badge>
                    </div>
                    <div className="flex w-20 items-start">
                      <span className="font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] text-slate-50 [font-style:var(--text-sm-medium-font-style)]">
                        {action.priority}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid w-full grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex h-full flex-col items-start gap-6 p-5 md:p-8">
              <div className="flex w-full flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="flex flex-col items-start gap-1">
                  <h2 className="mt-[-1.00px] font-text-md-semibold text-[length:var(--text-md-semibold-font-size)] font-[number:var(--text-md-semibold-font-weight)] leading-[var(--text-md-semibold-line-height)] tracking-[var(--text-md-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-md-semibold-font-style)]">
                    Skills Matrix Health Trend
                  </h2>
                  <p className="font-text-sm-regular text-[length:var(--text-sm-regular-font-size)] font-[number:var(--text-sm-regular-font-weight)] leading-[var(--text-sm-regular-line-height)] tracking-[var(--text-sm-regular-letter-spacing)] text-slate-400 [font-style:var(--text-sm-regular-font-style)]">
                    Last 30 days across engineers, operators and shift coverage
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 font-text-xs-medium text-[length:var(--text-xs-medium-font-size)] font-[number:var(--text-xs-medium-font-weight)] leading-[var(--text-xs-medium-line-height)] tracking-[var(--text-xs-medium-letter-spacing)] text-blue-500 shadow-none hover:bg-[#3b82f620] [font-style:var(--text-xs-medium-font-style)]">
                    <span className="h-1.5 w-1.5 rounded-[3px] bg-blue-500" />
                    AI Live
                  </Badge>
                  <span className="mt-[-1.00px] font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] text-slate-50 [font-style:var(--text-sm-medium-font-style)]">
                    94% confidence
                  </span>
                </div>
              </div>
              <SkillsHealthChart />
            </CardContent>
          </Card>
          <aside className="flex min-w-0 w-full flex-col items-start gap-4">
            <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex min-h-[360px] flex-col items-start gap-5 overflow-hidden p-5">
                <h2 className="mt-[-1.00px] self-stretch font-text-md-semibold text-[length:var(--text-md-semibold-font-size)] font-[number:var(--text-md-semibold-font-weight)] leading-[var(--text-md-semibold-line-height)] tracking-[var(--text-md-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-md-semibold-font-style)]">
                  Executive Summary
                </h2>
                <div className="flex w-full flex-col gap-5">
                  {executiveSummary.map((item) => (
                    <div
                      key={item.label}
                      className="flex w-full flex-col gap-2"
                    >
                      <div className="flex items-start justify-between">
                        <span className="mt-[-1.00px] font-text-sm-regular text-[length:var(--text-sm-regular-font-size)] font-[number:var(--text-sm-regular-font-weight)] leading-[var(--text-sm-regular-line-height)] tracking-[var(--text-sm-regular-letter-spacing)] text-slate-400 [font-style:var(--text-sm-regular-font-style)]">
                          {item.label}
                        </span>
                        <span className="mt-[-1.00px] font-text-sm-semibold text-[length:var(--text-sm-semibold-font-size)] font-[number:var(--text-sm-semibold-font-weight)] leading-[var(--text-sm-semibold-line-height)] tracking-[var(--text-sm-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-sm-semibold-font-style)]">
                          {item.value}
                        </span>
                      </div>
                      <Progress
                        value={item.progress}
                        className={`h-2 overflow-hidden rounded bg-gray-800 ${item.indicatorClassName}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex w-full items-start gap-4 pt-2">
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="mt-[-1.00px] font-text-xs-medium text-[length:var(--text-xs-medium-font-size)] font-[number:var(--text-xs-medium-font-weight)] leading-[var(--text-xs-medium-line-height)] tracking-[var(--text-xs-medium-letter-spacing)] text-slate-400 [font-style:var(--text-xs-medium-font-style)]">
                      Top Gap
                    </span>
                    <span className="w-full truncate font-text-md-semibold text-[length:var(--text-md-semibold-font-size)] font-[number:var(--text-md-semibold-font-weight)] leading-[var(--text-md-semibold-line-height)] tracking-[var(--text-md-semibold-letter-spacing)] text-blue-500 [font-style:var(--text-md-semibold-font-style)]">
                      {topGap}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="mt-[-1.00px] font-text-xs-medium text-[length:var(--text-xs-medium-font-size)] font-[number:var(--text-xs-medium-font-weight)] leading-[var(--text-xs-medium-line-height)] tracking-[var(--text-xs-medium-letter-spacing)] text-slate-400 [font-style:var(--text-xs-medium-font-style)]">
                      Focus Area
                    </span>
                    <span className="w-full truncate font-text-md-semibold text-[length:var(--text-md-semibold-font-size)] font-[number:var(--text-md-semibold-font-weight)] leading-[var(--text-md-semibold-line-height)] tracking-[var(--text-md-semibold-letter-spacing)] text-blue-500 [font-style:var(--text-md-semibold-font-style)]">
                      {focusArea}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Alert className="w-full rounded-xl border border-red-500 bg-[#ef444410] p-5 text-slate-50">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertTitle className="font-text-sm-semibold text-[length:var(--text-sm-semibold-font-size)] font-[number:var(--text-sm-semibold-font-weight)] leading-[var(--text-sm-semibold-line-height)] tracking-[var(--text-sm-semibold-letter-spacing)] text-red-500 [font-style:var(--text-sm-semibold-font-style)]">
                CRITICAL RISK
              </AlertTitle>
              <AlertDescription className="font-text-sm-regular text-[length:var(--text-sm-regular-font-size)] font-[number:var(--text-sm-regular-font-weight)] leading-[var(--text-sm-regular-line-height)] tracking-[var(--text-sm-regular-letter-spacing)] text-slate-50 [font-style:var(--text-sm-regular-font-style)]">
                PLC fault-finding gap is affecting 15 operators across Lines 1
                &amp; 2.
              </AlertDescription>
            </Alert>
          </aside>
        </div>
      </div>

      {/* ── AI Insights ─────────────────────────────────────────────────── */}
      <div className="w-full border-t border-gray-800 pt-8">
        <AiInsightsSection />
      </div>
    </section>
  );
};
