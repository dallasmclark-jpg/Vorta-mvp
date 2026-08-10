import { supabase } from "../../lib/supabaseClient";
import type { PreparedAskVortaImage } from "./askVortaImageClient";

export const ASK_VORTA_PROGRESS_EVENT = "vorta-ask-vorta-progress";
export const ASK_VORTA_PROGRESS_RESET_EVENT = "vorta-ask-vorta-progress-reset";

export interface VortaAgentProgressEvent {
  id: string;
  label: string;
  state: "active" | "complete" | "failed";
  detail?: string;
}

export interface VortaAgentHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface VortaConversationContextOption {
  position: number;
  type: "equipment" | "ranked_action" | "cover" | "spare" | "document" | "work" | "skill";
  label: string;
  equipmentQuery?: string;
  equipmentId?: string;
  reference?: string;
  value?: string;
}

export interface VortaConversationContext {
  version: 1;
  subject: string;
  intent: string;
  activeEquipment: {
    query: string;
    id?: string;
    code?: string;
    name?: string;
  } | null;
  area: string | null;
  shift: {
    team?: string;
    type?: string;
    date?: string;
  } | null;
  dateRange: {
    startDate: string;
    endDate: string;
    timezone: string;
  } | null;
  orderedOptions: VortaConversationContextOption[];
  selectedOption: VortaConversationContextOption | null;
  updatedAt: string | null;
}

export interface VortaAgentFinding {
  category: "cover" | "absence" | "skill" | "spare" | "work" | "history" | "document" | "risk" | "data";
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  detail: string;
}

export interface VortaAgentCoverOption {
  engineerNames: string[];
  shift: string;
  reason: string;
  skillsCovered: string[];
  assetsProtected: string[];
  projectedImpact: string;
  remainingRisk: string;
  caveat: string;
}

export interface VortaAgentAction {
  priority: "now" | "before_shift" | "this_week" | "planned";
  action: string;
  owner: string;
  expectedImpact: string;
  verification: string;
}

export interface VortaAgentEvidenceLink {
  label: string;
  path: string;
  recordType: "shift" | "handover" | "equipment" | "work" | "spare" | "skill" | "document" | "risk";
}

export interface VortaAgentAnswer {
  responseId: string;
  directAnswer: string;
  decisionSummary: VortaAgentDecisionSummaryItem[];
  evidence: string[];
  findings: VortaAgentFinding[];
  coverOptions: VortaAgentCoverOption[];
  recommendedActions: string[];
  actionPlan: VortaAgentAction[];
  followUpQuestions: string[];
  sources: string[];
  missingData: string[];
  confidence: number;
  intentLabel: string;
  toolsUsed: string[];
  evidenceLinks: VortaAgentEvidenceLink[];
  evidenceGeneratedAt?: string;
  conversationContext?: VortaConversationContext;
}

export type AskVortaFeedbackCategory =
  | "wrong_route"
  | "missing_evidence"
  | "too_slow"
  | "unclear"
  | "incorrect"
  | "too_much_detail"
  | "other";

export interface VortaAgentDecisionSummaryItem {
  label: string;
  value: string;
}

interface AskVortaAgentInput {
  question: string;
  role: string;
  siteId: string;
  history: VortaAgentHistoryItem[];
  conversationContext?: VortaConversationContext;
  image?: PreparedAskVortaImage;
  pagePath: string;
}

interface AskVortaStreamResult {
  ok: boolean;
  status: number;
  payload: unknown;
}

const REQUEST_TIMEOUT_MS = 55_000;

export class AskVortaAgentError extends Error {
  responseId?: string;

  constructor(message: string, responseId?: string) {
    super(message);
    this.name = "AskVortaAgentError";
    this.responseId = responseId;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFindings(value: unknown): value is VortaAgentFinding[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.category === "string" &&
        typeof item.severity === "string" &&
        typeof item.title === "string" &&
        typeof item.detail === "string",
    )
  );
}

function isDecisionSummary(
  value: unknown,
): value is VortaAgentDecisionSummaryItem[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.label === "string" &&
        Boolean(item.label.trim()) &&
        typeof item.value === "string" &&
        Boolean(item.value.trim()),
    )
  );
}

