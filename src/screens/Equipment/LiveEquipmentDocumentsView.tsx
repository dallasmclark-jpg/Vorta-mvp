import {
  BookOpen,
  ChevronRight,
  FileSearch,
  Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LiveEquipmentRecord } from "./equipmentLiveTrust";
import {
  buildDocumentCitation,
  loadLiveEquipmentDocuments,
} from "./equipmentPilotEvidence";
import {
  AskVortaButton,
  EvidenceStateMessage,
  LoadingEvidence,
  Metric,
  PageFrame,
  RefreshButton,
  documentStatusTone,
  usePilotEvidence,
} from "./EquipmentPilotEvidenceShared";

export function LiveEquipmentDocumentsView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const navigate = useNavigate();
  const loader = useCallback(() => loadLiveEquipmentDocuments(record.id), [record.id]);
  const { state, loading, reload } = usePilotEvidence(loader);
  const [query, setQuery] = useState("");
  const documents = state?.status === "ready" ? state.data : [];
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return documents;
    return documents.filter((document) =>
      [
        document.title,
        document.documentType,
        document.revision,
        document.summary,
        document.externalReference,
        document.drawingNumber,
        ...document.faultCodes,
        ...document.componentTags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [documents, query]);
  const current = documents.filter((document) => document.isCurrent).length;
  const indexed = documents.filter((document) => document.chunkCount > 0).length;
  const promptCitations = documents.slice(0, 8).map(buildDocumentCitation).join("; ");

  return (
    <PageFrame
      record={record}
      activeTab="documents"
      title="Documents"
      description="Controlled equipment and site documents are filtered by the active site, equipment link and the current user's allowed role."
      icon={FileSearch}
      actions={
        <>
          <AskVortaButton
            question={`Use the controlled documents for ${record.name} (${record.assetNumber}) to explain the likely fault path. Cite these document references: ${promptCitations || "No controlled document references are currently available."}`}
          />
          <RefreshButton loading={loading} onClick={reload} />
        </>
      }
    >
      {loading && !state ? <LoadingEvidence label="Loading controlled documents…" /> : null}
      {state && state.status !== "ready" ? <EvidenceStateMessage state={state} /> : null}
      {state?.status === "ready" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Available documents" value={documents.length} detail="Role-authorised records" />
            <Metric label="Current" value={current} detail="Marked as current" tone="text-emerald-300" />
            <Metric label="AI searchable" value={indexed} detail="Indexed evidence sections" tone="text-blue-300" />
          </div>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-700 bg-[#10151d] px-3">
            <Search className="h-4 w-4 text-slate-500" />
            <span className="sr-only">Search controlled documents</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search manual, drawing, fault code or component"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
            />
          </label>
          <div className="grid gap-3 xl:grid-cols-2">
            {filtered.map((document) => (
              <article key={document.documentId} className="flex flex-col rounded-xl border border-gray-800 bg-[#141820] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-300" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-300">{document.documentType}</span>
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${documentStatusTone(document)}`}>
                        {document.isCurrent ? document.approvalStatus : "Not current"}
                      </span>
                    </div>
                    <h2 className="mt-3 text-base font-semibold text-slate-100">{document.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {document.revision ? `Revision ${document.revision} · ` : ""}{document.externalReference ?? document.sourceDocumentId}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-gray-700 px-2 py-1 text-xs font-semibold text-slate-300">
                    {document.chunkCount} sections
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                  {document.summary ?? "No extracted summary is available. Open the document to inspect indexed source sections."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {document.faultCodes.slice(0, 3).map((code) => <span key={code} className="rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{code}</span>)}
                  {document.componentTags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-blue-500/10 px-2 py-1 text-[10px] text-blue-300">{tag}</span>)}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/equipment/${record.id}/documents/${document.documentId}`)}
                  className="mt-auto inline-flex min-h-10 items-center justify-end gap-2 border-t border-gray-800 pt-4 text-sm font-semibold text-blue-300 hover:text-blue-200"
                >
                  Open controlled document
                  <ChevronRight className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </PageFrame>
  );
}
