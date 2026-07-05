import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar,
  ChevronRight,
  ClipboardList,
  Download,
  Edit,
  Eye,
  RefreshCw,
  Sparkles,
  UserCircle,
  Wrench,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

// ─── Equipment data (shared shape) ───────────────────────────────────────────

import { EquipmentBase, DEFAULT_EQUIPMENT_ID, getEquipmentById } from "./equipmentData";
import { getEquipmentIdentityById, getCachedEquipmentIdentity } from "./equipmentService";

// ─── Health-specific data ─────────────────────────────────────────────────────

interface HealthData {
  healthScore: number;
  riskScore: number;
  breakdownProbability: number;
  reliability: number;
  availabilityPct: number;
  maintainability: number;
  performance: number;
  oee: number;
  reliabilityDelta: number;
  availabilityDelta: number;
  maintainabilityDelta: number;
  performanceDelta: number;
  oeeDelta: number;
  failureIndicators: { label: string; level: "CRITICAL" | "HIGH" | "MEDIUM" }[];
  failureHistory: { date: string; failure: string; wo: string; severity: "CRITICAL" | "HIGH" | "LOW" }[];
  reliabilityKpis: { label: string; value: string }[];
  sensorStatus: { label: string; status: "NORMAL" | "WARNING" | "CRITICAL" }[];
  maintenanceTypes: { label: string; pct: number; color: string }[];
  componentHealth: { label: string; value: number; color: string }[];
  healthImpact: { label: string; level: "HIGH" | "MEDIUM" | "LOW" }[];
  aiAnalysis: {
    summary: string;
    mainContributor: string;
    failureProbability: number;
    likelyWindow: string;
    actions: string[];
    confidence: number;
  };
}

