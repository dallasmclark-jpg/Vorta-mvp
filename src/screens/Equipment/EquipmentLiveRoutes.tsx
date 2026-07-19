import {
  AlertTriangle,
  ArrowRight,
  Database,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { EquipmentAiInsights } from "./EquipmentAiInsights";
import { EquipmentOverview } from "./EquipmentOverview";
import { EquipmentOverviewLive } from "./EquipmentOverviewLive";
import { EquipmentSection } from "./EquipmentSection";
import { EquipmentSpares } from "./EquipmentSpares";
import type { EquipmentListItem } from "./equipmentService";
import {
  loadLiveEquipmentComponents,
  loadLiveEquipmentList,
  loadLiveEquipmentRiskProfile,
  type LiveDataState,
  type LiveEquipmentListPayload,
} from "./equipmentLiveTrust";

function riskTone(level: EquipmentListItem["riskLevel"]): string {
  if (level === "Critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (level === "High") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (level === "Medium") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  if (level === "Low") return "border-lime-500/30 bg-lime-500/10 text-lime-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function EvidenceState({
  title,
  message,
  unavailable,
  onRetry,
}: {
  title: string;
  message: string;
  unavailable: boolean;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <section className="flex w-full flex-col gap-5 px-4 pb-12 pt-5 md:px-6 xl:px-8">
      <div
        role={unavailable ? "alert" : "status"}
        className={`rounded-xl border p-5 ${
          unavailable
            ? "border-red-500/30 bg-red-500/[0.07]"
            : "border-amber-500/30 bg-amber-500/[0.07]"
        }`}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              unavailable ? "text-red-400" : "text-amber-400"
            }`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h1
              className={`text-base font-semibold ${
                unavailable ? "text-red-100" : "text-amber-100"
              }`}
            >
              {title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
              {message}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              No demonstration record, generated score or optimistic percentage has been substituted.
            </p>
          </div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-gray-700 px-3 text-sm font-semibold text-slate-200 hover:bg-gray-800"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LiveEquipmentSection(): JSX.Element {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<LiveDataState<LiveEquipmentListPayload> | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setState(await loadLiveEquipmentList());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = state?.status === "ready" ? state.data.items : [];
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      [item.name, item.assetNumber, item.area, item.type, item.oem]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [items, query]);

  if (loading && !state) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <span className="inline-flex items-center gap-2 text-sm text-slate-400">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
          Loading verified equipment risk records…
        </span>
      </section>
    );
  }

  if (state && state.status !== "ready") {
    return (
      <EvidenceState
        title={state.status === "unavailable" ? "Equipment data unavailable" : "Equipment risk not configured"}
        message={state.message}
        unavailable={state.status === "unavailable"}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <section className="flex w-full flex-col gap-5 px-4 pb-12 pt-5 md:px-6 xl:px-8">
      <header className="flex flex-col gap-4 border-b border-gray-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">Equipment</h1>
            <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold tracking-[0.12em] text-emerald-300">
              VERIFIED RISK RECORDS
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Site-authorised assets with stored risk profiles. Equipment without calculated evidence is withheld.
          </p>
          {state?.status === "ready" && state.data.excludedWithoutRiskProfile > 0 ? (
            <p className="mt-2 text-xs text-amber-300">
              {state.data.excludedWithoutRiskProfile} equipment record{state.data.excludedWithoutRiskProfile === 1 ? " is" : "s are"} awaiting a verified risk profile.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-700 bg-[#10151d] px-3">
            <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span className="sr-only">Search equipment</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search equipment"
              className="min-w-0 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 text-sm font-semibold text-slate-200 hover:bg-gray-800 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="flex flex-col rounded-xl border border-gray-800 bg-[#141820] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-100">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.assetNumber} · {item.area}
                </p>
              </div>
              <span className={`rounded-md border px-2 py-1 text-xs font-bold ${riskTone(item.riskLevel)}`}>
                {item.riskScore.toFixed(1)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-2">
                <p className="text-lg font-bold text-slate-100">{item.openWorkOrderCount}</p>
                <p className="text-[11px] text-slate-500">Open WOs</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-2">
                <p className="text-lg font-bold text-orange-300">{item.overduePmCount}</p>
                <p className="text-[11px] text-slate-500">Overdue PMs</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-2">
                <p className="text-lg font-bold text-cyan-300">{item.calibrationOverdueCount}</p>
                <p className="text-[11px] text-slate-500">Calibrations</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Stored risk drivers</p>
              {item.breakdown.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {item.breakdown.slice(0, 3).map((driver) => (
                    <div key={driver.label} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-400">{driver.label}</span>
                      <span className="font-semibold tabular-nums text-slate-200">{driver.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-amber-300">Driver percentages are unavailable.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate(`/equipment/${item.id}/overview`)}
              className="mt-5 inline-flex min-h-10 items-center justify-end gap-2 border-t border-gray-800 pt-4 text-sm font-semibold text-blue-300 hover:text-blue-200"
            >
              Open verified equipment
              <ArrowRight className="h-4 w-4" />
            </button>
          </article>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 bg-[#10151d] px-6 py-12 text-center">
          <Database className="mx-auto h-7 w-7 text-slate-600" />
          <p className="mt-3 text-sm font-semibold text-slate-300">No matching verified equipment</p>
        </div>
      ) : null}
    </section>
  );
}

function useLiveRouteMode(): "live" | "demo" | "unavailable" {
  const { siteContext } = useAuth();
  return getEffectiveDataMode(Boolean(siteContext?.siteId));
}

export function EquipmentSectionEntry(): JSX.Element {
  const mode = useLiveRouteMode();
  if (mode === "demo") return <EquipmentSection />;
  if (mode === "unavailable") {
    return (
      <EvidenceState
        title="Equipment data unavailable"
        message="No authorised active-site context is available."
        unavailable
      />
    );
  }
  return <LiveEquipmentSection />;
}

export function EquipmentOverviewTrustedEntry(): JSX.Element {
  const mode = useLiveRouteMode();
  const { equipmentId = "" } = useParams();
  const [loading, setLoading] = useState(mode === "live");
  const [state, setState] = useState<LiveDataState<{ equipmentId: string }> | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (mode !== "live" || !equipmentId) return;
    setLoading(true);
    setState(await loadLiveEquipmentRiskProfile(equipmentId));
    setLoading(false);
  }, [equipmentId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  if (mode === "demo") return <EquipmentOverview />;
  if (mode === "unavailable") {
    return <EvidenceState title="Equipment data unavailable" message="No authorised active-site context is available." unavailable />;
  }
  if (loading && !state) {
    return <section className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400"><RefreshCw className="mr-2 h-4 w-4 animate-spin text-blue-400" />Checking verified risk evidence…</section>;
  }
  if (state?.status !== "ready") {
    return <EvidenceState title="Equipment risk unavailable" message={state?.message ?? "Verified equipment risk could not be loaded."} unavailable={state?.status === "unavailable"} onRetry={() => void load()} />;
  }
  return <EquipmentOverviewLive />;
}

export function EquipmentSparesEntry(): JSX.Element {
  const mode = useLiveRouteMode();
  const { equipmentId = "" } = useParams();
  const [loading, setLoading] = useState(mode === "live");
  const [state, setState] = useState<LiveDataState<unknown> | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (mode !== "live" || !equipmentId) return;
    setLoading(true);
    setState(await loadLiveEquipmentComponents(equipmentId));
    setLoading(false);
  }, [equipmentId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  if (mode === "demo") return <EquipmentSpares />;
  if (mode === "unavailable") {
    return <EvidenceState title="Spares data unavailable" message="No authorised active-site context is available." unavailable />;
  }
  if (loading && !state) {
    return <section className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400"><RefreshCw className="mr-2 h-4 w-4 animate-spin text-blue-400" />Checking live component inventory…</section>;
  }
  if (state?.status !== "ready") {
    return <EvidenceState title={state?.status === "empty" ? "Component inventory not configured" : "Spares data unavailable"} message={(state as LiveDataState<unknown> | null)?.status === "ready" ? "" : state?.message ?? "Live component inventory could not be loaded."} unavailable={state?.status === "unavailable"} onRetry={() => void load()} />;
  }
  return <EquipmentSpares />;
}

function LiveEquipmentAssistantBridge(): JSX.Element {
  const navigate = useNavigate();
  const { equipmentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const dispatched = useRef(false);
  const prompt = searchParams.get("prompt")?.trim() || `Explain the current verified risk, work, skills and spares evidence for equipment ${equipmentId}.`;

  useEffect(() => {
    if (dispatched.current) return;
    dispatched.current = true;
    const returnToPreviousPage = Number(window.history.state?.idx ?? 0) > 0;
    if (returnToPreviousPage) navigate(-1);
    else navigate(`/equipment/${equipmentId}/overview`, { replace: true });

    const timer = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("vorta-global-ai-prompt", {
          detail: {
            question: prompt,
            submit: true,
            role: "maintenance-manager",
          },
        }),
      );
    }, 120);

    return () => window.clearTimeout(timer);
  }, [equipmentId, navigate, prompt]);

  return (
    <section className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-lg rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-6 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-blue-300" />
        <h1 className="mt-3 text-base font-semibold text-slate-100">Opening Ask Vorta</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Returning to the equipment workflow and opening the same-page assistant with verified equipment context.
        </p>
      </div>
    </section>
  );
}

export function EquipmentAiInsightsTrustedEntry(): JSX.Element {
  const mode = useLiveRouteMode();
  if (mode === "demo") return <EquipmentAiInsights />;
  if (mode === "unavailable") {
    return <EvidenceState title="Ask Vorta unavailable" message="No authorised active-site context is available." unavailable />;
  }
  return <LiveEquipmentAssistantBridge />;
}
