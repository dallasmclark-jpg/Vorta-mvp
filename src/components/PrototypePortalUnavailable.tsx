import { Database, LockKeyhole, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "./ui/card";

interface PrototypePortalUnavailableProps {
  portalName: string;
  capability: string;
}

export function PrototypePortalUnavailable({
  portalName,
  capability,
}: PrototypePortalUnavailableProps): JSX.Element {
  return (
    <section className="flex min-w-0 w-full flex-col px-4 pb-16 pt-0 md:px-6 xl:px-8">
      <header className="py-5">
        <p className="text-xs font-medium text-slate-500">{portalName}</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">{capability}</h1>
      </header>

      <Card className="max-w-3xl rounded-xl border border-amber-500/25 bg-[#141820] shadow-none">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.08] p-2">
              <ShieldAlert className="h-5 w-5 text-amber-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="inline-flex rounded-full border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                Prototype · non-operational
              </span>
              <h2 className="mt-3 text-base font-semibold text-slate-100">
                Operational data is not connected for this role yet
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Vorta is deliberately hiding prototype KPIs, assignments, competencies and recommendations on this route rather than presenting sample values as current operational evidence.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-[#10151c] p-4">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <p className="text-xs font-semibold text-slate-200">Evidence state</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                No approved live role-specific data feed is connected to this view. No sync time, confidence score or operational KPI is being inferred.
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#10151c] p-4">
              <div className="flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <p className="text-xs font-semibold text-slate-200">Access boundary</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                The authenticated organisation, site and role boundary remains enforced. Live content will appear only after scoped services and release evidence are verified.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
