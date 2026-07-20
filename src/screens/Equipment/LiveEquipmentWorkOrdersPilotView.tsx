import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  loadLiveEquipmentWorkItems,
  type LiveEquipmentRecord,
  type LiveWorkItem,
} from "./equipmentLiveTrust";
import {
  buildWorkEvidenceCitation,
  isLiveWorkItemCompleted,
  isLiveWorkItemOverdue,
  loadLiveEquipmentHistory,
  type LiveEquipmentHistoryItem,
} from "./equipmentPilotEvidence";
import { WorkEvidenceDetails } from "./EquipmentWorkEvidenceDetails";
import {
  AskVortaButton,
  EvidenceStateMessage,
  LoadingEvidence,
  Metric,
  PageFrame,
  RefreshButton,
  formatDate,
  statusTone,
  usePilotEvidence,
} from "./EquipmentPilotEvidenceShared";

function readinessTone(value: number | null): string {
  if (value === null) return "text-slate-500";
  if (value >= 85) return "text-emerald-300";
  if (value >= 65) return "text-amber-300";
  return "text-red-300";
}

function average(values: Array<number | null>): number | null {
  const available = values.filter((value): value is number => value !== null);
  return available.length ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length) : null;
}

function reservationReadiness(history: LiveEquipmentHistoryItem[]): number | null {
  const reservations = history.flatMap((item) => item.reservations);
  if (!reservations.length) return null;
  const required = reservations.reduce((sum, item) => sum + Math.max(0, item.requiredQuantity), 0);
  if (required <= 0) return null;
  const covered = reservations.reduce(
    (sum, item) =>
      sum + Math.min(Math.max(item.reservedQuantity, item.withdrawnQuantity, 0), Math.max(item.requiredQuantity, 0)),
    0,
  );
  return Math.round((covered / required) * 100);
}

