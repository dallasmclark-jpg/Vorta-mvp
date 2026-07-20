import {
  AlertTriangle,
  ArrowRight,
  Database,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import { openMaintenanceAiAssistant } from "../../lib/maintenanceActions";
import { EquipmentAiInsights } from "./EquipmentAiInsights";
import { EquipmentDocumentViewer } from "./EquipmentDocumentViewer";
import { EquipmentNotifications } from "./EquipmentNotifications";
import { EquipmentOverview } from "./EquipmentOverview";
import { EquipmentPMs } from "./EquipmentPMs";
import { EquipmentSection } from "./EquipmentSection";
import { EquipmentSkills } from "./EquipmentSkills";
import { EquipmentSpares } from "./EquipmentSpares";
import {
  EquipmentDocumentsEntry,
  EquipmentHistoryEntry,
} from "./EquipmentTrustedEntries";
import { EquipmentWorkOrdersWithAiNavigation } from "./EquipmentWorkOrdersWithAiNavigation";
import {
  LiveEquipmentCalibrationsView,
  LiveEquipmentNotificationsView,
  LiveEquipmentOverviewView,
  LiveEquipmentSkillsView,
  LiveEquipmentSparesView,
} from "./EquipmentLiveEvidenceViews";
import { LiveEquipmentDocumentViewerView } from "./LiveEquipmentDocumentViewerView";
import { LiveEquipmentDocumentsView } from "./LiveEquipmentDocumentsView";
import { LiveEquipmentHistoryView } from "./LiveEquipmentHistoryView";
import { LiveEquipmentWorkOrdersPilotView } from "./LiveEquipmentWorkOrdersPilotView";
import {
  loadLiveEquipmentList,
  loadLiveEquipmentRecord,
  type LiveDataState,
  type LiveEquipmentListPayload,
  type LiveEquipmentRecord,
} from "./equipmentLiveTrust";
import type { EquipmentListItem } from "./equipmentService";

interface RoutedMaintenanceAiPrompt {
  commandId: string;
  question: string;
  submit: true;
  role: "maintenance-manager";
}

interface EquipmentRouteState {
  vortaMaintenanceAiPrompt?: RoutedMaintenanceAiPrompt;
}

const deliveredPromptCommands = new Set<string>();

function riskTone(level: EquipmentListItem["riskLevel"]): string {
  if (level === "Critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (level === "High") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (level === "Medium") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  if (level === "Low") return "border-lime-500/30 bg-lime-500/10 text-lime-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function createPromptCommandId(equipmentId: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${equipmentId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function RoutedPromptDelivery({ children }: { children: ReactNode }): JSX.Element {
  const location = useLocation();
  const routeState = location.state as EquipmentRouteState | null;
  const prompt = routeState?.vortaMaintenanceAiPrompt;

  useEffect(() => {
    if (!prompt?.commandId || deliveredPromptCommands.has(prompt.commandId)) return;
    deliveredPromptCommands.add(prompt.commandId);
    window.queueMicrotask(() => {
      openMaintenanceAiAssistant(prompt);
    });
  }, [prompt]);

  return <>{children}</>;
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
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">{message}</p>
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

function LoadingState({ label }: { label: string }): JSX.Element {
  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <span className="inline-flex items-center gap-2 text-sm text-slate-400">
        <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
        {label}
      </span>
    </section>
  );
}

function LiveEquipmentSection({ siteId }: { siteId: string }): JSX.Element {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<LiveDataState<LiveEquipmentListPayload> | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setState(await loadLiveEquipmentList(siteId));
    setLoading(false);
  }, [siteId]);

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
    return <LoadingState label="Loading active-site equipment risk records…" />;
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
    <section
      className="flex w-full flex-col gap-5 px-4 pb-12 pt-5 md:px-6 xl:px-8"
      data-vorta-live-equipment-list="true"
      data-vorta-active-site={siteId}
    >
      <header className="flex flex-col gap-4 border-b border-gray-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">Equipment</h1>
            <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold tracking-[0.12em] text-emerald-300">
              ACTIVE-SITE VERIFIED
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Current equipment risk records explicitly scoped to the authorised active site.
          </p>
          {state?.status === "ready" &&
          (state.data.excludedWithoutRiskProfile > 0 ||
            state.data.excludedInvalidRiskProfile > 0) ? (
            <p className="mt-2 text-xs text-amber-300">
              {state.data.excludedWithoutRiskProfile} awaiting a risk profile · {state.data.excludedInvalidRiskProfile} withheld because evidence is invalid or stale.
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
          <article key={item.id} className="flex flex-col rounded-xl border border-gray-800 bg-[#141820] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-100">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">{item.assetNumber} · {item.area}</p>
              </div>
              <span className={`rounded-md border px-2 py-1 text-xs font-bold ${riskTone(item.riskLevel)}`}>
                {item.riskScore.toFixed(1)}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-2"><p className="text-lg font-bold text-slate-100">{item.openWorkOrderCount}</p><p className="text-[11px] text-slate-500">Open WOs</p></div>
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-2"><p className="text-lg font-bold text-orange-300">{item.overduePmCount}</p><p className="text-[11px] text-slate-500">Overdue PMs</p></div>
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-2"><p className="text-lg font-bold text-cyan-300">{item.calibrationOverdueCount}</p><p className="text-[11px] text-slate-500">Calibrations</p></div>
            </div>
            <div className="mt-4 space-y-2">
              {item.breakdown.slice(0, 3).map((driver) => (
                <div key={driver.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400">{driver.label}</span>
                  <span className="font-semibold tabular-nums text-slate-200">{driver.pct.toFixed(1)}%</span>
                </div>
              ))}
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

function EquipmentDetailBoundary({
  demo,
  renderLive,
}: {
  demo: ReactNode;
  renderLive: (record: LiveEquipmentRecord) => ReactNode;
}): JSX.Element {
  const { siteContext } = useAuth();
  const { equipmentId = "" } = useParams();
  const mode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const [loading, setLoading] = useState(mode === "live");
  const [state, setState] = useState<LiveDataState<LiveEquipmentRecord> | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (mode !== "live" || !siteContext?.siteId || !equipmentId) return;
    setLoading(true);
    try {
      setState(await loadLiveEquipmentRecord(siteContext.siteId, equipmentId));
    } catch (error) {
      setState({
        status: "unavailable",
        message:
          error instanceof Error
            ? error.message
            : "The active-site equipment record request failed.",
      });
    } finally {
      setLoading(false);
    }
  }, [equipmentId, mode, siteContext?.siteId]);

  useEffect(() => {
    setState(null);
    void load();
  }, [load]);

  if (mode === "demo") return <>{demo}</>;
  if (mode === "unavailable" || !siteContext?.siteId) {
    return (
      <EvidenceState
        title="Equipment data unavailable"
        message="No authorised active-site context is available."
        unavailable
      />
    );
  }
  if (loading && !state) return <LoadingState label="Verifying active-site equipment evidence…" />;
  if (state?.status !== "ready") {
    return (
      <EvidenceState
        title={state?.status === "empty" ? "Equipment not available for this site" : "Equipment evidence unavailable"}
        message={state?.message ?? "The equipment record could not be verified."}
        unavailable={state?.status !== "empty"}
        onRetry={() => void load()}
      />
    );
  }
  return <>{renderLive(state.data)}</>;
}

export function EquipmentSectionEntry(): JSX.Element {
  const { siteContext } = useAuth();
  const mode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  if (mode === "demo") return <EquipmentSection />;
  if (mode === "unavailable" || !siteContext?.siteId) {
    return <EvidenceState title="Equipment data unavailable" message="No authorised active-site context is available." unavailable />;
  }
  return <LiveEquipmentSection siteId={siteContext.siteId} />;
}

export function EquipmentOverviewTrustedEntry(): JSX.Element {
  return (
    <EquipmentDetailBoundary
      demo={<EquipmentOverview />}
      renderLive={(record) => (
        <RoutedPromptDelivery>
          <LiveEquipmentOverviewView record={record} />
        </RoutedPromptDelivery>
      )}
    />
  );
}

export function EquipmentNotificationsTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentNotifications />} renderLive={(record) => <LiveEquipmentNotificationsView record={record} />} />;
}

export function EquipmentWorkOrdersTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentWorkOrdersWithAiNavigation />} renderLive={(record) => <LiveEquipmentWorkOrdersPilotView record={record} />} />;
}

export function EquipmentCalibrationsTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentPMs />} renderLive={(record) => <LiveEquipmentCalibrationsView record={record} />} />;
}

