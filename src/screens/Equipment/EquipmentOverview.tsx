import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronRight,
  Clock,
  Edit,
  FileText,
  RefreshCw,
  Settings,
  Sparkles,
  Users,
  UserCircle,
  Wrench,
  Zap,
} from "lucide-react";
import { DEFAULT_EQUIPMENT_ID, getEquipmentById, EquipmentBase } from "./equipmentData";
import { getEquipmentIdentityById, getCachedEquipmentIdentity, getEquipmentRiskPrediction } from "./equipmentService";
import type { EquipmentRiskPrediction } from "./equipmentService";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";
import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

// ─── Overview-specific data (not in the shared service) ───────────────────────

interface OverviewData {
  healthScore: number;
  breakdownProbability: number;
  reliability: number;
  oee: number;
  nextIntervention: string;
  woOpen: number;
  woOverdue: number;
  woCritical: number;
  latestWo: { ref: string; title: string; created: string; due: string; urgent: boolean };
  pmCompliance: number;
  pmOverdue: number;
  nextPm: string;
  nextPmDue: string;
  pmThisWeek: number;
  primaryEngineer: { initials: string; name: string; role: string };
  skillsMatch: number;
  skillsCoverage: number;
  knowledgeRisk: string;
  backupEngineers: number;
  sparesHealth: number;
  sparesOutOfStock: number;
  sparesCritical: number;
  topRiskSpare: string;
  inventoryValue: string;
  docsTotal: number;
  docsExpiring: number;
  docsReview: number;
  docsSize: string;
  activity: { date: string; time: string; type: string; description: string; ref: string; status: string }[];
  aiRecommendation: string;
  aiRiskImpact: string;
  aiConfidence: number;
  aiDowntimeReduction: number;
  priorityActions: { icon: string; title: string; due: string; level: string; link: string; linkLabel: string }[];
}