export function LiveEquipmentWorkOrdersPilotView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const workLoader = useCallback(() => loadLiveEquipmentWorkItems(record.id), [record.id]);
  const historyLoader = useCallback(() => loadLiveEquipmentHistory(record.id), [record.id]);
  const work = usePilotEvidence(workLoader);
  const history = usePilotEvidence(historyLoader);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string | null>(null);

  const rows = work.state?.status === "ready" ? work.state.data : [];
  const historyRows = history.state?.status === "ready" ? history.state.data : [];
  const historyByNumber = useMemo(
    () => new Map(historyRows.map((item) => [item.workOrderNumber, item])),
    [historyRows],
  );
  const openRows = rows.filter((item) => !isLiveWorkItemCompleted(item));
  const completedRows = rows.filter(isLiveWorkItemCompleted);
  const overdueRows = openRows.filter((item) => isLiveWorkItemOverdue(item));
  const unassignedRows = openRows.filter(
    (item) => !item.assignedEngineer || /unassigned|—/i.test(item.assignedEngineer),
  );

  const assignmentReadiness =
    work.state?.status === "ready" && openRows.length
      ? Math.round(((openRows.length - unassignedRows.length) / openRows.length) * 100)
      : null;
  const scheduleReadiness =
    work.state?.status === "ready" && openRows.length
      ? Math.round(((openRows.length - overdueRows.length) / openRows.length) * 100)
      : null;
  const evidenceReadiness =
    work.state?.status === "ready" && openRows.length
      ? Math.round(
          (openRows.filter((item) => Boolean(item.description.trim()) && Boolean(item.dueDate)).length /
            openRows.length) *
            100,
        )
      : null;
  const partsReadiness =
    history.state?.status === "ready"
      ? reservationReadiness(
          historyRows.filter((item) => openRows.some((workItem) => workItem.workOrderNumber === item.workOrderNumber)),
        )
      : null;
  const executionReadiness = average([
    assignmentReadiness,
    partsReadiness,
    scheduleReadiness,
    evidenceReadiness,
  ]);
  const selectedEvidence = selectedWorkOrder ? historyByNumber.get(selectedWorkOrder) ?? null : null;
  const promptCitations = historyRows.slice(0, 5).map(buildWorkEvidenceCitation).join("; ");
  const loading = work.loading || history.loading;

  const refresh = (): void => {
    work.reload();
    history.reload();
  };

  return (
    <PageFrame
      record={record}
      activeTab="work-orders"
      title="Work Orders"
      description="Work demand and execution evidence are loaded independently. Readiness remains unavailable until its source has been verified."
      icon={ClipboardList}
      actions={
        <>
          <AskVortaButton
            question={`Analyse verified work execution for ${record.name} (${record.assetNumber}). Cite these source records where relevant: ${promptCitations || "No work evidence references are currently available."}`}
          />
          <RefreshButton loading={loading} onClick={refresh} />
        </>
      }
    >
      {work.loading && !work.state ? <LoadingEvidence label="Loading verified work orders…" /> : null}
      {work.state && work.state.status !== "ready" ? <EvidenceStateMessage state={work.state} /> : null}
      {history.state && history.state.status !== "ready" ? <EvidenceStateMessage state={history.state} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Open work orders"
          value={work.state?.status === "ready" ? openRows.length : "—"}
          detail={work.state?.status === "ready" ? `${completedRows.length} completed records` : "Work source unavailable"}
        />
        <Metric
          label="Overdue"
          value={work.state?.status === "ready" ? overdueRows.length : "—"}
          detail="Derived from completion state and due date"
          tone={work.state?.status === "ready" && overdueRows.length ? "text-red-300" : undefined}
        />
        <Metric
          label="Execution readiness"
          value={executionReadiness === null ? "—" : `${executionReadiness}%`}
          detail={
            work.state?.status !== "ready"
              ? "Work-order evidence unavailable"
              : openRows.length === 0
                ? "No open backlog to score"
                : partsReadiness === null
                  ? "Calculated from three verified sources; parts unavailable"
                  : "Assignment, parts, schedule and evidence"
          }
          tone={readinessTone(executionReadiness)}
        />
        <Metric
          label="Confirmations"
          value={history.state?.status === "ready" ? historyRows.reduce((sum, item) => sum + item.confirmationCount, 0) : "—"}
          detail="SAP completion evidence"
        />
        <Metric
          label="Goods movements"
          value={history.state?.status === "ready" ? historyRows.reduce((sum, item) => sum + item.goodsMovementCount, 0) : "—"}
          detail="Posted material evidence"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-xl border border-gray-800 bg-[#141820] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Readiness sources</p>
              <h2 className="mt-1 text-base font-semibold text-slate-100">Can the verified backlog be executed?</h2>
            </div>
            <span className={`text-3xl font-bold ${readinessTone(executionReadiness)}`}>
              {executionReadiness === null ? "—" : `${executionReadiness}%`}
            </span>
          </div>
          <div className="mt-5 space-y-4">
            {[
              ["Engineering assignment", assignmentReadiness, `${unassignedRows.length} unassigned`],
              ["Parts reservation", partsReadiness, partsReadiness === null ? "Reservation evidence unavailable" : "Required quantity coverage"],
              ["Schedule control", scheduleReadiness, `${overdueRows.length} overdue`],
              ["Execution evidence", evidenceReadiness, "Description and due-date completeness"],
            ].map(([label, value, detail]) => {
              const numericValue = typeof value === "number" ? value : null;
              return (
                <div key={String(label)}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-300">{label}</p>
                      <p className="mt-0.5 text-[11px] text-slate-600">{detail}</p>
                    </div>
                    <span className={readinessTone(numericValue)}>
                      {numericValue === null ? "Unavailable" : `${numericValue}%`}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${numericValue ?? 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {work.state?.status === "ready" && rows.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <p className="mt-2 text-sm font-semibold text-emerald-200">No work orders recorded</p>
              <p className="mt-1 text-xs text-slate-500">The verified source returned no work-order rows. Readiness is not presented as 100%.</p>
            </div>
          ) : null}
          {rows.map((item: LiveWorkItem) => {
            const overdue = isLiveWorkItemOverdue(item);
            const evidence = historyByNumber.get(item.workOrderNumber);
            const expanded = selectedWorkOrder === item.workOrderNumber;
            return (
              <article key={item.id} className="rounded-xl border border-gray-800 bg-[#141820]">
                <button
                  type="button"
                  onClick={() => setSelectedWorkOrder(expanded ? null : item.workOrderNumber)}
                  className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-start sm:justify-between"
                  aria-expanded={expanded}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-300">{item.workOrderNumber}</span>
                      {overdue ? <span className="rounded border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">Overdue</span> : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{item.description}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.workType} · {item.assignedEngineer || "Unassigned"} · Due {formatDate(item.dueDate)}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-600">
                      {evidence
                        ? `${evidence.confirmationCount} confirmations · ${evidence.reservationCount} reservations · ${evidence.goodsMovementCount} goods movements`
                        : history.state?.status === "ready"
                          ? "No linked execution evidence"
                          : "Execution evidence unavailable"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{item.status}</span>
                    {expanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                  </div>
                </button>

                {expanded ? (
                  <div className="border-t border-gray-800 px-4 pb-4 pt-4">
                    {evidence ? (
                      <WorkEvidenceDetails item={evidence} />
                    ) : (
                      <p className="text-xs text-slate-500">No verified confirmation, reservation or goods-movement detail is available for this work order.</p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </PageFrame>
  );
}
