import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, RefreshCw, ShieldAlert, Wrench } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { MobilePageHeader } from "../../components/MobilePageHeader";
import { EquipmentTabNavigation } from "./EquipmentTabNavigation";
import {
  getEquipmentIdentityById,
  getEquipmentList,
  getEquipmentRecommendedWorkQueue,
  getEquipmentWorkOrders,
  type EquipmentListItem,
  type EquipmentRecommendedWorkQueue,
} from "./equipmentService";
import type { Equipment } from "./equipmentTypes";

function riskTone(level: string): string {
  const value = level.toLowerCase();
  if (value === "critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (value === "high") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (value === "medium") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (value === "low") return "border-lime-500/30 bg-lime-500/10 text-lime-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

export function MobileEquipmentOverview(): JSX.Element {
  const navigate = useNavigate();
  const { equipmentId = "" } = useParams<{ equipmentId?: string }>();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [summary, setSummary] = useState<EquipmentListItem | null>(null);
  const [queue, setQueue] = useState<EquipmentRecommendedWorkQueue | null>(null);
  const [openWorkOrders, setOpenWorkOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!equipmentId) {
      setError("The equipment reference is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [identityResult, listResult, workOrderResult, queueResult] = await Promise.allSettled([
        getEquipmentIdentityById(equipmentId),
        getEquipmentList(),
        getEquipmentWorkOrders(equipmentId),
        getEquipmentRecommendedWorkQueue(equipmentId),
      ]);

      if (identityResult.status !== "fulfilled") {
        throw identityResult.reason instanceof Error
          ? identityResult.reason
          : new Error("Equipment identity could not be loaded.");
      }

      setEquipment(identityResult.value);
      setSummary(
        listResult.status === "fulfilled"
          ? listResult.value.find((item) => item.id === equipmentId) ?? null
          : null,
      );
      setOpenWorkOrders(
        workOrderResult.status === "fulfilled" ? workOrderResult.value.open.length : 0,
      );
      setQueue(queueResult.status === "fulfilled" ? queueResult.value : null);
    } catch (loadError) {
      setEquipment(null);
      setSummary(null);
      setQueue(null);
      setOpenWorkOrders(0);
      setError(loadError instanceof Error ? loadError.message : "Equipment evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [equipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const riskDrivers = useMemo(
    () => (summary?.breakdown ?? equipment?.riskBreakdown ?? []).slice(0, 3),
    [equipment?.riskBreakdown, summary?.breakdown],
  );
  const primaryAction = queue?.actions[0] ?? null;
  const overdueTotal = (summary?.overduePmCount ?? 0) + (summary?.calibrationOverdueCount ?? 0);

  if (!equipment && loading) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center" role="status">
        <span className="inline-flex items-center gap-2 text-sm text-slate-400">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-400" aria-hidden="true" />
          Loading equipment overview…
        </span>
      </section>
    );
  }

  return (
    <section
      data-vorta-mobile-equipment-overview="true"
      className="flex w-full flex-col gap-4 overflow-x-hidden px-3 pb-28 pt-4"
    >
      <MobilePageHeader
        eyebrow={equipment?.assetNumber ?? "Equipment"}
        title={equipment?.name ?? "Equipment overview"}
        description={equipment ? `${equipment.area} · ${equipment.type}` : "Operational asset evidence"}
        actionLabel="Refresh equipment overview"
        busy={loading}
        onAction={() => void load()}
      />

      {equipment ? <EquipmentTabNavigation equipmentId={equipment.id} activeTab="overview" /> : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <p className="font-semibold">Equipment evidence unavailable</p>
          </div>
          <p className="mt-2 text-sm text-red-200/80">{error}</p>
        </div>
      ) : null}

      {equipment ? (
        <>
          <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Current risk</p>
                <p className="mt-2 text-4xl font-bold tracking-tight text-slate-50">
                  {(summary?.riskScore ?? equipment.riskScore).toFixed(1)}
                </p>
              </div>
              <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${riskTone(summary?.riskLevel ?? equipment.riskLevel)}`}>
                {summary?.riskLevel ?? equipment.riskLevel}
              </span>
            </div>
            <p className="mt-3 text-sm leading-5 text-slate-400">
              {equipment.statusNote || primaryAction?.detail || "Current risk is based on the latest recorded asset evidence."}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
              <p className="text-[10px] text-slate-500">Open WOs</p>
              <p className="mt-1 text-xl font-semibold text-slate-50">{openWorkOrders}</p>
            </div>
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.05] p-3">
              <p className="text-[10px] text-slate-500">Overdue</p>
              <p className="mt-1 text-xl font-semibold text-orange-300">{overdueTotal}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
              <p className="text-[10px] text-slate-500">After actions</p>
              <p className="mt-1 text-xl font-semibold text-emerald-300">
                {queue ? queue.projectedRiskScore.toFixed(1) : "—"}
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-gray-800 bg-[#141820] p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-orange-300" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-100">Main risk drivers</h2>
            </div>
            {riskDrivers.length ? (
              <div className="mt-3 flex flex-col gap-3">
                {riskDrivers.map((driver) => (
                  <div key={driver.label}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-400">{driver.label}</span>
                      <span className="font-semibold tabular-nums text-slate-200">{driver.pct.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, driver.pct))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No current risk-driver evidence is available.</p>
            )}
          </section>

          <section className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-4">
            <div className="flex items-start gap-3">
              <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-blue-200">Next maintenance action</p>
                <p className="mt-2 text-sm leading-5 text-slate-300">
                  {primaryAction?.action || "Review open work and overdue maintenance for this asset."}
                </p>
                {primaryAction?.detail ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">{primaryAction.detail}</p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/equipment/${equipment.id}/work-orders`)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-between rounded-xl border border-blue-500/25 bg-[#141820] px-4 text-sm font-semibold text-slate-100"
            >
              View work and actions <ChevronRight className="h-4 w-4 text-blue-300" aria-hidden="true" />
            </button>
          </section>
        </>
      ) : null}
    </section>
  );
}
