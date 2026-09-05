import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const PAGE =
  "mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 pb-10 pt-5 sm:px-5 md:gap-6 md:px-6 md:pb-12 md:pt-6 xl:px-8";
const CARD =
  "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.22)]";
const RAISED = "rounded-xl border border-slate-800/70 bg-[#07172b]";
const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-[#07172b] px-3 text-sm font-medium text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

interface WorkEquipment {
  id: string;
  equipment_code: string | null;
  name: string;
  area: string | null;
  line: string | null;
  equipment_type: string | null;
  criticality: string | null;
  status: string | null;
}

interface EngineerWorkOrder {
  id: string;
  equipment_id: string | null;
  wo_number: string | null;
  priority: string | null;
  description: string | null;
  work_type: string | null;
  status: string | null;
  assigned_engineer: string | null;
  requested_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  downtime_minutes: number | null;
  is_overdue: boolean | null;
  fault_code: string | null;
  order_type_code: string | null;
  order_type_description: string | null;
  maintenance_activity_type_code: string | null;
  maintenance_activity_type_description: string | null;
  main_work_center: string | null;
  planner_group: string | null;
  basic_start_date: string | null;
  basic_finish_date: string | null;
  scheduled_start_at: string | null;
  scheduled_finish_at: string | null;
  actual_start_at: string | null;
  actual_finish_at: string | null;
  system_status_codes: unknown;
  user_status_codes: unknown;
  source_updated_at: string | null;
  equipment: WorkEquipment | null;
}

interface EngineerWorkPayload {
  siteId: string;
  organisationId: string;
  engineer: {
    id: string;
    fullName: string;
    discipline: string | null;
  };
  workOrders: EngineerWorkOrder[];
  generatedAt: string;
  scope: "self";
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normaliseEquipment(value: unknown): WorkEquipment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = readString(row.id);
  const name = readString(row.name);
  if (!id || !name) return null;
  return {
    id,
    equipment_code: readString(row.equipment_code),
    name,
    area: readString(row.area),
    line: readString(row.line),
    equipment_type: readString(row.equipment_type),
    criticality: readString(row.criticality),
    status: readString(row.status),
  };
}

function normaliseWorkOrder(value: unknown): EngineerWorkOrder | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = readString(row.id);
  if (!id) return null;
  return {
    id,
    equipment_id: readString(row.equipment_id),
    wo_number: readString(row.wo_number),
    priority: readString(row.priority),
    description: readString(row.description),
    work_type: readString(row.work_type),
    status: readString(row.status),
    assigned_engineer: readString(row.assigned_engineer),
    requested_date: readString(row.requested_date),
    due_date: readString(row.due_date),
    completed_date: readString(row.completed_date),
    downtime_minutes: readNumber(row.downtime_minutes),
    is_overdue: row.is_overdue === true,
    fault_code: readString(row.fault_code),
    order_type_code: readString(row.order_type_code),
    order_type_description: readString(row.order_type_description),
    maintenance_activity_type_code: readString(row.maintenance_activity_type_code),
    maintenance_activity_type_description: readString(row.maintenance_activity_type_description),
    main_work_center: readString(row.main_work_center),
    planner_group: readString(row.planner_group),
    basic_start_date: readString(row.basic_start_date),
    basic_finish_date: readString(row.basic_finish_date),
    scheduled_start_at: readString(row.scheduled_start_at),
    scheduled_finish_at: readString(row.scheduled_finish_at),
    actual_start_at: readString(row.actual_start_at),
    actual_finish_at: readString(row.actual_finish_at),
    system_status_codes: row.system_status_codes ?? null,
    user_status_codes: row.user_status_codes ?? null,
    source_updated_at: readString(row.source_updated_at),
    equipment: normaliseEquipment(row.equipment),
  };
}

function normalisePayload(value: unknown): EngineerWorkPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Engineer work evidence returned an invalid payload.");
  }
  const root = value as Record<string, unknown>;
  const error = readString(root.error);
  if (error) throw new Error(error);
  const engineerValue = root.engineer;
  if (!engineerValue || typeof engineerValue !== "object" || Array.isArray(engineerValue)) {
    throw new Error("The signed-in engineer could not be resolved from verified identity data.");
  }
  const engineer = engineerValue as Record<string, unknown>;
  const engineerId = readString(engineer.id);
  const fullName = readString(engineer.fullName);
  const siteId = readString(root.siteId);
  const organisationId = readString(root.organisationId);
  if (!engineerId || !fullName || !siteId || !organisationId || root.scope !== "self") {
    throw new Error("Engineer work scope could not be verified.");
  }
  const workOrders = Array.isArray(root.workOrders)
    ? root.workOrders.flatMap((item) => {
        const order = normaliseWorkOrder(item);
        return order ? [order] : [];
      })
    : [];
  return {
    siteId,
    organisationId,
    engineer: {
      id: engineerId,
      fullName,
      discipline: readString(engineer.discipline),
    },
    workOrders,
    generatedAt: readString(root.generatedAt) ?? new Date().toISOString(),
    scope: "self",
  };
}

