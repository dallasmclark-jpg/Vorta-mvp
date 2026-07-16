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
  UserRoundCheck,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import type { EquipmentKnowledgeChunk } from "../Equipment/equipmentService";
import {
  buildDirectAnswer,
  buildRecommendedActions,
  formatDate,
  formatStatus,
  isFaultQuestion,
  type FaultHistoryRecord,
} from "./faultIntelligenceData";
import {
  buildFaultIntelligenceWithIdentity,
  type EquipmentSmeRecommendation,
  type FaultEngineerRecommendationWithIdentity,
  type FaultIntelligenceWithIdentityResult,
} from "./faultIntelligenceWithIdentity";
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

const FAULT_PROMPT_EVENT = "vorta-global-ai-fault-prompt-v2";
const ROUTER_MARKER = "vortaFaultPromptRouterV2";

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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function EngineerAvatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
}): JSX.Element {
  const dimensions =
    size === "lg"
      ? "h-12 w-12 text-sm"
      : size === "sm"
        ? "h-8 w-8 text-[10px]"
        : "h-10 w-10 text-xs";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-400/25 bg-blue-500/10 font-semibold text-blue-200 ${dimensions}`}
      aria-label={`${name} profile picture`}
    >
      <span>{initials(name)}</span>
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
    </div>
  );
}

function shiftStateLabel(
  engineer:
    | FaultEngineerRecommendationWithIdentity
    | EquipmentSmeRecommendation,
): string {
  if (engineer.shiftState === "confirmed") return "Confirmed on shift";
  if (engineer.shiftState === "scheduled") return "Scheduled today";
  return "Available, not confirmed";
}

function shiftStateClass(
  engineer:
    | FaultEngineerRecommendationWithIdentity
    | EquipmentSmeRecommendation,
): string {
  if (engineer.shiftState === "confirmed") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  if (engineer.shiftState === "scheduled") {
    return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  }
  return "border-slate-600 bg-slate-800/70 text-slate-400";
}

function capabilityLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function HistorySection({ records }: { records: FaultHistoryRecord[] }): JSX.Element {
  if (records.length === 0) {
    return (
      <section className="space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Recent matching history
        </h4>
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] px-3 py-2.5 text-[10px] leading-relaxed text-yellow-100/75">
          No matching work-order description or fault code was returned from the
          last 12 months. No prior fault has been invented.
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
                  <span>
                    {record.equipmentName} · {record.equipmentCode}
                  </span>
                  <span>{formatDate(record.date)}</span>
                  {record.assignedEngineer && (
                    <span>Assigned: {record.assignedEngineer}</span>
                  )}
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

function EquipmentSmeSection({
  sme,
  equipmentName,
}: {
  sme: EquipmentSmeRecommendation | null;
  equipmentName: string;
}): JSX.Element {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Equipment SME
          </h4>
          <p className="mt-0.5 text-[9px] text-slate-500">{equipmentName}</p>
        </div>
        <a
          href="/engineers"
          className="text-[9px] font-semibold text-blue-400 hover:text-blue-300"
        >
          Open engineer record →
        </a>
      </div>

      {sme ? (
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.07] p-3">
          <div className="flex items-start gap-3">
            <EngineerAvatar name={sme.name} avatarUrl={sme.avatarUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] font-semibold text-slate-100">
                  {sme.name}
                </span>
                <Badge className="h-auto rounded border border-violet-400/25 bg-violet-400/10 px-1.5 py-0 text-[8px] font-bold text-violet-200 shadow-none">
                  {capabilityLabel(sme.capabilityRole)}
                </Badge>
                <Badge
                  className={`h-auto rounded border px-1.5 py-0 text-[8px] font-semibold shadow-none ${shiftStateClass(sme)}`}
                >
                  {shiftStateLabel(sme)}
                </Badge>
              </div>
              <p className="mt-0.5 text-[9px] text-slate-400">{sme.discipline}</p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-300">
                {sme.specialism}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[8.5px] text-slate-500">
                <span>Competency level {sme.competencyLevel}/5</span>
                <span>{capabilityLabel(sme.practiceAuthority)}</span>
                <span>{capabilityLabel(sme.validationStatus)}</span>
                <span>Shift: {sme.shiftPattern}</span>
              </div>
            </div>
            <UserRoundCheck className="h-4 w-4 shrink-0 text-violet-300" />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] px-3 py-2.5 text-[10px] leading-relaxed text-yellow-100/75">
          No active equipment SME capability record was returned. Vorta has not
          assigned an SME from skill ratings alone.
        </div>
      )}
    </section>
  );
}

function PrimaryEngineerCard({
  engineer,
}: {
  engineer: FaultEngineerRecommendationWithIdentity;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.07] p-3">
      <div className="flex items-start gap-3">
        <EngineerAvatar
          name={engineer.name}
          avatarUrl={engineer.avatarUrl}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold text-slate-100">
              {engineer.name}
            </span>
            <Badge
              className={`h-auto rounded border px-1.5 py-0 text-[8px] font-semibold shadow-none ${shiftStateClass(engineer)}`}
            >
              {shiftStateLabel(engineer)}
            </Badge>
            {engineer.isEquipmentSme && (
              <Badge className="h-auto rounded border border-violet-400/25 bg-violet-400/10 px-1.5 py-0 text-[8px] font-bold text-violet-200 shadow-none">
                {capabilityLabel(engineer.capabilityRole ?? "SME")}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[9px] text-slate-400">
            {engineer.discipline}
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-300">
            {engineer.relevantSkills.join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[8.5px] text-slate-500">
            <span>{engineer.rating}/5 {engineer.ratingSource} rating</span>
            {engineer.assetMatchPercent > 0 && (
              <span>{engineer.assetMatchPercent}% equipment-skill match</span>
            )}
            {engineer.matchingHistoryCount > 0 && (
              <span>
                {engineer.matchingHistoryCount} matching history record
                {engineer.matchingHistoryCount === 1 ? "" : "s"}
              </span>
            )}
            {engineer.yearsExperience > 0 && (
              <span>{engineer.yearsExperience.toFixed(1)} years recorded</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold text-blue-300">
            {engineer.rating}/5
          </p>
          <p className="max-w-24 text-[8.5px] leading-3 text-slate-400">
            {engineer.primarySkill}
          </p>
        </div>
      </div>
    </div>
  );
}

function EngineerSection({
  engineers,
  shiftLabel,
  shiftWindow,
  shiftBasis,
}: {
  engineers: FaultEngineerRecommendationWithIdentity[];
  shiftLabel: string;
  shiftWindow: string;
  shiftBasis: string;
}): JSX.Element {
  const primary = engineers[0];
  const secondary = engineers.slice(1, 5);

  return (
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Recommended engineers
          </h4>
          <p className="mt-0.5 text-[9px] text-slate-500">
            {shiftLabel} · {shiftWindow}
          </p>
        </div>
        <a
          href="/engineers"
          className="text-[9px] font-semibold text-blue-400 hover:text-blue-300"
        >
          Open skills →
        </a>
      </div>

      <p className="rounded-md border border-gray-800 bg-[#0d131b] px-2.5 py-2 text-[9px] leading-relaxed text-slate-500">
        {shiftBasis}
      </p>

      {primary ? (
        <div className="space-y-2">
          <PrimaryEngineerCard engineer={primary} />

          {secondary.length > 0 && (
            <div className="divide-y divide-gray-800 rounded-lg border border-gray-800 bg-[#0d131b] px-3">
              {secondary.map((engineer) => (
                <div
                  key={engineer.id}
                  className="flex items-center gap-2.5 py-2.5"
                >
                  <EngineerAvatar
                    name={engineer.name}
                    avatarUrl={engineer.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-slate-100">
                        {engineer.name}
                      </span>
                      <Badge
                        className={`h-auto rounded border px-1.5 py-0 text-[7.5px] font-semibold shadow-none ${shiftStateClass(engineer)}`}
                      >
                        {shiftStateLabel(engineer)}
                      </Badge>
                      {engineer.isEquipmentSme && (
                        <Badge className="h-auto rounded border border-violet-400/25 bg-violet-400/10 px-1.5 py-0 text-[7.5px] font-bold text-violet-200 shadow-none">
                          SME
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[8.5px] text-slate-500">
                      {engineer.discipline} · {engineer.primarySkill}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-semibold text-blue-300">
                      {engineer.rating}/5
                    </p>
                    <p className="text-[7.5px] uppercase tracking-wide text-slate-600">
                      {engineer.ratingSource}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] px-3 py-2.5 text-[10px] leading-relaxed text-yellow-100/75">
          No relevant engineer rating and shift record was returned. Attendance
          and competence must be confirmed manually.
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
              document.drawingNumber
                ? `Drawing ${document.drawingNumber}`
                : "",
              document.sheetNumber ? `Sheet ${document.sheetNumber}` : "",
              document.pageNumber != null ? `Page ${document.pageNumber}` : "",
              document.sectionTitle ?? "",
            ]
              .filter(Boolean)
              .join(" · ");
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
                      {document.title}
                      {document.revision ? ` ${document.revision}` : ""}
                    </p>
                    {location && (
                      <p className="mt-0.5 text-[9px] text-slate-500">
                        {location}
                      </p>
                    )}
                    <p className="mt-1.5 text-[9.5px] leading-relaxed text-slate-400">
                      {document.chunkText.slice(0, 260)}
                      {document.chunkText.length > 260 ? "…" : ""}
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
          No indexed manual, drawing or procedure section matched the fault
          terms. Vorta has not substituted a generic document.
        </div>
      )}
    </section>
  );
}

function buildAnswerWithSme(
  result: FaultIntelligenceWithIdentityResult,
): string {
  const baseAnswer = buildDirectAnswer(result);
  const sme = result.equipmentSme;
  if (!sme) return baseAnswer;

  return `${baseAnswer} ${sme.name} is recorded as the ${capabilityLabel(
    sme.capabilityRole,
  )} for this equipment at competency level ${sme.competencyLevel}/5 (${capabilityLabel(
    sme.validationStatus,
  )}).`;
}

function FaultIntelligenceDrawer({
  role,
}: {
  role: VortaAiRole;
}): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [input, setInput] = useState("");
  const [question, setQuestion] = useState("");
  const [result, setResult] =
    useState<FaultIntelligenceWithIdentityResult | null>(null);
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
      const nextResult = await buildFaultIntelligenceWithIdentity(trimmed);
      if (requestId !== requestIdRef.current) return;
      setResult(nextResult);
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      console.warn("Vorta fault intelligence request failed:", requestError);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Vorta could not load the required live fault data.",
      );
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
      if (detail?.submit && nextQuestion && !isFaultQuestion(nextQuestion)) {
        setOpen(false);
      }
    };

    window.addEventListener("vorta-global-ai-prompt", closeForGeneralPrompt);
    return () =>
      window.removeEventListener("vorta-global-ai-prompt", closeForGeneralPrompt);
  }, []);

  const actions = useMemo(() => {
    if (!result) return [];

    const baseActions = buildRecommendedActions(result);
    const smeAction = result.equipmentSme
      ? `Use ${result.equipmentSme.name}, the recorded ${capabilityLabel(
          result.equipmentSme.capabilityRole,
        )}, for equipment-specific escalation or technical confirmation.`
      : null;

    return [...new Set([...baseActions, ...(smeAction ? [smeAction] : [])])].slice(
      0,
      4,
    );
  }, [result]);

  const submitFollowUp = (nextQuestion: string): void => {
    const trimmed = nextQuestion.trim();
    if (!trimmed || loading) return;

    const effectiveQuestion =
      isFaultQuestion(trimmed) || !question
        ? trimmed
        : `${question}. Follow-up: ${trimmed}`;
    setInput("");
    void runQuestion(effectiveQuestion);
  };

  if (!open) return null;

  return (
    <aside
      data-vorta-fault-panel="true"
      className={`fixed z-[70] overflow-hidden rounded-2xl border border-gray-800 bg-[#10151f] shadow-2xl shadow-black/50 transition-all duration-200 max-sm:inset-0 max-sm:rounded-none sm:right-4 ${
        minimised
          ? "bottom-4 h-[58px] w-[min(520px,calc(100vw-2rem))]"
          : "bottom-4 top-4 w-[min(520px,calc(100vw-2rem))]"
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
              <h3 className="truncate text-sm font-semibold text-slate-100">
                Vorta AI
              </h3>
              <p className="truncate text-[9px] text-slate-500">
                Live fault history, engineer identity and equipment SME
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMinimised((value) => !value)}
              className="rounded-md p-2 text-slate-500 transition-colors hover:bg-gray-800 hover:text-slate-300"
              aria-label={
                minimised ? "Expand fault assistant" : "Minimise fault assistant"
              }
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  minimised ? "rotate-180" : ""
                }`}
              />
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
                [
                  "Unresolved history",
                  "Show only unresolved fault history and repeat records",
                ],
                [
                  "Best on-shift engineer",
                  "Which relevant engineer is confirmed on shift and has the highest recorded rating?",
                ],
                [
                  "Equipment SME",
                  "Who is the recorded SME for this equipment and are they scheduled today?",
                ],
                [
                  "Best document",
                  "Which indexed manual page or drawing is the strongest match?",
                ],
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
              Live work orders, indexed documents, recorded SME capabilities,
              profile images, skill ratings and shift status only.
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
                    <p className="text-xs font-medium text-slate-300">
                      Checking live Vorta records
                    </p>
                    <p className="mt-1 text-[9px] text-slate-500">
                      Work orders · documents · SME · profile images · skills ·
                      shift status
                    </p>
                  </div>
                </div>
              )}

              {error && !loading && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <div>
                      <p className="text-xs font-semibold text-red-200">
                        Fault intelligence could not load
                      </p>
                      <p className="mt-1 text-[10px] leading-relaxed text-red-100/70">
                        {error}
                      </p>
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
                      <span className="text-[9px] font-semibold text-blue-400">
                        {result.confidence}% source coverage
                      </span>
                    </div>
                    <h4 className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Answer
                    </h4>
                    <p className="mt-1.5 text-[11px] leading-[1.65] text-slate-200">
                      {buildAnswerWithSme(result)}
                    </p>

                    {actions.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Recommended action
                        </h4>
                        <ul className="mt-1.5 space-y-1.5">
                          {actions.map((action) => (
                            <li
                              key={action}
                              className="flex gap-2 text-[10px] leading-relaxed text-slate-300"
                            >
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>

                  <EquipmentSmeSection
                    sme={result.equipmentSme}
                    equipmentName={
                      result.primaryEquipment?.name ?? "No matched equipment"
                    }
                  />
                  <HistorySection records={result.history} />
                  <EngineerSection
                    engineers={result.engineers}
                    shiftLabel={result.shiftLabel}
                    shiftWindow={result.shiftWindow}
                    shiftBasis={result.shiftBasis}
                  />
                  <DocumentSection
                    documents={result.documents}
                    equipmentId={result.primaryEquipment?.id ?? null}
                  />

                  {result.sourceErrors.length > 0 && (
                    <section className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] px-3 py-2.5">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-yellow-200/70">
                        Missing source data
                      </h4>
                      <ul className="mt-1.5 space-y-1">
                        {result.sourceErrors.map((item) => (
                          <li
                            key={item}
                            className="text-[9.5px] leading-relaxed text-yellow-100/65"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 pt-3 text-[9px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      No synthetic work orders, documents, people, profile images,
                      SME roles or ratings
                    </span>
                    <span>
                      {result.searchedAssetCount} asset
                      {result.searchedAssetCount === 1 ? "" : "s"} checked
                    </span>
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
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setInput(event.target.value)
                  }
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

interface GlobalMaintenanceAiAssistantWithFaultsV2Props {
  role?: VortaAiRole;
}

export function GlobalMaintenanceAiAssistantWithFaultsV2({
  role = "maintenance-manager",
}: GlobalMaintenanceAiAssistantWithFaultsV2Props): JSX.Element {
  return (
    <>
      <GlobalMaintenanceAiAssistant role={role} />
      <FaultIntelligenceDrawer role={role} />
    </>
  );
}
