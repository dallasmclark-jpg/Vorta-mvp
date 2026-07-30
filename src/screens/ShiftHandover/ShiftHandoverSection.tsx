import {
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  Gauge,
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
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  DetailDrawer,
  DrawerCloseButton,
} from "../../components/DetailDrawer";
import { VortaSelect } from "../../components/VortaSelect";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import { getVortaShiftPresentation } from "../../lib/shiftPresentation";
import {
  getEffectiveDataMode,
  type VortaDataMode,
} from "../../lib/dataTrust";
import {
  isShiftHandoverReviewHours,
  loadShiftHandoverSnapshot,
  type ShiftHandoverDiscipline,
  type ShiftHandoverItem,
  type ShiftHandoverReviewHours,
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

type CriticalityFilter = "all" | ShiftHandoverItem["criticality"];
type StatusFilter = "all" | "active" | "completed" | "waiting" | "contractor";
type SortMode = "priority" | "breakdown" | "recent";
type ActivityGroup = {
  key: string;
  label: string | null;
  items: ShiftHandoverItem[];
};

const REVIEW_STORAGE_KEY = "vorta.shift-handover.review-period";
const REVIEW_PERIOD_OPTIONS: Array<{
  value: ShiftHandoverReviewHours;
  label: string;
}> = [
  { value: 12, label: "Previous shift · 12 hours" },
  { value: 24, label: "Previous 2 shifts · 24 hours" },
  { value: 36, label: "Previous 3 shifts · 36 hours" },
  { value: 48, label: "Previous 4 shifts · 48 hours" },
  { value: 96, label: "Previous 8 shifts · 4 days" },
];

const CRITICALITY_OPTIONS: Array<{ value: CriticalityFilter; label: string }> = [
  { value: "all", label: "All criticalities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active / ongoing" },
  { value: "waiting", label: "Waiting / deferred" },
  { value: "contractor", label: "External contractor" },
  { value: "completed", label: "Completed" },
];

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "priority", label: "Criticality" },
  { value: "breakdown", label: "Longest breakdown" },
  { value: "recent", label: "Most recent" },
];

function reviewShiftCount(reviewHours: ShiftHandoverReviewHours): number {
  return reviewHours / 12;
}

function reviewPeriodHeading(reviewHours: ShiftHandoverReviewHours): string {
  const count = reviewShiftCount(reviewHours);
  if (count === 1) return "Previous shift: Previous shift activity";
  return `Previous ${count} shifts: Activity from the previous ${count} shifts`;
}

function reviewPeriodEmptyState(reviewHours: ShiftHandoverReviewHours): string {
  const count = reviewShiftCount(reviewHours);
  return count === 1
    ? "No handover activity was recorded during the previous shift."
    : `No work orders were recorded during the previous ${count} shifts.`;
}

function reviewPeriodLoadingState(reviewHours: ShiftHandoverReviewHours): string {
  const count = reviewShiftCount(reviewHours);
  return count === 1
    ? "Loading activity from the previous shift…"
    : `Loading activity from the previous ${count} shifts…`;
}

function localDateParts(value: string, timeZone: string): {
  year: string;
  month: string;
  day: string;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: map.get("year") ?? "0000",
    month: map.get("month") ?? "00",
    day: map.get("day") ?? "00",
  };
}

