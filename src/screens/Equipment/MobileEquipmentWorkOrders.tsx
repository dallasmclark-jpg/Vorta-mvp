import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  PackageSearch,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { openWorkOrderDetail } from "../../lib/maintenanceActions";
import { openMaintenanceAiAssistant } from "../../lib/maintenanceAiAssistant";
import { DEFAULT_EQUIPMENT_ID, type EquipmentBase } from "./equipmentData";
import {
  getCachedEquipmentIdentity,
  getEquipmentIdentityById,
  getEquipmentRecommendedWorkQueue,
  getEquipmentWorkOrders,
  type EquipmentRecommendedWorkAction,
  type EquipmentRecommendedWorkQueue,
} from "./equipmentService";
import type { CompletedWorkOrder, WorkOrder } from "./equipmentTypes";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";

type RegisterView = "OPEN" | "COMPLETED";
type MobileFilter = "ALL" | "OVERDUE" | "WAITING PARTS" | "UNASSIGNED";

function priorityTone(value: string): string {
  if (value === "CRITICAL") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (value === "HIGH") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (value === "MEDIUM") return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}

function statusTone(value: string): string {
  const status = value.toUpperCase();
  if (status.includes("WAITING")) return "border-violet-500/30 bg-violet-500/10 text-violet-300";
  if (status.includes("HOLD") || status.includes("PARTIAL")) return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  if (status.includes("PROGRESS")) return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (status.includes("SUCCESS") || status.includes("COMPLETED")) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  return "border-slate-600 bg-slate-800/70 text-slate-300";
}

function riskTone(value: string): string {
  const level = value.toLowerCase();
  if (level === "critical") return "text-red-300";
  if (level === "high") return "text-orange-300";
  if (level === "medium") return "text-amber-300";
  return "text-emerald-300";
}

function formatDate(value: string): string {
  if (!value) return "Not recorded";
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-50">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function actionReference(action: EquipmentRecommendedWorkAction): string {
  return action.workOrderNumber ?? action.pmNumber ?? action.sparePartNumber ?? "Risk action";
}

