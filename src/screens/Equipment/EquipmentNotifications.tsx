import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  Check,
  ChevronRight,
  Copy,
  RefreshCw,
  Search,
  UserCircle,
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
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";
import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";

type NotificationWorkflowStatus =
  | "AWAITING_WORK_ORDER"
  | "CONVERTED"
  | "CLOSED_WITHOUT_WORK";

type NotificationFilter = "ALL" | NotificationWorkflowStatus;

interface EquipmentNotification {
  notificationId: string;
  notificationNumber: string;
  notificationTypeCode: string | null;
  notificationTypeDescription: string | null;
  shortText: string;
  longText: string | null;
  priorityCode: string | null;
  priorityDescription: string | null;
  sourceStatus: string;
  workflowStatus: NotificationWorkflowStatus;
  breakdownIndicator: boolean;
  reportedBy: string | null;
  requiredStartDate: string | null;
  requiredEndDate: string | null;
  reportedAt: string | null;
  ageDays: number;
  riskPoints: number;
  riskReason: string | null;
  linkedWorkOrderNumber: string | null;
  linkedWorkOrderStatus: string | null;
  linkedWorkOrderPriority: string | null;
  linkedWorkOrderDueDate: string | null;
  linkedWorkOrderOverdue: boolean;
  convertedAt: string | null;
}

interface NotificationSummary {
  totalNotifications: number;
  awaitingWorkOrder: number;
  convertedNotifications: number;
  highCriticalAwaiting: number;
  breakdownAwaiting: number;
  oldestAwaitingDays: number;
  notificationRiskScore: number;
}

const EMPTY_SUMMARY: NotificationSummary = {
  totalNotifications: 0,
  awaitingWorkOrder: 0,
  convertedNotifications: 0,
  highCriticalAwaiting: 0,
  breakdownAwaiting: 0,
  oldestAwaitingDays: 0,
  notificationRiskScore: 0,
};

const FILTERS: Array<{
  label: string;
  value: NotificationFilter;
}> = [
  { label: "All", value: "ALL" },
  { label: "Awaiting WO", value: "AWAITING_WORK_ORDER" },
  { label: "Converted", value: "CONVERTED" },
  { label: "Closed", value: "CLOSED_WITHOUT_WORK" },
];

function asRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (row): row is Record<string, unknown> =>
        typeof row === "object" && row !== null,
    );
  }

  if (typeof value === "object" && value !== null) {
    return [value as Record<string, unknown>];
  }

  return [];
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : null;
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function workflowStatus(value: unknown): NotificationWorkflowStatus {
  if (value === "CONVERTED" || value === "CLOSED_WITHOUT_WORK") {
    return value;
  }

  return "AWAITING_WORK_ORDER";
}

function mapNotification(
  row: Record<string, unknown>,
): EquipmentNotification {
  return {
    notificationId: stringValue(row.notification_id),
    notificationNumber: stringValue(row.notification_number),
    notificationTypeCode: nullableString(row.notification_type_code),
    notificationTypeDescription: nullableString(
      row.notification_type_description,
    ),
    shortText: stringValue(row.short_text, "Maintenance notification"),
    longText: nullableString(row.long_text),
    priorityCode: nullableString(row.priority_code),
    priorityDescription: nullableString(row.priority_description),
    sourceStatus: stringValue(row.source_status, "OPEN"),
    workflowStatus: workflowStatus(row.workflow_status),
    breakdownIndicator: row.breakdown_indicator === true,
    reportedBy: nullableString(row.reported_by),
    requiredStartDate: nullableString(row.required_start_date),
    requiredEndDate: nullableString(row.required_end_date),
    reportedAt: nullableString(row.reported_at),
    ageDays: numberValue(row.age_days),
    riskPoints: numberValue(row.risk_points),
    riskReason: nullableString(row.risk_reason),
    linkedWorkOrderNumber: nullableString(
      row.linked_work_order_number,
    ),
    linkedWorkOrderStatus: nullableString(row.linked_work_order_status),
    linkedWorkOrderPriority: nullableString(
      row.linked_work_order_priority,
    ),
    linkedWorkOrderDueDate: nullableString(
      row.linked_work_order_due_date,
    ),
    linkedWorkOrderOverdue: row.linked_work_order_overdue === true,
    convertedAt: nullableString(row.converted_at),
  };
}

