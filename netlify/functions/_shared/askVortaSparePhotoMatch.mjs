const MAX_PREFILTER = 8;
const MAX_RESULTS = 5;

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function text(value, limit = 240) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, limit)
    : "";
}

function normalise(value) {
  return text(value, 600)
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
}

function tokens(value) {
  return new Set(
    text(value, 1_200)
      .toUpperCase()
      .normalize("NFKD")
      .match(/[A-Z0-9]{2,}/g) ?? [],
  );
}

function tokenOverlap(left, right) {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const shared = [...leftTokens].filter((item) => rightTokens.has(item)).length;
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumberValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(numberValue(value))));
}

function evidenceValues(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(record)
    .filter(Boolean)
    .map((item) => ({
      value: text(item.value),
      confidence: clampScore(item.confidence),
    }))
    .filter((item) => item.value);
}

function textValues(value) {
  return Array.isArray(value)
    ? value.map((item) => text(item, 500)).filter(Boolean)
    : [];
}

function safeImageUrl(value) {
  const candidate = text(value, 1_000);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

const COMPONENT_CLASS_SIGNALS = [
  {
    key: "motor",
    terms: [
      "SERVO MOTOR",
      "SERVOMOTOR",
      "MOTOR",
      "OUTPUT SHAFT",
      "SHAFT",
      "FRONT FLANGE",
      "FLANGE",
    ],
  },
  {
    key: "plc_module",
    terms: [
      "PLC",
      "SIMATIC",
      "ET 200",
      "INPUT MODULE",
      "OUTPUT MODULE",
      "ANALOGUE INPUT",
      "ANALOG INPUT",
      "DIGITAL INPUT",
      "DIGITAL OUTPUT",
    ],
  },
  {
    key: "sensor",
    terms: ["SENSOR", "TRANSMITTER", "PRESSURE SENSOR", "PROBE"],
  },
  {
    key: "filter",
    terms: ["FILTER", "CARTRIDGE", "FILTER CARTRIDGE"],
  },
  {
    key: "seal",
    terms: ["DIAPHRAGM", "SEAL", "GASKET"],
  },
];

function componentClass(value) {
  const source = text(value, 2_000).toUpperCase();
  if (!source) return "";
  let best = { key: "", score: 0 };
  for (const group of COMPONENT_CLASS_SIGNALS) {
    const score = group.terms.reduce(
      (total, term) => total + (source.includes(term) ? 1 : 0),
      0,
    );
    if (score > best.score) best = { key: group.key, score };
  }
  return best.score > 0 ? best.key : "";
}

export function isAskVortaSparePhotoQuestion(value) {
  const question = text(value, 1_000).toLowerCase();
  if (!question) return false;
  return (
    /\b(stock\s*(number|no\.?|code)|stores?\s*(number|code)|spare\s*(number|code))\b/.test(question) ||
    /\b(identify|recognise|recognize|match|find)\b.{0,40}\b(spare|part|component|stock)\b/.test(question) ||
    /\b(spare|part|component)\b.{0,40}\b(identify|recognise|recognize|match|find|stock|stores?)\b/.test(question) ||
    /\bwhat\s+is\s+(this|the)\s+(spare|part|component)\b/.test(question)
  );
}

function candidateIdentity(component) {
  return [
    component.component_name,
    component.component_code,
    component.oem_part_number,
    component.maker_name,
    component.vendor_name,
    component.image_alt_text,
  ].filter(Boolean).join(" ");
}

function strongestManufacturer(extraction) {
  return evidenceValues(extraction?.manufacturerCandidates)
    .sort((first, second) => second.confidence - first.confidence)[0] ?? null;
}

function scoreMetadata(component, extraction, pagePath) {
  const identity = candidateIdentity(component);
  const componentCode = normalise(component.component_code);
  const oemPart = normalise(component.oem_part_number);
  const makerValues = [component.maker_name, component.vendor_name]
    .map(normalise)
    .filter(Boolean);
  let score = 0;
  let exactIdentifier = false;

  const weightedTerms = [
    ...evidenceValues(extraction?.partCandidates).map((item) => ({ ...item, kind: "part" })),
    ...evidenceValues(extraction?.modelCandidates).map((item) => ({ ...item, kind: "model" })),
    ...evidenceValues(extraction?.observedText).map((item) => ({ ...item, kind: "observed" })),
  ];

  for (const term of weightedTerms) {
    const normalisedTerm = normalise(term.value);
    if (!normalisedTerm) continue;
    const weight = Math.max(0.3, term.confidence / 100);
    if (
      normalisedTerm.length >= 4 &&
      (normalisedTerm === componentCode || normalisedTerm === oemPart)
    ) {
      score += 120 * weight;
      exactIdentifier = true;
      continue;
    }
    if (
      normalisedTerm.length >= 4 &&
      (componentCode.includes(normalisedTerm) || oemPart.includes(normalisedTerm))
    ) {
      score += 70 * weight;
      continue;
    }
    const overlap = tokenOverlap(identity, term.value);
    if (overlap >= 0.25) {
      score += (term.kind === "part" ? 52 : term.kind === "model" ? 38 : 24) * overlap * weight;
    }
  }

  for (const manufacturer of evidenceValues(extraction?.manufacturerCandidates)) {
    const normalisedManufacturer = normalise(manufacturer.value);
    const weight = Math.max(0.3, manufacturer.confidence / 100);
    if (normalisedManufacturer && makerValues.some((maker) => maker === normalisedManufacturer)) {
      score += 60 * weight;
    } else if (normalisedManufacturer && normalise(identity).includes(normalisedManufacturer)) {
      score += 42 * weight;
    }
  }

  const visualObservations = textValues(extraction?.visualObservations);
  for (const observation of visualObservations) {
    const overlap = tokenOverlap(identity, observation);
    if (overlap >= 0.2) score += 28 * overlap;
  }

  // Component class is a deliberately strong fallback signal. A visible servo motor
  // must not tie with a PLC input module merely because both carry SIEMENS branding.
  const observedClass = componentClass(visualObservations.join(" "));
  const candidateClass = componentClass(identity);
  if (observedClass && candidateClass) {
    score += observedClass === candidateClass ? 52 : -38;
  }

  if (
    typeof pagePath === "string" &&
    component.equipment_id &&
    pagePath.includes(String(component.equipment_id))
  ) {
    score += 18;
  }

  if (safeImageUrl(component.image_url)) score += 8;
  if (text(component.image_verification_status).toLowerCase() === "verified") score += 8;

  return {
    rawScore: Math.round(score * 10) / 10,
    metadataScore: clampScore(exactIdentifier ? Math.max(95, score) : score),
    exactIdentifier,
  };
}

export function rankAskVortaSparePhotoCandidates(
  extractionValue,
  componentValue,
  options = {},
) {
  const extraction = record(extractionValue) ?? {};
  const components = Array.isArray(componentValue)
    ? componentValue.map(record).filter(Boolean)
    : [];
  const pagePath = text(options.pagePath, 1_000);
  const manufacturer = strongestManufacturer(extraction);
  const manufacturerNormalised = normalise(manufacturer?.value);
  const manufacturerReliable = Boolean(
    manufacturerNormalised && numberValue(manufacturer?.confidence) >= 60,
  );

  const eligible = components.filter((component) =>
    text(component.image_verification_status).toLowerCase() === "verified" &&
    Boolean(safeImageUrl(component.image_url)),
  );
  const manufacturerMatches = manufacturerReliable
    ? eligible.filter((component) =>
        [component.maker_name, component.vendor_name]
          .map(normalise)
          .filter(Boolean)
          .some((maker) => maker === manufacturerNormalised || maker.includes(manufacturerNormalised)),
      )
    : [];
  const pool = manufacturerMatches.length > 0 ? manufacturerMatches : eligible;

  const ranked = pool
    .map((component) => {
      const scoring = scoreMetadata(component, extraction, pagePath);
      return {
        componentId: text(component.id, 100),
        equipmentId: text(component.equipment_id, 100),
        componentName: text(component.component_name, 220),
        stockNumber: text(component.component_code, 140),
        oemPartNumber: text(component.oem_part_number, 140),
        manufacturer: text(component.maker_name || component.vendor_name, 160),
        imageUrl: safeImageUrl(component.image_url),
        imageAltText: text(component.image_alt_text, 240),
        quantity: optionalNumberValue(component.quantity_available),
        location: text(component.storage_location, 160),
        availabilityStatus: text(component.availability_status, 100),
        metadataScore: scoring.metadataScore,
        rawMetadataScore: scoring.rawScore,
        exactIdentifier: scoring.exactIdentifier,
      };
    })
    .filter((item) => item.componentId && item.imageUrl)
    .sort((first, second) =>
      second.rawMetadataScore - first.rawMetadataScore ||
      first.stockNumber.localeCompare(second.stockNumber),
    );

  // Exact duplicate OEM/image records add noise to a photo-identification list. Keep the
  // strongest context-specific record for each exact part image.
  const seenPartImages = new Set();
  const unique = [];
  for (const item of ranked) {
    const key = `${normalise(item.oemPartNumber) || normalise(item.stockNumber)}|${normalise(item.imageUrl)}`;
    if (seenPartImages.has(key)) continue;
    seenPartImages.add(key);
    unique.push(item);
    if (unique.length >= MAX_PREFILTER) break;
  }

  return {
    manufacturerFilter: manufacturerReliable ? manufacturer?.value ?? "" : "",
    manufacturerFilterApplied: manufacturerMatches.length > 0,
    candidates: unique,
  };
}

export function combineAskVortaSparePhotoMatches(candidateValue, visualValue) {
  const candidates = Array.isArray(candidateValue)
    ? candidateValue.map(record).filter(Boolean)
    : [];
  const visualRows = Array.isArray(visualValue)
    ? visualValue.map(record).filter(Boolean)
    : [];
  const visualById = new Map(
    visualRows
      .map((item) => [text(item.componentId, 100), clampScore(item.visualSimilarity)])
      .filter(([id]) => Boolean(id)),
  );
  const hasVisualEvidence = visualById.size > 0;
  const ranked = candidates
    .map((candidate) => {
      const metadataScore = clampScore(candidate.metadataScore);
      const visualSimilarity = visualById.has(text(candidate.componentId, 100))
        ? visualById.get(text(candidate.componentId, 100))
        : null;
      const finalScore = visualSimilarity === null
        ? Math.round(metadataScore * (hasVisualEvidence ? 0.4 : 0.72))
        : clampScore(metadataScore * 0.36 + visualSimilarity * 0.64);
      return {
        ...candidate,
        metadataScore,
        visualSimilarity,
        matchConfidence: candidate.exactIdentifier
          ? Math.max(95, finalScore)
          : finalScore,
      };
    })
    .filter((item) => item.matchConfidence >= 20)
    .sort((first, second) =>
      second.matchConfidence - first.matchConfidence ||
      first.stockNumber.localeCompare(second.stockNumber),
    );

  const topScore = ranked[0]?.matchConfidence ?? 0;
  return ranked
    .filter(
      (item, index) =>
        index === 0 || item.matchConfidence >= Math.max(25, topScore - 35),
    )
    .slice(0, MAX_RESULTS);
}

export const ASK_VORTA_SPARE_VISUAL_MATCH_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    matches: {
      type: "array",
      maxItems: MAX_PREFILTER,
      items: {
        type: "object",
        properties: {
          componentId: { type: "string" },
          visualSimilarity: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["componentId", "visualSimilarity"],
        additionalProperties: false,
      },
    },
  },
  required: ["matches"],
  additionalProperties: false,
});
