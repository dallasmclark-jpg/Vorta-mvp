import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Database,
  ExternalLink,
  FileSearch,
  History,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { openMaintenanceAiAssistant } from "../../lib/maintenanceActions";
import { EquipmentTabNavigation, type EquipmentTabRoute } from "./EquipmentTabNavigation";
import {
  loadLiveEquipmentWorkItems,
  type LiveDataState,
  type LiveEquipmentRecord,
  type LiveWorkItem,
} from "./equipmentLiveTrust";
import {
  buildDocumentCitation,
  buildWorkEvidenceCitation,
  isLiveWorkItemCompleted,
  isLiveWorkItemOverdue,
  loadLiveEquipmentDocument,
  loadLiveEquipmentDocuments,
  loadLiveEquipmentHistory,
  type LiveEquipmentDocument,
  type LiveEquipmentDocumentSummary,
  type LiveEquipmentHistoryItem,
} from "./equipmentPilotEvidence";

interface EvidenceHookState<T> {
  state: LiveDataState<T> | null;
  loading: boolean;
  reload: () => void;
}

function unavailableState<T>(error: unknown): LiveDataState<T> {
  return {
    status: "unavailable",
    message:
      error instanceof Error
        ? error.message
        : "The verified evidence request failed before a response was returned.",
  };
}

function usePilotEvidence<T>(loader: () => Promise<LiveDataState<T>>): EvidenceHookState<T> {
  const requestVersion = useRef(0);
  const [state, setState] = useState<LiveDataState<T> | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback((): void => {
    const request = ++requestVersion.current;
    setLoading(true);

    void (async () => {
      try {
        const nextState = await loader();
        if (request === requestVersion.current) setState(nextState);
      } catch (error) {
        if (request === requestVersion.current) setState(unavailableState<T>(error));
      } finally {
        if (request === requestVersion.current) setLoading(false);
      }
    })();
  }, [loader]);

  useEffect(() => {
    reload();
    return () => {
      requestVersion.current += 1;
    };
  }, [reload]);

  return { state, loading, reload };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
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

function formatQuantity(value: number, unit: string | null): string {
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value)}${
    unit ? ` ${unit}` : ""
  }`;
}

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function riskTone(level: string): string {
  if (level === "Critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (level === "High") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (level === "Medium") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function statusTone(value: string): string {
  const status = value.toLowerCase();
  if (/overdue|critical|failed|temporary|partial/.test(status)) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (/waiting|hold|due|review/.test(status)) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }
  if (/complete|closed|current|approved|success|resolved/.test(status)) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  return "border-blue-500/25 bg-blue-500/10 text-blue-300";
}

function PageFrame({
  record,
  activeTab,
  title,
  description,
  icon: Icon,
  actions,
  children,
}: {
  record: LiveEquipmentRecord;
  activeTab: EquipmentTabRoute;
  title: string;
  description: string;
  icon: typeof Wrench;
  actions?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const navigate = useNavigate();
  return (
    <section className="flex w-full flex-col gap-5 px-4 pb-12 pt-4 md:px-6 xl:px-8">
      <header className="border-b border-gray-800 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate("/equipment")}
              className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Equipment
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <Icon className="h-5 w-5 text-blue-300" aria-hidden="true" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">{title}</h1>
              <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold tracking-[0.12em] text-emerald-300">
                LIVE SITE EVIDENCE
              </span>
              <span className={`rounded-md border px-2 py-1 text-xs font-bold ${riskTone(record.risk.level)}`}>
                {record.risk.score.toFixed(1)} · {record.risk.level}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {record.name} · {record.assetNumber} · {record.area}
            </p>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">{description}</p>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
        <EquipmentTabNavigation equipmentId={record.id} activeTab={activeTab} />
      </header>
      {children}
    </section>
  );
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
}): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function EvidenceStateMessage({ state }: { state: Exclude<LiveDataState<unknown>, { status: "ready" }> }): JSX.Element {
  const unavailable = state.status === "unavailable";
  return (
    <div
      role={unavailable ? "alert" : "status"}
      className={`rounded-xl border px-4 py-4 ${
        unavailable
          ? "border-red-500/30 bg-red-500/[0.07]"
          : "border-amber-500/30 bg-amber-500/[0.07]"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={`mt-0.5 h-5 w-5 ${unavailable ? "text-red-400" : "text-amber-400"}`} />
        <div>
          <p className={`text-sm font-semibold ${unavailable ? "text-red-200" : "text-amber-200"}`}>
            {unavailable ? "Live evidence unavailable" : "No configured evidence"}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{state.message}</p>
          <p className="mt-2 text-xs text-slate-600">
            No demonstration values, optimistic percentages or cross-site records were substituted.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingEvidence({ label }: { label: string }): JSX.Element {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-gray-800 bg-[#0d1117]">
      <span className="inline-flex items-center gap-2 text-sm text-slate-400">
        <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
        {label}
      </span>
    </div>
  );
}

function RefreshButton({ loading, onClick }: { loading: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-700 px-3 text-sm font-semibold text-slate-200 hover:bg-gray-800 disabled:opacity-50"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      Refresh
    </button>
  );
}

function AskVortaButton({ question }: { question: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => openMaintenanceAiAssistant({ question })}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
    >
      <Sparkles className="h-4 w-4" />
      Ask Vorta
    </button>
  );
}

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

