import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ClipboardPlus,
  ExternalLink,
  ImagePlus,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabaseClient";
import {
  getAreaRiskProfiles,
  getEquipmentComponents,
  getEquipmentList,
  getSiteRiskProfile,
  searchEquipmentKnowledge,
  type AreaRiskProfile,
  type EquipmentComponent,
  type EquipmentKnowledgeChunk,
  type EquipmentListItem,
  type SiteRiskProfile,
} from "../Equipment/equipmentService";
import {
  getShiftCoverAiBrief,
  type ShiftCoverAiBrief,
  type ShiftCoverCalendarItem,
  type ShiftCoverException,
  type ShiftCoverSkillRisk,
} from "../LabourRisk/shiftCoverService";
import {
  askVortaAgent,
  AskVortaAgentError,
  markAskVortaFallback,
  submitAskVortaFeedback,
  type AskVortaFeedbackCategory,
  type VortaAgentAction,
  type VortaAgentCoverOption,
  type VortaAgentDecisionSummaryItem,
  type VortaAgentEvidenceLink,
  type VortaAgentFinding,
  type VortaAgentHistoryItem,
  type VortaConversationContext,
} from "./vortaAgentService";
import { openAskVortaActionReviewDialog } from "./askVortaActionReviewLauncher";
import {
  prepareAskVortaImage,
  type PreparedAskVortaImage,
} from "./askVortaImageClient";
import {
  AskVortaWorkspace,
  type AskVortaWorkspaceAnswer,
  type AskVortaWorkspaceMessage,
} from "./AskVortaWorkspace";

type ChatRole = "user" | "assistant";

interface VortaSpeechAlternative {
  transcript: string;
  confidence: number;
}

interface VortaSpeechResult {
  readonly length: number;
  readonly isFinal: boolean;
  readonly [index: number]:
    VortaSpeechAlternative;
}

interface VortaSpeechResultList {
  readonly length: number;
  readonly [index: number]:
    VortaSpeechResult;
}

interface VortaSpeechResultEvent {
  resultIndex: number;
  results: VortaSpeechResultList;
}

interface VortaSpeechErrorEvent {
  error: string;
  message?: string;
}

interface VortaSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult:
    | ((
        event:
          VortaSpeechResultEvent,
      ) => void)
    | null;
  onerror:
    | ((
        event:
          VortaSpeechErrorEvent,
      ) => void)
    | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type VortaSpeechRecognitionConstructor =
  new () => VortaSpeechRecognition;

type VortaSpeechWindow =
  Window & {
    SpeechRecognition?:
      VortaSpeechRecognitionConstructor;
    webkitSpeechRecognition?:
      VortaSpeechRecognitionConstructor;
  };

type VortaAiRole =
  | "maintenance-manager"
  | "planner"
  | "engineer"
  | "operator"
  | "production-manager"
  | "contractor";

type GlobalAiIntent =
  | "shift-cover"
  | "shift-skills-gap"
  | "daily-priority"
  | "site-risk"
  | "area-risk"
  | "equipment-risk"
  | "evidence"
  | "labour-risk"
  | "pm-risk"
  | "spares-risk"
  | "skills-risk"
  | "general";

interface RoleResponseProfile {
  role: VortaAiRole;
  label: string;
  subtitle: string;
  responseBadge: string;
  introAnswer: string;
  defaultAction: string;
  promptPlaceholder: string;
  contextLine: string;
  confidenceLabel: string;
  focusAreas: string[];
  quickQuestions: string[];
}

interface GlobalAiPromptEventDetail {
  question?: string;
  submit?: boolean;
  role?: VortaAiRole;
}

interface GlobalAiAnswer {
  responseId?: string;
  directAnswer: string;
  decisionSummary?: VortaAgentDecisionSummaryItem[];
  evidence: string[];
  findings?: VortaAgentFinding[];
  coverOptions?: VortaAgentCoverOption[];
  recommendedActions: string[];
  actionPlan?: VortaAgentAction[];
  followUpQuestions?: string[];
  sources: string[];
  confidence: number;
  roleLabel: string;
  responseBadge: string;
  intentLabel: string;
  roleNote?: string;
  knowledgeChunks?: EquipmentKnowledgeChunk[];
  missingData?: string[];
  evidenceLinks?: VortaAgentEvidenceLink[];
  evidenceGeneratedAt?: string;
  conversationContext?: VortaConversationContext;
}

interface GlobalAiMessage {
  id: string;
  role: ChatRole;
  text?: string;
  loading?: boolean;
  answer?: GlobalAiAnswer;
  error?: string;
  retryQuestion?: string;
  imageName?: string;
}

function conversationHistory(
  messages: GlobalAiMessage[],
  excludedMessageId?: string,
): VortaAgentHistoryItem[] {
  return messages
    .filter((message) => message.id !== excludedMessageId)
    .flatMap((message): VortaAgentHistoryItem[] => {
      if (message.role === "user" && message.text?.trim()) {
        return [{ role: "user", content: message.text.trim() }];
      }

      if (message.role === "assistant" && message.answer) {
        return [{
          role: "assistant",
          content: [
            message.answer.directAnswer,
            ...(message.answer.findings ?? []).slice(0, 3).map(
              (finding) => `${finding.title}: ${finding.detail}`,
            ),
            ...message.answer.evidence.slice(0, 4),
          ].join("\n"),
        }];
      }

      return [];
    })
    .slice(-8);
}

function latestConversationContext(
  messages: GlobalAiMessage[],
): VortaConversationContext | undefined {
  return [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" &&
        message.answer?.conversationContext,
    )?.answer?.conversationContext;
}

function agentRole(role: VortaAiRole): string {
  return role === "planner" ? "maintenance-planner" : role;
}

// ─── Shift skills types ───────────────────────────────────────────────────────

interface SkillsMatrixEngineer {
  id: string;
  full_name: string;
  discipline: string;
  shift_pattern: string;
  department_name?: string | null;
  skills_score?: number;
  risk_level?: string;
  training_count?: number;
  critical_knowledge_holder?: boolean;
}

interface SkillsMatrixSkill {
  id: string;
  name: string;
  category: string;
  is_critical: boolean;
}

interface SkillsMatrixAssignment {
  engineer_id: string;
  skill_id: string;
  validated_rating: number | null;
  manager_rating: number | null;
  self_rating: number | null;
  training_required: boolean;
  verification_status?: string;
}

interface SkillsMatrixGap {
  id: string;
  skill_name: string;
  skill_category: string;
  department_name: string | null;
  target_rating: number;
  current_average_rating: number;
  engineers_at_or_above_target: number;
  engineers_below_target: number;
  single_point_of_failure: boolean;
  risk_level: string;
  recommendation: string;
  snapshot_date: string;
}

interface EngineerAvailabilityRow {
  id: string;
  full_name: string;
  discipline: string | null;
  shift_pattern: string | null;
  availability_status: string | null;
}

interface ShiftSkillGap {
  skillName: string;
  category: string;
  riskLevel: "critical" | "high" | "medium";
  targetRating: number;
  competentCount: number;
  onShiftCount: number;
  competentEngineers: string[];
  belowTargetEngineers: string[];
  trainingRequiredEngineers: string[];
  singlePointOfFailure: boolean;
  recommendation: string;
}

interface ShiftSkillsContext {
  shiftLabel: string;
  shiftWindow: string;
  onShiftEngineers: SkillsMatrixEngineer[];
  gaps: ShiftSkillGap[];
  confidenceNote: string;
  sourceStatus: "live-shift" | "shift-pattern" | "fallback";
}

interface GlobalSpareIssue {
  assetId: string;
  assetName: string;
  assetNumber?: string;
  area?: string;
  riskScore: number;
  riskLevel: string;
  componentName: string;
  partNumber: string;
  stock: number;
  target: number;
  minimumQuantity?: number;
  status: string;
  criticality: string;
  leadDays: number;
  location: string;
  supplier: string;
  manufacturer: string;
}

interface GlobalSparesContext {
  checkedAssetCount: number;
  issueCount: number;
  outOfStockCount: number;
  lowStockCount: number;
  assetsWithIssues: number;
  issues: GlobalSpareIssue[];
  sourceNote: string;
}

interface ShiftCoverDateRange {
  startDate: string;
  endDate: string;
  label: string;
}

// ─── Role profiles ────────────────────────────────────────────────────────────

const ROLE_PROFILES: Record<VortaAiRole, RoleResponseProfile> = {
  "maintenance-manager": {
    role: "maintenance-manager",
    label: "Maintenance Manager",
    subtitle: "Site risk and action assistant",
    responseBadge: "Strategic maintenance response",
    introAnswer: "I can answer Maintenance Manager questions using Vorta site risk, area risk, equipment risk and source document data currently available in the MVP.",
    defaultAction: "Ask: What should I review first today?",
    promptPlaceholder: "Ask about cover, work, skills, spares or equipment...",
    contextLine: "Using live cover, work, skills, spares, risk and document evidence.",
    confidenceLabel: "Manager confidence",
    focusAreas: ["site risk", "area risk", "equipment priority", "labour risk", "PM backlog", "skills coverage", "spares"],
    quickQuestions: [
      "Who is off and who can cover next week?",
      "Which spares could delay a repair?",
      "Where are our single-person skill risks?",
      "What previous work was done on FD-03?",
      "What actions reduce risk most?",
    ],
  },
  planner: {
    role: "planner",
    label: "Maintenance Planner",
    subtitle: "Planning, workload and readiness assistant",
    responseBadge: "Planner response",
    introAnswer: "I can help a Maintenance Planner prioritise workload, prepare work packs, check PM readiness and highlight labour, spares or access constraints.",
    defaultAction: "Ask: What work should be planned first?",
    promptPlaceholder: "Ask about workload, PMs, spares, access, readiness...",
    contextLine: "Using equipment risk, PM backlog, area risk and source documents.",
    confidenceLabel: "Planning confidence",
    focusAreas: ["workload", "PM readiness", "spares", "access", "shutdown windows", "resource cover"],
    quickQuestions: [
      "What work should be planned first?",
      "Which PMs need spares before release?",
      "What is blocking readiness?",
      "Which asset should be scheduled first?",
      "What evidence supports this plan?",
    ],
  },
  engineer: {
    role: "engineer",
    label: "Engineer",
    subtitle: "Fault, evidence and safe action assistant",
    responseBadge: "Engineer response",
    introAnswer: "I can help an Engineer understand the likely fault, evidence, source sections, spares and safe next checks for assigned equipment.",
    defaultAction: "Ask: What should I check first?",
    promptPlaceholder: "Ask about faults, manuals, spares, PMs or safe checks...",
    contextLine: "Using equipment risk, work orders, manuals, SOPs, spares and source documents.",
    confidenceLabel: "Diagnostic confidence",
    focusAreas: ["fault checks", "safe isolation", "manuals", "SOPs", "spares", "work order history"],
    quickQuestions: [
      "What should I check first?",
      "What does the SOP say?",
      "What spares may be needed?",
      "Has this fault happened before?",
      "Who else has worked on this asset?",
    ],
  },
  operator: {
    role: "operator",
    label: "Operator",
    subtitle: "Safe task and escalation assistant",
    responseBadge: "Operator response",
    introAnswer: "I can help an Operator understand safe checks, escalation triggers, SOP references and what information to give maintenance.",
    defaultAction: "Ask: Is this safe to continue running?",
    promptPlaceholder: "Ask about safe checks, escalation, SOPs or task guidance...",
    contextLine: "Using SOPs, safe operating notes, equipment status and source documents.",
    confidenceLabel: "Operational confidence",
    focusAreas: ["safe running", "operator checks", "handover notes", "SOPs", "escalation"],
    quickQuestions: [
      "Is this safe to continue running?",
      "What should I tell maintenance?",
      "What operator checks are allowed?",
      "When should I escalate?",
      "What SOP applies?",
    ],
  },
  "production-manager": {
    role: "production-manager",
    label: "Production Manager",
    subtitle: "Production risk and impact assistant",
    responseBadge: "Production response",
    introAnswer: "I can help a Production Manager understand production impact, line risk, downtime exposure and what maintenance action affects output.",
    defaultAction: "Ask: What is the production impact today?",
    promptPlaceholder: "Ask about production impact, downtime, lines, risk or priorities...",
    contextLine: "Using site risk, equipment criticality, downtime and source documents.",
    confidenceLabel: "Production confidence",
    focusAreas: ["production impact", "line risk", "downtime", "critical assets", "handover actions"],
    quickQuestions: [
      "What is the production impact today?",
      "Which line is most at risk?",
      "What could stop production?",
      "What should I raise in the meeting?",
      "What is the evidence?",
    ],
  },
  contractor: {
    role: "contractor",
    label: "Contractor",
    subtitle: "Assignment and compliance assistant",
    responseBadge: "Contractor response",
    introAnswer: "I can help a Contractor understand assignment scope, required skills, compliance checks, source documents and handover expectations.",
    defaultAction: "Ask: What do I need before attending site?",
    promptPlaceholder: "Ask about assignment scope, compliance, skills or documents...",
    contextLine: "Using assignment context, equipment risk, compliance and source documents.",
    confidenceLabel: "Assignment confidence",
    focusAreas: ["assignment scope", "site compliance", "required skills", "documents", "handover"],
    quickQuestions: [
      "What do I need before attending site?",
      "What documents should I review?",
      "What skills are required?",
      "What risks should I know?",
      "What should my job report include?",
    ],
  },
};

function getRoleProfile(role: VortaAiRole): RoleResponseProfile {
  return ROLE_PROFILES[role] ?? ROLE_PROFILES["maintenance-manager"];
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function shorten(text: string, max = 240): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function addCalendarDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfCalendarWeek(value: Date): Date {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBriefDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(year, month - 1, day));
}

function resolveShiftCoverDateRange(question: string, now = new Date()): ShiftCoverDateRange {
  const q = question.toLowerCase();
  const thisWeekStart = startOfCalendarWeek(now);
  let start = thisWeekStart;
  let end = addCalendarDays(thisWeekStart, 6);

  if (q.includes("next week") || q.includes("following week")) {
    start = addCalendarDays(thisWeekStart, 7);
    end = addCalendarDays(start, 6);
  } else if (q.includes("today")) {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = start;
  } else if (q.includes("tomorrow")) {
    start = addCalendarDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1);
    end = start;
  } else if (q.includes("next 7 days") || q.includes("next seven days")) {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = addCalendarDays(start, 6);
  }

  const startDate = formatDateOnly(start);
  const endDate = formatDateOnly(end);
  return {
    startDate,
    endDate,
    label:
      startDate === endDate
        ? formatBriefDate(startDate)
        : `${formatBriefDate(startDate)} to ${formatBriefDate(endDate)}`,
  };
}

