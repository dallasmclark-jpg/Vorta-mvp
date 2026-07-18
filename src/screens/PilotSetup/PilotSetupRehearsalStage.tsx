import {
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  RefreshCw,
  TestTube2,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { FieldLabel } from "./PilotSetupShared";
import {
  type AttemptDraft,
  type PilotSetupReport,
  type RehearsalScenario,
  type ScenarioResult,
  STATUS_STYLES,
  blankAttemptDraft,
  formatDateTime,
  statusLabel,
} from "./pilotSetupModel";

interface PilotSetupRehearsalStageProps {
  report: PilotSetupReport;
  attemptDrafts: Record<string, AttemptDraft>;
  busy: Record<string, boolean>;
  onDraftChange: (scenarioKey: string, patch: Partial<AttemptDraft>) => void;
  onRecordAttempt: (scenario: RehearsalScenario) => void;
}

export function PilotSetupRehearsalStage({
  report,
  attemptDrafts,
  busy,
  onDraftChange,
  onRecordAttempt,
}: PilotSetupRehearsalStageProps): JSX.Element {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-5 md:p-6">
        <div className="mb-5 flex items-start gap-3">
          <TestTube2 className="mt-0.5 h-4 w-4 text-blue-400" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Pilot rehearsal</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Every scenario needs two consecutive clean passes. A later fail, block or assisted attempt resets that streak.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {report.rehearsal.scenarios.map((scenario) => {
            const draft = attemptDrafts[scenario.key] ?? blankAttemptDraft();
            const isSaving = Boolean(busy[`scenario:${scenario.key}`]);

            return (
              <details
                key={scenario.key}
                className="group rounded-lg border border-gray-800 bg-[#10141b]"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      scenario.complete ? "bg-emerald-500/10" : "bg-blue-500/10"
                    }`}
                  >
                    {scenario.complete ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <span className="text-xs font-bold text-blue-300">{scenario.order}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-200">
                        {scenario.title}
                      </p>
                      <Badge
                        className={`h-auto rounded border px-2 py-0.5 text-[10px] font-bold shadow-none ${
                          scenario.complete ? STATUS_STYLES.pass : STATUS_STYLES.pending
                        }`}
                      >
                        {scenario.cleanPasses}/{scenario.requiredCleanPasses} consecutive clean passes
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{scenario.objective}</p>
                  </div>

                  <ChevronRight
                    className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-90"
                    aria-hidden="true"
                  />
                </summary>

                <div className="border-t border-gray-800 p-4">
                  <div className="rounded-lg border border-blue-500/15 bg-blue-500/5 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-300">
                      Expected outcome
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {scenario.expectedOutcome}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{scenario.attempts} attempts</span>
                    <span>{scenario.failures} failed</span>
                    <span>{scenario.blockedAttempts} blocked</span>
                    {scenario.lastAttemptAt ? (
                      <span>
                        Latest {statusLabel(scenario.latestResult ?? "pending")} · {formatDateTime(scenario.lastAttemptAt)}
                      </span>
                    ) : null}
                    {scenario.latestIssueReference ? (
                      <span>Issue {scenario.latestIssueReference}</span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <FieldLabel>
                      Result
                      <select
                        value={draft.result}
                        onChange={(event) =>
                          onDraftChange(scenario.key, {
                            result: event.target.value as ScenarioResult,
                          })
                        }
                        className="h-10 rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
                      >
                        <option value="">Choose result</option>
                        <option value="pass">Pass</option>
                        <option value="fail">Fail</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </FieldLabel>

                    <FieldLabel>
                      Duration, minutes
                      <input
                        type="number"
                        min={0}
                        max={1440}
                        value={draft.durationMinutes}
                        onChange={(event) =>
                          onDraftChange(scenario.key, {
                            durationMinutes: event.target.value,
                          })
                        }
                        className="h-10 rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
                      />
                    </FieldLabel>

                    <label className="flex h-10 items-center gap-2 self-end rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={draft.interventionRequired}
                        onChange={(event) =>
                          onDraftChange(scenario.key, {
                            interventionRequired: event.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-gray-700 bg-slate-900"
                      />
                      Intervention required
                    </label>

                    <FieldLabel className="lg:col-span-3">
                      Notes
                      <textarea
                        rows={3}
                        value={draft.notes}
                        onChange={(event) =>
                          onDraftChange(scenario.key, { notes: event.target.value })
                        }
                        maxLength={3000}
                        placeholder="What happened, whether the expected outcome was met, and any confusion."
                        className="rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2 text-sm leading-6 text-slate-200 outline-none focus:border-blue-500/60"
                      />
                    </FieldLabel>

                    <FieldLabel className="lg:col-span-2">
                      Evidence
                      <input
                        value={draft.evidence}
                        onChange={(event) =>
                          onDraftChange(scenario.key, { evidence: event.target.value })
                        }
                        maxLength={2000}
                        placeholder="Screenshot, record or observed evidence"
                        className="h-10 rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
                      />
                    </FieldLabel>

                    <FieldLabel>
                      Issue reference
                      <input
                        value={draft.issueReference}
                        onChange={(event) =>
                          onDraftChange(scenario.key, {
                            issueReference: event.target.value,
                          })
                        }
                        maxLength={500}
                        placeholder="Optional issue or ticket"
                        className="h-10 rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
                      />
                    </FieldLabel>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onRecordAttempt(scenario)}
                      disabled={isSaving || !draft.result}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSaving ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
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
  );
}
