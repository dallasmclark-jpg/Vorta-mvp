import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import type { EquipmentKnowledgeChunk } from "../Equipment/equipmentService";
import {
  buildDirectAnswer,
  buildFaultIntelligence,
  buildRecommendedActions,
  formatDate,
  formatStatus,
  isFaultQuestion,
  type FaultEngineerRecommendation,
  type FaultHistoryRecord,
  type FaultIntelligenceResult,
} from "./faultIntelligenceData";
import { GlobalMaintenanceAiAssistant } from "./GlobalMaintenanceAiAssistant";

type VortaAiRole =
  | "maintenance-manager"
  | "planner"
  | "engineer"
  | "operator"
  | "production-manager"
  | "contractor";

interface GlobalAiPromptEventDetail {
  question?: string;
  submit?: boolean;
  role?: VortaAiRole;
}

const FAULT_PROMPT_EVENT = "vorta-global-ai-fault-prompt";
const ROUTER_MARKER = "vortaFaultPromptRouter";

function installFaultPromptRouter(): void {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  if (root.dataset[ROUTER_MARKER] === "true") return;
  root.dataset[ROUTER_MARKER] = "true";

  window.addEventListener(
    "vorta-global-ai-prompt",
    (event) => {
      const detail = (event as CustomEvent<GlobalAiPromptEventDetail>).detail;
      const question = detail?.question?.trim() ?? "";
      if (!detail?.submit || !question || !isFaultQuestion(question)) return;

      event.stopImmediatePropagation();
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Close global assistant"]:not([data-vorta-fault-close="true"])',
        )
        ?.click();

      window.queueMicrotask(() => {
        window.dispatchEvent(new CustomEvent(FAULT_PROMPT_EVENT, { detail }));
      });
    },
    true,
  );
}

installFaultPromptRouter();

function shiftStateLabel(engineer: FaultEngineerRecommendation): string {
  if (engineer.shiftState === "confirmed") return "Confirmed on shift";
  if (engineer.shiftState === "scheduled") return "Scheduled pattern";
  return "Available, not confirmed";
}

function shiftStateClass(engineer: FaultEngineerRecommendation): string {
  if (engineer.shiftState === "confirmed") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  if (engineer.shiftState === "scheduled") {
    return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  }
  return "border-slate-600 bg-slate-800/70 text-slate-400";
}

