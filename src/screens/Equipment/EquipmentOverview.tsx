import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Clock,
  Copy,
  Database,
  FileSearch,
  FileText,
  Gauge,
  History,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCircle,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { ProfilePhoto } from "../../components/ProfilePhoto";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { DEFAULT_EQUIPMENT_ID, EquipmentBase } from "./equipmentData";
import {
  getCachedEquipmentIdentity,
  getEquipmentIdentityById,
  getEquipmentRecommendedWorkQueue,
  getEquipmentRiskExplanations,
  getEquipmentRiskPrediction,
  getEquipmentSkillsShowcase,
} from "./equipmentService";
import type {
  EquipmentRecommendedWorkQueue,
  EquipmentRiskExplanation,
  EquipmentRiskPrediction,
  EquipmentSkillsShowcase,
} from "./equipmentService";
import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";

interface EquipmentOverviewDemo {
  healthScore: number;
  breakdownProbability: number;
  reliability: number;
  oee: number;
  awaitingNotifications: number;
  woOpen: number;
  woOverdue: number;
  woCritical: number;
  pmOverdue: number;
  calibrationBacklog: number;
  oldestOpenItem: string;
  sparesHealth: number;
  sparesOutOfStock: number;
  sparesCritical: number;
  sparesReserved: number;
  topRiskSpare: string;
  inventoryValue: string;
  documentsTotal: number;
  documentsIndexed: number;
  documentsAttention: number;
  latestDocument: string;
  repeatFailure: {
    title: string;
    occurrences: number;
    mtbf: string;
    component: string;
    references: string;
    document: string;
    confidence: number;
  };
  recentEvents: Array<{
    when: string;
    type: string;
    title: string;
    reference: string;
    tone: "red" | "amber" | "blue" | "green" | "violet";
  }>;
}

const VIAL_FILLER_OVERVIEW: EquipmentOverviewDemo = {
  healthScore: 68,
  breakdownProbability: 86,
  reliability: 62,
  oee: 65,
  awaitingNotifications: 3,
  woOpen: 12,
  woOverdue: 5,
  woCritical: 2,
  pmOverdue: 2,
  calibrationBacklog: 1,
  oldestOpenItem: "Bearing vibration notification · 18 days",
  sparesHealth: 62,
  sparesOutOfStock: 3,
  sparesCritical: 18,
  sparesReserved: 2,
  topRiskSpare: "Vacuum pump seal kit",
  inventoryValue: "£48,760",
  documentsTotal: 6,
  documentsIndexed: 6,
  documentsAttention: 0,
  latestDocument: "VF-02 Reject Sensor Verification Record",
  repeatFailure: {
    title: "Drive-end bearing vibration",
    occurrences: 4,
    mtbf: "47 days",
    component: "Main drive assembly",
    references: "WO-10482 · WO-10398 · N100214",
    document: "Fault-Finding Guide · Drawing MDA-04",
    confidence: 91,
  },
  recentEvents: [
    { when: "2h ago", type: "SAP import", title: "Latest maintenance and skills data processed", reference: "IMPORT-150726", tone: "blue" },
    { when: "6h ago", type: "Notification", title: "Drive-end bearing vibration above threshold", reference: "N100214", tone: "red" },
    { when: "Yesterday", type: "PM", title: "Daily visual inspection became overdue", reference: "450001248", tone: "amber" },
    { when: "2 days ago", type: "Spares", title: "Vacuum pump seal kit moved out of stock", reference: "MAT-700184", tone: "violet" },
    { when: "3 days ago", type: "Capability", title: "Rebecca Hughes started backup-SME pathway", reference: "CAP-VF02-02", tone: "green" },
  ],
};

interface PlanAction {
  priority: number;
  title: string;
  source: string;
  detail: string;
  status: string;
  current: number;
  projected: number;
  reduction: number;
  route: string;
}

