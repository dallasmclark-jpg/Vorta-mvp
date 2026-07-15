import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bell,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Database,
  Download,
  FileSearch,
  Gauge,
  History,
  RefreshCw,
  Repeat2,
  Search,
  ShieldCheck,
  Sparkles,
  UserCircle,
  Wrench,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  DEFAULT_EQUIPMENT_ID,
  type EquipmentBase,
} from "./equipmentData";
import {
  getCachedEquipmentIdentity,
  getEquipmentActivity,
  getEquipmentIdentityById,
  getEquipmentRecommendedWorkQueue,
  getEquipmentRiskHistory,
  type EquipmentRecommendedWorkQueue,
  type EquipmentRiskHistory,
} from "./equipmentService";
import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";
import { EquipmentHistoryTimeline } from "./EquipmentHistoryTimeline";

type HistoryRange = "all" | "12m" | "6m" | "30d";
type HistoryFilter =
  | "ALL"
  | "ATTENTION"
  | "CORRECTIVE"
  | "PREVENTIVE"
  | "INSPECTION";

interface HistoryRow {
  date: string;
  woNumber: string;
  type: string;
  priority: string;
  description: string;
  downtime: string;
  outcome: string;
}

interface FailurePattern {
  label: string;
  count: number;
  downtimeMinutes: number;
  weakOutcomes: number;
  references: string[];
  latestDate: string;
}

interface MetricProps {
  label: string;
  value: string | number;
  detail: string;
  tone?: string;
}

