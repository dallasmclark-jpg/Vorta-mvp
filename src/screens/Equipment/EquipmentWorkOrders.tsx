import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Calendar,
  ChevronRight,
  ClipboardList,
  Download,
  Edit,
  Edit2,
  Eye,
  Filter,
  Plus,
  RefreshCw,
  Search,
  UserCircle,
  Wrench,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

import { EquipmentBase, DEFAULT_EQUIPMENT_ID, getEquipmentById } from "./equipmentData";
import {
  getEquipmentIdentityById,
  getCachedEquipmentIdentity,
  getEquipmentWorkOrders,
  getEquipmentRecommendedWorkQueue,
  type EquipmentRecommendedWorkQueue,
} from "./equipmentService";

// ─── Work Orders types (local, mirrors equipmentTypes.ts shapes) ─────────────

type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type WoStatus = "OPEN" | "IN PROGRESS" | "ON HOLD" | "WAITING PARTS";
type Outcome  = "SUCCESS" | "PARTIAL" | "FAILED";

interface WorkOrder {
  id: string;
  priority: Priority;
  description: string;
  type: string;
  status: WoStatus;
  engineer: string;
  requestedDate: string;
  dueDate: string;
  age: string;
  overdue?: boolean;
}

interface CompletedWO {
  id: string;
  description: string;
  type: string;
  completedBy: string;
  completionDate: string;
  mttr: string;
  outcome: Outcome;
}

interface EngineerWorkload {
  name: string;
  initials: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const ENGINEER_WORKLOAD: EngineerWorkload[] = [
  { name: "James Wilson", initials: "JW", critical: 1, high: 4, medium: 4, low: 3 },
  { name: "Sarah Chen",   initials: "SC", critical: 0, high: 3, medium: 4, low: 3 },
  { name: "Mike Torres",  initials: "MT", critical: 0, high: 2, medium: 4, low: 3 },
  { name: "Lisa Park",    initials: "LP", critical: 0, high: 2, medium: 3, low: 3 },
];

const CALENDAR_DAYS = [
  { label: "Mon", date: "21", pills: [{ id: "WO-10482", color: "#ef4444" }, { id: "PM-01", color: "#10b981" }] },
  { label: "Tue", date: "22", pills: [{ id: "WO-10491", color: "#f97316" }] },
  { label: "Wed", date: "23", pills: [{ id: "WO-10435", color: "#eab308" }, { id: "WO-10420", color: "#10b981" }] },
  { label: "Thu", date: "24", pills: [{ id: "WO-10412", color: "#6366f1" }] },
  { label: "Fri", date: "25", pills: [{ id: "WO-10415", color: "#10b981" }, { id: "PM-02", color: "#10b981" }] },
  { label: "Sat", date: "26", pills: [] },
  { label: "Sun", date: "27", pills: [{ id: "WO-10415", color: "#3b82f6" }] },
];

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { label: "Overview",          id: "overview" },
  { label: "Health",            id: "health" },
  { label: "Work Orders",       id: "wo" },
  { label: "PMs",               id: "pm" },
  { label: "History",           id: "history" },
  { label: "Skills & Engineers",id: "skills" },
  { label: "Spares",            id: "spares" },
  { label: "Documents",         id: "docs" },
  { label: "AI Insights",       id: "ai" },
];

// ─── Style helpers ────────────────────────────────────────────────────────────

function priorityClass(p: Priority) {
  if (p === "CRITICAL") return "bg-[#ef444420] text-red-400";
  if (p === "HIGH")     return "bg-[#f9731620] text-orange-400";
  if (p === "MEDIUM")   return "bg-[#eab30820] text-yellow-400";
  return "bg-[#10b98120] text-emerald-400";
}

function statusClass(s: WoStatus) {
  if (s === "OPEN")          return "bg-[#3b82f620] text-blue-400";
  if (s === "IN PROGRESS")   return "bg-[#f9731620] text-orange-400";
  if (s === "ON HOLD")       return "bg-[#6b728020] text-slate-400";
  return "bg-[#8b5cf620] text-violet-400";
}

