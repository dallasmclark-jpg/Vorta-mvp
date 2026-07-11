import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw,
  UserCircle,
  ChevronDown,
  X,
  ArrowRight,
} from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { VortaAiCommandBar } from "../../../../components/ai/VortaAiCommandBar";
import {
  getAreaRiskProfiles,
  getSiteRiskProfile,
  getAreaInterventionPlans,
  getAreaHighestRiskIntervention,
  getSiteRiskReductionPlan,
  refreshCurrentRisk,
  getRiskReductionKpis,
  type AreaRiskProfile,
  type SiteRiskProfile,
  type AreaInterventionPlan,
  type AreaHighestRiskIntervention,
  type SiteRiskReductionPlan,
  type RiskReductionKpi,
  type RiskReductionKpiDashboard,
  type RiskKpiPeriodKey,
} from "../../../Equipment/equipmentService";

const formatSiteRisk = (value: number): string =>
  Number(value).toFixed(1);

const parseDateOnly = (value: string): Date => {
  const [year, month, day] = value
    .split("-")
    .map(Number);

  return new Date(
    year,
    month - 1,
    day,
  );
};

const formatCalendarDate = (
  value: string,
): string => {
  if (!value) {
    return "—";
  }

  return parseDateOnly(value).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
    },
  );
};

const getLabourRiskPresentation = (
  score: number,
  noEngineerOverride: boolean,
) => {
  if (noEngineerOverride || score >= 85) {
    return {
      level: "Critical",
      badgeClassName:
        "bg-[#ef444420] text-red-500 hover:bg-[#ef444420]",
      progressClassName: "bg-red-500",
      label: noEngineerOverride
        ? "Critical no-cover override"
        : "Critical labour exposure",
    };
  }

  if (score >= 65) {
    return {
      level: "High",
      badgeClassName:
        "bg-orange-500/20 text-orange-400 hover:bg-orange-500/20",
      progressClassName: "bg-orange-500",
      label: "High labour exposure",
    };
  }

  if (score >= 40) {
    return {
      level: "Med",
      badgeClassName:
        "bg-[#facc1520] text-yellow-400 hover:bg-[#facc1520]",
      progressClassName: "bg-yellow-400",
      label: "Reduced labour resilience",
    };
  }

  if (score >= 20) {
    return {
      level: "Low",
      badgeClassName:
        "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20",
      progressClassName: "bg-emerald-500",
      label: "Low labour exposure",
    };
  }

  return {
    level: "Minimal",
    badgeClassName:
      "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20",
    progressClassName: "bg-cyan-400",
    label: "Labour coverage stable",
  };
};

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

const RISK_KPI_PERIODS: Array<{
  key: RiskKpiPeriodKey;
  label: string;
}> = [
  {
    key: "daily",
    label: "Daily",
  },
  {
    key: "weekly",
    label: "Weekly",
  },
  {
    key: "monthly",
    label: "Monthly",
  },
  {
    key: "ytd",
    label: "YTD",
  },
];

type RiskKpiDashboardCache = Partial<
  Record<
    RiskKpiPeriodKey,
    RiskReductionKpiDashboard
  >
>;