function WorkEvidenceDetails({ item }: { item: LiveEquipmentHistoryItem }): JSX.Element {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <EvidenceList
        title="Confirmations"
        icon={ClipboardCheck}
        empty="No confirmation text recorded"
        rows={item.confirmations.map((confirmation) => ({
          key: confirmation.id,
          title: confirmation.confirmationNumber ?? "Confirmation",
          detail: confirmation.text ?? "No confirmation text",
          meta: `${confirmation.confirmedBy ?? "Unknown engineer"} · ${formatDateTime(confirmation.confirmedAt ?? confirmation.postingDate)}`,
        }))}
      />
      <EvidenceList
        title="Reservations"
        icon={PackageCheck}
        empty="No material reservations recorded"
        rows={item.reservations.map((reservation) => ({
          key: reservation.id,
          title: reservation.materialNumber,
          detail: `${formatQuantity(reservation.reservedQuantity, reservation.baseUnit)} reserved of ${formatQuantity(reservation.requiredQuantity, reservation.baseUnit)}`,
          meta: `${reservation.reservationNumber ?? "No reservation number"} · ${reservation.status}`,
        }))}
      />
      <EvidenceList
        title="Goods movements"
        icon={Database}
        empty="No goods movements recorded"
        rows={item.goodsMovements.map((movement) => ({
          key: movement.id,
          title: movement.materialNumber ?? "Material movement",
          detail: `${formatQuantity(movement.quantity, movement.baseUnit)} · movement ${movement.movementType ?? "—"}`,
          meta: `${movement.materialDocumentNumber ?? "No material document"} · ${formatDate(movement.postingDate)}`,
        }))}
      />
    </div>
  );
}

