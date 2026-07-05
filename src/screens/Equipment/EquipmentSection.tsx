import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Info, RefreshCw, Search, UserCircle } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskSegment {
  label: string;
  pct: number;
  color: string;
  dotClass: string;
}

interface EquipmentItem {
  id: string;
  name: string;
  assetNumber: string;
  type: string;
  area: string;
  riskScore: number;
  riskLevel: "Critical" | "High" | "Medium" | "Low" | "Minimal";
  breakdown: RiskSegment[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const ALL_EQUIPMENT: EquipmentItem[] = [
  // Building 2 equipment
  {
    id: "fl-03",
    name: "Filling Line 3",
    assetNumber: "FL-03",
    type: "FILLING LINE",
    area: "Building 2",
    riskScore: 92,
    riskLevel: "Critical",
    breakdown: [
      { label: "Breakdowns", pct: 40, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "PMs",        pct: 25, color: "#f97316", dotClass: "bg-orange-500" },
      { label: "Skills",     pct: 15, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",     pct: 10, color: "#6366f1", dotClass: "bg-indigo-500" },
      { label: "Criticality",pct: 10, color: "#6b7280", dotClass: "bg-slate-500" },
    ],
  },
  {
    id: "pl-02",
    name: "Palletiser 2",
    assetNumber: "PL-02",
    type: "PALLETISER",
    area: "Building 2",
    riskScore: 71,
    riskLevel: "High",
    breakdown: [
      { label: "High",       pct: 71, color: "#f97316", dotClass: "bg-orange-400" },
      { label: "Critical",   pct: 24, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "Skills",     pct: 16, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",     pct: 8,  color: "#6366f1", dotClass: "bg-indigo-500" },
      { label: "Criticality",pct: 8,  color: "#6b7280", dotClass: "bg-slate-500" },
    ],
  },
  {
    id: "cv-04",
    name: "Conveyor 4",
    assetNumber: "CV-04",
    type: "CONVEYOR",
    area: "Building 2",
    riskScore: 58,
    riskLevel: "Medium",
    breakdown: [
      { label: "Medium",     pct: 58, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Critical",   pct: 21, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "Skills",     pct: 10, color: "#84cc16", dotClass: "bg-lime-500" },
      { label: "Spares",     pct: 8,  color: "#6366f1", dotClass: "bg-indigo-500" },
      { label: "Criticality",pct: 3,  color: "#6b7280", dotClass: "bg-slate-500" },
    ],
  },
  {
    id: "ac-01",
    name: "Air Compressor 1",
    assetNumber: "AC-01",
    type: "COMPRESSOR",
    area: "Building 2",
    riskScore: 33,
    riskLevel: "Low",
    breakdown: [
      { label: "Low",        pct: 33, color: "#84cc16", dotClass: "bg-lime-500" },
      { label: "Critical",   pct: 11, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "Skills",     pct: 10, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",     pct: 8,  color: "#6366f1", dotClass: "bg-indigo-500" },
      { label: "Criticality",pct: 8,  color: "#6b7280", dotClass: "bg-slate-500" },
    ],
  },
  {
    id: "lt-01",
    name: "Lighting System",
    assetNumber: "LT-01",
    type: "FACILITIES",
    area: "Building 2",
    riskScore: 12,
    riskLevel: "Minimal",
    breakdown: [
      { label: "Minimal",    pct: 12, color: "#10b981", dotClass: "bg-emerald-500" },
      { label: "Critical",   pct: 5,  color: "#ef4444", dotClass: "bg-red-500" },
      { label: "Skills",     pct: 4,  color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",     pct: 3,  color: "#6366f1", dotClass: "bg-indigo-500" },
      { label: "Criticality",pct: 2,  color: "#6b7280", dotClass: "bg-slate-500" },
    ],
  },
  // Other areas
  {
    id: "cp-04",
    name: "Case Packer 4",
    assetNumber: "CP-04",
    type: "PACKING",
    area: "Packing",
    riskScore: 88,
    riskLevel: "Critical",
    breakdown: [
      { label: "Breakdowns", pct: 45, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "PMs",        pct: 22, color: "#f97316", dotClass: "bg-orange-500" },
      { label: "Skills",     pct: 18, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",     pct: 9,  color: "#6366f1", dotClass: "bg-indigo-500" },
      { label: "Criticality",pct: 6,  color: "#6b7280", dotClass: "bg-slate-500" },
    ],
  },
  {
    id: "bl-01",
    name: "Boiler 1",
    assetNumber: "BL-01",
    type: "UTILITIES",
    area: "Utilities",
    riskScore: 74,
    riskLevel: "High",
    breakdown: [
      { label: "High",       pct: 38, color: "#f97316", dotClass: "bg-orange-400" },
      { label: "Critical",   pct: 20, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "Skills",     pct: 16, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",     pct: 12, color: "#6366f1", dotClass: "bg-indigo-500" },
      { label: "Criticality",pct: 8,  color: "#6b7280", dotClass: "bg-slate-500" },
    ],
  },
  {
    id: "l2-plc",
    name: "Line 2 PLC",
    assetNumber: "L2-PLC",
    type: "AUTOMATION",
    area: "Packing",
    riskScore: 68,
    riskLevel: "High",
    breakdown: [
      { label: "High",       pct: 35, color: "#f97316", dotClass: "bg-orange-400" },
      { label: "Critical",   pct: 18, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "Skills",     pct: 15, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",     pct: 10, color: "#6366f1", dotClass: "bg-indigo-500" },
      { label: "Criticality",pct: 7,  color: "#6b7280", dotClass: "bg-slate-500" },
    ],
  },
  {
    id: "pm-01",
    name: "Press Line Motor",
    assetNumber: "PM-01",
    type: "PROCESSING",
    area: "Processing",
    riskScore: 52,
    riskLevel: "Medium",
    breakdown: [
      { label: "Medium",     pct: 30, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Critical",   pct: 14, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "Skills",     pct: 12, color: "#84cc16", dotClass: "bg-lime-500" },
      { label: "Spares",     pct: 8,  color: "#6366f1", dotClass: "bg-indigo-500" },
      { label: "Criticality",pct: 4,  color: "#6b7280", dotClass: "bg-slate-500" },
    ],
  },
  {
    id: "wf-03",
    name: "Warehouse Forklift 3",
    assetNumber: "WF-03",
    type: "WAREHOUSE",
    area: "Warehouse",
    riskScore: 28,
    riskLevel: "Low",
    breakdown: [
      { label: "Low",        pct: 28, color: "#84cc16", dotClass: "bg-lime-500" },
      { label: "Critical",   pct: 8,  color: "#ef4444", dotClass: "bg-red-500" },
      { label: "Skills",     pct: 6,  color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",     pct: 5,  color: "#6366f1", dotClass: "bg-indigo-500" },
      { label: "Criticality",pct: 3,  color: "#6b7280", dotClass: "bg-slate-500" },
    ],
  },
];

const TOP_RISK = [
  { name: "Case Packer 4",       level: "Critical", badgeClass: "bg-[#ef444420] text-red-500" },
  { name: "Boiler 1",            level: "High",     badgeClass: "bg-[#f9731620] text-orange-400" },
  { name: "Line 2 PLC",          level: "High",     badgeClass: "bg-[#f9731620] text-orange-400" },
  { name: "Press Line Motor",    level: "Medium",   badgeClass: "bg-[#eab30820] text-yellow-400" },
  { name: "Warehouse Forklift 3",level: "Low",      badgeClass: "bg-[#10b98120] text-emerald-500" },
];

const RECENT_ACTIVITY = [
  { text: "PM completed on Case Packer 3",    dotClass: "bg-emerald-500" },
  { text: "Fault detected on Line 2 PLC",     dotClass: "bg-red-500" },
  { text: "Work order raised for Boiler 1",   dotClass: "bg-yellow-400" },
  { text: "Downtime logged on Press Line",    dotClass: "bg-orange-400" },
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
  { label: "0-20% Minimal",   dotClass: "bg-emerald-500" },
  { label: "21-40% Low",      dotClass: "bg-lime-500" },
  { label: "41-60% Medium",   dotClass: "bg-yellow-400" },
  { label: "61-80% High",     dotClass: "bg-orange-400" },
  { label: "81-100% Critical",dotClass: "bg-red-500" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskScoreClasses(level: EquipmentItem["riskLevel"]): { text: string; badge: string } {
  switch (level) {
    case "Critical": return { text: "text-slate-50",    badge: "bg-[#ef444420] text-red-500" };
    case "High":     return { text: "text-slate-50",    badge: "bg-[#f9731620] text-orange-400" };
    case "Medium":   return { text: "text-slate-50",    badge: "bg-[#eab30820] text-yellow-400" };
    case "Low":      return { text: "text-slate-50",    badge: "bg-[#84cc1620] text-lime-500" };
    default:         return { text: "text-slate-50",    badge: "bg-[#10b98120] text-emerald-500" };
  }
}

// ─── Risk Breakdown Bar ───────────────────────────────────────────────────────

function RiskBreakdownBar({ segments }: { segments: RiskSegment[] }) {
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
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 whitespace-nowrap">{label}</span>
          {badgeLabel && (
            <Badge className={`h-auto rounded px-1.5 py-0 text-[10px] font-semibold shadow-none ${badgeClass}`}>
              {badgeLabel}
            </Badge>
          )}
        </div>
        <p className="text-xl font-semibold text-slate-50">{value}</p>
        {showBar && (
          <Progress
            value={barValue ?? 0}
            className="mt-1 h-1.5 rounded bg-gray-800 [&>div]:bg-emerald-500"
          />
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

  const buildingParam = searchParams.get("building");
  const [search, setSearch] = useState("");
  const [activeArea, setActiveArea] = useState<string | null>(buildingParam);
  const [activeChip, setActiveChip] = useState<string | null>(buildingParam ? "Area" : null);

  const filtered = useMemo(() => {
    const items = [...ALL_EQUIPMENT].sort((a, b) => b.riskScore - a.riskScore);
    return items.filter((e) => {
      if (activeArea && e.area !== activeArea) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !e.assetNumber.toLowerCase().includes(q) && !e.area.toLowerCase().includes(q) && !e.type.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [activeArea, search]);

  const totalAssets   = ALL_EQUIPMENT.length;
  const criticalCount = ALL_EQUIPMENT.filter((e) => e.riskLevel === "Critical").length;
  const atRisk        = ALL_EQUIPMENT.filter((e) => e.riskLevel === "Critical" || e.riskLevel === "High").length;
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
        setActiveArea(buildingParam);
      }
    } else {
      setActiveChip(activeChip === chip ? null : chip);
    }
  };

  const handleRowClick = (item: EquipmentItem) => {
    navigate(`/equipment/${item.id}/overview`);
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
              {chip}
              {chip === "Area" && activeArea ? `: ${activeArea}` : ""}
            </button>
          );
        })}
        {(activeArea || search) && (
          <button
            type="button"
            onClick={() => { setActiveArea(null); setActiveChip(null); setSearch(""); }}
            className="rounded-full border border-gray-700 bg-[#141820] px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Equipment Table ─────────────────────────────────────────────── */}
      <div className="w-full rounded-xl border border-gray-800 bg-[#141820] overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_120px] items-center gap-4 border-b border-gray-800 px-5 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Equipment</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Risk Breakdown</span>
            <Info className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
          </div>
          <span className="text-right text-[11px] font-semibold uppercase tracking-widest text-slate-500">Risk Score</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No equipment found.</div>
        ) : (
          filtered.map((item, index) => {
            const { badge } = riskScoreClasses(item.riskLevel);
            const isSelected = equipmentId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => handleRowClick(item)}
                className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_minmax(0,2fr)_120px] items-center gap-4 px-5 py-4 transition-colors hover:bg-[#1a2030] ${
                  index !== filtered.length - 1 ? "border-b border-gray-800" : ""
                } ${isSelected ? "bg-[#1a2030]" : ""}`}
              >
                {/* Equipment info */}
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 shrink-0 flex items-center justify-center text-slate-600">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M4 5l2 2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <span className="truncate text-sm font-semibold text-slate-50">{item.name}</span>
                  </div>
                  <span className="pl-6 text-xs text-slate-500">{item.assetNumber}</span>
                  <span className="ml-6 mt-0.5 inline-flex w-fit rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-400">
                    {item.type}
                  </span>
                </div>

                {/* Risk breakdown bar */}
                <RiskBreakdownBar segments={item.breakdown} />

                {/* Risk score */}
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-2xl font-bold text-slate-50">{item.riskScore}%</span>
                  <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-semibold uppercase shadow-none ${badge}`}>
                    {item.riskLevel}
                  </Badge>
                </div>
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
              {TOP_RISK.map((item, i) => (
                <li key={item.name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0 text-xs text-slate-500 w-4">{i + 1}.</span>
                    <span className="truncate text-sm text-slate-200">{item.name}</span>
                  </div>
                  <Badge className={`shrink-0 h-auto rounded px-2 py-0.5 text-[10px] font-semibold uppercase shadow-none ${item.badgeClass}`}>
                    {item.level}
                  </Badge>
                </li>
              ))}
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
