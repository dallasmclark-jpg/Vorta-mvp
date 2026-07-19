import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import type {
  Equipment,
  PreventiveMaintenance,
  WorkOrder,
  CompletedWorkOrder,
} from "./equipmentTypes";
import type {
  EquipmentRecommendedWorkQueue,
  SkillsCoverageSummary,
} from "./equipmentService";
import {
  getEquipmentIdentityById,
  getEquipmentPMs,
  getEquipmentRecommendedWorkQueue,
  getEquipmentSkills,
  getEquipmentWorkOrders,
} from "./equipmentService";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";

interface EquipmentOverviewLiveData {
  equipment: Equipment;
  openWorkOrders: WorkOrder[];
  completedWorkOrders: CompletedWorkOrder[];
  preventiveMaintenance: PreventiveMaintenance[];
  skillsCoverage: SkillsCoverageSummary | null;
  workQueue: EquipmentRecommendedWorkQueue | null;
  partialFailures: string[];
}

function riskClasses(level: Equipment["riskLevel"]): string {
  switch (level) {
    case "Critical":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "High":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    case "Medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "text-slate-50",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Gauge;
  tone?: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
      </div>
      <p className={`mt-3 text-2xl font-bold tabular-nums ${tone}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export function EquipmentOverviewLive(): JSX.Element {
  const { equipmentId } = useParams();
  const navigate = useNavigate();
  const [data, setData] =
    useState<EquipmentOverviewLiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!equipmentId) {
      setData(null);
      setError("No equipment identifier was supplied.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const equipment = await getEquipmentIdentityById(equipmentId);
      const [workOrders, pms, skills, workQueue] =
        await Promise.allSettled([
          getEquipmentWorkOrders(equipmentId),
          getEquipmentPMs(equipmentId),
          getEquipmentSkills(equipmentId),
          getEquipmentRecommendedWorkQueue(equipmentId),
        ]);

      const partialFailures: string[] = [];

      if (workOrders.status === "rejected") {
        partialFailures.push("work orders");
      }
      if (pms.status === "rejected") {
        partialFailures.push("calibrations and PMs");
      }
      if (skills.status === "rejected") {
        partialFailures.push("skills coverage");
      }
      if (workQueue.status === "rejected") {
        partialFailures.push("recommended work queue");
      }

      setData({
        equipment,
        openWorkOrders:
          workOrders.status === "fulfilled"
            ? workOrders.value.open
            : [],
        completedWorkOrders:
          workOrders.status === "fulfilled"
            ? workOrders.value.completed
            : [],
        preventiveMaintenance:
          pms.status === "fulfilled" ? pms.value : [],
        skillsCoverage:
          skills.status === "fulfilled"
            ? skills.value.coverageSummary
            : null,
        workQueue:
          workQueue.status === "fulfilled"
            ? workQueue.value
            : null,
        partialFailures,
      });
    } catch (loadError) {
      setData(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Verified equipment data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [equipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center px-6">
        <span className="inline-flex items-center gap-2 text-sm text-slate-400">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
          Loading verified equipment records…
        </span>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="flex w-full flex-col gap-5 px-4 pb-12 pt-4 md:px-6 xl:px-8">
        <button
          type="button"
          onClick={() => navigate("/equipment")}
          className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Equipment
        </button>
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/[0.07] p-5"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div>
              <h1 className="text-base font-semibold text-red-100">
                Equipment data unavailable
              </h1>
              <p className="mt-1 text-sm leading-6 text-red-100/75">
                {error ?? "No authorised equipment record was returned."}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Vorta did not substitute a local equipment profile or generated risk evidence.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const { equipment } = data;
  const overduePmCount = data.preventiveMaintenance.filter(
    (item) => item.status === "OVERDUE",
  ).length;
  const criticalWorkOrderCount = data.openWorkOrders.filter(
    (item) => item.priority === "CRITICAL",
  ).length;
  const workQueueActions = data.workQueue?.actions ?? [];

  return (
    <section className="flex w-full flex-col gap-6 px-4 pb-12 pt-4 md:px-6 xl:px-8">
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
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">
                {equipment.name}
              </h1>
              <span
                className={`rounded-md border px-2 py-1 text-xs font-bold uppercase ${riskClasses(
                  equipment.riskLevel,
                )}`}
              >
                {equipment.riskLevel} risk
              </span>
              <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold tracking-[0.12em] text-emerald-300">
                LIVE RECORD
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {equipment.assetNumber} · {equipment.area} · {equipment.manufacturer} {equipment.model}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {equipment.status} · {equipment.statusNote}
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-[#141820] px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Current risk
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-50">
                {equipment.riskScore.toFixed(1)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-700 text-slate-300 hover:bg-gray-800 disabled:opacity-50"
              aria-label="Refresh equipment data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <EquipmentTabNavigation
          equipmentId={equipment.id}
          activeTab="overview"
        />
      </header>

      {data.partialFailures.length > 0 ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3"
        >
          <p className="text-sm font-semibold text-amber-200">
            Some live evidence is temporarily unavailable
          </p>
          <p className="mt-1 text-xs text-amber-100/70">
            Missing: {data.partialFailures.join(", ")}. Available sections remain live and no demo values were inserted.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Open work orders"
          value={data.openWorkOrders.length}
          detail={`${criticalWorkOrderCount} critical`}
          icon={ClipboardList}
          tone={criticalWorkOrderCount > 0 ? "text-red-300" : undefined}
        />
        <MetricCard
          label="PM / calibration backlog"
          value={overduePmCount}
          detail={`${data.preventiveMaintenance.length} plans returned`}
          icon={Wrench}
          tone={overduePmCount > 0 ? "text-orange-300" : undefined}
        />
        <MetricCard
          label="Skill coverage"
          value={
            data.skillsCoverage
              ? `${data.skillsCoverage.coveragePercent.toFixed(1)}%`
              : "—"
          }
          detail={
            data.skillsCoverage
              ? `${data.skillsCoverage.missing} missing · ${data.skillsCoverage.atRisk} at risk`
              : "Live coverage unavailable"
          }
          icon={Users}
        />
        <MetricCard
          label="Completed history"
          value={data.completedWorkOrders.length}
          detail="Completed work orders returned"
          icon={CheckCircle2}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="rounded-xl border border-gray-800 bg-[#141820] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Live risk drivers
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-50">
                Current equipment risk composition
              </h2>
            </div>
            <Gauge className="h-5 w-5 text-slate-500" />
          </div>

          {equipment.riskBreakdown.length > 0 ? (
            <div className="mt-5 space-y-4">
              {equipment.riskBreakdown.map((driver) => (
                <div key={driver.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-slate-300">
                      {driver.label}
                    </span>
                    <span className="tabular-nums text-slate-500">
                      {driver.pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#080b10] ring-1 ring-inset ring-gray-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(100, driver.pct))}%`,
                        backgroundColor: driver.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500">
              No live risk-driver breakdown was returned for this equipment.
            </p>
          )}
        </div>

        <aside className="rounded-xl border border-gray-800 bg-[#141820] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Data trust
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-50">
                Authoritative evidence only
              </h2>
            </div>
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <ul className="mt-4 space-y-3 text-xs leading-5 text-slate-400">
            <li>Equipment identity is loaded from the authorised site record.</li>
            <li>Work orders, PMs and skills remain empty when their live query fails.</li>
            <li>No local equipment profile or generated KPI is used in live mode.</li>
          </ul>
        </aside>
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#141820] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">
              Recommended work queue
            </p>
            <h2 className="mt-1 text-base font-semibold text-slate-50">
              Ranked live risk-reduction actions
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {workQueueActions.length} action{workQueueActions.length === 1 ? "" : "s"}
          </span>
        </div>

        {workQueueActions.length > 0 ? (
          <div className="mt-4 space-y-2">
            {workQueueActions.slice(0, 5).map((action, index) => (
              <div
                key={`${action.priority}-${action.action}-${index}`}
                className="grid gap-3 rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-300">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">
                    {action.action}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {action.driver}
                    {action.workOrderNumber
                      ? ` · ${action.workOrderNumber}`
                      : action.pmNumber
                        ? ` · ${action.pmNumber}`
                        : action.sparePartNumber
                          ? ` · ${action.sparePartNumber}`
                          : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-300">
                    −{action.calculatedReduction.toFixed(1)}
                  </p>
                  <p className="text-xs text-slate-500">
                    to {action.projectedScore.toFixed(1)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-gray-800 bg-[#0d1117] px-5 py-8 text-center">
            <p className="text-sm font-semibold text-slate-300">
              No live recommended actions were returned
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Vorta has not generated a fallback plan for this equipment.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
