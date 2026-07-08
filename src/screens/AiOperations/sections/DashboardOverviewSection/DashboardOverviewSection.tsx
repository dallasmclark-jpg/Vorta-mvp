import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  UserCircle,
  ChevronDown,
  X,
} from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import {
  getAreaRiskProfiles,
  getSiteRiskProfile,
  getAreaInterventionPlans,
  type AreaRiskProfile,
  type SiteRiskProfile,
  type AreaInterventionPlan,
} from "../../../Equipment/equipmentService";

// ─── RiskMeter ────────────────────────────────────────────────────────────────

const RiskMeter = ({
  value,
  fillClassName,
}: {
  value: number;
  fillClassName: string;
}) => (
  <div className="relative h-3 w-full overflow-visible rounded-full bg-[#050914]">
    <div
      className={`h-full rounded-l-full rounded-r-none ${fillClassName}`}
      style={{ width: `${value}%` }}
    />
    <span
      className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-slate-100 shadow-[0_0_6px_rgba(255,255,255,0.35)]"
      style={{ left: `calc(${value}% - 2px)` }}
      aria-hidden="true"
    />
  </div>
);

// ─── Building static display config ──────────────────────────────────────────

const labourRiskItems = [
  {
    title: "Shift Cover",
    slug: "shift-cover",
    level: "Critical",
    score: "85",
    description: "Night Shift Coverage Gap",
    metricLabel: "Shifts uncovered",
    metricValue: "3",
    extraLabel: "Cover required",
    extraValue: "12h",
    label: "Critical shortage",
    progress: 85,
    badgeClassName: "bg-[#ef444420] text-red-500 hover:bg-[#ef444420]",
    progressClassName: "bg-red-500",
  },
  {
    title: "Single Point Risk",
    slug: "single-point-failure",
    level: "High",
    score: "72",
    description: "No PLC backup trained",
    metricLabel: "Key person risk",
    metricValue: "1",
    extraLabel: "Backup trained",
    extraValue: "0",
    label: "No backup available",
    progress: 72,
    badgeClassName: "bg-[#facc1520] text-yellow-400 hover:bg-[#facc1520]",
    progressClassName: "bg-orange-500",
  },
  {
    title: "Annual Leave",
    slug: "annual-leave",
    level: "Med",
    score: "68",
    description: "Peak leave overlap",
    metricLabel: "Engineers off",
    metricValue: "3",
    extraLabel: "Critical cover",
    extraValue: "Low",
    label: "Peak overlap risk",
    progress: 68,
    badgeClassName: "bg-[#facc1520] text-yellow-400 hover:bg-[#facc1520]",
    progressClassName: "bg-yellow-400",
  },
  {
    title: "Training Risk",
    slug: "training-expiring",
    level: "Med",
    score: "54",
    description: "Safety certs expiring",
    metricLabel: "Certs expiring",
    metricValue: "2",
    extraLabel: "Next expiry",
    extraValue: "3 days",
    label: "Expiry imminent",
    progress: 54,
    badgeClassName: "bg-[#facc1520] text-yellow-400 hover:bg-[#facc1520]",
    progressClassName: "bg-yellow-400",
  },
];

const kpiItems = [
  { label: "Total Assets", value: "142" },
  { label: "At Risk Assets", value: "24" },
  { label: "PM Backlog", value: "8" },
  { label: "PM Compliance", value: "92%" },
  { label: "Calibrations Due This Week", value: "3" },
  { label: "Open Work Orders", value: "12" },
  { label: "Downtime MTD", value: "14h" },
];

