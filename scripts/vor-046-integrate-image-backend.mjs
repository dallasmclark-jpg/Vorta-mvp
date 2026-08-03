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

const backendHelpers = readFileSync(
  "scripts/templates/vor-046-image-backend-helpers.txt",
  "utf8",
);
const helperMarker = "function deterministicQuestionPlan(";
const helperIndex = source.indexOf(helperMarker);
if (helperIndex < 0) {
  throw new Error("Image backend helper insertion point was not found.");
}
source =
  source.slice(0, helperIndex) +
  backendHelpers.trimEnd() +
  "\n\n" +
  source.slice(helperIndex);

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
console.log(
  "Applied VOR-046 Ask Vorta image extraction and Vorta matching backend integration.",
);