function readableExceptionType(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatShiftLabel(shiftDate: string, shiftType: string): string {
  return `${formatBriefDate(shiftDate)} ${shiftType === "night" ? "night" : "day"} shift`;
}

function withTimeout<T>(
  request: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise<T>(
    (resolve, reject) => {
      const timeoutId =
        window.setTimeout(
          () => {
            reject(
              new Error(
                timeoutMessage,
              ),
            );
          },
          timeoutMs,
        );

      request.then(
        (value) => {
          window.clearTimeout(
            timeoutId,
          );

          resolve(value);
        },
        (error: unknown) => {
          window.clearTimeout(
            timeoutId,
          );

          reject(error);
        },
      );
    },
  );
}

function riskRank(level: string): number {
  const value = level.toLowerCase();
  if (value.includes("critical")) return 4;
  if (value.includes("high")) return 3;
  if (value.includes("medium")) return 2;
  if (value.includes("low")) return 1;
  return 0;
}

function sourceLabel(chunk: EquipmentKnowledgeChunk): string {
  const revision  = chunk.revision      ? ` ${chunk.revision}`               : "";
  const drawing   = chunk.drawingNumber ? `, Drawing ${chunk.drawingNumber}` : "";
  const sheet     = chunk.sheetNumber   ? `, Sheet ${chunk.sheetNumber}`     : "";
  const page      = chunk.pageNumber != null ? `, Page ${chunk.pageNumber}`  : "";
  const section   = chunk.sectionTitle  ? `, ${chunk.sectionTitle}`          : (chunk.chunkRef ? `, ${chunk.chunkRef}` : "");
  return `${chunk.sourceSystem}: ${chunk.title}${revision}${drawing}${sheet}${page}${section}`;
}

// ─── Shift skills helpers ─────────────────────────────────────────────────────

function getCurrentShiftInfo(now = new Date()): { shiftLabel: string; shiftWindow: string; isDayShift: boolean } {
  const hour = now.getHours();
  const isDayShift = hour >= 6 && hour < 18;
  return {
    shiftLabel: isDayShift ? "Day shift" : "Night shift",
    shiftWindow: isDayShift ? "06:00-18:00" : "18:00-06:00",
    isDayShift,
  };
}

function getBestRating(assignment: SkillsMatrixAssignment | undefined): number | null {
  if (!assignment) return null;
  return assignment.validated_rating ?? assignment.manager_rating ?? assignment.self_rating ?? null;
}

function isUnavailable(status: string | null | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return (
    value.includes("unavailable") ||
    value.includes("off") ||
    value.includes("leave") ||
    value.includes("sick") ||
    value.includes("away")
  );
}

function isExplicitlyOnShift(status: string | null | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return (
    value.includes("on shift") ||
    value.includes("on-site") ||
    value.includes("onsite") ||
    value.includes("available") ||
    value.includes("active")
  );
}

function matchesCurrentShiftPattern(shiftPattern: string | null | undefined, isDayShift: boolean): boolean {
  const value = (shiftPattern ?? "").toLowerCase();
  if (!value) return false;
  if (isDayShift && (value.includes("day") || value.includes("days"))) return true;
  if (!isDayShift && (value.includes("night") || value.includes("nights"))) return true;
  if (
    value.includes("team a") ||
    value.includes("team b") ||
    value.includes("team c") ||
    value.includes("team d") ||
    value.includes("continental")
  ) {
    return true;
  }
  return false;
}

async function fetchShiftSkillsContext(): Promise<ShiftSkillsContext> {
  const { shiftLabel, shiftWindow, isDayShift } = getCurrentShiftInfo();

  const { data, error } = await supabase.functions.invoke("skills-matrix-data");

  if (error || !data) {
    return {
      shiftLabel,
      shiftWindow,
      onShiftEngineers: [],
      gaps: [],
      confidenceNote: "Skills matrix data could not be loaded.",
      sourceStatus: "fallback",
    };
  }

  const engineers = (data.engineers ?? []) as SkillsMatrixEngineer[];
  const skills = (data.heatmapSkills ?? []) as SkillsMatrixSkill[];
  const assignments = (data.heatmapAssignments ?? []) as SkillsMatrixAssignment[];
  const skillGaps = (data.skillGaps ?? []) as SkillsMatrixGap[];

  const { data: availabilityRows } = await supabase
    .from("engineers")
    .select("id, full_name, discipline, shift_pattern, availability_status");

  const availabilityById = new Map(
    ((availabilityRows ?? []) as EngineerAvailabilityRow[]).map((row) => [row.id, row]),
  );

  const explicitOnShift = engineers.filter((engineer) => {
    const availability = availabilityById.get(engineer.id);
    return isExplicitlyOnShift(availability?.availability_status) && !isUnavailable(availability?.availability_status);
  });

  const patternMatched = engineers.filter((engineer) => {
    const availability = availabilityById.get(engineer.id);
    const shiftPattern = availability?.shift_pattern ?? engineer.shift_pattern;
    return !isUnavailable(availability?.availability_status) && matchesCurrentShiftPattern(shiftPattern, isDayShift);
  });

  const onShiftEngineers =
    explicitOnShift.length > 0
      ? explicitOnShift
      : patternMatched.length > 0
        ? patternMatched
        : engineers.filter((engineer) => {
            const availability = availabilityById.get(engineer.id);
            return !isUnavailable(availability?.availability_status);
          });

  const sourceStatus: ShiftSkillsContext["sourceStatus"] =
    explicitOnShift.length > 0 ? "live-shift" : patternMatched.length > 0 ? "shift-pattern" : "fallback";

  const confidenceNote =
    sourceStatus === "live-shift"
      ? "Using engineer availability status for today's shift."
      : sourceStatus === "shift-pattern"
        ? "Using shift_pattern because live attendance/rota status is not fully available."
        : "No clear live shift roster was found, so this uses available engineers as a fallback.";

  const onShiftIds = new Set(onShiftEngineers.map((engineer) => engineer.id));
  const onShiftNameById = new Map(onShiftEngineers.map((engineer) => [engineer.id, engineer.full_name]));

  const assignmentsBySkill = new Map<string, SkillsMatrixAssignment[]>();
  assignments.forEach((assignment) => {
    if (!onShiftIds.has(assignment.engineer_id)) return;
    const existing = assignmentsBySkill.get(assignment.skill_id) ?? [];
    existing.push(assignment);
    assignmentsBySkill.set(assignment.skill_id, existing);
  });

  const criticalSkills = skills.filter((skill) => {
    if (skill.is_critical) return true;
    return skillGaps.some((gap) => gap.skill_name === skill.name && ["critical", "high"].includes(gap.risk_level?.toLowerCase?.() ?? ""));
  });

  const gaps = criticalSkills
    .map((skill) => {
      const gapRow = skillGaps.find((gap) => gap.skill_name === skill.name);
      const targetRating = gapRow?.target_rating ?? 4;
      const skillAssignments = assignmentsBySkill.get(skill.id) ?? [];

      const competentEngineers = skillAssignments
        .filter((assignment) => {
          const rating = getBestRating(assignment);
          return rating != null && rating >= targetRating;
        })
        .map((assignment) => onShiftNameById.get(assignment.engineer_id))
        .filter(Boolean) as string[];

      const belowTargetEngineers = skillAssignments
        .filter((assignment) => {
          const rating = getBestRating(assignment);
          return rating == null || rating < targetRating;
        })
        .map((assignment) => onShiftNameById.get(assignment.engineer_id))
        .filter(Boolean) as string[];

      const trainingRequiredEngineers = skillAssignments
        .filter((assignment) => assignment.training_required)
        .map((assignment) => onShiftNameById.get(assignment.engineer_id))
        .filter(Boolean) as string[];

      const singlePointOfFailure = competentEngineers.length === 1 || Boolean(gapRow?.single_point_of_failure);
      const riskLevel: ShiftSkillGap["riskLevel"] =
        competentEngineers.length === 0
          ? "critical"
          : singlePointOfFailure
            ? "high"
            : "medium";

      return {
        skillName: skill.name,
        category: skill.category,
        riskLevel,
        targetRating,
        competentCount: competentEngineers.length,
        onShiftCount: onShiftEngineers.length,
        competentEngineers,
        belowTargetEngineers,
        trainingRequiredEngineers,
        singlePointOfFailure,
        recommendation:
          gapRow?.recommendation ??
          (competentEngineers.length === 0
            ? `No on-shift engineer is validated to target for ${skill.name}. Arrange cover or escalation.`
            : singlePointOfFailure
              ? `Only one on-shift engineer is validated to target for ${skill.name}. Confirm backup or contractor fallback.`
              : `Review training and validation coverage for ${skill.name}.`),
      };
    })
    .filter(
      (gap) =>
        gap.competentCount === 0 ||
        gap.singlePointOfFailure ||
        gap.trainingRequiredEngineers.length > 0 ||
        gap.belowTargetEngineers.length > 0,
    )
    .sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2 };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || a.skillName.localeCompare(b.skillName);
    })
    .slice(0, 6);

  return {
    shiftLabel,
    shiftWindow,
    onShiftEngineers,
    gaps,
    confidenceNote,
    sourceStatus,
  };
}

function formatEngineerList(names: string[], fallback: string): string {
  if (names.length === 0) return fallback;
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
}

// ─── Spares context helpers ───────────────────────────────────────────────────

function spareStatusRank(status: string): number {
  const value = status.toLowerCase();
  if (value.includes("out of stock")) return 0;
  if (value.includes("low stock")) return 1;
  return 2;
}

function criticalityRank(value: string): number {
  const level = value.toLowerCase();
  if (level.includes("critical")) return 0;
  if (level.includes("high")) return 1;
  if (level.includes("medium")) return 2;
  return 3;
}

function sortSpareIssues(a: GlobalSpareIssue, b: GlobalSpareIssue): number {
  return (
    spareStatusRank(a.status) - spareStatusRank(b.status) ||
    criticalityRank(a.criticality) - criticalityRank(b.criticality) ||
    b.riskScore - a.riskScore ||
    b.leadDays - a.leadDays ||
    a.assetName.localeCompare(b.assetName)
  );
}

function formatSpareEvidence(issue: GlobalSpareIssue): string {
  const stockLabel = `${issue.stock}/${issue.target}`;
  const minLabel = issue.minimumQuantity != null && issue.minimumQuantity > 0
    ? `, min ${issue.minimumQuantity}`
    : "";
  const leadLabel = issue.leadDays > 0 ? `, ${issue.leadDays} day lead` : "";
  const locationLabel = issue.location ? `, ${issue.location}` : "";
  return `${issue.assetName}${issue.assetNumber ? ` (${issue.assetNumber})` : ""}: ${issue.componentName} (${issue.partNumber}) is ${issue.status}, stock ${stockLabel}${minLabel}, ${issue.criticality || "unknown"} criticality${leadLabel}${locationLabel}.`;
}

async function fetchGlobalSparesContext(assets: EquipmentListItem[]): Promise<GlobalSparesContext> {
  const scopedAssets = assets.slice(0, 8);

  const results = await Promise.all(
    scopedAssets.map(async (asset) => {
      const components = await getEquipmentComponents(asset.id);
      return components.criticalComponents.map((component: EquipmentComponent): GlobalSpareIssue => ({
        assetId: asset.id,
        assetName: asset.name,
        assetNumber: asset.assetNumber,
        area: asset.area,
        riskScore: asset.riskScore,
        riskLevel: asset.riskLevel,
        componentName: component.name,
        partNumber: component.partNumber,
        stock: component.stock,
        target: component.max,
        minimumQuantity: component.minimumQuantity,
        status: component.status,
        criticality: component.criticality,
        leadDays: component.leadDays,
        location: component.location,
        supplier: component.supplier,
        manufacturer: component.manufacturer,
      }));
    }),
  );

  const issues = results.flat().sort(sortSpareIssues);
  const outOfStockCount = issues.filter((i) => i.status.toLowerCase().includes("out of stock")).length;
  const lowStockCount   = issues.filter((i) => i.status.toLowerCase().includes("low stock")).length;
  const assetsWithIssues = new Set(issues.map((i) => i.assetId)).size;

  return {
    checkedAssetCount: scopedAssets.length,
    issueCount: issues.length,
    outOfStockCount,
    lowStockCount,
    assetsWithIssues,
    issues,
    sourceNote: `Checked equipment_components for ${scopedAssets.length} asset${scopedAssets.length === 1 ? "" : "s"}.`,
  };
}

// ─── Intent classification ────────────────────────────────────────────────────

function classifyGlobalQuestion(question: string): GlobalAiIntent {
  const q = question.toLowerCase();

  if (
    q.includes("shift cover") ||
    q.includes("rota cover") ||
    q.includes("cover issue") ||
    q.includes("cover risk") ||
    (
      (q.includes("holiday") || q.includes("annual leave") || q.includes("training") || q.includes("off"))
      && (q.includes("shift") || q.includes("rota") || q.includes("week"))
    )
  ) {
    return "shift-cover";
  }

  // Must be checked before daily-priority because "today" would match there first
  if (
    (q.includes("skill") || q.includes("skills") || q.includes("competency") || q.includes("competence") || q.includes("gap") || q.includes("gaps")) &&
    (q.includes("shift") || q.includes("today") || q.includes("on site") || q.includes("onsite") || q.includes("on shift") || q.includes("cover"))
  ) {
    return "shift-skills-gap";
  }

  if (
    q.includes("spare") ||
    q.includes("spares") ||
    q.includes("part") ||
    q.includes("parts") ||
    q.includes("stock") ||
    q.includes("stores") ||
    q.includes("bom") ||
    q.includes("inventory")
  ) {
    return "spares-risk";
  }

  if (
    q.includes("pm") ||
    q.includes("planned maintenance") ||
    q.includes("overdue") ||
    q.includes("backlog")
  ) {
    return "pm-risk";
  }

  if (
    q.includes("first") ||
    q.includes("today") ||
    q.includes("review") ||
    q.includes("priority") ||
    q.includes("worry")
  ) {
    return "daily-priority";
  }

  if (
    q.includes("site risk") ||
    q.includes("highest site") ||
    q.includes("overall risk") ||
    q.includes("site")
  ) {
    return "site-risk";
  }

  if (
    q.includes("building") ||
    q.includes("area") ||
    q.includes("line") ||
    q.includes("department")
  ) {
    return "area-risk";
  }

  if (
    q.includes("equipment") ||
    q.includes("asset") ||
    q.includes("machine") ||
    q.includes("critical") ||
    q.includes("next shift")
  ) {
    return "equipment-risk";
  }

  if (
    q.includes("evidence") ||
    q.includes("source") ||
    q.includes("why") ||
    q.includes("document") ||
    q.includes("manual") ||
    q.includes("sop")
  ) {
    return "evidence";
  }

  if (
    q.includes("labour") ||
    q.includes("labor") ||
    q.includes("cover") ||
    q.includes("shift") ||
    q.includes("engineer")
  ) {
    return "labour-risk";
  }

  if (
    q.includes("pm") ||
    q.includes("planned maintenance") ||
    q.includes("overdue") ||
    q.includes("backlog")
  ) {
    return "pm-risk";
  }

  if (
    q.includes("spare") ||
    q.includes("part") ||
    q.includes("stock") ||
    q.includes("bom")
  ) {
    return "spares-risk";
  }

  if (
    q.includes("skill") ||
    q.includes("training") ||
    q.includes("competency") ||
    q.includes("competence")
  ) {
    return "skills-risk";
  }

  return "general";
}