const formatKpiPeriodRange = (
  start: string,
  end: string,
): string => {
  if (!start || !end) {
    return "";
  }

  if (start === end) {
    return parseDateOnly(
      start,
    ).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const startLabel = parseDateOnly(
    start,
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  const endLabel = parseDateOnly(
    end,
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `${startLabel} – ${endLabel}`;
};

const getKpiRagPresentation = (
  status: RiskReductionKpi["ragStatus"],
) => {
  switch (status) {
    case "green":
      return {
        label: "On target",
        borderClassName: "border-emerald-500/30",
        backgroundClassName: "bg-emerald-500/[0.035]",
        valueClassName: "text-emerald-400",
        badgeClassName:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        dotClassName: "bg-emerald-400",
        barClassName: "bg-emerald-500",
      };

    case "amber":
      return {
        label: "At risk",
        borderClassName: "border-yellow-500/30",
        backgroundClassName: "bg-yellow-500/[0.035]",
        valueClassName: "text-yellow-400",
        badgeClassName:
          "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
        dotClassName: "bg-yellow-400",
        barClassName: "bg-yellow-500",
      };

    case "red":
      return {
        label: "Off target",
        borderClassName: "border-red-500/30",
        backgroundClassName: "bg-red-500/[0.035]",
        valueClassName: "text-red-400",
        badgeClassName:
          "border-red-500/20 bg-red-500/10 text-red-400",
        dotClassName: "bg-red-400",
        barClassName: "bg-red-500",
      };

    default:
      return {
        label: "No data",
        borderClassName: "border-gray-800",
        backgroundClassName: "bg-[#141820]",
        valueClassName: "text-slate-400",
        badgeClassName:
          "border-gray-700 bg-gray-800/70 text-slate-400",
        dotClassName: "bg-slate-500",
        barClassName: "bg-slate-600",
      };
  }
};

const formatKpiPercentage = (
  value: number | null,
): string =>
  value === null
    ? "—"
    : `${value.toFixed(1)}%`;

const formatKpiTarget = (
  target: number,
): string => `Target ≥ ${target.toFixed(1)}%`;

// ─── Component ────────────────────────────────────────────────────────────────

export const DashboardOverviewSection = (): JSX.Element => {
  const navigate = useNavigate();
  const [areaRiskCards, setAreaRiskCards] = useState<AreaRiskProfile[]>([]);
  const [siteRisk, setSiteRisk] = useState<SiteRiskProfile | null>(null);
  const [isRiskDetailOpen, setIsRiskDetailOpen] = useState(false);
  const [interventionPlans, setInterventionPlans] = useState<AreaInterventionPlan[]>([]);
  const [selectedInterventionPlan, setSelectedInterventionPlan] = useState<AreaInterventionPlan | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedAreaIntervention, setSelectedAreaIntervention] = useState<AreaHighestRiskIntervention | null>(null);
  const [areaInterventionLoading, setAreaInterventionLoading] = useState(false);

  const [riskReductionPlan, setRiskReductionPlan] =
    useState<SiteRiskReductionPlan | null>(null);
  const [riskReductionPlanLoading, setRiskReductionPlanLoading] =
    useState(true);
  const [dashboardRefreshing, setDashboardRefreshing] =
    useState(false);

  const [
    selectedKpiPeriod,
    setSelectedKpiPeriod,
  ] = useState<RiskKpiPeriodKey>("daily");

  const [
    riskKpiDashboard,
    setRiskKpiDashboard,
  ] = useState<RiskReductionKpiDashboard | null>(
    null,
  );

  const [
    riskKpiCache,
    setRiskKpiCache,
  ] = useState<RiskKpiDashboardCache>(
    {},
  );

  const [
    riskKpiLoading,
    setRiskKpiLoading,
  ] = useState(false);

  const [riskPlanHistory, setRiskPlanHistory] = useState<string[]>([]);

  const previousRiskPlanArea =
    riskPlanHistory.length > 0
      ? riskPlanHistory[riskPlanHistory.length - 1]
      : null;

  const siteRiskReduction = riskReductionPlan
    ? Math.max(
        0,
        Math.round(
          (Number(riskReductionPlan.currentSiteRisk) -
            Number(riskReductionPlan.projectedSiteRisk)) *
            10,
        ) / 10,
      )
    : 0;

  const loadRiskDashboard = useCallback(
    async (period: RiskKpiPeriodKey) => {
      setDashboardRefreshing(true);
      setRiskReductionPlanLoading(true);
      setRiskKpiLoading(true);

      try {
        await refreshCurrentRisk();

        const riskKpiRequest =
          Promise.all(
            RISK_KPI_PERIODS.map(
              async ({ key }) => ({
                key,
                dashboard:
                  await getRiskReductionKpis(
                    key,
                  ),
              }),
            ),
          );

        const [
          areaProfiles,
          siteProfile,
          areaPlans,
          reductionPlan,
          kpiResults,
        ] = await Promise.all([
          getAreaRiskProfiles(),
          getSiteRiskProfile(),
          getAreaInterventionPlans(),
          getSiteRiskReductionPlan(),
          riskKpiRequest,
        ]);

        setAreaRiskCards(areaProfiles);
        setSiteRisk(siteProfile);
        setInterventionPlans(areaPlans);
        setRiskReductionPlan(reductionPlan);

        const nextRiskKpiCache =
          kpiResults.reduce<
            RiskKpiDashboardCache
          >(
            (
              cache,
              result,
            ) => {
              if (result.dashboard) {
                cache[result.key] =
                  result.dashboard;
              }

              return cache;
            },
            {},
          );

        setRiskKpiCache(nextRiskKpiCache);

        const requestedKpiDashboard =
          nextRiskKpiCache[period] ??
          nextRiskKpiCache.daily ??
          null;

        if (requestedKpiDashboard) {
          setRiskKpiDashboard(requestedKpiDashboard);
        }

        setRiskPlanHistory([]);
      } finally {
        setRiskReductionPlanLoading(false);
        setRiskKpiLoading(false);
        setDashboardRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadRiskDashboard("daily");
  }, [loadRiskDashboard]);

  const handleLoadRiskReductionPlan = async (
    area?: string,
    navigationMode: "forward" | "back" | "reset" = "forward",
  ) => {
    if (riskReductionPlanLoading) {
      return;
    }

    setRiskReductionPlanLoading(true);
    setIsRiskDetailOpen(true);

    try {
      const plan = await getSiteRiskReductionPlan(area);

      if (!plan) {
        return;
      }

      const currentArea = riskReductionPlan?.highestArea;

      if (
        navigationMode === "forward" &&
        currentArea &&
        currentArea !== plan.highestArea
      ) {
        setRiskPlanHistory((history) => [...history, currentArea]);
      }

      if (navigationMode === "back") {
        setRiskPlanHistory((history) => history.slice(0, -1));
      }

      if (navigationMode === "reset") {
        setRiskPlanHistory([]);
      }

      setRiskReductionPlan(plan);
    } finally {
      setRiskReductionPlanLoading(false);
    }
  };

  const handleLoadPreviousRiskArea = () => {
    if (!previousRiskPlanArea) {
      return;
    }

    void handleLoadRiskReductionPlan(previousRiskPlanArea, "back");
  };

  const handleAssetClick = (id: string) => {
    navigate(`/equipment/${id}/overview`);
  };

  const handleAreaCardClick = async (area: string) => {
    if (selectedArea === area) {
      setSelectedArea(null);
      setSelectedAreaIntervention(null);
      return;
    }

    setSelectedArea(area);
    setSelectedAreaIntervention(null);
    setAreaInterventionLoading(true);

    try {
      const intervention = await getAreaHighestRiskIntervention(area);
      setSelectedAreaIntervention(intervention);
    } finally {
      setAreaInterventionLoading(false);
    }
  };

  const liveLabourRiskItems = labourRiskItems.map(
    (item) => {
      if (
        item.slug !== "shift-cover" ||
        !siteRisk
      ) {
        return item;
      }

      const presentation =
        getLabourRiskPresentation(
          siteRisk.labourRiskScore,
          siteRisk.noEngineerOverride,
        );

      const shiftLabel =
        siteRisk.labourShiftType === "night"
          ? "Night"
          : "Day";

      return {
        ...item,
        level: presentation.level,
        score: formatSiteRisk(
          siteRisk.labourRiskScore,
        ),
        description: `${shiftLabel} shift labour and equipment-skill coverage`,
        metricLabel: "Engineers scheduled",
        metricValue: String(
          siteRisk.scheduledEngineerCount,
        ),
        extraLabel: "Equipment cover gaps",
        extraValue: String(
          siteRisk.coverGapCount,
        ),
        label: presentation.label,
        progress: Math.max(
          0,
          Math.min(
            100,
            siteRisk.labourRiskScore,
          ),
        ),
        badgeClassName:
          presentation.badgeClassName,
        progressClassName:
          presentation.progressClassName,
      };
    },
  );

  const handleKpiPeriodChange = (
    period: RiskKpiPeriodKey,
  ) => {
    if (
      period === selectedKpiPeriod ||
      riskKpiLoading
    ) {
      return;
    }

    const cachedDashboard =
      riskKpiCache[period];

    if (!cachedDashboard) {
      return;
    }

    setSelectedKpiPeriod(period);

    setRiskKpiDashboard(cachedDashboard);
  };

  const handleRiskKpiClick = (
    kpi: RiskReductionKpi,
  ) => {
    if (
      kpi.key === "risk_reduction_achieved"
    ) {
      setIsRiskDetailOpen(true);

      if (!riskReductionPlan) {
        void handleLoadRiskReductionPlan(
          undefined,
          "reset",
        );
      }

      return;
    }

    if (!riskKpiDashboard) {
      return;
    }

    const query = new URLSearchParams({
      focus: kpi.key,
      period: riskKpiDashboard.periodKey,
      start: riskKpiDashboard.periodStart,
      end: riskKpiDashboard.periodEnd,
    });

    const separator = kpi.drilldownRoute.includes(
      "?",
    )
      ? "&"
      : "?";

    navigate(
      `${kpi.drilldownRoute}${separator}${query.toString()}`,
    );
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
            onClick={() => void loadRiskDashboard(selectedKpiPeriod)}
            disabled={dashboardRefreshing}
            className="h-auto border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-50 shadow-none hover:bg-white/15 hover:text-slate-50"
          >
            Run Risk Analysis
          </Button>
          <button
            type="button"
            onClick={() => void loadRiskDashboard(selectedKpiPeriod)}
            disabled={dashboardRefreshing}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${dashboardRefreshing ? "animate-spin" : ""}`} />
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

      {/* ── Dashboard AI Command Bar ─────────────────────────────────── */}
      <VortaAiCommandBar role="maintenance-manager" />

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
                <p className="text-xl font-semibold text-slate-50">{siteRisk
                  ? formatSiteRisk(siteRisk.riskScore)
                  : "—"}</p>
                <p className="text-xs text-orange-400">{siteRisk ? (
                  <>
                    <span>
                      {siteRisk.riskLevel} · live
                    </span>
                    <span className="text-slate-500">
                      {" "}
                      · Op{" "}
                      {formatSiteRisk(
                        siteRisk.operationalRiskScore,
                      )}
                      {" "}
                      · Labour{" "}
                      {formatSiteRisk(
                        siteRisk.labourRiskScore,
                      )}
                    </span>
                  </>
                ) : (
                  "No live data"
                )}</p>
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
              <div className={`flex flex-col gap-0.5 rounded-lg border bg-[#0d1117] px-3 py-2.5 ${
                siteRisk?.noEngineerOverride
                  ? "border-red-500/50"
                  : "border-gray-800"
              }`}>
                <p className="text-xs text-slate-500">Cover Gaps</p>
                <p className="text-xl font-semibold text-slate-50">{siteRisk?.coverGapCount ?? "—"}</p>
                <p className={`text-xs ${
                  siteRisk?.noEngineerOverride
                    ? "text-red-400"
                    : "text-slate-400"
                }`}>{siteRisk?.noEngineerOverride
                  ? "0 engineers · critical override"
                  : siteRisk
                    ? (siteRisk.scheduledEngineerCount + " engineers · " + (siteRisk.labourShiftType === "night" ? "night" : "day") + " shift")
                    : "No live data"}</p>
              </div>
            </div>

            {/* Priority action summary */}
            <div className="flex flex-col gap-3 rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400">
                  Today's Risk Reduction Plan
                </p>
                <p className="text-sm font-semibold leading-snug text-slate-50">
                  {riskReductionPlan
                    ? `${riskReductionPlan.highestArea}: complete the highest-value work queue to reduce area risk from ${riskReductionPlan.currentAreaRisk} to ${riskReductionPlan.projectedAreaRisk}.`
                    : siteRisk?.priorityAction ??
                      "Review the highest-risk area and clear the largest leading risk driver."}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <Badge className="rounded bg-[#10b98120] px-2 py-1 text-xs font-medium text-emerald-500 hover:bg-[#10b98120]">
                  Live calculation
                </Badge>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsRiskDetailOpen(true)}
                  className="h-auto rounded-lg border border-solid border-[#ffffff20] bg-[#ffffff1a] px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-[#ffffff24]"
                >
                  View Work Queue
                </Button>

                <button
                  type="button"
                  onClick={() => setIsRiskDetailOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-slate-50"
                >
                  {isRiskDetailOpen ? "Hide work plan" : "View work plan"}
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
                {riskReductionPlanLoading && !riskReductionPlan ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                    Loading risk reduction plan...
                  </div>
                ) : !riskReductionPlan ? (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-red-300">
                      Risk reduction plan could not be loaded.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    <div className="flex min-h-7 flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {siteRisk?.highestArea &&
                          riskReductionPlan.highestArea !== siteRisk.highestArea &&
                          previousRiskPlanArea !== siteRisk.highestArea && (
                            <button
                              type="button"
                              disabled={riskReductionPlanLoading}
                              onClick={() =>
                                void handleLoadRiskReductionPlan(
                                  undefined,
                                  "reset",
                                )
                              }
                              className="text-xs font-medium text-slate-500 transition-colors hover:text-blue-300 disabled:cursor-wait disabled:opacity-50"
                            >
                              Back to highest area: {siteRisk.highestArea}
                            </button>
                          )}
                      </div>

                      <div className="min-w-[110px] text-right">
                        {riskReductionPlanLoading && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-blue-400">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Updating plan…
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                      <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          Plan area
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {riskReductionPlan.highestArea}
                        </p>
                      </div>

                      <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          Area risk
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {riskReductionPlan.currentAreaRisk}
                          <span className="mx-1.5 text-slate-600">→</span>
                          <span className="text-emerald-400">
                            {riskReductionPlan.projectedAreaRisk}
                          </span>
                        </p>
                      </div>

                      <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          Site risk
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {formatSiteRisk(riskReductionPlan.currentSiteRisk)}
                          <span className="mx-1.5 text-slate-600">→</span>
                          <span
                            className={
                              riskReductionPlan.projectedSiteRisk <
                              riskReductionPlan.currentSiteRisk
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {formatSiteRisk(riskReductionPlan.projectedSiteRisk)}
                          </span>
                        </p>
                      </div>

                      <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          Active work duration
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {riskReductionPlan.estimatedDurationMinutes >= 60
                            ? `${Math.floor(riskReductionPlan.estimatedDurationMinutes / 60)}h ${riskReductionPlan.estimatedDurationMinutes % 60}m`
                            : `${riskReductionPlan.estimatedDurationMinutes}m`}
                        </p>
                      </div>

                      <div
                        className={`rounded-lg border p-3 ${
                          siteRiskReduction > 0
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : "border-gray-800 bg-[#0d1117]"
                        }`}
                      >
                        <p
                          className={`text-[10px] uppercase tracking-wider ${
                            siteRiskReduction > 0
                              ? "text-emerald-400/70"
                              : "text-slate-500"
                          }`}
                        >
                          {siteRiskReduction > 0
                            ? "Site reduction"
                            : "Site impact"}
                        </p>

                        <p
                          className={`mt-1 text-sm font-semibold ${
                            siteRiskReduction > 0
                              ? "text-emerald-400"
                              : "text-slate-400"
                          }`}
                        >
                          {siteRiskReduction > 0
                            ? `−${siteRiskReduction.toFixed(1)} points`
                            : "No immediate change"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Recommended Work Queue
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Ranked by final asset risk reduction, including current-shift labour coverage, then criticality, overdue age and duration.
                          </p>
                        </div>

                        <span className="text-xs text-slate-500">
                          {riskReductionPlan.equipmentName}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2">
                        {riskReductionPlan.actions
                          .slice()
                          .sort(
                            (a, b) =>
                              b.calculatedReduction - a.calculatedReduction ||
                              a.priority - b.priority,
                          )
                          .map((action, index) => {
                            const workOrder = action.workOrderNumbers[0] ?? null;
                            const reference =
                              action.pmNumbers[0] ??
                              action.sparePartNumbers[0] ??
                              null;
                            const durationMinutes = action.estimatedDurationMinutes ?? 0;
                            const procurementLeadDays = action.procurementLeadDays ?? 0;

                            return (
                              <button
                                key={`${action.priority}-${action.action}`}
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/equipment/${riskReductionPlan.equipmentId}/work-orders`,
                                  )
                                }
                                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3 text-left transition-colors hover:border-blue-500/30 hover:bg-[#151b26]"
                              >
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/15 text-[11px] font-semibold text-blue-300">
                                  {index + 1}
                                </span>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-slate-100">
                                      {action.action}
                                    </p>

                                    <Badge className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400 shadow-none">
                                      {action.driver}
                                    </Badge>
                                  </div>

                                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {workOrder && (
                                      <span className="rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                                        {workOrder}
                                      </span>
                                    )}

                                    {reference && (
                                      <span className="rounded border border-slate-700 bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                                        {reference}
                                      </span>
                                    )}

                                    {durationMinutes > 0 && (
                                      <span className="rounded border border-slate-700 bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                                        {durationMinutes >= 60
                                          ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
                                          : `${durationMinutes}m`}
                                      </span>
                                    )}

                                    {procurementLeadDays > 0 && (
                                      <span className="rounded border border-orange-500/20 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-300">
                                        Lead time {procurementLeadDays}d
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-right">
                                  <p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">
                                    Asset risk
                                  </p>
                                  <p className="text-sm font-semibold text-emerald-400">
                                    −{action.calculatedReduction}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    to {action.projectedScore}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                      <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                        <p className="text-[10px] text-slate-500">
                          PM backlog
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {riskReductionPlan.currentPmBacklog}
                          <span className="mx-1.5 text-slate-600">→</span>
                          <span
                            className={
                              riskReductionPlan.projectedPmBacklog <
                              riskReductionPlan.currentPmBacklog
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {riskReductionPlan.projectedPmBacklog}
                          </span>
                        </p>
                        {riskReductionPlan.projectedPmBacklog ===
                          riskReductionPlan.currentPmBacklog && (
                          <p className="mt-0.5 text-[9px] text-slate-600">
                            No PM action selected
                          </p>
                        )}
                      </div>

                      <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                        <p className="text-[10px] text-slate-500">
                          Calibration backlog
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {riskReductionPlan.currentCalibrationBacklog}
                          <span className="mx-1.5 text-slate-600">→</span>
                          <span
                            className={
                              riskReductionPlan.projectedCalibrationBacklog <
                              riskReductionPlan.currentCalibrationBacklog
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {riskReductionPlan.projectedCalibrationBacklog}
                          </span>
                        </p>
                        {riskReductionPlan.projectedCalibrationBacklog ===
                          riskReductionPlan.currentCalibrationBacklog && (
                          <p className="mt-0.5 text-[9px] text-slate-600">
                            No calibration action selected
                          </p>
                        )}
                      </div>

                      <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                        <p className="text-[10px] text-slate-500">
                          Out-of-stock parts
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {riskReductionPlan.currentStockouts}
                          <span className="mx-1.5 text-slate-600">→</span>
                          <span
                            className={
                              riskReductionPlan.projectedStockouts <
                              riskReductionPlan.currentStockouts
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {riskReductionPlan.projectedStockouts}
                          </span>
                        </p>
                        {riskReductionPlan.projectedStockouts ===
                          riskReductionPlan.currentStockouts && (
                          <p className="mt-0.5 text-[9px] text-slate-600">
                            No stockout action selected
                          </p>
                        )}
                      </div>

                      <div
                        className={`col-span-2 flex items-center justify-between gap-4 rounded-lg border p-3 ${
                          riskReductionPlan.nextArea
                            ? "border-blue-500/20 bg-blue-500/5"
                            : "border-gray-800 bg-[#0d1117]"
                        }`}
                      >
                        <div className="min-w-0">
                          {riskReductionPlan.nextArea ? (
                            <>
                              <p className="text-[10px] uppercase tracking-wider text-blue-400">
                                Next recommended area
                              </p>

                              <p className="mt-1 text-sm font-semibold text-slate-100">
                                {riskReductionPlan.nextArea}
                              </p>

                              <p className="text-xs text-slate-500">
                                Risk {riskReductionPlan.nextAreaRisk} ·{" "}
                                {riskReductionPlan.nextAreaLevel}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                                Area review
                              </p>

                              <p className="mt-1 text-sm font-semibold text-slate-300">
                                All ranked areas reviewed
                              </p>
                            </>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-4">
                          {previousRiskPlanArea && (
                            <button
                              type="button"
                              disabled={riskReductionPlanLoading}
                              onClick={handleLoadPreviousRiskArea}
                              title={`Return to ${previousRiskPlanArea}`}
                              aria-label={`Return to previous area: ${previousRiskPlanArea}`}
                              className="text-xs font-semibold text-slate-400 transition-colors hover:text-blue-300 disabled:cursor-wait disabled:opacity-50"
                            >
                              ← Previous area
                            </button>
                          )}

                          {riskReductionPlan.nextArea && (
                            <button
                              type="button"
                              disabled={riskReductionPlanLoading}
                              onClick={() =>
                                void handleLoadRiskReductionPlan(
                                  riskReductionPlan.nextArea,
                                  "forward",
                                )
                              }
                              className="text-xs font-semibold text-blue-400 transition-colors hover:text-blue-300 disabled:cursor-wait disabled:opacity-50"
                            >
                              Next area →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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

        {(() => {
          const visibleAreaRiskCards = areaRiskCards.slice(0, 4);

          const selectedAreaIndex = visibleAreaRiskCards.findIndex(
            (area) => area.area === selectedArea,
          );

          const selectedAreaProfile =
            selectedAreaIndex >= 0 ? visibleAreaRiskCards[selectedAreaIndex] : null;

          const projectedScoreColor =
            selectedAreaIntervention
              ? selectedAreaIntervention.projectedRiskScore >= 85 ? "text-red-400" :
                selectedAreaIntervention.projectedRiskScore >= 65 ? "text-orange-400" :
                selectedAreaIntervention.projectedRiskScore >= 40 ? "text-yellow-400" :
                selectedAreaIntervention.projectedRiskScore >= 20 ? "text-emerald-400" :
                "text-cyan-400"
              : "text-yellow-400";

          const projectedLevelColor =
            selectedAreaIntervention
              ? selectedAreaIntervention.projectedRiskScore >= 85 ? "text-red-300" :
                selectedAreaIntervention.projectedRiskScore >= 65 ? "text-orange-300" :
                selectedAreaIntervention.projectedRiskScore >= 40 ? "text-yellow-300" :
                selectedAreaIntervention.projectedRiskScore >= 20 ? "text-emerald-300" :
                "text-cyan-300"
              : "text-yellow-300";

          const renderAreaIntervention = (areaProfile: AreaRiskProfile) => (
            <div className="flex w-full flex-col gap-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                    Highest-risk intervention
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-50">
                    {selectedAreaIntervention?.equipmentName ?? areaProfile.highestAssetName}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedAreaIntervention?.equipmentCode}
                    {selectedAreaIntervention?.equipmentCode && selectedAreaIntervention?.equipmentType ? " · " : ""}
                    {selectedAreaIntervention?.equipmentType}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedArea(null);
                    setSelectedAreaIntervention(null);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-100"
                  aria-label="Return to area summary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Loading */}
              {areaInterventionLoading && (
                <div className="flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                  Calculating intervention impact...
                </div>
              )}

              {/* Error */}
              {!areaInterventionLoading && selectedAreaIntervention === null && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-6 text-center">
                  <p className="text-sm font-medium text-red-300">
                    Intervention data could not be loaded.
                  </p>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleAreaCardClick(areaProfile.area);
                    }}
                    className="mt-2 text-xs font-semibold text-blue-400 hover:text-blue-300"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Data loaded */}
              {!areaInterventionLoading && selectedAreaIntervention !== null && (
                <>
                  {/* Risk projection */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        Current risk
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-red-400">
                        {selectedAreaIntervention.currentRiskScore}
                      </p>
                      <p className="text-xs text-red-300">
                        {selectedAreaIntervention.currentRiskLevel}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-600" />
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        Projected risk
                      </p>
                      <p className={`mt-1 text-2xl font-semibold ${projectedScoreColor}`}>
                        {selectedAreaIntervention.projectedRiskScore}
                      </p>
                      <p className={`text-xs ${projectedLevelColor}`}>
                        {selectedAreaIntervention.projectedRiskLevel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md bg-emerald-500/5 px-3 py-2">
                    <span className="text-xs text-slate-400">
                      Total calculated reduction
                    </span>
                    <span className="text-sm font-semibold text-emerald-400">
                      −{selectedAreaIntervention.totalCalculatedReduction} points
                    </span>
                  </div>

                  {/* Calculated actions */}
                  {selectedAreaIntervention.actions.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Actions that reduce the weighted score
                      </p>
                      {selectedAreaIntervention.actions
                        .slice()
                        .sort((a, b) => a.priority - b.priority)
                        .map((action) => (
                          <div
                            key={`${action.priority}-${action.driver}`}
                            className="rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 gap-2">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-semibold text-blue-300">
                                  {action.priority}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-xs font-semibold text-slate-100">
                                      {action.action}
                                    </p>
                                    <Badge className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400 shadow-none">
                                      {action.driver}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                                    {action.detail}
                                  </p>
                                  {(() => {
                                    const workOrderNumber = action.workOrderNumbers[0] ?? null;
                                    const pmNumber = action.pmNumbers[0] ?? null;
                                    const sparePartNumber = action.sparePartNumbers[0] ?? null;
                                    if (!workOrderNumber && !pmNumber && !sparePartNumber) {
                                      return null;
                                    }
                                    return (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {workOrderNumber && (
                                          <span className="inline-flex rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                                            {workOrderNumber}
                                          </span>
                                        )}
                                        {pmNumber && (
                                          <span className="inline-flex rounded border border-slate-700 bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                                            {pmNumber}
                                          </span>
                                        )}
                                        {sparePartNumber && (
                                          <span className="inline-flex rounded border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-300">
                                            {sparePartNumber}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold text-emerald-400">
                                  −{action.calculatedReduction}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  to {action.projectedScore}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Card actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/equipment/${selectedAreaIntervention.equipmentId}/overview`);
                      }}
                      className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
                    >
                      Open {selectedAreaIntervention.equipmentName} →
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/equipment?area=${encodeURIComponent(areaProfile.area)}`);
                      }}
                      className="inline-flex items-center justify-center rounded-md border border-gray-700 bg-transparent px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white"
                    >
                      View all {areaProfile.area} equipment →
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedArea(null);
                        setSelectedAreaIntervention(null);
                      }}
                      className="ml-auto text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
                    >
                      Back to area summary
                    </button>
                  </div>
                </>
              )}
            </div>
          );

          return (
            <div className="relative">
              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                {visibleAreaRiskCards.map((area) => {
                  const riskLabel = area.riskLevel;
                  const isHighestRisk = areaRiskCards[0]?.area === area.area;
                  const interventionPlan = interventionPlans.find((plan) => plan.area === area.area);
                  const isSelected = selectedArea === area.area;

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
                    area.noEngineerOverride
                      ? "No engineers on current shift"
                      : area.labourRiskScore >= 65
                        ? "Labour coverage"
                        : area.calibrationOverdueCount > 0
                          ? "Calibration backlog"
                          : area.overduePmCount > 0
                            ? "PM backlog"
                            : area.criticalSparesMissing > 0
                              ? "Critical spares"
                              : area.singlePointSkillGapCount > 0
                                ? "Skills coverage"
                                : "Stable leading indicators";

                  const trend =
                    isHighestRisk ? "Highest site area risk" :
                    area.riskScore >= 65 ? "Elevated risk" :
                    area.riskScore >= 40 ? "Monitor closely" :
                    "Stable";

                  return (
                    <Card
                      key={area.area}
                      onClick={() => handleAreaCardClick(area.area)}
                      className={`cursor-pointer rounded-xl border bg-[#141820] shadow-none transition-colors hover:bg-[#181e2a] ${
                        isSelected
                          ? "border-blue-500/60 shadow-[0_0_12px_rgba(59,130,246,0.12)]"
                          : isHighestRisk
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
                          <div className="flex items-start justify-between gap-3">
                            <dt className="text-sm text-slate-400">Labour risk</dt>
                            <dd className={`text-sm font-semibold ${
                              area.noEngineerOverride
                                ? "text-red-400"
                                : area.labourRiskScore >= 65
                                  ? "text-orange-400"
                                  : area.labourRiskScore >= 40
                                    ? "text-yellow-400"
                                    : "text-slate-50"
                            }`}>
                              {formatSiteRisk(
                                area.labourRiskScore,
                              )}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-auto flex w-full flex-col gap-1.5 pt-1">
                          <RiskMeter value={area.riskScore} fillClassName={progressClass} />
                          <p className="text-xs text-slate-400">{trend}</p>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigate(`/equipment?area=${encodeURIComponent(area.area)}`); }}
                            className="mt-1 inline-flex w-fit items-center gap-1 text-xs font-semibold text-blue-400 transition-colors hover:text-blue-300"
                            aria-label={`View equipment in ${area.area}`}
                          >
                            View area equipment →
                          </button>
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

              {/* Intervention overlay */}
              {selectedArea && selectedAreaProfile && (
                <>
                  {/* Desktop: absolute overlay covering two card positions */}
                  <div
                    className={`absolute top-0 z-40 hidden h-full w-[calc(50%_-_0.5rem)] overflow-hidden rounded-xl border border-blue-500/60 bg-[#141820] shadow-2xl 2xl:block ${
                      selectedAreaIndex <= 1 ? "left-0" : "right-0"
                    }`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="h-full overflow-y-auto p-4">
                      {renderAreaIntervention(selectedAreaProfile)}
                    </div>
                  </div>

                  {/* Tablet/mobile: fixed overlay */}
                  <div
                    className="fixed inset-x-4 bottom-4 top-20 z-50 overflow-hidden rounded-xl border border-blue-500/60 bg-[#141820] shadow-2xl 2xl:hidden"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="h-full overflow-y-auto p-4">
                      {renderAreaIntervention(selectedAreaProfile)}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}

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

                  {/* Target work list */}
                  <div>
                    <div className="mb-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Target Work List</h3>
                      <p className="mt-0.5 text-[11px] text-slate-600">Priority work included in the recommended intervention.</p>
                    </div>
                    {selectedInterventionPlan.workItems.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {selectedInterventionPlan.workItems.slice(0, 5).map((item, i) => (
                          <div key={i} className="rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[10px] font-semibold text-slate-400">
                                    {item.priority}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-100">{item.asset}</span>
                                  {item.assetCode && (
                                    <span className="text-[10px] text-slate-500">{item.assetCode}</span>
                                  )}
                                </div>
                                <div className="ml-7 flex flex-wrap gap-x-4 gap-y-0.5">
                                  <span className="text-[11px] text-slate-400">
                                    <span className="text-slate-600">Action: </span>{item.action}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    <span className="text-slate-600">Driver: </span>{item.driver}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    <span className="text-slate-600">Risk: </span>
                                    {item.riskScore} <span className="text-orange-400">{item.riskLevel}</span>
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0 flex flex-col items-end gap-0.5">
                                <span className="text-sm font-bold text-emerald-400">▼{item.estimatedReduction}</span>
                                <span className="text-[10px] text-slate-500">{item.estimatedHours} hrs</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : selectedInterventionPlan.targetWorkList ? (
                      <div className="flex flex-col gap-2">
                        {selectedInterventionPlan.targetWorkList
                          .split(";")
                          .map((raw) => raw.trim())
                          .filter(Boolean)
                          .slice(0, 5)
                          .map((item, i) => {
                            const reductionMatch = item.match(/\b(\d+)\s*(?:risk\s+)?(?:reduction|pts?|points?)\b/i);
                            const reductionValue = reductionMatch ? reductionMatch[1] : null;
                            return (
                              <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[10px] font-semibold text-slate-400">
                                  {i + 1}
                                </span>
                                <span className="min-w-0 flex-1 text-xs text-slate-300 leading-snug">{item}</span>
                                {reductionValue && (
                                  <div className="shrink-0 flex flex-col items-end gap-0">
                                    <span className="text-[10px] text-slate-500">Risk reduction</span>
                                    <span className="text-sm font-bold text-emerald-400">▼{reductionValue}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3 text-xs text-slate-500">
                        Work list will be generated from the highest-risk assets in this area.
                      </p>
                    )}
                  </div>

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
          {liveLabourRiskItems.map((item) => (
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

      {/* ── Risk Reduction Performance KPIs ─────────────────────────── */}
      <section
        aria-label="Risk reduction performance"
        className="flex w-full flex-col gap-4"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-50">
              Risk Reduction Performance
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Leading indicators showing whether maintenance is removing future site risk.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            {riskKpiDashboard && (
              <span className="text-xs text-slate-500">
                {riskKpiDashboard.periodLabel}
                {" · "}
                {formatKpiPeriodRange(
                  riskKpiDashboard.periodStart,
                  riskKpiDashboard.periodEnd,
                )}
              </span>
            )}

            <div
              role="tablist"
              aria-label="KPI period"
              className="inline-flex rounded-lg border border-gray-800 bg-[#0d1117] p-1"
            >
              {RISK_KPI_PERIODS.map(
                (period) => {
                  const isSelected =
                    selectedKpiPeriod ===
                    period.key;

                  return (
                    <button
                      type="button"
                      role="tab"
                      key={period.key}
                      aria-selected={
                        isSelected
                      }
                      disabled={
                        riskKpiLoading
                      }
                      onClick={() =>
                        void handleKpiPeriodChange(
                          period.key,
                        )
                      }
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-400 hover:bg-gray-800 hover:text-slate-200"
                      } disabled:cursor-wait`}
                    >
                      {period.label}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </div>

        {riskKpiDashboard ? (
          <div
            className={`grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 ${
              riskKpiLoading
                ? "opacity-70"
                : "opacity-100"
            } transition-opacity`}
          >
            {riskKpiDashboard.kpis.map(
              (kpi) => {
                const presentation =
                  getKpiRagPresentation(
                    kpi.ragStatus,
                  );

                const chartValue =
                  kpi.value === null
                    ? 0
                    : Math.max(
                        0,
                        Math.min(
                          100,
                          kpi.value,
                        ),
                      );

                const chartTarget = Math.max(
                  0,
                  Math.min(
                    100,
                    kpi.target,
                  ),
                );

                const targetGap =
                  kpi.value === null
                    ? null
                    : Number(
                        (
                          kpi.value -
                          kpi.target
                        ).toFixed(1),
                      );

                const targetGapLabel =
                  kpi.noData ||
                  targetGap === null
                    ? "No eligible work in this period"
                    : targetGap === 0
                      ? "Target achieved"
                      : targetGap > 0
                        ? `${Math.abs(
                            targetGap,
                          ).toFixed(
                            1,
                          )} pts above target`
                        : `${Math.abs(
                            targetGap,
                          ).toFixed(
                            1,
                          )} pts below target`;

                const targetGapClassName =
                  kpi.noData ||
                  targetGap === null
                    ? "text-slate-400"
                    : targetGap >= 0
                      ? "text-emerald-400"
                      : kpi.ragStatus ===
                          "amber"
                        ? "text-yellow-400"
                        : "text-red-400";

                return (
                  <Card
                    key={kpi.key}
                    onClick={() =>
                      handleRiskKpiClick(
                        kpi,
                      )
                    }
                    className={`group h-[276px] cursor-pointer overflow-hidden rounded-xl border shadow-none transition-all hover:-translate-y-0.5 hover:border-blue-500/30 hover:bg-[#181e2a] ${presentation.borderClassName} ${presentation.backgroundClassName}`}
                  >
                    <CardContent className="grid h-full grid-rows-[44px_minmax(0,1fr)_28px] gap-3 overflow-hidden p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold leading-snug text-slate-100">
                          {kpi.label}
                        </h3>

                        <span
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-semibold ${presentation.badgeClassName}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${presentation.dotClassName}`}
                          />

                          {presentation.label}
                        </span>
                      </div>

                      <div className="flex min-h-0 items-center gap-4 overflow-hidden">
                        <div
                          className="relative flex h-[150px] w-16 shrink-0 items-end overflow-hidden rounded-xl border border-gray-700/80 bg-[#080b11] shadow-inner"
                          aria-hidden="true"
                        >
                          {!kpi.noData && (
                            <div
                              className={`w-full rounded-t-[10px] transition-[height] duration-300 ease-out ${presentation.barClassName}`}
                              style={{
                                height: `${chartValue}%`,
                              }}
                            />
                          )}

                          {!kpi.noData && (
                            <div
                              className="pointer-events-none absolute inset-x-0 z-20 border-t border-dashed border-slate-200/70"
                              style={{
                                bottom: `${chartTarget}%`,
                              }}
                            />
                          )}
                        </div>

                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                          <p
                            className={`text-3xl font-semibold leading-none tracking-tight ${presentation.valueClassName}`}
                          >
                            {formatKpiPercentage(
                              kpi.value,
                            )}
                          </p>

                          <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                            {formatKpiTarget(
                              kpi.target,
                            )}
                          </p>

                          <p
                            className={`mt-2 min-h-[32px] text-xs font-semibold leading-4 ${targetGapClassName}`}
                          >
                            {targetGapLabel}
                          </p>

                          <p
                            title={kpi.detail}
                            className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400"
                          >
                            {kpi.detail}
                          </p>
                        </div>
                      </div>

                      <div className="flex h-7 items-center justify-between gap-3 border-t border-gray-800 pt-2">
                        <span className="truncate text-[10px] text-slate-500">
                          {kpi.noData
                            ? "No eligible records"
                            : `${kpi.numerator} of ${kpi.denominator}`}
                        </span>

                        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-blue-400 transition-colors group-hover:text-blue-300">
                          View detail
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              },
            )}
          </div>
        ) : (
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 text-sm text-slate-400">
              Risk reduction KPIs are not available.
            </CardContent>
          </Card>
        )}
      </section>

    </section>
  );
};
