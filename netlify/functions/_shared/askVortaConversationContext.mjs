const CONTEXT_VERSION = 1;
const MAX_OPTIONS = 8;
const MAX_TEXT = 240;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBJECTS = new Set([
  "site",
  "site_priorities",
  "equipment",
  "shift_cover",
  "maintenance_plan",
  "spares",
  "documents",
  "work",
  "skills",
  "handover",
  "risk",
  "mixed",
]);
const OPTION_TYPES = new Set([
  "equipment",
  "ranked_action",
  "cover",
  "spare",
  "document",
  "work",
  "skill",
]);

const ORDINAL_WORDS = new Map([
  ["first", 1],
  ["1st", 1],
  ["one", 1],
  ["second", 2],
  ["2nd", 2],
  ["two", 2],
  ["third", 3],
  ["3rd", 3],
  ["three", 3],
  ["fourth", 4],
  ["4th", 4],
  ["four", 4],
  ["fifth", 5],
  ["5th", 5],
  ["five", 5],
  ["sixth", 6],
  ["6th", 6],
  ["six", 6],
  ["seventh", 7],
  ["7th", 7],
  ["seven", 7],
  ["eighth", 8],
  ["8th", 8],
  ["eight", 8],
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function text(value, limit = MAX_TEXT) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, limit)
    : null;
}

function date(value) {
  const candidate = text(value, 10);
  return candidate && DATE_ONLY_PATTERN.test(candidate) ? candidate : null;
}

function uuid(value) {
  const candidate = text(value, 36);
  return candidate && UUID_PATTERN.test(candidate) ? candidate : null;
}

function option(value, fallbackPosition) {
  const candidate = record(value);
  if (!candidate) return null;
  const position = Number(candidate.position);
  const normalisedPosition = Number.isInteger(position)
    ? Math.max(1, Math.min(MAX_OPTIONS, position))
    : fallbackPosition;
  const label = text(candidate.label);
  const type = text(candidate.type, 40);
  if (!label || !type || !OPTION_TYPES.has(type)) return null;
  const equipmentQuery = text(candidate.equipmentQuery, 160);
  const equipmentId = uuid(candidate.equipmentId);
  const reference = text(candidate.reference, 160);
  const optionValue = text(candidate.value, 500);
  return {
    position: normalisedPosition,
    type,
    label,
    ...(equipmentQuery ? { equipmentQuery } : {}),
    ...(equipmentId ? { equipmentId } : {}),
    ...(reference ? { reference } : {}),
    ...(optionValue ? { value: optionValue } : {}),
  };
}

function activeEquipment(value) {
  const candidate = record(value);
  if (!candidate) return null;
  const query = text(candidate.query, 160);
  const id = uuid(candidate.id);
  const code = text(candidate.code, 80);
  const name = text(candidate.name, 160);
  if (!query && !id && !code && !name) return null;
  return {
    query: query || code || name || "",
    ...(id ? { id } : {}),
    ...(code ? { code } : {}),
    ...(name ? { name } : {}),
  };
}

function dateRange(value) {
  const candidate = record(value);
  if (!candidate) return null;
  const startDate = date(candidate.startDate);
  const endDate = date(candidate.endDate);
  const timezone = text(candidate.timezone, 80) || "Europe/London";
  if (!startDate || !endDate || endDate < startDate) return null;
  return { startDate, endDate, timezone };
}

function shift(value) {
  const candidate = record(value);
  if (!candidate) return null;
  const team = text(candidate.team, 120);
  const type = text(candidate.type, 80);
  const shiftDate = date(candidate.date);
  if (!team && !type && !shiftDate) return null;
  return {
    ...(team ? { team } : {}),
    ...(type ? { type } : {}),
    ...(shiftDate ? { date: shiftDate } : {}),
  };
}

