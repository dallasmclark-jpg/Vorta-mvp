import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bell, ChevronRight, Edit, RefreshCw, UserCircle,
  Zap, AlertTriangle, TrendingUp, Activity, Send,
  BarChart2, Brain, Lightbulb, Play, Settings2, Download, FileText,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

import { EquipmentBase, DEFAULT_EQUIPMENT_ID } from "./equipmentData";
import {
  getEquipmentSummary,
  getCachedEquipmentIdentity,
  type EquipmentSummary,
} from "./equipmentService";

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

const TREND_BARS = [
  { month: "Jan", pct: 30 },
  { month: "Feb", pct: 35 },
  { month: "Mar", pct: 45 },
  { month: "Apr", pct: 48 },
  { month: "May", pct: 72 },
  { month: "Jun", pct: 88 },
];

const TIMELINE_ROWS = [
  { label: "Failures",        color: "#ef4444", dots: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1] },
  { label: "Warnings",        color: "#eab308", dots: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1] },
  { label: "Recommendations", color: "#3b82f6", dots: [1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1] },
  { label: "Patterns",        color: "#8b5cf6", dots: [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0] },
];

const SIMILAR_EQ = [
  { id: "PL-04", name: "Palletiser 4", note: "Bearing failed at 13,200 hrs",               noteClass: "text-red-400"    },
  { id: "PL-07", name: "Palletiser 7", note: "PM schedule reduced failures by 40%",         noteClass: "text-emerald-400"},
  { id: "PL-01", name: "Palletiser 1", note: "Same vibration pattern 3 weeks before failure",noteClass: "text-orange-400"},
];

const OPPORTUNITIES = [
  { label: "Spare Network",    saving: "£3,200/yr", desc: "Connect with Palletiser 4 spare pool to reduce stockholding by £3,200/yr.", color: "#10b981" },
  { label: "PM Optimisation",  saving: "£1,800/yr", desc: "AI suggests extending oil change interval from 3 to 4 months based on oil analysis trends.", color: "#3b82f6" },
  { label: "Energy Reduction", saving: "£940/yr",   desc: "Reduce idle power consumption by scheduling auto-shutdown during breaks.", color: "#eab308" },
];

const QUICK_ACTIONS = [
  { Icon: Play,     label: "Run Full Analysis"     },
  { Icon: BarChart2,label: "View Risk Dashboard"   },
  { Icon: FileText, label: "Generate AI Report"    },
  { Icon: Settings2,label: "Configure AI Settings" },
  { Icon: Download, label: "Export Insights"       },
];

const CHAT_MESSAGES = [
  { from: "user", text: "What is the biggest risk for this machine?" },
  { from: "ai",   text: "The drive-end bearing shows an 86% probability of failure within 5–8 days based on vibration analysis and historical patterns." },
];

// ─── Mini chart components ────────────────────────────────────────────────────

