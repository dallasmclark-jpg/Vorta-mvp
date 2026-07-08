import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Package, Wrench } from "lucide-react";
import {
  getAreaInterventionPlans,
  type AreaInterventionPlan,
  type AreaInterventionWorkItem,
} from "../Equipment/equipmentService";

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  "Draft",
  "Ready for Review",
  "Released to Shift",
  "Blocked",
] as const;
type PlanStatus = (typeof STATUS_OPTIONS)[number];

function StatusBadge({ status }: { status: PlanStatus }) {
  const style: Record<PlanStatus, string> = {
    Draft:              "border-gray-700 bg-gray-800/50 text-slate-400",
    "Ready for Review": "border-amber-500/30 bg-amber-500/10 text-amber-400",
    "Released to Shift":"border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    Blocked:            "border-red-500/30 bg-red-500/10 text-red-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${style[status]}`}>
      {status}
    </span>
  );
}

// ─── Risk level colour ─────────────────────────────────────────────────────────

function riskColor(level: string) {
  if (level === "Critical") return "text-red-400";
  if (level === "High")     return "text-orange-400";
  if (level === "Medium")   return "text-amber-400";
  return "text-emerald-400";
}

// ─── Work Pack Drawer ──────────────────────────────────────────────────────────

interface WorkPackDrawerProps {
  plan: AreaInterventionPlan;
  status: PlanStatus;
  notes: string;
  onStatusChange: (s: PlanStatus) => void;
  onNotesChange: (n: string) => void;
  onSaveDraft: () => void;
  onRelease: () => void;
  onClose: () => void;
}

function WorkPackDrawer({
  plan,
  status,
  notes,
  onStatusChange,
  onNotesChange,
  onSaveDraft,
  onRelease,
  onClose,
}: WorkPackDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-gray-800 bg-[#090b10] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-slate-50">Planner Work Pack</h2>
            <p className="mt-0.5 text-xs text-slate-500">{plan.area}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Intervention",  value: plan.recommendedOption },
              { label: "Duration",      value: `${plan.recommendedDurationHours} hrs` },
              { label: "Risk reduction",value: `▼${plan.recommendedReduction}` },
              { label: "Work items",    value: `${plan.workItems.length} items` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</span>
                <span className="mt-1 block text-sm font-semibold text-slate-200">{value}</span>
              </div>
            ))}
          </div>

          {/* Target work list */}
          {plan.workItems.length > 0 && (
            <div>
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Target Work List</h3>
              <div className="flex flex-col gap-2">
                {plan.workItems.map((item: AreaInterventionWorkItem, i: number) => (
                  <div key={i} className="rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[10px] font-semibold text-slate-400">
                            {item.priority}
                          </span>
                          <span className="text-xs font-semibold text-slate-100">{item.asset}</span>
                          {item.assetCode && <span className="text-[10px] text-slate-500">{item.assetCode}</span>}
                        </div>
                        <div className="ml-7 flex flex-wrap gap-x-4 gap-y-0.5">
                          <span className="text-[11px] text-slate-400">
                            <span className="text-slate-600">Action: </span>{item.action}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            <span className="text-slate-600">Driver: </span>{item.driver}
                          </span>
                          {(item as AreaInterventionWorkItem & { workRef?: string }).workRef && (
                            <span className="text-[11px] text-slate-400">
                              <span className="text-slate-600">SAP Ref: </span>
                              <span className="font-mono">{(item as AreaInterventionWorkItem & { workRef?: string }).workRef}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-0.5">
                        <span className="text-sm font-bold text-emerald-400">▼{item.estimatedReduction}</span>
                        <span className="text-[10px] text-slate-500">{item.estimatedHours} hrs</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Required resources */}
          {plan.resourceRequirements.length > 0 && (
            <div>
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Required Resources</h3>
              <div className="flex flex-col gap-2">
                {plan.resourceRequirements.map((req, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3">
                    <span className="text-sm font-semibold text-slate-200">{req.role}</span>
                    <div className="flex items-center gap-6 text-xs text-slate-400">
                      <span>Engineers: <span className="font-semibold text-slate-200">{req.engineers}</span></span>
                      <span>Labour: <span className="font-semibold text-slate-200">{req.estimatedHours} hrs</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    status === s
                      ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                      : "border-gray-700 bg-transparent text-slate-400 hover:border-gray-600 hover:text-slate-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Planner notes */}
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Planner Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={4}
              placeholder="Add planning notes, constraints, or shift handover details…"
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3.5 py-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-gray-800 px-6 py-4">
          <button
            onClick={onSaveDraft}
            className="flex-1 rounded-lg border border-gray-700 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-100"
          >
            Save Draft
          </button>
          <button
            onClick={onRelease}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Release to Shift
          </button>
        </div>
      </div>
    </>
  );
}

// ─── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-[#0d1117] p-5">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-50">{value}</p>
        <p className="mt-0.5 text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// ─── Intervention row ──────────────────────────────────────────────────────────

function InterventionRow({
  plan,
  packStatus,
  onBuildPack,
}: {
  plan: AreaInterventionPlan;
  packStatus: PlanStatus;
  onBuildPack: () => void;
}) {
  const totalLabour = plan.resourceRequirements.reduce(
    (sum, r) => sum + (r.estimatedHours ?? 0),
    0,
  );

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-[#0d1117] px-5 py-4 transition-colors hover:border-gray-700">
      {/* Area + risk */}
      <div className="w-40 shrink-0">
        <p className="text-sm font-semibold text-slate-100">{plan.area}</p>
        <p className={`text-xs font-semibold ${riskColor(plan.currentRiskLevel)}`}>
          Risk {plan.currentRiskScore}
        </p>
      </div>

      {/* Intervention */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm text-slate-300">{plan.recommendedOption}</p>
        <p className="text-xs text-slate-500">{plan.recommendedDurationHours} hrs</p>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-6 shrink-0">
        <div className="text-center">
          <p className="text-sm font-bold text-emerald-400">▼{plan.recommendedReduction}</p>
          <p className="text-[10px] text-slate-600">Reduction</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-200">{plan.workItems.length}</p>
          <p className="text-[10px] text-slate-600">Work items</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-200">{totalLabour > 0 ? `${totalLabour}h` : "—"}</p>
          <p className="text-[10px] text-slate-600">Labour hrs</p>
        </div>
      </div>

      {/* Status + CTA */}
      <div className="flex items-center gap-3 shrink-0">
        <StatusBadge status={packStatus} />
        <button
          onClick={onBuildPack}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600/15 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-600/25 hover:border-blue-500/50"
        >
          <Wrench className="h-3 w-3" />
          Build work pack
        </button>
      </div>
    </div>
  );
}

// ─── Main section ──────────────────────────────────────────────────────────────

export function PlannerDashboardSection() {
  const [plans, setPlans] = useState<AreaInterventionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-area work pack state: status + notes
  const [packStatuses, setPackStatuses] = useState<Record<string, PlanStatus>>({});
  const [packNotes,    setPackNotes]    = useState<Record<string, string>>({});

  // Drawer state
  const [openPlan, setOpenPlan] = useState<AreaInterventionPlan | null>(null);

  useEffect(() => {
    getAreaInterventionPlans().then((data) => {
      setPlans(data);
      const initial: Record<string, PlanStatus> = {};
      data.forEach((p) => { initial[p.area] = "Draft"; });
      setPackStatuses(initial);
      setLoading(false);
    });
  }, []);

  const statusFor   = (area: string): PlanStatus => packStatuses[area] ?? "Draft";
  const notesFor    = (area: string): string      => packNotes[area]    ?? "";

  // KPI derivations
  const awaitingPlanning = plans.filter((p) => statusFor(p.area) === "Draft").length;
  const readyToRelease   = plans.filter((p) => statusFor(p.area) === "Ready for Review").length;
  const blockedBySpares  = plans.filter((p) => statusFor(p.area) === "Blocked").length;
  const totalLabourHours = plans.reduce(
    (sum, p) => sum + p.resourceRequirements.reduce((s, r) => s + (r.estimatedHours ?? 0), 0),
    0,
  );

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-50">Planner Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Risk-based intervention planning and work pack release.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Awaiting Planning"   value={loading ? "—" : awaitingPlanning} icon={Clock}         accent="bg-blue-500/15 text-blue-400"    />
        <KpiCard label="Ready to Release"    value={loading ? "—" : readyToRelease}   icon={CheckCircle2}  accent="bg-emerald-500/15 text-emerald-400" />
        <KpiCard label="Blocked by Spares"   value={loading ? "—" : blockedBySpares}  icon={AlertCircle}   accent="bg-red-500/15 text-red-400"      />
        <KpiCard label="Labour Hours Required" value={loading ? "—" : `${totalLabourHours}h`} icon={Package} accent="bg-amber-500/15 text-amber-400" />
      </div>

      {/* Interventions table */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Interventions Awaiting Planning</h2>
          <span className="text-xs text-slate-500">{loading ? "" : `${plans.length} areas`}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-gray-800 bg-[#0d1117] py-16">
            <svg className="h-5 w-5 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-[#0d1117] py-16 text-center">
            <p className="text-sm font-semibold text-slate-400">No intervention plans found</p>
            <p className="mt-1 text-xs text-slate-600">Plans are generated from area risk analysis.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {plans.map((plan) => (
              <InterventionRow
                key={plan.area}
                plan={plan}
                packStatus={statusFor(plan.area)}
                onBuildPack={() => setOpenPlan(plan)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Work pack drawer */}
      {openPlan && (
        <WorkPackDrawer
          plan={openPlan}
          status={statusFor(openPlan.area)}
          notes={notesFor(openPlan.area)}
          onStatusChange={(s) => setPackStatuses((prev) => ({ ...prev, [openPlan.area]: s }))}
          onNotesChange={(n) => setPackNotes((prev) => ({ ...prev, [openPlan.area]: n }))}
          onSaveDraft={() => {
            setPackStatuses((prev) => ({ ...prev, [openPlan.area]: "Ready for Review" }));
            setOpenPlan(null);
          }}
          onRelease={() => {
            setPackStatuses((prev) => ({ ...prev, [openPlan.area]: "Released to Shift" }));
            setOpenPlan(null);
          }}
          onClose={() => setOpenPlan(null)}
        />
      )}
    </div>
  );
}