const RANGE_LABELS = ["Daily", "Weekly", "Monthly", "YTD"] as const;
type TrendRange = (typeof RANGE_LABELS)[number];

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function riskTone(level: string): string {
  const value = level.toLowerCase();
  if (value.includes("critical")) return "border-red-500/30 bg-red-500/10 text-red-300";
  if (value.includes("high")) return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (value.includes("medium")) return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function eventTone(tone: EquipmentOverviewDemo["recentEvents"][number]["tone"]): string {
  if (tone === "red") return "bg-red-500/15 text-red-300 ring-red-500/20";
  if (tone === "amber") return "bg-amber-500/15 text-amber-300 ring-amber-500/20";
  if (tone === "green") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20";
  if (tone === "violet") return "bg-violet-500/15 text-violet-300 ring-violet-500/20";
  return "bg-blue-500/15 text-blue-300 ring-blue-500/20";
}

function actionRoute(equipmentId: string, action: EquipmentRecommendedWorkQueue["actions"][number]): string {
  if (action.workOrderNumber) return `/equipment/${equipmentId}/work-orders`;
  if (action.pmNumber) return `/equipment/${equipmentId}/pms`;
  if (action.sparePartNumber) return `/equipment/${equipmentId}/spares`;
  return `/equipment/${equipmentId}/ai-insights`;
}

function fallbackPlan(equipmentId: string, currentScore: number): PlanAction[] {
  const first = clampScore(currentScore - 10);
  const second = clampScore(first - 5);
  const third = clampScore(second - 6);
  return [
    {
      priority: 1,
      title: "Inspect drive-end bearing",
      source: "SAP notification N100214",
      detail: "Confirm vibration source, inspect bearing condition and validate sensor trend before the next production run.",
      status: "Awaiting work order",
      current: currentScore,
      projected: first,
      reduction: currentScore - first,
      route: `/equipment/${equipmentId}/notifications`,
    },
    {
      priority: 2,
      title: "Complete overdue daily inspection",
      source: "PM work order 450001248",
      detail: "Complete the visual inspection and record bearing, guard and lubrication findings in SAP.",
      status: "Overdue",
      current: first,
      projected: second,
      reduction: first - second,
      route: `/equipment/${equipmentId}/pms`,
    },
    {
      priority: 3,
      title: "Resolve PLC communication fault",
      source: "SAP notification N100219",
      detail: "Review intermittent communication history, connector integrity and the linked fault-finding guide.",
      status: "Open",
      current: second,
      projected: third,
      reduction: second - third,
      route: `/equipment/${equipmentId}/notifications`,
    },
  ];
}

function createPlan(
  queue: EquipmentRecommendedWorkQueue | null,
  equipmentId: string,
  currentScore: number,
): PlanAction[] {
  if (!queue?.actions.length) return fallbackPlan(equipmentId, currentScore);

  let runningScore = queue.currentRiskScore || currentScore;
  return queue.actions.slice(0, 3).map((action, index) => {
    const projected = action.projectedScore > 0
      ? clampScore(action.projectedScore)
      : clampScore(runningScore - action.calculatedReduction);
    const plan: PlanAction = {
      priority: action.priority || index + 1,
      title: action.action || action.workOrderDescription || action.pmTitle || action.partName || action.driver,
      source: action.workOrderNumber
        ? `SAP work order ${action.workOrderNumber}`
        : action.pmNumber
          ? `PM ${action.pmNumber}`
          : action.sparePartNumber
            ? `Spare ${action.sparePartNumber}`
            : action.actionType || action.driver,
      detail: action.detail || action.workOrderDescription || action.pmTitle || action.partName || action.driver,
      status: action.status || action.workOrderStatus || action.pmStatus || action.partAvailabilityStatus || "Recommended",
      current: runningScore,
      projected,
      reduction: Math.max(0, action.calculatedReduction || runningScore - projected),
      route: actionRoute(equipmentId, action),
    };
    runningScore = projected;
    return plan;
  });
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">{eyebrow}</p>
        ) : null}
        <h2 className="mt-1 text-base font-semibold text-slate-50">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function DonutChart({ value, color = "#f97316" }: { value: number; color?: string }) {
  const size = 84;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (clampScore(value) / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${value}%`}>
      <circle cx="42" cy="42" r={radius} fill="none" stroke="#202633" strokeWidth={strokeWidth} />
      <circle
        cx="42"
        cy="42"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${filled} ${circumference - filled}`}
        strokeLinecap="round"
        transform="rotate(-90 42 42)"
      />
      <text x="50%" y="51%" dominantBaseline="middle" textAnchor="middle" fill="#f8fafc" fontSize="17" fontWeight="700">
        {value}%
      </text>
    </svg>
  );
}

