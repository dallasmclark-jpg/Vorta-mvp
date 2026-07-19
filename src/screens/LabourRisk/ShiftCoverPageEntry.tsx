import { FlaskConical } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { LiveShiftCoverPage } from "./LiveShiftCoverPage";

export function ShiftCoverPageEntry(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));

  return (
    <div
      className="contents"
      data-vorta-shift-cover-mode={dataMode}
    >
      <style>{`
        [data-vorta-shift-cover-mode="demo"]
          > section
          > header
          h1
          + span {
          display: none !important;
        }
      `}</style>

      {dataMode === "demo" ? (
        <aside
          role="status"
          className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-amber-100 md:mx-6 xl:mx-8"
        >
          <FlaskConical
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-bold tracking-[0.12em] text-amber-200">
              DEMO ROTA
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-100/70">
              The calendar is loaded from the demonstration site database. Its engineers, shortages and recommendations are not verified pilot evidence.
            </p>
          </div>
        </aside>
      ) : null}

      <LiveShiftCoverPage />
    </div>
  );
}
