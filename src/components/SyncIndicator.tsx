import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";

interface SyncIndicatorProps {
  /** ISO string or Date — when the data was last fetched. Omit to auto-track mount time. */
  syncedAt?: Date | string | null;
  /** E.g. "Supabase" */
  source?: string;
  /** 0–100 */
  confidence?: number;
  loading?: boolean;
  className?: string;
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 10)  return "just now";
  if (secs < 60)  return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export const SyncIndicator = ({
  syncedAt,
  source = "Supabase",
  confidence,
  loading = false,
  className = "",
}: SyncIndicatorProps): JSX.Element => {
  const [, setTick] = useState(0);

  // Re-render every 30s so "X ago" stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const date = syncedAt ? new Date(syncedAt) : null;
  const label = loading
    ? "Syncing…"
    : date
    ? `Synced ${timeAgo(date)}`
    : "Live";

  return (
    <div className={`flex flex-wrap items-center gap-3 text-[11px] text-slate-500 ${className}`}>
      <span className="flex items-center gap-1.5">
        {loading ? (
          <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />
        ) : (
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        )}
        {label}
      </span>
      <span className="text-slate-700">·</span>
      <span>{source}</span>
      {confidence !== undefined && (
        <>
          <span className="text-slate-700">·</span>
          <span className={confidence >= 80 ? "text-emerald-500" : confidence >= 60 ? "text-yellow-400" : "text-red-400"}>
            AI {confidence}% confidence
          </span>
        </>
      )}
    </div>
  );
};
