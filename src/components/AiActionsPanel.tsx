import { useState } from "react";
import { ArrowRight, Check, LucideIcon, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "./Toast";

export interface AiAction {
  label: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  icon?: LucideIcon;
  /** Optional nav href — if provided card body navigates there */
  href?: string;
  onClick?: () => void;
}

interface AiActionsPanelProps {
  actions: AiAction[];
  className?: string;
  /** Called when Review is clicked on a card — use to open a detail panel */
  onReview?: (action: AiAction) => void;
}

const priorityStyle: Record<AiAction["priority"], { badge: string; dot: string }> = {
  critical: { badge: "bg-[#ef444418] text-red-400 border border-red-500/20",         dot: "bg-red-500"    },
  high:     { badge: "bg-[#f9731618] text-orange-400 border border-orange-500/20",   dot: "bg-orange-400" },
  medium:   { badge: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20",   dot: "bg-yellow-400" },
  low:      { badge: "bg-[#10b98118] text-emerald-400 border border-emerald-500/20", dot: "bg-emerald-400" },
};

interface ActionCardProps {
  action: AiAction;
  onReview?: (action: AiAction) => void;
}

function ActionCard({ action: a, onReview }: ActionCardProps) {
  const toast    = useToast();
  const navigate = useNavigate();
  const style    = priorityStyle[a.priority];
  const Icon     = a.icon;

  const [accepted,  setAccepted]  = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  function accept() {
    setAccepted(true);
    toast({ type: "success", message: `Accepted: ${a.label}` });
  }
  function dismiss() {
    setDismissed(true);
    toast({ type: "info", message: `Dismissed: ${a.label}` });
  }
  function review() {
    if (onReview) {
      onReview(a);
    } else {
      toast({ type: "info", message: `Reviewing: ${a.label}` });
      if (a.href) navigate(a.href);
    }
  }

  return (
    <div
      role={accepted ? undefined : "button"}
      tabIndex={accepted ? undefined : 0}
      aria-label={a.label}
      onClick={() => { if (!accepted && a.href) navigate(a.href); }}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !accepted && a.href) { e.preventDefault(); navigate(a.href); } }}
      className={[
        "flex h-full flex-col gap-2 rounded-lg border p-3 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50",
        accepted
          ? "border-emerald-500/20 bg-[#10b98108] opacity-60 cursor-default"
          : "border-gray-800 bg-[#111620] hover:border-[#3b82f640] hover:bg-[#141b2a] cursor-pointer",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {accepted ? "done" : a.priority}
          </span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
      </div>
      <p className={`text-xs font-semibold leading-snug ${accepted ? "line-through text-slate-500" : "text-slate-200"}`}>
        {a.label}
      </p>
      <p className="flex-1 text-[11px] leading-relaxed text-slate-500">{a.description}</p>

      <div className="mt-1 flex items-center gap-1.5 border-t border-gray-800/60 pt-2">
        {accepted ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500">
            <Check className="h-3 w-3" aria-hidden /> Accepted
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); accept(); }}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              aria-label={`Accept: ${a.label}`}
            >
              <Check className="h-3 w-3" aria-hidden /> Accept
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); review(); }}
              className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-400 transition-colors hover:bg-blue-500/20"
              aria-label={`Review: ${a.label}`}
            >
              Review
            </button>
          </>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-[#ffffff08] hover:text-slate-400"
          aria-label={`Dismiss: ${a.label}`}
        >
          <X className="h-3 w-3" aria-hidden /> Dismiss
        </button>
      </div>
    </div>
  );
}

export const AiActionsPanel = ({ actions, className = "", onReview }: AiActionsPanelProps): JSX.Element => {
  if (!actions.length) return <></>;

  return (
    <div className={`w-full rounded-xl border border-[#3b82f620] bg-[#0d1523] p-4 md:p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
        <span className="text-sm font-semibold text-slate-200">AI Suggested Actions</span>
        <span className="ml-auto text-[11px] text-slate-500">{actions.length} recommendation{actions.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((a, i) => (
          <div key={i} className="h-full motion-safe:animate-card-enter" style={{ animationDelay: `${i * 60}ms` }}>
            <ActionCard action={a} onReview={onReview} />
          </div>
        ))}
      </div>
    </div>
  );
};