function Metric({
  label,
  value,
  detail,
  tone = "text-slate-50",
}: MetricProps): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0b1017]/80 p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className={`mt-1.5 text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p>
    </div>
  );
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const iso = new Date(`${value}T00:00:00`);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function formatDate(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return value || "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: Date | null): string {
  if (!value) return "Loading latest history";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function parseDowntimeMinutes(value: string): number {
  const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] ?? 0);
  const minutes = Number(value.match(/(\d+)\s*m/i)?.[1] ?? 0);
  return Math.round(hours * 60 + minutes);
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function normalise(value: string): string {
  return value.trim().toUpperCase();
}

function isCorrective(row: HistoryRow): boolean {
  const type = normalise(row.type);
  return type.includes("CORRECTIVE") || type.includes("BREAKDOWN");
}

function isPreventive(row: HistoryRow): boolean {
  return normalise(row.type).includes("PREVENTIVE");
}

function isInspection(row: HistoryRow): boolean {
  const type = normalise(row.type);
  return type.includes("INSPECTION") || type.includes("CALIBRATION");
}

function isWeakOutcome(outcome: string): boolean {
  const value = normalise(outcome);
  return (
    value.includes("TEMPORARY") ||
    value.includes("RECUR") ||
    value.includes("PARTIAL") ||
    value.includes("OPEN") ||
    value.includes("FAIL") ||
    value.includes("HOLD")
  );
}

function isResolvedOutcome(outcome: string): boolean {
  const value = normalise(outcome);
  return (
    value.includes("SUCCESS") ||
    value.includes("RESOLVED") ||
    value.includes("COMPLETED") ||
    value.includes("PASS")
  );
}

function priorityRank(priority: string): number {
  switch (normalise(priority)) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    default:
      return 1;
  }
}

function priorityClass(priority: string): string {
  switch (normalise(priority)) {
    case "CRITICAL":
      return "border-red-500/25 bg-red-500/10 text-red-300";
    case "HIGH":
      return "border-orange-500/25 bg-orange-500/10 text-orange-300";
    case "MEDIUM":
      return "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";
    default:
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
}

function typeClass(type: string): string {
  const value = normalise(type);
  if (value.includes("BREAKDOWN")) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (value.includes("CORRECTIVE")) {
    return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  }
  if (value.includes("PREVENTIVE")) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  if (value.includes("CALIBRATION")) {
    return "border-cyan-500/25 bg-cyan-500/10 text-cyan-300";
  }
  if (value.includes("INSPECTION")) {
    return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  }
  return "border-slate-600 bg-slate-800/70 text-slate-300";
}

function outcomeClass(outcome: string): string {
  if (isWeakOutcome(outcome)) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (isResolvedOutcome(outcome)) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  return "border-slate-600 bg-slate-800/70 text-slate-300";
}

function riskTone(level: string): string {
  switch (level.toLowerCase()) {
    case "critical":
      return "border-red-500/25 bg-red-500/10 text-red-300";
    case "high":
      return "border-orange-500/25 bg-orange-500/10 text-orange-300";
    case "medium":
      return "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";
    default:
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
}

function extractFailurePattern(description: string): string | null {
  const faultCode = description.match(/\bF-\d{3,}\b/i)?.[0];
  if (faultCode) return faultCode.toUpperCase();

  const text = description.toLowerCase();
  const patterns: Array<[string, string[]]> = [
    ["Reject sensor / false reject", ["reject sensor", "false reject", "reject confirmation"]],
    ["Reject actuator / cylinder", ["reject actuator", "reject cylinder", "return position"]],
    ["Filler bowl level control", ["filler bowl", "level control"]],
    ["PLC / communication", ["plc", "communication fault"]],
    ["HMI / batch pause", ["hmi", "batch pause"]],
    ["Servo axis", ["servo"]],
    ["Bearing / vibration", ["bearing", "vibration"]],
    ["Guard interlock", ["guard door", "interlock"]],
    ["Pneumatic supply", ["pneumatic", "air pressure", "valve manifold"]],
    ["Calibration drift", ["calibration", "tolerance", "adjustment"]],
  ];

  for (const [label, terms] of patterns) {
    if (terms.some((term) => text.includes(term))) return label;
  }

  return null;
}


export const EquipmentHistory = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;

  const [equipment, setEquipment] = useState<EquipmentBase | null>(() =>
    getCachedEquipmentIdentity(resolvedId),
  );
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [riskHistory, setRiskHistory] = useState<EquipmentRiskHistory[]>([]);
  const [riskQueue, setRiskQueue] =
    useState<EquipmentRecommendedWorkQueue | null>(null);
  const [range, setRange] = useState<HistoryRange>("12m");
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [search, setSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    void getEquipmentIdentityById(resolvedId).then(setEquipment);
  }, [resolvedId]);

  const loadHistoryIntelligence = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [activity, riskSnapshots, queue] = await Promise.all([
        getEquipmentActivity(resolvedId),
        getEquipmentRiskHistory(resolvedId, 365),
        getEquipmentRecommendedWorkQueue(resolvedId),
      ]);

      setHistoryRows(
        activity.map((row) => ({
          date: row.date,
          woNumber: row.woNumber,
          type: row.type,
          priority: row.priority,
          description: row.description,
          downtime: row.downtime,
          outcome: row.outcome,
        })),
      );
      setRiskHistory(riskSnapshots);
      setRiskQueue(queue);
      setLastUpdated(new Date());
    } catch (error) {
      console.warn("Equipment history intelligence failed:", error);
      setHistoryRows([]);
      setRiskHistory([]);
      setRiskQueue(null);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Equipment history could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => {
    void loadHistoryIntelligence();
  }, [loadHistoryIntelligence]);

  const referenceDate = useMemo(() => {
    const validDates = historyRows
      .map((row) => parseDate(row.date))
      .filter((date): date is Date => Boolean(date));
    if (validDates.length === 0) return new Date();
    return new Date(Math.max(...validDates.map((date) => date.getTime())));
  }, [historyRows]);

  const rangedRows = useMemo(() => {
    if (range === "all") return historyRows;

    const cutoff = new Date(referenceDate);
    if (range === "12m") cutoff.setMonth(cutoff.getMonth() - 12);
    if (range === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
    if (range === "30d") cutoff.setDate(cutoff.getDate() - 30);

    return historyRows.filter((row) => {
      const date = parseDate(row.date);
      return date ? date >= cutoff : false;
    });
  }, [historyRows, range, referenceDate]);

  const correctiveRows = useMemo(
    () => rangedRows.filter(isCorrective),
    [rangedRows],
  );

  const preventiveRows = useMemo(
    () => rangedRows.filter((row) => isPreventive(row) || isInspection(row)),
    [rangedRows],
  );

  const failurePatterns = useMemo<FailurePattern[]>(() => {
    const map = new Map<string, FailurePattern>();

    correctiveRows.forEach((row) => {
      const label = extractFailurePattern(row.description);
      if (!label) return;

      const existing = map.get(label) ?? {
        label,
        count: 0,
        downtimeMinutes: 0,
        weakOutcomes: 0,
        references: [],
        latestDate: row.date,
      };
      existing.count += 1;
      existing.downtimeMinutes += parseDowntimeMinutes(row.downtime);
      existing.weakOutcomes += isWeakOutcome(row.outcome) ? 1 : 0;
      if (!existing.references.includes(row.woNumber)) {
        existing.references.push(row.woNumber);
      }
      const existingDate = parseDate(existing.latestDate)?.getTime() ?? 0;
      const rowDate = parseDate(row.date)?.getTime() ?? 0;
      if (rowDate > existingDate) existing.latestDate = row.date;
      map.set(label, existing);
    });

    return [...map.values()].sort(
      (left, right) =>
        right.count - left.count ||
        right.downtimeMinutes - left.downtimeMinutes,
    );
  }, [correctiveRows]);

  const highestPattern = failurePatterns[0] ?? null;
  const weakOutcomeRows = useMemo(
    () => rangedRows.filter((row) => isWeakOutcome(row.outcome)),
    [rangedRows],
  );
  const resolvedRows = useMemo(
    () => rangedRows.filter((row) => isResolvedOutcome(row.outcome)),
    [rangedRows],
  );
  const totalDowntimeMinutes = useMemo(
    () =>
      rangedRows.reduce(
        (sum, row) => sum + parseDowntimeMinutes(row.downtime),
        0,
      ),
    [rangedRows],
  );
  const topDowntimeRows = useMemo(
    () =>
      [...rangedRows]
        .sort(
          (left, right) =>
            parseDowntimeMinutes(right.downtime) -
            parseDowntimeMinutes(left.downtime),
        )
        .slice(0, 3),
    [rangedRows],
  );
  const topDowntimeMinutes = topDowntimeRows.reduce(
    (sum, row) => sum + parseDowntimeMinutes(row.downtime),
    0,
  );
  const downtimeConcentration =
    totalDowntimeMinutes > 0
      ? Math.round((topDowntimeMinutes / totalDowntimeMinutes) * 100)
      : 0;
  const repeatedEventCount = failurePatterns
    .filter((pattern) => pattern.count > 1)
    .reduce((sum, pattern) => sum + pattern.count, 0);
  const recurrenceRate =
    correctiveRows.length > 0
      ? Math.round((repeatedEventCount / correctiveRows.length) * 100)
      : 0;
  const avgCorrectiveDowntime =
    correctiveRows.length > 0
      ? Math.round(
          correctiveRows.reduce(
            (sum, row) => sum + parseDowntimeMinutes(row.downtime),
            0,
          ) / correctiveRows.length,
        )
      : 0;
  const outcomeQuality =
    rangedRows.length > 0
      ? Math.round((resolvedRows.length / rangedRows.length) * 100)
      : 100;
  const evidenceCompleteness =
    rangedRows.length > 0
      ? Math.round(
          (rangedRows.filter(
            (row) =>
              row.woNumber &&
              row.date &&
              row.description &&
              row.type &&
              row.outcome,
          ).length /
            rangedRows.length) *
            100,
        )
      : 100;

  const latestRisk =
    riskHistory.length > 0
      ? riskHistory[riskHistory.length - 1].riskScore
      : equipment?.riskScore ?? 0;
  const earliestRisk = riskHistory[0]?.riskScore ?? latestRisk;
  const riskChange = latestRisk - earliestRisk;
  const projectedRisk = riskQueue?.projectedRiskScore ?? latestRisk;

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...rangedRows]
      .filter((row) => {
        const matchesFilter =
          filter === "ALL" ||
          (filter === "ATTENTION" &&
            (isWeakOutcome(row.outcome) ||
              priorityRank(row.priority) >= 3 ||
              parseDowntimeMinutes(row.downtime) > 0)) ||
          (filter === "CORRECTIVE" && isCorrective(row)) ||
          (filter === "PREVENTIVE" && isPreventive(row)) ||
          (filter === "INSPECTION" && isInspection(row));
        if (!matchesFilter) return false;
        if (!query) return true;

        return [
          row.woNumber,
          row.description,
          row.type,
          row.priority,
          row.outcome,
          row.date,
        ].some((value) => value.toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const leftDate = parseDate(left.date)?.getTime() ?? 0;
        const rightDate = parseDate(right.date)?.getTime() ?? 0;
        return rightDate - leftDate;
      });
  }, [filter, rangedRows, search]);

  const briefing = useMemo(() => {
    if (!equipment) return "";
    const patternSentence = highestPattern
      ? `${highestPattern.label} is the leading repeat pattern with ${highestPattern.count} linked events and ${formatDuration(highestPattern.downtimeMinutes)} recorded downtime.`
      : "No repeat failure pattern is currently dominant in the available SAP history.";
    const outcomeSentence =
      weakOutcomeRows.length > 0
        ? `${weakOutcomeRows.length} record${weakOutcomeRows.length === 1 ? "" : "s"} ended with an open, temporary, partial or recurring outcome.`
        : "No weak maintenance outcomes are present in the selected period.";

    return `${equipment.name} has ${rangedRows.length} maintenance records in the selected period, including ${correctiveRows.length} corrective or breakdown events and ${preventiveRows.length} preventive, inspection or calibration events. ${patternSentence} ${outcomeSentence} The three largest events account for ${downtimeConcentration}% of recorded downtime, while equipment risk is currently ${latestRisk}% with ${Math.abs(riskChange)} point${Math.abs(riskChange) === 1 ? "" : "s"} ${riskChange > 0 ? "increase" : riskChange < 0 ? "reduction" : "change"} across the available risk history.`;
  }, [
    correctiveRows.length,
    downtimeConcentration,
    equipment,
    highestPattern,
    latestRisk,
    preventiveRows.length,
    rangedRows.length,
    riskChange,
    weakOutcomeRows.length,
  ]);

  const copyValue = useCallback(async (value: string, key: string) => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => {
        setCopied((current) => (current === key ? null : current));
      }, 1600);
    } catch (error) {
      console.warn("History reference copy failed:", error);
    }
  }, []);

  const askVorta = useCallback(
    (prompt?: string) => {
      if (!equipment) return;
      const resolvedPrompt =
        prompt ||
        question.trim() ||
        `Analyse the maintenance history for ${equipment.name}. Identify repeat failures, weak outcomes, downtime concentration and the highest-value reliability actions, citing relevant work orders, parts and documents.`;
      navigate(
        `/equipment/${equipment.id}/ai-insights?prompt=${encodeURIComponent(
          resolvedPrompt,
        )}`,
      );
    },
    [equipment, navigate, question],
  );

  const openWorkOrder = useCallback(
    (workOrderNumber: string) => {
      if (!equipment) return;
      navigate(
        `/equipment/${equipment.id}/work-orders?workOrder=${encodeURIComponent(
          workOrderNumber,
        )}#work-order-register`,
      );
    },
    [equipment, navigate],
  );

  const exportHistory = useCallback(() => {
    if (!equipment) return;
    const rows = [
      [
        "Date",
        "Work Order",
        "Type",
        "Priority",
        "Description",
        "Downtime",
        "Outcome",
        "Failure Pattern",
      ],
      ...filteredRows.map((row) => [
        row.date,
        row.woNumber,
        row.type,
        row.priority,
        row.description,
        row.downtime,
        row.outcome,
        extractFailurePattern(row.description) ?? "",
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${equipment.assetNumber}-maintenance-history-intelligence.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [equipment, filteredRows]);

  if (!equipment) {
    return (
      <section className="flex w-full flex-col overflow-x-hidden pb-10">
        <div className="border-b border-gray-800 bg-[#0b0e14] px-4 py-4 md:px-6">
          <div className="h-40 animate-pulse rounded-xl bg-[#141820]" />
        </div>
      </section>
    );
  }

  const riskTotal =
    equipment.riskBreakdown.reduce(
      (sum, driver) => sum + driver.pct,
      0,
    ) || 1;
  const riskBadgeClass = riskTone(equipment.riskLevel);
  const maxPatternCount = Math.max(
    1,
    ...failurePatterns.map((pattern) => pattern.count),
  );
  const primaryRiskAction = riskQueue?.actions[0] ?? null;

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
      {loadError ? (
        <div className="mx-4 mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-xs text-red-200 md:mx-6">
          {loadError}
        </div>
      ) : null}

      <div className="sticky top-0 z-10 border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500"
          >
            <button
              type="button"
              onClick={() => navigate("/equipment")}
              className="transition-colors hover:text-slate-300"
            >
              Equipment
            </button>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-slate-300">
              {equipment.name} ({equipment.assetNumber})
            </span>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void copyValue(equipment.assetNumber, "asset")}
              className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs text-slate-300 hover:bg-gray-800 hover:text-slate-100"
            >
              {copied === "asset" ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied === "asset" ? "Copied" : "Copy asset ref"}
            </Button>
            <button
              type="button"
              onClick={() => void loadHistoryIntelligence()}
              disabled={loading}
              aria-label="Refresh maintenance history intelligence"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={() => navigate(`/equipment/${equipment.id}/notifications`)}
              aria-label="Equipment notifications"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/settings")}
              aria-label="Profile settings"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200"
            >
              <UserCircle className="h-7 w-7" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">
            <img
              src={equipment.image}
              alt={equipment.name}
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">
                {equipment.name}
              </h1>
              <Badge
                className={`inline-flex h-auto rounded border px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}
              >
                {equipment.riskLevel} Risk
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <EquipmentRiskIndicator riskLevel={equipment.riskLevel} />
              <span className="text-sm font-semibold text-slate-200">
                {equipment.status}
              </span>
              <span className="text-sm text-slate-500">
                {equipment.statusNote}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="font-medium text-slate-300">
                {equipment.assetNumber}
              </span>
              <span className="rounded bg-gray-800 px-1.5 py-0.5 font-medium tracking-wide">
                {equipment.type}
              </span>
              <span>📍 {equipment.area}</span>
              <span>
                Manufacturer: {" "}
                <span className="text-slate-300">
                  {equipment.manufacturer}
                </span>
              </span>
              <span>
                Model: <span className="text-slate-300">{equipment.model}</span>
              </span>
              <span>
                Criticality: {" "}
                <span className="text-slate-300">
                  {equipment.criticality}
                </span>
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 lg:w-52">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Risk Score
            </span>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-slate-50">
                {equipment.riskScore}%
              </span>
              <Badge
                className={`mb-1 inline-flex h-auto rounded border px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}
              >
                {equipment.riskLevel}
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500">
                Risk drivers
              </span>
              <div className="flex h-2 overflow-hidden rounded-full bg-gray-800">
                {equipment.riskBreakdown.map((driver) => (
                  <div
                    key={driver.label}
                    style={{
                      width: `${(driver.pct / riskTotal) * 100}%`,
                      backgroundColor: driver.color,
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {equipment.riskBreakdown.map((driver) => (
                  <span
                    key={driver.label}
                    className="inline-flex items-center gap-1 text-[10px] text-slate-400"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${driver.dotClass}`}
                    />
                    {driver.label} {driver.pct}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <EquipmentTabNavigation
          equipmentId={equipment.id}
          activeTab="history"
        />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">
        <Card className="overflow-hidden rounded-2xl border border-violet-500/25 bg-[linear-gradient(135deg,#151824_0%,#10151d_55%,#151222_100%)] shadow-none">
          <CardContent className="p-0">
            <div className="grid xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.55fr)]">
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="h-auto rounded bg-violet-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300 shadow-none">
                    Reliability history intelligence
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Database className="h-3.5 w-3.5" />
                    SAP work history · downtime · outcomes · risk snapshots · {formatDateTime(lastUpdated)}
                  </span>
                </div>

                <h2 className="mt-4 text-xl font-semibold text-slate-50">
                  Reliability History Briefing
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                  {briefing}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    label="History records"
                    value={rangedRows.length}
                    detail={`${correctiveRows.length} corrective · ${preventiveRows.length} planned or verified`}
                  />
                  <Metric
                    label="Recorded downtime"
                    value={formatDuration(totalDowntimeMinutes)}
                    detail={`${formatDuration(avgCorrectiveDowntime)} average per corrective event`}
                    tone={totalDowntimeMinutes > 0 ? "text-orange-300" : "text-emerald-300"}
                  />
                  <Metric
                    label="Recurrence rate"
                    value={`${recurrenceRate}%`}
                    detail={`${failurePatterns.filter((pattern) => pattern.count > 1).length} repeat pattern${failurePatterns.filter((pattern) => pattern.count > 1).length === 1 ? "" : "s"} detected`}
                    tone={recurrenceRate >= 40 ? "text-red-300" : recurrenceRate > 0 ? "text-yellow-300" : "text-emerald-300"}
                  />
                  <Metric
                    label="Outcome quality"
                    value={`${outcomeQuality}%`}
                    detail={`${weakOutcomeRows.length} weak or unresolved outcome${weakOutcomeRows.length === 1 ? "" : "s"}`}
                    tone={outcomeQuality >= 80 ? "text-emerald-300" : outcomeQuality >= 60 ? "text-yellow-300" : "text-red-300"}
                  />
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-gray-700 bg-[#0a0f16] px-3 focus-within:border-violet-500/60">
                    <Sparkles className="h-4 w-4 shrink-0 text-violet-400" />
                    <input
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") askVorta();
                      }}
                      placeholder={`Ask Vorta about ${equipment.assetNumber} reliability history...`}
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => askVorta()}
                    className="min-h-11 gap-2 bg-violet-600 px-5 text-white hover:bg-violet-500"
                  >
                    <BrainCircuit className="h-4 w-4" />
                    Ask Vorta
                  </Button>
                </div>
              </div>

              <div className="border-t border-gray-800 bg-[#0b1017]/70 p-5 xl:border-l xl:border-t-0 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Highest recurring exposure
                </p>

                {highestPattern ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-300">
                        <Repeat2 className="h-5 w-5" />
                      </div>
                      <Badge className="h-auto rounded border border-red-500/25 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300 shadow-none">
                        {highestPattern.count} linked events
                      </Badge>
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-slate-100">
                      {highestPattern.label}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      The pattern has generated {formatDuration(highestPattern.downtimeMinutes)} recorded downtime and {highestPattern.weakOutcomes} weak or recurring outcome{highestPattern.weakOutcomes === 1 ? "" : "s"}.
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Metric
                        label="Latest event"
                        value={formatDate(highestPattern.latestDate)}
                        detail="Most recent linked record"
                      />
                      <Metric
                        label="Risk after actions"
                        value={`${projectedRisk}%`}
                        detail={`${riskQueue?.totalCalculatedReduction ?? 0} points available`}
                        tone="text-emerald-300"
                      />
                    </div>

                    <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-300/80">
                        Linked evidence
                      </p>
                      <p className="mt-1 break-words font-mono text-xs leading-5 text-violet-100/70">
                        {highestPattern.references.slice(0, 4).join(" · ")}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        askVorta(
                          `Analyse the repeat failure pattern ${highestPattern.label} on ${equipment.name}. Use ${highestPattern.references.join(", ")} and explain the likely root cause, weak repairs, downtime impact, relevant spares, documents and permanent corrective action.`,
                        )
                      }
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300"
                    >
                      Analyse repeat failure
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <p className="mt-3 text-sm font-semibold text-emerald-200">
                      No dominant repeat pattern
                    </p>
                    <p className="mt-1 text-xs leading-5 text-emerald-100/60">
                      The available maintenance history does not currently show a recurring failure mode.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.45fr)]">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
  <CardContent className="p-5 md:p-6">
    <EquipmentHistoryTimeline
      equipmentId={equipment.id}
      rows={historyRows}
      range={range}
      onRangeChange={setRange}
      loading={loading}
      onOpenWorkOrder={openWorkOrder}
    />
  </CardContent>
</Card>

<Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-cyan-400" />
                <h2 className="text-base font-semibold text-slate-100">
                  Current Reliability Context
                </h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Historical evidence connected to the live Vorta risk model.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric
                  label="Current risk"
                  value={`${latestRisk}%`}
                  detail={equipment.riskLevel}
                  tone={latestRisk >= 75 ? "text-red-300" : latestRisk >= 50 ? "text-orange-300" : "text-emerald-300"}
                />
                <Metric
                  label="Projected risk"
                  value={`${projectedRisk}%`}
                  detail={`${riskQueue?.totalCalculatedReduction ?? 0} points available`}
                  tone="text-emerald-300"
                />
                <Metric
                  label="Risk movement"
                  value={`${riskChange > 0 ? "+" : ""}${riskChange}`}
                  detail="Across available snapshots"
                  tone={riskChange > 0 ? "text-red-300" : riskChange < 0 ? "text-emerald-300" : "text-slate-100"}
                />
                <Metric
                  label="Evidence quality"
                  value={`${evidenceCompleteness}%`}
                  detail="Core record fields present"
                  tone={evidenceCompleteness >= 90 ? "text-emerald-300" : "text-yellow-300"}
                />
              </div>

              {primaryRiskAction ? (
                <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">
                    Highest-value current action
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-5 text-slate-100">
                    {primaryRiskAction.action}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {primaryRiskAction.detail ?? primaryRiskAction.driver}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const action = primaryRiskAction;
                      if (action.workOrderNumber) {
                        openWorkOrder(action.workOrderNumber);
                      } else if (action.sparePartNumber) {
                        navigate(`/equipment/${equipment.id}/spares`);
                      } else {
                        askVorta(`Explain why this is the highest-value action for ${equipment.name}: ${action.action}`);
                      }
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                  >
                    Open supporting evidence
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Repeat2 className="h-4 w-4 text-red-400" />
                    <h2 className="text-base font-semibold text-slate-100">
                      Failure Pattern Intelligence
                    </h2>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Repeated fault codes and recurring maintenance themes ranked by frequency and downtime.
                  </p>
                </div>
                <Badge className="h-auto rounded border border-red-500/20 bg-red-500/[0.07] px-2 py-1 text-[10px] font-semibold text-red-300 shadow-none">
                  {failurePatterns.filter((pattern) => pattern.count > 1).length} repeat patterns
                </Badge>
              </div>

              <div className="mt-5 space-y-3">
                {failurePatterns.slice(0, 6).map((pattern, index) => (
                  <article
                    key={pattern.label}
                    className="rounded-xl border border-gray-800 bg-[#0d1219] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-xs font-bold text-red-300">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-100">
                              {pattern.label}
                            </h3>
                            <p className="mt-1 font-mono text-[10px] text-blue-300">
                              {pattern.references.slice(0, 5).join(" · ")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-slate-100">
                              {pattern.count}
                            </p>
                            <p className="text-[9px] uppercase tracking-wide text-slate-600">
                              events
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800">
                          <div
                            className="h-full rounded-full bg-red-400/70 ring-1 ring-inset ring-red-300/60"
                            style={{
                              width: `${(pattern.count / maxPatternCount) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>{formatDuration(pattern.downtimeMinutes)} downtime</span>
                          <span>{pattern.weakOutcomes} weak outcome{pattern.weakOutcomes === 1 ? "" : "s"}</span>
                          <span>Latest {formatDate(pattern.latestDate)}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}

                {!loading && failurePatterns.length === 0 ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-8 text-center">
                    <ShieldCheck className="mx-auto h-6 w-6 text-emerald-400" />
                    <p className="mt-3 text-sm font-semibold text-emerald-200">
                      No recurring failure pattern detected
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Available corrective history does not yet form a repeat cluster.
                    </p>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-orange-400" />
                  <h2 className="text-sm font-semibold text-slate-100">
                    Downtime Concentration
                  </h2>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  The largest recorded events in the selected period.
                </p>

                <div className="mt-4 space-y-3">
                  {topDowntimeRows.map((row, index) => {
                    const minutes = parseDowntimeMinutes(row.downtime);
                    const width =
                      topDowntimeMinutes > 0
                        ? (minutes / Math.max(1, parseDowntimeMinutes(topDowntimeRows[0]?.downtime ?? ""))) * 100
                        : 0;
                    return (
                      <button
                        key={row.woNumber}
                        type="button"
                        onClick={() => openWorkOrder(row.woNumber)}
                        className="w-full rounded-xl border border-gray-800 bg-[#0d1219] p-3 text-left transition-colors hover:border-blue-500/30 hover:bg-blue-500/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-mono text-[10px] text-blue-300">
                              {index + 1}. {row.woNumber}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">
                              {row.description}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-orange-300">
                            {row.downtime}
                          </span>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800">
                          <div
                            className="h-full rounded-full bg-orange-400/70"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  Top three events account for <span className="font-semibold text-orange-300">{downtimeConcentration}%</span> of recorded downtime.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-slate-100">
                    Maintenance Balance
                  </h2>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Planned work versus reactive intervention in the selected period.
                </p>

                <div className="mt-4 space-y-3">
                  {[
                    { label: "Corrective / breakdown", value: correctiveRows.length, tone: "bg-red-400" },
                    { label: "Preventive", value: rangedRows.filter(isPreventive).length, tone: "bg-emerald-400" },
                    { label: "Inspection / calibration", value: rangedRows.filter(isInspection).length, tone: "bg-cyan-400" },
                    { label: "Other", value: rangedRows.filter((row) => !isCorrective(row) && !isPreventive(row) && !isInspection(row)).length, tone: "bg-slate-500" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-400">{item.label}</span>
                        <span className="font-semibold text-slate-200">{item.value}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
                        <div
                          className={`h-full rounded-full ${item.tone}`}
                          style={{
                            width: `${rangedRows.length > 0 ? (item.value / rangedRows.length) * 100 : 0}%`,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card
          id="history-register"
          className="scroll-mt-48 rounded-2xl border border-gray-800 bg-[#141820] shadow-none"
        >
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-gray-800 p-4 lg:flex-row lg:items-center lg:justify-between md:p-5">
              <div>
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-violet-400" />
                  <h2 className="text-base font-semibold text-slate-100">
                    Maintenance Evidence Register
                  </h2>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Searchable SAP work history with outcome, downtime and repeat-pattern evidence.
                </p>
              </div>

              <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search WO, failure, outcome..."
                    className="h-9 w-full rounded-lg border border-gray-700 bg-[#0b0e14] pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-violet-500 sm:w-64"
                  />
                </div>

                <div className="flex flex-wrap rounded-lg border border-gray-700 bg-[#0b0e14] p-1">
                  {([
                    ["All", "ALL"],
                    ["Attention", "ATTENTION"],
                    ["Corrective", "CORRECTIVE"],
                    ["Preventive", "PREVENTIVE"],
                    ["Inspection", "INSPECTION"],
                  ] as const).map(([label, value]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        filter === value
                          ? "bg-violet-600 text-white"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={exportHistory}
                  className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800 hover:text-slate-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-800 text-[10px] uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3 font-semibold">Date / reference</th>
                    <th className="px-4 py-3 font-semibold">Work type</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Maintenance evidence</th>
                    <th className="px-4 py-3 font-semibold">Downtime</th>
                    <th className="px-4 py-3 font-semibold">Outcome</th>
                    <th className="px-4 py-3 font-semibold">Pattern</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index} className="border-b border-gray-800/70">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="h-12 animate-pulse rounded-lg bg-[#171c25]" />
                          </td>
                        </tr>
                      ))
                    : filteredRows.map((row) => {
                        const pattern = extractFailurePattern(row.description);
                        return (
                          <tr
                            key={`${row.woNumber}-${row.date}`}
                            className="border-b border-gray-800/70 transition-colors last:border-b-0 hover:bg-white/[0.015]"
                          >
                            <td className="px-4 py-4 align-top">
                              <p className="text-xs text-slate-400">
                                {formatDate(row.date)}
                              </p>
                              <button
                                type="button"
                                onClick={() => openWorkOrder(row.woNumber)}
                                className="mt-1 font-mono text-xs font-semibold text-blue-300 hover:text-blue-200"
                              >
                                {row.woNumber}
                              </button>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <Badge
                                className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${typeClass(
                                  row.type,
                                )}`}
                              >
                                {row.type}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <Badge
                                className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${priorityClass(
                                  row.priority,
                                )}`}
                              >
                                {row.priority}
                              </Badge>
                            </td>
                            <td className="max-w-[420px] px-4 py-4 align-top">
                              <p className="text-xs leading-5 text-slate-300">
                                {row.description}
                              </p>
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 align-top text-xs font-semibold text-orange-300">
                              {row.downtime}
                            </td>
                            <td className="px-4 py-4 align-top">
                              <Badge
                                className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${outcomeClass(
                                  row.outcome,
                                )}`}
                              >
                                {row.outcome}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 align-top">
                              {pattern ? (
                                <span className="inline-flex rounded border border-violet-500/20 bg-violet-500/[0.07] px-2 py-1 font-mono text-[10px] text-violet-300">
                                  {pattern}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-600">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void copyValue(row.woNumber, row.woNumber)}
                                  aria-label={`Copy ${row.woNumber}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                                >
                                  {copied === row.woNumber ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openWorkOrder(row.woNumber)}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-700 px-3 text-xs font-semibold text-blue-400 transition-colors hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-blue-300"
                                >
                                  Open WO
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            {!loading && filteredRows.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <FileSearch className="mx-auto h-7 w-7 text-slate-600" />
                <p className="mt-3 text-sm font-medium text-slate-300">
                  No history records match this view
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Change the date range, filter or search term.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 px-4 py-3 text-xs text-slate-500">
              <span>
                Showing {filteredRows.length} of {rangedRows.length} records in the selected period
              </span>
              <span>
                Vorta remains read-only; maintenance execution and record changes continue in SAP.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-blue-400" />
                  <h2 className="text-sm font-semibold text-slate-100">
                    Reliability Investigation
                  </h2>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Continue from historical evidence into the records that explain current equipment risk.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/equipment/${equipment.id}/work-orders`)}
                  className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800 hover:text-slate-100"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  View work execution
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/equipment/${equipment.id}/documents`)}
                  className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800 hover:text-slate-100"
                >
                  <FileSearch className="h-3.5 w-3.5" />
                  Search documents
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/equipment/${equipment.id}/spares`)}
                  className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800 hover:text-slate-100"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Review critical spares
                </Button>
                <Button
                  type="button"
                  onClick={() => askVorta()}
                  className="h-9 gap-2 bg-violet-600 px-3 text-xs text-white hover:bg-violet-500"
                >
                  <BrainCircuit className="h-3.5 w-3.5" />
                  Analyse history
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
