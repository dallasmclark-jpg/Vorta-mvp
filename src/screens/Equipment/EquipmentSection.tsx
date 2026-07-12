import { useEffect, useMemo, useState } from "react";
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

import { getEquipmentList, getEquipmentRiskExplanations, getEquipmentRiskHistory, resolveBuilding } from "./equipmentService";
import type { EquipmentListItem, EquipmentRiskExplanation, EquipmentRiskHistory } from "./equipmentService";

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
    case "Critical": return "bg-[#ef444420] text-red-500";
    case "High":     return "bg-[#f9731620] text-orange-400";
    case "Medium":   return "bg-[#eab30820] text-yellow-400";
    case "Low":      return "bg-[#84cc1620] text-lime-500";
    default:         return "bg-[#10b98120] text-emerald-500";
  }
}

// ─── Risk Breakdown Bar ───────────────────────────────────────────────────────

function RiskBreakdownBar({ segments }: { segments: EquipmentListItem["breakdown"] }) {
  const total = segments.reduce((s, seg) => s + seg.pct, 0) || 1;
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{ width: `${(seg.pct / total) * 100}%`, backgroundColor: seg.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((seg) => (
          <span key={seg.label} className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${seg.dotClass}`} />
            {seg.label} {seg.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSnapshotDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// ─── Expanded Panel ───────────────────────────────────────────────────────────

function ExpandedPanel({ item, onNavigate, onNavigateToHistory }: { item: EquipmentListItem; onNavigate: (id: string) => void; onNavigateToHistory: (id: string) => void }) {
  const [explanations, setExplanations] = useState<EquipmentRiskExplanation[]>([]);
  const [history, setHistory] = useState<EquipmentRiskHistory[]>([]);
  const [
    showAllExplanations,
    setShowAllExplanations,
  ] = useState(false);

  useEffect(() => {
    setShowAllExplanations(false);
    getEquipmentRiskExplanations(item.id).then(setExplanations);
    getEquipmentRiskHistory(item.id).then(setHistory);
  }, [item.id]);

  const visibleExplanations =
    showAllExplanations
      ? explanations.slice(0, 5)
      : explanations.slice(0, 3);

  const availableExplanationCount =
    Math.min(explanations.length, 5);

  return (
    <div className="border-l-2 border-blue-500/50 bg-[#0b0f18] px-5 py-4">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,2fr)_minmax(220px,0.9fr)] xl:grid-cols-[minmax(0,2.2fr)_minmax(260px,0.8fr)]">

        {/* 1 — AI Risk Trend */}
        <div className="flex flex-col gap-3">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI risk trend</h4>
            <p className="mt-0.5 text-[10px] text-slate-600">30 day history</p>
          </div>
          {history.length === 0 ? (
            <p className="text-[11px] text-slate-500">No historical snapshots available.</p>
          ) : (() => {
            const trend = history.map((h) => ({
              label: h.snapshotLabel ?? formatSnapshotDate(h.snapshotDate),
              value: h.riskScore,
            }));
            const todayScore = trend[trend.length - 1].value;
            const sevenDaysAgo = history.length >= 2 ? history[Math.max(0, history.length - 8)].riskScore : null;
            const weeklyChange = sevenDaysAgo !== null ? todayScore - sevenDaysAgo : null;
            const monthlyChange = todayScore - trend[0].value;
            const maxScore = Math.max(...trend.map((t) => t.value)) || 1;
            const lastEntry = history[history.length - 1];
            return (
              <div className="flex flex-col gap-2">
                <div className="flex min-h-[104px] items-end justify-between gap-1">
                  {trend.map((point, i) => {
                    const isLast = i === trend.length - 1;
                    const barHeight = Math.max(
                      10,
                      Math.round(
                        (point.value / maxScore) * 72,
                      ),
                    );
                    return (
                      <div key={`${point.label}-${i}`} className="flex flex-1 flex-col items-center gap-1">
                        <span className={`text-[9px] font-semibold ${isLast ? "text-blue-400" : "text-slate-500"}`}>
                          {point.value}
                        </span>
                        <div
                          style={{ height: `${barHeight}px` }}
                          className={`w-full rounded-sm ${isLast ? "bg-blue-500" : "bg-slate-700"}`}
                        />
                        <span className={`text-[9px] ${isLast ? "font-semibold text-blue-400" : "text-slate-600"}`}>
                          {point.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Weekly</span>
                  {weeklyChange !== null ? (
                    <span className={`text-[10px] font-semibold ${weeklyChange > 0 ? "text-red-400" : weeklyChange < 0 ? "text-emerald-400" : "text-slate-400"}`}>
                      {weeklyChange > 0 ? `▲ +${weeklyChange}` : weeklyChange < 0 ? `▼ ${weeklyChange}` : "— 0"}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">--</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Monthly</span>
                  <span className={`text-[10px] font-semibold ${monthlyChange > 0 ? "text-red-400" : monthlyChange < 0 ? "text-emerald-400" : "text-slate-400"}`}>
                    {monthlyChange > 0 ? `▲ +${monthlyChange}` : monthlyChange < 0 ? `▼ ${monthlyChange}` : "— 0"}
                  </span>
                </div>

                {lastEntry.primaryDriver && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">Primary driver</span>
                    <span className="text-[10px] font-semibold text-slate-300">{lastEntry.primaryDriver}</span>
                  </div>
                )}

                {lastEntry.changeReason && (
                  <p className="text-[10px] leading-relaxed text-slate-500">{lastEntry.changeReason}</p>
                )}
              </div>
            );
          })()}
        </div>

        {/* 2 — Actions */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</h4>
          <p className="text-sm leading-relaxed text-slate-300">
            Open the complete asset record.
          </p>
          <p className="text-[10px] leading-relaxed text-slate-500">
            PMs, work orders, history, skills, spares, documents and AI insights.
          </p>
          <div className="mt-auto flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => onNavigate(item.id)}
              className="h-auto w-full justify-center gap-2 border border-blue-400/40 bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white shadow-[0_0_8px_rgba(59,130,246,0.35)] hover:bg-blue-500 hover:shadow-[0_0_12px_rgba(59,130,246,0.5)]"
            >
              View full asset intelligence →
            </Button>
            <button
              type="button"
              onClick={() => onNavigateToHistory(item.id)}
              className="w-full rounded-md border border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-gray-800 hover:text-slate-100"
            >
              View History
            </button>
          </div>
        </div>

      </div>

      {/* Why this risk? */}
      <div className="mt-5 border-t border-gray-800 pt-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {visibleExplanations.map((exp) => {
              const afterScore = Math.max(0, item.riskScore - exp.estimatedReduction);
              return (
                <div key={exp.driver} className="h-full rounded-lg border border-gray-800 bg-[#141820] px-4 py-3">
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

            {/* Summary card */}
            {(() => {
              const totalReduction = explanations.slice(0, 5).reduce((sum, e) => sum + e.estimatedReduction, 0);
              const predictedScore = Math.max(0, item.riskScore - totalReduction);
              const predictedLevel =
                predictedScore >= 85 ? "Critical" :
                predictedScore >= 65 ? "High" :
                predictedScore >= 40 ? "Medium" :
                predictedScore >= 20 ? "Low" : "Minimal";
              const currentLevel = item.riskLevel;
              return (
                <div className="col-span-full rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                    If all recommended actions are completed
                  </p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500">Current Risk</span>
                      <span className="font-semibold text-slate-200">{item.riskScore}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500">Predicted Risk</span>
                      <span className="font-semibold text-emerald-400">{predictedScore}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500">Risk Level</span>
                      <span className="font-semibold text-slate-200">
                        {currentLevel} <span className="text-slate-500">→</span> <span className="text-emerald-400">{predictedLevel}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
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
      <CardContent className="flex flex-col gap-1 p-3">
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
          <Progress value={barValue ?? 0} className="mt-1 h-1.5 rounded bg-gray-800 [&>div]:bg-blue-500" />
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

      {/* ── Active area filter label ─────────────────────────────────── */}
      {activeArea && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>Showing area:</span>
          <span className="font-semibold text-slate-200">{areaChipLabel}</span>
          <button
            type="button"
            onClick={() => { setActiveArea(null); navigate("/equipment"); }}
            className="ml-1 rounded border border-gray-700 px-2 py-0.5 text-xs text-slate-500 transition-colors hover:border-gray-600 hover:text-slate-300"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Equipment Table ─────────────────────────────────────────────── */}
      <div className="w-full overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">

        {/* Table header */}
        <div className="grid grid-cols-[40px_minmax(0,1fr)_minmax(0,2fr)_120px] items-center gap-4 border-b border-gray-800 px-4 py-3">
          <div />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Equipment</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Risk Drivers</span>
            <Info className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
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
                  className={`grid cursor-pointer grid-cols-[40px_minmax(0,1fr)_minmax(0,2fr)_120px] items-center gap-4 px-4 py-4 transition-colors hover:bg-[#1a2030] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50 ${isExpanded ? "bg-[#141f2e]" : ""}`}
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

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-800 px-5 py-3">
          {RISK_LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`h-2 w-2 rounded-full ${l.dotClass}`} />
              {l.label}
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