function HistorySection({ records }: { records: FaultHistoryRecord[] }): JSX.Element {
  if (records.length === 0) {
    return (
      <section className="space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Recent matching history
        </h4>
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] px-3 py-2.5 text-[10px] leading-relaxed text-yellow-100/75">
          No matching work-order description or fault code was returned from the last 12 months. No prior fault has been invented.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Recent matching history
        </h4>
        <span className="text-[9px] text-slate-500">Live work_orders data</span>
      </div>
      <div className="space-y-2">
        {records.slice(0, 6).map((record) => (
          <a
            key={record.id}
            href={`/equipment/${encodeURIComponent(record.equipmentId)}/history`}
            className="block rounded-lg border border-gray-800 bg-[#0d131b] px-3 py-2.5 transition-colors hover:border-blue-500/40 hover:bg-blue-500/[0.05]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-100">
                    {record.workOrderNumber}
                  </span>
                  <Badge className="h-auto rounded border border-gray-700 bg-gray-800/70 px-1.5 py-0 text-[8px] font-semibold text-slate-300 shadow-none">
                    {record.priority}
                  </Badge>
                  <Badge
                    className={`h-auto rounded px-1.5 py-0 text-[8px] font-semibold shadow-none ${
                      record.unresolved
                        ? "border border-orange-500/25 bg-orange-500/10 text-orange-300"
                        : "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    {formatStatus(record.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-300">
                  {record.description}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-500">
                  <span>{record.equipmentName} · {record.equipmentCode}</span>
                  <span>{formatDate(record.date)}</span>
                  {record.assignedEngineer && <span>Assigned: {record.assignedEngineer}</span>}
                  {record.faultCode && <span>Fault code: {record.faultCode}</span>}
                </div>
              </div>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function EngineerSection({
  engineers,
  shiftLabel,
  shiftWindow,
  shiftBasis,
}: {
  engineers: FaultEngineerRecommendation[];
  shiftLabel: string;
  shiftWindow: string;
  shiftBasis: string;
}): JSX.Element {
  return (
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Recommended engineers
          </h4>
          <p className="mt-0.5 text-[9px] text-slate-500">{shiftLabel} · {shiftWindow}</p>
        </div>
        <a href="/engineers" className="text-[9px] font-semibold text-blue-400 hover:text-blue-300">
          Open skills →
        </a>
      </div>

      <p className="rounded-md border border-gray-800 bg-[#0d131b] px-2.5 py-2 text-[9px] leading-relaxed text-slate-500">
        {shiftBasis}
      </p>

      {engineers.length > 0 ? (
        <div className="divide-y divide-gray-800 rounded-lg border border-gray-800 bg-[#0d131b] px-3">
          {engineers.slice(0, 5).map((engineer) => (
            <div key={engineer.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-100">{engineer.name}</span>
                  <Badge
                    className={`h-auto rounded border px-1.5 py-0 text-[8px] font-semibold shadow-none ${shiftStateClass(engineer)}`}
                  >
                    {shiftStateLabel(engineer)}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[9px] text-slate-500">{engineer.discipline}</p>
                <p className="mt-1 text-[9px] leading-relaxed text-slate-400">
                  {engineer.relevantSkills.join(" · ")}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[8.5px] text-slate-500">
                  {engineer.assetMatchPercent > 0 && <span>{engineer.assetMatchPercent}% equipment-skill match</span>}
                  {engineer.matchingHistoryCount > 0 && (
                    <span>{engineer.matchingHistoryCount} matching history record{engineer.matchingHistoryCount === 1 ? "" : "s"}</span>
                  )}
                  {engineer.yearsExperience > 0 && <span>{engineer.yearsExperience.toFixed(1)} years recorded experience</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-blue-300">{engineer.rating}/5</p>
                <p className="text-[8px] uppercase tracking-wide text-slate-500">{engineer.ratingSource}</p>
                <p className="mt-1 max-w-24 text-[8.5px] leading-3 text-slate-400">{engineer.primarySkill}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] px-3 py-2.5 text-[10px] leading-relaxed text-yellow-100/75">
          No relevant engineer rating and shift record was returned. Attendance and competence must be confirmed manually.
        </div>
      )}
    </section>
  );
}

function DocumentSection({
  documents,
  equipmentId,
}: {
  documents: EquipmentKnowledgeChunk[];
  equipmentId: string | null;
}): JSX.Element {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Corresponding documentation
        </h4>
        {equipmentId && (
          <a
            href={`/equipment/${encodeURIComponent(equipmentId)}/documents`}
            className="text-[9px] font-semibold text-blue-400 hover:text-blue-300"
          >
            Open documents →
          </a>
        )}
      </div>

      {documents.length > 0 ? (
        <div className="space-y-2">
          {documents.slice(0, 5).map((document) => {
            const location = [
              document.drawingNumber ? `Drawing ${document.drawingNumber}` : "",
              document.sheetNumber ? `Sheet ${document.sheetNumber}` : "",
              document.pageNumber != null ? `Page ${document.pageNumber}` : "",
              document.sectionTitle ?? "",
            ].filter(Boolean).join(" · ");
            const url = equipmentId
              ? `/equipment/${encodeURIComponent(equipmentId)}/documents/${encodeURIComponent(document.documentId)}`
              : document.sourceUrl;

            return (
              <a
                key={document.chunkId}
                href={url ?? undefined}
                className="block rounded-lg border border-blue-500/15 bg-blue-500/[0.06] px-3 py-2.5 transition-colors hover:border-blue-400/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className="h-auto rounded bg-blue-500/15 px-1.5 py-0 text-[8px] font-bold text-blue-300 shadow-none">
                        {document.sourceSystem}
                      </Badge>
                      <Badge className="h-auto rounded bg-gray-800 px-1.5 py-0 text-[8px] font-medium text-slate-400 shadow-none">
                        {document.documentType}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[10px] font-semibold text-blue-100">
                      {document.title}{document.revision ? ` ${document.revision}` : ""}
                    </p>
                    {location && <p className="mt-0.5 text-[9px] text-slate-500">{location}</p>}
                    <p className="mt-1.5 text-[9.5px] leading-relaxed text-slate-400">
                      {document.chunkText.slice(0, 260)}{document.chunkText.length > 260 ? "…" : ""}
                    </p>
                  </div>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] px-3 py-2.5 text-[10px] leading-relaxed text-yellow-100/75">
          No indexed manual, drawing or procedure section matched the fault terms. Vorta has not substituted a generic document.
        </div>
      )}
    </section>
  );
}

function FaultIntelligenceDrawer({ role }: { role: VortaAiRole }): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [input, setInput] = useState("");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<FaultIntelligenceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const runQuestion = useCallback(async (nextQuestion: string) => {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setQuestion(trimmed);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const nextResult = await buildFaultIntelligence(trimmed);
      if (requestId !== requestIdRef.current) return;
      setResult(nextResult);
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      console.warn("Vorta fault intelligence request failed:", requestError);
      setError(requestError instanceof Error ? requestError.message : "Vorta could not load the required live fault data.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleFaultPrompt = (event: Event) => {
      const detail = (event as CustomEvent<GlobalAiPromptEventDetail>).detail;
      const nextQuestion = detail?.question?.trim() ?? "";
      if (!nextQuestion) return;
      if (detail?.role && detail.role !== role) {
        console.warn("Fault intelligence received a prompt for a different role.");
      }
      setOpen(true);
      setMinimised(false);
      setInput("");
      void runQuestion(nextQuestion);
    };
    window.addEventListener(FAULT_PROMPT_EVENT, handleFaultPrompt);
    return () => window.removeEventListener(FAULT_PROMPT_EVENT, handleFaultPrompt);
  }, [role, runQuestion]);

  useEffect(() => {
    const closeForGeneralPrompt = (event: Event) => {
      const detail = (event as CustomEvent<GlobalAiPromptEventDetail>).detail;
      const nextQuestion = detail?.question?.trim() ?? "";
      if (detail?.submit && nextQuestion && !isFaultQuestion(nextQuestion)) setOpen(false);
    };
    window.addEventListener("vorta-global-ai-prompt", closeForGeneralPrompt);
    return () => window.removeEventListener("vorta-global-ai-prompt", closeForGeneralPrompt);
  }, []);

  const actions = useMemo(() => (result ? buildRecommendedActions(result) : []), [result]);

  const submitFollowUp = (nextQuestion: string): void => {
    const trimmed = nextQuestion.trim();
    if (!trimmed || loading) return;
    const effectiveQuestion = isFaultQuestion(trimmed) || !question ? trimmed : `${question}. Follow-up: ${trimmed}`;
    setInput("");
    void runQuestion(effectiveQuestion);
  };

  if (!open) return null;

  return (
    <aside
      data-vorta-fault-panel="true"
      className={`fixed z-[70] overflow-hidden rounded-2xl border border-gray-800 bg-[#10151f] shadow-2xl shadow-black/50 transition-all duration-200 max-sm:inset-0 max-sm:rounded-none sm:right-4 ${
        minimised ? "bottom-4 h-[58px] w-[min(520px,calc(100vw-2rem))]" : "bottom-4 top-4 w-[min(520px,calc(100vw-2rem))]"
      }`}
      aria-label="Vorta fault intelligence"
    >
      <div className="flex h-full flex-col">
        <header className="flex min-h-[56px] items-center justify-between border-b border-gray-800 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
              <Sparkles className="h-4 w-4 text-blue-300" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-100">Vorta AI</h3>
              <p className="truncate text-[9px] text-slate-500">Live fault history and engineer intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMinimised((value) => !value)}
              className="rounded-md p-2 text-slate-500 transition-colors hover:bg-gray-800 hover:text-slate-300"
              aria-label={minimised ? "Expand fault assistant" : "Minimise fault assistant"}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${minimised ? "rotate-180" : ""}`} />
            </button>
            <button
              type="button"
              data-vorta-fault-close="true"
              onClick={() => setOpen(false)}
              className="rounded-md p-2 text-slate-500 transition-colors hover:bg-gray-800 hover:text-slate-300"
              aria-label="Close global assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {!minimised && (
          <>
            <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-800 px-4 py-2.5">
              {[
                ["Unresolved history", "Show only unresolved fault history and repeat records"],
                ["Best on-shift engineer", "Which relevant engineer is confirmed on shift and has the highest recorded rating?"],
                ["Best document", "Which indexed manual page or drawing is the strongest match?"],
              ].map(([label, prompt]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => submitFollowUp(prompt)}
                  className="rounded-full border border-gray-700 bg-[#0d131b] px-2.5 py-1 text-[9px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-200"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-2 text-[9px] text-slate-500">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              Live work orders, indexed documents, engineer skill ratings and shift status only.
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {question && (
                <div className="mb-3 flex justify-end">
                  <div className="max-w-[82%] rounded-lg bg-blue-600 px-3 py-2 text-[10px] leading-relaxed text-white">
                    {question}
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                  <div>
                    <p className="text-xs font-medium text-slate-300">Checking live Vorta records</p>
                    <p className="mt-1 text-[9px] text-slate-500">Work orders · documents · skills · shift status</p>
                  </div>
                </div>
              )}

              {error && !loading && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <div>
                      <p className="text-xs font-semibold text-red-200">Fault intelligence could not load</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-red-100/70">{error}</p>
                      <Button
                        type="button"
                        onClick={() => void runQuestion(question)}
                        className="mt-3 h-auto bg-red-500/15 px-3 py-1.5 text-[10px] font-semibold text-red-100 hover:bg-red-500/25"
                      >
                        Retry live data
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {result && !loading && (
                <div className="space-y-5">
                  <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className="h-auto rounded bg-blue-500/15 px-1.5 py-0 text-[8px] font-bold text-blue-300 shadow-none">
                          Maintenance Manager response
                        </Badge>
                        <Badge className="h-auto rounded bg-gray-800 px-1.5 py-0 text-[8px] font-medium text-slate-400 shadow-none">
                          Real records only
                        </Badge>
                      </div>
                      <span className="text-[9px] font-semibold text-blue-400">{result.confidence}% source coverage</span>
                    </div>
                    <h4 className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Answer</h4>
                    <p className="mt-1.5 text-[11px] leading-[1.65] text-slate-200">{buildDirectAnswer(result)}</p>

                    {actions.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recommended action</h4>
                        <ul className="mt-1.5 space-y-1.5">
                          {actions.map((action) => (
                            <li key={action} className="flex gap-2 text-[10px] leading-relaxed text-slate-300">
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>

                  <HistorySection records={result.history} />
                  <EngineerSection
                    engineers={result.engineers}
                    shiftLabel={result.shiftLabel}
                    shiftWindow={result.shiftWindow}
                    shiftBasis={result.shiftBasis}
                  />
                  <DocumentSection documents={result.documents} equipmentId={result.primaryEquipment?.id ?? null} />

                  {result.sourceErrors.length > 0 && (
                    <section className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] px-3 py-2.5">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-yellow-200/70">Missing source data</h4>
                      <ul className="mt-1.5 space-y-1">
                        {result.sourceErrors.map((item) => (
                          <li key={item} className="text-[9.5px] leading-relaxed text-yellow-100/65">{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 pt-3 text-[9px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      No synthetic work orders, documents, people or ratings
                    </span>
                    <span>{result.searchedAssetCount} asset{result.searchedAssetCount === 1 ? "" : "s"} checked</span>
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                submitFollowUp(input);
              }}
              className="flex items-center gap-2 border-t border-gray-800 bg-[#0d121a] px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-700 bg-[#0b1017] px-3 py-2 focus-within:border-blue-500/50">
                <Wrench className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                <input
                  value={input}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setInput(event.target.value)}
                  placeholder="Ask a follow-up about this fault..."
                  className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-200 outline-none placeholder:text-slate-600"
                />
              </div>
              <Button
                type="submit"
                disabled={!input.trim() || loading}
                className="h-auto gap-1.5 bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </Button>
            </form>
          </>
        )}
      </div>
    </aside>
  );
}

interface GlobalMaintenanceAiAssistantWithFaultsProps { role?: VortaAiRole }

export function GlobalMaintenanceAiAssistantWithFaults({
  role = "maintenance-manager",
}: GlobalMaintenanceAiAssistantWithFaultsProps): JSX.Element {
  return (
    <>
      <GlobalMaintenanceAiAssistant role={role} />
      <FaultIntelligenceDrawer role={role} />
    </>
  );
}