export function MobileEquipmentWorkOrders(): JSX.Element {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [equipment, setEquipment] = useState<EquipmentBase | null>(() => getCachedEquipmentIdentity(resolvedId));
  const [openOrders, setOpenOrders] = useState<WorkOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<CompletedWorkOrder[]>([]);
  const [riskQueue, setRiskQueue] = useState<EquipmentRecommendedWorkQueue | null>(null);
  const [view, setView] = useState<RegisterView>("OPEN");
  const [filter, setFilter] = useState<MobileFilter>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    const [identityResult, workResult, queueResult] = await Promise.allSettled([
      getEquipmentIdentityById(resolvedId),
      getEquipmentWorkOrders(resolvedId),
      getEquipmentRecommendedWorkQueue(resolvedId),
    ]);

    const unavailable: string[] = [];
    if (identityResult.status === "fulfilled") setEquipment(identityResult.value);
    else unavailable.push("equipment identity");

    if (workResult.status === "fulfilled") {
      setOpenOrders(workResult.value.open);
      setCompletedOrders(workResult.value.completed);
    } else {
      setOpenOrders([]);
      setCompletedOrders([]);
      unavailable.push("work orders");
    }

    if (queueResult.status === "fulfilled") setRiskQueue(queueResult.value);
    else {
      setRiskQueue(null);
      unavailable.push("risk queue");
    }

    if (unavailable.length > 0) {
      setError(`Some evidence is unavailable: ${unavailable.join(", ")}. Missing values have not been treated as zero risk.`);
    }
    setLoading(false);
  }, [resolvedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const overdueOrders = useMemo(() => openOrders.filter((order) => Boolean(order.overdue)), [openOrders]);
  const waitingOrders = useMemo(
    () => openOrders.filter((order) => order.status.toUpperCase().includes("WAITING")),
    [openOrders],
  );
  const unassignedOrders = useMemo(
    () => openOrders.filter((order) => !order.engineer || order.engineer === "—"),
    [openOrders],
  );

  const filteredOpen = useMemo(() => {
    const query = search.trim().toLowerCase();
    return openOrders.filter((order) => {
      const matchesSearch = !query || [order.id, order.description, order.engineer, order.type, order.status]
        .some((value) => String(value).toLowerCase().includes(query));
      const matchesFilter =
        filter === "ALL" ||
        (filter === "OVERDUE" && Boolean(order.overdue)) ||
        (filter === "WAITING PARTS" && order.status.toUpperCase().includes("WAITING")) ||
        (filter === "UNASSIGNED" && (!order.engineer || order.engineer === "—"));
      return matchesSearch && matchesFilter;
    });
  }, [filter, openOrders, search]);

  const filteredCompleted = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return completedOrders;
    return completedOrders.filter((order) =>
      [order.id, order.description, order.completedBy, order.type, order.outcome]
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [completedOrders, search]);

  const topAction = riskQueue?.actions[0] ?? null;

  const openAction = (action: EquipmentRecommendedWorkAction): void => {
    if (!equipment) return;
    if (action.workOrderNumber) {
      openWorkOrderDetail({ equipmentId: equipment.id, workOrderNumber: action.workOrderNumber });
      return;
    }
    if (action.sparePartNumber || action.actionType === "Critical Spare") {
      navigate(`/equipment/${equipment.id}/spares`);
      return;
    }
    navigate(`/equipment/${equipment.id}/pms`);
  };

  const askVorta = (): void => {
    if (!equipment) return;
    openMaintenanceAiAssistant({
      question: `Explain the work-order execution risk for ${equipment.name} (${equipment.assetNumber}). Rank the highest-value next actions, blockers, required engineers, parts and documents.`,
    });
  };

  return (
    <section className="flex w-full flex-col gap-4 overflow-x-hidden px-3 pb-24 pt-4" data-vorta-mobile-work-orders="true">
      <header className="border-b border-gray-800 pb-4">
        <button
          type="button"
          onClick={() => navigate("/equipment")}
          className="text-xs font-semibold text-slate-500"
        >
          Equipment register
        </button>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold text-slate-50">{equipment?.name ?? "Equipment work orders"}</p>
            <p className="mt-1 text-sm text-slate-400">
              {equipment ? `${equipment.assetNumber} · ${equipment.area}` : "Loading equipment identity"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-2xl font-semibold tabular-nums ${riskTone(equipment?.riskLevel ?? "low")}`}>
              {equipment ? `${equipment.riskScore}%` : "—"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-slate-600">risk</p>
          </div>
        </div>
        <EquipmentTabNavigation equipmentId={resolvedId} activeTab="work-orders" />
      </header>

      {error ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-4" role="alert">
          <div className="flex items-start gap-2 text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Work-order evidence partly unavailable</p>
              <p className="mt-1 text-sm leading-5 text-amber-100/70">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Open" value={loading ? "—" : String(openOrders.length)} detail="SAP work orders" />
        <Metric label="Overdue" value={loading ? "—" : String(overdueOrders.length)} detail="Past due date" />
        <Metric label="Waiting parts" value={loading ? "—" : String(waitingOrders.length)} detail="Execution blocked" />
        <Metric label="Unassigned" value={loading ? "—" : String(unassignedOrders.length)} detail="No engineer" />
      </div>

      {topAction ? (
        <article className="rounded-xl border border-blue-500/25 bg-blue-500/[0.07] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-blue-300">
                <Sparkles className="h-4 w-4" />
                <p className="text-sm font-semibold">Highest-value action</p>
              </div>
              <p className="mt-2 font-mono text-xs font-semibold text-blue-200">{actionReference(topAction)}</p>
              <h2 className="mt-1 font-semibold leading-5 text-slate-100">{topAction.action}</h2>
              {topAction.detail ? <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-400">{topAction.detail}</p> : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xl font-semibold text-emerald-300">-{topAction.calculatedReduction}</p>
              <p className="text-[9px] uppercase tracking-wider text-slate-600">risk points</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => openAction(topAction)} className="min-h-11 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 text-sm font-semibold text-blue-200">
              Open record
            </button>
            <button type="button" onClick={askVorta} className="min-h-11 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white">
              Ask Vorta
            </button>
          </div>
        </article>
      ) : null}

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-gray-800 bg-[#10151d] p-1" role="tablist" aria-label="Work-order register view">
        {(["OPEN", "COMPLETED"] as RegisterView[]).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={view === option}
            onClick={() => {
              setView(option);
              setFilter("ALL");
            }}
            className={`min-h-11 rounded-lg text-xs font-semibold ${view === option ? "bg-blue-600 text-white" : "text-slate-400"}`}
          >
            {option === "OPEN" ? `Open ${openOrders.length}` : `Completed ${completedOrders.length}`}
          </button>
        ))}
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <span className="sr-only">Search work orders</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search work orders"
          className="min-h-12 w-full rounded-xl border border-gray-800 bg-[#10151d] pl-10 pr-4 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500"
        />
      </label>

      {view === "OPEN" ? (
        <div className="-mr-3 flex gap-2 overflow-x-auto pr-3 pb-1 scrollbar-none" aria-label="Open work-order filters">
          {([
            ["ALL", "All"],
            ["OVERDUE", "Overdue"],
            ["WAITING PARTS", "Waiting parts"],
            ["UNASSIGNED", "Unassigned"],
          ] as Array<[MobileFilter, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-semibold ${
                filter === value
                  ? "border-blue-500/40 bg-blue-500/15 text-blue-200"
                  : "border-gray-800 bg-[#141820] text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-50">{view === "OPEN" ? "Execution backlog" : "Completed work"}</h2>
          <p className="text-xs text-slate-500">
            {view === "OPEN" ? filteredOpen.length : filteredCompleted.length} matching record{(view === "OPEN" ? filteredOpen.length : filteredCompleted.length) === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh work-order evidence"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-800 bg-[#141820] text-slate-300 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {loading && openOrders.length === 0 && completedOrders.length === 0
          ? Array.from({ length: 4 }, (_, index) => <div key={index} className="h-40 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />)
          : null}

        {view === "OPEN"
          ? filteredOpen.map((order) => (
              <article key={order.id} id={`work-order-${order.id}`} className="rounded-xl border border-gray-800 bg-[#141820] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${priorityTone(order.priority)}`}>{order.priority}</span>
                      <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusTone(order.status)}`}>{order.status}</span>
                      {order.overdue ? <span className="text-[10px] font-semibold text-red-300">Overdue</span> : null}
                    </div>
                    <p className="mt-3 font-mono text-xs font-semibold text-blue-300">{order.id}</p>
                    <h3 className="mt-1 text-sm font-semibold leading-5 text-slate-100">{order.description}</h3>
                    <p className="mt-1 text-xs text-slate-500">{order.type} · age {order.age}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-800 pt-3">
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-wider text-slate-600">Engineer</p>
                    <p className={`mt-1 truncate text-xs font-semibold ${order.engineer === "—" ? "text-red-300" : "text-slate-300"}`}>
                      {order.engineer === "—" ? "Unassigned" : order.engineer}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-wider text-slate-600">Due</p>
                    <p className={`mt-1 text-xs font-semibold ${order.overdue ? "text-red-300" : "text-slate-300"}`}>{formatDate(order.dueDate)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => equipment && openWorkOrderDetail({ equipmentId: equipment.id, workOrderNumber: order.id })}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-between rounded-xl border border-gray-700 bg-[#10151d] px-4 text-sm font-semibold text-blue-300"
                >
                  Open work order <ChevronRight className="h-4 w-4" />
                </button>
              </article>
            ))
          : filteredCompleted.map((order) => (
              <article key={order.id} className="rounded-xl border border-gray-800 bg-[#141820] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusTone(order.outcome)}`}>{order.outcome || "Completed"}</span>
                      <span className="text-[10px] font-semibold text-slate-500">MTTR {order.mttr}</span>
                    </div>
                    <p className="mt-3 font-mono text-xs font-semibold text-blue-300">{order.id}</p>
                    <h3 className="mt-1 text-sm font-semibold leading-5 text-slate-100">{order.description}</h3>
                    <p className="mt-1 text-xs text-slate-500">{order.type}</p>
                  </div>
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-800 pt-3">
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-wider text-slate-600">Completed by</p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-300">{order.completedBy}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-wider text-slate-600">Completed</p>
                    <p className="mt-1 text-xs font-semibold text-slate-300">{formatDate(order.completionDate)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => equipment && openWorkOrderDetail({ equipmentId: equipment.id, workOrderNumber: order.id })}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-between rounded-xl border border-gray-700 bg-[#10151d] px-4 text-sm font-semibold text-blue-300"
                >
                  Open completion evidence <ChevronRight className="h-4 w-4" />
                </button>
              </article>
            ))}

        {!loading && view === "OPEN" && filteredOpen.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-800 bg-[#10151d] p-8 text-center">
            <Wrench className="mx-auto h-6 w-6 text-slate-700" />
            <p className="mt-3 text-sm font-semibold text-slate-300">No matching open work orders</p>
            <p className="mt-1 text-xs text-slate-600">Change the search or filter.</p>
          </div>
        ) : null}
        {!loading && view === "COMPLETED" && filteredCompleted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-800 bg-[#10151d] p-8 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-slate-700" />
            <p className="mt-3 text-sm font-semibold text-slate-300">No matching completed work</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#10151d] p-4">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <p className="text-xs leading-5 text-slate-500">
            Work-order information is read-only. Assignment, status and completion remain controlled in SAP PM.
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => equipment && navigate(`/equipment/${equipment.id}/notifications`)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-800 bg-[#141820] text-xs font-semibold text-slate-300">
            <AlertTriangle className="h-4 w-4" /> Notifications
          </button>
          <button type="button" onClick={() => equipment && navigate(`/equipment/${equipment.id}/spares`)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-800 bg-[#141820] text-xs font-semibold text-slate-300">
            <PackageSearch className="h-4 w-4" /> Spares
          </button>
        </div>
      </div>
    </section>
  );
}
