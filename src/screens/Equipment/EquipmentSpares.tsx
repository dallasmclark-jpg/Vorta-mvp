import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Copy,
  Database,
  Download,
  FileSearch,
  Gauge,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  UserCircle,
  Wrench,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { DEFAULT_EQUIPMENT_ID } from "./equipmentData";
import type { EquipmentBase } from "./equipmentData";
import {
  getCachedEquipmentIdentity,
  getEquipmentComponents,
  getEquipmentIdentityById,
  getEquipmentRecommendedWorkQueue,
} from "./equipmentService";
import type {
  EquipmentComponentsResult,
  EquipmentRecommendedWorkQueue,
} from "./equipmentService";
import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";

type InventoryPart = EquipmentComponentsResult["inventory"][number];
type ExposureBand = "Critical" | "High" | "Medium" | "Covered";

interface RankedPart extends InventoryPart {
  gap: number;
  coverage: number;
  exposureScore: number;
  exposureBand: ExposureBand;
  consequence: string;
  recommendation: string;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function normaliseCriticality(value: string): string {
  return value.trim().toLowerCase();
}

function isCriticalPart(part: InventoryPart): boolean {
  const criticality = normaliseCriticality(part.criticality);
  return criticality === "critical" || criticality === "high";
}

function isOutOfStock(part: InventoryPart): boolean {
  return part.stock <= 0 || part.status.toLowerCase().includes("out");
}

function isBelowTarget(part: InventoryPart): boolean {
  return part.stock < Math.max(part.max, 0);
}

function consequenceFor(part: InventoryPart): string {
  const label = `${part.name} ${part.partNumber}`.toLowerCase();

  if (label.includes("reject") && label.includes("sensor")) {
    return "Reject verification unavailable; production may require a quality hold.";
  }
  if (label.includes("level probe") || label.includes("level sensor")) {
    return "Loss of level control can stop filling and interrupt batch continuity.";
  }
  if (label.includes("hmi") || label.includes("touchscreen")) {
    return "Operator interface failure can extend diagnosis and recovery time.";
  }
  if (label.includes("servo") || label.includes("motor")) {
    return "Drive failure can stop the affected equipment axis until replacement.";
  }
  if (label.includes("clutch") || label.includes("starwheel")) {
    return "Infeed timing failure can stop product transfer through the filler.";
  }
  if (label.includes("needle") || label.includes("nozzle")) {
    return "Product-contact component failure can interrupt sterile filling readiness.";
  }
  if (label.includes("valve") || label.includes("manifold")) {
    return "Pneumatic control loss can disable multiple machine functions.";
  }
  if (label.includes("guard") || label.includes("switch")) {
    return "Safety-circuit failure can prevent the equipment from being released to run.";
  }

  return isCriticalPart(part)
    ? "Failure would restrict safe operation until a suitable replacement is available."
    : "Stock depletion would increase maintenance recovery time.";
}

function exposureBand(score: number, covered: boolean): ExposureBand {
  if (covered) return "Covered";
  if (score >= 75) return "Critical";
  if (score >= 52) return "High";
  return "Medium";
}

function exposureTone(band: ExposureBand): string {
  if (band === "Critical") {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (band === "High") {
    return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  }
  if (band === "Medium") {
    return "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";
  }
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}

function criticalityTone(criticality: string): string {
  const value = normaliseCriticality(criticality);
  if (value === "critical") {
    return "bg-red-500/10 text-red-300";
  }
  if (value === "high") {
    return "bg-orange-500/10 text-orange-300";
  }
  if (value === "medium") {
    return "bg-yellow-500/10 text-yellow-300";
  }
  return "bg-slate-800 text-slate-400";
}

function riskTone(level: string): string {
  if (level === "Critical") {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (level === "High") {
    return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  }
  if (level === "Medium") {
    return "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";
  }
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}

function StockDonut({
  coverage,
  available,
  low,
  out,
}: {
  coverage: number;
  available: number;
  low: number;
  out: number;
}) {
  const size = 132;
  const strokeWidth = 13;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { value: available, color: "#10b981" },
    { value: low, color: "#eab308" },
    { value: out, color: "#ef4444" },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Stock resilience ${coverage}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#1f2937"
        strokeWidth={strokeWidth}
      />
      {segments.map((segment) => {
        const length = (segment.value / total) * circumference;
        const currentOffset = offset;
        offset += length;

        return (
          <circle
            key={segment.color}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${Math.max(0, length - 2)} ${circumference}`}
            strokeDashoffset={-currentOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
      <text
        x="50%"
        y="47%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="#f8fafc"
        fontSize="22"
        fontWeight="700"
      >
        {coverage}%
      </text>
      <text
        x="50%"
        y="63%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="#64748b"
        fontSize="9"
      >
        target cover
      </text>
    </svg>
  );
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
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-base font-semibold text-slate-50">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  tone = "text-slate-50",
}: {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
      {note ? <p className="mt-1 text-[10px] text-slate-600">{note}</p> : null}
    </div>
  );
}

export const EquipmentSpares = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;

  const [equipment, setEquipment] = useState<EquipmentBase | null>(() =>
    getCachedEquipmentIdentity(resolvedId),
  );
  const [components, setComponents] = useState<EquipmentComponentsResult>({
    inventory: [],
    criticalComponents: [],
    stockSummary: {
      totalComponents: 0,
      outOfStock: 0,
      lowStock: 0,
      okStock: 0,
    },
  });
  const [workQueue, setWorkQueue] =
    useState<EquipmentRecommendedWorkQueue | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [question, setQuestion] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const loadSparesIntelligence = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);

    try {
      const [identity, componentResult, queue] = await Promise.all([
        getEquipmentIdentityById(resolvedId),
        getEquipmentComponents(resolvedId),
        getEquipmentRecommendedWorkQueue(resolvedId),
      ]);

      setEquipment(identity);
      setComponents(componentResult);
      setWorkQueue(queue);
      setLastUpdated(new Date());
      setHasLoaded(true);
    } catch (error) {
      console.error("Failed to load equipment spares intelligence", error);
      setLoadError(
        "Unable to refresh spares intelligence. Showing the latest available data.",
      );
      setHasLoaded(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [resolvedId]);

  useEffect(() => {
    void loadSparesIntelligence();
  }, [loadSparesIntelligence]);

  const rankedParts = useMemo<RankedPart[]>(() => {
    return components.inventory
      .map((part) => {
        const target = Math.max(part.max, 0);
        const gap = Math.max(target - part.stock, 0);
        const coverage =
          target > 0 ? clamp(Math.round((part.stock / target) * 100)) : 100;
        const criticality = normaliseCriticality(part.criticality);
        const criticalityWeight =
          criticality === "critical"
            ? 32
            : criticality === "high"
              ? 24
              : criticality === "medium"
                ? 12
                : 5;
        const availabilityWeight = isOutOfStock(part)
          ? 42
          : isBelowTarget(part)
            ? 20
            : 0;
        const gapWeight =
          target > 0 ? Math.round((gap / target) * 20) : 0;
        const leadWeight = Math.min(18, Math.max(0, part.leadDays));
        const exposureScore = clamp(
          availabilityWeight + criticalityWeight + gapWeight + leadWeight,
        );
        const covered = gap === 0 && !isOutOfStock(part);
        const band = exposureBand(exposureScore, covered);

        return {
          ...part,
          gap,
          coverage,
          exposureScore,
          exposureBand: band,
          consequence: consequenceFor(part),
          recommendation: covered
            ? "Maintain current holding"
            : `Restore stock to ${target} unit${target === 1 ? "" : "s"}`,
        };
      })
      .sort((left, right) => {
        if (right.exposureScore !== left.exposureScore) {
          return right.exposureScore - left.exposureScore;
        }
        return left.name.localeCompare(right.name);
      });
  }, [components.inventory]);

  const inventoryValue = useMemo(
    () =>
      components.inventory.reduce(
        (total, part) => total + part.stock * (part.unitCost ?? 0),
        0,
      ),
    [components.inventory],
  );

  const gapValue = useMemo(
    () =>
      rankedParts.reduce(
        (total, part) => total + part.gap * (part.unitCost ?? 0),
        0,
      ),
    [rankedParts],
  );

  const targetUnits = useMemo(
    () => rankedParts.reduce((total, part) => total + Math.max(part.max, 0), 0),
    [rankedParts],
  );

  const coveredTargetUnits = useMemo(
    () =>
      rankedParts.reduce(
        (total, part) =>
          total + Math.min(Math.max(part.stock, 0), Math.max(part.max, 0)),
        0,
      ),
    [rankedParts],
  );

  const stockResilience =
    targetUnits > 0
      ? clamp(Math.round((coveredTargetUnits / targetUnits) * 100))
      : 100;

  const criticalParts = useMemo(
    () => rankedParts.filter((part) => isCriticalPart(part)),
    [rankedParts],
  );

  const criticalAtRisk = useMemo(
    () => criticalParts.filter((part) => part.gap > 0 || isOutOfStock(part)),
    [criticalParts],
  );

  const longLeadCritical = useMemo(
    () =>
      criticalParts.filter(
        (part) => part.leadDays >= 14 && (part.gap > 0 || isOutOfStock(part)),
      ),
    [criticalParts],
  );

  const suppliers = useMemo(() => {
    const supplierMap = new Map<
      string,
      {
        name: string;
        partCount: number;
        criticalCount: number;
        atRiskCount: number;
        leadDays: number[];
        value: number;
      }
    >();

    for (const part of rankedParts) {
      const name = part.supplier.trim() || "Supplier not set";
      const existing = supplierMap.get(name) ?? {
        name,
        partCount: 0,
        criticalCount: 0,
        atRiskCount: 0,
        leadDays: [],
        value: 0,
      };

      existing.partCount += 1;
      existing.value += part.stock * (part.unitCost ?? 0);
      if (isCriticalPart(part)) existing.criticalCount += 1;
      if (part.gap > 0 || isOutOfStock(part)) existing.atRiskCount += 1;
      if (part.leadDays > 0) existing.leadDays.push(part.leadDays);
      supplierMap.set(name, existing);
    }

    return Array.from(supplierMap.values())
      .map((supplier) => ({
        ...supplier,
        averageLead:
          supplier.leadDays.length > 0
            ? Math.round(
                supplier.leadDays.reduce((sum, days) => sum + days, 0) /
                  supplier.leadDays.length,
              )
            : 0,
      }))
      .sort((left, right) => {
        if (right.atRiskCount !== left.atRiskCount) {
          return right.atRiskCount - left.atRiskCount;
        }
        return right.criticalCount - left.criticalCount;
      });
  }, [rankedParts]);

  const filteredParts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rankedParts.filter((part) => {
      const matchesSearch =
        !query ||
        part.name.toLowerCase().includes(query) ||
        part.partNumber.toLowerCase().includes(query) ||
        part.supplier.toLowerCase().includes(query) ||
        part.location.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "attention" && part.exposureBand !== "Covered") ||
        (statusFilter === "out" && isOutOfStock(part)) ||
        (statusFilter === "critical" && isCriticalPart(part));

      return matchesSearch && matchesStatus;
    });
  }, [rankedParts, search, statusFilter]);

  if (!equipment) {
    return (
      <section className="flex w-full flex-col pb-10">
        <div className="border-b border-gray-800 bg-[#0b0e14] px-4 py-4 md:px-6">
          <div className="h-40 animate-pulse rounded-xl bg-[#141820]" />
        </div>
      </section>
    );
  }

  const eq = equipment;
  const riskTotal =
    eq.riskBreakdown.reduce((sum, driver) => sum + driver.pct, 0) || 1;
  const sparesRiskContribution =
    eq.riskBreakdown.find((driver) =>
      driver.label.toLowerCase().includes("spare"),
    )?.pct ?? 0;
  const topExposure = rankedParts[0] ?? null;
  const currentRisk = workQueue?.currentRiskScore || eq.riskScore;
  const spareQueueAction = workQueue?.actions.find(
    (action) => action.sparePartNumber || action.partName,
  );
  const potentialReduction =
    spareQueueAction?.calculatedReduction ??
    Math.min(8, Math.max(2, components.stockSummary.outOfStock * 3));
  const projectedRisk = clamp(currentRisk - potentialReduction);
  const riskBadgeClass = riskTone(eq.riskLevel);

  const lastUpdatedLabel = lastUpdated
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(lastUpdated)
    : "Loading latest import";

  const briefing =
    topExposure && topExposure.exposureBand !== "Covered"
      ? `${eq.name} has ${components.stockSummary.outOfStock} part${
          components.stockSummary.outOfStock === 1 ? "" : "s"
        } out of stock and ${components.stockSummary.lowStock} below target. ${
          topExposure.name
        } creates the highest current exposure because it is ${
          topExposure.status.toLowerCase()
        }, is rated ${topExposure.criticality.toLowerCase()} and has a ${
          topExposure.leadDays
        }-day replenishment lead time.`
      : `${eq.name} currently has full critical-spares coverage. Vorta is monitoring target holdings, supplier lead times and equipment failure consequences for early deterioration.`;

  const askVorta = () => {
    const prompt =
      question.trim() ||
      `Explain the spare-parts risk for ${eq.name} and the highest-value replenishment action.`;
    navigate(
      `/equipment/${eq.id}/ai-insights?prompt=${encodeURIComponent(prompt)}`,
    );
  };

  const copyText = async (value: string, key: string) => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  };

  const exportInventory = () => {
    const rows = [
      [
        "Part",
        "Part Number",
        "Criticality",
        "Stock",
        "Target",
        "Status",
        "Supplier",
        "Lead Days",
        "Storage Location",
        "Unit Cost",
        "Exposure Score",
      ],
      ...rankedParts.map((part) => [
        part.name,
        part.partNumber,
        part.criticality,
        String(part.stock),
        String(part.max),
        part.status,
        part.supplier,
        String(part.leadDays),
        part.location,
        String(part.unitCost ?? 0),
        String(part.exposureScore),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${eq.assetNumber}-spares-intelligence.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
      {loadError ? (
        <div className="mx-4 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 md:mx-6">
          {loadError}
        </div>
      ) : null}

      <div className="sticky top-0 z-10 border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500"
          >
            <button
              type="button"
              onClick={() => navigate("/equipment")}
              className="transition-colors hover:text-slate-300"
            >
              Equipment
            </button>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-slate-300">
              {eq.name} ({eq.assetNumber})
            </span>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void copyText(eq.assetNumber, "asset")}
              className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs text-slate-300 hover:bg-gray-800 hover:text-slate-100"
            >
              {copied === "asset" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied === "asset" ? "Copied" : "Copy asset ref"}
            </Button>
            <button
              type="button"
              onClick={() => void loadSparesIntelligence()}
              disabled={isRefreshing}
              aria-label="Refresh spares intelligence"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={() => navigate(`/equipment/${eq.id}/notifications`)}
              aria-label="Equipment notifications"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/settings")}
              aria-label="Profile settings"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200"
            >
              <UserCircle className="h-7 w-7" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">
            <img
              src={eq.image}
              alt={eq.name}
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">
                {eq.name}
              </h1>
              <Badge
                className={`inline-flex h-auto rounded border px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}
              >
                {eq.riskLevel} Risk
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <EquipmentRiskIndicator riskLevel={eq.riskLevel} />
              <span className="text-sm font-semibold text-slate-200">
                {eq.status}
              </span>
              <span className="text-sm text-slate-500">{eq.statusNote}</span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="font-medium text-slate-300">
                {eq.assetNumber}
              </span>
              <span className="rounded bg-gray-800 px-1.5 py-0.5 font-medium tracking-wide">
                {eq.type}
              </span>
              <span>📍 {eq.area}</span>
              <span>
                Manufacturer:{" "}
                <span className="text-slate-300">{eq.manufacturer}</span>
              </span>
              <span>
                Model: <span className="text-slate-300">{eq.model}</span>
              </span>
              <span>
                Criticality:{" "}
                <span className="text-slate-300">{eq.criticality}</span>
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 lg:w-52">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Risk Score
            </span>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-slate-50">
                {currentRisk}%
              </span>
              <Badge
                className={`mb-1 inline-flex h-auto rounded border px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}
              >
                {eq.riskLevel}
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500">
                Risk drivers
              </span>
              <div className="flex h-2 overflow-hidden rounded-full bg-gray-800">
                {eq.riskBreakdown.map((driver) => (
                  <div
                    key={driver.label}
                    style={{
                      width: `${(driver.pct / riskTotal) * 100}%`,
                      backgroundColor: driver.color,
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {eq.riskBreakdown.map((driver) => (
                  <span
                    key={driver.label}
                    className="inline-flex items-center gap-1 text-[10px] text-slate-400"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${driver.dotClass}`}
                    />
                    {driver.label} {driver.pct}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <EquipmentTabNavigation equipmentId={eq.id} activeTab="spares" />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">
        <Card className="overflow-hidden rounded-2xl border border-indigo-500/25 bg-[linear-gradient(135deg,#131923_0%,#10151d_55%,#111525_100%)] shadow-none">
          <CardContent className="p-0">
            <div className="grid xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.55fr)]">
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="h-auto rounded bg-indigo-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-300 shadow-none">
                    Spares intelligence
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Database className="h-3.5 w-3.5" />
                    SAP IH01 · MB52 · equipment BOM · refreshed{" "}
                    {lastUpdated ? "now" : "pending"}
                  </span>
                </div>

                <h2 className="mt-4 text-xl font-semibold text-slate-50">
                  Spares Resilience Briefing
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                  {briefing}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-gray-800 bg-[#0c1118]/80 p-3">
                    <Metric
                      label="Target stock cover"
                      value={`${stockResilience}%`}
                      tone={
                        stockResilience >= 90
                          ? "text-emerald-300"
                          : stockResilience >= 70
                            ? "text-yellow-300"
                            : "text-red-300"
                      }
                    />
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-[#0c1118]/80 p-3">
                    <Metric
                      label="Critical parts exposed"
                      value={criticalAtRisk.length}
                      tone={
                        criticalAtRisk.length > 0
                          ? "text-orange-300"
                          : "text-emerald-300"
                      }
                    />
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-[#0c1118]/80 p-3">
                    <Metric
                      label="Stock gap value"
                      value={formatCurrency(gapValue)}
                      tone="text-slate-50"
                    />
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-[#0c1118]/80 p-3">
                    <Metric
                      label="Risk after action"
                      value={`${projectedRisk}%`}
                      note={`-${potentialReduction} calculated points`}
                      tone="text-emerald-300"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-gray-700 bg-[#0a0f16] px-3 focus-within:border-blue-500/60">
                    <Sparkles className="h-4 w-4 shrink-0 text-blue-400" />
                    <input
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") askVorta();
                      }}
                      placeholder={`Ask Vorta about ${eq.assetNumber} spare risk...`}
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={askVorta}
                    className="min-h-11 gap-2 bg-blue-600 px-5 text-white hover:bg-blue-500"
                  >
                    <BrainCircuit className="h-4 w-4" />
                    Ask Vorta
                  </Button>
                </div>
              </div>

              <div className="border-t border-gray-800 bg-[#0b1017]/70 p-5 xl:border-l xl:border-t-0 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Current exposure
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-800 bg-[#0b0f15] p-3">
                    <Metric
                      label="Out of stock"
                      value={components.stockSummary.outOfStock}
                      tone="text-red-300"
                    />
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-[#0b0f15] p-3">
                    <Metric
                      label="Below target"
                      value={rankedParts.filter((part) => part.gap > 0).length}
                      tone="text-yellow-300"
                    />
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-[#0b0f15] p-3">
                    <Metric
                      label="Long-lead critical"
                      value={longLeadCritical.length}
                      tone="text-orange-300"
                    />
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-[#0b0f15] p-3">
                    <Metric
                      label="Equipment risk share"
                      value={`${sparesRiskContribution}%`}
                      tone="text-indigo-300"
                    />
                  </div>
                </div>

                {topExposure ? (
                  <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                      <div>
                        <p className="text-xs font-semibold text-slate-100">
                          Highest exposure
                        </p>
                        <p className="mt-1 text-sm font-semibold text-red-200">
                          {topExposure.name}
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-400">
                          {topExposure.consequence}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => navigate(`/equipment/${eq.id}/ai-insights`)}
                  className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
                >
                  Open full risk explanation
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-orange-500/25 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <SectionHeading
              eyebrow="Risk-ranked replenishment"
              title="Highest-value stock interventions"
              description="Vorta ranks each part using stock gap, equipment criticality, failure consequence and supplier lead time. The list is read-only and remains aligned to SAP as the system of record."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={exportInventory}
                  className="h-9 gap-2 border-gray-700 bg-transparent text-xs text-slate-300 hover:bg-gray-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export intelligence
                </Button>
              }
            />

            <div className="mt-5 overflow-hidden rounded-xl border border-gray-800">
              <div className="hidden grid-cols-[56px_minmax(220px,1.5fr)_110px_105px_minmax(130px,0.8fr)_110px_44px] gap-3 border-b border-gray-800 bg-[#0d1219] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 lg:grid">
                <span>Priority</span>
                <span>Part and consequence</span>
                <span>Stock</span>
                <span>Lead time</span>
                <span>Supplier</span>
                <span>Exposure</span>
                <span />
              </div>

              {rankedParts.slice(0, 4).map((part, index) => (
                <button
                  key={part.partNumber}
                  type="button"
                  onClick={() =>
                    void copyText(part.partNumber, `plan-${part.partNumber}`)
                  }
                  className="grid w-full gap-3 border-b border-gray-800 px-4 py-4 text-left transition-colors last:border-0 hover:bg-white/[0.025] lg:grid-cols-[56px_minmax(220px,1.5fr)_110px_105px_minmax(130px,0.8fr)_110px_44px] lg:items-center"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-800 text-xs font-bold text-slate-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-100">
                        {part.name}
                      </span>
                      <span className="font-mono text-[10px] text-slate-600">
                        {part.partNumber}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
                      {part.consequence}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {part.stock} / {part.max}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      Gap {part.gap}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      {part.leadDays} days
                    </p>
                    <p className="text-[10px] text-slate-600">
                      {part.location || "Location not set"}
                    </p>
                  </div>
                  <span className="truncate text-xs text-slate-400">
                    {part.supplier || "Not set"}
                  </span>
                  <Badge
                    className={`w-fit rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${exposureTone(
                      part.exposureBand,
                    )}`}
                  >
                    {part.exposureBand}
                  </Badge>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-500">
                    {copied === `plan-${part.partNumber}` ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <ClipboardCopy className="h-3.5 w-3.5" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.45fr)]">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <SectionHeading
                eyebrow="BOM and inventory intelligence"
                title="Equipment spares register"
                description={`${filteredParts.length} of ${rankedParts.length} linked parts shown. Search by part, SAP material reference, supplier or storage location.`}
              />

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <div className="flex min-h-10 flex-1 items-center gap-2 rounded-lg border border-gray-700 bg-[#0b0f15] px-3 focus-within:border-blue-500/50">
                  <Search className="h-4 w-4 text-slate-600" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search parts, material number, supplier or stores..."
                    className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="min-h-10 rounded-lg border border-gray-700 bg-[#0b0f15] px-3 text-xs text-slate-300 outline-none focus:border-blue-500/50"
                >
                  <option value="all">All parts</option>
                  <option value="attention">Requires attention</option>
                  <option value="out">Out of stock</option>
                  <option value="critical">Critical and high</option>
                </select>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {[
                        "Part",
                        "Criticality",
                        "Stock / target",
                        "Supplier",
                        "Lead",
                        "Storage",
                        "Exposure",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 first:pl-0"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!hasLoaded ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-10 text-center text-xs text-slate-500"
                        >
                          Loading linked equipment spares...
                        </td>
                      </tr>
                    ) : filteredParts.length > 0 ? (
                      filteredParts.map((part) => (
                        <tr
                          key={part.partNumber}
                          className="border-b border-gray-800 last:border-0"
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-800 bg-[#0d1219]">
                                <Package className="h-4 w-4 text-slate-500" />
                              </div>
                              <div>
                                <p className="font-semibold text-slate-200">
                                  {part.name}
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void copyText(
                                      part.partNumber,
                                      part.partNumber,
                                    )
                                  }
                                  className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-slate-600 hover:text-blue-400"
                                >
                                  {part.partNumber}
                                  {copied === part.partNumber ? (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <Badge
                              className={`rounded px-2 py-1 text-[10px] font-semibold shadow-none ${criticalityTone(
                                part.criticality,
                              )}`}
                            >
                              {part.criticality}
                            </Badge>
                          </td>
                          <td className="px-2 py-3">
                            <p
                              className={`font-semibold ${
                                isOutOfStock(part)
                                  ? "text-red-300"
                                  : part.gap > 0
                                    ? "text-yellow-300"
                                    : "text-emerald-300"
                              }`}
                            >
                              {part.stock} / {part.max}
                            </p>
                            <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-gray-800">
                              <div
                                className={`h-full rounded-full ${
                                  isOutOfStock(part)
                                    ? "bg-red-500"
                                    : part.gap > 0
                                      ? "bg-yellow-500"
                                      : "bg-emerald-500"
                                }`}
                                style={{ width: `${part.coverage}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-2 py-3 text-slate-400">
                            {part.supplier || "Not set"}
                          </td>
                          <td className="px-2 py-3">
                            <span
                              className={
                                part.leadDays >= 14
                                  ? "font-semibold text-orange-300"
                                  : "text-slate-400"
                              }
                            >
                              {part.leadDays}d
                            </span>
                          </td>
                          <td className="px-2 py-3 text-slate-400">
                            {part.location || "Not set"}
                          </td>
                          <td className="px-2 py-3">
                            <Badge
                              className={`rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${exposureTone(
                                part.exposureBand,
                              )}`}
                            >
                              {part.exposureBand} · {part.exposureScore}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-10 text-center text-xs text-slate-500"
                        >
                          No linked parts match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <SectionHeading
                  eyebrow="Stock resilience"
                  title="Target holding coverage"
                  description="Current quantities compared with equipment-specific target holdings."
                />
                <div className="mt-5 flex items-center justify-center gap-5">
                  <StockDonut
                    coverage={stockResilience}
                    available={components.stockSummary.okStock}
                    low={components.stockSummary.lowStock}
                    out={components.stockSummary.outOfStock}
                  />
                  <div className="space-y-3">
                    {[
                      {
                        label: "At target",
                        value: components.stockSummary.okStock,
                        tone: "bg-emerald-400",
                      },
                      {
                        label: "Low stock",
                        value: components.stockSummary.lowStock,
                        tone: "bg-yellow-400",
                      },
                      {
                        label: "Out of stock",
                        value: components.stockSummary.outOfStock,
                        tone: "bg-red-400",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between gap-5"
                      >
                        <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                          <span
                            className={`h-2 w-2 rounded-full ${item.tone}`}
                          />
                          {item.label}
                        </span>
                        <span className="text-sm font-semibold text-slate-100">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-800 pt-4">
                  <Metric
                    label="Available units"
                    value={coveredTargetUnits}
                    tone="text-slate-100"
                  />
                  <Metric
                    label="Target units"
                    value={targetUnits}
                    tone="text-slate-100"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-red-500/20 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <SectionHeading
                  eyebrow="Failure consequence"
                  title={topExposure?.name ?? "No exposed critical part"}
                  description={
                    topExposure?.consequence ??
                    "All linked critical parts are currently covered."
                  }
                />
                {topExposure ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-gray-800 bg-[#0d1219] p-3">
                        <Metric
                          label="Current / target"
                          value={`${topExposure.stock} / ${topExposure.max}`}
                          tone="text-red-300"
                        />
                      </div>
                      <div className="rounded-xl border border-gray-800 bg-[#0d1219] p-3">
                        <Metric
                          label="Lead time"
                          value={`${topExposure.leadDays}d`}
                          tone="text-orange-300"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-[#0d1219] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        Vorta recommendation
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-300">
                        {topExposure.recommendation}. Confirm availability with{" "}
                        {topExposure.supplier || "the linked supplier"} and
                        review work orders currently waiting for this component.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/equipment/${eq.id}/work-orders`)
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
                    >
                      View related work orders
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <SectionHeading
                eyebrow="Supplier resilience"
                title="Lead-time and concentration exposure"
                description="Supplier dependency is ranked by exposed critical parts, linked components and average replenishment lead."
              />
              <div className="mt-4 overflow-hidden rounded-xl border border-gray-800">
                <div className="grid grid-cols-[minmax(180px,1fr)_90px_100px_110px] gap-3 border-b border-gray-800 bg-[#0d1219] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  <span>Supplier</span>
                  <span>Parts</span>
                  <span>At risk</span>
                  <span>Average lead</span>
                </div>
                {suppliers.slice(0, 6).map((supplier) => (
                  <div
                    key={supplier.name}
                    className="grid grid-cols-[minmax(180px,1fr)_90px_100px_110px] gap-3 border-b border-gray-800 px-4 py-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-200">
                        {supplier.name}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-600">
                        {supplier.criticalCount} critical ·{" "}
                        {formatCurrency(supplier.value)} current value
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {supplier.partCount}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        supplier.atRiskCount > 0
                          ? "text-orange-300"
                          : "text-emerald-300"
                      }`}
                    >
                      {supplier.atRiskCount}
                    </span>
                    <span
                      className={`text-xs ${
                        supplier.averageLead >= 14
                          ? "font-semibold text-orange-300"
                          : "text-slate-400"
                      }`}
                    >
                      {supplier.averageLead} days
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <SectionHeading
                eyebrow="Stock-gap priority"
                title="Units required to restore target cover"
                description="The largest equipment-specific gaps, weighted by current failure exposure."
              />
              <div className="mt-5 space-y-4">
                {rankedParts
                  .filter((part) => part.gap > 0)
                  .slice(0, 6)
                  .map((part) => {
                    const maxGap = Math.max(
                      ...rankedParts.map((candidate) => candidate.gap),
                      1,
                    );
                    const width = Math.max(
                      8,
                      Math.round((part.gap / maxGap) * 100),
                    );

                    return (
                      <div key={part.partNumber}>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate text-slate-300">
                            {part.name}
                          </span>
                          <span className="font-semibold text-slate-100">
                            {part.gap}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-800">
                          <div
                            className={`h-full rounded-full ${
                              part.exposureBand === "Critical"
                                ? "bg-red-500/80"
                                : part.exposureBand === "High"
                                  ? "bg-orange-500/80"
                                  : "bg-yellow-500/80"
                            }`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}

                {rankedParts.every((part) => part.gap === 0) ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-xs text-emerald-300">
                    All linked parts meet their equipment-specific target
                    holdings.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <SectionHeading
              eyebrow="Read-only intelligence actions"
              title="Continue the equipment investigation"
              description="Vorta links the relevant SAP records, BOM evidence and maintenance context without creating or changing transactions."
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "View waiting-parts work",
                  description: "Open linked work orders and statuses",
                  Icon: Wrench,
                  onClick: () =>
                    navigate(`/equipment/${eq.id}/work-orders`),
                },
                {
                  label: "Search BOM documents",
                  description: "Find manuals, drawings and part references",
                  Icon: FileSearch,
                  onClick: () =>
                    navigate(`/equipment/${eq.id}/documents`),
                },
                {
                  label: "Review source imports",
                  description: "Open IH01 and MB52 import history",
                  Icon: Database,
                  onClick: () => navigate("/settings/data-import"),
                },
                {
                  label: "Export spares intelligence",
                  description: "Download the current ranked inventory",
                  Icon: Download,
                  onClick: exportInventory,
                },
              ].map(({ label, description, Icon, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#0d1219] p-3 text-left transition-colors hover:border-blue-500/30 hover:bg-[#101722]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <Icon className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200">
                      {label}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-4 text-slate-600">
                      {description}
                    </p>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-700" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2 border-t border-gray-800 py-3 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Read-only data from SAP IH01, MB52 and the equipment BOM. Last
            refreshed {lastUpdatedLabel}.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5" />
            {rankedParts.length} linked parts · {criticalParts.length} critical
            or high
          </span>
        </div>
      </div>
    </section>
  );
};