function Metric({ label, value, tone = "text-slate-100" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-600">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function RiskTrendChart({
  current,
  projected7,
  projected30,
  afterAction,
  range,
}: {
  current: number;
  projected7: number;
  projected30: number;
  afterAction: number;
  range: TrendRange;
}) {
  const width = 760;
  const height = 250;
  const pad = { left: 42, right: 22, top: 28, bottom: 40 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const historicalDelta = range === "Daily" ? 8 : range === "Weekly" ? 14 : range === "Monthly" ? 22 : 31;
  const historical = [
    clampScore(current - historicalDelta),
    clampScore(current - historicalDelta + 3),
    clampScore(current - historicalDelta + 5),
    clampScore(current - 6),
    clampScore(current - 4),
    clampScore(current - 2),
    clampScore(current),
  ];
  const noAction = [current, projected7, projected30];
  const withAction = [current, clampScore((current + afterAction) / 2), afterAction];
  const y = (score: number) => pad.top + ((100 - score) / 100) * plotHeight;
  const historyStep = plotWidth * 0.62 / (historical.length - 1);
  const futureStart = pad.left + plotWidth * 0.62;
  const futureStep = plotWidth * 0.38 / (noAction.length - 1);
  const points = (values: number[], start: number, step: number) =>
    values.map((value, index) => `${start + index * step},${y(value)}`).join(" ");
  const dateLabels = range === "Daily"
    ? ["09:00", "11:00", "13:00", "15:00", "Now", "+7d", "+30d"]
    : range === "Weekly"
      ? ["6 weeks", "5 weeks", "4 weeks", "3 weeks", "2 weeks", "Now", "+30d"]
      : range === "Monthly"
        ? ["Jan", "Feb", "Mar", "Apr", "May", "Now", "+30d"]
        : ["Q3", "Q4", "Q1", "Q2", "Jun", "Now", "+30d"];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[250px] w-full" role="img" aria-label="Equipment risk trend and forecast">
      {[25, 50, 75, 100].map((value) => (
        <g key={value}>
          <line x1={pad.left} y1={y(value)} x2={width - pad.right} y2={y(value)} stroke="#ffffff0d" strokeWidth="1" />
          <text x={pad.left - 8} y={y(value) + 4} textAnchor="end" fill="#475569" fontSize="10">{value}</text>
        </g>
      ))}
      <rect x={futureStart} y={pad.top} width={plotWidth * 0.38} height={plotHeight} fill="#3b82f607" rx="8" />
      <line x1={futureStart} y1={pad.top} x2={futureStart} y2={pad.top + plotHeight} stroke="#3b82f633" strokeDasharray="4 4" />
      <text x={futureStart + 8} y={pad.top + 14} fill="#60a5fa" fontSize="10" fontWeight="600">FORECAST</text>
      <polyline points={points(historical, pad.left, historyStep)} fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={points(noAction, futureStart, futureStep)} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 5" />
      <polyline points={points(withAction, futureStart, futureStep)} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {[...historical.map((value, index) => ({ x: pad.left + index * historyStep, value })), ...noAction.slice(1).map((value, index) => ({ x: futureStart + (index + 1) * futureStep, value }))].map((point, index) => (
        <circle key={index} cx={point.x} cy={y(point.value)} r="3.5" fill="#0f131b" stroke={index < historical.length ? "#f97316" : "#ef4444"} strokeWidth="2" />
      ))}
      {withAction.slice(1).map((value, index) => (
        <circle key={index} cx={futureStart + (index + 1) * futureStep} cy={y(value)} r="3.5" fill="#0f131b" stroke="#10b981" strokeWidth="2" />
      ))}
      {dateLabels.map((label, index) => (
        <text key={label} x={pad.left + (plotWidth / (dateLabels.length - 1)) * index} y={height - 12} textAnchor="middle" fill="#475569" fontSize="10">{label}</text>
      ))}
      <g transform={`translate(${pad.left + plotWidth * 0.2}, ${pad.top + 18})`}>
        <circle r="4" fill="#f97316" /><text x="9" y="4" fill="#94a3b8" fontSize="10">Actual risk</text>
        <circle cx="92" r="4" fill="#ef4444" /><text x="101" y="4" fill="#94a3b8" fontSize="10">No action</text>
        <circle cx="178" r="4" fill="#10b981" /><text x="187" y="4" fill="#94a3b8" fontSize="10">After plan</text>
      </g>
    </svg>
  );
}

