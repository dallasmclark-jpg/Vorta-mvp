import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Boxes,
  BrainCircuit,
  Check,
  ChevronRight,
  Copy,
  Database,
  FileSearch,
  Gauge,
  GraduationCap,
  History,
  Layers3,
  LineChart,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserCircle,
  Wrench,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { DEFAULT_EQUIPMENT_ID, type EquipmentBase } from "./equipmentData";
import {
  getCachedEquipmentIdentity,
  getEquipmentRecommendedWorkQueue,
  getEquipmentRiskExplanations,
  getEquipmentRiskPrediction,
  getEquipmentRiskTrendSeries,
  getEquipmentSummary,
  searchEquipmentKnowledge,
  type EquipmentKnowledgeChunk,
  type EquipmentRecommendedWorkAction,
  type EquipmentRecommendedWorkQueue,
  type EquipmentRiskExplanation,
  type EquipmentRiskPrediction,
  type EquipmentRiskTrendSeries,
  type EquipmentSummary,
} from "./equipmentService";
import { EquipmentKnowledgeAssistant } from "./EquipmentKnowledgeAssistant";
import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";

type AskResult = {
  prompt: string;
  answer: string;
  evidence: string[];
  sources: Array<{ label: string; detail: string; url?: string | null }>;
  confidence: number;
};

