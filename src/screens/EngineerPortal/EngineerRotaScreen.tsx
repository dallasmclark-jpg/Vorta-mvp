import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import {
  getEngineerRotaWindow,
  type EngineerRotaCalendarItem,
  type EngineerRotaColleague,
  type EngineerRotaExceptionType,
  type EngineerRotaWindowSnapshot,
} from "./engineerRotaService";
import {
  deleteMyEngineerCalendarEntry,
  getMyEngineerCalendar,
  saveMyEngineerCalendarEntry,
  type EngineerCalendarEntry,
  type EngineerCalendarEntryStatus,
  type EngineerCalendarEntryType,
  type EngineerCalendarSnapshot,
  type SaveEngineerCalendarEntryInput,
} from "./engineerCalendarService";
import {
  resolveAuthenticatedEngineerIdentity,
  type EngineerRosterIdentity,
} from "./engineerIdentity";

const PAGE =
  "mx-auto flex w-full max-w-[1040px] flex-col gap-4 px-3 pb-10 pt-4 sm:px-5 md:gap-5 md:px-6 md:pb-12 md:pt-6";
const CARD =
  "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.22)]";
const RAISED = "rounded-xl border border-slate-800/70 bg-[#07172b]";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WINDOW_MONTHS = 12;

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

function startOfCalendarGrid(value: Date): Date {
  const date = startOfMonth(value);
  const weekday = date.getDay();
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return date;
}

function endOfCalendarGrid(value: Date): Date {
  const date = endOfMonth(value);
  const weekday = date.getDay();
  date.setDate(date.getDate() + (weekday === 0 ? 0 : 7 - weekday));
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  date.setDate(date.getDate() + days);
  return date;
}

function monthIndex(value: Date): number {
  return value.getFullYear() * 12 + value.getMonth();
}

function monthKey(value: Date): string {
  return `${value.getFullYear()}-${value.getMonth()}`;
}

function dateOnly(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function sameMonth(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function monthTitle(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function fullDateTitle(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseDateOnly(value));
}

function shortDateTitle(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(parseDateOnly(value));
}

function shiftLabel(item: EngineerRotaCalendarItem): string {
  return item.shiftType === "day" ? "Day shift" : "Night shift";
}

function shiftShortLabel(item: EngineerRotaCalendarItem): string {
  return item.shiftType === "day" ? "Day" : "Night";
}

function exceptionLabel(value: EngineerRotaExceptionType | null): string {
  switch (value) {
    case "annual_leave":
      return "Annual leave";
    case "sickness":
      return "Sickness";
    case "training":
      return "Training";
    case "unavailable":
      return "Unavailable";
    case "overtime":
      return "Overtime";
    case "contractor_cover":
      return "Contractor cover";
    case "manual_assignment":
      return "Manual cover";
    default:
      return "Available";
  }
}

function personalStatusLabel(item: EngineerRotaCalendarItem): string {
  return item.personalStatus === "scheduled"
    ? shiftShortLabel(item)
    : exceptionLabel(item.personalStatus);
}

function statusTone(item: EngineerRotaCalendarItem): string {
  if (item.personalStatus !== "scheduled") {
    if (item.personalStatus === "sickness" || item.personalStatus === "unavailable") {
      return "border-red-400/45 bg-red-500/[0.18] text-red-100";
    }
    return "border-amber-400/45 bg-amber-500/[0.18] text-amber-100";
  }
  if (item.shiftType === "day") {
    return "border-blue-400/50 bg-blue-500/[0.28] text-blue-100 shadow-[inset_0_0_14px_rgba(59,130,246,0.12)]";
  }
  return "border-indigo-400/50 bg-indigo-500/[0.28] text-indigo-100 shadow-[inset_0_0_14px_rgba(99,102,241,0.12)]";
}

function shiftCellTone(item: EngineerRotaCalendarItem): string {
  if (item.shiftType === "day") {
    return "border-blue-400/30 bg-blue-500/[0.08] shadow-[inset_0_0_0_1px_rgba(96,165,250,0.05),0_0_16px_rgba(37,99,235,0.07)] hover:border-blue-400/45";
  }
  return "border-indigo-400/30 bg-indigo-500/[0.08] shadow-[inset_0_0_0_1px_rgba(129,140,248,0.05),0_0_16px_rgba(79,70,229,0.07)] hover:border-indigo-400/45";
}

function needsAttention(item: EngineerRotaCalendarItem): boolean {
  return item.unavailableCount > 0;
}

function colleagueStatusTone(colleague: EngineerRotaColleague): string {
  if (!colleague.isAvailable) {
    if (colleague.exceptionType === "sickness" || colleague.exceptionType === "unavailable") {
      return "border-red-500/25 bg-red-500/[0.08] text-red-200";
    }
    return "border-amber-500/25 bg-amber-500/[0.08] text-amber-200";
  }
  if (colleague.isContractor) {
    return "border-blue-500/25 bg-blue-500/[0.08] text-blue-200";
  }
  return "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200";
}

function colleagueStatusLabel(colleague: EngineerRotaColleague): string {
  if (!colleague.isAvailable) return exceptionLabel(colleague.exceptionType);
  if (colleague.isContractor) return "Contractor";
  return "Available";
}

function LoadingCalendar(): JSX.Element {
  return (
    <div className={`${CARD} p-4 sm:p-5`} aria-live="polite">
      <div className="animate-pulse">
        <div className="h-5 w-36 rounded bg-slate-800/80" />
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, index) => (
            <div
              key={index}
              className="h-[72px] rounded-xl border border-slate-800/60 bg-slate-900/45"
            />
          ))}
        </div>
      </div>
    </div>
  );
}


