import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
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
import { EquipmentWorkOrders as EquipmentWorkOrdersBase } from "./EquipmentWorkOrders";
import {
  getWorkOrderExecutionDetail,
  type WorkOrderConfirmationRecord,
  type WorkOrderExecutionDetail,
  type WorkOrderGoodsMovementRecord,
  type WorkOrderMaterialReservationRecord,
} from "./workOrderExecutionService";

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

function formatStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatQuantity(value: number, unit: string | null): string {
  const formatted = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 3,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function statusTone(value: string): string {
  const normalised = value.toLowerCase();
  if (normalised.includes("short") || normalised.includes("cancel")) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (normalised.includes("partial") || normalised.includes("waiting")) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }
  if (normalised.includes("issued") || normalised.includes("complete") || normalised.includes("reserved")) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  return "border-blue-500/25 bg-blue-500/10 text-blue-300";
}

function ConfirmationCard({ confirmation }: { confirmation: WorkOrderConfirmationRecord }): JSX.Element {
  const reference = [
    confirmation.confirmationNumber ? `Confirmation ${confirmation.confirmationNumber}` : "SAP confirmation",
    confirmation.confirmationCounter ? `counter ${confirmation.confirmationCounter}` : "",
    confirmation.operationNumber ? `operation ${confirmation.operationNumber}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="rounded-xl border border-gray-800 bg-[#0d1219] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300/80">
            {reference}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {confirmation.confirmedBy ?? "Engineer not supplied"} · {formatDateTime(confirmation.confirmationTimestamp ?? confirmation.postingDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {confirmation.finalConfirmation ? (
            <Badge className="h-auto rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-300 shadow-none">
              Final confirmation
            </Badge>
          ) : null}
          {confirmation.reversal ? (
            <Badge className="h-auto rounded border border-red-500/25 bg-red-500/10 px-2 py-1 text-[9px] font-semibold text-red-300 shadow-none">
              Reversal
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-blue-500/15 bg-blue-500/[0.05] px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Engineer confirmation text
        </p>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-200">
          {confirmation.confirmationText?.trim() || "No confirmation text was supplied in the imported SAP record."}
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-[#0a0f16] px-3 py-2.5">
          <p className="text-[9px] uppercase tracking-wide text-slate-600">Actual work</p>
          <p className="mt-1 text-xs font-semibold text-slate-200">
            {confirmation.actualWork == null
              ? "—"
              : formatQuantity(confirmation.actualWork, confirmation.workUnit)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-[#0a0f16] px-3 py-2.5">
          <p className="text-[9px] uppercase tracking-wide text-slate-600">Actual duration</p>
          <p className="mt-1 text-xs font-semibold text-slate-200">
            {confirmation.actualDuration == null
              ? "—"
              : formatQuantity(confirmation.actualDuration, confirmation.durationUnit)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-500">
        {confirmation.workCenter ? <span>Work centre: {confirmation.workCenter}</span> : null}
        {confirmation.personnelNumber ? <span>Personnel: {confirmation.personnelNumber}</span> : null}
        {confirmation.reasonCode ? <span>Reason: {confirmation.reasonCode}</span> : null}
        <span>Source: {confirmation.sourceSystem}</span>
      </div>
    </article>
  );
}

function ReservationRow({ reservation }: { reservation: WorkOrderMaterialReservationRecord }): JSX.Element {
  return (
    <article className="rounded-xl border border-gray-800 bg-[#0d1219] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-blue-300">{reservation.materialNumber}</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            {reservation.materialDescription ?? "Material description not supplied"}
          </p>
          <p className="mt-1 text-[9px] text-slate-500">
            Reservation {reservation.reservationNumber ?? "—"}
            {reservation.reservationItem ? ` · item ${reservation.reservationItem}` : ""}
            {reservation.storageLocation ? ` · ${reservation.storageLocation}` : ""}
          </p>
        </div>
        <Badge className={`h-auto rounded border px-2 py-1 text-[9px] font-semibold shadow-none ${statusTone(reservation.reservationStatus)}`}>
          {formatStatus(reservation.reservationStatus)}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Required", reservation.requiredQuantity],
          ["Reserved", reservation.reservedQuantity],
          ["Withdrawn", reservation.withdrawnQuantity],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-gray-800 bg-[#0a0f16] px-2.5 py-2">
            <p className="text-[8px] uppercase tracking-wide text-slate-600">{label}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-200">
              {formatQuantity(Number(value), reservation.baseUnit)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[9px] text-slate-500">
        <span>Required {formatDate(reservation.requirementDate)}</span>
        <span>{reservation.finalIssue ? "Final issue recorded" : `Source: ${reservation.sourceSystem}`}</span>
      </div>
    </article>
  );
}

function GoodsMovementRow({ movement }: { movement: WorkOrderGoodsMovementRecord }): JSX.Element {
  const documentReference = [
    movement.materialDocumentNumber,
    movement.materialDocumentYear,
    movement.documentItem,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <article className="rounded-xl border border-gray-800 bg-[#0d1219] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs font-semibold text-blue-300">
              {documentReference || "Material document"}
            </p>
            {movement.movementType ? (
              <Badge className="h-auto rounded border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[8px] font-semibold text-violet-300 shadow-none">
                Movement {movement.movementType}
              </Badge>
            ) : null}
            {movement.reversal ? (
              <Badge className="h-auto rounded border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[8px] font-semibold text-red-300 shadow-none">
                Reversal
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-300">
            {movement.materialNumber ?? "Material number unavailable"}
            {movement.materialDescription ? ` · ${movement.materialDescription}` : ""}
          </p>
          <p className="mt-1 text-[9px] text-slate-500">
            Posted {formatDate(movement.postingDate)}
            {movement.enteredBy ? ` · ${movement.enteredBy}` : ""}
            {movement.storageLocation ? ` · ${movement.storageLocation}` : ""}
          </p>
        </div>
        <p className={`text-sm font-semibold ${movement.reversal ? "text-red-300" : "text-emerald-300"}`}>
          {formatQuantity(movement.quantity, movement.baseUnit)}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-500">
        {movement.reservationNumber ? (
          <span>
            Reservation {movement.reservationNumber}
            {movement.reservationItem ? ` / ${movement.reservationItem}` : ""}
          </span>
        ) : null}
        {movement.batchNumber ? <span>Batch: {movement.batchNumber}</span> : null}
        {movement.plantCode ? <span>Plant: {movement.plantCode}</span> : null}
        <span>Source: {movement.sourceSystem}</span>
      </div>
    </article>
  );
}

function ExecutionDrawer({
  detail,
  loading,
  error,
  onClose,
  onRetry,
}: {
  detail: WorkOrderExecutionDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}): JSX.Element {
  const confirmationTextCount = detail?.confirmations.filter((item) => Boolean(item.confirmationText?.trim())).length ?? 0;

  return (
    <>
      <button
        type="button"
        aria-label="Close work order details"
        onClick={onClose}
        className="fixed inset-0 z-[79] bg-black/35 backdrop-blur-[1px]"
      />
      <aside
        data-work-order-execution-drawer="true"
        className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-[620px] flex-col border-l border-gray-800 bg-[#10151f] shadow-2xl shadow-black/60"
        aria-label="Work order execution detail"
      >
        <header className="flex min-h-[64px] items-center justify-between gap-3 border-b border-gray-800 px-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-blue-400/80">
              SAP execution record
            </p>
            <h2 className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">
              {detail?.header.workOrderNumber ?? "Work order details"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-gray-800 hover:text-slate-200"
            aria-label="Close work order details"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              <div>
                <p className="text-sm font-medium text-slate-300">Loading SAP execution evidence</p>
                <p className="mt-1 text-xs text-slate-600">Confirmations · reservations · goods movements</p>
              </div>
            </div>
          ) : null}

          {error && !loading ? (
            <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <div>
                  <p className="text-sm font-semibold text-red-200">Execution detail could not load</p>
                  <p className="mt-1 text-xs leading-5 text-red-100/70">{error}</p>
                  <Button
                    type="button"
                    onClick={onRetry}
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
                      <Badge className={`h-auto rounded border px-2 py-1 text-[9px] font-semibold shadow-none ${statusTone(detail.header.status)}`}>
                        {detail.header.status}
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
                      {detail.header.mainWorkCenter ? ` · ${detail.header.mainWorkCenter}` : ""}
                    </p>
                  </div>
                  <Database className="h-5 w-5 shrink-0 text-blue-400/70" />
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-[#0a0f16] px-3 py-2.5">
                    <UserRound className="h-3.5 w-3.5 text-slate-600" />
                    <div>
                      <p className="text-[8px] uppercase tracking-wide text-slate-600">Assigned engineer</p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-300">{detail.header.assignedEngineer ?? "Unassigned"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-[#0a0f16] px-3 py-2.5">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-600" />
                    <div>
                      <p className="text-[8px] uppercase tracking-wide text-slate-600">Completed / due</p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-300">
                        {formatDate(detail.header.completedDate ?? detail.header.dueDate)}
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
                    <div key={String(label)} className="rounded-lg border border-gray-800 bg-[#0a0f16] px-2.5 py-2.5 text-center">
                      <Icon className="mx-auto h-3.5 w-3.5 text-blue-400" />
                      <p className="mt-1.5 text-base font-semibold text-slate-100">{String(value)}</p>
                      <p className="mt-0.5 text-[8px] leading-3 text-slate-600">{String(label)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Engineer confirmations</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">Work completion text and actual effort recorded against the SAP order.</p>
                  </div>
                  <ClipboardCheck className="h-4 w-4 text-blue-400" />
                </div>
                {detail.confirmations.length > 0 ? (
                  detail.confirmations.map((confirmation) => (
                    <ConfirmationCard key={confirmation.id} confirmation={confirmation} />
                  ))
                ) : (
                  <div className="rounded-xl border border-gray-800 bg-[#0d1219] px-4 py-5 text-center">
                    <ClipboardCheck className="mx-auto h-5 w-5 text-slate-700" />
                    <p className="mt-2 text-xs font-medium text-slate-300">No SAP confirmation imported</p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-600">
                      Confirmation text will appear here once a confirmation record is supplied by the SAP integration.
                    </p>
                  </div>
                )}
              </section>

              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Reserved materials</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">Required, reserved and withdrawn quantities linked to this order.</p>
                  </div>
                  <PackageCheck className="h-4 w-4 text-blue-400" />
                </div>
                {detail.reservations.length > 0 ? (
                  detail.reservations.map((reservation) => (
                    <ReservationRow key={reservation.id} reservation={reservation} />
                  ))
                ) : (
                  <div className="rounded-xl border border-gray-800 bg-[#0d1219] px-4 py-5 text-center">
                    <PackageCheck className="mx-auto h-5 w-5 text-slate-700" />
                    <p className="mt-2 text-xs font-medium text-slate-300">No material reservations linked</p>
                    <p className="mt-1 text-[10px] text-slate-600">No reservation record is currently stored for this work order.</p>
                  </div>
                )}
              </section>

              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Goods movements</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">Material issues, returns and reversals recorded against the order.</p>
                  </div>
                  <ArrowLeftRight className="h-4 w-4 text-blue-400" />
                </div>
                {detail.goodsMovements.length > 0 ? (
                  detail.goodsMovements.map((movement) => (
                    <GoodsMovementRow key={movement.id} movement={movement} />
                  ))
                ) : (
                  <div className="rounded-xl border border-gray-800 bg-[#0d1219] px-4 py-5 text-center">
                    <ArrowLeftRight className="mx-auto h-5 w-5 text-slate-700" />
                    <p className="mt-2 text-xs font-medium text-slate-300">No goods movement imported</p>
                    <p className="mt-1 text-[10px] text-slate-600">No material document movement is currently stored for this order.</p>
                  </div>
                )}
              </section>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 pt-3 text-[9px] text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  Read-only source records. No SAP data can be changed here.
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
    </>
  );
}

function workOrderNumberFromRow(row: HTMLTableRowElement): string | null {
  if (row.id.startsWith("work-order-")) {
    return row.id.slice("work-order-".length).trim() || null;
  }

  const firstCell = row.querySelector("td");
  const candidate = firstCell?.textContent?.trim() ?? "";
  return candidate || null;
}

export function EquipmentWorkOrdersWithExecution(): JSX.Element {
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkOrderExecutionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedEquipmentId = equipmentId ?? "fl-03";

  useEffect(() => {
    const handleWorkOrderClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-work-order-execution-drawer="true"]')) return;

      const row = target.closest<HTMLTableRowElement>("#work-order-register tbody tr");
      if (!row) return;

      const workOrderNumber = workOrderNumberFromRow(row);
      if (!workOrderNumber) return;

      setSelectedWorkOrder(workOrderNumber);
    };

    document.addEventListener("click", handleWorkOrderClick);
    return () => document.removeEventListener("click", handleWorkOrderClick);
  }, []);

  useEffect(() => {
    setSelectedWorkOrder(null);
    setDetail(null);
    setError(null);
  }, [resolvedEquipmentId]);

  useEffect(() => {
    if (!selectedWorkOrder) return;

    let active = true;
    setLoading(true);
    setError(null);
    setDetail(null);

    void getWorkOrderExecutionDetail(resolvedEquipmentId, selectedWorkOrder)
      .then((nextDetail) => {
        if (active) setDetail(nextDetail);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Work order execution detail could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [resolvedEquipmentId, selectedWorkOrder]);

  const retryKey = useMemo(
    () => `${resolvedEquipmentId}:${selectedWorkOrder ?? ""}`,
    [resolvedEquipmentId, selectedWorkOrder],
  );
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (retryCount === 0 || !selectedWorkOrder) return;
    let active = true;
    setLoading(true);
    setError(null);

    void getWorkOrderExecutionDetail(resolvedEquipmentId, selectedWorkOrder)
      .then((nextDetail) => {
        if (active) setDetail(nextDetail);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Work order execution detail could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [resolvedEquipmentId, retryCount, retryKey, selectedWorkOrder]);

  return (
    <>
      <EquipmentWorkOrdersBase />
      {selectedWorkOrder ? (
        <ExecutionDrawer
          detail={detail}
          loading={loading}
          error={error}
          onClose={() => setSelectedWorkOrder(null)}
          onRetry={() => setRetryCount((value) => value + 1)}
        />
      ) : null}
    </>
  );
}