function outcomeClass(o: Outcome) {
  if (o === "SUCCESS") return "bg-[#10b98120] text-emerald-400";
  if (o === "PARTIAL") return "bg-[#eab30820] text-yellow-400";
  return "bg-[#ef444420] text-red-400";
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

function SegmentedDonut({ segments }: { segments: { value: number; color: string }[] }) {
  const size = 100;
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;
  const arcs = segments.map((seg) => {
    const len = (seg.value / total) * circ;
    const arc = { offset, len, color: seg.color };
    offset += len + 2; // small gap
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
    </svg>
  );
}

// ─── Engineer initials avatar ─────────────────────────────────────────────────

function Avatar({ initials, color = "bg-blue-600/30 text-blue-300" }: { initials: string; color?: string }) {
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color}`}>
      {initials}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const EquipmentWorkOrders = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [search, setSearch] = useState("");

  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [eq, setEq] = useState<EquipmentBase | null>(() => getCachedEquipmentIdentity(resolvedId));
  const [openWOs, setOpenWOs] = useState<WorkOrder[]>([]);
  const [completedWOs, setCompletedWOs] = useState<CompletedWO[]>([]);

  const [riskQueue, setRiskQueue] =
    useState<EquipmentRecommendedWorkQueue | null>(null);

  useEffect(() => {
    getEquipmentIdentityById(resolvedId).then(setEq);
  }, [resolvedId]);

  useEffect(() => {
    getEquipmentWorkOrders(resolvedId).then(({ open, completed }) => {
      setOpenWOs(open as WorkOrder[]);
      setCompletedWOs(completed as CompletedWO[]);
    });
  }, [resolvedId]);

  useEffect(() => {
    let active = true;
    setRiskQueue(null);
    getEquipmentRecommendedWorkQueue(resolvedId).then((queue) => {
      if (active) {
        setRiskQueue(queue);
      }
    });

    return () => {
      active = false;
    };
  }, [resolvedId]);

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
    eq.riskLevel === "Medium"   ? "bg-[#eab30820] text-yellow-400" :
    "bg-[#10b98120] text-emerald-400";

  const statusDotClass =
    eq.status === "Running" ? "bg-emerald-500" :
    eq.status === "At Risk" ? "bg-orange-400" :
    eq.status === "Fault"   ? "bg-red-500" :
    "bg-yellow-400";

  const riskTotal = eq.riskBreakdown.reduce((s, b) => s + b.pct, 0) || 1;

  const handleTabClick = (tabId: string) => {
    const id = eq.id;
    if (tabId === "overview") navigate(`/equipment/${id}/overview`);
    if (tabId === "health")   navigate(`/equipment/${id}/health`);
    if (tabId === "pm")       navigate(`/equipment/${id}/pms`);
    if (tabId === "history")  navigate(`/equipment/${id}/history`);
    if (tabId === "skills")   navigate(`/equipment/${id}/skills`);
    if (tabId === "spares")   navigate(`/equipment/${id}/spares`);
    if (tabId === "docs")     navigate(`/equipment/${id}/documents`);
    if (tabId === "ai")       navigate(`/equipment/${id}/ai-insights`);
    // other tabs placeholder
  };

  const filteredWOs = openWOs.filter(
    (wo) =>
      wo.id.toLowerCase().includes(search.toLowerCase()) ||
      wo.description.toLowerCase().includes(search.toLowerCase()) ||
      wo.engineer.toLowerCase().includes(search.toLowerCase()),
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const priorityCounts = {
    CRITICAL: openWOs.filter(
      (wo) => wo.priority === "CRITICAL",
    ).length,
    HIGH: openWOs.filter(
      (wo) => wo.priority === "HIGH",
    ).length,
    MEDIUM: openWOs.filter(
      (wo) => wo.priority === "MEDIUM",
    ).length,
  };

  const overdueCount = openWOs.filter(
    (wo) => wo.overdue,
  ).length;

  const dueThisWeekCount = openWOs.filter((wo) => {
    if (!wo.dueDate) return false;

    const dueDate = new Date(`${wo.dueDate}T00:00:00`);

    return (
      !Number.isNaN(dueDate.getTime()) &&
      dueDate >= today &&
      dueDate <= sevenDaysFromNow
    );
  }).length;

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
              <span className="rounded bg-gray-800 px-1.5 py-0.5 font-medium tracking-wide text-slate-400">{eq.type}</span>
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

        {/* Tab navigation */}
        <div className="mt-4 flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => handleTabClick(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                tab.id === "wo"
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

        {/* ── Row 1: 5 KPI cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">

          {/* Open Work Orders */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Open Work Orders</p>
              <p className="mb-2 text-3xl font-bold text-slate-50">{openWOs.length}</p>
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />Critical {priorityCounts.CRITICAL}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />High {priorityCounts.HIGH}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />Medium {priorityCounts.MEDIUM}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Overdue */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Overdue</p>
              <p className="mb-2 text-3xl font-bold text-red-400">{overdueCount}</p>
              <p className="text-[11px] text-slate-500">{openWOs.length > 0
  ? `${Math.round((overdueCount / openWOs.length) * 100)}% of open`
  : "No open work orders"}</p>
            </CardContent>
          </Card>

          {/* Due This Week */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Due This Week</p>
              <p className="mb-2 text-3xl font-bold text-yellow-400">{dueThisWeekCount}</p>
              <p className="text-[11px] text-slate-500">{openWOs.length > 0
  ? `${Math.round((dueThisWeekCount / openWOs.length) * 100)}% of open`
  : "No open work orders"}</p>
            </CardContent>
          </Card>

          {/* Completed */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Projected Equipment Risk
              </p>
              <p className="mb-2 text-3xl font-bold text-emerald-400">
                {riskQueue
                  ? `${riskQueue.projectedRiskScore}%`
                  : "—"}
              </p>
              <p className="text-[11px] text-slate-500">
                {riskQueue
                  ? `${riskQueue.projectedRiskLevel} after ${riskQueue.actions.length} ranked actions`
                  : "Calculating projected risk"}
              </p>
            </CardContent>
          </Card>

          {/* Average MTTR */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Available Risk Reduction
              </p>

              <p className="mb-2 text-3xl font-bold text-emerald-400">
                {riskQueue?.totalCalculatedReduction ?? 0}
                <span className="text-lg font-semibold text-slate-400">
                  {" "}pts
                </span>
              </p>

              <p className="text-[11px] text-slate-500">
                {riskQueue
                  ? `${riskQueue.actions.length} ranked actions · projected ${riskQueue.projectedRiskScore}% ${riskQueue.projectedRiskLevel}`
                  : "Calculated from recommended actions"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Filter / Action bar ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search work orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-[#141820] py-2 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50 focus:ring-0"
            />
          </div>
          {["Status", "Priority", "Work Type", "Assigned To"].map((f) => (
            <button key={f} type="button"
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-[#141820] px-3 py-2 text-xs font-medium text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
              {f}
            </button>
          ))}
          <button type="button"
            className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-[#141820] px-3 py-2 text-xs font-medium text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
            <Filter className="h-3 w-3" /> More Filters
          </button>
          <div className="ml-auto">
            <Button type="button"
              className="h-auto gap-2 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-none">
              <Plus className="h-3.5 w-3.5" /> Create Work Order
            </Button>
          </div>
        </div>

        {/* ── Main WO table ─────────────────────────────────────────────── */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-200">Open Work Orders</h2>
              <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">
                View all open work orders →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-800">
                    {["WO Number", "Priority", "Description", "Type", "Status", "Assigned Engineer", "Requested Date", "Due Date", "Age", "Actions"].map((h) => (
                      <th key={h} className="py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:pl-1 last:pr-1">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredWOs.map((wo, i) => (
                    <tr key={wo.id} className={i !== filteredWOs.length - 1 ? "border-b border-gray-800" : ""}>
                      <td className="py-3 pr-3 pl-1 font-mono text-[11px] font-semibold text-slate-200">{wo.id}</td>
                      <td className="py-3 pr-3">
                        <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${priorityClass(wo.priority)}`}>
                          {wo.priority}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3 max-w-[200px]">
                        <span className="block truncate text-slate-200" title={wo.description}>{wo.description}</span>
                      </td>
                      <td className="py-3 pr-3 text-slate-400">{wo.type}</td>
                      <td className="py-3 pr-3">
                        <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${statusClass(wo.status)}`}>
                          {wo.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3 text-slate-300">{wo.engineer}</td>
                      <td className="py-3 pr-3 text-slate-400 whitespace-nowrap">{wo.requestedDate}</td>
                      <td className={`py-3 pr-3 whitespace-nowrap font-medium ${wo.overdue ? "text-orange-400" : "text-slate-400"}`}>
                        {wo.dueDate}
                      </td>
                      <td className="py-3 pr-3 text-slate-400">{wo.age}</td>
                      <td className="py-3 pr-1">
                        <div className="flex items-center gap-2">
                          <button type="button" className="text-slate-500 hover:text-blue-400 transition-colors" title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className="text-slate-500 hover:text-slate-300 transition-colors" title="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Chart row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Work Order Status */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-slate-200">Work Order Status</h2>
              <p className="mb-4 text-[11px] text-slate-500">Distribution of open work orders</p>
              <div className="flex justify-center mb-4">
                <SegmentedDonut segments={[
                  { value: 6, color: "#3b82f6" },
                  { value: 3, color: "#f97316" },
                  { value: 2, color: "#6b7280" },
                  { value: 3, color: "#8b5cf6" },
                ]} />
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  { label: "Open",          count: 6, color: "#3b82f6" },
                  { label: "In Progress",   count: 3, color: "#f97316" },
                  { label: "On Hold",       count: 2, color: "#6b7280" },
                  { label: "Waiting Parts", count: 3, color: "#8b5cf6" },
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
            </CardContent>
          </Card>

          {/* Work Orders by Type */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-slate-200">Work Orders by Type</h2>
              <p className="mb-4 text-[11px] text-slate-500">Classification of recent work</p>
              <div className="flex justify-center mb-4">
                <SegmentedDonut segments={[
                  { value: 5, color: "#ef4444" },
                  { value: 4, color: "#10b981" },
                  { value: 2, color: "#3b82f6" },
                  { value: 1, color: "#f97316" },
                ]} />
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  { label: "Corrective",  count: 5, color: "#ef4444" },
                  { label: "Preventive",  count: 4, color: "#10b981" },
                  { label: "Predictive",  count: 2, color: "#3b82f6" },
                  { label: "Inspection",  count: 1, color: "#f97316" },
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
            </CardContent>
          </Card>

          {/* Top Failure Codes */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-1 text-sm font-semibold text-slate-200">Top Failure Codes</h2>
              <p className="mb-4 text-[11px] text-slate-500">Frequency of issues</p>
              <div className="flex flex-col gap-3">
                {[
                  { label: "High Vibration",          count: 12, color: "#ef4444" },
                  { label: "PLC Communication Fault", count: 8,  color: "#f97316" },
                  { label: "Motor Overload",           count: 6,  color: "#eab308" },
                  { label: "Sensor Failure",           count: 5,  color: "#10b981" },
                  { label: "Pneumatic Leak",           count: 4,  color: "#6366f1" },
                ].map((fc) => (
                  <div key={fc.label} className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full" style={{ width: `${(fc.count / 12) * 100}%`, backgroundColor: fc.color }} />
                    </div>
                    <div className="flex w-32 items-center justify-between shrink-0">
                      <span className="text-[11px] text-slate-400 leading-tight">{fc.label}</span>
                      <span className="text-[11px] font-semibold text-slate-200 ml-2">{fc.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Middle row: Completed WOs + Workload ───────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">

          {/* Recently Completed */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-1">
                <h2 className="text-sm font-semibold text-slate-200">Recently Completed Work Orders</h2>
                <p className="text-[11px] text-slate-500">Last 30 days</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {["WO Number", "Description", "Type", "Completed By", "Completion Date", "MTTR", "Outcome"].map((h) => (
                        <th key={h} className="py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:pl-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {completedWOs.map((wo, i) => (
                      <tr key={wo.id} className={i !== completedWOs.length - 1 ? "border-b border-gray-800" : ""}>
                        <td className="py-2.5 pr-3 font-mono text-[11px] font-semibold text-slate-200">{wo.id}</td>
                        <td className="py-2.5 pr-3 max-w-[140px]">
                          <span className="block truncate text-slate-300" title={wo.description}>{wo.description}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-slate-400">{wo.type}</td>
                        <td className="py-2.5 pr-3 text-slate-300 whitespace-nowrap">{wo.completedBy}</td>
                        <td className="py-2.5 pr-3 text-slate-400 whitespace-nowrap">{wo.completionDate}</td>
                        <td className="py-2.5 pr-3 font-semibold text-slate-200">{wo.mttr}</td>
                        <td className="py-2.5">
                          <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${outcomeClass(wo.outcome)}`}>
                            {wo.outcome}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Workload */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Maintenance Workload</h2>
              <div className="flex flex-col gap-3">
                {ENGINEER_WORKLOAD.map((eng) => {
                  const total = eng.critical + eng.high + eng.medium + eng.low;
                  const segments = [
                    { pct: (eng.critical / total) * 100, color: "#ef4444" },
                    { pct: (eng.high    / total) * 100, color: "#f97316" },
                    { pct: (eng.medium  / total) * 100, color: "#eab308" },
                    { pct: (eng.low     / total) * 100, color: "#3b82f6" },
                  ];
                  return (
                    <div key={eng.name} className="flex items-center gap-3">
                      <Avatar initials={eng.initials} />
                      <div className="flex flex-1 flex-col gap-1">
                        <span className="text-xs font-medium text-slate-200">{eng.name}</span>
                        <div className="flex h-2 overflow-hidden rounded-full">
                          {segments.map((s, i) => s.pct > 0 && (
                            <div key={i} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                          ))}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-slate-200">{total}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-gray-800 pt-3">
                {[
                  { label: "Critical", color: "#ef4444" },
                  { label: "High",     color: "#f97316" },
                  { label: "Medium",   color: "#eab308" },
                  { label: "Low",      color: "#3b82f6" },
                ].map((l) => (
                  <span key={l.label} className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />{l.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Bottom row: Calendar + Quick Actions ───────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">

          {/* Work Order Calendar */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-slate-200">Work Order Calendar</h2>
                <p className="text-[11px] text-slate-500">Week of 22 Apr 2025</p>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {CALENDAR_DAYS.map((day) => (
                  <div key={day.date} className="flex flex-col gap-1">
                    <div className="rounded-lg border border-gray-800 bg-[#0d1118] px-1 py-1.5 text-center">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{day.label}</p>
                      <p className="text-sm font-bold text-slate-200">{day.date}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {day.pills.map((pill) => (
                        <div key={pill.id}
                          className="rounded px-1.5 py-0.5 text-center text-[9px] font-semibold text-white truncate"
                          style={{ backgroundColor: pill.color + "33", border: `1px solid ${pill.color}55`, color: pill.color }}>
                          {pill.id}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Quick Actions</h2>
              <div className="flex flex-col gap-2">

                {/* Highlight: assign critical */}
                <button type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-orange-500/30 bg-orange-500/5 px-3 py-2.5 text-left transition-colors hover:bg-orange-500/10">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-500/15">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xs font-medium text-slate-200">Assign Critical Work Order</span>
                    <span className="text-[10px] text-orange-400">WO-10482 needs immediate attention</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                </button>

                {[
                  { Icon: Wrench,       label: "Create Work Order" },
                  { Icon: Calendar,     label: "Create PM" },
                  { Icon: ClipboardList,label: "Request Spare" },
                  { Icon: AlertTriangle,label: "Log Downtime" },
                  { Icon: Download,     label: "Export Work Orders" },
                ].map(({ Icon, label }) => (
                  <button key={label} type="button"
                    className="flex w-full items-center gap-3 rounded-lg border border-gray-800 bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-[#1a2030]">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-800">
                      <Icon className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <span className="flex-1 truncate text-xs font-medium text-slate-300">{label}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                  </button>
                ))}
              </div>
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
