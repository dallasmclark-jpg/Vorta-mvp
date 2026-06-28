import { ArrowRight, LucideIcon, Sparkles } from "lucide-react";

export interface AiAction {
  label: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  icon?: LucideIcon;
  /** Optional nav href — if provided renders as a link hint */
  href?: string;
  onClick?: () => void;
}

interface AiActionsPanelProps {
  actions: AiAction[];
  className?: string;
}

const priorityStyle: Record<AiAction["priority"], { badge: string; dot: string }> = {
  critical: { badge: "bg-[#ef444418] text-red-400 border border-red-500/20",   dot: "bg-red-500"    },
  high:     { badge: "bg-[#f9731618] text-orange-400 border border-orange-500/20", dot: "bg-orange-400" },
  medium:   { badge: "bg-[#facc1518] text-yellow-400 border border-yellow-500/20", dot: "bg-yellow-400" },
  low:      { badge: "bg-[#10b98118] text-emerald-400 border border-emerald-500/20", dot: "bg-emerald-400" },
};

export const AiActionsPanel = ({ actions, className = "" }: AiActionsPanelProps): JSX.Element => {
  if (!actions.length) return <></>;

  return (
    <div className={`w-full rounded-xl border border-[#3b82f620] bg-[#0d1523] p-4 md:p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
        <span className="text-sm font-semibold text-slate-200">AI Suggested Actions</span>
        <span className="ml-auto text-[11px] text-slate-500">{actions.length} recommendation{actions.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((a, i) => {
          const style  = priorityStyle[a.priority];
          const Icon   = a.icon;
          const isLink = !!a.href;

          const inner = (
            <div className="flex h-full flex-col gap-2 rounded-lg border border-gray-800 bg-[#111620] p-3 transition-colors hover:border-[#3b82f640] hover:bg-[#141b2a]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                    {a.priority}
                  </span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold leading-snug text-slate-200">{a.label}</p>
              <p className="text-[11px] leading-relaxed text-slate-500">{a.description}</p>
            </div>
          );

          return isLink ? (
            <a key={i} href={a.href} className="block h-full no-underline" aria-label={a.label}>
              {inner}
            </a>
          ) : (
            <button key={i} type="button" onClick={a.onClick} className="block h-full w-full text-left" aria-label={a.label}>
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
};
