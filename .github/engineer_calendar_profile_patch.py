from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected patch target not found: {label}")
    return text.replace(old, new, 1)


# Fix deterministic personal-calendar handler formatting.
p = Path("netlify/functions/ask-vorta/runtime-personal-calendar.mts")
s = p.read_text()
s = replace_once(
    s,
    '`, totalling ${workedHours:g} hours`.replace(":g", "")',
    '`, totalling ${workedHours} hours`',
    "personal calendar overtime hours",
)
p.write_text(s)

# Put the personal Engineer calendar handler in front of Ask Vorta.
p = Path("netlify/functions/ask-vorta.mts")
s = p.read_text()
s = replace_once(
    s,
    'import handler, {\n  ASK_VORTA_DOCUMENT_LINK_REVISION,\n} from "./ask-vorta/runtime-document-links.mjs";',
    'import handler from "./ask-vorta/runtime-personal-calendar.mjs";\nimport {\n  ASK_VORTA_DOCUMENT_LINK_REVISION,\n} from "./ask-vorta/runtime-document-links.mjs";',
    "Ask Vorta personal calendar wrapper",
)
p.write_text(s)

p = Path("src/screens/EngineerPortal/EngineerRotaScreen.tsx")
s = p.read_text()

s = replace_once(
    s,
    "  Clock3,\n  RefreshCw,\n  ShieldCheck,\n  Users,\n  X,",
    "  Clock3,\n  Plus,\n  RefreshCw,\n  ShieldCheck,\n  Trash2,\n  Users,\n  X,",
    "rota icons",
)

s = replace_once(
    s,
    '} from "./engineerRotaService";\nimport {\n  resolveAuthenticatedEngineerIdentity,',
    '} from "./engineerRotaService";\nimport {\n  deleteMyEngineerCalendarEntry,\n  getMyEngineerCalendar,\n  saveMyEngineerCalendarEntry,\n  type EngineerCalendarEntry,\n  type EngineerCalendarEntryStatus,\n  type EngineerCalendarEntryType,\n  type EngineerCalendarSnapshot,\n  type SaveEngineerCalendarEntryInput,\n} from "./engineerCalendarService";\nimport {\n  resolveAuthenticatedEngineerIdentity,',
    "calendar service import",
)

component = r'''
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

function calendarEntryTone(value: EngineerCalendarEntryType): string {
  switch (value) {
    case "training":
      return "border-violet-400/30 bg-violet-500/[0.10] text-violet-200";
    case "overtime":
      return "border-cyan-400/30 bg-cyan-500/[0.10] text-cyan-200";
    case "annual_leave":
      return "border-amber-400/30 bg-amber-500/[0.10] text-amber-200";
    case "appointment":
      return "border-pink-400/30 bg-pink-500/[0.10] text-pink-200";
    case "other":
      return "border-slate-600/60 bg-slate-800/45 text-slate-300";
    default:
      return "border-blue-400/30 bg-blue-500/[0.10] text-blue-200";
  }
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
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-blue-500/25 bg-blue-500/[0.08] px-3 text-xs font-semibold text-blue-200 transition-colors hover:border-blue-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800/70 text-slate-500 transition-colors hover:border-red-400/35 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
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
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-700/80 bg-[#030c1d] px-3 text-xs font-medium normal-case tracking-normal text-slate-200 outline-none focus:border-blue-400/60"
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
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-700/80 bg-[#030c1d] px-3 text-xs font-medium normal-case tracking-normal text-slate-200 outline-none focus:border-blue-400/60"
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
            className="h-11 w-full rounded-xl border border-slate-700/80 bg-[#030c1d] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-400/60"
          />

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Optional notes"
            className="w-full resize-none rounded-xl border border-slate-700/80 bg-[#030c1d] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-400/60"
          />

          <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Hours <span className="normal-case tracking-normal text-slate-600">optional</span>
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              placeholder="e.g. 12"
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-700/80 bg-[#030c1d] px-3 text-sm font-medium normal-case tracking-normal text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-400/60"
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

'''

s = replace_once(
    s,
    "interface DaySheetProps {\n",
    component + "interface DaySheetProps {\n",
    "personal calendar section",
)

s = replace_once(
    s,
    'interface DaySheetProps {\n  date: string;\n  engineer: EngineerRosterIdentity;\n  shift: EngineerRotaCalendarItem | null;\n  onClose: () => void;\n}\n\nfunction DaySheet({ date, engineer, shift, onClose }: DaySheetProps): JSX.Element {',
    'interface DaySheetProps {\n  date: string;\n  engineer: EngineerRosterIdentity;\n  shift: EngineerRotaCalendarItem | null;\n  entries: EngineerCalendarEntry[];\n  onSaveEntry: (input: SaveEngineerCalendarEntryInput) => Promise<void>;\n  onDeleteEntry: (entryId: string) => Promise<void>;\n  onClose: () => void;\n}\n\nfunction DaySheet({\n  date,\n  engineer,\n  shift,\n  entries,\n  onSaveEntry,\n  onDeleteEntry,\n  onClose,\n}: DaySheetProps): JSX.Element {',
    "day sheet props",
)

s = replace_once(
    s,
    '        <div className="space-y-4 px-4 py-5 sm:px-5">\n          {shift ? (',
    '        <div className="space-y-4 px-4 py-5 sm:px-5">\n          <PersonalCalendarSection\n            date={date}\n            entries={entries}\n            shiftType={shift?.shiftType ?? null}\n            onSave={onSaveEntry}\n            onDelete={onDeleteEntry}\n          />\n\n          {shift ? (',
    "day sheet personal calendar placement",
)