const atRiskAssets = [
  { id: "case-packer-4", asset: "Case Packer 4", area: "Building 2 / Packing", risk: "Critical", riskClass: "text-red-500", status: "Overdue", highlight: true },
  { id: "boiler-1", asset: "Boiler 1", area: "Utilities", risk: "High", riskClass: "text-yellow-400", status: "Due Today", highlight: false },
  { id: "line-2-plc", asset: "Line 2 PLC", area: "Building 2", risk: "High", riskClass: "text-yellow-400", status: "Active", highlight: false },
  { id: "press-line-motor", asset: "Press Line Motor", area: "Processing", risk: "Medium", riskClass: "text-yellow-400", status: "Scheduled", highlight: false },
  { id: "warehouse-forklift-3", asset: "Warehouse Forklift 3", area: "Warehouse", risk: "Low", riskClass: "text-emerald-500", status: "Standby", highlight: false },
];

const recommendedActions = [
  {
    title: "Reallocate Sarah Jones to Case Packer 4.",
    asset: "Case Packer 4",
    status: "Open",
    statusBadgeClass: "bg-[#10b98120] text-emerald-500",
    statusDotClass: "bg-emerald-500",
    priority: "High",
    category: "Labour",
    categoryClass: "bg-[#facc1520] text-yellow-400",
  },
  {
    title: "Arrange contractor fallback for Boiler 1.",
    asset: "Boiler 1",
    status: "Review",
    statusBadgeClass: "bg-[#facc1520] text-yellow-400",
    statusDotClass: "bg-yellow-400",
    priority: "High",
    category: "Maintenance",
    categoryClass: "bg-[#ef444420] text-red-500",
  },
  {
    title: "Train Liam on Siemens S7 before shutdown.",
    asset: "Press Line",
    status: "Open",
    statusBadgeClass: "bg-[#10b98120] text-emerald-500",
    statusDotClass: "bg-emerald-500",
    priority: "Med",
    category: "Training",
    categoryClass: "bg-[#facc1520] text-yellow-400",
  },
];

const upcomingExpiries = [
  { label: "Calibration: Boiler 1", value: "Tomorrow" },
  { label: "Training: PLC Level 2", value: "In 3 days" },
  { label: "Contract: Electrical", value: "In 1 week" },
];

const recentActivity = [
  { Icon: CheckCircle2, iconClass: "text-emerald-500", text: "PM completed on Case Packer 3" },
  { Icon: AlertTriangle, iconClass: "text-yellow-400", text: "Fault detected on Line 2 PLC" },
  { Icon: Clock, iconClass: "text-slate-400", text: "Downtime logged on Press Line" },
];

