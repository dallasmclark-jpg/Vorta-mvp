const MAX_VISUAL_ITEMS = 12;
const MAX_MATCHES = 8;
const MAX_TEXT_LENGTH = 240;
const EXTRACTION_STATUSES = new Set(["readable", "partial", "unreadable"]);
const IMAGE_TYPES = new Set([
  "fault_screen",
  "nameplate",
  "component",
  "equipment",
  "other",
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function text(value, limit = MAX_TEXT_LENGTH) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, limit)
    : "";
}

function confidence(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.max(0, Math.min(100, Math.round(numeric)))
    : 0;
}

function evidenceItems(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .slice(0, MAX_VISUAL_ITEMS * 2)
    .flatMap((item) => {
      const candidate = record(item);
      const itemValue = text(candidate?.value);
      if (!itemValue) return [];
      const key = itemValue.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ value: itemValue, confidence: confidence(candidate?.confidence) }];
    })
    .sort((first, second) => second.confidence - first.confidence)
    .slice(0, MAX_VISUAL_ITEMS);
}

function textItems(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .slice(0, MAX_VISUAL_ITEMS * 2)
    .flatMap((item) => {
      const itemValue = text(item, 500);
      if (!itemValue) return [];
      const key = itemValue.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [itemValue];
    })
    .slice(0, MAX_VISUAL_ITEMS);
}

export const ASK_VORTA_IMAGE_EXTRACTION_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    extractionStatus: {
      type: "string",
      enum: ["readable", "partial", "unreadable"],
    },
    imageType: {
      type: "string",
      enum: ["fault_screen", "nameplate", "component", "equipment", "other"],
    },
    observedText: {
      type: "array",
      items: {
        type: "object",
        properties: {
          value: { type: "string" },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      maxItems: MAX_VISUAL_ITEMS,
    },
    faultCodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          value: { type: "string" },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      maxItems: MAX_VISUAL_ITEMS,
    },
    manufacturerCandidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          value: { type: "string" },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      maxItems: MAX_VISUAL_ITEMS,
    },
    modelCandidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          value: { type: "string" },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      maxItems: MAX_VISUAL_ITEMS,
    },
    partCandidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          value: { type: "string" },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      maxItems: MAX_VISUAL_ITEMS,
    },
    equipmentCodeCandidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          value: { type: "string" },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      maxItems: MAX_VISUAL_ITEMS,
    },
    visualObservations: {
      type: "array",
      items: { type: "string" },
      maxItems: MAX_VISUAL_ITEMS,
    },
    qualityWarnings: {
      type: "array",
      items: { type: "string" },
      maxItems: MAX_VISUAL_ITEMS,
    },
  },
  required: [
    "extractionStatus",
    "imageType",
    "observedText",
    "faultCodes",
    "manufacturerCandidates",
    "modelCandidates",
    "partCandidates",
    "equipmentCodeCandidates",
    "visualObservations",
    "qualityWarnings",
  ],
  additionalProperties: false,
});

export function sanitizeAskVortaImageExtraction(value) {
  const candidate = record(value);
  if (!candidate) return null;
  const extractionStatus = text(candidate.extractionStatus, 20);
  const imageType = text(candidate.imageType, 30);
  if (!EXTRACTION_STATUSES.has(extractionStatus) || !IMAGE_TYPES.has(imageType)) {
    return null;
  }
  return {
    extractionStatus,
    imageType,
    observedText: evidenceItems(candidate.observedText),
    faultCodes: evidenceItems(candidate.faultCodes),
    manufacturerCandidates: evidenceItems(candidate.manufacturerCandidates),
    modelCandidates: evidenceItems(candidate.modelCandidates),
    partCandidates: evidenceItems(candidate.partCandidates),
    equipmentCodeCandidates: evidenceItems(candidate.equipmentCodeCandidates),
    visualObservations: textItems(candidate.visualObservations),
    qualityWarnings: textItems(candidate.qualityWarnings),
  };
}

function normalise(value) {
  return text(value, 500)
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
}

function words(value) {
  return new Set(
    text(value, 1_000)
      .toUpperCase()
      .normalize("NFKD")
      .match(/[A-Z0-9]{2,}/g) ?? [],
  );
}

function overlapScore(left, right) {
  const leftWords = words(left);
  const rightWords = words(right);
  if (!leftWords.size || !rightWords.size) return 0;
  const overlap = [...leftWords].filter((item) => rightWords.has(item)).length;
  return overlap / Math.max(leftWords.size, rightWords.size);
}

function includesNormalised(haystack, needle) {
  const normalisedHaystack = normalise(haystack);
  const normalisedNeedle = normalise(needle);
  return Boolean(
    normalisedNeedle.length >= 3 &&
    normalisedHaystack.includes(normalisedNeedle),
  );
}

