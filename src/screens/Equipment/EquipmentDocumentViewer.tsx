import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { DEFAULT_EQUIPMENT_ID, type EquipmentBase } from "./equipmentData";
import {
  getCachedEquipmentIdentity,
  getEquipmentDocuments,
  getEquipmentIdentityById,
} from "./equipmentService";
import type { EquipmentDocument } from "./equipmentTypes";
import {
  getDemoDocumentDefinition,
  type DocumentDiagram,
  type DocumentPageContent,
} from "./equipmentDocumentViewerData";
import { isBrowserSafeDocumentUrl } from "./equipmentDocumentNavigation";

function Diagram({ type }: { type: DocumentDiagram }): JSX.Element {
  if (type === "electrical-reject-circuit") {
    return (
      <svg viewBox="0 0 900 330" className="w-full" role="img" aria-label="Reject confirmation electrical circuit">
        <defs>
          <marker id="arrow-electrical" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#0f766e" /></marker>
        </defs>
        <rect x="22" y="40" width="125" height="70" rx="10" fill="#e2e8f0" stroke="#334155" strokeWidth="2" />
        <text x="84" y="69" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0f172a">24 VDC</text>
        <text x="84" y="92" textAnchor="middle" fontSize="12" fill="#475569">PSU-24</text>
        <rect x="220" y="30" width="170" height="95" rx="10" fill="#ecfeff" stroke="#0891b2" strokeWidth="2" />
        <text x="305" y="62" textAnchor="middle" fontSize="16" fontWeight="700" fill="#164e63">B204 SENSOR</text>
        <text x="305" y="86" textAnchor="middle" fontSize="12" fill="#155e75">M12 pin 4 signal</text>
        <text x="305" y="106" textAnchor="middle" fontSize="11" fill="#64748b">PNP reject confirmation</text>
        <rect x="468" y="40" width="125" height="70" rx="10" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
        <text x="530" y="70" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0f172a">X12:14</text>
        <text x="530" y="92" textAnchor="middle" fontSize="12" fill="#475569">Terminal</text>
        <rect x="680" y="25" width="185" height="105" rx="10" fill="#eef2ff" stroke="#4f46e5" strokeWidth="2" />
        <text x="772" y="61" textAnchor="middle" fontSize="16" fontWeight="700" fill="#312e81">PLC INPUT I3.7</text>
        <text x="772" y="85" textAnchor="middle" fontSize="12" fill="#4338ca">Reject confirmed</text>
        <text x="772" y="107" textAnchor="middle" fontSize="11" fill="#64748b">F-204 / F-207 logic</text>
        <line x1="147" y1="62" x2="220" y2="62" stroke="#0f766e" strokeWidth="4" />
        <line x1="390" y1="75" x2="468" y2="75" stroke="#0f766e" strokeWidth="4" />
        <line x1="593" y1="75" x2="680" y2="75" stroke="#0f766e" strokeWidth="4" markerEnd="url(#arrow-electrical)" />
        <rect x="250" y="205" width="155" height="80" rx="10" fill="#fff7ed" stroke="#ea580c" strokeWidth="2" />
        <text x="327" y="237" textAnchor="middle" fontSize="16" fontWeight="700" fill="#9a3412">PLC Q4.2</text>
        <text x="327" y="261" textAnchor="middle" fontSize="12" fill="#c2410c">Reject command</text>
        <rect x="520" y="205" width="155" height="80" rx="10" fill="#fff7ed" stroke="#ea580c" strokeWidth="2" />
        <text x="597" y="237" textAnchor="middle" fontSize="16" fontWeight="700" fill="#9a3412">YV-204</text>
        <text x="597" y="261" textAnchor="middle" fontSize="12" fill="#c2410c">Solenoid valve</text>
        <line x1="405" y1="245" x2="520" y2="245" stroke="#ea580c" strokeWidth="4" markerEnd="url(#arrow-electrical)" />
        <text x="450" y="315" textAnchor="middle" fontSize="12" fill="#475569">DEMO SCHEMATIC - verify against customer-controlled drawing before work</text>
      </svg>
    );
  }

  if (type === "pneumatic-reject-circuit") {
    return (
      <svg viewBox="0 0 900 330" className="w-full" role="img" aria-label="Reject cylinder pneumatic circuit">
        <defs><marker id="arrow-pneumatic" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#0369a1" /></marker></defs>
        <rect x="25" y="100" width="130" height="80" rx="10" fill="#eff6ff" stroke="#0284c7" strokeWidth="2" />
        <text x="90" y="132" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0c4a6e">AIR SUPPLY</text>
        <text x="90" y="156" textAnchor="middle" fontSize="12" fill="#0369a1">6.0 bar</text>
        <rect x="210" y="100" width="145" height="80" rx="10" fill="#ecfeff" stroke="#0891b2" strokeWidth="2" />
        <text x="282" y="130" textAnchor="middle" fontSize="15" fontWeight="700" fill="#164e63">PR-204</text>
        <text x="282" y="153" textAnchor="middle" fontSize="12" fill="#155e75">5.5 bar regulator</text>
        <rect x="420" y="75" width="170" height="130" rx="10" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
        <text x="505" y="112" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0f172a">V04 / YV-204</text>
        <text x="505" y="136" textAnchor="middle" fontSize="12" fill="#475569">5/2 solenoid valve</text>
        <line x1="455" y1="160" x2="555" y2="160" stroke="#475569" strokeWidth="3" />
        <line x1="505" y1="110" x2="505" y2="190" stroke="#475569" strokeWidth="3" />
        <rect x="675" y="80" width="195" height="120" rx="10" fill="#f0fdf4" stroke="#16a34a" strokeWidth="2" />
        <text x="772" y="117" textAnchor="middle" fontSize="15" fontWeight="700" fill="#14532d">CY-204</text>
        <text x="772" y="142" textAnchor="middle" fontSize="12" fill="#166534">Reject cylinder</text>
        <text x="772" y="165" textAnchor="middle" fontSize="11" fill="#475569">25 mm bore / 80 mm stroke</text>
        <line x1="155" y1="140" x2="210" y2="140" stroke="#0369a1" strokeWidth="4" markerEnd="url(#arrow-pneumatic)" />
        <line x1="355" y1="140" x2="420" y2="140" stroke="#0369a1" strokeWidth="4" markerEnd="url(#arrow-pneumatic)" />
        <line x1="590" y1="115" x2="675" y2="115" stroke="#0369a1" strokeWidth="4" markerEnd="url(#arrow-pneumatic)" />
        <line x1="590" y1="175" x2="675" y2="175" stroke="#0369a1" strokeWidth="4" markerEnd="url(#arrow-pneumatic)" />
        <text x="635" y="102" textAnchor="middle" fontSize="11" fill="#0369a1">FC-204A</text>
        <text x="635" y="196" textAnchor="middle" fontSize="11" fill="#0369a1">FC-204B</text>
        <text x="450" y="285" textAnchor="middle" fontSize="12" fill="#475569">Slow movement: check regulated pressure, exhaust restriction, flow controls and seal drag</text>
      </svg>
    );
  }

  if (type === "reject-timing") {
    return (
      <svg viewBox="0 0 900 300" className="w-full" role="img" aria-label="Reject confirmation timing chart">
        <line x1="90" y1="245" x2="850" y2="245" stroke="#64748b" strokeWidth="2" />
        {[0, 80, 220, 320].map((value, index) => {
          const x = [110, 300, 610, 820][index];
          return <g key={value}><line x1={x} y1="55" x2={x} y2="252" stroke="#cbd5e1" strokeDasharray="4 4" /><text x={x} y="275" textAnchor="middle" fontSize="12" fill="#475569">{value} ms</text></g>;
        })}
        <text x="25" y="95" fontSize="13" fontWeight="700" fill="#0f172a">Q4.2</text>
        <path d="M110 110 L110 70 L820 70 L820 110" fill="none" stroke="#ea580c" strokeWidth="5" />
        <text x="25" y="180" fontSize="13" fontWeight="700" fill="#0f172a">I3.7</text>
        <path d="M110 195 L350 195 L350 150 L680 150 L680 195 L820 195" fill="none" stroke="#0891b2" strokeWidth="5" />
        <rect x="300" y="35" width="310" height="190" rx="10" fill="#10b981" opacity="0.08" />
        <text x="455" y="25" textAnchor="middle" fontSize="13" fontWeight="700" fill="#047857">ACCEPTANCE WINDOW 80-220 ms</text>
      </svg>
    );
  }

  if (type === "reject-fault-tree") {
    const boxes = [
      [365, 20, 170, 52, "Intermittent reject"],
      [80, 115, 180, 58, "Sensor / target"],
      [280, 115, 160, 58, "Cable / input"],
      [480, 115, 160, 58, "Pneumatic"],
      [680, 115, 150, 58, "PLC timing"],
    ] as const;
    return (
      <svg viewBox="0 0 900 330" className="w-full" role="img" aria-label="False reject fault tree">
        {boxes.map(([x, y, w, h, label], index) => <g key={label}><rect x={x} y={y} width={w} height={h} rx="10" fill={index ? "#f8fafc" : "#ede9fe"} stroke={index ? "#64748b" : "#7c3aed"} strokeWidth="2" /><text x={x + w / 2} y={y + 32} textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">{label}</text></g>)}
        {[170, 360, 560, 755].map((x) => <path key={x} d={`M450 72 L450 92 L${x} 92 L${x} 115`} fill="none" stroke="#64748b" strokeWidth="2" />)}
        <text x="170" y="215" textAnchor="middle" fontSize="12" fill="#475569">Clean lens · align bracket · inspect target</text>
        <text x="360" y="215" textAnchor="middle" fontSize="12" fill="#475569">Flex M12 · monitor I3.7 · check X12:14</text>
        <text x="560" y="215" textAnchor="middle" fontSize="12" fill="#475569">Pressure · exhaust · cylinder response</text>
        <text x="755" y="215" textAnchor="middle" fontSize="12" fill="#475569">Compare only after physical evidence</text>
        <rect x="235" y="255" width="430" height="46" rx="10" fill="#ecfdf5" stroke="#10b981" />
        <text x="450" y="283" textAnchor="middle" fontSize="13" fontWeight="700" fill="#065f46">Challenge test and record as-found / as-left evidence</text>
      </svg>
    );
  }

  if (type === "pm-functional-test") {
    return (
      <svg viewBox="0 0 900 270" className="w-full" role="img" aria-label="PM functional test sequence">
        {[
          [35, "Safe state"],
          [235, "Clean + align"],
          [435, "3 challenges"],
          [635, "Record + close"],
        ].map(([x, label], index) => <g key={String(label)}><circle cx={Number(x) + 70} cy="105" r="50" fill={index === 2 ? "#ede9fe" : "#f8fafc"} stroke={index === 2 ? "#7c3aed" : "#64748b"} strokeWidth="2" /><text x={Number(x) + 70} y="100" textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">{index + 1}</text><text x={Number(x) + 70} y="124" textAnchor="middle" fontSize="12" fill="#475569">{label}</text>{index < 3 ? <ChevronRight x={Number(x) + 140} y={90} width="30" height="30" color="#64748b" /> : null}</g>)}
        <text x="450" y="215" textAnchor="middle" fontSize="13" fill="#475569">All three challenges must complete within the approved timing window</text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 900 280" className="w-full" role="img" aria-label="Calibration result chart">
      <line x1="90" y1="220" x2="840" y2="220" stroke="#64748b" strokeWidth="2" />
      <line x1="90" y1="35" x2="90" y2="220" stroke="#64748b" strokeWidth="2" />
      <rect x="100" y="70" width="720" height="105" fill="#10b981" opacity="0.08" />
      <line x1="100" y1="70" x2="820" y2="70" stroke="#10b981" strokeDasharray="6 4" />
      <line x1="100" y1="175" x2="820" y2="175" stroke="#10b981" strokeDasharray="6 4" />
      {[[210, 118, "4.1"], [430, 156, "3.6"], [650, 126, "4.0"]].map(([x, y, label]) => <g key={String(x)}><circle cx={Number(x)} cy={Number(y)} r="10" fill="#0891b2" /><text x={Number(x)} y={Number(y) - 18} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a">{label} mm</text></g>)}
      <text x="210" y="245" textAnchor="middle" fontSize="12" fill="#475569">Clean target</text>
      <text x="430" y="245" textAnchor="middle" fontSize="12" fill="#475569">Lower limit</text>
      <text x="650" y="245" textAnchor="middle" fontSize="12" fill="#475569">Repeat</text>
      <text x="835" y="65" textAnchor="end" fontSize="11" fill="#047857">Upper acceptance</text>
      <text x="835" y="170" textAnchor="end" fontSize="11" fill="#047857">Lower acceptance</text>
    </svg>
  );
}

function PaperPage({
  page,
  reference,
  revision,
  pageCount,
  highlightedSection,
}: {
  page: DocumentPageContent;
  reference: string;
  revision: string;
  pageCount: number;
  highlightedSection: string | null;
}): JSX.Element {
  return (
    <article className="mx-auto min-h-[760px] w-full max-w-[920px] rounded-sm bg-[#f6f3eb] px-8 py-7 text-slate-900 shadow-2xl shadow-black/30 md:px-12 md:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-300 pb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-800">Vorta demo controlled document</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">{reference} · {revision}</p>
        </div>
        <div className="text-right text-[10px] leading-5 text-slate-500">
          <p>Controlled copy for pilot demonstration</p>
          <p>Page {page.pageNumber} of {pageCount}</p>
        </div>
      </header>

      <div className="mt-8">
        {page.eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-800">{page.eyebrow}</p> : null}
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="max-w-3xl text-2xl font-bold leading-tight text-slate-950">{page.heading}</h1>
          {highlightedSection ? <span className="rounded-full border border-violet-300 bg-violet-100 px-3 py-1 text-[10px] font-bold text-violet-800">AI cited section</span> : null}
        </div>
      </div>

      {page.warning ? <div className="mt-6 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-950">{page.warning}</div> : null}

      {page.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-5 text-sm leading-7 text-slate-700">{paragraph}</p>)}

      {page.bullets?.length ? <ul className="mt-5 space-y-2 pl-5 text-sm leading-6 text-slate-700">{page.bullets.map((bullet) => <li key={bullet} className="list-disc pl-1">{bullet}</li>)}</ul> : null}

      {page.diagram ? <div className="mt-7 rounded-xl border border-slate-300 bg-white p-4"><Diagram type={page.diagram} /></div> : null}

      {page.table ? <div className="mt-7 overflow-hidden rounded-lg border border-slate-300"><table className="w-full border-collapse text-left text-xs"><thead className="bg-slate-200 text-slate-800"><tr>{page.table.headers.map((header) => <th key={header} className="border-b border-slate-300 px-3 py-2.5 font-bold">{header}</th>)}</tr></thead><tbody>{page.table.rows.map((row, rowIndex) => <tr key={`${rowIndex}-${row.join("-")}`} className="odd:bg-white even:bg-slate-50">{row.map((cell, index) => <td key={`${cell}-${index}`} className="border-b border-slate-200 px-3 py-2.5 align-top leading-5 text-slate-700">{cell}</td>)}</tr>)}</tbody></table></div> : null}

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 pt-4 text-[10px] text-slate-500">
        <span>Synthetic pilot content. Customer-controlled evidence remains authoritative.</span>
        <span>{reference} · Page {page.pageNumber}</span>
      </footer>
    </article>
  );
}

export const EquipmentDocumentViewer = (): JSX.Element => {
  const navigate = useNavigate();
  const { equipmentId, documentId } = useParams<{ equipmentId?: string; documentId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const resolvedEquipmentId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [equipment, setEquipment] = useState<EquipmentBase | null>(() => getCachedEquipmentIdentity(resolvedEquipmentId));
  const [document, setDocument] = useState<EquipmentDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    void Promise.all([
      getEquipmentIdentityById(resolvedEquipmentId),
      getEquipmentDocuments(resolvedEquipmentId),
    ])
      .then(([identity, documents]) => {
        if (!active) return;
        setEquipment(identity);
        setDocument(documents.find((item) => item.id === documentId) ?? null);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Document evidence could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [documentId, resolvedEquipmentId]);

  const definition = useMemo(
    () => (document ? getDemoDocumentDefinition(document) : null),
    [document],
  );
  const requestedPage = Number(searchParams.get("page"));
  const initialPage = Number.isFinite(requestedPage) && requestedPage > 0
    ? requestedPage
    : document?.pageNumber ?? 1;
  const pageNumber = definition
    ? Math.max(1, Math.min(definition.pageCount, Math.round(initialPage)))
    : Math.max(1, Math.round(initialPage));
  const highlightedSection = searchParams.get("section");
  const page = definition?.getPage(pageNumber) ?? null;

  const goToPage = useCallback(
    (nextPage: number) => {
      if (!definition) return;
      const safePage = Math.max(1, Math.min(definition.pageCount, Math.round(nextPage)));
      const next = new URLSearchParams(searchParams);
      next.set("page", String(safePage));
      const section = definition.sections.find((item) => item.page === safePage)?.label;
      if (section) next.set("section", section);
      else next.delete("section");
      setSearchParams(next, { replace: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [definition, searchParams, setSearchParams],
  );

  const askVorta = useCallback(() => {
    if (!equipment || !document) return;
    const section = page?.heading || document.manualSection || "the current document section";
    const prompt = `Using ${document.name}, ${section}, page ${pageNumber}, explain the maintenance evidence relevant to the current fault on ${equipment.name}. Cite the manual page, drawing sheet, fault codes and linked work history where available.`;
    navigate(`/equipment/${equipment.id}/ai-insights?prompt=${encodeURIComponent(prompt)}`);
  }, [document, equipment, navigate, page?.heading, pageNumber]);

  if (loading) {
    return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-400" /></div>;
  }

  if (!equipment || !document) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl border border-red-500/20 bg-[#141820] shadow-none"><CardContent className="p-6"><p className="text-sm font-semibold text-red-200">Document not available</p><p className="mt-2 text-xs text-slate-500">{loadError || "The selected equipment document could not be found."}</p><Button type="button" variant="outline" onClick={() => navigate(`/equipment/${resolvedEquipmentId}/documents`)} className="mt-4 border-gray-700 bg-transparent text-slate-300"><ArrowLeft className="mr-2 h-4 w-4" />Back to documents</Button></CardContent></Card>
      </div>
    );
  }

  const sourceIsExternal = isBrowserSafeDocumentUrl(document.sourceUrl);
  const displayReference = definition?.reference || document.externalReference || document.drawingNumber || document.fileId || document.id;
  const displayRevision = definition?.revision || document.revision || "Revision not recorded";

  return (
    <section className="flex w-full flex-col overflow-x-hidden pb-10">
      <div className="sticky top-0 z-20 border-b border-gray-800 bg-[#0b0e14]/95 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => navigate(`/equipment/${equipment.id}/documents`)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-700 text-slate-400 hover:bg-gray-800 hover:text-slate-200" aria-label="Back to equipment documents"><ArrowLeft className="h-4 w-4" /></button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><FileText className="h-4 w-4 text-cyan-400" /><h1 className="truncate text-base font-semibold text-slate-100">{document.name}</h1><Badge className="h-auto rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 shadow-none">Controlled evidence</Badge></div>
              <p className="mt-1 text-xs text-slate-500">{displayReference} · {displayRevision} · {document.sourceSystem || "Source pending"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sourceIsExternal ? <a href={document.sourceUrl as string} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-700 px-3 text-xs font-semibold text-slate-300 hover:border-blue-500/40 hover:text-blue-300"><ExternalLink className="h-3.5 w-3.5" />Open customer source</a> : null}
            <Button type="button" onClick={askVorta} className="h-9 gap-2 bg-cyan-600 px-3 text-xs text-white hover:bg-cyan-500"><BrainCircuit className="h-3.5 w-3.5" />Ask Vorta about this page</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-4 pt-4 xl:grid-cols-[280px_minmax(0,1fr)] md:px-6">
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /><h2 className="text-sm font-semibold text-slate-100">Document control</h2></div><dl className="mt-4 space-y-3 text-xs"><div><dt className="text-[10px] uppercase tracking-wide text-slate-600">Reference</dt><dd className="mt-1 font-mono text-slate-300">{displayReference}</dd></div><div><dt className="text-[10px] uppercase tracking-wide text-slate-600">Revision</dt><dd className="mt-1 text-slate-300">{displayRevision}</dd></div><div><dt className="text-[10px] uppercase tracking-wide text-slate-600">Source custody</dt><dd className="mt-1 flex items-center gap-1.5 text-slate-300"><Link2 className="h-3.5 w-3.5 text-slate-500" />{document.sourceSystem || "Not recorded"}</dd></div><div><dt className="text-[10px] uppercase tracking-wide text-slate-600">AI index</dt><dd className="mt-1 text-emerald-300">{document.aiIndexed ? "Searchable and citation-ready" : "Index pending"}</dd></div></dl></CardContent></Card>

          {definition ? <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-4"><h2 className="text-sm font-semibold text-slate-100">Document sections</h2><p className="mt-1 text-[11px] leading-4 text-slate-500">Jump to a controlled section or drawing sheet.</p><div className="mt-3 space-y-1">{definition.sections.map((section) => <button key={`${section.page}-${section.label}`} type="button" onClick={() => goToPage(section.page)} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs ${pageNumber >= section.page && pageNumber < (definition.sections[definition.sections.indexOf(section) + 1]?.page ?? definition.pageCount + 1) ? "bg-cyan-500/10 text-cyan-200" : "text-slate-400 hover:bg-gray-800 hover:text-slate-200"}`}><span className="truncate">{section.label}</span><span className="font-mono text-[10px] text-slate-600">{section.page}</span></button>)}</div></CardContent></Card> : null}
        </aside>

        <main className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#141820] px-3 py-2.5">
            <div className="flex items-center gap-2"><button type="button" disabled={!definition || pageNumber <= 1} onClick={() => goToPage(pageNumber - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 text-slate-400 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-28 text-center text-xs font-semibold text-slate-300">Page {pageNumber}{definition ? ` of ${definition.pageCount}` : ""}</span><button type="button" disabled={!definition || pageNumber >= definition.pageCount} onClick={() => goToPage(pageNumber + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 text-slate-400 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button></div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500"><span>{definition?.controlledStatus || "Metadata preview"}</span>{highlightedSection ? <Badge className="h-auto rounded border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-300 shadow-none">Opened from AI citation</Badge> : null}</div>
          </div>

          {page && definition ? <PaperPage page={page} reference={definition.reference} revision={definition.revision} pageCount={definition.pageCount} highlightedSection={highlightedSection} /> : <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none"><CardContent className="p-8"><FileText className="h-8 w-8 text-slate-600" /><h2 className="mt-4 text-lg font-semibold text-slate-100">Controlled source preview</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{document.extractedSummary || document.description || "This record has metadata but no embedded demonstration content."}</p><div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-xs leading-5 text-amber-200">The live customer document remains in {document.sourceSystem || "the source system"}. Configure a browser-accessible HTTPS deep link or authenticated file proxy to display the original here.</div>{sourceIsExternal ? <a href={document.sourceUrl as string} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-blue-200"><ExternalLink className="h-4 w-4" />Open customer-controlled source</a> : null}</CardContent></Card>}
        </main>
      </div>
    </section>
  );
};
