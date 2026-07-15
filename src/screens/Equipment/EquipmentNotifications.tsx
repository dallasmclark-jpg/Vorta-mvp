import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  Download,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
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
import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";

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
        (total, notification) => total + notification.riskPoints,
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

function formatDateTime(value: Date | null): string {
  if (!value) return "Loading latest SAP import";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
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
      return "Converted to work order";
    default:
      return "Closed in SAP without work order";
  }
}

function riskTone(level: string): string {
  switch (level.toLowerCase()) {
    case "critical":
      return "border-red-500/25 bg-red-500/10 text-red-300";
    case "high":
      return "border-orange-500/25 bg-orange-500/10 text-orange-300";
    case "medium":
      return "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";
    case "low":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-slate-600 bg-slate-800/70 text-slate-300";
  }
}

function isRequiredStartOverdue(notification: EquipmentNotification): boolean {
  if (
    notification.workflowStatus !== "AWAITING_WORK_ORDER" ||
    !notification.requiredStartDate
  ) {
    return false;
  }

  const requiredStart = new Date(notification.requiredStartDate);
  if (Number.isNaN(requiredStart.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  requiredStart.setHours(0, 0, 0, 0);

  return requiredStart < today;
}

function Metric({
  label,
  value,
  detail,
  tone = "text-slate-50",
}: {
  label: string;
  value: ReactNode;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-800 bg-[#0c1118]/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
        {label}
      </p>
      <p className={`mt-1 truncate text-xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400/80">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-50">{title}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
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
  const [copied, setCopied] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

    setLastUpdated(new Date());
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

  const awaitingNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          notification.workflowStatus === "AWAITING_WORK_ORDER",
      ),
    [notifications],
  );

  const convertedNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) => notification.workflowStatus === "CONVERTED",
      ),
    [notifications],
  );

  const closedWithoutWork = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          notification.workflowStatus === "CLOSED_WITHOUT_WORK",
      ),
    [notifications],
  );

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

  const overdueAwaiting = useMemo(
    () => awaitingNotifications.filter(isRequiredStartOverdue),
    [awaitingNotifications],
  );

  const ageBands = useMemo(
    () => [
      {
        label: "0–3 days",
        count: awaitingNotifications.filter(
          (notification) => notification.ageDays <= 3,
        ).length,
        tone: "bg-emerald-500",
      },
      {
        label: "4–7 days",
        count: awaitingNotifications.filter(
          (notification) =>
            notification.ageDays >= 4 && notification.ageDays <= 7,
        ).length,
        tone: "bg-yellow-500",
      },
      {
        label: "8+ days",
        count: awaitingNotifications.filter(
          (notification) => notification.ageDays >= 8,
        ).length,
        tone: "bg-red-500",
      },
    ],
    [awaitingNotifications],
  );

  const notificationTypes = useMemo(() => {
    const groups = new Map<string, number>();

    for (const notification of notifications) {
      const label =
        notification.notificationTypeDescription ??
        notification.notificationTypeCode ??
        "Maintenance notification";
      groups.set(label, (groups.get(label) ?? 0) + 1);
    }

    return Array.from(groups.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count);
  }, [notifications]);

  const evidenceCompleteness = useMemo(() => {
    if (notifications.length === 0) return 100;

    const completeFields = notifications.reduce((total, notification) => {
      return (
        total +
        Number(Boolean(notification.longText)) +
        Number(Boolean(notification.reportedBy)) +
        Number(Boolean(notification.requiredStartDate)) +
        Number(
          Boolean(
            notification.notificationTypeCode ||
              notification.notificationTypeDescription,
          ),
        )
      );
    }, 0);

    return Math.round((completeFields / (notifications.length * 4)) * 100);
  }, [notifications]);

  const highestExposure = awaitingNotifications[0] ?? null;
  const conversionRate =
    notifications.length > 0
      ? Math.round(
          (convertedNotifications.length / notifications.length) * 100,
        )
      : 0;
  const averageAwaitingAge =
    awaitingNotifications.length > 0
      ? Math.round(
          awaitingNotifications.reduce(
            (total, notification) => total + notification.ageDays,
            0,
          ) / awaitingNotifications.length,
        )
      : 0;
  const notificationRiskAfterTopConversion = Math.max(
    0,
    summary.notificationRiskScore - (highestExposure?.riskPoints ?? 0),
  );

  const briefing = highestExposure
    ? `${equipment?.name ?? "This equipment"} has ${
        awaitingNotifications.length
      } SAP maintenance notification${
        awaitingNotifications.length === 1 ? "" : "s"
      } awaiting work-order conversion. ${
        highestExposure.notificationNumber
      } creates the highest current workflow exposure at ${
        highestExposure.riskPoints
      } points because it is ${
        (
          highestExposure.priorityDescription ??
          highestExposure.priorityCode ??
          "normal"
        ).toLowerCase()
      }, is ${highestExposure.ageDays} days old${
        highestExposure.breakdownIndicator ? " and is marked as a breakdown" : ""
      }.`
    : `${equipment?.name ?? "This equipment"} has no SAP maintenance notifications awaiting work-order conversion. Vorta is continuing to reconcile imported notifications against linked SAP work orders.`;

  const copyValue = useCallback(async (value: string, key: string) => {
    if (!navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => {
        setCopied((current) => (current === key ? null : current));
      }, 1600);
    } catch (error) {
      console.warn("Copy failed:", error);
    }
  }, []);

  const askVorta = useCallback(
    (prompt?: string) => {
      if (!equipment) return;

      const resolvedPrompt =
        prompt ??
        question.trim() ??
        `Explain the maintenance notification risk for ${equipment.name}.`;

      navigate(
        `/equipment/${equipment.id}/ai-insights?prompt=${encodeURIComponent(
          resolvedPrompt ||
            `Explain the maintenance notification risk for ${equipment.name}.`,
        )}`,
      );
    },
    [equipment, navigate, question],
  );

  const exportNotifications = useCallback(() => {
    if (!equipment) return;

    const rows = [
      [
        "Notification",
        "Type",
        "Priority",
        "Issue",
        "Workflow Status",
        "SAP Status",
        "Reported By",
        "Reported Date",
        "Required Start",
        "Age Days",
        "Risk Points",
        "Risk Reason",
        "Linked Work Order",
        "Work Order Status",
        "Work Order Due",
      ],
      ...notifications.map((notification) => [
        notification.notificationNumber,
        notification.notificationTypeDescription ??
          notification.notificationTypeCode ??
          "",
        notification.priorityDescription ??
          notification.priorityCode ??
          "",
        notification.shortText,
        workflowLabel(notification.workflowStatus),
        notification.sourceStatus,
        notification.reportedBy ?? "",
        formatDate(notification.reportedAt),
        formatDate(notification.requiredStartDate),
        String(notification.ageDays),
        String(notification.riskPoints),
        notification.riskReason ?? "",
        notification.linkedWorkOrderNumber ?? "",
        notification.linkedWorkOrderStatus ?? "",
        formatDate(notification.linkedWorkOrderDueDate),
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
    anchor.download = `${equipment.assetNumber}-notification-intelligence.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [equipment, notifications]);

  if (!equipment) {
    return (
      <section className="flex w-full flex-col overflow-x-hidden pb-10">
        <div className="border-b border-gray-800 bg-[#0b0e14] px-4 py-4 md:px-6">
          <div className="h-40 animate-pulse rounded-xl bg-[#141820]" />
        </div>
      </section>
    );
  }

  const riskBadgeClass = riskTone(equipment.riskLevel);
  const riskTotal =
    equipment.riskBreakdown.reduce(
      (sum, driver) => sum + driver.pct,
      0,
    ) || 1;

  return (
    <section className="flex w-full flex-col overflow-x-hidden pb-10">
      {errorMessage ? (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4 md:mx-6">
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
              onClick={() =>
                void copyValue(equipment.assetNumber, "asset-reference")
              }
              className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs text-slate-300 hover:bg-gray-800 hover:text-slate-100"
            >
              {copied === "asset-reference" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied === "asset-reference" ? "Copied" : "Copy asset ref"}
            </Button>

            <button
              type="button"
              onClick={() => void loadNotifications()}
              disabled={loading}
              aria-label="Refresh notification intelligence"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
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
          activeTab="notifications"
        />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">
        {summaryWarning ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3 text-xs text-amber-200/80">
            {summaryWarning}
          </div>
        ) : null}

        <Card className="overflow-hidden rounded-2xl border border-blue-500/25 bg-[linear-gradient(135deg,#131923_0%,#10151d_55%,#101722_100%)] shadow-none">
          <CardContent className="p-0">
            <div className="grid xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.55fr)]">
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="h-auto rounded bg-blue-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300 shadow-none">
                    SAP notification intelligence
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Database className="h-3.5 w-3.5" />
                    Notifications · linked work orders · {formatDateTime(lastUpdated)}
                  </span>
                </div>

                <h2 className="mt-4 text-xl font-semibold text-slate-50">
                  Notification Risk Briefing
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                  {briefing}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    label="Awaiting SAP work order"
                    value={summary.awaitingWorkOrder}
                    detail={`${summary.totalNotifications} total imported notifications`}
                    tone="text-orange-300"
                  />
                  <Metric
                    label="High / critical awaiting"
                    value={summary.highCriticalAwaiting}
                    detail={`${summary.breakdownAwaiting} breakdown notification${
                      summary.breakdownAwaiting === 1 ? "" : "s"
                    } awaiting`}
                    tone={
                      summary.highCriticalAwaiting > 0
                        ? "text-red-300"
                        : "text-emerald-300"
                    }
                  />
                  <Metric
                    label="Notification risk"
                    value={`${summary.notificationRiskScore}/100`}
                    detail="Unconverted workflow exposure only"
                    tone={
                      summary.notificationRiskScore >= 70
                        ? "text-red-300"
                        : summary.notificationRiskScore > 0
                          ? "text-orange-300"
                          : "text-emerald-300"
                    }
                  />
                  <Metric
                    label="Oldest awaiting"
                    value={`${summary.oldestAwaitingDays}d`}
                    detail={`${overdueAwaiting.length} required-start date${
                      overdueAwaiting.length === 1 ? "" : "s"
                    } overdue`}
                    tone={
                      summary.oldestAwaitingDays >= 8
                        ? "text-red-300"
                        : "text-slate-50"
                    }
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
                      placeholder={`Ask Vorta about ${equipment.assetNumber} notifications...`}
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
                  Highest current exposure
                </p>

                {highestExposure ? (
                  <div className="mt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${priorityClass(
                          highestExposure.priorityDescription ??
                            highestExposure.priorityCode,
                        )}`}
                      >
                        {highestExposure.priorityDescription ??
                          highestExposure.priorityCode ??
                          "Normal"}
                      </Badge>
                      {highestExposure.breakdownIndicator ? (
                        <Badge className="h-auto rounded border border-red-500/25 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300 shadow-none">
                          Breakdown
                        </Badge>
                      ) : null}
                    </div>

                    <p className="mt-3 text-sm font-semibold leading-5 text-slate-100">
                      {highestExposure.shortText}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {highestExposure.riskReason ??
                        "Awaiting SAP work-order conversion."}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Metric
                        label="Risk points"
                        value={highestExposure.riskPoints}
                        detail={highestExposure.notificationNumber}
                        tone="text-red-300"
                      />
                      <Metric
                        label="After conversion"
                        value={`${notificationRiskAfterTopConversion}/100`}
                        detail="Notification-specific risk"
                        tone="text-emerald-300"
                      />
                    </div>

                    <div className="mt-4 rounded-xl border border-orange-500/20 bg-orange-500/[0.05] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-300/80">
                        Source-of-truth action
                      </p>
                      <p className="mt-1 text-xs leading-5 text-orange-100/80">
                        Review and convert the notification in SAP. Vorta removes
                        only the unconverted-notification exposure; the linked
                        work-order risk remains until the work is completed.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        askVorta(
                          `Explain ${highestExposure.notificationNumber}: ${highestExposure.shortText}. Include the risk evidence, linked history and recommended next investigation.`,
                        )
                      }
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
                    >
                      Analyse this notification
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <p className="mt-3 text-sm font-semibold text-emerald-200">
                      No unconverted notification exposure
                    </p>
                    <p className="mt-1 text-xs leading-5 text-emerald-100/60">
                      Imported SAP notifications are either linked to work
                      orders or closed in the source system.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-orange-500/25 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <SectionHeading
              eyebrow="Risk reduction queue"
              title="Unconverted notifications requiring attention"
              description="Vorta ranks imported SAP notifications by active risk, priority, breakdown status, required dates and age. This queue is read-only and clears automatically when SAP links a work order."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFilter("AWAITING_WORK_ORDER");
                    document
                      .getElementById("notification-register")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="h-9 border-orange-500/30 bg-orange-500/10 text-xs text-orange-200 hover:bg-orange-500/15"
                >
                  View awaiting register
                </Button>
              }
            />

            <div className="mt-5 overflow-hidden rounded-xl border border-gray-800">
              <div className="hidden grid-cols-[54px_120px_minmax(260px,1.6fr)_120px_120px_100px_42px] gap-3 border-b border-gray-800 bg-[#0d1219] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 lg:grid">
                <span>Rank</span>
                <span>Notification</span>
                <span>Issue</span>
                <span>Priority</span>
                <span>Required</span>
                <span>Risk</span>
                <span />
              </div>

              {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="border-b border-gray-800 p-4 last:border-0"
                  >
                    <div className="h-14 animate-pulse rounded-lg bg-[#171c25]" />
                  </div>
                ))
              ) : awaitingNotifications.length > 0 ? (
                awaitingNotifications.slice(0, 3).map((notification, index) => {
                  const priority =
                    notification.priorityDescription ??
                    notification.priorityCode ??
                    "Normal";
                  const overdue = isRequiredStartOverdue(notification);

                  return (
                    <div
                      key={
                        notification.notificationId ||
                        notification.notificationNumber
                      }
                      className="grid gap-3 border-b border-gray-800 px-4 py-4 last:border-0 lg:grid-cols-[54px_120px_minmax(260px,1.6fr)_120px_120px_100px_42px] lg:items-center"
                    >
                      <div>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/10 text-xs font-semibold text-orange-300">
                          {index + 1}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-blue-300">
                          {notification.notificationNumber}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-600">
                          {notification.notificationTypeCode ??
                            "SAP notification"}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-5 text-slate-200">
                          {notification.shortText}
                        </p>
                        <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">
                          {notification.riskReason ??
                            "Awaiting SAP work-order conversion."}
                        </p>
                      </div>

                      <div>
                        <Badge
                          className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${priorityClass(
                            priority,
                          )}`}
                        >
                          {priority}
                        </Badge>
                        {notification.breakdownIndicator ? (
                          <p className="mt-1 text-[10px] font-medium text-red-400">
                            Breakdown
                          </p>
                        ) : null}
                      </div>

                      <div className="text-[11px] leading-5">
                        <p
                          className={
                            overdue ? "font-medium text-red-300" : "text-slate-300"
                          }
                        >
                          {formatDate(notification.requiredStartDate)}
                        </p>
                        <p className="text-slate-600">
                          Age {notification.ageDays}d
                        </p>
                      </div>

                      <div>
                        <p
                          className={`text-lg font-semibold ${
                            notification.riskPoints >= 50
                              ? "text-red-300"
                              : "text-orange-300"
                          }`}
                        >
                          {notification.riskPoints}
                        </p>
                        <p className="text-[10px] text-slate-600">points</p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          askVorta(
                            `Explain ${notification.notificationNumber}: ${notification.shortText}. What evidence supports the risk score and what should the maintenance manager investigate next?`,
                          )
                        }
                        aria-label={`Analyse ${notification.notificationNumber}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 text-slate-500 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="flex min-h-36 flex-col items-center justify-center px-6 text-center">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500/70" />
                  <p className="mt-3 text-sm font-medium text-slate-300">
                    No notifications awaiting work-order conversion
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    The active notification queue is clear.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-blue-500/15 bg-blue-500/[0.035] px-3 py-2.5">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
              <p className="text-[11px] leading-5 text-slate-500">
                Conversion transfers the risk into the SAP work-order workflow;
                it does not imply the underlying defect has been removed.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <SectionHeading
                eyebrow="Workflow reconciliation"
                title="Notification conversion flow"
                description="Imported SAP notifications are reconciled against linked SAP work orders so Vorta does not double-count the same maintenance exposure."
              />

              <div className="mt-5 grid grid-cols-3 gap-3">
                <Metric
                  label="Awaiting"
                  value={awaitingNotifications.length}
                  detail="No linked work order"
                  tone="text-orange-300"
                />
                <Metric
                  label="Converted"
                  value={convertedNotifications.length}
                  detail="Risk transferred to WO"
                  tone="text-blue-300"
                />
                <Metric
                  label="Closed"
                  value={closedWithoutWork.length}
                  detail="No work order linked"
                  tone="text-slate-300"
                />
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Conversion rate</span>
                  <span className="font-semibold text-slate-100">
                    {conversionRate}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full rounded-full bg-blue-500/80"
                    style={{ width: `${conversionRate}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                {convertedNotifications.slice(0, 3).map((notification) => (
                  <div
                    key={
                      notification.notificationId ||
                      notification.notificationNumber
                    }
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#0d1219] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-blue-300">
                          {notification.notificationNumber}
                        </p>
                        <ArrowRight className="h-3 w-3 text-slate-700" />
                        <button
                          type="button"
                          onClick={() =>
                            notification.linkedWorkOrderNumber
                              ? navigate(
                                  `/equipment/${equipment.id}/work-orders?workOrder=${encodeURIComponent(
                                    notification.linkedWorkOrderNumber,
                                  )}#open-work-orders`,
                                )
                              : undefined
                          }
                          className="text-xs font-semibold text-blue-300 hover:text-blue-200 disabled:text-slate-600"
                          disabled={!notification.linkedWorkOrderNumber}
                        >
                          {notification.linkedWorkOrderNumber ?? "Linked work order"}
                        </button>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-slate-500">
                        {notification.shortText}
                      </p>
                    </div>
                    <Badge className="h-auto rounded border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] text-blue-300 shadow-none">
                      {notification.linkedWorkOrderStatus ?? "Converted"}
                    </Badge>
                  </div>
                ))}

                {!loading && convertedNotifications.length === 0 ? (
                  <p className="rounded-xl border border-gray-800 bg-[#0d1219] p-4 text-xs text-slate-500">
                    No converted notifications are currently linked to work
                    orders for this equipment.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <SectionHeading
                eyebrow="Ageing and evidence"
                title="Notification control quality"
                description="Ageing exposes stalled triage while evidence completeness indicates whether engineers have enough context to investigate efficiently."
              />

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric
                  label="Average awaiting age"
                  value={`${averageAwaitingAge}d`}
                  detail={`${overdueAwaiting.length} past required start`}
                  tone={
                    averageAwaitingAge >= 8
                      ? "text-red-300"
                      : "text-slate-50"
                  }
                />
                <Metric
                  label="Evidence completeness"
                  value={`${evidenceCompleteness}%`}
                  detail="Text, reporter, dates and type"
                  tone={
                    evidenceCompleteness >= 90
                      ? "text-emerald-300"
                      : "text-yellow-300"
                  }
                />
              </div>

              <div className="mt-5 space-y-3">
                {ageBands.map((band) => {
                  const percentage =
                    awaitingNotifications.length > 0
                      ? Math.round(
                          (band.count / awaitingNotifications.length) * 100,
                        )
                      : 0;

                  return (
                    <div key={band.label}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{band.label}</span>
                        <span className="font-semibold text-slate-200">
                          {band.count}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-800">
                        <div
                          className={`h-full rounded-full ${band.tone}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-gray-800 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Notification mix
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {notificationTypes.map((type) => (
                    <span
                      key={type.label}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-[#0d1219] px-2.5 py-1.5 text-[11px] text-slate-400"
                    >
                      {type.label}
                      <span className="font-semibold text-slate-200">
                        {type.count}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card
          id="notification-register"
          className="scroll-mt-44 rounded-2xl border border-gray-800 bg-[#141820] shadow-none"
        >
          <CardContent className="p-0">
            <div className="border-b border-gray-800 p-5">
              <SectionHeading
                eyebrow="Source register"
                title="SAP maintenance notifications"
                description="Search and reconcile every imported notification against its SAP workflow state and linked work order."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={exportNotifications}
                    disabled={notifications.length === 0}
                    className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800 hover:text-slate-100 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                }
              />

              <div className="mt-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search notification, issue, reporter or linked work order"
                    aria-label="Search maintenance notifications"
                    className="h-10 w-full rounded-xl border border-gray-700 bg-[#0b0e14] pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500"
                  />
                </div>

                <div className="flex overflow-x-auto rounded-xl border border-gray-700 bg-[#0b0e14] p-1">
                  {FILTERS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFilter(option.value)}
                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
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

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-800 text-[10px] uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3 font-semibold">Notification</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Issue and evidence</th>
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
                            <div className="h-14 animate-pulse rounded-lg bg-[#171c25]" />
                          </td>
                        </tr>
                      ))
                    : filteredNotifications.map((notification) => {
                        const priority =
                          notification.priorityDescription ??
                          notification.priorityCode ??
                          "Normal";
                        const overdue =
                          isRequiredStartOverdue(notification);

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
                                      void copyValue(
                                        notification.notificationNumber,
                                        `notification-${notification.notificationNumber}`,
                                      )
                                    }
                                    className="rounded-md border border-gray-700 p-1 text-slate-500 transition-colors hover:border-blue-500/50 hover:text-blue-300"
                                    aria-label={`Copy SAP notification ${notification.notificationNumber}`}
                                    title="Copy SAP notification number"
                                  >
                                    {copied ===
                                    `notification-${notification.notificationNumber}` ? (
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
                              <Badge
                                className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${priorityClass(
                                  priority,
                                )}`}
                              >
                                {priority}
                              </Badge>
                              {notification.breakdownIndicator ? (
                                <p className="mt-2 text-[11px] font-medium text-red-400">
                                  Breakdown
                                </p>
                              ) : null}
                            </td>

                            <td className="max-w-lg px-4 py-4 align-top">
                              <p className="text-xs font-medium leading-5 text-slate-200">
                                {notification.shortText}
                              </p>
                              {notification.longText ? (
                                <p className="mt-1 max-w-lg text-[11px] leading-4 text-slate-500">
                                  {notification.longText}
                                </p>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-600">
                                {notification.reportedBy ? (
                                  <span>Reported by {notification.reportedBy}</span>
                                ) : null}
                                <span>SAP status {notification.sourceStatus}</span>
                              </div>
                            </td>

                            <td className="px-4 py-4 align-top">
                              <Badge
                                className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${workflowClass(
                                  notification.workflowStatus,
                                )}`}
                              >
                                {workflowLabel(notification.workflowStatus)}
                              </Badge>
                              {notification.convertedAt ? (
                                <p className="mt-2 text-[11px] text-slate-600">
                                  Converted {formatDate(notification.convertedAt)}
                                </p>
                              ) : null}
                            </td>

                            <td className="px-4 py-4 align-top text-[11px] leading-5">
                              <p className="text-slate-500">
                                Reported {formatDate(notification.reportedAt)}
                              </p>
                              <p
                                className={
                                  overdue
                                    ? "font-medium text-red-300"
                                    : "text-slate-500"
                                }
                              >
                                Required{" "}
                                {formatDate(notification.requiredStartDate)}
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
                                  "No active notification-specific risk."}
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
                                <span
                                  className={`text-xs font-medium ${
                                    notification.workflowStatus ===
                                    "AWAITING_WORK_ORDER"
                                      ? "text-orange-300"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {notification.workflowStatus ===
                                  "CLOSED_WITHOUT_WORK"
                                    ? "Closed without work order"
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
                                  Priority{" "}
                                  {notification.linkedWorkOrderPriority}
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
                      ? "The SAP notification feed returned no records."
                      : "Adjust the search or workflow filter."}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-800 px-4 py-3 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {filteredNotifications.length} of {notifications.length} notifications
              </span>
              <span>
                Read-only reconciliation · last refreshed {formatDateTime(lastUpdated)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
