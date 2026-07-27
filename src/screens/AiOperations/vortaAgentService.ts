import { supabase } from "../../lib/supabaseClient";

export interface VortaAgentHistoryItem {
  role: "user" | "assistant";
  content: string;
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
}

interface AskVortaAgentInput {
  question: string;
  role: string;
  siteId: string;
  history: VortaAgentHistoryItem[];
  pagePath: string;
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
  };
}

export async function submitAskVortaFeedback(
  responseId: string,
  feedback: "helpful" | "not_helpful",
  reason?: string,
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user.id) {
    throw new Error("Your Vorta session has expired.");
  }
  const { error } = await supabase
    .from("ask_vorta_interactions")
    .update({
      feedback,
      feedback_reason: reason?.trim().slice(0, 500) || null,
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
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Your Vorta session has expired.");
  const { data, error } = await supabase
    .from("ask_vorta_action_drafts")
    .insert({
      interaction_id: responseId || null,
      site_id: siteId,
      user_id: userId,
      priority: action.priority,
      action: action.action,
      owner: action.owner,
      expected_impact: action.expectedImpact,
      verification: action.verification,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    throw new Error("Vorta could not prepare this action draft.");
  }
  return String(data.id);
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
  pagePath,
}: AskVortaAgentInput): Promise<VortaAgentAnswer> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Your Vorta session has expired. Sign in again to use Ask Vorta.");
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/ask-vorta", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        question: question.trim(),
        role,
        siteId,
        history: history.slice(-8),
        pageContext: {
          path: pagePath,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload &&
        typeof payload === "object" &&
        typeof (payload as Record<string, unknown>).error === "string"
          ? String((payload as Record<string, unknown>).error)
          : "Ask Vorta could not complete the analysis.";
      const responseId =
        payload &&
        typeof payload === "object" &&
        typeof (payload as Record<string, unknown>).responseId === "string"
          ? String((payload as Record<string, unknown>).responseId)
          : undefined;
      throw new AskVortaAgentError(message, responseId);
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