function mapSummary(
  row: Record<string, unknown> | undefined,
): NotificationSummary {
  if (!row) return EMPTY_SUMMARY;

  return {
    totalNotifications: numberValue(row.total_notifications),
    awaitingWorkOrder: numberValue(row.awaiting_work_order),
    convertedNotifications: numberValue(row.converted_notifications),
    highCriticalAwaiting: numberValue(row.high_critical_awaiting),
    breakdownAwaiting: numberValue(row.breakdown_awaiting),
    oldestAwaitingDays: numberValue(row.oldest_awaiting_days),
    notificationRiskScore: numberValue(row.notification_risk_score),
  };
}

function summaryFromNotifications(
  notifications: EquipmentNotification[],
): NotificationSummary {
  const awaiting = notifications.filter(
    (notification) =>
      notification.workflowStatus === "AWAITING_WORK_ORDER",
  );

  return {
    totalNotifications: notifications.length,
    awaitingWorkOrder: awaiting.length,
    convertedNotifications: notifications.filter(
      (notification) => notification.workflowStatus === "CONVERTED",
    ).length,
    highCriticalAwaiting: awaiting.filter((notification) => {
      const priority = (
        notification.priorityDescription ??
        notification.priorityCode ??
        ""
      ).toUpperCase();
      return priority === "HIGH" || priority === "CRITICAL";
    }).length,
    breakdownAwaiting: awaiting.filter(
      (notification) => notification.breakdownIndicator,
    ).length,
    oldestAwaitingDays: awaiting.reduce(
      (oldest, notification) => Math.max(oldest, notification.ageDays),
      0,
    ),
    notificationRiskScore: Math.min(
      100,
      awaiting.reduce(
        (highest, notification) =>
          Math.max(highest, notification.riskPoints),
        0,
      ),
    ),
  };
}

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

function priorityClass(priority: string | null): string {
  switch (priority?.toUpperCase()) {
    case "CRITICAL":
      return "border-red-500/25 bg-red-500/10 text-red-300";
    case "HIGH":
      return "border-orange-500/25 bg-orange-500/10 text-orange-300";
    case "MEDIUM":
      return "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";
    default:
      return "border-slate-600 bg-slate-800/70 text-slate-300";
  }
}

function workflowClass(status: NotificationWorkflowStatus): string {
  switch (status) {
    case "AWAITING_WORK_ORDER":
      return "border-orange-500/25 bg-orange-500/10 text-orange-300";
    case "CONVERTED":
      return "border-blue-500/25 bg-blue-500/10 text-blue-300";
    default:
      return "border-slate-600 bg-slate-800/70 text-slate-300";
  }
}

function workflowLabel(status: NotificationWorkflowStatus): string {
  switch (status) {
    case "AWAITING_WORK_ORDER":
      return "Awaiting SAP work order";
    case "CONVERTED":
      return "Converted";
    default:
      return "Closed in SAP without work order";
  }
}

