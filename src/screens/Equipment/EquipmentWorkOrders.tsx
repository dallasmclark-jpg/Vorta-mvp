import { useState, useEffect } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ChevronRight,
  Search,
  UserCircle,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";

import {
  EquipmentBase,
  DEFAULT_EQUIPMENT_ID,
} from "./equipmentData";
import {
  getEquipmentIdentityById,
  getCachedEquipmentIdentity,
  getEquipmentWorkOrders,
  getEquipmentRecommendedWorkQueue,
  type EquipmentRecommendedWorkAction,
  type EquipmentRecommendedWorkQueue,
} from "./equipmentService";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";

// ─── Work Orders types (local, mirrors equipmentTypes.ts shapes) ─────────────

type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type WoStatus = "OPEN" | "IN PROGRESS" | "ON HOLD" | "WAITING PARTS";

interface WorkOrder {
  id: string;
  priority: Priority;
  description: string;
  type: string;
  status: WoStatus;
  engineer: string;
  requestedDate: string;
  dueDate: string;
  age: string;
  overdue?: boolean;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

// ─── Style helpers ────────────────────────────────────────────────────────────

function priorityClass(p: Priority) {
  if (p === "CRITICAL") return "bg-[#ef444420] text-red-400";
  if (p === "HIGH")     return "bg-[#f9731620] text-orange-400";
  if (p === "MEDIUM")   return "bg-[#eab30820] text-yellow-400";
  return "bg-[#10b98120] text-emerald-400";
}

function statusClass(s: WoStatus) {
  if (s === "OPEN")          return "bg-[#3b82f620] text-blue-400";
  if (s === "IN PROGRESS")   return "bg-[#f9731620] text-orange-400";
  if (s === "ON HOLD")       return "bg-[#6b728020] text-slate-400";
  return "bg-[#8b5cf620] text-violet-400";
}



// ─── Main Component ───────────────────────────────────────────────────────────

export const EquipmentWorkOrders = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedWorkOrder = searchParams.get("workOrder")?.trim() ?? "";
  const [search, setSearch] = useState(selectedWorkOrder);

  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [eq, setEq] = useState<EquipmentBase | null>(() => getCachedEquipmentIdentity(resolvedId));
  const [openWOs, setOpenWOs] = useState<WorkOrder[]>([]);

  const [riskQueue, setRiskQueue] =
    useState<EquipmentRecommendedWorkQueue | null>(null);

  useEffect(() => {
    getEquipmentIdentityById(resolvedId).then(setEq);
  }, [resolvedId]);

  useEffect(() => {
    let active = true;

    setOpenWOs([]);

    getEquipmentWorkOrders(resolvedId).then(({ open }) => {
      if (active) {
        setOpenWOs(open as WorkOrder[]);
      }
    });

    return () => {
      active = false;
    };
  }, [resolvedId]);

  useEffect(() => {
    let active = true;
    setRiskQueue(null);
    getEquipmentRecommendedWorkQueue(resolvedId).then((queue) => {
      if (active) {
        setRiskQueue(queue);
      }
    });

    return () => {
      active = false;
    };
  }, [resolvedId]);

