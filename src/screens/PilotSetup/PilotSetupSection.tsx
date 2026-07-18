import { useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Database,
  RefreshCw,
  Rocket,
  ShieldCheck,
  TestTube2,
  UsersRound,
  X,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { PilotSetupDataStage } from "./PilotSetupDataStage";
import { PilotSetupLaunchStage } from "./PilotSetupLaunchStage";
import { PilotSetupPeopleStage } from "./PilotSetupPeopleStage";
import { PilotSetupRehearsalStage } from "./PilotSetupRehearsalStage";
import { PilotSetupSetupStage } from "./PilotSetupSetupStage";
import { LoadingState, ProgressBar } from "./PilotSetupShared";
import {
  type PilotSetupReport,
  type SetupStage,
  PILOT_STATUS_STYLES,
  formatDate,
  scoreClass,
} from "./pilotSetupModel";
import { usePilotSetup } from "./usePilotSetup";

const STAGES: Array<{
  key: SetupStage;
  label: string;
  description: string;
  icon: typeof ClipboardCheck;
}> = [
  {
    key: "setup",
    label: "Setup",
    description: "Objective, dates, people and success criteria",
    icon: ClipboardCheck,
  },
  {
    key: "data",
    label: "Data",
    description: "Automated source-data and backend gates",
    icon: Database,
  },
  {
    key: "people",
    label: "People",
    description: "Access, scope and readiness evidence",
    icon: UsersRound,
  },
  {
    key: "rehearsal",
    label: "Rehearsal",
    description: "Two consecutive clean passes per scenario",
    icon: TestTube2,
  },
  {
    key: "launch",
    label: "Launch",
    description: "Final confirmation and weekly evidence",
    icon: Rocket,
  },
];

function LaunchDialog({
  report,
  busy,
  onCancel,
  onConfirm,
}: {
  report: PilotSetupReport;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !busy) onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pilot-launch-title"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-emerald-500/25 bg-[#121821] shadow-2xl shadow-black/50"
      >
        <header className="flex items-start justify-between gap-4 border-b border-gray-800 px-5 py-5 md:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <Rocket className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            </div>
            <div>
              <h2 id="pilot-launch-title" className="text-lg font-semibold text-slate-50">
                Confirm pilot launch
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                This records the actual start time and the administrator who approved the launch.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close launch confirmation"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-100 disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="grid gap-4 px-5 py-5 md:grid-cols-2 md:px-6">
          <div className="rounded-xl border border-gray-800 bg-[#0f141b] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Site
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{report.site.name}</p>
            <p className="mt-1 text-xs text-slate-500">{report.site.region ?? "Region not recorded"}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0f141b] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Planned period
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              {formatDate(report.pilot.plannedStartDate)} to {formatDate(report.pilot.plannedEndDate)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Readiness {report.readiness.score.toFixed(1)}%</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0f141b] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Pilot owner
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              {report.pilot.pilotOwnerName ?? "Not recorded"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0f141b] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Maintenance Manager
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              {report.pilot.managerContactName ?? "Not recorded"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0f141b] p-4 md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Objective
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              {report.pilot.objective ?? "No objective recorded"}
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-800 px-5 py-4 sm:flex-row sm:justify-end md:px-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-700 px-4 text-sm font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Rocket className="h-4 w-4" aria-hidden="true" />
            )}
            Confirm pilot launch
          </button>
        </div>
      </section>
    </div>
  );
}

