import { supabase } from "../../lib/supabaseClient";

export interface AskVortaInteractionHistoryRow {
  routeKey: string;
  intentLabel: string | null;
  feedback: string | null;
  createdAt: string;
}

export interface AskVortaLiveSuggestionContext {
  siteRiskScore: number | null;
  topEquipmentRiskScore: number | null;
  criticalShiftSkillGaps: number;
  highShiftSkillGaps: number;
}

export interface AskVortaSuggestion {
  question: string;
  source: "frequently-asked" | "relevant-now" | "history" | "default";
  intentGroup: string;
  score: number;
}

interface SuggestionDefinition {
  id: string;
  question: string;
  routeTokens: string[];
}

const HISTORY_DAYS = 90;
const HISTORY_LIMIT = 180;
const MIN_PERSONALISATION_INTERACTIONS = 5;

const DEFINITIONS: SuggestionDefinition[] = [
  {
    id: "site-risk",
    question: "What are my highest site risks today?",
    routeTokens: [
      "site_priorities",
      "site_risk_movement",
      "site_threat_prioritization",
      "daily_priority",
      "site_risk",
    ],
  },
  {
    id: "equipment",
    question: "Which equipment needs attention first?",
    routeTokens: ["equipment", "equipment_decision", "equipment_risk"],
  },
  {
    id: "shift-cover",
    question: "What shift-cover issues need attention?",
    routeTokens: [
      "shift_cover",
      "shift_cover_risk",
      "shift_cover_assessment",
      "maintenance_plan_cover",
      "absence",
      "absence_check",
    ],
  },
  {
    id: "skills",
    question: "Where are my biggest skills or capability gaps?",
    routeTokens: ["capability_risk", "shift_skills_gap", "skills_risk"],
  },
  {
    id: "spares",
    question: "Which spares risks need attention?",
    routeTokens: ["spares", "spares_priority", "spares_risk_assessment"],
  },
  {
    id: "handover",
    question: "What needs attention from the latest shift handover?",
    routeTokens: [
      "handover",
      "shift_handover",
      "shift_handover_summary",
      "shift_change",
    ],
  },
  {
    id: "work",
    question: "Which maintenance work should I prioritise?",
    routeTokens: ["work_backlog", "work", "maintenance_work"],
  },
  {
    id: "contractor",
    question: "Where do I need contractor support?",
    routeTokens: [
      "contractor",
      "contractor_support",
      "contractor_availability",
      "contractor_availability_skills",
      "contractor_availability_and_skills",
    ],
  },
];

function normalise(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function resolveDefinition(row: AskVortaInteractionHistoryRow): SuggestionDefinition | null {
  const values = [normalise(row.routeKey), normalise(row.intentLabel)].filter(Boolean);
  return (
    DEFINITIONS.find((definition) =>
      definition.routeTokens.some((token) =>
        values.some((value) => value === token || value.startsWith(`${token}_`)),
      ),
    ) ?? null
  );
}

function recencyWeight(createdAt: string, nowMs: number): number {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (nowMs - timestamp) / 86_400_000);
  if (ageDays <= 1) return 6;
  if (ageDays <= 7) return 4;
  if (ageDays <= 30) return 2;
  return 1;
}

function liveRelevanceScore(
  definitionId: string,
  context: AskVortaLiveSuggestionContext,
): number {
  if (definitionId === "site-risk") {
    const score = context.siteRiskScore ?? 0;
    return score >= 80 ? 12 : score >= 65 ? 9 : score >= 45 ? 6 : 3;
  }

  if (definitionId === "equipment") {
    const score = context.topEquipmentRiskScore ?? 0;
    return score >= 85 ? 12 : score >= 70 ? 9 : score >= 50 ? 6 : 3;
  }

  if (definitionId === "shift-cover" || definitionId === "skills") {
    if (context.criticalShiftSkillGaps > 0) return 13;
    if (context.highShiftSkillGaps > 0) return 10;
    return 2;
  }

  return 1;
}