export const EquipmentOverview = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [equipmentBase, setEquipmentBase] = useState<EquipmentBase | null>(() =>
    getCachedEquipmentIdentity(resolvedId) ?? getCachedEquipmentIdentity(DEFAULT_EQUIPMENT_ID),
  );
  const [prediction, setPrediction] = useState<EquipmentRiskPrediction | null>(null);
  const [workQueue, setWorkQueue] = useState<EquipmentRecommendedWorkQueue | null>(null);
  const [explanations, setExplanations] = useState<EquipmentRiskExplanation[]>([]);
  const [skills, setSkills] = useState<EquipmentSkillsShowcase | null>(null);
  const [trendRange, setTrendRange] = useState<TrendRange>("Monthly");
  const [question, setQuestion] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getEquipmentIdentityById(resolvedId).then((data) => { if (!cancelled) setEquipmentBase(data); });
    void getEquipmentRiskPrediction(resolvedId).then((data) => { if (!cancelled) setPrediction(data); });
    void getEquipmentRecommendedWorkQueue(resolvedId).then((data) => { if (!cancelled) setWorkQueue(data); });
    void getEquipmentRiskExplanations(resolvedId).then((data) => { if (!cancelled) setExplanations(data); });
    void getEquipmentSkillsShowcase(resolvedId).then((data) => { if (!cancelled) setSkills(data); });
    return () => { cancelled = true; };
  }, [resolvedId]);

  const demo = VIAL_FILLER_OVERVIEW;
  const primarySme = skills?.engineers.find((engineer) => engineer.capabilityRole === "PRIMARY_SME");
  const currentRisk = clampScore(workQueue?.currentRiskScore || prediction?.currentScore || equipmentBase?.riskScore || 82);
  const plan = useMemo(
    () => createPlan(workQueue, resolvedId, currentRisk),
    [workQueue, resolvedId, currentRisk],
  );
  const afterPlan = plan.length ? plan[plan.length - 1].projected : prediction?.estimatedScoreAfterAction || clampScore(currentRisk - 20);
  const projected7 = prediction?.projected7 ?? clampScore(currentRisk + 4);
  const projected30 = prediction?.projected30 ?? clampScore(currentRisk + 9);
  const totalReduction = Math.max(0, currentRisk - afterPlan);
  const driverRows = explanations.length
    ? explanations.slice(0, 5).map((driver) => ({ label: driver.driver, pct: driver.driverPct, evidence: driver.evidence }))
    : (equipmentBase?.riskBreakdown ?? []).map((driver) => ({ label: driver.label, pct: driver.pct, evidence: null }));

  if (!equipmentBase) {
    return (
      <section className="flex w-full flex-col pb-10">
        <div className="border-b border-gray-800 bg-[#0b0e14] px-4 py-4 md:px-6">
          <div className="h-40 animate-pulse rounded-xl bg-[#141820]" />
        </div>
      </section>
    );
  }

  const eq = equipmentBase;
  const riskTotal = eq.riskBreakdown.reduce((sum, item) => sum + item.pct, 0) || 1;
  const riskBadgeClass = riskTone(eq.riskLevel);
  const briefing = `${eq.name} remains ${eq.riskLevel} Risk at ${currentRisk}%. Risk is primarily driven by ${driverRows.slice(0, 3).map((driver) => driver.label.toLowerCase()).join(", ") || "maintenance backlog and asset criticality"}. ${demo.awaitingNotifications} SAP maintenance notifications are still awaiting work-order conversion, while the repeat vibration pattern on the main drive assembly increases the likelihood of unplanned downtime.`;

  const askVorta = () => {
    const prompt = question.trim();
    const query = prompt ? `?prompt=${encodeURIComponent(prompt)}` : "";
    navigate(`/equipment/${eq.id}/ai-insights${query}`);
  };

  const copyAssetReference = () => {
    const copyPromise = navigator.clipboard?.writeText(eq.assetNumber);
    if (!copyPromise) return;
    void copyPromise.then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
      <div className="lg:sticky lg:top-0 z-10 border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
            <button type="button" onClick={() => navigate("/equipment")} className="transition-colors hover:text-slate-300">Equipment</button>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-slate-300">{eq.name} ({eq.assetNumber})</span>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" onClick={copyAssetReference} className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs text-slate-300 hover:bg-gray-800 hover:text-slate-100">
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy asset ref"}
            </Button>
            <button type="button" onClick={() => window.location.reload()} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200" aria-label="Refresh equipment intelligence">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200" aria-label="Equipment notifications">
              <Bell className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => navigate("/settings")} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200" aria-label="Profile settings">
              <UserCircle className="h-7 w-7" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">
            <img src={eq.image} alt={eq.name} className="h-full w-full object-cover" onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">{eq.name}</h1>
              <Badge className={`inline-flex h-auto rounded border px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}>{eq.riskLevel} Risk</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <EquipmentRiskIndicator riskLevel={eq.riskLevel} />
              <span className="text-sm font-semibold text-slate-200">{eq.status}</span>
              <span className="text-sm text-slate-500">{eq.statusNote}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="font-medium text-slate-300">{eq.assetNumber}</span>
              <span className="rounded bg-gray-800 px-1.5 py-0.5 font-medium tracking-wide">{eq.type}</span>
              <span>📍 {eq.area}</span>
              <span>Manufacturer: <span className="text-slate-300">{eq.manufacturer}</span></span>
              <span>Model: <span className="text-slate-300">{eq.model}</span></span>
              <span>Criticality: <span className="text-slate-300">{eq.criticality}</span></span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 lg:w-52">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Score</span>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-slate-50">{currentRisk}%</span>
              <Badge className={`mb-1 inline-flex h-auto rounded border px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}>{eq.riskLevel}</Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500">Risk drivers</span>
              <div className="flex h-2 overflow-hidden rounded-full bg-gray-800">
                {eq.riskBreakdown.map((driver) => (
                  <div key={driver.label} style={{ width: `${(driver.pct / riskTotal) * 100}%`, backgroundColor: driver.color }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {eq.riskBreakdown.map((driver) => (
                  <span key={driver.label} className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${driver.dotClass}`} />{driver.label} {driver.pct}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <EquipmentTabNavigation equipmentId={eq.id} activeTab="overview" />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">
        <Card className="overflow-hidden rounded-2xl border border-blue-500/25 bg-[linear-gradient(135deg,#131923_0%,#10151d_55%,#101722_100%)] shadow-none">
          <CardContent className="p-0">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="h-auto rounded bg-blue-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300 shadow-none">Equipment intelligence</Badge>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><Database className="h-3.5 w-3.5" />SAP · Skills · Spares · Documents · refreshed 2h ago</span>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-50">Equipment Risk Briefing</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{briefing}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-gray-800 bg-[#0c1118]/80 p-3"><Metric label="Awaiting SAP work order" value={demo.awaitingNotifications} tone="text-orange-300" /></div>
                  <div className="rounded-xl border border-gray-800 bg-[#0c1118]/80 p-3"><Metric label="Predicted failure mode" value="Bearing degradation" tone="text-red-300" /></div>
                  <div className="rounded-xl border border-gray-800 bg-[#0c1118]/80 p-3"><Metric label="Risk after plan" value={`${afterPlan}%`} tone="text-emerald-300" /></div>
                  <div className="rounded-xl border border-gray-800 bg-[#0c1118]/80 p-3"><Metric label="Calculated reduction" value={`-${totalReduction} points`} tone="text-emerald-300" /></div>
                </div>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-gray-700 bg-[#0a0f16] px-3 focus-within:border-blue-500/60">
                    <Sparkles className="h-4 w-4 shrink-0 text-blue-400" />
                    <input
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") askVorta(); }}
                      placeholder={`Ask Vorta about ${eq.assetNumber}...`}
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                    />
                  </div>
                  <Button type="button" onClick={askVorta} className="min-h-11 gap-2 bg-blue-600 px-5 text-white hover:bg-blue-500"><BrainCircuit className="h-4 w-4" />Ask Vorta</Button>
                </div>
              </div>
              <div className="border-t border-gray-800 bg-[#0b1017]/70 p-5 xl:border-l xl:border-t-0 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Risk evidence</p>
                <div className="mt-4 flex flex-col gap-3">
                  {driverRows.slice(0, 5).map((driver, index) => (
                    <div key={`${driver.label}-${index}`}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-slate-300">{driver.label}</span>
                        <span className="font-semibold text-slate-100">{Math.round(driver.pct)}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-blue-500/70" style={{ width: `${Math.min(100, Math.max(4, driver.pct))}%` }} /></div>
                      {driver.evidence ? <p className="mt-1 truncate text-[10px] text-slate-600">{driver.evidence}</p> : null}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => navigate(`/equipment/${eq.id}/ai-insights`)} className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300">Open full risk explanation <ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-orange-500/25 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <SectionHeading
              eyebrow="Risk reduction plan"
              title="Highest-value interventions"
              description="Vorta ranks the work most likely to remove future equipment risk, then recalculates the projected score after each intervention."
              action={<Button type="button" variant="outline" onClick={() => navigate(`/equipment/${eq.id}/ai-insights`)} className="h-9 border-orange-500/30 bg-orange-500/10 text-xs text-orange-200 hover:bg-orange-500/15">View full intervention plan</Button>}
            />
            <div className="mt-5 overflow-hidden rounded-xl border border-gray-800">
              <div className="hidden grid-cols-[60px_minmax(220px,1.6fr)_minmax(150px,1fr)_100px_100px_90px_42px] gap-3 border-b border-gray-800 bg-[#0d1219] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 lg:grid">
                <span>Priority</span><span>Intervention</span><span>Source</span><span>Current</span><span>After</span><span>Reduction</span><span />
              </div>
              {plan.map((action) => (
                <button key={`${action.priority}-${action.title}`} type="button" onClick={() => navigate(action.route)} className="grid w-full gap-3 border-b border-gray-800 px-4 py-4 text-left transition-colors last:border-0 hover:bg-white/[0.025] lg:grid-cols-[60px_minmax(220px,1.6fr)_minmax(150px,1fr)_100px_100px_90px_42px] lg:items-center">
                  <div className="flex items-center gap-3 lg:block"><span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-sm font-bold text-orange-300">{action.priority}</span><span className="text-[10px] font-semibold uppercase text-slate-600 lg:hidden">Priority</span></div>
                  <div className="min-w-0"><p className="text-sm font-semibold text-slate-100">{action.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{action.detail}</p><Badge className={`mt-2 h-auto rounded border px-2 py-0.5 text-[9px] font-semibold shadow-none ${action.status.toLowerCase().includes("overdue") || action.status.toLowerCase().includes("awaiting") ? "border-orange-500/25 bg-orange-500/10 text-orange-300" : "border-gray-700 bg-gray-800 text-slate-400"}`}>{action.status}</Badge></div>
                  <p className="text-xs text-slate-400">{action.source}</p>
                  <Metric label="Current" value={action.current} />
                  <Metric label="After" value={action.projected} tone="text-emerald-300" />
                  <Metric label="Reduction" value={`-${Math.round(action.reduction)}`} tone="text-emerald-300" />
                  <ChevronRight className="hidden h-4 w-4 text-slate-600 lg:block" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-4">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-400" /><h3 className="text-sm font-semibold text-slate-100">Maintenance backlog</h3></div><button onClick={() => navigate(`/equipment/${eq.id}/work-orders`)} className="text-[11px] text-blue-400">View work</button></div>
              <div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Notifications" value={demo.awaitingNotifications} tone="text-orange-300" /><Metric label="Open WOs" value={demo.woOpen} /><Metric label="Overdue WOs" value={demo.woOverdue} tone="text-red-300" /><Metric label="Critical WOs" value={demo.woCritical} tone="text-red-300" /><Metric label="Overdue PMs" value={demo.pmOverdue} tone="text-amber-300" /><Metric label="Calibration" value={demo.calibrationBacklog} tone="text-amber-300" /></div>
              <div className="mt-4 rounded-lg border border-orange-500/15 bg-orange-500/5 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-600">Oldest unresolved item</p><p className="mt-1 text-xs font-medium text-orange-200">{demo.oldestOpenItem}</p></div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /><h3 className="text-sm font-semibold text-slate-100">People & capability</h3></div><button onClick={() => navigate(`/equipment/${eq.id}/skills`)} className="text-[11px] text-blue-400">View skills</button></div>
              <div className="mt-4 flex items-center gap-3">
                <ProfilePhoto name={primarySme?.engineerName ?? "James Mitchell"} entityType="engineer" entityId={primarySme?.engineerId} sizeClass="h-14 w-14" shapeClass="rounded-xl" fallbackClass="bg-emerald-500/15 text-emerald-300" eager />
                <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-slate-600">Primary SME</p><p className="truncate text-sm font-semibold text-slate-100">{primarySme?.engineerName ?? "James Mitchell"}</p><p className="mt-1 text-[11px] text-slate-500">{primarySme ? `${primarySme.requiredSkillMatches}/${primarySme.requiredSkillTotal} required skills matched` : "7/11 required skills matched"}</p></div>
              </div>
              <div className="mt-4 space-y-3">
                <div><div className="mb-1 flex justify-between text-[11px]"><span className="text-slate-500">Required skills coverage</span><span className="font-semibold text-amber-300">{primarySme ? Math.round((primarySme.requiredSkillMatches / Math.max(1, primarySme.requiredSkillTotal)) * 100) : 64}%</span></div><Progress value={primarySme ? (primarySme.requiredSkillMatches / Math.max(1, primarySme.requiredSkillTotal)) * 100 : 64} className="h-1.5 bg-gray-800 [&>div]:bg-amber-500" /></div>
                <div className="grid grid-cols-2 gap-3"><Metric label="Backup resilience" value={skills?.backupSmeCount ? `${skills.backupSmeCount} validated` : `${skills?.developingBackupCount ?? 1} developing`} tone="text-amber-300" /><Metric label="AM shift cover" value={`${skills?.rotatingShiftCoverageCount ?? 3}/4 shifts`} tone="text-amber-300" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><PackageSearch className="h-4 w-4 text-violet-400" /><h3 className="text-sm font-semibold text-slate-100">Critical spares</h3></div><button onClick={() => navigate(`/equipment/${eq.id}/spares`)} className="text-[11px] text-blue-400">View spares</button></div>
              <div className="mt-4 flex items-center gap-4"><DonutChart value={demo.sparesHealth} color="#8b5cf6" /><div className="grid flex-1 grid-cols-2 gap-3"><Metric label="Critical" value={demo.sparesCritical} /><Metric label="Stock-outs" value={demo.sparesOutOfStock} tone="text-red-300" /><Metric label="Reserved" value={demo.sparesReserved} tone="text-blue-300" /><Metric label="Exposure" value={demo.inventoryValue} /></div></div>
              <div className="mt-4 rounded-lg border border-red-500/15 bg-red-500/5 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-600">Highest-risk unavailable part</p><p className="mt-1 text-xs font-medium text-red-200">{demo.topRiskSpare}</p></div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-blue-400" /><h3 className="text-sm font-semibold text-slate-100">Knowledge & evidence</h3></div><button onClick={() => navigate(`/equipment/${eq.id}/documents`)} className="text-[11px] text-blue-400">View documents</button></div>
              <div className="mt-4 grid grid-cols-2 gap-3"><Metric label="References" value={demo.documentsTotal} /><Metric label="AI indexed" value={`${demo.documentsIndexed}/${demo.documentsTotal}`} tone="text-blue-300" /><Metric label="Need attention" value={demo.documentsAttention} tone="text-emerald-300" /><Metric label="Search coverage" value="100%" tone="text-emerald-300" /></div>
              <div className="mt-4 rounded-lg border border-blue-500/15 bg-blue-500/5 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-600">Latest linked evidence</p><p className="mt-1 text-xs font-medium text-blue-200">{demo.latestDocument}</p><p className="mt-1 text-[10px] text-slate-600">Page 3 · Results and Acceptance · AI searchable</p></div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.65fr)]">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <SectionHeading
                eyebrow="Risk trend & forecast"
                title="What happens next"
                description="Historical risk is combined with current SAP backlog, capability, spares and document evidence. The green forecast shows the calculated impact of completing the intervention plan."
                action={<div className="flex rounded-lg border border-gray-800 bg-[#0d1219] p-1">{RANGE_LABELS.map((range) => <button key={range} type="button" onClick={() => setTrendRange(range)} className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${trendRange === range ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}>{range}</button>)}</div>}
              />
              <div className="mt-4"><RiskTrendChart current={currentRisk} projected7={projected7} projected30={projected30} afterAction={afterPlan} range={trendRange} /></div>
              <div className="grid gap-3 border-t border-gray-800 pt-4 sm:grid-cols-3"><Metric label="Current risk" value={`${currentRisk}%`} tone="text-orange-300" /><Metric label="30-day no action" value={`${projected30}%`} tone="text-red-300" /><Metric label="After recommended plan" value={`${afterPlan}% · -${totalReduction} points`} tone="text-emerald-300" /></div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-blue-500/20 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-blue-400" /><h3 className="text-sm font-semibold text-slate-100">Repeat-failure intelligence</h3></div><Badge className="h-auto rounded bg-blue-500/15 px-2 py-0.5 text-[9px] font-semibold text-blue-300 shadow-none">{demo.repeatFailure.confidence}% confidence</Badge></div>
              <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-red-400">Recurring fault pattern</p><p className="mt-2 text-base font-semibold text-slate-50">{demo.repeatFailure.title}</p><p className="mt-2 text-xs leading-5 text-slate-400">Four related maintenance records show the same vibration signature returning after temporary corrective work. Vorta recommends condition confirmation before replacing parts.</p></div>
              <div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Occurrences" value={demo.repeatFailure.occurrences} tone="text-red-300" /><Metric label="Mean time between" value={demo.repeatFailure.mtbf} /><Metric label="Component" value={demo.repeatFailure.component} /><Metric label="AI confidence" value={`${demo.repeatFailure.confidence}%`} tone="text-blue-300" /></div>
              <div className="mt-4 space-y-3 border-t border-gray-800 pt-4"><div><p className="text-[10px] uppercase tracking-wide text-slate-600">Linked maintenance records</p><p className="mt-1 text-xs text-slate-300">{demo.repeatFailure.references}</p></div><div><p className="text-[10px] uppercase tracking-wide text-slate-600">Relevant evidence</p><p className="mt-1 text-xs text-blue-300">{demo.repeatFailure.document}</p></div></div>
              <button type="button" onClick={() => navigate(`/equipment/${eq.id}/history`)} className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300">Investigate failure pattern <ArrowRight className="h-3.5 w-3.5" /></button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <SectionHeading title="Recent equipment events" description="Only events that materially change equipment risk, resilience or evidence are shown here." action={<button type="button" onClick={() => navigate(`/equipment/${eq.id}/history`)} className="text-xs font-semibold text-blue-400 hover:text-blue-300">View complete history</button>} />
              <div className="mt-5">
                {demo.recentEvents.map((event, index) => (
                  <div key={`${event.reference}-${index}`} className="relative flex gap-4 pb-5 last:pb-0">
                    {index < demo.recentEvents.length - 1 ? <div className="absolute left-[15px] top-8 h-[calc(100%-20px)] w-px bg-gray-800" /> : null}
                    <div className={`relative z-[1] mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${eventTone(event.tone)}`}><span className="h-2 w-2 rounded-full bg-current" /></div>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-200">{event.title}</p><span className="text-[10px] text-slate-600">{event.when}</span></div><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]"><Badge className="h-auto rounded bg-gray-800 px-2 py-0.5 text-[9px] font-medium text-slate-400 shadow-none">{event.type}</Badge><span className="font-mono text-slate-500">{event.reference}</span></div></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <SectionHeading title="Equipment intelligence actions" description="Read-only navigation into the evidence and decisions behind this asset." />
              <div className="mt-5 grid gap-2">
                {[
                  { label: "Ask Vorta about this equipment", icon: Sparkles, route: `/equipment/${eq.id}/ai-insights` },
                  { label: "View intervention plan", icon: TrendingDown, route: `/equipment/${eq.id}/ai-insights` },
                  { label: "Review SAP notifications", icon: AlertTriangle, route: `/equipment/${eq.id}/notifications` },
                  { label: "Search linked documents", icon: FileSearch, route: `/equipment/${eq.id}/documents` },
                  { label: "View critical spares", icon: Boxes, route: `/equipment/${eq.id}/spares` },
                  { label: "View qualified engineers", icon: Users, route: `/equipment/${eq.id}/skills` },
                ].map((action) => (
                  <button key={action.label} type="button" onClick={() => navigate(action.route)} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#0d1219] px-3 py-3 text-left transition-colors hover:border-blue-500/30 hover:bg-blue-500/5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10"><action.icon className="h-4 w-4 text-blue-400" /></div><span className="min-w-0 flex-1 text-xs font-semibold text-slate-300">{action.label}</span><ChevronRight className="h-4 w-4 text-slate-600" />
                  </button>
                ))}
                <button type="button" onClick={copyAssetReference} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#0d1219] px-3 py-3 text-left transition-colors hover:border-blue-500/30 hover:bg-blue-500/5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10"><ClipboardCopy className="h-4 w-4 text-blue-400" /></div><span className="min-w-0 flex-1 text-xs font-semibold text-slate-300">{copied ? "Asset reference copied" : "Copy asset reference"}</span><ChevronRight className="h-4 w-4 text-slate-600" /></button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-3 text-[10px] text-slate-600">
          <span className="inline-flex items-center gap-1.5"><Database className="h-3.5 w-3.5" />Risk intelligence based on the latest SAP, skills, spares and document data.</span>
          <span>Read-only · source systems remain authoritative</span>
        </div>
      </div>
    </section>
  );
};