function findMentionedArea(question: string, areaRisks: AreaRiskProfile[]): AreaRiskProfile | undefined {
  const q = question.toLowerCase();
  return areaRisks.find((area) => {
    const areaName = area.area.toLowerCase();
    return q.includes(areaName) || areaName.split(/[\s/-]+/).some((part) => part.length > 2 && q.includes(part));
  });
}

function findMentionedEquipment(question: string, equipment: EquipmentListItem[]): EquipmentListItem | undefined {
  const q = question.toLowerCase();
  return equipment.find((item) => {
    const name = item.name.toLowerCase();
    const assetNumber = item.assetNumber?.toLowerCase?.() ?? "";
    return (
      q.includes(name) ||
      Boolean(assetNumber && q.includes(assetNumber)) ||
      name.split(/[\s/-]+/).some((part) => part.length > 3 && q.includes(part))
    );
  });
}

function getIntentTitle(intent: GlobalAiIntent): string {
  switch (intent) {
    case "shift-cover":      return "Shift cover";
    case "shift-skills-gap": return "Shift skills gap";
    case "daily-priority":   return "Daily priority";
    case "site-risk":        return "Site risk";
    case "area-risk":        return "Area risk";
    case "equipment-risk":   return "Equipment risk";
    case "evidence":         return "Evidence summary";
    case "labour-risk":      return "Labour risk";
    case "pm-risk":          return "PM risk";
    case "spares-risk":      return "Spares risk";
    case "skills-risk":      return "Skills risk";
    default:                 return "General risk question";
  }
}

// ─── Role-aware helpers ───────────────────────────────────────────────────────

function roleAwareDirectAnswer(
  baseAnswer: string,
  roleProfile: RoleResponseProfile,
  topEquipment?: EquipmentListItem,
  intent?: GlobalAiIntent,
): string {
  const equipmentName = topEquipment?.name ?? "the highest-risk asset";

  if (intent === "spares-risk" || intent === "shift-cover") {
    return baseAnswer;
  }

  switch (roleProfile.role) {
    case "planner":
      return `${baseAnswer} Planning lens: confirm the work can be scheduled by checking labour availability, required spares, access constraints, PM status and any source document requirements before releasing work.`;
    case "engineer":
      return `${baseAnswer} Engineering lens: start with safe isolation requirements, source-backed checks, previous work order evidence and likely spares before touching the asset.`;
    case "operator":
      return `${baseAnswer} Operator lens: do not perform maintenance activity. Capture the alarm/state, follow the approved SOP, complete only permitted operator checks and escalate ${equipmentName} to maintenance if risk remains.`;
    case "production-manager":
      return `${baseAnswer} Production lens: focus on production impact, line availability, likely downtime exposure and what decision is needed before the next shift or production meeting.`;
    case "contractor":
      return `${baseAnswer} Contractor lens: confirm assignment scope, site access, compliance documents, required skills, isolation handover and job report expectations before attending.`;
    case "maintenance-manager":
    default:
      return `${baseAnswer} Maintenance Manager lens: prioritise risk reduction, labour coverage, PM backlog, skills gaps, spares and the action owner.`;
  }
}

function roleAwareActions(
  baseActions: string[],
  roleProfile: RoleResponseProfile,
  topEquipment?: EquipmentListItem,
  intent?: GlobalAiIntent,
): string[] {
  const equipmentName = topEquipment?.name ?? "the highest-risk asset";

  const roleActions: Record<VortaAiRole, string[]> = {
    "maintenance-manager": [
      `Assign an owner to review ${equipmentName} risk drivers and confirm the next action.`,
      "Check labour cover, skills coverage, overdue PMs and critical spares before the next handover.",
    ],
    planner: [
      `Create or review the work pack for ${equipmentName}.`,
      "Check spares, permits, access, estimated duration and engineer availability before scheduling.",
    ],
    engineer: [
      `Open the equipment detail for ${equipmentName} and review source-backed checks before attending.`,
      "Confirm isolation/SOP requirements and record evidence before resetting or replacing parts.",
    ],
    operator: [
      "Follow the approved SOP and complete only permitted operator checks.",
      `Escalate ${equipmentName} to maintenance with alarm text, time, product/state and any safe observations.`,
    ],
    "production-manager": [
      `Review the production impact of ${equipmentName} and agree risk tolerance before the next shift.`,
      "Raise the risk in the production/maintenance meeting with the evidence summary.",
    ],
    contractor: [
      `Confirm scope, compliance, RAMS/permit requirements and site access before attending ${equipmentName}.`,
      "Review the linked source documents and prepare a clear job report with findings and actions.",
    ],
  };

  if (intent === "shift-cover") {
    return unique(baseActions).slice(0, 5);
  }

  if (intent === "spares-risk") {
    return unique([...baseActions, ...roleActions[roleProfile.role]]).slice(0, 5);
  }

  return unique([...roleActions[roleProfile.role], ...baseActions]).slice(0, 5);
}

function roleAwareNote(roleProfile: RoleResponseProfile): string {
  switch (roleProfile.role) {
    case "operator":
      return "Operator safety note: this does not authorise maintenance work. Follow site SOPs and escalate outside permitted checks.";
    case "contractor":
      return "Contractor note: confirm assignment, permit, RAMS and site access requirements before attending.";
    case "engineer":
      return "Engineer safety note: confirm isolation and approved procedure before physical intervention.";
    case "planner":
      return "Planner note: this supports planning priority, not final release without labour, spares, access and permit checks.";
    case "production-manager":
      return "Production note: this supports production risk decisions, not maintenance override decisions.";
    case "maintenance-manager":
    default:
      return "Manager note: this supports prioritisation and action ownership using available Vorta evidence.";
  }
}

// ─── Answer engine ────────────────────────────────────────────────────────────

