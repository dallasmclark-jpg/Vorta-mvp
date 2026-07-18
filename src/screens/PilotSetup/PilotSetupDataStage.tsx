import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Database,
  XCircle,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import {
  type CheckStatus,
  type PilotSetupReport,
  STATUS_STYLES,
  statusLabel,
} from "./pilotSetupModel";

function statusIcon(status: CheckStatus): typeof CheckCircle2 {
  if (status === "pass") return CheckCircle2;
  if (status === "warning") return AlertTriangle;
  if (status === "fail") return XCircle;
  return CircleDashed;
}

export function PilotSetupDataStage({
  report,
}: {
  report: PilotSetupReport;
}): JSX.Element {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-5 md:p-6">
        <div className="mb-5 flex items-start gap-3">
          <Database className="mt-0.5 h-4 w-4 text-blue-400" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Automated readiness gates
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Calculated from current site data and backend health. These cannot be manually overridden.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {report.readiness.automatedChecks.map((check) => {
            const Icon = statusIcon(check.status);
            return (
              <div
                key={check.key}
                className="rounded-lg border border-gray-800 bg-[#10141b] p-4"
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      check.status === "pass"
                        ? "text-emerald-400"
                        : check.status === "warning"
                          ? "text-amber-400"
                          : check.status === "fail"
                            ? "text-red-400"
                            : "text-slate-500"
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
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
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {check.evidence}
                    </p>
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
