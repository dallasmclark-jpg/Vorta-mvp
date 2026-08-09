import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ChevronDown,
  Clock3,
  Database,
  ExternalLink,
  Maximize2,
  Package,
  PackageCheck,
  PackageMinus,
  RefreshCw,
  Search,
  Warehouse,
  X,
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
  | "low-stock"
  | "long-lead"
  | "excess";

interface MetricCardProps {
  label: string;
  mobileLabel?: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  accessibleLabel?: string;
  compactMobileValue?: boolean;
}

interface FilterOption {
  key: InventoryFilter;
  label: string;
  count: number;
  dotClassName: string;
}

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const integer = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

function isStale(value: string | null): boolean {
  if (!value) return true;
  const age = Date.now() - new Date(value).getTime();
  return !Number.isFinite(age) || age > 7 * 86_400_000;
}

function riskDot(score: number): string {
  if (score >= 85) return "bg-red-400";
  if (score >= 65) return "bg-orange-400";
  if (score >= 40) return "bg-yellow-400";
  if (score >= 20) return "bg-emerald-400";
  return "bg-cyan-400";
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
  mobileLabel = label,
  value,
  detail,
  icon: Icon,
  active = false,
  onClick,
  accessibleLabel,
  compactMobileValue = false,
}: MetricCardProps): JSX.Element {
  const content = (
    <>
      <span className="block md:hidden">
        <span className="flex min-h-8 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-800 bg-[#0d1117] text-blue-300">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span
            data-vorta-inventory-kpi-mobile-label="true"
            className="text-[10px] font-semibold uppercase leading-4 tracking-[0.11em] text-slate-500"
          >
            {mobileLabel}
          </span>
        </span>
        <span
          className={`mt-2 block font-semibold tracking-tight text-slate-50 ${
            compactMobileValue ? "text-lg leading-5" : "text-2xl"
          }`}
        >
          {value}
        </span>
      </span>

      <span className="hidden md:contents">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-800 bg-[#0d1117] text-blue-300">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">
            {label}
          </span>
          <span className="mt-1 block text-2xl font-semibold tracking-tight text-slate-50">
            {value}
          </span>
          <span
            data-vorta-inventory-kpi-detail="true"
            className="mt-1 block text-xs leading-5 text-slate-400"
          >
            {detail}
          </span>
        </span>
      </span>
    </>
  );

  const className = `h-[100px] rounded-xl border p-3 text-left transition-colors md:h-auto md:min-h-[132px] md:p-4 ${
    active
      ? "border-blue-500/40 bg-blue-600/[0.12]"
      : "border-gray-800 bg-[#141820] hover:border-gray-700"
  }`;

  if (!onClick) {
    return (
      <article
        data-vorta-inventory-kpi="true"
        aria-label={accessibleLabel}
        className={className}
      >
        {content}
      </article>
    );
  }

  return (
    <button
      type="button"
      data-vorta-inventory-kpi="true"
      aria-label={accessibleLabel}
      onClick={onClick}
      className={`${className} w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60`}
    >
      {content}
    </button>
  );
}

function LoadingState(): JSX.Element {
  return (
    <section
      className="flex w-full flex-col gap-5 px-4 pb-28 pt-4 md:px-6 md:pb-12 xl:px-8"
      role="status"
      aria-live="polite"
    >
      <div className="hidden h-16 animate-pulse border-b border-white/10 md:block" />
      <div className="h-14 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-[100px] animate-pulse rounded-xl border border-gray-800 bg-[#141820] md:h-32"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
      <span className="sr-only">Loading Stores Inventory…</span>
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
      <div className="w-full rounded-xl border border-gray-800 bg-[#141820] p-6 text-center sm:p-8">
        <Warehouse className="mx-auto h-9 w-9 text-slate-500" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold text-slate-50">{title}</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
          {message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-700 bg-[#0d1117] px-4 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:border-gray-600 hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    </section>
  );
}

function DashboardStyleTab({
  label,
  value,
  selected,
  dotClassName,
  onClick,
}: {
  label: string;
  value: string;
  selected: boolean;
  dotClassName: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
        selected
          ? "border-blue-500/40 bg-blue-600 text-white"
          : "border-gray-800 bg-[#0d1117] text-slate-400 hover:border-gray-700 hover:bg-gray-800 hover:text-slate-200"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${dotClassName}`}
        data-vorta-risk-dot="true"
      />
      <span>{label}</span>
      <span className={selected ? "text-blue-100" : "text-slate-600"}>
        {value}
      </span>
    </button>
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
      (area) => ({
        area,
        summary: summariseStoresInventory(
          items.filter((item) => item.area === area),
        ),
      }),
    );

    return entries.sort(
      (left, right) =>
        right.summary.riskScore - left.summary.riskScore ||
        left.area.localeCompare(right.area),
    );
  }, [items]);

  const siteSummary = summariseStoresInventory(items);

  return (
    <div
      className="overflow-x-auto border-b border-gray-800 pb-2 sm:pb-4"
      style={{ scrollbarWidth: "none" }}
    >
      <div
        className="flex min-w-max items-center gap-2"
        role="tablist"
        aria-label="Inventory area risk"
      >
        <DashboardStyleTab
          label="All site"
          value={String(siteSummary.riskScore)}
          selected={selectedArea === "all"}
          dotClassName={riskDot(siteSummary.riskScore)}
          onClick={() => onSelect("all")}
        />
        {areas.map(({ area, summary }) => (
          <DashboardStyleTab
            key={area}
            label={area}
            value={String(summary.riskScore)}
            selected={selectedArea === area}
            dotClassName={riskDot(summary.riskScore)}
            onClick={() => onSelect(area)}
          />
        ))}
      </div>
    </div>
  );
}

function StockFilterTabs({
  options,
  selectedFilter,
  onSelect,
}: {
  options: FilterOption[];
  selectedFilter: InventoryFilter;
  onSelect: (filter: InventoryFilter) => void;
}): JSX.Element {
  return (
    <div
      className="overflow-x-auto pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      <div
        className="flex min-w-max items-center gap-2"
        role="tablist"
        aria-label="Inventory stock status"
      >
        {options.map((option) => (
          <DashboardStyleTab
            key={option.key}
            label={option.label}
            value={integer.format(option.count)}
            selected={selectedFilter === option.key}
            dotClassName={option.dotClassName}
            onClick={() => onSelect(option.key)}
          />
        ))}
      </div>
    </div>
  );
}

interface PreviousWeekComparison {
  scoreLabel: string;
  changeLabel: string | null;
  toneClassName: string;
  ariaLabel: string;
}

function getPreviousWeekComparison(
  currentScore: number,
  previousWeekScore: number | null,
): PreviousWeekComparison {
  if (previousWeekScore === null) {
    return {
      scoreLabel: "No prior score",
      changeLabel: null,
      toneClassName: "text-slate-300",
      ariaLabel: "Previous week: no prior inventory risk score is available",
    };
  }

  const difference = currentScore - previousWeekScore;
  if (difference > 0) {
    return {
      scoreLabel: `${previousWeekScore}/100`,
      changeLabel: `↑ ${difference} worse`,
      toneClassName: "text-red-300",
      ariaLabel: `Previous week ${previousWeekScore} out of 100, up ${difference}, worse`,
    };
  }
  if (difference < 0) {
    return {
      scoreLabel: `${previousWeekScore}/100`,
      changeLabel: `↓ ${Math.abs(difference)} better`,
      toneClassName: "text-emerald-300",
      ariaLabel: `Previous week ${previousWeekScore} out of 100, down ${Math.abs(difference)}, better`,
    };
  }

  return {
    scoreLabel: `${previousWeekScore}/100`,
    changeLabel: "No change",
    toneClassName: "text-slate-300",
    ariaLabel: `Previous week ${previousWeekScore} out of 100, no change`,
  };
}

function getPreviousWeekRiskScore(
  payload: StoresInventoryPayload | null,
): number | null {
  if (!payload) return null;

  const candidate = (payload as StoresInventoryPayload & {
    previousWeekRiskScore?: unknown;
  }).previousWeekRiskScore;

  return typeof candidate === "number" &&
    Number.isFinite(candidate) &&
    candidate >= 0 &&
    candidate <= 100
    ? Math.round(candidate)
    : null;
}

function RiskSummaryCard({
  summary,
  scopeLabel,
  previousWeekScore,
}: {
  summary: StoresInventorySummary;
  scopeLabel: string;
  previousWeekScore: number | null;
}): JSX.Element {
  const comparison = getPreviousWeekComparison(
    summary.riskScore,
    previousWeekScore,
  );

  return (
    <article
      data-vorta-inventory-risk-card="true"
      className={`rounded-xl border p-5 ${riskTone(summary.riskLevel)}`}
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

        <div
          data-vorta-inventory-week-comparison="true"
          className="shrink-0 text-right md:hidden"
          aria-label={comparison.ariaLabel}
        >
          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-65">
            Previous week
          </span>
          <strong
            className={`mt-1 block text-xs font-semibold ${comparison.toneClassName}`}
          >
            {comparison.scoreLabel}
          </strong>
          {comparison.changeLabel && (
            <span
              data-vorta-inventory-week-change="true"
              className={`mt-0.5 block text-[10px] font-semibold ${comparison.toneClassName}`}
            >
              {comparison.changeLabel}
            </span>
          )}
        </div>

        <span
          data-vorta-inventory-risk-icon="true"
          className="hidden h-11 w-11 items-center justify-center rounded-xl border border-current/20 bg-black/10 md:inline-flex"
        >
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

function DetailValue({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium leading-5 text-slate-200">
        {value}
      </dd>
    </div>
  );
}

function InventoryItemDisclosure({
  item,
  onOpen,
}: {
  item: StoresInventoryItem;
  onOpen: (item: StoresInventoryItem) => void;
}): JSX.Element {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [fullImageFailed, setFullImageFailed] = useState(false);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeImage = useCallback(() => {
    setImageExpanded(false);
    window.requestAnimationFrame(() => imageButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    setImageFailed(false);
    setImageExpanded(false);
    setFullImageFailed(false);
  }, [item.imageUrl, item.imageFullUrl]);

  useEffect(() => {
    if (!imageExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeImage();
    };

    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeImage, imageExpanded]);

  const showVerifiedImage = Boolean(item.imageUrl) && !imageFailed;
  const lightboxImageUrl =
    fullImageFailed || !item.imageFullUrl ? item.imageUrl : item.imageFullUrl;
  const imageSourceLabel =
    item.imageSourceType === "manufacturer"
      ? "Verified manufacturer image"
      : item.imageSourceType === "authorised_supplier"
        ? "Verified supplier image"
        : item.imageSourceType === "site_photo"
          ? "Verified site image"
          : "Verified spare image";

  return (
    <>
      <details
        data-vorta-inventory-disclosure="true"
        className="group rounded-xl border border-gray-800 bg-[#141820]"
      >
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/60 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-100 sm:text-base">
              {item.partName}
            </h3>
            <p className="mt-1 truncate text-xs text-slate-500">{item.partNumber}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stockTone(item)}`}
            >
              {item.stockState}
            </span>
            <ChevronDown
              className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </div>
        </summary>

        <div className="border-t border-gray-800 px-4 pb-4 pt-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div
              data-vorta-spare-image="true"
              className="w-full shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#0d1117]"
              style={{ maxWidth: "10rem" }}
            >
              <div
                className="flex items-center justify-center bg-[#0d1117]"
                style={{ aspectRatio: "1 / 1" }}
              >
                {showVerifiedImage ? (
                  <button
                    ref={imageButtonRef}
                    type="button"
                    onClick={() => {
                      setFullImageFailed(false);
                      setImageExpanded(true);
                    }}
                    aria-label={`Enlarge image of ${item.partName}`}
                    className="group/image relative h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/70"
                  >
                    <img
                      src={item.imageUrl ?? undefined}
                      alt={item.imageAltText}
                      loading="lazy"
                      decoding="async"
                      onError={() => setImageFailed(true)}
                      className="h-full w-full object-contain p-3"
                    />
                    <span className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/65 text-white opacity-90 shadow-lg transition-opacity group-hover/image:opacity-100">
                      <Maximize2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-slate-500">
                    <Package className="h-8 w-8" aria-hidden="true" />
                    <span className="text-xs font-medium leading-5">
                      No verified image available
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 border-t border-gray-800 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-500">
                  {showVerifiedImage ? imageSourceLabel : "Image unavailable"}
                </p>
                {item.oemUrl && (
                  <a
                    href={item.oemUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-blue-300 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                  >
                    View OEM product
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>

            <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-3 xl:grid-cols-6">
              <DetailValue label="Manufacturer" value={item.manufacturer} />
              <DetailValue
                label="OEM part number"
                value={item.oemPartNumber ?? "Not recorded"}
              />
              <DetailValue label="Stock" value={integer.format(item.stock)} />
              <DetailValue label="Minimum" value={integer.format(item.minimum)} />
              <DetailValue label="Target" value={integer.format(item.target)} />
              <DetailValue
                label="Lead time"
                value={item.leadDays === null ? "Not recorded" : `${item.leadDays} days`}
              />
              <DetailValue label="Supplier" value={item.supplier} />
              <DetailValue label="Location" value={item.storageLocation} />
            </dl>
          </div>

          <div className="mt-4 grid gap-3 border-t border-gray-800 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Affected equipment
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-100">
                {item.equipmentName}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {item.equipmentCode} · {item.area}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Recommended action
              </p>
              <p className="mt-1 text-sm font-medium leading-5 text-blue-200">
                {item.recommendedAction}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-500/35 bg-blue-500/[0.09] px-4 py-2.5 text-sm font-semibold text-blue-100 transition-colors hover:border-blue-400/60 hover:bg-blue-500/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
              aria-label={`Open ${item.partName} for ${item.equipmentName}`}
            >
              Open spares
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </details>

      {showVerifiedImage && imageExpanded && lightboxImageUrl && (
        <div
          data-vorta-spare-image-lightbox="true"
          role="dialog"
          aria-modal="true"
          aria-label={`Enlarged image of ${item.partName}`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeImage();
          }}
        >
          <div className="relative flex h-[92dvh] w-[96vw] max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeImage}
              aria-label="Close enlarged image"
              className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-black/70 text-white shadow-lg transition-colors hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="min-h-0 flex-1 p-4 sm:p-6 md:p-8">
              <img
                src={lightboxImageUrl}
                alt={item.imageAltText}
                decoding="async"
                onError={() => {
                  if (!fullImageFailed && item.imageUrl) {
                    setFullImageFailed(true);
                  } else {
                    closeImage();
                  }
                }}
                className="h-full w-full object-contain"
              />
            </div>

            <div className="flex flex-col gap-2 border-t border-white/10 bg-[#141820] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {item.partName}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {item.manufacturer}
                  {item.oemPartNumber ? ` · ${item.oemPartNumber}` : ""}
                </p>
              </div>
              {item.oemUrl && (
                <a
                  href={item.oemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-500/35 bg-blue-500/[0.09] px-3 py-2 text-sm font-semibold text-blue-100 hover:border-blue-400/60 hover:bg-blue-500/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                >
                  View OEM product
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
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
  const rawFilter = searchParams.get("filter");
  const filter: InventoryFilter =
    rawFilter === "all" ||
    rawFilter === "stockout" ||
    rawFilter === "low-stock" ||
    rawFilter === "long-lead" ||
    rawFilter === "excess"
      ? rawFilter
      : rawFilter === "below-minimum"
        ? "low-stock"
        : "attention";
  const search = searchParams.get("search") || "";

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        const shouldDelete =
          !value ||
          (key === "area" && value === "all") ||
          (key === "filter" && value === "attention");
        if (shouldDelete) next.delete(key);
        else next.set(key, value);
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

    if (result.status === "empty") {
      setPayload(null);
      setLoadError(result.message);
      setLoading(false);
      return;
    }

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
  const previousWeekRiskScore = useMemo(
    () => getPreviousWeekRiskScore(payload),
    [payload],
  );

  const filterOptions = useMemo<FilterOption[]>(() => {
    const actionRequired = scopedItems.filter((item) => item.exposureScore > 0).length;
    const outOfStock = scopedItems.filter(
      (item) => item.stockState === "Out of stock",
    ).length;
    const lowStock = scopedItems.filter(
      (item) =>
        item.stockState === "Below minimum" ||
        item.stockState === "Below target",
    ).length;
    const longLead = scopedItems.filter((item) => item.longLeadShortage).length;
    const excess = scopedItems.filter((item) => item.stockState === "Excess").length;

    return [
      {
        key: "attention",
        label: "Action required",
        count: actionRequired,
        dotClassName: "bg-orange-400",
      },
      {
        key: "stockout",
        label: "Out of stock",
        count: outOfStock,
        dotClassName: "bg-red-400",
      },
      {
        key: "low-stock",
        label: "Low stock",
        count: lowStock,
        dotClassName: "bg-yellow-400",
      },
      {
        key: "long-lead",
        label: "Long lead",
        count: longLead,
        dotClassName: "bg-amber-400",
      },
      {
        key: "excess",
        label: "Excess",
        count: excess,
        dotClassName: "bg-purple-400",
      },
      {
        key: "all",
        label: "All",
        count: scopedItems.length,
        dotClassName: "bg-cyan-400",
      },
    ];
  }, [scopedItems]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return scopedItems.filter((item) => {
      const matchesSearch =
        !term ||
        [
          item.partName,
          item.partNumber,
          item.oemPartNumber ?? "",
          item.manufacturer,
          item.equipmentName,
          item.equipmentCode,
          item.storageLocation,
          item.supplier,
        ].some((value) => value.toLowerCase().includes(term));

      if (!matchesSearch) return false;
      if (filter === "all") return true;
      if (filter === "stockout") return item.stockState === "Out of stock";
      if (filter === "low-stock") {
        return (
          item.stockState === "Below minimum" ||
          item.stockState === "Below target"
        );
      }
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

  if (loading && !payload) return <LoadingState />;

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
  const partial =
    payload.assetEvidence.status === "unavailable" ||
    payload.riskEvidence.status === "unavailable";

  return (
    <section
      data-vorta-stores-inventory="true"
      className="flex w-full flex-col gap-5 px-4 pb-28 pt-4 md:px-6 md:pb-12 xl:px-8"
    >
      <h1 className="sr-only">Stores Inventory</h1>
      <header className="hidden w-full flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex md:flex-row md:items-start">
        <div className="flex flex-col gap-1">
          <p className="text-xl font-semibold tracking-tight text-slate-50">
            Stores Inventory
          </p>
          <p className="text-sm text-slate-400">
            Stock risk, shortages and affected assets by plant area.
          </p>
        </div>
      </header>

      {(loadError || stale || partial) && (
        <div
          className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm leading-6 text-amber-100"
          role="status"
        >
          {loadError
            ? `Inventory could not be updated. Previous verified values remain visible. ${loadError}`
            : stale
              ? "Inventory source data may be stale. Values remain visible with their existing source timestamps."
              : "Some linked equipment or risk context is unavailable. Inventory quantities remain visible; unsupported context is withheld."}
        </div>
      )}

      <section
        data-vorta-group-frame="true"
        className="rounded-xl border border-gray-800 bg-[#141820] p-3 sm:p-5"
        aria-labelledby="area-risk-heading"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
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
        <RiskSummaryCard
          summary={summary}
          scopeLabel={scopeLabel}
          previousWeekScore={previousWeekRiskScore}
        />
        <div
          data-vorta-group-frame="true"
          className="grid grid-cols-2 gap-3 rounded-xl border border-gray-800 bg-[#141820] p-3 md:grid-cols-3 xl:grid-cols-6"
        >
          <MetricCard
            label="Critical stock-outs"
            mobileLabel="Critical stock-outs"
            value={integer.format(summary.criticalStockouts)}
            detail="Critical items with zero stock"
            icon={AlertTriangle}
            active={filter === "stockout"}
            onClick={() => applyFilter("stockout")}
          />
          <MetricCard
            label="Low stock"
            mobileLabel="Low stock"
            value={integer.format(summary.belowMinimum + summary.belowTarget)}
            detail="Below minimum or target"
            icon={PackageMinus}
            active={filter === "low-stock"}
            onClick={() => applyFilter("low-stock")}
          />
          <MetricCard
            label="Long lead"
            mobileLabel="Long lead 42+ days"
            value={integer.format(summary.longLeadShortages)}
            detail="Shortfall with at least 42 days lead"
            icon={Clock3}
            active={filter === "long-lead"}
            onClick={() => applyFilter("long-lead")}
          />
          <MetricCard
            label="Affected assets"
            mobileLabel="Affected assets"
            value={integer.format(summary.affectedAssets)}
            detail="Equipment exposed to a stock gap"
            icon={Boxes}
            active={filter === "attention"}
            onClick={() => applyFilter("attention")}
          />
          <MetricCard
            label="Stock value"
            mobileLabel="On-hand stock value"
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
            mobileLabel="Excess stock value"
            value={
              summary.excessValue === null
                ? "Not calculated"
                : currency.format(summary.excessValue)
            }
            detail="Quantity above target where cost exists"
            accessibleLabel={
              summary.excessValue === null
                ? "Excess stock value: not calculated. No calculable excess value is available from the current target-stock and unit-cost evidence."
                : `Excess stock value: ${currency.format(summary.excessValue)}`
            }
            compactMobileValue={summary.excessValue === null}
            icon={Package}
            active={filter === "excess"}
            onClick={() => applyFilter("excess")}
          />
        </div>
      </section>

      <section
        ref={registerRef}
        className="scroll-mt-4 rounded-xl border border-gray-800 bg-[#141820] p-4 sm:p-5"
        aria-labelledby="inventory-register-heading"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 id="inventory-register-heading" className="text-lg font-semibold text-slate-50">
                Inventory
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {visibleCount} {visibleCount === 1 ? "record" : "records"} shown
                {selectedArea === "all" ? " across the site" : ` for ${selectedArea}`}.
              </p>
            </div>
            <label className="relative block w-full lg:max-w-sm">
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
                className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1117] py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          </div>

          <StockFilterTabs
            options={filterOptions}
            selectedFilter={filter}
            onSelect={applyFilter}
          />
        </div>

        <div className="mt-5 space-y-3">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <InventoryItemDisclosure
                key={item.id}
                item={item}
                onOpen={openItem}
              />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-gray-700 bg-[#0d1117] px-5 py-10 text-center">
              <Database className="mx-auto h-8 w-8 text-slate-600" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-slate-100">
                No matching inventory records
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                The current area, search and stock filter do not match any inventory records.
              </p>
              <button
                type="button"
                onClick={() =>
                  setSearchParams(
                    selectedArea === "all" ? {} : { area: selectedArea },
                    { replace: true },
                  )
                }
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-700 bg-[#141820] px-4 py-2.5 text-sm font-semibold text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
              >
                Clear inventory filters
              </button>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
