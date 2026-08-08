import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  History,
  PackageX,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import type {
  HistoricalBacktestCase,
  HistoricalBacktestResult,
} from "../Equipment/equipmentHistoricalBacktestService";
import {
  filterHistoricalValidationCases,
  getHistoricalValidationAreas,
  loadHistoricalValidation,
  scopeHistoricalValidation,
  type HistoricalValidationScope,
  type HistoricalValidationView,
} from "./historicalValidationService";

interface MetricDefinition {
  key: string;
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}

const VIEW_OPTIONS: Array<{ key: HistoricalValidationView; label: string }> = [
  { key: "breakdowns", label: "Breakdowns" },
  { key: "interventions", label: "Successful interventions" },
  { key: "false-positives", label: "False positives" },
  { key: "spares", label: "Spares impact" },
];

const surfaceClass = "rounded-xl border border-gray-800 bg-[#141820] p-4";
const insetClass = "rounded-lg border border-gray-800 bg-[#0d1117] p-3";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMinutes(value: number | null): string {
  if (value == null) return "Not evidenced";
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function hasClassification(item: HistoricalBacktestCase, code: string): boolean {
  return item.classifications.some((classification) => classification.code === code);
}

function outcomeLabel(item: HistoricalBacktestCase): string {
  if (item.timeframe.failureAt) {
    return item.workOrder?.number ? `Breakdown ${item.workOrder.number}` : "Breakdown recorded";
  }
  if (item.timeframe.interventionAt) {
    return item.workOrder?.number
      ? `Intervention ${item.workOrder.number}`
      : "Intervention completed";
  }
  return `No breakdown in ${item.validation.windowDays}-day window`;
}

function scenarioLabel(item: HistoricalBacktestCase): string {
  if (hasClassification(item, "stockout_materially_extended_recovery")) {
    return "Spares extended recovery";
  }
  if (hasClassification(item, "successful_intervention")) return "Successful intervention";
  if (hasClassification(item, "false_positive")) return "False positive";
  return "Elevated risk before breakdown";
}

function ScopeTab({
  label,
  value,
  selected,
  onClick,
}: {
  label: string;
  value: number;
  selected: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg border bg-[#0d1117] px-3 text-xs font-semibold ${
        selected ? "text-blue-200" : "border-gray-800 text-slate-400"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-blue-400" aria-hidden="true" />
      <span>{label}</span>
      <span className={selected ? "text-blue-200" : "text-slate-600"}>{value}</span>
    </button>
  );
}

function MetricCard({ metric }: { metric: MetricDefinition }): JSX.Element {
  const Icon = metric.icon;
  return (
    <article data-vorta-historical-metric={metric.key} className={surfaceClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-500">{metric.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">{metric.value}</p>
        </div>
        <span className="text-blue-300">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{metric.detail}</p>
    </article>
  );
}

function CaseCard({ item }: { item: HistoricalBacktestCase }): JSX.Element {
  const navigate = useNavigate();
  const outcomeAt =
    item.timeframe.failureAt ?? item.timeframe.interventionAt ?? item.timeframe.validationWindowEnd;
  const spareRelevant = Boolean(item.stock.materialNumber);
  const stockout = item.stock.availableQuantity === 0;
  const linkedEvidence = [
    item.workOrder?.number,
    item.stock.reservationNumber ? `Reservation ${item.stock.reservationNumber}` : null,
    item.stock.materialDocumentNumber ? `261 ${item.stock.materialDocumentNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article data-vorta-historical-case={item.scenarioKey} className={surfaceClass}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-gray-700 px-2 py-1 text-xs font-semibold text-blue-200">
          {scenarioLabel(item)}
        </span>
        <span className="rounded-full border border-gray-700 px-2 py-1 text-xs text-slate-400">
          {item.confidence}% confidence
        </span>
      </div>

      <h2 className="mt-3 text-lg font-semibold text-slate-50">{item.equipment.name}</h2>
      <p className="mt-1 text-xs text-slate-500">
        {item.equipment.code} · {item.equipment.area} · {item.scenarioKey}
      </p>

      <div className="mt-4 grid gap-3">
        <div className={insetClass}>
          <p className="text-xs font-semibold uppercase text-slate-500">Warning</p>
          <p className="mt-1 text-lg font-semibold text-slate-50">
            {item.risk.warningScore ?? "—"}/100 risk
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {item.timeframe.warningLeadDays} days before outcome · {item.risk.primaryDriver || "driver unavailable"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Captured {formatDateTime(item.timeframe.warningStartAt)}
          </p>
        </div>

        <div className={insetClass}>
          <p className="text-xs font-semibold uppercase text-slate-500">Recorded outcome</p>
          <p className="mt-1 text-sm font-semibold text-slate-50">{outcomeLabel(item)}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{formatDateTime(outcomeAt)}</p>
        </div>

        <div className={insetClass}>
          <p className="text-xs font-semibold uppercase text-slate-500">
            {spareRelevant ? "Spare evidence" : "Validation"}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-50">
            {spareRelevant
              ? `${item.stock.materialNumber}${stockout ? " · 0 stock" : ""}`
              : item.validation.noBreakdownInWindow
                ? "No later breakdown"
                : "Breakdown evidenced"}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {item.stock.verifiedMaterialWaitMinutes != null
              ? `${formatMinutes(item.stock.verifiedMaterialWaitMinutes)} verified material wait`
              : item.risk.postInterventionScore != null
                ? `${item.risk.postInterventionScore}/100 post-intervention risk`
                : `${item.validation.windowDays}-day validation window`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className={insetClass}>
          <p className="text-xs font-semibold text-slate-400">Vorta action at the time</p>
          <p className="mt-1 text-sm leading-6 text-slate-200">{item.risk.recommendedActionAtTime}</p>
        </div>
        <div className={insetClass}>
          <p className="text-xs font-semibold text-slate-400">Linked evidence</p>
          <p className="mt-1 text-sm leading-6 text-slate-200">
            {linkedEvidence || "Timestamped Vorta risk evidence"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.classifications.map((classification) => (
          <span
            key={`${item.scenarioKey}-${classification.code}`}
            className="rounded-full border border-gray-700 px-2 py-1 text-xs text-slate-300"
          >
            {classification.label} · {classification.confidence}%
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate(`/equipment/${item.equipment.id}/history`)}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm font-semibold text-slate-200"
      >
        <History className="h-4 w-4" aria-hidden="true" />
        Equipment history
      </button>
    </article>
  );
}

function LoadingState(): JSX.Element {
  return (
    <section className="flex w-full flex-col gap-5 px-4 pb-28 pt-4" role="status" aria-live="polite">
      <div className="h-16 animate-pulse border-b border-gray-800" />
      <div className="h-12 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
        ))}
      </div>
      <span className="sr-only">Loading Historical Validation</span>
    </section>
  );
}

function UnavailableState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <section className="w-full px-4 py-12">
      <div className={surfaceClass}>
        <Database className="h-9 w-9 text-slate-500" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold text-slate-50">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 bg-[#0d1117] px-4 py-2 text-sm font-semibold text-slate-100"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function HistoricalValidationSection(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const [result, setResult] = useState<HistoricalBacktestResult | null>(null);
  const [scope, setScope] = useState<HistoricalValidationScope>("all");
  const [view, setView] = useState<HistoricalValidationView>("breakdowns");
  const [loading, setLoading] = useState(dataMode === "demo");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (dataMode !== "demo" || !siteContext?.siteId) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await loadHistoricalValidation(siteContext.siteId));
    } catch (nextError) {
      setResult(null);
      setError(nextError instanceof Error ? nextError.message : "Historical validation is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [dataMode, siteContext?.siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const areas = useMemo(() => (result ? getHistoricalValidationAreas(result) : []), [result]);

  useEffect(() => {
    if (scope !== "all" && !areas.some((item) => item.area === scope)) setScope("all");
  }, [areas, scope]);

  const scopedResult = useMemo(
    () => (result ? scopeHistoricalValidation(result, scope) : null),
    [result, scope],
  );
  const visibleCases = useMemo(
    () => (scopedResult ? filterHistoricalValidationCases(scopedResult.cases, view) : []),
    [scopedResult, view],
  );
  const viewCounts = useMemo(() => {
    if (!scopedResult) {
      return { breakdowns: 0, interventions: 0, "false-positives": 0, spares: 0 };
    }
    return {
      breakdowns: filterHistoricalValidationCases(scopedResult.cases, "breakdowns").length,
      interventions: filterHistoricalValidationCases(scopedResult.cases, "interventions").length,
      "false-positives": filterHistoricalValidationCases(scopedResult.cases, "false-positives").length,
      spares: filterHistoricalValidationCases(scopedResult.cases, "spares").length,
    };
  }, [scopedResult]);

  const metrics = useMemo<MetricDefinition[]>(() => {
    if (!scopedResult) return [];
    const summary = scopedResult.summary;
    return [
      {
        key: "scenarios",
        label: "Scenarios analysed",
        value: String(summary.scenarioCount),
        detail: scope === "all" ? "Governed site evidence" : `${scope} evidence`,
        icon: Database,
      },
      {
        key: "breakdown-warnings",
        label: "Breakdowns warned",
        value: `${summary.elevatedRiskPrecededBreakdownCount}/${summary.breakdownCount}`,
        detail: "Breakdowns preceded by timestamped elevated risk",
        icon: AlertTriangle,
      },
      {
        key: "median-warning",
        label: "Median warning",
        value: summary.medianWarningDays == null ? "—" : `${summary.medianWarningDays}d`,
        detail: "Median lead time from warning to recorded outcome",
        icon: Clock3,
      },
      {
        key: "prefailure-stockouts",
        label: "Pre-failure stock-outs",
        value: String(summary.preFailureStockoutCount),
        detail: "Critical zero-stock states before recorded breakdowns",
        icon: PackageX,
      },
      {
        key: "recovery-delays",
        label: "Verified recovery delays",
        value: String(summary.stockoutExtendedRecoveryCount),
        detail: "Cases meeting the strict material-recovery evidence rule",
        icon: Wrench,
      },
      {
        key: "material-wait",
        label: "Median material wait",
        value: formatMinutes(summary.medianVerifiedMaterialWaitMinutes),
        detail: "Verified wait from failure to linked 261 material issue",
        icon: TrendingUp,
      },
      {
        key: "interventions",
        label: "Successful interventions",
        value: String(summary.successfulInterventionCount),
        detail: "Risk fell and no breakdown followed in the validation window",
        icon: CheckCircle2,
      },
      {
        key: "false-positives",
        label: "False positives",
        value: String(summary.falsePositiveCount),
        detail: "Elevated risk without a subsequent breakdown in the validation window",
        icon: ShieldCheck,
      },
      {
        key: "preventability",
        label: "Supported preventability",
        value: `${summary.evidenceSupportedPreventabilityRate ?? 0}%`,
        detail: "Only evidence-supported cases, never inferred from timing alone",
        icon: ShieldCheck,
      },
    ];
  }, [scope, scopedResult]);

  if (dataMode === "live") {
    return (
      <UnavailableState
        title="Historical validation is not yet available for live evidence"
        message="This screen does not substitute synthetic demonstration history for a live site. It will populate only when authorised real historical evidence satisfies the Vorta trust contract."
      />
    );
  }

  if (dataMode === "unavailable") {
    return (
      <UnavailableState
        title="Historical validation is unavailable"
        message="Vorta could not resolve an authorised active-site context for this screen."
      />
    );
  }

  if (loading) return <LoadingState />;
  if (error) {
    return (
      <UnavailableState
        title="Historical validation could not be loaded"
        message={error}
        onRetry={() => void load()}
      />
    );
  }
  if (!result || result.status === "empty") {
    return (
      <UnavailableState
        title="No historical validation evidence is available"
        message="There are no governed historical backtest cases for the authorised site."
        onRetry={() => void load()}
      />
    );
  }

  const scopeLabel = scope === "all" ? "Site" : scope;
  const syntheticDemo = result.cases.some((item) => item.provenance.syntheticDemo);

  return (
    <section
      data-vorta-historical-validation="true"
      data-vorta-historical-scope={scopeLabel}
      className="flex w-full min-w-0 flex-col gap-5 px-4 pb-28 pt-4"
    >
      <header className="border-b border-gray-800 pb-4">
        <p className="text-xs font-semibold uppercase text-blue-300">Risk intelligence</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-50">Historical Validation</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Review what Vorta risk and spare evidence showed before recorded outcomes, including breakdowns, interventions and validation counterexamples.
        </p>
        <p className="mt-2 text-xs text-slate-500">Scope: {scopeLabel}</p>
      </header>

      <div data-vorta-historical-provenance="true" className={surfaceClass}>
        <p className="text-xs font-semibold text-blue-200">
          {syntheticDemo ? "Historical demonstration evidence" : "Historical evidence"}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {syntheticDemo
            ? "This dataset is explicitly synthetic demonstration history used to validate Vorta's backtest capability. It is not imported pilot-site SAP history."
            : "Evidence provenance is governed by the Vorta historical backtest contract."}{" "}
          Temporal sequence and correlation do not prove breakdown causation or guaranteed preventability.
        </p>
      </div>

      <div className="overflow-x-auto border-b border-gray-800 pb-3">
        <div className="flex min-w-max gap-2" role="tablist" aria-label="Historical validation scope">
          <ScopeTab
            label="Site"
            value={result.summary.scenarioCount}
            selected={scope === "all"}
            onClick={() => setScope("all")}
          />
          {areas.map((item) => (
            <ScopeTab
              key={item.area}
              label={item.area}
              value={item.scenarioCount}
              selected={scope === item.area}
              onClick={() => setScope(item.area)}
            />
          ))}
        </div>
      </div>

      {scopedResult?.status === "empty" ? (
        <div className={surfaceClass}>
          <p className="text-sm font-semibold text-slate-100">No historical cases in {scopeLabel}</p>
          <p className="mt-2 text-sm text-slate-400">The selected area has no governed historical validation scenarios.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} />
            ))}
          </div>

          <div className={surfaceClass}>
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-2" role="tablist" aria-label="Historical validation evidence type">
                {VIEW_OPTIONS.map((option) => (
                  <ScopeTab
                    key={option.key}
                    label={option.label}
                    value={viewCounts[option.key]}
                    selected={view === option.key}
                    onClick={() => setView(option.key)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3" aria-live="polite">
            {visibleCases.length > 0 ? (
              visibleCases.map((item) => <CaseCard key={item.scenarioKey} item={item} />)
            ) : (
              <div className={surfaceClass}>
                <p className="text-sm font-semibold text-slate-100">
                  No {VIEW_OPTIONS.find((option) => option.key === view)?.label.toLowerCase()} cases in {scopeLabel}
                </p>
                <p className="mt-2 text-sm text-slate-400">Try another evidence type or switch the Site/Area scope.</p>
              </div>
            )}
          </div>

          <footer className="rounded-xl border border-gray-800 bg-[#0d1117] px-4 py-3 text-xs leading-5 text-slate-500">
            Dataset {result.datasetVersion} · validation window {result.validationWindowDays} days · preventability status: not established from sequence alone.
          </footer>
        </>
      )}
    </section>
  );
}