function isCoverOptions(value: unknown): value is VortaAgentCoverOption[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        isStringArray(item.engineerNames) &&
        typeof item.shift === "string" &&
        typeof item.reason === "string" &&
        isStringArray(item.skillsCovered) &&
        isStringArray(item.assetsProtected) &&
        typeof item.projectedImpact === "string" &&
        typeof item.remainingRisk === "string" &&
        typeof item.caveat === "string",
    )
  );
}

function isActionPlan(value: unknown): value is VortaAgentAction[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.priority === "string" &&
        typeof item.action === "string" &&
        typeof item.owner === "string" &&
        typeof item.expectedImpact === "string" &&
        typeof item.verification === "string",
    )
  );
}

function isEvidenceLinks(value: unknown): value is VortaAgentEvidenceLink[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.label === "string" &&
        typeof item.path === "string" &&
        item.path.startsWith("/") &&
        typeof item.recordType === "string",
    )
  );
}

function isConversationContextOption(value: unknown): value is VortaConversationContextOption {
  return (
    isRecord(value) &&
    Number.isInteger(value.position) &&
    Number(value.position) >= 1 &&
    Number(value.position) <= 8 &&
    typeof value.type === "string" &&
    typeof value.label === "string" &&
    Boolean(value.label.trim())
  );
}

function isConversationContext(value: unknown): value is VortaConversationContext {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.subject === "string" &&
    typeof value.intent === "string" &&
    (value.activeEquipment === null || isRecord(value.activeEquipment)) &&
    (value.area === null || typeof value.area === "string") &&
    (value.shift === null || isRecord(value.shift)) &&
    (value.dateRange === null || isRecord(value.dateRange)) &&
    Array.isArray(value.orderedOptions) &&
    value.orderedOptions.length <= 8 &&
    value.orderedOptions.every(isConversationContextOption) &&
    (value.selectedOption === null || isConversationContextOption(value.selectedOption))
  );
}

function isProgressEvent(value: unknown): value is VortaAgentProgressEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    Boolean(value.id.trim()) &&
    typeof value.label === "string" &&
    Boolean(value.label.trim()) &&
    (value.state === "active" || value.state === "complete" || value.state === "failed") &&
    (value.detail === undefined || typeof value.detail === "string")
  );
}

function dispatchProgressReset(): void {
  window.dispatchEvent(new Event(ASK_VORTA_PROGRESS_RESET_EVENT));
}

function dispatchProgress(event: VortaAgentProgressEvent): void {
  window.dispatchEvent(
    new CustomEvent<VortaAgentProgressEvent>(ASK_VORTA_PROGRESS_EVENT, {
      detail: event,
    }),
  );
}

function parseAgentAnswer(value: unknown): VortaAgentAnswer {
  if (!isRecord(value)) {
    throw new Error("Ask Vorta returned an invalid response.");
  }

  const record = value;
  if (
    typeof record.directAnswer !== "string" ||
    !record.directAnswer.trim() ||
    typeof record.responseId !== "string" ||
    !record.responseId ||
    !isDecisionSummary(record.decisionSummary) ||
    !isStringArray(record.evidence) ||
    !isFindings(record.findings) ||
    !isCoverOptions(record.coverOptions) ||
    !isStringArray(record.recommendedActions) ||
    !isActionPlan(record.actionPlan) ||
    !isStringArray(record.followUpQuestions) ||
    !isStringArray(record.sources) ||
    !isStringArray(record.missingData) ||
    !isStringArray(record.toolsUsed) ||
    !isEvidenceLinks(record.evidenceLinks) ||
    typeof record.intentLabel !== "string" ||
    typeof record.confidence !== "number" ||
    !Number.isFinite(record.confidence)
  ) {
    throw new Error("Ask Vorta returned an incomplete response.");
  }

  return {
    responseId: record.responseId,
    directAnswer: record.directAnswer.trim(),
    decisionSummary: record.decisionSummary.map((item) => ({
      label: item.label.trim(),
      value: item.value.trim(),
    })),
    evidence: record.evidence,
    findings: record.findings,
    coverOptions: record.coverOptions,
    recommendedActions: record.recommendedActions,
    actionPlan: record.actionPlan,
    followUpQuestions: record.followUpQuestions,
    sources: [...new Set(record.sources)],
    missingData: record.missingData,
    confidence: Math.max(0, Math.min(100, Math.round(record.confidence))),
    intentLabel: record.intentLabel.trim() || "Vorta analysis",
    toolsUsed: [...new Set(record.toolsUsed)],
    evidenceLinks: record.evidenceLinks,
    evidenceGeneratedAt:
      typeof record.evidenceGeneratedAt === "string" &&
      Number.isFinite(new Date(record.evidenceGeneratedAt).getTime())
        ? record.evidenceGeneratedAt
        : undefined,
    conversationContext: isConversationContext(record.conversationContext)
      ? record.conversationContext
      : undefined,
  };
}

