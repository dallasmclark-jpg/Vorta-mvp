import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  PackageX,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  Wrench,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  getEquipmentHistoricalBacktestBundle,
  type EquipmentHistoricalBacktestBundle,
  type HistoricalBacktestCase,
  type HistoricalBacktestClassification,
} from "./equipmentHistoricalBacktestService";

interface Props {
  equipmentId: string;
  onAskVorta: (prompt: string) => void;
}

interface SummaryMetricProps {
  label: string;
  value: string | number;
  detail: string;
  tone?: string;
}

function SummaryMetric({
  label,
  value,
  detail,
  tone = "text-slate-100",
}: SummaryMetricProps): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0b1017]/80 p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className={`mt-1.5 text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p>
    </div>
  );
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMinutes(value: number | null | undefined): string {
  if (value == null) return "Not evidenced";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours <= 0) return `${minutes} min`;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function classificationTone(item: HistoricalBacktestClassification): string {
  if (item.evidenceLevel === "supported_impact") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-200";
  }
  if (item.evidenceLevel === "validation_counterexample") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
  }
  if (item.evidenceLevel === "plausible_relevance") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-200";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

function caseHeading(item: HistoricalBacktestCase): string {
  if (item.scenarioType === "stockout_extended_recovery") {
    return "Breakdown with material-constrained recovery";
  }
  if (item.scenarioType === "successful_intervention") {
    return "Risk reduced after historical intervention";
  }
  if (item.scenarioType === "false_positive") {
    return "Elevated risk without subsequent breakdown";
  }
  return "Elevated risk before breakdown";
}

function casePrompt(item: HistoricalBacktestCase): string {
  return [
    `Backtest the historical evidence for ${item.equipment.name} (${item.equipment.code}).`,
    `Use VOR-069 scenario ${item.scenarioKey}.`,
    "Explain the risk state before the outcome, the main risk driver, any relevant spare-stock evidence, linked work-order/material evidence, warning period and confidence classifications.",
    "Distinguish verified sequence from plausible relevance and do not claim causation or preventability unless the evidence explicitly supports it.",
  ].join(" ");
}

function TimelinePoint({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  tone: string;
}): JSX.Element {
  return (
    <div className="relative min-w-0 rounded-xl border border-gray-800 bg-[#0a0f16] p-3">
      <span className={`absolute left-3 top-3 h-2 w-2 rounded-full ${tone}`} />
      <p className="pl-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-100">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p>
    </div>
  );
}

function CaseCard({
  item,
  onAskVorta,
}: {
  item: HistoricalBacktestCase;
  onAskVorta: (prompt: string) => void;
}): JSX.Element {
  const stockout = item.stock.availableQuantity === 0;
  const outcomeDate = item.timeframe.failureAt ?? item.timeframe.interventionAt;
  const outcomeLabel = item.timeframe.failureAt
    ? "Breakdown"
    : item.timeframe.interventionAt
      ? "Intervention"
      : "Validation window";
  const outcomeValue = item.timeframe.failureAt
    ? item.workOrder?.number || "Breakdown recorded"
    : item.timeframe.interventionAt
      ? item.workOrder?.number || "Intervention completed"
      : "No breakdown recorded";

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#10151d] p-4 md:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="h-auto rounded border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-200 shadow-none">
              {caseHeading(item)}
            </Badge>
            <Badge className="h-auto rounded border border-gray-700 bg-gray-800/50 px-2 py-1 text-[10px] font-semibold text-slate-300 shadow-none">
              {item.confidence}% evidence confidence
            </Badge>
          </div>
          <h4 className="mt-3 text-base font-semibold text-slate-100">
            {item.equipment.name} · {item.equipment.code}
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {item.scenarioKey} · {item.equipment.area} · model {item.risk.modelVersion || "not recorded"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => onAskVorta(casePrompt(item))}
          className="h-auto shrink-0 gap-2 border-violet-500/25 bg-violet-500/[0.06] px-3 py-2 text-xs text-violet-200 hover:bg-violet-500/10 hover:text-violet-100"
        >
          <BrainCircuit className="h-3.5 w-3.5" />
          Ask Vorta about evidence
        </Button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <TimelinePoint
          title="Warning risk"
          value={`${item.risk.warningScore ?? "—"}/100`}
          detail={`${formatDateTime(item.risk.warningCapturedAt)} · ${item.risk.primaryDriver || "driver unavailable"}`}
          tone="bg-orange-400"
        />
        <TimelinePoint
          title="Pre-outcome"
          value={`${item.risk.preOutcomeScore ?? "—"}/100`}
          detail={`${item.timeframe.warningLeadDays} days from warning to ${item.timeframe.failureAt ? "failure" : item.timeframe.interventionAt ? "intervention" : "validation"}`}
          tone="bg-red-400"
        />
        <TimelinePoint
          title={outcomeLabel}
          value={outcomeValue}
          detail={formatDateTime(outcomeDate ?? item.timeframe.validationWindowEnd)}
          tone={item.timeframe.failureAt ? "bg-red-500" : "bg-emerald-400"}
        />
        <TimelinePoint
          title={stockout ? "Material recovery" : "Post outcome"}
          value={
            stockout
              ? formatMinutes(item.stock.verifiedMaterialWaitMinutes)
              : item.risk.postInterventionScore != null
                ? `${item.risk.postInterventionScore}/100 risk`
                : "No later failure"
          }
          detail={
            stockout
              ? `${item.stock.materialNumber || "Material"} · 261 ${item.stock.materialDocumentNumber || "not recorded"}`
              : item.risk.observedPostInterventionReduction != null
                ? `${item.risk.observedPostInterventionReduction} point observed reduction`
                : `${item.validation.windowDays}-day validation window`
          }
          tone={stockout ? "bg-orange-400" : "bg-emerald-400"}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.classifications.map((classification) => (
          <span
            key={`${item.scenarioKey}-${classification.code}`}
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${classificationTone(classification)}`}
          >
            {classification.label} · {classification.confidence}%
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-[#0b1017]/70 p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Vorta action at the time
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-300">
            {item.risk.recommendedActionAtTime}
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-[#0b1017]/70 p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Exact linked evidence
          </p>
          <p className="mt-2 break-words font-mono text-[11px] leading-5 text-slate-400">
            {[
              item.workOrder?.number,
              item.stock.reservationNumber,
              item.stock.materialDocumentNumber
                ? `261 ${item.stock.materialDocumentNumber}`
                : null,
              item.stock.snapshotAt ? `stock ${formatDateTime(item.stock.snapshotAt)}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Timestamped risk evidence only"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function EquipmentHistoricalBacktest({
  equipmentId,
  onAskVorta,
}: Props): JSX.Element {
  const [bundle, setBundle] = useState<EquipmentHistoricalBacktestBundle | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBundle(await getEquipmentHistoricalBacktestBundle(equipmentId));
    } catch (loadError) {
      console.error("Historical backtest load failed:", loadError);
      setBundle(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Historical validation evidence could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [equipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const siteSummary = bundle?.site.summary;
  const equipmentCases = bundle?.equipment.cases ?? [];
  const siteProvenance = bundle?.site.summary.evidenceProvenance ?? [];
  const isSynthetic = siteProvenance.includes("synthetic_demo");
  const headline = useMemo(() => {
    if (!siteSummary) return "";
    if (siteSummary.breakdownCount === 0) {
      return "No controlled breakdown cases are available in the governed validation dataset.";
    }
    return `${siteSummary.elevatedRiskPrecededBreakdownCount} of ${siteSummary.breakdownCount} controlled breakdown cases had elevated Vorta risk beforehand. Median warning was ${siteSummary.medianWarningDays ?? "—"} days.`;
  }, [siteSummary]);

  if (loading) {
    return (
      <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin text-violet-400" />
            Reconstructing historical risk, stock and breakdown evidence…
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-xl border border-gray-800 bg-[#0b1017]"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !bundle || !siteSummary) {
    return (
      <Card className="rounded-2xl border border-red-500/25 bg-red-500/[0.04] shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-red-100">
                Historical validation unavailable
              </h3>
              <p className="mt-1 text-xs leading-5 text-red-100/65">
                {error || "The governed backtest payload was not available."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void load()}
              className="h-auto border-red-500/25 bg-transparent px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/10"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-[linear-gradient(135deg,#111923_0%,#10151d_55%,#111a20_100%)] shadow-none">
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="h-auto rounded bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200 shadow-none">
                Historical risk validation
              </Badge>
              {isSynthetic ? (
                <Badge className="h-auto rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200 shadow-none">
                  Synthetic demo evidence
                </Badge>
              ) : null}
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                <Database className="h-3.5 w-3.5" />
                {bundle.site.datasetVersion} · {bundle.site.validationWindowDays}-day validation window
              </span>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-50">
              Backtest: did Vorta surface risk before later outcomes?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{headline}</p>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5 xl:max-w-sm">
            <div className="flex items-center gap-2 text-amber-200">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-semibold">Evidence boundary</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-amber-100/70">
              Preventability is not established from sequence alone. A warning before a failure proves timing, not causation. Recovery impact is only shown where stock, reservation, 261 movement and repair timestamps align.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryMetric
            label="Breakdowns warned"
            value={`${siteSummary.elevatedRiskPrecededBreakdownCount}/${siteSummary.breakdownCount}`}
            detail="Elevated risk recorded before controlled breakdown cases"
            tone="text-orange-300"
          />
          <SummaryMetric
            label="Median warning"
            value={`${siteSummary.medianWarningDays ?? "—"}d`}
            detail="Warning start to recorded outcome"
            tone="text-cyan-300"
          />
          <SummaryMetric
            label="Pre-failure stock-outs"
            value={siteSummary.preFailureStockoutCount}
            detail="Critical material at zero before/at failure"
            tone="text-red-300"
          />
          <SummaryMetric
            label="Recovery impacts"
            value={siteSummary.stockoutExtendedRecoveryCount}
            detail={`${formatMinutes(siteSummary.medianVerifiedMaterialWaitMinutes)} median verified material wait`}
            tone="text-orange-300"
          />
          <SummaryMetric
            label="Successful interventions"
            value={siteSummary.successfulInterventionCount}
            detail="Risk fell and no breakdown followed in validation window"
            tone="text-emerald-300"
          />
          <SummaryMetric
            label="False positives"
            value={siteSummary.falsePositiveCount}
            detail="Retained to prevent hindsight-only validation"
            tone="text-cyan-300"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5 text-cyan-400" />
            Exact timestamp sequence
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PackageX className="h-3.5 w-3.5 text-orange-400" />
            Stock + reservation + 261 recovery evidence
          </span>
          <span className="inline-flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
            Observed intervention risk reduction retained
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5 text-violet-400" />
            Work-order outcomes linked
          </span>
        </div>

        <div className="mt-6 border-t border-gray-800 pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                This equipment
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Controlled cases linked to the selected asset. Exact source identities remain attached to every classification.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onAskVorta(
                  "Backtest the site historical risk evidence against later breakdowns and interventions. Summarise warning lead time, pre-failure critical stock-outs, material-related recovery delays, successful interventions and false positives. Do not claim causation or preventability from timing alone.",
                )
              }
              className="h-auto gap-2 border-cyan-500/25 bg-cyan-500/[0.05] px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/10 hover:text-cyan-100"
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              Ask Vorta for site backtest
            </Button>
          </div>

          {equipmentCases.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {equipmentCases.map((item) => (
                <CaseCard
                  key={item.scenarioKey}
                  item={item}
                  onAskVorta={onAskVorta}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-gray-800 bg-[#0b1017]/70 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    No controlled VOR-069 case for this equipment
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Site validation is still shown above. Vorta is not fabricating an asset-specific historical event where none exists in the governed dataset.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