function localDateKey(value: string, timeZone: string): string {
  const parts = localDateParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function previousLocalDateKey(value: string, timeZone: string): string {
  const parts = localDateParts(value, timeZone);
  const previous = new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day) - 1,
  ));
  return [
    String(previous.getUTCFullYear()).padStart(4, "0"),
    String(previous.getUTCMonth() + 1).padStart(2, "0"),
    String(previous.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function activityDateLabel(
  value: string,
  referenceEnd: string,
  timeZone: string,
): string {
  const key = localDateKey(value, timeZone);
  if (key === localDateKey(referenceEnd, timeZone)) return "Today";
  if (key === previousLocalDateKey(referenceEnd, timeZone)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

function summariseItems(
  items: ShiftHandoverItem[],
): ShiftHandoverSnapshot["summary"] {
  return {
    total: items.length,
    ongoing: items.filter((item) => item.status === "ongoing").length,
    completed: items.filter((item) => item.status === "completed").length,
    waitingOnParts: items.filter((item) => item.status === "waiting_on_parts").length,
    externalContractor: items.filter((item) => item.status === "external_contractor").length,
    unavailableEquipment: items.filter(
      (item) => item.breakdownMinutes > 0 && item.status !== "completed",
    ).length,
    totalBreakdownMinutes: items.reduce(
      (sum, item) => sum + item.breakdownMinutes,
      0,
    ),
    sparesUsed: items.reduce((sum, item) => sum + item.sparesUsed.length, 0),
  };
}

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

function latestConfirmationSummary(item: ShiftHandoverItem): string {
  const latest = item.confirmations[0] ?? null;

  if (item.status === "completed") {
    return latest?.finalConfirmation
      ? "Work was completed and a final confirmation was posted. The recorded scope and completion details are shown below."
      : "The work order is recorded as completed or closed. The latest recorded confirmation is shown below.";
  }
  if (item.status === "waiting_on_parts") {
    return latest?.finalConfirmation
      ? "A final confirmation was posted, but outstanding material evidence keeps this item open for follow-up."
      : "The order remains open with outstanding material requirements. The latest confirmation is shown below.";
  }
  if (!latest) {
    return "No work confirmation has been posted. The order remains open for planned execution.";
  }
  if (item.status === "ongoing") {
    return "A partial confirmation was posted. The order remains open for planned execution.";
  }
  return `The work order is ${item.statusLabel.toLowerCase()}. The latest confirmation is shown below.`;
}

function formatConfirmationMeasure(value: number, unit: string | null): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${formatted} ${unit?.trim() || "hr"}`;
}

function confirmationMetadata(
  confirmation: ShiftHandoverItem["confirmations"][number],
): string[] {
  return [
    confirmation.finalConfirmation ? "Final confirmation" : "Partial confirmation",
    confirmation.workCenter ? `Work centre ${confirmation.workCenter}` : null,
    formatConfirmationMeasure(confirmation.actualWork, confirmation.workUnit),
    confirmation.actualDuration > 0
      ? `Duration ${formatConfirmationMeasure(confirmation.actualDuration, confirmation.durationUnit)}`
      : null,
  ].filter((value): value is string => Boolean(value));
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
    <div
      className="rounded-xl border border-gray-800 bg-[#141820] p-3 sm:p-4"
      data-vorta-shift-handover-metric={label.toLowerCase().replace(/\s+/g, "-")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" />
      </div>
      <p className={`mt-2 text-xl font-bold tabular-nums sm:mt-3 sm:text-2xl ${tone}`}>{value}</p>
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
      role="tab"
      aria-selected={active}
      aria-pressed={active}
      className={`min-h-11 shrink-0 whitespace-nowrap rounded-lg border px-4 text-sm font-semibold transition-colors ${
        active
          ? "border-blue-500/60 bg-[#10151d] text-blue-200"
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
        <span
          data-vorta-shift-handover-card-status={item.status}
          className={`rounded-md border px-2 py-1 text-xs font-semibold ${tone.badge}`}
        >
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
  const latestConfirmation = item.confirmations[0] ?? null;
  const latestConfirmationNote = latestConfirmation?.text || item.latestConfirmationText;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-vorta-shift-handover-detail="true">
      <div className="flex items-start justify-between gap-4 border-b border-gray-800 px-5 py-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-blue-300">{item.workOrderNumber}</span>
            <span
              data-vorta-shift-handover-detail-status={item.status}
              className={`rounded-md border px-2 py-1 text-xs font-semibold ${tone.badge}`}
            >
              {item.statusLabel}
            </span>
          </div>
          <h2 className="mt-3 break-words text-xl font-semibold text-slate-50 [overflow-wrap:anywhere]">{item.equipmentName}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
        </div>
        {showClose ? <DrawerCloseButton onClose={onClose} /> : null}
      </div>

      <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-5 py-5">
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
          <dl className="space-y-3 text-sm" data-vorta-shift-handover-location="true">
            <div className="flex min-w-0 items-start gap-3 rounded-lg border border-gray-800 bg-[#10151d] px-3 py-2.5">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs text-slate-600">Building</dt>
                <dd className="mt-1 break-words font-medium text-slate-300 [overflow-wrap:anywhere]">{item.building}</dd>
              </div>
            </div>
            <div className="flex min-w-0 items-start gap-3 rounded-lg border border-gray-800 bg-[#10151d] px-3 py-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs text-slate-600">Area</dt>
                <dd className="mt-1 break-words font-medium text-slate-300 [overflow-wrap:anywhere]">{item.area}{item.line ? ` · ${item.line}` : ""}</dd>
              </div>
            </div>
            <div className="flex min-w-0 items-start gap-3 rounded-lg border border-gray-800 bg-[#10151d] px-3 py-2.5">
              <Gauge className={`mt-0.5 h-4 w-4 shrink-0 ${item.functionalLocation ? "text-slate-500" : "text-slate-600"}`} aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs text-slate-600">Functional location</dt>
                <dd
                  data-vorta-shift-handover-functional-location={item.functionalLocation ? "supplied" : "unavailable"}
                  className={`mt-1 break-words [overflow-wrap:anywhere] ${item.functionalLocation ? "font-medium text-slate-300" : "text-slate-500"}`}
                >
                  {item.functionalLocation ?? "Functional location not supplied"}
                </dd>
              </div>
            </div>
            <div className="flex min-w-0 items-start gap-3 rounded-lg border border-gray-800 bg-[#10151d] px-3 py-2.5">
              <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs text-slate-600">Equipment</dt>
                <dd className="mt-1 break-words font-medium text-slate-300 [overflow-wrap:anywhere]">
                  {item.equipmentName}{item.equipmentCode ? ` · ${item.equipmentCode}` : ""}
                </dd>
              </div>
            </div>
          </dl>
        </DetailSection>

        <DetailSection title="Latest confirmation">
          <div
            className="min-w-0 rounded-xl border border-gray-800 bg-[#10151d] p-4 sm:p-5"
            data-vorta-shift-handover-latest-confirmation="true"
          >
            <p
              className="break-words text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]"
              data-vorta-shift-handover-confirmation-summary="true"
            >
              {latestConfirmationSummary(item)}
            </p>
            {latestConfirmationNote ? (
              <div className="mt-4 border-t border-gray-800 pt-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-400 [overflow-wrap:anywhere]">
                  {latestConfirmationNote}
                </p>
              </div>
            ) : null}
            {latestConfirmation ? (
              <div className="mt-4 grid min-w-0 gap-1 text-xs text-slate-600 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3">
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">{latestConfirmation.confirmedBy ?? "Unknown engineer"}</span>
                <time className="whitespace-nowrap" dateTime={latestConfirmation.timestamp ?? undefined}>{formatTimestamp(latestConfirmation.timestamp)}</time>
              </div>
            ) : null}
          </div>
        </DetailSection>

        <DetailSection title={`Confirmation history (${item.confirmations.length})`}>
          {item.confirmations.length > 0 ? (
            <div className="space-y-3">
              {item.confirmations.map((confirmation) => {
                const metadata = confirmationMetadata(confirmation);
                return (
                  <article
                    key={confirmation.id}
                    className="min-w-0 rounded-xl border border-gray-800 bg-[#10151d] p-4 sm:p-5"
                    data-vorta-shift-handover-confirmation-history-item="true"
                  >
                    <header className="grid min-w-0 gap-1 text-xs text-slate-500 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3">
                      <span className="min-w-0 break-words font-medium text-slate-300 [overflow-wrap:anywhere]">
                        {confirmation.confirmedBy ?? "Unknown engineer"}
                      </span>
                      <time className="whitespace-nowrap" dateTime={confirmation.timestamp ?? undefined}>
                        {formatTimestamp(confirmation.timestamp)}
                      </time>
                    </header>
                    {metadata.length > 0 ? (
                      <div
                        className="mt-3 flex min-w-0 flex-wrap gap-2"
                        data-vorta-shift-handover-confirmation-metadata="true"
                      >
                        {metadata.map((entry) => (
                          <span key={entry} className="max-w-full break-words rounded-md border border-gray-700 bg-[#0d1117] px-2 py-1 text-xs text-slate-400 [overflow-wrap:anywhere]">
                            {entry}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p
                      className="mt-4 whitespace-pre-wrap break-words border-t border-gray-800 pt-4 text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]"
                      data-vorta-shift-handover-confirmation-body="true"
                    >
                      {confirmation.text || "No confirmation text was supplied."}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No confirmations have been posted against this work order.</p>
          )}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [reviewHours, setReviewHours] = useState<ShiftHandoverReviewHours>(() => {
    const queryValue = searchParams.get("review");
    if (isShiftHandoverReviewHours(queryValue)) return Number(queryValue) as ShiftHandoverReviewHours;
    const storedValue = typeof window !== "undefined"
      ? window.sessionStorage.getItem(REVIEW_STORAGE_KEY)
      : null;
    return isShiftHandoverReviewHours(storedValue)
      ? Number(storedValue) as ShiftHandoverReviewHours
      : 12;
  });

  const [snapshot, setSnapshot] = useState<ShiftHandoverSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [scopeValue, setScopeValue] = useState("all");
  const [criticality, setCriticality] = useState<CriticalityFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusInfoOpen, setStatusInfoOpen] = useState(false);
  const scopeOptionsRef = useRef<HTMLDivElement>(null);
  const [scopeOptionsCanScrollRight, setScopeOptionsCanScrollRight] = useState(false);
  const [workflowActions, setWorkflowActions] = useState<Map<string, ShiftHandoverWorkflowAction>>(new Map());
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false): Promise<void> => {
    setLoading(true);
    setError(null);
    setWorkflowError(null);
    try {
      const next = await loadShiftHandoverSnapshot(dataMode, reviewHours, refresh);
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
  }, [dataMode, reviewHours, siteContext?.siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateScopeOptionsOverflow = useCallback((): void => {
    const node = scopeOptionsRef.current;
    setScopeOptionsCanScrollRight(Boolean(
      node && node.scrollLeft + node.clientWidth < node.scrollWidth - 1,
    ));
  }, []);

  const changeReviewPeriod = (value: string): void => {
    if (!isShiftHandoverReviewHours(value)) return;
    const next = Number(value) as ShiftHandoverReviewHours;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("review", String(next));
    setSearchParams(nextParams, { replace: true });
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(REVIEW_STORAGE_KEY, String(next));
    }
    if (next > 12) setSortMode("recent");
    setSelectedId(null);
    setDetailOpen(false);
    setReviewHours(next);
  };

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
        if (scopeValue !== "all" && item.area !== scopeValue) return false;
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
        if (reviewHours > 12 || sortMode === "recent") {
          return new Date(b.lastActivityAt ?? 0).getTime()
            - new Date(a.lastActivityAt ?? 0).getTime();
        }
        if (sortMode === "breakdown") return b.breakdownMinutes - a.breakdownMinutes;
        return b.criticalityRank - a.criticalityRank || b.breakdownMinutes - a.breakdownMinutes;
      });
  }, [criticality, query, reviewHours, scopeValue, snapshot?.items, sortMode, status]);

  const filteredSummary = useMemo(
    () => summariseItems(filteredItems),
    [filteredItems],
  );

  const activityGroups = useMemo<ActivityGroup[]>(() => {
    if (!snapshot || reviewHours === 12) {
      return [{ key: "review-period", label: null, items: filteredItems }];
    }

    const ordered = [...filteredItems].sort(
      (a, b) => new Date(b.lastActivityAt ?? 0).getTime()
        - new Date(a.lastActivityAt ?? 0).getTime(),
    );
    const grouped = new Map<string, ShiftHandoverItem[]>();
    for (const item of ordered) {
      const activityAt = item.lastActivityAt ?? snapshot.window.start;
      const key = localDateKey(activityAt, snapshot.site.timezone);
      const current = grouped.get(key) ?? [];
      current.push(item);
      grouped.set(key, current);
    }

    return [...grouped.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([key, items]) => ({
        key,
        label: activityDateLabel(
          items[0]?.lastActivityAt ?? snapshot.window.start,
          snapshot.window.end,
          snapshot.site.timezone,
        ),
        items,
      }));
  }, [filteredItems, reviewHours, snapshot]);

  const selectedItem = filteredItems.find((item) => item.id === selectedId)
    ?? filteredItems[0]
    ?? null;
  const scopeAreas = useMemo(() => {
    const areas = new Set<string>();
    for (const item of snapshot?.items ?? []) {
      const area = item.area.trim();
      if (area) areas.add(area);
    }
    return [...areas].sort((left, right) => left.localeCompare(
      right,
      "en-GB",
      { sensitivity: "base", numeric: true },
    ));
  }, [snapshot?.items]);

  const reviewPeriodOptions = useMemo(() => REVIEW_PERIOD_OPTIONS.map((option) => {
    const period = snapshot?.reviewPeriods.find((candidate) => candidate.reviewHours === option.value);
    return {
      ...option,
      supportingItems: period?.shifts.map((shift) => {
        const presentation = getVortaShiftPresentation({
          teamCode: shift.rotaTeamCode,
          teamName: shift.rotaTeamName,
          shiftLabel: shift.label,
        });
        return {
          label: presentation.label,
          dotClassName: presentation.dotClassName,
          textClassName: presentation.textClassName,
        };
      }),
    };
  }), [snapshot?.reviewPeriods]);

  const activeAdvancedFilterCount = Number(criticality !== "all")
    + Number(status !== "all");
  const hasActiveAdvancedFilters = criticality !== "all"
    || status !== "all"
    || sortMode !== "recent";

  const clearAdvancedFilters = (): void => {
    setCriticality("all");
    setStatus("all");
    setSortMode("recent");
  };

  useEffect(() => {
    if (scopeValue !== "all" && !scopeAreas.includes(scopeValue)) {
      setScopeValue("all");
    }
  }, [scopeAreas, scopeValue]);

  useEffect(() => {
    const node = scopeOptionsRef.current;
    if (!node) {
      setScopeOptionsCanScrollRight(false);
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      const selected = node.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
      if (selected) {
        const selectedLeft = selected.offsetLeft;
        const selectedRight = selectedLeft + selected.offsetWidth;
        const viewportLeft = node.scrollLeft;
        const viewportRight = viewportLeft + node.clientWidth;
        if (selectedLeft < viewportLeft + 8) {
node.scrollLeft = Math.max(0, selectedLeft - 8);
        } else if (selectedRight > viewportRight - 8) {
node.scrollLeft = Math.max(0, selectedRight - node.clientWidth + 8);
        }
      }
      updateScopeOptionsOverflow();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [scopeAreas.length, scopeValue, updateScopeOptionsOverflow]);

  useEffect(() => {
    window.addEventListener("resize", updateScopeOptionsOverflow);
    return () => window.removeEventListener("resize", updateScopeOptionsOverflow);
  }, [updateScopeOptionsOverflow]);


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
            <h1 data-vorta-mobile-page-title="true" className="text-2xl font-bold tracking-tight text-slate-50">Shift Handover</h1>
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
            {reviewPeriodLoadingState(reviewHours)}
          </span>
        </div>
      ) : null}

      {snapshot ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
  <MetricCard label="Handover items" value={String(filteredSummary.total)} detail="In selected shift period" icon={Wrench} />
  <MetricCard label="Ongoing" value={String(filteredSummary.ongoing)} detail="Needs incoming action" icon={Timer} tone="text-blue-300" />
  <MetricCard label="Completed" value={String(filteredSummary.completed)} detail="Returned or closed" icon={CheckCircle2} tone="text-emerald-300" />
  <MetricCard label="Waiting parts" value={String(filteredSummary.waitingOnParts)} detail="Open material need" icon={Boxes} tone="text-amber-300" />
</div>

          <section data-vorta-group-frame="true" className="rounded-2xl border border-gray-800 bg-[#10151d] p-4 sm:p-5">
  <div>
    <h2 className="text-sm font-semibold text-slate-100">Handover scope</h2>
    <p className="mt-1 text-xs text-slate-500">Site and areas with activity in the selected shift period.</p>
  </div>

  <div className="relative mt-4">
    <div
      ref={scopeOptionsRef}
      onScroll={updateScopeOptionsOverflow}
      role="tablist"
      aria-label="Handover scope"
      className="flex gap-2 overflow-x-auto pb-1 pr-10"
      data-vorta-shift-handover-scope-tabs="true"
    >
      <SelectorTab active={scopeValue === "all"} onClick={() => setScopeValue("all")}>Site</SelectorTab>
      {scopeAreas.map((area) => (
        <SelectorTab key={area} active={scopeValue === area} onClick={() => setScopeValue(area)}>
{area}
        </SelectorTab>
      ))}
    </div>
    {scopeOptionsCanScrollRight ? (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#10151d] to-transparent"
        data-vorta-shift-handover-scope-fade="true"
      />
    ) : null}
  </div>

  <div
    data-vorta-shift-handover-review-period="true"
    className="mt-4 border-t border-gray-800 pt-4"
  >
    <VortaSelect
      label="Review period"
      value={reviewHours}
      options={reviewPeriodOptions}
      onChange={(nextValue) => changeReviewPeriod(String(nextValue))}
      disabled={loading}
      className="w-full sm:max-w-xs"
    />
    {loading ? (
      <span role="status" className="mt-2 inline-flex items-center gap-2 text-xs text-blue-300">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {reviewPeriodLoadingState(reviewHours)}
      </span>
    ) : null}
  </div>

  <div className="mt-4 grid gap-3 border-t border-gray-800 pt-4 lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(150px,0.45fr))]">
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

    <button
      type="button"
      onClick={() => setFiltersOpen((open) => !open)}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 text-sm font-semibold text-slate-300 lg:hidden"
      aria-expanded={filtersOpen}
      aria-controls="shift-handover-advanced-filters"
    >
      <Filter className="h-4 w-4" aria-hidden="true" />
      Filters{activeAdvancedFilterCount > 0 ? ` · ${activeAdvancedFilterCount}` : ""}
    </button>

    <div
      id="shift-handover-advanced-filters"
      className={`${filtersOpen ? "grid" : "hidden"} gap-2 sm:gap-3 lg:contents`}
    >
      <VortaSelect
        label="Criticality"
        value={criticality}
        options={CRITICALITY_OPTIONS}
        onChange={setCriticality}
      />

      <VortaSelect
        label="Status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={setStatus}
      />

      <VortaSelect
        label="Sort by"
        value={reviewHours > 12 ? "recent" : sortMode}
        options={SORT_OPTIONS}
        onChange={setSortMode}
        disabled={reviewHours > 12}
      />

      {hasActiveAdvancedFilters ? (
        <button
          type="button"
          onClick={clearAdvancedFilters}
          className="inline-flex min-h-9 items-center justify-center justify-self-start rounded-lg px-2.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/10 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 lg:hidden"
          data-vorta-shift-handover-clear-filters="true"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  </div>
</section>

          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-50">{reviewPeriodHeading(reviewHours)}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredItems.length} of {snapshot.items.length} work orders
              </p>
            </div>
            <span className="hidden text-xs text-slate-600 sm:inline">SAP confirmations · work orders · goods movements · reservations</span>
          </div>

          {filteredItems.length > 0 ? (
            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_430px] xl:gap-5">
              <div className="space-y-5">
                {activityGroups.map((group) => (
                  <section
                    key={group.key}
                    data-vorta-shift-handover-date-group={group.key}
                  >
                    {group.label ? (
                      <h3 className="mb-3 text-sm font-semibold text-slate-300">
                        {group.label}
                      </h3>
                    ) : null}
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                      {group.items.map((item) => (
                        <HandoverCard
                          key={item.id}
                          item={item}
                          selected={selectedItem?.id === item.id}
                          onOpen={() => openItem(item)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              {selectedItem ? (
                <aside className="hidden max-h-[calc(100vh-120px)] min-h-[640px] overflow-hidden rounded-2xl border border-gray-800 bg-[#0d1117] xl:sticky xl:top-6 xl:flex">
                  <HandoverDetail
                    item={selectedItem}
                    workflow={workflowActions.get(selectedItem.id) ?? null}
                    dataMode={dataMode}
                    siteId={siteContext?.siteId ?? null}
                    windowStart={selectedItem.handoverWindowStart}
                    windowEnd={selectedItem.handoverWindowEnd}
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
              <h2 className="mt-4 font-semibold text-slate-300">
      {snapshot.items.length === 0
        ? reviewPeriodEmptyState(reviewHours)
        : "No work orders match the selected filters."}
    </h2>
    <p className="mt-1 text-sm text-slate-600">
      {snapshot.items.length === 0
        ? "No work orders were confirmed in the selected completed shifts."
        : "Return to Site or clear the search, status or criticality filters."}
    </p>

            </div>
          )}

          <div
            className="rounded-xl border border-gray-800 bg-[#10151d] px-4 py-3"
            data-vorta-shift-handover-status-disclosure="true"
          >
            <button
              type="button"
              onClick={() => setStatusInfoOpen((open) => !open)}
              className="flex min-h-9 w-full items-center justify-between gap-3 text-left text-sm font-medium text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
              aria-expanded={statusInfoOpen}
              aria-controls="shift-handover-status-explanation"
            >
              <span>How handover statuses are calculated</span>
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${statusInfoOpen ? "rotate-90" : ""}`}
                aria-hidden="true"
              />
            </button>
            {statusInfoOpen ? (
              <p
                id="shift-handover-status-explanation"
                className="mt-2 border-t border-gray-800 pt-3 text-xs leading-5 text-slate-500"
              >
                Handover status is normalised from SAP work-order status, confirmation text, final confirmations, goods movements and open material reservations. The original SAP status codes remain visible in each detail panel.
              </p>
            ) : null}
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
            windowStart={selectedItem.handoverWindowStart}
            windowEnd={selectedItem.handoverWindowEnd}
            onWorkflowChange={updateWorkflow}
            onClose={() => setDetailOpen(false)}
            showClose
          />
        ) : null}
      </DetailDrawer>
    </section>
  );
}
