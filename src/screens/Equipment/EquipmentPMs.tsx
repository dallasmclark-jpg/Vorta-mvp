import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  Download,
  FileCheck2,
  Gauge,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCircle,
  Wrench,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { supabase } from "../../lib/supabaseClient";
import {
  DEFAULT_EQUIPMENT_ID,
  type EquipmentBase,
} from "./equipmentData";
import {
  getCachedEquipmentIdentity,
  getEquipmentIdentityById,
  getEquipmentRecommendedWorkQueue,
  type EquipmentRecommendedWorkAction,
  type EquipmentRecommendedWorkQueue,
} from "./equipmentService";
import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";

type CalibrationFilter = "ALL" | "ATTENTION" | "CONTROLLED";

interface EquipmentCalibration {
  calibrationId: string;
  calibrationNumber: string;
  title: string;
  calibrationPoint: string | null;
  toleranceSpecification: string | null;
  lastCompletedDate: string | null;
  nextDueDate: string | null;
  scheduleStatus: string;
  criticality: string | null;
  assignedEngineer: string | null;
  procedureReference: string | null;
  checklistReference: string | null;
  lastResult: string | null;
  resultAt: string | null;
  certificateReference: string | null;
  linkedWorkOrderNumber: string | null;
  linkedWorkOrderStatus: string | null;
  linkedWorkOrderDueDate: string | null;
  riskState: string;
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

function mapCalibration(row: Record<string, unknown>): EquipmentCalibration {
  return {
    calibrationId: String(row.calibration_id ?? ""),
    calibrationNumber: String(row.calibration_number ?? ""),
    title: String(row.title ?? "Calibration control"),
    calibrationPoint:
      typeof row.calibration_point === "string" ? row.calibration_point : null,
    toleranceSpecification:
      typeof row.tolerance_specification === "string"
        ? row.tolerance_specification
        : null,
    lastCompletedDate:
      typeof row.last_completed_date === "string" ? row.last_completed_date : null,
    nextDueDate:
      typeof row.next_due_date === "string" ? row.next_due_date : null,
    scheduleStatus: String(row.schedule_status ?? "UNKNOWN"),
    criticality: typeof row.criticality === "string" ? row.criticality : null,
    assignedEngineer:
      typeof row.assigned_engineer === "string" ? row.assigned_engineer : null,
    procedureReference:
      typeof row.procedure_reference === "string" ? row.procedure_reference : null,
    checklistReference:
      typeof row.checklist_reference === "string" ? row.checklist_reference : null,
    lastResult: typeof row.last_result === "string" ? row.last_result : null,
    resultAt: typeof row.result_at === "string" ? row.result_at : null,
    certificateReference:
      typeof row.certificate_reference === "string"
        ? row.certificate_reference
        : null,
    linkedWorkOrderNumber:
      typeof row.linked_work_order_number === "string"
        ? row.linked_work_order_number
        : null,
    linkedWorkOrderStatus:
      typeof row.linked_work_order_status === "string"
        ? row.linked_work_order_status
        : null,
    linkedWorkOrderDueDate:
      typeof row.linked_work_order_due_date === "string"
        ? row.linked_work_order_due_date
        : null,
    riskState: String(row.risk_state ?? "CONTROLLED"),
  };
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null): string {
  const date = parseDate(value);
  if (!date) return value || "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: Date | null): string {
  if (!value) return "Loading latest calibration import";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function daysUntil(value: string | null): number | null {
  const date = parseDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function needsAttention(calibration: EquipmentCalibration): boolean {
  const risk = calibration.riskState.toUpperCase();
  const schedule = calibration.scheduleStatus.toUpperCase();
  const result = calibration.lastResult?.toUpperCase() ?? "";

  return (
    risk !== "CONTROLLED" ||
    schedule === "OVERDUE" ||
    schedule === "DUE SOON" ||
    result.includes("FAIL") ||
    result.includes("REJECT")
  );
}

function scheduleStatusClass(status: string): string {
  switch (status.toUpperCase()) {
    case "OVERDUE":
      return "border-red-500/25 bg-red-500/10 text-red-300";
    case "DUE SOON":
      return "border-orange-500/25 bg-orange-500/10 text-orange-300";
    case "ON TRACK":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-slate-600 bg-slate-800/70 text-slate-300";
  }
}

function resultClass(result: string | null): string {
  const value = result?.toUpperCase() ?? "";
  if (value.includes("FAIL") || value.includes("REJECT")) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (value.includes("ADJUSTMENT")) {
    return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  }
  if (value.includes("PASS")) {
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

function exposureScore(calibration: EquipmentCalibration): number {
  const schedule = calibration.scheduleStatus.toUpperCase();
  const risk = calibration.riskState.toUpperCase();
  const criticality = calibration.criticality?.toUpperCase() ?? "";
  const result = calibration.lastResult?.toUpperCase() ?? "";

  return (
    (schedule === "OVERDUE" ? 70 : schedule === "DUE SOON" ? 40 : 0) +
    (risk === "RESULT RISK" ? 55 : risk !== "CONTROLLED" ? 25 : 0) +
    (criticality === "CRITICAL" ? 25 : criticality === "HIGH" ? 15 : 0) +
    (result.includes("FAIL") || result.includes("REJECT") ? 45 : 0) +
    (result.includes("ADJUSTMENT") ? 10 : 0) +
    (calibration.certificateReference ? 0 : 8) +
    (calibration.linkedWorkOrderNumber ? 0 : 6)
  );
}

function calibrationAction(
  queue: EquipmentRecommendedWorkQueue | null,
): EquipmentRecommendedWorkAction | null {
  return (
    queue?.actions.find((action) => {
      const haystack = [
        action.driver,
        action.action,
        action.actionType,
        action.pmTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes("calibrat");
    }) ?? null
  );
}

export const EquipmentPMs = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;

  const [equipment, setEquipment] = useState<EquipmentBase | null>(() =>
    getCachedEquipmentIdentity(resolvedId),
  );
  const [calibrations, setCalibrations] = useState<EquipmentCalibration[]>([]);
  const [riskQueue, setRiskQueue] =
    useState<EquipmentRecommendedWorkQueue | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CalibrationFilter>("ALL");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadCalibrationIntelligence = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const [identityResult, calibrationResult, queueResult] = await Promise.all([
      getEquipmentIdentityById(resolvedId),
      supabase.rpc("vorta_get_equipment_calibrations", {
        p_equipment_id: resolvedId,
      }),
      getEquipmentRecommendedWorkQueue(resolvedId),
    ]);

    setEquipment(identityResult);
    setRiskQueue(queueResult);

    if (calibrationResult.error) {
      console.warn("Equipment calibrations failed:", calibrationResult.error);
      setCalibrations([]);
      setErrorMessage(
        calibrationResult.error.message || "Calibrations could not be loaded.",
      );
    } else {
      const rows = Array.isArray(calibrationResult.data)
        ? calibrationResult.data
        : [];
      setCalibrations(
        rows
          .filter(
            (row): row is Record<string, unknown> =>
              typeof row === "object" && row !== null,
          )
          .map(mapCalibration)
          .sort((left, right) => exposureScore(right) - exposureScore(left)),
      );
      setLastUpdated(new Date());
    }

    setLoading(false);
  }, [resolvedId]);

  useEffect(() => {
    void loadCalibrationIntelligence();
  }, [loadCalibrationIntelligence]);

  const attention = useMemo(
    () => calibrations.filter(needsAttention),
    [calibrations],
  );
  const controlled = useMemo(
    () => calibrations.filter((calibration) => !needsAttention(calibration)),
    [calibrations],
  );
  const overdue = useMemo(
    () =>
      calibrations.filter(
        (calibration) => calibration.scheduleStatus.toUpperCase() === "OVERDUE",
      ),
    [calibrations],
  );
  const dueSoon = useMemo(
    () =>
      calibrations.filter(
        (calibration) => calibration.scheduleStatus.toUpperCase() === "DUE SOON",
      ),
    [calibrations],
  );
  const openCalibrationWork = useMemo(
    () =>
      calibrations.filter(
        (calibration) =>
          calibration.linkedWorkOrderNumber &&
          !["COMPLETED", "CLOSED", "TECO", "CLSD"].includes(
            calibration.linkedWorkOrderStatus?.toUpperCase() ?? "",
          ),
      ),
    [calibrations],
  );
  const upcoming30Days = useMemo(
    () =>
      calibrations
        .filter((calibration) => {
          const days = daysUntil(calibration.nextDueDate);
          return days !== null && days >= 0 && days <= 30;
        })
        .sort(
          (left, right) =>
            (daysUntil(left.nextDueDate) ?? 9999) -
            (daysUntil(right.nextDueDate) ?? 9999),
        ),
    [calibrations],
  );

  const certificates = calibrations.filter(
    (calibration) => calibration.certificateReference,
  ).length;
  const procedures = calibrations.filter(
    (calibration) => calibration.procedureReference,
  ).length;
  const checklists = calibrations.filter(
    (calibration) => calibration.checklistReference,
  ).length;
  const adjustments = calibrations.filter((calibration) =>
    calibration.lastResult?.toUpperCase().includes("ADJUSTMENT"),
  ).length;
  const failedResults = calibrations.filter((calibration) => {
    const result = calibration.lastResult?.toUpperCase() ?? "";
    return result.includes("FAIL") || result.includes("REJECT");
  }).length;

  const controlCoverage = calibrations.length
    ? Math.round((controlled.length / calibrations.length) * 100)
    : 100;
  const evidenceCompleteness = calibrations.length
    ? Math.round(
        (calibrations.reduce(
          (total, calibration) =>
            total +
            Number(Boolean(calibration.calibrationPoint)) +
            Number(Boolean(calibration.toleranceSpecification)) +
            Number(Boolean(calibration.procedureReference)) +
            Number(Boolean(calibration.checklistReference)) +
            Number(Boolean(calibration.certificateReference)),
          0,
        ) /
          (calibrations.length * 5)) *
          100,
      )
    : 100;

  const highestExposure = attention[0] ?? null;
  const matchedRiskAction = calibrationAction(riskQueue);
  const availableRiskReduction = matchedRiskAction?.calculatedReduction ?? 0;
  const projectedRisk =
    matchedRiskAction?.projectedScore ?? equipment?.riskScore ?? 0;

  const briefing = highestExposure
    ? `${equipment?.name ?? "This equipment"} has ${attention.length} calibration control${
        attention.length === 1 ? "" : "s"
      } requiring attention. ${highestExposure.calibrationNumber} is the highest current compliance exposure because it is ${highestExposure.scheduleStatus.toLowerCase()}, is ${
        highestExposure.criticality?.toLowerCase() ?? "standard"
      } criticality and ${
        highestExposure.linkedWorkOrderNumber
          ? `is linked to ${highestExposure.linkedWorkOrderNumber}`
          : "has no linked executable work order"
      }.`
    : `${equipment?.name ?? "This equipment"} has no active calibration compliance exposure. All imported calibration points are controlled against their schedules, tolerances and available evidence.`;

  const filteredCalibrations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return calibrations.filter((calibration) => {
      const attentionState = needsAttention(calibration);
      const matchesFilter =
        filter === "ALL" ||
        (filter === "ATTENTION" && attentionState) ||
        (filter === "CONTROLLED" && !attentionState);
      if (!matchesFilter) return false;
      if (!query) return true;

      return [
        calibration.calibrationNumber,
        calibration.title,
        calibration.calibrationPoint,
        calibration.toleranceSpecification,
        calibration.assignedEngineer,
        calibration.linkedWorkOrderNumber,
        calibration.certificateReference,
        calibration.procedureReference,
        calibration.checklistReference,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [calibrations, filter, search]);

  const copyValue = useCallback(async (value: string, key: string) => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => {
        setCopied((current) => (current === key ? null : current));
      }, 1600);
    } catch (error) {
      console.warn("Calibration reference copy failed:", error);
    }
  }, []);

  const askVorta = useCallback(
    (prompt?: string) => {
      if (!equipment) return;
      const resolvedPrompt =
        prompt ||
        question.trim() ||
        `Explain the calibration compliance risk for ${equipment.name}. Rank the highest-value next actions and cite the relevant work orders, procedures, checklists and certificates.`;
      navigate(
        `/equipment/${equipment.id}/ai-insights?prompt=${encodeURIComponent(
          resolvedPrompt,
        )}`,
      );
    },
    [equipment, navigate, question],
  );

  const openCalibrationSource = useCallback(
    (calibration: EquipmentCalibration) => {
      if (!equipment) return;
      if (calibration.linkedWorkOrderNumber) {
        navigate(
          `/equipment/${equipment.id}/work-orders?workOrder=${encodeURIComponent(
            calibration.linkedWorkOrderNumber,
          )}#work-order-register`,
        );
        return;
      }
      askVorta(
        `Analyse ${calibration.calibrationNumber}: ${calibration.title}. Explain why no executable work order is linked and what should be reviewed in SAP.`,
      );
    },
    [askVorta, equipment, navigate],
  );

  const exportCalibrations = useCallback(() => {
    if (!equipment) return;
    const rows = [
      [
        "Calibration",
        "Title",
        "Point",
        "Tolerance",
        "Criticality",
        "Schedule Status",
        "Risk State",
        "Last Completed",
        "Next Due",
        "Last Result",
        "Assigned Engineer",
        "Work Order",
        "Work Order Status",
        "Procedure",
        "Checklist",
        "Certificate",
      ],
      ...calibrations.map((calibration) => [
        calibration.calibrationNumber,
        calibration.title,
        calibration.calibrationPoint ?? "",
        calibration.toleranceSpecification ?? "",
        calibration.criticality ?? "",
        calibration.scheduleStatus,
        calibration.riskState,
        calibration.lastCompletedDate ?? "",
        calibration.nextDueDate ?? "",
        calibration.lastResult ?? "",
        calibration.assignedEngineer ?? "",
        calibration.linkedWorkOrderNumber ?? "",
        calibration.linkedWorkOrderStatus ?? "",
        calibration.procedureReference ?? "",
        calibration.checklistReference ?? "",
        calibration.certificateReference ?? "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${equipment.assetNumber}-calibration-intelligence.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [calibrations, equipment]);

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
    equipment.riskBreakdown.reduce((sum, driver) => sum + driver.pct, 0) || 1;
  const riskBadgeClass = riskTone(equipment.riskLevel);

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
      {errorMessage ? (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-xs text-red-200 md:mx-6">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <p className="font-semibold">Calibration intelligence could not load</p>
            <p className="mt-1 text-red-200/70">{errorMessage}</p>
          </div>
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
              onClick={() => void loadCalibrationIntelligence()}
              disabled={loading}
              aria-label="Refresh calibration intelligence"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
                <span className="text-slate-300">{equipment.manufacturer}</span>
              </span>
              <span>
                Model: <span className="text-slate-300">{equipment.model}</span>
              </span>
              <span>
                Criticality: {" "}
                <span className="text-slate-300">{equipment.criticality}</span>
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

        <EquipmentTabNavigation equipmentId={equipment.id} activeTab="pms" />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">
        <Card className="overflow-hidden rounded-2xl border border-cyan-500/25 bg-[linear-gradient(135deg,#121a22_0%,#10151d_55%,#0f1920_100%)] shadow-none">
          <CardContent className="p-0">
            <div className="grid xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.55fr)]">
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="h-auto rounded bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300 shadow-none">
                    Calibration control intelligence
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Database className="h-3.5 w-3.5" />
                    Schedules · tolerances · results · certificates · {formatDateTime(lastUpdated)}
                  </span>
                </div>

                <h2 className="mt-4 text-xl font-semibold text-slate-50">
                  Calibration Compliance Briefing
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                  {briefing}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    label="Calibration points"
                    value={calibrations.length}
                    detail={`${certificates} certificates available`}
                  />
                  <Metric
                    label="Require attention"
                    value={attention.length}
                    detail={`${overdue.length} overdue · ${dueSoon.length} due soon`}
                    tone={attention.length ? "text-orange-300" : "text-emerald-300"}
                  />
                  <Metric
                    label="Control coverage"
                    value={`${controlCoverage}%`}
                    detail={`${controlled.length} controls currently managed`}
                    tone={controlCoverage >= 90 ? "text-emerald-300" : "text-yellow-300"}
                  />
                  <Metric
                    label="Evidence completeness"
                    value={`${evidenceCompleteness}%`}
                    detail="Points, tolerances, procedures, checklists and certificates"
                    tone={evidenceCompleteness >= 90 ? "text-emerald-300" : "text-yellow-300"}
                  />
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-gray-700 bg-[#0a0f16] px-3 focus-within:border-cyan-500/60">
                    <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
                    <input
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") askVorta();
                      }}
                      placeholder={`Ask Vorta about ${equipment.assetNumber} calibration risk...`}
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => askVorta()}
                    className="min-h-11 gap-2 bg-cyan-600 px-5 text-white hover:bg-cyan-500"
                  >
                    <BrainCircuit className="h-4 w-4" />
                    Ask Vorta
                  </Button>
                </div>
              </div>

              <div className="border-t border-gray-800 bg-[#0b1017]/70 p-5 xl:border-l xl:border-t-0 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Highest compliance exposure
                </p>

                {highestExposure ? (
                  <div className="mt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${scheduleStatusClass(
                          highestExposure.scheduleStatus,
                        )}`}
                      >
                        {highestExposure.scheduleStatus}
                      </Badge>
                      <Badge
                        className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${riskTone(
                          highestExposure.criticality ?? "low",
                        )}`}
                      >
                        {highestExposure.criticality ?? "Standard"}
                      </Badge>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void copyValue(
                          highestExposure.calibrationNumber,
                          highestExposure.calibrationNumber,
                        )
                      }
                      className="mt-3 inline-flex items-center gap-2 font-mono text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                      {copied === highestExposure.calibrationNumber ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {highestExposure.calibrationNumber}
                    </button>
                    <p className="mt-2 text-sm font-semibold leading-5 text-slate-100">
                      {highestExposure.title}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {highestExposure.calibrationPoint ?? "Calibration point not recorded"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {highestExposure.toleranceSpecification ?? "Tolerance not recorded"}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Metric
                        label="Next due"
                        value={formatDate(highestExposure.nextDueDate)}
                        detail={
                          daysUntil(highestExposure.nextDueDate) === null
                            ? "Schedule date unavailable"
                            : `${Math.abs(daysUntil(highestExposure.nextDueDate) ?? 0)} day${
                                Math.abs(daysUntil(highestExposure.nextDueDate) ?? 0) === 1
                                  ? ""
                                  : "s"
                              } ${
                                (daysUntil(highestExposure.nextDueDate) ?? 0) < 0
                                  ? "overdue"
                                  : "remaining"
                              }`
                        }
                        tone="text-orange-300"
                      />
                      <Metric
                        label="Executable work"
                        value={highestExposure.linkedWorkOrderNumber ?? "Not linked"}
                        detail={highestExposure.linkedWorkOrderStatus ?? "Review in SAP"}
                        tone={
                          highestExposure.linkedWorkOrderNumber
                            ? "text-blue-300"
                            : "text-red-300"
                        }
                      />
                    </div>

                    <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300/80">
                        Source-of-truth action
                      </p>
                      <p className="mt-1 text-xs leading-5 text-cyan-100/70">
                        Complete scheduling, assignment, result entry and certificate release in the source maintenance or calibration system. Vorta remains read-only and reconciles the imported outcome.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        askVorta(
                          `Analyse ${highestExposure.calibrationNumber}: ${highestExposure.title}. Explain the compliance consequence, tolerance, linked work, evidence gaps and recommended next investigation.`,
                        )
                      }
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                    >
                      Analyse this calibration
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <p className="mt-3 text-sm font-semibold text-emerald-200">
                      Calibration controls are current
                    </p>
                    <p className="mt-1 text-xs leading-5 text-emerald-100/60">
                      No imported calibration point currently requires intervention.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-orange-500/20 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-400/80">
                  Compliance intervention queue
                </p>
                <h2 className="mt-1 text-base font-semibold text-slate-100">
                  Calibration controls requiring attention
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Ranked by schedule exposure, result state, criticality, certificate evidence and executable-work linkage.
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold text-emerald-300">
                  {availableRiskReduction > 0
                    ? `${availableRiskReduction} risk points available`
                    : `${attention.length} active control${attention.length === 1 ? "" : "s"}`}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {matchedRiskAction
                    ? `${equipment.riskScore}% to ${projectedRisk}% projected equipment risk`
                    : "Risk impact follows the live equipment model"}
                </p>
              </div>
            </div>

            {attention.length > 0 ? (
              <div className="mt-5 grid gap-3 xl:grid-cols-3">
                {attention.slice(0, 3).map((calibration, index) => {
                  const days = daysUntil(calibration.nextDueDate);
                  return (
                    <article
                      key={calibration.calibrationId}
                      className="flex min-h-[255px] flex-col rounded-xl border border-gray-800 bg-[#0d1219] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-xs font-bold text-orange-300">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-mono text-[10px] font-semibold text-cyan-300">
                              {calibration.calibrationNumber}
                            </p>
                            <h3 className="mt-1 text-sm font-semibold leading-5 text-slate-100">
                              {calibration.title}
                            </h3>
                          </div>
                        </div>
                        <p className="shrink-0 text-lg font-bold text-orange-300">
                          {exposureScore(calibration)}
                          <span className="ml-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                            priority
                          </span>
                        </p>
                      </div>

                      <p className="mt-3 text-xs leading-5 text-slate-400">
                        {calibration.calibrationPoint ?? "Calibration point not recorded"}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500">
                        {calibration.toleranceSpecification ?? "Tolerance not recorded"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge
                          className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${scheduleStatusClass(
                            calibration.scheduleStatus,
                          )}`}
                        >
                          {calibration.scheduleStatus}
                        </Badge>
                        <Badge
                          className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${riskTone(
                            calibration.criticality ?? "low",
                          )}`}
                        >
                          {calibration.criticality ?? "Standard"}
                        </Badge>
                        {calibration.lastResult ? (
                          <Badge
                            className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${resultClass(
                              calibration.lastResult,
                            )}`}
                          >
                            {calibration.lastResult}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                            Schedule
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-300">
                            {formatDate(calibration.nextDueDate)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-600">
                            {days === null
                              ? "Date unavailable"
                              : days < 0
                                ? `${Math.abs(days)}d overdue`
                                : `${days}d remaining`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openCalibrationSource(calibration)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-cyan-400 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/5 hover:text-cyan-300"
                        >
                          {calibration.linkedWorkOrderNumber
                            ? "Open work order"
                            : "Analyse work gap"}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-400" />
                <p className="mt-3 text-sm font-semibold text-emerald-200">
                  No immediate calibration intervention required
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Current imported schedules, results and evidence are controlled.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-4">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-slate-100">
                  Schedule control
                </h2>
              </div>
              <div className="mt-4 space-y-3">
                <Metric
                  label="Overdue"
                  value={overdue.length}
                  detail={`${dueSoon.length} due soon`}
                  tone={overdue.length ? "text-red-300" : "text-emerald-300"}
                />
                <Metric
                  label="Next 30 days"
                  value={upcoming30Days.length}
                  detail={
                    upcoming30Days[0]
                      ? `${upcoming30Days[0].calibrationNumber} next`
                      : "No upcoming controls"
                  }
                  tone="text-cyan-300"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-slate-100">
                  Evidence and traceability
                </h2>
              </div>
              <div className="mt-4 space-y-3">
                <Metric
                  label="Certificates"
                  value={`${certificates}/${calibrations.length}`}
                  detail={`${calibrations.length - certificates} missing certificate references`}
                  tone={certificates === calibrations.length ? "text-emerald-300" : "text-yellow-300"}
                />
                <p className="text-xs leading-5 text-slate-500">
                  {procedures} procedure references · {checklists} controlled checklists
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-slate-100">
                  Result intelligence
                </h2>
              </div>
              <div className="mt-4 space-y-3">
                <Metric
                  label="Result risk"
                  value={failedResults}
                  detail={`${adjustments} passed after adjustment`}
                  tone={failedResults ? "text-red-300" : "text-emerald-300"}
                />
                <p className="text-xs leading-5 text-slate-500">
                  Adjustment outcomes remain visible because a pass can still reveal drift, wear or setup instability.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-100">
                  Work-order linkage
                </h2>
              </div>
              <div className="mt-4 space-y-3">
                <Metric
                  label="Open calibration work"
                  value={openCalibrationWork.length}
                  detail={`${calibrations.filter((item) => item.linkedWorkOrderNumber).length}/${calibrations.length} controls linked to work`}
                  tone={openCalibrationWork.length ? "text-blue-300" : "text-emerald-300"}
                />
                <button
                  type="button"
                  onClick={() => navigate(`/equipment/${equipment.id}/work-orders`)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
                >
                  Open work execution intelligence
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card
          id="calibration-register"
          className="scroll-mt-48 rounded-2xl border border-gray-800 bg-[#141820] shadow-none"
        >
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-gray-800 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-slate-100">
                    Calibration control register
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Read-only schedule, tolerance, result, certificate and linked-work evidence from the source systems.
                </p>
              </div>

              <div className="flex flex-col gap-2 xl:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={exportCalibrations}
                  className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search calibration, point, WO or certificate"
                    className="h-9 w-full rounded-lg border border-gray-700 bg-[#0b0e14] pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-500 sm:w-80"
                  />
                </div>

                <div className="flex rounded-lg border border-gray-700 bg-[#0b0e14] p-1">
                  {[
                    ["All", "ALL"],
                    ["Attention", "ATTENTION"],
                    ["Controlled", "CONTROLLED"],
                  ].map(([label, value]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value as CalibrationFilter)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        filter === value
                          ? "bg-cyan-600 text-white"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1220px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-800 text-[10px] uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3 font-semibold">Calibration</th>
                    <th className="px-4 py-3 font-semibold">Point and tolerance</th>
                    <th className="px-4 py-3 font-semibold">Schedule</th>
                    <th className="px-4 py-3 font-semibold">Last result</th>
                    <th className="px-4 py-3 font-semibold">Assigned</th>
                    <th className="px-4 py-3 font-semibold">Work order</th>
                    <th className="px-4 py-3 font-semibold">Evidence</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <tr key={index} className="border-b border-gray-800/70">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="h-14 animate-pulse rounded-lg bg-[#171c25]" />
                          </td>
                        </tr>
                      ))
                    : filteredCalibrations.map((calibration) => (
                        <tr
                          key={calibration.calibrationId}
                          className="border-b border-gray-800/70 transition-colors last:border-b-0 hover:bg-white/[0.015]"
                        >
                          <td className="px-4 py-4 align-top">
                            <button
                              type="button"
                              onClick={() =>
                                void copyValue(
                                  calibration.calibrationNumber,
                                  calibration.calibrationNumber,
                                )
                              }
                              className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                            >
                              {copied === calibration.calibrationNumber ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              {calibration.calibrationNumber}
                            </button>
                            <p className="mt-1 max-w-[240px] text-xs leading-5 text-slate-300">
                              {calibration.title}
                            </p>
                            <Badge
                              className={`mt-2 h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${riskTone(
                                calibration.criticality ?? "low",
                              )}`}
                            >
                              {calibration.criticality ?? "Standard"}
                            </Badge>
                          </td>

                          <td className="max-w-[300px] px-4 py-4 align-top">
                            <p className="text-xs font-medium text-slate-200">
                              {calibration.calibrationPoint ?? "Point not recorded"}
                            </p>
                            <p className="mt-1 text-[11px] leading-4 text-slate-500">
                              {calibration.toleranceSpecification ?? "Tolerance not recorded"}
                            </p>
                          </td>

                          <td className="px-4 py-4 align-top">
                            <Badge
                              className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${scheduleStatusClass(
                                calibration.scheduleStatus,
                              )}`}
                            >
                              {calibration.scheduleStatus}
                            </Badge>
                            <p className="mt-2 text-[11px] text-slate-400">
                              Next {formatDate(calibration.nextDueDate)}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-600">
                              Last {formatDate(calibration.lastCompletedDate)}
                            </p>
                          </td>

                          <td className="px-4 py-4 align-top">
                            <Badge
                              className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${resultClass(
                                calibration.lastResult,
                              )}`}
                            >
                              {calibration.lastResult ?? "No result"}
                            </Badge>
                            <p className="mt-2 text-[11px] text-slate-600">
                              {formatDate(calibration.resultAt)}
                            </p>
                          </td>

                          <td className="px-4 py-4 align-top text-xs text-slate-300">
                            {calibration.assignedEngineer ?? "Not assigned"}
                          </td>

                          <td className="px-4 py-4 align-top">
                            {calibration.linkedWorkOrderNumber ? (
                              <button
                                type="button"
                                onClick={() => openCalibrationSource(calibration)}
                                className="font-mono text-xs font-semibold text-blue-300 hover:text-blue-200"
                              >
                                {calibration.linkedWorkOrderNumber}
                              </button>
                            ) : (
                              <span className="text-xs font-medium text-orange-300">
                                No executable work linked
                              </span>
                            )}
                            <p className="mt-1 text-[11px] text-slate-600">
                              {calibration.linkedWorkOrderStatus ?? "Review in SAP"}
                            </p>
                            {calibration.linkedWorkOrderDueDate ? (
                              <p className="mt-1 text-[11px] text-slate-600">
                                Due {formatDate(calibration.linkedWorkOrderDueDate)}
                              </p>
                            ) : null}
                          </td>

                          <td className="px-4 py-4 align-top text-[11px] leading-5 text-slate-500">
                            <p className={calibration.procedureReference ? "text-slate-300" : "text-orange-300"}>
                              Procedure {calibration.procedureReference ?? "missing"}
                            </p>
                            <p className={calibration.checklistReference ? "text-slate-300" : "text-orange-300"}>
                              Checklist {calibration.checklistReference ?? "missing"}
                            </p>
                            {calibration.certificateReference ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void copyValue(
                                    calibration.certificateReference ?? "",
                                    `certificate-${calibration.calibrationId}`,
                                  )
                                }
                                className="mt-1 inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200"
                              >
                                <FileCheck2 className="h-3.5 w-3.5" />
                                {calibration.certificateReference}
                              </button>
                            ) : (
                              <p className="mt-1 text-orange-300">Certificate missing</p>
                            )}
                          </td>

                          <td className="px-4 py-4 align-top">
                            <button
                              type="button"
                              onClick={() => openCalibrationSource(calibration)}
                              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-gray-700 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-400 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/5"
                            >
                              {calibration.linkedWorkOrderNumber ? "Open work" : "Analyse"}
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>

              {!loading && filteredCalibrations.length === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
                  <ShieldCheck className="h-7 w-7 text-slate-700" />
                  <p className="mt-3 text-sm font-medium text-slate-300">
                    {calibrations.length === 0
                      ? "No calibration controls for this equipment"
                      : "No matching calibration controls"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {calibrations.length === 0
                      ? "The calibration RPC returned no records."
                      : "Adjust the search or compliance filter."}
                  </p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-gray-800 bg-[#0d1219] px-4 py-3 text-[11px] leading-5 text-slate-500">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
            <p>
              Vorta does not amend calibration schedules, enter results or release certificates. It reconciles read-only source data and highlights where timing, evidence or executable work creates equipment and compliance exposure.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
