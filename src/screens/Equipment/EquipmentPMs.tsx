import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  Bell as BellIcon,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Edit,
  Edit2,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  UserCircle,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

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

type PmStatus = "ON TRACK" | "DUE SOON" | "OVERDUE" | "COMPLETED";

interface PmRow {
  name: string;
  code: string;
  frequency: string;
  type: string;
  lastCompleted: string;
  nextDue: string;
  status: PmStatus;
  compliance: number;
}

const PM_ROWS: PmRow[] = [
  { name: "Daily Visual Inspection", code: "PM-PL-02-DAILY",   frequency: "Daily",     type: "Inspection", lastCompleted: "24 Apr 2025", nextDue: "25 Apr 2025", status: "ON TRACK",  compliance: 90 },
  { name: "Conveyor Lubrication",    code: "PM-PL-02-LUB-01",  frequency: "Weekly",    type: "Lubrication",lastCompleted: "20 Apr 2025", nextDue: "27 Apr 2025", status: "DUE SOON",  compliance: 75 },
  { name: "Bearing Inspection",      code: "PM-PL-02-BEAR-01", frequency: "Monthly",   type: "Inspection", lastCompleted: "15 Mar 2025", nextDue: "15 Apr 2025", status: "OVERDUE",   compliance: 45 },
  { name: "PLC Logic Review",        code: "PM-PL-02-LOGIC",   frequency: "Quarterly", type: "Test",       lastCompleted: "10 Jan 2025", nextDue: "10 Apr 2025", status: "COMPLETED", compliance: 100 },
  { name: "Drive-End Alignment",     code: "PM-PL-02-ALIGN",   frequency: "Monthly",   type: "Service",    lastCompleted: "05 Apr 2025", nextDue: "05 May 2025", status: "ON TRACK",  compliance: 95 },
];

interface ChecklistRow {
  name: string;
  linkedPm: string;
  lastUpdated: string;
  version: string;
}

const CHECKLISTS: ChecklistRow[] = [
  { name: "Palletiser Daily Check",       linkedPm: "PM-PL-02-DAILY",   lastUpdated: "24 Apr 2025", version: "v2.1" },
  { name: "Bearing Inspection Checklist", linkedPm: "PM-PL-02-BEAR-01", lastUpdated: "15 Mar 2025", version: "v1.0" },
  { name: "PLC Logic Review Checklist",   linkedPm: "PM-PL-02-LOGIC",   lastUpdated: "10 Jan 2025", version: "v3.2" },
];

const SCHEDULE_DAYS = [
  { label: "Mon", date: "21", pills: [{ text: "Inspection", color: "#3b82f6" }, { text: "Lubrication", color: "#f97316" }] },
  { label: "Tue", date: "22", pills: [{ text: "Service",    color: "#10b981" }] },
  { label: "Wed", date: "23", pills: [{ text: "Testing",    color: "#8b5cf6" }] },
  { label: "Thu", date: "24", pills: [{ text: "Inspection", color: "#3b82f6" }] },
  { label: "Fri", date: "25", pills: [{ text: "Lubrication",color: "#f97316" }, { text: "Service",    color: "#10b981" }] },
  { label: "Sat", date: "26", pills: [{ text: "Service",    color: "#10b981" }] },
  { label: "Sun", date: "27", pills: [{ text: "Testing",    color: "#8b5cf6" }] },
];

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

function pmStatusClass(s: PmStatus) {
  if (s === "ON TRACK")  return "bg-[#10b98120] text-emerald-400";
  if (s === "DUE SOON")  return "bg-[#eab30820] text-yellow-400";
  if (s === "OVERDUE")   return "bg-[#ef444420] text-red-400";
  return "bg-[#3b82f620] text-blue-400";
}

function complianceColor(v: number) {
  return v >= 80 ? "#10b981" : v >= 60 ? "#f97316" : "#ef4444";
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

function SegmentedDonut({
  segments,
  size = 100,
  strokeWidth = 14,
  label,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  label?: string;
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
        <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle"
          fill="white" fontSize={size * 0.18} fontWeight="700">
          {label}
        </text>
      )}
    </svg>
  );
}

// ─── Compliance trend SVG sparkline ──────────────────────────────────────────

