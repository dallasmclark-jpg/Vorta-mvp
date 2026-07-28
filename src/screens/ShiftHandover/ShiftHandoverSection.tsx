import {
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  Gauge,
  HardHat,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  Timer,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  DetailDrawer,
  DrawerCloseButton,
} from "../../components/DetailDrawer";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import {
  getEffectiveDataMode,
  type VortaDataMode,
} from "../../lib/dataTrust";
import {
  loadShiftHandoverSnapshot,
  type ShiftHandoverDiscipline,
  type ShiftHandoverItem,
  type ShiftHandoverSnapshot,
  type ShiftHandoverStatus,
} from "./shiftHandoverService";
import {
  acknowledgeShiftHandoverAction,
  carryForwardShiftHandoverAction,
  loadShiftHandoverActions,
  saveShiftHandoverAction,
  type ShiftHandoverWorkflowAction,
} from "./shiftHandoverWorkflowService";

type ScopeMode = "site" | "building" | "area";
type CriticalityFilter = "all" | ShiftHandoverItem["criticality"];
type StatusFilter = "all" | "active" | "completed" | "waiting" | "contractor";
type SortMode = "priority" | "breakdown" | "recent";

const MODE_PRESENTATION: Record<
  VortaDataMode,
  { label: string; className: string; description: string }
> = {
  live: {
    label: "LIVE SAP EVIDENCE",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    description: "Previous completed shift, generated from live work orders, confirmations and material evidence.",
  },
  demo: {
    label: "DEMO SAP EVIDENCE",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    description: "Latest imported demonstration shift using the same SAP-shaped evidence model.",
  },
  unavailable: {
    label: "DATA UNAVAILABLE",
    className: "border-red-500/30 bg-red-500/10 text-red-200",
    description: "Shift handover is withheld until an authorised active site is restored.",
  },
};

const STATUS_TONE: Record<
  ShiftHandoverStatus,
  { badge: string; dot: string }
