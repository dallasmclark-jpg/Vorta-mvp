import { supabase } from "../../lib/supabaseClient";
import {
  getEquipmentList,
  searchEquipmentKnowledge,
  type EquipmentKnowledgeChunk,
  type EquipmentListItem,
} from "../Equipment/equipmentService";

export interface FaultHistoryRecord {
  id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentCode: string;
  workOrderNumber: string;
  description: string;
  faultCode: string | null;
  workType: string;
  priority: string;
  status: string;
  outcome: string | null;
  assignedEngineer: string | null;
  date: string;
  unresolved: boolean;
  matchedTerms: string[];
  score: number;
}

export type EngineerShiftState = "confirmed" | "scheduled" | "available";

export interface FaultEngineerRecommendation {
  id: string;
  name: string;
  discipline: string;
  availabilityStatus: string;
  shiftPattern: string;
  shiftState: EngineerShiftState;
  rating: number;
  ratingSource: "validated" | "manager" | "self";
  primarySkill: string;
  relevantSkills: string[];
  yearsExperience: number;
  assetMatchPercent: number;
  matchingHistoryCount: number;
  score: number;
}

export interface FaultIntelligenceResult {
  question: string;
  matchedTerms: string[];
  primaryEquipment: EquipmentListItem | null;
  history: FaultHistoryRecord[];
  documents: EquipmentKnowledgeChunk[];
  engineers: FaultEngineerRecommendation[];
  shiftLabel: string;
  shiftWindow: string;
  shiftBasis: string;
  searchedAssetCount: number;
  sourceErrors: string[];
  confidence: number;
}

interface WorkOrderRow {
  id: string;
  equipment_id: string | null;
  wo_number: string | null;
  description: string | null;
  fault_code: string | null;
  work_type: string | null;
  priority: string | null;
  status: string | null;
  outcome: string | null;
  assigned_engineer: string | null;
  requested_date: string | null;
  completed_date: string | null;
}

interface EquipmentRequiredSkillRow { skill_id: string; required_level: number | null }
interface SkillRow { id: string; name: string; category: string | null }
interface EngineerSkillRow {
  engineer_id: string;
  skill_id: string;
  validated_rating: number | null;
  manager_rating: number | null;
  self_rating: number | null;
  years_experience: number | null;
  last_used_date: string | null;
  training_required: boolean | null;
}
interface EngineerRow {
  id: string;
  full_name: string;
  discipline: string | null;
  shift_pattern: string | null;
  availability_status: string | null;
}

const GENERIC_FAULT_TERMS = [
  "fault", "failure", "failed", "alarm", "trip", "error", "intermittent",
  "issue", "problem", "breakdown", "not working", "stopped",
];

const COMPONENT_EXPANSIONS: Record<string, string[]> = {
  sensor: [
    "sensor", "proximity", "photoeye", "photo eye", "photoelectric", "photocell",
    "encoder", "detector", "transducer", "switch", "feedback", "position",
    "reject confirmation", "false reject", "probe", "transmitter", "level",
    "pressure", "temperature", "flow", "vision",
  ],
  plc: ["plc", "controller", "logic", "communication", "comms", "i/o", "io module"],
  motor: ["motor", "drive", "overload", "winding", "bearing", "vibration"],
  valve: ["valve", "actuator", "cylinder", "solenoid", "pneumatic", "air pressure"],
  servo: ["servo", "axis", "drive", "encoder", "position feedback"],
  interlock: ["interlock", "guard", "door switch", "safety circuit"],
  calibration: ["calibration", "drift", "tolerance", "adjustment", "out of tolerance"],
};

const SKILL_EXPANSIONS: Record<string, string[]> = {
  sensor: ["instrument", "instrumentation", "calibration", "vision", "automation", "plc", "electrical", "control", "fault finding", "diagnostic"],
  plc: ["plc", "automation", "control", "electrical", "fault finding"],
  motor: ["motor", "electrical", "mechanical", "drive", "fault finding"],
  valve: ["pneumatic", "mechanical", "instrument", "process control"],
  servo: ["servo", "automation", "plc", "electrical", "motion control"],
  interlock: ["safety", "electrical", "plc", "automation"],
  calibration: ["calibration", "instrument", "metrology"],
};

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "to", "for", "of", "in", "on", "at", "is",
  "are", "was", "were", "with", "from", "this", "that", "what", "which", "who",
  "how", "show", "find", "look", "recent", "history", "issue", "issues", "fault",
  "faults", "failure", "problem", "problems",
]);

