import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Database,
  Loader2,
  PackageCheck,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  getWorkOrderExecutionDetail,
  type WorkOrderExecutionDetail,
} from "./workOrderExecutionService";

export const VORTA_WORK_ORDER_DETAIL_EVENT = "vorta-work-order-detail";

interface WorkOrderDetailEvent {
  equipmentId?: string;
  workOrderNumber?: string;
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

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatQuantity(value: number | null, unit: string | null): string {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 3,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(value: string): string {
  const normalised = value.toLowerCase();
  if (normalised.includes("cancel") || normalised.includes("short")) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (normalised.includes("wait") || normalised.includes("partial")) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }
  if (
    normalised.includes("complete") ||
    normalised.includes("issued") ||
    normalised.includes("reserved")
  ) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  return "border-blue-500/25 bg-blue-500/10 text-blue-300";
}

export function GlobalWorkOrderExecutionOverlay(): JSX.Element | null {
  const [selection, setSelection] = useState<WorkOrderDetailEvent | null>(null);
  const [detail, setDetail] = useState<WorkOrderExecutionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const close = useCallback(() => {
    setSelection(null);
    setDetail(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const next = (event as CustomEvent<WorkOrderDetailEvent>).detail;
      const equipmentId = next?.equipmentId?.trim();
      const workOrderNumber = next?.workOrderNumber?.trim();
      if (!equipmentId || !workOrderNumber) return;

      setSelection({ equipmentId, workOrderNumber });
      setDetail(null);
      setError(null);
      setRetryCount(0);
    };

    window.addEventListener(VORTA_WORK_ORDER_DETAIL_EVENT, handleOpen);
    return () => window.removeEventListener(VORTA_WORK_ORDER_DETAIL_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (!selection?.equipmentId || !selection.workOrderNumber) return;

    let active = true;
    setLoading(true);
    setError(null);
    setDetail(null);

    void getWorkOrderExecutionDetail(
      selection.equipmentId,
      selection.workOrderNumber,
    )
      .then((nextDetail) => {
        if (active) setDetail(nextDetail);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Work order execution detail could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selection, retryCount]);

  useEffect(() => {
    if (!selection) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, selection]);

  if (!selection) return null;

  const confirmationTextCount =
    detail?.confirmations.filter((item) => Boolean(item.confirmationText?.trim()))
      .length ?? 0;

  return (
    <div className="fixed inset-0 z-[90]" data-global-work-order-overlay="true">
      <button
        type="button"
        aria-label="Close work order information"
        onClick={close}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />

      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-[620px] flex-col border-l border-gray-800 bg-[#10151f] shadow-2xl shadow-black/70"
        aria-label="Work order information"
        aria-modal="true"
        role="dialog"
      >
        <header className="flex min-h-[64px] items-center justify-between gap-3 border-b border-gray-800 px-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-blue-400/80">
              SAP execution record
            </p>
            <h2 className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">
              {detail?.header.workOrderNumber ?? selection.workOrderNumber}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-gray-800 hover:text-slate-200"
            aria-label="Close work order information"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              <div>
                <p className="text-sm font-medium text-slate-300">
                  Loading SAP execution evidence
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Confirmations · reservations · goods movements
                </p>
              </div>
            </div>
          ) : null}

          {error && !loading ? (
            <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <div>
                  <p className="text-sm font-semibold text-red-200">
                    Execution detail could not load
                  </p>
                  <p className="mt-1 text-xs leading-5 text-red-100/70">{error}</p>
                  <Button
                    type="button"
                    onClick={() => setRetryCount((value) => value + 1)}
                    className="mt-3 h-auto gap-2 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/25"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {detail && !loading ? (
            <div className="space-y-5">
              <section className="rounded-2xl border border-gray-800 bg-[#141820] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="h-auto rounded border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-[9px] font-semibold text-blue-300 shadow-none">
                        {detail.header.priority}
                      </Badge>
                      <Badge
                        className={`h-auto rounded border px-2 py-1 text-[9px] font-semibold shadow-none ${statusTone(detail.header.status)}`}
                      >
                        {formatStatus(detail.header.status)}
                      </Badge>
                      {detail.header.orderTypeCode ? (
                        <Badge className="h-auto rounded border border-gray-700 bg-gray-800/70 px-2 py-1 text-[9px] font-medium text-slate-400 shadow-none">
                          {detail.header.orderTypeCode}
                        </Badge>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-sm font-semibold leading-6 text-slate-100">
                      {detail.header.description}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {detail.header.workType}
                      {detail.header.mainWorkCenter
                        ? ` · ${detail.header.mainWorkCenter}`
                        : ""}
                    </p>
                  </div>
                  <Database className="h-5 w-5 shrink-0 text-blue-400/70" />
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-[#0a0f16] px-3 py-2.5">
                    <UserRound className="h-3.5 w-3.5 text-slate-600" />
                    <div>
                      <p className="text-[8px] uppercase tracking-wide text-slate-600">
                        Assigned engineer
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-300">
                        {detail.header.assignedEngineer ?? "Unassigned"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-[#0a0f16] px-3 py-2.5">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-600" />
                    <div>
                      <p className="text-[8px] uppercase tracking-wide text-slate-600">
                        Completed / due
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-300">
                        {formatDate(
                          detail.header.completedDate ?? detail.header.dueDate,
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    ["Confirmation text", confirmationTextCount, ClipboardCheck],
                    ["Reserved parts", detail.reservations.length, PackageCheck],
                    ["Goods movements", detail.goodsMovements.length, ArrowLeftRight],
                  ].map(([label, value, Icon]) => (
                    <div
                      key={String(label)}
                      className="rounded-lg border border-gray-800 bg-[#0a0f16] px-2.5 py-2.5 text-center"
                    >
                      <Icon className="mx-auto h-3.5 w-3.5 text-blue-400" />
                      <p className="mt-1.5 text-base font-semibold text-slate-100">
                        {String(value)}
                      </p>
                      <p className="mt-0.5 text-[8px] leading-3 text-slate-600">
                        {String(label)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Engineer confirmations
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-600">
                      Work completion text and actual effort recorded against the SAP order.
                    </p>
                  </div>
                  <ClipboardCheck className="h-4 w-4 text-blue-400" />
                </div>
                {detail.confirmations.length > 0 ? (
                  detail.confirmations.map((confirmation) => (
                    <article
                      key={confirmation.id}
                      className="rounded-xl border border-gray-800 bg-[#0d1219] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300/80">
                            {confirmation.confirmationNumber
                              ? `Confirmation ${confirmation.confirmationNumber}`
                              : "SAP confirmation"}
                            {confirmation.operationNumber
                              ? ` · operation ${confirmation.operationNumber}`
                              : ""}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {confirmation.confirmedBy ?? "Engineer not supplied"} ·{" "}
                            {formatDateTime(
                              confirmation.confirmationTimestamp ??
                                confirmation.postingDate,
                            )}
                          </p>
                        </div>
                        {confirmation.finalConfirmation ? (
                          <Badge className="h-auto rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-300 shadow-none">
                            Final confirmation
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-3 rounded-lg border border-blue-500/15 bg-blue-500/[0.05] px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Engineer confirmation text
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-200">
                          {confirmation.confirmationText?.trim() ||
                            "No confirmation text was supplied in the imported SAP record."}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-500">
                        <span>
                          Actual work: {formatQuantity(
                            confirmation.actualWork,
                            confirmation.workUnit,
                          )}
                        </span>
                        <span>
                          Duration: {formatQuantity(
                            confirmation.actualDuration,
                            confirmation.durationUnit,
                          )}
                        </span>
                        <span>Source: {confirmation.sourceSystem}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-gray-800 bg-[#0d1219] px-4 py-5 text-center">
                    <ClipboardCheck className="mx-auto h-5 w-5 text-slate-700" />
                    <p className="mt-2 text-xs font-medium text-slate-300">
                      No SAP confirmation imported
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-600">
                      Confirmation text will appear once SAP supplies the record.
                    </p>
                  </div>
                )}
              </section>

              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Reserved materials
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-600">
                      Required, reserved and withdrawn quantities linked to this order.
                    </p>
                  </div>
                  <PackageCheck className="h-4 w-4 text-blue-400" />
                </div>
                {detail.reservations.length > 0 ? (
                  detail.reservations.map((reservation) => (
                    <article
                      key={reservation.id}
                      className="rounded-xl border border-gray-800 bg-[#0d1219] p-3.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-semibold text-blue-300">
                            {reservation.materialNumber}
                          </p>
                          <p className="mt-1 text-xs text-slate-300">
                            {reservation.materialDescription ??
                              "Material description not supplied"}
                          </p>
                          <p className="mt-1 text-[9px] text-slate-500">
                            Reservation {reservation.reservationNumber ?? "—"}
                            {reservation.reservationItem
                              ? ` · item ${reservation.reservationItem}`
                              : ""}
                          </p>
                        </div>
                        <Badge
                          className={`h-auto rounded border px-2 py-1 text-[9px] font-semibold shadow-none ${statusTone(reservation.reservationStatus)}`}
                        >
                          {formatStatus(reservation.reservationStatus)}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        {[
                          ["Required", reservation.requiredQuantity],
                          ["Reserved", reservation.reservedQuantity],
                          ["Withdrawn", reservation.withdrawnQuantity],
                        ].map(([label, value]) => (
                          <div
                            key={String(label)}
                            className="rounded-lg border border-gray-800 bg-[#0a0f16] px-2 py-2"
                          >
                            <p className="text-[8px] uppercase tracking-wide text-slate-600">
                              {String(label)}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-200">
                              {formatQuantity(Number(value), reservation.baseUnit)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-gray-800 bg-[#0d1219] px-4 py-5 text-center">
                    <PackageCheck className="mx-auto h-5 w-5 text-slate-700" />
                    <p className="mt-2 text-xs font-medium text-slate-300">
                      No material reservations linked
                    </p>
                  </div>
                )}
              </section>

              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Goods movements
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-600">
                      Material issues, returns and reversals recorded against the order.
                    </p>
                  </div>
                  <ArrowLeftRight className="h-4 w-4 text-blue-400" />
                </div>
                {detail.goodsMovements.length > 0 ? (
                  detail.goodsMovements.map((movement) => (
                    <article
                      key={movement.id}
                      className="rounded-xl border border-gray-800 bg-[#0d1219] p-3.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-semibold text-blue-300">
                            {movement.materialDocumentNumber ?? "Material document"}
                            {movement.movementType
                              ? ` · movement ${movement.movementType}`
                              : ""}
                          </p>
                          <p className="mt-1 text-xs text-slate-300">
                            {movement.materialNumber ?? "Material number unavailable"}
                            {movement.materialDescription
                              ? ` · ${movement.materialDescription}`
                              : ""}
                          </p>
                          <p className="mt-1 text-[9px] text-slate-500">
                            Posted {formatDate(movement.postingDate)}
                            {movement.enteredBy ? ` · ${movement.enteredBy}` : ""}
                          </p>
                        </div>
                        <p
                          className={`text-sm font-semibold ${movement.reversal ? "text-red-300" : "text-emerald-300"}`}
                        >
                          {formatQuantity(movement.quantity, movement.baseUnit)}
                        </p>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-gray-800 bg-[#0d1219] px-4 py-5 text-center">
                    <ArrowLeftRight className="mx-auto h-5 w-5 text-slate-700" />
                    <p className="mt-2 text-xs font-medium text-slate-300">
                      No goods movement imported
                    </p>
                  </div>
                )}
              </section>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 pt-3 text-[9px] text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  Read-only SAP source records
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3 w-3" />
                  Source updated {formatDateTime(detail.header.sourceUpdatedAt)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
