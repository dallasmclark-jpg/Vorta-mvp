import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  Search,
  UserCircle,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

import { getEquipmentList, resolveBuilding } from "./equipmentService";
import type { EquipmentListItem } from "./equipmentService";

// ─── Local display-only constants ────────────────────────────────────────────

const RECENT_ACTIVITY = [
  { text: "PM completed on Case Packer 3",  dotClass: "bg-emerald-500" },
  { text: "Fault detected on Line 2 PLC",   dotClass: "bg-red-500" },
  { text: "Work order raised for Boiler 1", dotClass: "bg-yellow-400" },
  { text: "Downtime logged on Press Line",  dotClass: "bg-orange-400" },
];

const AI_RECOMMENDATIONS = [
  {
    title: "Reallocate Sarah Jones to Case Packer 4.",
    badges: [
      { label: "CRITICAL", cls: "bg-[#ef444420] text-red-500" },
      { label: "HIGH",     cls: "bg-[#f9731620] text-orange-400" },
    ],
  },
  {
    title: "Arrange contractor check for Boiler 1.",
    badges: [
      { label: "REVIEW",   cls: "bg-[#facc1520] text-yellow-400" },
      { label: "HIGH",     cls: "bg-[#f9731620] text-orange-400" },
    ],
  },
  {
    title: "Train Liam on Siemens S7 before Press Line.",
    badges: [
      { label: "OPEN",     cls: "bg-[#10b98120] text-emerald-500" },
      { label: "MID",      cls: "bg-[#3b82f620] text-blue-400" },
      { label: "TRAINING", cls: "bg-[#a855f720] text-purple-400" },
    ],
  },
];

const FILTER_CHIPS = ["Area", "Risk", "Criticality", "Asset Type", "PM Status", "Engineer", "Calibration", "Training Status"];

