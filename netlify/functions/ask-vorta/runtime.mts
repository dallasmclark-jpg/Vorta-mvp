import type { Config, Context } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type { ResponseInput, Tool } from "openai/resources/responses/responses";
import {
  safeAskVortaImageMetadata,
  validateAskVortaImage,
} from "../_shared/askVortaImageEvidence.mjs";
import {
  contextResolutionPrompt,
  createConversationContext,
  resolveConversationFollowUp,
  sanitizeConversationContext,
} from "../_shared/askVortaConversationContext.mjs";
import type { AskVortaPhase, AskVortaRequest, EvidenceLink, JsonRecord, ToolResult } from "./contracts.mjs";
import { ANSWER_SCHEMA, ANSWER_TIMEOUT_MS, EVIDENCE_TIMEOUT_MS, MAX_TOOL_ROUNDS, MODEL, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MINUTES, TOOLS, decisionPackCoveringTool, successfulToolNames } from "./contracts.mjs";
import { deterministicOperationalAnswer } from "./decision-answer.mjs";
import { repairEquipmentDecisionAnswer, retainEquipmentDecisionFacts, trimToolResult } from "./equipment-evidence.mjs";
import { buildAskVortaImageDiagnosis, directImageEvidenceAnswer, enforceImageDiagnosisAnswer, imageDiagnosisPrompt, imageDiagnosisQuestionPlan } from "./image-diagnosis.mjs";
import { AskVortaPhaseTimeoutError, canonicalRouteKey, routingModeForPlan, withPhaseTimeout } from "./phase-runtime.mjs";
import { buildConversationContext, enrichQuestionWithConversationContext, jsonResponse, parseRequest } from "./request-context.mjs";
import { answerOutputTokenBudget, answerReasoningEffort, enforceAnswerEvidence, enforceBacklogActionPlan, enforceDeterministicResponseShape, enforceEquipmentReturnToServiceSafety, enforcePlannedResponseShape, evidenceAwareConfidence } from "./response-validation.mjs";
import { buildQuestionPlan, deterministicQuestionPlan, systemInstructions } from "./route-planning.mjs";
import {
  loadSiteRiskMovement,
  siteRiskMovementAnswer,
  siteRiskMovementQuestionPlan,
} from "./site-risk-movement.mjs";
import { evidenceLinkForTool, executeTool } from "./tool-execution.mjs";
import { normaliseRelativeShiftCoverArguments, numberValue, parseArguments, sha256Fingerprint, textValues } from "./utilities.mjs";

