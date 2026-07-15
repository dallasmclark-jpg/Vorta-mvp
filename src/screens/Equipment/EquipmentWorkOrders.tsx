import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bell,
  BrainCircuit,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  Download,
  Gauge,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  UserCircle,
  Users,
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
  getEquipmentIdentityById,
  getEquipmentRecommendedWorkQueue,
  getEquipmentWorkOrders,
  type EquipmentRecommendedWorkAction,
  type EquipmentRecommendedWorkQueue,
} from "./equipmentService";
import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";

type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type WoStatus = "OPEN" | "IN PROGRESS" | "ON HOLD" | "WAITING PARTS";
type RegisterView = "OPEN" | "COMPLETED";
type WorkFilter =
  | "ALL"
  | "OVERDUE"
  | "WAITING PARTS"
  | "PREVENTIVE"
  | "CORRECTIVE";

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

interface CompletedWorkOrder {
  id: string;
  description: string;
  type: string;
  completedBy: string;
  completionDate: string;
  mttr: string;
  outcome: string;
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

function priorityClass(priority: string): string {
  switch (priority.toUpperCase()) {
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

function statusClass(status: string): string {
  const normalised = status.toUpperCase();

  if (normalised.includes("WAITING")) {
    return "border-violet-500/25 bg-violet-500/10 text-violet-300";
  }
  if (normalised.includes("HOLD")) {
    return "border-slate-600 bg-slate-800/70 text-slate-300";
  }
  if (normalised.includes("PROGRESS")) {
    return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  }
  if (normalised.includes("COMPLETED") || normalised.includes("SUCCESS")) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  if (normalised.includes("RECUR") || normalised.includes("TEMPORARY")) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  return "border-blue-500/25 bg-blue-500/10 text-blue-300";
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

function priorityRank(priority: Priority): number {
  return { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[priority];
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string): string {
  const date = parseDate(value);
  if (!date) return value || "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: Date | null): string {
  if (!value) return "Loading latest import";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function initials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0 || name === "—") return "—";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function outcomeTone(outcome: string): string {
  return statusClass(outcome || "Completed");
}

function extractFaultReference(description: string): string | null {
  const match = description.match(/\b([A-Z]-\d{3,4})\b/i);
  return match?.[1]?.toUpperCase() ?? null;
}

export const EquipmentWorkOrders = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const selectedWorkOrder = searchParams.get("workOrder")?.trim() ?? "";

  const [equipment, setEquipment] = useState<EquipmentBase | null>(() =>
    getCachedEquipmentIdentity(resolvedId),
  );
  const [openWorkOrders, setOpenWorkOrders] = useState<WorkOrder[]>([]);
  const [completedWorkOrders, setCompletedWorkOrders] = useState<
    CompletedWorkOrder[]
  >([]);
  const [riskQueue, setRiskQueue] =
    useState<EquipmentRecommendedWorkQueue | null>(null);
  const [search, setSearch] = useState(selectedWorkOrder);
  const [filter, setFilter] = useState<WorkFilter>("ALL");
  const [registerView, setRegisterView] = useState<RegisterView>("OPEN");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadWorkOrderIntelligence = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [identity, workOrders, queue] = await Promise.all([
        getEquipmentIdentityById(resolvedId),
        getEquipmentWorkOrders(resolvedId),
        getEquipmentRecommendedWorkQueue(resolvedId),
      ]);

      setEquipment(identity);
      setOpenWorkOrders(workOrders.open as WorkOrder[]);
      setCompletedWorkOrders(workOrders.completed as CompletedWorkOrder[]);
      setRiskQueue(queue);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to load equipment work-order intelligence", error);
      setLoadError(
        "Work-order intelligence could not be refreshed. Showing the latest available equipment data.",
      );
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => {
    void loadWorkOrderIntelligence();
  }, [loadWorkOrderIntelligence]);

  useEffect(() => {
    if (!selectedWorkOrder) return;

    setSearch(selectedWorkOrder);
    setRegisterView("OPEN");

    if (openWorkOrders.length === 0) return;

    requestAnimationFrame(() => {
      document
        .getElementById(`work-order-${selectedWorkOrder}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [openWorkOrders.length, selectedWorkOrder]);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const sevenDaysFromNow = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() + 7);
    return date;
  }, [today]);

  const overdueWorkOrders = useMemo(
    () => openWorkOrders.filter((workOrder) => workOrder.overdue),
    [openWorkOrders],
  );

  const waitingPartsWorkOrders = useMemo(
    () =>
      openWorkOrders.filter((workOrder) =>
        workOrder.status.toUpperCase().includes("WAITING"),
      ),
    [openWorkOrders],
  );

  const unassignedWorkOrders = useMemo(
    () =>
      openWorkOrders.filter(
        (workOrder) =>
          !workOrder.engineer || workOrder.engineer.trim() === "—",
      ),
    [openWorkOrders],
  );

  const dueThisWeek = useMemo(
    () =>
      openWorkOrders.filter((workOrder) => {
        const dueDate = parseDate(workOrder.dueDate);
        return Boolean(
          dueDate && dueDate >= today && dueDate <= sevenDaysFromNow,
        );
      }),
    [openWorkOrders, sevenDaysFromNow, today],
  );

  const highestExecutionExposure = useMemo(
    () =>
      [...openWorkOrders].sort((left, right) => {
        const score = (workOrder: WorkOrder) =>
          priorityRank(workOrder.priority) * 20 +
          Number(Boolean(workOrder.overdue)) * 28 +
          Number(workOrder.status === "WAITING PARTS") * 20 +
          Number(workOrder.status === "ON HOLD") * 10 +
          Number(!workOrder.engineer || workOrder.engineer === "—") * 8;

        return score(right) - score(left);
      })[0] ?? null,
    [openWorkOrders],
  );

  const priorityCounts = useMemo(
    () => ({
      CRITICAL: openWorkOrders.filter(
        (workOrder) => workOrder.priority === "CRITICAL",
      ).length,
      HIGH: openWorkOrders.filter(
        (workOrder) => workOrder.priority === "HIGH",
      ).length,
      MEDIUM: openWorkOrders.filter(
        (workOrder) => workOrder.priority === "MEDIUM",
      ).length,
      LOW: openWorkOrders.filter(
        (workOrder) => workOrder.priority === "LOW",
      ).length,
    }),
    [openWorkOrders],
  );

  const workTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const workOrder of openWorkOrders) {
      const label = workOrder.type || "Other";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count);
  }, [openWorkOrders]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const workOrder of openWorkOrders) {
      counts.set(
        workOrder.status,
        (counts.get(workOrder.status) ?? 0) + 1,
      );
    }

    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count);
  }, [openWorkOrders]);

  const completedWithIssues = useMemo(
    () =>
      completedWorkOrders.filter((workOrder) => {
        const outcome = workOrder.outcome.toUpperCase();
        return outcome.includes("RECUR") || outcome.includes("TEMPORARY");
      }),
    [completedWorkOrders],
  );

  const averageMttr = useMemo(() => {
    const values = completedWorkOrders
      .map((workOrder) => Number.parseFloat(workOrder.mttr))
      .filter((value) => Number.isFinite(value));

    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [completedWorkOrders]);

  const repeatFault = useMemo(() => {
    const groups = new Map<
      string,
      { count: number; records: CompletedWorkOrder[] }
    >();

    for (const workOrder of completedWorkOrders) {
      const reference = extractFaultReference(workOrder.description);
      if (!reference) continue;
      const group = groups.get(reference) ?? { count: 0, records: [] };
      group.count += 1;
      group.records.push(workOrder);
      groups.set(reference, group);
    }

    return (
      Array.from(groups.entries())
        .map(([reference, value]) => ({ reference, ...value }))
        .sort((left, right) => right.count - left.count)[0] ?? null
    );
  }, [completedWorkOrders]);

  const assignmentReadiness =
    openWorkOrders.length > 0
      ? Math.round(
          ((openWorkOrders.length - unassignedWorkOrders.length) /
            openWorkOrders.length) *
            100,
        )
      : 100;
  const partsReadiness =
    openWorkOrders.length > 0
      ? Math.round(
          ((openWorkOrders.length - waitingPartsWorkOrders.length) /
            openWorkOrders.length) *
            100,
        )
      : 100;
  const scheduleReadiness =
    openWorkOrders.length > 0
      ? Math.round(
          ((openWorkOrders.length - overdueWorkOrders.length) /
            openWorkOrders.length) *
            100,
        )
      : 100;
  const evidenceReadiness =
    openWorkOrders.length > 0
      ? Math.round(
          (openWorkOrders.filter(
            (workOrder) =>
              Boolean(workOrder.description) && Boolean(workOrder.dueDate),
          ).length /
            openWorkOrders.length) *
            100,
        )
      : 100;
  const executionReadiness = Math.round(
    (assignmentReadiness +
      partsReadiness +
      scheduleReadiness +
      evidenceReadiness) /
      4,
  );

  const currentRisk = riskQueue?.currentRiskScore ?? equipment?.riskScore ?? 0;
  const projectedRisk =
    riskQueue?.projectedRiskScore ?? Math.max(0, currentRisk - 4);

  const briefing = highestExecutionExposure
    ? `${equipment?.name ?? "This equipment"} has ${openWorkOrders.length} open SAP work order${
        openWorkOrders.length === 1 ? "" : "s"
      }, including ${overdueWorkOrders.length} overdue and ${waitingPartsWorkOrders.length} waiting for parts. ${
        highestExecutionExposure.id
      } creates the highest current execution exposure because it is ${
        highestExecutionExposure.priority.toLowerCase()
      } priority, ${
        highestExecutionExposure.overdue
          ? "overdue"
          : highestExecutionExposure.status.toLowerCase()
      } and is assigned to ${
        highestExecutionExposure.engineer === "—"
          ? "no engineer"
          : highestExecutionExposure.engineer
      }.`
    : `${equipment?.name ?? "This equipment"} has no open SAP work orders. Vorta is continuing to monitor imported maintenance demand, completion outcomes and emerging repeat-failure evidence.`;

  const filteredOpenWorkOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return openWorkOrders.filter((workOrder) => {
      const matchesSearch =
        !query ||
        workOrder.id.toLowerCase().includes(query) ||
        workOrder.description.toLowerCase().includes(query) ||
        workOrder.engineer.toLowerCase().includes(query) ||
        workOrder.type.toLowerCase().includes(query) ||
        workOrder.status.toLowerCase().includes(query);

      const matchesFilter =
        filter === "ALL" ||
        (filter === "OVERDUE" && Boolean(workOrder.overdue)) ||
        (filter === "WAITING PARTS" &&
          workOrder.status === "WAITING PARTS") ||
        (filter === "PREVENTIVE" &&
          workOrder.type.toLowerCase().includes("prevent")) ||
        (filter === "CORRECTIVE" &&
          workOrder.type.toLowerCase().includes("correct"));

      return matchesSearch && matchesFilter;
    });
  }, [filter, openWorkOrders, search]);

  const filteredCompletedWorkOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return completedWorkOrders.filter((workOrder) =>
      [
        workOrder.id,
        workOrder.description,
        workOrder.completedBy,
        workOrder.type,
        workOrder.outcome,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [completedWorkOrders, search]);

  const copyValue = useCallback(async (value: string, key: string) => {
    if (!navigator.clipboard) return;

    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => {
      setCopied((current) => (current === key ? null : current));
    }, 1600);
  }, []);

  const askVorta = useCallback(
    (prompt?: string) => {
      if (!equipment) return;

      const resolvedPrompt =
        prompt ||
        question.trim() ||
        `Explain the work-order execution risk for ${equipment.name} and rank the highest-value next actions.`;

      navigate(
        `/equipment/${equipment.id}/ai-insights?prompt=${encodeURIComponent(
          resolvedPrompt,
        )}`,
      );
    },
    [equipment, navigate, question],
  );

  const openRiskAction = useCallback(
    (action: EquipmentRecommendedWorkAction) => {
      if (!equipment) return;

      if (action.sparePartNumber || action.actionType === "Critical Spare") {
        navigate(`/equipment/${equipment.id}/spares`);
        return;
      }

      if (action.workOrderNumber) {
        setRegisterView("OPEN");
        setSearch(action.workOrderNumber);
        setSearchParams(
          { workOrder: action.workOrderNumber },
          { replace: true },
        );
        requestAnimationFrame(() => {
          document
            .getElementById("work-order-register")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return;
      }

      if (action.pmNumber || action.actionType === "Preventive Maintenance") {
        setRegisterView("OPEN");
        setFilter("PREVENTIVE");
        requestAnimationFrame(() => {
          document
            .getElementById("work-order-register")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },
    [equipment, navigate, setSearchParams],
  );

  const exportWorkOrders = useCallback(() => {
    if (!equipment) return;

    const rows = [
      [
        "Work Order",
        "Record State",
        "Priority",
        "Description",
        "Type",
        "Status / Outcome",
        "Engineer",
        "Requested / Completed",
        "Due Date",
        "Age / MTTR",
      ],
      ...openWorkOrders.map((workOrder) => [
        workOrder.id,
        "Open",
        workOrder.priority,
        workOrder.description,
        workOrder.type,
        workOrder.status,
        workOrder.engineer,
        workOrder.requestedDate,
        workOrder.dueDate,
        workOrder.age,
      ]),
      ...completedWorkOrders.map((workOrder) => [
        workOrder.id,
        "Completed",
        "",
        workOrder.description,
        workOrder.type,
        workOrder.outcome,
        workOrder.completedBy,
        workOrder.completionDate,
        "",
        workOrder.mttr,
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
    anchor.download = `${equipment.assetNumber}-work-order-intelligence.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [completedWorkOrders, equipment, openWorkOrders]);

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
              onClick={() => void loadWorkOrderIntelligence()}
              disabled={loading}
              aria-label="Refresh work-order intelligence"
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
          activeTab="work-orders"
        />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">
        <Card className="overflow-hidden rounded-2xl border border-blue-500/25 bg-[linear-gradient(135deg,#131923_0%,#10151d_55%,#101722_100%)] shadow-none">
          <CardContent className="p-0">
            <div className="grid xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.55fr)]">
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="h-auto rounded bg-blue-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300 shadow-none">
                    SAP work execution intelligence
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Database className="h-3.5 w-3.5" />
                    Work orders · PM execution · completion history · {formatDateTime(lastUpdated)}
                  </span>
                </div>

                <h2 className="mt-4 text-xl font-semibold text-slate-50">
                  Work Execution Briefing
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                  {briefing}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    label="Open work orders"
                    value={openWorkOrders.length}
                    detail={`${priorityCounts.CRITICAL} critical · ${priorityCounts.HIGH} high`}
                  />
                  <Metric
                    label="Overdue"
                    value={overdueWorkOrders.length}
                    detail={`${dueThisWeek.length} due within seven days`}
                    tone={
                      overdueWorkOrders.length > 0
                        ? "text-red-300"
                        : "text-emerald-300"
                    }
                  />
                  <Metric
                    label="Execution readiness"
                    value={`${executionReadiness}%`}
                    detail={`${unassignedWorkOrders.length} unassigned · ${waitingPartsWorkOrders.length} waiting parts`}
                    tone={
                      executionReadiness >= 85
                        ? "text-emerald-300"
                        : executionReadiness >= 65
                          ? "text-yellow-300"
                          : "text-red-300"
                    }
                  />
                  <Metric
                    label="Available risk reduction"
                    value={`${riskQueue?.totalCalculatedReduction ?? 0} pts`}
                    detail={`${currentRisk}% to ${projectedRisk}% projected risk`}
                    tone="text-emerald-300"
                  />
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-gray-700 bg-[#0a0f16] px-3 focus-within:border-blue-500/60">
                    <Sparkles className="h-4 w-4 shrink-0 text-blue-400" />
                    <input
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") askVorta();
                      }}
                      placeholder={`Ask Vorta about ${equipment.assetNumber} work execution...`}
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => askVorta()}
                    className="min-h-11 gap-2 bg-blue-600 px-5 text-white hover:bg-blue-500"
                  >
                    <BrainCircuit className="h-4 w-4" />
                    Ask Vorta
                  </Button>
                </div>
              </div>

              <div className="border-t border-gray-800 bg-[#0b1017]/70 p-5 xl:border-l xl:border-t-0 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Highest execution exposure
                </p>

                {highestExecutionExposure ? (
                  <div className="mt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${priorityClass(
                          highestExecutionExposure.priority,
                        )}`}
                      >
                        {highestExecutionExposure.priority}
                      </Badge>
                      <Badge
                        className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${statusClass(
                          highestExecutionExposure.status,
                        )}`}
                      >
                        {highestExecutionExposure.status}
                      </Badge>
                      {highestExecutionExposure.overdue ? (
                        <Badge className="h-auto rounded border border-red-500/25 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300 shadow-none">
                          Overdue
                        </Badge>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setRegisterView("OPEN");
                        setSearch(highestExecutionExposure.id);
                        setSearchParams(
                          { workOrder: highestExecutionExposure.id },
                          { replace: true },
                        );
                        requestAnimationFrame(() => {
                          document
                            .getElementById("work-order-register")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                        });
                      }}
                      className="mt-3 font-mono text-sm font-semibold text-blue-300 hover:text-blue-200"
                    >
                      {highestExecutionExposure.id}
                    </button>
                    <p className="mt-2 text-sm font-semibold leading-5 text-slate-100">
                      {highestExecutionExposure.description}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Metric
                        label="Assigned engineer"
                        value={highestExecutionExposure.engineer}
                        detail={highestExecutionExposure.type}
                        tone={
                          highestExecutionExposure.engineer === "—"
                            ? "text-red-300"
                            : "text-slate-100"
                        }
                      />
                      <Metric
                        label="Due date"
                        value={formatDate(highestExecutionExposure.dueDate)}
                        detail={`Age ${highestExecutionExposure.age}`}
                        tone={
                          highestExecutionExposure.overdue
                            ? "text-red-300"
                            : "text-slate-100"
                        }
                      />
                    </div>

                    <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300/80">
                        Vorta execution view
                      </p>
                      <p className="mt-1 text-xs leading-5 text-blue-100/70">
                        Vorta remains read-only. Completion, assignment and status
                        changes continue in SAP; this page ranks what deserves
                        attention and explains the operational consequence.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        askVorta(
                          `Analyse ${highestExecutionExposure.id}: ${highestExecutionExposure.description}. Explain execution blockers, equipment risk, relevant notifications, required skills, parts and documents.`,
                        )
                      }
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
                    >
                      Analyse this work order
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <p className="mt-3 text-sm font-semibold text-emerald-200">
                      No open execution exposure
                    </p>
                    <p className="mt-1 text-xs leading-5 text-emerald-100/60">
                      No open SAP work orders are currently linked to this
                      equipment.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-emerald-500/20 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/80">
                  Risk reduction queue
                </p>
                <h2 className="mt-1 text-base font-semibold text-slate-100">
                  Highest-value executable work
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Ranked from the live equipment risk model, SAP work orders,
                  preventive maintenance and critical-spares exposure.
                </p>
              </div>

              {riskQueue ? (
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-300">
                    {riskQueue.totalCalculatedReduction} risk points available
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {riskQueue.currentRiskScore}% to {riskQueue.projectedRiskScore}%
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-3">
              {riskQueue?.actions.map((action) => {
                const reference =
                  action.workOrderNumber ??
                  action.pmNumber ??
                  action.sparePartNumber ??
                  "Risk action";

                return (
                  <article
                    key={`${action.priority}-${action.action}`}
                    className="flex min-h-[250px] flex-col rounded-xl border border-gray-800 bg-[#0d1219] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-300">
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
                        <p className="text-lg font-bold text-emerald-300">
                          -{action.calculatedReduction}
                        </p>
                        <p className="text-[9px] uppercase tracking-wide text-slate-600">
                          risk points
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 break-words font-mono text-[10px] text-blue-300">
                      {reference}
                    </p>
                    {action.detail ? (
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        {action.detail}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {action.status ? (
                        <Badge
                          className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${statusClass(
                            action.status,
                          )}`}
                        >
                          {action.status}
                        </Badge>
                      ) : null}
                      {action.actionType ? (
                        <Badge className="h-auto rounded border border-gray-700 bg-gray-800/70 px-2 py-1 text-[10px] font-medium text-slate-400 shadow-none">
                          {action.actionType}
                        </Badge>
                      ) : null}
                      {action.durationMinutes > 0 ? (
                        <Badge className="h-auto rounded border border-gray-700 bg-gray-800/70 px-2 py-1 text-[10px] font-medium text-slate-400 shadow-none">
                          {action.durationMinutes} min
                        </Badge>
                      ) : action.leadTimeDays > 0 ? (
                        <Badge className="h-auto rounded border border-gray-700 bg-gray-800/70 px-2 py-1 text-[10px] font-medium text-slate-400 shadow-none">
                          {action.leadTimeDays} day lead
                        </Badge>
                      ) : null}
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
                        Open source record
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}

              {!riskQueue || riskQueue.actions.length === 0 ? (
                <div className="col-span-full rounded-xl border border-gray-800 bg-[#0d1219] px-4 py-10 text-center">
                  <Gauge className="mx-auto h-6 w-6 text-slate-700" />
                  <p className="mt-3 text-sm font-medium text-slate-300">
                    {loading
                      ? "Calculating risk-reducing work"
                      : "No immediate risk-reduction work identified"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Vorta will populate this queue when the risk engine identifies
                    executable interventions.
                  </p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-400/80">
                    Execution readiness
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-100">
                    Can the current backlog be executed?
                  </h2>
                </div>
                <div className="text-right">
                  <p
                    className={`text-3xl font-semibold ${
                      executionReadiness >= 85
                        ? "text-emerald-300"
                        : executionReadiness >= 65
                          ? "text-yellow-300"
                          : "text-red-300"
                    }`}
                  >
                    {executionReadiness}%
                  </p>
                  <p className="text-[10px] text-slate-500">overall readiness</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {[
                  {
                    label: "Engineering assignment",
                    value: assignmentReadiness,
                    detail: `${unassignedWorkOrders.length} work order${unassignedWorkOrders.length === 1 ? "" : "s"} unassigned`,
                    icon: Users,
                  },
                  {
                    label: "Parts availability",
                    value: partsReadiness,
                    detail: `${waitingPartsWorkOrders.length} waiting for parts`,
                    icon: PackageSearch,
                  },
                  {
                    label: "Schedule control",
                    value: scheduleReadiness,
                    detail: `${overdueWorkOrders.length} overdue work order${overdueWorkOrders.length === 1 ? "" : "s"}`,
                    icon: CalendarClock,
                  },
                  {
                    label: "Execution evidence",
                    value: evidenceReadiness,
                    detail: "Description and due-date completeness",
                    icon: ShieldAlert,
                  },
                ].map(({ label, value, detail, icon: Icon }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-300">
                            {label}
                          </p>
                          <p className="truncate text-[10px] text-slate-600">
                            {detail}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-slate-200">
                        {value}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Backlog profile
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-100">
                Priority, type and status mix
              </h2>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric
                  label="Critical / high"
                  value={priorityCounts.CRITICAL + priorityCounts.HIGH}
                  detail={`${priorityCounts.CRITICAL} critical · ${priorityCounts.HIGH} high`}
                  tone="text-orange-300"
                />
                <Metric
                  label="Due this week"
                  value={dueThisWeek.length}
                  detail={`${overdueWorkOrders.length} already overdue`}
                  tone="text-yellow-300"
                />
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Work type
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {workTypeCounts.map((item) => (
                      <Badge
                        key={item.label}
                        className="h-auto rounded border border-gray-700 bg-gray-800/70 px-2 py-1 text-[10px] font-medium text-slate-300 shadow-none"
                      >
                        {item.label} {item.count}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Execution status
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {statusCounts.map((item) => (
                      <Badge
                        key={item.label}
                        className={`h-auto rounded border px-2 py-1 text-[10px] font-medium shadow-none ${statusClass(
                          item.label,
                        )}`}
                      >
                        {item.label} {item.count}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <Card className="rounded-2xl border border-red-500/20 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-400/80">
                    Repeat-failure intelligence
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-100">
                    Completed work that did not eliminate the fault
                  </h2>
                </div>
                <Activity className="h-5 w-5 text-red-400/70" />
              </div>

              {repeatFault ? (
                <div className="mt-5 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
                    <p className="font-mono text-lg font-semibold text-red-300">
                      {repeatFault.reference}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {repeatFault.count} completed work records
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-slate-600">Average MTTR</p>
                        <p className="mt-1 text-lg font-semibold text-slate-100">
                          {averageMttr.toFixed(1)}h
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-600">Weak outcomes</p>
                        <p className="mt-1 text-lg font-semibold text-red-300">
                          {completedWithIssues.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm leading-6 text-slate-300">
                      Vorta has detected repeated work against the same fault
                      reference. Temporary fixes and recurrences indicate that the
                      underlying failure mechanism may not yet be removed.
                    </p>
                    <div className="mt-3 space-y-2">
                      {repeatFault.records.slice(0, 3).map((workOrder) => (
                        <div
                          key={workOrder.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-gray-800 bg-[#0d1219] p-3"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-[11px] font-semibold text-blue-300">
                              {workOrder.id}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                              {workOrder.description}
                            </p>
                          </div>
                          <Badge
                            className={`h-auto shrink-0 rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${outcomeTone(
                              workOrder.outcome,
                            )}`}
                          >
                            {workOrder.outcome}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        askVorta(
                          `Investigate repeat fault ${repeatFault.reference} on ${equipment.name}. Compare the completed work orders, outcomes, parts, documents and likely root cause.`,
                        )
                      }
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
                    >
                      Investigate repeat failure
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <p className="mt-3 text-sm font-semibold text-emerald-200">
                    No repeat fault reference detected
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Completed work history does not currently contain repeated
                    structured fault references.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Recent execution evidence
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-100">
                    Latest completed work
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRegisterView("COMPLETED");
                    setFilter("ALL");
                    requestAnimationFrame(() => {
                      document
                        .getElementById("work-order-register")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    });
                  }}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                >
                  View all
                </button>
              </div>

              <div className="mt-4 divide-y divide-gray-800">
                {completedWorkOrders.slice(0, 5).map((workOrder) => (
                  <div key={workOrder.id} className="flex gap-3 py-3 first:pt-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-800/70 text-[10px] font-semibold text-slate-300">
                      {initials(workOrder.completedBy)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-mono text-[11px] font-semibold text-blue-300">
                          {workOrder.id}
                        </p>
                        <Badge
                          className={`h-auto shrink-0 rounded border px-2 py-0.5 text-[9px] font-semibold shadow-none ${outcomeTone(
                            workOrder.outcome,
                          )}`}
                        >
                          {workOrder.outcome || "Completed"}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-300">
                        {workOrder.description}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-600">
                        {workOrder.completedBy} · {formatDate(workOrder.completionDate)} · MTTR {workOrder.mttr}
                      </p>
                    </div>
                  </div>
                ))}

                {!loading && completedWorkOrders.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    No completed work history is linked to this equipment.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card
          id="work-order-register"
          className="scroll-mt-48 overflow-hidden rounded-2xl border border-gray-800 bg-[#141820] shadow-none"
        >
          <CardContent className="p-0">
            <div className="border-b border-gray-800 p-4 md:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    SAP work-order register
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-100">
                    Complete equipment work history
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Imported read-only from SAP PM and reconciled with Vorta risk
                    intelligence.
                  </p>
                </div>

                <div className="flex flex-col gap-2 lg:flex-row">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <input
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
                      placeholder="Search WO, issue, engineer or type"
                      className="h-9 w-full rounded-lg border border-gray-700 bg-[#0b0e14] pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500 sm:w-72"
                    />
                  </div>

                  <div className="flex overflow-x-auto rounded-lg border border-gray-700 bg-[#0b0e14] p-1">
                    {(["OPEN", "COMPLETED"] as RegisterView[]).map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => {
                          setRegisterView(view);
                          if (view === "COMPLETED") setFilter("ALL");
                        }}
                        className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          registerView === view
                            ? "bg-blue-600 text-white"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {view === "OPEN"
                          ? `Open ${openWorkOrders.length}`
                          : `Completed ${completedWorkOrders.length}`}
                      </button>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={exportWorkOrders}
                    className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800 hover:text-slate-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                </div>
              </div>

              {registerView === "OPEN" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(
                    [
                      ["ALL", "All"],
                      ["OVERDUE", "Overdue"],
                      ["WAITING PARTS", "Waiting parts"],
                      ["PREVENTIVE", "Preventive / PM"],
                      ["CORRECTIVE", "Corrective"],
                    ] as Array<[WorkFilter, string]>
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        filter === value
                          ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                          : "border-gray-700 bg-[#0d1219] text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {registerView === "OPEN" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-800 text-[10px] uppercase tracking-wide text-slate-600">
                      <th className="px-4 py-3 font-semibold">Work order</th>
                      <th className="px-4 py-3 font-semibold">Priority</th>
                      <th className="px-4 py-3 font-semibold">Work scope</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Engineer</th>
                      <th className="px-4 py-3 font-semibold">Requested</th>
                      <th className="px-4 py-3 font-semibold">Due</th>
                      <th className="px-4 py-3 font-semibold">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOpenWorkOrders.map((workOrder) => (
                      <tr
                        id={`work-order-${workOrder.id}`}
                        key={workOrder.id}
                        className={`border-b border-gray-800/70 transition-colors last:border-b-0 hover:bg-white/[0.015] ${
                          workOrder.id === selectedWorkOrder
                            ? "bg-blue-500/[0.08] ring-1 ring-inset ring-blue-500/30"
                            : ""
                        }`}
                      >
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void copyValue(workOrder.id, workOrder.id)
                              }
                              className="font-mono text-xs font-semibold text-blue-300 hover:text-blue-200"
                            >
                              {workOrder.id}
                            </button>
                            {copied === workOrder.id ? (
                              <Check className="h-3 w-3 text-emerald-300" />
                            ) : (
                              <Copy className="h-3 w-3 text-slate-600" />
                            )}
                          </div>
                          {workOrder.overdue ? (
                            <p className="mt-1 text-[10px] font-semibold text-red-300">
                              Overdue
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <Badge
                            className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${priorityClass(
                              workOrder.priority,
                            )}`}
                          >
                            {workOrder.priority}
                          </Badge>
                        </td>
                        <td className="max-w-md px-4 py-4 align-top">
                          <p className="text-xs font-medium leading-5 text-slate-200">
                            {workOrder.description}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-slate-400">
                          {workOrder.type}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <Badge
                            className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${statusClass(
                              workOrder.status,
                            )}`}
                          >
                            {workOrder.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-800/70 text-[9px] font-semibold text-slate-300">
                              {initials(workOrder.engineer)}
                            </div>
                            <span
                              className={`text-xs ${
                                workOrder.engineer === "—"
                                  ? "text-red-300"
                                  : "text-slate-300"
                              }`}
                            >
                              {workOrder.engineer === "—"
                                ? "Unassigned"
                                : workOrder.engineer}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-slate-500">
                          {formatDate(workOrder.requestedDate)}
                        </td>
                        <td
                          className={`px-4 py-4 align-top text-xs font-medium ${
                            workOrder.overdue
                              ? "text-red-300"
                              : "text-slate-400"
                          }`}
                        >
                          {formatDate(workOrder.dueDate)}
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-slate-500">
                          {workOrder.age}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!loading && filteredOpenWorkOrders.length === 0 ? (
                  <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
                    <Wrench className="h-7 w-7 text-slate-700" />
                    <p className="mt-3 text-sm font-medium text-slate-300">
                      No matching open work orders
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Adjust the search or work-order filter.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-800 text-[10px] uppercase tracking-wide text-slate-600">
                      <th className="px-4 py-3 font-semibold">Work order</th>
                      <th className="px-4 py-3 font-semibold">Completed work</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Completed by</th>
                      <th className="px-4 py-3 font-semibold">Completion date</th>
                      <th className="px-4 py-3 font-semibold">MTTR</th>
                      <th className="px-4 py-3 font-semibold">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompletedWorkOrders.map((workOrder) => (
                      <tr
                        key={workOrder.id}
                        className="border-b border-gray-800/70 transition-colors last:border-b-0 hover:bg-white/[0.015]"
                      >
                        <td className="px-4 py-4 align-top font-mono text-xs font-semibold text-blue-300">
                          {workOrder.id}
                        </td>
                        <td className="max-w-lg px-4 py-4 align-top text-xs leading-5 text-slate-200">
                          {workOrder.description}
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-slate-400">
                          {workOrder.type}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-800/70 text-[9px] font-semibold text-slate-300">
                              {initials(workOrder.completedBy)}
                            </div>
                            <span className="text-xs text-slate-300">
                              {workOrder.completedBy}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-slate-500">
                          {formatDate(workOrder.completionDate)}
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-slate-300">
                          {workOrder.mttr}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <Badge
                            className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${outcomeTone(
                              workOrder.outcome,
                            )}`}
                          >
                            {workOrder.outcome || "Completed"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!loading && filteredCompletedWorkOrders.length === 0 ? (
                  <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
                    <CheckCircle2 className="h-7 w-7 text-slate-700" />
                    <p className="mt-3 text-sm font-medium text-slate-300">
                      No matching completed work
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Adjust the search term to view other completion records.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 py-3 text-xs text-slate-500">
          <span>
            Data is synced read-only from SAP PM and Vorta risk services. Last
            refreshed {formatDateTime(lastUpdated)}.
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`/equipment/${equipment.id}/notifications`)}
              className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300"
            >
              <Bell className="h-3.5 w-3.5" />
              View notifications
            </button>
            <button
              type="button"
              onClick={() => navigate(`/equipment/${equipment.id}/spares`)}
              className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300"
            >
              <PackageSearch className="h-3.5 w-3.5" />
              View spares
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