function extractionTerms(extraction) {
  const sources = [
    ...extraction.equipmentCodeCandidates.map((item) => ({ ...item, kind: "equipment_code" })),
    ...extraction.partCandidates.map((item) => ({ ...item, kind: "part" })),
    ...extraction.modelCandidates.map((item) => ({ ...item, kind: "model" })),
    ...extraction.manufacturerCandidates.map((item) => ({ ...item, kind: "manufacturer" })),
    ...extraction.observedText.map((item) => ({ ...item, kind: "observed" })),
  ];
  return sources.filter((item) => normalise(item.value).length >= 2);
}

function equipmentIdentity(asset) {
  return [
    asset.equipment_code,
    asset.name,
    asset.equipment_type,
    asset.area,
    asset.model,
    asset.description,
  ].filter(Boolean).join(" ");
}

function componentIdentity(component) {
  return [
    component.component_code,
    component.oem_part_number,
    component.component_name,
    component.vendor_name,
    component.maker_name,
    component.functional_location_code,
  ].filter(Boolean).join(" ");
}

function confidenceBand(score, exactIdentifier) {
  if (exactIdentifier && score >= 100) return "exact_identifier";
  if (score >= 80) return "strong_candidate";
  if (score >= 45) return "possible_candidate";
  return "weak_candidate";
}

function scoreEquipment(asset, terms, componentMakers) {
  const code = normalise(asset.equipment_code);
  const model = normalise(asset.model);
  const identity = equipmentIdentity(asset);
  let score = 0;
  let exactIdentifier = false;
  const basis = [];
  for (const term of terms) {
    const termValue = normalise(term.value);
    const weight = Math.max(0.25, term.confidence / 100);
    if (term.kind === "equipment_code" && termValue === code) {
      score += 110 * weight;
      exactIdentifier = true;
      basis.push(`Exact equipment code ${term.value}`);
      continue;
    }
    if (term.kind === "model" && termValue && termValue === model) {
      score += 75 * weight;
      basis.push(`Exact model text ${term.value}`);
      continue;
    }
    if (
      term.kind === "manufacturer" &&
      componentMakers.some((maker) => normalise(maker) === termValue)
    ) {
      score += 45 * weight;
      basis.push(`Recorded manufacturer ${term.value}`);
      continue;
    }
    if (includesNormalised(identity, term.value)) {
      score += (term.kind === "part" ? 20 : term.kind === "manufacturer" ? 30 : 32) * weight;
      basis.push(`Visible text overlaps ${term.value}`);
      continue;
    }
    const overlap = overlapScore(identity, term.value);
    if (overlap >= 0.5) {
      score += 18 * overlap * weight;
      basis.push(`Partial text overlap ${term.value}`);
    }
  }
  return {
    score: Math.round(score * 10) / 10,
    exactIdentifier,
    basis: [...new Set(basis)].slice(0, 6),
  };
}

function scoreComponent(component, asset, terms) {
  const componentCode = normalise(component.component_code);
  const partNumber = normalise(component.oem_part_number);
  const identity = componentIdentity(component);
  let score = 0;
  let exactIdentifier = false;
  const basis = [];
  for (const term of terms) {
    const termValue = normalise(term.value);
    const weight = Math.max(0.25, term.confidence / 100);
    if (
      (term.kind === "part" || term.kind === "observed") &&
      termValue &&
      (termValue === componentCode || termValue === partNumber)
    ) {
      score += 115 * weight;
      exactIdentifier = true;
      basis.push(`Exact component or OEM part code ${term.value}`);
      continue;
    }
    if (
      term.kind === "manufacturer" &&
      [component.maker_name, component.vendor_name]
        .filter(Boolean)
        .some((maker) => normalise(maker) === termValue)
    ) {
      score += 45 * weight;
      basis.push(`Recorded component manufacturer ${term.value}`);
      continue;
    }
    if (includesNormalised(identity, term.value)) {
      score += (term.kind === "part" ? 55 : term.kind === "model" ? 35 : 28) * weight;
      basis.push(`Component text overlaps ${term.value}`);
      continue;
    }
    const overlap = overlapScore(identity, term.value);
    if (overlap >= 0.5) {
      score += 20 * overlap * weight;
      basis.push(`Partial component overlap ${term.value}`);
    }
  }
  return {
    score: Math.round(score * 10) / 10,
    exactIdentifier,
    basis: [...new Set(basis)].slice(0, 6),
    equipmentCode: text(asset?.equipment_code, 80),
    equipmentName: text(asset?.name, 160),
  };
}

