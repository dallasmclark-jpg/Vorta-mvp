import { ShieldAlert } from "lucide-react";
import { EmptyState } from "./EmptyState";

interface PrototypePortalUnavailableProps {
  portalName: string;
  capability: string;
}

export function PrototypePortalUnavailable({
  portalName,
  capability,
}: PrototypePortalUnavailableProps): JSX.Element {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-slate-300">{portalName}</p>
        <p className="max-w-xs text-sm text-slate-500">{capability}</p>
      </div>

      <p className="text-sm font-semibold text-slate-300">
        Prototype · non-operational
      </p>

      <EmptyState
        icon={ShieldAlert}
        title="Operational data is not connected for this role yet"
        description="Vorta is deliberately hiding prototype KPIs, assignments, competencies and recommendations on this route rather than presenting sample values as current operational evidence."
      />

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-slate-300">Evidence state</p>
        <p className="max-w-xs text-sm text-slate-500">
          No approved live role-specific data feed is connected to this view. No sync time, confidence score or operational KPI is being inferred.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-slate-300">Access boundary</p>
        <p className="max-w-xs text-sm text-slate-500">
          The authenticated organisation, site and role boundary remains enforced. Live content will appear only after scoped services and release evidence are verified.
        </p>
      </div>
    </section>
  );
}