  useEffect(() => {
    if (!selectedWorkOrder) return;

    setSearch(selectedWorkOrder);

    if (openWOs.length === 0) return;

    requestAnimationFrame(() => {
      document
        .getElementById(`work-order-${selectedWorkOrder}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    });
  }, [openWOs.length, selectedWorkOrder]);

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
    eq.riskLevel === "Medium"   ? "bg-[#eab30820] text-yellow-400" :
    "bg-[#10b98120] text-emerald-400";

  const statusDotClass =
    eq.status === "Running" ? "bg-emerald-500" :
    eq.status === "At Risk" ? "bg-orange-400" :
    eq.status === "Fault"   ? "bg-red-500" :
    "bg-yellow-400";

  const riskTotal = eq.riskBreakdown.reduce((s, b) => s + b.pct, 0) || 1;

  const filteredWOs = openWOs.filter(
    (wo) =>
      wo.id.toLowerCase().includes(search.toLowerCase()) ||
      wo.description.toLowerCase().includes(search.toLowerCase()) ||
      wo.engineer.toLowerCase().includes(search.toLowerCase()),
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const priorityCounts = {
    CRITICAL: openWOs.filter(
      (wo) => wo.priority === "CRITICAL",
    ).length,
    HIGH: openWOs.filter(
      (wo) => wo.priority === "HIGH",
    ).length,
    MEDIUM: openWOs.filter(
      (wo) => wo.priority === "MEDIUM",
    ).length,
  };

  const overdueCount = openWOs.filter(
    (wo) => wo.overdue,
  ).length;

  const dueThisWeekCount = openWOs.filter((wo) => {
    if (!wo.dueDate) return false;

    const dueDate = new Date(`${wo.dueDate}T00:00:00`);

    return (
      !Number.isNaN(dueDate.getTime()) &&
      dueDate >= today &&
      dueDate <= sevenDaysFromNow
    );
  }).length;

  const riskActionStatusClass = (status: string | null) => {
    const normalised = status?.toUpperCase() ?? "";

    if (
      normalised.includes("OVERDUE") ||
      normalised.includes("OUT OF STOCK") ||
      normalised.includes("CRITICAL")
    ) {
      return "bg-red-500/10 text-red-400";
    }

    if (
      normalised.includes("WAITING") ||
      normalised.includes("HOLD")
    ) {
      return "bg-violet-500/10 text-violet-400";
    }

    return "bg-blue-500/10 text-blue-400";
  };

  const riskActionButtonLabel = (
    action: EquipmentRecommendedWorkAction,
  ) => {
    if (
      action.sparePartNumber ||
      action.actionType === "Critical Spare"
    ) {
      return "Open spare record";
    }

    if (action.workOrderNumber) {
      return "Locate work order";
    }

    if (
      action.pmNumber ||
      action.actionType === "Preventive Maintenance"
    ) {
      return "Review work orders";
    }

    return "Review action";
  };

  const scrollToWorkOrders = () => {
    requestAnimationFrame(() => {
      document
        .getElementById("open-work-orders")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  };

  const openRiskAction = (
    action: EquipmentRecommendedWorkAction,
  ) => {
    if (
      action.sparePartNumber ||
      action.actionType === "Critical Spare"
    ) {
      navigate(`/equipment/${eq.id}/spares`);
      return;
    }

    if (action.workOrderNumber) {
      setSearch(action.workOrderNumber);
      setSearchParams(
        { workOrder: action.workOrderNumber },
        { replace: true },
      );
      scrollToWorkOrders();
      return;
    }

    if (
      action.pmNumber ||
      action.actionType === "Preventive Maintenance"
    ) {
      setSearch("");
      setSearchParams({}, { replace: true });
      scrollToWorkOrders();
    }
  };

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">

      {/* ── Sticky Header ───────────────────────────────────────────────── */}
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
            <button type="button" onClick={() => navigate("/settings")} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
              <UserCircle className="h-7 w-7" />
            </button>
          </div>
        </div>

        {/* Equipment header row */}
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
              <span className={`h-2 w-2 rounded-full ${statusDotClass}`} aria-hidden="true" />
              <span className="text-sm font-semibold text-slate-200">{eq.status}</span>
              <span className="text-sm text-slate-500">{eq.statusNote}</span>
            </div>
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

          <div className="flex shrink-0 flex-col gap-2 lg:w-52">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Score</span>
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
        <EquipmentTabNavigation equipmentId={eq.id} activeTab="work-orders" />
      </div>

      {/* ── Page Content ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">

        {/* ── Row 1: 5 KPI cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">

          {/* Open Work Orders */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Open Work Orders</p>
              <p className="mb-2 text-3xl font-bold text-slate-50">{openWOs.length}</p>
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />Critical {priorityCounts.CRITICAL}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />High {priorityCounts.HIGH}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />Medium {priorityCounts.MEDIUM}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Overdue */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Overdue</p>
              <p className="mb-2 text-3xl font-bold text-red-400">{overdueCount}</p>
              <p className="text-[11px] text-slate-500">{openWOs.length > 0
  ? `${Math.round((overdueCount / openWOs.length) * 100)}% of open`
  : "No open work orders"}</p>
            </CardContent>
          </Card>

          {/* Due This Week */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Due This Week</p>
              <p className="mb-2 text-3xl font-bold text-yellow-400">{dueThisWeekCount}</p>
              <p className="text-[11px] text-slate-500">{openWOs.length > 0
  ? `${Math.round((dueThisWeekCount / openWOs.length) * 100)}% of open`
  : "No open work orders"}</p>
            </CardContent>
          </Card>

          {/* Completed */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Projected Equipment Risk
              </p>
              <p className="mb-2 text-3xl font-bold text-emerald-400">
                {riskQueue
                  ? `${riskQueue.projectedRiskScore}%`
                  : "—"}
              </p>
              <p className="text-[11px] text-slate-500">
                {riskQueue
                  ? `${riskQueue.projectedRiskLevel} after ${riskQueue.actions.length} ranked actions`
                  : "Calculating projected risk"}
              </p>
            </CardContent>
          </Card>

          {/* Average MTTR */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Available Risk Reduction
              </p>

              <p className="mb-2 text-3xl font-bold text-emerald-400">
                {riskQueue?.totalCalculatedReduction ?? 0}
                <span className="text-lg font-semibold text-slate-400">
                  {" "}pts
                </span>
              </p>

              <p className="text-[11px] text-slate-500">
                {riskQueue
                  ? `${riskQueue.actions.length} ranked actions · projected ${riskQueue.projectedRiskScore}% ${riskQueue.projectedRiskLevel}`
                  : "Calculated from recommended actions"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">
                  Top Risk-Reducing Work
                </h2>

                <p className="mt-1 text-[11px] text-slate-500">
                  Ranked by calculated equipment-risk reduction
                </p>
              </div>

              {riskQueue && (
                <div className="text-right">
                  <p className="text-xs font-semibold text-emerald-400">
                    {riskQueue.totalCalculatedReduction} points available
                  </p>

                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {riskQueue.currentRiskScore}% to{" "}
                    {riskQueue.projectedRiskScore}%
                  </p>
                </div>
              )}
            </div>

            {!riskQueue && (
              <div
                className="rounded-xl border border-gray-800 bg-[#0d1118] px-4 py-8 text-center"
                role="status"
              >
                <p className="text-sm font-medium text-slate-300">
                  Calculating risk-reduction work
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Loading the ranked actions for this equipment
                </p>
              </div>
            )}

            {riskQueue && riskQueue.actions.length === 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-8 text-center">
                <p className="text-sm font-medium text-emerald-300">
                  No immediate risk-reduction work identified
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Current calculated risk drivers do not require a ranked action
                </p>
              </div>
            )}

            {riskQueue && riskQueue.actions.length > 0 && (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                {riskQueue.actions.map((action) => {
                  const references = [
                    action.workOrderNumber
                      ? `WO ${action.workOrderNumber}`
                      : null,
                    action.pmNumber
                      ? `PM ${action.pmNumber}`
                      : null,
                    action.sparePartNumber
                      ? `Part ${action.sparePartNumber}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  const timing = action.durationMinutes > 0
                    ? `${action.durationMinutes} min`
                    : action.leadTimeDays > 0
                      ? `${action.leadTimeDays} day lead time`
                      : null;

                  return (
                    <article
                      key={`${action.priority}-${action.action}`}
                      className="flex min-h-[220px] flex-col rounded-xl border border-gray-800 bg-[#0d1118] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-400">
                            {action.priority}
                          </span>

                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              {action.driver}
                            </p>

                            <h3 className="mt-1 text-sm font-semibold leading-5 text-slate-100">
                              {action.action}
                            </h3>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-lg font-bold text-emerald-400">
                            -{action.calculatedReduction}
                          </p>

                          <p className="text-[9px] uppercase tracking-wide text-slate-600">
                            risk points
                          </p>
                        </div>
                      </div>

                      {references && (
                        <p className="mt-3 break-words font-mono text-[10px] text-blue-300">
                          {references}
                        </p>
                      )}

                      {action.detail && (
                        <p className="mt-2 text-xs leading-5 text-slate-400">
                          {action.detail}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {action.status && (
                          <span
                            className={`rounded px-2 py-1 text-[10px] font-semibold uppercase ${riskActionStatusClass(
                              action.status,
                            )}`}
                          >
                            {action.status}
                          </span>
                        )}

                        {action.actionType && (
                          <span className="rounded bg-gray-800 px-2 py-1 text-[10px] font-medium text-slate-400">
                            {action.actionType}
                          </span>
                        )}

                        {timing && (
                          <span className="rounded bg-gray-800 px-2 py-1 text-[10px] font-medium text-slate-400">
                            {timing}
                          </span>
                        )}
                      </div>

                      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                            Projected risk
                          </p>

                          <p className="mt-0.5 text-sm font-bold text-slate-200">
                            {action.projectedScore}%
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => openRiskAction(action)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-blue-400 transition-colors hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-blue-300"
                        >
                          {riskActionButtonLabel(action)}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div
          id="open-work-orders"
          className="flex scroll-mt-48 flex-wrap items-center justify-between gap-3"
        >
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Open Work Orders
            </h2>

            <p className="mt-0.5 text-[11px] text-slate-500">
              SAP PM work assigned to {eq.name}
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />

            <input
              type="search"
              placeholder="Search WO, description or engineer"
              value={search}
              onChange={(event) => {
                const nextSearch = event.target.value;
                setSearch(nextSearch);

                if (
                  selectedWorkOrder &&
                  nextSearch !== selectedWorkOrder
                ) {
                  setSearchParams({}, { replace: true });
                }
              }}
              className="w-full rounded-lg border border-gray-700 bg-[#141820] py-2 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-800">
                    {[
                      "WO Number",
                      "Priority",
                      "Description",
                      "Type",
                      "Status",
                      "Assigned Engineer",
                      "Requested Date",
                      "Due Date",
                      "Age",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:pl-1"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredWOs.map((wo, index) => (
                    <tr
                      id={`work-order-${wo.id}`}
                      key={wo.id}
                      aria-current={
                        wo.id === selectedWorkOrder
                          ? "true"
                          : undefined
                      }
                      className={`${
                        index !== filteredWOs.length - 1
                          ? "border-b border-gray-800"
                          : ""
                      } ${
                        wo.id === selectedWorkOrder
                          ? "bg-blue-500/[0.08] ring-1 ring-inset ring-blue-500/30"
                          : ""
                      }`}
                    >
                      <td className="py-3 pl-1 pr-3 font-mono text-[11px] font-semibold text-slate-200">
                        {wo.id}
                      </td>

                      <td className="py-3 pr-3">
                        <Badge
                          className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${priorityClass(
                            wo.priority,
                          )}`}
                        >
                          {wo.priority}
                        </Badge>
                      </td>

                      <td className="max-w-[220px] py-3 pr-3">
                        <span
                          className="block truncate text-slate-200"
                          title={wo.description}
                        >
                          {wo.description}
                        </span>
                      </td>

                      <td className="py-3 pr-3 text-slate-400">
                        {wo.type}
                      </td>

                      <td className="py-3 pr-3">
                        <Badge
                          className={`h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${statusClass(
                            wo.status,
                          )}`}
                        >
                          {wo.status}
                        </Badge>
                      </td>

                      <td className="whitespace-nowrap py-3 pr-3 text-slate-300">
                        {wo.engineer}
                      </td>

                      <td className="whitespace-nowrap py-3 pr-3 text-slate-400">
                        {wo.requestedDate}
                      </td>

                      <td
                        className={`whitespace-nowrap py-3 pr-3 font-medium ${
                          wo.overdue
                            ? "text-orange-400"
                            : "text-slate-400"
                        }`}
                      >
                        {wo.dueDate}
                      </td>

                      <td className="py-3 pr-3 text-slate-400">
                        {wo.age}
                      </td>
                    </tr>
                  ))}

                  {filteredWOs.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-12 text-center"
                      >
                        <p className="text-sm font-medium text-slate-300">
                          {search
                            ? "No work orders match this search"
                            : "No open work orders for this equipment"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {search
                            ? "Clear or change the search term"
                            : "No unrelated demo work orders have been substituted"}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