export const EquipmentNotifications = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const requestIdRef = useRef(0);

  const [equipment, setEquipment] = useState<EquipmentBase | null>(() =>
    getCachedEquipmentIdentity(resolvedId),
  );
  const [notifications, setNotifications] = useState<
    EquipmentNotification[]
  >([]);
  const [summary, setSummary] =
    useState<NotificationSummary>(EMPTY_SUMMARY);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NotificationFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summaryWarning, setSummaryWarning] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] =
    useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setErrorMessage(null);
    setSummaryWarning(null);

    const [notificationResult, summaryResult] = await Promise.all([
      supabase.rpc("vorta_get_equipment_notifications", {
        p_equipment_id: resolvedId,
      }),
      supabase.rpc("vorta_get_equipment_notification_summary", {
        p_equipment_id: resolvedId,
      }),
    ]);

    if (requestId !== requestIdRef.current) return;

    if (notificationResult.error) {
      console.warn(
        "Equipment notifications failed:",
        notificationResult.error,
      );
      setNotifications([]);
      setSummary(EMPTY_SUMMARY);
      setErrorMessage(
        notificationResult.error.message ||
          "Notifications could not be loaded.",
      );
      setLoading(false);
      return;
    }

    const mappedNotifications = asRows(notificationResult.data)
      .map(mapNotification)
      .sort((left, right) => {
        const leftAwaiting =
          left.workflowStatus === "AWAITING_WORK_ORDER" ? 1 : 0;
        const rightAwaiting =
          right.workflowStatus === "AWAITING_WORK_ORDER" ? 1 : 0;

        return (
          rightAwaiting - leftAwaiting ||
          right.riskPoints - left.riskPoints ||
          right.ageDays - left.ageDays
        );
      });

    setNotifications(mappedNotifications);

    if (summaryResult.error) {
      console.warn(
        "Equipment notification summary failed:",
        summaryResult.error,
      );
      setSummary(summaryFromNotifications(mappedNotifications));
      setSummaryWarning(
        "Summary RPC unavailable. Totals were calculated from the notification list.",
      );
    } else {
      const summaryRows = asRows(summaryResult.data);
      const mappedSummary = mapSummary(summaryRows[0]);
      setSummary(
        mappedSummary.totalNotifications === 0 &&
          mappedNotifications.length > 0
          ? summaryFromNotifications(mappedNotifications)
          : mappedSummary,
      );
    }

    setLoading(false);
  }, [resolvedId]);

  useEffect(() => {
    let active = true;

    setEquipment(getCachedEquipmentIdentity(resolvedId));
    void getEquipmentIdentityById(resolvedId).then((identity) => {
      if (active) setEquipment(identity);
    });

    return () => {
      active = false;
    };
  }, [resolvedId]);

  useEffect(() => {
    void loadNotifications();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadNotifications]);

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesFilter =
        filter === "ALL" || notification.workflowStatus === filter;

      if (!matchesFilter) return false;
      if (!query) return true;

      return [
        notification.notificationNumber,
        notification.notificationTypeCode,
        notification.notificationTypeDescription,
        notification.shortText,
        notification.longText,
        notification.priorityCode,
        notification.priorityDescription,
        notification.reportedBy,
        notification.linkedWorkOrderNumber,
        notification.linkedWorkOrderStatus,
        notification.linkedWorkOrderPriority,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [filter, notifications, search]);

  const copyNotificationNumber = useCallback(
    async (notificationNumber: string) => {
      try {
        await navigator.clipboard.writeText(notificationNumber);
        setCopiedNotification(notificationNumber);
        window.setTimeout(() => {
          setCopiedNotification((current) =>
            current === notificationNumber ? null : current,
          );
        }, 1600);
      } catch (error) {
        console.warn("Notification copy failed:", error);
      }
    },
    [],
  );

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

  const riskTotal =
    equipment.riskBreakdown.reduce(
      (sum, driver) => sum + driver.pct,
      0,
    ) || 1;

  const summaryCards = [
    {
      label: "Awaiting SAP work order",
      value: summary.awaitingWorkOrder,
      detail: `${summary.totalNotifications} total notifications`,
      valueClass: "text-orange-300",
    },
    {
      label: "High / critical awaiting",
      value: summary.highCriticalAwaiting,
      detail: "Require manager triage",
      valueClass:
        summary.highCriticalAwaiting > 0
          ? "text-red-300"
          : "text-emerald-300",
    },
    {
      label: "Breakdown awaiting",
      value: summary.breakdownAwaiting,
      detail: `${summary.convertedNotifications} already converted`,
      valueClass:
        summary.breakdownAwaiting > 0
          ? "text-red-300"
          : "text-emerald-300",
    },
    {
      label: "Oldest awaiting",
      value: `${summary.oldestAwaitingDays}d`,
      detail: `Notification risk ${summary.notificationRiskScore}/100`,
      valueClass:
        summary.oldestAwaitingDays > 7
          ? "text-red-300"
          : "text-slate-100",
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

        <EquipmentTabNavigation equipmentId={equipment.id} activeTab="notifications" />
      </div>

      <div className="space-y-5 px-4 pt-5 md:px-6">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <Card
              key={card.label}
              className="border-gray-800 bg-[#11151d]"
            >
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500">
                  {card.label}
                </p>
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
          ))}
        </div>

        <Card className="border-gray-800 bg-[#11151d]">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-gray-800 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-blue-400" />
                  <h2 className="text-sm font-semibold text-slate-100">
                    Maintenance notifications
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Notifications are reconciled read-only from imported SAP notifications and linked SAP work orders.
                </p>
              </div>

              <div className="flex flex-col gap-2 xl:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadNotifications()}
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
                    placeholder="Search notification, issue or WO"
                    aria-label="Search maintenance notifications"
                    className="h-9 w-full rounded-lg border border-gray-700 bg-[#0b0e14] pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500 sm:w-72"
                  />
                </div>

                <div className="flex overflow-x-auto rounded-lg border border-gray-700 bg-[#0b0e14] p-1">
                  {FILTERS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFilter(option.value)}
                      className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        filter === option.value
                          ? "bg-blue-600 text-white"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {summaryWarning ? (
              <div className="border-b border-amber-500/20 bg-amber-500/[0.04] px-4 py-2 text-xs text-amber-200/80">
                {summaryWarning}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="m-4 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-red-200">
                    Notifications could not be loaded
                  </p>
                  <p className="mt-1 break-words text-xs text-red-200/70">
                    {errorMessage}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadNotifications()}
                    className="mt-3 text-xs font-semibold text-red-300 hover:text-red-200"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-800 text-[11px] uppercase tracking-wide text-slate-600">
                      <th className="px-4 py-3 font-semibold">Notification</th>
                      <th className="px-4 py-3 font-semibold">Priority</th>
                      <th className="px-4 py-3 font-semibold">Issue</th>
                      <th className="px-4 py-3 font-semibold">Workflow</th>
                      <th className="px-4 py-3 font-semibold">Dates</th>
                      <th className="px-4 py-3 font-semibold">Risk</th>
                      <th className="px-4 py-3 font-semibold">
                        Linked work order
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading
                      ? Array.from({ length: 4 }).map((_, index) => (
                          <tr
                            key={index}
                            className="border-b border-gray-800/70"
                          >
                            <td colSpan={7} className="px-4 py-4">
                              <div className="h-12 animate-pulse rounded-lg bg-[#171c25]" />
                            </td>
                          </tr>
                        ))
                      : filteredNotifications.map((notification) => {
                          const priority =
                            notification.priorityDescription ??
                            notification.priorityCode ??
                            "Normal";

                          return (
                            <tr
                              key={
                                notification.notificationId ||
                                notification.notificationNumber
                              }
                              className="border-b border-gray-800/70 transition-colors last:border-b-0 hover:bg-white/[0.015]"
                            >
                              <td className="px-4 py-4 align-top">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-semibold text-blue-300">
                                    {notification.notificationNumber || "—"}
                                  </p>
                                  {notification.notificationNumber ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void copyNotificationNumber(
                                          notification.notificationNumber,
                                        )
                                      }
                                      className="rounded-md border border-gray-700 p-1 text-slate-500 transition-colors hover:border-blue-500/50 hover:text-blue-300"
                                      aria-label={`Copy SAP notification ${notification.notificationNumber}`}
                                      title="Copy SAP notification number"
                                    >
                                      {copiedNotification ===
                                      notification.notificationNumber ? (
                                        <Check className="h-3 w-3 text-emerald-300" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </button>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-[11px] text-slate-600">
                                  {notification.notificationTypeDescription ??
                                    notification.notificationTypeCode ??
                                    "Maintenance notification"}
                                </p>
                              </td>

                              <td className="px-4 py-4 align-top">
                                <span
                                  className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${priorityClass(
                                    priority,
                                  )}`}
                                >
                                  {priority}
                                </span>
                                {notification.breakdownIndicator ? (
                                  <p className="mt-2 text-[11px] font-medium text-red-400">
                                    Breakdown
                                  </p>
                                ) : null}
                              </td>

                              <td className="max-w-md px-4 py-4 align-top">
                                <p className="text-xs font-medium leading-5 text-slate-200">
                                  {notification.shortText}
                                </p>
                                {notification.longText ? (
                                  <p className="mt-1 max-w-md text-[11px] leading-4 text-slate-500">
                                    {notification.longText}
                                  </p>
                                ) : null}
                                {notification.reportedBy ? (
                                  <p className="mt-1 text-[11px] text-slate-600">
                                    Reported by {notification.reportedBy}
                                  </p>
                                ) : null}
                              </td>

                              <td className="px-4 py-4 align-top">
                                <span
                                  className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${workflowClass(
                                    notification.workflowStatus,
                                  )}`}
                                >
                                  {workflowLabel(notification.workflowStatus)}
                                </span>
                                <p className="mt-2 text-[11px] text-slate-600">
                                  SAP status: {notification.sourceStatus}
                                </p>
                              </td>

                              <td className="px-4 py-4 align-top text-[11px] leading-5 text-slate-500">
                                <p>
                                  Reported {formatDate(notification.reportedAt)}
                                </p>
                                <p>
                                  Required {formatDate(notification.requiredStartDate)}
                                </p>
                                <p className="font-medium text-slate-300">
                                  Age {notification.ageDays}d
                                </p>
                              </td>

                              <td className="px-4 py-4 align-top">
                                <p
                                  className={`text-sm font-semibold ${
                                    notification.riskPoints >= 50
                                      ? "text-red-300"
                                      : notification.riskPoints > 0
                                        ? "text-orange-300"
                                        : "text-slate-500"
                                  }`}
                                >
                                  {notification.riskPoints}
                                </p>
                                <p className="mt-1 max-w-[190px] text-[11px] leading-4 text-slate-600">
                                  {notification.riskReason ??
                                    "No active notification risk."}
                                </p>
                              </td>

                              <td className="px-4 py-4 align-top">
                                {notification.linkedWorkOrderNumber ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate(
                                        `/equipment/${equipment.id}/work-orders?workOrder=${encodeURIComponent(
                                          notification.linkedWorkOrderNumber,
                                        )}#open-work-orders`,
                                      )
                                    }
                                    className="text-xs font-semibold text-blue-300 hover:text-blue-200"
                                  >
                                    {notification.linkedWorkOrderNumber}
                                  </button>
                                ) : (
                                  <span className="text-xs font-medium text-orange-300">
                                    {notification.workflowStatus === "CLOSED_WITHOUT_WORK"
                                      ? "Closed in SAP without work order"
                                      : "Awaiting SAP work order"}
                                  </span>
                                )}
                                {notification.linkedWorkOrderStatus ? (
                                  <p className="mt-1 text-[11px] text-slate-600">
                                    Status {notification.linkedWorkOrderStatus}
                                  </p>
                                ) : null}
                                {notification.linkedWorkOrderPriority ? (
                                  <p className="text-[11px] text-slate-600">
                                    Priority {notification.linkedWorkOrderPriority}
                                  </p>
                                ) : null}
                                {notification.linkedWorkOrderDueDate ? (
                                  <p
                                    className={`text-[11px] ${
                                      notification.linkedWorkOrderOverdue
                                        ? "font-medium text-red-300"
                                        : "text-slate-600"
                                    }`}
                                  >
                                    {notification.linkedWorkOrderOverdue
                                      ? "Overdue · "
                                      : ""}
                                    Due{" "}
                                    {formatDate(
                                      notification.linkedWorkOrderDueDate,
                                    )}
                                  </p>
                                ) : notification.linkedWorkOrderOverdue ? (
                                  <p className="text-[11px] font-medium text-red-300">
                                    Overdue
                                  </p>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>

                {!loading && filteredNotifications.length === 0 ? (
                  <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
                    <Bell className="h-7 w-7 text-slate-700" />
                    <p className="mt-3 text-sm font-medium text-slate-300">
                      {notifications.length === 0
                        ? "No notifications for this equipment"
                        : "No matching notifications"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {notifications.length === 0
                        ? "The notification RPC returned no records."
                        : "Adjust the search or workflow filter."}
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
