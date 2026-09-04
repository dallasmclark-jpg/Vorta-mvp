import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Clock3, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import {
  getMyEngineerCalendar,
  type EngineerCalendarEntry,
  type EngineerCalendarEntryType,
} from "./engineerCalendarService";

const CARD =
  "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.22)]";

function dateOnly(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function activityTypeLabel(value: EngineerCalendarEntryType): string {
  switch (value) {
    case "training":
      return "Training";
    case "overtime":
      return "Overtime";
    case "annual_leave":
      return "Annual leave";
    case "appointment":
      return "Appointment";
    case "shift_cover":
      return "Shift cover";
    case "development":
      return "Development";
    case "other":
      return "Other";
    default:
      return "Note";
  }
}

function displayDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function EngineerProfileActivityTimeline(): JSX.Element | null {
  const { siteContext } = useAuth();
  const siteId = siteContext?.siteId ?? null;
  const [entries, setEntries] = useState<EngineerCalendarEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!siteId) {
      setEntries([]);
      return;
    }

    let alive = true;
    const now = new Date();
    const start = dateOnly(new Date(now.getFullYear(), 0, 1));
    const end = dateOnly(new Date(now.getFullYear(), 11, 31));
    setLoading(true);

    void getMyEngineerCalendar(siteId, start, end)
      .then((snapshot) => {
        if (!alive) return;
        setEntries([...snapshot.entries, ...snapshot.formalTraining]);
      })
      .catch(() => {
        if (alive) setEntries([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [siteId]);

  const activity = useMemo(
    () =>
      [...entries]
        .filter((entry) => entry.status !== "cancelled")
        .sort((left, right) => {
          const dateOrder = right.entryDate.localeCompare(left.entryDate);
          if (dateOrder !== 0) return dateOrder;
          return String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? ""));
        })
        .slice(0, 8),
    [entries],
  );

  if (!siteId) return null;

  return (
    <section className="mx-auto -mt-6 w-full max-w-[1040px] px-3 pb-10 sm:px-5 md:-mt-8 md:px-6 md:pb-12">
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/70 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-300">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-100">My calendar activity</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Notes, training, overtime, cover and development saved to your engineer profile.
              </p>
            </div>
          </div>
          <Link
            to="/engineer/rota"
            className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-blue-400 transition-colors hover:text-blue-300"
          >
            Calendar
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2.5 p-4 sm:p-5" aria-live="polite">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl border border-slate-800/70 bg-slate-900/35" />
            ))}
          </div>
        ) : activity.length > 0 ? (
          <div className="divide-y divide-slate-800/65">
            {activity.map((entry) => (
              <div key={`${entry.source ?? "vorta"}-${entry.id}`} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-800/70 bg-[#07172b] text-slate-400">
                  {entry.equipmentName ? <Wrench className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-blue-400">
                      {activityTypeLabel(entry.entryType)}
                    </span>
                    <span className="text-[10px] text-slate-600">{displayDate(entry.entryDate)}</span>
                    <span className="text-[10px] capitalize text-slate-600">{entry.status}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-200">{entry.title}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                    {entry.equipmentName ? <span>{entry.equipmentName}</span> : null}
                    {entry.hours !== null ? <span>{entry.hours} hours</span> : null}
                    {entry.source === "training_booking" ? <span>Training booking</span> : <span>Profile activity</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-5 sm:px-5">
            <p className="text-xs leading-5 text-slate-500">
              No personal calendar activity has been saved for this year yet.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
