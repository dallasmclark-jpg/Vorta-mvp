import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { LiveEquipmentRecord } from "./equipmentLiveTrust";
import {
  buildDocumentCitation,
  loadLiveEquipmentDocument,
  type LiveEquipmentDocument,
} from "./equipmentPilotEvidence";
import {
  AskVortaButton,
  EvidenceStateMessage,
  LoadingEvidence,
  PageFrame,
  RefreshButton,
  documentStatusTone,
  formatDate,
  safeExternalUrl,
  usePilotEvidence,
} from "./EquipmentPilotEvidenceShared";

export function LiveEquipmentDocumentViewerView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const navigate = useNavigate();
  const { documentId = "" } = useParams<{ documentId?: string }>();
  const loader = useCallback(
    () => loadLiveEquipmentDocument(record.id, documentId),
    [documentId, record.id],
  );
  const { state, loading, reload } = usePilotEvidence(loader);
  const document: LiveEquipmentDocument | null = state?.status === "ready" ? state.data : null;
  const sourceUrl = safeExternalUrl(document?.sourceUrl ?? null);
  const chunkCitations = document?.chunks
    .slice(0, 8)
    .map((chunk) => `${chunk.reference}${chunk.pageNumber ? ` page ${chunk.pageNumber}` : ""}`)
    .join("; ");

  return (
    <PageFrame
      record={record}
      activeTab="documents"
      title={document?.title ?? "Document viewer"}
      description="The viewer retains equipment and active-site context. Indexed sections are the citation boundary used by Ask Vorta."
      icon={BookOpen}
      actions={
        <>
          {document ? (
            <AskVortaButton
              question={`Use ${buildDocumentCitation(document)} to answer questions about ${record.name} (${record.assetNumber}). Cite these indexed sections: ${chunkCitations || "No indexed sections are available."}`}
            />
          ) : null}
          <RefreshButton loading={loading} onClick={reload} />
        </>
      }
    >
      <button
        type="button"
        onClick={() => navigate(`/equipment/${record.id}/documents`)}
        className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to documents
      </button>
      {loading && !state ? <LoadingEvidence label="Opening controlled document…" /> : null}
      {state && state.status !== "ready" ? <EvidenceStateMessage state={state} /> : null}
      {document ? (
        <>
          <div className="rounded-xl border border-gray-800 bg-[#141820] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded border px-2 py-1 text-xs font-semibold ${documentStatusTone(document)}`}>{document.approvalStatus}</span>
                  <span className="rounded border border-gray-700 px-2 py-1 text-xs text-slate-300">{document.documentType}</span>
                  {document.revision ? <span className="rounded border border-gray-700 px-2 py-1 text-xs text-slate-300">Revision {document.revision}</span> : null}
                </div>
                <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300">{document.summary ?? "No document summary is available."}</p>
                <p className="mt-3 text-xs text-slate-500">
                  Source: {document.sourceSystem} · Reference: {document.externalReference ?? document.sourceDocumentId} · Updated {formatDate(document.updatedAt)}
                </p>
              </div>
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-gray-700 px-3 text-sm font-semibold text-slate-200 hover:bg-gray-800"
                >
                  Open controlled source
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>
          <div className="space-y-3">
            {document.chunks.length ? document.chunks.map((chunk, index) => (
              <article key={chunk.id || `${chunk.reference}-${index}`} className="rounded-xl border border-gray-800 bg-[#141820] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-300">{chunk.reference}</p>
                    <h2 className="mt-1 text-sm font-semibold text-slate-100">{chunk.sectionTitle ?? `Evidence section ${index + 1}`}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                    {chunk.pageNumber ? <span>Page {chunk.pageNumber}</span> : null}
                    {chunk.drawingNumber ? <span>Drawing {chunk.drawingNumber}</span> : null}
                    {chunk.sheetNumber ? <span>Sheet {chunk.sheetNumber}</span> : null}
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{chunk.text}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {chunk.faultCodes.map((code) => <span key={code} className="rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{code}</span>)}
                  {chunk.componentTags.map((tag) => <span key={tag} className="rounded bg-blue-500/10 px-2 py-1 text-[10px] text-blue-300">{tag}</span>)}
                </div>
              </article>
            )) : (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-5">
                <ShieldCheck className="h-5 w-5 text-amber-300" />
                <p className="mt-2 text-sm font-semibold text-amber-200">Document metadata verified, content not indexed</p>
                <p className="mt-1 text-xs text-slate-500">Ask Vorta will not invent content for this document. Use the controlled source link when available.</p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </PageFrame>
  );
}
