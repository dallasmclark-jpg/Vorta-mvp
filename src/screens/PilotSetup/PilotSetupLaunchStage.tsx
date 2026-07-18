import {
  CalendarDays,
  RefreshCw,
  Rocket,
  Save,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { FieldLabel } from "./PilotSetupShared";
import {
  type PilotSetupReport,
  type WeeklyReview,
  type WeeklyReviewDraft,
  STATUS_STYLES,
  formatDate,
  formatDateTime,
  statusLabel,
} from "./pilotSetupModel";

interface PilotSetupLaunchStageProps {
  report: PilotSetupReport;
  weeklyDraft: WeeklyReviewDraft;
  busy: Record<string, boolean>;
  onOpenLaunch: () => void;
  onWeeklyDraftChange: (patch: Partial<WeeklyReviewDraft>) => void;
  onSaveWeeklyReview: () => void;
  onEditWeeklyReview: (review: WeeklyReview) => void;
}

export function PilotSetupLaunchStage({
  report,
  weeklyDraft,
  busy,
  onOpenLaunch,
  onWeeklyDraftChange,
  onSaveWeeklyReview,
  onEditWeeklyReview,
}: PilotSetupLaunchStageProps): JSX.Element {
  const reviewBusy = Boolean(busy[`week:${weeklyDraft.weekNumber}`]);

  return (
    <div className="grid gap-5">
      <Card
        className={`rounded-xl border shadow-none ${
          report.readiness.launchEligible
            ? "border-emerald-500/25 bg-emerald-500/5"
            : "border-amber-500/20 bg-[#141820]"
        }`}
      >
        <CardContent className="flex flex-col gap-5 p-5 md:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                report.readiness.launchEligible
                  ? "bg-emerald-500/10"
                  : "bg-amber-500/10"
              }`}
            >
              <Rocket
                className={`h-5 w-5 ${
                  report.readiness.launchEligible
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
                aria-hidden="true"
              />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                {report.pilot.status === "LIVE"
                  ? "Pilot is live"
                  : report.readiness.launchEligible
                    ? "Ready to launch"
                    : "Launch remains blocked"}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                {report.pilot.status === "LIVE"
                  ? `Launched ${formatDateTime(report.pilot.launchConfirmedAt)}. Continue the weekly evidence cycle.`
                  : report.readiness.launchEligible
                    ? "Every blocking check and consecutive rehearsal requirement has passed. Review the summary before confirming."
                    : `${report.readiness.automatedBlockers} data, ${report.readiness.manualBlockers} people and ${report.readiness.rehearsalBlockers} rehearsal blockers remain.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenLaunch}
            disabled={
              !report.readiness.launchEligible ||
              report.pilot.status === "LIVE"
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            <Rocket className="h-4 w-4" aria-hidden="true" />
            {report.pilot.status === "LIVE" ? "Pilot live" : "Review and launch"}
          </button>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="mb-5 flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 text-blue-400" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                {report.pilot.status === "LIVE"
                  ? "Weekly pilot reviews"
                  : "Week 0 baseline review"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {report.pilot.status === "LIVE"
                  ? "Capture value, accuracy, time saved, blockers and the next action each week."
                  : "Record the baseline conversation now. Ongoing weekly reviews become relevant after launch."}
              </p>
            </div>
          </div>

          {report.weeklyReviews.length > 0 ? (
            <div className="mb-5 grid gap-3 lg:grid-cols-2">
              {report.weeklyReviews.map((review) => (
                <div
                  key={review.weekNumber}
                  className="rounded-lg border border-gray-800 bg-[#10141b] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        Week {review.weekNumber}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(review.periodStart)} to {formatDate(review.periodEnd)}
                      </p>
                    </div>
                    <Badge
                      className={`h-auto rounded border px-2 py-0.5 text-[10px] font-bold shadow-none ${
                        review.status === "complete"
                          ? STATUS_STYLES.pass
                          : STATUS_STYLES.pending
                      }`}
                    >
                      {statusLabel(review.status)}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span className="text-slate-500">Manager value</span>
                    <span className="text-right font-semibold text-slate-300">
                      {review.managerValueScore ?? "Not scored"}
                    </span>
                    <span className="text-slate-500">Data accuracy</span>
                    <span className="text-right font-semibold text-slate-300">
                      {review.dataAccuracyPercent == null
                        ? "Not scored"
                        : `${review.dataAccuracyPercent}%`}
                    </span>
                    <span className="text-slate-500">Time saved</span>
                    <span className="text-right font-semibold text-slate-300">
                      {review.estimatedTimeSavedMinutes == null
                        ? "Not estimated"
                        : `${review.estimatedTimeSavedMinutes} min`}
                    </span>
                    <span className="text-slate-500">Risks / actions</span>
                    <span className="text-right font-semibold text-slate-300">
                      {review.risksIdentified} / {review.followThroughActions}
                    </span>
                  </div>

                  {review.summary ? (
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {review.summary}
                    </p>
                  ) : null}
                  {review.blockers ? (
                    <p className="mt-2 text-xs leading-5 text-amber-300">
                      Blockers: {review.blockers}
                    </p>
                  ) : null}
                  {review.nextActions ? (
                    <p className="mt-2 text-xs leading-5 text-blue-300">
                      Next: {review.nextActions}
                    </p>
                  ) : null}

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onEditWeeklyReview(review)}
                      className="inline-flex h-8 items-center rounded-lg border border-gray-700 px-3 text-xs font-semibold text-slate-300 hover:bg-white/5"
                    >
                      Edit review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-5 rounded-lg border border-dashed border-gray-800 bg-[#10141b] px-4 py-5 text-sm text-slate-500">
              No reviews recorded yet.
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-3">
            <FieldLabel>
              Week number
              <input
                type="number"
                min={0}
                max={52}
                value={weeklyDraft.weekNumber}
                onChange={(event) =>
                  onWeeklyDraftChange({ weekNumber: event.target.value })
                }
                className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>

            <FieldLabel>
              Period start
              <input
                type="date"
                value={weeklyDraft.periodStart}
                onChange={(event) =>
                  onWeeklyDraftChange({ periodStart: event.target.value })
                }
                className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>

            <FieldLabel>
              Period end
              <input
                type="date"
                value={weeklyDraft.periodEnd}
                min={weeklyDraft.periodStart || undefined}
                onChange={(event) =>
                  onWeeklyDraftChange({ periodEnd: event.target.value })
                }
                className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>

            <FieldLabel>
              Manager value, 0–10
              <input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={weeklyDraft.managerValueScore}
                onChange={(event) =>
                  onWeeklyDraftChange({ managerValueScore: event.target.value })
                }
                className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>

            <FieldLabel>
              Data accuracy, %
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={weeklyDraft.dataAccuracyPercent}
                onChange={(event) =>
                  onWeeklyDraftChange({ dataAccuracyPercent: event.target.value })
                }
                className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>

            <FieldLabel>
              Estimated time saved, minutes
              <input
                type="number"
                min={0}
                value={weeklyDraft.estimatedTimeSavedMinutes}
                onChange={(event) =>
                  onWeeklyDraftChange({
                    estimatedTimeSavedMinutes: event.target.value,
                  })
                }
                className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>

            <FieldLabel>
              Risks identified
              <input
                type="number"
                min={0}
                value={weeklyDraft.risksIdentified}
                onChange={(event) =>
                  onWeeklyDraftChange({ risksIdentified: event.target.value })
                }
                className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>

            <FieldLabel>
              Follow-through actions
              <input
                type="number"
                min={0}
                value={weeklyDraft.followThroughActions}
                onChange={(event) =>
                  onWeeklyDraftChange({ followThroughActions: event.target.value })
                }
                className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>

            <FieldLabel>
              Review status
              <select
                value={weeklyDraft.status}
                onChange={(event) =>
                  onWeeklyDraftChange({
                    status: event.target.value as "draft" | "complete",
                  })
                }
                className="h-10 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
              >
                <option value="draft">Draft</option>
                <option value="complete">Complete</option>
              </select>
            </FieldLabel>

            <FieldLabel className="lg:col-span-3">
              Summary
              <textarea
                rows={3}
                value={weeklyDraft.summary}
                onChange={(event) =>
                  onWeeklyDraftChange({ summary: event.target.value })
                }
                maxLength={5000}
                className="rounded-lg border border-gray-800 bg-[#10141b] px-3 py-2 text-sm leading-6 text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>

            <FieldLabel className="lg:col-span-3">
              Blockers
              <textarea
                rows={2}
                value={weeklyDraft.blockers}
                onChange={(event) =>
                  onWeeklyDraftChange({ blockers: event.target.value })
                }
                maxLength={3000}
                className="rounded-lg border border-gray-800 bg-[#10141b] px-3 py-2 text-sm leading-6 text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>

            <FieldLabel className="lg:col-span-3">
              Next actions
              <textarea
                rows={2}
                value={weeklyDraft.nextActions}
                onChange={(event) =>
                  onWeeklyDraftChange({ nextActions: event.target.value })
                }
                maxLength={3000}
                className="rounded-lg border border-gray-800 bg-[#10141b] px-3 py-2 text-sm leading-6 text-slate-200 outline-none focus:border-blue-500/60"
              />
            </FieldLabel>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onSaveWeeklyReview}
              disabled={reviewBusy}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
            >
              {reviewBusy ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Save weekly review
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
