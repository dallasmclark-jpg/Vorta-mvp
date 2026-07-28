import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DetailDrawer, DrawerCloseButton } from "../../components/DetailDrawer";
import { MobilePageHeader } from "../../components/MobilePageHeader";
import type { VortaDataMode } from "../../lib/dataTrust";
import {
  loadEquipmentEvidenceCoverage,
  type EquipmentEvidenceCoverage,
} from "./equipmentEvidenceCoverage";
import {
  loadLiveEquipmentList,
  type LiveEquipmentListPayload,
} from "./equipmentLiveTrust";
import { getEquipmentList, type EquipmentListItem } from "./equipmentService";

type RiskFilter = "all" | "critical-high" | "overdue" | "evidence-gaps";
type SortKey = "risk" | "backlog" | "name" | "evidence";

interface MobileEquipmentSectionProps {
  dataMode: VortaDataMode;
  siteId: string | null;
}

function riskTone(level: EquipmentListItem["riskLevel"]): string {
  if (level === "Critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (level === "High") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (level === "Medium") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (level === "Low") return "border-lime-500/30 bg-lime-500/10 text-lime-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function backlog(item: EquipmentListItem): number {
  return item.openWorkOrderCount + item.overduePmCount + item.calibrationOverdueCount;
}

function equipmentRoute(equipmentId: string, destination: string): string {
  const separator = destination.includes("?") ? "&" : "?";
  return `/equipment/${encodeURIComponent(equipmentId)}/${destination}${separator}from=equipment-list`;
}

function EvidenceBadge({
  mode,
  coverage,
  unavailable,
}: {
  mode: VortaDataMode;
  coverage: EquipmentEvidenceCoverage | undefined;
  unavailable: boolean;
}): JSX.Element {
  if (mode === "demo") {
    return (
      <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200">
        Demo evidence
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
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold ${
        coverage.complete
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/25 bg-amber-500/10 text-amber-300"
      }`}
      title={`${coverage.componentCount} components · ${coverage.documentCount} documents · ${coverage.faultCodeCount} fault codes · ${coverage.workOrderCount} work orders · ${coverage.maintenanceScheduleCount} maintenance schedules`}
    >
      {coverage.complete ? <ShieldCheck className="h-3 w-3" aria-hidden="true" /> : null}
      {coverage.score}/5 evidence
    </span>
  );
}

export function MobileEquipmentSection({
  dataMode,
  siteId,
}: MobileEquipmentSectionProps): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedArea =
    searchParams.get("area")?.trim() ||
    searchParams.get("building")?.trim() ||
    "all";
  const [items, setItems] = useState<EquipmentListItem[]>([]);
  const [livePayload, setLivePayload] = useState<LiveEquipmentListPayload | null>(null);
  const [coverage, setCoverage] = useState<Map<string, EquipmentEvidenceCoverage>>(new Map());
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [area, setArea] = useState(requestedArea);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setEmptyMessage(null);

    try {
      if (dataMode === "unavailable" || (dataMode === "live" && !siteId)) {
        throw new Error("Equipment is unavailable because no authorised active site was resolved.");
      }

      if (dataMode === "live" && siteId) {
        const nextState = await loadLiveEquipmentList(siteId);
        if (nextState.status !== "ready") {
          if (items.length === 0) {
            setItems([]);
            setLivePayload(null);
            setCoverage(new Map());
            if (nextState.status === "empty") setEmptyMessage(nextState.message);
            else setError(nextState.message);
          } else {
            setError(`${nextState.message} Showing the previous verified list.`);
          }
          return;
        }

        setItems(nextState.data.items);
        setLivePayload(nextState.data);
        setCoverageError(null);
        try {
          setCoverage(
            await loadEquipmentEvidenceCoverage(
              nextState.data.records.map((record) => record.id),
            ),
          );
        } catch (coverageLoadError) {
          setCoverage(new Map());
          setCoverageError(
            coverageLoadError instanceof Error
              ? coverageLoadError.message
              : "Equipment evidence coverage could not be loaded.",
          );
        }
        return;
      }

      const demoItems = await getEquipmentList();
      setItems(demoItems);
      setLivePayload(null);
      setCoverage(new Map());
      setCoverageError(null);
      if (demoItems.length === 0) setEmptyMessage("No equipment records are available.");
    } catch (loadError) {
      if (items.length === 0) {
        setItems([]);
        setLivePayload(null);
      }
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Equipment records could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [dataMode, items.length, siteId]);

  useEffect(() => {
    void load();
    // load intentionally reacts only to the active data boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataMode, siteId]);

  const areas = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.area))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [items],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...items]
      .filter((item) => {
        if (
          query &&
          ![item.name, item.assetNumber, item.area, item.type, item.oem]
            .join(" ")
            .toLowerCase()
            .includes(query)
        ) {
          return false;
        }
        if (area !== "all" && item.area !== area) return false;
        if (
          riskFilter === "critical-high" &&
          !["Critical", "High"].includes(item.riskLevel)
        ) {
          return false;
        }
        if (
          riskFilter === "overdue" &&
          item.overduePmCount + item.calibrationOverdueCount === 0
        ) {
          return false;
        }
        if (
          riskFilter === "evidence-gaps" &&
          dataMode === "live" &&
          coverage.get(item.id)?.complete !== false
        ) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        if (sortKey === "name") return left.name.localeCompare(right.name);
        if (sortKey === "backlog") return backlog(right) - backlog(left);
        if (sortKey === "evidence") {
          return (coverage.get(left.id)?.score ?? -1) - (coverage.get(right.id)?.score ?? -1);
        }
        return right.riskScore - left.riskScore;
      });
  }, [area, coverage, dataMode, items, riskFilter, search, sortKey]);

  const atRiskCount = items.filter((item) =>
    ["Critical", "High"].includes(item.riskLevel),
  ).length;
  const overdueCount = items.reduce(
    (total, item) => total + item.overduePmCount + item.calibrationOverdueCount,
    0,
  );
  const activeFilterCount =
    Number(area !== "all") +
    Number(riskFilter !== "all") +
    Number(sortKey !== "risk");

  return (
    <section
      data-vorta-mobile-equipment="true"
      data-vorta-equipment-mode={dataMode}
      className="flex w-full flex-col gap-4 overflow-x-hidden px-3 pb-24 pt-4"
    >
      <DetailDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <div className="flex items-start justify-between border-b border-gray-800 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">
              Equipment filters
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-50">Focus the asset list</h2>
          </div>
          <DrawerCloseButton onClose={() => setFiltersOpen(false)} />
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Area
            </legend>
            <div className="mt-3 grid gap-2">
              {["all", ...areas].map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={area === option}
                  onClick={() => setArea(option)}
                  className={`min-h-11 rounded-xl border px-3 text-left text-sm font-semibold ${
                    area === option
                      ? "border-blue-500 bg-blue-500/15 text-blue-200"
                      : "border-gray-800 bg-[#141820] text-slate-300"
                  }`}
                >
                  {option === "all" ? "All areas" : option}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Risk and evidence
            </legend>
            <div className="mt-3 grid gap-2">
              {([
                ["all", "All risk states"],
                ["critical-high", "Critical and high"],
                ["overdue", "Overdue PM or calibration"],
                ...(dataMode === "live" && !coverageError
                  ? [["evidence-gaps", "Evidence gaps"] as const]
                  : []),
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={riskFilter === value}
                  onClick={() => setRiskFilter(value)}
                  className={`min-h-11 rounded-xl border px-3 text-left text-sm font-semibold ${
                    riskFilter === value
                      ? "border-blue-500 bg-blue-500/15 text-blue-200"
                      : "border-gray-800 bg-[#141820] text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Sort
            </legend>
            <div className="mt-3 grid gap-2">
              {([
                ["risk", "Highest risk first"],
                ["backlog", "Largest backlog first"],
                ...(dataMode === "live"
                  ? [["evidence", "Evidence gaps first"] as const]
                  : []),
                ["name", "Asset name"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={sortKey === value}
                  onClick={() => setSortKey(value)}
                  className={`min-h-11 rounded-xl border px-3 text-left text-sm font-semibold ${
                    sortKey === value
                      ? "border-blue-500 bg-blue-500/15 text-blue-200"
                      : "border-gray-800 bg-[#141820] text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-auto grid grid-cols-2 gap-2 border-t border-gray-800 pt-4">
            <button
              type="button"
              onClick={() => {
                setArea("all");
                setRiskFilter("all");
                setSortKey("risk");
              }}
              className="min-h-12 rounded-xl border border-gray-800 bg-[#141820] text-sm font-semibold text-slate-200"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="min-h-12 rounded-xl bg-blue-600 text-sm font-semibold text-white"
            >
              Show {filtered.length}
            </button>
          </div>
        </div>
      </DetailDrawer>

      <MobilePageHeader
        eyebrow={dataMode === "live" ? "Active-site verified" : "Asset risk"}
        title="Equipment"
        description="Risk, backlog and the next asset that needs attention."
        actionLabel="Refresh equipment"
        busy={loading}
        onAction={() => void load()}
      />

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <p className="font-semibold">Equipment unavailable</p>
          </div>
          <p className="mt-2 text-sm text-red-200/80">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-400/30 px-3 text-sm font-semibold text-red-100"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
          </button>
        </div>
      ) : null}

      {coverageError && items.length > 0 ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200" role="status">
          {coverageError} Risk and backlog records remain available.
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
          <p className="text-[10px] text-slate-500">Assets</p>
          <p className="mt-1 text-xl font-semibold text-slate-50">{loading && !items.length ? "—" : items.length}</p>
        </div>
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.05] p-3">
          <p className="text-[10px] text-slate-500">High risk</p>
          <p className="mt-1 text-xl font-semibold text-orange-300">{loading && !items.length ? "—" : atRiskCount}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3">
          <p className="text-[10px] text-slate-500">Overdue</p>
          <p className="mt-1 text-xl font-semibold text-amber-300">{loading && !items.length ? "—" : overdueCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="flex min-h-12 items-center gap-2 rounded-xl border border-gray-800 bg-[#10151d] px-3">
          <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span className="sr-only">Search equipment</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search equipment"
            className="min-w-0 flex-1 bg-transparent text-base text-slate-200 outline-none placeholder:text-slate-600"
          />
        </label>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-label={`Open equipment filters${activeFilterCount ? `, ${activeFilterCount} active` : ""}`}
          className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl border border-gray-800 bg-[#141820] text-slate-300"
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          {activeFilterCount ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-50">Asset register</h2>
          <p className="text-xs text-slate-500">{filtered.length} of {items.length} assets</p>
        </div>
        {livePayload ? (
          <span className="text-[10px] font-semibold text-emerald-300">
            {livePayload.excludedWithoutRiskProfile + livePayload.excludedInvalidRiskProfile > 0
              ? `${livePayload.excludedWithoutRiskProfile + livePayload.excludedInvalidRiskProfile} withheld`
              : "Verified records"}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        {loading && items.length === 0
          ? Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-48 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
            ))
          : filtered.map((item) => {
              const driver = item.breakdown[0];
              const tone = riskTone(item.riskLevel);
              return (
                <article
                  key={item.id}
                  data-vorta-group-frame="true"
                  className="w-full rounded-xl border border-gray-800 p-3"
                >
                  <button
                    type="button"
                    onClick={() => navigate(equipmentRoute(item.id, "overview"))}
                    aria-label={`Open overview for ${item.name}, ${item.assetNumber}`}
                    className="flex min-h-16 w-full items-start justify-between gap-3 rounded-lg px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-base font-semibold leading-6 text-slate-100">{item.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{item.assetNumber} · {item.area}</p>
                      <div className="mt-2">
                        <EvidenceBadge
                          mode={dataMode}
                          coverage={coverage.get(item.id)}
                          unavailable={Boolean(coverageError)}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-xl font-semibold tabular-nums ${tone.split(" ").at(-1)}`}>{item.riskScore.toFixed(1)}</p>
                      <span className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
                        {item.riskLevel}
                      </span>
                    </div>
                  </button>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(equipmentRoute(item.id, "work-orders"))}
                      aria-label={`Open ${item.openWorkOrderCount} work orders for ${item.name}`}
                      className="min-h-14 rounded-lg border border-gray-800 bg-[#0d1117] p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                    >
                      <p className="text-base font-semibold text-slate-100">{item.openWorkOrderCount}</p>
                      <p className="text-[10px] text-slate-500">Open WOs</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(equipmentRoute(item.id, "work-orders?view=pm-backlog"))}
                      aria-label={`Open ${item.overduePmCount} overdue PMs for ${item.name}`}
                      className="min-h-14 rounded-lg border border-gray-800 bg-[#0d1117] p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                    >
                      <p className="text-base font-semibold text-orange-300">{item.overduePmCount}</p>
                      <p className="text-[10px] text-slate-500">PM overdue</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(equipmentRoute(item.id, "pms?view=backlog"))}
                      aria-label={`Open ${item.calibrationOverdueCount} calibration items for ${item.name}`}
                      className="min-h-14 rounded-lg border border-gray-800 bg-[#0d1117] p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                    >
                      <p className="text-base font-semibold text-cyan-300">{item.calibrationOverdueCount}</p>
                      <p className="text-[10px] text-slate-500">Calibration</p>
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-800 pt-3">
                    <span className="min-w-0 truncate text-xs text-slate-400">
                      {driver ? `${driver.label} · ${driver.pct.toFixed(1)}%` : "Risk drivers unavailable"}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(equipmentRoute(item.id, "overview"))}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                      aria-label={`Open ${item.name} overview`}
                    >
                      Overview <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
      </div>

      {!loading && filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 bg-[#10151d] px-6 py-10 text-center">
          <Wrench className="mx-auto h-7 w-7 text-slate-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-300">No matching equipment</p>
          <p className="mt-1 text-xs text-slate-500">
            {emptyMessage ?? "Clear the search or filters to restore the list."}
          </p>
        </div>
      ) : null}
    </section>
  );
}
