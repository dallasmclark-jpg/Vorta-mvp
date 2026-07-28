import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock3,
  Database,
  Package,
  PackageCheck,
  PackageMinus,
  RefreshCw,
  Search,
  ShieldCheck,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import {
  loadStoresInventorySnapshot,
  summariseStoresInventory,
} from "./storesInventoryService";
import type {
  InventoryExposureLevel,
  StoresInventoryItem,
  StoresInventoryPayload,
  StoresInventorySummary,
} from "./storesInventoryService";

type InventoryFilter =
  | "attention"
  | "all"
  | "stockout"
  | "below-minimum"
  | "long-lead"
  | "excess";

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
}

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const integer = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

function ageLabel(value: string | null): string {
  if (!value) return "No source timestamp";
  const milliseconds = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) return "Invalid source timestamp";
  const days = Math.max(0, Math.floor(milliseconds / 86_400_000));
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated 1 day ago";
  return `Updated ${days} days ago`;
}

function isStale(value: string | null): boolean {
  if (!value) return true;
  const age = Date.now() - new Date(value).getTime();
  return !Number.isFinite(age) || age > 7 * 86_400_000;
}

function riskTone(level: InventoryExposureLevel): string {
  if (level === "Critical") {
    return "border-red-500/35 bg-red-500/[0.08] text-red-200";
  }
  if (level === "High") {
    return "border-orange-500/35 bg-orange-500/[0.08] text-orange-200";
  }
  if (level === "Medium") {
    return "border-amber-400/30 bg-amber-400/[0.08] text-amber-100";
  }
  if (level === "Low") {
    return "border-blue-500/30 bg-blue-500/[0.08] text-blue-100";
  }
  return "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-100";
}

function stockTone(item: StoresInventoryItem): string {
  if (item.stockState === "Out of stock") {
    return "border-red-500/35 bg-red-500/[0.08] text-red-200";
  }
  if (item.stockState === "Below minimum") {
    return "border-orange-500/35 bg-orange-500/[0.08] text-orange-200";
  }
  if (item.stockState === "Below target") {
    return "border-amber-400/30 bg-amber-400/[0.08] text-amber-100";
  }
  if (item.stockState === "Excess") {
    return "border-purple-500/30 bg-purple-500/[0.08] text-purple-100";
  }
  return "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-100";
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  active = false,
  onClick,
}: MetricCardProps): JSX.Element {
  const content = (
    <>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-[#111722] text-blue-300">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">
          {label}
        </span>
        <span className="mt-1 block text-2xl font-semibold tracking-tight text-slate-50">
          {value}
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-400">
          {detail}
        </span>
      </span>
    </>
  );

  const className = `min-h-[132px] rounded-xl border p-4 text-left transition ${
    active
      ? "border-blue-500/60 bg-blue-500/[0.09] shadow-[0_0_0_1px_rgba(59,130,246,0.14)]"
      : "border-slate-800 bg-[#11161f] hover:border-slate-700 hover:bg-[#131a25]"
  }`;

  if (!onClick) {
    return <article className={className}>{content}</article>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}
    >
      {content}
    </button>
  );
}

function LoadingState(): JSX.Element {
  return (
    <section
      className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 lg:px-8"
      role="status"
      aria-live="polite"
    >
      <div className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-[#11161f]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-slate-800 bg-[#11161f]"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl border border-slate-800 bg-[#11161f]" />
      <span className="sr-only">Loading Stores Inventory evidence…</span>
    </section>
  );
}

function EmptyState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}): JSX.Element {
  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center px-4 py-12 sm:px-6">
      <div className="w-full rounded-2xl border border-slate-800 bg-[#11161f] p-6 text-center sm:p-8">
        <Warehouse className="mx-auto h-9 w-9 text-slate-500" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold text-slate-50">{title}</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
          {message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#151c27] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-[#18212d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry inventory
        </button>
      </div>
    </section>
  );
}

function DataTrustBanner({
  payload,
  dataMode,
}: {
  payload: StoresInventoryPayload;
  dataMode: "live" | "demo" | "unavailable";
}): JSX.Element {
  const stale = isStale(payload.latestSourceAt);
  const partial =
    payload.assetEvidence.status === "unavailable" ||
    payload.riskEvidence.status === "unavailable";
  const label =
    dataMode === "demo"
      ? "Demo inventory evidence"
      : stale
        ? "Stale inventory evidence"
        : partial
          ? "Partial live evidence"
          : "Verified live inventory";
  const Icon = stale || partial ? AlertTriangle : ShieldCheck;

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        stale || partial
          ? "border-amber-500/30 bg-amber-500/[0.07]"
          : "border-emerald-500/25 bg-emerald-500/[0.06]"
      }`}
      role={stale || partial ? "status" : undefined}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            stale || partial ? "text-amber-300" : "text-emerald-300"
          }`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">{label}</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-400">
            {ageLabel(payload.latestSourceAt)}
            {payload.sourceSystems.length > 0
              ? ` · ${payload.sourceSystems.join(", ")}`
              : ""}
          </p>
        </div>
      </div>
      <p className="text-xs leading-5 text-slate-400 sm:max-w-md sm:text-right">
        Exposure uses verified stock gap, criticality, lead time and available
        affected-asset risk. Stock value never increases the risk score.
      </p>
    </div>
  );
}

