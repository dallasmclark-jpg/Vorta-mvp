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

// ─── Shared equipment base ────────────────────────────────────────────────────

interface EquipmentBase {
  id: string; name: string; assetNumber: string; type: string; area: string;
  manufacturer: string; model: string; serialNumber: string; installDate: string;
  warranty: string; criticality: string; status: string; statusNote: string;
  image: string; riskScore: number; riskLevel: string;
  riskBreakdown: { label: string; pct: number; color: string; dotClass: string }[];
}

const EQUIPMENT_BASE: Record<string, EquipmentBase> = {
  "pl-02": {
    id: "pl-02", name: "Palletiser 2", assetNumber: "PL-02", type: "PALLETISER",
    area: "Packaging Area", manufacturer: "KUKA", model: "KR 210 R2700",
    serialNumber: "PL-02-2019-7731", installDate: "12 Mar 2019", warranty: "Expired",
    criticality: "High", status: "Running", statusNote: "Operating normally",
    image: "https://images.pexels.com/photos/3912981/pexels-photo-3912981.jpeg?auto=compress&cs=tinysrgb&w=400",
    riskScore: 71, riskLevel: "High",
    riskBreakdown: [
      { label: "High",     pct: 71, color: "#f97316", dotClass: "bg-orange-400" },
      { label: "Critical", pct: 24, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "Skills",   pct: 16, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",   pct: 8,  color: "#6366f1", dotClass: "bg-indigo-500" },
    ],
  },
  "fl-03": {
    id: "fl-03", name: "Filling Line 3", assetNumber: "FL-03", type: "FILLING LINE",
    area: "Building 2", manufacturer: "Krones", model: "Modulfill VFS 32",
    serialNumber: "FL-03-2017-4421", installDate: "8 Jun 2017", warranty: "Expired",
    criticality: "Critical", status: "At Risk", statusNote: "Fault detected",
    image: "https://images.pexels.com/photos/1267338/pexels-photo-1267338.jpeg?auto=compress&cs=tinysrgb&w=400",
    riskScore: 92, riskLevel: "Critical",
    riskBreakdown: [
      { label: "Breakdowns", pct: 40, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "PMs",        pct: 25, color: "#f97316", dotClass: "bg-orange-500" },
      { label: "Skills",     pct: 15, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",     pct: 10, color: "#6366f1", dotClass: "bg-indigo-500" },
    ],
  },
};

const DEFAULT_ID = "pl-02";

// ─── Tabs ─────────────────────────────────────────────────────────────────────

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

// ─── Mock data ────────────────────────────────────────────────────────────────

type StockStatus = "Out of Stock" | "Low Stock" | "OK";

interface InventoryRow {
  name: string; partNumber: string; stock: number; max: number; status: StockStatus;
}

const INVENTORY: InventoryRow[] = [
  { name: "Encoder Rotary 1024",       partNumber: "EN-2205", stock: 0, max: 2, status: "Out of Stock" },
  { name: "Servo Motor AC 3kW",        partNumber: "SM-4521", stock: 2, max: 3, status: "Low Stock"    },
  { name: "Pneumatic Cylinder 50mm",   partNumber: "PC-3301", stock: 1, max: 2, status: "Low Stock"    },
  { name: "Drive Belt Poly-V 1200mm",  partNumber: "DB-1192", stock: 4, max: 4, status: "OK"           },
  { name: "Bearing Kit 6205-2RS",      partNumber: "BK-411C", stock: 6, max: 4, status: "OK"           },
  { name: "Filter Hydraulic 10µm",     partNumber: "FT-160",  stock: 3, max: 2, status: "OK"           },
];

const USAGE_BARS = [
  { label: "Drive Belt",  count: 12, color: "#3b82f6", pct: 100 },
  { label: "Filter",      count: 9,  color: "#3b82f6", pct: 75  },
  { label: "Bearing Kit", count: 7,  color: "#3b82f6", pct: 58  },
  { label: "Encoder",     count: 5,  color: "#3b82f6", pct: 42  },
  { label: "O-Ring Set",  count: 4,  color: "#3b82f6", pct: 33  },
];

const CRITICAL_SPARES = [
  { name: "Servo Motor",        status: "Out of Stock" as StockStatus },
  { name: "Drive Belt",         status: "Low Stock"    as StockStatus },
  { name: "Pneumatic Cylinder", status: "Low Stock"    as StockStatus },
];

const UPCOMING_REQS = [
  { name: "Drive Belt",  when: "Due Tomorrow", urgentClass: "bg-red-500/20 text-red-400"     },
  { name: "Encoder",     when: "Next Week",    urgentClass: "bg-orange-500/20 text-orange-400" },
  { name: "Bearing Kit", when: "Next Month",   urgentClass: "bg-yellow-500/20 text-yellow-400" },
];

const SUPPLIERS = [
  { name: "KUKA UK",              meta: "OEM Supplier · Lead 5 days"    },
  { name: "RS Components",        meta: "Reliability 98% · Lead 1 day"  },
  { name: "Festo UK",             meta: "Reliability 96% · Lead 3 days" },
  { name: "Radwell International",meta: "Surplus · Lead 7 days"         },
];

const RECENT_ISSUES = [
  { text: "Encoder issued to J. Wilson",           when: "2 hours ago",  dotColor: "bg-blue-400"    },
  { text: "Drive Belt replaced on PL-02",          when: "Yesterday",    dotColor: "bg-emerald-400" },
  { text: "Servo Motor ordered from Siemens",      when: "2 days ago",   dotColor: "bg-orange-400"  },
  { text: "Filter replaced during PM",             when: "3 days ago",   dotColor: "bg-slate-400"   },
  { text: "Bearing Kit reserved for WO-10442",     when: "5 days ago",   dotColor: "bg-slate-400"   },
];

const QUICK_ACTIONS = [
  { Icon: Package,      label: "Request Spare"           },
  { Icon: ShoppingCart, label: "Create Purchase Request" },
  { Icon: BookmarkPlus, label: "Reserve Spare"           },
  { Icon: Layers,       label: "View Inventory"          },
  { Icon: Printer,      label: "Print Stock Report"      },
];

// ─── Donut chart ──────────────────────────────────────────────────────────────

function StockDonut() {
  const size = 110; const sw = 14;
  const r = (size - sw) / 2; const circ = 2 * Math.PI * r;
  const segs = [
    { value: 121, color: "#10b981" },
    { value: 18,  color: "#eab308" },
    { value: 3,   color: "#ef4444" },
  ];
  const total = segs.reduce((s, g) => s + g.value, 0);
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
        fill="white" fontSize="18" fontWeight="700">78%</text>
      <text x="50%" y="62%" dominantBaseline="middle" textAnchor="middle"
        fill="#94a3b8" fontSize="8.5"></text>
    </svg>
  );
}

function statusBadgeClass(s: StockStatus) {
  if (s === "Out of Stock") return "bg-[#ef444420] text-red-400";
  if (s === "Low Stock")    return "bg-[#eab30820] text-yellow-400";
  return "bg-[#10b98120] text-emerald-400";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const EquipmentSpares = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const eq = (equipmentId && EQUIPMENT_BASE[equipmentId]) ?? EQUIPMENT_BASE[DEFAULT_ID];

  const riskBadgeClass =
    eq.riskLevel === "Critical" ? "bg-[#ef444420] text-red-400" :
    eq.riskLevel === "High"     ? "bg-[#f9731620] text-orange-400" :
    "bg-[#10b98120] text-emerald-400";

  const statusDotClass =
    eq.status === "Running" ? "bg-emerald-500" :
    eq.status === "At Risk" ? "bg-orange-400" : "bg-red-500";

  const riskTotal = eq.riskBreakdown.reduce((s, b) => s + b.pct, 0) || 1;

  const handleTabClick = (tabId: string) => {
    const id = equipmentId ?? DEFAULT_ID;
    if (tabId === "overview") navigate(`/equipment/${id}/overview`);
    if (tabId === "health")   navigate(`/equipment/${id}/health`);
    if (tabId === "wo")       navigate(`/equipment/${id}/work-orders`);
    if (tabId === "pm")       navigate(`/equipment/${id}/pms`);
    if (tabId === "history")  navigate(`/equipment/${id}/history`);
    if (tabId === "skills")   navigate(`/equipment/${id}/skills`);
    if (tabId === "docs")     navigate(`/equipment/${id}/documents`);
  };

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">

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
              <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
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

        <div className="mt-4 flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => handleTabClick(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                tab.id === "spares"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}>
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
            { label: "Total Spares",     value: "142",      sub: "Active Parts",        valueClass: "text-slate-50" },
            { label: "Critical Spares",  value: "18",       sub: "Low Stock",           valueClass: "text-orange-400" },
            { label: "Out of Stock",     value: "3",        sub: "Requires Action",     valueClass: "text-red-400" },
            { label: "Inventory Value",  value: "£48,760",  sub: "Current Stock Value", valueClass: "text-slate-50" },
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
                <StockDonut />
                <div className="flex flex-col gap-1.5">
                  {[
                    { label: "Available",    count: 121, color: "#10b981" },
                    { label: "Low Stock",    count: 18,  color: "#eab308" },
                    { label: "Out of Stock", count: 3,   color: "#ef4444" },
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
                {CRITICAL_SPARES.map((s) => (
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
                    {INVENTORY.map((row, i) => (
                      <tr key={row.partNumber} className={i !== INVENTORY.length - 1 ? "border-b border-gray-800" : ""}>
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
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                <span>Showing 6 of 142 parts.</span>
                <button type="button" className="text-blue-400 hover:text-blue-300 transition-colors">
                  View Full Inventory →
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Spare Usage */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-1 text-sm font-semibold text-slate-200">Spare Usage</h3>
              <p className="mb-4 text-[11px] text-slate-500">Top 5 most used — last 90 days</p>
              <div className="flex flex-col gap-3">
                {USAGE_BARS.map((bar) => (
                  <div key={bar.label} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-[11px] text-slate-300">{bar.label}</span>
                    <div className="flex-1 h-2 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full" style={{ width: `${bar.pct}%`, backgroundColor: bar.color }} />
                    </div>
                    <span className="w-4 shrink-0 text-right text-[11px] font-bold text-slate-200">{bar.count}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-4 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View Usage Report →
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
                {UPCOMING_REQS.map((r) => (
                  <div key={r.name} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-800">
                        <Package className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <span className="text-xs font-medium text-slate-200">{r.name}</span>
                    </div>
                    <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-semibold shadow-none ${r.urgentClass}`}>
                      {r.when}
                    </Badge>
                  </div>
                ))}
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
                {SUPPLIERS.map((s) => (
                  <div key={s.name} className="flex flex-col gap-0.5 py-3">
                    <span className="text-xs font-semibold text-slate-200">{s.name}</span>
                    <span className="text-[10px] text-slate-500">{s.meta}</span>
                  </div>
                ))}
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
                {RECENT_ISSUES.map((item) => (
                  <div key={item.text} className="flex items-start gap-2.5 py-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.dotColor}`} />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-medium text-slate-200">{item.text}</span>
                      <span className="text-[10px] text-slate-500">{item.when}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View Issue History →
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
          <span>All data is synced from Vorta Network and SAP PM. Last updated: 24 Apr 2025, 14:45</span>
          <button type="button" aria-label="Refresh" className="text-slate-600 hover:text-slate-400 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
