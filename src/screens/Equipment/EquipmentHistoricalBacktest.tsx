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

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-100">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function ClassificationChip({
  item,
}: {
  item: HistoricalBacktestClassification;
}): JSX.Element {
  const className =
    item.evidenceLevel === "supported_impact"
      ? "border-orange-500/30 text-orange-200"
      : item.evidenceLevel === "validation_counterexample"
        ? "border-cyan-500/30 text-cyan-200"
        : item.evidenceLevel === "plausible_relevance"
          ? "border-violet-500/30 text-violet-200"
          : "border-emerald-500/30 text-emerald-200";

  return (
    <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>
      {item.label} · {item.confidence}%
    </span>
  );
}

function EvidenceRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}): JSX.Element {
  return (
    <div className="border-b border-gray-800 py-3 last:border-b-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <p className="text-xs font-semibold text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-100">{value}</p>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
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
  const outcomeAt = item.timeframe.failureAt ?? item.timeframe.interventionAt;
  const outcomeValue = item.timeframe.failureAt
    ? item.workOrder?.number || "Breakdown recorded"
    : item.timeframe.interventionAt
      ? item.workOrder?.number || "Intervention completed"
      : "No breakdown recorded";

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-transparent text-violet-200 shadow-none">
              {caseHeading(item)}
            </Badge>
            <Badge className="bg-transparent text-slate-300 shadow-none">
              {item.confidence}% evidence confidence
            </Badge>
          </div>
          <h4 className="mt-3 text-base font-semibold text-slate-100">
            {item.equipment.name} · {item.equipment.code}
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            {item.scenarioKey} · {item.equipment.area} · model {item.risk.modelVersion || "not recorded"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => onAskVorta(casePrompt(item))}
          className="h-auto gap-2 px-3 py-2 text-xs"
        >
          <BrainCircuit className="h-4 w-4" />
          Ask Vorta about evidence
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-gray-800 p-3">
          <EvidenceRow
            label="Warning risk"
            value={`${item.risk.warningScore ?? "—"}/100`}
            detail={`${formatDateTime(item.risk.warningCapturedAt)} · ${item.risk.primaryDriver || "driver unavailable"}`}
          />
          <EvidenceRow
            label="Pre-outcome risk"
            value={`${item.risk.preOutcomeScore ?? "—"}/100`}
            detail={`${item.timeframe.warningLeadDays} days from warning to recorded outcome`}
          />
          <EvidenceRow
            label="Recorded outcome"
            value={outcomeValue}
            detail={formatDateTime(outcomeAt ?? item.timeframe.validationWindowEnd)}
          />
        </div>

        <div className="rounded-lg border border-gray-800 p-3">
          <EvidenceRow
            label={stockout ? "Material recovery" : "Post outcome"}
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
          />
          <EvidenceRow
            label="Vorta action at the time"
            value={item.risk.primaryDriver || "Verified risk review"}
            detail={item.risk.recommendedActionAtTime}
          />
          <EvidenceRow
            label="Linked evidence"
            value={item.workOrder?.number || item.scenarioKey}
            detail={[
              item.stock.reservationNumber,
              item.stock.materialDocumentNumber
                ? `261 ${item.stock.materialDocumentNumber}`
                : null,
              item.stock.snapshotAt ? `stock ${formatDateTime(item.stock.snapshotAt)}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Timestamped risk evidence"}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.classifications.map((classification) => (
          <ClassificationChip
            key={`${item.scenarioKey}-${classification.code}`}
            item={classification}
          />
        ))}
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
  const isSynthetic =
    bundle?.site.summary.evidenceProvenance.includes("synthetic_demo") ?? false;
  const headline = useMemo(() => {
    if (!siteSummary) return "";
    if (siteSummary.breakdownCount === 0) {
      return "No controlled breakdown cases are available in the governed validation dataset.";
    }
    return `${siteSummary.elevatedRiskPrecededBreakdownCount} of ${siteSummary.breakdownCount} controlled breakdown cases had elevated Vorta risk beforehand. Median warning was ${siteSummary.medianWarningDays ?? "—"} days.`;
  }, [siteSummary]);

  if (loading) {
    return (
      <Card className="rounded-xl border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Reconstructing historical risk, stock and breakdown evidence…
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg bg-gray-900" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !bundle || !siteSummary) {
    return (
      <Card className="rounded-xl border-red-500/30 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-red-300" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-red-100">
                Historical validation unavailable
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {error || "The governed backtest payload was not available."}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-xl border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-transparent text-cyan-200 shadow-none">
                Historical risk validation
              </Badge>
              {isSynthetic ? (
                <Badge className="bg-transparent text-amber-200 shadow-none">
                  Synthetic demo evidence
                </Badge>
              ) : null}
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Database className="h-4 w-4" />
                {bundle.site.datasetVersion} · {bundle.site.validationWindowDays}-day validation window
              </span>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-slate-50">
              Backtest: did Vorta surface risk before later outcomes?
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {headline}
            </p>
          </div>

          <div className="rounded-lg border border-amber-500/30 p-3 xl:max-w-sm">
            <div className="flex items-center gap-2 text-amber-200">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-semibold">Evidence boundary</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Preventability is not established from sequence alone. Temporal sequence does not by itself prove causation. Recovery impact is only shown where stock, reservation, 261 movement and repair timestamps align.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryMetric
            label="Breakdowns warned"
            value={`${siteSummary.elevatedRiskPrecededBreakdownCount}/${siteSummary.breakdownCount}`}
            detail="Elevated risk before controlled breakdown cases"
          />
          <SummaryMetric
            label="Median warning"
            value={`${siteSummary.medianWarningDays ?? "—"}d`}
            detail="Warning start to recorded outcome"
          />
          <SummaryMetric
            label="Pre-failure stock-outs"
            value={siteSummary.preFailureStockoutCount}
            detail="Critical material at zero before or at failure"
          />
          <SummaryMetric
            label="Recovery impacts"
            value={siteSummary.stockoutExtendedRecoveryCount}
            detail={`${formatMinutes(siteSummary.medianVerifiedMaterialWaitMinutes)} median verified material wait`}
          />
          <SummaryMetric
            label="Successful interventions"
            value={siteSummary.successfulInterventionCount}
            detail="Observed risk reduction with no breakdown in the validation window"
          />
          <SummaryMetric
            label="False positives"
            value={siteSummary.falsePositiveCount}
            detail="Retained to prevent hindsight-only validation"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-4 w-4" /> Exact timestamp sequence
          </span>
          <span className="inline-flex items-center gap-1">
            <PackageX className="h-4 w-4" /> Stock + reservation + 261 evidence
          </span>
          <span className="inline-flex items-center gap-1">
            <TrendingDown className="h-4 w-4" /> Observed risk reduction
          </span>
          <span className="inline-flex items-center gap-1">
            <Wrench className="h-4 w-4" /> Work-order outcomes linked
          </span>
        </div>

        <div className="mt-6 border-t border-gray-800 pt-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">This equipment</h3>
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
              className="h-auto gap-2 px-3 py-2 text-xs"
            >
              <BrainCircuit className="h-4 w-4" />
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
            <div className="mt-4 rounded-lg border border-gray-800 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-cyan-300" />
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