export function sanitizeConversationContext(value) {
  const candidate = record(value);
  if (!candidate || Number(candidate.version) !== CONTEXT_VERSION) return null;
  const subjectValue = text(candidate.subject, 60);
  const subject = subjectValue && SUBJECTS.has(subjectValue) ? subjectValue : "mixed";
  const intent = text(candidate.intent, 120) || "Vorta follow-up";
  const area = text(candidate.area, 120);
  const options = Array.isArray(candidate.orderedOptions)
    ? candidate.orderedOptions
        .slice(0, MAX_OPTIONS)
        .map((item, index) => option(item, index + 1))
        .filter(Boolean)
        .map((item, index) => ({ ...item, position: index + 1 }))
    : [];
  const requestedSelected = option(candidate.selectedOption, 1);
  const selectedOption = requestedSelected
    ? options.find((item) => item.position === requestedSelected.position) || requestedSelected
    : null;
  const updatedAtValue = text(candidate.updatedAt, 40);
  const updatedAt = updatedAtValue && Number.isFinite(new Date(updatedAtValue).getTime())
    ? new Date(updatedAtValue).toISOString()
    : null;
  return {
    version: CONTEXT_VERSION,
    subject,
    intent,
    activeEquipment: activeEquipment(candidate.activeEquipment),
    area,
    shift: shift(candidate.shift),
    dateRange: dateRange(candidate.dateRange),
    orderedOptions: options,
    selectedOption,
    updatedAt,
  };
}

