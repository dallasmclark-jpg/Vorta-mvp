import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  AlertCircle,
  Bell,
  ChevronRight,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
} from "../../components/ui/card";
import { supabase } from "../../lib/supabaseClient";
import {
  DEFAULT_EQUIPMENT_ID,
  EquipmentBase,
} from "./equipmentData";
import {
  getCachedEquipmentIdentity,
  getEquipmentIdentityById,
} from "./equipmentService";

type NotificationWorkflowStatus =
  | "AWAITING_WORK_ORDER"
  | "CONVERTED"
  | "CLOSED_WITHOUT_WORK";

type NotificationFilter =
  | "ALL"
  | "AWAITING_WORK_ORDER"
  | "CONVERTED";

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

const TABS = [
  { label: "Overview", id: "overview" },
  { label: "Health", id: "health" },
  { label: "Notifications", id: "notifications" },
  { label: "Work Orders", id: "work-orders" },
  { label: "PMs", id: "pms" },
  { label: "History", id: "history" },
  { label: "Skills & Engineers", id: "skills" },
  { label: "Spares", id: "spares" },
  { label: "Documents", id: "documents" },
  { label: "AI Insights", id: "ai-insights" },
] as const;

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function priorityClass(priority: string | null): string {
  const value = priority?.toUpperCase();

  if (value === "CRITICAL") {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }

  if (value === "HIGH") {
    return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  }

  if (value === "MEDIUM") {
    return "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";
  }

  return "border-slate-600 bg-slate-800/70 text-slate-300";
}

function workflowClass(
  status: NotificationWorkflowStatus,
): string {
  if (status === "AWAITING_WORK_ORDER") {
    return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  }

  if (status === "CONVERTED") {
    return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  }

  return "border-slate-600 bg-slate-800/70 text-slate-300";
}

function workflowLabel(
  status: NotificationWorkflowStatus,
): string {
  if (status === "AWAITING_WORK_ORDER") {
    return "Awaiting work order";
  }

  if (status === "CONVERTED") {
    return "Converted";
  }

  return "Closed without work";
}

function mapNotification(row: any): EquipmentNotification {
  const workflowStatus =
    row.workflow_status === "CONVERTED" ||
    row.workflow_status === "CLOSED_WITHOUT_WORK"
      ? row.workflow_status
      : "AWAITING_WORK_ORDER";

  return {
    notificationId: String(row.notification_id ?? ""),
    notificationNumber: String(
      row.notification_number ?? "",
    ),
    notificationTypeCode:
      row.notification_type_code ?? null,
    notificationTypeDescription:
      row.notification_type_description ?? null,
    shortText: String(row.short_text ?? ""),
    longText: row.long_text ?? null,
    priorityCode: row.priority_code ?? null,
    priorityDescription:
      row.priority_description ?? null,
    sourceStatus: String(row.source_status ?? "OPEN"),
    workflowStatus,
    breakdownIndicator:
      row.breakdown_indicator ?? false,
    reportedBy: row.reported_by ?? null,
    requiredStartDate:
      row.required_start_date ?? null,
    requiredEndDate:
      row.required_end_date ?? null,
    reportedAt: row.reported_at ?? null,
    ageDays: Number(row.age_days ?? 0),
    riskPoints: Number(row.risk_points ?? 0),
    riskReason: row.risk_reason ?? null,
    linkedWorkOrderNumber:
      row.linked_work_order_number ?? null,
    linkedWorkOrderStatus:
      row.linked_work_order_status ?? null,
    convertedAt: row.converted_at ?? null,
  };
}

function mapSummary(row: any): NotificationSummary {
  if (!row) return EMPTY_SUMMARY;

  return {
    totalNotifications: Number(
      row.total_notifications ?? 0,
    ),
    awaitingWorkOrder: Number(
      row.awaiting_work_order ?? 0,
    ),
    convertedNotifications: Number(
      row.converted_notifications ?? 0,
    ),
    highCriticalAwaiting: Number(
      row.high_critical_awaiting ?? 0,
    ),
    breakdownAwaiting: Number(
      row.breakdown_awaiting ?? 0,
    ),
    oldestAwaitingDays: Number(
      row.oldest_awaiting_days ?? 0,
    ),
    notificationRiskScore: Number(
      row.notification_risk_score ?? 0,
    ),
  };
}