import { authenticateAskVortaRequest } from "./authenticated-context.mjs";
import { beginAskVortaInteraction, buildAskVortaTelemetryValues, updateAskVortaInteraction } from "./telemetry.mjs";
export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const authenticated = await authenticateAskVortaRequest(req);
  if (!authenticated.ok) return authenticated.response;
  const { request, supabase, userId } = authenticated;
  const startedAt = Date.now();
  const preliminaryPlan =
    siteRiskMovementQuestionPlan(request) ?? deterministicQuestionPlan(request);
  const preliminaryRouteKey = canonicalRouteKey(preliminaryPlan);
  const preliminaryRoutingMode = routingModeForPlan(preliminaryPlan);
  const imageFingerprint = request.image
    ? await sha256Fingerprint(request.image.dataUrl)
    : "";
  const questionFingerprint = await sha256Fingerprint(
    `${request.question.trim().toLowerCase()}|image:${imageFingerprint}`,
  );
  const telemetryStart = await beginAskVortaInteraction({
    supabase,
    request,
    userId,
    requestId: _context.requestId,
    startedAt,
    questionFingerprint,
    routeKey: preliminaryRouteKey,
    routingMode: preliminaryRoutingMode,
  });
  if (!telemetryStart.ok) return telemetryStart.response;
  const { interactionId } = telemetryStart;
  let plannerMs = 0;
  let evidenceMs = 0;
  let answerMs = 0;
  let toolRoundCount = 0;
  let failureStage: AskVortaPhase | null = null;
  const plannerStartedAt = Date.now();
  const client = new OpenAI();
  const imageDiagnosis = await buildAskVortaImageDiagnosis(
    client,
    supabase,
    request,
  );
  const conversationResolution = resolveConversationFollowUp(
    request.question,
    request.conversationContext,
  );
  const planningRequest: AskVortaRequest = {
    ...request,
    question: enrichQuestionWithConversationContext(
      request.question,
      conversationResolution,
    ),
  };
  let questionPlan: JsonRecord | null = imageDiagnosis
    ? imageDiagnosisQuestionPlan(request, imageDiagnosis)
    : conversationResolution.shouldClarify
      ? {
        routingMode: "deterministic",
        scope: "clarification",
        intentLabel: "Clarify follow-up reference",
        decisionGoal: conversationResolution.clarificationQuestion ?? "Clarify the intended prior option.",
        shouldUseTools: false,
        requiredTools: [],
        optionalTools: [],
        equipmentQuery: "",
        startDate: "",
        endDate: "",
        ambiguity: conversationResolution.clarificationQuestion ?? "The prior reference is ambiguous.",
        answerFocus: "Ask one concise clarification and do not guess.",
        verificationChecks: ["Confirm the intended prior option or asset."],
      }
      : siteRiskMovementQuestionPlan(planningRequest) ??
        deterministicQuestionPlan(planningRequest);
  if (!questionPlan) {
    try {
      questionPlan = await buildQuestionPlan(client, planningRequest);
      plannerMs = Date.now() - plannerStartedAt;
    } catch (error) {
      plannerMs = Date.now() - plannerStartedAt;
      failureStage = error instanceof AskVortaPhaseTimeoutError ? error.stage : "planner";
      console.warn("Ask Vorta semantic planning failed; continuing with direct evidence reasoning", {
        requestId: _context.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const plannedIntent = String(questionPlan?.intentLabel ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (
    questionPlan?.routingMode !== "deterministic" &&
    (
      plannedIntent === "site_priorities" ||
      plannedIntent === "site_threat_prioritization" ||
      plannedIntent === "site_threat_prioritisation"
    )
  ) {
    questionPlan = {
      ...questionPlan,
      scope: "site_priorities",
      intentLabel: "site_threat_prioritization",
      shouldUseTools: true,
      requiredTools: ["get_site_operational_snapshot"],
      optionalTools: [],
      equipmentQuery: "",
      ambiguity: "none",
      answerFocus:
        "Rank the main current maintenance threats from the authorised operational-value evidence, state the first executable action and retain exact impact, blockers, owner and verification.",
      verificationChecks: [
        "Use only the authorised site operational snapshot.",
        "Do not repeat equipment specialist lookups unless the user explicitly names an asset.",
      ],
      routingMode: "deterministic",
      summaryItemLimit: 5,
      forceActionPlan: true,
      followUpLimit: 1,
    };
  }

  const routeKey = canonicalRouteKey(questionPlan);
  const routingMode = routingModeForPlan(questionPlan);
  const input: ResponseInput = [
    ...request.history.map((item) => ({
      role: item.role,
      content: item.content,
    })),
    ...(imageDiagnosis
      ? [{
          role: "user" as const,
          content:
            "Verified bounded image evidence. The raw photo is not part of conversation history. Separate visible OCR from Vorta records and never infer safe return to service from this evidence alone: " +
            imageDiagnosisPrompt(imageDiagnosis),
        }]
      : []),
    ...(conversationResolution.usedContext
      ? [{
          role: "user" as const,
          content:
            "Validated structured conversation context for this follow-up: " +
            contextResolutionPrompt(conversationResolution),
        }]
      : []),
    { role: "user", content: request.question },
  ];
  const usedSources = new Set<string>();
  if (imageDiagnosis) usedSources.add("User-supplied image evidence");
  const usedTools = new Set<string>();
  const toolOutcomes = new Map<string, ToolResult>();
  const evidenceLinks = new Map<string, EvidenceLink>();
  let shiftCoverEvidence: JsonRecord | null = null;
  let shiftCoverArguments: JsonRecord | null = null;
  const deterministicToolNames =
    questionPlan?.routingMode === "deterministic"
      ? textValues(questionPlan.requiredTools)
      : [];
  const hasDeterministicRouting = deterministicToolNames.length > 0;
  const deterministicArgumentsFor = (toolName: string): JsonRecord => {
    if (toolName === "get_shift_cover" || toolName === "get_site_maintenance_plan") {
      return {
        start_date:
          typeof questionPlan?.startDate === "string"
            ? questionPlan.startDate
            : "",
        end_date:
          typeof questionPlan?.endDate === "string"
            ? questionPlan.endDate
            : "",
      };
    }
    if (toolName === "get_equipment_decision_pack") {
      return {
        query:
          typeof questionPlan?.equipmentQuery === "string"
            ? questionPlan.equipmentQuery
            : "",
      };
    }
    return {};
  };

  const telemetryValues = (
    status: "completed" | "failed" | "fallback" | "timed_out",
  ): JsonRecord => buildAskVortaTelemetryValues({
    status,
    routeKey,
    routingMode,
    plannerMs,
    evidenceMs,
    answerMs,
    toolCount: usedTools.size,
    toolRoundCount,
    failureStage,
    startedAt,
  });
  const completeDeterministicAnswer = async (
    answer: JsonRecord,
  ): Promise<Response> => {
    enforceAnswerEvidence(
      answer,
      request.question,
      shiftCoverEvidence,
      shiftCoverArguments,
    );
    enforceDeterministicResponseShape(answer, questionPlan);
    enforcePlannedResponseShape(answer, questionPlan);
    retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);
    repairEquipmentDecisionAnswer(answer, questionPlan, toolOutcomes);
    answer.confidence = evidenceAwareConfidence(answer, questionPlan, toolOutcomes);
    enforceImageDiagnosisAnswer(answer, imageDiagnosis);
    answer.sources = [...usedSources];
    answer.toolsUsed = [...usedTools];
    answer.evidenceLinks = [...evidenceLinks.values()];
    answer.responseId = interactionId;
    answer.conversationContext = buildConversationContext(
      request,
      questionPlan,
      toolOutcomes,
      answer,
      conversationResolution,
    );
    enforceBacklogActionPlan(answer, toolOutcomes, usedTools);
    await updateAskVortaInteraction(
      supabase,
      interactionId,
      userId,
      {
        ...telemetryValues("completed"),
        intent_label: routeKey,
        tools_used: [...usedTools],
        sources: [...usedSources],
        confidence:
          typeof answer.confidence === "number"
            ? Math.max(0, Math.min(100, Math.round(answer.confidence)))
            : null,
        missing_data_count: Array.isArray(answer.missingData)
          ? answer.missingData.length
          : 0,
      },
    );
    return jsonResponse(answer);
  };

  if (imageDiagnosis && !imageDiagnosis.selectedEquipmentQuery) {
    return completeDeterministicAnswer(
      directImageEvidenceAnswer(imageDiagnosis),
    );
  }

  if (conversationResolution.shouldClarify) {
    return completeDeterministicAnswer({
      directAnswer:
        conversationResolution.clarificationQuestion ??
        "Which earlier option or asset do you mean?",
      decisionSummary: [{
        label: "Clarification needed",
        value:
          conversationResolution.clarificationQuestion ??
          "Name the option, asset or work order you want to continue with.",
      }],
      evidence: [],
      findings: [{
        category: "data",
        severity: "info",
        title: "Ambiguous follow-up reference",
        detail:
          "Ask Vorta found more than one plausible prior reference and did not choose silently.",
      }],
      coverOptions: [],
      recommendedActions: [],
      actionPlan: [],
      followUpQuestions: [],
      sources: [],
      missingData: [],
      confidence: 90,
      intentLabel: "Clarify follow-up reference",
      toolsUsed: [],
      evidenceLinks: [],
    });
  }

  try {
    if (hasDeterministicRouting) {
      const evidenceStartedAt = Date.now();
      toolRoundCount = deterministicToolNames.length > 0 ? 1 : 0;
      const deterministicResults = await Promise.all(
        deterministicToolNames.map(async (toolName) => {
          const toolArguments = deterministicArgumentsFor(toolName);
          usedTools.add(toolName);
          let result: ToolResult;
          try {
            result = await withPhaseTimeout(
              "evidence",
              EVIDENCE_TIMEOUT_MS,
              () =>
                toolName === "get_site_risk_movement"
                  ? loadSiteRiskMovement(supabase, request)
                  : executeTool(toolName, toolArguments, supabase, request),
            );
          } catch (error) {
            result = {
              source: toolName,
              status: "unavailable",
              message:
                error instanceof Error
                  ? error.message
                  : "The deterministic evidence lookup could not be completed.",
            };
          }
          toolOutcomes.set(toolName, result);
          if (result.status !== "unavailable") usedSources.add(result.source);
          if (
            toolName === "get_shift_cover" &&
            result.data &&
            typeof result.data === "object" &&
            !Array.isArray(result.data)
          ) {
            shiftCoverEvidence = result.data as JsonRecord;
            shiftCoverArguments = toolArguments;
          }
          const link =
            toolName === "get_site_risk_movement"
              ? {
                  label: "Open site risk",
                  path: "/dashboard",
                  recordType: "risk",
                }
              : evidenceLinkForTool(toolName, toolArguments);
          if (link) evidenceLinks.set(link.path, link);
          return { toolName, result };
        }),
      );
      evidenceMs += Date.now() - evidenceStartedAt;
      for (const { toolName, result } of deterministicResults) {
        input.push({
          role: "user",
          content:
            `Verified Vorta evidence from ${toolName}. Use this evidence directly, do not request another tool, and answer only from this authorised result:\n${trimToolResult(result)}`,
        });
      }
      const deterministicAnswer =
        siteRiskMovementAnswer(request, questionPlan, toolOutcomes) ??
        deterministicOperationalAnswer(
          request,
          questionPlan,
          toolOutcomes,
        );
      if (deterministicAnswer) {
        return completeDeterministicAnswer(deterministicAnswer);
      }
    }


    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const answerStartedAt = Date.now();
      let response: Awaited<ReturnType<typeof client.responses.create>>;
      try {
        response = await withPhaseTimeout(
          "answer",
          ANSWER_TIMEOUT_MS,
          (signal) => client.responses.create({
        model: Netlify.env.get("VORTA_AI_MODEL") || MODEL,
        reasoning: { effort: answerReasoningEffort(questionPlan) },
        instructions: systemInstructions(request, questionPlan),
        input,
        tools: hasDeterministicRouting ? [] : TOOLS,
        tool_choice: hasDeterministicRouting
          ? "none"
          : round === 0 && questionPlan?.shouldUseTools === true
            ? "required"
            : "auto",
        parallel_tool_calls: !hasDeterministicRouting,
        max_output_tokens: answerOutputTokenBudget(questionPlan),
        store: false,
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "vorta_maintenance_answer",
            strict: true,
            schema: ANSWER_SCHEMA,
          },
        },
      }, { signal }),
        );
      } catch (error) {
        failureStage = error instanceof AskVortaPhaseTimeoutError ? error.stage : "answer";
        throw error;
      } finally {
        answerMs += Date.now() - answerStartedAt;
      }

      // OpenAI documents response output as valid subsequent response input.
      // The SDK unions currently disagree on one unused computer-tool status.
      input.push(...(response.output as unknown as ResponseInput));
      const toolCalls = response.output.filter((item) => item.type === "function_call");
      if (toolCalls.length === 0) {
        const plannedRequiredTools = textValues(questionPlan?.requiredTools);
        const successfulTools = successfulToolNames(toolOutcomes);
        const missingPlannedTools = plannedRequiredTools.filter(
          (toolName) =>
            !usedTools.has(toolName) &&
            !decisionPackCoveringTool(toolName, successfulTools),
        );
        if (missingPlannedTools.length > 0 && round < MAX_TOOL_ROUNDS - 1) {
          input.push({
            role: "user",
            content:
              "Evidence completeness check: the semantic plan still requires these Vorta tools before a final answer: " +
              missingPlannedTools.join(", ") +
              ". Call the relevant tools now, or use the returned evidence to explain why a planned tool is genuinely inapplicable. Do not answer from the plan itself.",
          });
          continue;
        }
        const answer = JSON.parse(response.output_text) as JsonRecord;
        enforceAnswerEvidence(
          answer,
          request.question,
          shiftCoverEvidence,
          shiftCoverArguments,
        );
        enforceDeterministicResponseShape(answer, questionPlan);
        enforcePlannedResponseShape(answer, questionPlan);
        retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);
        repairEquipmentDecisionAnswer(answer, questionPlan, toolOutcomes);
            enforceEquipmentReturnToServiceSafety(answer, questionPlan);
        const calibratedConfidence = evidenceAwareConfidence(
          answer,
          questionPlan,
          toolOutcomes,
        );
        answer.confidence = shiftCoverEvidence
          ? Math.max(
              45,
              Math.min(
                95,
                Math.round(
                  numberValue(answer.confidence) * 0.6 + calibratedConfidence * 0.4,
                ),
              ),
            )
          : calibratedConfidence;
        enforceImageDiagnosisAnswer(answer, imageDiagnosis);
        answer.sources = [...usedSources];
        answer.toolsUsed = [...usedTools];
        answer.evidenceLinks = [...evidenceLinks.values()];
        answer.responseId = interactionId;
        answer.conversationContext = buildConversationContext(
          request,
          questionPlan,
          toolOutcomes,
          answer,
          conversationResolution,
        );
        enforceBacklogActionPlan(answer, toolOutcomes, usedTools);
        await updateAskVortaInteraction(
          supabase,
          interactionId,
          userId,
          {
            ...telemetryValues("completed"),
            intent_label: routeKey,
            tools_used: [...usedTools],
            sources: [...usedSources],
            confidence:
              typeof answer.confidence === "number"
                ? Math.max(0, Math.min(100, Math.round(answer.confidence)))
                : null,
            missing_data_count: Array.isArray(answer.missingData)
              ? answer.missingData.length
              : 0,
          },
        );
        return jsonResponse(answer);
      }

      toolRoundCount += 1;
      const executeToolCall = async (toolCall: (typeof toolCalls)[number]) => {
        usedTools.add(toolCall.name);
        const toolArguments = parseArguments(toolCall.arguments);
        const effectiveArguments =
          toolCall.name === "get_shift_cover"
            ? normaliseRelativeShiftCoverArguments(
                request.question,
                request.pageContext.timezone,
                toolArguments,
              )
            : toolArguments;
        const link = evidenceLinkForTool(toolCall.name, effectiveArguments);
        if (link) evidenceLinks.set(link.path, link);
        let result: ToolResult;
        try {
          result = await withPhaseTimeout(
            "evidence",
            EVIDENCE_TIMEOUT_MS,
            () =>
              executeTool(
                toolCall.name,
                effectiveArguments,
                supabase,
                request,
              ),
          );
          if (
            toolCall.name === "get_shift_cover" &&
            result.data &&
            typeof result.data === "object" &&
            !Array.isArray(result.data)
          ) {
            shiftCoverEvidence = result.data as JsonRecord;
            shiftCoverArguments = effectiveArguments;
          }
        } catch (error) {
          result = {
            source: toolCall.name,
            status: "unavailable",
            message: error instanceof Error ? error.message : "The tool could not be completed.",
          };
        }
        toolOutcomes.set(toolCall.name, result);
        if (result.status !== "unavailable") usedSources.add(result.source);
        return {
          type: "function_call_output" as const,
          call_id: toolCall.call_id,
          output: trimToolResult(result),
        };
      };

      const evidenceStartedAt = Date.now();
      const decisionPackCalls = toolCalls.filter(
        (toolCall) =>
          toolCall.name === "get_site_operational_snapshot" ||
          toolCall.name === "get_equipment_decision_pack",
      );
      const decisionPackResults = await Promise.all(
        decisionPackCalls.map(executeToolCall),
      );
      const successfulPacks = successfulToolNames(toolOutcomes);
      const remainingResults = await Promise.all(
        toolCalls
          .filter((toolCall) => !decisionPackCalls.includes(toolCall))
          .map(async (toolCall) => {
            const coveringPack = decisionPackCoveringTool(
              toolCall.name,
              successfulPacks,
            );
            if (coveringPack) {
              return {
                type: "function_call_output" as const,
                call_id: toolCall.call_id,
                output: JSON.stringify({
                  source: coveringPack,
                  status: "ok",
                  data: {
                    coverage:
                      `Equivalent ${toolCall.name} evidence is already included in ${coveringPack}; the duplicate lookup was not executed.`,
                  },
                }),
              };
            }
            return executeToolCall(toolCall);
          }),
      );
      const results = [...decisionPackResults, ...remainingResults];
      evidenceMs += Date.now() - evidenceStartedAt;
      input.push(...results);
    }

    await updateAskVortaInteraction(
      supabase,
      interactionId,
      userId,
      {
        ...telemetryValues("failed"),
        tools_used: [...usedTools],
        sources: [...usedSources],
      },
    );
    return jsonResponse(
      {
        error: "Ask Vorta needed too many evidence lookups. Narrow the question and try again.",
        responseId: interactionId,
      },
      422,
    );
  } catch (error) {
    if (error instanceof AskVortaPhaseTimeoutError) {
      failureStage = error.stage;
    }
    const verifiedFallback =
      siteRiskMovementAnswer(request, questionPlan, toolOutcomes) ??
      deterministicOperationalAnswer(
        request,
        questionPlan,
        toolOutcomes,
      );
    if (verifiedFallback && usedSources.size > 0) {
      console.warn("Ask Vorta final reasoning failed; returning verified deterministic evidence", {
        requestId: _context.requestId,
        userId: userId,
        error: error instanceof Error ? error.message : String(error),
      });
      enforceAnswerEvidence(
        verifiedFallback,
        request.question,
        shiftCoverEvidence,
        shiftCoverArguments,
      );
      enforceDeterministicResponseShape(verifiedFallback, questionPlan);
      enforcePlannedResponseShape(verifiedFallback, questionPlan);
      verifiedFallback.confidence = evidenceAwareConfidence(
        verifiedFallback,
        questionPlan,
        toolOutcomes,
      );
      verifiedFallback.sources = [...usedSources];
      verifiedFallback.toolsUsed = [...usedTools];
      verifiedFallback.evidenceLinks = [...evidenceLinks.values()];
      verifiedFallback.responseId = interactionId;
      enforceBacklogActionPlan(verifiedFallback, toolOutcomes, usedTools);
      await updateAskVortaInteraction(
        supabase,
        interactionId,
        userId,
        {
          ...telemetryValues("fallback"),
          intent_label: routeKey,
          tools_used: [...usedTools],
          sources: [...usedSources],
          confidence: Math.max(
            0,
            Math.min(100, Math.round(numberValue(verifiedFallback.confidence))),
          ),
          missing_data_count: Array.isArray(verifiedFallback.missingData)
            ? verifiedFallback.missingData.length
            : 0,
        },
      );
      return jsonResponse(verifiedFallback);
    }
    await updateAskVortaInteraction(
      supabase,
      interactionId,
      userId,
      {
        ...telemetryValues(
          error instanceof AskVortaPhaseTimeoutError ? "timed_out" : "failed",
        ),
        tools_used: [...usedTools],
        sources: [...usedSources],
      },
    );
    console.error("Ask Vorta agent failed", {
      requestId: _context.requestId,
      userId: userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(
      {
        error:
          error instanceof AskVortaPhaseTimeoutError
            ? `Ask Vorta ${error.stage} took too long. Try again with a narrower question.`
            : "The Vorta reasoning service is temporarily unavailable. Verified fallback analysis will be used.",
        responseId: interactionId,
      },
      error instanceof AskVortaPhaseTimeoutError ? 504 : 503,
    );
  }
}

export const config: Config = {
  path: "/api/ask-vorta",
  method: "POST",
};