function normalise(value: string): string {
  return value.toLowerCase().replace(/[\s_/-]+/g, " ").trim();
}

function unique<T>(items: T[]): T[] { return [...new Set(items)]; }

export function isFaultQuestion(question: string): boolean {
  const value = normalise(question);
  return GENERIC_FAULT_TERMS.some((term) => value.includes(term)) ||
    Object.entries(COMPONENT_EXPANSIONS).some(([key, terms]) =>
      value.includes(key) || terms.some((term) => value.includes(term)),
    );
}

function buildFaultTerms(question: string): string[] {
  const value = normalise(question);
  const expanded = value.split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  Object.entries(COMPONENT_EXPANSIONS).forEach(([key, terms]) => {
    if (value.includes(key) || terms.some((term) => value.includes(term))) expanded.push(key, ...terms);
  });
  if (expanded.length === 0) expanded.push("fault", "alarm", "failure", "trip");
  return unique(expanded.map(normalise).filter(Boolean));
}

function buildSkillTerms(question: string, faultTerms: string[]): string[] {
  const value = normalise(question);
  const terms = [...faultTerms];
  Object.entries(SKILL_EXPANSIONS).forEach(([key, values]) => {
    if (value.includes(key) || COMPONENT_EXPANSIONS[key]?.some((term) => value.includes(term))) terms.push(...values);
  });
  return unique(terms.map(normalise).filter((term) => term.length > 2));
}

function equipmentMentionScore(question: string, equipment: EquipmentListItem): number {
  const value = normalise(question);
  const name = normalise(equipment.name);
  const code = normalise(equipment.assetNumber ?? "");
  const type = normalise(equipment.type ?? "");
  let score = 0;
  if (code && value.includes(code)) score += 100;
  if (name && value.includes(name)) score += 80;
  name.split(" ").filter((part) => part.length > 3).forEach((part) => { if (value.includes(part)) score += 12; });
  type.split(" ").filter((part) => part.length > 4).forEach((part) => { if (value.includes(part)) score += 5; });
  return score;
}

function priorityScore(priority: string): number {
  const value = normalise(priority);
  if (value.includes("critical")) return 8;
  if (value.includes("high")) return 5;
  if (value.includes("medium")) return 3;
  return 1;
}

function isUnresolved(status: string, outcome: string | null): boolean {
  return !/completed|closed|cancelled|resolved|success|passed/.test(normalise(`${status} ${outcome ?? ""}`));
}

