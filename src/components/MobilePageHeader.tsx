import { RefreshCw, type LucideIcon } from "lucide-react";

interface MobilePageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  busy?: boolean;
  onAction?: () => void;
}

export function MobilePageHeader({
  eyebrow,
  title,
  description,
  badge,
  actionLabel = "Refresh",
  actionIcon: ActionIcon = RefreshCw,
  busy = false,
  onAction,
}: MobilePageHeaderProps): JSX.Element {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-gray-800 pb-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
            {eyebrow}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1
            data-vorta-mobile-page-title="true"
            aria-hidden="true"
            className="text-xl font-semibold tracking-tight text-slate-50"
          >
            {title}
          </h1>
          {badge ? (
            <span className="rounded-md border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-300">
              {badge}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
        ) : null}
      </div>

      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          aria-label={actionLabel}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-800 bg-[#141820] text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:cursor-wait disabled:opacity-50"
        >
          <ActionIcon className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      ) : null}
    </header>
  );
}