function ordinalPosition(question, count) {
  const lowered = question.toLowerCase();
  const numericMatch = lowered.match(/\b(?:option|choice|item|number|no\.?|#)\s*([1-8])\b/);
  if (numericMatch) return Number(numericMatch[1]);
  for (const [word, position] of ORDINAL_WORDS) {
    const pattern = new RegExp(`\\b${word}\\s+(?:option|choice|item|one|asset|action|result)\\b`);
    if (pattern.test(lowered)) return position;
  }
  if (/\b(?:last|final)\s+(?:option|choice|item|one|asset|action|result)\b/.test(lowered)) {
    return count || null;
  }
  return null;
}

function hasExplicitDateReference(question) {
  return /\b(?:today|tomorrow|yesterday|tonight|this\s+(?:week|month|shift)|next\s+(?:week|month|shift|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|previous\s+(?:week|month|shift)|last\s+(?:week|month|shift)|\d{4}-\d{2}-\d{2})\b/i.test(question);
}

function hasExplicitEquipmentCode(question) {
  return /\b[A-Z]{2,8}-\d{1,6}\b/i.test(question);
}

function asksForContextReference(question) {
  return /\b(?:it|that\s+(?:asset|machine|equipment|one|option|action|result)|this\s+(?:asset|machine|equipment|one)|same\s+(?:asset|machine|equipment|one|option)|the\s+other\s+one)\b/i.test(question);
}

function isBareFollowUp(question) {
  const words = question.trim().split(/\s+/).filter(Boolean);
  return words.length <= 18 && (
    asksForContextReference(question) ||
    hasExplicitDateReference(question) ||
    /\b(?:what\s+about|and\s+for|how\s+about|why|when|who|where|show\s+me|open|compare|instead)\b/i.test(question)
  );
}

function optionSummary(options) {
  return options
    .slice(0, 4)
    .map((item) => `${item.position}: ${item.label}`)
    .join("; ");
}

export function resolveConversationFollowUp(questionValue, contextValue) {
  const question = text(questionValue, 2_000) || "";
  const context = sanitizeConversationContext(contextValue);
  if (!context) {
    return {
      context: null,
      selectedOption: null,
      activeEquipmentQuery: null,
      inheritedSubject: null,
      inheritedDateRange: null,
      shouldClarify: false,
      clarificationQuestion: null,
      usedContext: false,
      hasExplicitDate: hasExplicitDateReference(question),
      hasExplicitEquipment: hasExplicitEquipmentCode(question),
    };
  }

  const requestedPosition = ordinalPosition(question, context.orderedOptions.length);
  if (requestedPosition && context.orderedOptions.length === 0) {
    return {
      context,
      selectedOption: null,
      activeEquipmentQuery: null,
      inheritedSubject: context.subject,
      inheritedDateRange: null,
      shouldClarify: true,
      clarificationQuestion: "Which earlier option do you mean? The previous answer did not contain a reusable ordered option list.",
      usedContext: false,
      hasExplicitDate: hasExplicitDateReference(question),
      hasExplicitEquipment: hasExplicitEquipmentCode(question),
    };
  }
  if (requestedPosition && requestedPosition > context.orderedOptions.length) {
    return {
      context,
      selectedOption: null,
      activeEquipmentQuery: null,
      inheritedSubject: context.subject,
      inheritedDateRange: null,
      shouldClarify: true,
      clarificationQuestion: `Which option do you mean? The previous answer contains ${context.orderedOptions.length}: ${optionSummary(context.orderedOptions)}.`,
      usedContext: false,
      hasExplicitDate: hasExplicitDateReference(question),
      hasExplicitEquipment: hasExplicitEquipmentCode(question),
    };
  }

  let selectedOption = requestedPosition
    ? context.orderedOptions[requestedPosition - 1] || null
    : context.selectedOption;
  const referencesContext = asksForContextReference(question);
  if (!selectedOption && referencesContext && context.orderedOptions.length === 1) {
    selectedOption = context.orderedOptions[0];
  }
  if (
    !requestedPosition &&
    referencesContext &&
    !selectedOption &&
    !context.activeEquipment &&
    context.orderedOptions.length > 1
  ) {
    return {
      context,
      selectedOption: null,
      activeEquipmentQuery: null,
      inheritedSubject: context.subject,
      inheritedDateRange: null,
      shouldClarify: true,
      clarificationQuestion: `Which one do you mean? ${optionSummary(context.orderedOptions)}.`,
      usedContext: false,
      hasExplicitDate: hasExplicitDateReference(question),
      hasExplicitEquipment: hasExplicitEquipmentCode(question),
    };
  }

  const explicitDate = hasExplicitDateReference(question);
  const explicitEquipment = hasExplicitEquipmentCode(question);
  const activeEquipmentQuery = explicitEquipment
    ? null
    : selectedOption?.equipmentQuery || context.activeEquipment?.query || null;
  const bareFollowUp = isBareFollowUp(question) || Boolean(requestedPosition);
  return {
    context,
    selectedOption,
    activeEquipmentQuery,
    inheritedSubject: bareFollowUp ? context.subject : null,
    inheritedDateRange: bareFollowUp && !explicitDate ? context.dateRange : null,
    shouldClarify: false,
    clarificationQuestion: null,
    usedContext: Boolean(
      selectedOption ||
      activeEquipmentQuery ||
      (bareFollowUp && context.subject) ||
      (bareFollowUp && !explicitDate && context.dateRange)
    ),
    hasExplicitDate: explicitDate,
    hasExplicitEquipment: explicitEquipment,
  };
}

export function contextResolutionPrompt(resolutionValue) {
  const resolution = record(resolutionValue);
  if (!resolution || !resolution.usedContext) return "No validated structured follow-up context was used.";
  const context = sanitizeConversationContext(resolution.context);
  if (!context) return "No validated structured follow-up context was used.";
  const selected = option(resolution.selectedOption, 1);
  const inheritedDates = dateRange(resolution.inheritedDateRange);
  return JSON.stringify({
    subject: resolution.inheritedSubject || context.subject,
    activeEquipmentQuery: text(resolution.activeEquipmentQuery, 160),
    selectedOption: selected,
    inheritedDateRange: inheritedDates,
    area: context.area,
    shift: context.shift,
  });
}

export function createConversationContext(value) {
  return sanitizeConversationContext({
    version: CONTEXT_VERSION,
    subject: value?.subject || "mixed",
    intent: value?.intent || "Vorta follow-up",
    activeEquipment: value?.activeEquipment || null,
    area: value?.area || null,
    shift: value?.shift || null,
    dateRange: value?.dateRange || null,
    orderedOptions: value?.orderedOptions || [],
    selectedOption: value?.selectedOption || null,
    updatedAt: value?.updatedAt || new Date().toISOString(),
  });
}
