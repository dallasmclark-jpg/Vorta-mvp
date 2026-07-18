import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  RefreshCw,
  UsersRound,
  XCircle,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import {
  type CheckStatus,
  type PilotCheck,
  type PilotSetupReport,
  STATUS_STYLES,
  formatDateTime,
  statusLabel,
} from "./pilotSetupModel";

function statusIcon(status: CheckStatus): typeof CheckCircle2 {
  if (status === "pass") return CheckCircle2;
  if (status === "warning") return AlertTriangle;
  if (status === "fail") return XCircle;
  return CircleDashed;
}

interface PilotSetupPeopleStageProps {
  report: PilotSetupReport;
  manualEvidence: Record<string, string>;
  busy: Record<string, boolean>;
  onEvidenceChange: (checkKey: string, value: string) => void;
  onUpdateCheck: (check: PilotCheck, status: "pass" | "fail") => void;
}

export function PilotSetupPeopleStage({
  report,
  manualEvidence,
  busy,
  onEvidenceChange,
  onUpdateCheck,
}: PilotSetupPeopleStageProps): JSX.Element {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-5 md:p-6">
        <div className="mb-5 flex items-start gap-3">
          <UsersRound className="mt-0.5 h-4 w-4 text-blue-400" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Manual readiness confirmations
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Every recorded outcome requires evidence. Empty green ticks are not accepted.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {report.readiness.manualChecks.map((check) => {
            const Icon = statusIcon(check.status);
            const evidence = manualEvidence[check.key] ?? "";
            const isSaving = Boolean(busy[`check:${check.key}`]);
            const evidenceReady = evidence.trim().length >= 8;

            return (
              <div
                key={check.key}
                className="rounded-lg border border-gray-800 bg-[#10141b] p-4"
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] xl:items-start">
                  <div className="flex min-w-0 items-start gap-3">
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        check.status === "pass"
                          ? "text-emerald-400"
                          : check.status === "fail"
                            ? "text-red-400"
                            : "text-slate-500"
                      }`}
                      aria-hidden="true"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-200">
                          {check.label}
                        </p>
                        <Badge
                          className={`h-auto rounded border px-2 py-0.5 text-[10px] font-bold shadow-none ${STATUS_STYLES[check.status]}`}
                        >
                          {statusLabel(check.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {check.description}
                      </p>
                      {check.checkedAt ? (
                        <p className="mt-1 text-xs text-slate-600">
                          Recorded {formatDateTime(check.checkedAt)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <input
                      value={evidence}
                      onChange={(event) => onEvidenceChange(check.key, event.target.value)}
                      maxLength={2000}
                      placeholder="Evidence, date, meeting or test result"
                      className="h-10 min-w-0 rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`text-xs ${
                          evidenceReady ? "text-emerald-400" : "text-slate-600"
                        }`}
                      >
                        {evidenceReady
                          ? "Evidence ready"
                          : "At least 8 characters required"}
                      </span>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onUpdateCheck(check, "pass")}
                          disabled={isSaving || !evidenceReady}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isSaving ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          Pass
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateCheck(check, "fail")}
                          disabled={isSaving || !evidenceReady}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Fail
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
