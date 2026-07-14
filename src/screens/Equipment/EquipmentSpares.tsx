import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  Download,
  Edit,
  RefreshCw,
  UserCircle,
  Package,
  ShoppingCart,
  BookmarkPlus,
  Layers,
  Printer,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

import { EquipmentBase, DEFAULT_EQUIPMENT_ID } from "./equipmentData";
import { getEquipmentIdentityById, getCachedEquipmentIdentity, getEquipmentComponents, EquipmentComponentsResult } from "./equipmentService";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";
import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";

// ─── Tabs ─────────────────────────────────────────────────────────────────────

// ─── Static actions ────────────────────────────────────────────────────────────




const QUICK_ACTIONS = [
  { Icon: Package,      label: "Request Spare"           },
  { Icon: ShoppingCart, label: "Create Purchase Request" },
  { Icon: BookmarkPlus, label: "Reserve Spare"           },
  { Icon: Layers,       label: "View Inventory"          },
  { Icon: Printer,      label: "Print Stock Report"      },
];

// ─── Donut chart ──────────────────────────────────────────────────────────────

function StockDonut({ ok, low, out }: { ok: number; low: number; out: number }) {
  const size = 110; const sw = 14;
  const r = (size - sw) / 2; const circ = 2 * Math.PI * r;
  const total = ok + low + out || 1;
  const pct = Math.round((ok / total) * 100);
  const segs = [
    { value: ok,  color: "#10b981" },
    { value: low, color: "#eab308" },
    { value: out, color: "#ef4444" },
  ];
  let offset = 0;
  const arcs = segs.map((s) => {
    const len = (s.value / total) * circ;
    const a = { offset, len, color: s.color };
    offset += len + 2;
    return a;
  });
  const cx = size / 2; const cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2433" strokeWidth={sw} />
      {arcs.map((a, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={a.color} strokeWidth={sw}
          strokeDasharray={`${Math.max(0, a.len - 2)} ${circ}`}
          strokeDashoffset={-a.offset}
          transform={`rotate(-90 ${cx} ${cy})`} />
      ))}
      <text x="50%" y="46%" dominantBaseline="middle" textAnchor="middle"
        fill="white" fontSize="18" fontWeight="700">{pct}%</text>
      <text x="50%" y="62%" dominantBaseline="middle" textAnchor="middle"
        fill="#94a3b8" fontSize="8.5"></text>
    </svg>
  );
}