function uniqueSuggestions(items: AskVortaSuggestion[]): AskVortaSuggestion[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalise(item.question);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function loadAskVortaInteractionHistory({
  userId,
  siteId,
  role,
}: {
  userId: string;
  siteId: string;
  role: string;
}): Promise<AskVortaInteractionHistoryRow[]> {
  const cutoff = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("ask_vorta_interactions")
    .select("route_key, intent_label, feedback, created_at")
    .eq("user_id", userId)
    .eq("site_id", siteId)
    .eq("role", role)
    .eq("status", "completed")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    throw new Error(`Ask Vorta suggestion history could not be loaded: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    routeKey: String(row.route_key ?? ""),
    intentLabel: row.intent_label ? String(row.intent_label) : null,
    feedback: row.feedback ? String(row.feedback) : null,
    createdAt: String(row.created_at ?? ""),
  }));
}

export function buildPersonalisedAskVortaSuggestions({
  history,
  liveContext,
  fallbackQuestions,
  now = new Date(),
}: {
  history: AskVortaInteractionHistoryRow[];
  liveContext: AskVortaLiveSuggestionContext;
  fallbackQuestions: string[];
  now?: Date;
}): AskVortaSuggestion[] {
  const nowMs = now.getTime();
  const aggregates = new Map<
    string,
    {
      definition: SuggestionDefinition;
      count: number;
      recency: number;
      feedback: number;
      lastUsedMs: number;
    }
  >();

  history.forEach((row) => {
    const definition = resolveDefinition(row);
    if (!definition) return;
    const current = aggregates.get(definition.id) ?? {
      definition,
      count: 0,
      recency: 0,
      feedback: 0,
      lastUsedMs: 0,
    };
    const timestamp = new Date(row.createdAt).getTime();
    current.count += 1;
    current.recency += recencyWeight(row.createdAt, nowMs);
    current.feedback += row.feedback === "helpful" ? 2 : row.feedback === "not_helpful" ? -3 : 0;
    current.lastUsedMs = Math.max(
      current.lastUsedMs,
      Number.isFinite(timestamp) ? timestamp : 0,
    );
    aggregates.set(definition.id, current);
  });

  const historyRanked = [...aggregates.values()]
    .map((aggregate) => ({
      definition: aggregate.definition,
      score:
        Math.log2(aggregate.count + 1) * 8 +
        aggregate.recency +
        aggregate.feedback +
        (aggregate.lastUsedMs > 0 ? 1 : 0),
    }))
    .sort((left, right) => right.score - left.score);

  const relevantNow = DEFINITIONS
    .map((definition) => ({
      definition,
      score: liveRelevanceScore(definition.id, liveContext),
    }))
    .sort((left, right) => right.score - left.score);

  const suggestions: AskVortaSuggestion[] = [];
  const personalised = history.length >= MIN_PERSONALISATION_INTERACTIONS;

  if (personalised && historyRanked[0]) {
    suggestions.push({
      question: historyRanked[0].definition.question,
      source: "frequently-asked",
      intentGroup: historyRanked[0].definition.id,
      score: historyRanked[0].score,
    });
  }

  const usedIntent = new Set(suggestions.map((item) => item.intentGroup));
  const contextChoice = relevantNow.find((item) => !usedIntent.has(item.definition.id));
  if (contextChoice) {
    suggestions.push({
      question: contextChoice.definition.question,
      source: "relevant-now",
      intentGroup: contextChoice.definition.id,
      score: contextChoice.score,
    });
    usedIntent.add(contextChoice.definition.id);
  }

  if (personalised) {
    historyRanked.slice(1).forEach((item) => {
      if (suggestions.length >= 4 || usedIntent.has(item.definition.id)) return;
      suggestions.push({
        question: item.definition.question,
        source: "history",
        intentGroup: item.definition.id,
        score: item.score,
      });
      usedIntent.add(item.definition.id);
    });
  }

  fallbackQuestions.forEach((question, index) => {
    if (suggestions.length >= 4) return;
    suggestions.push({
      question,
      source: "default",
      intentGroup: `default-${index}`,
      score: 0,
    });
  });

  return uniqueSuggestions(suggestions).slice(0, 4);
}
