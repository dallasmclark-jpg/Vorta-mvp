import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ClipboardCheck,
  Database,
  FileCheck2,
  Flag,
  Gauge,
  PlayCircle,
  RefreshCw,
  Rocket,
  Save,
  ShieldCheck,
  TestTube2,
  UsersRound,
  XCircle,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabaseClient";

type CheckStatus = "pending" | "pass" | "warning" | "fail" | "not_applicable";
type ScenarioResult = "pass" | "fail" | "blocked";
type PilotStage = "SITE_SETUP" | "DATA_READINESS" | "USER_READINESS" | "LAUNCH";

interface PilotCheck {
  key: string;
  stage: PilotStage;
  label: string;
  description?: string;
  blocking: boolean;
  status: CheckStatus;
  evidence: string | null;
  checkedAt?: string | null;
}

interface RehearsalScenario {
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
  latestResult: ScenarioResult | null;
  latestNotes: string | null;
  latestEvidence: string | null;
  latestIssueReference: string | null;
  lastAttemptAt: string | null;
}

interface WeeklyReview {
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

interface PilotSetupReport {
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
    status: "DRAFT" | "DATA_PREPARATION" | "REHEARSAL" | "READY" | "LIVE" | "PAUSED" | "COMPLETED";
    objective: string | null;
    plannedStartDate: string | null;
    plannedEndDate: string | null;
    actualStartAt: string | null;
    actualEndAt: string | null;
    knownLimitations: string | null;
    successCriteria: Array<{
      key: string;
      label: string;
      target: number;
      unit: string;
    }>;
    baselineSnapshotDate: string | null;
    launchConfirmedAt: string | null;
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

interface AttemptDraft {
  result: ScenarioResult;
  durationMinutes: string;
  interventionRequired: boolean;
  notes: string;
  evidence: string;
  issueReference: string;
}

interface WeeklyReviewDraft {
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

const STATUS_STYLES: Record<CheckStatus, string> = {
  pass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  fail: "border-red-500/25 bg-red-500/10 text-red-300",
  pending: "border-slate-500/25 bg-slate-500/10 text-slate-300",
  not_applicable: "border-slate-500/25 bg-slate-500/10 text-slate-400",
};

const PILOT_STATUS_STYLES: Record<PilotSetupReport["pilot"]["status"], string> = {
  DRAFT: "border-slate-500/25 bg-slate-500/10 text-slate-300",
  DATA_PREPARATION: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  REHEARSAL: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  READY: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  LIVE: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  PAUSED: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  COMPLETED: "border-slate-500/25 bg-slate-500/10 text-slate-300",
};

const STAGE_LABELS: Record<PilotStage, string> = {
  SITE_SETUP: "Site setup",
  DATA_READINESS: "Data readiness",
  USER_READINESS: "User readiness",
  LAUNCH: "Launch",
};

function localDateIso(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function addDaysIso(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateIso(date);
}

function formatDate(value: string | null): string {
  if (!value) return "Not set";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null): string {
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

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusIcon(status: CheckStatus): typeof CheckCircle2 {
  if (status === "pass") return CheckCircle2;
  if (status === "warning") return AlertTriangle;
  if (status === "fail") return XCircle;
  return CircleDashed;
}

function statusLabel(status: CheckStatus): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function scoreClass(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-blue-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function stageProgress(checks: PilotCheck[]): { complete: number; total: number } {
  return {
    complete: checks.filter((check) => check.status === "pass" || check.status === "not_applicable").length,
    total: checks.length,
  };
}

function ProgressBar({ value }: { value: number }): JSX.Element {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-slate-800"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeValue)}
    >
      <div
        className="h-full rounded-full bg-blue-500 transition-[width] duration-500"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

function LoadingState(): JSX.Element {
  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">
      <div className="h-28 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
      <div className="grid gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
    </section>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Gauge;
  label: string;
  value: string | number;
  detail: string;
}): JSX.Element {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
          <Icon className="h-4 w-4 text-blue-400" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="mt-1 text-xl font-bold text-slate-50">{value}</p>
          <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export const PilotSetupSection = (): JSX.Element => {
  const { siteContext } = useAuth();
  const today = useMemo(() => localDateIso(), []);
  const [report, setReport] = useState<PilotSetupReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [objective, setObjective] = useState("");
  const [plannedStartDate, setPlannedStartDate] = useState(today);
  const [plannedEndDate, setPlannedEndDate] = useState(addDaysIso(today, 28));
  const [knownLimitations, setKnownLimitations] = useState("");
  const [manualEvidence, setManualEvidence] = useState<Record<string, string>>({});
  const [attemptDrafts, setAttemptDrafts] = useState<Record<string, AttemptDraft>>({});
  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyReviewDraft>({
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
  });

  const applyReport = useCallback((nextReport: PilotSetupReport): void => {
    setReport(nextReport);
    setObjective(nextReport.pilot.objective ?? "");
    setPlannedStartDate(nextReport.pilot.plannedStartDate ?? today);
    setPlannedEndDate(nextReport.pilot.plannedEndDate ?? addDaysIso(today, 28));
    setKnownLimitations(nextReport.pilot.knownLimitations ?? "");
    setManualEvidence(
      Object.fromEntries(nextReport.readiness.manualChecks.map((check) => [check.key, check.evidence ?? ""])),
    );
    setAttemptDrafts((current) => {
      const next = { ...current };
      nextReport.rehearsal.scenarios.forEach((scenario) => {
        next[scenario.key] ??= {
          result: "pass",
          durationMinutes: "",
          interventionRequired: false,
          notes: "",
          evidence: "",
          issueReference: "",
        };
      });
      return next;
    });
  }, [today]);

  const loadReport = useCallback(async (): Promise<void> => {
    const siteId = siteContext?.siteId;
    if (!siteId) {
      setReport(null);
      setError("A maintenance site could not be resolved for this account.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("vorta_get_pilot_setup", {
      p_site_id: siteId,
    });

    if (rpcError || !data) {
      setReport(null);
      setError(rpcError?.message ?? "Pilot setup is not available for this site.");
      setLoading(false);
      return;
    }

    applyReport(data as PilotSetupReport);
    setLoading(false);
  }, [applyReport, siteContext?.siteId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const runMutation = useCallback(async (
    key: string,
    rpcName: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> => {
    setSavingKey(key);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc(rpcName, payload);
    if (rpcError || !data) {
      setError(rpcError?.message ?? "The pilot workflow could not be updated.");
      setSavingKey(null);
      return false;
    }
    applyReport(data as PilotSetupReport);
    setSavingKey(null);
    return true;
  }, [applyReport]);

  const saveConfiguration = (): void => {
    const siteId = siteContext?.siteId;
    if (!siteId) return;
    if (plannedStartDate && plannedEndDate && plannedEndDate < plannedStartDate) {
      setError("The pilot end date must be on or after the start date.");
      return;
    }
    void runMutation("configuration", "vorta_update_pilot_configuration", {
      p_site_id: siteId,
      p_objective: objective,
      p_planned_start_date: plannedStartDate || null,
      p_planned_end_date: plannedEndDate || null,
      p_known_limitations: knownLimitations,
    });
  };

  const updateManualCheck = (check: PilotCheck, status: CheckStatus): void => {
    const siteId = siteContext?.siteId;
    if (!siteId) return;
    void runMutation(`check:${check.key}`, "vorta_update_pilot_manual_check", {
      p_site_id: siteId,
      p_item_key: check.key,
      p_status: status,
      p_evidence: manualEvidence[check.key] ?? "",
    });
  };

  const updateAttemptDraft = (scenarioKey: string, patch: Partial<AttemptDraft>): void => {
    setAttemptDrafts((current) => ({
      ...current,
      [scenarioKey]: {
        ...(current[scenarioKey] ?? {
          result: "pass",
          durationMinutes: "",
          interventionRequired: false,
          notes: "",
          evidence: "",
          issueReference: "",
        }),
        ...patch,
      },
    }));
  };

  const recordAttempt = (scenario: RehearsalScenario): void => {
    const siteId = siteContext?.siteId;
    const draft = attemptDrafts[scenario.key];
    if (!siteId || !draft) return;
    void runMutation(`scenario:${scenario.key}`, "vorta_record_pilot_rehearsal_attempt", {
      p_site_id: siteId,
      p_scenario_key: scenario.key,
      p_result: draft.result,
      p_duration_minutes: numberOrNull(draft.durationMinutes),
      p_intervention_required: draft.interventionRequired,
      p_notes: draft.notes,
      p_evidence: draft.evidence,
      p_issue_reference: draft.issueReference,
    }).then((updated) => {
      if (!updated) return;
      updateAttemptDraft(scenario.key, {
        durationMinutes: "",
        interventionRequired: false,
        notes: "",
        evidence: "",
        issueReference: "",
      });
    });
  };

  const saveWeeklyReview = (): void => {
    const siteId = siteContext?.siteId;
    const weekNumber = Number(weeklyDraft.weekNumber);
    if (!siteId) return;
    if (!Number.isInteger(weekNumber) || weekNumber < 0 || weekNumber > 52) {
      setError("Week number must be between 0 and 52.");
      return;
    }
    if (!weeklyDraft.periodStart || !weeklyDraft.periodEnd) {
      setError("Choose both weekly review dates.");
      return;
    }
    if (weeklyDraft.periodEnd < weeklyDraft.periodStart) {
      setError("The weekly review end date must be on or after the start date.");
      return;
    }

    void runMutation(`week:${weekNumber}`, "vorta_upsert_pilot_weekly_review", {
      p_site_id: siteId,
      p_week_number: weekNumber,
      p_period_start: weeklyDraft.periodStart,
      p_period_end: weeklyDraft.periodEnd,
      p_status: weeklyDraft.status,
      p_manager_value_score: numberOrNull(weeklyDraft.managerValueScore),
      p_data_accuracy_percent: numberOrNull(weeklyDraft.dataAccuracyPercent),
      p_estimated_time_saved_minutes: numberOrNull(weeklyDraft.estimatedTimeSavedMinutes),
      p_risks_identified: Number(weeklyDraft.risksIdentified || 0),
      p_follow_through_actions: Number(weeklyDraft.followThroughActions || 0),
      p_summary: weeklyDraft.summary,
      p_blockers: weeklyDraft.blockers,
      p_next_actions: weeklyDraft.nextActions,
    });
  };

  const launchPilot = (): void => {
    const siteId = siteContext?.siteId;
    if (!siteId || !report?.readiness.launchEligible) return;
    void runMutation("launch", "vorta_launch_pilot", { p_site_id: siteId });
  };

  if (loading) return <LoadingState />;

  if (!report) {
    return (
      <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">
        <header className="py-5">
          <p className="text-xs font-medium text-slate-400">Pilot administration</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">Pilot Setup</h1>
        </header>
        <Card className="rounded-xl border border-red-500/20 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-100">Pilot setup could not be loaded</p>
              <p className="mt-1 text-sm text-slate-400">{error}</p>
            </div>
            <button type="button" onClick={() => void loadReport()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-50 hover:bg-white/15">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const combinedChecks = [...report.readiness.automatedChecks, ...report.readiness.manualChecks];
  const stageCards = [
    { key: "site", label: "Site setup", icon: ClipboardCheck, ...stageProgress(combinedChecks.filter((check) => check.stage === "SITE_SETUP")), detail: "Objective, dates, owner and success criteria" },
    { key: "data", label: "Data readiness", icon: Database, ...stageProgress(combinedChecks.filter((check) => check.stage === "DATA_READINESS")), detail: "SAP evidence, skills, documents and backend health" },
    { key: "user", label: "User readiness", icon: UsersRound, ...stageProgress(combinedChecks.filter((check) => check.stage === "USER_READINESS")), detail: "Access, device, scope and limitations" },
    { key: "rehearsal", label: "Rehearsal", icon: TestTube2, complete: report.rehearsal.completedScenarios, total: report.rehearsal.totalScenarios, detail: "Two clean passes required per scenario" },
    { key: "launch", label: "Launch", icon: Rocket, ...stageProgress(combinedChecks.filter((check) => check.stage === "LAUNCH")), detail: report.readiness.launchEligible ? "Ready to activate" : "Launch remains blocked" },
  ];

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
      <header className="flex w-full flex-col gap-4 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">Pilot administration</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">Pilot Setup</h1>
            <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] font-bold shadow-none ${PILOT_STATUS_STYLES[report.pilot.status]}`}>
              {report.pilot.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">Configure, rehearse and launch the Maintenance Manager pilot for {report.site.name}.</p>
        </div>
        <button type="button" onClick={() => void loadReport()} disabled={savingKey !== null} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-800 bg-[#141820] px-4 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:cursor-wait disabled:opacity-60">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh checks
        </button>
      </header>

      {error ? <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="grid gap-6 p-5 md:p-6 xl:grid-cols-[220px_1fr_auto] xl:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Launch readiness</p>
            <p className={`mt-1 text-4xl font-bold ${scoreClass(report.readiness.score)}`}>{report.readiness.score.toFixed(1)}%</p>
          </div>
          <div>
            <ProgressBar value={report.readiness.score} />
            <p className="mt-3 text-sm text-slate-300">{report.readiness.recommendedNextAction}</p>
            <p className="mt-1 text-xs text-slate-500">Baseline: {formatDate(report.pilot.baselineSnapshotDate)} · Report {report.reportVersion}</p>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-5 w-5 ${report.readiness.launchEligible ? "text-emerald-400" : "text-amber-400"}`} aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-200">{report.readiness.launchEligible ? "Launch gate passed" : "Launch gate blocked"}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Gauge} label="Readiness score" value={`${report.readiness.score.toFixed(1)}%`} detail="Automated, manual and rehearsal evidence" />
        <SummaryCard icon={Database} label="Automated blockers" value={report.readiness.automatedBlockers} detail="Configuration or source-data gates" />
        <SummaryCard icon={ClipboardCheck} label="Manual blockers" value={report.readiness.manualBlockers} detail="Manager confirmations still required" />
        <SummaryCard icon={TestTube2} label="Rehearsal complete" value={`${report.rehearsal.completedScenarios}/${report.rehearsal.totalScenarios}`} detail={`${report.rehearsal.cleanPasses} clean passes recorded`} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {stageCards.map((stage) => {
          const Icon = stage.icon;
          const complete = stage.total > 0 && stage.complete === stage.total;
          return (
            <Card key={stage.key} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${complete ? "bg-emerald-500/10" : "bg-blue-500/10"}`}>
                    <Icon className={`h-4 w-4 ${complete ? "text-emerald-400" : "text-blue-400"}`} aria-hidden="true" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{stage.complete}/{stage.total}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-100">{stage.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{stage.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="mb-5 flex items-center gap-2">
            <Flag className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">1. Pilot configuration</h2>
              <p className="mt-0.5 text-xs text-slate-500">Define the problem, period and known limitations before asking the site to judge the outcome.</p>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium text-slate-400 xl:col-span-2">
              Pilot objective
              <textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={3} maxLength={2000} placeholder="State the operational problem and what the pilot must prove." className="min-h-[92px] rounded-lg border border-gray-800 bg-[#10141b] px-3 py-2 text-sm leading-6 text-slate-200 outline-none focus:border-blue-500/60" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-400">
              Planned start
              <input type="date" value={plannedStartDate} onChange={(event) => setPlannedStartDate(event.target.value)} className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-400">
              Planned end
              <input type="date" value={plannedEndDate} min={plannedStartDate || undefined} onChange={(event) => setPlannedEndDate(event.target.value)} className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-400 xl:col-span-2">
              Known limitations
              <textarea value={knownLimitations} onChange={(event) => setKnownLimitations(event.target.value)} rows={3} maxLength={5000} placeholder="Record data gaps, unsupported workflows and anything the site must understand before launch." className="min-h-[92px] rounded-lg border border-gray-800 bg-[#10141b] px-3 py-2 text-sm leading-6 text-slate-200 outline-none focus:border-blue-500/60" />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={saveConfiguration} disabled={savingKey !== null} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">
              {savingKey === "configuration" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
              Save configuration
            </button>
          </div>
          <div className="mt-6 border-t border-gray-800 pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Default success criteria</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {report.pilot.successCriteria.map((criterion) => (
                <div key={criterion.key} className="rounded-lg border border-gray-800 bg-[#10141b] px-3 py-3">
                  <p className="text-xs font-semibold text-slate-200">{criterion.label}</p>
                  <p className="mt-1 text-sm font-bold text-blue-300">{criterion.target} {criterion.unit}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="mb-5 flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">2. Automated readiness gates</h2>
              <p className="mt-0.5 text-xs text-slate-500">Calculated from current site data and backend health. These cannot be manually overridden.</p>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {report.readiness.automatedChecks.map((check) => {
              const Icon = statusIcon(check.status);
              return (
                <div key={check.key} className="rounded-lg border border-gray-800 bg-[#10141b] p-4">
                  <div className="flex items-start gap-3">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${check.status === "pass" ? "text-emerald-400" : check.status === "warning" ? "text-amber-400" : check.status === "fail" ? "text-red-400" : "text-slate-500"}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-200">{check.label}</p>
                        <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] font-bold shadow-none ${STATUS_STYLES[check.status]}`}>{statusLabel(check.status)}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{check.evidence}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{STAGE_LABELS[check.stage]}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="mb-5 flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">3. Manual readiness confirmations</h2>
              <p className="mt-0.5 text-xs text-slate-500">Record evidence for checks that source data cannot prove.</p>
            </div>
          </div>
          <div className="grid gap-3">
            {report.readiness.manualChecks.map((check) => {
              const Icon = statusIcon(check.status);
              const isSaving = savingKey === `check:${check.key}`;
              return (
                <div key={check.key} className="rounded-lg border border-gray-800 bg-[#10141b] p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${check.status === "pass" ? "text-emerald-400" : check.status === "warning" ? "text-amber-400" : check.status === "fail" ? "text-red-400" : "text-slate-500"}`} aria-hidden="true" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-200">{check.label}</p>
                          <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] font-bold shadow-none ${STATUS_STYLES[check.status]}`}>{statusLabel(check.status)}</Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{check.description}</p>
                      </div>
                    </div>
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_auto]">
                      <input value={manualEvidence[check.key] ?? ""} onChange={(event) => setManualEvidence((current) => ({ ...current, [check.key]: event.target.value }))} maxLength={2000} placeholder="Evidence, date, meeting or test result" className="h-9 min-w-0 rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => updateManualCheck(check, "pass")} disabled={savingKey !== null} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50">
                          {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                          Pass
                        </button>
                        <button type="button" onClick={() => updateManualCheck(check, "fail")} disabled={savingKey !== null} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/15 disabled:opacity-50">
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Fail
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="mb-5 flex items-center gap-2">
            <TestTube2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">4. Pilot rehearsal</h2>
              <p className="mt-0.5 text-xs text-slate-500">Every scenario requires two successful passes without intervention before launch.</p>
            </div>
          </div>
          <div className="grid gap-3">
            {report.rehearsal.scenarios.map((scenario) => {
              const draft = attemptDrafts[scenario.key];
              const isSaving = savingKey === `scenario:${scenario.key}`;
              return (
                <details key={scenario.key} className="group rounded-lg border border-gray-800 bg-[#10141b]">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${scenario.complete ? "bg-emerald-500/10" : "bg-blue-500/10"}`}>
                      {scenario.complete ? <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" /> : <span className="text-xs font-bold text-blue-300">{scenario.order}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-200">{scenario.title}</p>
                        <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] font-bold shadow-none ${scenario.complete ? STATUS_STYLES.pass : STATUS_STYLES.pending}`}>{scenario.cleanPasses}/{scenario.requiredCleanPasses} clean passes</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{scenario.objective}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <div className="border-t border-gray-800 p-4">
                    <div className="rounded-lg border border-blue-500/15 bg-blue-500/5 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-300">Expected outcome</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{scenario.expectedOutcome}</p>
                    </div>
                    {scenario.lastAttemptAt ? <div className="mt-3 text-xs text-slate-500">Latest: {statusLabel((scenario.latestResult ?? "pending") as CheckStatus)} · {formatDateTime(scenario.lastAttemptAt)}{scenario.latestIssueReference ? ` · Issue ${scenario.latestIssueReference}` : ""}</div> : null}
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <label className="grid gap-1 text-[11px] font-medium text-slate-400">
                        Result
                        <select value={draft?.result ?? "pass"} onChange={(event) => updateAttemptDraft(scenario.key, { result: event.target.value as ScenarioResult })} className="h-9 rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60">
                          <option value="pass">Pass</option><option value="fail">Fail</option><option value="blocked">Blocked</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-[11px] font-medium text-slate-400">
                        Duration, minutes
                        <input type="number" min={0} max={1440} value={draft?.durationMinutes ?? ""} onChange={(event) => updateAttemptDraft(scenario.key, { durationMinutes: event.target.value })} className="h-9 rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60" />
                      </label>
                      <label className="flex h-9 items-center gap-2 self-end rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-xs text-slate-300">
                        <input type="checkbox" checked={draft?.interventionRequired ?? false} onChange={(event) => updateAttemptDraft(scenario.key, { interventionRequired: event.target.checked })} className="h-4 w-4 rounded border-gray-700 bg-slate-900" />
                        Intervention required
                      </label>
                      <label className="grid gap-1 text-[11px] font-medium text-slate-400 lg:col-span-3">
                        Notes
                        <textarea rows={2} value={draft?.notes ?? ""} onChange={(event) => updateAttemptDraft(scenario.key, { notes: event.target.value })} maxLength={3000} placeholder="What happened, where the workflow was unclear, and whether help was required." className="rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-blue-500/60" />
                      </label>
                      <label className="grid gap-1 text-[11px] font-medium text-slate-400 lg:col-span-2">
                        Evidence
                        <input value={draft?.evidence ?? ""} onChange={(event) => updateAttemptDraft(scenario.key, { evidence: event.target.value })} maxLength={2000} placeholder="Screenshot, record or observed evidence" className="h-9 rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60" />
                      </label>
                      <label className="grid gap-1 text-[11px] font-medium text-slate-400">
                        Issue reference
                        <input value={draft?.issueReference ?? ""} onChange={(event) => updateAttemptDraft(scenario.key, { issueReference: event.target.value })} maxLength={500} placeholder="Optional issue or ticket" className="h-9 rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60" />
                      </label>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button type="button" onClick={() => recordAttempt(scenario)} disabled={savingKey !== null} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">
                        {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                        Record attempt
                      </button>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="mb-5 flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">5. Weekly pilot review</h2>
              <p className="mt-0.5 text-xs text-slate-500">Capture adoption, evidence quality, time saving, blockers and the next action without rewriting the story at the end.</p>
            </div>
          </div>

          {report.weeklyReviews.length > 0 ? (
            <div className="mb-5 grid gap-3 lg:grid-cols-2">
              {report.weeklyReviews.map((review) => (
                <div key={review.weekNumber} className="rounded-lg border border-gray-800 bg-[#10141b] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-200">Week {review.weekNumber}</p>
                    <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] font-bold shadow-none ${review.status === "complete" ? STATUS_STYLES.pass : STATUS_STYLES.pending}`}>{review.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(review.periodStart)} to {formatDate(review.periodEnd)}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span className="text-slate-500">Manager value</span><span className="text-right font-semibold text-slate-300">{review.managerValueScore ?? "Not scored"}</span>
                    <span className="text-slate-500">Data accuracy</span><span className="text-right font-semibold text-slate-300">{review.dataAccuracyPercent == null ? "Not scored" : `${review.dataAccuracyPercent}%`}</span>
                    <span className="text-slate-500">Time saved</span><span className="text-right font-semibold text-slate-300">{review.estimatedTimeSavedMinutes == null ? "Not estimated" : `${review.estimatedTimeSavedMinutes} min`}</span>
                    <span className="text-slate-500">Risks / actions</span><span className="text-right font-semibold text-slate-300">{review.risksIdentified} / {review.followThroughActions}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="mb-5 rounded-lg border border-dashed border-gray-800 bg-[#10141b] px-4 py-5 text-sm text-slate-500">No weekly reviews have been recorded. Week 0 can be used for the baseline conversation.</div>}

          <div className="grid gap-3 lg:grid-cols-3">
            <label className="grid gap-1 text-[11px] font-medium text-slate-400">Week number<input type="number" min={0} max={52} value={weeklyDraft.weekNumber} onChange={(event) => setWeeklyDraft((current) => ({ ...current, weekNumber: event.target.value }))} className="h-9 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60" /></label>
            <label className="grid gap-1 text-[11px] font-medium text-slate-400">Period start<input type="date" value={weeklyDraft.periodStart} onChange={(event) => setWeeklyDraft((current) => ({ ...current, periodStart: event.target.value }))} className="h-9 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60" /></label>
            <label className="grid gap-1 text-[11px] font-medium text-slate-400">Period end<input type="date" value={weeklyDraft.periodEnd} min={weeklyDraft.periodStart || undefined} onChange={(event) => setWeeklyDraft((current) => ({ ...current, periodEnd: event.target.value }))} className="h-9 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60" /></label>
            <label className="grid gap-1 text-[11px] font-medium text-slate-400">Manager value, 0–10<input type="number" min={0} max={10} step={0.1} value={weeklyDraft.managerValueScore} onChange={(event) => setWeeklyDraft((current) => ({ ...current, managerValueScore: event.target.value }))} className="h-9 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60" /></label>
            <label className="grid gap-1 text-[11px] font-medium text-slate-400">Data accuracy, %<input type="number" min={0} max={100} step={0.1} value={weeklyDraft.dataAccuracyPercent} onChange={(event) => setWeeklyDraft((current) => ({ ...current, dataAccuracyPercent: event.target.value }))} className="h-9 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60" /></label>
            <label className="grid gap-1 text-[11px] font-medium text-slate-400">Estimated time saved, minutes<input type="number" min={0} value={weeklyDraft.estimatedTimeSavedMinutes} onChange={(event) => setWeeklyDraft((current) => ({ ...current, estimatedTimeSavedMinutes: event.target.value }))} className="h-9 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60" /></label>
            <label className="grid gap-1 text-[11px] font-medium text-slate-400">Risks identified<input type="number" min={0} value={weeklyDraft.risksIdentified} onChange={(event) => setWeeklyDraft((current) => ({ ...current, risksIdentified: event.target.value }))} className="h-9 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60" /></label>
            <label className="grid gap-1 text-[11px] font-medium text-slate-400">Follow-through actions<input type="number" min={0} value={weeklyDraft.followThroughActions} onChange={(event) => setWeeklyDraft((current) => ({ ...current, followThroughActions: event.target.value }))} className="h-9 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60" /></label>
            <label className="grid gap-1 text-[11px] font-medium text-slate-400">Review status<select value={weeklyDraft.status} onChange={(event) => setWeeklyDraft((current) => ({ ...current, status: event.target.value as "draft" | "complete" }))} className="h-9 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60"><option value="draft">Draft</option><option value="complete">Complete</option></select></label>
            <label className="grid gap-1 text-[11px] font-medium text-slate-400 lg:col-span-3">Summary<textarea rows={3} value={weeklyDraft.summary} onChange={(event) => setWeeklyDraft((current) => ({ ...current, summary: event.target.value }))} maxLength={5000} className="rounded-lg border border-gray-800 bg-[#10141b] px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-blue-500/60" /></label>
            <label className="grid gap-1 text-[11px] font-medium text-slate-400 lg:col-span-3">Blockers<textarea rows={2} value={weeklyDraft.blockers} onChange={(event) => setWeeklyDraft((current) => ({ ...current, blockers: event.target.value }))} maxLength={3000} className="rounded-lg border border-gray-800 bg-[#10141b] px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-blue-500/60" /></label>
            <label className="grid gap-1 text-[11px] font-medium text-slate-400 lg:col-span-3">Next actions<textarea rows={2} value={weeklyDraft.nextActions} onChange={(event) => setWeeklyDraft((current) => ({ ...current, nextActions: event.target.value }))} maxLength={3000} className="rounded-lg border border-gray-800 bg-[#10141b] px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-blue-500/60" /></label>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={saveWeeklyReview} disabled={savingKey !== null} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">
              {savingKey?.startsWith("week:") ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
              Save weekly review
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className={`rounded-xl border shadow-none ${report.readiness.launchEligible ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/20 bg-[#141820]"}`}>
        <CardContent className="flex flex-col gap-5 p-5 md:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${report.readiness.launchEligible ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
              <Rocket className={`h-5 w-5 ${report.readiness.launchEligible ? "text-emerald-400" : "text-amber-400"}`} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{report.pilot.status === "LIVE" ? "Pilot is live" : report.readiness.launchEligible ? "Ready to launch" : "Launch remains blocked"}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                {report.pilot.status === "LIVE"
                  ? `Launched ${formatDateTime(report.pilot.launchConfirmedAt)}. Use the weekly review cycle to keep adoption and operational evidence honest.`
                  : report.readiness.launchEligible
                    ? "Every blocking readiness check and rehearsal scenario has passed. Launching records the actual start time and freezes the decision point."
                    : `${report.readiness.automatedBlockers} automated, ${report.readiness.manualBlockers} manual and ${report.readiness.rehearsalBlockers} rehearsal blockers remain.`}
              </p>
            </div>
          </div>
          <button type="button" onClick={launchPilot} disabled={!report.readiness.launchEligible || report.pilot.status === "LIVE" || savingKey !== null} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">
            {savingKey === "launch" ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Rocket className="h-4 w-4" aria-hidden="true" />}
            {report.pilot.status === "LIVE" ? "Pilot live" : "Launch pilot"}
          </button>
        </CardContent>
      </Card>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-5 text-xs text-slate-600">
        <span>Generated {formatDateTime(report.generatedAt)}</span>
        <span>Site-scoped internal pilot workflow · SAP remains read-only</span>
      </footer>
    </section>
  );
};