export const EquipmentNotifications = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{
    equipmentId?: string;
  }>();

  const resolvedId =
    equipmentId ?? DEFAULT_EQUIPMENT_ID;

  const [equipment, setEquipment] =
    useState<EquipmentBase | null>(() =>
      getCachedEquipmentIdentity(resolvedId),
    );

  const [notifications, setNotifications] =
    useState<EquipmentNotification[]>([]);

  const [summary, setSummary] =
    useState<NotificationSummary>(EMPTY_SUMMARY);

  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<NotificationFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [notificationResult, summaryResult] =
        await Promise.all([
          supabase.rpc(
            "vorta_get_equipment_notifications",
            {
              p_equipment_id: resolvedId,
            },
          ),
          supabase.rpc(
            "vorta_get_equipment_notification_summary",
            {
              p_equipment_id: resolvedId,
            },
          ),
        ]);

      if (notificationResult.error) {
        throw notificationResult.error;
      }

      if (summaryResult.error) {
        throw summaryResult.error;
      }

      const notificationRows = Array.isArray(
        notificationResult.data,
      )
        ? notificationResult.data
        : [];

      const summaryRows = Array.isArray(
        summaryResult.data,
      )
        ? summaryResult.data
        : [];

      setNotifications(
        notificationRows.map(mapNotification),
      );

      setSummary(
        mapSummary(summaryRows[0] ?? null),
      );
    } catch (error) {
      console.warn(
        "Equipment notifications failed:",
        error,
      );

      setNotifications([]);
      setSummary(EMPTY_SUMMARY);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Notifications could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => {
    void getEquipmentIdentityById(
      resolvedId,
    ).then(setEquipment);
  }, [resolvedId]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesFilter =
        filter === "ALL" ||
        notification.workflowStatus === filter;

      const matchesSearch =
        query.length === 0 ||
        notification.notificationNumber
          .toLowerCase()
          .includes(query) ||
        notification.shortText
          .toLowerCase()
          .includes(query) ||
        (
          notification.linkedWorkOrderNumber ?? ""
        )
          .toLowerCase()
          .includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [filter, notifications, search]);

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
      ? "bg-red-500/10 text-red-300"
      : equipment.riskLevel === "High"
        ? "bg-orange-500/10 text-orange-300"
        : equipment.riskLevel === "Medium"
          ? "bg-yellow-500/10 text-yellow-300"
          : "bg-emerald-500/10 text-emerald-300";

  const handleTabClick = (tabId: string) => {
    navigate(
      `/equipment/${equipment.id}/${tabId}`,
    );
  };

  const summaryCards = [
    {
      label: "Awaiting work order",
      value: summary.awaitingWorkOrder,
      detail: `${summary.breakdownAwaiting} breakdown notification${
        summary.breakdownAwaiting === 1 ? "" : "s"
      }`,
      valueClass: "text-orange-300",
    },
    {
      label: "Converted",
      value: summary.convertedNotifications,
      detail: "Linked to executable work",
      valueClass: "text-blue-300",
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
              {equipment.name} (
              {equipment.assetNumber})
            </span>
          </nav>

          <Button
            type="button"
            variant="outline"
            onClick={() => void loadNotifications()}
            disabled={loading}
            className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                loading ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-50">
              {equipment.name}
            </h1>

            <p className="mt-1 text-xs text-slate-500">
              {equipment.assetNumber} ·{" "}
              {equipment.type} · {equipment.area}
            </p>
          </div>

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskBadgeClass}`}
          >
            {equipment.riskScore}%{" "}
            {equipment.riskLevel} risk
          </span>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-gray-800">
          {TABS.map((tab) => {
            const active =
              tab.id === "notifications";

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  handleTabClick(tab.id)
                }
                className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-blue-500 text-blue-300"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
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
                  Notifications remain a risk driver
                  until converted into executable work
                  or closed without work.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search notifications or WO"
                    className="h-9 w-full rounded-lg border border-gray-700 bg-[#0b0e14] pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500 sm:w-64"
                  />
                </div>

                <div className="flex rounded-lg border border-gray-700 bg-[#0b0e14] p-1">
                  {[
                    {
                      label: "All",
                      value: "ALL",
                    },
                    {
                      label: "Awaiting WO",
                      value:
                        "AWAITING_WORK_ORDER",
                    },
                    {
                      label: "Converted",
                      value: "CONVERTED",
                    },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setFilter(
                          option.value as NotificationFilter,
                        )
                      }
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
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

            {errorMessage ? (
              <div className="m-4 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />

                <div className="min-w-0">
                  <p className="text-sm font-medium text-red-200">
                    Notifications could not be
                    loaded
                  </p>

                  <p className="mt-1 break-words text-xs text-red-200/70">
                    {errorMessage}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      void loadNotifications()
                    }
                    className="mt-3 text-xs font-semibold text-red-300 hover:text-red-200"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-800 text-[11px] uppercase tracking-wide text-slate-600">
                      <th className="px-4 py-3 font-semibold">
                        Notification
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Priority
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Issue
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Workflow
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Age
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Risk
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Linked work order
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading
                      ? Array.from({
                          length: 4,
                        }).map((_, index) => (
                          <tr
                            key={index}
                            className="border-b border-gray-800/70"
                          >
                            <td
                              colSpan={7}
                              className="px-4 py-4"
                            >
                              <div className="h-10 animate-pulse rounded-lg bg-[#171c25]" />
                            </td>
                          </tr>
                        ))
                      : filteredNotifications.map(
                          (notification) => (
                            <tr
                              key={
                                notification.notificationId
                              }
                              className="border-b border-gray-800/70 transition-colors last:border-b-0 hover:bg-white/[0.015]"
                            >
                              <td className="px-4 py-4 align-top">
                                <p className="text-xs font-semibold text-blue-300">
                                  {
                                    notification.notificationNumber
                                  }
                                </p>

                                <p className="mt-1 text-[11px] text-slate-600">
                                  {notification.notificationTypeDescription ??
                                    notification.notificationTypeCode ??
                                    "Maintenance notification"}
                                </p>
                              </td>

                              <td className="px-4 py-4 align-top">
                                <span
                                  className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${priorityClass(
                                    notification.priorityDescription ??
                                      notification.priorityCode,
                                  )}`}
                                >
                                  {notification.priorityDescription ??
                                    notification.priorityCode ??
                                    "Normal"}
                                </span>

                                {notification.breakdownIndicator ? (
                                  <p className="mt-2 text-[11px] font-medium text-red-400">
                                    Breakdown
                                  </p>
                                ) : null}
                              </td>

                              <td className="max-w-sm px-4 py-4 align-top">
                                <p className="text-xs font-medium leading-5 text-slate-200">
                                  {
                                    notification.shortText
                                  }
                                </p>

                                <p className="mt-1 text-[11px] text-slate-600">
                                  Reported{" "}
                                  {formatDate(
                                    notification.reportedAt,
                                  )}
                                  {notification.reportedBy
                                    ? ` by ${notification.reportedBy}`
                                    : ""}
                                </p>
                              </td>

                              <td className="px-4 py-4 align-top">
                                <span
                                  className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${workflowClass(
                                    notification.workflowStatus,
                                  )}`}
                                >
                                  {workflowLabel(
                                    notification.workflowStatus,
                                  )}
                                </span>

                                <p className="mt-2 text-[11px] text-slate-600">
                                  SAP status:{" "}
                                  {
                                    notification.sourceStatus
                                  }
                                </p>
                              </td>

                              <td className="px-4 py-4 align-top text-xs text-slate-300">
                                {
                                  notification.ageDays
                                }
                                d
                              </td>

                              <td className="px-4 py-4 align-top">
                                <p
                                  className={`text-sm font-semibold ${
                                    notification.riskPoints >=
                                    50
                                      ? "text-red-300"
                                      : notification.riskPoints >
                                          0
                                        ? "text-orange-300"
                                        : "text-slate-500"
                                  }`}
                                >
                                  {
                                    notification.riskPoints
                                  }
                                </p>

                                <p className="mt-1 max-w-[180px] text-[11px] leading-4 text-slate-600">
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
                                        `/equipment/${equipment.id}/work-orders`,
                                      )
                                    }
                                    className="text-xs font-semibold text-blue-300 hover:text-blue-200"
                                  >
                                    {
                                      notification.linkedWorkOrderNumber
                                    }
                                  </button>
                                ) : (
                                  <span className="text-xs font-medium text-orange-300">
                                    Awaiting conversion
                                  </span>
                                )}

                                {notification.linkedWorkOrderStatus ? (
                                  <p className="mt-1 text-[11px] text-slate-600">
                                    {
                                      notification.linkedWorkOrderStatus
                                    }
                                  </p>
                                ) : null}
                              </td>
                            </tr>
                          ),
                        )}
                  </tbody>
                </table>

                {!loading &&
                filteredNotifications.length === 0 ? (
                  <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
                    <Bell className="h-7 w-7 text-slate-700" />

                    <p className="mt-3 text-sm font-medium text-slate-300">
                      No matching notifications
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      Adjust the search or workflow
                      filter.
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
