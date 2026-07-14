import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  Edit,
  ExternalLink,
  FileText,
  Filter,
  Info,
  RefreshCw,
  Search,
  UserCircle,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

import { EquipmentBase, DEFAULT_EQUIPMENT_ID } from "./equipmentData";
import { getEquipmentIdentityById, getCachedEquipmentIdentity, getEquipmentDocuments } from "./equipmentService";
import type { EquipmentDocument, DocumentStatus } from "./equipmentTypes";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";

// ─── Tabs ─────────────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveStatus(s: DocumentStatus): "Current" | "Expiring" | "Review Due" | "Expired" {
  if (s === "active" || s === "Current") return "Current";
  if (s === "review_due" || s === "Review Due") return "Review Due";
  if (s === "Expiring") return "Expiring";
  return "Expired";
}

function statusBadgeClass(s: DocumentStatus) {
  const r = resolveStatus(s);
  if (r === "Current")    return "bg-[#10b98120] text-emerald-400";
  if (r === "Expiring")   return "bg-[#eab30820] text-yellow-400";
  if (r === "Review Due") return "bg-[#f9731620] text-orange-400";
  return "bg-[#ef444420] text-red-400";
}

function sourceSystemBadgeClass(system: string | undefined) {
  if (!system) return "bg-gray-700 text-slate-400";
  const s = system.toLowerCase();
  if (s.includes("sharepoint")) return "bg-blue-500/15 text-blue-300";
  if (s.includes("easidoc") || s.includes("easydoc")) return "bg-purple-500/15 text-purple-300";
  if (s.includes("sap")) return "bg-orange-500/15 text-orange-300";
  if (s.includes("manual")) return "bg-emerald-500/15 text-emerald-300";
  return "bg-gray-700/60 text-slate-400";
}