function errorFromPayload(payload: unknown): AskVortaAgentError {
  const message =
    isRecord(payload) && typeof payload.error === "string"
      ? payload.error
      : "Ask Vorta could not complete the analysis.";
  const responseId =
    isRecord(payload) && typeof payload.responseId === "string"
      ? payload.responseId
      : undefined;
  return new AskVortaAgentError(message, responseId);
}

function processStreamLine(line: string): AskVortaStreamResult | null {
  if (!line.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.type !== "string") return null;
  if (parsed.type === "progress" && isProgressEvent(parsed.event)) {
    dispatchProgress(parsed.event);
    return null;
  }
  if (
    parsed.type === "result" &&
    typeof parsed.ok === "boolean" &&
    typeof parsed.status === "number"
  ) {
    return {
      ok: parsed.ok,
      status: parsed.status,
      payload: parsed.payload,
    };
  }
  return null;
}

async function readAskVortaStream(response: Response): Promise<AskVortaStreamResult> {
  if (!response.body) {
    throw new Error("Ask Vorta progress stream was unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: AskVortaStreamResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      finalResult = processStreamLine(line) ?? finalResult;
      newline = buffer.indexOf("\n");
    }
    if (done) break;
  }

  if (buffer.trim()) {
    finalResult = processStreamLine(buffer) ?? finalResult;
  }
  if (!finalResult) {
    throw new Error("Ask Vorta ended before returning a final answer.");
  }
  return finalResult;
}

export async function submitAskVortaFeedback(
  responseId: string,
  feedback: "helpful" | "not_helpful",
  options: {
    category?: AskVortaFeedbackCategory;
    reason?: string;
  } = {},
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user.id) {
    throw new Error("Your Vorta session has expired.");
  }
  const { error } = await supabase
    .from("ask_vorta_interactions")
    .update({
      feedback,
      feedback_category:
        feedback === "not_helpful" ? options.category ?? null : null,
      feedback_reason:
        feedback === "not_helpful"
          ? options.reason?.trim().slice(0, 500) || null
          : null,
      feedback_at: new Date().toISOString(),
    })
    .eq("id", responseId)
    .eq("user_id", sessionData.session.user.id);
  if (error) throw new Error("Vorta could not save this feedback.");
}

export async function createAskVortaActionDraft({
  responseId,
  siteId,
  action,
}: {
  responseId?: string;
  siteId: string;
  action: VortaAgentAction;
}): Promise<string> {
  throw new Error(
    "Controlled Ask Vorta actions require the review dialog and explicit server confirmation.",
  );
}

export async function markAskVortaFallback(responseId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return;
  await supabase
    .from("ask_vorta_interactions")
    .update({
      status: "fallback",
      completed_at: new Date().toISOString(),
    })
    .eq("id", responseId)
    .eq("user_id", userId);
}

export async function askVortaAgent({
  question,
  role,
  siteId,
  history,
  conversationContext,
  image,
  pagePath,
}: AskVortaAgentInput): Promise<VortaAgentAnswer> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Your Vorta session has expired. Sign in again to use Ask Vorta.");
  }

  dispatchProgressReset();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/ask-vorta", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson, application/json;q=0.9",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        question: question.trim(),
        role,
        siteId,
        history: history.slice(-8),
        conversationContext,
        image: image
          ? {
              name: image.name,
              mimeType: image.mimeType,
              dataUrl: image.dataUrl,
            }
          : undefined,
        pageContext: {
          path: pagePath,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
        },
      }),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("application/x-ndjson")) {
      const streamed = await readAskVortaStream(response);
      if (!streamed.ok) throw errorFromPayload(streamed.payload);
      return parseAgentAnswer(streamed.payload);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw errorFromPayload(payload);
    }

    return parseAgentAnswer(payload);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Ask Vorta took too long to analyse the available evidence.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}