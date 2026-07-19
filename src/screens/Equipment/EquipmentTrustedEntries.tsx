import { AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { getConfiguredDataMode } from "../../lib/dataTrust";
import { EquipmentAiInsights } from "./EquipmentAiInsights";
import { EquipmentDocuments } from "./EquipmentDocuments";
import { EquipmentHistory } from "./EquipmentHistory";
import {
  EquipmentTabNavigation,
  type EquipmentTabRoute,
} from "./EquipmentTabNavigation";

function LiveEvidenceUnavailable({
  title,
  activeTab,
  detail,
}: {
  title: string;
  activeTab: EquipmentTabRoute;
  detail: string;
}): JSX.Element {
  const navigate = useNavigate();
  const { equipmentId = "" } = useParams();

  return (
    <section className="flex w-full flex-col gap-5 px-4 pb-12 pt-4 md:px-6 xl:px-8">
      <header className="border-b border-gray-800 pb-4">
        <button
          type="button"
          onClick={() => navigate("/equipment")}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Equipment
        </button>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-50">{title}</h1>
          <span className="rounded-md border border-red-500/25 bg-red-500/10 px-2 py-1 text-[11px] font-bold tracking-[0.12em] text-red-300">
            LIVE EVIDENCE UNAVAILABLE
          </span>
        </div>
        {equipmentId ? (
          <EquipmentTabNavigation
            equipmentId={equipmentId}
            activeTab={activeTab}
          />
        ) : null}
      </header>

      <div
        role="alert"
        className="rounded-xl border border-red-500/30 bg-red-500/[0.07] p-5"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-100">
              This workflow is withheld in live mode
            </p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-red-100/75">
              {detail}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Vorta has deliberately not substituted its legacy demonstration records. The page will become available when its source contract is verified against the active site.
            </p>
          </div>
        </div>
      </div>

      <aside className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        <div>
          <p className="text-sm font-semibold text-emerald-200">
            Data-trust protection is active
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-100/65">
            Other verified equipment workflows remain available through the tabs above.
          </p>
        </div>
      </aside>
    </section>
  );
}

export function EquipmentHistoryEntry(): JSX.Element {
  return getConfiguredDataMode() === "demo" ? (
    <EquipmentHistory />
  ) : (
    <LiveEvidenceUnavailable
      title="Equipment History"
      activeTab="history"
      detail="The legacy History service can still produce demonstration activity when a live query fails, so it is not permitted to render during a live pilot."
    />
  );
}

export function EquipmentDocumentsEntry(): JSX.Element {
  return getConfiguredDataMode() === "demo" ? (
    <EquipmentDocuments />
  ) : (
    <LiveEvidenceUnavailable
      title="Equipment Documents"
      activeTab="documents"
      detail="The document index must prove that every result belongs to the active site and current equipment before this page can be exposed as live evidence."
    />
  );
}

export function EquipmentAiInsightsEntry(): JSX.Element {
  return getConfiguredDataMode() === "demo" ? (
    <EquipmentAiInsights />
  ) : (
    <LiveEvidenceUnavailable
      title="Equipment AI Insights"
      activeTab="ai-insights"
      detail="AI insights are hidden until every cited document, work order and equipment record is guaranteed to come from the authorised live-site context."
    />
  );
}