export function EquipmentSkillsTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentSkills />} renderLive={(record) => <LiveEquipmentSkillsView record={record} />} />;
}

export function EquipmentSparesEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentSpares />} renderLive={(record) => <LiveEquipmentSparesView record={record} />} />;
}

export function EquipmentHistoryTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentHistoryEntry />} renderLive={(record) => <LiveEquipmentHistoryView record={record} />} />;
}

export function EquipmentDocumentsTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentDocumentsEntry />} renderLive={(record) => <LiveEquipmentDocumentsView record={record} />} />;
}

export function EquipmentDocumentViewerTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentDocumentViewer />} renderLive={(record) => <LiveEquipmentDocumentViewerView record={record} />} />;
}

function LiveEquipmentAssistantBridge({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatched = useRef(false);

  useEffect(() => {
    if (dispatched.current) return;
    dispatched.current = true;
    const requestedReturn = searchParams.get("returnTo")?.trim() ?? "";
    const safePrefix = `/equipment/${record.id}/`;
    const returnTo = requestedReturn.startsWith(safePrefix)
      ? requestedReturn
      : `/equipment/${record.id}/overview`;
    const prompt =
      searchParams.get("prompt")?.trim() ||
      `Explain the current verified risk, work, skills and spares evidence for ${record.name} (${record.assetNumber}).`;

    navigate(returnTo, {
      replace: true,
      state: {
        vortaMaintenanceAiPrompt: {
          commandId: createPromptCommandId(record.id),
          question: prompt,
          submit: true,
          role: "maintenance-manager",
        } satisfies RoutedMaintenanceAiPrompt,
      } satisfies EquipmentRouteState,
    });
  }, [navigate, record.assetNumber, record.id, record.name, searchParams]);

  return (
    <section className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-lg rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-6 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-blue-300" />
        <h1 className="mt-3 text-base font-semibold text-slate-100">Opening Ask Vorta</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Returning to the verified equipment workflow with the assistant prompt preserved.
        </p>
      </div>
    </section>
  );
}

export function EquipmentAiInsightsTrustedEntry(): JSX.Element {
  return <EquipmentDetailBoundary demo={<EquipmentAiInsights />} renderLive={(record) => <LiveEquipmentAssistantBridge record={record} />} />;
}