function EvidenceList({
  title,
  icon: Icon,
  empty,
  rows,
}: {
  title: string;
  icon: typeof Database;
  empty: string;
  rows: Array<{ key: string; title: string; detail: string; meta: string }>;
}): JSX.Element {
  return (
    <section className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-300" />
        <h3 className="text-xs font-semibold text-slate-200">{title}</h3>
      </div>
      <div className="mt-3 space-y-2">
        {rows.length ? rows.map((row) => (
          <div key={row.key} className="rounded-md border border-gray-800 bg-[#10151d] p-3">
            <p className="text-xs font-semibold text-slate-200">{row.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{row.detail}</p>
            <p className="mt-1 text-[10px] text-slate-600">{row.meta}</p>
          </div>
        )) : <p className="text-xs text-slate-600">{empty}</p>}
      </div>
    </section>
  );
}

export function LiveEquipmentHistoryView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const loader = useCallback(() => loadLiveEquipmentHistory(record.id), [record.id]);
  const { state, loading, reload } = usePilotEvidence(loader);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const rows = state?.status === "ready" ? state.data : [];
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter((item) =>
      [item.workOrderNumber, item.description, item.workType, item.status, item.outcome, item.faultCode]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [query, rows]);
  const confirmations = rows.reduce((sum, item) => sum + item.confirmationCount, 0);
  const reservations = rows.reduce((sum, item) => sum + item.reservationCount, 0);
  const movements = rows.reduce((sum, item) => sum + item.goodsMovementCount, 0);
  const promptCitations = rows.slice(0, 8).map(buildWorkEvidenceCitation).join("; ");

  return (
    <PageFrame
      record={record}
      activeTab="history"
      title="History"
      description="Site-scoped work history with SAP confirmation text, material reservations and posted goods movements."
      icon={History}
      actions={
        <>
          <AskVortaButton
            question={`Analyse the verified maintenance history for ${record.name} (${record.assetNumber}), identify repeat faults and cite these source records: ${promptCitations || "No history references are currently available."}`}
          />
          <RefreshButton loading={loading} onClick={reload} />
        </>
      }
    >
      {loading && !state ? <LoadingEvidence label="Loading verified maintenance history…" /> : null}
      {state && state.status !== "ready" ? <EvidenceStateMessage state={state} /> : null}
      {state?.status === "ready" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Work records" value={rows.length} detail="Authorised equipment history" />
            <Metric label="Confirmations" value={confirmations} detail="Non-reversed SAP confirmations" />
            <Metric label="Reservations" value={reservations} detail="Linked material reservations" />
            <Metric label="Goods movements" value={movements} detail="Non-reversed material postings" />
          </div>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-700 bg-[#10151d] px-3">
            <Search className="h-4 w-4 text-slate-500" />
            <span className="sr-only">Search equipment history</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search work order, fault, outcome or confirmation"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
            />
          </label>
          <div className="space-y-3">
            {filtered.map((item) => {
              const expanded = selected === item.workOrderId;
              return (
                <article key={item.workOrderId} className="rounded-xl border border-gray-800 bg-[#141820]">
                  <button
                    type="button"
                    onClick={() => setSelected(expanded ? null : item.workOrderId)}
                    className="flex w-full flex-col gap-3 p-4 text-left lg:flex-row lg:items-start lg:justify-between"
                    aria-expanded={expanded}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-blue-300">{item.workOrderNumber}</span>
                        {item.faultCode ? <span className="rounded border border-gray-700 px-2 py-0.5 text-[10px] text-slate-400">{item.faultCode}</span> : null}
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${statusTone(item.outcome ?? item.status)}`}>{item.outcome ?? item.status}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-100">{item.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(item.eventDate)} · {item.workType} · {item.assignedEngineer ?? "Unassigned"}
                      </p>
                      {item.latestConfirmationText ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.latestConfirmationText}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-[11px] text-slate-500">
                      <span>{item.confirmationCount} confirmations</span>
                      <span>{item.goodsMovementCount} movements</span>
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </button>
                  {expanded ? <div className="border-t border-gray-800 p-4"><WorkEvidenceDetails item={item} /></div> : null}
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </PageFrame>
  );
}

function documentStatusTone(document: LiveEquipmentDocumentSummary): string {
  if (!document.isCurrent || /expired|obsolete|withdrawn/i.test(document.status)) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (/review|draft|pending/i.test(`${document.status} ${document.approvalStatus}`)) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}

export function LiveEquipmentDocumentsView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const navigate = useNavigate();
  const loader = useCallback(() => loadLiveEquipmentDocuments(record.id), [record.id]);
  const { state, loading, reload } = usePilotEvidence(loader);
  const [query, setQuery] = useState("");
  const documents = state?.status === "ready" ? state.data : [];
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return documents;
    return documents.filter((document) =>
      [
        document.title,
        document.documentType,
        document.revision,
        document.summary,
        document.externalReference,
        document.drawingNumber,
        ...document.faultCodes,
        ...document.componentTags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [documents, query]);
  const current = documents.filter((document) => document.isCurrent).length;
  const indexed = documents.filter((document) => document.chunkCount > 0).length;
  const promptCitations = documents.slice(0, 8).map(buildDocumentCitation).join("; ");

  return (
    <PageFrame
      record={record}
      activeTab="documents"
      title="Documents"
      description="Controlled equipment and site documents are filtered by the active site, equipment link and the current user's allowed role."
      icon={FileSearch}
      actions={
        <>
          <AskVortaButton
            question={`Use the controlled documents for ${record.name} (${record.assetNumber}) to explain the likely fault path. Cite these document references: ${promptCitations || "No controlled document references are currently available."}`}
          />
          <RefreshButton loading={loading} onClick={reload} />
        </>
      }
    >
      {loading && !state ? <LoadingEvidence label="Loading controlled documents…" /> : null}
      {state && state.status !== "ready" ? <EvidenceStateMessage state={state} /> : null}
      {state?.status === "ready" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Available documents" value={documents.length} detail="Role-authorised records" />
            <Metric label="Current" value={current} detail="Marked as current" tone="text-emerald-300" />
            <Metric label="AI searchable" value={indexed} detail="Indexed evidence sections" tone="text-blue-300" />
          </div>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-700 bg-[#10151d] px-3">
            <Search className="h-4 w-4 text-slate-500" />
            <span className="sr-only">Search controlled documents</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search manual, drawing, fault code or component"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
            />
          </label>
          <div className="grid gap-3 xl:grid-cols-2">
            {filtered.map((document) => (
              <article key={document.documentId} className="flex flex-col rounded-xl border border-gray-800 bg-[#141820] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-300" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-300">{document.documentType}</span>
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${documentStatusTone(document)}`}>
                        {document.isCurrent ? document.approvalStatus : "Not current"}
                      </span>
                    </div>
                    <h2 className="mt-3 text-base font-semibold text-slate-100">{document.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {document.revision ? `Revision ${document.revision} · ` : ""}{document.externalReference ?? document.sourceDocumentId}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-gray-700 px-2 py-1 text-xs font-semibold text-slate-300">
                    {document.chunkCount} sections
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                  {document.summary ?? "No extracted summary is available. Open the document to inspect indexed source sections."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {document.faultCodes.slice(0, 3).map((code) => <span key={code} className="rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{code}</span>)}
                  {document.componentTags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-blue-500/10 px-2 py-1 text-[10px] text-blue-300">{tag}</span>)}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/equipment/${record.id}/documents/${document.documentId}`)}
                  className="mt-auto inline-flex min-h-10 items-center justify-end gap-2 border-t border-gray-800 pt-4 text-sm font-semibold text-blue-300 hover:text-blue-200"
                >
                  Open controlled document
                  <ChevronRight className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </PageFrame>
  );
}

export function LiveEquipmentDocumentViewerView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const navigate = useNavigate();
  const { documentId = "" } = useParams<{ documentId?: string }>();
  const loader = useCallback(
    () => loadLiveEquipmentDocument(record.id, documentId),
    [documentId, record.id],
  );
  const { state, loading, reload } = usePilotEvidence(loader);
  const document: LiveEquipmentDocument | null = state?.status === "ready" ? state.data : null;
  const sourceUrl = safeExternalUrl(document?.sourceUrl ?? null);
  const chunkCitations = document?.chunks
    .slice(0, 8)
    .map((chunk) => `${chunk.reference}${chunk.pageNumber ? ` page ${chunk.pageNumber}` : ""}`)
    .join("; ");

  return (
    <PageFrame
      record={record}
      activeTab="documents"
      title={document?.title ?? "Document viewer"}
      description="The viewer retains equipment and active-site context. Indexed sections are the citation boundary used by Ask Vorta."
      icon={BookOpen}
      actions={
        <>
          {document ? (
            <AskVortaButton
              question={`Use ${buildDocumentCitation(document)} to answer questions about ${record.name} (${record.assetNumber}). Cite these indexed sections: ${chunkCitations || "No indexed sections are available."}`}
            />
          ) : null}
          <RefreshButton loading={loading} onClick={reload} />
        </>
      }
    >
      <button
        type="button"
        onClick={() => navigate(`/equipment/${record.id}/documents`)}
        className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to documents
      </button>
      {loading && !state ? <LoadingEvidence label="Opening controlled document…" /> : null}
      {state && state.status !== "ready" ? <EvidenceStateMessage state={state} /> : null}
      {document ? (
        <>
          <div className="rounded-xl border border-gray-800 bg-[#141820] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded border px-2 py-1 text-xs font-semibold ${documentStatusTone(document)}`}>{document.approvalStatus}</span>
                  <span className="rounded border border-gray-700 px-2 py-1 text-xs text-slate-300">{document.documentType}</span>
                  {document.revision ? <span className="rounded border border-gray-700 px-2 py-1 text-xs text-slate-300">Revision {document.revision}</span> : null}
                </div>
                <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300">{document.summary ?? "No document summary is available."}</p>
                <p className="mt-3 text-xs text-slate-500">
                  Source: {document.sourceSystem} · Reference: {document.externalReference ?? document.sourceDocumentId} · Updated {formatDate(document.updatedAt)}
                </p>
              </div>
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-gray-700 px-3 text-sm font-semibold text-slate-200 hover:bg-gray-800"
                >
                  Open controlled source
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>
          <div className="space-y-3">
            {document.chunks.length ? document.chunks.map((chunk, index) => (
              <article key={chunk.id || `${chunk.reference}-${index}`} className="rounded-xl border border-gray-800 bg-[#141820] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-300">{chunk.reference}</p>
                    <h2 className="mt-1 text-sm font-semibold text-slate-100">{chunk.sectionTitle ?? `Evidence section ${index + 1}`}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                    {chunk.pageNumber ? <span>Page {chunk.pageNumber}</span> : null}
                    {chunk.drawingNumber ? <span>Drawing {chunk.drawingNumber}</span> : null}
                    {chunk.sheetNumber ? <span>Sheet {chunk.sheetNumber}</span> : null}
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{chunk.text}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {chunk.faultCodes.map((code) => <span key={code} className="rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{code}</span>)}
                  {chunk.componentTags.map((tag) => <span key={tag} className="rounded bg-blue-500/10 px-2 py-1 text-[10px] text-blue-300">{tag}</span>)}
                </div>
              </article>
            )) : (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-5">
                <ShieldCheck className="h-5 w-5 text-amber-300" />
                <p className="mt-2 text-sm font-semibold text-amber-200">Document metadata verified, content not indexed</p>
                <p className="mt-1 text-xs text-slate-500">Ask Vorta will not invent content for this document. Use the controlled source link when available.</p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </PageFrame>
  );
}
