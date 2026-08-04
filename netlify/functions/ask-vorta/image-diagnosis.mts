import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type { ResponseInput, Tool } from "openai/resources/responses/responses";
import {
  safeAskVortaImageMetadata,
  validateAskVortaImage,
} from "../_shared/askVortaImageEvidence.mjs";
import type {
  ValidatedAskVortaImage,
} from "../_shared/askVortaImageEvidence.mjs";
import {
  ASK_VORTA_IMAGE_EXTRACTION_SCHEMA,
  imageDiagnosisSearchText,
  rankAskVortaImageMatches,
  sanitizeAskVortaImageExtraction,
} from "../_shared/askVortaImageDiagnosis.mjs";
import type {
  AskVortaImageExtraction,
  AskVortaImageMatch,
} from "../_shared/askVortaImageDiagnosis.mjs";
import type { AskVortaRequest, JsonRecord } from "./contracts.mjs";
import { MODEL } from "./contracts.mjs";
import { numberValue, records, textValues } from "./utilities.mjs";

export interface AskVortaImageDiagnosisEvidence extends AskVortaImageMatch {
  metadata: ReturnType<typeof safeAskVortaImageMetadata>;
  searchText: string;
  catalogStatus: "ok" | "unavailable";
  catalogMessage: string | null;
}

export function fallbackImageExtraction(message: string): AskVortaImageExtraction {
  return {
    extractionStatus: "unreadable",
    imageType: "other",
    observedText: [],
    faultCodes: [],
    manufacturerCandidates: [],
    modelCandidates: [],
    partCandidates: [],
    equipmentCodeCandidates: [],
    visualObservations: [],
    qualityWarnings: [message],
  };
}

export async function extractAskVortaImageEvidence(
  client: OpenAI,
  image: ValidatedAskVortaImage,
): Promise<AskVortaImageExtraction> {
  try {
    const response = await client.responses.create({
      model: Netlify.env.get("VORTA_AI_VISION_MODEL") || MODEL,
      reasoning: { effort: "low" },
      instructions: [
        "Extract only visible maintenance evidence from the supplied image.",
        "Transcribe labels, codes, alarm text and nameplate text exactly as seen. Do not repair uncertain characters silently.",
        "Observed text is not a Vorta record and must not be treated as a confirmed equipment, manufacturer, model or part match.",
        "Candidate fields may contain only text that is visible in the image or a conservative visual reading of a visible logo or label.",
        "Confidence describes image readability, not diagnostic certainty. Use low confidence when glare, blur, perspective, cropping or occlusion affects the reading.",
        "Do not diagnose the fault, recommend work, infer site data, or state that equipment is safe to run.",
        "If no useful text is readable, return unreadable with concise quality warnings and empty candidate arrays.",
      ].join("\n"),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Extract bounded OCR and visual evidence for later site-scoped maintenance matching.",
            },
            {
              type: "input_image",
              image_url: image.dataUrl,
              detail: "high",
            },
          ],
        },
      ] as unknown as ResponseInput,
      max_output_tokens: 1_800,
      store: false,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "vorta_image_evidence",
          strict: true,
          schema: ASK_VORTA_IMAGE_EXTRACTION_SCHEMA,
        },
      },
    });
    const parsed = sanitizeAskVortaImageExtraction(
      JSON.parse(response.output_text),
    );
    return parsed ?? fallbackImageExtraction(
      "The image model returned evidence that did not pass Vorta validation. Retake the photo closer and square to the label or display.",
    );
  } catch (error) {
    console.warn("Ask Vorta image extraction failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallbackImageExtraction(
      "Visual extraction was unavailable. Retake or reattach the photo before relying on any identification.",
    );
  }
}

export async function buildAskVortaImageDiagnosis(
  client: OpenAI,
  supabase: SupabaseClient,
  request: AskVortaRequest,
): Promise<AskVortaImageDiagnosisEvidence | null> {
  if (!request.image) return null;
  const extraction = await extractAskVortaImageEvidence(client, request.image);
  const [equipmentResult, componentResult] = await Promise.all([
    supabase
      .from("equipment_assets")
      .select("id,equipment_code,name,equipment_type,area,model,description")
      .eq("site_id", request.siteId)
      .limit(500),
    supabase
      .from("equipment_components")
      .select("id,equipment_id,component_name,component_code,oem_part_number,vendor_name,maker_name,functional_location_code,criticality,availability_status,quantity_available,minimum_quantity,lead_days")
      .eq("site_id", request.siteId)
      .limit(1_000),
  ]);
  const catalogError = equipmentResult.error ?? componentResult.error;
  const match = rankAskVortaImageMatches(
    extraction,
    equipmentResult.data ?? [],
    componentResult.data ?? [],
  );
  return {
    ...match,
    metadata: safeAskVortaImageMetadata(request.image),
    searchText: imageDiagnosisSearchText(match),
    catalogStatus: catalogError ? "unavailable" : "ok",
    catalogMessage: catalogError?.message ?? null,
  };
}