function AreaTabs({
  items,
  selectedArea,
  onSelect,
}: {
  items: StoresInventoryItem[];
  selectedArea: string;
  onSelect: (area: string) => void;
}): JSX.Element {
  const areas = useMemo(() => {
    const entries = Array.from(new Set(items.map((item) => item.area))).map(
      (area) => {
        const scopedItems = items.filter((item) => item.area === area);
        return {
          area,
          summary: summariseStoresInventory(scopedItems),
        };
      },
    );

    return entries.sort(
      (left, right) =>
        right.summary.riskScore - left.summary.riskScore ||
        left.area.localeCompare(right.area),
    );
  }, [items]);

  const siteSummary = summariseStoresInventory(items);

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-max gap-2" role="tablist" aria-label="Inventory area risk">
        <button
          type="button"
          role="tab"
          aria-selected={selectedArea === "all"}
          onClick={() => onSelect("all")}
          className={`min-h-12 rounded-xl border px-4 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            selectedArea === "all"
              ? "border-blue-500/60 bg-blue-500/[0.1]"
              : "border-slate-800 bg-[#11161f] hover:border-slate-700"
          }`}
        >
          <span className="block text-xs font-semibold text-slate-100">All site</span>
          <span className="mt-0.5 block text-[11px] text-slate-400">
            Risk {siteSummary.riskScore} · {siteSummary.riskLevel}
          </span>
        </button>

        {areas.map(({ area, summary }) => (
          <button
            key={area}
            type="button"
            role="tab"
            aria-selected={selectedArea === area}
            onClick={() => onSelect(area)}
            className={`min-h-12 rounded-xl border px-4 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              selectedArea === area
                ? "border-blue-500/60 bg-blue-500/[0.1]"
                : "border-slate-800 bg-[#11161f] hover:border-slate-700"
            }`}
          >
            <span className="block text-xs font-semibold text-slate-100">{area}</span>
            <span className="mt-0.5 block text-[11px] text-slate-400">
              Risk {summary.riskScore} · {summary.riskLevel}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RiskSummaryCard({
  summary,
  scopeLabel,
}: {
  summary: StoresInventorySummary;
  scopeLabel: string;
}): JSX.Element {
  return (
    <article
      className={`rounded-2xl border p-5 ${riskTone(summary.riskLevel)}`}
      aria-label={`${scopeLabel} inventory risk ${summary.riskScore}, ${summary.riskLevel}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] opacity-75">
            {scopeLabel} inventory risk
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-5xl font-semibold tracking-[-0.05em]">
              {summary.riskScore}
            </span>
            <span className="pb-1 text-sm font-semibold opacity-80">/100</span>
          </div>
          <p className="mt-2 text-sm font-semibold">{summary.riskLevel}</p>
        </div>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-current/20 bg-black/10">
          <Warehouse className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-current/15 pt-4 text-xs">
        <div>
          <span className="block opacity-65">Affected assets</span>
          <strong className="mt-1 block text-base">{summary.affectedAssets}</strong>
        </div>
        <div>
          <span className="block opacity-65">Long-lead shortages</span>
          <strong className="mt-1 block text-base">{summary.longLeadShortages}</strong>
        </div>
      </div>
    </article>
  );
}

function InventoryItemCard({
  item,
  onOpen,
}: {
  item: StoresInventoryItem;
  onOpen: (item: StoresInventoryItem) => void;
}): JSX.Element {
  return (
    <article className="rounded-xl border border-slate-800 bg-[#11161f] p-4">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(220px,1.4fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(170px,0.9fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stockTone(item)}`}>
              {item.stockState}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${riskTone(item.exposureLevel)}`}>
              Exposure {item.exposureScore}
            </span>
            {item.longLeadShortage && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/[0.08] px-2.5 py-1 text-[11px] font-semibold text-amber-100">
                Long lead
              </span>
            )}
          </div>
          <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-slate-50">
            {item.partName}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {item.partNumber} · {item.storageLocation}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 lg:block">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Stock
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              {integer.format(item.stock)}
            </p>
          </div>
          <div className="lg:mt-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Minimum
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {integer.format(item.minimum)}
            </p>
          </div>
          <div className="lg:mt-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Target
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {integer.format(item.target)}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
            Lead time
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-100">
            {item.leadDays === null ? "Not recorded" : `${item.leadDays} days`}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {item.stockValue === null
              ? "Value not recorded"
              : `${currency.format(item.stockValue)} on hand`}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
            Affected equipment
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-100">
            {item.equipmentName}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {item.equipmentCode} · {item.area}
          </p>
          <p className="mt-2 text-xs font-medium text-blue-200">
            {item.recommendedAction}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpen(item)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-500/35 bg-blue-500/[0.09] px-4 py-2.5 text-sm font-semibold text-blue-100 transition hover:border-blue-400/60 hover:bg-blue-500/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label={`Open ${item.partName} for ${item.equipmentName}`}
        >
          Open spares
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

export function StoresInventorySection(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const registerRef = useRef<HTMLElement>(null);
  const [payload, setPayload] = useState<StoresInventoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedArea = searchParams.get("area") || "all";
  const filter = (searchParams.get("filter") || "attention") as InventoryFilter;
  const search = searchParams.get("search") || "";

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === "all") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const load = useCallback(async () => {
    if (!siteContext?.siteId || dataMode === "unavailable") {
      setPayload(null);
      setLoadError("Select an authorised site before opening Stores Inventory.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    const result = await loadStoresInventorySnapshot(siteContext.siteId);

    if (result.status === "ready") {
      setPayload(result.data);
      setLoading(false);
      return;
    }

    setPayload(null);
    setLoadError(result.message);
    setLoading(false);
  }, [dataMode, siteContext?.siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const scopedItems = useMemo(() => {
    if (!payload) return [];
    if (selectedArea === "all") return payload.items;
    return payload.items.filter((item) => item.area === selectedArea);
  }, [payload, selectedArea]);

  const summary = useMemo(
    () => summariseStoresInventory(scopedItems),
    [scopedItems],
  );

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return scopedItems.filter((item) => {
      const matchesSearch =
        !term ||
        [
          item.partName,
          item.partNumber,
          item.equipmentName,
          item.equipmentCode,
          item.storageLocation,
          item.supplier,
        ].some((value) => value.toLowerCase().includes(term));

      if (!matchesSearch) return false;
      if (filter === "all") return true;
      if (filter === "stockout") return item.stockState === "Out of stock";
      if (filter === "below-minimum") return item.stockState === "Below minimum";
      if (filter === "long-lead") return item.longLeadShortage;
      if (filter === "excess") return item.stockState === "Excess";
      return item.exposureScore > 0;
    });
  }, [filter, scopedItems, search]);

  const applyFilter = (nextFilter: InventoryFilter) => {
    updateParams({ filter: nextFilter });
    window.requestAnimationFrame(() => {
      registerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const openItem = (item: StoresInventoryItem) => {
    const next = new URLSearchParams({
      record: item.partNumber,
      from: "stores-inventory",
    });
    navigate(`/equipment/${item.equipmentId}/spares?${next.toString()}`);
  };

  if (loading && !payload) {
    return <LoadingState />;
  }

  if (!payload) {
    return (
      <EmptyState
        title="Stores Inventory unavailable"
        message={loadError ?? "Inventory evidence is not available for the active site."}
        onRetry={() => void load()}
      />
    );
  }

  const scopeLabel = selectedArea === "all" ? "Site" : selectedArea;
  const visibleCount = filteredItems.length;
  const stale = isStale(payload.latestSourceAt);

  return (
    <div
      data-vorta-stores-inventory="true"
      className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 pb-28 sm:px-6 sm:py-6 lg:px-8 lg:pb-10"
    >
      <header className="rounded-2xl border border-slate-800 bg-[#0f141d] p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-500/[0.08] text-blue-300">
                <Warehouse className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300">
                Site-wide stock intelligence
              </p>
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              Stores Inventory
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Prioritise stock-outs, shortages and long-lead exposure by the
              operational consequence to equipment and plant areas.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#151c27] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-[#18212d] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh inventory
          </button>
        </div>

        <div className="mt-5">
          <DataTrustBanner payload={payload} dataMode={dataMode} />
        </div>

        {loadError && payload && (
          <div
            className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-100"
            role="status"
          >
            Refresh failed. The previous evidence remains visible and is clearly
            timestamped. {loadError}
          </div>
        )}
      </header>

      <section
        data-vorta-group-frame="true"
        className="rounded-2xl border border-slate-800/90 bg-transparent p-3 sm:p-4"
        aria-labelledby="area-risk-heading"
      >
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <h2 id="area-risk-heading" className="text-sm font-semibold text-slate-100">
              Site and area risk
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Areas are ordered by current inventory exposure.
            </p>
          </div>
          <span className="text-xs text-slate-500">
            {payload.items.length} materials
          </span>
        </div>
        <AreaTabs
          items={payload.items}
          selectedArea={selectedArea}
          onSelect={(area) => updateParams({ area })}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.15fr_3fr]">
        <RiskSummaryCard summary={summary} scopeLabel={scopeLabel} />

        <div
          data-vorta-group-frame="true"
          className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-800/90 bg-transparent p-3 md:grid-cols-3 xl:grid-cols-6"
        >
          <MetricCard
            label="Critical stock-outs"
            value={integer.format(summary.criticalStockouts)}
            detail="Critical exposure with zero stock"
            icon={AlertTriangle}
            active={filter === "stockout"}
            onClick={() => applyFilter("stockout")}
          />
          <MetricCard
            label="Below minimum"
            value={integer.format(summary.belowMinimum)}
            detail="Available stock below the minimum"
            icon={PackageMinus}
            active={filter === "below-minimum"}
            onClick={() => applyFilter("below-minimum")}
          />
          <MetricCard
            label="Long-lead shortages"
            value={integer.format(summary.longLeadShortages)}
            detail="Shortfall with at least 42 days lead"
            icon={Clock3}
            active={filter === "long-lead"}
            onClick={() => applyFilter("long-lead")}
          />
          <MetricCard
            label="Affected assets"
            value={integer.format(summary.affectedAssets)}
            detail="Equipment exposed to a stock gap"
            icon={Boxes}
            active={filter === "attention"}
            onClick={() => applyFilter("attention")}
          />
          <MetricCard
            label="Stock value"
            value={
              summary.stockValue === null
                ? "Unavailable"
                : currency.format(summary.stockValue)
            }
            detail="On-hand value, not a risk driver"
            icon={PackageCheck}
            active={filter === "all"}
            onClick={() => applyFilter("all")}
          />
          <MetricCard
            label="Excess value"
            value={
              summary.excessValue === null
                ? "Unavailable"
                : currency.format(summary.excessValue)
            }
            detail="Quantity above target where cost exists"
            icon={Package}
            active={filter === "excess"}
            onClick={() => applyFilter("excess")}
          />
        </div>
      </section>

      <section
        ref={registerRef}
        className="scroll-mt-4 rounded-2xl border border-slate-800 bg-[#0f141d] p-4 sm:p-5"
        aria-labelledby="inventory-register-heading"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="inventory-register-heading" className="text-lg font-semibold text-slate-50">
              Prioritised inventory
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {visibleCount} {visibleCount === 1 ? "record" : "records"} shown
              {selectedArea === "all" ? " across the site" : ` for ${selectedArea}`}.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto]">
            <label className="relative block">
              <span className="sr-only">Search stores inventory</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  updateParams({ search: event.target.value || null })
                }
                placeholder="Search part, asset or location"
                className="min-h-11 w-full rounded-lg border border-slate-700 bg-[#111722] py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
            <select
              aria-label="Filter stores inventory"
              value={filter}
              onChange={(event) =>
                updateParams({
                  filter: event.target.value as InventoryFilter,
                })
              }
              className="min-h-11 rounded-lg border border-slate-700 bg-[#111722] px-3 text-sm font-medium text-slate-200 focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="attention">Action required</option>
              <option value="all">All inventory</option>
              <option value="stockout">Out of stock</option>
              <option value="below-minimum">Below minimum</option>
              <option value="long-lead">Long-lead shortages</option>
              <option value="excess">Excess stock</option>
            </select>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <InventoryItemCard
                key={item.id}
                item={item}
                onOpen={openItem}
              />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 bg-[#11161f] px-5 py-10 text-center">
              <Database className="mx-auto h-8 w-8 text-slate-600" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-slate-100">
                No matching inventory records
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                The current area, search and stock filter do not match any
                verified inventory evidence.
              </p>
              <button
                type="button"
                onClick={() =>
                  setSearchParams(
                    selectedArea === "all"
                      ? {}
                      : { area: selectedArea },
                    { replace: true },
                  )
                }
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-700 bg-[#151c27] px-4 py-2.5 text-sm font-semibold text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Clear inventory filters
              </button>
            </div>
          )}
        </div>
      </section>

      <footer className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#0f141d] px-4 py-3 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Checked {new Date(payload.checkedAt).toLocaleString("en-GB")} ·{" "}
          {stale ? "Source evidence is stale" : "Source evidence is within 7 days"}
        </span>
        <span>
          Equipment context: {payload.assetEvidence.status} · Risk context:{" "}
          {payload.riskEvidence.status}
        </span>
      </footer>
    </div>
  );
}