function parseDate(value: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

export function formatStatus(value: string): string {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getCurrentShiftInfo(now = new Date()): { shiftLabel: string; shiftWindow: string; isDayShift: boolean } {
  const isDayShift = now.getHours() >= 6 && now.getHours() < 18;
  return {
    shiftLabel: isDayShift ? "Day shift" : "Night shift",
    shiftWindow: isDayShift ? "06:00-18:00" : "18:00-06:00",
    isDayShift,
  };
}

function isConfirmedOnShift(status: string | null): boolean {
  const value = normalise(status ?? "");
  return value === "on shift" || value.includes("on site") || value.includes("onsite") || value.includes("active shift");
}

function isUnavailable(status: string | null): boolean {
  return /unavailable|off shift|leave|sick|away/.test(normalise(status ?? ""));
}

function isAvailable(status: string | null): boolean {
  const value = normalise(status ?? "");
  return !isUnavailable(status) && (value.includes("available") || isConfirmedOnShift(status));
}

function matchesShiftPattern(shiftPattern: string | null, isDayShift: boolean): boolean {
  const value = normalise(shiftPattern ?? "");
  if (!value) return false;
  if (isDayShift && (value.includes("day") || value.includes("days"))) return true;
  if (!isDayShift && (value.includes("night") || value.includes("nights"))) return true;
  return false;
}

function bestRating(assignment: EngineerSkillRow): { rating: number; source: "validated" | "manager" | "self" } {
  if (assignment.validated_rating != null) return { rating: assignment.validated_rating, source: "validated" };
  if (assignment.manager_rating != null) return { rating: assignment.manager_rating, source: "manager" };
  return { rating: assignment.self_rating ?? 0, source: "self" };
}

function ratingSourceScore(source: "validated" | "manager" | "self"): number {
  return source === "validated" ? 12 : source === "manager" ? 6 : 0;
}

async function fetchHistory(assets: EquipmentListItem[], terms: string[]): Promise<{ records: FaultHistoryRecord[]; errors: string[] }> {
  if (assets.length === 0) return { records: [], errors: ["No equipment record matched the question."] };
  const equipmentById = new Map(assets.map((asset) => [asset.id, asset]));
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - 1);
  const { data, error } = await supabase
    .from("work_orders")
    .select("id, equipment_id, wo_number, description, fault_code, work_type, priority, status, outcome, assigned_engineer, requested_date, completed_date")
    .in("equipment_id", assets.map((asset) => asset.id))
    .gte("requested_date", fromDate.toISOString().slice(0, 10))
    .order("requested_date", { ascending: false })
    .limit(250);
  if (error) return { records: [], errors: [`Work-order history could not be loaded: ${error.message}`] };

  const records = ((data ?? []) as WorkOrderRow[])
    .map((row): FaultHistoryRecord | null => {
      const equipment = row.equipment_id ? equipmentById.get(row.equipment_id) : undefined;
      if (!equipment) return null;
      const description = row.description ?? "";
      const searchable = normalise([description, row.fault_code ?? "", row.work_type ?? "", row.status ?? "", row.outcome ?? ""].join(" "));
      const matchedTerms = terms.filter((term) => searchable.includes(term));
      if (matchedTerms.length === 0) return null;
      const directMatches = matchedTerms.filter((term) => normalise(description).includes(term)).length;
      const unresolved = isUnresolved(row.status ?? "", row.outcome);
      const date = row.completed_date ?? row.requested_date ?? "";
      const recencyDays = date ? Math.max(0, Math.round((Date.now() - parseDate(date)) / 86_400_000)) : 365;
      const score = matchedTerms.length * 5 + directMatches * 4 + priorityScore(row.priority ?? "") + (unresolved ? 7 : 1) + Math.max(0, 8 - Math.floor(recencyDays / 30)) + Math.round(equipment.riskScore / 20);
      return {
        id: row.id,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        equipmentCode: equipment.assetNumber,
        workOrderNumber: row.wo_number ?? row.id,
        description,
        faultCode: row.fault_code,
        workType: row.work_type ?? "Maintenance",
        priority: row.priority ?? "Unknown",
        status: row.status ?? "Unknown",
        outcome: row.outcome,
        assignedEngineer: row.assigned_engineer,
        date,
        unresolved,
        matchedTerms,
        score,
      };
    })
    .filter((record): record is FaultHistoryRecord => Boolean(record))
    .sort((left, right) => right.score - left.score || Number(right.unresolved) - Number(left.unresolved) || parseDate(right.date) - parseDate(left.date))
    .slice(0, 10);
  return { records, errors: [] };
}

function choosePrimaryEquipment(scopedAssets: EquipmentListItem[], history: FaultHistoryRecord[]): EquipmentListItem | null {
  if (scopedAssets.length === 0) return null;
  const historyScore = new Map<string, number>();
  history.forEach((record) => historyScore.set(record.equipmentId, (historyScore.get(record.equipmentId) ?? 0) + record.score));
  return [...scopedAssets].sort((left, right) => (historyScore.get(right.id) ?? 0) - (historyScore.get(left.id) ?? 0) || right.riskScore - left.riskScore)[0];
}

async function fetchEngineerRecommendations(
  equipment: EquipmentListItem | null,
  question: string,
  faultTerms: string[],
  history: FaultHistoryRecord[],
): Promise<{ engineers: FaultEngineerRecommendation[]; shiftLabel: string; shiftWindow: string; shiftBasis: string; errors: string[] }> {
  const { shiftLabel, shiftWindow, isDayShift } = getCurrentShiftInfo();
  if (!equipment) return { engineers: [], shiftLabel, shiftWindow, shiftBasis: "No equipment scope was available.", errors: ["Engineer matching was skipped because no equipment record matched."] };

  const [requiredResult, skillsResult] = await Promise.all([
    supabase.from("equipment_required_skills").select("skill_id, required_level").eq("equipment_id", equipment.id),
    supabase.from("skills").select("id, name, category"),
  ]);
  const errors: string[] = [];
  if (requiredResult.error) errors.push(`Equipment-required skills could not be loaded: ${requiredResult.error.message}`);
  if (skillsResult.error) errors.push(`Skills could not be loaded: ${skillsResult.error.message}`);

  const requiredRows = (requiredResult.data ?? []) as EquipmentRequiredSkillRow[];
  const skillRows = (skillsResult.data ?? []) as SkillRow[];
  const requiredSkillIds = new Set(requiredRows.map((row) => row.skill_id));
  const skillTerms = buildSkillTerms(question, faultTerms);
  const relevantSkills = skillRows.filter((skill) => requiredSkillIds.has(skill.id) || skillTerms.some((term) => normalise(`${skill.name} ${skill.category ?? ""}`).includes(term)));
  if (relevantSkills.length === 0) return { engineers: [], shiftLabel, shiftWindow, shiftBasis: "No relevant skill records matched the fault terms.", errors };

  const skillById = new Map(relevantSkills.map((skill) => [skill.id, skill]));
  const assignmentResult = await supabase
    .from("engineer_skills")
    .select("engineer_id, skill_id, validated_rating, manager_rating, self_rating, years_experience, last_used_date, training_required")
    .in("skill_id", relevantSkills.map((skill) => skill.id));
  if (assignmentResult.error) return { engineers: [], shiftLabel, shiftWindow, shiftBasis: "Engineer skill ratings were unavailable.", errors: [...errors, `Engineer skill ratings could not be loaded: ${assignmentResult.error.message}`] };

  const assignments = (assignmentResult.data ?? []) as EngineerSkillRow[];
  const engineerIds = unique(assignments.map((assignment) => assignment.engineer_id));
  if (engineerIds.length === 0) return { engineers: [], shiftLabel, shiftWindow, shiftBasis: "No engineer ratings were found for the relevant skills.", errors };

  const engineerResult = await supabase
    .from("engineers")
    .select("id, full_name, discipline, shift_pattern, availability_status")
    .in("id", engineerIds);
  if (engineerResult.error) return { engineers: [], shiftLabel, shiftWindow, shiftBasis: "Engineer availability was unavailable.", errors: [...errors, `Engineer availability could not be loaded: ${engineerResult.error.message}`] };

  const historyCountByEngineer = new Map<string, number>();
  history.forEach((record) => {
    if (!record.assignedEngineer) return;
    const key = normalise(record.assignedEngineer);
    historyCountByEngineer.set(key, (historyCountByEngineer.get(key) ?? 0) + 1);
  });
  const assignmentsByEngineer = new Map<string, EngineerSkillRow[]>();
  assignments.forEach((assignment) => {
    const current = assignmentsByEngineer.get(assignment.engineer_id) ?? [];
    current.push(assignment);
    assignmentsByEngineer.set(assignment.engineer_id, current);
  });

  const engineers = ((engineerResult.data ?? []) as EngineerRow[])
    .map((engineer): FaultEngineerRecommendation | null => {
      const engineerAssignments = assignmentsByEngineer.get(engineer.id) ?? [];
      const rated = engineerAssignments
        .map((assignment) => ({ assignment, skill: skillById.get(assignment.skill_id), ...bestRating(assignment) }))
        .filter((item) => Boolean(item.skill) && item.rating > 0)
        .sort((left, right) => right.rating - left.rating || ratingSourceScore(right.source) - ratingSourceScore(left.source) || Number(requiredSkillIds.has(right.assignment.skill_id)) - Number(requiredSkillIds.has(left.assignment.skill_id)));
      const top = rated[0];
      if (!top?.skill) return null;
      const confirmed = isConfirmedOnShift(engineer.availability_status);
      const scheduled = !confirmed && !isUnavailable(engineer.availability_status) && matchesShiftPattern(engineer.shift_pattern, isDayShift);
      const available = isAvailable(engineer.availability_status);
      if (!confirmed && !scheduled && !available) return null;
      const shiftState: EngineerShiftState = confirmed ? "confirmed" : scheduled ? "scheduled" : "available";
      const coveredRequiredSkills = requiredRows.filter((required) => {
        const assignment = engineerAssignments.find((item) => item.skill_id === required.skill_id);
        return assignment ? bestRating(assignment).rating >= (required.required_level ?? 1) : false;
      }).length;
      const assetMatchPercent = requiredRows.length > 0 ? Math.round((coveredRequiredSkills / requiredRows.length) * 100) : 0;
      const matchingHistoryCount = historyCountByEngineer.get(normalise(engineer.full_name)) ?? 0;
      const yearsExperience = Math.max(0, ...rated.map((item) => Number(item.assignment.years_experience ?? 0)));
      const shiftScore = shiftState === "confirmed" ? 100 : shiftState === "scheduled" ? 45 : 15;
      const score = shiftScore + top.rating * 20 + ratingSourceScore(top.source) + assetMatchPercent / 4 + matchingHistoryCount * 18 + Math.min(yearsExperience, 15);
      return {
        id: engineer.id,
        name: engineer.full_name,
        discipline: engineer.discipline ?? "Maintenance engineering",
        availabilityStatus: engineer.availability_status ?? "Unknown",
        shiftPattern: engineer.shift_pattern ?? "Not recorded",
        shiftState,
        rating: top.rating,
        ratingSource: top.source,
        primarySkill: top.skill.name,
        relevantSkills: unique(rated.slice(0, 4).map((item) => item.skill?.name ?? "").filter(Boolean)),
        yearsExperience,
        assetMatchPercent,
        matchingHistoryCount,
        score,
      };
    })
    .filter((engineer): engineer is FaultEngineerRecommendation => Boolean(engineer))
    .sort((left, right) => right.score - left.score || right.rating - left.rating || right.assetMatchPercent - left.assetMatchPercent)
    .slice(0, 6);

  const confirmedCount = engineers.filter((engineer) => engineer.shiftState === "confirmed").length;
  const scheduledCount = engineers.filter((engineer) => engineer.shiftState === "scheduled").length;
  const shiftBasis = confirmedCount > 0
    ? `${confirmedCount} engineer${confirmedCount === 1 ? " is" : "s are"} confirmed on shift from live availability status.`
    : scheduledCount > 0
      ? `No engineer is confirmed on shift; ${scheduledCount} match the current ${shiftLabel.toLowerCase()} from recorded shift patterns.`
      : "No relevant engineer is confirmed or scheduled for the current shift; only general availability records are shown.";
  return { engineers, shiftLabel, shiftWindow, shiftBasis, errors };
}

export async function buildFaultIntelligence(question: string): Promise<FaultIntelligenceResult> {
  const equipment = await getEquipmentList();
  if (equipment.length === 0) throw new Error("The live equipment list could not be loaded. No fault answer was generated.");
  const terms = buildFaultTerms(question);
  const scoredEquipment = equipment
    .map((asset) => ({ asset, mentionScore: equipmentMentionScore(question, asset) }))
    .sort((left, right) => right.mentionScore - left.mentionScore || right.asset.riskScore - left.asset.riskScore);
  const mentionedAssets = scoredEquipment.filter((item) => item.mentionScore > 0).slice(0, 4).map((item) => item.asset);
  const scopedAssets = mentionedAssets.length > 0 ? mentionedAssets : [...equipment].sort((left, right) => right.riskScore - left.riskScore).slice(0, 12);
  const historyResult = await fetchHistory(scopedAssets, terms);
  const primaryEquipment = choosePrimaryEquipment(scopedAssets, historyResult.records);
  const [documents, engineerResult] = await Promise.all([
    primaryEquipment ? searchEquipmentKnowledge(primaryEquipment.id, `${question} ${terms.slice(0, 14).join(" ")}`, 6) : Promise.resolve([]),
    fetchEngineerRecommendations(primaryEquipment, question, terms, historyResult.records),
  ]);
  const sourceErrors = unique([...historyResult.errors, ...engineerResult.errors]);
  const sourceSignals = [
    historyResult.records.length > 0,
    documents.length > 0,
    engineerResult.engineers.length > 0,
    engineerResult.engineers.some((engineer) => engineer.shiftState === "confirmed"),
    Boolean(primaryEquipment),
  ].filter(Boolean).length;
  return {
    question,
    matchedTerms: terms,
    primaryEquipment,
    history: historyResult.records,
    documents,
    engineers: engineerResult.engineers,
    shiftLabel: engineerResult.shiftLabel,
    shiftWindow: engineerResult.shiftWindow,
    shiftBasis: engineerResult.shiftBasis,
    searchedAssetCount: scopedAssets.length,
    sourceErrors,
    confidence: Math.min(94, 50 + sourceSignals * 9),
  };
}

export function buildDirectAnswer(result: FaultIntelligenceResult): string {
  const equipment = result.primaryEquipment;
  const unresolved = result.history.filter((record) => record.unresolved);
  const topRecord = unresolved[0] ?? result.history[0];
  const confirmedEngineer = result.engineers.find((engineer) => engineer.shiftState === "confirmed");
  if (!equipment) return `No equipment record matched “${result.question}”. Vorta did not infer an asset or fault history.`;
  if (result.history.length === 0) {
    return `No work-order record in the last 12 months matched the fault terms for ${equipment.name} (${equipment.assetNumber}). Vorta found ${result.documents.length} indexed source section${result.documents.length === 1 ? "" : "s"} and ${result.engineers.length} relevant engineer rating${result.engineers.length === 1 ? "" : "s"}, but it is not claiming that this fault has happened before.`;
  }
  const repeatStatement = result.history.length > 1
    ? "Multiple matching records exist, so Vorta flags a repeat pattern in the recorded history."
    : "Only one matching record was found, so Vorta does not label it as a repeat pattern.";
  const engineerStatement = confirmedEngineer
    ? `${confirmedEngineer.name} is the highest-ranked relevant engineer confirmed on ${result.shiftLabel.toLowerCase()}, with a ${confirmedEngineer.rating}/5 ${confirmedEngineer.ratingSource} rating in ${confirmedEngineer.primarySkill}.`
    : `No relevant engineer is positively confirmed on ${result.shiftLabel.toLowerCase()}; recorded shift patterns and availability still require attendance confirmation.`;
  return `Vorta found ${result.history.length} real work-order record${result.history.length === 1 ? "" : "s"} matching this fault on ${equipment.name} (${equipment.assetNumber}). ${unresolved.length} ${unresolved.length === 1 ? "is" : "are"} still open, in progress or waiting for completion. The highest-priority current record is ${topRecord.workOrderNumber}: ${topRecord.description} (${formatStatus(topRecord.status)}). ${repeatStatement} ${engineerStatement} No cause has been inferred beyond the recorded work-order descriptions and indexed source text.`;
}

export function buildRecommendedActions(result: FaultIntelligenceResult): string[] {
  const actions: string[] = [];
  const unresolved = result.history.find((record) => record.unresolved);
  const document = result.documents[0];
  const bestEngineer = result.engineers.find((engineer) => engineer.shiftState === "confirmed") ?? result.engineers[0];
  if (unresolved) actions.push(`Review ${unresolved.workOrderNumber} (${formatStatus(unresolved.status)}) in ${unresolved.equipmentName} history before creating or repeating corrective work.`);
  if (document) {
    const location = [
      document.pageNumber != null ? `page ${document.pageNumber}` : "",
      document.sectionTitle ?? "",
      document.drawingNumber ? `drawing ${document.drawingNumber}` : "",
      document.sheetNumber ? `sheet ${document.sheetNumber}` : "",
    ].filter(Boolean).join(", ");
    actions.push(`Use ${document.title}${location ? `, ${location}` : ""} as the approved source for the next check.`);
  }
  if (bestEngineer) {
    actions.push(bestEngineer.shiftState === "confirmed"
      ? `Contact ${bestEngineer.name}, confirmed on ${result.shiftLabel.toLowerCase()}, with ${bestEngineer.rating}/5 ${bestEngineer.ratingSource} rating in ${bestEngineer.primarySkill}.`
      : `Confirm attendance with ${bestEngineer.name} before assignment; the record shows ${bestEngineer.rating}/5 ${bestEngineer.ratingSource} rating in ${bestEngineer.primarySkill}, but not a live on-shift confirmation.`);
  }
  if (result.history.length === 0 && result.documents.length === 0) actions.push("Capture the exact alarm, equipment code and component tag, then search again. Vorta will not invent a diagnosis without matching records or source documents.");
  return actions.slice(0, 4);
}
