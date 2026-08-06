import type { Context } from "@netlify/functions";
import {
  resolveConversationFollowUp,
} from "../_shared/askVortaConversationContext.mjs";
import type {
  AskVortaPhase,
  JsonRecord,
  ToolResult,
} from "./contracts.mjs";
import { EVIDENCE_TIMEOUT_MS } from "./contracts.mjs";
import { authenticateAskVortaRequest } from "./authenticated-context.mjs";
import {
  AskVortaPhaseTimeoutError,
  canonicalRouteKey,
  routingModeForPlan,
  withPhaseTimeout,
} from "./phase-runtime.mjs";
import {
  buildConversationContext,
  jsonResponse,
  parseRequest,
} from "./request-context.mjs";
import {
  enforceAnswerEvidence,
  enforceDeterministicResponseShape,
  enforcePlannedResponseShape,
  evidenceAwareConfidence,
} from "./response-validation.mjs";
import {
  loadSiteRiskMovement,
  siteRiskMovementAnswer,
  siteRiskMovementQuestionPlan,
} from "./site-risk-movement.mjs";
import {
  beginAskVortaInteraction,
  buildAskVortaTelemetryValues,
  updateAskVortaInteraction,
} from "./telemetry.mjs";
import { numberValue, sha256Fingerprint } from "./utilities.mjs";

export async function handleSiteRiskMovementRequest(
  req: Request,
  context: Context,
): Promise<Response | null> {
  let candidate: ReturnType<typeof parseRequest> = null;
  try {
    candidate = parseRequest(await req.clone().json());
  } catch {
    return null;
  }
  if (!candidate || !siteRiskMovementQuestionPlan(candidate)) return null;

  const authenticated = await authenticateAskVortaRequest(req);
  if (!authenticated.ok) return authenticated.response;
  const { request, supabase, userId } = authenticated;
  const questionPlan = siteRiskMovementQuestionPlan(request);
  if (!questionPlan) return null;

  const startedAt = Date.now();
  const routeKey = canonicalRouteKey(questionPlan);
  const routingMode = routingModeForPlan(questionPlan);
  const questionFingerprint = await sha256Fingerprint(
    `${request.question.trim().toLowerCase()}|image:`,
  );
  const telemetryStart = await beginAskVortaInteraction({
    supabase,
    request,
    userId,
    requestId: context.requestId,
    startedAt,
    questionFingerprint,
    routeKey,
    routingMode,
  });
  if (!telemetryStart.ok) return telemetryStart.response;
  const { interactionId } = telemetryStart;

  let evidenceMs = 0;
  let failureStage: AskVortaPhase | null = null;
  const toolsUsed = new Set(["get_site_risk_movement"]);
  const sources = new Set<string>();
  const outcomes = new Map<string, ToolResult>();
  const conversationResolution = resolveConversationFollowUp(
    request.question,
    request.conversationContext,
  );
  const telemetryValues = (
    status: "completed" | "failed" | "fallback" | "timed_out",
  ): JsonRecord => buildAskVortaTelemetryValues({
    status,
    routeKey,
    routingMode,
    plannerMs: 0,
    evidenceMs,
    answerMs: 0,
    toolCount: toolsUsed.size,
    toolRoundCount: 1,
    failureStage,
    startedAt,
  });

  try {
    const evidenceStartedAt = Date.now();
    const result = await withPhaseTimeout(
      "evidence",
      EVIDENCE_TIMEOUT_MS,
      () => loadSiteRiskMovement(supabase, request),
    );
    evidenceMs = Date.now() - evidenceStartedAt;
    outcomes.set("get_site_risk_movement", result);
    if (result.status !== "unavailable") sources.add(result.source);

    const answer = siteRiskMovementAnswer(request, questionPlan, outcomes);
    if (!answer) {
      throw new Error("The site-risk movement answer could not be constructed.");
    }
    enforceAnswerEvidence(answer, request.question, null, null);
    enforceDeterministicResponseShape(answer, questionPlan);
    enforcePlannedResponseShape(answer, questionPlan);
    answer.confidence = evidenceAwareConfidence(answer, questionPlan, outcomes);
    answer.sources = [...sources];
    answer.toolsUsed = [...toolsUsed];
    answer.evidenceLinks = [{
      label: "Open site risk",
      path: "/dashboard",
      recordType: "risk",
    }];
    answer.responseId = interactionId;
    answer.conversationContext = buildConversationContext(
      request,
      questionPlan,
      outcomes,
      answer,
      conversationResolution,
    );

    await updateAskVortaInteraction(
      supabase,
      interactionId,
      userId,
      {
        ...telemetryValues("completed"),
        intent_label: routeKey,
        tools_used: [...toolsUsed],
        sources: [...sources],
        confidence: Math.max(
          0,
          Math.min(100, Math.round(numberValue(answer.confidence))),
        ),
        missing_data_count: Array.isArray(answer.missingData)
          ? answer.missingData.length
          : 0,
      },
    );
    return jsonResponse(answer);
  } catch (error) {
    if (error instanceof AskVortaPhaseTimeoutError) {
      failureStage = error.stage;
    }
    await updateAskVortaInteraction(
      supabase,
      interactionId,
      userId,
      {
        ...telemetryValues(
          error instanceof AskVortaPhaseTimeoutError ? "timed_out" : "failed",
        ),
        tools_used: [...toolsUsed],
        sources: [...sources],
      },
    );
    console.error("Ask Vorta site-risk movement route failed", {
      requestId: context.requestId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(
      {
        error:
          error instanceof AskVortaPhaseTimeoutError
            ? "Ask Vorta could not retrieve the site-risk history in time."
            : "The verified site-risk comparison is temporarily unavailable.",
        responseId: interactionId,
      },
      error instanceof AskVortaPhaseTimeoutError ? 504 : 503,
    );
  }
}
