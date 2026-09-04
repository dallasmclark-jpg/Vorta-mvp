import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Clock3, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import {
  getMyEngineerCalendar,
  type EngineerCalendarEntry,
  type EngineerCalendarEntryType,
} from "./engineerCalendarService";

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

  const iconStyle = { width: 16, height: 16, flex: "0 0 auto" } as const;

  return (
    <section
      style={{
        width: "100%",
        maxWidth: 1040,
        margin: "-24px auto 0",
        padding: "0 12px 40px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          overflow: "hidden",
          borderRadius: 16,
          border: "1px solid #1e293b",
          background: "#020617",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderBottom: "1px solid #1e293b",
            padding: 16,
          }}
        >
          <div style={{ display: "flex", minWidth: 0, alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "grid",
                width: 36,
                height: 36,
                flex: "0 0 36px",
                placeItems: "center",
                borderRadius: 8,
                border: "1px solid #3b82f6",
                background: "#172554",
                color: "#93c5fd",
              }}
            >
              <CalendarDays style={iconStyle} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, color: "#f1f5f9", fontSize: 14, fontWeight: 600 }}>
                My calendar activity
              </h2>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>
                Notes, training, overtime, cover and development saved to your engineer profile.
              </p>
            </div>
          </div>
          <Link
            to="/engineer/rota"
            style={{
              display: "inline-flex",
              flex: "0 0 auto",
              alignItems: "center",
              gap: 4,
              color: "#60a5fa",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Calendar
            <ChevronRight style={iconStyle} />
          </Link>
        </div>

        {loading ? (
          <div style={{ display: "grid", gap: 8, padding: 16 }} aria-live="polite">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                style={{
                  height: 64,
                  borderRadius: 12,
                  border: "1px solid #1e293b",
                  background: "#0f172a",
                  opacity: 0.72,
                }}
              />
            ))}
          </div>
        ) : activity.length > 0 ? (
          <div>
            {activity.map((entry, index) => (
              <div
                key={`${entry.source ?? "vorta"}-${entry.id}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: 16,
                  borderTop: index === 0 ? undefined : "1px solid #1e293b",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    width: 32,
                    height: 32,
                    flex: "0 0 32px",
                    placeItems: "center",
                    borderRadius: 8,
                    border: "1px solid #1e293b",
                    background: "#0f172a",
                    color: "#94a3b8",
                  }}
                >
                  {entry.equipmentName ? <Wrench style={iconStyle} /> : <Clock3 style={iconStyle} />}
                </div>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        color: "#60a5fa",
                        fontSize: 12,
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      {activityTypeLabel(entry.entryType)}
                    </span>
                    <span style={{ color: "#475569", fontSize: 12 }}>{displayDate(entry.entryDate)}</span>
                    <span style={{ color: "#475569", fontSize: 12, textTransform: "capitalize" }}>
                      {entry.status}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>
                    {entry.title}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginTop: 4,
                      color: "#64748b",
                      fontSize: 12,
                    }}
                  >
                    {entry.equipmentName ? <span>{entry.equipmentName}</span> : null}
                    {entry.hours !== null ? <span>{entry.hours} hours</span> : null}
                    {entry.source === "training_booking" ? <span>Training booking</span> : <span>Profile activity</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 16 }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>
              No personal calendar activity has been saved for this year yet.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