> = {
  completed: {
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  ongoing: {
    badge: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    dot: "bg-blue-400",
  },
  temporarily_restored: {
    badge: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
    dot: "bg-cyan-400",
  },
  waiting_on_parts: {
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  external_contractor: {
    badge: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    dot: "bg-violet-400",
  },
  waiting_on_production: {
    badge: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    dot: "bg-orange-400",
  },
  monitoring: {
    badge: "border-sky-500/25 bg-sky-500/10 text-sky-300",
    dot: "bg-sky-400",
  },
  deferred: {
    badge: "border-slate-600 bg-slate-700/40 text-slate-300",
    dot: "bg-slate-400",
  },
};

const CRITICALITY_TONE: Record<ShiftHandoverItem["criticality"], string> = {
  critical: "text-red-300",
  high: "text-orange-300",
  medium: "text-amber-300",
  low: "text-emerald-300",
  unknown: "text-slate-400",
};

const DISCIPLINE_LABELS: Record<ShiftHandoverDiscipline, string> = {
  mechanical: "Mechanical",
  electrical: "Electrical",
  controls: "Controls",
  facilities: "Facilities",
};

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "No recorded downtime";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Timestamp unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "text-slate-50",
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" />
      </div>
      <p className={`mt-3 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function SelectorTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 shrink-0 rounded-lg border px-4 text-sm font-semibold transition-colors ${
        active
          ? "border-blue-500/50 bg-blue-500/15 text-blue-200"
          : "border-gray-800 bg-[#10151d] text-slate-400 hover:border-gray-700 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function HandoverCard({
  item,
  selected,
  onOpen,
}: {
  item: ShiftHandoverItem;
  selected: boolean;
  onOpen: () => void;
}): JSX.Element {
  const tone = STATUS_TONE[item.status];
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={selected}
      className={`w-full rounded-2xl border bg-[#141820] p-4 text-left transition-colors sm:p-5 ${
        selected
          ? "border-blue-500/55 ring-1 ring-blue-500/35"
          : "border-gray-800 hover:border-gray-700 hover:bg-[#171c25]"
      }`}
      data-vorta-shift-handover-card="true"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} aria-hidden="true" />
            <span className="text-xs font-semibold text-blue-300">{item.workOrderNumber}</span>
            <span className={`text-xs font-bold uppercase tracking-[0.12em] ${CRITICALITY_TONE[item.criticality]}`}>
              {item.criticality}
            </span>
          </div>
          <h2 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-slate-50 sm:text-lg">
            {item.equipmentName}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-400">
            {item.description}
          </p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${tone.badge}`}>
          {item.statusLabel}
        </span>
        <span className="rounded-md border border-gray-700 bg-[#0d1117] px-2 py-1 text-xs text-slate-400">
          {DISCIPLINE_LABELS[item.discipline]}
        </span>
        <span className="rounded-md border border-gray-700 bg-[#0d1117] px-2 py-1 text-xs text-slate-400">
          {formatDuration(item.breakdownMinutes)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-800 pt-4 text-xs sm:grid-cols-4">
        <div>
          <p className="text-slate-600">Area</p>
          <p className="mt-1 truncate font-medium text-slate-300">{item.area}</p>
        </div>
        <div>
          <p className="text-slate-600">Engineer</p>
          <p className="mt-1 truncate font-medium text-slate-300">{item.assignedEngineer ?? "Unassigned"}</p>
        </div>
        <div>
          <p className="text-slate-600">Confirmed</p>
          <p className="mt-1 font-medium text-slate-300">{item.confirmedWorkHours.toFixed(2)} hr</p>
        </div>
        <div>
          <p className="text-slate-600">Spares</p>
          <p className="mt-1 font-medium text-slate-300">
            {item.sparesUsed.length} used · {item.outstandingMaterials.length} open
          </p>
        </div>
      </div>
    </button>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="border-t border-gray-800 pt-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}


function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function HandoverControlPanel({
  item,
  workflow,
  dataMode,
  siteId,
  windowStart,
  windowEnd,
  onWorkflowChange,
}: {
  item: ShiftHandoverItem;
  workflow: ShiftHandoverWorkflowAction | null;
  dataMode: VortaDataMode;
  siteId: string | null;
  windowStart: string;
  windowEnd: string;
  onWorkflowChange: (action: ShiftHandoverWorkflowAction) => void;
}): JSX.Element {
  const [outgoingNote, setOutgoingNote] = useState(workflow?.outgoingNote ?? item.latestConfirmationText ?? "");
  const [nextAction, setNextAction] = useState(workflow?.nextAction ?? item.nextAction);
  const [ownerName, setOwnerName] = useState(workflow?.ownerName ?? item.assignedEngineer ?? "");
  const [dueAt, setDueAt] = useState(toDateTimeLocal(workflow?.dueAt ?? windowEnd));
  const [busy, setBusy] = useState<"save" | "acknowledge" | "carry" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setOutgoingNote(workflow?.outgoingNote ?? item.latestConfirmationText ?? "");
    setNextAction(workflow?.nextAction ?? item.nextAction);
    setOwnerName(workflow?.ownerName ?? item.assignedEngineer ?? "");
    setDueAt(toDateTimeLocal(workflow?.dueAt ?? windowEnd));
    setMessage(null);
  }, [item.id, item.assignedEngineer, item.latestConfirmationText, item.nextAction, windowEnd, workflow]);

  const completed = item.status === "completed";
  const liveControl = dataMode === "live" && Boolean(siteId);
  const editable = liveControl && !completed && (!workflow || workflow.status === "ready");

  const run = async (operation: "save" | "acknowledge" | "carry"): Promise<void> => {
    if (!siteId) return;
    setBusy(operation);
    setMessage(null);
    try {
      if (operation === "save") {
        if (!outgoingNote.trim() || !nextAction.trim() || !ownerName.trim() || !dueAt) {
          throw new Error("Note, next action, owner and due time are required.");
        }
        const saved = await saveShiftHandoverAction({
          siteId,
          workOrderId: item.id,
          windowStart,
          windowEnd,
          outgoingNote: outgoingNote.trim(),
          nextAction: nextAction.trim(),
          ownerName: ownerName.trim(),
          dueAt: new Date(dueAt).toISOString(),
          expectedVersion: workflow?.version ?? null,
        });
        onWorkflowChange(saved);
        setMessage("Handover control saved with an audit entry.");
      } else if (operation === "acknowledge" && workflow) {
        const acknowledged = await acknowledgeShiftHandoverAction(workflow.id, workflow.version);
        onWorkflowChange(acknowledged);
        setMessage("Incoming shift acknowledgement recorded.");
      } else if (operation === "carry" && workflow) {
        const nextStart = new Date(windowEnd);
        const nextEnd = new Date(nextStart.getTime() + 12 * 60 * 60 * 1000);
        const carried = await carryForwardShiftHandoverAction(
          workflow.id,
          workflow.version,
          nextStart.toISOString(),
          nextEnd.toISOString(),
          nextEnd.toISOString(),
        );
        onWorkflowChange(carried.current);
        setMessage(`Carried forward to the shift ending ${formatTimestamp(nextEnd.toISOString())}.`);
      }
    } catch (operationError) {
      setMessage(
        operationError instanceof Error
          ? operationError.message
          : "The handover control could not be updated. Refresh and retry.",
      );
    } finally {
      setBusy(null);
    }
  };

  if (completed) {
    return (
      <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">Handover control locked</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">This work order is completed in SAP and cannot be reopened through handover.</p>
      </section>
    );
  }

  if (!liveControl) {
    return (
      <section className="rounded-xl border border-gray-800 bg-[#10151d] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Handover control</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">Notes, ownership and acknowledgement are available only against an authorised live site.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-blue-500/25 bg-blue-500/[0.04] p-4" data-vorta-handover-control="true">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-300">Controlled handover</p>
          <p className="mt-1 text-xs text-slate-500">SAP remains read-only. Vorta records accountability and acknowledgement.</p>
        </div>
        <span className="rounded-md border border-gray-700 bg-[#0d1117] px-2 py-1 text-[10px] font-semibold uppercase text-slate-300">
          {workflow?.status.replaceAll("_", " ") ?? "Not saved"}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-xs text-slate-400">
          Outgoing shift note
          <textarea
            value={outgoingNote}
            onChange={(event) => setOutgoingNote(event.target.value)}
            readOnly={!editable}
            maxLength={1200}
            rows={3}
            className="rounded-xl border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm leading-6 text-slate-200 outline-none focus:border-blue-500/60 read-only:opacity-70"
          />
        </label>
        <label className="grid gap-1.5 text-xs text-slate-400">
          Incoming shift next action
          <textarea
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            readOnly={!editable}
            maxLength={800}
            rows={2}
            className="rounded-xl border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm leading-6 text-slate-200 outline-none focus:border-blue-500/60 read-only:opacity-70"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs text-slate-400">
            Accountable owner
            <input
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              readOnly={!editable}
              maxLength={160}
              className="min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60 read-only:opacity-70"
            />
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">
            Due by
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              readOnly={!editable}
              className="min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60 read-only:opacity-70"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button type="button" disabled={!editable || Boolean(busy)} onClick={() => void run("save")} className="min-h-11 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "save" ? "Saving…" : workflow ? "Update handover" : "Save handover"}
        </button>
        <button type="button" disabled={!workflow || workflow.status !== "ready" || Boolean(busy)} onClick={() => void run("acknowledge")} className="min-h-11 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "acknowledge" ? "Recording…" : "Acknowledge"}
        </button>
        <button type="button" disabled={!workflow || !["ready", "acknowledged"].includes(workflow.status) || Boolean(busy)} onClick={() => void run("carry")} className="min-h-11 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 text-sm font-semibold text-amber-200 disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "carry" ? "Carrying…" : "Carry forward"}
        </button>
      </div>

      {message ? <p className="mt-3 text-xs leading-5 text-slate-300" role="status">{message}</p> : null}
      {workflow?.events.length ? (
        <details className="mt-4 border-t border-gray-800 pt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-blue-300">Audit trail ({workflow.events.length})</summary>
          <div className="space-y-2 pt-2">
            {workflow.events.slice(0, 5).map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 text-xs text-slate-500">
                <span className="capitalize">{event.eventType.replaceAll("_", " ")} · v{event.actionVersion}</span>
                <span>{formatTimestamp(event.createdAt)}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function HandoverDetail({
  item,
  workflow,
  dataMode,
  siteId,
  windowStart,
  windowEnd,
  onWorkflowChange,
  onClose,
  showClose,
}: {
  item: ShiftHandoverItem;
  workflow: ShiftHandoverWorkflowAction | null;
  dataMode: VortaDataMode;
  siteId: string | null;
  windowStart: string;
  windowEnd: string;
  onWorkflowChange: (action: ShiftHandoverWorkflowAction) => void;
  onClose: () => void;
  showClose: boolean;
}): JSX.Element {
  const navigate = useNavigate();
  const tone = STATUS_TONE[item.status];

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-vorta-shift-handover-detail="true">
      <div className="flex items-start justify-between gap-4 border-b border-gray-800 px-5 py-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-blue-300">{item.workOrderNumber}</span>
            <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${tone.badge}`}>
              {item.statusLabel}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-semibold text-slate-50">{item.equipmentName}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
        </div>
        {showClose ? <DrawerCloseButton onClose={onClose} /> : null}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-800 bg-[#10151d] p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-600">Breakdown</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{formatDuration(item.breakdownMinutes)}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#10151d] p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-600">Confirmed work</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{item.confirmedWorkHours.toFixed(2)} hr</p>
          </div>
        </div>

        <section className="rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-300">Incoming shift action</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{workflow?.nextAction ?? item.nextAction}</p>
        </section>

        <HandoverControlPanel
          item={item}
          workflow={workflow}
          dataMode={dataMode}
          siteId={siteId}
          windowStart={windowStart}
          windowEnd={windowEnd}
          onWorkflowChange={onWorkflowChange}
        />

        <DetailSection title="Work order evidence">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {[
              ["SAP status", item.sapStatus || "Not supplied"],
              ["Priority", item.priority || "Not supplied"],
              ["Work type", item.workType || "Not supplied"],
              ["Discipline", DISCIPLINE_LABELS[item.discipline]],
              ["Engineer", item.assignedEngineer ?? "Unassigned"],
              ["Work centre", item.mainWorkCenter ?? "Not supplied"],
              ["Last activity", formatTimestamp(item.lastActivityAt)],
              ["Notification", item.notificationNumber ?? "Not linked"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-gray-800 bg-[#10151d] px-3 py-2.5">
                <dt className="text-xs text-slate-600">{label}</dt>
                <dd className="mt-1 font-medium text-slate-300">{value}</dd>
              </div>
            ))}
          </dl>
        </DetailSection>

        <DetailSection title="Location">
          <div className="space-y-2 text-sm text-slate-300">
            <p className="flex items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />{item.building}</p>
            <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />{item.area}{item.line ? ` · ${item.line}` : ""}</p>
            <p className="flex items-start gap-2"><Gauge className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />{item.functionalLocation ?? "Functional location not supplied"}</p>
          </div>
        </DetailSection>

        <DetailSection title="Latest confirmation">
          {item.latestConfirmationText ? (
            <div className="rounded-xl border border-gray-800 bg-[#10151d] p-4">
              <p className="text-sm leading-6 text-slate-300">{item.latestConfirmationText}</p>
              <p className="mt-3 text-xs text-slate-600">
                {item.confirmations[0]?.confirmedBy ?? "Unknown engineer"} · {formatTimestamp(item.confirmations[0]?.timestamp ?? null)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No confirmation text was supplied for this shift.</p>
          )}
        </DetailSection>

        <DetailSection title={`Confirmation history (${item.confirmations.length})`}>
          <div className="space-y-3">
            {item.confirmations.map((confirmation) => (
              <article key={confirmation.id} className="rounded-xl border border-gray-800 bg-[#10151d] p-4">
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{confirmation.confirmedBy ?? "Unknown engineer"}</span>
                  <span>{formatTimestamp(confirmation.timestamp)}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{confirmation.text || "No confirmation text"}</p>
              </article>
            ))}
          </div>
        </DetailSection>

        <DetailSection title={`Spares used (${item.sparesUsed.length})`}>
          {item.sparesUsed.length > 0 ? (
            <div className="space-y-2">
              {item.sparesUsed.map((spare) => (
                <div key={`${spare.materialNumber}-${spare.postingDate ?? ""}`} className="flex items-start justify-between gap-4 rounded-lg border border-gray-800 bg-[#10151d] px-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{spare.description}</p>
                    <p className="mt-1 text-xs text-slate-600">{spare.materialNumber}{spare.storageLocation ? ` · ${spare.storageLocation}` : ""}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-cyan-300">{spare.quantity} {spare.unit}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No goods movements were recorded against this work order.</p>
          )}
        </DetailSection>

        <DetailSection title={`Outstanding materials (${item.outstandingMaterials.length})`}>
          {item.outstandingMaterials.length > 0 ? (
            <div className="space-y-2">
              {item.outstandingMaterials.map((material) => (
                <div key={`${material.materialNumber}-${material.requirementDate ?? ""}`} className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-medium text-slate-200">{material.materialNumber}</p>
                    <span className="text-sm font-semibold text-amber-300">{material.outstandingQuantity} {material.unit}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Required {material.requirementDate ?? "date not supplied"} · {material.reservationStatus || "Open reservation"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No outstanding material reservations.</p>
          )}
        </DetailSection>

        <button
          type="button"
          onClick={() => navigate(`/equipment/${item.equipmentId}/work-orders?workOrder=${encodeURIComponent(item.workOrderNumber)}`)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Open equipment work orders
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function ShiftHandoverSection(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const modePresentation = MODE_PRESENTATION[dataMode];
  const compactDetail = useMediaQuery("(max-width: 1279px)");

  const [snapshot, setSnapshot] = useState<ShiftHandoverSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [scopeMode, setScopeMode] = useState<ScopeMode>("site");
  const [scopeValue, setScopeValue] = useState("all");
  const [discipline, setDiscipline] = useState<"all" | ShiftHandoverDiscipline>("all");
  const [criticality, setCriticality] = useState<CriticalityFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [workflowActions, setWorkflowActions] = useState<Map<string, ShiftHandoverWorkflowAction>>(new Map());
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false): Promise<void> => {
    setLoading(true);
    setError(null);
    setWorkflowError(null);
    try {
      const next = await loadShiftHandoverSnapshot(dataMode, refresh);
      setSnapshot(next);
      setSelectedId((current) => current && next.items.some((item) => item.id === current)
        ? current
        : next.items[0]?.id ?? null);

      if (dataMode === "live" && siteContext?.siteId) {
        try {
          setWorkflowActions(
            await loadShiftHandoverActions(
              siteContext.siteId,
              next.window.start,
              next.window.end,
            ),
          );
        } catch (workflowLoadError) {
          setWorkflowError(
            workflowLoadError instanceof Error
              ? workflowLoadError.message
              : "Shift handover controls could not be loaded.",
          );
          if (!refresh) setWorkflowActions(new Map());
        }
      } else {
        setWorkflowActions(new Map());
      }
    } catch (loadError) {
      if (!refresh) {
        setSnapshot(null);
        setSelectedId(null);
      }
      setError(
        `${loadError instanceof Error ? loadError.message : "Shift handover could not be loaded."}${
          refresh ? " Previous verified evidence remains visible." : ""
        }`,
      );
    } finally {
      setLoading(false);
    }
  }, [dataMode, siteContext?.siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setScopeValue("all");
  }, [scopeMode]);

  const filteredItems = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();
    const statusMatch = (item: ShiftHandoverItem): boolean => {
      if (status === "all") return true;
      if (status === "completed") return item.status === "completed";
      if (status === "contractor") return item.status === "external_contractor";
      if (status === "waiting") return ["waiting_on_parts", "waiting_on_production", "deferred"].includes(item.status);
      return item.status !== "completed";
    };

    return [...(snapshot?.items ?? [])]
      .filter((item) => {
        if (scopeMode === "building" && scopeValue !== "all" && item.building !== scopeValue) return false;
        if (scopeMode === "area" && scopeValue !== "all" && item.area !== scopeValue) return false;
        if (discipline !== "all" && item.discipline !== discipline) return false;
        if (criticality !== "all" && item.criticality !== criticality) return false;
        if (!statusMatch(item)) return false;
        if (!searchTerm) return true;
        return [
          item.workOrderNumber,
          item.notificationNumber,
          item.equipmentName,
          item.equipmentCode,
          item.description,
          item.area,
          item.building,
          item.assignedEngineer,
          item.functionalLocation,
        ].join(" ").toLowerCase().includes(searchTerm);
      })
      .sort((a, b) => {
        if (sortMode === "breakdown") return b.breakdownMinutes - a.breakdownMinutes;
        if (sortMode === "recent") return new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime();
        return b.criticalityRank - a.criticalityRank || b.breakdownMinutes - a.breakdownMinutes;
      });
  }, [criticality, discipline, query, scopeMode, scopeValue, snapshot?.items, sortMode, status]);

  const selectedItem = snapshot?.items.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;
  const scopeOptions = scopeMode === "building"
    ? snapshot?.scopeOptions.buildings ?? []
    : scopeMode === "area"
      ? snapshot?.scopeOptions.areas ?? []
      : [];

  const openItem = (item: ShiftHandoverItem): void => {
    setSelectedId(item.id);
    if (compactDetail) setDetailOpen(true);
  };

  const updateWorkflow = useCallback((action: ShiftHandoverWorkflowAction): void => {
    setWorkflowActions((current) => {
      const next = new Map(current);
      next.set(action.workOrderId, action);
      return next;
    });
  }, []);

  return (
    <section
      className="flex w-full flex-col gap-6 px-4 pb-28 pt-4 md:px-6 md:pb-12 xl:px-8"
      data-vorta-shift-handover="true"
      data-vorta-shift-handover-mode={dataMode}
    >
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">Shift Handover</h1>
            <span className={`rounded-md border px-2 py-1 text-[11px] font-bold tracking-[0.12em] ${modePresentation.className}`}>
              {modePresentation.label}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{modePresentation.description}</p>
          {snapshot ? (
            <p className="mt-2 inline-flex items-center gap-2 text-xs text-blue-300">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {snapshot.window.label}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-gray-700 bg-[#10151d] px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-gray-800 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh SAP evidence
        </button>
      </header>

      {workflowError && snapshot ? (
        <div role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
          {workflowError} SAP evidence remains available; control actions are withheld until refreshed.
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/[0.08] p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-red-100">Shift handover unavailable</h2>
              <p className="mt-1 text-sm leading-6 text-red-100/75">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {loading && !snapshot ? (
        <div className="flex min-h-[45vh] items-center justify-center" role="status">
          <span className="inline-flex items-center gap-2 text-sm text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-400" aria-hidden="true" />
            Building the previous-shift handover from SAP evidence…
          </span>
        </div>
      ) : null}

      {snapshot ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
            <MetricCard label="Handover items" value={String(snapshot.summary.total)} detail="Confirmed this shift" icon={Wrench} />
            <MetricCard label="Ongoing" value={String(snapshot.summary.ongoing)} detail="Needs incoming action" icon={Timer} tone="text-blue-300" />
            <MetricCard label="Completed" value={String(snapshot.summary.completed)} detail="Returned or closed" icon={CheckCircle2} tone="text-emerald-300" />
            <MetricCard label="Waiting parts" value={String(snapshot.summary.waitingOnParts)} detail="Open material need" icon={Boxes} tone="text-amber-300" />
            <MetricCard label="Contractor" value={String(snapshot.summary.externalContractor)} detail="External support" icon={HardHat} tone="text-violet-300" />
            <MetricCard label="Breakdown" value={formatDuration(snapshot.summary.totalBreakdownMinutes)} detail="Recorded downtime" icon={Gauge} tone="text-orange-300" />
          </div>

          <section data-vorta-group-frame="true" className="rounded-2xl border border-gray-800 bg-[#10151d] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Handover scope</h2>
                <p className="mt-1 text-xs text-slate-500">Move from the full site into a building or operating area.</p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 px-3 text-sm font-semibold text-slate-300 lg:hidden"
                aria-expanded={filtersOpen}
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
                Filters
              </button>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Handover scope level">
              <SelectorTab active={scopeMode === "site"} onClick={() => setScopeMode("site")}>Site</SelectorTab>
              <SelectorTab active={scopeMode === "building"} onClick={() => setScopeMode("building")}>Building</SelectorTab>
              <SelectorTab active={scopeMode === "area"} onClick={() => setScopeMode("area")}>Area</SelectorTab>
            </div>

            {scopeMode !== "site" ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={`${scopeMode} options`}>
                <SelectorTab active={scopeValue === "all"} onClick={() => setScopeValue("all")}>
                  All {scopeMode === "building" ? "buildings" : "areas"}
                </SelectorTab>
                {scopeOptions.map((option) => (
                  <SelectorTab key={option} active={scopeValue === option} onClick={() => setScopeValue(option)}>
                    {option}
                  </SelectorTab>
                ))}
              </div>
            ) : null}

            <div className="mt-4 border-t border-gray-800 pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Discipline</p>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Maintenance discipline">
                <SelectorTab active={discipline === "all"} onClick={() => setDiscipline("all")}>All</SelectorTab>
                {(Object.keys(DISCIPLINE_LABELS) as ShiftHandoverDiscipline[]).map((value) => (
                  <SelectorTab key={value} active={discipline === value} onClick={() => setDiscipline(value)}>
                    {DISCIPLINE_LABELS[value]}
                  </SelectorTab>
                ))}
              </div>
            </div>

            <div className={`${filtersOpen ? "grid" : "hidden"} mt-4 gap-3 border-t border-gray-800 pt-4 lg:grid lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(150px,0.45fr))]`}>
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-700 bg-[#0d1117] px-3">
                <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span className="sr-only">Search handover</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search work order or equipment"
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                />
              </label>

              <label className="grid gap-1 text-xs text-slate-500">
                Criticality
                <select
                  value={criticality}
                  onChange={(event) => setCriticality(event.target.value as CriticalityFilter)}
                  className="min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-medium text-slate-200 outline-none focus:border-blue-500/60"
                >
                  <option value="all">All criticalities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <label className="grid gap-1 text-xs text-slate-500">
                Status
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as StatusFilter)}
                  className="min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-medium text-slate-200 outline-none focus:border-blue-500/60"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active / ongoing</option>
                  <option value="waiting">Waiting / deferred</option>
                  <option value="contractor">External contractor</option>
                  <option value="completed">Completed</option>
                </select>
              </label>

              <label className="grid gap-1 text-xs text-slate-500">
                Sort by
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-medium text-slate-200 outline-none focus:border-blue-500/60"
                >
                  <option value="priority">Criticality</option>
                  <option value="breakdown">Longest breakdown</option>
                  <option value="recent">Most recent</option>
                </select>
              </label>
            </div>
          </section>

          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-50">Previous shift activity</h2>
              <p className="mt-1 text-sm text-slate-500">{filteredItems.length} of {snapshot.items.length} work orders</p>
            </div>
            <span className="hidden text-xs text-slate-600 sm:inline">SAP confirmations · work orders · goods movements · reservations</span>
          </div>

          {filteredItems.length > 0 ? (
            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_430px] xl:gap-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                {filteredItems.map((item) => (
                  <HandoverCard
                    key={item.id}
                    item={item}
                    selected={selectedItem?.id === item.id}
                    onOpen={() => openItem(item)}
                  />
                ))}
              </div>

              {selectedItem ? (
                <aside className="hidden max-h-[calc(100vh-120px)] min-h-[640px] overflow-hidden rounded-2xl border border-gray-800 bg-[#0d1117] xl:sticky xl:top-6 xl:flex">
                  <HandoverDetail
                    item={selectedItem}
                    workflow={workflowActions.get(selectedItem.id) ?? null}
                    dataMode={dataMode}
                    siteId={siteContext?.siteId ?? null}
                    windowStart={snapshot.window.start}
                    windowEnd={snapshot.window.end}
                    onWorkflowChange={updateWorkflow}
                    onClose={() => undefined}
                    showClose={false}
                  />
                </aside>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-800 bg-[#10151d] px-6 py-14 text-center">
              <PackageCheck className="mx-auto h-8 w-8 text-slate-600" aria-hidden="true" />
              <h2 className="mt-4 font-semibold text-slate-300">No handover items match these filters</h2>
              <p className="mt-1 text-sm text-slate-600">Return to the site scope or remove a discipline, status or criticality filter.</p>
            </div>
          )}

          <div className="rounded-xl border border-gray-800 bg-[#10151d] px-4 py-3 text-xs leading-5 text-slate-500">
            Handover status is normalised from SAP work-order status, confirmation text, final confirmations, goods movements and open material reservations. The original SAP status codes remain visible in each detail panel.
          </div>
        </>
      ) : null}

      <DetailDrawer open={detailOpen && Boolean(selectedItem)} onClose={() => setDetailOpen(false)} maxWidth="max-w-xl">
        {selectedItem && snapshot ? (
          <HandoverDetail
            item={selectedItem}
            workflow={workflowActions.get(selectedItem.id) ?? null}
            dataMode={dataMode}
            siteId={siteContext?.siteId ?? null}
            windowStart={snapshot.window.start}
            windowEnd={snapshot.window.end}
            onWorkflowChange={updateWorkflow}
            onClose={() => setDetailOpen(false)}
            showClose
          />
        ) : null}
      </DetailDrawer>
    </section>
  );
}