export function imageDiagnosisQuestionPlan(
  request: AskVortaRequest,
  diagnosis: AskVortaImageDiagnosisEvidence,
): JsonRecord {
  const selectedEquipmentQuery = diagnosis.selectedEquipmentQuery ?? "";
  return {
    routingMode: "deterministic",
    scope: "image_diagnosis",
    intentLabel: "Image-assisted fault diagnosis",
    decisionGoal: request.question,
    shouldUseTools: Boolean(selectedEquipmentQuery),
    requiredTools: selectedEquipmentQuery
      ? ["get_equipment_decision_pack"]
      : [],
    optionalTools: [],
    equipmentQuery: selectedEquipmentQuery,
    startDate: "",
    endDate: "",
    ambiguity: diagnosis.conflicts.join(" "),
    answerFocus:
      "Separate visible image evidence from the ranked Vorta match. Use the authorised equipment decision pack for history, documents, spares and safe next checks. Never claim return-to-service certainty from a photo.",
    verificationChecks: [
      "State the exact visible labels and confidence before any inference.",
      "Name the Vorta match status and evidence basis.",
      "Do not call a manufacturer or model resemblance an exact equipment match.",
      "Use approved/current documents and recorded history only when returned by Vorta.",
      "Do not recommend bypassing an interlock, resetting protection or returning equipment to service from image evidence alone.",
    ],
    summaryItemLimit: 5,
    forceActionPlan: true,
  };
}

export function imageDiagnosisPrompt(
  diagnosis: AskVortaImageDiagnosisEvidence,
): string {
  return JSON.stringify({
    imageMetadata: diagnosis.metadata,
    extraction: diagnosis.extraction,
    matchStatus: diagnosis.matchStatus,
    selectedEquipmentQuery: diagnosis.selectedEquipmentQuery,
    equipmentMatches: diagnosis.equipmentMatches.slice(0, 5),
    componentMatches: diagnosis.componentMatches.slice(0, 5),
    conflicts: diagnosis.conflicts,
    catalogStatus: diagnosis.catalogStatus,
  });
}

export function imageMatchLabel(diagnosis: AskVortaImageDiagnosisEvidence): string {
  const component = diagnosis.componentMatches[0];
  const equipment = diagnosis.equipmentMatches[0];
  if (component) {
    return [
      component.componentCode || component.oemPartNumber || component.componentName,
      component.equipmentCode || component.equipmentName,
    ].filter(Boolean).join(" · ");
  }
  return equipment
    ? [equipment.equipmentCode, equipment.equipmentName].filter(Boolean).join(" · ")
    : "No supported Vorta match";
}

export function directImageEvidenceAnswer(
  diagnosis: AskVortaImageDiagnosisEvidence,
): JsonRecord {
  const observedText = diagnosis.extraction?.observedText
    .slice(0, 6)
    .map((item) => `${item.value} (${item.confidence}%)`) ?? [];
  const faultCodes = diagnosis.extraction?.faultCodes
    .slice(0, 4)
    .map((item) => `${item.value} (${item.confidence}%)`) ?? [];
  const warnings = diagnosis.extraction?.qualityWarnings ?? [];
  const candidateLabels = [
    ...diagnosis.equipmentMatches.slice(0, 3).map(
      (item) => `${item.equipmentCode || item.equipmentName} (${item.confidenceBand.replace(/_/g, " ")}, score ${item.score})`,
    ),
    ...diagnosis.componentMatches.slice(0, 3).map(
      (item) => `${item.componentCode || item.oemPartNumber || item.componentName} (${item.confidenceBand.replace(/_/g, " ")}, score ${item.score})`,
    ),
  ];
  const unreadable = diagnosis.matchStatus === "unreadable";
  const ambiguous = diagnosis.matchStatus === "ambiguous";
  const noMatch = diagnosis.matchStatus === "no_supported_match";
  const directAnswer = unreadable
    ? "I could not read enough from the photo to identify the equipment or fault safely."
    : ambiguous
      ? "The photo produced more than one plausible Vorta match, so I have not selected one silently."
      : noMatch
        ? "The visible image evidence did not match an authorised Vorta asset or component strongly enough."
        : `The leading visual candidate is ${imageMatchLabel(diagnosis)}, but it still requires verification against the physical equipment code or part label.`;
  return {
    directAnswer,
    decisionSummary: [
      {
        label: "Observed image evidence",
        value: observedText.length
          ? observedText.join("; ")
          : "No reliable text was extracted.",
      },
      ...(faultCodes.length
        ? [{ label: "Visible fault code", value: faultCodes.join("; ") }]
        : []),
      {
        label: "Vorta match",
        value: `${diagnosis.matchStatus.replace(/_/g, " ")}: ${candidateLabels.join("; ") || "no ranked candidate"}.`,
      },
      {
        label: "Next safe check",
        value:
          "Keep the equipment in its existing safe state, capture the complete equipment code or OEM part number, and do not reset or bypass protection from the photo alone.",
      },
    ],
    evidence: [
      ...observedText.map((item) => `Visible text: ${item}`),
      ...faultCodes.map((item) => `Visible fault code: ${item}`),
      ...candidateLabels.map((item) => `Ranked Vorta candidate: ${item}`),
    ].slice(0, 12),
    findings: [
      {
        category: "data",
        severity: unreadable || ambiguous ? "high" : "medium",
        title: "Image identification remains unverified",
        detail:
          diagnosis.conflicts.join(" ") ||
          warnings.join(" ") ||
          "The image alone does not prove the equipment identity or fault cause.",
      },
    ],
    coverOptions: [],
    recommendedActions: [
      "Verify the physical equipment code, model or OEM part number before using maintenance history or instructions.",
    ],
    actionPlan: [
      {
        priority: "now",
        action:
          "Retake or inspect the label square-on and record the complete equipment code, fault code and part number.",
        owner: "Maintenance engineer",
        expectedImpact:
          "Converts an image-led candidate into a traceable Vorta asset or component match.",
        verification:
          "Confirm the recorded code against the equipment plate, HMI asset reference or controlled spare label.",
      },
    ],
    followUpQuestions: [],
    sources: [],
    missingData: [
      ...warnings,
      ...diagnosis.conflicts,
      ...(diagnosis.catalogStatus === "unavailable"
        ? ["The authorised Vorta equipment/component catalog could not be checked."]
        : []),
      "A verified physical equipment or part identifier is required before fault diagnosis or work release.",
    ].slice(0, 8),
    confidence: unreadable ? 25 : ambiguous ? 45 : noMatch ? 40 : 58,
    intentLabel: "Image-assisted fault diagnosis",
    toolsUsed: [],
    evidenceLinks: [],
  };
}

