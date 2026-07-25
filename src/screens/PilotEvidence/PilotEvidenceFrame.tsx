import type { ReactNode } from "react";
import { BarChart3, ChevronRight, Gauge } from "lucide-react";
import { NavLink } from "react-router-dom";

interface PilotEvidenceFrameProps {
  active: "impact" | "adoption";
  children: ReactNode;
}

const tabs = [
  {
    key: "impact" as const,
    label: "Impact",
    detail: "Risk and capability movement",
    to: "/pilot-impact",
    icon: BarChart3,
  },
  {
    key: "adoption" as const,
    label: "Adoption",
    detail: "Usage and workflow depth",
    to: "/pilot-adoption",
    icon: Gauge,
  },
];

export function PilotEvidenceFrame({ active, children }: PilotEvidenceFrameProps): JSX.Element {
  return (
    <div className="min-w-0" data-vorta-pilot-evidence-workspace="true">
      <nav
        aria-label="Pilot evidence views"
        data-vorta-pilot-evidence-tabs="true"
        className="flex gap-2 px-4 pt-4 md:px-6 xl:px-8"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = tab.key === active;
          return (
            <NavLink
              key={tab.key}
              to={tab.to}
              aria-current={selected ? "page" : undefined}
              className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 transition-colors md:max-w-xs ${
                selected
                  ? "border-blue-500/35 bg-blue-500/10 text-blue-200"
                  : "border-gray-800 bg-[#141820] text-slate-400 hover:border-gray-700 hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{tab.label}</span>
                <span className="hidden truncate text-[10px] text-slate-500 sm:block">{tab.detail}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
            </NavLink>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