function docTypeBadgeClass(type: string | undefined) {
  if (!type) return "bg-gray-700 text-slate-400";
  const t = type.toLowerCase();
  if (t.includes("manual"))     return "bg-blue-500/15 text-blue-300";
  if (t.includes("drawing"))    return "bg-orange-500/15 text-orange-300";
  if (t.includes("pm") || t.includes("instruction")) return "bg-teal-500/15 text-teal-300";
  if (t.includes("procedure"))  return "bg-yellow-500/15 text-yellow-300";
  if (t.includes("schematic"))  return "bg-indigo-500/15 text-indigo-300";
  if (t.includes("certificate") || t.includes("compliance")) return "bg-red-500/15 text-red-300";
  return "bg-gray-700/60 text-slate-400";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const EquipmentDocuments = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;

  const [eq, setEq] = useState<EquipmentBase | null>(() => getCachedEquipmentIdentity(resolvedId));
  const [documents, setDocuments] = useState<EquipmentDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterRevision, setFilterRevision] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    getEquipmentIdentityById(resolvedId).then(setEq);
    setLoading(true);
    getEquipmentDocuments(resolvedId)
      .then((docs) => { setDocuments(docs); setLoading(false); })
      .catch(() => setLoading(false));
  }, [resolvedId]);

  if (!eq) {
    return (
      <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
        <div className="border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
          <div className="h-28 animate-pulse rounded-xl bg-[#141820]" />
        </div>
      </section>
    );
  }

  const riskBadgeClass =
    eq.riskLevel === "Critical" ? "bg-[#ef444420] text-red-400" :
    eq.riskLevel === "High"     ? "bg-[#f9731620] text-orange-400" :
    "bg-[#10b98120] text-emerald-400";

  const statusDotClass =
    eq.status === "Running" ? "bg-emerald-500" :
    eq.status === "At Risk" ? "bg-orange-400" : "bg-red-500";

  const riskTotal = eq.riskBreakdown.reduce((s, b) => s + b.pct, 0) || 1;

  // Derived filter options
  const allTypes    = useMemo(() => [...new Set(documents.map((d) => d.category).filter(Boolean))].sort(), [documents]);
  const allSources  = useMemo(() => [...new Set(documents.map((d) => d.sourceSystem).filter(Boolean))].sort(), [documents]);
  const allRevisions = useMemo(() => [...new Set(documents.map((d) => d.revision).filter(Boolean))].sort(), [documents]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return documents.filter((d) => {
      if (filterType   && d.category   !== filterType)   return false;
      if (filterSource && d.sourceSystem !== filterSource) return false;
      if (filterRevision && d.revision !== filterRevision) return false;
      if (filterStatus && resolveStatus(d.status) !== filterStatus) return false;
      if (!q) return true;
      return (
        (d.name ?? "").toLowerCase().includes(q) ||
        (d.title ?? "").toLowerCase().includes(q) ||
        (d.drawingNumber ?? "").toLowerCase().includes(q) ||
        (d.manualSection ?? "").toLowerCase().includes(q) ||
        (d.sourceSystem ?? "").toLowerCase().includes(q) ||
        (d.revision ?? "").toLowerCase().includes(q) ||
        (d.oem ?? "").toLowerCase().includes(q) ||
        (d.description ?? "").toLowerCase().includes(q) ||
        (d.faultCodes ?? []).some((fc) => fc.toLowerCase().includes(q)) ||
        (d.componentTags ?? []).some((ct) => ct.toLowerCase().includes(q))
      );
    });
  }, [documents, search, filterType, filterSource, filterRevision, filterStatus]);

  const criticalCount = documents.filter((d) => ["Review Due", "Expiring", "Expired", "review_due"].includes(d.status)).length;
  const aiIndexedCount = documents.filter((d) => d.aiIndexed).length;
  const hasActiveFilters = !!(search || filterType || filterSource || filterRevision || filterStatus);

  const clearFilters = () => {
    setSearch("");
    setFilterType("");
    setFilterSource("");
    setFilterRevision("");
    setFilterStatus("");
  };

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-1.5 text-sm text-slate-500">
            <button type="button" onClick={() => navigate("/equipment")} className="transition-colors hover:text-slate-300">
              Equipment
            </button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-300">{eq.name} ({eq.assetNumber})</span>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline"
              className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-gray-800 hover:text-slate-100">
              <Edit className="h-3.5 w-3.5" /> Edit Equipment
            </Button>
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-800 hover:text-slate-200 transition-colors">
              <UserCircle className="h-7 w-7" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">
            <img src={eq.image} alt={eq.name} className="h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">{eq.name}</h1>
              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}>
                {eq.riskLevel} Risk
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
              <span className="text-sm font-semibold text-slate-200">{eq.status}</span>
              <span className="text-sm text-slate-500">{eq.statusNote}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="font-medium text-slate-300">{eq.assetNumber}</span>
              <span className="rounded bg-gray-800 px-1.5 py-0.5 font-medium tracking-wide">{eq.type}</span>
              <span>📍 {eq.area}</span>
              <span>Manufacturer: <span className="text-slate-300">{eq.manufacturer}</span></span>
              <span>Model: <span className="text-slate-300">{eq.model}</span></span>
              <span>Criticality: <span className="text-slate-300">{eq.criticality}</span></span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 lg:w-52">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Score</span>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-slate-50">{eq.riskScore}%</span>
              <Badge className={`mb-1 inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskBadgeClass}`}>
                {eq.riskLevel}
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500">Risk Drivers</span>
              <div className="flex h-2 overflow-hidden rounded-full">
                {eq.riskBreakdown.map((b) => (
                  <div key={b.label} style={{ width: `${(b.pct / riskTotal) * 100}%`, backgroundColor: b.color }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {eq.riskBreakdown.map((b) => (
                  <span key={b.label} className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${b.dotClass}`} />
                    {b.label} {b.pct}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <EquipmentTabNavigation equipmentId={eq.id} activeTab="documents" />
      </div>

      {/* ── Page Content ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">

        {/* Page title */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-50">Documents</h2>
            <p className="text-xs text-slate-500">
              Linked source documents, drawings, manuals and PM instructions for this equipment.
            </p>
          </div>
        </div>

        {/* ── Data custody callout ─────────────────────────────────────────── */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <p className="text-xs leading-relaxed text-blue-100/80">
            Vorta stores document references, metadata and searchable index data only. Source documents remain in
            SharePoint, EasiDoc, EasyDoc, SAP DMS or other customer-controlled systems.
          </p>
        </div>

        {/* ── KPI Row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total References</p>
              <p className="text-2xl font-bold text-slate-50">{documents.length}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Indexed document links</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Need Attention</p>
              <p className="text-2xl font-bold text-orange-400">{criticalCount}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Review due or expired</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">AI Indexed</p>
              <p className="text-2xl font-bold text-blue-400">{aiIndexedCount}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Chunks available to Ask AI</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Showing</p>
              <p className="text-2xl font-bold text-slate-50">{filtered.length}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">of {documents.length} after filters</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Search + Filters ─────────────────────────────────────────────── */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              {/* Free-text search */}
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search title, drawing no., fault code, component tag, section, source..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-gray-700 bg-[#0f1218] pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              {/* Document type */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-9 rounded-lg border border-gray-700 bg-[#0f1218] px-2 text-xs text-slate-300 focus:border-blue-500/50 focus:outline-none"
              >
                <option value="">All types</option>
                {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              {/* Source system */}
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="h-9 rounded-lg border border-gray-700 bg-[#0f1218] px-2 text-xs text-slate-300 focus:border-blue-500/50 focus:outline-none"
              >
                <option value="">All sources</option>
                {allSources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Revision */}
              <select
                value={filterRevision}
                onChange={(e) => setFilterRevision(e.target.value)}
                className="h-9 rounded-lg border border-gray-700 bg-[#0f1218] px-2 text-xs text-slate-300 focus:border-blue-500/50 focus:outline-none"
              >
                <option value="">All revisions</option>
                {allRevisions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>

              {/* Status */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 rounded-lg border border-gray-700 bg-[#0f1218] px-2 text-xs text-slate-300 focus:border-blue-500/50 focus:outline-none"
              >
                <option value="">All statuses</option>
                <option value="Current">Current</option>
                <option value="Review Due">Review Due</option>
                <option value="Expiring">Expiring</option>
                <option value="Expired">Expired</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-700 bg-[#0f1218] px-3 text-xs text-slate-400 transition-colors hover:bg-gray-800 hover:text-slate-200"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Document Reference Cards ──────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-28 animate-pulse rounded-xl bg-[#141820]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-[#141820] px-6 py-10 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">No documents found</p>
            <p className="mt-1 text-xs text-slate-600">
              {hasActiveFilters
                ? "Try clearing filters or broadening the search."
                : "No document references are indexed for this equipment yet."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((doc) => {
              const displayStatus = resolveStatus(doc.status);
              const hasSourceUrl = Boolean(doc.sourceUrl);

              return (
                <div
                  key={doc.id}
                  className="rounded-xl border border-gray-800 bg-[#141820] p-4 transition-colors hover:border-gray-700"
                >
                  {/* Row 1: title + badges + open button */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="text-sm font-semibold text-slate-100">{doc.name}</span>

                      {doc.documentType && (
                        <Badge className={`h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-bold shadow-none ${docTypeBadgeClass(doc.documentType)}`}>
                          {doc.documentType}
                        </Badge>
                      )}

                      {doc.sourceSystem && (
                        <Badge className={`h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-bold shadow-none ${sourceSystemBadgeClass(doc.sourceSystem)}`}>
                          {doc.sourceSystem}
                        </Badge>
                      )}

                      <Badge className={`h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-bold shadow-none ${statusBadgeClass(doc.status)}`}>
                        {displayStatus}
                      </Badge>

                      {doc.aiIndexed && (
                        <Badge className="h-auto shrink-0 rounded px-2 py-0.5 text-[10px] font-bold shadow-none bg-blue-500/15 text-blue-300">
                          <Zap className="mr-1 inline h-2.5 w-2.5" />AI indexed
                        </Badge>
                      )}
                    </div>

                    {hasSourceUrl ? (
                      <a
                        href={doc.sourceUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-semibold text-blue-300 transition-colors hover:border-blue-400/60 hover:bg-blue-500/20"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open source
                      </a>
                    ) : (
                      <span className="flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-gray-700 bg-transparent px-3 text-xs text-slate-600">
                        Source link pending
                      </span>
                    )}
                  </div>

                  {/* Row 2: metadata grid */}
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-slate-500">
                    {doc.revision && (
                      <span>
                        Revision: <span className="font-semibold text-slate-300">{doc.revision}</span>
                      </span>
                    )}
                    {doc.drawingNumber && (
                      <span>
                        Drawing: <span className="font-semibold text-slate-300">{doc.drawingNumber}</span>
                      </span>
                    )}
                    {doc.sheetNumber && (
                      <span>
                        Sheet: <span className="font-semibold text-slate-300">{doc.sheetNumber}</span>
                      </span>
                    )}
                    {doc.pageNumber != null && (
                      <span>
                        Page: <span className="font-semibold text-slate-300">{doc.pageNumber}</span>
                      </span>
                    )}
                    {doc.manualSection && (
                      <span>
                        Section: <span className="font-semibold text-slate-300">{doc.manualSection}</span>
                      </span>
                    )}
                    {doc.oem && (
                      <span>
                        OEM: <span className="font-semibold text-slate-300">{doc.oem}</span>
                      </span>
                    )}
                    {doc.externalReference && (
                      <span>
                        Ref: <span className="font-semibold text-slate-300">{doc.externalReference}</span>
                      </span>
                    )}
                  </div>

                  {/* Row 3: fault codes + component tags */}
                  {((doc.faultCodes?.length ?? 0) > 0 || (doc.componentTags?.length ?? 0) > 0) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {doc.faultCodes?.map((fc) => (
                        <span key={fc} className="rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                          {fc}
                        </span>
                      ))}
                      {doc.componentTags?.map((ct) => (
                        <span key={ct} className="rounded border border-slate-600/40 bg-slate-700/30 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                          {ct}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Row 4: description */}
                  {doc.description && (
                    <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">{doc.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-gray-800 py-3 text-xs text-slate-500">
          <span>
            {filtered.length} of {documents.length} document references
            {hasActiveFilters ? " (filtered)" : ""} · Vorta stores references and index data only
          </span>
          <button
            type="button"
            aria-label="Refresh"
            onClick={() => {
              setLoading(true);
              getEquipmentDocuments(resolvedId)
                .then((docs) => { setDocuments(docs); setLoading(false); })
                .catch(() => setLoading(false));
            }}
            className="text-slate-600 hover:text-slate-400 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