type FailurePattern = {
  key: string;
  label: string;
  count: number;
  latestDate: string;
  references: string[];
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function riskTone(level: string): string {
  const value = level.toLowerCase();
  if (value === "critical") return "border-red-500/25 bg-red-500/10 text-red-300";
  if (value === "high") return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  if (value === "medium") return "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}

function formatDateTime(value: Date | null): string {
  if (!value) return "Loading latest equipment evidence";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatDate(value?: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function Metric({
  label,
  value,
  detail,
  tone = "text-slate-50",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0b1017]/80 p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p>
    </div>
  );
}

function sourceLabel(chunk: EquipmentKnowledgeChunk): string {
  const section = chunk.sectionTitle || chunk.chunkRef;
  const location = [
    chunk.drawingNumber ? `Drawing ${chunk.drawingNumber}` : null,
    chunk.sheetNumber ? `Sheet ${chunk.sheetNumber}` : null,
    chunk.pageNumber != null ? `Page ${chunk.pageNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `${chunk.title}${chunk.revision ? ` ${chunk.revision}` : ""}${section ? ` · ${section}` : ""}${location ? ` · ${location}` : ""}`;
}

function extractFailurePatterns(summary: EquipmentSummary | null): FailurePattern[] {
  if (!summary) return [];
  const groups = new Map<string, FailurePattern>();

  summary.activity.forEach((row) => {
    const description = row.description || "";
    const code = description.match(/\b(?:ALM|ERR|FAULT|F|FC)[-\s]?\d{2,6}\b/i)?.[0];
    const phrase = description
      .split(/[—:;-]/)[0]
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join(" ");
    const key = (code || phrase || row.type).toLowerCase();
    const label = code ? code.toUpperCase() : phrase || row.type;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.references.push(row.woNumber);
      if (new Date(row.date).getTime() > new Date(existing.latestDate).getTime()) {
        existing.latestDate = row.date;
      }
    } else {
      groups.set(key, {
        key,
        label,
        count: 1,
        latestDate: row.date,
        references: [row.woNumber],
      });
    }
  });

  return [...groups.values()]
    .filter((pattern) => pattern.count > 1)
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);
}

function actionRoute(equipmentId: string, action: EquipmentRecommendedWorkAction): string {
  if (action.sparePartNumber) return `/equipment/${equipmentId}/spares`;
  if (action.workOrderNumber || action.pmNumber) return `/equipment/${equipmentId}/work-orders`;
  return `/equipment/${equipmentId}/overview`;
}

function ForecastChart({
  series,
  current,
  projected7,
  projected30,
  afterPlan,
}: {
  series: EquipmentRiskTrendSeries | null;
  current: number;
  projected7: number;
  projected30: number;
  afterPlan: number;
}): JSX.Element {
  const actual = (series?.["30d"] ?? []).slice(-10);
  const actualValues = actual.length ? actual.map((point) => clamp(point.riskScore)) : [current];
  const width = 920;
  const height = 255;
  const pad = { left: 42, right: 24, top: 26, bottom: 36 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const actualEnd = pad.left + plotWidth * 0.66;
  const actualStep = actualValues.length > 1 ? (actualEnd - pad.left) / (actualValues.length - 1) : 0;
  const futureStep = (width - pad.right - actualEnd) / 2;
  const y = (score: number) => pad.top + ((100 - clamp(score)) / 100) * plotHeight;
  const points = (values: number[], start: number, step: number) =>
    values.map((value, index) => `${start + index * step},${y(value)}`).join(" ");
  const noAction = [current, projected7, projected30];
  const withPlan = [current, clamp((current + afterPlan) / 2), afterPlan];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[255px] min-w-[760px] w-full" role="img" aria-label="Live equipment risk history and forecast">
      {[25, 50, 75, 100].map((value) => (
        <g key={value}>
          <line x1={pad.left} y1={y(value)} x2={width - pad.right} y2={y(value)} stroke="#ffffff0a" />
          <text x={pad.left - 8} y={y(value) + 4} textAnchor="end" fill="#475569" fontSize="10">{value}</text>
        </g>
      ))}
      <rect x={actualEnd} y={pad.top} width={width - pad.right - actualEnd} height={plotHeight} rx="8" fill="#3b82f608" />
      <line x1={actualEnd} x2={actualEnd} y1={pad.top} y2={pad.top + plotHeight} stroke="#3b82f640" strokeDasharray="4 4" />
      <text x={actualEnd + 10} y={pad.top + 15} fill="#60a5fa" fontSize="10" fontWeight="600">FORECAST</text>
      {actualValues.length > 1 ? (
        <polyline points={points(actualValues, pad.left, actualStep)} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      <polyline points={points(noAction, actualEnd, futureStep)} fill="none" stroke="#ef4444" strokeWidth="3" strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={points(withPlan, actualEnd, futureStep)} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {actualValues.map((value, index) => (
        <circle key={`actual-${index}`} cx={pad.left + index * actualStep} cy={y(value)} r="3.5" fill="#10151d" stroke="#a78bfa" strokeWidth="2" />
      ))}
      {noAction.slice(1).map((value, index) => (
        <circle key={`no-action-${index}`} cx={actualEnd + (index + 1) * futureStep} cy={y(value)} r="3.5" fill="#10151d" stroke="#ef4444" strokeWidth="2" />
      ))}
      {withPlan.slice(1).map((value, index) => (
        <circle key={`plan-${index}`} cx={actualEnd + (index + 1) * futureStep} cy={y(value)} r="3.5" fill="#10151d" stroke="#10b981" strokeWidth="2" />
      ))}
      <text x={pad.left} y={height - 10} fill="#64748b" fontSize="10">Available history</text>
      <text x={actualEnd} y={height - 10} textAnchor="middle" fill="#64748b" fontSize="10">Now</text>
      <text x={actualEnd + futureStep} y={height - 10} textAnchor="middle" fill="#64748b" fontSize="10">+7 days</text>
      <text x={actualEnd + futureStep * 2} y={height - 10} textAnchor="middle" fill="#64748b" fontSize="10">+30 days</text>
    </svg>
  );
}

export const EquipmentAiInsights = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const initialPrompt = new URLSearchParams(location.search).get("prompt") ?? "";

  const [equipment, setEquipment] = useState<EquipmentBase | null>(() => getCachedEquipmentIdentity(resolvedId));
  const [summary, setSummary] = useState<EquipmentSummary | null>(null);
  const [prediction, setPrediction] = useState<EquipmentRiskPrediction | null>(null);
  const [workQueue, setWorkQueue] = useState<EquipmentRecommendedWorkQueue | null>(null);
  const [explanations, setExplanations] = useState<EquipmentRiskExplanation[]>([]);
  const [trendSeries, setTrendSeries] = useState<EquipmentRiskTrendSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [question, setQuestion] = useState(initialPrompt);
  const [askLoading, setAskLoading] = useState(false);
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [copied, setCopied] = useState(false);
  const assistantRef = useRef<HTMLDivElement>(null);
  const processedPromptRef = useRef<string>("");

  const loadIntelligence = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const summaryData = await getEquipmentSummary(resolvedId);
      setSummary(summaryData);
      setEquipment(summaryData.equipment);

      const [predictionData, queueData, explanationData, trendData] = await Promise.all([
        getEquipmentRiskPrediction(resolvedId).catch(() => null),
        getEquipmentRecommendedWorkQueue(resolvedId).catch(() => null),
        getEquipmentRiskExplanations(resolvedId).catch(() => []),
        getEquipmentRiskTrendSeries(resolvedId).catch(() => null),
      ]);

      setPrediction(predictionData);
      setWorkQueue(queueData);
      setExplanations(explanationData);
      setTrendSeries(trendData);
      setLastUpdated(new Date());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Equipment intelligence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => {
    void loadIntelligence();
  }, [loadIntelligence]);

  const currentRisk = clamp(workQueue?.currentRiskScore ?? prediction?.currentScore ?? equipment?.riskScore ?? 0);
  const projected7 = clamp(prediction?.projected7 ?? currentRisk);
  const projected30 = clamp(prediction?.projected30 ?? currentRisk);
  const afterPlan = clamp(workQueue?.projectedRiskScore ?? prediction?.estimatedScoreAfterAction ?? currentRisk);
  const availableReduction = Math.max(0, currentRisk - afterPlan);
  const topDriver = explanations[0] ?? null;
  const topAction = workQueue?.actions[0] ?? null;

  const openWorkOrders = summary?.workOrders.open.length ?? 0;
  const overdueWorkOrders = summary?.workOrders.open.filter((order) => order.overdue).length ?? 0;
  const overduePms = summary?.pms.filter((pm) => pm.status === "OVERDUE").length ?? 0;
  const pmCompliance = summary?.pms.length
    ? Math.round(summary.pms.reduce((sum, pm) => sum + pm.compliance, 0) / summary.pms.length)
    : 0;
  const criticalSpares = summary?.components.criticalComponents.length ?? 0;
  const skillCoverage = summary?.skills.coverageSummary.coveragePercent ?? 0;
  const documents = summary?.documents ?? [];
  const aiIndexedDocuments = documents.filter((document) => document.aiIndexed).length;
  const failurePatterns = useMemo(() => extractFailurePatterns(summary), [summary]);

  const evidenceDomains = useMemo(() => {
    return [
      { label: "Risk model", available: Boolean(equipment?.riskBreakdown.length), value: `${equipment?.riskBreakdown.length ?? 0} drivers`, route: `/equipment/${resolvedId}/overview`, icon: Gauge },
      { label: "Work execution", available: Boolean(summary?.workOrders.open.length || summary?.workOrders.completed.length), value: `${openWorkOrders} open`, route: `/equipment/${resolvedId}/work-orders`, icon: Wrench },
      { label: "Maintenance history", available: Boolean(summary?.activity.length), value: `${summary?.activity.length ?? 0} records`, route: `/equipment/${resolvedId}/history`, icon: History },
      { label: "Critical spares", available: Boolean(summary?.components.inventory.length), value: `${criticalSpares} exposed`, route: `/equipment/${resolvedId}/spares`, icon: Boxes },
      { label: "Capability", available: Boolean(summary?.skills.skills.length || summary?.skills.legacySkills.length), value: `${skillCoverage}% covered`, route: `/equipment/${resolvedId}/skills`, icon: GraduationCap },
      { label: "Controlled knowledge", available: Boolean(documents.length), value: `${aiIndexedDocuments}/${documents.length} indexed`, route: `/equipment/${resolvedId}/documents`, icon: BookOpen },
    ];
  }, [aiIndexedDocuments, criticalSpares, documents.length, equipment?.riskBreakdown.length, openWorkOrders, resolvedId, skillCoverage, summary]);

  const evidenceCoverage = Math.round((evidenceDomains.filter((domain) => domain.available).length / evidenceDomains.length) * 100);
  const modelConfidence = clamp(48 + evidenceDomains.filter((domain) => domain.available).length * 7 + Math.min(10, aiIndexedDocuments * 2));

  const runAnalysis = useCallback(async (rawPrompt?: string) => {
    if (!summary || !equipment) return;
    const prompt = (rawPrompt ?? question).trim() || `Explain the current risk and the highest-value intervention for ${equipment.name}.`;
    setQuestion(prompt);
    setAskLoading(true);

    const chunks = await searchEquipmentKnowledge(resolvedId, prompt, 6).catch(() => [] as EquipmentKnowledgeChunk[]);
    const lower = prompt.toLowerCase();
    const evidence: string[] = [];
    const sources: AskResult["sources"] = [];

    if (topDriver) {
      evidence.push(`${topDriver.driver} contributes ${topDriver.driverPct}% of the current risk model${topDriver.evidence ? `: ${topDriver.evidence}` : "."}`);
    } else if (equipment.riskBreakdown[0]) {
      evidence.push(`${equipment.riskBreakdown[0].label} is the largest visible risk driver at ${equipment.riskBreakdown[0].pct}%.`);
    }

    evidence.push(`${openWorkOrders} open work orders, including ${overdueWorkOrders} overdue.`);
    evidence.push(`PM compliance is ${pmCompliance}% with ${overduePms} overdue PMs.`);
    evidence.push(`${criticalSpares} critical spare availability issues and ${skillCoverage}% validated skill coverage are linked to this asset.`);

    chunks.slice(0, 4).forEach((chunk) => {
      sources.push({
        label: sourceLabel(chunk),
        detail: `${chunk.sourceSystem} · ${chunk.documentType} · ${Math.round(chunk.rank * 100)}% match`,
        url: chunk.sourceUrl,
      });
    });

    let answer: string;
    if (/manual|drawing|document|sop|procedure|instruction/.test(lower)) {
      answer = chunks.length
        ? `Vorta found ${chunks.length} relevant approved knowledge section${chunks.length === 1 ? "" : "s"}. The strongest match is ${sourceLabel(chunks[0])}. Use the linked controlled source before execution.`
        : `No matching indexed source section was found for this question. The equipment has ${documents.length} document references, of which ${aiIndexedDocuments} are currently AI-searchable.`;
    } else if (/spare|part|stock|bom/.test(lower)) {
      answer = criticalSpares
        ? `${criticalSpares} critical component${criticalSpares === 1 ? " is" : "s are"} currently exposed. The first spares action should be checked against the equipment intervention queue and supplier lead-time evidence before the planned work window.`
        : `No critical stock exposure is present in the current component data. ${summary.components.inventory.length} linked parts remain available for investigation.`;
    } else if (/skill|engineer|trained|capability|competent/.test(lower)) {
      answer = `Validated skill coverage is ${skillCoverage}%. ${summary.skills.coverageSummary.missing} required skill${summary.skills.coverageSummary.missing === 1 ? " is" : "s are"} missing and ${summary.skills.coverageSummary.atRisk} are at risk. Check the Skills & Engineers page before assigning the intervention.`;
    } else if (/history|repeat|failure|fault|breakdown|last time/.test(lower)) {
      answer = failurePatterns.length
        ? `The strongest repeat cluster is ${failurePatterns[0].label}, appearing in ${failurePatterns[0].count} linked history records. Compare the latest work outcome with the matched manual or drawing evidence before repeating the previous repair.`
        : `No repeat cluster is confirmed in the currently available history. Vorta can still use the latest ${summary.activity.length} maintenance records and indexed knowledge to guide the investigation.`;
    } else {
      answer = `${equipment.name} is currently ${equipment.riskLevel.toLowerCase()} risk at ${currentRisk}%. ${topAction ? `The highest-value intervention is “${topAction.action}”, calculated to remove ${topAction.calculatedReduction} risk points and move the score to ${topAction.projectedScore}%.` : `No calculated intervention is currently available, so the next step is to validate the leading risk evidence.`} Without the full plan, the 30-day forecast is ${projected30}%.`;
    }

    if (topAction) {
      sources.unshift({
        label: topAction.action,
        detail: `${topAction.driver} · ${topAction.calculatedReduction} calculated risk-point reduction`,
      });
    }

    setAskResult({
      prompt,
      answer,
      evidence,
      sources,
      confidence: clamp(modelConfidence + Math.min(8, chunks.length * 2)),
    });
    setAskLoading(false);
  }, [aiIndexedDocuments, criticalSpares, currentRisk, documents.length, equipment, failurePatterns, modelConfidence, openWorkOrders, overduePms, overdueWorkOrders, pmCompliance, projected30, question, resolvedId, skillCoverage, summary, topAction, topDriver]);

  useEffect(() => {
    if (!initialPrompt || !summary || processedPromptRef.current === initialPrompt) return;
    processedPromptRef.current = initialPrompt;
    void runAnalysis(initialPrompt);
  }, [initialPrompt, runAnalysis, summary]);

  const copyAsset = useCallback(async () => {
    if (!equipment || !navigator.clipboard) return;
    await navigator.clipboard.writeText(equipment.assetNumber);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [equipment]);

  const scrollToAssistant = useCallback(() => {
    assistantRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (!equipment) {
    return (
      <section className="flex w-full flex-col overflow-x-hidden pb-10">
        <div className="border-b border-gray-800 bg-[#0b0e14] px-4 py-4 md:px-6">
          <div className="h-40 animate-pulse rounded-xl bg-[#141820]" />
        </div>
      </section>
    );
  }

  const riskTotal = equipment.riskBreakdown.reduce((sum, driver) => sum + driver.pct, 0) || 1;
  const briefing = `${equipment.name} is currently ${equipment.riskLevel} Risk at ${currentRisk}%. ${topDriver ? `${topDriver.driver} is the leading explainable driver at ${topDriver.driverPct}%.` : "The live risk model is available, but detailed driver explanations are limited."} The current action plan can remove ${availableReduction} risk points, while the evidence pack covers ${evidenceCoverage}% of the key maintenance domains.`;

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
      {loadError ? (
        <div className="mx-4 mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-xs text-red-200 md:mx-6">{loadError}</div>
      ) : null}

      <div className="lg:sticky lg:top-0 z-10 border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
            <button type="button" onClick={() => navigate("/equipment")} className="hover:text-slate-300">Equipment</button>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-slate-300">{equipment.name} ({equipment.assetNumber})</span>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void copyAsset()} className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs text-slate-300 hover:bg-gray-800">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy asset ref"}
            </Button>
            <button type="button" onClick={() => void loadIntelligence()} disabled={loading} aria-label="Refresh AI intelligence" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-gray-800 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={() => navigate(`/equipment/${equipment.id}/notifications`)} aria-label="Equipment notifications" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-gray-800">
              <Bell className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => navigate("/settings")} aria-label="Profile settings" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-800">
              <UserCircle className="h-7 w-7" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">
            <img src={equipment.image} alt={equipment.name} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">{equipment.name}</h1>
              <Badge className={`inline-flex h-auto rounded border px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskTone(equipment.riskLevel)}`}>{equipment.riskLevel} Risk</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <EquipmentRiskIndicator riskLevel={equipment.riskLevel} />
              <span className="text-sm font-semibold text-slate-200">{equipment.status}</span>
              <span className="text-sm text-slate-500">{equipment.statusNote}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="font-medium text-slate-300">{equipment.assetNumber}</span>
              <span className="rounded bg-gray-800 px-1.5 py-0.5 font-medium tracking-wide">{equipment.type}</span>
              <span>📍 {equipment.area}</span>
              <span>Manufacturer: <span className="text-slate-300">{equipment.manufacturer}</span></span>
              <span>Model: <span className="text-slate-300">{equipment.model}</span></span>
              <span>Criticality: <span className="text-slate-300">{equipment.criticality}</span></span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 lg:w-52">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Score</span>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-slate-50">{currentRisk}%</span>
              <Badge className={`mb-1 inline-flex h-auto rounded border px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskTone(equipment.riskLevel)}`}>{equipment.riskLevel}</Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500">Risk drivers</span>
              <div className="flex h-2 overflow-hidden rounded-full bg-gray-800">
                {equipment.riskBreakdown.map((driver) => <div key={driver.label} style={{ width: `${(driver.pct / riskTotal) * 100}%`, backgroundColor: driver.color }} />)}
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {equipment.riskBreakdown.map((driver) => <span key={driver.label} className="inline-flex items-center gap-1 text-[10px] text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${driver.dotClass}`} />{driver.label} {driver.pct}%</span>)}
              </div>
            </div>
          </div>
        </div>

        <EquipmentTabNavigation equipmentId={equipment.id} activeTab="ai-insights" />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">
        <Card className="overflow-hidden rounded-2xl border border-violet-500/25 bg-[linear-gradient(135deg,#151322_0%,#10151d_55%,#12182a_100%)] shadow-none">
          <CardContent className="p-0">
            <div className="grid xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.55fr)]">
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="h-auto rounded bg-violet-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300 shadow-none">Equipment decision intelligence</Badge>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><Database className="h-3.5 w-3.5" />Risk · SAP work · PMs · spares · skills · knowledge · {formatDateTime(lastUpdated)}</span>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-50">AI Equipment Decision Briefing</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{briefing}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Current risk" value={`${currentRisk}%`} detail={equipment.riskLevel} tone={currentRisk >= 75 ? "text-red-300" : currentRisk >= 50 ? "text-orange-300" : "text-emerald-300"} />
                  <Metric label="30-day forecast" value={`${projected30}%`} detail={prediction?.trendDirection || "Current forecast"} tone={projected30 > currentRisk ? "text-red-300" : "text-amber-300"} />
                  <Metric label="Plan impact" value={`-${availableReduction}`} detail={`Projected to ${afterPlan}%`} tone="text-emerald-300" />
                  <Metric label="Evidence confidence" value={`${modelConfidence}%`} detail={`${evidenceCoverage}% domain coverage`} tone={modelConfidence >= 80 ? "text-emerald-300" : "text-amber-300"} />
                </div>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-gray-700 bg-[#0a0f16] px-3 focus-within:border-violet-500/60">
                    <Sparkles className="h-4 w-4 shrink-0 text-violet-400" />
                    <input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runAnalysis(); }} placeholder={`Ask Vorta what matters most for ${equipment.assetNumber}...`} className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600" />
                  </div>
                  <Button type="button" onClick={() => void runAnalysis()} disabled={askLoading || loading} className="min-h-11 gap-2 bg-violet-600 px-5 text-white hover:bg-violet-500 disabled:opacity-60">
                    <BrainCircuit className={`h-4 w-4 ${askLoading ? "animate-pulse" : ""}`} />{askLoading ? "Analysing" : "Ask Vorta"}
                  </Button>
                </div>
              </div>

              <div className="border-t border-gray-800 bg-[#0b1017]/70 p-5 xl:border-l xl:border-t-0 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Highest-value decision</p>
                {topAction ? (
                  <div className="mt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300"><Target className="h-5 w-5" /></div>
                      <Badge className="h-auto rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 shadow-none">-{topAction.calculatedReduction} risk points</Badge>
                    </div>
                    <h3 className="mt-4 text-base font-semibold leading-6 text-slate-100">{topAction.action}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{topAction.detail || topAction.driver}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Metric label="Current" value={`${currentRisk}%`} detail={workQueue?.currentRiskLevel || equipment.riskLevel} />
                      <Metric label="After action" value={`${topAction.projectedScore}%`} detail={workQueue?.projectedRiskLevel || "Projected"} tone="text-emerald-300" />
                    </div>
                    <button type="button" onClick={() => navigate(actionRoute(equipment.id, topAction))} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200">Open supporting evidence<ArrowRight className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-8 text-center"><AlertTriangle className="mx-auto h-6 w-6 text-amber-400" /><p className="mt-3 text-sm font-semibold text-amber-200">No calculated intervention available</p><p className="mt-1 text-xs text-slate-500">Refresh after the next validated data import.</p></div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {askResult ? (
          <Card className="rounded-2xl border border-violet-500/25 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-400">Ask Vorta decision brief</p><h2 className="mt-1 text-base font-semibold text-slate-100">{askResult.prompt}</h2></div>
                <Badge className="h-auto rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 shadow-none">{askResult.confidence}% source confidence</Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-200">{askResult.answer}</p>
              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-xl border border-gray-800 bg-[#0d1219] p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Evidence used</p><div className="mt-3 space-y-2">{askResult.evidence.map((item) => <div key={item} className="flex gap-2 text-xs leading-5 text-slate-400"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />{item}</div>)}</div></div>
                <div className="rounded-xl border border-gray-800 bg-[#0d1219] p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sources and actions</p><div className="mt-3 space-y-2">{askResult.sources.length ? askResult.sources.map((source) => source.url ? <a key={`${source.label}-${source.detail}`} href={source.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-lg border border-gray-800 bg-[#0a0f16] p-3 hover:border-violet-500/30"><div><p className="text-xs font-semibold text-slate-200">{source.label}</p><p className="mt-1 text-[10px] text-slate-500">{source.detail}</p></div><ArrowRight className="h-3.5 w-3.5 shrink-0 text-violet-400" /></a> : <div key={`${source.label}-${source.detail}`} className="rounded-lg border border-gray-800 bg-[#0a0f16] p-3"><p className="text-xs font-semibold text-slate-200">{source.label}</p><p className="mt-1 text-[10px] text-slate-500">{source.detail}</p></div>) : <p className="text-xs text-slate-500">No indexed source section matched this question.</p>}</div></div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-4 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />Generated only from available equipment evidence</span><button type="button" onClick={scrollToAssistant} className="inline-flex items-center gap-1.5 font-semibold text-violet-300 hover:text-violet-200">Continue in full assistant<ArrowRight className="h-3.5 w-3.5" /></button></div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><LineChart className="h-4 w-4 text-violet-400" /><h2 className="text-base font-semibold text-slate-100">Risk Forecast and Intervention Scenario</h2></div><p className="mt-1 text-xs leading-5 text-slate-500">Available risk history, no-action forecast and calculated improvement after the current plan.</p></div><div className="flex flex-wrap gap-3 text-[11px] text-slate-500"><span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 bg-violet-400" />Actual</span><span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 bg-red-400" />No action</span><span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 bg-emerald-400" />Current plan</span></div></div>
            <div className="mt-5 overflow-x-auto"><ForecastChart series={trendSeries} current={currentRisk} projected7={projected7} projected30={projected30} afterPlan={afterPlan} /></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4"><div className="flex items-center gap-2 text-red-300"><TrendingUp className="h-4 w-4" /><p className="text-xs font-semibold">No intervention</p></div><p className="mt-3 text-2xl font-semibold text-red-300">{projected30}%</p><p className="mt-1 text-[11px] text-slate-500">30-day projected risk</p></div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4"><div className="flex items-center gap-2 text-amber-300"><Activity className="h-4 w-4" /><p className="text-xs font-semibold">Top action only</p></div><p className="mt-3 text-2xl font-semibold text-amber-300">{topAction?.projectedScore ?? afterPlan}%</p><p className="mt-1 text-[11px] text-slate-500">After highest-value action</p></div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4"><div className="flex items-center gap-2 text-emerald-300"><TrendingDown className="h-4 w-4" /><p className="text-xs font-semibold">Full calculated plan</p></div><p className="mt-3 text-2xl font-semibold text-emerald-300">{afterPlan}%</p><p className="mt-1 text-[11px] text-slate-500">{availableReduction} risk points removed</p></div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-blue-400" /><h2 className="text-base font-semibold text-slate-100">Explainable Risk Drivers</h2></div><p className="mt-1 text-xs text-slate-500">Each driver is tied to evidence, an action and an estimated contribution to risk reduction.</p></div><Badge className="h-auto rounded border border-blue-500/20 bg-blue-500/[0.07] px-2 py-1 text-[10px] font-semibold text-blue-300 shadow-none">{explanations.length || equipment.riskBreakdown.length} drivers</Badge></div>
              <div className="mt-5 space-y-3">
                {(explanations.length ? explanations : equipment.riskBreakdown.map((driver) => ({ equipmentId: equipment.id, driver: driver.label, driverScore: driver.pct, driverPct: driver.pct, evidence: null, recommendedAction: null, estimatedReduction: 0 }))).slice(0, 6).map((driver, index) => (
                  <article key={driver.driver} className="rounded-xl border border-gray-800 bg-[#0d1219] p-4"><div className="flex items-start gap-3"><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-300">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-slate-100">{driver.driver}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{driver.evidence || "Live risk contribution from the equipment model."}</p></div><div className="text-right"><p className="text-lg font-semibold text-slate-100">{driver.driverPct}%</p><p className="text-[9px] uppercase tracking-wide text-slate-600">contribution</p></div></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.min(100, driver.driverPct)}%`, opacity: 0.72 }} /></div>{driver.recommendedAction ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]"><span className="text-slate-400">{driver.recommendedAction}</span><span className="font-semibold text-emerald-300">-{driver.estimatedReduction} estimated</span></div> : null}</div></div></article>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center gap-2"><Database className="h-4 w-4 text-cyan-400" /><h2 className="text-sm font-semibold text-slate-100">Evidence Coverage</h2></div><p className="mt-1 text-xs leading-5 text-slate-500">What Vorta can currently use to explain and support a decision.</p>
                <div className="mt-4 space-y-2">{evidenceDomains.map((domain) => { const Icon = domain.icon; return <button key={domain.label} type="button" onClick={() => navigate(domain.route)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#0d1219] p-3 text-left hover:border-cyan-500/30"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${domain.available ? "bg-cyan-500/10 text-cyan-300" : "bg-gray-800 text-slate-600"}`}><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-200">{domain.label}</p><p className="mt-1 text-[10px] text-slate-500">{domain.value}</p></div></div>{domain.available ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}</button>; })}</div>
                <div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Domain coverage" value={`${evidenceCoverage}%`} detail="Across six evidence domains" tone="text-cyan-300" /><Metric label="AI-searchable docs" value={`${aiIndexedDocuments}/${documents.length}`} detail="Controlled references" tone={aiIndexedDocuments === documents.length && documents.length ? "text-emerald-300" : "text-amber-300"} /></div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5"><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-400" /><h2 className="text-sm font-semibold text-slate-100">Live Operational Signals</h2></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Open work" value={openWorkOrders} detail={`${overdueWorkOrders} overdue`} tone={overdueWorkOrders ? "text-red-300" : "text-slate-100"} /><Metric label="PM compliance" value={`${pmCompliance}%`} detail={`${overduePms} overdue`} tone={overduePms ? "text-amber-300" : "text-emerald-300"} /><Metric label="Critical spares" value={criticalSpares} detail="Availability issues" tone={criticalSpares ? "text-red-300" : "text-emerald-300"} /><Metric label="Skill coverage" value={`${skillCoverage}%`} detail="Validated capability" tone={skillCoverage >= 80 ? "text-emerald-300" : "text-amber-300"} /></div></CardContent>
            </Card>
          </div>
        </div>

        <Card className="rounded-2xl border border-amber-500/20 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400/80">AI intervention queue</p><h2 className="mt-1 text-base font-semibold text-slate-100">Highest-value calculated actions</h2><p className="mt-1 text-xs leading-5 text-slate-500">Ranked from the existing Vorta work queue, with source references and projected risk after each intervention.</p></div><Badge className="h-auto rounded border border-amber-500/20 bg-amber-500/[0.07] px-2 py-1 text-[10px] font-semibold text-amber-300 shadow-none">{workQueue?.actions.length ?? 0} actions</Badge></div>
            <div className="mt-5 grid gap-3 xl:grid-cols-3">{workQueue?.actions.map((action, index) => <article key={`${action.priority}-${action.action}`} className="flex min-h-[230px] flex-col rounded-xl border border-gray-800 bg-[#0d1219] p-4"><div className="flex items-start gap-3"><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-300">{index + 1}</span><div><p className="text-sm font-semibold leading-5 text-slate-100">{action.action}</p><p className="mt-2 text-xs leading-5 text-slate-400">{action.detail || action.driver}</p></div></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Reduction" value={`-${action.calculatedReduction}`} detail="Calculated points" tone="text-emerald-300" /><Metric label="Projected" value={`${action.projectedScore}%`} detail={action.status || "After action"} /></div><div className="mt-4 rounded-lg border border-gray-800 bg-[#0a0f16] p-3"><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">Source evidence</p><p className="mt-1 text-xs text-slate-300">{action.workOrderNumber || action.pmNumber || action.sparePartNumber || action.procedureRef || action.driver}</p></div><button type="button" onClick={() => navigate(actionRoute(equipment.id, action))} className="mt-auto inline-flex items-center justify-end gap-1.5 pt-4 text-xs font-semibold text-amber-300 hover:text-amber-200">Open evidence<ChevronRight className="h-3.5 w-3.5" /></button></article>)}{!loading && !workQueue?.actions.length ? <div className="xl:col-span-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-8 text-center"><ShieldCheck className="mx-auto h-6 w-6 text-emerald-400" /><p className="mt-3 text-sm font-semibold text-emerald-200">No calculated intervention is currently queued</p><p className="mt-1 text-xs text-slate-500">Refresh after the next SAP or Vorta risk calculation.</p></div> : null}</div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-5 md:p-6"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><History className="h-4 w-4 text-red-400" /><h2 className="text-base font-semibold text-slate-100">Repeat-Failure Intelligence</h2></div><p className="mt-1 text-xs text-slate-500">Recurring fault codes and maintenance themes detected in the available equipment history.</p></div><Badge className="h-auto rounded border border-red-500/20 bg-red-500/[0.07] px-2 py-1 text-[10px] font-semibold text-red-300 shadow-none">{failurePatterns.length} clusters</Badge></div><div className="mt-5 space-y-3">{failurePatterns.map((pattern, index) => <article key={pattern.key} className="rounded-xl border border-gray-800 bg-[#0d1219] p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-xs font-bold text-red-300">{index + 1}</span><div><p className="text-sm font-semibold text-slate-100">{pattern.label}</p><p className="mt-1 font-mono text-[10px] text-blue-300">{pattern.references.slice(0, 5).join(" · ")}</p></div></div><div className="text-right"><p className="text-lg font-semibold text-slate-100">{pattern.count}</p><p className="text-[9px] uppercase tracking-wide text-slate-600">events</p></div></div><div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500"><span>Latest {formatDate(pattern.latestDate)}</span><button type="button" onClick={() => { setQuestion(`What happened in the ${pattern.label} repeat failure pattern and what should we check next?`); void runAnalysis(`What happened in the ${pattern.label} repeat failure pattern and what should we check next?`); }} className="font-semibold text-red-300 hover:text-red-200">Analyse pattern</button></div></article>)}{!loading && !failurePatterns.length ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-10 text-center"><ShieldCheck className="mx-auto h-6 w-6 text-emerald-400" /><p className="mt-3 text-sm font-semibold text-emerald-200">No repeat cluster confirmed</p><p className="mt-1 text-xs text-slate-500">Available work history does not yet form a repeated failure pattern.</p></div> : null}</div></CardContent></Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-5 md:p-6"><div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-violet-400" /><h2 className="text-base font-semibold text-slate-100">Decision Traceability</h2></div><p className="mt-1 text-xs leading-5 text-slate-500">The chain from leading signal to evidence, action and predicted outcome.</p><div className="mt-5 space-y-3">{[
            { step: "1", label: "Signal", value: topDriver?.driver || equipment.riskBreakdown[0]?.label || "Current equipment risk", tone: "text-red-300" },
            { step: "2", label: "Evidence", value: topDriver?.evidence || `${openWorkOrders} open work orders, ${overduePms} overdue PMs and ${criticalSpares} spare issues`, tone: "text-blue-300" },
            { step: "3", label: "Action", value: topAction?.action || "Validate the highest-risk evidence", tone: "text-amber-300" },
            { step: "4", label: "Outcome", value: topAction ? `${topAction.projectedScore}% projected risk after action` : `${afterPlan}% projected after available plan`, tone: "text-emerald-300" },
          ].map((item) => <div key={item.step} className="flex gap-3 rounded-xl border border-gray-800 bg-[#0d1219] p-3"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[10px] font-bold text-violet-300">{item.step}</span><div><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">{item.label}</p><p className={`mt-1 text-xs leading-5 ${item.tone}`}>{item.value}</p></div></div>)}</div></CardContent></Card>
        </div>

        <div ref={assistantRef} className="scroll-mt-48">
          <EquipmentKnowledgeAssistant equipmentId={resolvedId} summary={summary} />
        </div>

        <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-violet-400" /><h2 className="text-sm font-semibold text-slate-100">AI Investigation Routes</h2></div><p className="mt-1 text-xs text-slate-500">Move from the AI decision into the exact evidence domain that supports it.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => navigate(`/equipment/${equipment.id}/history`)} className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800"><History className="h-3.5 w-3.5" />Failure history</Button><Button type="button" variant="outline" onClick={() => navigate(`/equipment/${equipment.id}/documents`)} className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800"><BookOpen className="h-3.5 w-3.5" />Knowledge evidence</Button><Button type="button" variant="outline" onClick={() => navigate(`/equipment/${equipment.id}/work-orders`)} className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800"><Wrench className="h-3.5 w-3.5" />Work execution</Button><Button type="button" onClick={scrollToAssistant} className="h-9 gap-2 bg-violet-600 px-3 text-xs text-white hover:bg-violet-500"><Search className="h-3.5 w-3.5" />Open full assistant</Button></div></div></CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 py-3 text-xs text-slate-500"><span>Vorta combines read-only SAP and site evidence. It does not create, approve or close source-system records.</span><span>{formatDateTime(lastUpdated)}</span></div>
      </div>
    </section>
  );
};
