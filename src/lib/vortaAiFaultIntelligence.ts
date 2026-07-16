import {
  getEquipmentActivity,
  getEquipmentDocuments,
  getEquipmentList,
  getEquipmentSkills,
  searchEquipmentKnowledge,
  type EngineerMatch,
  type EquipmentKnowledgeChunk,
  type EquipmentListItem,
} from "../screens/Equipment/equipmentService";
import { supabase } from "./supabaseClient";

const INSTALL_MARKER = "vortaAiFaultIntelligence";
const RESULT_ATTR = "data-vorta-fault-intelligence";

const GENERIC_FAULT_TERMS = [
  "fault",
  "failure",
  "failed",
  "alarm",
  "trip",
  "error",
  "intermittent",
  "issue",
  "problem",
  "breakdown",
  "not working",
  "stopped",
];

const COMPONENT_EXPANSIONS: Record<string, string[]> = {
  sensor: [
    "sensor",
    "proximity",
    "photoeye",
    "photo eye",
    "photo-eye",
    "photocell",
    "encoder",
    "detector",
    "transducer",
    "switch",
    "feedback",
    "position",
    "reject confirmation",
    "false reject",
    "level",
    "pressure",
    "temperature",
    "flow",
    "vision",
  ],
  plc: ["plc", "controller", "logic", "communication", "comms", "i/o", "io module"],
  motor: ["motor", "drive", "overload", "winding", "bearing", "vibration"],
  valve: ["valve", "actuator", "cylinder", "solenoid", "pneumatic", "air pressure"],
  servo: ["servo", "axis", "drive", "encoder", "position feedback"],
  interlock: ["interlock", "guard", "door switch", "safety circuit"],
  calibration: ["calibration", "drift", "tolerance", "adjustment", "out of tolerance"],
};

const SKILL_SYNONYMS = [
  "instrumentation",
  "controls",
  "control systems",
  "automation",
  "electrical",
  "plc",
  "vision",
  "sensors",
  "sensor systems",
  "calibration",
  "process control",
  "fault finding",
  "diagnostics",
];

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "for",
  "of",
  "in",
  "on",
  "at",
  "is",
  "are",
  "was",
  "were",
  "with",
  "from",
  "this",
  "that",
  "what",
  "which",
  "who",
  "how",
  "show",
  "find",
  "look",
  "recent",
  "history",
  "issue",
  "issues",
  "fault",
  "faults",
  "problem",
  "problems",
]);

type EquipmentActivity = Awaited<ReturnType<typeof getEquipmentActivity>>[number];
type EquipmentDocument = Awaited<ReturnType<typeof getEquipmentDocuments>>[number];

interface HistoryMatch {
  equipment: EquipmentListItem;
  activity: EquipmentActivity;
  score: number;
  matchedTerms: string[];
  eventTime: number;
}

interface DocumentMatch {
  equipment: EquipmentListItem;
  title: string;
  sourceSystem: string;
  detail: string;
  excerpt: string;
  url: string | null;
  score: number;
}

interface RatedEngineer {
  id: string;
  name: string;
  discipline: string;
  availability: string;
  shift: string;
  onShift: boolean;
  rating: number;
  ratingSource: string;
  relevantSkills: string[];
  equipmentMatch: number;
  relevantSkillCount: number;
  score: number;
}

interface FaultIntelligenceResult {
  question: string;
  terms: string[];
  history: HistoryMatch[];
  documents: DocumentMatch[];
  engineers: RatedEngineer[];
  shiftLabel: string;
  confidence: number;
  searchedAssetCount: number;
}

interface SkillRow {
  id: string;
  name: string;
}

interface EngineerSkillRow {
  engineer_id: string;
  skill_id: string;
  validated_rating: number | null;
  manager_rating: number | null;
  self_rating: number | null;
  training_required?: boolean | null;
}

interface EngineerRow {
  id: string;
  full_name: string;
  discipline: string | null;
  shift_pattern: string | null;
  availability_status: string | null;
}

const resultsByQuestion = new Map<string, FaultIntelligenceResult>();
const pendingQuestions = new Set<string>();
let renderScheduled = false;