function statusBadgeClass(s: string) {
  if (s === "Out of Stock") return "bg-[#ef444420] text-red-400";
  if (s === "Low Stock")    return "bg-[#eab30820] text-yellow-400";
  return "bg-[#10b98120] text-emerald-400";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const EquipmentSpares = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [eq, setEq] = useState<EquipmentBase | null>(() => getCachedEquipmentIdentity(resolvedId));
  const [components, setComponents] = useState<EquipmentComponentsResult>({
    inventory: [],
    criticalComponents: [],
    stockSummary: { totalComponents: 0, outOfStock: 0, lowStock: 0, okStock: 0 },
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoadedComponents, setHasLoadedComponents] = useState(false);

  const loadEquipmentSpares = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const [identity, componentResult] = await Promise.all([
        getEquipmentIdentityById(resolvedId),
        getEquipmentComponents(resolvedId),
      ]);
      setEq(identity);
      setComponents(componentResult);
      setHasLoadedComponents(true);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to load equipment spares", error);
      setLoadError("Unable to refresh spares data. Showing the latest available data.");
      setHasLoadedComponents(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [resolvedId]);
  useEffect(() => {
    loadEquipmentSpares();
  }, [loadEquipmentSpares]);

  const inventoryValue = useMemo(
    () => components.inventory.reduce((total, item) => total + item.stock * (item.unitCost ?? 0), 0),
    [components.inventory]
  );

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return "Loading latest data";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(lastUpdated);
  }, [lastUpdated]);

  const preferredSuppliers = useMemo(() => {
    const supplierMap = new Map<
      string,
      {
        name: string;
        componentCount: number;
        criticalCount: number;
        leadDays: number[];
      }
    >();

    for (const item of components.inventory) {
      const supplier = item.supplier.trim();
      if (!supplier) continue;

      const existing = supplierMap.get(supplier) ?? {
        name: supplier,
        componentCount: 0,
        criticalCount: 0,
        leadDays: [],
      };

      existing.componentCount += 1;

      const criticality = item.criticality.toLowerCase();
      if (criticality === "high" || criticality === "critical") {
        existing.criticalCount += 1;
      }

      if (item.leadDays > 0) {
        existing.leadDays.push(item.leadDays);
      }

      supplierMap.set(supplier, existing);
    }

    return Array.from(supplierMap.values())
      .map((supplier) => {
        const averageLeadDays =
          supplier.leadDays.length > 0
            ? Math.round(
                supplier.leadDays.reduce((total, days) => total + days, 0) /
                  supplier.leadDays.length
              )
            : null;

        const linkedPartsLabel =
          supplier.componentCount === 1 ? "1 linked part" : `${supplier.componentCount} linked parts`;

        const leadLabel =
          averageLeadDays !== null
            ? `Avg lead ${averageLeadDays} day${averageLeadDays === 1 ? "" : "s"}`
            : "Lead time not set";

        const criticalLabel =
          supplier.criticalCount > 0
            ? ` · ${supplier.criticalCount} critical`
            : "";

        return {
          name: supplier.name,
          componentCount: supplier.componentCount,
          criticalCount: supplier.criticalCount,
          meta: `${linkedPartsLabel} · ${leadLabel}${criticalLabel}`,
        };
      })
      .sort((a, b) => {
        if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;
        if (b.componentCount !== a.componentCount) return b.componentCount - a.componentCount;
        return a.name.localeCompare(b.name);
      });
  }, [components.inventory]);

  const upcomingRequirements = useMemo(() => {
    return components.inventory
      .filter((item) => item.stock <= item.max)
      .map((item) => {
        const isOutOfStock = item.stock === 0 || item.status === "Out of Stock";
        const isLowStock = item.status === "Low Stock" || item.stock < item.max;

        return {
          name: item.name,
          when: isOutOfStock ? "Order Now" : isLowStock ? "Reorder Soon" : "Monitor",
          urgentClass: isOutOfStock
            ? "bg-red-500/20 text-red-400"
            : isLowStock
              ? "bg-orange-500/20 text-orange-400"
              : "bg-yellow-500/20 text-yellow-400",
          stock: item.stock,
          max: item.max,
        };
      })
      .sort((a, b) => {
        if (a.stock !== b.stock) return a.stock - b.stock;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 3);
  }, [components.inventory]);

  const usageBars = useMemo(() => {
    const stockGapRows = components.inventory
      .map((item) => {
        const target = Math.max(item.max, 0);
        const stock = Math.max(item.stock, 0);
        const gap = Math.max(target - stock, 0);

        return {
          label: item.name,
          count: gap,
          pct: target > 0 ? Math.round((gap / target) * 100) : 0,
        };
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 5);

    const maxGap = Math.max(...stockGapRows.map((item) => item.count), 1);

    return stockGapRows.map((item) => ({
      ...item,
      pct: Math.max(8, Math.round((item.count / maxGap) * 100)),
    }));
  }, [components.inventory]);

  const recentStockIssues = useMemo(() => {
    return components.inventory
      .filter((item) => item.stock === 0 || item.status === "Out of Stock" || item.status === "Low Stock" || item.stock < item.max)
      .map((item) => {
        const isOutOfStock = item.stock === 0 || item.status === "Out of Stock";
        const isLowStock = item.status === "Low Stock" || item.stock < item.max;

        return {
          text: isOutOfStock
            ? `${item.name} is out of stock`
            : isLowStock
              ? `${item.name} below target stock`
              : `${item.name} requires stock review`,
          when: item.location ? `Stores: ${item.location}` : "Stores location not set",
          dotColor: isOutOfStock
            ? "bg-red-400"
            : isLowStock
              ? "bg-orange-400"
              : "bg-slate-400",
          severityRank: isOutOfStock ? 0 : isLowStock ? 1 : 2,
          stock: item.stock,
          max: item.max,
        };
      })
      .sort((a, b) => {
        if (a.severityRank !== b.severityRank) return a.severityRank - b.severityRank;
        if (a.stock !== b.stock) return a.stock - b.stock;
        return a.text.localeCompare(b.text);
      })
      .slice(0, 5);
  }, [components.inventory]);

  if (!eq) {
    return (
      <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
        <div className="border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
          <div className="h-28 animate-pulse rounded-xl bg-[#141820]" />
        </div>
      </section>
    );
  }

  const riskBadgeClass =
    eq.riskLevel === "Critical" ? "bg-[#ef444420] text-red-400" :
    eq.riskLevel === "High"     ? "bg-[#f9731620] text-orange-400" :
    "bg-[#10b98120] text-emerald-400";

  const riskTotal = eq.riskBreakdown.reduce((s, b) => s + b.pct, 0) || 1;

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
      {loadError && (
        <div className="mx-4 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 md:mx-6">
          {loadError}
        </div>
      )}

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-1.5 text-sm text-slate-500">
            <button type="button" onClick={() => navigate("/equipment")} className="transition-colors hover:text-slate-300">
              Equipment
            </button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-300">{eq.name} ({eq.assetNumber})</span>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline"
              className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100">
              <Edit className="h-3.5 w-3.5" /> Edit Equipment
            </Button>
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
              <UserCircle className="h-7 w-7" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">
            <img src={eq.image} alt={eq.name} className="h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">{eq.name}</h1>
              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}>
                {eq.riskLevel} Risk
              </Badge>
            </div>
            <div className="flex items-center gap-2">
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
              <span>Serial Number: <span className="text-slate-300">{eq.serialNumber}</span></span>
              <span>Install Date: <span className="text-slate-300">{eq.installDate}</span></span>
              <span>Warranty: <span className="text-orange-400">{eq.warranty}</span></span>
              <span>Criticality: <span className="text-slate-300">{eq.criticality}</span></span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 lg:w-52">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Score</span>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-slate-50">{eq.riskScore}%</span>
              <Badge className={`mb-1 inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}>
                {eq.riskLevel}
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500">Risk Drivers</span>
              <div className="flex h-2 overflow-hidden rounded-full">
                {eq.riskBreakdown.map((b) => (
                  <div key={b.label} style={{ width: `${(b.pct / riskTotal) * 100}%`, backgroundColor: b.color }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {eq.riskBreakdown.map((b) => (
                  <span key={b.label} className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${b.dotClass}`} />
                    {b.label} {b.pct}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <EquipmentTabNavigation equipmentId={eq.id} activeTab="spares" />
      </div>

      {/* ── Page Content ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">

        {/* Page title + actions */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-50">Spares</h2>
            <p className="text-xs text-slate-500">Spare parts inventory, stock health and upcoming requirements for this equipment.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline"
              className="h-auto gap-1.5 border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100 shadow-none">
              Request Spare
            </Button>
            <Button type="button" variant="outline"
              className="h-auto gap-1.5 border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100 shadow-none">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </div>

        {/* ── KPI Row ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {[
            { label: "Total Spares",     value: String(components.stockSummary.totalComponents), sub: "Active Parts",        valueClass: "text-slate-50" },
            { label: "Critical Spares",  value: String(components.stockSummary.lowStock),        sub: "Low Stock",           valueClass: "text-orange-400" },
            { label: "Out of Stock",     value: String(components.stockSummary.outOfStock),       sub: "Requires Action",     valueClass: "text-red-400" },
            { label: "Inventory Value",  value: new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(inventoryValue),  sub: "Current Stock Value", valueClass: "text-slate-50" },
            { label: "30 Day Usage",     value: "£7,920",   sub: "↑18% vs previous month", valueClass: "text-emerald-400" },
          ].map((kpi) => (
            <Card key={kpi.label} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
                <p className={`text-2xl font-bold ${kpi.valueClass}`}>{kpi.value}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{kpi.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Summary Row: Stock Availability | Critical Spares | AI Rec ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Stock Availability */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Stock Availability</h3>
              <div className="flex items-center gap-4">
                <StockDonut
                  ok={components.stockSummary.okStock}
                  low={components.stockSummary.lowStock}
                  out={components.stockSummary.outOfStock}
                />
                <div className="flex flex-col gap-1.5">
                  {[
                    { label: "Available",    count: components.stockSummary.okStock,  color: "#10b981" },
                    { label: "Low Stock",    count: components.stockSummary.lowStock, color: "#eab308" },
                    { label: "Out of Stock", count: components.stockSummary.outOfStock, color: "#ef4444" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="text-[11px] text-slate-400">{l.label}</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-200">{l.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View Critical Spares →
              </button>
            </CardContent>
          </Card>

          {/* Critical Spares Requiring Attention */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Critical Spares Requiring Attention</h3>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {components.criticalComponents.map((s) => (
                  <div key={s.name} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-800">
                        <Package className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <span className="text-xs text-slate-200">{s.name}</span>
                    </div>
                    <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold shadow-none ${statusBadgeClass(s.status)}`}>
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View All Critical Spares →
              </button>
            </CardContent>
          </Card>

          {/* AI Spare Recommendation */}
          <Card className="rounded-xl border border-blue-500/20 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-200">AI Spare Recommendation</h3>
              </div>
              <div className="mb-3 flex flex-col gap-2">
                {[
                  "Increase Encoder stock to 3",
                  "Increase Drive Belt stock to 4",
                ].map((rec) => (
                  <div key={rec} className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    <span className="text-[11px] text-slate-300">{rec}</span>
                  </div>
                ))}
              </div>
              <div className="mb-3 flex gap-4 rounded-lg bg-gray-800/60 p-2.5">
                <div>
                  <p className="text-[10px] text-slate-500">Est. downtime reduction</p>
                  <p className="text-base font-bold text-emerald-400">23%</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Confidence</p>
                  <p className="text-base font-bold text-blue-400">91%</p>
                </div>
              </div>
              <button type="button"
                className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 transition-colors">
                Review Recommendations
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Main Inventory Row ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">

          {/* Spares Inventory Summary */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Spares Inventory Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {["Part", "Stock", "Status"].map((h) => (
                        <th key={h} className="py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:pl-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!hasLoadedComponents ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-[11px] text-slate-500">
                          Loading spares inventory...
                        </td>
                      </tr>
                    ) : components.inventory.length > 0 ? (
                      components.inventory.map((row, i) => (
                        <tr key={row.partNumber} className={i !== components.inventory.length - 1 ? "border-b border-gray-800" : ""}>
                          <td className="py-3 pr-3">
                            <p className="font-semibold text-slate-200">{row.name}</p>
                            <p className="font-mono text-[10px] text-slate-500">{row.partNumber}</p>
                          </td>
                          <td className="py-3 pr-3">
                            <span className={`font-bold ${row.stock === 0 ? "text-red-400" : row.stock < row.max ? "text-yellow-400" : "text-slate-200"}`}>
                              {row.stock}
                            </span>
                            <span className="text-slate-500"> / {row.max}</span>
                          </td>
                          <td className="py-3">
                            <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold shadow-none ${statusBadgeClass(row.status)}`}>
                              {row.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-[11px] text-slate-500">
                          No spares linked to this equipment yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                <span>
                  {hasLoadedComponents
                    ? `Showing ${components.inventory.length} part${components.inventory.length !== 1 ? "s" : ""}.`
                    : "Loading linked parts..."}
                </span>
                <button type="button" className="text-blue-400 hover:text-blue-300 transition-colors">
                  View Full Inventory →
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Spare Usage */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-1 text-sm font-semibold text-slate-200">Stock Gap Priority</h3>
              <p className="mb-4 text-[11px] text-slate-500">Top stock gaps against target holding</p>
              <div className="flex flex-col gap-3">
                {!hasLoadedComponents ? (
                  <p className="text-[11px] text-slate-500">
                    Loading stock gaps...
                  </p>
                ) : usageBars.length > 0 ? (
                  usageBars.map((bar) => (
                    <div key={bar.label} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 truncate text-[11px] text-slate-300">{bar.label}</span>
                      <div className="flex-1 h-2 overflow-hidden rounded-full bg-gray-800">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${bar.pct}%` }} />
                      </div>
                      <span className="w-4 shrink-0 text-right text-[11px] font-bold text-slate-200">{bar.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-slate-500">
                    No stock gaps against target holding.
                  </p>
                )}
              </div>
              <button type="button" className="mt-4 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View Stock Gap Report →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Lower Row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Upcoming Spare Requirements */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Upcoming Spare Requirements</h3>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {!hasLoadedComponents ? (
                  <p className="py-3 text-[11px] text-slate-500">
                    Loading spare requirements...
                  </p>
                ) : upcomingRequirements.length > 0 ? (
                  upcomingRequirements.map((r) => (
                    <div key={r.name} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-800">
                          <Package className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-slate-200">{r.name}</span>
                          <span className="text-[10px] text-slate-500">Stock {r.stock} / {r.max}</span>
                        </div>
                      </div>
                      <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-semibold shadow-none ${r.urgentClass}`}>
                        {r.when}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="py-3 text-[11px] text-slate-500">
                    No upcoming spare requirements for this equipment.
                  </p>
                )}
              </div>
              <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View Requirements →
              </button>
            </CardContent>
          </Card>

          {/* Preferred Suppliers */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Preferred Suppliers</h3>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {!hasLoadedComponents ? (
                  <p className="py-3 text-[11px] text-slate-500">
                    Loading preferred suppliers...
                  </p>
                ) : preferredSuppliers.length > 0 ? (
                  preferredSuppliers.map((supplier) => (
                    <div key={supplier.name} className="flex flex-col gap-0.5 py-3">
                      <span className="text-xs font-semibold text-slate-200">{supplier.name}</span>
                      <span className="text-[10px] text-slate-500">{supplier.meta}</span>
                    </div>
                  ))
                ) : (
                  <p className="py-3 text-[11px] text-slate-500">
                    No preferred suppliers linked to this equipment yet.
                  </p>
                )}
              </div>
              <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Manage Suppliers →
              </button>
            </CardContent>
          </Card>

          {/* Recent Spare Issues */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Recent Spare Issues</h3>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {!hasLoadedComponents ? (
                  <p className="py-3 text-[11px] text-slate-500">
                    Loading stock issues...
                  </p>
                ) : recentStockIssues.length > 0 ? (
                  recentStockIssues.map((item) => (
                    <div key={item.text} className="flex items-start gap-2.5 py-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.dotColor}`} />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-medium text-slate-200">{item.text}</span>
                        <span className="text-[10px] text-slate-500">
                          {item.when} · Stock {item.stock} / {item.max}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-3 text-[11px] text-slate-500">
                    No recent spare stock issues for this equipment.
                  </p>
                )}
              </div>
              <button type="button" className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View Stock Issue History →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Quick Actions ─────────────────────────────────────────────────── */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Quick Actions</h3>
            <div className="flex flex-col gap-2">
              {QUICK_ACTIONS.map(({ Icon, label }) => (
                <button key={label} type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-gray-800 bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-[#1a2030]">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-800">
                    <Icon className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <span className="flex-1 text-xs font-medium text-slate-300">{label}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-gray-800 py-3 text-xs text-slate-500">
          <span>All data is synced from Vorta Network and SAP PM. Last updated: {lastUpdatedLabel}</span>
          <button
            type="button"
            aria-label="Refresh spares data"
            onClick={loadEquipmentSpares}
            disabled={isRefreshing}
            className="text-slate-600 transition-colors hover:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </section>
  );
};
