import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { supabase } from "../../lib/supabaseClient";
import { DEFAULT_EQUIPMENT_ID } from "./equipmentData";
import { VORTA_WORK_ORDER_DETAIL_EVENT } from "./GlobalWorkOrderExecutionOverlay";

interface WorkOrderRow {
  id: string;
  wo_number: string;
  status: string | null;
  outcome: string | null;
  description: string | null;
  completed_date: string | null;
  due_date: string | null;
}

interface ConfirmationRow {
  work_order_id: string;
  confirmation_text: string | null;
  final_confirmation: boolean | null;
  reversal: boolean | null;
}

interface ReservationRow {
  work_order_id: string;
  final_issue: boolean | null;
  withdrawn_quantity: number | string | null;
}

interface MovementRow {
  work_order_id: string;
  movement_type: string | null;
  reversal: boolean | null;
}

interface WorkOrderEvidence {
  workOrderId: string;
  workOrderNumber: string;
  status: string;
  outcome: string;
  description: string;
  completedDate: string | null;
  dueDate: string | null;
  confirmationCount: number;
  hasFinalConfirmation: boolean;
  goodsIssueCount: number;
  finalIssueReservationCount: number;
  followUpRequired: boolean;
}

function normalise(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function isFollowUpOutcome(outcome: string): boolean {
  const value = normalise(outcome);
  return ["TEMPORARY", "RECUR", "MONITOR", "PARTIAL", "FAILED"].some(
    (marker) => value.includes(marker),
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function outcomeTone(outcome: string): string {
  return isFollowUpOutcome(outcome)
    ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
    : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}

export function WorkOrderEvidenceControl(): JSX.Element {
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedEquipmentId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [records, setRecords] = useState<WorkOrderEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const loadEvidence = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: workOrders, error: workOrderError } = await supabase
        .from("work_orders")
        .select(
          "id, wo_number, status, outcome, description, completed_date, due_date",
        )
        .eq("equipment_id", resolvedEquipmentId);

      if (workOrderError) throw workOrderError;

      const orderRows = (workOrders ?? []) as WorkOrderRow[];
      const orderIds = orderRows.map((row) => row.id);

      if (orderIds.length === 0) {
        setRecords([]);
        return;
      }

      const [confirmationResult, reservationResult, movementResult] =
        await Promise.all([
          supabase
            .from("work_order_confirmations")
            .select(
              "work_order_id, confirmation_text, final_confirmation, reversal",
            )
            .in("work_order_id", orderIds),
          supabase
            .from("work_order_material_reservations")
            .select("work_order_id, final_issue, withdrawn_quantity")
            .in("work_order_id", orderIds),
          supabase
            .from("work_order_goods_movements")
            .select("work_order_id, movement_type, reversal")
            .in("work_order_id", orderIds),
        ]);

      if (confirmationResult.error) throw confirmationResult.error;
      if (reservationResult.error) throw reservationResult.error;
      if (movementResult.error) throw movementResult.error;

      const confirmationsByOrder = new Map<string, ConfirmationRow[]>();
      for (const row of (confirmationResult.data ?? []) as ConfirmationRow[]) {
        const current = confirmationsByOrder.get(row.work_order_id) ?? [];
        current.push(row);
        confirmationsByOrder.set(row.work_order_id, current);
      }

      const reservationsByOrder = new Map<string, ReservationRow[]>();
      for (const row of (reservationResult.data ?? []) as ReservationRow[]) {
        const current = reservationsByOrder.get(row.work_order_id) ?? [];
        current.push(row);
        reservationsByOrder.set(row.work_order_id, current);
      }

      const movementsByOrder = new Map<string, MovementRow[]>();
      for (const row of (movementResult.data ?? []) as MovementRow[]) {
        const current = movementsByOrder.get(row.work_order_id) ?? [];
        current.push(row);
        movementsByOrder.set(row.work_order_id, current);
      }

      setRecords(
        orderRows.map((order): WorkOrderEvidence => {
          const confirmations = (confirmationsByOrder.get(order.id) ?? []).filter(
            (row) => !row.reversal && Boolean(row.confirmation_text?.trim()),
          );
          const reservations = reservationsByOrder.get(order.id) ?? [];
          const movements = movementsByOrder.get(order.id) ?? [];
          const status = order.status ?? "OPEN";
          const outcome = order.outcome ?? "";

          return {
            workOrderId: order.id,
            workOrderNumber: order.wo_number,
            status,
            outcome,
            description: order.description ?? "Maintenance work order",
            completedDate: order.completed_date,
            dueDate: order.due_date,
            confirmationCount: confirmations.length,
            hasFinalConfirmation: confirmations.some(
              (row) => row.final_confirmation === true,
            ),
            goodsIssueCount: movements.filter(
              (row) => !row.reversal && row.movement_type === "261",
            ).length,
            finalIssueReservationCount: reservations.filter(
              (row) =>
                row.final_issue === true || Number(row.withdrawn_quantity ?? 0) > 0,
            ).length,
            followUpRequired:
              normalise(status) === "COMPLETED" && isFollowUpOutcome(outcome),
          };
        }),
      );
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Execution evidence could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [resolvedEquipmentId]);

  useEffect(() => {
    void loadEvidence();
  }, [loadEvidence]);

  const summary = useMemo(() => {
    const completed = records.filter(
      (record) => normalise(record.status) === "COMPLETED",
    );
    const active = records.filter(
      (record) => normalise(record.status) !== "COMPLETED",
    );
    const withConfirmation = records.filter(
      (record) => record.confirmationCount > 0,
    );

    return {
      coverage:
        records.length > 0
          ? Math.round((withConfirmation.length / records.length) * 100)
          : 100,
      completedCount: completed.length,
      completedFinalCount: completed.filter(
        (record) => record.hasFinalConfirmation,
      ).length,
      activeCount: active.length,
      activeUpdatedCount: active.filter(
        (record) => record.confirmationCount > 0,
      ).length,
      goodsIssueCount: records.reduce(
        (total, record) => total + record.goodsIssueCount,
        0,
      ),
      followUpCount: records.filter((record) => record.followUpRequired).length,
      missingCount: records.filter((record) => record.confirmationCount === 0)
        .length,
    };
  }, [records]);

  const followUpRecords = useMemo(
    () =>
      records
        .filter((record) => record.followUpRequired)
        .sort((left, right) =>
          (right.completedDate ?? "").localeCompare(left.completedDate ?? ""),
        )
        .slice(0, 5),
    [records],
  );

  const openWorkOrder = useCallback(
    (workOrderNumber: string) => {
      window.dispatchEvent(
        new CustomEvent(VORTA_WORK_ORDER_DETAIL_EVENT, {
          detail: {
            equipmentId: resolvedEquipmentId,
            workOrderNumber,
          },
        }),
      );
    },
    [resolvedEquipmentId],
  );

  return (
    <section
      className="mx-4 mt-4 rounded-2xl border border-blue-500/20 bg-[#111722] shadow-sm md:mx-6"
      data-work-order-evidence-control="true"
    >
      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
            <ShieldCheck className="h-5 w-5 text-blue-300" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-400/80">
                SAP execution evidence control
              </p>
              {!loading && !error ? (
                <Badge
                  className={`h-auto rounded border px-2 py-0.5 text-[9px] font-semibold shadow-none ${
                    summary.missingCount === 0
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                      : "border-red-500/25 bg-red-500/10 text-red-300"
                  }`}
                >
                  {summary.missingCount === 0
                    ? "Evidence complete"
                    : `${summary.missingCount} evidence gap${summary.missingCount === 1 ? "" : "s"}`}
                </Badge>
              ) : null}
            </div>
            <h2 className="mt-1 text-sm font-semibold text-slate-100">
              Confirmation and parts evidence across this equipment
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Final confirmations, active engineer updates and SAP material issues are reconciled before the manager opens an individual order.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadEvidence()}
          disabled={loading}
          aria-label="Refresh work-order execution evidence"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-lg border border-gray-700 text-slate-500 transition-colors hover:border-blue-500/40 hover:text-blue-300 disabled:opacity-50 lg:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? (
        <div className="mx-4 mb-4 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <p className="text-xs font-semibold text-red-200">
              Execution evidence could not be refreshed
            </p>
            <p className="mt-1 text-[11px] text-red-100/65">{error}</p>
          </div>
        </div>
      ) : null}

      {!error ? (
        <div className="grid border-t border-gray-800 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "Evidence coverage",
              value: loading ? "—" : `${summary.coverage}%`,
              detail: `${summary.missingCount} missing updates`,
              icon: ClipboardCheck,
              tone: "text-emerald-300",
            },
            {
              label: "Completed evidence",
              value: loading
                ? "—"
                : `${summary.completedFinalCount}/${summary.completedCount}`,
              detail: "Final confirmations",
              icon: CheckCircle2,
              tone: "text-emerald-300",
            },
            {
              label: "Active updates",
              value: loading
                ? "—"
                : `${summary.activeUpdatedCount}/${summary.activeCount}`,
              detail: "Interim engineer updates",
              icon: ClipboardCheck,
              tone: "text-blue-300",
            },
            {
              label: "Parts issued",
              value: loading ? "—" : summary.goodsIssueCount,
              detail: "SAP movement type 261",
              icon: ArrowLeftRight,
              tone: "text-violet-300",
            },
            {
              label: "Follow-up required",
              value: loading ? "—" : summary.followUpCount,
              detail: "Temporary, recurring or monitored",
              icon: AlertTriangle,
              tone:
                summary.followUpCount > 0 ? "text-amber-300" : "text-emerald-300",
            },
          ].map(({ label, value, detail, icon: Icon, tone }) => (
            <div
              key={label}
              className="border-b border-gray-800 p-4 last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  {label}
                </p>
                <Icon className="h-3.5 w-3.5 text-slate-600" />
              </div>
              <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
              <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error && summary.followUpCount > 0 ? (
        <div className="border-t border-gray-800">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.015]"
          >
            <div>
              <p className="text-xs font-semibold text-amber-200">
                Review {summary.followUpCount} completed order{summary.followUpCount === 1 ? "" : "s"} requiring follow-up
              </p>
              <p className="mt-0.5 text-[10px] text-slate-600">
                Temporary fixes, recurring faults and monitoring outcomes remain visible after technical completion.
              </p>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>

          {expanded ? (
            <div className="divide-y divide-gray-800 border-t border-gray-800">
              {followUpRecords.map((record) => (
                <div
                  key={record.workOrderId}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-[11px] font-semibold text-blue-300">
                        {record.workOrderNumber}
                      </p>
                      <Badge
                        className={`h-auto rounded border px-2 py-0.5 text-[9px] font-semibold shadow-none ${outcomeTone(record.outcome)}`}
                      >
                        {record.outcome || "Follow-up"}
                      </Badge>
                      {record.goodsIssueCount > 0 ? (
                        <Badge className="h-auto rounded border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[9px] font-semibold text-violet-300 shadow-none">
                          {record.goodsIssueCount} part issue{record.goodsIssueCount === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-300">
                      {record.description}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      Completed {formatDate(record.completedDate)} · {record.confirmationCount} confirmation{record.confirmationCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openWorkOrder(record.workOrderNumber)}
                    className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-blue-300 transition-colors hover:border-blue-500/40 hover:bg-blue-500/5"
                  >
                    Open evidence
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
