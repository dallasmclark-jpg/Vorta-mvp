import { readFileSync, writeFileSync } from "node:fs";

const targetPath = "netlify/functions/ask-vorta.mts";
let source = readFileSync(targetPath, "utf8");

if (source.includes("async function extractAskVortaImageEvidence(")) {
  console.log("VOR-046 Ask Vorta image backend integration is already applied.");
  process.exit(0);
}

function replaceOnce(oldValue, newValue, label) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}.`);
  }
  source = source.replace(oldValue, newValue);
}

function findFunctionRange(name) {
  const candidates = [`function ${name}(`, `async function ${name}(`];
  const start = candidates
    .map((candidate) => source.indexOf(candidate))
    .filter((index) => index >= 0)
    .sort((first, second) => first - second)[0];
  if (start === undefined) throw new Error(`Function ${name} was not found.`);
  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) throw new Error(`Function ${name} has no opening brace.`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = braceStart; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1 };
    }
  }
  throw new Error(`Function ${name} has no closing brace.`);
}

function updateFunction(name, updater) {
  const range = findFunctionRange(name);
  const block = source.slice(range.start, range.end);
  source = source.slice(0, range.start) + updater(block) + source.slice(range.end);
}

replaceOnce(
  'import type { ResponseInput, Tool } from "openai/resources/responses/responses";\n',
  'import type { ResponseInput, Tool } from "openai/resources/responses/responses";\nimport {\n  safeAskVortaImageMetadata,\n  validateAskVortaImage,\n} from "./_shared/askVortaImageEvidence.mjs";\nimport type {\n  ValidatedAskVortaImage,\n} from "./_shared/askVortaImageEvidence.mjs";\nimport {\n  ASK_VORTA_IMAGE_EXTRACTION_SCHEMA,\n  imageDiagnosisSearchText,\n  rankAskVortaImageMatches,\n  sanitizeAskVortaImageExtraction,\n} from "./_shared/askVortaImageDiagnosis.mjs";\nimport type {\n  AskVortaImageExtraction,\n  AskVortaImageMatch,\n} from "./_shared/askVortaImageDiagnosis.mjs";\n',
  "image backend imports",
);

replaceOnce(
  "  conversationContext: ConversationContext | null;\n  pageContext: PageContext;",
  "  conversationContext: ConversationContext | null;\n  image: ValidatedAskVortaImage | null;\n  pageContext: PageContext;",
  "request image field",
);

updateFunction("parseRequest", (block) => {
  let updated = block.replace(
    "  const conversationContext = sanitizeConversationContext(record.conversationContext);\n",
    "  const conversationContext = sanitizeConversationContext(record.conversationContext);\n  const imageValidation = record.image == null\n    ? null\n    : validateAskVortaImage(record.image);\n  if (imageValidation && !imageValidation.ok) return null;\n  const image = imageValidation?.ok ? imageValidation.image : null;\n",
  );
  if (updated === block) {
    throw new Error("parseRequest image validation insertion point was not found.");
  }
  const returnMarker = "    conversationContext,\n";
  const count = updated.split(returnMarker).length - 1;
  if (count !== 1) {
    throw new Error(`parseRequest image return: expected one context field, found ${count}.`);
  }
  updated = updated.replace(returnMarker, `${returnMarker}    image,\n`);
  return updated;
});

const backendHelpers = String.raw`
interface AskVortaImageDiagnosisEvidence extends AskVortaImageMatch {
  metadata: ReturnType<typeof safeAskVortaImageMetadata>;
  searchText: string;
  catalogStatus: "ok" | "unavailable";
  catalogMessage: string | null;
}

function fallbackImageExtraction(message: string): AskVortaImageExtraction {
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

async function extractAskVortaImageEvidence(
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

async function buildAskVortaImageDiagnosis(
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

function imageDiagnosisQuestionPlan(
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

function imageDiagnosisPrompt(
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

function imageMatchLabel(diagnosis: AskVortaImageDiagnosisEvidence): string {
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

function directImageEvidenceAnswer(
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

function enforceImageDiagnosisAnswer(
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

`;

const helperMarker = "function deterministicQuestionPlan(";
const helperIndex = source.indexOf(helperMarker);
if (helperIndex < 0) throw new Error("Image backend helper insertion point was not found.");
source = source.slice(0, helperIndex) + backendHelpers + source.slice(helperIndex);

replaceOnce(
  "  const request = parseRequest(await req.json().catch(() => null));\n  if (!request) return jsonResponse({ error: \"The Ask Vorta request is invalid.\" }, 400);",
  "  const rawRequest = await req.json().catch(() => null);\n  const rawImage = rawRequest && typeof rawRequest === \"object\" && !Array.isArray(rawRequest)\n    ? (rawRequest as JsonRecord).image\n    : null;\n  if (rawImage != null) {\n    const imageValidation = validateAskVortaImage(rawImage);\n    if (!imageValidation.ok) {\n      return jsonResponse({ error: imageValidation.message }, 400);\n    }\n  }\n  const request = parseRequest(rawRequest);\n  if (!request) return jsonResponse({ error: \"The Ask Vorta request is invalid.\" }, 400);",
  "specific image validation response",
);

replaceOnce(
  "  const questionFingerprint = await sha256Fingerprint(\n    request.question.trim().toLowerCase(),\n  );",
  "  const imageFingerprint = request.image\n    ? await sha256Fingerprint(request.image.dataUrl)\n    : \"\";\n  const questionFingerprint = await sha256Fingerprint(\n    `${request.question.trim().toLowerCase()}|image:${imageFingerprint}`,\n  );",
  "image-aware request fingerprint",
);

replaceOnce(
  "  const client = new OpenAI();\n  const conversationResolution = resolveConversationFollowUp(",
  "  const client = new OpenAI();\n  const imageDiagnosis = await buildAskVortaImageDiagnosis(\n    client,\n    supabase,\n    request,\n  );\n  const conversationResolution = resolveConversationFollowUp(",
  "image extraction before planning",
);

replaceOnce(
  "  let questionPlan: JsonRecord | null = conversationResolution.shouldClarify\n    ? {",
  "  let questionPlan: JsonRecord | null = imageDiagnosis\n    ? imageDiagnosisQuestionPlan(request, imageDiagnosis)\n    : conversationResolution.shouldClarify\n      ? {",
  "image diagnosis question plan precedence",
);

replaceOnce(
  "      }\n    : deterministicQuestionPlan(planningRequest);",
  "      }\n      : deterministicQuestionPlan(planningRequest);",
  "image plan ternary alignment",
);

replaceOnce(
  "    ...(conversationResolution.usedContext\n      ? [{",
  "    ...(imageDiagnosis\n      ? [{\n          role: \"user\" as const,\n          content:\n            \"Verified bounded image evidence. The raw photo is not part of conversation history. Separate visible OCR from Vorta records and never infer safe return to service from this evidence alone: \" +\n            imageDiagnosisPrompt(imageDiagnosis),\n        }]\n      : []),\n    ...(conversationResolution.usedContext\n      ? [{",
  "structured image evidence input",
);

replaceOnce(
  "  const usedSources = new Set<string>();\n  const usedTools = new Set<string>();",
  "  const usedSources = new Set<string>();\n  if (imageDiagnosis) usedSources.add(\"User-supplied image evidence\");\n  const usedTools = new Set<string>();",
  "image evidence source registration",
);

replaceOnce(
  "    answer.confidence = evidenceAwareConfidence(answer, questionPlan, toolOutcomes);\n    answer.sources = [...usedSources];",
  "    answer.confidence = evidenceAwareConfidence(answer, questionPlan, toolOutcomes);\n    enforceImageDiagnosisAnswer(answer, imageDiagnosis);\n    answer.sources = [...usedSources];",
  "deterministic image answer enforcement",
);

replaceOnce(
  "        answer.confidence = shiftCoverEvidence\n          ? Math.max(",
  "        answer.confidence = shiftCoverEvidence\n          ? Math.max(",
  "main confidence marker validation",
);

replaceOnce(
  "          : calibratedConfidence;\n        answer.sources = [...usedSources];",
  "          : calibratedConfidence;\n        enforceImageDiagnosisAnswer(answer, imageDiagnosis);\n        answer.sources = [...usedSources];",
  "model image answer enforcement",
);

replaceOnce(
  "  if (conversationResolution.shouldClarify) {\n    return completeDeterministicAnswer({",
  "  if (imageDiagnosis && !imageDiagnosis.selectedEquipmentQuery) {\n    return completeDeterministicAnswer(\n      directImageEvidenceAnswer(imageDiagnosis),\n    );\n  }\n\n  if (conversationResolution.shouldClarify) {\n    return completeDeterministicAnswer({",
  "direct unreadable ambiguous or no-match response",
);

replaceOnce(
  '    "Use this validated structured conversation context for pronouns, ordinal choices and inherited dates: " +',
  '    "When image evidence is supplied, observed text and visual candidates are unverified visual evidence. Exact equipment or component claims require an exact visible code or part identifier plus an authorised Vorta match. Manufacturer or model resemblance alone is never exact. Use approved/current documents, recorded history and spares only after the Vorta match is established. Do not recommend bypassing protection, resetting an interlock or returning equipment to service from a photo alone.",\n    "Use this validated structured conversation context for pronouns, ordinal choices and inherited dates: " +',
  "image safety system instruction",
);

writeFileSync(targetPath, source);
console.log("Applied VOR-046 Ask Vorta image extraction and Vorta matching backend integration.");
