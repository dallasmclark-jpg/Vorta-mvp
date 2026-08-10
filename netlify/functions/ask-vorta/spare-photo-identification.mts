import type { Context } from "@netlify/functions";
import OpenAI from "openai";
import type { ResponseInput } from "openai/resources/responses/responses";
import {
  ASK_VORTA_SPARE_VISUAL_MATCH_SCHEMA,
  combineAskVortaSparePhotoMatches,
  isAskVortaSparePhotoQuestion,
  rankAskVortaSparePhotoCandidates,
  type AskVortaSparePhotoCandidate,
  type AskVortaSparePhotoMatch,
} from "../_shared/askVortaSparePhotoMatch.mjs";
import { authenticateAskVortaRequest } from "./authenticated-context.mjs";
import { MODEL } from "./contracts.mjs";
import { extractAskVortaImageEvidence } from "./image-diagnosis.mjs";
import { jsonResponse } from "./request-context.mjs";
import {
  beginAskVortaInteraction,
  buildAskVortaTelemetryValues,
  updateAskVortaInteraction,
} from "./telemetry.mjs";
import { sha256Fingerprint } from "./utilities.mjs";

const ROUTE_KEY = "spare_photo_identification";
const INTENT_LABEL = "Spare photo identification";

function visualInput(
  imageDataUrl: string,
  candidates: AskVortaSparePhotoCandidate[],
): ResponseInput {
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text:
        "TARGET PHOTO. Compare only the physical component in this image with the supplied Vorta stock candidate images.",
    },
    {
      type: "input_image",
      image_url: imageDataUrl,
      detail: "high",
    },
  ];
  candidates.forEach((candidate, index) => {
    content.push({
      type: "input_text",
      text:
        `VORTA STOCK CANDIDATE ${index + 1}. componentId=${candidate.componentId}; ` +
        `stockNumber=${candidate.stockNumber || "unavailable"}; ` +
        `manufacturer=${candidate.manufacturer || "unavailable"}; ` +
        `description=${candidate.componentName || "unavailable"}.`,
    });
    content.push({
      type: "input_image",
      image_url: candidate.imageUrl,
      detail: "low",
    });
  });
  return [
    {
      role: "user",
      content,
    },
  ] as unknown as ResponseInput;
}

