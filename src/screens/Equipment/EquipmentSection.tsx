import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  Search,
  UserCircle,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

import {
  getEquipmentList,
  getEquipmentRiskExplanations,
  getEquipmentRiskTrendSeries,
  resolveBuilding,
} from "./equipmentService";

import type {
  EquipmentListItem,
  EquipmentRiskExplanation,
  EquipmentRiskTrendRange,
  EquipmentRiskTrendSeries,
} from "./equipmentService";

// ─── Local display-only constants ────────────────────────────────────────────

type EquipmentFilterChip =
  | "Area"
  | "At Risk"
  | "Overdue PMs"
  | "Calibration Due";

const FILTER_CHIPS: readonly EquipmentFilterChip[] = [
  "Area",
  "At Risk",
  "Overdue PMs",
  "Calibration Due",
];

const RISK_LEGEND = [
  {
    label: "0-19% Minimal",
    dotClass: "bg-emerald-500",
  },
  {
    label: "20-39% Low",
    dotClass: "bg-lime-500",
  },
  {
    label: "40-64% Medium",
    dotClass: "bg-yellow-400",
  },
  {
    label: "65-84% High",
    dotClass: "bg-orange-400",
  },
  {
    label: "85-100% Critical",
    dotClass: "bg-red-500",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskBadgeClass(level: EquipmentListItem["riskLevel"]): string {
  switch (level) {
    case "Critical":
      return "bg-[#ef444420] text-red-400";
    case "High":
      return "bg-[#f9731620] text-orange-300";
    case "Medium":
      return "bg-[#eab30820] text-yellow-300";
    case "Low":
      return "bg-[#84cc1620] text-lime-400";
    default:
      return "bg-[#10b98120] text-emerald-400";
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return hex;
  }

  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

// ─── Risk Breakdown Bar ───────────────────────────────────────────────────────

function RiskBreakdownBar({ segments }: { segments: EquipmentListItem["breakdown"] }) {
  const total = segments.reduce((s, seg) => s + seg.pct, 0) || 1;
  return (
    <div className="flex h-6 w-full overflow-hidden rounded-lg ring-1 ring-inset ring-slate-600/45">
      {segments.map((seg) => {
        const segmentWidth =
          (seg.pct / total) * 100;

        return (
          <div
            key={seg.label}
            title={`${seg.label}: ${seg.pct}%`}
            style={{
              width: `${segmentWidth}%`,
              backgroundColor: hexToRgba(
                seg.color,
                0.24,
              ),
            }}
            className="relative flex items-center justify-center overflow-hidden border-r border-white/10 last:border-r-0"
          >
            {segmentWidth >= 7 && (
              <span className="truncate px-1 text-[10px] font-semibold tabular-nums text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
                {seg.pct}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Expanded Panel ───────────────────────────────────────────────────────────

const RISK_TREND_RANGES: readonly {
  key: EquipmentRiskTrendRange;
  label: string;
  description: string;
}[] = [
  {
    key: "7d",
    label: "7D",
    description: "Last 7 days",
  },
  {
    key: "30d",
    label: "30D",
    description: "Last 30 days",
  },
  {
    key: "90d",
    label: "90D",
    description: "Last 90 days",
  },
  {
    key: "ytd",
    label: "YTD",
    description: "Year to date",
  },
];

function ExpandedPanel({ item, onNavigate, onNavigateToHistory }: { item: EquipmentListItem; onNavigate: (id: string) => void; onNavigateToHistory: (id: string) => void }) {
  const [explanations, setExplanations] = useState<EquipmentRiskExplanation[]>([]);
  const [
    trendSeries,
    setTrendSeries,
  ] =
    useState<EquipmentRiskTrendSeries | null>(
      null,
    );

  const [
    trendError,
    setTrendError,
  ] = useState<string | null>(
    null,
  );

  const [
    trendRange,
    setTrendRange,
  ] =
    useState<EquipmentRiskTrendRange>(
      "30d",
    );

  const [
    historyLoading,
    setHistoryLoading,
  ] = useState(false);
  const [
    showAllExplanations,
    setShowAllExplanations,
  ] = useState(false);

  useEffect(() => {
    setShowAllExplanations(false);

    void getEquipmentRiskExplanations(
      item.id,
    ).then(setExplanations);
  }, [item.id]);

  useEffect(() => {
    let cancelled = false;

    setTrendRange("30d");
    setHistoryLoading(true);
    setTrendError(null);
    setTrendSeries(null);

    void getEquipmentRiskTrendSeries(
      item.id,
    )
      .then((series) => {
        if (!cancelled) {
          setTrendSeries(series);
        }
      })
      .catch((error: unknown) => {
        console.warn(
          "Equipment risk trend could not be loaded:",
          error,
        );

        if (!cancelled) {
          setTrendError(
            error instanceof Error
              ? error.message
              : "Equipment risk trend could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item.id]);

  const visibleExplanations =
    showAllExplanations
      ? explanations.slice(0, 5)
      : explanations.slice(0, 3);

  const availableExplanationCount =
    Math.min(explanations.length, 5);

  const activeTrendRange =
    RISK_TREND_RANGES.find(
      (range) =>
        range.key === trendRange,
    ) ?? RISK_TREND_RANGES[1];

  const trend =
    trendSeries?.[trendRange] ??
    [];

  const firstTrendPoint =
    trend[0] ?? null;

  const lastTrendPoint =
    trend.length > 0
      ? trend[
          trend.length - 1
        ]
      : null;

  const trendDescription =
    activeTrendRange.description;

  const rangeChangeLabel =
    `${activeTrendRange.label} change`;

  const rangeChange =
    firstTrendPoint &&
    lastTrendPoint
      ? lastTrendPoint.riskScore -
        firstTrendPoint.riskScore
      : null;

  const latestDetailPoint =
    [...trend]
      .reverse()
      .find(
        (point) =>
          point.primaryDriver ||
          point.changeReason,
      ) ?? lastTrendPoint;

  const totalRecommendedReduction = explanations
    .slice(0, 5)
    .reduce(
      (sum, explanation) =>
        sum + explanation.estimatedReduction,
      0,
    );

  const predictedScore = Math.max(
    0,
    item.riskScore - totalRecommendedReduction,
  );

  const predictedLevel: EquipmentListItem["riskLevel"] =
    predictedScore >= 85
      ? "Critical"
      : predictedScore >= 65
        ? "High"
        : predictedScore >= 40
          ? "Medium"
          : predictedScore >= 20
            ? "Low"
            : "Minimal";

  return (
    <div className="border-l-2 border-blue-500/50 bg-[#0b0f18] px-5 py-3">
      {/* Why this risk? */}
      <div className="border-t border-gray-800 pt-3">
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why this risk?</h4>
            <p className="mt-0.5 text-[10px] text-slate-600">Ranked drivers, evidence and calculated risk reduction.</p>
          </div>
          {explanations.length > 3 && (
            <button
              type="button"
              onClick={() =>
                setShowAllExplanations(
                  (current) => !current,
                )
              }
              aria-expanded={showAllExplanations}
              className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-1.5 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
            >
              {showAllExplanations
                ? "Show top 3"
                : `View all ${availableExplanationCount} drivers`}
            </button>
          )}
        </div>
        {explanations.length === 0 ? (
          <p className="text-sm text-slate-500">No risk explanation available for this asset yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
            {visibleExplanations.map((exp) => {
              const afterScore = Math.max(0, item.riskScore - exp.estimatedReduction);
              return (
                <div key={exp.driver} className="h-full rounded-lg border border-gray-800 bg-[#141820] px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-200">
                      {exp.driver} · <span className="text-blue-400">{exp.driverPct}%</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      Score: {exp.driverScore}
                    </span>
                  </div>
                  {exp.evidence && (
                    <p className="mt-1 text-xs text-slate-400">{exp.evidence}</p>
                  )}
                  {exp.recommendedAction && (
                    <p className="mt-1 text-xs text-slate-300">
                      <span className="text-slate-500">Action: </span>{exp.recommendedAction}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Current</span>
                    <span className="font-semibold text-slate-200">{item.riskScore}</span>
                    <span className="text-slate-600">→</span>
                    <span className="text-slate-500">After action</span>
                    <span className="font-semibold text-emerald-400">{afterScore}</span>
                    <span className="ml-1 font-semibold text-emerald-500">▼ -{exp.estimatedReduction}</span>
                  </div>
                </div>
              );
            })}

            {/* Recommended action outcome and asset actions */}
            <div className="col-span-full rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                    If all recommended actions are completed
                  </p>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500">
                        Current Risk
                      </span>
                      <span className="text-sm font-semibold text-slate-200">
                        {item.riskScore}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500">
                        Predicted Risk
                      </span>
                      <span className="text-sm font-semibold text-emerald-400">
                        {predictedScore}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500">
                        Risk Level
                      </span>
                      <span className="text-sm font-semibold text-slate-200">
                        {item.riskLevel}
                        <span className="mx-1.5 text-slate-500">
                          →
                        </span>
                        <span className="text-emerald-400">
                          {predictedLevel}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-3 border-t border-emerald-500/15 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Actions
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                      Open the complete asset record, work history and supporting intelligence.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <Button
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className="h-auto w-full justify-center gap-2 border border-blue-400/40 bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-[0_0_8px_rgba(59,130,246,0.35)] hover:bg-blue-500 hover:shadow-[0_0_12px_rgba(59,130,246,0.5)]"
                    >
                      View full asset intelligence →
                    </Button>

                    <button
                      type="button"
                      onClick={() =>
                        onNavigateToHistory(item.id)
                      }
                      className="w-full rounded-md border border-gray-700 bg-transparent px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-gray-800 hover:text-slate-100"
                    >
                      View History
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full-width AI Risk Trend */}
      <div className="mt-3 border-t border-gray-800 pt-3">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              AI risk trend
            </h4>

            <p className="mt-0.5 text-[10px] text-slate-600">
              {trendDescription}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div
              role="tablist"
              aria-label="AI risk trend range"
              className="inline-flex rounded-lg border border-gray-800 bg-[#0d1117] p-1"
            >
              {RISK_TREND_RANGES.map(
                (range) => {
                  const isSelected =
                    trendRange === range.key;

                  return (
                    <button
                      key={range.key}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      disabled={historyLoading}
                      onClick={() =>
                        setTrendRange(
                          range.key,
                        )
                      }
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-400 hover:bg-gray-800 hover:text-slate-200"
                      } disabled:cursor-wait disabled:opacity-70`}
                    >
                      {range.label}
                    </button>
                  );
                },
              )}
            </div>

            {!historyLoading &&
              rangeChange !== null && (
                <div className="inline-flex items-center gap-1.5 text-[10px]">
                  <span className="text-slate-500">
                    {rangeChangeLabel}
                  </span>

                  <span
                    className={`font-semibold ${
                      rangeChange > 0
                        ? "text-red-400"
                        : rangeChange < 0
                          ? "text-emerald-400"
                          : "text-slate-400"
                    }`}
                  >
                    {rangeChange > 0
                      ? `▲ +${rangeChange}`
                      : rangeChange < 0
                        ? `▼ ${rangeChange}`
                        : "— 0"}
                  </span>
                </div>
              )}
          </div>
        </div>

        {historyLoading ? (
          <div className="flex min-h-[140px] items-center justify-center gap-2 rounded-lg border border-gray-800 bg-[#11151d] px-4 py-5 text-[11px] text-slate-500">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-400" />
            Loading equipment risk trend...
          </div>
        ) : trendError ||
          trend.length === 0 ? (
          <div className="flex min-h-[140px] items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-5 text-center text-[11px] text-red-300">
            {trendError ??
              "No equipment risk trend data is available."}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-800 bg-[#11151d] px-4 py-3">
            <div className="relative">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-[25%] border-t border-dashed border-slate-700/40"
              />

              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-[50%] border-t border-dashed border-slate-700/40"
              />

              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-[75%] border-t border-dashed border-slate-700/40"
              />

              <div
                className="grid min-h-[128px] items-end gap-1.5 sm:gap-2"
                style={{
                  gridTemplateColumns:
                    `repeat(${trend.length}, minmax(0, 1fr))`,
                }}
              >
                {trend.map(
                  (point) => {
                    const boundedValue =
                      Math.min(
                        100,
                        Math.max(
                          0,
                          point.riskScore,
                        ),
                      );

                    const barHeight =
                      Math.max(
                        10,
                        Math.round(
                          (boundedValue /
                            100) *
                            82,
                        ),
                      );

                    return (
                      <div
                        key={`${trendRange}-${point.sortOrder}`}
                        className="relative flex h-full min-w-0 flex-col items-center justify-end"
                      >
                        <span
                          className={`mb-1 text-[9px] font-semibold tabular-nums ${
                            point.isLive
                              ? "text-blue-400"
                              : "text-slate-500"
                          }`}
                        >
                          {point.riskScore}
                        </span>

                        <div className="flex h-[82px] w-full items-end justify-center">
                          <div
                            title={`${point.periodLabel}: ${point.riskScore}% risk`}
                            style={{
                              height: `${barHeight}px`,
                            }}
                            className={`w-[68%] max-w-[72px] rounded-t-sm border ${
                              point.isLive
                                ? "border-blue-400 bg-blue-500/60 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                : "border-slate-500/70 bg-slate-700/40"
                            }`}
                          />
                        </div>

                        <span
                          className={`mt-1 w-full truncate text-center text-[9px] ${
                            point.isLive
                              ? "font-medium text-blue-400"
                              : "text-slate-600"
                          }`}
                        >
                          {point.isLive
                            ? "Live"
                            : point.periodLabel}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            {latestDetailPoint &&
              (latestDetailPoint.primaryDriver ||
                latestDetailPoint.changeReason) && (
                <div className="mt-3 flex flex-col gap-1 border-t border-gray-800 pt-2">
                  {latestDetailPoint.primaryDriver && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500">
                        Primary driver
                      </span>

                      <span className="text-[10px] font-semibold text-slate-300">
                        {latestDetailPoint.primaryDriver}
                      </span>
                    </div>
                  )}

                  {latestDetailPoint.changeReason && (
                    <p className="text-[10px] leading-relaxed text-slate-500">
                      {latestDetailPoint.changeReason}
                    </p>
                  )}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, badgeLabel, badgeClass, showBar, barValue }: {
  label: string;
  value: string;
  badgeLabel?: string;
  badgeClass?: string;
  showBar?: boolean;
  barValue?: number;
}) {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex flex-col gap-0.5 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="whitespace-nowrap text-xs text-slate-400">{label}</span>
          {badgeLabel && (
            <Badge className={`h-auto rounded px-1.5 py-0 text-[10px] font-semibold shadow-none ${badgeClass}`}>
              {badgeLabel}
            </Badge>
          )}
        </div>
        <p className="text-xl font-semibold text-slate-50">{value}</p>
        {showBar && (
          <Progress value={barValue ?? 0} className="mt-0.5 h-1.5 rounded bg-gray-800 [&>div]:bg-blue-500" />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const normalizeAreaKey = (
  value: unknown,
): string =>
  String(value ?? "")
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\barea\b/g, "")
    .replace(/[^a-z0-9]/g, "");

export const EquipmentSection = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [searchParams] = useSearchParams();

  const areaParam     = searchParams.get("area");
  const buildingParam = searchParams.get("building");
  const initialArea   = areaParam ?? buildingParam;

  const [search, setSearch] = useState("");
  const [activeArea, setActiveArea] = useState<string | null>(initialArea);
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [overduePmOnly, setOverduePmOnly] = useState(false);
  const [calibrationDueOnly, setCalibrationDueOnly] =
    useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string>("");
  const [equipmentList, setEquipmentList] = useState<EquipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Keep local filter in sync with URL whenever the area param changes (e.g. navigated from dashboard)
  useEffect(() => {
    setActiveArea(initialArea);
    setExpandedId("");
  }, [initialArea]);

  // For the chip label: building codes resolve to a human label; plain area names display as-is
  const areaChipLabel = activeArea ? (resolveBuilding(activeArea)?.label ?? activeArea) : "";

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setLoadError(null);

    getEquipmentList()
      .then((items) => {
        if (cancelled) return;
        setEquipmentList(items);
        if (items.length > 0) {
          setExpandedId((current) =>
            current && items.some((item) => item.id === current) ? current : items[0].id,
          );
        } else {
          setExpandedId("");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Equipment list load failed:", error);
        setEquipmentList([]);
        setExpandedId("");
        setLoadError("Equipment data could not be loaded. Refresh the page or try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [reloadKey]);

  const filtered = useMemo(() => {
    const items = [...equipmentList].sort((a, b) => b.riskScore - a.riskScore);
    return items.filter((e) => {
      if (activeArea) {
        const resolved = resolveBuilding(activeArea);

        if (resolved) {
          const normalizedBuildingAreas =
            resolved.areas.map(normalizeAreaKey);

          if (
            !normalizedBuildingAreas.includes(
              normalizeAreaKey(e.area),
            )
          ) {
            return false;
          }
        } else if (
          normalizeAreaKey(e.area) !==
          normalizeAreaKey(activeArea)
        ) {
          return false;
        }
      }
      if (
        atRiskOnly &&
        e.riskLevel !== "Critical" &&
        e.riskLevel !== "High"
      ) {
        return false;
      }
      if (overduePmOnly && e.overduePmCount === 0) {
        return false;
      }
      if (
        calibrationDueOnly &&
        e.calibrationOverdueCount === 0
      ) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.name.toLowerCase().includes(q) &&
          !e.assetNumber.toLowerCase().includes(q) &&
          !e.area.toLowerCase().includes(q) &&
          !e.type.toLowerCase().includes(q) &&
          !e.oem.toLowerCase().includes(q) &&
          !e.criticality.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [
    equipmentList,
    activeArea,
    search,
    atRiskOnly,
    overduePmOnly,
    calibrationDueOnly,
  ]);

  const riskDriverLegend = useMemo(() => {
    const driverColours = new Map<string, string>();

    equipmentList.forEach((equipment) => {
      equipment.breakdown.forEach((segment) => {
        if (!driverColours.has(segment.label)) {
          driverColours.set(
            segment.label,
            segment.color,
          );
        }
      });
    });

    const preferredOrder = [
      "PM Backlog",
      "Asset Criticality",
      "Calibration",
      "Labour Coverage",
      "Spares",
    ];

    const orderedLabels = [
      ...preferredOrder.filter((label) =>
        driverColours.has(label),
      ),
      ...Array.from(driverColours.keys()).filter(
        (label) => !preferredOrder.includes(label),
      ),
    ];

    return orderedLabels.map((label) => ({
      label,
      color: driverColours.get(label) ?? "#64748b",
    }));
  }, [equipmentList]);

  const totalAssets = filtered.length;

  const criticalCount = filtered.filter(
    (item) => item.riskLevel === "Critical",
  ).length;

  const atRisk = filtered.filter(
    (item) =>
      item.riskLevel === "Critical" ||
      item.riskLevel === "High",
  ).length;

  const overduePms = filtered.reduce(
    (total, item) => total + item.overduePmCount,
    0,
  );

  const openWorkOrders = filtered.reduce(
    (total, item) => total + item.openWorkOrderCount,
    0,
  );

  const averageRisk =
    filtered.length > 0
      ? Math.round(
          filtered.reduce(
            (total, item) => total + item.riskScore,
            0,
          ) / filtered.length,
        )
      : 0;

  const calibrationDue = filtered.reduce(
    (total, item) => total + item.calibrationOverdueCount,
    0,
  );

  const refreshEquipment = () => {
    setExpandedId("");
    setReloadKey((value) => value + 1);
  };

  const hasActiveFilters =
    Boolean(activeArea) ||
    Boolean(search) ||
    atRiskOnly ||
    overduePmOnly ||
    calibrationDueOnly;

  const handleChipClick = (
    chip: EquipmentFilterChip,
  ) => {
    switch (chip) {
      case "Area":
        if (activeArea) {
          setActiveArea(null);
          navigate("/equipment");
        }
        break;

      case "At Risk":
        setAtRiskOnly((current) => !current);
        break;

      case "Overdue PMs":
        setOverduePmOnly((current) => !current);
        break;

      case "Calibration Due":
        setCalibrationDueOnly(
          (current) => !current,
        );
        break;
    }
  };

  const toggleRow = (id: string) => {
    setExpandedId((prev) => (prev === id ? "" : id));
  };

  const navigateToEquipment = (id: string) => {
    navigate(`/equipment/${id}/overview`);
  };

  return (
    <section className="flex w-full flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-4 md:px-6 xl:px-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">Equipment</h1>
          <p className="text-sm text-slate-400">
            Monitor asset health, operational risk and maintenance readiness across your site.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={refreshEquipment}
            className="h-auto border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-50 shadow-none hover:bg-white/15 hover:text-slate-50 disabled:opacity-60"
          >
            Refresh Risk Data
          </Button>
          <button
            type="button"
            disabled={loading}
            onClick={refreshEquipment}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 disabled:opacity-60"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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

      {/* ── KPI Bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Total Assets" value={String(totalAssets)} />
        <KpiCard
          label="Critical Assets"
          value={String(criticalCount)}
          badgeLabel={criticalCount > 0 ? "CRITICAL" : undefined}
          badgeClass="bg-[#ef444420] text-red-500"
        />
        <KpiCard
          label="Assets At Risk"
          value={String(atRisk)}
          badgeLabel={atRisk > 0 ? "HIGH" : undefined}
          badgeClass="bg-[#f9731620] text-orange-400"
        />
        <KpiCard
          label="Overdue PMs"
          value={String(overduePms)}
          badgeLabel={overduePms > 0 ? "ACTION" : undefined}
          badgeClass="bg-[#ef444420] text-red-500"
        />
        <KpiCard label="Open Work Orders" value={String(openWorkOrders)} />
        <KpiCard
          label="Average Risk"
          value={`${averageRisk}%`}
          showBar
          barValue={averageRisk}
        />
        <KpiCard label="Calibration Due" value={String(calibrationDue)} />
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search equipment, asset number, area, manufacturer or production line..."
          className="w-full rounded-xl border border-gray-800 bg-[#141820] py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
        />
      </div>

      {/* ── Filter Chips ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {FILTER_CHIPS.map((chip) => {
          const isActive =
            chip === "Area"
              ? activeArea !== null
              : chip === "At Risk"
                ? atRiskOnly
                : chip === "Overdue PMs"
                  ? overduePmOnly
                  : calibrationDueOnly;

          return (
            <button
              key={chip}
              type="button"
              onClick={() =>
                handleChipClick(chip)
              }
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                  : "border-gray-700 bg-[#141820] text-slate-400 hover:border-gray-600 hover:text-slate-200"
              }`}
            >
              {chip}
              {chip === "Area" && activeArea
                ? `: ${areaChipLabel}`
                : ""}
            </button>
          );
        })}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setActiveArea(null);
              setSearch("");
              setAtRiskOnly(false);
              setOverduePmOnly(false);
              setCalibrationDueOnly(false);
              navigate(
                "/equipment",
                { replace: true },
              );
            }}
            className="rounded-full border border-gray-700 bg-[#141820] px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Equipment Table ─────────────────────────────────────────────── */}
      <div className="w-full overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">

        {/* Table header */}
        <div className="grid grid-cols-[40px_minmax(0,7fr)_minmax(0,18fr)_108px] items-center gap-4 border-b border-gray-800 px-4 py-4">
          <div />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Equipment</span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <div
              className="flex items-center gap-1.5"
              title="Percentages show each driver's share of the asset's total calculated risk and add to 100%."
            >
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Risk Composition
              </span>

              <Info
                className="h-3.5 w-3.5 text-slate-600"
                aria-hidden="true"
              />
            </div>

            {riskDriverLegend.length > 0 && (
              <div className="flex translate-y-0.5 flex-wrap items-center gap-x-3 gap-y-1">
                {riskDriverLegend.map((driver) => (
                  <span
                    key={driver.label}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400"
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        backgroundColor: driver.color,
                      }}
                      className="h-[6px] w-[6px] shrink-0 rounded-full opacity-80"
                    />
                    {driver.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className="text-right text-[11px] font-semibold uppercase tracking-widest text-slate-500">Risk Score</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 px-5 py-16 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
            Loading equipment...
          </div>
        ) : loadError ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-red-400">Equipment data could not be loaded.</p>
            <p className="mt-1 text-xs text-slate-500">Refresh the page or try again.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-400">
              {activeArea ? `No equipment is assigned to ${areaChipLabel}.` : "No equipment found."}
            </p>
          </div>
        ) : (
          filtered.map((item, index) => {
            const isExpanded = expandedId === item.id;
            const isLast = index === filtered.length - 1;
            const badge = riskBadgeClass(item.riskLevel);
            return (
              <div key={item.id} className={!isLast || isExpanded ? "border-b border-gray-800" : ""}>

                {/* Row */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => toggleRow(item.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleRow(item.id); } }}
                  className={`grid cursor-pointer grid-cols-[40px_minmax(0,7fr)_minmax(0,18fr)_108px] items-center gap-4 px-4 py-3 transition-colors hover:bg-[#1a2030] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50 ${isExpanded ? "bg-[#141e2c]" : ""}`}
                >
                  <div className="flex items-center justify-center">
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-blue-400" />
                      : <ChevronDown className="h-4 w-4 text-slate-500" />
                    }
                  </div>

                  <div className="flex min-w-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigateToEquipment(item.id); }}
                      className="truncate text-left text-sm font-semibold text-slate-50 underline-offset-2 hover:text-blue-400 hover:underline focus-visible:outline-none"
                    >
                      {item.name}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigateToEquipment(item.id); }}
                      className="w-fit text-left text-xs text-slate-500 underline-offset-2 hover:text-blue-400 hover:underline focus-visible:outline-none"
                    >
                      {item.assetNumber}
                    </button>
                    <span className="mt-0.5 inline-flex w-fit rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-400">
                      {item.type}
                    </span>
                  </div>

                  <RiskBreakdownBar segments={item.breakdown} />

                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-2xl font-bold text-slate-50">{item.riskScore}%</span>
                    <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-semibold uppercase shadow-none ${badge}`}>
                      {item.riskLevel}
                    </Badge>
                  </div>
                </div>

                {isExpanded && (
                  <ExpandedPanel
                    item={item}
                    onNavigate={navigateToEquipment}
                    onNavigateToHistory={(id) =>
                      navigate(`/equipment/${id}/history`)
                    }
                  />
                )}
              </div>
            );
          })
        )}

        {/* Overall risk scale */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-800 px-5 py-3">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Overall risk scale
          </span>

          {RISK_LEGEND.map((level) => (
            <span
              key={level.label}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400"
            >
              <span
                className={`h-2 w-2 rounded-full ${level.dotClass}`}
              />
              {level.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Bottom Panels ───────────────────────────────────────────────── */}
      <div className="w-full">
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-50">Top 10 Highest Risk Equipment</h2>
            <ol className="flex flex-col gap-3">
              {[...equipmentList]
                .sort((a, b) => b.riskScore - a.riskScore)
                .slice(0, 10)
                .map((item, i) => (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => navigateToEquipment(item.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <span className="w-4 shrink-0 text-xs text-slate-500">{i + 1}.</span>
                      <span className="truncate text-sm text-slate-200 hover:text-blue-400">{item.name}</span>
                    </button>
                    <Badge className={`h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase shadow-none ${riskBadgeClass(item.riskLevel)}`}>
                      {item.riskLevel}
                    </Badge>
                  </li>
                ))
              }
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