const HEALTH_DATA: Record<string, HealthData> = {
  "pl-02": {
    healthScore: 68,
    riskScore: 71,
    breakdownProbability: 86,
    reliability: 62,
    availabilityPct: 74,
    maintainability: 58,
    performance: 72,
    oee: 65,
    reliabilityDelta: 2,
    availabilityDelta: 1,
    maintainabilityDelta: -3,
    performanceDelta: 1,
    oeeDelta: 2,
    failureIndicators: [
      { label: "Breakdown Frequency", level: "CRITICAL" },
      { label: "MTTR Increasing",     level: "HIGH" },
      { label: "PM Overdue",          level: "CRITICAL" },
      { label: "Repeat Failures",     level: "HIGH" },
      { label: "Component Wear",      level: "HIGH" },
      { label: "Rising Downtime",     level: "HIGH" },
      { label: "Increased Vibration", level: "CRITICAL" },
      { label: "Oil Analysis Warning",level: "HIGH" },
    ],
    failureHistory: [
      { date: "24 Apr", failure: "High vibration detected",        wo: "WO-10482", severity: "CRITICAL" },
      { date: "23 Apr", failure: "PLC communication fault",        wo: "WO-10435", severity: "HIGH" },
      { date: "21 Apr", failure: "Gripper alignment issue",        wo: "WO-10491", severity: "HIGH" },
      { date: "19 Apr", failure: "Motor temperature spike",        wo: "WO-10412", severity: "LOW" },
    ],
    reliabilityKpis: [
      { label: "MTBF",            value: "142h" },
      { label: "MTTR",            value: "2.4h" },
      { label: "Availability",    value: "74%" },
      { label: "Downtime (MTD)",  value: "14h" },
      { label: "Downtime Cost",   value: "£12,400" },
      { label: "Repeat Failures", value: "3" },
      { label: "PM Compliance",   value: "82%" },
      { label: "Emergency Stops", value: "2" },
    ],
    sensorStatus: [
      { label: "Vibration",    status: "WARNING" },
      { label: "Temperature",  status: "NORMAL" },
      { label: "Current",      status: "NORMAL" },
      { label: "Oil",          status: "WARNING" },
      { label: "Pressure",     status: "NORMAL" },
      { label: "Flow",         status: "NORMAL" },
      { label: "PLC Alarms",   status: "CRITICAL" },
    ],
    maintenanceTypes: [
      { label: "Preventive",  pct: 45, color: "#10b981" },
      { label: "Predictive",  pct: 20, color: "#3b82f6" },
      { label: "Corrective",  pct: 25, color: "#f97316" },
      { label: "Emergency",   pct: 8,  color: "#ef4444" },
      { label: "Other",       pct: 2,  color: "#6b7280" },
    ],
    componentHealth: [
      { label: "Motor",       value: 78, color: "#10b981" },
      { label: "Gearbox",     value: 65, color: "#10b981" },
      { label: "Bearing",     value: 42, color: "#ef4444" },
      { label: "Encoder",     value: 88, color: "#10b981" },
      { label: "Sensors",     value: 72, color: "#10b981" },
      { label: "Pneumatics",  value: 81, color: "#10b981" },
      { label: "Chains",      value: 55, color: "#f97316" },
    ],
    healthImpact: [
      { label: "Risk of Failure",   level: "HIGH" },
      { label: "Production Impact", level: "HIGH" },
      { label: "Safety Impact",     level: "MEDIUM" },
      { label: "Quality Impact",    level: "MEDIUM" },
      { label: "Cost Impact",       level: "HIGH" },
    ],
    aiAnalysis: {
      summary: "High risk of downtime. Inspect vibration sensors and review PLC logic before next shift.",
      mainContributor: "Bearing Wear",
      failureProbability: 86,
      likelyWindow: "5-8 days",
      actions: [
        "Inspect drive-end bearing",
        "Check motor alignment",
        "Verify lubrication",
        "Monitor vibration trend",
      ],
      confidence: 91,
    },
  },
  "fl-03": {
    healthScore: 42,
    riskScore: 92,
    breakdownProbability: 94,
    reliability: 48,
    availabilityPct: 61,
    maintainability: 44,
    performance: 55,
    oee: 51,
    reliabilityDelta: -3,
    availabilityDelta: -2,
    maintainabilityDelta: -5,
    performanceDelta: -2,
    oeeDelta: -4,
    failureIndicators: [
      { label: "Breakdown Frequency", level: "CRITICAL" },
      { label: "Gearbox Fault",       level: "CRITICAL" },
      { label: "PM Overdue",          level: "CRITICAL" },
      { label: "Repeat Failures",     level: "HIGH" },
      { label: "Component Wear",      level: "HIGH" },
      { label: "Rising Downtime",     level: "CRITICAL" },
      { label: "MTTR Increasing",     level: "HIGH" },
      { label: "Lubrication Warning", level: "HIGH" },
    ],
    failureHistory: [
      { date: "2 May",  failure: "Gearbox fault — reduced speed",  wo: "WO-10458", severity: "CRITICAL" },
      { date: "1 May",  failure: "PLC intermittent fault",          wo: "WO-10451", severity: "HIGH" },
      { date: "28 Apr", failure: "Conveyor belt tension issue",     wo: "WO-10438", severity: "HIGH" },
      { date: "27 Apr", failure: "Product jam on exit conveyor",    wo: "WO-10431", severity: "LOW" },
    ],
    reliabilityKpis: [
      { label: "MTBF",            value: "68h" },
      { label: "MTTR",            value: "4.1h" },
      { label: "Availability",    value: "61%" },
      { label: "Downtime (MTD)",  value: "32h" },
      { label: "Downtime Cost",   value: "£28,600" },
      { label: "Repeat Failures", value: "6" },
      { label: "PM Compliance",   value: "64%" },
      { label: "Emergency Stops", value: "5" },
    ],
    sensorStatus: [
      { label: "Vibration",    status: "CRITICAL" },
      { label: "Temperature",  status: "WARNING" },
      { label: "Current",      status: "WARNING" },
      { label: "Oil",          status: "CRITICAL" },
      { label: "Pressure",     status: "NORMAL" },
      { label: "Flow",         status: "WARNING" },
      { label: "PLC Alarms",   status: "CRITICAL" },
    ],
    maintenanceTypes: [
      { label: "Preventive",  pct: 28, color: "#10b981" },
      { label: "Predictive",  pct: 12, color: "#3b82f6" },
      { label: "Corrective",  pct: 38, color: "#f97316" },
      { label: "Emergency",   pct: 18, color: "#ef4444" },
      { label: "Other",       pct: 4,  color: "#6b7280" },
    ],
    componentHealth: [
      { label: "Motor",       value: 55, color: "#f97316" },
      { label: "Gearbox",     value: 22, color: "#ef4444" },
      { label: "Bearing",     value: 38, color: "#ef4444" },
      { label: "Encoder",     value: 74, color: "#10b981" },
      { label: "Sensors",     value: 60, color: "#f97316" },
      { label: "Pneumatics",  value: 68, color: "#10b981" },
      { label: "Chains",      value: 41, color: "#ef4444" },
    ],
    healthImpact: [
      { label: "Risk of Failure",   level: "HIGH" },
      { label: "Production Impact", level: "HIGH" },
      { label: "Safety Impact",     level: "HIGH" },
      { label: "Quality Impact",    level: "HIGH" },
      { label: "Cost Impact",       level: "HIGH" },
    ],
    aiAnalysis: {
      summary: "Critical failure risk. Replace gearbox coupling before next shift. Escalate spare delivery timeline immediately.",
      mainContributor: "Gearbox Failure",
      failureProbability: 94,
      likelyWindow: "1-3 days",
      actions: [
        "Replace gearbox coupling",
        "Expedite spare delivery",
        "Review lubrication schedule",
        "Assign dedicated engineer",
      ],
      confidence: 94,
    },
  },
};