function buildGlobalAnswer(
  question: string,
  siteRisk: SiteRiskProfile | null,
  areaRisks: AreaRiskProfile[],
  equipment: EquipmentListItem[],
  knowledgeChunks: EquipmentKnowledgeChunk[],
  roleProfile: RoleResponseProfile,
  shiftSkillsContext: ShiftSkillsContext | null,
  shiftCoverBrief: ShiftCoverAiBrief | null,
  shiftCoverRange: ShiftCoverDateRange | null,
  sparesContext: GlobalSparesContext | null,
): GlobalAiAnswer {
  const intent = classifyGlobalQuestion(question);
  const mentionedArea = findMentionedArea(question, areaRisks);
  const mentionedEquipment = findMentionedEquipment(question, equipment);

  const sortedEquipment = [...equipment].sort((a, b) => {
    const scoreDiff = b.riskScore - a.riskScore;
    if (scoreDiff !== 0) return scoreDiff;
    return riskRank(b.riskLevel) - riskRank(a.riskLevel);
  });

  const sortedAreas = [...areaRisks].sort((a, b) => b.riskScore - a.riskScore);

  const topEquipment = sortedEquipment[0];
  const topArea = sortedAreas[0];

  const selectedArea = mentionedArea ?? topArea;
  const selectedEquipment = mentionedEquipment ?? topEquipment;

  const evidence: string[] = [];
  const decisionSummary: VortaAgentDecisionSummaryItem[] = [];
  const findings: VortaAgentFinding[] = [];
  const coverOptions: VortaAgentCoverOption[] = [];
  const recommendedActions: string[] = [];
  const actionPlan: VortaAgentAction[] = [];
  const followUpQuestions: string[] = [];
  const sources: string[] = [];
  const missingData: string[] = [];
  let directAnswer = "";

  switch (intent) {
    case "shift-cover": {
      if (!shiftCoverBrief || !shiftCoverRange) {
        directAnswer = "I cannot confirm the requested shift cover because the verified Shift Cover calendar was not available.";
        missingData.push("The dated Shift Cover calendar, exceptions and skill coverage could not be loaded.");
        sources.push("Verified Shift Cover calendar");
        break;
      }

      const unavailableExceptions = shiftCoverBrief.exceptions.filter(
        (exception: ShiftCoverException) => !exception.isAvailable,
      );
      const reducedShifts = shiftCoverBrief.calendar
        .filter((shift: ShiftCoverCalendarItem) => shift.coverageStatus !== "covered")
        .sort(
          (first: ShiftCoverCalendarItem, second: ShiftCoverCalendarItem) =>
            second.labourRiskScore - first.labourRiskScore ||
            second.missingSkillCount - first.missingSkillCount,
        );
      const exposedShifts = shiftCoverBrief.calendar
        .filter(
          (shift: ShiftCoverCalendarItem) =>
            shift.missingSkillCount > 0 ||
            shift.equipmentWithMissingCover > 0,
        )
        .sort(
          (first: ShiftCoverCalendarItem, second: ShiftCoverCalendarItem) =>
            second.labourRiskScore - first.labourRiskScore,
        );
      const skillRisks = shiftCoverBrief.skillRisks
        .slice()
        .sort(
          (first: ShiftCoverSkillRisk, second: ShiftCoverSkillRisk) =>
            first.qualifiedEngineerCount - second.qualifiedEngineerCount ||
            first.shiftDate.localeCompare(second.shiftDate),
        );
      const issueCount =
        reducedShifts.length + unavailableExceptions.length + exposedShifts.length;

      if (issueCount === 0) {
        directAnswer = `No—none of the ${shiftCoverBrief.calendar.length} shifts checked has a cover issue.`;
        decisionSummary.push(
          {
            label: "Period checked",
            value: shiftCoverRange.label,
          },
          {
            label: "Absence",
            value: "No holiday, training or other unavailable exception is recorded.",
          },
          {
            label: "Skills risk",
            value: "No equipment-required skill is below its minimum qualified-engineer threshold.",
          },
        );
        evidence.push(
          `${shiftCoverBrief.calendar.length} dated shifts checked; none is marked reduced, partial, gap or contractor cover.`,
        );
        evidence.push("No unavailable holiday, training, sickness or other rota exception is recorded for the period.");
        evidence.push("No equipment-required skill is below its minimum qualified-engineer threshold.");
        recommendedActions.push("No immediate cover change is required; recheck after any leave, training or rota update.");
        findings.push({
          category: "cover",
          severity: "low",
          title: "No cover intervention required",
          detail: `${shiftCoverBrief.calendar.length} dated shifts were checked. None has reduced rota cover or a missing required-skill exposure.`,
        });
        actionPlan.push({
          priority: "planned",
          action: "Recheck Shift Cover after the next rota, leave or training update.",
          owner: "Maintenance Planner",
          expectedImpact: "Keeps the no-intervention decision aligned with the latest attendance records.",
          verification: "Confirm the Shift Cover calendar still shows no reduced shifts or missing required skills.",
        });
      } else {
        const priorityShifts = (reducedShifts.length > 0 ? reducedShifts : exposedShifts).slice(0, 3);
        const highestRiskShift = priorityShifts[0];
        const highestRiskPackage = highestRiskShift
          ? shiftCoverBrief.coverPackages.find(
              (item) =>
                item.shiftDate === highestRiskShift.shiftDate &&
                item.shiftType === highestRiskShift.shiftType,
            )
          : undefined;
        const jointHighestRiskCount = highestRiskShift
          ? priorityShifts.filter(
              (shift) =>
                shift.labourRiskScore === highestRiskShift.labourRiskScore &&
                shift.missingSkillCount === highestRiskShift.missingSkillCount,
            ).length
          : 0;
        const priorityReason = highestRiskShift
          ? jointHighestRiskCount > 1
            ? `It is the earliest of ${jointHighestRiskCount} joint-highest shifts at ${highestRiskShift.labourRiskScore.toFixed(1)} labour risk, with ${highestRiskShift.missingSkillCount} skill exposures across ${highestRiskShift.equipmentWithMissingCover} assets.`
            : `It ranks first at ${highestRiskShift.labourRiskScore.toFixed(1)} labour risk, with ${highestRiskShift.missingSkillCount} skill exposures across ${highestRiskShift.equipmentWithMissingCover} assets.`
          : "";
        directAnswer =
          `Yes—${exposedShifts.length} of ${shiftCoverBrief.calendar.length} shifts have insufficient validated skill coverage; ` +
          `${reducedShifts.length} also have reduced or non-standard rota cover.`;
        if (highestRiskShift) {
          decisionSummary.push(
            {
              label: "Highest risk",
              value: `${formatShiftLabel(highestRiskShift.shiftDate, highestRiskShift.shiftType)} — ${highestRiskShift.teamNames.join(" + ")}; ${highestRiskShift.labourRiskScore.toFixed(1)} labour risk, ${highestRiskShift.missingSkillCount} missing-skill gaps across ${highestRiskShift.equipmentWithMissingCover} assets.`,
            },
            {
              label: "Scheduled",
              value: formatEngineerList(
                highestRiskShift.engineerNames,
                "No engineers scheduled",
              ),
            },
          );
        }
        decisionSummary.push({
          label: "Absence",
          value:
            unavailableExceptions.length === 0
              ? "None recorded. Confirm unrecorded leave or rota changes before offering overtime."
              : unavailableExceptions
                  .slice(0, 4)
                  .map(
                    (exception) =>
                      `${exception.engineerName ?? exception.teamName ?? "Scheduled team"} — ${readableExceptionType(exception.exceptionType)}`,
                  )
                  .join("; "),
        });
        if (highestRiskPackage) {
          decisionSummary.push(
            {
              label: "Best provisional cover",
              value: `${highestRiskPackage.engineerNames.join(", ")} for ${formatShiftLabel(highestRiskPackage.shiftDate, highestRiskPackage.shiftType)}.`,
            },
            {
              label: "Calculated impact",
              value: `Closes ${highestRiskPackage.missingSkillsClosed} of ${highestRiskShift?.missingSkillCount ?? highestRiskPackage.missingSkillsClosed + highestRiskPackage.remainingMissingSkills} missing-skill gaps; ${highestRiskPackage.remainingMissingSkills} remain.`,
            },
            {
              label: "Residual risk",
              value:
                highestRiskPackage.remainingMissingSkills > 0
                  ? `${highestRiskPackage.remainingMissingSkills} gaps remain; open the residual skill-by-asset list before releasing planned work.`
                  : "No zero-cover skill gap remains in the calculated package.",
            },
            {
              label: "First action",
              value: "Confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval.",
            },
          );
        }

        unavailableExceptions.slice(0, 3).forEach((exception: ShiftCoverException) => {
          const person = exception.engineerName ?? exception.teamName ?? "Scheduled team";
          const note = exception.notes ? ` — ${exception.notes}` : "";
          evidence.push(
            `${formatShiftLabel(exception.shiftDate, exception.shiftType)}: ${person} unavailable — ${readableExceptionType(exception.exceptionType)}${note}.`,
          );
        });

        if (unavailableExceptions.length === 0) {
          evidence.push("No holiday, training, sickness or other unavailable rota exception is recorded for the period.");
          findings.push({
            category: "absence",
            severity: "info",
            title: "No recorded leave or training",
            detail: "No holiday, training, sickness or other unavailable rota exception is recorded for this period. Confirm any unrecorded changes before assigning overtime.",
          });
        } else {
          unavailableExceptions.slice(0, 3).forEach((exception: ShiftCoverException) => {
            const person = exception.engineerName ?? exception.teamName ?? "Scheduled team";
            findings.push({
              category: "absence",
              severity: "high",
              title: `${person} unavailable`,
              detail: `${formatShiftLabel(exception.shiftDate, exception.shiftType)} — ${readableExceptionType(exception.exceptionType)}${exception.notes ? `: ${exception.notes}` : "."}`,
            });
          });
        }

        priorityShifts.forEach((shift: ShiftCoverCalendarItem, index) => {
          const shiftRisks = skillRisks
            .filter(
              (risk) =>
                risk.shiftDate === shift.shiftDate &&
                risk.shiftType === shift.shiftType,
            )
            .slice(0, 4);
          const gapSummary =
            shiftRisks.length > 0
              ? shiftRisks
                  .map(
                    (risk) =>
                      `${risk.skillName} on ${risk.equipmentCode ?? risk.equipmentName}`,
                  )
                  .join("; ")
              : "Open Shift Cover for the complete skill-by-asset list";

          evidence.push(
            `${formatShiftLabel(shift.shiftDate, shift.shiftType)}: ${shift.coverageStatus} cover with ${formatEngineerList(shift.engineerNames, "no engineers scheduled")}; ${shift.missingSkillCount} missing skill${shift.missingSkillCount === 1 ? "" : "s"} across ${shift.equipmentWithMissingCover} affected asset${shift.equipmentWithMissingCover === 1 ? "" : "s"}; labour risk ${shift.labourRiskScore.toFixed(1)} ${shift.labourRiskLevel}.`,
          );
          findings.push({
            category: "cover",
            severity:
              index === 0 && shift.missingSkillCount >= 50
                ? "critical"
                : shift.coverageStatus !== "covered"
                  ? "high"
                  : "medium",
            title: `${index === 0 ? "Priority — " : ""}${formatShiftLabel(shift.shiftDate, shift.shiftType)}`,
            detail:
              `${shift.teamNames.join(" + ")}: ${formatEngineerList(shift.engineerNames, "no engineers scheduled")}. ` +
              `${shift.missingSkillCount} required-skill exposures—fewer validated engineers than the equipment requirement—across ${shift.equipmentWithMissingCover} assets. ` +
              `${index === 0 ? `${priorityReason} ` : ""}Examples: ${gapSummary}.`,
          });
        });

        if (highestRiskShift) {
          const offRota = shiftCoverBrief.offRota.find(
            (item) =>
              item.shiftDate === highestRiskShift.shiftDate &&
              item.shiftType === highestRiskShift.shiftType,
          );
          if (offRota) {
            evidence.push(
              `${formatShiftLabel(offRota.shiftDate, offRota.shiftType)} off-rota candidates: ${formatEngineerList(offRota.engineerNames, "none without a rest conflict")}. This is not confirmed availability.`,
            );
            findings.push({
              category: "cover",
              severity: "info",
              title: "Off-rota engineers for the priority shift",
              detail:
                `${formatEngineerList(offRota.engineerNames, "No engineers without a rest conflict")}. ` +
                (offRota.restConflictEngineerNames.length > 0
                  ? `Rest-conflict review: ${offRota.restConflictEngineerNames.join(", ")}. `
                  : "") +
                "Off-rota does not mean available; overtime, leave and fatigue checks are required.",
            });
          }

          const coverPackage = highestRiskPackage;
          if (coverPackage) {
            evidence.push(
              `Calculated cover package: ${coverPackage.engineerNames.join(", ")} would close ${coverPackage.missingSkillsClosed} of ${highestRiskShift.missingSkillCount} zero-cover skill exposures and leave ${coverPackage.remainingMissingSkills}; ${coverPackage.assetsWithClosedGaps} assets would have at least one gap closed.`,
            );
            recommendedActions.push(
              `Check overtime, leave and fatigue availability for ${coverPackage.engineerNames.join(", ")} before ${formatShiftLabel(coverPackage.shiftDate, coverPackage.shiftType)}; if confirmed, this is the strongest calculated cover package.`,
            );
          } else {
            const candidates = shiftCoverBrief.coverCandidates
              .filter(
                (item) =>
                  item.shiftDate === highestRiskShift.shiftDate &&
                  item.shiftType === highestRiskShift.shiftType,
              )
              .slice(0, 3);
            if (candidates.length > 0) {
              evidence.push(
                `Ranked off-rota cover candidates: ${candidates.map((item) => `${item.engineerName} (${item.gapsClosed} gaps closed)`).join(", ")}. Availability is not yet confirmed.`,
              );
            }
          }
        }

        const highestShiftRisks = highestRiskShift
          ? skillRisks
              .filter(
                (risk) =>
                  risk.shiftDate === highestRiskShift.shiftDate &&
                  risk.shiftType === highestRiskShift.shiftType,
              )
              .slice(0, 4)
          : [];
        highestShiftRisks.forEach((risk: ShiftCoverSkillRisk) => {
          const qualifiedNames = formatEngineerList(
            risk.qualifiedEngineerNames,
            "no qualified engineer on shift",
          );
          evidence.push(
            `${formatShiftLabel(risk.shiftDate, risk.shiftType)} — ${risk.skillName} on ${risk.equipmentName}${risk.equipmentCode ? ` (${risk.equipmentCode})` : ""}: ${risk.qualifiedEngineerCount}/${risk.minimumQualifiedEngineers} qualified; ${qualifiedNames}.`,
          );
        });

        priorityShifts.forEach((shift) => {
          const coverPackage = shiftCoverBrief.coverPackages.find(
            (item) =>
              item.shiftDate === shift.shiftDate &&
              item.shiftType === shift.shiftType,
          );
          if (!coverPackage || coverPackage.engineerNames.length === 0) return;
          coverOptions.push({
            engineerNames: coverPackage.engineerNames,
            shift: formatShiftLabel(coverPackage.shiftDate, coverPackage.shiftType),
            reason: "Strongest calculated package from the validated skills evidence available for this shift.",
            skillsCovered: coverPackage.closedSkills.slice(0, 6),
            assetsProtected: coverPackage.protectedAssets.slice(0, 6),
            projectedImpact:
              `Closes ${coverPackage.missingSkillsClosed} of ${shift.missingSkillCount} missing-skill gaps; ` +
              `${coverPackage.remainingMissingSkills} remain across the shift.`,
            remainingRisk:
              coverPackage.remainingMissingSkills > 0
                ? `${coverPackage.remainingMissingSkills} required-skill exposures remain. Review the residual skill-by-asset list before releasing planned work.`
                : "No zero-cover exposure remains in the calculated package; verify the revised roster before release.",
            caveat: "Provisional only—confirm overtime acceptance, unrecorded leave, fatigue and rest compliance.",
          });
        });

        if (highestRiskShift) {
          const packageNames = new Set(
            (highestRiskPackage?.engineerNames ?? []).map((name) => name.toLowerCase()),
          );
          const rankedCandidates = shiftCoverBrief.coverCandidates
            .filter(
              (candidate) =>
                candidate.shiftDate === highestRiskShift.shiftDate &&
                candidate.shiftType === highestRiskShift.shiftType &&
                !packageNames.has(candidate.engineerName.toLowerCase()),
            )
            .sort((first, second) => first.candidateRank - second.candidateRank)
            .slice(0, 3);
          rankedCandidates.forEach((candidate) => {
            coverOptions.push({
              engineerNames: [candidate.engineerName],
              shift: formatShiftLabel(candidate.shiftDate, candidate.shiftType),
              reason: `Ranked individual fallback${candidate.discipline ? ` — ${candidate.discipline}` : ""}.`,
              skillsCovered: candidate.topSkills.slice(0, 6),
              assetsProtected: candidate.topAssets.slice(0, 6),
              projectedImpact: `Closes ${candidate.gapsClosed} gaps and improves ${candidate.gapsImproved} skill-by-asset exposure points.`,
              remainingRisk: `${candidate.remainingMissingSkills} missing-skill gaps remain with this individual option.`,
              caveat: `${candidate.availabilityStatus}. ${
                candidate.restConflict
                  ? "Rest conflict recorded—do not assign until resolved."
                  : "Confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval."
              }`,
            });
          });
        }

        if (unavailableExceptions[0]) {
          const firstException = unavailableExceptions[0];
          recommendedActions.push(
            `Confirm replacement cover for ${firstException.engineerName ?? firstException.teamName ?? "the unavailable team"} on ${formatShiftLabel(firstException.shiftDate, firstException.shiftType)}.`,
          );
        }
        if (highestShiftRisks[0]) {
          const firstSkillRisk = highestShiftRisks[0];
          recommendedActions.push(
            firstSkillRisk.qualifiedEngineerCount === 0
              ? `Assign a validated ${firstSkillRisk.skillName} engineer to ${formatShiftLabel(firstSkillRisk.shiftDate, firstSkillRisk.shiftType)} or arrange competent contractor escalation.`
              : `Add backup ${firstSkillRisk.skillName} cover on ${formatShiftLabel(firstSkillRisk.shiftDate, firstSkillRisk.shiftType)}; current cover is below the required minimum.`,
          );
        }
        if (highestRiskShift) {
          recommendedActions.push(
            `After cover is confirmed, re-run Shift Cover and verify the remaining missing-skill count for ${formatShiftLabel(highestRiskShift.shiftDate, highestRiskShift.shiftType)}.`,
          );
        }

        if (highestRiskShift && highestRiskPackage) {
          actionPlan.push({
            priority: "now",
            action: `Contact ${highestRiskPackage.engineerNames.join(", ")} for provisional cover of ${formatShiftLabel(highestRiskShift.shiftDate, highestRiskShift.shiftType)}.`,
            owner: "Maintenance Manager",
            expectedImpact: `If all accept, ${highestRiskPackage.missingSkillsClosed} of ${highestRiskShift.missingSkillCount} zero-cover exposures close; ${highestRiskPackage.remainingMissingSkills} remain.`,
            verification: "Record confirmed availability, re-run Shift Cover and compare the remaining missing-skill count.",
          });
          actionPlan.push({
            priority: "before_shift",
            action:
              highestRiskPackage.remainingMissingSkills > 0
                ? `Protect the ${highestRiskPackage.remainingMissingSkills} residual exposures by moving non-essential work and arranging validated contractor or cross-shift support.`
                : "Confirm the revised team covers every required asset skill before releasing the plan.",
            owner: "Maintenance Planner",
            expectedImpact: "Prevents planned work from relying on skills that remain uncovered after the proposed rota change.",
            verification: "Check the work plan against the residual skill-by-asset list in Shift Cover.",
          });
        }
        actionPlan.push({
          priority: "before_shift",
          action: "Confirm overtime acceptance, fatigue controls and any leave or training not yet recorded.",
          owner: "Shift Supervisor",
          expectedImpact: "Turns provisional names into a safe, auditable cover decision.",
          verification: "Update the rota exceptions and confirm the final named shift roster at handover.",
        });
        followUpQuestions.push(
          "Which skills and assets remain uncovered after this package?",
          `Show alternative cover if ${highestRiskPackage?.engineerNames.join(", ") ?? "the proposed engineers"} are unavailable.`,
          "Which planned work should move away from the highest-risk shift?",
          "Show every shift with reduced rota or insufficient skills coverage.",
        );
      }

      sources.push(
        "Verified Shift Cover calendar",
        "Shift exceptions",
        "Engineer skills",
        "Equipment required skills",
      );
      break;
    }

    case "shift-skills-gap": {
      if (!shiftSkillsContext) {
        directAnswer = "I cannot check shift skills gaps because shift skills context is not available.";
        missingData.push("Shift skills context was not loaded.");
        sources.push("Skills matrix data");
        break;
      }

      const gaps = shiftSkillsContext.gaps;
      const onShiftCount = shiftSkillsContext.onShiftEngineers.length;

      if (gaps.length === 0) {
        directAnswer = `${shiftSkillsContext.shiftLabel} (${shiftSkillsContext.shiftWindow}) has no critical skills gaps visible from the current skills matrix data.`;
        evidence.push(`${onShiftCount} engineer${onShiftCount === 1 ? "" : "s"} included in the shift skills check.`);
        evidence.push(shiftSkillsContext.confidenceNote);
        recommendedActions.push("Keep the shift skills view monitored and confirm live attendance before handover.");
        sources.push("Skills matrix data", "Engineer availability / shift pattern");
        break;
      }

      const criticalCount = gaps.filter((gap) => gap.riskLevel === "critical").length;
      const highCount = gaps.filter((gap) => gap.riskLevel === "high").length;
      const topGap = gaps[0];

      directAnswer = `${shiftSkillsContext.shiftLabel} (${shiftSkillsContext.shiftWindow}) has ${gaps.length} skills coverage gap${gaps.length === 1 ? "" : "s"} from the current skills matrix. ${criticalCount} critical and ${highCount} high. Top gap: ${topGap.skillName}.`;

      evidence.push(`${onShiftCount} engineer${onShiftCount === 1 ? "" : "s"} included in today's shift skills check.`);
      evidence.push(shiftSkillsContext.confidenceNote);

      gaps.slice(0, 4).forEach((gap) => {
        const competent = formatEngineerList(gap.competentEngineers, "no validated on-shift engineer");
        const belowTarget = formatEngineerList(gap.belowTargetEngineers, "none listed below target");
        const trainingRequired = formatEngineerList(gap.trainingRequiredEngineers, "none marked training required");
        evidence.push(
          `${gap.skillName}: ${gap.competentCount}/${gap.onShiftCount} on-shift engineers at target ${gap.targetRating}. Competent: ${competent}. Below target: ${belowTarget}. Training required: ${trainingRequired}.`,
        );
      });

      recommendedActions.push(`Cover ${topGap.skillName} first: ${topGap.recommendation}`);
      recommendedActions.push("Check the Skills Matrix for the on-shift engineers and confirm any single-point failure before handover.");
      recommendedActions.push("Arrange contractor fallback or engineer reallocation for any zero-cover critical skill.");

      sources.push("Skills matrix data", "Engineer skills", "Engineer availability / shift pattern");
      break;
    }

    case "daily-priority": {
      if (selectedEquipment) {
        directAnswer = `Review ${selectedEquipment.name} first. It is the highest-priority asset based on the current equipment risk list at ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel} risk.`;
        evidence.push(`${selectedEquipment.name} is ranked highest in the equipment risk list.`);
        evidence.push(`Risk score: ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel}.`);
        if (selectedEquipment.area) evidence.push(`Area: ${selectedEquipment.area}.`);
        recommendedActions.push(`Open ${selectedEquipment.name} and check risk drivers, PMs, work orders, skills and spares.`);
        recommendedActions.push("Confirm action owner before the next shift handover.");
        sources.push("Equipment risk list");
      }
      if (siteRisk) {
        evidence.push(`Site risk is currently ${siteRisk.riskScore}% ${siteRisk.riskLevel}.`);
        sources.push("Site risk profile");
      }
      if (!selectedEquipment && !siteRisk) {
        directAnswer = "I cannot identify today's priority because no equipment or site risk data is currently available.";
        missingData.push("Equipment risk list and site risk profile are unavailable.");
      }
      break;
    }

    case "site-risk": {
      if (siteRisk) {
        directAnswer = `The current site risk is ${siteRisk.riskScore}% ${siteRisk.riskLevel}. ${siteRisk.highestArea ? `${siteRisk.highestArea} is currently the highest-risk area.` : ""}`;
        evidence.push(`Site risk score: ${siteRisk.riskScore}% ${siteRisk.riskLevel}.`);
        if (siteRisk.highestArea) evidence.push(`Highest area: ${siteRisk.highestArea} at ${siteRisk.highestAreaScore ?? "unknown"}%.`);
        if (siteRisk.riskSummary) evidence.push(siteRisk.riskSummary);
        if (siteRisk.priorityAction) recommendedActions.push(siteRisk.priorityAction);
        sources.push("Site risk profile");
      } else {
        directAnswer = "I cannot confirm the current site risk because the site risk profile is unavailable.";
        missingData.push("Site risk profile is unavailable.");
      }
      break;
    }

    case "area-risk": {
      if (selectedArea) {
        directAnswer = `${selectedArea.area} is the area to review. It is currently ${selectedArea.riskScore}% ${selectedArea.riskLevel} risk.`;
        evidence.push(`${selectedArea.area} risk score: ${selectedArea.riskScore}% ${selectedArea.riskLevel}.`);
        evidence.push(`${selectedArea.criticalAssetCount} critical asset${selectedArea.criticalAssetCount === 1 ? "" : "s"} and ${selectedArea.highAssetCount} high-risk asset${selectedArea.highAssetCount === 1 ? "" : "s"} are linked to this area.`);
        if (selectedArea.riskSummary) evidence.push(selectedArea.riskSummary);
        if (selectedArea.priorityAction) recommendedActions.push(selectedArea.priorityAction);
        sources.push("Area risk profiles");
      } else {
        directAnswer = "I cannot identify the area risk because no area profile matched the question.";
        missingData.push("No matching area risk profile was found.");
      }
      break;
    }

    case "equipment-risk": {
      if (selectedEquipment) {
        directAnswer = `${selectedEquipment.name} needs the most attention from the current equipment risk list. It is ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel} risk.`;
        evidence.push(`${selectedEquipment.name} risk score: ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel}.`);
        if (selectedEquipment.area) evidence.push(`Area: ${selectedEquipment.area}.`);
        if (selectedEquipment.status) evidence.push(`Status: ${selectedEquipment.status}.`);
        recommendedActions.push(`Open ${selectedEquipment.name} and review risk drivers, overdue PMs, work orders, skills coverage and spares.`);
        recommendedActions.push("Confirm whether action is required before the next shift handover.");
        sources.push("Equipment risk list");
      } else {
        directAnswer = "I cannot identify the highest-risk equipment because the equipment risk list is unavailable.";
        missingData.push("Equipment risk list is unavailable.");
      }
      break;
    }

    case "evidence": {
      if (knowledgeChunks.length > 0) {
        directAnswer = `I found ${knowledgeChunks.length} matched source section${knowledgeChunks.length === 1 ? "" : "s"}. The strongest source match is ${sourceLabel(knowledgeChunks[0])}.`;
        knowledgeChunks.slice(0, 4).forEach((chunk) => {
          evidence.push(
            `${chunk.documentType}: ${chunk.title}${chunk.revision ? ` Rev ${chunk.revision}` : ""}, ${chunk.chunkRef}${chunk.sectionTitle ? ` - ${chunk.sectionTitle}` : ""}: ${shorten(chunk.chunkText, 180)}`,
          );
        });
        sources.push(...knowledgeChunks.slice(0, 4).map(sourceLabel));
        recommendedActions.push("Open the linked equipment page and review the source sections before making the decision.");
      } else {
        directAnswer = "I could not find a linked manual, drawing, or source document for this equipment/fault. This answer is based only on available Vorta equipment/work order data.";
        missingData.push("No matching knowledge document chunks were returned.");
        if (siteRisk) evidence.push(`Site risk is ${siteRisk.riskScore}% ${siteRisk.riskLevel}.`);
        if (selectedEquipment) evidence.push(`${selectedEquipment.name} is ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel} risk.`);
        sources.push("Site/equipment risk data");
      }
      break;
    }

    case "labour-risk": {
      directAnswer = "Labour risk should be reviewed against shift cover, single-point skill exposure and engineer availability before the next handover.";
      if (siteRisk) evidence.push(`Site risk is ${siteRisk.riskScore}% ${siteRisk.riskLevel}.`);
      if (selectedArea) evidence.push(`${selectedArea.area} is ${selectedArea.riskScore}% ${selectedArea.riskLevel} risk.`);
      if (selectedEquipment) evidence.push(`${selectedEquipment.name} should be checked for skills coverage and single-point dependency.`);
      recommendedActions.push("Check shift coverage and critical skill availability for the highest-risk area.");
      recommendedActions.push("Confirm whether contractor fallback or reallocation is needed.");
      sources.push("Site risk profile", "Area risk profiles", "Equipment risk list");
      break;
    }

    case "pm-risk": {
      directAnswer = "PM risk should be reviewed by checking overdue PMs, readiness, labour availability and whether the work can be completed before risk increases.";
      if (selectedEquipment) evidence.push(`${selectedEquipment.name} is the priority asset for PM/readiness review at ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel} risk.`);
      if (siteRisk) evidence.push(`Site risk is ${siteRisk.riskScore}% ${siteRisk.riskLevel}.`);
      recommendedActions.push("Open the equipment PM tab and check overdue PMs, next due date and readiness.");
      recommendedActions.push("Confirm spares, labour, access and permit requirements before scheduling.");
      sources.push("Equipment risk list", "Site risk profile");
      break;
    }

    case "spares-risk": {
      if (!sparesContext) {
        directAnswer = "I cannot check spares issues because equipment component context was not loaded.";
        missingData.push("equipment_components was not checked for this question.");
        sources.push("Equipment risk list");
        break;
      }

      if (sparesContext.issueCount === 0) {
        directAnswer = `No out-of-stock or low-stock critical spares were found across the ${sparesContext.checkedAssetCount} asset${sparesContext.checkedAssetCount === 1 ? "" : "s"} checked.`;
        evidence.push(sparesContext.sourceNote);
        if (selectedEquipment) {
          evidence.push(`${selectedEquipment.name} remains the selected asset by risk score, but no critical spare shortage was returned for the checked scope.`);
        }
        recommendedActions.push("Keep monitoring critical spares and refresh after the next stores/SAP import.");
        sources.push("equipment_components", "Equipment risk list");
        break;
      }

      const topIssue = sparesContext.issues[0];
      const topThree = sparesContext.issues.slice(0, 3);

      directAnswer =
        `Yes. There ${sparesContext.issueCount === 1 ? "is" : "are"} ${sparesContext.issueCount} spares issue${sparesContext.issueCount === 1 ? "" : "s"} across ${sparesContext.assetsWithIssues} asset${sparesContext.assetsWithIssues === 1 ? "" : "s"} checked: ` +
        `${sparesContext.outOfStockCount} out of stock and ${sparesContext.lowStockCount} low stock. ` +
        `Highest priority: ${topIssue.assetName} — ${topIssue.componentName} (${topIssue.partNumber}) is ${topIssue.status}, stock ${topIssue.stock}/${topIssue.target}, ${topIssue.criticality || "unknown"} criticality` +
        `${topIssue.leadDays > 0 ? `, ${topIssue.leadDays} day lead` : ""}` +
        `${topIssue.location ? `, ${topIssue.location}` : ""}.`;

      evidence.push(sparesContext.sourceNote);
      topThree.forEach((issue) => evidence.push(formatSpareEvidence(issue)));

      const outOfStockCritical = sparesContext.issues.find(
        (issue) =>
          issue.status.toLowerCase().includes("out of stock") &&
          issue.criticality.toLowerCase().includes("critical"),
      );

      if (outOfStockCritical) {
        recommendedActions.push(
          `Expedite ${outOfStockCritical.componentName} (${outOfStockCritical.partNumber}) for ${outOfStockCritical.assetName}; it is out of stock with ${outOfStockCritical.leadDays || "unknown"} day lead time.`,
        );
      }

      recommendedActions.push(`Review the top ${Math.min(3, sparesContext.issueCount)} spare issue${sparesContext.issueCount === 1 ? "" : "s"} before the next shift handover.`);
      recommendedActions.push("Check whether the affected assets have open work orders, overdue PMs or fault trends that depend on these parts.");

      sources.push("equipment_components", "Equipment risk list");
      break;
    }

    case "skills-risk": {
      directAnswer = "Skills risk should be reviewed from the skills matrix, not just the equipment risk list.";
      if (shiftSkillsContext) {
        const gaps = shiftSkillsContext.gaps;
        evidence.push(`${shiftSkillsContext.onShiftEngineers.length} engineer${shiftSkillsContext.onShiftEngineers.length === 1 ? "" : "s"} included in the current shift skills context.`);
        evidence.push(shiftSkillsContext.confidenceNote);
        if (gaps.length > 0) {
          evidence.push(`${gaps.length} shift skills gap${gaps.length === 1 ? "" : "s"} found. Top gap: ${gaps[0].skillName}.`);
          recommendedActions.push(`Review ${gaps[0].skillName} first and confirm competent cover.`);
        } else {
          evidence.push("No current shift skills gaps were returned by the skills matrix check.");
          recommendedActions.push("Confirm live attendance and keep monitoring critical skills coverage.");
        }
      } else {
        missingData.push("Shift skills context is not available.");
      }
      recommendedActions.push("Open Skills Matrix and filter by critical skills, training required and single point of failure.");
      sources.push("Skills matrix data", "Engineer skills", "Skill gap snapshots");
      break;
    }

    default: {
      directAnswer = "I can answer that using the current site, area, equipment and source document data, but the question does not match a specific risk category yet.";
      if (siteRisk) evidence.push(`Site risk is ${siteRisk.riskScore}% ${siteRisk.riskLevel}.`);
      if (selectedArea) evidence.push(`${selectedArea.area} is ${selectedArea.riskScore}% ${selectedArea.riskLevel} risk.`);
      if (selectedEquipment) evidence.push(`${selectedEquipment.name} is ${selectedEquipment.riskScore}% ${selectedEquipment.riskLevel} risk.`);
      recommendedActions.push("Ask about site risk, area risk, equipment risk, PMs, spares, skills or evidence for a more specific answer.");
      sources.push("Site risk profile", "Area risk profiles", "Equipment risk list");
      break;
    }
  }

  if (!directAnswer) {
    directAnswer = "I could not build a specific answer from the current Vorta data.";
    missingData.push("No matching risk context was available for this question.");
  }

  const roleAwareAnswer = roleAwareDirectAnswer(directAnswer, roleProfile, selectedEquipment, intent);
  const roleActions = roleAwareActions(recommendedActions, roleProfile, selectedEquipment, intent);

  const dataPoints = [
    siteRisk,
    selectedArea,
    selectedEquipment,
    knowledgeChunks.length > 0,
    shiftCoverBrief,
  ].filter(Boolean).length;

  return {
    directAnswer: roleAwareAnswer,
    decisionSummary,
    evidence: unique(evidence),
    findings,
    coverOptions,
    recommendedActions: roleActions,
    actionPlan,
    followUpQuestions,
    sources: unique(sources),
    confidence: Math.min(92, Math.max(55, 55 + dataPoints * 8)),
    roleLabel: roleProfile.label,
    responseBadge: roleProfile.responseBadge,
    intentLabel: getIntentTitle(intent),
    roleNote: roleAwareNote(roleProfile),
    knowledgeChunks,
    missingData: unique(missingData),
    evidenceGeneratedAt: shiftCoverBrief?.sourceUpdatedAt ?? shiftCoverBrief?.generatedAt,
  };
}