const OVERVIEW_DATA: Record<string, OverviewData> = {
  "pl-02": {
    healthScore: 68,
    breakdownProbability: 86,
    reliability: 62,
    oee: 65,
    nextIntervention: "Bearing inspection due in 5 days",
    woOpen: 12,
    woOverdue: 5,
    woCritical: 2,
    latestWo: { ref: "WO-10482", title: "High vibration detected on main arm", created: "24 Apr 2025", due: "Today", urgent: true },
    pmCompliance: 82,
    pmOverdue: 2,
    nextPm: "Daily Visual Inspection",
    nextPmDue: "Due Tomorrow",
    pmThisWeek: 4,
    primaryEngineer: { initials: "JW", name: "James Wilson", role: "Mechanical Engineer" },
    skillsMatch: 88,
    skillsCoverage: 82,
    knowledgeRisk: "Low",
    backupEngineers: 1,
    sparesHealth: 62,
    sparesOutOfStock: 3,
    sparesCritical: 18,
    topRiskSpare: "Vacuum Pump Seal Kit",
    inventoryValue: "£48,760",
    docsTotal: 86,
    docsExpiring: 7,
    docsReview: 12,
    docsSize: "2.48 GB",
    activity: [
      { date: "24 Apr 2025", time: "10:15", type: "Work Order", description: "High vibration detected on main arm", ref: "WO-10482",         status: "OPEN" },
      { date: "23 Apr 2025", time: "16:30", type: "PM",         description: "Daily Visual Inspection completed",  ref: "PM-PL-02-DAILY",   status: "COMPLETED" },
      { date: "22 Apr 2025", time: "14:30", type: "Fault",      description: "PLC communication intermittent",     ref: "WO-10435",         status: "OPEN" },
      { date: "21 Apr 2025", time: "10:30", type: "PM",         description: "Conveyor Lubrication completed",     ref: "PM-PL-02-WEEK-01", status: "COMPLETED" },
      { date: "20 Apr 2025", time: "09:10", type: "Work Order", description: "Gripper alignment check required",   ref: "WO-10491",         status: "IN PROGRESS" },
    ],
    aiRecommendation: "High risk of downtime. Inspect vibration sensors and review PLC logic before next shift.",
    aiRiskImpact: "High",
    aiConfidence: 91,
    aiDowntimeReduction: 23,
    priorityActions: [
      { icon: "alert", title: "Inspect drive-end bearing",     due: "Due in 3 days", level: "HIGH",   link: "/equipment", linkLabel: "Work Orders" },
      { icon: "clock", title: "Review overdue PM",             due: "Due in 3 days", level: "HIGH",   link: "/equipment", linkLabel: "PMs" },
      { icon: "zap",   title: "Check PLC communication fault", due: "Due in 7 days", level: "MEDIUM", link: "/equipment", linkLabel: "Work Orders" },
    ],
  },
  "fl-03": {
    healthScore: 42,
    breakdownProbability: 94,
    reliability: 48,
    oee: 51,
    nextIntervention: "Gearbox inspection required immediately",
    woOpen: 6,
    woOverdue: 4,
    woCritical: 3,
    latestWo: { ref: "WO-10458", title: "Gearbox fault — running at reduced speed", created: "2 May 2025", due: "Today", urgent: true },
    pmCompliance: 64,
    pmOverdue: 3,
    nextPm: "Lubrication Service",
    nextPmDue: "Overdue by 14 days",
    pmThisWeek: 2,
    primaryEngineer: { initials: "JW", name: "James Wilson", role: "Mechanical Engineer" },
    skillsMatch: 72,
    skillsCoverage: 65,
    knowledgeRisk: "High",
    backupEngineers: 0,
    sparesHealth: 38,
    sparesOutOfStock: 5,
    sparesCritical: 24,
    topRiskSpare: "Gearbox Coupling Assembly",
    inventoryValue: "£62,100",
    docsTotal: 94,
    docsExpiring: 11,
    docsReview: 18,
    docsSize: "3.12 GB",
    activity: [
      { date: "2 May 2025",  time: "08:40", type: "Fault",      description: "Gearbox fault — running at reduced speed", ref: "WO-10458",       status: "OPEN" },
      { date: "1 May 2025",  time: "14:20", type: "Work Order", description: "PLC intermittent fault logged",             ref: "WO-10451",       status: "OPEN" },
      { date: "30 Apr 2025", time: "09:00", type: "PM",         description: "Visual inspection completed",               ref: "PM-FL-03-DAILY", status: "COMPLETED" },
      { date: "28 Apr 2025", time: "11:15", type: "Work Order", description: "Conveyor belt tension adjustment",          ref: "WO-10438",       status: "IN PROGRESS" },
      { date: "27 Apr 2025", time: "15:30", type: "Fault",      description: "Line stop — product jam on exit conveyor", ref: "WO-10431",       status: "COMPLETED" },
    ],
    aiRecommendation: "Critical failure risk. Replace gearbox coupling before next shift. Escalate spare delivery timeline immediately.",
    aiRiskImpact: "Critical",
    aiConfidence: 94,
    aiDowntimeReduction: 34,
    priorityActions: [
      { icon: "alert", title: "Inspect gearbox coupling",        due: "Overdue",      level: "HIGH",   link: "/equipment", linkLabel: "Work Orders" },
      { icon: "clock", title: "Complete overdue lubrication PM", due: "14 days late", level: "HIGH",   link: "/equipment", linkLabel: "PMs" },
      { icon: "zap",   title: "PLC fault diagnosis",             due: "Due today",    level: "MEDIUM", link: "/equipment", linkLabel: "Work Orders" },
    ],
  },
};

// Default overview data used for unknown equipment IDs.
const DEFAULT_OVERVIEW: OverviewData = OVERVIEW_DATA[DEFAULT_EQUIPMENT_ID];

// ─── Mini Components ──────────────────────────────────────────────────────────

function DonutChart({ value, size = 72, strokeWidth = 9, color = "#10b981" }: {
  value: number; size?: number; strokeWidth?: number; color?: string;
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
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize={size * 0.22} fontWeight="700">
        {value}%
      </text>
    </svg>
  );
}