const DEFAULT_ID = DEFAULT_EQUIPMENT_ID;

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { label: "Overview",          id: "overview" },
  { label: "Health",            id: "health" },
  { label: "Work Orders",       id: "wo",      badge: 12 },
  { label: "PMs",               id: "pm",      badge: 8 },
  { label: "History",           id: "history" },
  { label: "Skills & Engineers",id: "skills" },
  { label: "Spares",            id: "spares" },
  { label: "Documents",         id: "docs" },
  { label: "AI Insights",       id: "ai" },
];

// ─── Mini helpers ─────────────────────────────────────────────────────────────

function failureLevelClass(l: "CRITICAL" | "HIGH" | "MEDIUM") {
  if (l === "CRITICAL") return "bg-[#ef444420] text-red-400";
  if (l === "HIGH")     return "bg-[#f9731620] text-orange-400";
  return "bg-[#eab30820] text-yellow-400";
}

function severityClass(s: "CRITICAL" | "HIGH" | "LOW") {
  if (s === "CRITICAL") return "bg-[#ef444420] text-red-400";
  if (s === "HIGH")     return "bg-[#f9731620] text-orange-400";
  return "bg-[#10b98120] text-emerald-400";
}

function impactLevelClass(l: "HIGH" | "MEDIUM" | "LOW") {
  if (l === "HIGH")   return "bg-[#f9731620] text-orange-400";
  if (l === "MEDIUM") return "bg-[#eab30820] text-yellow-400";
  return "bg-[#10b98120] text-emerald-400";
}

function sensorStatusClass(s: "NORMAL" | "WARNING" | "CRITICAL") {
  if (s === "CRITICAL") return "bg-[#ef444420] text-red-400";
  if (s === "WARNING")  return "bg-[#eab30820] text-yellow-400";
  return "bg-[#10b98120] text-emerald-400";
}

function deltaClass(d: number) {
  return d >= 0 ? "text-emerald-400" : "text-red-400";
}

function deltaLabel(d: number) {
  return d >= 0 ? `+${d}%` : `${d}%`;
}

// ─── Ring donut for KPI cards ─────────────────────────────────────────────────

function RingDonut({
  value,
  size = 80,
  strokeWidth = 10,
  color,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  const cx = size / 2;
  const cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2433" strokeWidth={strokeWidth} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x="50%" y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="white"
        fontSize={size * 0.21}
        fontWeight="700"
      >
        {value}%
      </text>
    </svg>
  );
}

// ─── Donut for maintenance effectiveness ─────────────────────────────────────

