export type CheckStatus = "pending" | "pass" | "warning" | "fail" | "not_applicable";
export type ScenarioResult = "" | "pass" | "fail" | "blocked";
export type PilotStatus = "DRAFT" | "DATA_PREPARATION" | "REHEARSAL" | "READY" | "LIVE" | "PAUSED" | "COMPLETED";
export type SetupStage = "setup" | "data" | "people" | "rehearsal" | "launch";

export interface PilotCheck {
  key: string;
  stage: "SITE_SETUP" | "DATA_READINESS" | "USER_READINESS" | "LAUNCH";
  label: string;
  description?: string;
  blocking: boolean;
  status: CheckStatus;
  evidence: string | null;
  checkedAt?: string | null;
}

export interface RehearsalScenario {
  key: string;
  order: number;
  title: string;
  objective: string;
  expectedOutcome: string;
  requiredCleanPasses: number;
  blocking: boolean;
  attempts: number;
  cleanPasses: number;
  failures: number;
  blockedAttempts: number;
  complete: boolean;
  latestResult: Exclude<ScenarioResult, ""> | null;
  latestInterventionRequired?: boolean | null;
  latestNotes: string | null;
  latestEvidence: string | null;
  latestIssueReference: string | null;
  lastAttemptAt: string | null;
}

export interface SuccessCriterion {
  key: string;
  label: string;
  target: number;
  unit: string;
}

export interface Participant {
  userId: string;
  name: string;
  role: string;
}

export interface WeeklyReview {
  weekNumber: number;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "complete";
  managerValueScore: number | null;
  dataAccuracyPercent: number | null;
  estimatedTimeSavedMinutes: number | null;
  risksIdentified: number;
  followThroughActions: number;
  summary: string | null;
  blockers: string | null;
  nextActions: string | null;
  completedAt: string | null;
}

export interface PilotSetupReport {
  reportVersion: string;
  generatedAt: string;
  site: {
    id: string;
    name: string;
    region: string | null;
    timezone: string;
  };
  pilot: {
    id: string;
    status: PilotStatus;
    objective: string | null;
    plannedStartDate: string | null;
    plannedEndDate: string | null;
    actualStartAt: string | null;
    actualEndAt: string | null;
    knownLimitations: string | null;
    successCriteria: SuccessCriterion[];
    baselineSnapshotDate: string | null;
    launchConfirmedAt: string | null;
    pilotOwnerUserId: string | null;
    managerContactUserId: string | null;
    pilotOwnerName?: string | null;
    managerContactName?: string | null;
    availableParticipants?: Participant[];
  };
  readiness: {
    score: number;
    launchEligible: boolean;
    automatedBlockers: number;
    manualBlockers: number;
    rehearsalBlockers: number;
    recommendedNextAction: string;
    automatedChecks: PilotCheck[];
    manualChecks: PilotCheck[];
  };
  rehearsal: {
    complete: boolean;
    totalScenarios: number;
    completedScenarios: number;
    cleanPasses: number;
    scenarios: RehearsalScenario[];
  };
  weeklyReviews: WeeklyReview[];
}

export interface ConfigurationDraft {
  objective: string;
  plannedStartDate: string;
  plannedEndDate: string;
  knownLimitations: string;
}

export interface AttemptDraft {
  result: ScenarioResult;
  durationMinutes: string;
  interventionRequired: boolean;
  notes: string;
  evidence: string;
  issueReference: string;
}

export interface WeeklyReviewDraft {
  weekNumber: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "complete";
  managerValueScore: string;
  dataAccuracyPercent: string;
  estimatedTimeSavedMinutes: string;
  risksIdentified: string;
  followThroughActions: string;
  summary: string;
  blockers: string;
  nextActions: string;
}

export interface Notice {
  kind: "success" | "error";
  text: string;
}

export const STATUS_STYLES: Record<CheckStatus, string> = {
  pass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  fail: "border-red-500/25 bg-red-500/10 text-red-300",
  pending: "border-slate-500/25 bg-slate-500/10 text-slate-300",
  not_applicable: "border-slate-500/25 bg-slate-500/10 text-slate-400",
};

export const PILOT_STATUS_STYLES: Record<PilotStatus, string> = {
  DRAFT: "border-slate-500/25 bg-slate-500/10 text-slate-300",
  DATA_PREPARATION: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  REHEARSAL: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  READY: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  LIVE: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  PAUSED: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  COMPLETED: "border-slate-500/25 bg-slate-500/10 text-slate-300",
};

export function localDateIso(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDaysIso(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateIso(date);
}

export function formatDate(value: string | null): string {
  if (!value) return "Not set";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function statusLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function scoreClass(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-blue-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

export function blankAttemptDraft(): AttemptDraft {
  return {
    result: "",
    durationMinutes: "",
    interventionRequired: false,
    notes: "",
    evidence: "",
    issueReference: "",
  };
}

export function blankWeeklyDraft(today: string): WeeklyReviewDraft {
  return {
    weekNumber: "0",
    periodStart: today,
    periodEnd: today,
    status: "draft",
    managerValueScore: "",
    dataAccuracyPercent: "",
    estimatedTimeSavedMinutes: "",
    risksIdentified: "0",
    followThroughActions: "0",
    summary: "",
    blockers: "",
    nextActions: "",
  };
}
