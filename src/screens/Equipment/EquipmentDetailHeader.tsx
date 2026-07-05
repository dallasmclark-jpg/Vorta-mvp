import { useNavigate } from "react-router-dom";
import { Bell, ChevronRight, Edit, UserCircle } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { EquipmentBase } from "./equipmentData";

const TABS = [
  { label: "Overview",           id: "overview" },
  { label: "Health",             id: "health" },
  { label: "Work Orders",        id: "wo",      badge: 12 },
  { label: "PMs",                id: "pm",      badge: 8 },
  { label: "History",            id: "history" },
  { label: "Skills & Engineers", id: "skills" },
  { label: "Spares",             id: "spares" },
  { label: "Documents",          id: "docs" },
  { label: "AI Insights",        id: "ai" },
];

interface Props {
  eq: EquipmentBase;
  activeTab: string;
  onTabClick: (tabId: string) => void;
}

export function EquipmentDetailHeader({ eq, activeTab, onTabClick }: Props): JSX.Element {
  const navigate = useNavigate();

  const riskBadgeClass =
    eq.riskLevel === "Critical" ? "bg-[#ef444420] text-red-400" :
    eq.riskLevel === "High"     ? "bg-[#f9731620] text-orange-400" :
    eq.riskLevel === "Medium"   ? "bg-[#eab30820] text-yellow-400" :
    "bg-[#10b98120] text-emerald-400";

  const statusDotClass =
    eq.status === "Running"  ? "bg-emerald-500" :
    eq.status === "At Risk"  ? "bg-orange-400" :
    eq.status === "Fault"    ? "bg-red-500" :
    "bg-yellow-400";

  const riskTotal = eq.riskBreakdown.reduce((s, b) => s + b.pct, 0) || 1;

  return (
    <div className="sticky top-0 z-10 border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">

      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500">
          <button type="button" onClick={() => navigate("/equipment")} className="transition-colors hover:text-slate-300">
            Equipment
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-300">{eq.name} ({eq.assetNumber})</span>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100"
          >
            <Edit className="h-3.5 w-3.5" />
            Edit Equipment
          </Button>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
            <Bell className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => navigate("/settings")} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
            <UserCircle className="h-7 w-7" />
          </button>
        </div>
      </div>

      {/* Equipment header row */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">

        {/* Image */}
        <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">
          <img
            src={eq.image}
            alt={eq.name}
            className="h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {/* Name + metadata */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Title row */}
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">{eq.name}</h1>
            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}>
              {eq.riskLevel} Risk
            </Badge>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusDotClass}`} aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-200">{eq.status}</span>
            <span className="text-sm text-slate-500">{eq.statusNote}</span>
          </div>

          {/* Metadata chips */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="font-medium text-slate-300">{eq.assetNumber}</span>
            <span className="rounded bg-gray-800 px-1.5 py-0.5 font-medium tracking-wide text-slate-400">{eq.type}</span>
            <span className="flex items-center gap-1">📍 {eq.area}</span>
            <span>Manufacturer: <span className="text-slate-300">{eq.manufacturer}</span></span>
            <span>Model: <span className="text-slate-300">{eq.model}</span></span>
            <span>Serial Number: <span className="text-slate-300">{eq.serialNumber}</span></span>
            <span>Install Date: <span className="text-slate-300">{eq.installDate}</span></span>
            <span>Warranty: <span className="text-orange-400">{eq.warranty}</span></span>
            <span>Criticality: <span className="text-slate-300">{eq.criticality}</span></span>
          </div>
        </div>

        {/* Risk score + breakdown */}
        <div className="flex shrink-0 flex-col gap-2 lg:w-52">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Score</span>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-slate-50">{eq.riskScore}%</span>
            <Badge className={`mb-1 inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}>
              {eq.riskLevel}
            </Badge>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500">Risk Breakdown</span>
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

      {/* Tab navigation */}
      <div className="mt-4 flex gap-0 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabClick(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.label}
            {tab.badge && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500/20 px-1 text-[9px] font-bold text-blue-400">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