function calendarEntryTypeLabel(value: EngineerCalendarEntryType): string {
  switch (value) {
    case "training":
      return "Training";
    case "overtime":
      return "Overtime";
    case "annual_leave":
      return "Annual leave";
    case "appointment":
      return "Appointment";
    case "other":
      return "Other";
    default:
      return "Note";
  }
}

function calendarEntryTone(_value: EngineerCalendarEntryType): string {
  return "border-slate-700/75 bg-slate-950/35 text-slate-300";
}

interface PersonalCalendarSectionProps {
  date: string;
  entries: EngineerCalendarEntry[];
  shiftType: "day" | "night" | null;
  onSave: (input: SaveEngineerCalendarEntryInput) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
}

function PersonalCalendarSection({
  date,
  entries,
  shiftType,
  onSave,
  onDelete,
}: PersonalCalendarSectionProps): JSX.Element {
  const [adding, setAdding] = useState(false);
  const [entryType, setEntryType] = useState<EngineerCalendarEntryType>("note");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [hours, setHours] = useState("");
  const [status, setStatus] = useState<EngineerCalendarEntryStatus>("planned");
  const [saving, setSaving] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  const resetForm = (): void => {
    setEntryType("note");
    setTitle("");
    setNotes("");
    setHours("");
    setStatus("planned");
    setEntryError(null);
  };

  const submit = async (): Promise<void> => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setEntryError("Add a short title before saving.");
      return;
    }
    const parsedHours = hours.trim() ? Number(hours) : null;
    if (
      parsedHours !== null &&
      (!Number.isFinite(parsedHours) || parsedHours < 0 || parsedHours > 24)
    ) {
      setEntryError("Hours must be between 0 and 24.");
      return;
    }
    setSaving(true);
    setEntryError(null);
    try {
      await onSave({
        entryDate: date,
        entryType,
        title: cleanTitle,
        notes: notes.trim() || null,
        hours: parsedHours,
        shiftType,
        status,
      });
      resetForm();
      setAdding(false);
    } catch (saveError) {
      setEntryError(
        saveError instanceof Error ? saveError.message : "This entry could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (entryId: string): Promise<void> => {
    setEntryError(null);
    try {
      await onDelete(entryId);
    } catch (deleteError) {
      setEntryError(
        deleteError instanceof Error ? deleteError.message : "This entry could not be deleted.",
      );
    }
  };

  return (
    <div className={`${RAISED} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-blue-400">
            My profile calendar
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-100">
            Notes, training and overtime
          </h3>
        </div>
        <button
          type="button"
          onClick={() => {
            setAdding((value) => !value);
            setEntryError(null);
          }}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-700/80 bg-[#030c1d] px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {entries.length > 0 ? (
        <div className="mt-3 space-y-2">
          {entries.map((entry) => (
            <div
              key={`${entry.source ?? "vorta"}-${entry.id}`}
              className="rounded-xl border border-slate-800/70 bg-slate-950/25 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-lg border px-2 py-1 text-[9px] font-semibold ${calendarEntryTone(entry.entryType)}`}
                    >
                      {calendarEntryTypeLabel(entry.entryType)}
                    </span>
                    <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-slate-500">
                      {entry.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-200">{entry.title}</p>
                  {entry.notes ? (
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">{entry.notes}</p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                    {entry.hours !== null ? <span>{entry.hours} hours</span> : null}
                    {entry.source === "training_booking" ? (
                      <span>Training booking</span>
                    ) : (
                      <span>Saved to profile</span>
                    )}
                  </div>
                </div>
                {entry.source !== "training_booking" ? (
                  <button
                    type="button"
                    onClick={() => void removeEntry(entry.id)}
                    aria-label={`Delete ${entry.title}`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800/70 text-slate-500 transition-colors hover:border-slate-700/75 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Nothing personal has been added to this date yet.
        </p>
      )}

      {adding ? (
        <div className="mt-4 space-y-3 border-t border-slate-800/70 pt-4">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Type
              <select
                value={entryType}
                onChange={(event) =>
                  setEntryType(event.target.value as EngineerCalendarEntryType)
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-700/80 bg-[#030c1d] px-3 text-xs font-medium text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <option value="note">Note</option>
                <option value="training">Training</option>
                <option value="overtime">Overtime</option>
                <option value="annual_leave">Annual leave</option>
                <option value="appointment">Appointment</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Status
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as EngineerCalendarEntryStatus)
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-700/80 bg-[#030c1d] px-3 text-xs font-medium text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>

          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            placeholder={
              entryType === "training"
                ? "e.g. Confined space refresher"
                : entryType === "overtime"
                  ? "e.g. Extra night shift"
                  : "Short title"
            }
            className="h-11 w-full rounded-xl border border-slate-700/80 bg-[#030c1d] px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          />

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Optional notes"
            className="w-full rounded-xl border border-slate-700/80 bg-[#030c1d] px-3 py-2.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          />

          <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Hours <span className="text-slate-600">optional</span>
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              placeholder="e.g. 12"
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-700/80 bg-[#030c1d] px-3 text-sm font-medium text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            />
          </label>

          {entryError ? <p className="text-xs leading-5 text-red-300">{entryError}</p> : null}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setAdding(false);
              }}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700/80 bg-[#030c1d] text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save to profile"}
            </button>
          </div>
        </div>
      ) : null}

      <Link
        to="/engineer/vorta"
        className="mt-3 inline-flex text-[11px] font-semibold text-blue-400 transition-colors hover:text-blue-300"
      >
        Ask Vorta about my calendar
      </Link>
    </div>
  );
}

interface DaySheetProps {
  date: string;
  engineer: EngineerRosterIdentity;
  shift: EngineerRotaCalendarItem | null;
  entries: EngineerCalendarEntry[];
  onSaveEntry: (input: SaveEngineerCalendarEntryInput) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onClose: () => void;
}

function DaySheet({
  date,
  engineer,
  shift,
  entries,
  onSaveEntry,
  onDeleteEntry,
  onClose,
}: DaySheetProps): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 px-0 pt-16 backdrop-blur-[2px] sm:px-4 sm:pb-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="engineer-rota-day-title"
        className="max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-t-[1.35rem] border border-slate-700/80 bg-[#07111f] shadow-[0_-18px_60px_rgba(0,0,0,0.42)] sm:rounded-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800/85 bg-[#07111f]/95 px-4 py-4 backdrop-blur sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">
              My rota
            </p>
            <h2
              id="engineer-rota-day-title"
              className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-50"
            >
              {fullDateTitle(date)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close day details"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/60 text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-5 sm:px-5">
          <PersonalCalendarSection
            date={date}
            entries={entries}
            shiftType={shift?.shiftType ?? null}
            onSave={onSaveEntry}
            onDelete={onDeleteEntry}
          />

          {shift ? (
            <>
              <div className={`${RAISED} p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusTone(shift)}`}
                    >
                      {personalStatusLabel(shift)}
                    </span>
                    <p className="mt-3 text-base font-semibold text-slate-100">
                      {shift.teamNames.join(" · ") || "Shift team"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{engineer.fullName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Shift
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-200">
                      {shiftLabel(shift)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className={`${RAISED} p-3`}>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Rostered
                  </p>
                  <p className="mt-1.5 text-xl font-semibold text-slate-100">
                    {shift.shiftEngineerCount}
                  </p>
                </div>
                <div className={`${RAISED} p-3`}>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Available
                  </p>
                  <p className="mt-1.5 text-xl font-semibold text-slate-100">
                    {shift.availableEngineerCount}
                  </p>
                </div>
                <div className={`${RAISED} p-3`}>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    On leave
                  </p>
                  <p className="mt-1.5 text-xl font-semibold text-slate-100">
                    {shift.holidayClashCount}
                  </p>
                </div>
              </div>

              {needsAttention(shift) ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-amber-100">
                      Shift availability clash
                    </h3>
                  </div>
                  <div className="mt-2 space-y-1 text-xs leading-5 text-amber-100/75">
                    {shift.holidayClashCount > 0 ? (
                      <p>{shift.holidayClashCount} colleague{shift.holidayClashCount === 1 ? " is" : "s are"} on annual leave.</p>
                    ) : null}
                    {shift.sicknessCount > 0 ? (
                      <p>{shift.sicknessCount} colleague{shift.sicknessCount === 1 ? " is" : "s are"} marked sick.</p>
                    ) : null}
                    {shift.trainingCount > 0 ? (
                      <p>{shift.trainingCount} colleague{shift.trainingCount === 1 ? " is" : "s are"} unavailable for training.</p>
                    ) : null}
                    {shift.unavailableCount >
                    shift.holidayClashCount + shift.sicknessCount + shift.trainingCount ? (
                      <p>Additional unavailable cover is recorded on this shift.</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-100">
                      No colleague availability clashes recorded
                    </p>
                  </div>
                </div>
              )}

              <div className={`${RAISED} p-4`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-slate-100">
                      Same-shift engineers
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {shift.colleagues.length} colleagues
                  </span>
                </div>

                {shift.colleagues.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {shift.colleagues.map((colleague) => (
                      <div
                        key={colleague.engineerId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/70 bg-slate-950/25 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-200">
                            {colleague.fullName}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-slate-500">
                            {colleague.teamNames.join(" · ") || colleague.discipline || "Engineer"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-lg border px-2 py-1 text-[9px] font-semibold ${colleagueStatusTone(colleague)}`}
                        >
                          {colleagueStatusLabel(colleague)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    No other engineers are rostered on this shift.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Link
                  to="/engineer/work"
                  onClick={onClose}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  View my work
                </Link>
                <Link
                  to="/engineer/handover"
                  onClick={onClose}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-700/80 bg-[#030c1d] px-4 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  View shift handover
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className={`${RAISED} p-5`}>
                <span className="inline-flex rounded-lg border border-slate-700/70 bg-slate-800/35 px-2.5 py-1 text-xs font-semibold text-slate-300">
                  Off
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-100">
                  You are not rostered on this date
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  No day or night shift for {engineer.fullName} appears in the loaded rota window.
                </p>
              </div>
              <Link
                to="/engineer/work"
                onClick={onClose}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-700/80 bg-[#030c1d] px-4 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                View my work
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export function EngineerRotaScreen(): JSX.Element {
  const { session, siteContext } = useAuth();
  const initialMonth = startOfMonth(new Date());
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const [windowAnchor, setWindowAnchor] = useState(initialMonth);
  const [requestedMonth, setRequestedMonth] = useState(initialMonth);
  const [loadedAnchor, setLoadedAnchor] = useState<Date | null>(null);
  const [snapshot, setSnapshot] = useState<EngineerRotaWindowSnapshot | null>(null);
  const [calendarSnapshot, setCalendarSnapshot] = useState<EngineerCalendarSnapshot | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [engineer, setEngineer] = useState<EngineerRosterIdentity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const visibleMonthKey = monthKey(visibleMonth);
  const windowAnchorKey = monthKey(windowAnchor);

  useEffect(() => {
    let cancelled = false;

    const resolveIdentity = async (): Promise<void> => {
      setIdentityLoading(true);
      setError(null);
      try {
        const resolvedEngineer = await resolveAuthenticatedEngineerIdentity(session);
        if (!resolvedEngineer) {
          throw new Error(
            "Vorta could not uniquely match this signed-in account to an engineer profile.",
          );
        }
        const authorisedSiteId = siteContext?.siteId ?? resolvedEngineer.siteId;
        if (!authorisedSiteId) {
          throw new Error("No authorised site is available for this engineer.");
        }
        if (
          siteContext?.siteId &&
          resolvedEngineer.siteId &&
          siteContext.siteId !== resolvedEngineer.siteId
        ) {
          throw new Error(
            "The engineer profile does not match the currently authorised site.",
          );
        }
        if (!cancelled) setEngineer(resolvedEngineer);
      } catch (identityError) {
        if (cancelled) return;
        setEngineer(null);
        setSnapshot(null);
        setCalendarSnapshot(null);
        setError(
          identityError instanceof Error
            ? identityError.message
            : "Your engineer profile could not be loaded.",
        );
      } finally {
        if (!cancelled) setIdentityLoading(false);
      }
    };

    void resolveIdentity();
    return () => {
      cancelled = true;
    };
  }, [session, siteContext?.siteId]);

  useEffect(() => {
    if (!engineer) return;
    let cancelled = false;
    const hasExistingContent = Boolean(snapshot);

    const loadWindow = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      setCalendarError(null);
      try {
        const rangeStart = startOfCalendarGrid(windowAnchor);
        const rangeEnd = endOfCalendarGrid(addMonths(windowAnchor, WINDOW_MONTHS - 1));
        const authorisedSiteId = siteContext?.siteId ?? engineer.siteId;
        if (!authorisedSiteId) {
          throw new Error("No authorised site is available for this engineer.");
        }
        const personalCalendarPromise = getMyEngineerCalendar(
          authorisedSiteId,
          dateOnly(rangeStart),
          dateOnly(rangeEnd),
        ).catch((calendarLoadError) => {
          if (!cancelled) {
            setCalendarError(
              calendarLoadError instanceof Error
                ? calendarLoadError.message
                : "Your personal calendar could not be loaded.",
            );
          }
          return null;
        });
        const [data, personalCalendar] = await Promise.all([
          getEngineerRotaWindow(
            engineer.id,
            dateOnly(rangeStart),
            dateOnly(rangeEnd),
          ),
          personalCalendarPromise,
        ]);
        if (cancelled) return;
        setSnapshot(data);
        setCalendarSnapshot(personalCalendar);
        setLoadedAnchor(windowAnchor);
        setVisibleMonth(requestedMonth);
      } catch (loadError) {
        if (cancelled) return;
        if (!hasExistingContent) setSnapshot(null);
        setError(
          loadError instanceof Error ? loadError.message : "Your rota could not be loaded.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadWindow();
    return () => {
      cancelled = true;
    };
  }, [engineer?.id, engineer?.siteId, siteContext?.siteId, windowAnchorKey, reloadToken]);

  useEffect(() => {
    if (!selectedDate) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setSelectedDate(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDate]);

  const calendarDays = useMemo(() => {
    const start = startOfCalendarGrid(visibleMonth);
    const end = endOfCalendarGrid(visibleMonth);
    const days: Date[] = [];
    for (
      let cursor = new Date(start);
      cursor.getTime() <= end.getTime();
      cursor = addDays(cursor, 1)
    ) {
      days.push(cursor);
    }
    return days;
  }, [visibleMonthKey]);

  const personalShifts = useMemo(
    () => [...(snapshot?.calendar ?? [])].sort((a, b) => a.shiftDate.localeCompare(b.shiftDate)),
    [snapshot],
  );

  const shiftByDate = useMemo(() => {
    const entries = new Map<string, EngineerRotaCalendarItem>();
    for (const item of personalShifts) {
      if (!entries.has(item.shiftDate)) entries.set(item.shiftDate, item);
    }
    return entries;
  }, [personalShifts]);

  const calendarEntries = useMemo(
    () =>
      [
        ...(calendarSnapshot?.entries ?? []),
        ...(calendarSnapshot?.formalTraining ?? []),
      ].sort((a, b) => a.entryDate.localeCompare(b.entryDate)),
    [calendarSnapshot],
  );

  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, EngineerCalendarEntry[]>();
    for (const entry of calendarEntries) {
      const existing = grouped.get(entry.entryDate) ?? [];
      grouped.set(entry.entryDate, [...existing, entry]);
    }
    return grouped;
  }, [calendarEntries]);

  const today = new Date();
  const todayKey = dateOnly(today);
  const viewingCurrentMonth = sameMonth(visibleMonth, today);

  const summaryShift = useMemo(() => {
    if (personalShifts.length === 0) return null;
    if (viewingCurrentMonth) {
      return personalShifts.find((item) => item.shiftDate >= todayKey) ?? null;
    }
    const monthStart = dateOnly(startOfMonth(visibleMonth));
    const monthEnd = dateOnly(endOfMonth(visibleMonth));
    return (
      personalShifts.find(
        (item) => item.shiftDate >= monthStart && item.shiftDate <= monthEnd,
      ) ?? null
    );
  }, [personalShifts, todayKey, viewingCurrentMonth, visibleMonthKey]);

  const selectedShift = selectedDate ? shiftByDate.get(selectedDate) ?? null : null;
  const selectedEntries = selectedDate ? entriesByDate.get(selectedDate) ?? [] : [];

  const isMonthLoaded = (target: Date): boolean => {
    if (!loadedAnchor || !snapshot) return false;
    const targetIndex = monthIndex(target);
    const startIndex = monthIndex(loadedAnchor);
    return targetIndex >= startIndex && targetIndex < startIndex + WINDOW_MONTHS;
  };

  const goToMonth = (offset: number): void => {
    if (loading && !snapshot) return;
    const target = addMonths(visibleMonth, offset);
    setSelectedDate(null);
    setRequestedMonth(target);
    if (isMonthLoaded(target)) {
      setVisibleMonth(target);
      return;
    }
    if (!loading) setWindowAnchor(target);
  };

  const goToToday = (): void => {
    const target = startOfMonth(new Date());
    setSelectedDate(null);
    setRequestedMonth(target);
    if (isMonthLoaded(target)) {
      setVisibleMonth(target);
      return;
    }
    if (!loading) setWindowAnchor(target);
  };



  const activeSiteId = siteContext?.siteId ?? engineer?.siteId ?? null;

  const handleSaveCalendarEntry = async (
    input: SaveEngineerCalendarEntryInput,
  ): Promise<void> => {
    if (!activeSiteId) {
      throw new Error("No authorised site is available for this engineer.");
    }
    const saved = await saveMyEngineerCalendarEntry(activeSiteId, input);
    setCalendarSnapshot((current) => {
      const manualEntries = [
        ...(current?.entries ?? []).filter((entry) => entry.id !== saved.id),
        saved,
      ].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
      if (current) return { ...current, entries: manualEntries };
      const anchor = loadedAnchor ?? windowAnchor;
      return {
        engineerId: engineer?.id ?? "",
        startDate: dateOnly(startOfCalendarGrid(anchor)),
        endDate: dateOnly(endOfCalendarGrid(addMonths(anchor, WINDOW_MONTHS - 1))),
        entries: manualEntries,
        formalTraining: [],
      };
    });
  };

  const handleDeleteCalendarEntry = async (entryId: string): Promise<void> => {
    if (!activeSiteId) {
      throw new Error("No authorised site is available for this engineer.");
    }
    await deleteMyEngineerCalendarEntry(activeSiteId, entryId);
    setCalendarSnapshot((current) =>
      current
        ? { ...current, entries: current.entries.filter((entry) => entry.id !== entryId) }
        : current,
    );
  };

  const hasLoadedContent = Boolean(engineer && snapshot);
  const initialLoading = identityLoading || (loading && !snapshot);

  return (
    <div
      data-vorta-page-content="true"
      data-vorta-engineer-rota="true"
      className="min-h-full w-full min-w-0 flex-1"
    >
      <div className={PAGE}>
        <header className="flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-blue-400">
              Engineer
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-50 md:text-2xl">
              My rota
            </h1>
            <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
              Your personal shifts, month at a glance.
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/[0.08] text-blue-300">
            <CalendarDays className="h-5 w-5" />
          </div>
        </header>

        {initialLoading && !hasLoadedContent ? (
          <LoadingCalendar />
        ) : error && !hasLoadedContent ? (
          <section className={`${CARD} p-5`} role="alert">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/[0.08] text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-slate-100">
                  Personal rota unavailable
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadToken((value) => value + 1)}
                  className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-[#07172b] px-3.5 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              </div>
            </div>
          </section>
        ) : engineer && snapshot ? (
          <>
            <section className={`${CARD} overflow-hidden`} aria-busy={loading}>
              <div className="flex items-center justify-between gap-3 border-b border-slate-800/75 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {viewingCurrentMonth ? "Next shift" : "First shift this month"}
                  </p>
                  {summaryShift ? (
                    <div className="mt-1.5 flex min-w-0 items-center gap-2">
                      <span
                        className={`inline-flex shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold ${statusTone(summaryShift)}`}
                      >
                        {personalStatusLabel(summaryShift)}
                      </span>
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {shortDateTitle(summaryShift.shiftDate)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-sm font-semibold text-slate-300">
                      No rostered shift in this view
                    </p>
                  )}
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-medium text-slate-300">12 months loaded</p>
                  <p className="mt-1 text-[11px] text-slate-500">Rota + profile calendar</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4">
                <button
                  type="button"
                  onClick={() => goToMonth(-1)}
                  aria-label="Previous month"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700/75 bg-[#07172b] text-slate-300 transition-colors hover:border-blue-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="min-w-0 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="truncate text-base font-semibold tracking-[-0.02em] text-slate-100">
                      {monthTitle(visibleMonth)}
                    </h2>
                    {loading ? (
                      <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-400" />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={goToToday}
                    className="mt-0.5 text-[11px] font-medium text-blue-400 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    Today
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => goToMonth(1)}
                  aria-label="Next month"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700/75 bg-[#07172b] text-slate-300 transition-colors hover:border-blue-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {calendarError ? (
                <div className="mx-3 mb-2 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-3 py-2 text-[10px] text-blue-100/80 sm:mx-4">
                  Your rota is available, but personal profile entries could not be refreshed.
                </div>
              ) : null}

              {error ? (
                <div className="mx-3 mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[10px] text-amber-100/80 sm:mx-4">
                  <span className="min-w-0 truncate">The next 12-month rota window could not be loaded.</span>
                  <button
                    type="button"
                    onClick={() => setReloadToken((value) => value + 1)}
                    className="shrink-0 font-semibold text-amber-200 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              <div className="px-2 pb-3 sm:px-4 sm:pb-4">
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      className="py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-600 sm:text-[10px]"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
                  {calendarDays.map((date) => {
                    const key = dateOnly(date);
                    const shift = shiftByDate.get(key) ?? null;
                    const inMonth = sameMonth(date, visibleMonth);
                    const isToday = key === todayKey;
                    const attention = shift ? needsAttention(shift) : false;
                    const personalEntries = entriesByDate.get(key) ?? [];

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDate(key)}
                        aria-label={`${fullDateTitle(key)}. ${shift ? personalStatusLabel(shift) : "Off"}`}
                        style={isToday ? { outline: "2px solid #ffffff", outlineOffset: "-2px" } : undefined}
                        className={[
                          "relative flex min-h-[68px] min-w-0 flex-col items-center rounded-xl border px-0.5 py-1.5 text-center transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:min-h-[78px] sm:px-1 sm:py-2",
                          inMonth
                            ? shift
                              ? shiftCellTone(shift)
                              : "border-slate-800/55 bg-[#07172b]/45 hover:border-slate-700/75"
                            : "border-slate-900/80 bg-slate-950/20 opacity-40",
                        ].join(" ")}
                      >
                        <span className={`text-[10px] font-semibold ${isToday ? "text-white" : "text-slate-400"}`}>
                          {date.getDate()}
                        </span>
                        <span
                          className={[
                            "mt-auto inline-flex w-full min-w-0 items-center justify-center rounded-md border px-0.5 py-1 text-[9px] font-semibold leading-none sm:px-1 sm:text-[10px]",
                            shift ? statusTone(shift) : "border-transparent bg-slate-900/30 text-slate-600",
                          ].join(" ")}
                        >
                          {shift ? personalStatusLabel(shift) : "Off"}
                        </span>
                        {personalEntries.length > 0 ? (
                          <span
                            className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500/35"
                            aria-label={`${personalEntries.length} personal profile ${personalEntries.length === 1 ? "entry" : "entries"}`}
                          />
                        ) : null}
                        {attention ? (
                          <span
                            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400"
                            aria-label="Colleague availability clash"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-800/65 pt-3 text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-sm border border-blue-400/50 bg-blue-500/35" /> Day
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-sm border border-indigo-400/50 bg-indigo-500/35" /> Night
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-sm bg-slate-800/60" /> Off
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-blue-500/35" /> My entry
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-amber-400" /> Availability clash
                  </span>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2.5">
              <div className={`${RAISED} p-3.5`}>
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock3 className="h-4 w-4" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Pattern</p>
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-slate-200">
                  {engineer.shiftPattern || "From live rota"}
                </p>
              </div>
              <div className={`${RAISED} p-3.5`}>
                <div className="flex items-center gap-2 text-slate-500">
                  <ShieldCheck className="h-4 w-4" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Source</p>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-200">Verified rota</p>
              </div>
            </section>
          </>
        ) : null}
      </div>

      {selectedDate && engineer && typeof document !== "undefined"
        ? createPortal(
            <DaySheet
              date={selectedDate}
              engineer={engineer}
              shift={selectedShift}
              entries={selectedEntries}
              onSaveEntry={handleSaveCalendarEntry}
              onDeleteEntry={handleDeleteCalendarEntry}
              onClose={() => setSelectedDate(null)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