async function compareVerifiedSpareImages(
  client: OpenAI,
  imageDataUrl: string,
  candidates: AskVortaSparePhotoCandidate[],
): Promise<Array<{ componentId: string; visualSimilarity: number }>> {
  if (candidates.length === 0) return [];
  try {
    const response = await client.responses.create({
      model: Netlify.env.get("VORTA_AI_VISION_MODEL") || MODEL,
      reasoning: { effort: "low" },
      instructions: [
        "You are performing bounded visual similarity ranking inside an authorised Vorta spare catalogue.",
        "The first image is the target photo. Every later image is a labelled Vorta stock candidate already selected from the authenticated site catalogue.",
        "Return a visual similarity score from 0 to 100 for each candidateId supplied. Compare physical form only: component class, housing shape, proportions, flange/shaft arrangement, connectors, controls, terminal layout and other visible geometry.",
        "Do not invent candidate IDs, part numbers, manufacturers or stock data. Do not browse for alternatives. Do not diagnose equipment or recommend work.",
        "Visible branding may support physical identity, but exact OCR/part-number evidence is ranked separately by Vorta and must not cause you to skip the visual comparison.",
      ].join("\n"),
      input: visualInput(imageDataUrl, candidates),
      max_output_tokens: 900,
      store: false,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "vorta_spare_visual_matches",
          strict: true,
          schema: ASK_VORTA_SPARE_VISUAL_MATCH_SCHEMA,
        },
      },
    });
    const parsed = JSON.parse(response.output_text) as {
      matches?: Array<{ componentId?: unknown; visualSimilarity?: unknown }>;
    };
    const allowedIds = new Set(candidates.map((candidate) => candidate.componentId));
    return Array.isArray(parsed.matches)
      ? parsed.matches.flatMap((item) => {
          const componentId =
            typeof item.componentId === "string" ? item.componentId.trim() : "";
          const numeric = Number(item.visualSimilarity);
          if (!allowedIds.has(componentId) || !Number.isFinite(numeric)) return [];
          return [{
            componentId,
            visualSimilarity: Math.max(0, Math.min(100, Math.round(numeric))),
          }];
        })
      : [];
  } catch (error) {
    console.warn("Ask Vorta spare image comparison unavailable; using bounded metadata fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function resultValue(match: AskVortaSparePhotoMatch): string {
  return [
    match.componentName,
    match.oemPartNumber ? `OEM ${match.oemPartNumber}` : "",
    match.quantity !== null ? `Qty ${match.quantity}` : "",
    match.location,
  ].filter(Boolean).join(" · ");
}

function answerForMatches(
  interactionId: string,
  matches: AskVortaSparePhotoMatch[],
) {
  const top = matches[0];
  const decisionSummary = matches.length > 0
    ? matches.map((match, index) => ({
        label:
          `${index + 1}. ${match.matchConfidence}%` +
          (match.stockNumber ? ` · ${match.stockNumber}` : ""),
        value: resultValue(match),
      }))
    : [{
        label: "No verified stock match",
        value: "No authorised site spare with a verified image matched the photo closely enough.",
      }];
  return {
    responseId: interactionId,
    directAnswer: top
      ? `Closest match: ${top.stockNumber || top.componentName} (${top.matchConfidence}%).`
      : "I could not find a credible match in the verified site stock images.",
    decisionSummary,
    evidence: [],
    findings: [],
    coverOptions: [],
    recommendedActions: [],
    actionPlan: [],
    followUpQuestions: [],
    sources: [],
    missingData: [],
    confidence: top?.matchConfidence ?? 35,
    intentLabel: INTENT_LABEL,
    toolsUsed: ["verified_site_spare_image_match"],
    evidenceLinks: [],
    evidenceGeneratedAt: new Date().toISOString(),
  };
}

export function shouldHandleSparePhotoPayload(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Boolean(candidate.image) && isAskVortaSparePhotoQuestion(candidate.question);
}

export async function handleSparePhotoIdentification(
  req: Request,
  context: Context,
): Promise<Response> {
  const startedAt = Date.now();
  const authenticated = await authenticateAskVortaRequest(req);
  if (!authenticated.ok) return authenticated.response;
  const { request, supabase, userId } = authenticated;
  if (!request.image || !isAskVortaSparePhotoQuestion(request.question)) {
    return jsonResponse({ error: "Spare-photo route was selected without a valid spare-identification image request." }, 400);
  }

  const imageFingerprint = await sha256Fingerprint(request.image.dataUrl);
  const questionFingerprint = await sha256Fingerprint(
    `${request.question.trim().toLowerCase()}|image:${imageFingerprint}`,
  );
  const telemetryStart = await beginAskVortaInteraction({
    supabase,
    request,
    userId,
    requestId: context.requestId,
    startedAt,
    questionFingerprint,
    routeKey: ROUTE_KEY,
    routingMode: "deterministic",
  });
  if (!telemetryStart.ok) return telemetryStart.response;
  const { interactionId } = telemetryStart;

  const evidenceStartedAt = Date.now();
  const client = new OpenAI();
  const extraction = await extractAskVortaImageEvidence(client, request.image);
  const componentResult = await supabase
    .from("equipment_components")
    .select(
      "id,equipment_id,component_name,component_code,oem_part_number,vendor_name,maker_name,image_url,image_alt_text,image_verification_status,quantity_available,storage_location,availability_status",
    )
    .eq("site_id", request.siteId)
    .eq("image_verification_status", "verified")
    .not("image_url", "is", null)
    .limit(1_000);
  const evidenceMs = Date.now() - evidenceStartedAt;

  if (componentResult.error) {
    await updateAskVortaInteraction(
      supabase,
      interactionId,
      userId,
      {
        ...buildAskVortaTelemetryValues({
          status: "failed",
          routeKey: ROUTE_KEY,
          routingMode: "deterministic",
          plannerMs: 0,
          evidenceMs,
          answerMs: 0,
          toolCount: 1,
          toolRoundCount: 1,
          failureStage: "evidence",
          startedAt,
        }),
        intent_label: ROUTE_KEY,
      },
    );
    return jsonResponse(
      { error: "Ask Vorta could not check the authorised site stock catalogue." },
      503,
    );
  }

  const ranked = rankAskVortaSparePhotoCandidates(
    extraction,
    componentResult.data ?? [],
    { pagePath: request.pageContext.path },
  );
  const answerStartedAt = Date.now();
  const visualMatches = await compareVerifiedSpareImages(
    client,
    request.image.dataUrl,
    ranked.candidates,
  );
  const matches = combineAskVortaSparePhotoMatches(
    ranked.candidates,
    visualMatches,
  );
  const answerMs = Date.now() - answerStartedAt;
  const answer = answerForMatches(interactionId, matches);

  await updateAskVortaInteraction(
    supabase,
    interactionId,
    userId,
    {
      ...buildAskVortaTelemetryValues({
        status: "completed",
        routeKey: ROUTE_KEY,
        routingMode: "deterministic",
        plannerMs: 0,
        evidenceMs,
        answerMs,
        toolCount: 1,
        toolRoundCount: 1,
        failureStage: null,
        startedAt,
      }),
      intent_label: ROUTE_KEY,
      tools_used: ["verified_site_spare_image_match"],
      sources: ["Verified site spare images"],
      confidence: answer.confidence,
      missing_data_count: 0,
    },
  );

  return jsonResponse(answer);
}