function normalise(value: string): string {
  return value.toLowerCase().replace(/[\s_/-]+/g, " ").trim();
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/")) return value;

  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function isFaultQuestion(question: string): boolean {
  const q = normalise(question);
  const hasFaultLanguage = GENERIC_FAULT_TERMS.some((term) => q.includes(term));
  const hasComponentLanguage = Object.keys(COMPONENT_EXPANSIONS).some((term) => q.includes(term));
  return hasFaultLanguage || hasComponentLanguage;
}

function buildSearchTerms(question: string): string[] {
  const q = normalise(question);
  const words = q
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  const expanded = [...words];
  Object.entries(COMPONENT_EXPANSIONS).forEach(([key, values]) => {
    if (q.includes(key) || values.some((value) => q.includes(value))) {
      expanded.push(...values);
    }
  });

  if (q.includes("sensor")) expanded.push(...SKILL_SYNONYMS);
  return unique(expanded.map(normalise).filter(Boolean));
}

function priorityScore(priority: string): number {
  const value = normalise(priority);
  if (value.includes("critical")) return 5;
  if (value.includes("high")) return 3;
  if (value.includes("medium")) return 2;
  return 1;
}

function outcomeScore(outcome: string): number {
  const value = normalise(outcome);
  if (/partial|temporary|recur|open|hold|fail|progress/.test(value)) return 5;
  if (/resolved|success|complete|pass/.test(value)) return 1;
  return 2;
}

function parseDate(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function findMentionedEquipment(
  question: string,
  equipment: EquipmentListItem[],
): EquipmentListItem | undefined {
  const q = normalise(question);
  return equipment.find((item) => {
    const name = normalise(item.name);
    const code = normalise(item.assetNumber ?? "");
    return q.includes(name) || Boolean(code && q.includes(code));
  });
}

function historyMatchScore(
  activity: EquipmentActivity,
  equipment: EquipmentListItem,
  terms: string[],
): { score: number; matchedTerms: string[] } {
  const searchable = normalise(
    `${activity.description} ${activity.type} ${activity.outcome} ${activity.woNumber}`,
  );
  const matchedTerms = terms.filter((term) => searchable.includes(term));
  const directTerms = terms.filter((term) => term.length > 4 && normalise(activity.description).includes(term));
  const score =
    matchedTerms.length * 3 +
    directTerms.length * 3 +
    priorityScore(activity.priority) +
    outcomeScore(activity.outcome) +
    Math.round(equipment.riskScore / 20);

  return { score, matchedTerms };
}

async function fetchHistoryMatches(
  question: string,
  assets: EquipmentListItem[],
  terms: string[],
): Promise<HistoryMatch[]> {
  const mentioned = findMentionedEquipment(question, assets);
  const scopedAssets = mentioned
    ? [mentioned]
    : [...assets]
        .sort((left, right) => right.riskScore - left.riskScore)
        .slice(0, 12);

  const activityByAsset = await Promise.all(
    scopedAssets.map(async (equipment) => ({
      equipment,
      activity: await getEquipmentActivity(equipment.id),
    })),
  );

  return activityByAsset
    .flatMap(({ equipment, activity }) =>
      activity.map((item) => {
        const match = historyMatchScore(item, equipment, terms);
        return {
          equipment,
          activity: item,
          score: match.score,
          matchedTerms: match.matchedTerms,
          eventTime: parseDate(item.date),
        };
      }),
    )
    .filter((match) => match.matchedTerms.length > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.eventTime - left.eventTime ||
        right.equipment.riskScore - left.equipment.riskScore,
    )
    .slice(0, 8);
}

function chunkDetail(chunk: EquipmentKnowledgeChunk): string {
  return [
    chunk.drawingNumber ? `Drawing ${chunk.drawingNumber}` : "",
    chunk.sheetNumber ? `Sheet ${chunk.sheetNumber}` : "",
    chunk.pageNumber != null ? `Page ${chunk.pageNumber}` : "",
    chunk.sectionTitle || chunk.chunkRef || "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function documentText(document: EquipmentDocument): string {
  const row = document as EquipmentDocument & {
    extractedSummary?: string | null;
    description?: string | null;
    faultCodes?: string[];
    componentTags?: string[];
    title?: string | null;
    documentType?: string | null;
    sourceSystem?: string | null;
    sourceUrl?: string | null;
    manualSection?: string | null;
    pageNumber?: number | null;
    drawingNumber?: string | null;
  };

  return normalise(
    [
      row.title,
      row.name,
      row.documentType,
      row.category,
      row.description,
      row.extractedSummary,
      ...(row.faultCodes ?? []),
      ...(row.componentTags ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

async function fetchDocumentMatches(
  question: string,
  relevantAssets: EquipmentListItem[],
  terms: string[],
): Promise<DocumentMatch[]> {
  const query = `${question} ${terms.slice(0, 12).join(" ")}`.trim();

  const rows = await Promise.all(
    relevantAssets.slice(0, 3).map(async (equipment) => {
      const [chunks, documents] = await Promise.all([
        searchEquipmentKnowledge(equipment.id, query, 6),
        getEquipmentDocuments(equipment.id),
      ]);

      const chunkMatches: DocumentMatch[] = chunks.map((chunk) => {
        const searchable = normalise(
          `${chunk.title} ${chunk.documentType} ${chunk.sectionTitle ?? ""} ${chunk.chunkText}`,
        );
        const matches = terms.filter((term) => searchable.includes(term));
        return {
          equipment,
          title: chunk.title,
          sourceSystem: chunk.sourceSystem,
          detail: chunkDetail(chunk),
          excerpt: chunk.chunkText.slice(0, 220),
          url: safeUrl(chunk.sourceUrl),
          score: matches.length * 5 + (chunk.pageNumber != null ? 2 : 0) + (chunk.drawingNumber ? 2 : 0),
        };
      });

      const documentMatches: DocumentMatch[] = documents
        .map((document) => {
          const row = document as EquipmentDocument & {
            title?: string | null;
            documentType?: string | null;
            sourceSystem?: string | null;
            sourceUrl?: string | null;
            extractedSummary?: string | null;
            description?: string | null;
            manualSection?: string | null;
            pageNumber?: number | null;
            drawingNumber?: string | null;
          };
          const searchable = documentText(document);
          const matches = terms.filter((term) => searchable.includes(term));
          const detail = [
            row.drawingNumber ? `Drawing ${row.drawingNumber}` : "",
            row.pageNumber != null ? `Page ${row.pageNumber}` : "",
            row.manualSection ?? "",
          ]
            .filter(Boolean)
            .join(" · ");
          return {
            equipment,
            title: row.title ?? row.name,
            sourceSystem: row.sourceSystem ?? row.category ?? "Document register",
            detail,
            excerpt: row.extractedSummary ?? row.description ?? "Linked equipment document",
            url:
              safeUrl(row.sourceUrl) ??
              `/equipment/${encodeURIComponent(equipment.id)}/documents/${encodeURIComponent(row.id)}`,
            score: matches.length * 4 + (row.pageNumber != null ? 2 : 0) + (row.drawingNumber ? 2 : 0),
          };
        })
        .filter((document) => document.score > 0);

      return [...chunkMatches, ...documentMatches];
    }),
  );

  const deduped = new Map<string, DocumentMatch>();
  rows.flat().forEach((document) => {
    const key = `${document.equipment.id}|${document.title}|${document.detail}`;
    const existing = deduped.get(key);
    if (!existing || document.score > existing.score) deduped.set(key, document);
  });

  return [...deduped.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}

function isUnavailable(status: string): boolean {
  const value = normalise(status);
  return /unavailable|off|leave|sick|away/.test(value);
}

function isOnShift(status: string, shiftPattern: string, isDayShift: boolean): boolean {
  const availability = normalise(status);
  const shift = normalise(shiftPattern);

  if (isUnavailable(availability)) return false;
  if (/on shift|on site|onsite|available|active/.test(availability)) return true;
  if (isDayShift && /day|days/.test(shift)) return true;
  if (!isDayShift && /night|nights/.test(shift)) return true;
  return /team a|team b|team c|team d|continental/.test(shift);
}

function ratingFor(row: EngineerSkillRow): { value: number; source: string } {
  if (row.validated_rating != null) return { value: row.validated_rating, source: "validated" };
  if (row.manager_rating != null) return { value: row.manager_rating, source: "manager" };
  if (row.self_rating != null) return { value: row.self_rating, source: "self" };
  return { value: 0, source: "unrated" };
}

async function fetchRatedEngineers(
  relevantAssets: EquipmentListItem[],
  terms: string[],
): Promise<{ engineers: RatedEngineer[]; shiftLabel: string }> {
  const now = new Date();
  const isDayShift = now.getHours() >= 6 && now.getHours() < 18;
  const shiftLabel = isDayShift ? "today's day shift" : "today's night shift";

  const coverageResults = await Promise.all(
    relevantAssets.slice(0, 3).map(async (equipment) => ({
      equipment,
      coverage: await getEquipmentSkills(equipment.id),
    })),
  );

  const equipmentMatchByEngineer = new Map<string, EngineerMatch>();
  const relevantSkillNames = new Map<string, string>();

  coverageResults.forEach(({ coverage }) => {
    coverage.engineers.forEach((engineer) => {
      const current = equipmentMatchByEngineer.get(engineer.id);
      if (!current || engineer.matchPercent > current.matchPercent) {
        equipmentMatchByEngineer.set(engineer.id, engineer);
      }
    });

    coverage.skills.forEach((skill) => {
      const name = normalise(skill.name);
      const matchesTerm = terms.some((term) => name.includes(term) || term.includes(name));
      const matchesDiagnosticSkill = SKILL_SYNONYMS.some((term) => name.includes(term));
      if (matchesTerm || matchesDiagnosticSkill) relevantSkillNames.set(skill.skillId, skill.name);
    });
  });

  const { data: allSkills, error: skillsError } = await supabase
    .from("skills")
    .select("id, name");

  if (!skillsError) {
    ((allSkills ?? []) as SkillRow[]).forEach((skill) => {
      const name = normalise(skill.name);
      const matchesTerm = terms.some((term) => name.includes(term) || term.includes(name));
      const matchesDiagnosticSkill = SKILL_SYNONYMS.some((term) => name.includes(term));
      if (matchesTerm || matchesDiagnosticSkill) relevantSkillNames.set(skill.id, skill.name);
    });
  }

  const relevantSkillIds = [...relevantSkillNames.keys()];

  if (relevantSkillIds.length === 0) {
    return {
      shiftLabel,
      engineers: [...equipmentMatchByEngineer.values()]
        .map((engineer) => ({
          id: engineer.id,
          name: engineer.name,
          discipline: engineer.role,
          availability: engineer.availability,
          shift: engineer.shift,
          onShift: isOnShift(engineer.availability, engineer.shift, isDayShift),
          rating: 0,
          ratingSource: "equipment match",
          relevantSkills: [],
          equipmentMatch: engineer.matchPercent,
          relevantSkillCount: engineer.relevantSkillCount,
          score:
            engineer.matchPercent +
            engineer.relevantSkillCount * 4 +
            (isOnShift(engineer.availability, engineer.shift, isDayShift) ? 40 : 0),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 6),
    };
  }

  const { data: engineerSkills, error: engineerSkillsError } = await supabase
    .from("engineer_skills")
    .select(
      "engineer_id, skill_id, validated_rating, manager_rating, self_rating, training_required",
    )
    .in("skill_id", relevantSkillIds);

  if (engineerSkillsError || !engineerSkills || engineerSkills.length === 0) {
    return {
      shiftLabel,
      engineers: [...equipmentMatchByEngineer.values()]
        .map((engineer) => ({
          id: engineer.id,
          name: engineer.name,
          discipline: engineer.role,
          availability: engineer.availability,
          shift: engineer.shift,
          onShift: isOnShift(engineer.availability, engineer.shift, isDayShift),
          rating: 0,
          ratingSource: "equipment match",
          relevantSkills: [],
          equipmentMatch: engineer.matchPercent,
          relevantSkillCount: engineer.relevantSkillCount,
          score:
            engineer.matchPercent +
            engineer.relevantSkillCount * 4 +
            (isOnShift(engineer.availability, engineer.shift, isDayShift) ? 40 : 0),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 6),
    };
  }

  const rows = engineerSkills as EngineerSkillRow[];
  const engineerIds = unique(rows.map((row) => row.engineer_id));
  const { data: engineerRows, error: engineersError } = await supabase
    .from("engineers")
    .select("id, full_name, discipline, shift_pattern, availability_status")
    .in("id", engineerIds);

  if (engineersError) return { engineers: [], shiftLabel };

  const engineerById = new Map(
    ((engineerRows ?? []) as EngineerRow[]).map((engineer) => [engineer.id, engineer]),
  );

  const grouped = new Map<string, EngineerSkillRow[]>();
  rows.forEach((row) => {
    const existing = grouped.get(row.engineer_id) ?? [];
    existing.push(row);
    grouped.set(row.engineer_id, existing);
  });

  const engineers = [...grouped.entries()]
    .map(([engineerId, skillRows]) => {
      const engineer = engineerById.get(engineerId);
      const ratings = skillRows.map(ratingFor).filter((rating) => rating.value > 0);
      const bestRating = ratings.reduce(
        (best, rating) => (rating.value > best.value ? rating : best),
        { value: 0, source: "unrated" },
      );
      const averageRating = ratings.length
        ? ratings.reduce((sum, rating) => sum + rating.value, 0) / ratings.length
        : 0;
      const relevantSkills = skillRows
        .filter((row) => ratingFor(row).value > 0)
        .map((row) => relevantSkillNames.get(row.skill_id) ?? "Relevant diagnostic skill");
      const equipmentMatch = equipmentMatchByEngineer.get(engineerId)?.matchPercent ?? 0;
      const availability = engineer?.availability_status ?? "Unknown";
      const shift = engineer?.shift_pattern ?? "Unknown";
      const onShift = isOnShift(availability, shift, isDayShift);
      const score =
        (onShift ? 60 : 0) +
        bestRating.value * 22 +
        averageRating * 8 +
        relevantSkills.length * 5 +
        equipmentMatch * 0.35;

      return {
        id: engineerId,
        name: engineer?.full_name ?? equipmentMatchByEngineer.get(engineerId)?.name ?? engineerId,
        discipline:
          engineer?.discipline ?? equipmentMatchByEngineer.get(engineerId)?.role ?? "Engineer",
        availability,
        shift,
        onShift,
        rating: Number(bestRating.value.toFixed(1)),
        ratingSource: bestRating.source,
        relevantSkills: unique(relevantSkills),
        equipmentMatch,
        relevantSkillCount: relevantSkills.length,
        score,
      } satisfies RatedEngineer;
    })
    .sort(
      (left, right) =>
        Number(right.onShift) - Number(left.onShift) ||
        right.rating - left.rating ||
        right.equipmentMatch - left.equipmentMatch ||
        right.score - left.score,
    )
    .slice(0, 6);

  return { engineers, shiftLabel };
}

async function buildFaultIntelligence(question: string): Promise<FaultIntelligenceResult> {
  const terms = buildSearchTerms(question);
  const equipment = await getEquipmentList();
  const history = await fetchHistoryMatches(question, equipment, terms);

  const relevantAssets = unique(
    history.map((match) => match.equipment.id),
  )
    .map((id) => equipment.find((asset) => asset.id === id))
    .filter((asset): asset is EquipmentListItem => Boolean(asset));

  const mentioned = findMentionedEquipment(question, equipment);
  if (mentioned && !relevantAssets.some((asset) => asset.id === mentioned.id)) {
    relevantAssets.unshift(mentioned);
  }

  if (relevantAssets.length === 0) {
    relevantAssets.push(
      ...[...equipment]
        .sort((left, right) => right.riskScore - left.riskScore)
        .slice(0, 2),
    );
  }

  const [documents, engineerResult] = await Promise.all([
    fetchDocumentMatches(question, relevantAssets, terms),
    fetchRatedEngineers(relevantAssets, terms),
  ]);

  const evidenceSignals = [
    history.length > 0,
    documents.length > 0,
    engineerResult.engineers.length > 0,
    engineerResult.engineers.some((engineer) => engineer.onShift),
  ].filter(Boolean).length;

  return {
    question,
    terms,
    history,
    documents,
    engineers: engineerResult.engineers,
    shiftLabel: engineerResult.shiftLabel,
    confidence: Math.min(94, 58 + evidenceSignals * 8),
    searchedAssetCount: mentioned ? 1 : Math.min(equipment.length, 12),
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function historyHtml(match: HistoryMatch): string {
  const historyUrl = `/equipment/${encodeURIComponent(match.equipment.id)}/history`;
  return `
    <a class="vorta-fault-row" href="${historyUrl}">
      <span class="vorta-fault-row-main">
        <strong>${escapeHtml(match.equipment.name)}</strong>
        <span>${escapeHtml(match.activity.woNumber)} · ${escapeHtml(formatDate(match.activity.date))}</span>
        <span>${escapeHtml(match.activity.description)}</span>
      </span>
      <span class="vorta-fault-row-meta">
        <em>${escapeHtml(match.activity.priority)}</em>
        <span>${escapeHtml(match.activity.outcome)}</span>
      </span>
    </a>`;
}

function engineerHtml(engineer: RatedEngineer): string {
  const rating = engineer.rating > 0 ? `${engineer.rating}/5 ${engineer.ratingSource}` : `${engineer.equipmentMatch}% equipment match`;
  const skillText = engineer.relevantSkills.length
    ? engineer.relevantSkills.slice(0, 3).join(" · ")
    : `${engineer.relevantSkillCount} relevant equipment skills`;

  return `
    <div class="vorta-fault-engineer">
      <div>
        <strong>${escapeHtml(engineer.name)}</strong>
        <span>${escapeHtml(engineer.discipline)}</span>
        <small>${escapeHtml(skillText)}</small>
      </div>
      <div class="vorta-fault-engineer-score">
        ${engineer.onShift ? '<b>On shift</b>' : '<i>Not confirmed on shift</i>'}
        <span>${escapeHtml(rating)}</span>
        ${engineer.equipmentMatch > 0 ? `<small>${engineer.equipmentMatch}% asset match</small>` : ""}
      </div>
    </div>`;
}

function documentHtml(document: DocumentMatch): string {
  const href = safeUrl(document.url);
  const opening = href
    ? `<a class="vorta-fault-document" href="${escapeHtml(href)}"${href.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : ""}>`
    : '<div class="vorta-fault-document">';
  const closing = href ? "</a>" : "</div>";
  return `${opening}
      <span>
        <strong>${escapeHtml(document.title)}</strong>
        <small>${escapeHtml(document.equipment.name)} · ${escapeHtml(document.sourceSystem)}</small>
        ${document.detail ? `<small>${escapeHtml(document.detail)}</small>` : ""}
        <p>${escapeHtml(document.excerpt)}</p>
      </span>
      <b>${href ? "Open" : "Indexed"}</b>
    ${closing}`;
}

function buildDirectAnswer(result: FaultIntelligenceResult): string {
  const topHistory = result.history[0];
  const onShift = result.engineers.filter((engineer) => engineer.onShift);

  if (!topHistory) {
    return `No recent history record directly matched “${result.question}” across the ${result.searchedAssetCount} assets checked. Vorta did find ${result.documents.length} potentially relevant document source${result.documents.length === 1 ? "" : "s"} and ${onShift.length} suitably rated engineer${onShift.length === 1 ? "" : "s"} confirmed for ${result.shiftLabel}.`;
  }

  return `Vorta found ${result.history.length} recent matching history record${result.history.length === 1 ? "" : "s"}. The strongest match is ${topHistory.equipment.name}, ${topHistory.activity.woNumber}: ${topHistory.activity.description}. Its recorded outcome is ${topHistory.activity.outcome}. ${onShift.length > 0 ? `${onShift[0].name} is the highest-ranked relevant engineer confirmed on ${result.shiftLabel}.` : `No relevant engineer is positively confirmed on ${result.shiftLabel}; check live attendance before assigning the work.`}`;
}

function buildRecommendedActions(result: FaultIntelligenceResult): string[] {
  const actions: string[] = [];
  const topHistory = result.history[0];
  const topEngineer = result.engineers.find((engineer) => engineer.onShift) ?? result.engineers[0];
  const topDocument = result.documents[0];

  if (topHistory) {
    actions.push(
      `Review ${topHistory.activity.woNumber} and the linked ${topHistory.equipment.name} history before repeating previous corrective work.`,
    );
  }
  if (topDocument) {
    actions.push(`Open ${topDocument.title}${topDocument.detail ? ` (${topDocument.detail})` : ""} and confirm the approved diagnostic sequence.`);
  }
  if (topEngineer) {
    actions.push(
      `${topEngineer.onShift ? "Assign" : "Confirm availability with"} ${topEngineer.name}, then use the next-ranked engineer as backup or escalation.`,
    );
  }
  actions.push("Capture the exact alarm text, sensor tag, machine state and whether the fault is intermittent before intervention.");
  return actions.slice(0, 4);
}

function resultHtml(result: FaultIntelligenceResult): string {
  const actions = buildRecommendedActions(result);
  const onShiftCount = result.engineers.filter((engineer) => engineer.onShift).length;

  return `
    <div ${RESULT_ATTR}="true" class="vorta-fault-intelligence">
      <div class="vorta-fault-badges">
        <span>Fault history &amp; skills response</span>
        <span>${result.confidence}% confidence</span>
      </div>

      <section>
        <h4>Answer</h4>
        <p class="vorta-fault-answer">${escapeHtml(buildDirectAnswer(result))}</p>
      </section>

      <section>
        <h4>Recent matching history</h4>
        ${
          result.history.length
            ? result.history.slice(0, 5).map(historyHtml).join("")
            : '<p class="vorta-fault-empty">No directly matching work-order description was found. The response below is based on linked documentation and skills data rather than invented history.</p>'
        }
      </section>

      <section>
        <div class="vorta-fault-heading-row">
          <h4>Recommended engineers</h4>
          <span>${onShiftCount} confirmed on ${escapeHtml(result.shiftLabel)}</span>
        </div>
        ${
          result.engineers.length
            ? result.engineers.slice(0, 5).map(engineerHtml).join("")
            : '<p class="vorta-fault-empty">No relevant engineer rating data was returned. Confirm the live skills matrix and shift roster.</p>'
        }
        <a class="vorta-fault-secondary-link" href="/engineers">Open engineers and skills →</a>
      </section>

      <section>
        <h4>Corresponding documentation</h4>
        ${
          result.documents.length
            ? result.documents.slice(0, 5).map(documentHtml).join("")
            : '<p class="vorta-fault-empty">No linked manual, drawing or procedure section matched these fault terms.</p>'
        }
      </section>

      <section>
        <h4>Recommended action</h4>
        <ul>${actions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul>
      </section>

      <section class="vorta-fault-followups">
        <h4>Ask next</h4>
        <div>
          <button type="button" data-vorta-fault-followup="Show only unresolved sensor fault history and repeat failures">Unresolved history</button>
          <button type="button" data-vorta-fault-followup="Which engineer on today's shift should attend this sensor fault first, and why?">Best on-shift engineer</button>
          <button type="button" data-vorta-fault-followup="Which manual page or electrical drawing should be opened first for this sensor fault?">Best document</button>
        </div>
      </section>
    </div>`;
}

function installStyles(): void {
  if (document.getElementById("vorta-fault-intelligence-styles")) return;
  const style = document.createElement("style");
  style.id = "vorta-fault-intelligence-styles";
  style.textContent = `
    .vorta-fault-intelligence { display:flex; flex-direction:column; gap:14px; color:#cbd5e1; }
    .vorta-fault-intelligence section { display:flex; flex-direction:column; gap:8px; }
    .vorta-fault-intelligence h4 { margin:0; color:#64748b; font-size:10px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; }
    .vorta-fault-answer { margin:0; color:#e2e8f0; font-size:13px; line-height:1.65; }
    .vorta-fault-badges { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .vorta-fault-badges span { border-radius:4px; background:rgba(59,130,246,.13); padding:3px 6px; color:#93c5fd; font-size:9px; font-weight:700; }
    .vorta-fault-row, .vorta-fault-document { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; border:1px solid #273244; border-radius:9px; background:#0d131b; padding:10px; color:inherit; text-decoration:none; transition:border-color .16s ease, background .16s ease; }
    .vorta-fault-row:hover, .vorta-fault-document:hover { border-color:rgba(59,130,246,.48); background:rgba(37,99,235,.07); }
    .vorta-fault-row-main, .vorta-fault-document > span { display:flex; min-width:0; flex:1; flex-direction:column; gap:3px; }
    .vorta-fault-row strong, .vorta-fault-document strong, .vorta-fault-engineer strong { color:#e2e8f0; font-size:11px; }
    .vorta-fault-row span, .vorta-fault-document small, .vorta-fault-engineer span, .vorta-fault-engineer small { color:#64748b; font-size:9.5px; line-height:1.45; }
    .vorta-fault-row-main span:last-child { color:#94a3b8; font-size:10px; }
    .vorta-fault-row-meta { display:flex; flex-shrink:0; flex-direction:column; align-items:flex-end; gap:4px; }
    .vorta-fault-row-meta em { border-radius:4px; background:rgba(249,115,22,.12); padding:2px 5px; color:#fdba74; font-size:8px; font-style:normal; font-weight:700; }
    .vorta-fault-engineer { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; border-bottom:1px solid #1f2937; padding:8px 0; }
    .vorta-fault-engineer > div:first-child { display:flex; min-width:0; flex:1; flex-direction:column; gap:2px; }
    .vorta-fault-engineer-score { display:flex; flex-shrink:0; flex-direction:column; align-items:flex-end; gap:2px; }
    .vorta-fault-engineer-score b { border-radius:999px; background:rgba(16,185,129,.12); padding:2px 6px; color:#6ee7b7; font-size:8px; }
    .vorta-fault-engineer-score i { color:#64748b; font-size:8px; font-style:normal; }
    .vorta-fault-document p { margin:2px 0 0; color:#94a3b8; font-size:10px; line-height:1.45; }
    .vorta-fault-document > b { color:#60a5fa; font-size:9px; }
    .vorta-fault-intelligence ul { display:flex; flex-direction:column; gap:5px; margin:0; padding:0; list-style:none; }
    .vorta-fault-intelligence li { position:relative; padding-left:12px; color:#cbd5e1; font-size:10px; line-height:1.55; }
    .vorta-fault-intelligence li::before { content:""; position:absolute; left:0; top:.55em; width:4px; height:4px; border-radius:50%; background:#34d399; }
    .vorta-fault-empty { margin:0; border:1px solid rgba(245,158,11,.18); border-radius:8px; background:rgba(245,158,11,.06); padding:9px; color:#c4a76b; font-size:10px; line-height:1.5; }
    .vorta-fault-heading-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .vorta-fault-heading-row > span { color:#64748b; font-size:9px; }
    .vorta-fault-secondary-link { width:fit-content; color:#60a5fa; font-size:10px; font-weight:600; text-decoration:none; }
    .vorta-fault-followups > div { display:flex; flex-wrap:wrap; gap:6px; }
    .vorta-fault-followups button { border:1px solid #334155; border-radius:999px; background:#0d131b; padding:5px 8px; color:#94a3b8; font-size:9px; font-weight:600; }
    .vorta-fault-followups button:hover { border-color:rgba(59,130,246,.5); color:#bfdbfe; }
  `;
  document.head.appendChild(style);
}

function findTargetAssistant(question: string): HTMLElement | null {
  const closeButton = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Close global assistant"]',
  );
  const panel = closeButton?.closest<HTMLElement>("div.fixed");
  const messages =
    panel?.querySelector<HTMLElement>('[data-vorta-ai-panel-messages="true"]') ??
    Array.from(panel?.children ?? []).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.className.includes("overflow-y-auto"),
    );
  if (!messages) return null;

  const children = Array.from(messages.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  const normalisedQuestion = normalise(question);
  let userIndex = -1;

  children.forEach((child, index) => {
    const isUser =
      child.dataset.vortaAiMessage === "user" || child.className.includes("justify-end");
    if (isUser && normalise(child.textContent ?? "") === normalisedQuestion) userIndex = index;
  });

  if (userIndex < 0) return null;

  for (let index = userIndex + 1; index < children.length; index += 1) {
    const child = children[index];
    const isAssistant =
      child.dataset.vortaAiMessage === "assistant" || child.className.includes("justify-start");
    if (isAssistant) return child;
  }

  return null;
}

function applyResult(result: FaultIntelligenceResult): boolean {
  const assistantMessage = findTargetAssistant(result.question);
  const bubble = assistantMessage?.firstElementChild;
  if (!(bubble instanceof HTMLElement)) return false;

  const existing = bubble.querySelector<HTMLElement>(`[${RESULT_ATTR}="true"]`);
  if (existing) return true;

  bubble.className = "w-full max-w-full rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-3 text-slate-200";
  bubble.innerHTML = resultHtml(result);
  assistantMessage?.setAttribute("data-vorta-fault-answer", "true");
  return true;
}

function scheduleRender(): void {
  if (renderScheduled) return;
  renderScheduled = true;
  window.requestAnimationFrame(() => {
    renderScheduled = false;
    resultsByQuestion.forEach((result) => applyResult(result));
  });
}

function submitFollowUp(question: string): void {
  window.dispatchEvent(
    new CustomEvent("vorta-global-ai-prompt", {
      detail: { question, submit: true, role: "maintenance-manager" },
    }),
  );
}

function installFaultIntelligence(): void {
  const root = document.documentElement;
  if (root.dataset[INSTALL_MARKER] === "true") return;
  root.dataset[INSTALL_MARKER] = "true";
  installStyles();

  window.addEventListener("vorta-global-ai-prompt", (event) => {
    const detail = (event as CustomEvent<{ question?: string; submit?: boolean }>).detail;
    const question = detail?.question?.trim() ?? "";
    if (!detail?.submit || !question || !isFaultQuestion(question)) return;

    const key = normalise(question);
    if (resultsByQuestion.has(key) || pendingQuestions.has(key)) return;
    pendingQuestions.add(key);

    void buildFaultIntelligence(question)
      .then((result) => {
        resultsByQuestion.set(key, result);
      })
      .catch((error) => {
        console.warn("Vorta fault intelligence failed:", error);
      })
      .finally(() => {
        pendingQuestions.delete(key);
        scheduleRender();
      });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const followUp = target.closest<HTMLButtonElement>("[data-vorta-fault-followup]");
    if (!followUp) return;
    event.preventDefault();
    submitFollowUp(followUp.dataset.vortaFaultFollowup ?? "");
  });

  const observer = new MutationObserver(scheduleRender);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  scheduleRender();
}

installFaultIntelligence();
