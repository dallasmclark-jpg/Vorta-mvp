import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Edit,
  Edit2,
  Eye,
  FileText,
  Filter,
  RefreshCw,
  Search,
  UserCircle,
  Wrench,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

// ─── Shared equipment base ────────────────────────────────────────────────────

interface EquipmentBase {
  id: string;
  name: string;
  assetNumber: string;
  type: string;
  area: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  installDate: string;
  warranty: string;
  criticality: string;
  status: string;
  statusNote: string;
  image: string;
  riskScore: number;
  riskLevel: string;
  riskBreakdown: { label: string; pct: number; color: string; dotClass: string }[];
}

const EQUIPMENT_BASE: Record<string, EquipmentBase> = {
  "pl-02": {
    id: "pl-02",
    name: "Palletiser 2",
    assetNumber: "PL-02",
    type: "PALLETISER",
    area: "Packaging Area",
    manufacturer: "KUKA",
    model: "KR 210 R2700",
    serialNumber: "PL-02-2019-7731",
    installDate: "12 Mar 2019",
    warranty: "Expired",
    criticality: "High",
    status: "Running",
    statusNote: "Operating normally",
    image: "https://images.pexels.com/photos/3912981/pexels-photo-3912981.jpeg?auto=compress&cs=tinysrgb&w=400",
    riskScore: 71,
    riskLevel: "High",
    riskBreakdown: [
      { label: "High",     pct: 71, color: "#f97316", dotClass: "bg-orange-400" },
      { label: "Critical", pct: 24, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "Skills",   pct: 16, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",   pct: 8,  color: "#6366f1", dotClass: "bg-indigo-500" },
    ],
  },
  "fl-03": {
    id: "fl-03",
    name: "Filling Line 3",
    assetNumber: "FL-03",
    type: "FILLING LINE",
    area: "Building 2",
    manufacturer: "Krones",
    model: "Modulfill VFS 32",
    serialNumber: "FL-03-2017-4421",
    installDate: "8 Jun 2017",
    warranty: "Expired",
    criticality: "Critical",
    status: "At Risk",
    statusNote: "Fault detected",
    image: "https://images.pexels.com/photos/1267338/pexels-photo-1267338.jpeg?auto=compress&cs=tinysrgb&w=400",
    riskScore: 92,
    riskLevel: "Critical",
    riskBreakdown: [
      { label: "Breakdowns", pct: 40, color: "#ef4444", dotClass: "bg-red-500" },
      { label: "PMs",        pct: 25, color: "#f97316", dotClass: "bg-orange-500" },
      { label: "Skills",     pct: 15, color: "#eab308", dotClass: "bg-yellow-400" },
      { label: "Spares",     pct: 10, color: "#6366f1", dotClass: "bg-indigo-500" },
    ],
  },
};

const DEFAULT_ID = "pl-02";

// ─── Mock data ────────────────────────────────────────────────────────────────

type WoType      = "BREAKDOWN" | "CORRECTIVE" | "PREVENTIVE" | "INSPECTION" | "PARTS";
type WoPriority  = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type WoOutcome   = "RESOLVED" | "PARTIAL" | "OPEN";

interface HistoryRow {
  date: string;
  woNumber: string;
  type: WoType;
  priority: WoPriority;
  description: string;
  downtime: string;
  outcome: WoOutcome;
}

const HISTORY_ROWS: HistoryRow[] = [
  { date: "24 Apr 2025", woNumber: "WO-10482", type: "BREAKDOWN",  priority: "CRITICAL", description: "High vibration on main arm — emergency stop triggered",  downtime: "3h 20m", outcome: "RESOLVED" },
  { date: "23 Apr 2025", woNumber: "WO-10435", type: "CORRECTIVE", priority: "HIGH",     description: "PLC communication intermittent — board reseated",           downtime: "1h 45m", outcome: "PARTIAL"  },
  { date: "21 Apr 2025", woNumber: "WO-10491", type: "PREVENTIVE", priority: "MEDIUM",   description: "Gripper alignment check — within tolerance",                 downtime: "0h 00m", outcome: "RESOLVED" },
  { date: "20 Apr 2025", woNumber: "WO-10478", type: "INSPECTION", priority: "MEDIUM",   description: "Monthly visual inspection — no defects found",               downtime: "0h 00m", outcome: "RESOLVED" },
  { date: "18 Apr 2025", woNumber: "WO-10465", type: "PARTS",      priority: "MEDIUM",   description: "Drive belt replaced — worn beyond 80% threshold",            downtime: "0h 30m", outcome: "RESOLVED" },
  { date: "15 Apr 2025", woNumber: "WO-10452", type: "BREAKDOWN",  priority: "CRITICAL", description: "Bearing failure on arm joint — partial bearing replacement", downtime: "6h 10m", outcome: "PARTIAL"  },
];

interface SparePartRow {
  name: string;
  partNumber: string;
  usage: number | "-";
  cost: string;
}

const SPARE_PARTS: SparePartRow[] = [
  { name: "Vacuum Pad",     partNumber: "VPK-7731", usage: 4,   cost: "£1,240" },
  { name: "Drive Belt",     partNumber: "DB-2040",  usage: "-", cost: "£560"   },
  { name: "Bearing",        partNumber: "BA-7731",  usage: 2,   cost: "£2,100" },
  { name: "Servo Motor",    partNumber: "SM-1102",  usage: 2,   cost: "£820"   },
  { name: "Encoder",        partNumber: "EW-3301",  usage: 1,   cost: "£340"   },
];

interface FailureHistoryRow {
  date: string;
  priority: WoPriority;
  woNumber: string;
}

const FAILURE_HISTORY: FailureHistoryRow[] = [
  { date: "24 Apr 2025", priority: "CRITICAL", woNumber: "WO-10482" },
  { date: "15 Apr 2025", priority: "CRITICAL", woNumber: "WO-10452" },
  { date: "08 Apr 2025", priority: "HIGH",     woNumber: "WO-10435" },
  { date: "28 Mar 2025", priority: "HIGH",     woNumber: "WO-10418" },
  { date: "12 Mar 2025", priority: "CRITICAL", woNumber: "WO-10392" },
];

const ACTIVITY_FEED = [
  { datetime: "24 Apr 2025 14:45", text: "WO-10482 completed",           Icon: CheckCircle2,  iconClass: "text-emerald-400" },
  { datetime: "23 Apr 2025 16:30", text: "PM-PL-02-DAILY completed",     Icon: CheckCircle2,  iconClass: "text-emerald-400" },
  { datetime: "21 Apr 2025 10:30", text: "Monthly inspection completed",  Icon: Search,        iconClass: "text-blue-400"    },
  { datetime: "18 Apr 2025 09:10", text: "Drive belt replaced",           Icon: Wrench,        iconClass: "text-slate-400"   },
  { datetime: "15 Apr 2025 09:10", text: "Bearing failure logged",        Icon: AlertTriangle, iconClass: "text-red-400"     },
  { datetime: "12 Apr 2025 11:20", text: "Engineer note added",           Icon: FileText,      iconClass: "text-slate-400"   },
];

// ─── Timeline data ────────────────────────────────────────────────────────────
// months 0-11 = May…Apr; dot positions are approx x fractions

const TIMELINE_ROWS = [
  { label: "Preventive",     color: "#10b981", dots: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { label: "Corrective",     color: "#eab308", dots: [1, 3, 5, 7, 9, 10] },
  { label: "Inspections",    color: "#3b82f6", dots: [0, 2, 5, 8, 11] },
  { label: "Parts Replaced", color: "#06b6d4", dots: [2, 6, 9] },
  { label: "Breakdowns",     color: "#ef4444", dots: [3, 7, 11] },
  { label: "Major Events",   color: "#8b5cf6", dots: [5, 10] },
];

const MONTHS = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];

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

// ─── Style helpers ────────────────────────────────────────────────────────────

function typeClass(t: WoType) {
  if (t === "BREAKDOWN")  return "bg-[#ef444420] text-red-400";
  if (t === "CORRECTIVE") return "bg-[#f9731620] text-orange-400";
  if (t === "PREVENTIVE") return "bg-[#10b98120] text-emerald-400";
  if (t === "INSPECTION") return "bg-[#3b82f620] text-blue-400";
  return "bg-[#06b6d420] text-cyan-400";
}

function priorityClass(p: WoPriority) {
  if (p === "CRITICAL") return "bg-[#ef444420] text-red-400";
  if (p === "HIGH")     return "bg-[#f9731620] text-orange-400";
  if (p === "MEDIUM")   return "bg-[#eab30820] text-yellow-400";
  return "bg-[#10b98120] text-emerald-400";
}

function outcomeClass(o: WoOutcome) {
  if (o === "RESOLVED") return "bg-[#10b98120] text-emerald-400";
  if (o === "PARTIAL")  return "bg-[#eab30820] text-yellow-400";
  return "bg-[#6b728020] text-slate-400";
}

// ─── Segmented donut ──────────────────────────────────────────────────────────

function SegmentedDonut({
  segments,
  size = 100,
  strokeWidth = 14,
  label,
  sublabel,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;
  const arcs = segments.map((seg) => {
    const len = (seg.value / total) * circ;
    const arc = { offset, len, color: seg.color };
    offset += len + 2;
    return arc;
  });
  const cx = size / 2;
  const cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2433" strokeWidth={strokeWidth} />
      {arcs.map((a, i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          fill="none" stroke={a.color} strokeWidth={strokeWidth}
          strokeDasharray={`${Math.max(0, a.len - 2)} ${circ}`}
          strokeDashoffset={-a.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
      {label && (
        <text x="50%" y={sublabel ? "46%" : "52%"} dominantBaseline="middle"
          textAnchor="middle" fill="white" fontSize={size * 0.15} fontWeight="700">
          {label}
        </text>
      )}
      {sublabel && (
        <text x="50%" y="62%" dominantBaseline="middle"
          textAnchor="middle" fill="#94a3b8" fontSize={size * 0.09}>
          {sublabel}
        </text>
      )}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const EquipmentHistory = (): JSX.Element => {
  const navigate  = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [timeRange, setTimeRange] = useState<"all" | "12m" | "6m" | "30d">("all");
  const [search, setSearch]       = useState("");
  const [page] = useState(1);

  const eq = (equipmentId && EQUIPMENT_BASE[equipmentId]) ?? EQUIPMENT_BASE[DEFAULT_ID];

  const riskBadgeClass =
    eq.riskLevel === "Critical" ? "bg-[#ef444420] text-red-400" :
    eq.riskLevel === "High"     ? "bg-[#f9731620] text-orange-400" :
    eq.riskLevel === "Medium"   ? "bg-[#eab30820] text-yellow-400" :
    "bg-[#10b98120] text-emerald-400";

  const statusDotClass =
    eq.status === "Running" ? "bg-emerald-500" :
    eq.status === "At Risk" ? "bg-orange-400" :
    eq.status === "Fault"   ? "bg-red-500" : "bg-yellow-400";

  const riskTotal = eq.riskBreakdown.reduce((s, b) => s + b.pct, 0) || 1;

  const handleTabClick = (tabId: string) => {
    const id = equipmentId ?? DEFAULT_ID;
    if (tabId === "overview") navigate(`/equipment/${id}/overview`);
    if (tabId === "health")   navigate(`/equipment/${id}/health`);
    if (tabId === "wo")       navigate(`/equipment/${id}/work-orders`);
    if (tabId === "pm")       navigate(`/equipment/${id}/pms`);
    // other tabs placeholder
  };

  const filtered = HISTORY_ROWS.filter(
    (r) =>
      r.woNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase()),
  );

  // Timeline grid geometry
  const TIMELINE_W = 520;
  const TIMELINE_H = TIMELINE_ROWS.length * 24 + 32;
  const LEFT_PAD   = 110;
  const RIGHT_PAD  = 10;
  const TOP_PAD    = 10;
  const chartW     = TIMELINE_W - LEFT_PAD - RIGHT_PAD;
  const colW       = chartW / (MONTHS.length - 1);

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
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
            <Button type="button" variant="outline"
              className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100">
              <Edit className="h-3.5 w-3.5" /> Edit Equipment
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
              <span className={`h-2 w-2 rounded-full ${statusDotClass}`} aria-hidden="true" />
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

        {/* Tab navigation */}
        <div className="mt-4 flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => handleTabClick(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                tab.id === "history"
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

        {/* ── Timeline Card ────────────────────────────────────────────────── */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Maintenance History Timeline</h2>
                <p className="text-[11px] text-slate-500">Equipment events over the last 12 months (May 2024 → Apr 2025)</p>
              </div>
              <div className="flex items-center gap-1">
                {([
                  { id: "all", label: "All Activity" },
                  { id: "12m", label: "12 Months" },
                  { id: "6m",  label: "6 Months" },
                  { id: "30d", label: "30 Days" },
                ] as const).map((opt) => (
                  <button key={opt.id} type="button" onClick={() => setTimeRange(opt.id)}
                    className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      timeRange === opt.id
                        ? "bg-blue-600 text-white"
                        : "text-slate-500 hover:bg-gray-800 hover:text-slate-300"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Timeline */}
            <div className="overflow-x-auto">
              <svg
                viewBox={`0 0 ${TIMELINE_W} ${TIMELINE_H}`}
                className="w-full min-w-[420px]"
                style={{ height: TIMELINE_H }}
                aria-hidden="true"
              >
                {/* Month grid lines */}
                {MONTHS.map((_, i) => (
                  <line key={i}
                    x1={LEFT_PAD + i * colW} y1={TOP_PAD}
                    x2={LEFT_PAD + i * colW} y2={TIMELINE_H - 22}
                    stroke="#ffffff08" strokeWidth="1"
                  />
                ))}

                {/* Event rows */}
                {TIMELINE_ROWS.map((row, ri) => {
                  const y = TOP_PAD + ri * 24 + 8;
                  return (
                    <g key={row.label}>
                      <text x={LEFT_PAD - 6} y={y + 4} textAnchor="end"
                        fill="#94a3b8" fontSize="9" fontWeight="500">
                        {row.label}
                      </text>
                      {/* Faint connector line */}
                      <line x1={LEFT_PAD} y1={y + 4} x2={LEFT_PAD + chartW} y2={y + 4}
                        stroke="#ffffff06" strokeWidth="1" />
                      {/* Dots */}
                      {row.dots.map((mi) => (
                        <circle key={mi}
                          cx={LEFT_PAD + mi * colW}
                          cy={y + 4}
                          r="4"
                          fill={row.color}
                          opacity="0.9"
                        />
                      ))}
                    </g>
                  );
                })}

                {/* Month labels */}
                {MONTHS.map((m, i) => (
                  <text key={m}
                    x={LEFT_PAD + i * colW} y={TIMELINE_H - 6}
                    textAnchor="middle" fill="#475569" fontSize="8.5">
                    {m}
                  </text>
                ))}
              </svg>
            </div>

            <button type="button" className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
              View complete maintenance history →
            </button>
          </CardContent>
        </Card>

        {/* ── KPI Row ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Total Work Orders", value: "156",       suffix: "",    trend: "+15%",  trendUp: true  },
            { label: "Breakdowns",        value: "27",        suffix: "",    trend: "-16%",  trendUp: false },
            { label: "Total Downtime",    value: "142h 35m",  suffix: "",    trend: "",      trendUp: null  },
            { label: "Downtime Cost",     value: "£28,450",   suffix: "",    trend: "",      trendUp: null  },
            { label: "MTTR",              value: "6.2",       suffix: " hrs",trend: "-24h",  trendUp: false },
            { label: "MTBF",              value: "312",       suffix: " hrs",trend: "",      trendUp: null  },
          ].map((kpi) => (
            <Card key={kpi.label} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-slate-50">
                  {kpi.value}<span className="text-base font-semibold text-slate-400">{kpi.suffix}</span>
                </p>
                {kpi.trend && (
                  <p className={`mt-1 text-[11px] font-semibold ${kpi.trendUp ? "text-emerald-400" : "text-red-400"}`}>
                    {kpi.trendUp ? "↑" : "↓"} {kpi.trend}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Main row: History table + right column ─────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">

          {/* History table */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">

              {/* Toolbar */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[160px] max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Search WO number, description..."
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-[#0d1118] py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50" />
                </div>
                {["Type: All", "Priority: All", "Outcome: All"].map((f) => (
                  <button key={f} type="button"
                    className="flex items-center gap-1 rounded-lg border border-gray-700 bg-[#0d1118] px-3 py-1.5 text-xs text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
                    {f} <ChevronRight className="h-3 w-3 rotate-90" />
                  </button>
                ))}
                <button type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-[#0d1118] px-3 py-1.5 text-xs text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
                  <Filter className="h-3 w-3" /> More filters
                </button>
                <Button type="button" variant="outline"
                  className="ml-auto h-auto gap-1.5 border-blue-500/50 bg-blue-600/10 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-600/20 shadow-none">
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {["Date", "WO Number", "Type", "Priority", "Description", "Downtime", "Outcome"].map((h) => (
                        <th key={h} className="py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:pl-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => (
                      <tr key={row.woNumber} className={i !== filtered.length - 1 ? "border-b border-gray-800" : ""}>
                        <td className="py-3 pr-3 text-slate-400 whitespace-nowrap">{row.date}</td>
                        <td className="py-3 pr-3 font-mono text-[11px] font-semibold text-slate-200">{row.woNumber}</td>
                        <td className="py-3 pr-3">
                          <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${typeClass(row.type)}`}>
                            {row.type}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${priorityClass(row.priority)}`}>
                            {row.priority}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3 max-w-[200px]">
                          <span className="block truncate text-slate-300" title={row.description}>{row.description}</span>
                        </td>
                        <td className="py-3 pr-3 font-semibold text-slate-200 whitespace-nowrap">{row.downtime}</td>
                        <td className="py-3">
                          <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${outcomeClass(row.outcome)}`}>
                            {row.outcome}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Page {page} of 12</span>
                <div className="flex items-center gap-1">
                  <button type="button"
                    className="flex items-center gap-1 rounded border border-gray-700 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
                    <ChevronLeft className="h-3 w-3" /> Previous
                  </button>
                  <button type="button"
                    className="flex items-center gap-1 rounded border border-gray-700 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
                    Next <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="flex flex-col gap-4">

            {/* Top Failure Modes */}
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-200">Top Failure Modes</h2>
                  <button type="button" className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">
                    View all →
                  </button>
                </div>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: "Motor Overload",          count: 12, color: "#ef4444" },
                    { label: "PLC Communication Fault", count: 8,  color: "#f97316" },
                    { label: "Bearing Failure",         count: 6,  color: "#eab308" },
                    { label: "Sensor Failure",          count: 5,  color: "#10b981" },
                    { label: "Pneumatic Leak",          count: 4,  color: "#3b82f6" },
                    { label: "Encoder Fault",           count: 3,  color: "#8b5cf6" },
                  ].map((fm) => (
                    <div key={fm.label} className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                        <div className="h-full rounded-full" style={{ width: `${(fm.count / 12) * 100}%`, backgroundColor: fm.color }} />
                      </div>
                      <span className="w-20 shrink-0 truncate text-[11px] text-slate-400">{fm.label}</span>
                      <span className="shrink-0 text-[11px] font-bold text-slate-200">{fm.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Failure History */}
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-200">Failure History</h2>
                  <button type="button" className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">
                    View all →
                  </button>
                </div>
                <div className="flex flex-col gap-0 divide-y divide-gray-800">
                  {FAILURE_HISTORY.map((fh) => (
                    <div key={fh.woNumber} className="flex items-center justify-between py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] text-slate-300">{fh.date}</span>
                        <span className="font-mono text-[10px] text-slate-500">{fh.woNumber}</span>
                      </div>
                      <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${priorityClass(fh.priority)}`}>
                        {fh.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Middle row: Spare Parts | Maintenance Frequency | Component Interventions ─ */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Spare Parts Used */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-200">Spare Parts Used</h2>
                <button type="button" className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">
                  View all parts →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {["Part Name", "Part Number", "Usage", "Total Cost"].map((h) => (
                        <th key={h} className="py-1.5 pr-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:pl-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SPARE_PARTS.map((p, i) => (
                      <tr key={p.partNumber} className={i !== SPARE_PARTS.length - 1 ? "border-b border-gray-800" : ""}>
                        <td className="py-2 pr-2 text-slate-200 font-medium">{p.name}</td>
                        <td className="py-2 pr-2 font-mono text-[10px] text-slate-400">{p.partNumber}</td>
                        <td className="py-2 pr-2 text-slate-400 text-center">{p.usage}</td>
                        <td className="py-2 font-semibold text-slate-200">{p.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Frequency */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-200">Maintenance Frequency</h2>
                <button type="button" className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">
                  View detailed report →
                </button>
              </div>
              <div className="flex justify-center mb-3">
                <SegmentedDonut
                  segments={[
                    { value: 15, color: "#ef4444" },
                    { value: 25, color: "#f97316" },
                    { value: 40, color: "#10b981" },
                    { value: 15, color: "#3b82f6" },
                    { value: 5,  color: "#6b7280" },
                  ]}
                  size={110}
                  strokeWidth={14}
                  label="Maintenance"
                  sublabel="100%"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  { label: "Breakdown",  pct: "15%", color: "#ef4444" },
                  { label: "Corrective", pct: "25%", color: "#f97316" },
                  { label: "Preventive", pct: "40%", color: "#10b981" },
                  { label: "Inspection", pct: "15%", color: "#3b82f6" },
                  { label: "Other",      pct: "5%",  color: "#6b7280" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                      <span className="text-[11px] text-slate-400">{l.label}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-200">{l.pct}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Component Interventions */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-200">Component Interventions</h2>
                <button type="button" className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">
                  View all →
                </button>
              </div>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: "Gripper Assembly", count: 24, color: "#10b981" },
                  { label: "Main Arm",         count: 18, color: "#3b82f6" },
                  { label: "Control Panel",    count: 15, color: "#f97316" },
                  { label: "Drive Motor",      count: 12, color: "#8b5cf6" },
                  { label: "Encoder",          count: 9,  color: "#eab308" },
                  { label: "Pneumatic System", count: 7,  color: "#6b7280" },
                ].map((ci) => (
                  <div key={ci.label} className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full" style={{ width: `${(ci.count / 24) * 100}%`, backgroundColor: ci.color }} />
                    </div>
                    <span className="w-28 shrink-0 truncate text-[11px] text-slate-400">{ci.label}</span>
                    <span className="shrink-0 text-[11px] font-bold text-slate-200">{ci.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Bottom row: Activity Feed + Quick Actions ─────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">

          {/* Activity Feed */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-200">Activity Feed</h2>
                <button type="button" className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">
                  View full activity feed →
                </button>
              </div>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {ACTIVITY_FEED.map((item) => {
                  const Icon = item.Icon;
                  return (
                    <div key={item.datetime + item.text} className="flex items-center gap-3 py-2.5">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${item.iconClass}`} />
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="shrink-0 text-[11px] text-slate-500 whitespace-nowrap">{item.datetime}</span>
                        <span className="truncate text-[11px] text-slate-200">{item.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Quick Actions</h2>
              <div className="flex flex-col gap-2">
                {[
                  { Icon: ClipboardList, label: "Create Work Order" },
                  { Icon: Calendar,      label: "Create PM" },
                  { Icon: Wrench,        label: "Request Spare Part" },
                  { Icon: AlertTriangle, label: "Log Downtime" },
                  { Icon: Download,      label: "Export History Report" },
                ].map(({ Icon, label }) => (
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
        </div>

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