s = replace_once(
    s,
    "  const [snapshot, setSnapshot] = useState<EngineerRotaWindowSnapshot | null>(null);\n  const [engineer, setEngineer] = useState<EngineerRosterIdentity | null>(null);",
    "  const [snapshot, setSnapshot] = useState<EngineerRotaWindowSnapshot | null>(null);\n  const [calendarSnapshot, setCalendarSnapshot] = useState<EngineerCalendarSnapshot | null>(null);\n  const [calendarError, setCalendarError] = useState<string | null>(null);\n  const [engineer, setEngineer] = useState<EngineerRosterIdentity | null>(null);",
    "calendar state",
)

s = replace_once(
    s,
    "        setEngineer(null);\n        setSnapshot(null);\n        setError(",
    "        setEngineer(null);\n        setSnapshot(null);\n        setCalendarSnapshot(null);\n        setError(",
    "identity calendar reset",
)

s = replace_once(
    s,
    "    const loadWindow = async (): Promise<void> => {\n      setLoading(true);\n      setError(null);\n      try {",
    "    const loadWindow = async (): Promise<void> => {\n      setLoading(true);\n      setError(null);\n      setCalendarError(null);\n      try {",
    "calendar load error reset",
)

old_load = '''        const data = await getEngineerRotaWindow(
          engineer.id,
          dateOnly(rangeStart),
          dateOnly(rangeEnd),
        );
        if (cancelled) return;
        setSnapshot(data);
        setLoadedAnchor(windowAnchor);
        setVisibleMonth(requestedMonth);'''
new_load = '''        const authorisedSiteId = siteContext?.siteId ?? engineer.siteId;
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
        setVisibleMonth(requestedMonth);'''
s = replace_once(s, old_load, new_load, "parallel 12-month calendar load")

s = replace_once(
    s,
    "  }, [engineer?.id, windowAnchorKey, reloadToken]);",
    "  }, [engineer?.id, engineer?.siteId, siteContext?.siteId, windowAnchorKey, reloadToken]);",
    "window load dependencies",
)

calendar_memos = r'''

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
'''
s = replace_once(
    s,
    "  }, [personalShifts]);\n\n  const today = new Date();",
    "  }, [personalShifts]);" + calendar_memos + "\n  const today = new Date();",
    "calendar entry memos",
)

s = replace_once(
    s,
    "  const selectedShift = selectedDate ? shiftByDate.get(selectedDate) ?? null : null;\n",
    "  const selectedShift = selectedDate ? shiftByDate.get(selectedDate) ?? null : null;\n  const selectedEntries = selectedDate ? entriesByDate.get(selectedDate) ?? [] : [];\n",
    "selected personal entries",
)

handlers = r'''

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
'''
s = replace_once(
    s,
    "  const hasLoadedContent = Boolean(engineer && snapshot);",
    handlers + "\n  const hasLoadedContent = Boolean(engineer && snapshot);",
    "calendar save handlers",
)

s = replace_once(
    s,
    '                  <p className="mt-1 text-[11px] text-slate-500">Rota + shift availability</p>',
    '                  <p className="mt-1 text-[11px] text-slate-500">Rota + profile calendar</p>',
    "header profile calendar text",
)

s = replace_once(
    s,
    '              {error ? (\n                <div className="mx-3 mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[10px] text-amber-100/80 sm:mx-4">',
    '              {calendarError ? (\n                <div className="mx-3 mb-2 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-3 py-2 text-[10px] text-blue-100/80 sm:mx-4">\n                  Your rota is available, but personal profile entries could not be refreshed.\n                </div>\n              ) : null}\n\n              {error ? (\n                <div className="mx-3 mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[10px] text-amber-100/80 sm:mx-4">',
    "calendar nonblocking error banner",
)

s = replace_once(
    s,
    "                    const attention = shift ? needsAttention(shift) : false;\n\n                    return (",
    "                    const attention = shift ? needsAttention(shift) : false;\n                    const personalEntries = entriesByDate.get(key) ?? [];\n\n                    return (",
    "calendar cell personal entries",
)

s = replace_once(
    s,
    '                        {attention ? (\n                          <span\n                            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400"',
    '                        {personalEntries.length > 0 ? (\n                          <span\n                            className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-cyan-300"\n                            aria-label={`${personalEntries.length} personal profile ${personalEntries.length === 1 ? "entry" : "entries"}`}\n                          />\n                        ) : null}\n                        {attention ? (\n                          <span\n                            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400"',
    "calendar personal entry dot",
)

s = replace_once(
    s,
    '                  <span className="inline-flex items-center gap-1.5">\n                    <i className="h-2 w-2 rounded-sm bg-slate-800/60" /> Off\n                  </span>\n                  <span className="inline-flex items-center gap-1.5">\n                    <i className="h-2 w-2 rounded-full bg-amber-400" /> Availability clash',
    '                  <span className="inline-flex items-center gap-1.5">\n                    <i className="h-2 w-2 rounded-sm bg-slate-800/60" /> Off\n                  </span>\n                  <span className="inline-flex items-center gap-1.5">\n                    <i className="h-2 w-2 rounded-full bg-cyan-300" /> My entry\n                  </span>\n                  <span className="inline-flex items-center gap-1.5">\n                    <i className="h-2 w-2 rounded-full bg-amber-400" /> Availability clash',
    "calendar legend personal entry",
)

s = replace_once(
    s,
    "              shift={selectedShift}\n              onClose={() => setSelectedDate(null)}",
    "              shift={selectedShift}\n              entries={selectedEntries}\n              onSaveEntry={handleSaveCalendarEntry}\n              onDeleteEntry={handleDeleteCalendarEntry}\n              onClose={() => setSelectedDate(null)}",
    "day sheet calendar handlers",
)

p.write_text(s)