export function rankAskVortaImageMatches(
  extractionValue,
  equipmentValue,
  componentsValue,
) {
  const extraction = sanitizeAskVortaImageExtraction(extractionValue);
  if (!extraction) {
    return {
      extraction: null,
      equipmentMatches: [],
      componentMatches: [],
      selectedEquipmentQuery: null,
      matchStatus: "invalid_extraction",
      conflicts: [],
    };
  }
  const equipment = Array.isArray(equipmentValue)
    ? equipmentValue.map(record).filter(Boolean)
    : [];
  const components = Array.isArray(componentsValue)
    ? componentsValue.map(record).filter(Boolean)
    : [];
  const equipmentById = new Map(
    equipment.map((item) => [String(item.id ?? ""), item]),
  );
  const makersByEquipment = new Map();
  for (const component of components) {
    const equipmentId = String(component.equipment_id ?? "");
    const makers = makersByEquipment.get(equipmentId) ?? [];
    for (const maker of [component.maker_name, component.vendor_name]) {
      if (typeof maker === "string" && maker.trim()) makers.push(maker.trim());
    }
    makersByEquipment.set(equipmentId, [...new Set(makers)]);
  }
  const terms = extractionTerms(extraction);
  const equipmentMatches = equipment
    .map((asset) => {
      const scoring = scoreEquipment(
        asset,
        terms,
        makersByEquipment.get(String(asset.id ?? "")) ?? [],
      );
      return {
        equipmentId: text(asset.id, 80),
        equipmentCode: text(asset.equipment_code, 80),
        equipmentName: text(asset.name, 160),
        model: text(asset.model, 160),
        area: text(asset.area, 120),
        score: scoring.score,
        confidenceBand: confidenceBand(scoring.score, scoring.exactIdentifier),
        exactIdentifier: scoring.exactIdentifier,
        basis: scoring.basis,
      };
    })
    .filter((item) => item.score >= 20)
    .sort((first, second) => second.score - first.score || first.equipmentCode.localeCompare(second.equipmentCode))
    .slice(0, MAX_MATCHES);

  const componentMatches = components
    .map((component) => {
      const asset = equipmentById.get(String(component.equipment_id ?? ""));
      const scoring = scoreComponent(component, asset, terms);
      return {
        componentId: text(component.id, 80),
        componentCode: text(component.component_code, 120),
        oemPartNumber: text(component.oem_part_number, 120),
        componentName: text(component.component_name, 180),
        maker: text(component.maker_name || component.vendor_name, 160),
        equipmentId: text(component.equipment_id, 80),
        equipmentCode: scoring.equipmentCode,
        equipmentName: scoring.equipmentName,
        score: scoring.score,
        confidenceBand: confidenceBand(scoring.score, scoring.exactIdentifier),
        exactIdentifier: scoring.exactIdentifier,
        basis: scoring.basis,
      };
    })
    .filter((item) => item.score >= 20)
    .sort((first, second) => second.score - first.score || first.componentCode.localeCompare(second.componentCode))
    .slice(0, MAX_MATCHES);

  const componentTop = componentMatches[0];
  const equipmentTop = equipmentMatches[0];
  const selectedEquipmentQuery =
    componentTop?.exactIdentifier && componentTop.equipmentCode
      ? componentTop.equipmentCode
      : equipmentTop?.confidenceBand === "exact_identifier" ||
          equipmentTop?.confidenceBand === "strong_candidate"
        ? equipmentTop.equipmentCode || equipmentTop.equipmentName
        : null;
  const topScores = [
    equipmentTop ? { label: equipmentTop.equipmentCode || equipmentTop.equipmentName, score: equipmentTop.score } : null,
    componentTop ? { label: componentTop.componentCode || componentTop.oemPartNumber || componentTop.componentName, score: componentTop.score } : null,
  ].filter(Boolean);
  const conflicts = [];
  if (
    equipmentMatches.length > 1 &&
    equipmentMatches[0].score - equipmentMatches[1].score < 15
  ) {
    conflicts.push(
      `Equipment candidates ${equipmentMatches[0].equipmentCode} and ${equipmentMatches[1].equipmentCode} are too close to select silently.`,
    );
  }
  if (
    componentMatches.length > 1 &&
    componentMatches[0].score - componentMatches[1].score < 15
  ) {
    conflicts.push(
      "Multiple component candidates have similar evidence scores.",
    );
  }
  const matchStatus =
    extraction.extractionStatus === "unreadable"
      ? "unreadable"
      : conflicts.length
        ? "ambiguous"
        : topScores.some((item) => item.score >= 100)
          ? "exact_identifier"
          : topScores.some((item) => item.score >= 80)
            ? "strong_candidate"
            : topScores.some((item) => item.score >= 45)
              ? "possible_candidate"
              : "no_supported_match";

  return {
    extraction,
    equipmentMatches,
    componentMatches,
    selectedEquipmentQuery: conflicts.length ? null : selectedEquipmentQuery,
    matchStatus,
    conflicts,
  };
}

export function imageDiagnosisSearchText(resultValue) {
  const result = record(resultValue);
  const extraction = sanitizeAskVortaImageExtraction(result?.extraction);
  if (!extraction) return "";
  return [
    ...extraction.equipmentCodeCandidates.map((item) => item.value),
    ...extraction.partCandidates.map((item) => item.value),
    ...extraction.modelCandidates.map((item) => item.value),
    ...extraction.manufacturerCandidates.map((item) => item.value),
    ...extraction.faultCodes.map((item) => item.value),
    ...extraction.observedText.map((item) => item.value),
  ].filter(Boolean).join(" ").slice(0, 1_500);
}
