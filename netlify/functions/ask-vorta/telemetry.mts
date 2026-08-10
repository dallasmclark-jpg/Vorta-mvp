import type { SupabaseClient } from "@supabase/supabase-js";
import type { AskVortaPhase, AskVortaRequest, JsonRecord } from "./contracts.mjs";
import {
  ASK_VORTA_RATE_LIMIT_REQUESTS,
  ASK_VORTA_RATE_LIMIT_WINDOW_MINUTES,
} from "./rate-limit-policy.mjs";
import { jsonResponse } from "./request-context.mjs";

interface BeginAskVortaInteractionInput {
  supabase: SupabaseClient;
  request: AskVortaRequest;
  userId: string;
  requestId: string;
  startedAt: number;
  questionFingerprint: string;
  routeKey: string;
  routingMode: string;
}

export type BeginAskVortaInteractionResult =
  | { ok: true; interactionId: string }
  | { ok: false; response: Response };

export async function beginAskVortaInteraction(
  input: BeginAskVortaInteractionInput,
): Promise<BeginAskVortaInteractionResult> {
  const rateWindowStart = new Date(
    input.startedAt - ASK_VORTA_RATE_LIMIT_WINDOW_MINUTES * 60_000,
  ).toISOString();
  const { count: recentRequestCount, error: rateError } = await input.supabase
    .from("ask_vorta_interactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .neq("status", "rate_limited")
    .gte("created_at", rateWindowStart);
  if (rateError) {
    console.error("Ask Vorta rate-limit check failed", {
      requestId: input.requestId,
      error: rateError.message,
    });
    return { ok: false, response: jsonResponse({ error: "Ask Vorta could not verify request capacity." }, 503) };
  }
  if ((recentRequestCount ?? 0) >= ASK_VORTA_RATE_LIMIT_REQUESTS) {
    await input.supabase.from("ask_vorta_interactions").insert({
      id: crypto.randomUUID(),
      site_id: input.request.siteId,
      user_id: input.userId,
      role: input.request.role,
      question_fingerprint: input.questionFingerprint,
      route_key: input.routeKey,
      routing_mode: input.routingMode,
      planner_ms: 0,
      evidence_ms: 0,
      answer_ms: 0,
      tool_count: 0,
      tool_round_count: 0,
      duration_ms: Date.now() - input.startedAt,
      status: "rate_limited",
      completed_at: new Date().toISOString(),
    });
    return {
      ok: false,
      response: jsonResponse(
        { error: `Ask Vorta allows ${ASK_VORTA_RATE_LIMIT_REQUESTS} analyses every ${ASK_VORTA_RATE_LIMIT_WINDOW_MINUTES} minutes per user. This protects the service from runaway or automated request loops without imposing a practical daily search cap.` },
        429,
      ),
    };
  }

  const interactionId = crypto.randomUUID();
  const { error: interactionError } = await input.supabase
    .from("ask_vorta_interactions")
    .insert({
      id: interactionId,
      site_id: input.request.siteId,
      user_id: input.userId,
      role: input.request.role,
      question_fingerprint: input.questionFingerprint,
      route_key: input.routeKey,
      routing_mode: input.routingMode,
      planner_ms: 0,
      evidence_ms: 0,
      answer_ms: 0,
      tool_count: 0,
      tool_round_count: 0,
      status: "started",
    });
  if (interactionError) {
    console.error("Ask Vorta telemetry start failed", {
      requestId: input.requestId,
      error: interactionError.message,
    });
    return { ok: false, response: jsonResponse({ error: "Ask Vorta could not start a traceable analysis." }, 503) };
  }
  return { ok: true, interactionId };
}

interface AskVortaTelemetryValuesInput {
  status: "completed" | "failed" | "fallback" | "timed_out";
  routeKey: string;
  routingMode: string;
  plannerMs: number;
  evidenceMs: number;
  answerMs: number;
  toolCount: number;
  toolRoundCount: number;
  failureStage: AskVortaPhase | null;
  startedAt: number;
}

export function buildAskVortaTelemetryValues(
  input: AskVortaTelemetryValuesInput,
): JsonRecord {
  return {
    route_key: input.routeKey,
    routing_mode: input.status === "fallback" ? "fallback" : input.routingMode,
    planner_ms: input.plannerMs,
    evidence_ms: input.evidenceMs,
    answer_ms: input.answerMs,
    tool_count: input.toolCount,
    tool_round_count: input.toolRoundCount,
    failure_stage: input.status === "completed" ? null : input.failureStage,
    duration_ms: Date.now() - input.startedAt,
    status: input.status,
    completed_at: new Date().toISOString(),
  };
}

export async function updateAskVortaInteraction(
  supabase: SupabaseClient,
  interactionId: string,
  userId: string,
  values: JsonRecord,
): Promise<void> {
  await supabase
    .from("ask_vorta_interactions")
    .update(values)
    .eq("id", interactionId)
    .eq("user_id", userId);
}
