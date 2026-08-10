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
import { emitAskVortaProgress } from "./progress-events.mjs";
import { jsonResponse } from "./request-context.mjs";
import {
  beginAskVortaInteraction,
  buildAskVortaTelemetryValues,
  updateAskVortaInteraction,
} from "./telemetry.mjs";
import { sha256Fingerprint } from "./utilities.mjs";

const ROUTE_KEY = "spare_photo_identification";
const INTENT_LABEL = "Spare photo identification";
const MAX_CANDIDATE_IMAGE_BYTES = 1_500_000;
const CANDIDATE_IMAGE_TIMEOUT_MS = 4_500;
const ALLOWED_CANDIDATE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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

function isSafePublicCandidateImageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (
      !hostname ||
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.includes(":") ||
      /^(?:127\.|10\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function arrayBufferToBase64(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function candidateImageAsDataUrl(imageUrl: string): Promise<string | null> {
  if (!isSafePublicCandidateImageUrl(imageUrl)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CANDIDATE_IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "image/jpeg,image/png,image/webp",
        "User-Agent": "Vorta-spare-image-matcher/1.0",
      },
    });
    if (!response.ok) return null;
    const contentType = (response.headers.get("content-type") ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_CANDIDATE_IMAGE_TYPES.has(contentType)) return null;
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_CANDIDATE_IMAGE_BYTES) {
      return null;
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_CANDIDATE_IMAGE_BYTES) {
      return null;
    }
    return `data:${contentType};base64,${arrayBufferToBase64(bytes)}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function prepareVisualCandidates(
  candidates: AskVortaSparePhotoCandidate[],
): Promise<AskVortaSparePhotoCandidate[]> {
  const prepared = await Promise.all(
    candidates.map(async (candidate) => {
      const dataUrl = await candidateImageAsDataUrl(candidate.imageUrl);
      return dataUrl ? { ...candidate, imageUrl: dataUrl } : null;
    }),
  );
  return prepared.filter(
    (candidate): candidate is AskVortaSparePhotoCandidate => Boolean(candidate),
  );
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
        "Return a visual similarity score from 0 to 100 for each candidateId supplied.",
        "Compare component class and physical geometry before branding: housing shape, proportions, flange and shaft arrangement, connectors, controls, terminal layout and mounting features.",
        "An obvious component-class mismatch must score low. For example, a servo motor with an exposed output shaft and flange is not a close visual match to a PLC I/O module merely because both are Siemens products.",
        "Do not invent candidate IDs, part numbers, manufacturers or stock data. Do not browse for alternatives. Do not diagnose equipment or recommend work.",
        "Visible branding may support identity, but exact OCR/part-number evidence is ranked separately by Vorta and must not override physical mismatch.",
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

function asksStockAvailability(question: string): boolean {
  return (
    /\b(?:in|on)\s+stock\b/i.test(question) ||
    /\b(?:is|are|any)\b.{0,30}\bavailable\b/i.test(question) ||
    /\b(?:how many|quantity|qty)\b/i.test(question)
  );
}

function answerForMatches(
  interactionId: string,
  matches: AskVortaSparePhotoMatch[],
  question: string,
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
        label: "No reliable stock match",
        value: "No authorised site spare image matched the photo closely enough.",
      }];

  let directAnswer = "I could not find a reliable match in the verified site stock images.";
  if (top) {
    const identifier = top.stockNumber || top.componentName;
    const compactLocation = top.location ? ` · ${top.location}` : "";
    if (asksStockAvailability(question) && top.matchConfidence >= 60 && top.quantity !== null) {
      directAnswer = top.quantity > 0
        ? `Yes. Closest stock match: ${identifier} · Qty ${top.quantity}${compactLocation}.`
        : `No. Closest stock match: ${identifier} · Qty 0${compactLocation}.`;
    } else if (top.matchConfidence >= 60) {
      directAnswer = `Closest stock match: ${identifier}.`;
    } else {
      directAnswer = `Possible stock match: ${identifier} (${top.matchConfidence}%).`;
    }
  }

  return {
    responseId: interactionId,
    directAnswer,
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
  emitAskVortaProgress({
    id: "spare-photo-image",
    label: "Reading the uploaded image",
    state: "active",
  });
  const extraction = await extractAskVortaImageEvidence(client, request.image);
  emitAskVortaProgress({
    id: "spare-photo-image",
    label: "Reading the uploaded image",
    state: "complete",
    detail: "Image evidence captured",
  });

  emitAskVortaProgress({
    id: "spare-photo-stores",
    label: "Checking Stores Inventory",
    state: "active",
  });
  const imageResult = await supabase
    .from("vorta_entity_images")
    .select("component_id,source_url,alt_text,is_primary,source_type")
    .eq("site_id", request.siteId)
    .eq("entity_type", "spare")
    .not("component_id", "is", null)
    .not("source_url", "is", null)
    .limit(100);

  if (imageResult.error) {
    emitAskVortaProgress({
      id: "spare-photo-stores",
      label: "Checking Stores Inventory",
      state: "failed",
      detail: "Stock images unavailable",
    });
    const evidenceMs = Date.now() - evidenceStartedAt;
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
      { error: "Ask Vorta could not check the verified site spare-image catalogue." },
      503,
    );
  }

  const imageRows = imageResult.data ?? [];
  const componentIds = [
    ...new Set(
      imageRows
        .map((row) => String(row.component_id ?? "").trim())
        .filter(Boolean),
    ),
  ];

  let componentRows: Array<Record<string, unknown>> = [];
  if (componentIds.length > 0) {
    const componentResult = await supabase
      .from("equipment_components")
      .select(
        "id,equipment_id,component_name,component_code,oem_part_number,vendor_name,maker_name,image_alt_text,quantity_available,storage_location,availability_status",
      )
      .eq("site_id", request.siteId)
      .in("id", componentIds);
    if (componentResult.error) {
      emitAskVortaProgress({
        id: "spare-photo-stores",
        label: "Checking Stores Inventory",
        state: "failed",
        detail: "Stock records unavailable",
      });
      const evidenceMs = Date.now() - evidenceStartedAt;
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
        { error: "Ask Vorta could not resolve the verified spare images to site stock records." },
        503,
      );
    }
    componentRows = componentResult.data ?? [];
  }

  const imageByComponent = new Map(
    imageRows.map((row) => [String(row.component_id ?? ""), row]),
  );
  const curatedComponents = componentRows.flatMap((component) => {
    const image = imageByComponent.get(String(component.id ?? ""));
    const sourceUrl = typeof image?.source_url === "string" ? image.source_url : "";
    if (!sourceUrl) return [];
    const altText = typeof image?.alt_text === "string" ? image.alt_text : "";
    return [{
      ...component,
      image_url: sourceUrl,
      image_alt_text: altText || component.image_alt_text,
      image_verification_status: "verified",
    }];
  });
  emitAskVortaProgress({
    id: "spare-photo-stores",
    label: "Checking Stores Inventory",
    state: "complete",
    detail: `${curatedComponents.length} verified stock image${curatedComponents.length === 1 ? "" : "s"}`,
  });
  const evidenceMs = Date.now() - evidenceStartedAt;

  const ranked = rankAskVortaSparePhotoCandidates(
    extraction,
    curatedComponents,
    { pagePath: request.pageContext.path },
  );
  const answerStartedAt = Date.now();
  emitAskVortaProgress({
    id: "spare-photo-visual",
    label: "Comparing verified stock images",
    state: "active",
  });
  const visualCandidates = await prepareVisualCandidates(ranked.candidates);
  const visualMatches = await compareVerifiedSpareImages(
    client,
    request.image.dataUrl,
    visualCandidates,
  );
  const matches = combineAskVortaSparePhotoMatches(
    ranked.candidates,
    visualMatches,
  );
  emitAskVortaProgress({
    id: "spare-photo-visual",
    label: "Comparing verified stock images",
    state: "complete",
    detail: `${visualCandidates.length} image${visualCandidates.length === 1 ? "" : "s"} compared`,
  });

  emitAskVortaProgress({
    id: "spare-photo-answer",
    label: "Preparing the closest stock match",
    state: "active",
  });
  const answer = answerForMatches(interactionId, matches, request.question);
  emitAskVortaProgress({
    id: "spare-photo-answer",
    label: "Preparing the closest stock match",
    state: "complete",
  });
  const answerMs = Date.now() - answerStartedAt;

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
      sources: ["Curated Vorta spare images"],
      confidence: answer.confidence,
      missing_data_count: 0,
    },
  );

  return jsonResponse(answer);
}