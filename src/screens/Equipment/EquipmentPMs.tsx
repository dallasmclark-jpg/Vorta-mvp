import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  RefreshCw,
  Search,
  ShieldCheck,
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
} from "./equipmentService";

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

const TABS = [
  { label: "Overview", id: "overview" },
  { label: "Notifications", id: "notifications" },
  { label: "Work Orders", id: "work-orders" },
  { label: "Calibrations", id: "pms" },
  { label: "History", id: "history" },
  { label: "Skills & Engineers", id: "skills" },
  { label: "Spares", id: "spares" },
  { label: "Documents", id: "documents" },
  { label: "AI Insights", id: "ai-insights" },
] as const;

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function mapCalibration(row: any): EquipmentCalibration {
  return {
    calibrationId: String(row.calibration_id ?? ""),
    calibrationNumber: String(row.calibration_number ?? ""),
    title: String(row.title ?? ""),
    calibrationPoint: row.calibration_point ?? null,
    toleranceSpecification: row.tolerance_specification ?? null,
    lastCompletedDate: row.last_completed_date ?? null,
    nextDueDate: row.next_due_date ?? null,
    scheduleStatus: String(row.schedule_status ?? "UNKNOWN"),
    criticality: row.criticality ?? null,
    assignedEngineer: row.assigned_engineer ?? null,
    procedureReference: row.procedure_reference ?? null,
    checklistReference: row.checklist_reference ?? null,
    lastResult: row.last_result ?? null,
    resultAt: row.result_at ?? null,
    certificateReference: row.certificate_reference ?? null,
    linkedWorkOrderNumber: row.linked_work_order_number ?? null,
    linkedWorkOrderStatus: row.linked_work_order_status ?? null,
    linkedWorkOrderDueDate: row.linked_work_order_due_date ?? null,
    riskState: String(row.risk_state ?? "CONTROLLED"),
  };
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

function riskStateClass(state: string): string {
  const value = state.toUpperCase();

  if (value === "OVERDUE" || value === "RESULT RISK") {
    return "text-red-300";
  }

  if (value === "DUE SOON") return "text-orange-300";

  return "text-emerald-300";
}

function resultClass(result: string | null): string {
  const value = result?.toUpperCase() ?? "";

  if (value.includes("FAIL") || value.includes("REJECT")) {
    return "text-red-300";
  }

  if (value.includes("ADJUSTMENT")) return "text-orange-300";
  if (value.includes("PASS")) return "text-emerald-300";

  return "text-slate-500";
}

export const EquipmentPMs = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;

  const [equipment, setEquipment] = useState<EquipmentBase | null>(() =>
    getCachedEquipmentIdentity(resolvedId),
  );
  const [calibrations, setCalibrations] = useState<EquipmentCalibration[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CalibrationFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCalibrations = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc(
        "vorta_get_equipment_calibrations",
        { p_equipment_id: resolvedId },
      );

      if (error) throw error;

      setCalibrations(
        (Array.isArray(data) ? data : []).map(mapCalibration),
      );
    } catch (error) {
      console.warn("Equipment calibrations failed:", error);
      setCalibrations([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Calibrations could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => {
    void getEquipmentIdentityById(resolvedId).then(setEquipment);
  }, [resolvedId]);

  useEffect(() => {
    void loadCalibrations();
  }, [loadCalibrations]);

  const summary = useMemo(() => {
    const needsAttention = (calibration: EquipmentCalibration) =>
      calibration.riskState !== "CONTROLLED" ||
      calibration.scheduleStatus === "OVERDUE" ||
      calibration.scheduleStatus === "DUE SOON";

    return {
      total: calibrations.length,
      attention: calibrations.filter(needsAttention).length,
      controlled: calibrations.filter(
        (calibration) => !needsAttention(calibration),
      ).length,
      openWorkOrders: calibrations.filter(
        (calibration) =>
          calibration.linkedWorkOrderNumber &&
          calibration.linkedWorkOrderStatus?.toUpperCase() !== "COMPLETED",
      ).length,
      certificates: calibrations.filter(
        (calibration) => calibration.certificateReference,
      ).length,
    };
  }, [calibrations]);

  const filteredCalibrations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return calibrations.filter((calibration) => {
      const needsAttention =
        calibration.riskState !== "CONTROLLED" ||
        calibration.scheduleStatus === "OVERDUE" ||
        calibration.scheduleStatus === "DUE SOON";

      const matchesFilter =
        filter === "ALL" ||
        (filter === "ATTENTION" && needsAttention) ||
        (filter === "CONTROLLED" && !needsAttention);

      const matchesSearch =
        !query ||
        calibration.calibrationNumber.toLowerCase().includes(query) ||
        calibration.title.toLowerCase().includes(query) ||
        (calibration.calibrationPoint ?? "").toLowerCase().includes(query) ||
        (calibration.linkedWorkOrderNumber ?? "")
          .toLowerCase()
          .includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [calibrations, filter, search]);

  if (!equipment) {
    return (
      <section className="flex w-full flex-col overflow-x-hidden pb-10">
        <div className="border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
          <div className="h-28 animate-pulse rounded-xl bg-[#141820]" />
        </div>
      </section>
    );
  }

  const riskBadgeClass =
    equipment.riskLevel === "Critical"
      ? "bg-[#ef444420] text-red-400"
      : equipment.riskLevel === "High"
        ? "bg-[#f9731620] text-orange-400"
        : equipment.riskLevel === "Medium"
          ? "bg-[#eab30820] text-yellow-400"
          : "bg-[#10b98120] text-emerald-400";

  const statusDotClass =
    equipment.status === "Running"
      ? "bg-emerald-500"
      : equipment.status === "At Risk"
        ? "bg-orange-400"
        : equipment.status === "Fault"
          ? "bg-red-500"
          : "bg-yellow-400";

  const riskTotal =
    equipment.riskBreakdown.reduce((sum, driver) => sum + driver.pct, 0) || 1;

  const summaryCards = [
    {
      label: "Calibration points",
      value: summary.total,
      detail: `${summary.certificates} certificate${
        summary.certificates === 1 ? "" : "s"
      } recorded`,
      valueClass: "text-slate-100",
      icon: ShieldCheck,
    },
    {
      label: "Require attention",
      value: summary.attention,
      detail: "Overdue, due soon or result risk",
      valueClass:
        summary.attention > 0 ? "text-orange-300" : "text-emerald-300",
      icon: AlertCircle,
    },
    {
      label: "Controlled",
      value: summary.controlled,
      detail: "Current calibration controls",
      valueClass: "text-emerald-300",
      icon: CheckCircle2,
    },
    {
      label: "Open calibration work",
      value: summary.openWorkOrders,
      detail: "Linked executable work orders",
      valueClass:
        summary.openWorkOrders > 0 ? "text-blue-300" : "text-slate-100",
      icon: Wrench,
    },
  ];

  return (
    <section className="flex w-full flex-col overflow-x-hidden pb-10">
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-sm text-slate-500"
          >
            <button
              type="button"
              onClick={() => navigate("/equipment")}
              className="transition-colors hover:text-slate-300"
            >
              Equipment
            </button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-300">
              {equipment.name} ({equipment.assetNumber})
            </span>
          </nav>

          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200"
            aria-label="Open settings"
          >
            <UserCircle className="h-7 w-7" />
          </button>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">
            <img
              src={equipment.image}
              alt={equipment.name}
              className="h-full w-full object-cover"
              onError={(event) => {
                (event.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">
                {equipment.name}
              </h1>
              <Badge
                className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}
              >
                {equipment.riskLevel} Risk
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${statusDotClass}`}
                aria-hidden="true"
              />
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
              <span className="rounded bg-gray-800 px-1.5 py-0.5 font-medium tracking-wide text-slate-400">
                {equipment.type}
              </span>
              <span>📍 {equipment.area}</span>
              <span>
                Manufacturer:{" "}
                <span className="text-slate-300">
                  {equipment.manufacturer}
                </span>
              </span>
              <span>
                Model:{" "}
                <span className="text-slate-300">{equipment.model}</span>
              </span>
              <span>
                Serial Number:{" "}
                <span className="text-slate-300">
                  {equipment.serialNumber}
                </span>
              </span>
              <span>
                Install Date:{" "}
                <span className="text-slate-300">
                  {equipment.installDate}
                </span>
              </span>
              <span>
                Warranty:{" "}
                <span className="text-orange-400">
                  {equipment.warranty}
                </span>
              </span>
              <span>
                Criticality:{" "}
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
                className={`mb-1 inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}
              >
                {equipment.riskLevel}
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500">
                Risk Drivers
              </span>
              <div className="flex h-2 overflow-hidden rounded-full">
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

        <div className="mt-4 flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                navigate(`/equipment/${equipment.id}/${tab.id}`)
              }
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                tab.id === "pms"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5 px-4 pt-5 md:px-6">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card
                key={card.label}
                className="border-gray-800 bg-[#11151d]"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-slate-500">
                      {card.label}
                    </p>
                    <Icon className="h-4 w-4 text-slate-600" />
                  </div>
                  <p
                    className={`mt-2 text-2xl font-semibold ${card.valueClass}`}
                  >
                    {card.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {card.detail}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-gray-800 bg-[#11151d]">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-gray-800 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-slate-100">
                    Calibration compliance
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Compliance status, tolerance, results, certificates and
                  linked executable work.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadCalibrations()}
                  disabled={loading}
                  className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search calibration or WO"
                    className="h-9 w-full rounded-lg border border-gray-700 bg-[#0b0e14] pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500 sm:w-64"
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
                          ? "bg-blue-600 text-white"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div className="m-4 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-red-200">
                    Calibrations could not be loaded
                  </p>
                  <p className="mt-1 break-words text-xs text-red-200/70">
                    {errorMessage}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadCalibrations()}
                    className="mt-3 text-xs font-semibold text-red-300 hover:text-red-200"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-800 text-[11px] uppercase tracking-wide text-slate-600">
                      <th className="px-4 py-3 font-semibold">Calibration</th>
                      <th className="px-4 py-3 font-semibold">
                        Point and tolerance
                      </th>
                      <th className="px-4 py-3 font-semibold">Schedule</th>
                      <th className="px-4 py-3 font-semibold">Last result</th>
                      <th className="px-4 py-3 font-semibold">Work order</th>
                      <th className="px-4 py-3 font-semibold">References</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading
                      ? Array.from({ length: 3 }).map((_, index) => (
                          <tr
                            key={index}
                            className="border-b border-gray-800/70"
                          >
                            <td colSpan={6} className="px-4 py-4">
                              <div className="h-12 animate-pulse rounded-lg bg-[#171c25]" />
                            </td>
                          </tr>
                        ))
                      : filteredCalibrations.map((calibration) => (
                          <tr
                            key={calibration.calibrationId}
                            className="border-b border-gray-800/70 transition-colors last:border-b-0 hover:bg-white/[0.015]"
                          >
                            <td className="px-4 py-4 align-top">
                              <p className="text-xs font-semibold text-cyan-300">
                                {calibration.calibrationNumber}
                              </p>
                              <p className="mt-1 max-w-[230px] text-xs leading-5 text-slate-300">
                                {calibration.title}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-600">
                                {calibration.criticality ?? "Standard"}{" "}
                                criticality
                              </p>
                            </td>

                            <td className="max-w-[280px] px-4 py-4 align-top">
                              <p className="text-xs font-medium text-slate-200">
                                {calibration.calibrationPoint ??
                                  "Calibration point not specified"}
                              </p>
                              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                                {calibration.toleranceSpecification ??
                                  "Tolerance not recorded"}
                              </p>
                            </td>

                            <td className="px-4 py-4 align-top">
                              <span
                                className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${scheduleStatusClass(
                                  calibration.scheduleStatus,
                                )}`}
                              >
                                {calibration.scheduleStatus}
                              </span>
                              <p className="mt-2 text-[11px] text-slate-500">
                                Next: {formatDate(calibration.nextDueDate)}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-600">
                                Last:{" "}
                                {formatDate(calibration.lastCompletedDate)}
                              </p>
                              <p
                                className={`mt-2 text-[11px] font-semibold ${riskStateClass(
                                  calibration.riskState,
                                )}`}
                              >
                                {calibration.riskState}
                              </p>
                            </td>

                            <td className="px-4 py-4 align-top">
                              <p
                                className={`text-xs font-semibold ${resultClass(
                                  calibration.lastResult,
                                )}`}
                              >
                                {calibration.lastResult ??
                                  "No result recorded"}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-600">
                                {formatDate(calibration.resultAt)}
                              </p>
                              <p className="mt-2 text-[11px] text-slate-500">
                                {calibration.assignedEngineer ??
                                  "Engineer not assigned"}
                              </p>
                            </td>

                            <td className="px-4 py-4 align-top">
                              {calibration.linkedWorkOrderNumber ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/equipment/${equipment.id}/work-orders`,
                                    )
                                  }
                                  className="text-xs font-semibold text-blue-300 hover:text-blue-200"
                                >
                                  {calibration.linkedWorkOrderNumber}
                                </button>
                              ) : (
                                <span className="text-xs text-slate-600">
                                  No linked WO
                                </span>
                              )}
                              <p className="mt-1 text-[11px] text-slate-500">
                                {calibration.linkedWorkOrderStatus ??
                                  "Not called"}
                              </p>
                              {calibration.linkedWorkOrderDueDate ? (
                                <p className="mt-1 text-[11px] text-slate-600">
                                  Due{" "}
                                  {formatDate(
                                    calibration.linkedWorkOrderDueDate,
                                  )}
                                </p>
                              ) : null}
                            </td>

                            <td className="px-4 py-4 align-top">
                              {calibration.certificateReference ? (
                                <div className="flex items-center gap-1.5 text-xs text-emerald-300">
                                  <FileCheck2 className="h-3.5 w-3.5" />
                                  <span>
                                    {calibration.certificateReference}
                                  </span>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-600">
                                  No certificate
                                </p>
                              )}

                              {calibration.procedureReference ? (
                                <p className="mt-2 text-[11px] text-slate-500">
                                  Procedure:{" "}
                                  {calibration.procedureReference}
                                </p>
                              ) : null}

                              {calibration.checklistReference ? (
                                <p className="mt-1 text-[11px] text-slate-500">
                                  Checklist:{" "}
                                  {calibration.checklistReference}
                                </p>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>

                {!loading && filteredCalibrations.length === 0 ? (
                  <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
                    <ShieldCheck className="h-7 w-7 text-slate-700" />
                    <p className="mt-3 text-sm font-medium text-slate-300">
                      No matching calibrations
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Adjust the search or compliance filter.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
