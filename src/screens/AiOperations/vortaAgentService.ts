import { supabase } from "../../lib/supabaseClient";

export interface VortaAgentHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface VortaAgentAnswer {
  directAnswer: string;
  evidence: string[];
  recommendedActions: string[];
  sources: string[];
  missingData: string[];
  confidence: number;
  intentLabel: string;
  toolsUsed: string[];
}

interface AskVortaAgentInput {
  question: string;
  role: string;
  siteId: string;
  history: VortaAgentHistoryItem[];
  pagePath: string;
}

const REQUEST_TIMEOUT_MS = 55_000;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseAgentAnswer(value: unknown): VortaAgentAnswer {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Ask Vorta returned an invalid response.");
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.directAnswer !== "string" ||
    !record.directAnswer.trim() ||
    !isStringArray(record.evidence) ||
    !isStringArray(record.recommendedActions) ||
    !isStringArray(record.sources) ||
    !isStringArray(record.missingData) ||
    !isStringArray(record.toolsUsed) ||
    typeof record.intentLabel !== "string" ||
    typeof record.confidence !== "number" ||
    !Number.isFinite(record.confidence)
  ) {
    throw new Error("Ask Vorta returned an incomplete response.");
  }

  return {
    directAnswer: record.directAnswer.trim(),
    evidence: record.evidence,
    recommendedActions: record.recommendedActions,
    sources: [...new Set(record.sources)],
    missingData: record.missingData,
    confidence: Math.max(0, Math.min(100, Math.round(record.confidence))),
    intentLabel: record.intentLabel.trim() || "Vorta analysis",
    toolsUsed: [...new Set(record.toolsUsed)],
  };
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
      throw new Error(message);
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
