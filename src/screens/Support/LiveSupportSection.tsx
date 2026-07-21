import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Headphones,
  Mail,
  RefreshCw,
  ShieldAlert,
  Users,
  Video,
  Wrench,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import { validateSupportEvidencePayload } from "../../lib/liveEvidenceContracts";
import { RuntimeContractError } from "../../lib/runtimeContracts";
import { supabase } from "../../lib/supabaseClient";

type SupportRequest = {
  id: string;
  requestTitle: string;
  issueDescription: string | null;
  priority: string;
  productionStopped: boolean;
  estimatedDowntimeMinutes: number | null;
  requiredSupportType: string | null;
  status: string;
  openedAt: string;
  resolutionSummary: string | null;
  equipmentName: string | null;
  departmentName: string | null;
  skillNames: string[];
  matchCount: number;
  sessionCount: number;
  reportCount: number;
  latestReportTitle: string | null;
};

type SupportPayload = {
  siteId: string;
  organisationId: string;
  generatedAt: string;
  stats: {
    totalRequests: number;
    openRequests: number;
    matchedRequests: number;
    closedRequests: number;
    productionStoppedRequests: number;
    sessionCount: number;
    reportCount: number;
  };
  requests: SupportRequest[];
};

function formatDateTime(value: string): string {
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

function statusClass(value: string): string {
  switch (value.trim().toLowerCase()) {
    case "closed":
    case "resolved":
    case "completed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "matched":
    case "accepted":
    case "in_progress":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    case "open":
    case "pending":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-slate-700 bg-slate-800/60 text-slate-300";
  }
}

function priorityClass(value: string): string {
  switch (value.trim().toLowerCase()) {
    case "urgent":
    case "critical":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "high":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    case "medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-slate-700 bg-slate-800/60 text-slate-300";
  }
}

export function LiveSupportSection(): JSX.Element {
  const { siteContext } = useAuth();
  const [payload, setPayload] = useState<SupportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial = false): Promise<void> => {
    if (!siteContext?.siteId || !siteContext.organisationId) {
      setPayload(null);
      setError("An active maintenance site could not be resolved for this account.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const { data, error: requestError } = await supabase.functions.invoke(
        "support-evidence-data",
        { body: { schemaVersion: "support-evidence-v1" } },
      );
      if (requestError || !data) throw requestError ?? new Error("Support evidence was empty");

      const validated = validateSupportEvidencePayload(data) as unknown as SupportPayload;
      if (
        validated.siteId !== siteContext.siteId ||
        validated.organisationId !== siteContext.organisationId
      ) {
        throw new RuntimeContractError(
          "Support evidence",
          "response scope did not match the authenticated site",
        );
      }
      setPayload(validated);
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Verified support evidence is unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteContext?.organisationId, siteContext?.siteId]);

  useEffect(() => { void load(true); }, [load]);

  const requests = useMemo(() => payload?.requests.slice(0, 12) ?? [], [payload]);

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
      <header className="flex flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-medium text-slate-400">Read-only live pilot</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">Support Evidence</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Active-site equipment support requests, matching sessions and outcome evidence. Platform support remains a direct Vorta contact, not a simulated ticket queue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="mailto:support@vorta.network?subject=Vorta%20pilot%20support"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 text-sm font-semibold text-blue-200 hover:bg-blue-500/20"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Email Vorta Support
          </a>
          <button
            type="button"
            onClick={() => void load(false)}
            disabled={loading || refreshing}
            aria-label="Refresh verified support evidence"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-100 hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading support evidence">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />)}
        </div>
      ) : null}

      {!loading && error ? (
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-red-500/30 bg-red-500/10 p-5 sm:flex-row sm:items-center" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
            <div><p className="text-sm font-semibold text-red-100">Support evidence was withheld</p><p className="mt-1 text-xs leading-5 text-red-100/75">{error}</p></div>
          </div>
          <button type="button" onClick={() => void load(false)} className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10">Retry</button>
        </div>
      ) : null}

      {!loading && payload ? (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-4 py-3 text-xs text-slate-300">
            <CheckCircle2 className="h-4 w-4 text-blue-300" aria-hidden="true" />
            <span className="font-semibold text-blue-200">Runtime-validated evidence</span>
            <span>Active site: {payload.siteId}</span>
            <span>Generated: {formatDateTime(payload.generatedAt)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Open requests", payload.stats.openRequests, Headphones, "text-amber-300"],
              ["Matched requests", payload.stats.matchedRequests, Users, "text-blue-300"],
              ["Production stopped", payload.stats.productionStoppedRequests, ShieldAlert, payload.stats.productionStoppedRequests ? "text-red-300" : "text-emerald-300"],
              ["Resolution reports", payload.stats.reportCount, FileText, "text-slate-100"],
            ].map(([label, value, Icon, valueClass]) => {
              const MetricIcon = Icon as typeof Headphones;
              return (
                <Card key={String(label)} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-slate-400">{String(label)}</p><MetricIcon className="h-4 w-4 text-slate-600" aria-hidden="true" /></div>
                    <p className={`mt-3 text-2xl font-semibold tabular-nums ${String(valueClass)}`}>{String(value)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <div className="border-b border-gray-800 p-5"><h2 className="font-semibold text-slate-50">Operational support register</h2><p className="mt-1 text-xs text-slate-500">Evidence only. This page cannot create, reply to, match or close requests.</p></div>
              <div className="grid gap-4 p-4 xl:grid-cols-2">
                {requests.length === 0 ? <p className="p-1 text-sm text-slate-500">No site-attributable support requests are recorded.</p> : requests.map((request) => (
                  <article key={request.id} className="rounded-xl border border-gray-800 bg-[#111620] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="text-sm font-semibold text-slate-100">{request.requestTitle}</p><p className="mt-0.5 text-xs text-slate-500">{request.equipmentName ?? "Equipment not recorded"}{request.departmentName ? ` · ${request.departmentName}` : ""}</p></div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5"><Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${priorityClass(request.priority)}`}>{request.priority}</Badge><Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${statusClass(request.status)}`}>{request.status.replaceAll("_", " ")}</Badge></div>
                    </div>
                    {request.issueDescription ? <p className="mt-3 text-xs leading-5 text-slate-400">{request.issueDescription}</p> : null}
                    {request.productionStopped ? <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200"><ShieldAlert className="h-4 w-4" aria-hidden="true" />Production stopped{request.estimatedDowntimeMinutes ? ` · estimated ${request.estimatedDowntimeMinutes} minutes` : ""}</div> : null}
                    <div className="mt-4 grid grid-cols-3 gap-3 text-xs"><div><p className="text-slate-600">Matches</p><p className="mt-0.5 font-semibold text-slate-300">{request.matchCount}</p></div><div><p className="text-slate-600">Sessions</p><p className="mt-0.5 font-semibold text-slate-300">{request.sessionCount}</p></div><div><p className="text-slate-600">Reports</p><p className="mt-0.5 font-semibold text-slate-300">{request.reportCount}</p></div></div>
                    {request.skillNames.length > 0 ? <div className="mt-4 flex flex-wrap gap-1.5">{request.skillNames.slice(0, 5).map((skill) => <span key={skill} className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-[10px] text-slate-300">{skill}</span>)}</div> : null}
                    <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><div className="flex items-center gap-2 text-slate-500"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />Opened {formatDateTime(request.openedAt)}</div><div className="flex items-center gap-2 text-slate-500 sm:justify-end">{request.requiredSupportType?.includes("video") ? <Video className="h-3.5 w-3.5" aria-hidden="true" /> : <Wrench className="h-3.5 w-3.5" aria-hidden="true" />}{request.requiredSupportType?.replaceAll("_", " ") ?? "Support type not recorded"}</div></div>
                    {request.latestReportTitle || request.resolutionSummary ? <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Recorded outcome evidence</p>{request.latestReportTitle ? <p className="mt-1 text-xs font-medium text-slate-200">{request.latestReportTitle}</p> : null}{request.resolutionSummary ? <p className="mt-1 text-xs leading-5 text-slate-400">{request.resolutionSummary}</p> : null}</div> : null}
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-5">
            <div className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" /><div><p className="text-sm font-semibold text-amber-100">Vorta platform support is handled directly</p><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">The application does not yet persist platform support tickets. Email support@vorta.network so the request enters a real support channel.</p></div></div>
          </div>
        </>
      ) : null}
    </section>
  );
}
