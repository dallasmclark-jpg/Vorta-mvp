import {
  AlertTriangle,
  ArrowRight,
  Database,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { EquipmentSection } from "./EquipmentSection";
import {
  loadEquipmentEvidenceCoverage,
  type EquipmentEvidenceCoverage,
} from "./equipmentEvidenceCoverage";
import {
  loadLiveEquipmentList,
  type LiveDataState,
  type LiveEquipmentListPayload,
} from "./equipmentLiveTrust";
import type { EquipmentListItem } from "./equipmentService";

type SortKey = "risk" | "name" | "backlog" | "evidence";
type RiskFilter = "all" | "high" | "overdue" | "evidence-gaps";

function riskTone(level: EquipmentListItem["riskLevel"]): string {
  if (level === "Critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (level === "High") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (level === "Medium") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  if (level === "Low") return "border-lime-500/30 bg-lime-500/10 text-lime-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function EvidenceState({
  title,
  message,
  unavailable,
  onRetry,
}: {
  title: string;
  message: string;
  unavailable: boolean;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <section className="flex w-full flex-col gap-5 px-4 pb-12 pt-5 md:px-6 xl:px-8">
      <div
        role={unavailable ? "alert" : "status"}
        className={`rounded-xl border p-5 ${
          unavailable
            ? "border-red-500/30 bg-red-500/[0.07]"
            : "border-amber-500/30 bg-amber-500/[0.07]"
        }`}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              unavailable ? "text-red-400" : "text-amber-400"
            }`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold text-slate-100">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">{message}</p>
            <p className="mt-2 text-xs text-slate-500">
              No demonstration record, generated score or optimistic percentage has been substituted.
            </p>
          </div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-gray-700 px-3 text-sm font-semibold text-slate-200 hover:bg-gray-800"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LoadingState(): JSX.Element {
  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <span className="inline-flex items-center gap-2 text-sm text-slate-400" role="status">
        <RefreshCw className="h-4 w-4 animate-spin text-blue-400" aria-hidden="true" />
        Loading active-site equipment risk records…
      </span>
    </section>
  );
}

function EvidenceBadge({
  coverage,
  loading,
  unavailable,
}: {
  coverage: EquipmentEvidenceCoverage | undefined;
  loading: boolean;
  unavailable: boolean;
}): JSX.Element {
  if (loading) {
    return (
      <span className="rounded-md border border-gray-700 bg-gray-800/60 px-2 py-1 text-[10px] font-semibold text-slate-400">
        Checking evidence…
      </span>
    );
  }
  if (unavailable || !coverage) {
    return (
      <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
        Evidence unavailable
      </span>
    );
  }
  return (
    <span
      className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${
        coverage.complete
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/25 bg-amber-500/10 text-amber-300"
      }`}
      title={`${coverage.componentCount} components · ${coverage.documentCount} documents · ${coverage.faultCodeCount} fault codes · ${coverage.workOrderCount} work orders · ${coverage.maintenanceScheduleCount} maintenance schedules`}
    >
      {coverage.score}/5 evidence
    </span>
  );
}

function LiveEquipmentList({ siteId }: { siteId: string }): JSX.Element {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<LiveDataState<LiveEquipmentListPayload> | null>(null);
  const [coverage, setCoverage] = useState<Map<string, EquipmentEvidenceCoverage>>(new Map());
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageError, setCoverageError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const nextState = await loadLiveEquipmentList(siteId);
    setState(nextState);
    setLoading(false);

    if (nextState.status !== "ready") {
      setCoverage(new Map());
      setCoverageError(null);
      return;
    }

    setCoverageLoading(true);
    setCoverageError(null);
    try {
      setCoverage(
        await loadEquipmentEvidenceCoverage(nextState.data.records.map((record) => record.id)),
      );
    } catch (error) {
      setCoverageError(
        error instanceof Error ? error.message : "Equipment evidence coverage could not be loaded.",
      );
    } finally {
      setCoverageLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = state?.status === "ready" ? state.data.items : [];
  const areas = useMemo(
    () => Array.from(new Set(items.map((item) => item.area))).sort((left, right) => left.localeCompare(right)),
    [items],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result = items.filter((item) => {
      if (
        normalized &&
        ![item.name, item.assetNumber, item.area, item.type, item.oem]
          .join(" ")
          .toLowerCase()
          .includes(normalized)
      ) {
        return false;
      }
      if (area !== "all" && item.area !== area) return false;
      if (riskFilter === "high" && item.riskScore < 65) return false;
      if (
        riskFilter === "overdue" &&
        item.overduePmCount + item.calibrationOverdueCount === 0
      ) {
        return false;
      }
      if (riskFilter === "evidence-gaps" && coverage.get(item.id)?.complete !== false) {
        return false;
      }
      return true;
    });

    return result.sort((left, right) => {
      if (sortKey === "name") return left.name.localeCompare(right.name);
      if (sortKey === "backlog") {
        return (
          right.openWorkOrderCount + right.overduePmCount + right.calibrationOverdueCount -
          (left.openWorkOrderCount + left.overduePmCount + left.calibrationOverdueCount)
        );
      }
      if (sortKey === "evidence") {
        return (coverage.get(left.id)?.score ?? -1) - (coverage.get(right.id)?.score ?? -1);
      }
      return right.riskScore - left.riskScore;
    });
  }, [area, coverage, items, query, riskFilter, sortKey]);

  if (loading && !state) return <LoadingState />;

  if (state && state.status !== "ready") {
    return (
      <EvidenceState
        title={state.status === "unavailable" ? "Equipment data unavailable" : "Equipment risk not configured"}
        message={state.message}
        unavailable={state.status === "unavailable"}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <section
      className="flex w-full flex-col gap-5 px-4 pb-12 pt-5 md:px-6 xl:px-8"
      data-vorta-live-equipment-list="true"
      data-vorta-active-site={siteId}
    >
      <header className="flex flex-col gap-4 border-b border-gray-800 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">Equipment</h1>
              <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold tracking-[0.12em] text-emerald-300">
                ACTIVE-SITE VERIFIED
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Date-verified risk, backlog and evidence records scoped to the authorised active site.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Showing {filtered.length} of {items.length} verified assets
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 text-sm font-semibold text-slate-200 hover:bg-gray-800 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.6fr)_repeat(3,minmax(150px,0.7fr))]">
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-700 bg-[#10151d] px-3">
            <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span className="sr-only">Search equipment</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search asset, area, type or OEM"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
            />
          </label>
          <label className="sr-only" htmlFor="equipment-area-filter">Filter by area</label>
          <select
            id="equipment-area-filter"
            value={area}
            onChange={(event) => setArea(event.target.value)}
            className="min-h-10 rounded-lg border border-gray-700 bg-[#10151d] px-3 text-sm text-slate-200 outline-none"
          >
            <option value="all">All areas</option>
            {areas.map((areaName) => <option key={areaName} value={areaName}>{areaName}</option>)}
          </select>
          <label className="sr-only" htmlFor="equipment-risk-filter">Filter by risk or evidence</label>
          <select
            id="equipment-risk-filter"
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
            className="min-h-10 rounded-lg border border-gray-700 bg-[#10151d] px-3 text-sm text-slate-200 outline-none"
          >
            <option value="all">All risk states</option>
            <option value="high">High and critical</option>
            <option value="overdue">Overdue PM or calibration</option>
            <option value="evidence-gaps" disabled={Boolean(coverageError)}>Evidence gaps</option>
          </select>
          <label className="sr-only" htmlFor="equipment-sort">Sort equipment</label>
          <select
            id="equipment-sort"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="min-h-10 rounded-lg border border-gray-700 bg-[#10151d] px-3 text-sm text-slate-200 outline-none"
          >
            <option value="risk">Highest risk first</option>
            <option value="backlog">Largest backlog first</option>
            <option value="evidence">Evidence gaps first</option>
            <option value="name">Asset name</option>
          </select>
        </div>

        {coverageError ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200" role="status">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{coverageError} Risk and backlog records remain available.</span>
          </div>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => {
          const itemCoverage = coverage.get(item.id);
          return (
            <article key={item.id} className="flex flex-col rounded-xl border border-gray-800 bg-[#141820] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-100">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.assetNumber} · {item.area}</p>
                </div>
                <span className={`rounded-md border px-2 py-1 text-xs font-bold ${riskTone(item.riskLevel)}`}>
                  {item.riskScore.toFixed(1)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <EvidenceBadge coverage={itemCoverage} loading={coverageLoading} unavailable={Boolean(coverageError)} />
                {itemCoverage?.complete ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Complete path
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-2">
                  <p className="text-lg font-bold text-slate-100">{item.openWorkOrderCount}</p>
                  <p className="text-[11px] text-slate-500">Open WOs</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-2">
                  <p className="text-lg font-bold text-orange-300">{item.overduePmCount}</p>
                  <p className="text-[11px] text-slate-500">Overdue PMs</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-2">
                  <p className="text-lg font-bold text-cyan-300">{item.calibrationOverdueCount}</p>
                  <p className="text-[11px] text-slate-500">Calibrations</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {item.breakdown.slice(0, 3).map((driver) => (
                  <div key={driver.label} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-400">{driver.label}</span>
                    <span className="font-semibold tabular-nums text-slate-200">{driver.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => navigate(`/equipment/${item.id}/overview`)}
                className="mt-5 inline-flex min-h-10 items-center justify-end gap-2 border-t border-gray-800 pt-4 text-sm font-semibold text-blue-300 hover:text-blue-200"
              >
                Open verified equipment
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 bg-[#10151d] px-6 py-12 text-center">
          <Database className="mx-auto h-7 w-7 text-slate-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-300">No matching verified equipment</p>
          <p className="mt-1 text-xs text-slate-500">Clear one or more filters to restore the equipment list.</p>
        </div>
      ) : null}
    </section>
  );
}

export function EquipmentLiveListEntry(): JSX.Element {
  const { siteContext } = useAuth();
  const mode = getEffectiveDataMode(Boolean(siteContext?.siteId));

  if (mode === "demo") return <EquipmentSection />;
  if (mode === "unavailable" || !siteContext?.siteId) {
    return (
      <EvidenceState
        title="Equipment data unavailable"
        message="No authorised active-site context is available."
        unavailable
      />
    );
  }

  return <LiveEquipmentList siteId={siteContext.siteId} />;
}