export const PilotSetupSection = (): JSX.Element => {
  const workflow = usePilotSetup();

  if (workflow.loading) return <LoadingState />;

  if (!workflow.report) {
    return (
      <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">
        <header className="py-5">
          <p className="text-xs font-medium text-slate-400">Pilot administration</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">Pilot Setup</h1>
        </header>
        <Card className="rounded-xl border border-red-500/20 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-slate-100">Pilot Setup unavailable</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {workflow.notice?.text ?? "This workflow is restricted to authorised pilot administrators."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void workflow.loadReport()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-50 hover:bg-white/15"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const report = workflow.report;
  const automatedComplete = report.readiness.automatedChecks.filter(
    (check) => check.status === "pass" || check.status === "not_applicable",
  ).length;
  const manualComplete = report.readiness.manualChecks.filter(
    (check) => check.status === "pass" || check.status === "not_applicable",
  ).length;
  const setupComplete = [
    Boolean(report.pilot.objective),
    Boolean(report.pilot.plannedStartDate),
    Boolean(report.pilot.plannedEndDate),
    Boolean(report.pilot.pilotOwnerUserId),
    Boolean(report.pilot.managerContactUserId),
    report.pilot.successCriteria.length > 0,
  ].filter(Boolean).length;

  const progressByStage: Record<SetupStage, { complete: number; total: number }> = {
    setup: { complete: setupComplete, total: 6 },
    data: {
      complete: automatedComplete,
      total: report.readiness.automatedChecks.length,
    },
    people: {
      complete: manualComplete,
      total: report.readiness.manualChecks.length,
    },
    rehearsal: {
      complete: report.rehearsal.completedScenarios,
      total: report.rehearsal.totalScenarios,
    },
    launch: {
      complete: report.pilot.status === "LIVE" ? 1 : 0,
      total: 1,
    },
  };

  const anyBusy = Object.values(workflow.busy).some(Boolean);

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-5 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">
      <header className="flex w-full flex-col gap-4 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">Pilot administration</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">Pilot Setup</h1>
            <Badge
              className={`h-auto rounded border px-2 py-0.5 text-[10px] font-bold shadow-none ${PILOT_STATUS_STYLES[report.pilot.status]}`}
            >
              {report.pilot.status.replace(/_/g, " ")}
            </Badge>
            {workflow.hasUnsavedChanges ? (
              <Badge className="h-auto rounded border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 shadow-none">
                Unsaved changes
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Configure, evidence, rehearse and launch the Maintenance Manager pilot for {report.site.name}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void workflow.loadReport()}
          disabled={anyBusy || workflow.hasUnsavedChanges}
          title={workflow.hasUnsavedChanges ? "Save or discard changes before refreshing" : undefined}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-800 bg-[#141820] px-4 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh checks
        </button>
      </header>

      {workflow.notice ? (
        <div
          role={workflow.notice.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`fixed right-4 top-4 z-[120] flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl shadow-black/40 ${
            workflow.notice.kind === "success"
              ? "border-emerald-500/25 bg-[#102018] text-emerald-100"
              : "border-red-500/25 bg-[#241316] text-red-100"
          }`}
        >
          {workflow.notice.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
          )}
          <span className="leading-5">{workflow.notice.text}</span>
          <button
            type="button"
            onClick={() => workflow.setNotice(null)}
            aria-label="Dismiss notification"
            className="ml-auto text-current opacity-60 hover:opacity-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="grid gap-5 p-5 md:p-6 xl:grid-cols-[180px_minmax(0,1fr)_auto] xl:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Launch readiness
            </p>
            <p className={`mt-1 text-4xl font-bold ${scoreClass(report.readiness.score)}`}>
              {report.readiness.score.toFixed(1)}%
            </p>
          </div>
          <div>
            <ProgressBar value={report.readiness.score} />
            <p className="mt-3 text-sm text-slate-300">{report.readiness.recommendedNextAction}</p>
            <p className="mt-1 text-xs text-slate-500">
              {report.readiness.automatedBlockers} data · {report.readiness.manualBlockers} people · {report.readiness.rehearsalBlockers} rehearsal blockers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={`h-5 w-5 ${report.readiness.launchEligible ? "text-emerald-400" : "text-amber-400"}`}
              aria-hidden="true"
            />
            <span className="text-sm font-semibold text-slate-200">
              {report.readiness.launchEligible ? "Launch gate passed" : "Launch gate blocked"}
            </span>
          </div>
        </CardContent>
      </Card>

      <nav
        className="grid gap-2 rounded-xl border border-gray-800 bg-[#11161d] p-2 sm:grid-cols-2 xl:grid-cols-5"
        aria-label="Pilot setup stages"
      >
        {STAGES.map((stage) => {
          const Icon = stage.icon;
          const progress = progressByStage[stage.key];
          const complete = progress.total > 0 && progress.complete === progress.total;
          const active = workflow.activeStage === stage.key;

          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => workflow.setActiveStage(stage.key)}
              aria-current={active ? "step" : undefined}
              className={`flex min-w-0 items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                active
                  ? "border-blue-500/30 bg-blue-500/10"
                  : "border-transparent hover:border-gray-800 hover:bg-white/[0.03]"
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  complete ? "bg-emerald-500/10" : active ? "bg-blue-500/15" : "bg-slate-800"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    complete ? "text-emerald-400" : active ? "text-blue-300" : "text-slate-500"
                  }`}
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${active ? "text-slate-50" : "text-slate-300"}`}>
                    {stage.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {progress.complete}/{progress.total}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{stage.description}</p>
              </div>
            </button>
          );
        })}
      </nav>

      <div>
        {workflow.activeStage === "setup" ? (
          <PilotSetupSetupStage
            report={report}
            configuration={workflow.configuration}
            configurationDirty={workflow.configurationDirty}
            criteria={workflow.criteria}
            criteriaDirty={workflow.criteriaDirty}
            pilotOwnerUserId={workflow.pilotOwnerUserId}
            managerContactUserId={workflow.managerContactUserId}
            participantsDirty={workflow.participantsDirty}
            busy={workflow.busy}
            onConfigurationChange={workflow.updateConfiguration}
            onSaveConfiguration={() => void workflow.saveConfiguration()}
            onOwnerChange={(userId) => {
              workflow.setPilotOwnerUserId(userId);
              workflow.setParticipantsDirty(true);
            }}
            onManagerChange={(userId) => {
              workflow.setManagerContactUserId(userId);
              workflow.setParticipantsDirty(true);
            }}
            onSaveParticipants={() => void workflow.saveParticipants()}
            onCriterionTargetChange={(index, target) => {
              workflow.setCriteria((current) =>
                current.map((criterion, currentIndex) =>
                  currentIndex === index ? { ...criterion, target } : criterion,
                ),
              );
              workflow.setCriteriaDirty(true);
            }}
            onSaveCriteria={() => void workflow.saveCriteria()}
          />
        ) : null}

        {workflow.activeStage === "data" ? <PilotSetupDataStage report={report} /> : null}

        {workflow.activeStage === "people" ? (
          <PilotSetupPeopleStage
            report={report}
            manualEvidence={workflow.manualEvidence}
            busy={workflow.busy}
            onEvidenceChange={(checkKey, value) =>
              workflow.setManualEvidence((current) => ({ ...current, [checkKey]: value }))
            }
            onUpdateCheck={(check, status) => void workflow.updateManualCheck(check, status)}
          />
        ) : null}

        {workflow.activeStage === "rehearsal" ? (
          <PilotSetupRehearsalStage
            report={report}
            attemptDrafts={workflow.attemptDrafts}
            busy={workflow.busy}
            onDraftChange={workflow.updateAttemptDraft}
            onRecordAttempt={(scenario) => void workflow.recordAttempt(scenario)}
          />
        ) : null}

        {workflow.activeStage === "launch" ? (
          <PilotSetupLaunchStage
            report={report}
            weeklyDraft={workflow.weeklyDraft}
            busy={workflow.busy}
            onOpenLaunch={() => workflow.setLaunchOpen(true)}
            onWeeklyDraftChange={(patch) =>
              workflow.setWeeklyDraft((current) => ({ ...current, ...patch }))
            }
            onSaveWeeklyReview={() => void workflow.saveWeeklyReview()}
            onEditWeeklyReview={workflow.loadWeeklyReview}
          />
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-5 text-xs text-slate-600">
        <span>Baseline {formatDate(report.pilot.baselineSnapshotDate)} · Report {report.reportVersion}</span>
        <span>Administrator-only workflow · SAP remains read-only</span>
      </footer>

      {workflow.launchOpen ? (
        <LaunchDialog
          report={report}
          busy={Boolean(workflow.busy.launch)}
          onCancel={() => workflow.setLaunchOpen(false)}
          onConfirm={() => void workflow.launchPilot()}
        />
      ) : null}
    </section>
  );
};