const RISK_LEGEND = [
  { label: "0-20% Minimal",    dotClass: "bg-emerald-500" },
  { label: "21-40% Low",       dotClass: "bg-lime-500" },
  { label: "41-60% Medium",    dotClass: "bg-yellow-400" },
  { label: "61-80% High",      dotClass: "bg-orange-400" },
  { label: "81-100% Critical", dotClass: "bg-red-500" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskBadgeClass(level: EquipmentListItem["riskLevel"]): string {
  switch (level) {
    case "Critical": return "bg-[#ef444420] text-red-500";
    case "High":     return "bg-[#f9731620] text-orange-400";
    case "Medium":   return "bg-[#eab30820] text-yellow-400";
    case "Low":      return "bg-[#84cc1620] text-lime-500";
    default:         return "bg-[#10b98120] text-emerald-500";
  }
}

// ─── Risk Breakdown Bar ───────────────────────────────────────────────────────

function RiskBreakdownBar({ segments }: { segments: EquipmentListItem["breakdown"] }) {
  const total = segments.reduce((s, seg) => s + seg.pct, 0) || 1;
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{ width: `${(seg.pct / total) * 100}%`, backgroundColor: seg.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((seg) => (
          <span key={seg.label} className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${seg.dotClass}`} />
            {seg.label} {seg.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function RiskSparkline() {
  const pts = "0,40 20,36 40,30 60,24 80,28 100,20 120,14 140,18 160,10";
  return (
    <svg width="160" height="48" viewBox="0 0 160 48" fill="none" aria-hidden="true" className="w-full">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,48 ${pts} 160,48`} fill="url(#sparkGrad)" stroke="none" />
      <polyline
        points={pts}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="160" cy="10" r="3" fill="#3b82f6" />
    </svg>
  );
}

// ─── Expanded Panel ───────────────────────────────────────────────────────────

function ExpandedPanel({ item, onNavigate }: { item: EquipmentListItem; onNavigate: (id: string) => void }) {
  return (
    <div className="border-l-2 border-blue-500/50 bg-[#0b0f18] px-5 py-4">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">

        {/* 1 — Risk summary */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk summary</h4>
          <div className="flex flex-col gap-3">
            {item.breakdown.map((seg) => (
              <div key={seg.label} className="flex items-start gap-2">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${seg.dotClass}`} aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium leading-snug text-slate-200">{seg.label}</span>
                  <span className="text-xs text-slate-500">{seg.pct}% of risk score</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2 — Asset info */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asset info</h4>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-500">Asset number</span>
              <span className="text-sm font-semibold text-slate-200">{item.assetNumber}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-500">Type</span>
              <span className="text-sm font-semibold text-slate-200">{item.type}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-500">Area</span>
              <span className="text-sm font-semibold text-slate-200">{item.area}</span>
            </div>
          </div>
        </div>

        {/* 3 — AI risk trend */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI risk trend</h4>
          <RiskSparkline />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Risk Score</span>
              <span className="text-xs font-semibold text-slate-200">{item.riskScore}%</span>
            </div>
            <Progress
              value={item.riskScore}
              className="h-1.5 rounded bg-gray-800 [&>div]:bg-blue-500"
            />
          </div>
        </div>

        {/* 4 — Actions */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</h4>
          <p className="text-sm leading-relaxed text-slate-300">
            Open this equipment to view AI recommendations, work orders, PMs, and full asset details.
          </p>
          <div className="mt-auto flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => onNavigate(item.id)}
              className="h-auto w-full justify-start gap-2 bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Open Equipment →
            </Button>
            <button
              type="button"
              className="w-full rounded-md border border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-gray-800 hover:text-slate-100"
            >
              Assign Engineer
            </button>
            <button
              type="button"
              className="w-full rounded-md border border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-gray-800 hover:text-slate-100"
            >
              Create Work Order
            </button>
            <button
              type="button"
              className="w-full rounded-md border border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-gray-800 hover:text-slate-100"
            >
              View History
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, badgeLabel, badgeClass, showBar, barValue }: {
  label: string;
  value: string;
  badgeLabel?: string;
  badgeClass?: string;
  showBar?: boolean;
  barValue?: number;
}) {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex flex-col gap-1 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="whitespace-nowrap text-xs text-slate-400">{label}</span>
          {badgeLabel && (
            <Badge className={`h-auto rounded px-1.5 py-0 text-[10px] font-semibold shadow-none ${badgeClass}`}>
              {badgeLabel}
            </Badge>
          )}
        </div>
        <p className="text-xl font-semibold text-slate-50">{value}</p>
        {showBar && (
          <Progress value={barValue ?? 0} className="mt-1 h-1.5 rounded bg-gray-800 [&>div]:bg-emerald-500" />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const EquipmentSection = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [searchParams] = useSearchParams();

  const areaParam     = searchParams.get("area");
  const buildingParam = searchParams.get("building");
  const initialArea   = areaParam ?? buildingParam;

  const [search, setSearch] = useState("");
  const [activeArea, setActiveArea] = useState<string | null>(initialArea);
  const [activeChip, setActiveChip] = useState<string | null>(initialArea ? "Area" : null);
  const [expandedId, setExpandedId] = useState<string>("");
  const [equipmentList, setEquipmentList] = useState<EquipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // For the chip label: building codes resolve to a human label; plain area names display as-is
  const areaChipLabel = activeArea ? (resolveBuilding(activeArea)?.label ?? activeArea) : "";

  useEffect(() => {
    getEquipmentList()
      .then((items) => {
        setEquipmentList(items);
        if (items.length > 0) setExpandedId(items[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const items = [...equipmentList].sort((a, b) => b.riskScore - a.riskScore);
    return items.filter((e) => {
      if (activeArea) {
        const resolved = resolveBuilding(activeArea);
        if (resolved) {
          if (!resolved.areas.includes(e.area)) return false;
        } else {
          if (e.area !== activeArea) return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.name.toLowerCase().includes(q) &&
          !e.assetNumber.toLowerCase().includes(q) &&
          !e.area.toLowerCase().includes(q) &&
          !e.type.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [equipmentList, activeArea, search]);

  const totalAssets   = equipmentList.length;
  const criticalCount = equipmentList.filter((e) => e.riskLevel === "Critical").length;
  const atRisk        = equipmentList.filter((e) => e.riskLevel === "Critical" || e.riskLevel === "High").length;
  const overduePms    = 8;
  const openWorkOrders = 12;
  const avgHealth     = 82;
  const calDue        = 3;

  const handleChipClick = (chip: string) => {
    if (chip === "Area") {
      if (activeChip === "Area") {
        setActiveChip(null);
        setActiveArea(null);
      } else {
        setActiveChip("Area");
        setActiveArea(initialArea);
      }
    } else {
      setActiveChip(activeChip === chip ? null : chip);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedId((prev) => (prev === id ? "" : id));
  };

  const navigateToEquipment = (id: string) => {
    navigate(`/equipment/${id}/overview`);
  };

  return (
    <section className="flex w-full flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-4 md:px-6 xl:px-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">Equipment</h1>
          <p className="text-sm text-slate-400">
            Monitor asset health, operational risk and maintenance readiness across your site.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            className="h-auto border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-50 shadow-none hover:bg-white/15 hover:text-slate-50"
          >
            Run Full Site Analysis
          </Button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
            aria-label="User profile"
          >
            <UserCircle className="h-8 w-8" />
          </button>
        </div>
      </header>

      {/* ── KPI Bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Total Assets"         value={String(totalAssets)} />
        <KpiCard label="Critical Assets"      value={String(criticalCount)}  badgeLabel="CRITICAL" badgeClass="bg-[#ef444420] text-red-500" />
        <KpiCard label="Assets At Risk"       value={String(atRisk)}         badgeLabel="HIGH"     badgeClass="bg-[#f9731620] text-orange-400" />
        <KpiCard label="Overdue PMs"          value={String(overduePms)}     badgeLabel="CRITICAL" badgeClass="bg-[#ef444420] text-red-500" />
        <KpiCard label="Open Work Orders"     value={String(openWorkOrders)} />
        <KpiCard label="Average Asset Health" value={`${avgHealth}%`} showBar barValue={avgHealth} />
        <KpiCard label="Calibration Due"      value={String(calDue)} />
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search equipment, asset number, area, manufacturer or production line..."
          className="w-full rounded-xl border border-gray-800 bg-[#141820] py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
        />
      </div>

      {/* ── Filter Chips ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {FILTER_CHIPS.map((chip) => {
          const isActive = activeChip === chip || (chip === "Area" && activeArea !== null);
          return (
            <button
              key={chip}
              type="button"
              onClick={() => handleChipClick(chip)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                  : "border-gray-700 bg-[#141820] text-slate-400 hover:border-gray-600 hover:text-slate-200"
              }`}
            >
              {chip}{chip === "Area" && activeArea ? `: ${areaChipLabel}` : ""}
            </button>
          );
        })}
        {(activeArea || search) && (
          <button
            type="button"
            onClick={() => { setActiveArea(null); setActiveChip(null); setSearch(""); }}
            className="rounded-full border border-gray-700 bg-[#141820] px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Active area filter label ─────────────────────────────────── */}
      {activeArea && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>Showing area:</span>
          <span className="font-semibold text-slate-200">{areaChipLabel}</span>
          <button
            type="button"
            onClick={() => { setActiveArea(null); setActiveChip(null); navigate("/equipment"); }}
            className="ml-1 rounded border border-gray-700 px-2 py-0.5 text-xs text-slate-500 transition-colors hover:border-gray-600 hover:text-slate-300"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Equipment Table ─────────────────────────────────────────────── */}
      <div className="w-full overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">

        {/* Table header */}
        <div className="grid grid-cols-[40px_minmax(0,1fr)_minmax(0,2fr)_120px] items-center gap-4 border-b border-gray-800 px-4 py-3">
          <div />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Equipment</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Risk Drivers</span>
            <Info className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
          </div>
          <span className="text-right text-[11px] font-semibold uppercase tracking-widest text-slate-500">Risk Score</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 px-5 py-16 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
            Loading equipment...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No equipment found.</div>
        ) : (
          filtered.map((item, index) => {
            const isExpanded = expandedId === item.id;
            const isLast = index === filtered.length - 1;
            const badge = riskBadgeClass(item.riskLevel);
            return (
              <div key={item.id} className={!isLast || isExpanded ? "border-b border-gray-800" : ""}>

                {/* Row */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => toggleRow(item.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleRow(item.id); } }}
                  className={`grid cursor-pointer grid-cols-[40px_minmax(0,1fr)_minmax(0,2fr)_120px] items-center gap-4 px-4 py-4 transition-colors hover:bg-[#1a2030] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50 ${isExpanded ? "bg-[#141f2e]" : ""}`}
                >
                  <div className="flex items-center justify-center">
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-blue-400" />
                      : <ChevronDown className="h-4 w-4 text-slate-500" />
                    }
                  </div>

                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-semibold text-slate-50">{item.name}</span>
                    <span className="text-xs text-slate-500">{item.assetNumber}</span>
                    <span className="mt-0.5 inline-flex w-fit rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-400">
                      {item.type}
                    </span>
                  </div>

                  <RiskBreakdownBar segments={item.breakdown} />

                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-2xl font-bold text-slate-50">{item.riskScore}%</span>
                    <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-semibold uppercase shadow-none ${badge}`}>
                      {item.riskLevel}
                    </Badge>
                  </div>
                </div>

                {isExpanded && (
                  <ExpandedPanel item={item} onNavigate={navigateToEquipment} />
                )}
              </div>
            );
          })
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-800 px-5 py-3">
          {RISK_LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`h-2 w-2 rounded-full ${l.dotClass}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Bottom Panels ───────────────────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Top 10 Highest Risk */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-50">Top 10 Highest Risk Equipment</h2>
            <ol className="flex flex-col gap-3">
              {[...equipmentList]
                .sort((a, b) => b.riskScore - a.riskScore)
                .slice(0, 10)
                .map((item, i) => (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="w-4 shrink-0 text-xs text-slate-500">{i + 1}.</span>
                      <span className="truncate text-sm text-slate-200">{item.name}</span>
                    </div>
                    <Badge className={`h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase shadow-none ${riskBadgeClass(item.riskLevel)}`}>
                      {item.riskLevel}
                    </Badge>
                  </li>
                ))
              }
            </ol>
          </CardContent>
        </Card>

        {/* Recent Equipment Activity */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-50">Recent Equipment Activity</h2>
            <ul className="flex flex-col gap-3">
              {RECENT_ACTIVITY.map((item) => (
                <li key={item.text} className="flex items-start gap-2.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.dotClass}`} aria-hidden="true" />
                  <span className="text-sm text-slate-300">{item.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* AI Equipment Recommendations */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-50">AI Equipment Recommendations</h2>
            <div className="flex flex-col gap-4">
              {AI_RECOMMENDATIONS.map((rec) => (
                <div key={rec.title} className="flex flex-col gap-2">
                  <p className="text-sm font-medium leading-snug text-slate-200">{rec.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rec.badges.map((b) => (
                      <Badge key={b.label} className={`h-auto rounded px-2 py-0.5 text-[10px] font-semibold uppercase shadow-none ${b.cls}`}>
                        {b.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </section>
  );
};
