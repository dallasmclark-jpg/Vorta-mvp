import {
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { openMaintenanceAiAssistant } from "../../lib/maintenanceActions";
import {
  EquipmentTabNavigation,
  type EquipmentTabRoute,
} from "./EquipmentTabNavigation";
import type {
  LiveDataState,
  LiveEquipmentRecord,
} from "./equipmentLiveTrust";
import type { LiveEquipmentDocumentSummary } from "./equipmentPilotEvidence";

interface EvidenceHookState<T> {
  state: LiveDataState<T> | null;
  loading: boolean;
  reload: () => void;
}

function unavailableState<T>(error: unknown): LiveDataState<T> {
  return {
    status: "unavailable",
    message:
      error instanceof Error
        ? error.message
        : "The verified evidence request failed before a response was returned.",
  };
}

export function usePilotEvidence<T>(loader: () => Promise<LiveDataState<T>>): EvidenceHookState<T> {
  const requestVersion = useRef(0);
  const [state, setState] = useState<LiveDataState<T> | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback((): void => {
    const request = ++requestVersion.current;
    setLoading(true);

    void (async () => {
      try {
        const nextState = await loader();
        if (request === requestVersion.current) setState(nextState);
      } catch (error) {
        if (request === requestVersion.current) setState(unavailableState<T>(error));
      } finally {
        if (request === requestVersion.current) setLoading(false);
      }
    })();
  }, [loader]);

  useEffect(() => {
    reload();
    return () => {
      requestVersion.current += 1;
    };
  }, [reload]);

  return { state, loading, reload };
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatQuantity(value: number, unit: string | null): string {
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value)}${
    unit ? ` ${unit}` : ""
  }`;
}

export function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function riskTone(level: string): string {
  if (level === "Critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (level === "High") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (level === "Medium") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (level === "Low") return "border-lime-500/30 bg-lime-500/10 text-lime-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

export function statusTone(value: string): string {
  const status = value.toLowerCase();
  if (/overdue|critical|failed|temporary|partial/.test(status)) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (/waiting|hold|due|review/.test(status)) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }
  if (/complete|closed|current|approved|success|resolved/.test(status)) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  return "border-blue-500/25 bg-blue-500/10 text-blue-300";
}

export function PageFrame({
  record,
  activeTab,
  title,
  description,
  icon: Icon,
  actions,
  children,
}: {
  record: LiveEquipmentRecord;
  activeTab: EquipmentTabRoute;
  title: string;
  description: string;
  icon: typeof Wrench;
  actions?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const navigate = useNavigate();
  return (
    <section className="flex w-full flex-col gap-5 px-4 pb-12 pt-4 md:px-6 xl:px-8">
      <header className="border-b border-gray-800 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate("/equipment")}
              className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Equipment
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <Icon className="h-5 w-5 text-blue-300" aria-hidden="true" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">{title}</h1>
              <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold tracking-[0.12em] text-emerald-300">
                LIVE SITE EVIDENCE
              </span>
              <span className={`rounded-md border px-2 py-1 text-xs font-bold ${riskTone(record.risk.level)}`}>
                {record.risk.score.toFixed(1)} · {record.risk.level}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {record.name} · {record.assetNumber} · {record.area}
            </p>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">{description}</p>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
        <EquipmentTabNavigation equipmentId={record.id} activeTab={activeTab} />
      </header>
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  detail,
  tone = "text-slate-50",
}: {
  label: string;
  value: ReactNode;
  detail: string;
  tone?: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export function EvidenceStateMessage({ state }: { state: Exclude<LiveDataState<unknown>, { status: "ready" }> }): JSX.Element {
  const unavailable = state.status === "unavailable";
  return (
    <div
      role={unavailable ? "alert" : "status"}
      className={`rounded-xl border px-4 py-4 ${
        unavailable
          ? "border-red-500/30 bg-red-500/[0.07]"
          : "border-amber-500/30 bg-amber-500/[0.07]"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={`mt-0.5 h-5 w-5 ${unavailable ? "text-red-400" : "text-amber-400"}`} />
        <div>
          <p className={`text-sm font-semibold ${unavailable ? "text-red-200" : "text-amber-200"}`}>
            {unavailable ? "Live evidence unavailable" : "No configured evidence"}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{state.message}</p>
          <p className="mt-2 text-xs text-slate-600">
            No demonstration values, optimistic percentages or cross-site records were substituted.
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoadingEvidence({ label }: { label: string }): JSX.Element {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-gray-800 bg-[#0d1117]">
      <span className="inline-flex items-center gap-2 text-sm text-slate-400">
        <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
        {label}
      </span>
    </div>
  );
}

export function RefreshButton({ loading, onClick }: { loading: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-700 px-3 text-sm font-semibold text-slate-200 hover:bg-gray-800 disabled:opacity-50"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      Refresh
    </button>
  );
}

export function AskVortaButton({ question }: { question: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => openMaintenanceAiAssistant({ question })}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
    >
      <Sparkles className="h-4 w-4" />
      Ask Vorta
    </button>
  );
}

export function documentStatusTone(document: LiveEquipmentDocumentSummary): string {
  if (!document.isCurrent || /expired|obsolete|withdrawn/i.test(document.status)) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (/review|draft|pending/i.test(`${document.status} ${document.approvalStatus}`)) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}