function ComplianceTrendChart() {
  const W = 280;
  const H = 100;
  const PAD = { top: 10, right: 10, bottom: 22, left: 28 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const data = [68, 72, 75, 78, 80, 82];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const xStep = cw / (data.length - 1);
  const yScale = (v: number) => ch - ((v - 60) / 40) * ch;
  const points = data.map((v, i) => `${PAD.left + i * xStep},${PAD.top + yScale(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" preserveAspectRatio="none">
      {[60, 70, 80, 90, 100].map((y) => (
        <line key={y} x1={PAD.left} y1={PAD.top + yScale(y)} x2={W - PAD.right} y2={PAD.top + yScale(y)}
          stroke="#ffffff0d" strokeWidth="1" />
      ))}
      {[60, 80, 100].map((y) => (
        <text key={y} x={PAD.left - 4} y={PAD.top + yScale(y) + 4}
          textAnchor="end" fill="#475569" fontSize="8">{y}</text>
      ))}
      {months.map((m, i) => (
        <text key={m} x={PAD.left + i * xStep} y={H - 5}
          textAnchor="middle" fill="#475569" fontSize="8">{m}</text>
      ))}
      <polyline points={points} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={PAD.left + i * xStep} cy={PAD.top + yScale(v)} r="2.5" fill="#10b981" />
      ))}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const EquipmentPMs = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [search, setSearch] = useState("");
  const [scheduleView, setScheduleView] = useState<"week" | "month">("week");

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
    if (tabId === "overview")    navigate(`/equipment/${id}/overview`);
    if (tabId === "health")      navigate(`/equipment/${id}/health`);
    if (tabId === "wo")          navigate(`/equipment/${id}/work-orders`);
    if (tabId === "history")     navigate(`/equipment/${id}/history`);
    if (tabId === "skills")      navigate(`/equipment/${id}/skills`);
    if (tabId === "spares")      navigate(`/equipment/${id}/spares`);
    // other tabs placeholder
  };

  const filtered = PM_ROWS.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">

      {/* ── Sticky Header ───────────────────────────────────────────────── */}
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
                tab.id === "pm"
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

      {/* ── Page Content ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">

        {/* ── Row 1: 6 KPI cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total PMs</p>
              <p className="text-3xl font-bold text-slate-50">8</p>
              <p className="mt-1 text-[11px] text-slate-500">Active PMs</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">PM Compliance</p>
              <p className="text-3xl font-bold text-emerald-400">82%</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">↑ +4.8% vs previous 30 days</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Overdue PMs</p>
              <p className="text-3xl font-bold text-red-400">2</p>
              <p className="mt-1 text-[11px] text-slate-500">25% of total</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Due This Week</p>
              <p className="text-3xl font-bold text-yellow-400">3</p>
              <p className="mt-1 text-[11px] text-slate-500">38% of total</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Due This Month</p>
              <p className="text-3xl font-bold text-slate-50">5</p>
              <p className="mt-1 text-[11px] text-slate-500">63% of total</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Next PM Due</p>
              <p className="text-2xl font-bold text-yellow-400">Tomorrow</p>
              <p className="mt-1 text-[11px] text-slate-400">Conveyor Lubrication</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Main row: PM table + right column ──────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">

          {/* PM Table */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[160px] max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Search PMs..."
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-[#0d1118] py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50" />
                </div>
                {["Status: All", "Frequency: All", "Sort: Due Date"].map((f) => (
                  <button key={f} type="button"
                    className="flex items-center gap-1 rounded-lg border border-gray-700 bg-[#0d1118] px-3 py-1.5 text-xs text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
                    {f} <ChevronRight className="h-3 w-3 rotate-90" />
                  </button>
                ))}
                <Button type="button"
                  className="ml-auto h-auto gap-1.5 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-none">
                  <Plus className="h-3.5 w-3.5" /> Create PM
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {["PM Name", "PM Code", "Frequency", "Type", "Last Completed", "Next Due", "Status", "Compliance", "Actions"].map((h) => (
                        <th key={h} className="py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:pl-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((pm, i) => (
                      <tr key={pm.code} className={i !== filtered.length - 1 ? "border-b border-gray-800" : ""}>
                        <td className="py-3 pr-3 font-semibold text-slate-200">{pm.name}</td>
                        <td className="py-3 pr-3 font-mono text-[11px] text-slate-400">{pm.code}</td>
                        <td className="py-3 pr-3 text-slate-400">{pm.frequency}</td>
                        <td className="py-3 pr-3 text-slate-400">{pm.type}</td>
                        <td className="py-3 pr-3 text-slate-400 whitespace-nowrap">{pm.lastCompleted}</td>
                        <td className={`py-3 pr-3 whitespace-nowrap font-medium ${pm.status === "OVERDUE" ? "text-red-400" : pm.status === "DUE SOON" ? "text-yellow-400" : "text-slate-400"}`}>
                          {pm.nextDue}
                        </td>
                        <td className="py-3 pr-3">
                          <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${pmStatusClass(pm.status)}`}>
                            {pm.status}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3 min-w-[100px]">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                              <div className="h-full rounded-full" style={{ width: `${pm.compliance}%`, backgroundColor: complianceColor(pm.compliance) }} />
                            </div>
                            <span className="shrink-0 text-[11px] font-semibold" style={{ color: complianceColor(pm.compliance) }}>{pm.compliance}%</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button type="button" className="text-slate-500 hover:text-blue-400 transition-colors" title="View"><Eye className="h-3.5 w-3.5" /></button>
                            <button type="button" className="text-slate-500 hover:text-slate-300 transition-colors" title="Edit"><Edit2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View inactive PMs →
              </button>
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="flex flex-col gap-4">

            {/* PM Compliance donut */}
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-200">PM Compliance</h2>
                <div className="flex justify-center mb-3">
                  <SegmentedDonut
                    segments={[
                      { value: 6, color: "#10b981" },
                      { value: 1, color: "#eab308" },
                      { value: 1, color: "#ef4444" },
                    ]}
                    size={110}
                    strokeWidth={14}
                    label="82%"
                  />
                </div>
                <div className="mb-3 flex flex-col gap-1.5">
                  {[
                    { label: "Compliant", count: 6, color: "#10b981" },
                    { label: "Due Soon",  count: 1, color: "#eab308" },
                    { label: "Overdue",   count: 1, color: "#ef4444" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="text-[11px] text-slate-400">{l.label}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-200">{l.count}</span>
                    </div>
                  ))}
                </div>
                <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  View compliance report →
                </button>
              </CardContent>
            </Card>

            {/* PMs by Type donut */}
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-200">PMs by Type</h2>
                <div className="flex justify-center mb-3">
                  <SegmentedDonut
                    segments={[
                      { value: 2, color: "#3b82f6" },
                      { value: 2, color: "#f97316" },
                      { value: 1, color: "#8b5cf6" },
                      { value: 3, color: "#10b981" },
                    ]}
                    size={110}
                    strokeWidth={14}
                    label="8"
                  />
                </div>
                <div className="mb-3 flex flex-col gap-1.5">
                  {[
                    { label: "Inspection",  count: 2, color: "#3b82f6" },
                    { label: "Lubrication", count: 2, color: "#f97316" },
                    { label: "Test",        count: 1, color: "#8b5cf6" },
                    { label: "Service",     count: 3, color: "#10b981" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="text-[11px] text-slate-400">{l.label}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-200">{l.count}</span>
                    </div>
                  ))}
                </div>
                <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  View detailed report →
                </button>
              </CardContent>
            </Card>

            {/* PM Settings */}
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-200">PM Settings</h2>
                <div className="flex flex-col gap-0 divide-y divide-gray-800">
                  {[
                    { label: "PM Calendar",   Icon: Calendar,       action: "Manage" },
                    { label: "Checklists",    Icon: ClipboardCheck, action: "Manage" },
                    { label: "Procedures",    Icon: Eye,            action: "View"   },
                    { label: "Triggers",      Icon: Settings,       action: "Manage" },
                    { label: "Notifications", Icon: BellIcon,       action: "View"   },
                  ].map(({ label, Icon, action }) => (
                    <div key={label} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-xs text-slate-300">{label}</span>
                      </div>
                      <button type="button" className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                        {action} →
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Schedule row ───────────────────────────────────────────────── */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-slate-200">PM Schedule</h2>
              <div className="flex items-center gap-1">
                {(["week", "month"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setScheduleView(v)}
                    className={`rounded px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                      scheduleView === v ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-gray-800 hover:text-slate-300"
                    }`}>
                    {v === "week" ? "Week" : "Month"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {SCHEDULE_DAYS.map((day) => (
                <div key={day.date} className="flex flex-col gap-1">
                  <div className="rounded-lg border border-gray-800 bg-[#0d1118] px-1 py-1.5 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{day.label}</p>
                    <p className="text-sm font-bold text-slate-200">{day.date}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {day.pills.map((pill, i) => (
                      <div key={i}
                        className="rounded px-1.5 py-0.5 text-center text-[9px] font-semibold truncate"
                        style={{ backgroundColor: pill.color + "28", border: `1px solid ${pill.color}50`, color: pill.color }}>
                        {pill.text}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
              View full calendar →
            </button>
          </CardContent>
        </Card>

        {/* ── Lower row: Compliance Trend | Overdue PMs | PM History ──────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Compliance Trend */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-1 text-sm font-semibold text-slate-200">PM Compliance Trend</h2>
              <p className="mb-3 text-[11px] text-slate-500">Last 6 months</p>
              <ComplianceTrendChart />
              <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View trend report →
              </button>
            </CardContent>
          </Card>

          {/* Overdue PMs */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Overdue PMs</h2>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {[
                  { name: "Bearing Inspection", overdue: "9 days",  priority: "HIGH" },
                  { name: "PLC Logic Review",   overdue: "14 days", priority: "HIGH" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-slate-200">{item.name}</span>
                      <span className="text-[11px] text-slate-500">{item.overdue}</span>
                    </div>
                    <Badge className="h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none bg-[#f9731620] text-orange-400">
                      {item.priority}
                    </Badge>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View all overdue PMs →
              </button>
            </CardContent>
          </Card>

          {/* PM History */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-1 text-sm font-semibold text-slate-200">PM History</h2>
              <p className="mb-3 text-[11px] text-slate-500">Last 90 Days</p>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {[
                  { name: "Daily Visual Inspection", by: "James Wilson", date: "24 Apr 2025" },
                  { name: "Conveyor Lubrication",    by: "Sarah Lee",    date: "20 Apr 2025" },
                  { name: "Drive-End Alignment",     by: "James Wilson", date: "05 Apr 2025" },
                  { name: "PLC Logic Review",        by: "System",       date: "10 Jan 2025" },
                ].map((item) => (
                  <div key={item.name + item.date} className="flex items-start gap-2.5 py-2.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-slate-200">{item.name}</span>
                      <span className="text-[11px] text-slate-500">Completed by {item.by} • {item.date}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View all history →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Bottom row: PM Checklists + AI Recommendation ──────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">

          {/* PM Checklists */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">PM Checklists</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {["Checklist Name", "Linked PM", "Last Updated", "Version", "Actions"].map((h) => (
                        <th key={h} className="py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:pl-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CHECKLISTS.map((cl, i) => (
                      <tr key={cl.linkedPm} className={i !== CHECKLISTS.length - 1 ? "border-b border-gray-800" : ""}>
                        <td className="py-3 pr-3 font-semibold text-slate-200">{cl.name}</td>
                        <td className="py-3 pr-3 font-mono text-[11px] text-slate-400">{cl.linkedPm}</td>
                        <td className="py-3 pr-3 text-slate-400 whitespace-nowrap">{cl.lastUpdated}</td>
                        <td className="py-3 pr-3">
                          <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">{cl.version}</span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button type="button" className="text-slate-500 hover:text-blue-400 transition-colors" title="View"><Eye className="h-3.5 w-3.5" /></button>
                            <button type="button" className="text-slate-500 hover:text-slate-300 transition-colors" title="Edit"><Edit2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Manage all checklists →
              </button>
            </CardContent>
          </Card>

          {/* AI Recommendation */}
          <Card className="rounded-xl border border-blue-500/20 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-200">AI Recommendation</h2>
              </div>
              <p className="mb-4 text-xs leading-relaxed text-slate-300">
                Based on current PM compliance and failure patterns, consider increasing lubrication
                frequency on drive-end bearing from monthly to bi-weekly. PM-PL-01-LUB-01 shows
                declining compliance.
              </p>
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <span className="text-[11px] text-slate-400">Confidence</span>
                <span className="ml-auto rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400">88%</span>
              </div>
              <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View AI Insights →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
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