function TrendBars({ bars }: { bars: { month: string; pct: number }[] }) {
  const max = Math.max(...bars.map((b) => b.pct), 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {bars.map((b) => (
        <div key={b.month} className="flex flex-1 flex-col items-center gap-1">
          <div className="relative flex w-full flex-col justify-end" style={{ height: "64px" }}>
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${(b.pct / max) * 64}px`,
                backgroundColor: b.pct >= 70 ? "#ef4444" : b.pct >= 45 ? "#eab308" : "#3b82f6",
              }}
            />
          </div>
          <span className="text-[9px] text-slate-500">{b.month}</span>
        </div>
      ))}
    </div>
  );
}

function InsightsTimeline() {
  const months = ["May", "Jul", "Sep", "Nov", "Jan"];
  return (
    <div className="flex flex-col gap-2 pt-1">
      {TIMELINE_ROWS.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 w-28 shrink-0">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="text-[10px] text-slate-400">{row.label}</span>
          </div>
          <div className="flex flex-1 items-center gap-0">
            {row.dots.map((d, i) => (
              <div key={i} className="flex flex-1 items-center justify-center">
                {d ? (
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                ) : (
                  <span className="h-px w-full" style={{ backgroundColor: "#1e2433" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-1 flex pl-28">
        {months.map((m, i) => (
          <div key={m} className="flex-1 text-center" style={{ marginLeft: i === 0 ? 0 : undefined }}>
            <span className="text-[9px] text-slate-600">{m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const EquipmentAiInsights = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [eq, setEq] = useState<EquipmentBase | null>(() => getCachedEquipmentIdentity(resolvedId));
  const [summary, setSummary] = useState<EquipmentSummary | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState(CHAT_MESSAGES);

  useEffect(() => {
    getEquipmentSummary(resolvedId).then((nextSummary) => {
      setSummary(nextSummary);
      setEq(nextSummary.equipment);
    });
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
    "bg-[#10b98120] text-emerald-400";

  const statusDotClass =
    eq.status === "Running" ? "bg-emerald-500" :
    eq.status === "At Risk" ? "bg-orange-400" : "bg-red-500";

  const riskTotal = eq.riskBreakdown.reduce((s, b) => s + b.pct, 0) || 1;
  const topRiskFactor = [...eq.riskBreakdown].sort((a, b) => b.pct - a.pct)[0];

  const openWorkOrderCount = summary?.workOrders.open.length ?? 0;
  const overdueWorkOrderCount = summary?.workOrders.open.filter((wo) => wo.overdue).length ?? 0;
  const overduePmCount = summary?.pms.filter((pm) => pm.status === "OVERDUE").length ?? 0;
  const pmCompliance =
    summary && summary.pms.length > 0
      ? Math.round(summary.pms.reduce((total, pm) => total + pm.compliance, 0) / summary.pms.length)
      : 0;
  const criticalComponentCount = summary?.components.criticalComponents.length ?? 0;
  const topRecommendation =
    overdueWorkOrderCount > 0
      ? "Review overdue work orders"
      : overduePmCount > 0
        ? "Complete overdue PMs"
        : criticalComponentCount > 0
          ? "Review critical spare availability"
          : "Continue monitoring equipment risk";
  const topRecommendationDescription =
    overdueWorkOrderCount > 0
      ? `${overdueWorkOrderCount} overdue work order${overdueWorkOrderCount === 1 ? "" : "s"} require review.`
      : overduePmCount > 0
        ? `${overduePmCount} overdue PM${overduePmCount === 1 ? "" : "s"} require completion.`
        : criticalComponentCount > 0
          ? `${criticalComponentCount} critical component${criticalComponentCount === 1 ? "" : "s"} need stock review.`
          : "No urgent actions found in the current equipment summary.";
  const patternTitle = topRiskFactor
    ? `${topRiskFactor.label} pattern detected`
    : "Pattern monitoring active";
  const patternDescription =
    topRiskFactor
      ? `${topRiskFactor.label} is the highest current contributor in the live equipment risk breakdown.`
      : "No dominant risk pattern is currently available.";

  const recommendedActions = [
    ...(overdueWorkOrderCount > 0
      ? [{ pri: "HIGH", label: "Review overdue work orders", when: `${overdueWorkOrderCount} overdue`, priClass: "bg-red-500/20 text-red-400" }]
      : []),
    ...(overduePmCount > 0
      ? [{ pri: "HIGH", label: "Complete overdue PMs", when: `${overduePmCount} overdue`, priClass: "bg-red-500/20 text-red-400" }]
      : []),
    ...(criticalComponentCount > 0
      ? [{ pri: "MEDIUM", label: "Review critical spares", when: `${criticalComponentCount} critical`, priClass: "bg-yellow-500/20 text-yellow-400" }]
      : []),
    ...(eq.riskLevel === "Critical" || eq.riskLevel === "High"
      ? [{ pri: eq.riskLevel === "Critical" ? "HIGH" : "MEDIUM", label: "Monitor equipment risk", when: `${eq.riskLevel} risk`, priClass: eq.riskLevel === "Critical" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400" }]
      : []),
  ];

  const trendBars = [
    { month: "Now", pct: Math.max(eq.riskScore - 20, 0) },
    { month: "+1", pct: Math.max(eq.riskScore - 10, 0) },
    { month: "+2", pct: eq.riskScore },
    { month: "+3", pct: Math.min(eq.riskScore + 5, 100) },
    { month: "+4", pct: Math.min(eq.riskScore + 10, 100) },
    { month: "+5", pct: Math.min(eq.riskScore + 15, 100) },
  ];
  const trendMessage =
    eq.riskLevel === "Critical"
      ? "Critical risk — immediate intervention recommended"
      : eq.riskLevel === "High"
        ? "High risk — intervention recommended"
        : "Risk stable — continue monitoring";

  const handleTabClick = (tabId: string) => {
    const id = eq.id;
    if (tabId === "overview") navigate(`/equipment/${id}/overview`);
    if (tabId === "health")   navigate(`/equipment/${id}/health`);
    if (tabId === "wo")       navigate(`/equipment/${id}/work-orders`);
    if (tabId === "pm")       navigate(`/equipment/${id}/pms`);
    if (tabId === "history")  navigate(`/equipment/${id}/history`);
    if (tabId === "skills")   navigate(`/equipment/${id}/skills`);
    if (tabId === "spares")   navigate(`/equipment/${id}/spares`);
    if (tabId === "docs")     navigate(`/equipment/${id}/documents`);
  };

  const handleSend = () => {
    const txt = chatInput.trim();
    if (!txt) return;
    setMessages((prev) => [
      ...prev,
      { from: "user", text: txt },
      { from: "ai", text: "Analysing equipment data... I'll provide an AI-driven response based on sensor readings, maintenance history, and failure patterns for this asset." },
    ]);
    setChatInput("");
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
                tab.id === "ai"
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

        {/* Page title + action */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-50">AI Health Summary</h2>
            <p className="max-w-xl text-xs text-slate-500">
              AI continuously analyses equipment data, work orders, PM compliance, failure history and industry benchmarks to identify risks, patterns and opportunities.
            </p>
          </div>
          <Button type="button"
            className="h-auto gap-1.5 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 shadow-none">
            <Play className="h-3.5 w-3.5" /> Run Analysis
          </Button>
        </div>

        {/* ── Row 1: Top Risk | Top Recommendation | PM Compliance | Pattern ─ */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* Top Risk */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <Badge className="mb-2 inline-flex h-auto gap-1 rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-bold shadow-none text-red-400">
                <AlertTriangle className="h-3 w-3" /> Top Risk
              </Badge>
              <h3 className="mb-1.5 text-sm font-bold text-slate-50">{topRiskFactor?.label ?? "Risk Factor"}</h3>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                Highest current risk driver based on the live equipment risk breakdown.
              </p>
              <div className="mb-3 flex gap-4">
                <div>
                  <p className="text-[10px] text-slate-500">Failure Probability</p>
                  <p className="text-xl font-bold text-red-400">{topRiskFactor?.pct ?? eq.riskScore}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Failure Window</p>
                  <p className="text-xl font-bold text-orange-400">
                    {eq.riskLevel === "Critical" ? "Immediate" : eq.riskLevel === "High" ? "Monitor" : "Stable"}
                  </p>
                </div>
              </div>
              <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View full analysis →
              </button>
            </CardContent>
          </Card>

          {/* Top Recommendation */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <Badge className="mb-2 inline-flex h-auto gap-1 rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold shadow-none text-blue-400">
                <Zap className="h-3 w-3" /> Top Recommendation
              </Badge>
              <h3 className="mb-1.5 text-sm font-bold text-slate-50">{topRecommendation}</h3>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                {topRecommendationDescription}
              </p>
              <div className="mb-3 flex gap-4">
                <div>
                  <p className="text-[10px] text-slate-500">Impact</p>
                  <p className="text-sm font-bold text-orange-400">
                    {overdueWorkOrderCount > 0 || overduePmCount > 0 ? "High" : criticalComponentCount > 0 ? "Medium" : "Low"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Confidence</p>
                  <p className="text-sm font-bold text-blue-400">
                    {summary ? "Live" : "Loading"}
                  </p>
                </div>
              </div>
              <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View recommendation →
              </button>
            </CardContent>
          </Card>

          {/* PM Compliance */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <Badge className="mb-2 inline-flex h-auto gap-1 rounded bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold shadow-none text-yellow-400">
                <Activity className="h-3 w-3" /> PM Compliance
              </Badge>
              <h3 className="mb-1.5 text-sm font-bold text-slate-50">
                {overduePmCount > 0 ? "Overdue PM Compliance" : "PM Compliance"}
              </h3>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                PM compliance is derived from the current PM schedule for this equipment.
              </p>
              <div className="mb-3 flex gap-4">
                <div>
                  <p className="text-[10px] text-slate-500">Compliance</p>
                  <p className="text-xl font-bold text-red-400">{pmCompliance}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Overdue PMs</p>
                  <p className="text-xl font-bold text-orange-400">{overduePmCount}</p>
                </div>
              </div>
              <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View compliance →
              </button>
            </CardContent>
          </Card>

          {/* Pattern Detected */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <Badge className="mb-2 inline-flex h-auto gap-1 rounded bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold shadow-none text-purple-400">
                <TrendingUp className="h-3 w-3" /> Pattern Detected
              </Badge>
              <h3 className="mb-1.5 text-sm font-bold text-slate-50">{patternTitle}</h3>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                {patternDescription}
              </p>
              <div className="mb-3 flex gap-4">
                <div>
                  <p className="text-[10px] text-slate-500">Severity</p>
                  <p className="text-sm font-bold text-red-400">{eq.riskLevel}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Confidence</p>
                  <p className="text-sm font-bold text-orange-400">{topRiskFactor?.pct ?? eq.riskScore}%</p>
                </div>
              </div>
              <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View pattern →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 2: Timeline | At-Risk Factors ─────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* AI Insights Timeline */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-4 text-sm font-semibold text-slate-200">AI Insights Timeline</h3>
              <InsightsTimeline />
            </CardContent>
          </Card>

          {/* At-Risk Factors */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-4 text-sm font-semibold text-slate-200">At-Risk Factors</h3>
              <div className="flex flex-col gap-3">
                {eq.riskBreakdown.length > 0 ? (
                  eq.riskBreakdown.map((factor) => (
                    <div key={factor.label} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-[11px] text-slate-400">{factor.label}</span>
                      <div className="flex-1 h-2 overflow-hidden rounded-full bg-gray-800">
                        <div className="h-full rounded-full" style={{ width: `${factor.pct}%`, backgroundColor: factor.color }} />
                      </div>
                      <span className="w-20 shrink-0 text-right text-[11px] font-semibold text-slate-300">{factor.pct}%</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No risk breakdown available.</p>
                )}
              </div>
              <button type="button" className="mt-4 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View Risk Analysis →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 3: Similar Equipment | Predicted Trend | AI Actions ──────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Similar Equipment Insights */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-1 text-sm font-semibold text-slate-200">Similar Equipment Insights</h3>
              <p className="mb-3 text-[11px] text-slate-500">Insights from similar palletisers across the network.</p>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {SIMILAR_EQ.map((s) => (
                  <div key={s.id} className="py-3">
                    <p className="text-xs font-semibold text-slate-200">{s.name} <span className="text-slate-500">({s.id})</span></p>
                    <p className={`text-[11px] ${s.noteClass}`}>{s.note}</p>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View Fleet Comparison →
              </button>
            </CardContent>
          </Card>

          {/* Predicted Risk Trend */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Predicted Risk Trend</h3>
              <TrendBars bars={trendBars} />
              <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-orange-500/10 px-2.5 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                <span className="text-[11px] text-orange-400">{trendMessage}</span>
              </div>
              <button type="button" className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View Trend Analysis →
              </button>
            </CardContent>
          </Card>

          {/* AI Recommended Actions */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">AI Recommended Actions</h3>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {recommendedActions.length > 0 ? (
                  recommendedActions.map((a) => (
                  <div key={a.label} className="flex items-center gap-3 py-3">
                    <Badge className={`h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-bold shadow-none ${a.priClass}`}>
                      {a.pri}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200">{a.label}</p>
                      <p className="text-[10px] text-slate-500">{a.when}</p>
                    </div>
                  </div>
                  ))
                ) : (
                  <p className="py-3 text-xs text-slate-500">No recommended actions at this time.</p>
                )}
              </div>
              <button type="button" className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View All Actions →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 4: Opportunity Analysis | AI Chat ─────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* AI Opportunity Analysis */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-400" />
                <h3 className="text-sm font-semibold text-slate-200">AI Opportunity Analysis</h3>
              </div>
              <div className="flex flex-col gap-0 divide-y divide-gray-800">
                {OPPORTUNITIES.map((opp) => (
                  <div key={opp.label} className="flex items-start gap-3 py-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${opp.color}20` }}>
                      <span className="text-[10px] font-bold" style={{ color: opp.color }}>£</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">{opp.label}</span>
                        <Badge className="h-auto rounded px-1.5 py-0 text-[9px] font-bold shadow-none"
                          style={{ backgroundColor: `${opp.color}20`, color: opp.color }}>
                          {opp.saving}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">{opp.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View All Opportunities →
              </button>
            </CardContent>
          </Card>

          {/* AI Chat Assistant */}
          <Card className="rounded-xl border border-blue-500/20 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="mb-1 flex items-center gap-2">
                <Brain className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-200">AI Chat Assistant</h3>
              </div>
              <p className="mb-3 text-[11px] text-slate-500">
                Ask questions about this equipment's health, history, and maintenance.
              </p>

              <div className="flex max-h-52 flex-col gap-2 overflow-y-auto rounded-lg bg-[#0f1218] p-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
                      m.from === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-slate-200"
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Ask about this equipment..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1 rounded-lg border border-gray-700 bg-[#0f1218] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                />
                <button type="button" onClick={handleSend}
                  className="flex h-8 w-16 shrink-0 items-center justify-center gap-1 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
                  <Send className="h-3 w-3" /> Send
                </button>
              </div>
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