export function enforceImageDiagnosisAnswer(
  answer: JsonRecord,
  diagnosis: AskVortaImageDiagnosisEvidence | null,
): void {
  if (!diagnosis) return;
  const observedText = diagnosis.extraction?.observedText
    .slice(0, 6)
    .map((item) => `${item.value} (${item.confidence}%)`) ?? [];
  const faultCodes = diagnosis.extraction?.faultCodes
    .slice(0, 4)
    .map((item) => `${item.value} (${item.confidence}%)`) ?? [];
  const matchLabel = imageMatchLabel(diagnosis);
  const exact = diagnosis.matchStatus === "exact_identifier";
  const matchStatement = exact
    ? `Exact visible identifier matched to ${matchLabel}; physical verification is still required.`
    : `Leading Vorta candidate: ${matchLabel}; status ${diagnosis.matchStatus.replace(/_/g, " ")}.`;
  answer.decisionSummary = [
    {
      label: "Observed image evidence",
      value: observedText.join("; ") || "No reliable text was extracted.",
    },
    ...(faultCodes.length
      ? [{ label: "Visible fault code", value: faultCodes.join("; ") }]
      : []),
    { label: "Vorta match", value: matchStatement },
    ...records(answer.decisionSummary),
  ].slice(0, 5);
  answer.evidence = [
    ...observedText.map((item) => `Visible text: ${item}`),
    ...faultCodes.map((item) => `Visible fault code: ${item}`),
    `Image-to-Vorta match: ${matchStatement}`,
    ...textValues(answer.evidence),
  ].slice(0, 16);
  answer.missingData = [
    ...(diagnosis.extraction?.qualityWarnings ?? []),
    ...diagnosis.conflicts,
    ...textValues(answer.missingData),
  ].slice(0, 8);
  if (!exact && typeof answer.directAnswer === "string") {
    answer.directAnswer = answer.directAnswer
      .replace(/\bconfirmed\b/gi, "leading")
      .replace(/\bdefinitely\b/gi, "possibly");
  }
  if (records(answer.actionPlan).length === 0) {
    answer.actionPlan = [
      {
        priority: "now",
        action:
          "Verify the physical equipment code, visible fault code and any OEM part number before releasing diagnostic work.",
        owner: "Maintenance engineer",
        expectedImpact:
          "Confirms that the Vorta history, documents and spare evidence belong to the photographed asset.",
        verification:
          "Match the code against the equipment plate or HMI asset reference, then use the approved/current Vorta source and recalculate risk after verified work.",
      },
    ];
  }
  const currentConfidence = numberValue(answer.confidence);
  const cap = exact
    ? 88
    : diagnosis.matchStatus === "strong_candidate"
      ? 78
      : diagnosis.matchStatus === "possible_candidate"
        ? 62
        : 55;
  answer.confidence = Math.max(25, Math.min(cap, currentConfidence || cap));
}