const downtimeImpact = [
  { label: "Total Downtime", value: "14h 20m", valueClass: "text-xl font-semibold" },
  { label: "Cost Impact", value: "$12,400", valueClass: "text-xl font-semibold" },
  { label: "Top Cause", value: "Electrical Faults", valueClass: "text-sm font-semibold" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const DashboardOverviewSection = (): JSX.Element => {
  const navigate = useNavigate();
  const [areaRiskCards, setAreaRiskCards] = useState<AreaRiskProfile[]>([]);
  const [siteRisk, setSiteRisk] = useState<SiteRiskProfile | null>(null);
  const [isRiskDetailOpen, setIsRiskDetailOpen] = useState(false);
  const [interventionPlans, setInterventionPlans] = useState<AreaInterventionPlan[]>([]);
  const [selectedInterventionPlan, setSelectedInterventionPlan] = useState<AreaInterventionPlan | null>(null);

  useEffect(() => {
    getAreaRiskProfiles().then(setAreaRiskCards);
    getSiteRiskProfile().then(setSiteRisk);
    getAreaInterventionPlans().then(setInterventionPlans);
  }, []);

  const handleAssetClick = (id: string) => {
    navigate(`/equipment/${id}/overview`);
  };

  return (
    <section className="flex w-full flex-col gap-6 px-4 pb-12 pt-4 md:px-6 xl:px-8">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Operations Overview
          </h1>
          <p className="text-sm text-slate-400">
            Risk intelligence across plant, people and assets.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            className="h-auto border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-50 shadow-none hover:bg-white/15 hover:text-slate-50"
          >
            Run Risk Analysis
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

      {/* ── Site Risk Briefing ───────────────────────────────────────── */}
      <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5">
          <div className="flex flex-col gap-5">

            {/* Card header */}
            <header className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <Badge className="w-fit rounded bg-[#ef444420] px-2 py-1 text-xs font-semibold tracking-wider text-red-400 hover:bg-[#ef444420]">
                  RISK INTELLIGENCE
                </Badge>
                <h2 className="text-base font-semibold text-slate-50">
                  Site Risk Briefing
                </h2>
              </div>
              <div className="flex flex-col items-end gap-0.5 text-right">
                <p className="text-xs text-slate-400">Based on latest import</p>
                <p className="text-xs text-slate-500">SAP / Skills / Training data refreshed 2h ago</p>
              </div>
            </header>

            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="flex flex-col gap-0.5 rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2.5">
                <p className="text-xs text-slate-500">Site Risk</p>
                <p className="text-xl font-semibold text-slate-50">{siteRisk?.riskScore ?? "—"}</p>
                <p className="text-xs text-orange-400">{siteRisk ? `${siteRisk.riskLevel} · live` : "No live data"}</p>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg border border-red-500/30 bg-[#0d1117] px-3 py-2.5">
                <p className="text-xs text-slate-500">Highest Area</p>
                <p className="text-base font-semibold text-slate-50">{siteRisk?.highestArea ?? "—"}</p>
                <p className="text-xs text-red-400">{siteRisk?.highestAreaLevel ? `${siteRisk.highestAreaLevel} risk` : "No live data"}</p>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2.5">
                <p className="text-xs text-slate-500">PM Backlog</p>
                <p className="text-xl font-semibold text-slate-50">{siteRisk?.overduePmCount ?? "—"}</p>
                <p className="text-xs text-orange-400">Overdue PMs</p>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2.5">
                <p className="text-xs text-slate-500">Calibration Backlog</p>
                <p className="text-xl font-semibold text-slate-50">{siteRisk?.calibrationBacklogCount ?? "—"}</p>
                <p className="text-xs text-yellow-400">Due / overdue</p>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2.5">
                <p className="text-xs text-slate-500">Cover Gaps</p>
                <p className="text-xl font-semibold text-slate-50">{siteRisk?.coverGapCount ?? "—"}</p>
                <p className="text-xs text-yellow-400">Labour risk</p>
              </div>
            </div>

            {/* Priority action summary */}
            <div className="flex flex-col gap-3 rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400">
                  Priority Action
                </p>
                <p className="text-sm font-semibold leading-snug text-slate-50">
                  {siteRisk?.priorityAction ?? "Review highest-risk area and clear the largest leading risk driver."}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <Badge className="rounded bg-[#10b98120] px-2 py-1 text-xs font-medium text-emerald-500 hover:bg-[#10b98120]">
                  94% Confidence
                </Badge>

                <Button
                  type="button"
                  variant="secondary"
                  className="h-auto rounded-lg border border-solid border-[#ffffff20] bg-[#ffffff1a] px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-[#ffffff24]"
                >
                  View Action Queue
                </Button>

                <button
                  type="button"
                  onClick={() => setIsRiskDetailOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-slate-50"
                >
                  {isRiskDetailOpen ? "Hide risk detail" : "View risk detail"}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      isRiskDetailOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {/* Expandable risk detail drawer */}
            {isRiskDetailOpen && (
              <div className="border-t border-gray-800 pt-4">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Current Risk Drivers
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {[
                        "Building 2 PM backlog increased by 6%",
                        "Case Packer 4 remains highest asset risk",
                        "Utilities calibration backlog rising",
                        "Night shift PLC cover gap identified",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                          <span
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500"
                            aria-hidden="true"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Risk Impact
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {[
                        "Increased chance of repeat downtime on Case Packer 4",
                        "Reduced technical cover overnight",
                        "Compliance exposure increasing in Utilities",
                        "Maintenance backlog pressure rising before weekend",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                          <span
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                            aria-hidden="true"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border border-gray-800 bg-[#0d1117] p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Secondary Focus
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {[
                        "Review Utilities calibration backlog",
                        "Arrange PLC night shift cover before 18:00",
                      ].map((action) => (
                        <li key={action} className="flex items-start gap-2 text-xs text-slate-400">
                          <span
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500"
                            aria-hidden="true"
                          />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Plant Area Risk ──────────────────────────────────────────── */}
      <section className="flex w-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-50">Plant Area Risk</h2>
          <button
            type="button"
            onClick={() => navigate("/equipment")}
            className="text-sm font-medium text-blue-500 transition-colors hover:text-blue-400"
          >
            View all plant areas →
          </button>
        </div>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {areaRiskCards.slice(0, 4).map((area) => {
            const riskLabel = area.riskLevel;
            const isHighestRisk = areaRiskCards[0]?.area === area.area;
            const interventionPlan = interventionPlans.find((plan) => plan.area === area.area);

            const badgeClass =
              area.riskScore >= 85 ? "bg-red-500/20 text-red-400" :
              area.riskScore >= 65 ? "bg-orange-500/20 text-orange-400" :
              area.riskScore >= 40 ? "bg-yellow-500/20 text-yellow-400" :
              area.riskScore >= 20 ? "bg-green-500/20 text-green-400" :
              "bg-cyan-500/20 text-cyan-400";

            const progressClass =
              area.riskScore >= 85 ? "bg-red-500" :
              area.riskScore >= 65 ? "bg-orange-500" :
              area.riskScore >= 40 ? "bg-yellow-400" :
              area.riskScore >= 20 ? "bg-emerald-500" :
              "bg-cyan-400";

            const driver =
              area.calibrationOverdueCount > 0 ? "Calibration backlog" :
              area.overduePmCount > 0 ? "PM backlog" :
              area.criticalSparesMissing > 0 ? "Critical spares" :
              area.singlePointSkillGapCount > 0 ? "Skills coverage" :
              "Stable leading indicators";

            const trend =
              isHighestRisk ? "Highest site area risk" :
              area.riskScore >= 65 ? "Elevated risk" :
              area.riskScore >= 40 ? "Monitor closely" :
              "Stable";

            return (
              <Card
                key={area.area}
                onClick={() => navigate(`/equipment?area=${encodeURIComponent(area.area)}`)}
                className={`cursor-pointer rounded-xl border bg-[#141820] shadow-none transition-colors hover:bg-[#181e2a] ${
                  isHighestRisk
                    ? "border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.10)] hover:border-red-500/70"
                    : "border-gray-800 hover:border-gray-700"
                }`}
              >
                <CardContent className="flex h-full flex-col items-start gap-3 p-4">
                  <div className="flex w-full items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-50">{area.area}</h3>
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${badgeClass}`}>
                      {riskLabel}
                    </span>
                  </div>

                  <p className="min-h-9 self-stretch text-xs text-slate-400">
                    {driver}
                  </p>

                  <div className="flex w-full flex-col gap-1">
                    <p className="text-xs text-slate-400">Area risk score</p>
                    <p className="text-xl font-semibold text-slate-50">{area.riskScore || "—"}</p>
                  </div>

                  <dl className="flex w-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-sm text-slate-400">Highest asset</dt>
                      <dd className="text-right text-sm font-semibold text-slate-50">
                        {area.highestAssetName ?? "—"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-sm text-slate-400">Overdue PMs</dt>
                      <dd className="text-sm font-semibold text-slate-50">{area.overduePmCount}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-sm text-slate-400">Calibration backlog</dt>
                      <dd className="text-sm font-semibold text-slate-50">{area.calibrationOverdueCount}</dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex w-full flex-col gap-1.5 pt-1">
                    <RiskMeter value={area.riskScore} fillClassName={progressClass} />
                    <p className="text-xs text-slate-400">{trend}</p>
                    {interventionPlan && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedInterventionPlan(interventionPlan); }}
                        className="mt-1 w-fit rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-400 transition-colors hover:border-blue-400/50 hover:bg-blue-500/15 hover:text-blue-300"
                      >
                        View intervention plan →
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {areaRiskCards.length === 0 && (
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4 text-sm text-slate-400">
                Area risk data is not available yet.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Intervention Plan Modal */}
        {selectedInterventionPlan && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setSelectedInterventionPlan(null)}
          >
            <div
              className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-[#141820] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-start justify-between gap-4 border-b border-gray-800 px-6 py-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recommended Maintenance Intervention</p>
                  <h2 className="mt-0.5 text-base font-semibold text-slate-50">{selectedInterventionPlan.area}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedInterventionPlan(null)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="flex flex-col gap-6">

                  {/* Hero comparison */}
                  <div className="flex flex-wrap items-center gap-6 rounded-lg border border-gray-800 bg-[#0d1117] px-5 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500">Current Risk</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold text-slate-50">{selectedInterventionPlan.currentRiskScore}</span>
                        <span className="text-sm font-semibold text-orange-400">{selectedInterventionPlan.currentRiskLevel}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <span className="text-slate-600">→</span>
                      <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                        {selectedInterventionPlan.recommendedOption}
                      </span>
                      <span className="text-slate-600">→</span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500">Predicted Risk</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold text-emerald-400">{selectedInterventionPlan.recommendedPredictedRiskScore}</span>
                        <span className="text-sm font-semibold text-emerald-400">{selectedInterventionPlan.recommendedPredictedRiskLevel}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500">Reduction</span>
                      <span className="text-3xl font-bold text-emerald-400">▼{selectedInterventionPlan.recommendedReduction}</span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500">Efficiency</span>
                      <span className="text-lg font-semibold text-slate-200">{selectedInterventionPlan.recommendedEfficiency} risk pts/hr</span>
                    </div>
                  </div>

                  {selectedInterventionPlan.justification && (
                    <p className="text-xs text-slate-400">{selectedInterventionPlan.justification}</p>
                  )}

                  {/* Options table */}
                  {selectedInterventionPlan.options.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Intervention Options</h3>
                      <div className="overflow-x-auto rounded-lg border border-gray-800">
                        <table className="w-full min-w-[560px] border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-gray-800 bg-[#0d1117]">
                              {["Option", "Duration", "Predicted Risk", "Reduction", "Efficiency", "Impact"].map((col) => (
                                <th key={col} className="px-3 py-2.5 text-left font-semibold text-slate-500">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedInterventionPlan.options.map((opt, i) => (
                              <tr
                                key={i}
                                className={`border-b border-gray-800 last:border-0 ${
                                  opt.recommended ? "bg-blue-500/5" : "bg-transparent"
                                }`}
                              >
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className={opt.recommended ? "font-semibold text-slate-50" : "text-slate-300"}>{opt.option}</span>
                                    {opt.recommended && (
                                      <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-400">Recommended</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-slate-400">{opt.durationHours} hrs</td>
                                <td className="px-3 py-2.5">
                                  <span className={opt.recommended ? "font-semibold text-emerald-400" : "text-slate-300"}>
                                    {opt.predictedRiskScore} <span className="text-slate-500">{opt.predictedRiskLevel}</span>
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 font-semibold text-emerald-400">▼{opt.reduction}</td>
                                <td className="px-3 py-2.5 text-slate-400">{opt.efficiency} pts/hr</td>
                                <td className="px-3 py-2.5 text-slate-400">{opt.productionImpact}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Target work package */}
                  {Object.keys(selectedInterventionPlan.targetWorkPackage).length > 0 && (
                    <div>
                      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Target Work Package</h3>
                      <div className="flex flex-wrap gap-3">
                        {[
                          { key: "targetAssets",       label: "Target assets" },
                          { key: "overduePMs",          label: "Overdue PMs" },
                          { key: "calibrationBacklog",  label: "Calibration backlog" },
                          { key: "criticalSpares",      label: "Critical spares" },
                          { key: "skillGaps",           label: "Skill gaps" },
                        ].filter(({ key }) => (selectedInterventionPlan.targetWorkPackage as Record<string, number>)[key] !== undefined)
                         .map(({ key, label }) => (
                          <div key={key} className="flex flex-col items-center rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-2.5">
                            <span className="text-xl font-bold text-slate-50">
                              {(selectedInterventionPlan.targetWorkPackage as Record<string, number>)[key]}
                            </span>
                            <span className="text-[10px] text-slate-500">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Required resources */}
                  {selectedInterventionPlan.resourceRequirements.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Required Resources</h3>
                      <div className="flex flex-col gap-2">
                        {selectedInterventionPlan.resourceRequirements.map((req, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3">
                            <span className="text-sm font-semibold text-slate-200">{req.role}</span>
                            <div className="flex items-center gap-6 text-xs text-slate-400">
                              <span>Engineers required: <span className="font-semibold text-slate-200">{req.engineers}</span></span>
                              <span>Estimated labour: <span className="font-semibold text-slate-200">{req.estimatedHours} hrs</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedInterventionPlan.dateNote && (
                        <p className="mt-2.5 text-[11px] text-slate-500">{selectedInterventionPlan.dateNote}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-between gap-3 border-t border-gray-800 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setSelectedInterventionPlan(null)}
                  className="text-sm text-slate-400 transition-colors hover:text-slate-200"
                >
                  Close
                </button>
                <Button
                  type="button"
                  onClick={() => {
                    navigate(`/equipment?area=${encodeURIComponent(selectedInterventionPlan.area)}`);
                    setSelectedInterventionPlan(null);
                  }}
                  className="h-auto bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  Open equipment for this area →
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Labour Risk ─────────────────────────────────────────────── */}
      <section className="flex w-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-50">Labour Risk</h2>
          <button
            type="button"
            onClick={() => navigate("/maintenance/labour-risk/shift-cover")}
            className="text-sm font-medium text-blue-500 transition-colors hover:text-blue-400"
          >
            View all labour risks →
          </button>
        </div>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {labourRiskItems.map((item) => (
            <Card
              key={item.title}
              onClick={() => navigate(`/maintenance/labour-risk/${item.slug}`)}
              className="cursor-pointer rounded-xl border border-gray-800 bg-[#141820] shadow-none transition-colors hover:border-gray-700 hover:bg-[#181e2a]"
            >
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="flex-1 text-sm font-semibold text-slate-50">{item.title}</h3>
                  <Badge
                    variant="secondary"
                    className={`rounded px-2 py-1 text-xs font-medium shadow-none ${item.badgeClassName}`}
                  >
                    {item.level}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">{item.description}</p>
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs text-slate-400">Overall risk score</p>
                  <p className="text-xl font-semibold text-slate-50">{item.score}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">{item.metricLabel}</span>
                  <span className="text-xs font-semibold text-slate-50">{item.metricValue}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">{item.extraLabel}</span>
                  <span className="text-xs font-semibold text-slate-50">{item.extraValue}</span>
                </div>
                <div className="mt-auto flex flex-col gap-1.5 pt-1">
                  <RiskMeter value={item.progress} fillClassName={item.progressClassName} />
                  <p className="text-xs text-slate-400">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Plant Performance KPIs ───────────────────────────────────── */}
      <section aria-label="Plant performance KPIs" className="w-full">
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {kpiItems.map((item) => (
            <Card key={item.label} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex h-full flex-col gap-1 p-2.5">
                <h3 className="text-xs text-slate-400">{item.label}</h3>
                <p className="text-xl font-semibold text-slate-50">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Top 5 At-Risk Assets + AI Recommended Actions ───────────── */}
      <section className="flex w-full flex-col gap-6 lg:flex-row">
        <Card className="flex-1 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-slate-50">Top 5 At-Risk Assets</h2>
              <div className="flex w-full flex-col">
                {atRiskAssets.map((item, index) => (
                  <article
                    key={item.id}
                    onClick={() => handleAssetClick(item.id)}
                    className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_120px_80px_80px] items-center gap-3 py-3 transition-colors hover:bg-[#1a2030] ${
                      item.highlight ? "border-l-2 border-l-red-500 bg-red-500/5 pl-3 hover:bg-red-500/10" : ""
                    } ${index !== atRiskAssets.length - 1 ? "border-b border-gray-800" : ""}`}
                  >
                    <h3 className="text-sm font-semibold text-slate-50">{item.asset}</h3>
                    <p className="text-sm text-slate-400">{item.area}</p>
                    <p className={`text-sm font-semibold ${item.riskClass}`}>{item.risk}</p>
                    <p className="text-sm font-medium text-slate-50">{item.status}</p>
                  </article>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none lg:w-[340px] lg:min-w-[340px]">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4">
              <header className="flex w-full items-center justify-between gap-4">
                <h2 className="text-base font-semibold text-slate-50">AI Recommended Actions</h2>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto p-0 text-sm font-medium text-blue-500 hover:bg-transparent hover:text-blue-400"
                >
                  View All
                </Button>
              </header>
              <div className="flex w-full flex-col">
                {recommendedActions.map((action, index) => (
                  <article
                    key={action.title}
                    className={`flex w-full flex-col gap-2 py-3.5 ${
                      index !== recommendedActions.length - 1 ? "border-b border-gray-800" : ""
                    }`}
                  >
                    <h3 className="text-sm font-semibold leading-snug text-slate-50">{action.title}</h3>
                    <p className="text-xs text-slate-400">{action.asset}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`inline-flex h-auto items-center gap-1.5 rounded px-2 py-1 text-xs font-medium shadow-none ${action.statusBadgeClass}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${action.statusDotClass}`} />
                        {action.status}
                      </Badge>
                      <span className="text-xs font-medium text-slate-50">{action.priority}</span>
                      <Badge
                        variant="secondary"
                        className={`h-auto rounded px-2 py-1 text-xs font-medium shadow-none ${action.categoryClass}`}
                      >
                        {action.category}
                      </Badge>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Upcoming Expiries / Recent Activity / Downtime Impact ────── */}
      <section className="grid w-full grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="flex flex-col rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardHeader className="p-5 pb-0">
            <CardTitle className="text-base font-semibold text-slate-50">Upcoming Expiries</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 p-5 pt-4">
            {upcomingExpiries.map((item) => (
              <div key={item.label} className="flex w-full items-start justify-between gap-4">
                <p className="text-sm text-slate-400">{item.label}</p>
                <p className="shrink-0 text-right text-sm font-semibold text-slate-50">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="flex flex-col rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardHeader className="p-5 pb-0">
            <CardTitle className="text-base font-semibold text-slate-50">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 p-5 pt-4">
            {recentActivity.map((item) => (
              <div key={item.text} className="flex items-center gap-2">
                <item.Icon className={`h-4 w-4 shrink-0 ${item.iconClass}`} aria-hidden="true" />
                <p className="text-sm text-slate-50">{item.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="flex flex-col rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardHeader className="p-5 pb-0">
            <CardTitle className="text-base font-semibold text-slate-50">Downtime Impact</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 p-5 pt-4">
            {downtimeImpact.map((item) => (
              <div key={item.label} className="flex flex-col gap-1">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className={`${item.valueClass} text-slate-50`}>{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

    </section>
  );
};