// ─── GlobalSourceCards ────────────────────────────────────────────────────────

function GlobalSourceCards({ chunks }: { chunks: EquipmentKnowledgeChunk[] }) {
  if (chunks.length === 0) return null;

  return (
    <div className="rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-300">
        Sources used
      </h4>
      <div className="flex flex-col gap-2">
        {chunks.slice(0, 4).map((chunk) => (
          <div key={chunk.chunkId} className="rounded border border-blue-500/10 bg-[#0f1218] px-2.5 py-2">
            <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <Badge className="h-auto rounded bg-blue-500/15 px-1.5 py-0 text-xs font-bold text-blue-300 shadow-none">
                    {chunk.sourceSystem}
                  </Badge>
                  <Badge className="h-auto rounded bg-gray-800 px-1.5 py-0 text-xs font-medium text-slate-400 shadow-none">
                    {chunk.documentType}
                  </Badge>
                </div>
                <p className="text-xs font-semibold text-blue-200">
                  {chunk.title}
                  {chunk.revision ? ` ${chunk.revision}` : ""}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  {chunk.drawingNumber && (
                    <span>Drawing: <span className="text-slate-300">{chunk.drawingNumber}</span></span>
                  )}
                  {chunk.sheetNumber && (
                    <span>Sheet: <span className="text-slate-300">{chunk.sheetNumber}</span></span>
                  )}
                  {chunk.pageNumber != null && (
                    <span>Page: <span className="text-slate-300">{chunk.pageNumber}</span></span>
                  )}
                  {chunk.sectionTitle && (
                    <span>Section: <span className="text-slate-300">{chunk.sectionTitle}</span></span>
                  )}
                </div>
              </div>
              {chunk.sourceUrl && (
                <a
                  href={chunk.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1 rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-200 transition-colors hover:border-blue-400/60"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open source
                </a>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {chunk.chunkText.slice(0, 240)}{chunk.chunkText.length > 240 ? "…" : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AnswerBlock ──────────────────────────────────────────────────────────────

function findingTone(severity: VortaAgentFinding["severity"]): string {
  if (severity === "critical") return "border-red-500/25 bg-red-500/10 text-red-200";
  if (severity === "high") return "border-orange-500/25 bg-orange-500/10 text-orange-200";
  if (severity === "medium") return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  if (severity === "low") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  return "border-blue-500/20 bg-blue-500/10 text-blue-200";
}

function AnswerBlock({
  answer,
  onFollowUp,
  presentation = "compact",
}: {
  answer: GlobalAiAnswer;
  onFollowUp: (question: string) => void;
  presentation?: "compact" | "workspace";
}) {
  const navigate = useNavigate();
  const { siteContext } = useAuth();
  const hasStructuredFindings = Boolean(answer.findings?.length);
  const hasStructuredActions = Boolean(answer.actionPlan?.length);
  const workspacePresentation = presentation === "workspace";
  const wideCompactPresentation =
    !workspacePresentation &&
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 769px)").matches;
  const decisionSummaryLimit = wideCompactPresentation ? 4 : 7;
  const decisionSeverity = answer.findings?.some(
    (finding) => finding.severity === "critical",
  )
    ? "Critical"
    : answer.findings?.some((finding) => finding.severity === "high")
      ? "High risk"
      : null;
  const evidenceUpdatedLabel = answer.evidenceGeneratedAt
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(answer.evidenceGeneratedAt))
    : null;
  const [feedback, setFeedback] = useState<"helpful" | "not_helpful" | null>(null);
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [feedbackPromptOpen, setFeedbackPromptOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<AskVortaFeedbackCategory | "">("");
  const [feedbackReason, setFeedbackReason] = useState("");
  const [draftedActions, setDraftedActions] = useState<Set<number>>(() => new Set());
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);

  const recordFeedback = async (
    value: "helpful" | "not_helpful",
    options: {
      category?: AskVortaFeedbackCategory;
      reason?: string;
    } = {},
  ): Promise<void> => {
    if (!answer.responseId || feedbackPending) return;
    setFeedbackPending(true);
    setWorkflowMessage(null);
    try {
      await submitAskVortaFeedback(answer.responseId, value, options);
      setFeedback(value);
      setFeedbackPromptOpen(false);
      setFeedbackCategory("");
      setFeedbackReason("");
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : "Feedback could not be saved.");
    } finally {
      setFeedbackPending(false);
    }
  };

  const prepareDraft = async (
    item: VortaAgentAction,
    index: number,
  ): Promise<void> => {
    if (!siteContext?.siteId || !answer.responseId || draftedActions.has(index)) return;
    setWorkflowMessage(null);
    setDraftedActions((current) => {
      const next = new Set(current);
      next.delete(index);
      return next;
    });
    openAskVortaActionReviewDialog({
      siteId: siteContext.siteId,
      responseId: answer.responseId,
      action: item,
      evidence: answer.evidence,
      sources: answer.sources,
    });
    setWorkflowMessage("Review the exact Vorta shift-handover action before confirmation.");
    // VOR-047 controlled handover review: SAP and SAP-equivalent records remain read-only.
  };

  return (
    <div className="flex flex-col gap-2">
      {!workspacePresentation && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className="h-auto rounded bg-blue-500/15 px-1.5 py-0 text-xs font-bold text-blue-300 shadow-none">
            {answer.responseBadge}
          </Badge>
          <Badge className="h-auto rounded bg-gray-800 px-1.5 py-0 text-xs font-medium text-slate-400 shadow-none">
            {answer.roleLabel}
          </Badge>
          {!wideCompactPresentation && (
            <Badge className="h-auto rounded bg-gray-800/80 px-1.5 py-0 text-xs font-medium text-slate-500 shadow-none">
              {answer.intentLabel}
            </Badge>
          )}
        </div>
      )}

      <p
        className={
          workspacePresentation
            ? "border-l-2 border-blue-400/70 pl-4 text-lg font-semibold leading-8 text-slate-100"
            : "text-base leading-7 text-slate-200 sm:text-sm sm:leading-6"
        }
      >
        {answer.directAnswer}
      </p>

      {answer.decisionSummary && answer.decisionSummary.length > 0 && (
        <section
          aria-labelledby="ask-vorta-decision-summary"
          className="rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-3 py-3"
        >
          <h4
            id="ask-vorta-decision-summary"
            className="mb-2 flex items-center justify-between gap-2 text-[15px] font-bold uppercase tracking-wider text-blue-200 sm:text-sm"
          >
            <span>Decision summary</span>
            {decisionSeverity && (
              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-bold normal-case tracking-normal text-orange-200">
                {decisionSeverity}
              </span>
            )}
          </h4>
          <ul className="flex flex-col gap-2.5">
            {answer.decisionSummary.slice(0, decisionSummaryLimit).map((item, index) => (
              <li
                key={`${item.label}-${index}`}
                className="flex items-start gap-2 text-[15px] leading-6 text-slate-200 sm:text-sm"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span>
                  <span className="font-bold text-slate-100">{item.label}:</span>{" "}
                  {item.value}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasStructuredFindings && (
        <details className="group rounded-lg border border-gray-800 bg-gray-900/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-[15px] font-bold text-slate-200 sm:text-sm">
            <span>Detailed cover evidence</span>
            <span className="flex items-center gap-2 text-sm font-medium text-slate-400">
              {answer.findings?.length} items
              <ChevronDown className="h-4 w-4 text-blue-300 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="flex flex-col gap-1.5 border-t border-gray-800 px-3 py-3">
            {answer.findings?.slice(0, 8).map((finding, index) => (
              <div
                key={`${finding.category}-${finding.title}-${index}`}
                className={`rounded-md border px-3 py-2.5 sm:px-2.5 sm:py-2 ${findingTone(finding.severity)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-bold text-current sm:text-sm">{finding.title}</p>
                  <span className="shrink-0 text-[13px] font-bold uppercase tracking-wide opacity-70 sm:text-xs">
                    {finding.severity}
                  </span>
                </div>
                <p className="mt-1 text-[15px] leading-6 text-slate-300 sm:mt-0.5 sm:text-sm sm:leading-6">
                  {finding.detail}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}

      {answer.coverOptions && answer.coverOptions.length > 0 && (
        <div>
          <h4 className="mb-2 text-[15px] font-bold uppercase tracking-wider text-slate-400 sm:text-sm">
            Cover options
          </h4>
          <div className="flex flex-col gap-1.5">
            {answer.coverOptions.slice(0, 5).map((option, index) => (
              <details
                key={`${option.shift}-${option.engineerNames.join("-")}-${index}`}
                className="group rounded-md border border-blue-500/20 bg-blue-500/8 px-3 py-2.5 sm:px-2.5 sm:py-2"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-2">
                  <span>
                    <span className="block text-[15px] font-bold text-blue-200">
                      {index === 0 ? "Recommended — " : "Alternative — "}
                      {option.engineerNames.join(" + ")}
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-slate-300">
                      {option.shift}
                    </span>
                  </span>
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-blue-300 transition-transform group-open:rotate-180" />
                </summary>
                <div className="hidden border-t border-blue-500/15 pt-2 group-open:mt-2 group-open:block">
                  <p className="mt-2 text-sm leading-6 text-slate-400 sm:mt-1 sm:text-xs sm:leading-relaxed">
                    {option.reason}
                  </p>
                  {option.skillsCovered.length > 0 && (
                    <div className="mt-2 sm:mt-1">
                      <p className="text-[13px] font-bold uppercase tracking-wide text-slate-400 sm:text-xs">
                        Skills covered
                      </p>
                      <p className="mt-0.5 text-[15px] leading-6 text-slate-300 sm:text-sm">
                        {option.skillsCovered.join(", ")}
                      </p>
                    </div>
                  )}
                  {option.assetsProtected.length > 0 && (
                    <div className="mt-2 sm:mt-1">
                      <p className="text-[13px] font-bold uppercase tracking-wide text-slate-400 sm:text-xs">
                        Assets protected
                      </p>
                      <p className="mt-0.5 text-[15px] leading-6 text-slate-300 sm:text-sm">
                        {option.assetsProtected.join(", ")}
                      </p>
                    </div>
                  )}
                  <p className="mt-2 text-base font-semibold leading-6 text-emerald-300 sm:mt-1 sm:text-sm sm:leading-6">
                    {option.projectedImpact}
                  </p>
                  <p className="mt-2 text-[15px] leading-6 text-orange-200 sm:mt-1 sm:text-sm sm:leading-6">
                    Remaining risk: {option.remainingRisk}
                  </p>
                  <p className="mt-2 text-[15px] leading-6 text-amber-200/80 sm:mt-1 sm:text-[13px] sm:leading-5">
                    {option.caveat}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {!hasStructuredFindings && answer.evidence.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Evidence</h4>
          <ul className="flex flex-col gap-1">
            {answer.evidence.slice(0, 6).map((item) => (
              <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="group rounded-lg border border-emerald-500/15 bg-emerald-500/[0.03]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-[15px] font-bold text-slate-200 sm:text-sm">
          <span>Risk-reduction plan</span>
          <span className="flex items-center gap-2 text-sm font-medium text-slate-400">
            {hasStructuredActions
              ? `${answer.actionPlan?.length ?? 0} actions`
              : `${answer.recommendedActions.length} actions`}
            <ChevronDown className="h-4 w-4 text-emerald-300 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="border-t border-emerald-500/15 px-3 py-3">
        {hasStructuredActions ? (
          <div className="flex flex-col gap-1.5">
            {answer.actionPlan?.slice(0, 5).map((item, index) => (
              <div
                key={`${item.priority}-${item.action}-${index}`}
                className="rounded-md border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5 sm:px-2.5 sm:py-2"
              >
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-300">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-6 text-slate-200 sm:text-xs sm:leading-relaxed">
                      {item.action}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 sm:mt-0.5 sm:text-[11px]">
                      {item.owner} · {item.priority.replace("_", " ")}
                    </p>
                    <p className="mt-2 text-sm leading-5 text-emerald-300 sm:mt-1 sm:text-xs sm:leading-relaxed">
                      {item.expectedImpact}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 sm:mt-0.5 sm:text-[11px] sm:leading-relaxed">
                      Verify: {item.verification}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!siteContext?.siteId || draftedActions.has(index)}
                      onClick={() => void prepareDraft(item, index)}
                      className="mt-2 h-8 border-emerald-500/25 bg-emerald-500/5 px-2.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-70 sm:h-7 sm:text-[11px]"
                    >
                      {draftedActions.has(index) ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Draft prepared
                        </>
                      ) : (
                        <>
                          <ClipboardPlus className="h-3.5 w-3.5" />
                          Prepare action draft
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {answer.recommendedActions.slice(0, 4).map((item) => (
              <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                {item}
              </li>
            ))}
          </ul>
        )}
        </div>
      </details>

      {answer.followUpQuestions && answer.followUpQuestions.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            Useful next questions
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {answer.followUpQuestions.slice(0, 2).map((question) => (
              <button
                type="button"
                key={question}
                onClick={() => onFollowUp(question)}
                className="rounded-full border border-gray-700 bg-gray-800/70 px-3 py-1.5 text-left text-xs leading-relaxed text-slate-300 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-200 sm:px-2 sm:py-1 sm:text-[11px]"
              >
                {question}
              </button>
            ))}
          </div>
          {answer.followUpQuestions.length > 2 && (
            <details className="group mt-1.5">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-xs font-semibold text-slate-400">
                More questions
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {answer.followUpQuestions.slice(2, 4).map((question) => (
                  <button
                    type="button"
                    key={question}
                    onClick={() => onFollowUp(question)}
                    className="rounded-full border border-gray-700 bg-gray-800/70 px-3 py-1.5 text-left text-xs leading-relaxed text-slate-300 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-200"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {answer.knowledgeChunks && answer.knowledgeChunks.length > 0 && (
        <GlobalSourceCards chunks={answer.knowledgeChunks} />
      )}

      {answer.evidenceLinks && answer.evidenceLinks.length > 0 && (
        <section data-vorta-ai-evidence-links="true">
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            Open in Vorta
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {answer.evidenceLinks.slice(0, 8).map((link) => (
              <button
                type="button"
                key={`${link.recordType}-${link.path}`}
                onClick={() => navigate(link.path)}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/25 bg-blue-500/10 px-2.5 py-1.5 text-xs font-semibold text-blue-200 transition-colors hover:border-blue-400/50 hover:bg-blue-500/15"
              >
                <ExternalLink className="h-3 w-3" />
                {link.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {answer.sources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {answer.sources.slice(0, 6).map((source) => (
            <Badge
              key={source}
              className="h-auto rounded border border-gray-700 bg-gray-800/70 px-1.5 py-0 text-xs font-medium text-slate-300 shadow-none"
            >
              {source}
            </Badge>
          ))}
        </div>
      )}

      {answer.roleNote && (
        <div className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1.5">
          <p className="text-xs leading-relaxed text-blue-100/80">{answer.roleNote}</p>
        </div>
      )}

      {answer.missingData && answer.missingData.length > 0 && (
        <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2 py-1.5">
          {answer.missingData.map((item) => (
            <p key={item} className="text-xs leading-relaxed text-yellow-100/80">
              {item}
            </p>
          ))}
        </div>
      )}

      {workflowMessage && (
        <p className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-2 text-xs leading-relaxed text-blue-100">
          {workflowMessage}
        </p>
      )}

      <div className="flex items-start justify-between gap-3 border-t border-gray-800 pt-2 text-xs text-slate-500">
        <span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            Source-backed response
          </span>
          {evidenceUpdatedLabel && (
            <span className="mt-0.5 block pl-[18px]">
              Evidence updated {evidenceUpdatedLabel}
            </span>
          )}
        </span>
        <span className="shrink-0 font-semibold text-blue-400">
          {answer.confidence >= 90
            ? "High"
            : answer.confidence >= 75
              ? "Medium"
              : "Low"}{" "}
          · {answer.confidence}%
        </span>
      </div>
      {answer.responseId && (
        <section
          data-vorta-ai-feedback="true"
          className="space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">
              {feedback ? "Thanks—this improves Ask Vorta." : "Was this decision pack useful?"}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Mark this Ask Vorta response helpful"
                disabled={feedbackPending}
                onClick={() => void recordFeedback("helpful")}
                className={`rounded-md border p-2 transition-colors ${
                  feedback === "helpful"
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-gray-700 text-slate-400 hover:border-emerald-500/30 hover:text-emerald-300"
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Mark this Ask Vorta response not helpful"
                aria-expanded={feedbackPromptOpen}
                disabled={feedbackPending}
                onClick={() => setFeedbackPromptOpen((current) => !current)}
                className={`rounded-md border p-2 transition-colors ${
                  feedback === "not_helpful"
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                    : "border-gray-700 text-slate-400 hover:border-amber-500/30 hover:text-amber-300"
                }`}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {feedbackPromptOpen && feedback !== "not_helpful" && (
            <div
              role="group"
              aria-labelledby={`ask-vorta-feedback-${answer.responseId}`}
              className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3"
            >
              <p
                id={`ask-vorta-feedback-${answer.responseId}`}
                className="text-xs font-semibold text-amber-100"
              >
                What was not useful? Choose a reason or add a brief detail to help improve the response.
              </p>
              <label className="block space-y-1 text-xs text-slate-300">
                <span>Reason</span>
                <select
                  value={feedbackCategory}
                  onChange={(event) =>
                    setFeedbackCategory(event.target.value as AskVortaFeedbackCategory | "")
                  }
                  className="min-h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100"
                >
                  <option value="">No category selected</option>
                  <option value="wrong_route">Answered the wrong question</option>
                  <option value="missing_evidence">Missing important evidence</option>
                  <option value="too_slow">Took too long</option>
                  <option value="unclear">Unclear or difficult to scan</option>
                  <option value="incorrect">Information looked incorrect</option>
                  <option value="too_much_detail">Too much detail</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block space-y-1 text-xs text-slate-300">
                <span>Brief detail</span>
                <textarea
                  value={feedbackReason}
                  maxLength={500}
                  rows={2}
                  onChange={(event) => setFeedbackReason(event.target.value)}
                  placeholder="Optional detail"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100"
                />
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={feedbackPending}
                  onClick={() => setFeedbackPromptOpen(false)}
                  className="min-h-10 rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={feedbackPending}
                  onClick={() => void recordFeedback("not_helpful")}
                  className="min-h-10 rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-500/30"
                >
                  Skip reason
                </button>
                <button
                  type="button"
                  disabled={feedbackPending}
                  onClick={() =>
                    void recordFeedback("not_helpful", {
                      category: feedbackCategory || undefined,
                      reason: feedbackReason,
                    })
                  }
                  className="min-h-10 rounded-md bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/30"
                >
                  Submit feedback
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface GlobalMaintenanceAiAssistantProps {
  role?: VortaAiRole;
  showLauncher?: boolean;
  shouldHandlePrompt?: (question: string) => boolean;
}

export function GlobalMaintenanceAiAssistant({
  role = "maintenance-manager",
  showLauncher = true,
  shouldHandlePrompt,
}: GlobalMaintenanceAiAssistantProps): JSX.Element | null {
  const roleProfile = getRoleProfile(role);
  const navigate = useNavigate();
  const { siteContext } = useAuth();
  const agentContextReady = Boolean(siteContext?.siteId);

  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<PreparedAskVortaImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const compactImageInputRef = useRef<HTMLInputElement | null>(null);

  const speechRecognitionRef =
    useRef<VortaSpeechRecognition | null>(
      null,
    );

  const speechInputPrefixRef =
    useRef("");

  const [
    speechSupported,
    setSpeechSupported,
  ] = useState(false);

  const [
    listening,
    setListening,
  ] = useState(false);

  const [
    speechError,
    setSpeechError,
  ] = useState<string | null>(
    null,
  );
  const [siteRisk, setSiteRisk] = useState<SiteRiskProfile | null>(null);
  const [areaRisks, setAreaRisks] = useState<AreaRiskProfile[]>([]);
  const [equipment, setEquipment] = useState<EquipmentListItem[]>([]);
  const [shiftSkillsContext, setShiftSkillsContext] = useState<ShiftSkillsContext | null>(null);
  const [
    loadingContext,
    setLoadingContext,
  ] = useState(false);

  const [
    contextReady,
    setContextReady,
  ] = useState(false);

  const [
    contextError,
    setContextError,
  ] = useState<string | null>(
    null,
  );

  const [
    contextReloadKey,
    setContextReloadKey,
  ] = useState(0);

  const [
    pendingPrompt,
    setPendingPrompt,
  ] = useState("");
  const [messages, setMessages] = useState<GlobalAiMessage[]>([
    {
      id: "global-mm-intro",
      role: "assistant",
      answer: {
        directAnswer: roleProfile.introAnswer,
        decisionSummary: [],
        evidence: [],
        recommendedActions: [roleProfile.defaultAction],
        sources: [],
        confidence: 70,
        roleLabel: roleProfile.label,
        responseBadge: roleProfile.responseBadge,
        intentLabel: "Introduction",
        roleNote: roleAwareNote(roleProfile),
      },
    },
  ]);

  const hasActiveConversation = messages.some(
    (message) => message.role === "user" && Boolean(message.text?.trim()),
  );

  useEffect(() => {
    const speechWindow =
      window as VortaSpeechWindow;

    const SpeechRecognitionApi =
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      setSpeechSupported(false);
      return;
    }

    const recognition =
      new SpeechRecognitionApi();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-GB";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setSpeechError(null);
    };

    recognition.onresult = (
      event,
    ) => {
      let transcript = "";

      for (
        let index = 0;
        index <
        event.results.length;
        index += 1
      ) {
        const alternative =
          event.results[index]?.[0];

        if (
          alternative?.transcript
        ) {
          transcript +=
            `${alternative.transcript} `;
        }
      }

      const dictatedText =
        transcript.trim();

      setInput(
        [
          speechInputPrefixRef
            .current,
          dictatedText,
        ]
          .filter(Boolean)
          .join(" "),
      );
    };

    recognition.onerror = (
      event,
    ) => {
      setListening(false);

      switch (event.error) {
        case "aborted":
          return;

        case "not-allowed":
        case "service-not-allowed":
          setSpeechError(
            "Microphone permission was denied. Enable microphone access in your browser settings and try again.",
          );
          return;

        case "audio-capture":
          setSpeechError(
            "No working microphone could be detected.",
          );
          return;

        case "no-speech":
          setSpeechError(
            "No speech was detected. Try again and speak clearly after the microphone activates.",
          );
          return;

        case "network":
          setSpeechError(
            "The browser voice-recognition service is currently unavailable.",
          );
          return;

        default:
          setSpeechError(
            event.message?.trim() ||
              "Voice dictation could not be completed.",
          );
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    speechRecognitionRef.current =
      recognition;

    setSpeechSupported(true);

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;

      try {
        recognition.abort();
      } catch {
        // Recognition may already be inactive.
      }

      speechRecognitionRef.current =
        null;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    let mounted = true;

    setLoadingContext(true);
    setContextReady(false);
    setContextError(null);

    setSiteRisk(null);
    setAreaRisks([]);
    setEquipment([]);
    setShiftSkillsContext(null);

    const loadContext =
      async (): Promise<void> => {
        try {
          const [
            nextSiteRisk,
            nextAreaRisks,
            nextEquipment,
            nextShiftSkillsContext,
          ] = await withTimeout(
            Promise.all(
              [
                getSiteRiskProfile(),
                getAreaRiskProfiles(),
                getEquipmentList(),
                fetchShiftSkillsContext(),
              ] as const,
            ),
            15000,
            "Vorta could not load the required site context within 15 seconds.",
          );

          if (
            !nextSiteRisk ||
            nextAreaRisks.length ===
              0 ||
            nextEquipment.length ===
              0
          ) {
            throw new Error(
              "Required Vorta site context is incomplete.",
            );
          }

          if (!mounted) {
            return;
          }

          setSiteRisk(
            nextSiteRisk,
          );

          setAreaRisks(
            nextAreaRisks,
          );

          setEquipment(
            nextEquipment,
          );

          setShiftSkillsContext(
            nextShiftSkillsContext,
          );

          setContextReady(true);
          setContextError(null);
        } catch (error) {
          console.warn(
            "GlobalMaintenanceAiAssistant context load failed:",
            error,
          );

          if (!mounted) {
            return;
          }

          const message =
            error instanceof Error
              ? error.message
              : "";

          setContextReady(false);

          setContextError(
            message.includes(
              "within 15 seconds",
            )
              ? message
              : "Vorta could not load the complete site risk and equipment context. Analysis is disabled until the data is available.",
          );
        } finally {
          if (mounted) {
            setLoadingContext(
              false,
            );
          }
        }
      };

    void loadContext();

    return () => {
      mounted = false;
    };
  }, [open, contextReloadKey]);

  const retryContextLoad =
    (): void => {
      if (loadingContext) {
        return;
      }

      setContextReloadKey(
        (current) =>
          current + 1,
      );
    };

  const stopSpeechRecognition = (
    abort = false,
  ): void => {
    const recognition =
      speechRecognitionRef.current;

    if (!recognition) {
      setListening(false);
      return;
    }

    try {
      if (abort) {
        recognition.abort();
      } else {
        recognition.stop();
      }
    } catch {
      // Recognition may already be inactive.
    }

    setListening(false);
  };

  const toggleSpeechRecognition =
    (): void => {
      const recognition =
        speechRecognitionRef.current;

      if (
        !speechSupported ||
        !recognition
      ) {
        setSpeechError(
          "Voice dictation is not supported by this browser.",
        );
        return;
      }

      if (listening) {
        stopSpeechRecognition();
        return;
      }

      speechInputPrefixRef.current =
        input.trim();

      setSpeechError(null);

      try {
        recognition.start();
      } catch {
        setSpeechError(
          "Voice dictation could not start. Wait a moment and try again.",
        );
      }
    };


  const selectImageFile = async (
    file: File | null | undefined,
  ): Promise<void> => {
    if (!file) return;
    setImageError(null);
    try {
      const prepared = await prepareAskVortaImage(file);
      setPendingImage(prepared);
    } catch (error) {
      setPendingImage(null);
      setImageError(
        error instanceof Error
          ? error.message
          : "The photo could not be prepared for Ask Vorta.",
      );
    }
  };

  const removePendingImage = (): void => {
    setPendingImage(null);
    setImageError(null);
    if (compactImageInputRef.current) {
      compactImageInputRef.current.value = "";
    }
  };

  const runQuestion = async (
    question: string,
    assistantId: string,
    history: VortaAgentHistoryItem[],
    image?: PreparedAskVortaImage,
  ): Promise<void> => {
    try {
      let agentFailureMessage: string | null = null;
      let agentFailureResponseId: string | undefined;

      if (siteContext?.siteId) {
        try {
          const agentAnswer = await askVortaAgent({
            question,
            role: agentRole(roleProfile.role),
            siteId: siteContext.siteId,
            history,
            conversationContext: latestConversationContext(messages),
            image,
            pagePath: window.location.pathname,
          });

          const answer: GlobalAiAnswer = {
            responseId: agentAnswer.responseId,
            directAnswer: agentAnswer.directAnswer,
            decisionSummary: agentAnswer.decisionSummary,
            evidence: agentAnswer.evidence,
            findings: agentAnswer.findings,
            coverOptions: agentAnswer.coverOptions,
            recommendedActions: agentAnswer.recommendedActions,
            actionPlan: agentAnswer.actionPlan,
            followUpQuestions: agentAnswer.followUpQuestions,
            sources: agentAnswer.sources,
            missingData: agentAnswer.missingData,
            confidence: agentAnswer.confidence,
            evidenceLinks: agentAnswer.evidenceLinks,
            evidenceGeneratedAt: agentAnswer.evidenceGeneratedAt,
            conversationContext: agentAnswer.conversationContext,
            roleLabel: roleProfile.label,
            responseBadge: roleProfile.responseBadge,
            intentLabel: agentAnswer.intentLabel,
            roleNote: roleAwareNote(roleProfile),
          };

          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    loading: false,
                    answer,
                    error: undefined,
                    retryQuestion: undefined,
                  }
                : message,
            ),
          );
          return;
        } catch (agentError) {
          agentFailureResponseId =
            agentError instanceof AskVortaAgentError
              ? agentError.responseId
              : undefined;
          agentFailureMessage =
            agentError instanceof Error
              ? agentError.message
              : "The conversational reasoning service was unavailable.";
          console.warn(
            "Ask Vorta agent unavailable; using verified deterministic fallback:",
            agentFailureMessage,
          );
          if (image) {
            throw new Error(
              `${agentFailureMessage} Reattach the photo before retrying; Vorta does not retain image uploads.`,
            );
          }
        }
      }

      if (
        !contextReady ||
        !siteRisk ||
        areaRisks.length === 0 ||
        equipment.length === 0
      ) {
        throw new Error(
          agentFailureMessage ??
            "Vorta site context is not ready.",
        );
      }

      const intent =
        classifyGlobalQuestion(
          question,
        );
      const shiftCoverRange =
        intent === "shift-cover"
          ? resolveShiftCoverDateRange(question)
          : null;

      const mentionedAsset =
        findMentionedEquipment(
          question,
          equipment,
        );

      const topAsset =
        mentionedAsset ??
        [...equipment].sort(
          (first, second) =>
            second.riskScore -
            first.riskScore,
        )[0];

      const sortedEquipmentByRisk =
        [...equipment].sort(
          (first, second) =>
            second.riskScore -
            first.riskScore,
        );

      const sparesAssets =
        intent === "spares-risk"
          ? mentionedAsset
            ? [mentionedAsset]
            : sortedEquipmentByRisk.slice(
                0,
                8,
              )
          : [];

      const knowledgeQuery =
        intent === "evidence" ||
        intent ===
          "equipment-risk" ||
        intent === "pm-risk" ||
        intent === "spares-risk"
          ? `${question} ${
              topAsset?.name ?? ""
            } ${
              topAsset?.assetNumber ??
              ""
            }`.trim()
          : question;

      const [
        knowledgeChunks,
        sparesContext,
        shiftCoverBrief,
      ] = await withTimeout(
        Promise.all(
          [
            topAsset &&
            (
              intent === "evidence" ||
              intent === "equipment-risk" ||
              intent === "pm-risk" ||
              intent === "spares-risk"
            )
              ? searchEquipmentKnowledge(
                  topAsset.id,
                  knowledgeQuery,
                  5,
                )
              : Promise.resolve([] as EquipmentKnowledgeChunk[]),

            intent ===
            "spares-risk"
              ? fetchGlobalSparesContext(
                  sparesAssets,
                )
              : Promise.resolve(
                  null,
                ),

            intent === "shift-cover" &&
            shiftCoverRange &&
            siteContext?.siteId
              ? getShiftCoverAiBrief(
                  siteContext.siteId,
                  shiftCoverRange.startDate,
                  shiftCoverRange.endDate,
                )
              : Promise.resolve(
                  null,
                ),

            new Promise<void>(
              (resolve) => {
                window.setTimeout(
                  resolve,
                  700,
                );
              },
            ),
          ] as const,
        ),
        15000,
        "Vorta AI could not complete the evidence request within 15 seconds.",
      );

      const answer =
        buildGlobalAnswer(
          question,
          siteRisk,
          areaRisks,
          equipment,
          knowledgeChunks,
          roleProfile,
          shiftSkillsContext,
          shiftCoverBrief,
          shiftCoverRange,
          sparesContext,
        );

      if (agentFailureMessage) {
        answer.missingData = unique([
          ...(answer.missingData ?? []),
          "Conversational reasoning is temporarily unavailable; this is the verified Vorta fallback response.",
        ]);
        answer.confidence = Math.min(answer.confidence, 85);
        answer.responseBadge = "Verified Vorta decision pack";
        if (agentFailureResponseId) {
          void markAskVortaFallback(agentFailureResponseId);
        }
      }

      setMessages((previous) =>
        previous.map(
          (message) =>
            message.id ===
            assistantId
              ? {
                  ...message,
                  loading: false,
                  answer,
                  error:
                    undefined,
                  retryQuestion:
                    undefined,
                }
              : message,
        ),
      );
    } catch (error) {
      console.warn(
        "GlobalMaintenanceAiAssistant request failed:",
        error,
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : "";

      const displayError =
        errorMessage.includes(
          "within 15 seconds",
        )
          ? errorMessage
          : "Vorta could not retrieve all required site and source data. No answer was generated from incomplete evidence.";

      setMessages((previous) =>
        previous.map(
          (message) =>
            message.id ===
            assistantId
              ? {
                  ...message,
                  loading: false,
                  answer:
                    undefined,
                  error:
                    displayError,
                  retryQuestion:
                    image ? undefined : question,
                }
              : message,
        ),
      );
    }
  };

  const submitQuestion = (
    question: string,
  ): void => {
    const trimmed = question.trim();
    const image = pendingImage;
    const effectiveQuestion = trimmed || (
      image
        ? "Identify the visible equipment or fault and give the safest evidence-backed next checks."
        : ""
    );

    if (!effectiveQuestion || !agentContextReady) return;

    stopSpeechRecognition(true);

    const requestId =
      `1785872025758-${Math.random().toString(36).slice(2, 8)}`;
    const userId = `global-user-${requestId}`;
    const assistantId = `global-assistant-${requestId}`;

    setMessages((previous) => [
      ...previous,
      {
        id: userId,
        role: "user",
        text: effectiveQuestion,
        imageName: image?.name,
      },
      {
        id: assistantId,
        role: "assistant",
        loading: true,
      },
    ]);

    setInput("");
    setPendingImage(null);
    setImageError(null);
    if (compactImageInputRef.current) {
      compactImageInputRef.current.value = "";
    }

    void runQuestion(
      effectiveQuestion,
      assistantId,
      conversationHistory(messages),
      image ?? undefined,
    );
  };

  const retryFailedQuestion = (
    assistantId: string,
    question: string,
  ): void => {
    if (
      !agentContextReady
    ) {
      return;
    }

    setMessages((previous) =>
      previous.map(
        (message) =>
          message.id ===
          assistantId
            ? {
                ...message,
                loading: true,
                answer:
                  undefined,
                error:
                  undefined,
              }
            : message,
      ),
    );

    void runQuestion(
      question,
      assistantId,
      conversationHistory(messages, assistantId),
    );
  };

  useEffect(() => {
    const handlePromptEvent = (event: Event) => {
      const detail = (event as CustomEvent<GlobalAiPromptEventDetail>).detail;
      const question = detail?.question?.trim() ?? "";

      if (question && shouldHandlePrompt && !shouldHandlePrompt(question)) {
        return;
      }

      setOpen(true);
      setMinimised(false);

      // Role override is accepted in the event detail for future portal-specific assistants.
      if (detail?.role && detail.role !== roleProfile.role) {
        console.warn("GlobalMaintenanceAiAssistant received a prompt for a different role. Current role:", roleProfile.role, "Requested role:", detail.role);
      }

      if (!question) return;

      if (detail?.submit) {
        setPendingPrompt(question);
        setInput("");
      } else {
        setInput(question);
      }
    };

    window.addEventListener("vorta-global-ai-prompt", handlePromptEvent);

    return () => {
      window.removeEventListener("vorta-global-ai-prompt", handlePromptEvent);
    };
  }, [roleProfile.role, shouldHandlePrompt]);

  useEffect(() => {
    if (!open || !agentContextReady || !pendingPrompt) return;

    const question = pendingPrompt;
    setPendingPrompt("");

    void submitQuestion(question);
  }, [open, agentContextReady, pendingPrompt]);


  const resetWorkspaceConversation = (): void => {
    stopSpeechRecognition(true);
    setInput("");
    removePendingImage();
    setMessages([
      {
        id: `global-mm-intro-${Date.now()}`,
        role: "assistant",
        answer: {
          directAnswer: roleProfile.introAnswer,
          decisionSummary: [],
          evidence: [],
          recommendedActions: [roleProfile.defaultAction],
          sources: [],
          confidence: 70,
          roleLabel: roleProfile.label,
          responseBadge: roleProfile.responseBadge,
          intentLabel: "Introduction",
          roleNote: roleAwareNote(roleProfile),
        },
      },
    ]);
  };

  const loadWorkspaceConversation = (
    nextMessages: AskVortaWorkspaceMessage[],
  ): void => {
    stopSpeechRecognition(true);
    setInput("");
    setMessages(nextMessages as GlobalAiMessage[]);
  };

  if (open && workspaceOpen) {
    return (
      <AskVortaWorkspace
        messages={messages as AskVortaWorkspaceMessage[]}
        input={input}
        roleSubtitle={roleProfile.subtitle}
        contextLine={
          shiftSkillsContext
            ? `${roleProfile.contextLine} Shift skills context loaded: ${shiftSkillsContext.shiftLabel}.`
            : roleProfile.contextLine
        }
        contextReady={agentContextReady}
        loadingContext={loadingContext}
        speechSupported={speechSupported}
        listening={listening}
        speechError={speechError}
        pendingImage={pendingImage}
        imageError={imageError}
        onSelectImage={(file) => void selectImageFile(file)}
        onRemoveImage={removePendingImage}
        promptPlaceholder={roleProfile.promptPlaceholder}
        onInputChange={setInput}
        onSubmit={submitQuestion}
        onRetry={retryFailedQuestion}
        onToggleSpeech={toggleSpeechRecognition}
        onCollapse={() => setWorkspaceOpen(false)}
        onClose={() => {
          stopSpeechRecognition(true);
          setWorkspaceOpen(false);
          setOpen(false);
        }}
        onNewConversation={resetWorkspaceConversation}
        onLoadConversation={loadWorkspaceConversation}
        onOpenEvidenceLink={(path) => {
          navigate(path);
          setWorkspaceOpen(false);
        }}
        renderAnswer={(answer: AskVortaWorkspaceAnswer) => (
          <AnswerBlock
            answer={answer as GlobalAiAnswer}
            onFollowUp={submitQuestion}
            presentation="workspace"
          />
        )}
      />
    );
  }

  if (!open) {
    if (!showLauncher) return null;

    return (
      <button
        type="button"
        aria-label="Ask Vorta AI"
        onClick={() => {
          setOpen(true);
          setMinimised(false);
        }}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-xl shadow-blue-950/40 transition-colors hover:bg-blue-500"
      >
        <Bot className="h-4 w-4" />
        Ask Vorta AI
      </button>
    );
  }

  return (
    <div
      data-vorta-global-ai-panel="true"
      className="fixed bottom-4 right-4 z-40 w-[min(500px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-blue-500/20 bg-[#10141d] shadow-2xl shadow-black/60 max-md:inset-0 max-md:flex max-md:h-[100dvh] max-md:w-screen max-md:flex-col max-md:rounded-none max-md:border-0 max-md:bg-[#0b0e14] max-md:shadow-none"
    >
      <div
        data-vorta-global-ai-header="true"
        className="flex min-h-14 items-center justify-between border-b border-gray-800 bg-[#141820] px-4 py-3 max-md:bg-[#0b0e14] max-md:px-3"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
            <Sparkles className="h-4 w-4 text-blue-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Vorta AI</h3>
            <p className="text-xs text-slate-500">{roleProfile.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWorkspaceOpen(true)}
            data-vorta-global-ai-expand="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 max-md:hidden"
            aria-label="Expand Ask Vorta workspace"
            title="Open full Ask Vorta workspace"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!minimised) {
                stopSpeechRecognition(
                  true,
                );
              }

              setMinimised(
                (value) => !value,
              );
            }}
            data-vorta-global-ai-minimise="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 max-md:hidden"
            aria-label="Minimise global assistant"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${minimised ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              stopSpeechRecognition(
                true,
              );

              setOpen(false);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
            aria-label="Close global assistant"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!minimised && (
        <>
          <div className={`border-b border-gray-800 px-4 py-3 ${hasActiveConversation ? "md:hidden" : ""}`}>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {roleProfile.quickQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={
                    !agentContextReady
                  }
                  title={
                    agentContextReady
                      ? question
                      : "An authorised Vorta site is required before analysis"
                  }
                  onClick={() =>
                    submitQuestion(
                      question,
                    )
                  }
                  className="rounded-full border border-gray-700 bg-[#0f1218] px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-700 disabled:hover:text-slate-400"
                >
                  {question}
                </button>
              ))}
            </div>

            <div
              className="text-xs"
              aria-live="polite"
            >
              {loadingContext ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                  Loading verified site context...
                </div>
              ) : contextError ? (
                <div className="flex flex-col gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />

                    <div>
                      <p className="font-semibold text-amber-100">
                        Local fallback context unavailable
                      </p>

                      <p className="mt-0.5 leading-4 text-amber-100/70">
                        Ask Vorta can still query its secure Vorta tools. {contextError}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      loadingContext
                    }
                    onClick={
                      retryContextLoad
                    }
                    className="h-7 w-fit border-amber-500/30 bg-transparent px-2.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/10 hover:text-amber-100"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry context
                  </Button>
                </div>
              ) : contextReady ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />

                  {shiftSkillsContext
                    ? `${roleProfile.contextLine} Shift skills context loaded: ${shiftSkillsContext.shiftLabel}.`
                    : roleProfile.contextLine}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-500">
                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                  Site context has not been verified.
                </div>
              )}
            </div>
          </div>

          <div
            data-vorta-global-ai-messages="true"
            className="flex max-h-[min(56vh,560px)] flex-col gap-3 overflow-y-auto px-4 py-3 max-md:min-h-0 max-md:max-h-none max-md:flex-1"
          >
            {messages.map((message, messageIndex) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} ${
                  hasActiveConversation && messageIndex === 0 ? "md:hidden" : ""
                }`}
              >
                <div
                  className={`max-w-[92%] rounded-lg px-3 py-2 ${message.role === "user" ? "bg-blue-600 text-white" : "border border-gray-800 bg-gray-900/70 text-slate-200"}`}
                >
                  {message.loading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                      Choosing and checking the relevant Vorta sources...
                    </div>
                  ) : message.error ? (
                    <div
                      className="flex flex-col gap-3"
                      role="alert"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />

                        <div>
                          <p className="text-xs font-semibold text-amber-100">
                            Vorta could not complete this analysis
                          </p>

                          <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
                            {
                              message.error
                            }
                          </p>
                        </div>
                      </div>

                      {message.retryQuestion ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            !agentContextReady
                          }
                          onClick={() =>
                            retryFailedQuestion(
                              message.id,
                              message.retryQuestion ??
                                "",
                            )
                          }
                          className="h-7 w-fit border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Retry analysis
                        </Button>
                      ) : null}
                    </div>
                  ) : message.answer ? (
                    <AnswerBlock
                      answer={
                        message.answer
                      }
                      onFollowUp={
                        submitQuestion
                      }
                    />
                  ) : (
                    <div className="space-y-1.5">
                      {message.imageName ? (
                        <p className="hidden text-xs font-semibold text-blue-100/80 md:block">
                          Photo attached: {message.imageName}
                        </p>
                      ) : null}
                      <p className="text-xs leading-relaxed">
                        {message.text}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div
            data-vorta-global-ai-composer="true"
            className="border-t border-gray-800 px-4 py-3 max-md:bg-[#0b0e14] max-md:px-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <input
              ref={compactImageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.[0];
                void selectImageFile(file);
              }}
            />
            {pendingImage ? (
              <div className="mb-2 hidden items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 md:flex">
                <img
                  src={pendingImage.dataUrl}
                  alt="Selected maintenance evidence"
                  className="h-10 w-10 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-200">{pendingImage.name}</p>
                  <p className="text-xs text-slate-500">
                    {pendingImage.width} × {pendingImage.height} · Not saved to Vorta records or Recents
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removePendingImage}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                  aria-label="Remove attached photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {imageError ? (
              <p className="mb-2 hidden text-xs text-amber-300 md:block" role="alert">{imageError}</p>
            ) : null}
            <div
              data-vorta-global-ai-composer-row="true"
              className="flex gap-2"
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => compactImageInputRef.current?.click()}
                disabled={!agentContextReady}
                aria-label="Attach equipment or fault photo"
                title="Attach one JPEG, PNG or WebP photo"
                className="hidden h-8 w-8 shrink-0 border-gray-700 bg-transparent p-0 text-slate-400 hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300 md:inline-flex"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={
                  toggleSpeechRecognition
                }
                disabled={
                  !speechSupported
                }
                aria-pressed={
                  listening
                }
                aria-label={
                  listening
                    ? "Stop voice dictation"
                    : "Start voice dictation"
                }
                title={
                  speechSupported
                    ? listening
                      ? "Stop voice dictation"
                      : "Start voice dictation"
                    : "Voice dictation is not supported by this browser"
                }
                className={`h-8 w-8 shrink-0 p-0 ${
                  listening
                    ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                    : "border-gray-700 bg-transparent text-slate-400 hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {listening ? (
                  <MicOff className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
              </Button>

              <input
                data-vorta-global-ai-input="true"
                type="text"
                placeholder={
                  listening
                    ? "Listening..."
                    : agentContextReady
                      ? roleProfile.promptPlaceholder
                      : "An authorised site is required"
                }
                value={input}
                onChange={(event) =>
                  setInput(
                    event.target.value,
                  )
                }
                onKeyDown={
                  (event) => {
                    if (
                      event.key ===
                        "Enter" &&
                      agentContextReady
                    ) {
                      void submitQuestion(
                        input,
                      );
                    }
                  }
                }
                className={`min-w-0 flex-1 rounded-lg border bg-[#0f1218] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none ${
                  listening
                    ? "border-blue-400/60 ring-1 ring-blue-500/20"
                    : "border-gray-700 focus:border-blue-500/50"
                }`}
              />

              <Button
                type="button"
                onClick={() =>
                  void submitQuestion(
                    input,
                  )
                }
                disabled={
                  (!input.trim() && !pendingImage) ||
                  !agentContextReady
                }
                data-vorta-global-ai-send="true"
                aria-label="Send"
                className="h-8 shrink-0 gap-1 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 max-md:h-10 max-md:w-10 max-md:gap-0 max-md:p-0"
              >
                <Send className="h-3 w-3 max-md:h-[1.125rem] max-md:w-[1.125rem]" aria-hidden="true" />
                <span className="max-md:sr-only">Send</span>
              </Button>
            </div>

            {listening ? (
              <div
                className="mt-2 flex items-center gap-2 text-xs text-blue-300"
                role="status"
                aria-live="polite"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
                </span>
                Listening. Speak naturally, then press the microphone again to stop.
              </div>
            ) : null}

            {speechError ? (
              <div
                className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-2"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />

                <p className="text-xs leading-4 text-amber-100/80">
                  {speechError}
                </p>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