async function loadMyWork(): Promise<EngineerWorkPayload> {
  const { data, error } = await supabase.functions.invoke("engineer-work-data");
  if (error) {
    throw new Error(`Engineer work evidence could not be loaded: ${error.message}`);
  }
  return normalisePayload(data);
}

function displayDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusKey(value: string | null): "open" | "complete" | "other" {
  const status = (value ?? "").toLowerCase();
  if (/teco|closed|complete|completed|clsd/.test(status)) return "complete";
  if (/rel|open|created|in progress|in_progress|released/.test(status)) return "open";
  return "other";
}

function priorityTone(priority: string | null): string {
  const value = (priority ?? "").toLowerCase();
  if (value.includes("critical") || value.includes("high") || value === "1") {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (value.includes("medium") || value === "2") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }
  return "border-slate-700 bg-slate-800/30 text-slate-400";
}

function EvidenceError({ message, onRetry }: { message: string; onRetry: () => void }): JSX.Element {
  return (
    <main className={PAGE}>
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">My Work</h1>
        <p className="mt-1 text-sm leading-6 text-slate-400">Work assigned to your verified engineer identity.</p>
      </header>
      <section className={`${CARD} p-5 sm:p-6`} data-vorta-engineer-work-state="unavailable">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Live work evidence unavailable</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">{message}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Vorta will not substitute demo work orders or another engineer&apos;s assignment list when the live scope cannot be verified.
            </p>
            <button type="button" onClick={onRetry} className={`${BUTTON} mt-4`}>
              <RefreshCw className="h-4 w-4" />
              Retry live evidence
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function LoadingWork(): JSX.Element {
  return (
    <main className={PAGE} aria-live="polite">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-800" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className={`${CARD} h-24 animate-pulse`} />
        ))}
      </div>
      <div className={`${CARD} h-80 animate-pulse`} />
    </main>
  );
}