function MaintenanceDonut({ types }: { types: { pct: number; color: string }[] }) {
  const size = 96;
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;
  const segments = types.map((t) => {
    const len = (t.pct / 100) * circ;
    const seg = { offset, len, color: t.color };
    offset += len;
    return seg;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2433" strokeWidth={strokeWidth} />
      {segments.map((s, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${s.len} ${circ - s.len}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
    </svg>
  );
}

// ─── Health Trend Chart ───────────────────────────────────────────────────────

type TrendWindow = "30d" | "7d" | "90d" | "12m";

function HealthTrendChart({ window: _w }: { window: TrendWindow }) {
  const W = 520;
  const H = 180;
  const PAD = { top: 12, right: 16, bottom: 28, left: 36 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const healthData = [74,72,73,70,71,69,68,70,67,69,68,66,67,69,68,66,67,66,67,68];
  const riskData   = [64,65,66,65,67,68,70,68,70,71,70,72,71,73,72,71,72,73,71,71];
  const bpData     = [78,80,79,82,83,84,83,85,84,86,85,87,86,85,87,86,87,88,87,86];

  const pts = healthData.length;
  const xStep = cw / (pts - 1);
  const yScale = (v: number) => ch - (v / 100) * ch;
  const toPoints = (data: number[]) =>
    data.map((v, i) => `${PAD.left + i * xStep},${PAD.top + yScale(v)}`).join(" ");

  const gridLines = [25, 50, 75, 100];
  const xLabels = [
    { label: "25 Mar", idx: 0 },
    { label: "1 Apr",  idx: 6 },
    { label: "8 Apr",  idx: 12 },
    { label: "15 Apr", idx: 15 },
    { label: "22 Apr", idx: 19 },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none" aria-label="Equipment Health Trend">
      {gridLines.map((y) => (
        <line key={y}
          x1={PAD.left} y1={PAD.top + yScale(y)}
          x2={W - PAD.right} y2={PAD.top + yScale(y)}
          stroke="#ffffff0d" strokeWidth="1"
        />
      ))}
      {[0, 25, 50, 75, 100].map((y) => (
        <text key={y} x={PAD.left - 4} y={PAD.top + yScale(y) + 4} textAnchor="end" fill="#475569" fontSize="9">{y}</text>
      ))}
      {xLabels.map(({ label, idx }) => (
        <text key={label} x={PAD.left + idx * xStep} y={H - 6} textAnchor="middle" fill="#475569" fontSize="9">{label}</text>
      ))}
      <polyline points={toPoints(healthData)} fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={toPoints(riskData)}   fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={toPoints(bpData)}     fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const EquipmentHealth = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [trendWindow, setTrendWindow] = useState<TrendWindow>("30d");

  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [equipmentBase, setEquipmentBase] = useState<EquipmentBase | null>(() => getCachedEquipmentIdentity(resolvedId));

  useEffect(() => {
    getEquipmentIdentityById(resolvedId).then(setEquipmentBase);
  }, [resolvedId]);

  if (!equipmentBase) {
    return (
      <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
        <div className="border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
          <div className="h-28 animate-pulse rounded-xl bg-[#141820]" />
        </div>
      </section>
    );
  }

  const eq = equipmentBase;
  const hd =
    HEALTH_DATA[eq.id] ??
    HEALTH_DATA[DEFAULT_ID];

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

  const healthColor = hd.healthScore >= 75 ? "#10b981" : hd.healthScore >= 50 ? "#f97316" : "#ef4444";
  const riskColor   = hd.riskScore   >= 70 ? "#ef4444" : hd.riskScore >= 50   ? "#f97316" : "#eab308";
  const bpColor     = hd.breakdownProbability >= 70 ? "#ef4444" : "#f97316";

  const TREND_LABELS: Record<TrendWindow, string> = {
    "30d": "30 Days",
    "7d":  "7 Days",
    "90d": "90 Days",
    "12m": "12 Months",
  };

  const handleTabClick = (tabId: string) => {
    const id = equipmentBase.id;
    if (tabId === "overview") navigate(`/equipment/${id}/overview`);
    if (tabId === "wo")       navigate(`/equipment/${id}/work-orders`);
    if (tabId === "pm")       navigate(`/equipment/${id}/pms`);
    if (tabId === "history")  navigate(`/equipment/${id}/history`);
    if (tabId === "skills")   navigate(`/equipment/${id}/skills`);
    if (tabId === "spares")   navigate(`/equipment/${id}/spares`);
    if (tabId === "docs")     navigate(`/equipment/${id}/documents`);
    if (tabId === "ai")       navigate(`/equipment/${id}/ai-insights`);
    // other tabs are placeholders — no-op for now
  };

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">

      {/* ── Header ──────────────────────────────────────────────────────── */}
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
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                tab.id === "health"
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

      {/* ── Health Content ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">

        {/* ── Row 1: 4 KPI cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* Asset Health Score */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Asset Health Score</span>
                <Badge className="h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none bg-[#eab30820] text-yellow-400">
                  Needs Attention
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                <RingDonut value={hd.healthScore} size={80} strokeWidth={10} color={healthColor} />
                <div className="flex flex-col gap-1">
                  <span className="text-base font-bold text-slate-50">Health Score</span>
                  <span className="text-xs text-slate-400">Stable but trending down</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk Score */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Risk Score</span>
                <Badge className="h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none bg-[#ef444420] text-red-400">
                  High Risk
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                <RingDonut value={hd.riskScore} size={80} strokeWidth={10} color={riskColor} />
                <div className="flex flex-col gap-1">
                  <span className="text-base font-bold text-slate-50">Risk Score</span>
                  <span className="text-xs text-slate-400">High risk of failure</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Breakdown Probability */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Breakdown Probability</span>
                <Badge className="h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none bg-[#ef444420] text-red-400">
                  High
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                <RingDonut value={hd.breakdownProbability} size={80} strokeWidth={10} color={bpColor} />
                <div className="flex flex-col gap-1">
                  <span className="text-base font-bold text-slate-50">Probability</span>
                  <span className="text-xs text-slate-400">Likely in next 5 days</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Equipment Status */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Equipment Status</span>
                <Badge className="h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none bg-[#ef444420] text-red-400">
                  Action Required
                </Badge>
              </div>
              <div className="flex flex-col gap-3 pt-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500/10">
                  <AlertTriangle className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-yellow-400">Needs Attention</span>
                  <span className="text-xs text-slate-400">Action required to prevent downtime</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 2: KPI strip ───────────────────────────────────────────── */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Reliability",      value: hd.reliability,      delta: hd.reliabilityDelta,      icon: <Activity className="h-4 w-4 text-blue-400" /> },
                { label: "Availability",     value: hd.availabilityPct,  delta: hd.availabilityDelta,     icon: <Eye className="h-4 w-4 text-emerald-400" /> },
                { label: "Maintainability",  value: hd.maintainability,  delta: hd.maintainabilityDelta,  icon: <Wrench className="h-4 w-4 text-orange-400" /> },
                { label: "Performance",      value: hd.performance,      delta: hd.performanceDelta,      icon: <Sparkles className="h-4 w-4 text-yellow-400" /> },
                { label: "OEE",              value: hd.oee,              delta: hd.oeeDelta,              icon: <Activity className="h-4 w-4 text-slate-400" /> },
              ].map(({ label, value, delta, icon }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-800">
                    {icon}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-slate-500">{label}</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-slate-50">{value}%</span>
                      <span className={`text-[10px] font-semibold ${deltaClass(delta)}`}>{deltaLabel(delta)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Row 3: Health Trend (left) + Failure Indicators (right) ────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">

          {/* Asset Health Trend */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-200">Asset Health Trend</h2>
                <div className="flex gap-1">
                  {(["30d", "7d", "90d", "12m"] as TrendWindow[]).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setTrendWindow(w)}
                      className={`rounded px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                        trendWindow === w
                          ? "bg-blue-600 text-white"
                          : "text-slate-500 hover:bg-gray-800 hover:text-slate-300"
                      }`}
                    >
                      {TREND_LABELS[w]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-2 flex flex-wrap gap-3">
                {[
                  { label: "Health Score",          color: "#10b981" },
                  { label: "Risk Score",             color: "#f97316" },
                  { label: "Breakdown Probability",  color: "#ef4444" },
                ].map((l) => (
                  <span key={l.label} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="h-0.5 w-5 rounded-sm" style={{ backgroundColor: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
              <HealthTrendChart window={trendWindow} />
            </CardContent>
          </Card>

          {/* Failure Indicators */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Failure Indicators</h2>
              <div className="flex flex-col gap-2">
                {hd.failureIndicators.map((fi) => (
                  <div key={fi.label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-400" aria-hidden="true" />
                      <span className="text-xs text-slate-300">{fi.label}</span>
                    </div>
                    <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${failureLevelClass(fi.level)}`}>
                      {fi.level}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 4: Reliability KPIs | Failure History | AI Analysis ─────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Reliability KPIs */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Reliability KPIs</h2>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {hd.reliabilityKpis.map((kpi) => (
                  <div key={kpi.label} className="flex items-center justify-between py-2">
                    <span className="text-xs text-slate-400">{kpi.label}</span>
                    <span className="text-xs font-semibold text-slate-200">{kpi.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Failure History */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Failure History</h2>
              <div className="mb-2 grid grid-cols-[48px_minmax(0,1fr)_80px_64px] gap-x-2 border-b border-gray-800 pb-1.5">
                {["Date", "Failure", "WO", "Severity"].map((h) => (
                  <span key={h} className="text-[10px] font-semibold text-slate-500">{h}</span>
                ))}
              </div>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {hd.failureHistory.map((row, i) => (
                  <div key={i} className="grid grid-cols-[48px_minmax(0,1fr)_80px_64px] items-start gap-x-2 py-2.5">
                    <span className="text-[11px] text-slate-500">{row.date}</span>
                    <span className="text-[11px] leading-snug text-slate-300">{row.failure}</span>
                    <span className="font-mono text-[11px] text-slate-400">{row.wo}</span>
                    <Badge className={`h-auto w-fit rounded px-1.5 py-0 text-[10px] font-bold uppercase shadow-none ${severityClass(row.severity)}`}>
                      {row.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Health Analysis */}
          <Card className="rounded-xl border border-blue-500/20 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-200">AI Health Analysis</h2>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-slate-300">{hd.aiAnalysis.summary}</p>
              <div className="mb-3 flex flex-col gap-1 border-t border-gray-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Main contributor</span>
                  <span className="text-[11px] font-semibold text-slate-200">{hd.aiAnalysis.mainContributor}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Failure probability</span>
                  <span className="text-[11px] font-semibold text-orange-400">{hd.aiAnalysis.failureProbability}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Likely failure window</span>
                  <span className="text-[11px] font-semibold text-slate-200">{hd.aiAnalysis.likelyWindow}</span>
                </div>
              </div>
              <div className="mb-3 border-t border-gray-800 pt-3">
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Recommended actions</span>
                <ul className="flex flex-col gap-1">
                  {hd.aiAnalysis.actions.map((a) => (
                    <li key={a} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-1.5 border-t border-gray-800 pt-3">
                <span className="text-[11px] text-slate-500">Confidence</span>
                <span className="text-[11px] font-semibold text-emerald-400">● {hd.aiAnalysis.confidence}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 5: Sensor Status | Maintenance Effectiveness | Component Health | Health Impact ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* Sensor Status */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Sensor Status</h2>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {hd.sensorStatus.map((s) => (
                  <div key={s.label} className="flex items-center justify-between py-2">
                    <span className="text-xs text-slate-400">{s.label}</span>
                    <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${sensorStatusClass(s.status)}`}>
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Effectiveness */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Maintenance Effectiveness</h2>
              <div className="flex flex-col items-center gap-4">
                <MaintenanceDonut types={hd.maintenanceTypes} />
                <div className="flex w-full flex-col gap-1.5">
                  {hd.maintenanceTypes.map((t) => (
                    <div key={t.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                        <span className="text-[11px] text-slate-400">{t.label}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-200">{t.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Component Health */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Component Health</h2>
              <div className="flex flex-col gap-3">
                {hd.componentHealth.map((c) => (
                  <div key={c.label} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{c.label}</span>
                      <span className="text-xs font-semibold" style={{ color: c.color }}>{c.value}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full transition-all" style={{ width: `${c.value}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Health Impact */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Health Impact</h2>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {hd.healthImpact.map((hi) => (
                  <div key={hi.label} className="flex items-center justify-between py-2.5">
                    <span className="text-xs text-slate-400">{hi.label}</span>
                    <Badge className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${impactLevelClass(hi.level)}`}>
                      {hi.level}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Footer action bar ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto gap-2 border-gray-700 bg-transparent px-4 py-2 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100"
          >
            <Calendar className="h-3.5 w-3.5" />
            Schedule Inspection
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto gap-2 border-gray-700 bg-transparent px-4 py-2 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100"
          >
            <Wrench className="h-3.5 w-3.5" />
            Raise Work Order
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto gap-2 border-gray-700 bg-transparent px-4 py-2 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100"
          >
            <Activity className="h-3.5 w-3.5" />
            Request Condition Monitoring
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto gap-2 border-gray-700 bg-transparent px-4 py-2 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            View History
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto gap-2 border-gray-700 bg-transparent px-4 py-2 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100"
          >
            <Download className="h-3.5 w-3.5" />
            Export Health Report
          </Button>
        </div>

        {/* ── Bottom sync strip ─────────────────────────────────────────── */}
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