function HealthTrendChart() {
  const W = 560;
  const H = 160;
  const PAD = { top: 12, right: 16, bottom: 28, left: 36 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const pts = 20;
  const healthData = [74,72,73,70,71,69,68,70,67,69,68,66,67,69,68,66,67,66,67,68];
  const riskData   = [64,65,66,65,67,68,70,68,70,71,70,72,71,73,72,71,72,73,71,71];
  const availData  = [95,94,95,93,92,93,91,92,90,92,91,89,90,91,89,90,89,88,89,88];

  const xStep = cw / (pts - 1);
  const yScale = (v: number) => ch - (v / 100) * ch;
  const toPoints = (data: number[]) =>
    data.map((v, i) => `${PAD.left + i * xStep},${PAD.top + yScale(v)}`).join(" ");

  const gridLines = [25, 50, 75, 100];
  const xLabels = [
    { label: "25 Mar", idx: 0 },
    { label: "1 Apr",  idx: 7 },
    { label: "8 Apr",  idx: 13 },
    { label: "15 Apr", idx: 19 },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none" aria-label="Equipment Health Trend">
      {gridLines.map((y) => (
        <line key={y}
          x1={PAD.left} y1={PAD.top + yScale(y)}
          x2={W - PAD.right} y2={PAD.top + yScale(y)}
          stroke="#ffffff0d" strokeWidth="1"
        />
      ))}
      {[0, 50, 100].map((y) => (
        <text key={y} x={PAD.left - 4} y={PAD.top + yScale(y) + 4} textAnchor="end" fill="#475569" fontSize="9">{y}%</text>
      ))}
      {xLabels.map(({ label, idx }) => (
        <text key={label} x={PAD.left + idx * xStep} y={H - 6} textAnchor="middle" fill="#475569" fontSize="9">{label}</text>
      ))}
      <polyline points={toPoints(healthData)} fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={toPoints(riskData)}   fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={toPoints(availData)}  fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Card number label ────────────────────────────────────────────────────────

function CardNum({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[10px] font-semibold text-slate-400">
      {n}
    </span>
  );
}

// ─── Status badge helpers ─────────────────────────────────────────────────────

function activityStatusClass(s: string) {
  if (s === "OPEN")        return "bg-[#3b82f620] text-blue-400";
  if (s === "COMPLETED")   return "bg-[#10b98120] text-emerald-400";
  if (s === "IN PROGRESS") return "bg-[#f9731620] text-orange-400";
  return "bg-gray-800 text-slate-400";
}

function levelClass(l: string) {
  if (l === "HIGH" || l === "Critical") return "bg-[#f9731620] text-orange-400";
  if (l === "MEDIUM")                   return "bg-[#eab30820] text-yellow-400";
  return "bg-[#10b98120] text-emerald-400";
}

function priorityIcon(icon: string) {
  switch (icon) {
    case "alert": return <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />;
    case "clock": return <Clock className="h-3.5 w-3.5 text-yellow-400" />;
    default:      return <Zap className="h-3.5 w-3.5 text-blue-400" />;
  }
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

// ─── Main Component ───────────────────────────────────────────────────────────

export const EquipmentOverview = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [activeTab] = useState("overview");

  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [equipmentBase, setEquipmentBase] = useState<EquipmentBase | null>(() =>
    getCachedEquipmentIdentity(resolvedId) ?? getCachedEquipmentIdentity(DEFAULT_EQUIPMENT_ID)
  );
  const [prediction, setPrediction] = useState<EquipmentRiskPrediction | null>(null);

  useEffect(() => {
    getEquipmentIdentityById(resolvedId).then(setEquipmentBase);
    getEquipmentRiskPrediction(resolvedId).then(setPrediction);
  }, [resolvedId]);

  // Identity comes from Supabase (with fallback); overview metrics stay local.
  if (!equipmentBase) {
    return (
      <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
        <div className="border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
          <div className="h-28 animate-pulse rounded-xl bg-[#141820]" />
        </div>
      </section>
    );
  }

  const overviewData =
    OVERVIEW_DATA[equipmentBase.id] ??
    OVERVIEW_DATA[DEFAULT_EQUIPMENT_ID];
  const eq = {
    ...overviewData,
    ...equipmentBase,
  };
  const ovw = overviewData;

  const riskBadgeClass =
    eq.riskLevel === "Critical" ? "bg-[#ef444420] text-red-400" :
    eq.riskLevel === "High"     ? "bg-[#f9731620] text-orange-400" :
    eq.riskLevel === "Medium"   ? "bg-[#eab30820] text-yellow-400" :
    "bg-[#10b98120] text-emerald-400";

  const healthColor =
    ovw.healthScore >= 75 ? "#10b981" :
    ovw.healthScore >= 50 ? "#f97316" : "#ef4444";

  const sparesColor =
    ovw.sparesHealth >= 75 ? "#10b981" :
    ovw.sparesHealth >= 50 ? "#f97316" : "#ef4444";

  const pmColor =
    ovw.pmCompliance >= 80 ? "#10b981" :
    ovw.pmCompliance >= 60 ? "#f97316" : "#ef4444";

  const riskTotal = eq.riskBreakdown.reduce((s, b) => s + b.pct, 0) || 1;

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
            {/* Title row */}
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">{eq.name}</h1>
              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}>
                {eq.riskLevel} Risk
              </Badge>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <EquipmentRiskIndicator riskLevel={eq.riskLevel} />
              <span className="text-sm font-semibold text-slate-200">{eq.status}</span>
              <span className="text-sm text-slate-500">{eq.statusNote}</span>
            </div>

            {/* Metadata chips */}
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
        <EquipmentTabNavigation equipmentId={eq.id} activeTab="overview" />
      </div>

      {/* ── Overview Content ─────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">

          {/* Row 1: Asset Health | Priority Actions | Work Orders */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            {/* 1 — Asset Health Summary */}
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardNum n={1} />
                    <h2 className="text-sm font-semibold text-slate-200">Asset Health Summary</h2>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <DonutChart value={ovw.healthScore} size={72} strokeWidth={8} color={healthColor} />
                  <div className="flex flex-1 flex-col gap-2.5">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Breakdown Probability</span>
                        <Badge className="h-auto rounded px-1.5 py-0 text-[10px] font-bold shadow-none bg-[#ef444420] text-red-400">HIGH</Badge>
                      </div>
                      <span className="text-sm font-bold text-slate-50">{ovw.breakdownProbability}%</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-slate-500">Reliability</span>
                      <span className="text-sm font-semibold text-orange-400">{ovw.reliability}% Needs Attention</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-slate-500">OEE</span>
                      <span className="text-sm font-semibold text-orange-400">{ovw.oee}% Needs Attention</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-blue-400" aria-hidden="true" />
                  <div className="flex flex-col gap-0">
                    <span className="text-[10px] text-slate-500">Next predicted intervention</span>
                    <span className="text-xs font-medium text-slate-200">{ovw.nextIntervention}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2 — Priority Actions */}
            <Card className="rounded-xl border border-orange-500/30 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardNum n={2} />
                    <h2 className="text-sm font-semibold text-slate-200">Priority Actions</h2>
                  </div>
                  <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">View all actions →</button>
                </div>
                <div className="flex flex-col gap-3">
                  {ovw.priorityActions.map((action) => (
                    <div key={action.title} className="flex items-start gap-2.5 rounded-lg border border-gray-800 bg-[#0d1118] p-2.5">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-800">
                        {priorityIcon(action.icon)}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-xs font-semibold leading-snug text-slate-200">{action.title}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-slate-500">{action.due}</span>
                          <span className="text-slate-700">·</span>
                          <Badge className={`h-auto rounded px-1.5 py-0 text-[10px] font-bold uppercase shadow-none ${levelClass(action.level)}`}>
                            {action.level}
                          </Badge>
                          <span className="text-slate-700">·</span>
                          <button type="button" className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                            {action.linkLabel} →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  View all actions →
                </button>
              </CardContent>
            </Card>

            {/* 3 — Work Orders Summary */}
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardNum n={3} />
                    <h2 className="text-sm font-semibold text-slate-200">Work Orders Summary</h2>
                  </div>
                  <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">View Work Orders →</button>
                </div>
                <div className="mb-3 flex items-end gap-4">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-2xl font-bold text-slate-50">{ovw.woOpen}</span>
                    <span className="text-[10px] font-semibold uppercase text-slate-500">Open</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-2xl font-bold text-orange-400">{ovw.woOverdue}</span>
                    <span className="text-[10px] font-semibold uppercase text-slate-500">Overdue</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-2xl font-bold text-red-400">{ovw.woCritical}</span>
                    <span className="text-[10px] font-semibold uppercase text-slate-500">Critical</span>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-800 bg-[#0d1118] p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500">Latest Critical Work Order</span>
                    <Badge className="h-auto rounded px-1.5 py-0 text-[10px] font-bold uppercase shadow-none bg-[#f9731620] text-orange-400">HIGH</Badge>
                  </div>
                  <span className="block text-sm font-bold text-slate-50">{ovw.latestWo.ref}</span>
                  <p className="mt-0.5 text-xs text-slate-400">{ovw.latestWo.title}</p>
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500">
                    <span>Created: {ovw.latestWo.created}</span>
                    <span>·</span>
                    <span className={ovw.latestWo.urgent ? "font-semibold text-red-400" : ""}>Due: {ovw.latestWo.due}</span>
                  </div>
                </div>
                <button type="button" className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  View Work Orders →
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: PM Summary | Skills | Spares */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            {/* 4 — PM Summary */}
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardNum n={4} />
                    <h2 className="text-sm font-semibold text-slate-200">PM Summary</h2>
                  </div>
                  <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">View PMs →</button>
                </div>
                <div className="flex items-center gap-4">
                  <DonutChart value={ovw.pmCompliance} size={68} strokeWidth={8} color={pmColor} />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="flex flex-col">
                      <span className="text-xl font-bold text-slate-50">{ovw.pmOverdue}</span>
                      <span className="text-[11px] font-semibold uppercase text-slate-500">Overdue PMs</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500">Next PM</span>
                      <span className="text-xs font-semibold text-slate-200">{ovw.nextPm}</span>
                      <span className="text-[11px] font-medium text-orange-400">{ovw.nextPmDue}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>{ovw.pmThisWeek} PMs scheduled this week</span>
                </div>
              </CardContent>
            </Card>

            {/* 5 — Skills & Engineer Cover */}
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardNum n={5} />
                    <h2 className="text-sm font-semibold text-slate-200">Skills & Engineer Cover</h2>
                  </div>
                  <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">View Skills →</button>
                </div>
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/30 text-xs font-bold text-blue-300">
                    {ovw.primaryEngineer.initials}
                  </div>
                  <div className="flex flex-col gap-0">
                    <span className="text-sm font-semibold text-slate-200">{ovw.primaryEngineer.name}</span>
                    <span className="text-[11px] text-slate-500">{ovw.primaryEngineer.role}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Skills Match</span>
                      <span className="text-xs font-semibold text-emerald-400">{ovw.skillsMatch}%</span>
                    </div>
                    <Progress value={ovw.skillsMatch} className="h-1.5 rounded bg-gray-800 [&>div]:bg-emerald-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Skills Coverage</span>
                      <span className="text-xs font-semibold text-emerald-400">{ovw.skillsCoverage}%</span>
                    </div>
                    <Progress value={ovw.skillsCoverage} className="h-1.5 rounded bg-gray-800 [&>div]:bg-emerald-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Knowledge Risk</span>
                    <span className={`text-xs font-semibold ${ovw.knowledgeRisk === "Low" ? "text-emerald-400" : ovw.knowledgeRisk === "High" ? "text-red-400" : "text-yellow-400"}`}>
                      {ovw.knowledgeRisk}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                  <Users className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>{ovw.backupEngineers} backup engineer{ovw.backupEngineers !== 1 ? "s" : ""} available</span>
                </div>
              </CardContent>
            </Card>

            {/* 6 — Spares Summary */}
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardNum n={6} />
                    <h2 className="text-sm font-semibold text-slate-200">Spares Summary</h2>
                  </div>
                  <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">View Spares →</button>
                </div>
                <div className="flex items-center gap-4">
                  <DonutChart value={ovw.sparesHealth} size={68} strokeWidth={8} color={sparesColor} />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="flex items-end gap-1.5">
                      <span className="text-2xl font-bold text-red-400">{ovw.sparesOutOfStock}</span>
                      <span className="mb-0.5 text-xs text-slate-500">Out of Stock</span>
                    </div>
                    <div className="flex items-end gap-1.5">
                      <span className="text-2xl font-bold text-slate-50">{ovw.sparesCritical}</span>
                      <span className="mb-0.5 text-xs text-slate-500">Critical Spares</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Top Risk Spare:</span>
                    <span className="text-xs font-medium text-slate-200">{ovw.topRiskSpare}</span>
                    <Badge className="h-auto rounded px-1.5 py-0 text-[10px] font-bold uppercase shadow-none bg-[#ef444420] text-red-400">Critical</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Total Inventory Value</span>
                    <span className="text-xs font-semibold text-slate-200">{ovw.inventoryValue}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 3: Projected Risk */}
          {(() => {
            const trendChips = [
              { label: "Stable",     match: "Stable",     cls: "bg-[#10b98120] text-emerald-400" },
              { label: "Increasing", match: "Increasing", cls: "bg-[#f9731620] text-orange-400" },
              { label: "Escalating", match: "Escalating", cls: "bg-[#ef444420] text-red-400" },
            ];
            const projectedLevelClass = (level: string) =>
              level === "Critical" ? "text-red-400" :
              level === "High"     ? "text-orange-400" :
              level === "Medium"   ? "text-yellow-400" :
              level === "Low"      ? "text-lime-400" : "text-emerald-400";

            return (
              <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CardNum n={7} />
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-200">Projected Risk</h2>
                        <p className="text-[10px] text-slate-500">If no action is taken</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {trendChips.map((chip) => (
                          <span
                            key={chip.label}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              prediction?.trendDirection === chip.match
                                ? chip.cls
                                : "bg-gray-800 text-slate-500"
                            }`}
                          >
                            {chip.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {!prediction ? (
                    <p className="text-sm text-slate-500">No prediction data available for this asset.</p>
                  ) : (
                    <div className="flex flex-col gap-4">

                      {/* Score timeline */}
                      <div className="flex items-start gap-2">
                        {[
                          { label: "Current",  value: prediction.currentScore,  highlight: false },
                          { label: "7 Days",   value: prediction.projected7,    highlight: false },
                          { label: "30 Days",  value: prediction.projected30,   highlight: false },
                          { label: "90 Days",  value: prediction.projected90,   highlight: true  },
                        ].map((pt, i, arr) => (
                          <div key={pt.label} className="flex items-center gap-2">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] text-slate-500">{pt.label}</span>
                              <span className={`text-2xl font-bold ${pt.highlight ? "text-red-400" : "text-slate-50"}`}>
                                {pt.value}
                              </span>
                            </div>
                            {i < arr.length - 1 && (
                              <span className="mb-0 mt-5 text-slate-600">→</span>
                            )}
                          </div>
                        ))}

                        <div className="ml-6 flex flex-col gap-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-slate-500">Projected Level</span>
                            <span className={`text-sm font-bold ${projectedLevelClass(prediction.projectedLevel)}`}>
                              {prediction.projectedLevel}
                            </span>
                          </div>
                          {prediction.primaryDriver && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] text-slate-500">Primary Driver</span>
                              <span className="text-sm font-semibold text-slate-200">{prediction.primaryDriver}</span>
                            </div>
                          )}
                          {prediction.reason && (
                            <p className="max-w-sm text-xs leading-relaxed text-slate-400">{prediction.reason}</p>
                          )}
                        </div>
                      </div>

                      {/* Recommended Action */}
                      {prediction.recommendedAction && (
                        <div className="border-t border-gray-800 pt-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recommended Action</span>
                              <p className="text-sm leading-relaxed text-slate-200">{prediction.recommendedAction}</p>
                            </div>
                            <div className="flex flex-col gap-3">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Expected Outcome</span>
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-slate-500">Current</span>
                                  <span className="text-xl font-bold text-slate-50">{prediction.currentScore}</span>
                                </div>
                                <span className="text-slate-600">→</span>
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-slate-500">After Action</span>
                                  <span className="text-xl font-bold text-emerald-400">{prediction.estimatedScoreAfterAction}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-slate-500">Reduction</span>
                                  <span className="text-sm font-bold text-emerald-400">
                                    ▼{prediction.currentScore - prediction.estimatedScoreAfterAction}
                                  </span>
                                </div>
                              </div>
                              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                                <p className="text-xs leading-relaxed text-emerald-300">
                                  If the recommended action is completed, predicted risk falls from{" "}
                                  <span className="font-bold">{prediction.currentScore}</span> to{" "}
                                  <span className="font-bold">{prediction.estimatedScoreAfterAction}</span>.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Row 4: Latest Activity (2/3) + Documents + AI Recommendation (1/3) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">

            {/* 7 — Latest Activity */}
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardNum n={8} />
                    <h2 className="text-sm font-semibold text-slate-200">Latest Activity</h2>
                  </div>
                  <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">View History →</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="py-1.5 pr-4 text-left font-semibold text-slate-500">Time</th>
                        <th className="py-1.5 pr-4 text-left font-semibold text-slate-500">Type</th>
                        <th className="py-1.5 pr-4 text-left font-semibold text-slate-500">Description</th>
                        <th className="py-1.5 pr-4 text-left font-semibold text-slate-500">Reference</th>
                        <th className="py-1.5 text-left font-semibold text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ovw.activity.map((row, i) => (
                        <tr key={i} className={i !== ovw.activity.length - 1 ? "border-b border-gray-800" : ""}>
                          <td className="py-2.5 pr-4 text-slate-400 whitespace-nowrap">
                            {row.date} {row.time}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              row.type === "Work Order" ? "bg-[#3b82f620] text-blue-400" :
                              row.type === "PM"         ? "bg-[#10b98120] text-emerald-400" :
                              "bg-[#ef444420] text-red-400"
                            }`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-slate-200">{row.description}</td>
                          <td className="py-2.5 pr-4 font-mono text-[11px] text-slate-400">{row.ref}</td>
                          <td className="py-2.5">
                            <Badge className={`h-auto rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shadow-none ${activityStatusClass(row.status)}`}>
                              {row.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Right column: Documents + AI Recommendation */}
            <div className="flex flex-col gap-4">

              {/* 8 — Documents Summary */}
              <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CardNum n={9} />
                      <h2 className="text-sm font-semibold text-slate-200">Documents Summary</h2>
                    </div>
                    <span className="text-sm font-semibold text-slate-300">{ovw.inventoryValue}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                        <FileText className="h-4 w-4 text-blue-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-50">{ovw.docsTotal}</span>
                        <span className="text-[10px] text-slate-500">Total Documents</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                        <Clock className="h-4 w-4 text-orange-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-50">{ovw.docsExpiring}</span>
                        <span className="text-[10px] text-slate-500">Expiring Soon</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10">
                        <AlertTriangle className="h-4 w-4 text-yellow-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-50">{ovw.docsReview}</span>
                        <span className="text-[10px] text-slate-500">Require Review</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700">
                        <Settings className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-50">{ovw.docsSize}</span>
                        <span className="text-[10px] text-slate-500">Total File Size</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 9 — AI Recommendation */}
              <Card className="rounded-xl border border-blue-500/20 bg-[#141820] shadow-none">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CardNum n={10} />
                      <h2 className="text-sm font-semibold text-slate-200">AI Recommendation</h2>
                    </div>
                    <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">View AI Insights →</button>
                  </div>
                  <div className="mb-3 flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                      <Sparkles className="h-4 w-4 text-blue-400" />
                    </div>
                    <p className="text-sm leading-relaxed text-slate-300">{ovw.aiRecommendation}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 border-t border-gray-800 pt-3 text-[11px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500">Risk Impact</span>
                      <span className={`font-semibold ${ovw.aiRiskImpact === "Critical" ? "text-red-400" : ovw.aiRiskImpact === "High" ? "text-orange-400" : "text-yellow-400"}`}>
                        {ovw.aiRiskImpact}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500">Confidence</span>
                      <span className="font-semibold text-emerald-400">↑ {ovw.aiConfidence}%</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500">Pot. Downtime Reduction</span>
                      <span className="font-semibold text-emerald-400">↓ {ovw.aiDowntimeReduction}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Row 4: Health Trend (2/3) + Quick Actions (1/3) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">

            {/* 10 — Equipment Health Trend */}
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardNum n={11} />
                    <h2 className="text-sm font-semibold text-slate-200">Equipment Health Trend (30 Days)</h2>
                  </div>
                  <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">View full report →</button>
                </div>
                <div className="mb-2 flex flex-wrap gap-3">
                  {[
                    { label: "Health Score (%)", color: "#10b981" },
                    { label: "Risk Score (%)",   color: "#f97316" },
                    { label: "Availability (%)", color: "#3b82f6" },
                  ].map((l) => (
                    <span key={l.label} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: l.color }} />
                      {l.label}
                    </span>
                  ))}
                </div>
                <HealthTrendChart />
              </CardContent>
            </Card>

            {/* 11 — Quick Actions */}
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CardNum n={12} />
                  <h2 className="text-sm font-semibold text-slate-200">Quick Actions</h2>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    { Icon: CalendarDays, label: "Schedule Bearing Inspection", sub: "Due in 5 days", highlight: true },
                    { Icon: Wrench,       label: "Create Work Order",           sub: null,           highlight: false },
                    { Icon: Clock,        label: "Create PM",                   sub: null,           highlight: false },
                    { Icon: Settings,     label: "Request Spare",               sub: null,           highlight: false },
                    { Icon: AlertTriangle,label: "Log Downtime",                sub: null,           highlight: false },
                    { Icon: FileText,     label: "Add Note",                    sub: null,           highlight: false },
                  ].map(({ Icon, label, sub, highlight }) => (
                    <button
                      key={label}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-[#1a2030] ${
                        highlight ? "border-orange-500/30 bg-orange-500/5" : "border-gray-800 bg-transparent"
                      }`}
                    >
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${highlight ? "bg-orange-500/15" : "bg-gray-800"}`}>
                        <Icon className={`h-3.5 w-3.5 ${highlight ? "text-orange-400" : "text-slate-400"}`} aria-hidden="true" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className={`truncate text-xs font-medium ${highlight ? "text-slate-200" : "text-slate-300"}`}>{label}</span>
                        {sub && <span className="text-[10px] text-orange-400">{sub}</span>}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-t border-gray-800 py-3 text-xs text-slate-500">
            <span>All data is synced from Vorta Network and SAP PM. Last updated: 24 Apr 2025, 14:41</span>
            <button type="button" aria-label="Refresh" className="text-slate-600 hover:text-slate-400 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Placeholder for other tabs */}
      {activeTab !== "overview" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800">
            <Wrench className="h-5 w-5 text-slate-500" />
          </div>
          <p className="text-sm font-semibold text-slate-400">
            {TABS.find((t) => t.id === activeTab)?.label} tab coming soon
          </p>
          <p className="text-xs text-slate-600">This section will be available in a future update.</p>
        </div>
      )}
    </section>
  );
};