export function EngineerMyWorkScreen(): JSX.Element {
  const [payload, setPayload] = useState<EngineerWorkPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "overdue" | "complete">("all");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadMyWork()
      .then((result) => {
        if (!cancelled) setPayload(result);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setPayload(null);
          setError(loadError instanceof Error ? loadError.message : "Engineer work evidence could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (payload?.workOrders ?? []).filter((order) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "overdue" && order.is_overdue) ||
        (filter === "open" && statusKey(order.status) === "open") ||
        (filter === "complete" && statusKey(order.status) === "complete");
      if (!matchesFilter) return false;
      if (!needle) return true;
      return [
        order.wo_number,
        order.description,
        order.work_type,
        order.priority,
        order.equipment?.name,
        order.equipment?.equipment_code,
        order.equipment?.area,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [filter, payload, query]);

  if (loading) return <LoadingWork />;
  if (error || !payload) {
    return <EvidenceError message={error ?? "Engineer work evidence could not be verified."} onRetry={() => setReloadToken((value) => value + 1)} />;
  }

  const openCount = payload.workOrders.filter((order) => statusKey(order.status) === "open").length;
  const overdueCount = payload.workOrders.filter((order) => order.is_overdue).length;
  const completedCount = payload.workOrders.filter((order) => statusKey(order.status) === "complete").length;

  return (
    <main className={PAGE} data-vorta-engineer-work-state="live">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">Engineer execution</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">My Work</h1>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            {payload.engineer.fullName} · only work orders assigned to your verified engineer identity.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Self-scoped live evidence
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => setFilter("open")} className={`${CARD} p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Open</p>
          <p className="mt-2 text-2xl font-semibold text-blue-400">{openCount}</p>
        </button>
        <button type="button" onClick={() => setFilter("overdue")} className={`${CARD} p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Overdue</p>
          <p className={`mt-2 text-2xl font-semibold ${overdueCount ? "text-red-400" : "text-emerald-400"}`}>{overdueCount}</p>
        </button>
        <button type="button" onClick={() => setFilter("complete")} className={`${CARD} p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Complete</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-400">{completedCount}</p>
        </button>
      </section>

      <section className={`${CARD} p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search work, equipment or order number"
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950/50 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-slate-600" />
            {(["all", "open", "overdue", "complete"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={`min-h-10 rounded-xl border px-3 text-xs font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${filter === value ? "border-blue-400/40 bg-blue-500/10 text-blue-200" : "border-slate-800 bg-slate-950/25 text-slate-500"}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="mt-4 space-y-2">
            {filtered.map((order) => (
              <Link
                key={order.id}
                to={`/engineer/work/${encodeURIComponent(order.id)}`}
                className="flex min-h-20 items-center justify-between gap-3 rounded-xl border border-slate-800/70 bg-[#07172b] p-3.5 transition-colors hover:border-blue-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-lg border px-2 py-1 text-[9px] font-semibold ${priorityTone(order.priority)}`}>
                      {order.priority ?? "Unrated"}
                    </span>
                    {order.is_overdue ? (
                      <span className="rounded-lg border border-red-500/25 bg-red-500/10 px-2 py-1 text-[9px] font-semibold text-red-300">Overdue</span>
                    ) : null}
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-600">
                      {order.wo_number ?? order.id}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-slate-100">
                    {order.description ?? "Maintenance work order"}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {order.equipment?.name ?? "Equipment not linked"} · {order.equipment?.area ?? "Area not recorded"} · due {displayDate(order.due_date)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-600" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-800/70 bg-slate-950/25 p-6 text-center">
            <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-400" />
            <p className="mt-2 text-sm font-semibold text-slate-200">
              {payload.workOrders.length === 0 ? "No work is currently assigned to you" : "No work matches this filter"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {payload.workOrders.length === 0
                ? "This is a verified empty result for your engineer identity. No demo work has been substituted."
                : "Change the search or filter to view other assigned work."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

export function EngineerWorkOrderDetailScreen(): JSX.Element {
  const { workOrderId } = useParams();
  const [payload, setPayload] = useState<EngineerWorkPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadMyWork()
      .then((result) => {
        if (!cancelled) setPayload(result);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setPayload(null);
          setError(loadError instanceof Error ? loadError.message : "Engineer work evidence could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  if (loading) return <LoadingWork />;
  if (error || !payload) {
    return <EvidenceError message={error ?? "Engineer work evidence could not be verified."} onRetry={() => setReloadToken((value) => value + 1)} />;
  }

  const order = payload.workOrders.find(
    (item) => item.id === workOrderId || item.wo_number === workOrderId,
  );
  if (!order) {
    return (
      <main className={PAGE}>
        <Link to="/engineer/work" className={BUTTON}><ArrowLeft className="h-4 w-4" />My Work</Link>
        <section className={`${CARD} p-5`} data-vorta-engineer-work-detail="not-authorised">
          <ShieldCheck className="h-5 w-5 text-amber-400" />
          <h1 className="mt-3 text-lg font-semibold text-slate-100">Work order not available</h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            This work order is not present in your verified assignment scope. Vorta will not load it from the wider site work-order table.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={PAGE} data-vorta-engineer-work-detail="live">
      <div><Link to="/engineer/work" className={BUTTON}><ArrowLeft className="h-4 w-4" />My Work</Link></div>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">
            Work order {order.wo_number ?? order.id}
          </p>
          <h1 className="mt-1 max-w-4xl text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">
            {order.description ?? "Maintenance work order"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {order.equipment?.name ?? "Equipment not linked"} · {order.equipment?.area ?? "Area not recorded"}
          </p>
        </div>
        <span className={`self-start rounded-xl border px-3 py-2 text-xs font-semibold ${priorityTone(order.priority)}`}>
          {order.priority ?? "Unrated priority"}
        </span>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Status</p><p className="mt-2 text-sm font-semibold text-slate-100">{order.status ?? "Not recorded"}</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Due</p><p className={`mt-2 text-sm font-semibold ${order.is_overdue ? "text-red-400" : "text-slate-100"}`}>{displayDate(order.due_date)}</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Work type</p><p className="mt-2 text-sm font-semibold text-slate-100">{order.work_type ?? order.order_type_description ?? "Maintenance"}</p></div>
        <div className={`${CARD} p-4`}><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Fault code</p><p className="mt-2 text-sm font-semibold text-slate-100">{order.fault_code ?? "—"}</p></div>
      </section>

      <section className={`${CARD} p-5 sm:p-6`}>
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-slate-100">Execution context</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ["Equipment", order.equipment?.name ?? "Not linked"],
            ["Asset", order.equipment?.equipment_code ?? "—"],
            ["Area", order.equipment?.area ?? "—"],
            ["Main work centre", order.main_work_center ?? "—"],
            ["Planner group", order.planner_group ?? "—"],
            ["Requested", displayDate(order.requested_date)],
            ["Basic start", displayDate(order.basic_start_date)],
            ["Basic finish", displayDate(order.basic_finish_date)],
          ].map(([label, value]) => (
            <div key={label} className={`${RAISED} p-3`}>
              <p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">{label}</p>
              <p className="mt-1 text-sm font-medium text-slate-200">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${CARD} p-5`}>
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Evidence provenance</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              This record came from the authenticated self-scoped engineer work endpoint. Source updated {displayDate(order.source_updated_at)}; Vorta remains read-only to the source maintenance system.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
