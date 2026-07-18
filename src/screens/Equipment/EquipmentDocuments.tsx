import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  Copy,
  Database,
  ExternalLink,
  FileCheck2,
  FileClock,
  FileSearch,
  FileText,
  FolderOpen,
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCircle,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { DEFAULT_EQUIPMENT_ID, type EquipmentBase } from "./equipmentData";
import {
  getCachedEquipmentIdentity,
  getEquipmentDocuments,
  getEquipmentIdentityById,
} from "./equipmentService";
import type { DocumentStatus, EquipmentDocument } from "./equipmentTypes";
import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";

type DocumentFilter =
  | "ALL"
  | "ATTENTION"
  | "CURRENT"
  | "AI_INDEXED"
  | "MISSING_SOURCE";

type KnowledgeDomain = {
  label: string;
  description: string;
  count: number;
  tone: string;
  iconTone: string;
};

function resolveStatus(status: DocumentStatus | string): "Current" | "Expiring" | "Review Due" | "Expired" {
  if (status === "active" || status === "Current") return "Current";
  if (status === "Expiring") return "Expiring";
  if (status === "review_due" || status === "Review Due" || status === "draft") return "Review Due";
  return "Expired";
}

function riskTone(level: string): string {
  const value = level.toLowerCase();
  if (value === "critical") return "border-red-500/25 bg-red-500/10 text-red-300";
  if (value === "high") return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  if (value === "medium") return "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}

function statusTone(status: DocumentStatus | string): string {
  const value = resolveStatus(status);
  if (value === "Current") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (value === "Expiring") return "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";
  if (value === "Review Due") return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  return "border-red-500/25 bg-red-500/10 text-red-300";
}

function sourceTone(source?: string): string {
  const value = source?.toLowerCase() ?? "";
  if (value.includes("sharepoint")) return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  if (value.includes("easidoc") || value.includes("easydoc")) return "border-violet-500/25 bg-violet-500/10 text-violet-300";
  if (value.includes("sap")) return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  if (value.includes("manual")) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  return "border-slate-600 bg-slate-800/70 text-slate-300";
}

function typeTone(type?: string): string {
  const value = type?.toLowerCase() ?? "";
  if (value.includes("manual")) return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  if (value.includes("drawing") || value.includes("schematic")) return "border-cyan-500/25 bg-cyan-500/10 text-cyan-300";
  if (value.includes("procedure") || value.includes("instruction") || value.includes("pm")) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (value.includes("certificate") || value.includes("compliance")) return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  return "border-slate-600 bg-slate-800/70 text-slate-300";
}

function formatDateTime(value: Date | null): string {
  if (!value) return "Loading latest knowledge data";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatDate(value?: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function Metric({
  label,
  value,
  detail,
  tone = "text-slate-50",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0b1017]/80 p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p>
    </div>
  );
}

function documentCompleteness(document: EquipmentDocument): number {
  const fields = [
    Boolean(document.name || document.title),
    Boolean(document.documentType || document.category),
    Boolean(document.sourceSystem),
    Boolean(document.sourceUrl || document.fileId),
    Boolean(document.revision),
    Boolean(document.description || document.extractedSummary),
    Boolean(
      document.externalReference ||
        document.drawingNumber ||
        document.manualSection ||
        document.pageNumber != null,
    ),
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function isDocumentType(document: EquipmentDocument, terms: string[]): boolean {
  const value = `${document.documentType ?? ""} ${document.category ?? ""}`.toLowerCase();
  return terms.some((term) => value.includes(term));
}

export const EquipmentDocuments = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;

  const [equipment, setEquipment] = useState<EquipmentBase | null>(() =>
    getCachedEquipmentIdentity(resolvedId),
  );
  const [documents, setDocuments] = useState<EquipmentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DocumentFilter>("ALL");
  const [copied, setCopied] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadKnowledge = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [identity, knowledge] = await Promise.all([
        getEquipmentIdentityById(resolvedId),
        getEquipmentDocuments(resolvedId),
      ]);
      setEquipment(identity);
      setDocuments(knowledge);
      setLastUpdated(new Date());
    } catch (error) {
      setDocuments([]);
      setLoadError(error instanceof Error ? error.message : "Equipment knowledge could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => {
    void loadKnowledge();
  }, [loadKnowledge]);

  const attentionDocuments = useMemo(
    () => documents.filter((document) => resolveStatus(document.status) !== "Current"),
    [documents],
  );
  const aiIndexedDocuments = useMemo(
    () => documents.filter((document) => document.aiIndexed),
    [documents],
  );
  const linkedDocuments = useMemo(
    () => documents.filter((document) => document.sourceUrl || document.fileId),
    [documents],
  );
  const missingSourceDocuments = useMemo(
    () => documents.filter((document) => !document.sourceUrl && !document.fileId),
    [documents],
  );
  const evidenceCompleteness = useMemo(() => {
    if (!documents.length) return 0;
    return Math.round(
      documents.reduce((sum, document) => sum + documentCompleteness(document), 0) /
        documents.length,
    );
  }, [documents]);
  const aiCoverage = documents.length
    ? Math.round((aiIndexedDocuments.length / documents.length) * 100)
    : 0;

  const sourceSystems = useMemo(() => {
    const counts = new Map<string, number>();
    documents.forEach((document) => {
      const key = document.sourceSystem || "Source pending";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [documents]);

  const domains = useMemo<KnowledgeDomain[]>(() => {
    const definitions = [
      {
        label: "Manuals and fault guides",
        description: "Operating, troubleshooting and OEM reference material",
        terms: ["manual", "fault", "guide"],
        tone: "border-blue-500/20 bg-blue-500/[0.04]",
        iconTone: "text-blue-400",
      },
      {
        label: "Drawings and schematics",
        description: "Electrical, mechanical and control-system evidence",
        terms: ["drawing", "schematic"],
        tone: "border-cyan-500/20 bg-cyan-500/[0.04]",
        iconTone: "text-cyan-400",
      },
      {
        label: "Procedures and instructions",
        description: "PM, calibration, SOP and work-instruction evidence",
        terms: ["procedure", "instruction", "pm", "sop"],
        tone: "border-emerald-500/20 bg-emerald-500/[0.04]",
        iconTone: "text-emerald-400",
      },
      {
        label: "Certificates and compliance",
        description: "Controlled certificates, approvals and compliance records",
        terms: ["certificate", "compliance"],
        tone: "border-amber-500/20 bg-amber-500/[0.04]",
        iconTone: "text-amber-400",
      },
    ];
    return definitions.map((definition) => ({
      label: definition.label,
      description: definition.description,
      count: documents.filter((document) => isDocumentType(document, definition.terms)).length,
      tone: definition.tone,
      iconTone: definition.iconTone,
    }));
  }, [documents]);

  const highestExposure =
    attentionDocuments[0] ??
    missingSourceDocuments[0] ??
    documents.find((document) => !document.aiIndexed) ??
    documents[0];

  const interventions = useMemo(() => {
    const rows: Array<{
      key: string;
      title: string;
      detail: string;
      evidence: string;
      document?: EquipmentDocument;
      prompt: string;
    }> = [];

    if (attentionDocuments.length) {
      const document = attentionDocuments[0];
      rows.push({
        key: `attention-${document.id}`,
        title: `Review ${document.name}`,
        detail: `${resolveStatus(document.status)} knowledge may no longer be suitable as controlled maintenance evidence.`,
        evidence: `${document.sourceSystem || "Source pending"} · ${document.revision ? `Revision ${document.revision}` : "Revision not recorded"}`,
        document,
        prompt: `Explain the maintenance and compliance exposure created by ${document.name} being ${resolveStatus(document.status).toLowerCase()} for ${equipment?.name ?? "this equipment"}.`,
      });
    }

    if (missingSourceDocuments.length) {
      const document = missingSourceDocuments[0];
      rows.push({
        key: `source-${document.id}`,
        title: `Restore the source link for ${document.name}`,
        detail: "Vorta can index metadata, but users cannot open the controlled source record from this equipment page.",
        evidence: `${missingSourceDocuments.length} reference${missingSourceDocuments.length === 1 ? "" : "s"} without a retrievable source`,
        document,
        prompt: `Assess the operational impact of missing source links for ${equipment?.name ?? "this equipment"}, starting with ${document.name}.`,
      });
    }

    const unindexed = documents.find((document) => !document.aiIndexed);
    if (unindexed) {
      rows.push({
        key: `index-${unindexed.id}`,
        title: `Complete AI indexing for ${unindexed.name}`,
        detail: "The document is linked, but its evidence is not yet available to equipment-specific Ask Vorta responses.",
        evidence: `${documents.length - aiIndexedDocuments.length} document${documents.length - aiIndexedDocuments.length === 1 ? "" : "s"} not AI indexed`,
        document: unindexed,
        prompt: `Explain which maintenance questions cannot yet be answered because ${unindexed.name} is not AI indexed for ${equipment?.name ?? "this equipment"}.`,
      });
    }

    const incomplete = [...documents]
      .sort((a, b) => documentCompleteness(a) - documentCompleteness(b))[0];
    if (incomplete && documentCompleteness(incomplete) < 80) {
      rows.push({
        key: `metadata-${incomplete.id}`,
        title: `Complete evidence metadata for ${incomplete.name}`,
        detail: "Revision, source, location or reference metadata is incomplete, weakening traceability and search accuracy.",
        evidence: `${documentCompleteness(incomplete)}% metadata completeness`,
        document: incomplete,
        prompt: `Identify the missing document metadata and traceability risk for ${incomplete.name} on ${equipment?.name ?? "this equipment"}.`,
      });
    }

    return rows.slice(0, 3);
  }, [aiIndexedDocuments.length, attentionDocuments, documents, equipment?.name, missingSourceDocuments]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((document) => {
      const status = resolveStatus(document.status);
      const filterMatch =
        filter === "ALL" ||
        (filter === "ATTENTION" && status !== "Current") ||
        (filter === "CURRENT" && status === "Current") ||
        (filter === "AI_INDEXED" && document.aiIndexed) ||
        (filter === "MISSING_SOURCE" && !document.sourceUrl && !document.fileId);
      if (!filterMatch) return false;
      if (!query) return true;
      return [
        document.name,
        document.title,
        document.documentType,
        document.category,
        document.sourceSystem,
        document.revision,
        document.drawingNumber,
        document.manualSection,
        document.externalReference,
        document.oem,
        document.description,
        document.extractedSummary,
        ...(document.faultCodes ?? []),
        ...(document.componentTags ?? []),
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [documents, filter, search]);

  const copyValue = useCallback(async (value: string, key: string) => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  }, []);

  const askVorta = useCallback(
    (prompt?: string) => {
      if (!equipment) return;
      const resolvedPrompt =
        prompt ||
        question.trim() ||
        `Review the controlled knowledge for ${equipment.name}. Identify missing, outdated or unindexed evidence and cite the most relevant manual section, drawing, procedure or certificate.`;
      navigate(`/equipment/${equipment.id}/ai-insights?prompt=${encodeURIComponent(resolvedPrompt)}`);
    },
    [equipment, navigate, question],
  );

  if (!equipment) {
    return (
      <section className="flex w-full flex-col overflow-x-hidden pb-10">
        <div className="border-b border-gray-800 bg-[#0b0e14] px-4 py-4 md:px-6">
          <div className="h-40 animate-pulse rounded-xl bg-[#141820]" />
        </div>
      </section>
    );
  }

  const riskTotal = equipment.riskBreakdown.reduce((sum, driver) => sum + driver.pct, 0) || 1;
  const briefing = `${equipment.name} has ${documents.length} linked knowledge references across ${sourceSystems.length} source system${sourceSystems.length === 1 ? "" : "s"}. ${aiCoverage}% is available to Ask Vorta and average evidence completeness is ${evidenceCompleteness}%. ${attentionDocuments.length ? `${attentionDocuments.length} controlled reference${attentionDocuments.length === 1 ? " requires" : "s require"} review.` : "All referenced documents are currently controlled."} ${missingSourceDocuments.length ? `${missingSourceDocuments.length} source link${missingSourceDocuments.length === 1 ? " is" : "s are"} unavailable.` : "Every reference has a retrievable source or linked file."}`;

  return (
    <section className="flex w-full flex-col gap-0 overflow-x-hidden pb-10">
      {loadError ? (
        <div className="mx-4 mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-xs text-red-200 md:mx-6">
          {loadError}
        </div>
      ) : null}

      <div className="lg:sticky lg:top-0 z-10 border-b border-gray-800 bg-[#0b0e14] px-4 pb-4 pt-4 md:px-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
            <button type="button" onClick={() => navigate("/equipment")} className="hover:text-slate-300">
              Equipment
            </button>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-slate-300">
              {equipment.name} ({equipment.assetNumber})
            </span>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void copyValue(equipment.assetNumber, "asset")}
              className="h-auto gap-2 border-gray-700 bg-transparent px-3 py-1.5 text-xs text-slate-300 hover:bg-gray-800"
            >
              {copied === "asset" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "asset" ? "Copied" : "Copy asset ref"}
            </Button>
            <button
              type="button"
              onClick={() => void loadKnowledge()}
              disabled={loading}
              aria-label="Refresh knowledge intelligence"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-gray-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => navigate(`/equipment/${equipment.id}/notifications`)}
              aria-label="Equipment notifications"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-gray-800"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/settings")}
              aria-label="Profile settings"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-800"
            >
              <UserCircle className="h-7 w-7" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">
            <img
              src={equipment.image}
              alt={equipment.name}
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">{equipment.name}</h1>
              <Badge className={`inline-flex h-auto rounded border px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskTone(equipment.riskLevel)}`}>
                {equipment.riskLevel} Risk
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <EquipmentRiskIndicator riskLevel={equipment.riskLevel} />
              <span className="text-sm font-semibold text-slate-200">{equipment.status}</span>
              <span className="text-sm text-slate-500">{equipment.statusNote}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="font-medium text-slate-300">{equipment.assetNumber}</span>
              <span className="rounded bg-gray-800 px-1.5 py-0.5 font-medium tracking-wide">{equipment.type}</span>
              <span>📍 {equipment.area}</span>
              <span>Manufacturer: <span className="text-slate-300">{equipment.manufacturer}</span></span>
              <span>Model: <span className="text-slate-300">{equipment.model}</span></span>
              <span>Criticality: <span className="text-slate-300">{equipment.criticality}</span></span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 lg:w-52">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Score</span>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-slate-50">{equipment.riskScore}%</span>
              <Badge className={`mb-1 inline-flex h-auto rounded border px-2 py-0.5 text-[10px] font-bold uppercase shadow-none ${riskTone(equipment.riskLevel)}`}>
                {equipment.riskLevel}
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500">Risk drivers</span>
              <div className="flex h-2 overflow-hidden rounded-full bg-gray-800">
                {equipment.riskBreakdown.map((driver) => (
                  <div
                    key={driver.label}
                    style={{
                      width: `${(driver.pct / riskTotal) * 100}%`,
                      backgroundColor: driver.color,
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {equipment.riskBreakdown.map((driver) => (
                  <span key={driver.label} className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${driver.dotClass}`} />
                    {driver.label} {driver.pct}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <EquipmentTabNavigation equipmentId={equipment.id} activeTab="documents" />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6">
        <Card className="overflow-hidden rounded-2xl border border-cyan-500/25 bg-[linear-gradient(135deg,#111a1d_0%,#10151d_55%,#10191d_100%)] shadow-none">
          <CardContent className="p-0">
            <div className="grid xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.55fr)]">
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="h-auto rounded bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300 shadow-none">
                    Knowledge and evidence intelligence
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Database className="h-3.5 w-3.5" />
                    References · revisions · source custody · AI index · {formatDateTime(lastUpdated)}
                  </span>
                </div>

                <h2 className="mt-4 text-xl font-semibold text-slate-50">Equipment Knowledge Briefing</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{briefing}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    label="Knowledge references"
                    value={documents.length}
                    detail={`${sourceSystems.length} source system${sourceSystems.length === 1 ? "" : "s"}`}
                  />
                  <Metric
                    label="AI-searchable"
                    value={`${aiCoverage}%`}
                    detail={`${aiIndexedDocuments.length} of ${documents.length} references indexed`}
                    tone={aiCoverage >= 90 ? "text-emerald-300" : aiCoverage >= 70 ? "text-amber-300" : "text-red-300"}
                  />
                  <Metric
                    label="Evidence quality"
                    value={`${evidenceCompleteness}%`}
                    detail="Average metadata completeness"
                    tone={evidenceCompleteness >= 90 ? "text-emerald-300" : evidenceCompleteness >= 70 ? "text-amber-300" : "text-red-300"}
                  />
                  <Metric
                    label="Control attention"
                    value={attentionDocuments.length}
                    detail={`${missingSourceDocuments.length} source link${missingSourceDocuments.length === 1 ? "" : "s"} unavailable`}
                    tone={attentionDocuments.length || missingSourceDocuments.length ? "text-orange-300" : "text-emerald-300"}
                  />
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-gray-700 bg-[#0a0f16] px-3 focus-within:border-cyan-500/60">
                    <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
                    <input
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") askVorta();
                      }}
                      placeholder={`Ask Vorta to find evidence for ${equipment.assetNumber}...`}
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => askVorta()}
                    className="min-h-11 gap-2 bg-cyan-600 px-5 text-white hover:bg-cyan-500"
                  >
                    <BrainCircuit className="h-4 w-4" />
                    Ask Vorta
                  </Button>
                </div>
              </div>

              <div className="border-t border-gray-800 bg-[#0b1017]/70 p-5 xl:border-l xl:border-t-0 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Highest evidence exposure</p>
                {highestExposure ? (
                  <div className="mt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-300">
                        <FileClock className="h-5 w-5" />
                      </div>
                      <Badge className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${statusTone(highestExposure.status)}`}>
                        {resolveStatus(highestExposure.status)}
                      </Badge>
                    </div>
                    <h3 className="mt-4 text-base font-semibold leading-6 text-slate-100">{highestExposure.name}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {highestExposure.extractedSummary || highestExposure.description || "Controlled knowledge reference requiring traceability review."}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Metric
                        label="Metadata"
                        value={`${documentCompleteness(highestExposure)}%`}
                        detail="Traceability completeness"
                        tone={documentCompleteness(highestExposure) >= 80 ? "text-emerald-300" : "text-amber-300"}
                      />
                      <Metric
                        label="AI index"
                        value={highestExposure.aiIndexed ? "Ready" : "Pending"}
                        detail={highestExposure.lastIndexedAt ? `Indexed ${formatDate(highestExposure.lastIndexedAt)}` : "No index timestamp"}
                        tone={highestExposure.aiIndexed ? "text-emerald-300" : "text-orange-300"}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => askVorta(`Explain the evidence status, source, revision and maintenance relevance of ${highestExposure.name} for ${equipment.name}.`)}
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                    >
                      Analyse this evidence
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-8 text-center">
                    <FileSearch className="mx-auto h-6 w-6 text-amber-400" />
                    <p className="mt-3 text-sm font-semibold text-amber-200">No equipment knowledge indexed</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-amber-500/20 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400/80">Knowledge intervention queue</p>
                <h2 className="mt-1 text-base font-semibold text-slate-100">Highest-value evidence actions</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Ranked from document control, source availability, AI indexing and metadata traceability.
                </p>
              </div>
              <Badge className="h-auto rounded border border-amber-500/20 bg-amber-500/[0.07] px-2 py-1 text-[10px] font-semibold text-amber-300 shadow-none">
                {interventions.length} active actions
              </Badge>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-3">
              {interventions.map((item, index) => (
                <article key={item.key} className="flex min-h-[220px] flex-col rounded-xl border border-gray-800 bg-[#0d1219] p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-300">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold leading-5 text-slate-100">{item.title}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border border-gray-800 bg-[#0a0f16] p-3">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">Evidence</p>
                    <p className="mt-1 text-xs text-slate-300">{item.evidence}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                    {item.document?.sourceUrl ? (
                      <a
                        href={item.document.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:text-blue-200"
                      >
                        Open source <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-600">Source link unavailable</span>
                    )}
                    <button
                      type="button"
                      onClick={() => askVorta(item.prompt)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200"
                    >
                      Analyse <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              ))}

              {!loading && interventions.length === 0 ? (
                <div className="xl:col-span-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-8 text-center">
                  <ShieldCheck className="mx-auto h-6 w-6 text-emerald-400" />
                  <p className="mt-3 text-sm font-semibold text-emerald-200">No immediate knowledge intervention required</p>
                  <p className="mt-1 text-xs text-slate-500">Document control, source links, metadata and AI indexing meet the current thresholds.</p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cyan-400" />
                <h2 className="text-base font-semibold text-slate-100">Knowledge Coverage Map</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">Evidence domains available for maintenance decisions on this equipment.</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {domains.map((domain) => (
                  <article key={domain.label} className={`rounded-xl border p-4 ${domain.tone}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <FileCheck2 className={`mt-0.5 h-4 w-4 shrink-0 ${domain.iconTone}`} />
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{domain.label}</p>
                          <p className="mt-1 text-[11px] leading-4 text-slate-500">{domain.description}</p>
                        </div>
                      </div>
                      <span className={`text-xl font-semibold ${domain.iconTone}`}>{domain.count}</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className="h-full rounded-full bg-cyan-400"
                        style={{ width: `${documents.length ? Math.min(100, (domain.count / documents.length) * 100) : 0}%`, opacity: 0.65 }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-blue-400" />
                <h2 className="text-base font-semibold text-slate-100">Source Custody</h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Vorta stores references, metadata and searchable index data. Controlled source files remain in customer systems.
              </p>

              <div className="mt-5 space-y-3">
                {sourceSystems.map((source) => (
                  <div key={source.label} className="rounded-xl border border-gray-800 bg-[#0d1219] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Link2 className="h-4 w-4 shrink-0 text-slate-500" />
                        <span className="truncate text-xs font-semibold text-slate-200">{source.label}</span>
                      </div>
                      <Badge className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${sourceTone(source.label)}`}>
                        {source.count} refs
                      </Badge>
                    </div>
                  </div>
                ))}
                {!loading && !sourceSystems.length ? (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-8 text-center">
                    <AlertTriangle className="mx-auto h-5 w-5 text-amber-400" />
                    <p className="mt-2 text-xs text-amber-200">No source custody recorded</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Retrievable" value={linkedDocuments.length} detail="Source URL or linked file" tone="text-emerald-300" />
                <Metric label="Unavailable" value={missingSourceDocuments.length} detail="Source access pending" tone={missingSourceDocuments.length ? "text-orange-300" : "text-emerald-300"} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card id="document-register" className="scroll-mt-48 rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-gray-800 p-4 lg:flex-row lg:items-center lg:justify-between md:p-5">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-base font-semibold text-slate-100">Knowledge Evidence Register</h2>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Searchable equipment references with source custody, revision, location and AI-index evidence.
                </p>
              </div>

              <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search title, drawing, fault, component..."
                    className="h-9 w-full rounded-lg border border-gray-700 bg-[#0b0e14] pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-500 sm:w-72"
                  />
                </div>
                <div className="flex flex-wrap rounded-lg border border-gray-700 bg-[#0b0e14] p-1">
                  {([
                    ["All", "ALL"],
                    ["Attention", "ATTENTION"],
                    ["Current", "CURRENT"],
                    ["AI indexed", "AI_INDEXED"],
                    ["Missing source", "MISSING_SOURCE"],
                  ] as const).map(([label, value]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${filter === value ? "bg-cyan-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-800">
              {loading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="p-4 md:p-5">
                      <div className="h-24 animate-pulse rounded-xl bg-[#171c25]" />
                    </div>
                  ))
                : filteredDocuments.map((document) => {
                    const reference = document.externalReference || document.drawingNumber || document.manualSection || document.id;
                    return (
                      <article key={document.id} className="p-4 transition-colors hover:bg-white/[0.015] md:p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-100">{document.name}</h3>
                              <Badge className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${typeTone(document.documentType || document.category)}`}>
                                {document.documentType || document.category}
                              </Badge>
                              <Badge className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${sourceTone(document.sourceSystem)}`}>
                                {document.sourceSystem || "Source pending"}
                              </Badge>
                              <Badge className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${statusTone(document.status)}`}>
                                {resolveStatus(document.status)}
                              </Badge>
                              {document.aiIndexed ? (
                                <Badge className="h-auto rounded border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-300 shadow-none">
                                  <Zap className="mr-1 h-3 w-3" />AI indexed
                                </Badge>
                              ) : null}
                            </div>

                            <p className="mt-3 max-w-5xl text-xs leading-5 text-slate-400">
                              {document.extractedSummary || document.description || "No extracted equipment summary is available for this reference."}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-500">
                              <span>Revision <span className="font-semibold text-slate-300">{document.revision || "Not recorded"}</span></span>
                              {document.drawingNumber ? <span>Drawing <span className="font-semibold text-slate-300">{document.drawingNumber}</span></span> : null}
                              {document.sheetNumber ? <span>Sheet <span className="font-semibold text-slate-300">{document.sheetNumber}</span></span> : null}
                              {document.manualSection ? <span>Section <span className="font-semibold text-slate-300">{document.manualSection}</span></span> : null}
                              {document.pageNumber != null ? <span>Page <span className="font-semibold text-slate-300">{document.pageNumber}</span></span> : null}
                              <span>Evidence <span className="font-semibold text-slate-300">{documentCompleteness(document)}%</span></span>
                              <span>Indexed <span className="font-semibold text-slate-300">{document.lastIndexedAt ? formatDate(document.lastIndexedAt) : "Not indexed"}</span></span>
                            </div>

                            {document.faultCodes?.length || document.componentTags?.length ? (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {document.faultCodes?.map((faultCode) => (
                                  <span key={faultCode} className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1 font-mono text-[10px] text-red-300">
                                    {faultCode}
                                  </span>
                                ))}
                                {document.componentTags?.map((component) => (
                                  <span key={component} className="rounded border border-slate-600/40 bg-slate-700/30 px-2 py-1 text-[10px] text-slate-400">
                                    {component}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2 xl:max-w-[250px] xl:justify-end">
                            <button
                              type="button"
                              onClick={() => void copyValue(reference, document.id)}
                              className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-700 px-3 text-xs font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
                            >
                              {copied === document.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                              {copied === document.id ? "Copied" : "Copy ref"}
                            </button>
                            <button
                              type="button"
                              onClick={() => askVorta(`Use ${document.name} to explain the most relevant maintenance evidence, fault codes, drawing references and source location for ${equipment.name}.`)}
                              className="inline-flex h-9 items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/[0.05] px-3 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
                            >
                              <BrainCircuit className="h-3.5 w-3.5" />Ask Vorta
                            </button>
                            {document.sourceUrl ? (
                              <a
                                href={document.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />Open source
                              </a>
                            ) : (
                              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-700 px-3 text-xs text-slate-600">
                                <Link2 className="h-3.5 w-3.5" />Source pending
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
            </div>

            {!loading && !filteredDocuments.length ? (
              <div className="px-4 py-12 text-center">
                <FileSearch className="mx-auto h-7 w-7 text-slate-600" />
                <p className="mt-3 text-sm font-medium text-slate-300">No knowledge references match this view</p>
                <p className="mt-1 text-xs text-slate-500">Change the filter or broaden the search terms.</p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 px-4 py-3 text-xs text-slate-500">
              <span>Showing {filteredDocuments.length} of {documents.length} equipment references</span>
              <span>Source documents remain in customer-controlled systems; Vorta remains read-only.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-slate-100">Knowledge Investigation</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">Continue from controlled evidence into failure history, work execution and AI diagnosis.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => navigate(`/equipment/${equipment.id}/history`)} className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800">
                  <FileClock className="h-3.5 w-3.5" />View history
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate(`/equipment/${equipment.id}/work-orders`)} className="h-9 gap-2 border-gray-700 bg-transparent px-3 text-xs text-slate-300 hover:bg-gray-800">
                  <FileCheck2 className="h-3.5 w-3.5" />View work evidence
                </Button>
                <Button type="button" onClick={() => askVorta()} className="h-9 gap-2 bg-cyan-600 px-3 text-xs text-white hover:bg-cyan-500">
                  <BrainCircuit className="h-3.5 w-3.5" />Analyse knowledge
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
