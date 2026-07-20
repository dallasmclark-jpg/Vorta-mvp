import {
  ChevronDown,
  ChevronRight,
  History,
  Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { LiveEquipmentRecord } from "./equipmentLiveTrust";
import {
  buildWorkEvidenceCitation,
  loadLiveEquipmentHistory,
} from "./equipmentPilotEvidence";
import { WorkEvidenceDetails } from "./EquipmentWorkEvidenceDetails";
import {
  AskVortaButton,
  EvidenceStateMessage,
  LoadingEvidence,
  Metric,
  PageFrame,
  RefreshButton,
  formatDate,
  statusTone,
  usePilotEvidence,
} from "./EquipmentPilotEvidenceShared";

export function LiveEquipmentHistoryView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const loader = useCallback(() => loadLiveEquipmentHistory(record.id), [record.id]);
  const { state, loading, reload } = usePilotEvidence(loader);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const rows = state?.status === "ready" ? state.data : [];
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter((item) =>
      [item.workOrderNumber, item.description, item.workType, item.status, item.outcome, item.faultCode]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [query, rows]);
  const confirmations = rows.reduce((sum, item) => sum + item.confirmationCount, 0);
  const reservations = rows.reduce((sum, item) => sum + item.reservationCount, 0);
  const movements = rows.reduce((sum, item) => sum + item.goodsMovementCount, 0);
  const promptCitations = rows.slice(0, 8).map(buildWorkEvidenceCitation).join("; ");

  return (
    <PageFrame
      record={record}
      activeTab="history"
      title="History"
      description="Site-scoped work history with SAP confirmation text, material reservations and posted goods movements."
      icon={History}
      actions={
        <>
          <AskVortaButton
            question={`Analyse the verified maintenance history for ${record.name} (${record.assetNumber}), identify repeat faults and cite these source records: ${promptCitations || "No history references are currently available."}`}
          />
          <RefreshButton loading={loading} onClick={reload} />
        </>
      }
    >
      {loading && !state ? <LoadingEvidence label="Loading verified maintenance history…" /> : null}
      {state && state.status !== "ready" ? <EvidenceStateMessage state={state} /> : null}
      {state?.status === "ready" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Work records" value={rows.length} detail="Authorised equipment history" />
            <Metric label="Confirmations" value={confirmations} detail="Non-reversed SAP confirmations" />
            <Metric label="Reservations" value={reservations} detail="Linked material reservations" />
            <Metric label="Goods movements" value={movements} detail="Non-reversed material postings" />
          </div>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-700 bg-[#10151d] px-3">
            <Search className="h-4 w-4 text-slate-500" />
            <span className="sr-only">Search equipment history</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search work order, fault, outcome or confirmation"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
            />
          </label>
          <div className="space-y-3">
            {filtered.map((item) => {
              const expanded = selected === item.workOrderId;
              return (
                <article key={item.workOrderId} className="rounded-xl border border-gray-800 bg-[#141820]">
                  <button
                    type="button"
                    onClick={() => setSelected(expanded ? null : item.workOrderId)}
                    className="flex w-full flex-col gap-3 p-4 text-left lg:flex-row lg:items-start lg:justify-between"
                    aria-expanded={expanded}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-blue-300">{item.workOrderNumber}</span>
                        {item.faultCode ? <span className="rounded border border-gray-700 px-2 py-0.5 text-[10px] text-slate-400">{item.faultCode}</span> : null}
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${statusTone(item.outcome ?? item.status)}`}>{item.outcome ?? item.status}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-100">{item.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(item.eventDate)} · {item.workType} · {item.assignedEngineer ?? "Unassigned"}
                      </p>
                      {item.latestConfirmationText ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.latestConfirmationText}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-[11px] text-slate-500">
                      <span>{item.confirmationCount} confirmations</span>
                      <span>{item.goodsMovementCount} movements</span>
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </button>
                  {expanded ? <div className="border-t border-gray-800 p-4"><WorkEvidenceDetails item={item} /></div> : null}
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </PageFrame>
  );
}
