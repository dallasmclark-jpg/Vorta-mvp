import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Package, Wrench, XCircle } from "lucide-react";
import {
  getAreaInterventionPlans,
  type AreaInterventionPlan,
  type AreaInterventionWorkItem,
} from "../Equipment/equipmentService";
import {
  getPlannerReadinessScores,
  type PlannerReadinessScore,
} from "./plannerService";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const SHIFTS = ["Day Shift", "Night Shift"] as const;

function statusIcon(status: string) {
  if (status === "Available" || status === "Covered" || status === "Ready")
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  if (status === "Partial" || status === "Low")
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
}

function readinessColor(level: string): { ring: string; bg: string; text: string; badge: string } {
  switch (level) {
    case "Ready":   return { ring: "ring-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-400", badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" };
    case "Review":  return { ring: "ring-amber-500/40",   bg: "bg-amber-500/10",   text: "text-amber-400",   badge: "border-amber-500/30 bg-amber-500/10 text-amber-300"   };
    case "At Risk": return { ring: "ring-orange-500/40",  bg: "bg-orange-500/10",  text: "text-orange-400",  badge: "border-orange-500/30 bg-orange-500/10 text-orange-300" };
    case "Blocked": return { ring: "ring-red-500/40",     bg: "bg-red-500/10",     text: "text-red-400",     badge: "border-red-500/30 bg-red-500/10 text-red-300"         };
    default:        return { ring: "ring-gray-700",       bg: "bg-gray-800/40",    text: "text-slate-400",   badge: "border-gray-700 bg-gray-800 text-slate-400"            };
  }
}

function riskColor(level: string) {
  if (level === "Critical") return "text-red-400";
  if (level === "High")     return "text-orange-400";
  if (level === "Medium")   return "text-amber-400";
  return "text-emerald-400";
}

function formatDate(iso: string) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

// ─── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, accent }: {
  label: string; value: number | string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-[#0d1117] px-5 py-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-slate-50 leading-none">{value}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// ─── Readiness gauge ───────────────────────────────────────────────────────────

function ReadinessGauge({ score, level }: { score: number; level: string }) {
  const col = readinessColor(level);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl ring-2 ${col.ring} ${col.bg} py-6`}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#1e2535" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          className={col.text}
        />
        <text x="70" y="65" textAnchor="middle" className="fill-slate-50" fontSize="26" fontWeight="700">{score}</text>
        <text x="70" y="83" textAnchor="middle" className="fill-slate-500" fontSize="11">/ 100</text>
      </svg>
      <span className={`mt-1 inline-flex rounded-full border px-3 py-0.5 text-xs font-semibold ${col.badge}`}>
        {level}
      </span>
    </div>
  );
}

// ─── Readiness breakdown ───────────────────────────────────────────────────────

function BreakdownRow({ label, left, right, status }: {
  label: string; left: string; right: string; status: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-800 last:border-0">
      <span className="text-xs font-semibold text-slate-400 w-20 shrink-0">{label}</span>
      <div className="flex flex-1 items-center justify-between gap-4 text-xs text-slate-500">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {statusIcon(status)}
        <span className="text-[11px] text-slate-400">{status}</span>
      </div>
    </div>
  );
}

// ─── Best windows table ────────────────────────────────────────────────────────

function BestWindowsTable({
  scores,
  selectedDate,
  selectedShift,
  onSelect,
}: {
  scores: PlannerReadinessScore[];
  selectedDate: string;
  selectedShift: string;
  onSelect: (date: string, shift: string) => void;
}) {
  const top5 = useMemo(
    () =>
      [...scores]
        .sort((a, b) => b.readinessScore - a.readinessScore || a.proposedDate.localeCompare(b.proposedDate))
        .slice(0, 5),
    [scores],
  );

  if (top5.length === 0) {
    return (
      <p className="rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3 text-xs text-slate-500">
        No readiness data available. Insert rows into planner_readiness_scores to see best windows.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {top5.map((s) => {
        const col = readinessColor(s.readinessLevel);
        const active = s.proposedDate === selectedDate && s.proposedShift === selectedShift;
        return (
          <button
            key={`${s.proposedDate}-${s.proposedShift}`}
            onClick={() => onSelect(s.proposedDate, s.proposedShift)}
            className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-left transition-colors ${
              active
                ? "border-blue-500/40 bg-blue-500/10"
                : "border-gray-800 bg-[#0d1117] hover:border-gray-700"
            }`}
          >
            <div className="flex flex-col gap-0">
              <span className="text-xs font-semibold text-slate-200">{formatDate(s.proposedDate)}</span>
              <span className="text-[10px] text-slate-500">{s.proposedShift}</span>
            </div>
            <div className="flex items-center gap-3">
              {s.warnings.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  {s.warnings.length}
                </span>
              )}
              <div className={`text-sm font-bold ${col.text}`}>{s.readinessScore}</div>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${col.badge}`}>
                {s.readinessLevel}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Work pack summary ─────────────────────────────────────────────────────────

function WorkPackSummary({ plan }: { plan: AreaInterventionPlan }) {
  if (plan.workItems.length === 0) {
    return (
      <p className="rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3 text-xs text-slate-500">
        No structured work items found for this area.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {plan.workItems.map((item: AreaInterventionWorkItem & { workRef?: string }, i: number) => (
        <div key={i} className="rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[9px] font-semibold text-slate-400">
                  {item.priority}
                </span>
                <span className="text-xs font-semibold text-slate-100">{item.asset}</span>
                {item.assetCode && <span className="text-[10px] text-slate-500">{item.assetCode}</span>}
                {item.workRef && (
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                    {item.workRef}
                  </span>
                )}
              </div>
              <span className="ml-6 text-[11px] text-slate-500">{item.action}</span>
            </div>
            <div className="shrink-0 flex items-center gap-3 text-xs">
              <span className="text-emerald-400 font-semibold">▼{item.estimatedReduction}</span>
              <span className="text-slate-500">{item.estimatedHours}h</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main section ──────────────────────────────────────────────────────────────

export function PlannerDashboardSection() {
  const [plans,           setPlans]           = useState<AreaInterventionPlan[]>([]);
  const [readinessScores, setReadinessScores] = useState<PlannerReadinessScore[]>([]);
  const [loading,         setLoading]         = useState(true);

  const [selectedArea,  setSelectedArea]  = useState<string | null>(null);
  const [proposedDate,  setProposedDate]  = useState<string>("");
  const [proposedShift, setProposedShift] = useState<string>("Day Shift");

  useEffect(() => {
    Promise.all([getAreaInterventionPlans(), getPlannerReadinessScores()]).then(
      ([planData, readinessData]) => {
        setPlans(planData);
        setReadinessScores(readinessData);
        if (planData.length > 0) setSelectedArea(planData[0].area);
        setLoading(false);
      },
    );
  }, []);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.area === selectedArea) ?? null,
    [plans, selectedArea],
  );

  const areaReadiness = useMemo(
    () => readinessScores.filter((s) => s.area === selectedArea),
    [readinessScores, selectedArea],
  );

  const activeReadiness = useMemo(
    () =>
      areaReadiness.find(
        (s) => s.proposedDate === proposedDate && s.proposedShift === proposedShift,
      ) ?? null,
    [areaReadiness, proposedDate, proposedShift],
  );

  // KPI derivations
  const totalLabour = useMemo(
    () => plans.reduce((sum, p) => sum + p.resourceRequirements.reduce((s, r) => s + (r.estimatedHours ?? 0), 0), 0),
    [plans],
  );
  const readyCount    = areaReadiness.filter((s) => s.readinessLevel === "Ready").length;
  const blockedCount  = areaReadiness.filter((s) => s.readinessLevel === "Blocked").length;

  const handleWindowSelect = (date: string, shift: string) => {
    setProposedDate(date);
    setProposedShift(shift);
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-50">Planner Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Select an area, choose a date and shift, and review planning readiness.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Areas to Plan"       value={loading ? "—" : plans.length}           icon={Clock}        accent="bg-blue-500/15 text-blue-400"     />
        <KpiCard label="Ready Windows"       value={loading ? "—" : readyCount}             icon={CheckCircle2} accent="bg-emerald-500/15 text-emerald-400" />
        <KpiCard label="Blocked Windows"     value={loading ? "—" : blockedCount}           icon={XCircle}      accent="bg-red-500/15 text-red-400"       />
        <KpiCard label="Total Labour Req."   value={loading ? "—" : `${totalLabour}h`}      icon={Package}      accent="bg-amber-500/15 text-amber-400"    />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">

        {/* LEFT — Planning Queue + Work Pack Summary */}
        <div className="flex flex-col gap-6">

          {/* Planning Queue */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-200">Interventions Awaiting Planning</h2>
            {loading ? (
              <div className="flex items-center justify-center rounded-xl border border-gray-800 bg-[#0d1117] py-12">
                <svg className="h-5 w-5 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </div>
            ) : plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-[#0d1117] py-12 text-center">
                <p className="text-sm font-semibold text-slate-400">No intervention plans found</p>
                <p className="mt-1 text-xs text-slate-600">Plans are generated from area risk analysis.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {plans.map((plan) => {
                  const labourHrs = plan.resourceRequirements.reduce((s, r) => s + (r.estimatedHours ?? 0), 0);
                  const active = plan.area === selectedArea;
                  return (
                    <button
                      key={plan.area}
                      onClick={() => { setSelectedArea(plan.area); setProposedDate(""); }}
                      className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-4 text-left transition-colors ${
                        active
                          ? "border-blue-500/40 bg-blue-500/8"
                          : "border-gray-800 bg-[#0d1117] hover:border-gray-700"
                      }`}
                    >
                      <div className="w-36 shrink-0">
                        <p className="text-sm font-semibold text-slate-100">{plan.area}</p>
                        <p className={`text-xs font-semibold ${riskColor(plan.currentRiskLevel)}`}>
                          Risk {plan.currentRiskScore}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1 hidden sm:block">
                        <p className="truncate text-sm text-slate-300">{plan.recommendedOption}</p>
                        <p className="text-xs text-slate-500">{plan.recommendedDurationHours} hrs</p>
                      </div>
                      <div className="flex items-center gap-5 shrink-0 text-center">
                        <div>
                          <p className="text-sm font-bold text-emerald-400">▼{plan.recommendedReduction}</p>
                          <p className="text-[10px] text-slate-600">Reduction</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{plan.workItems.length}</p>
                          <p className="text-[10px] text-slate-600">Items</p>
                        </div>
                        {labourHrs > 0 && (
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{labourHrs}h</p>
                            <p className="text-[10px] text-slate-600">Labour</p>
                          </div>
                        )}
                        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300">
                          Awaiting planning
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Work Pack Summary */}
          {selectedPlan && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-200">
                  Work Pack — {selectedPlan.area}
                </h2>
              </div>
              <WorkPackSummary plan={selectedPlan} />
            </div>
          )}
        </div>

        {/* RIGHT — Date/Shift + Readiness + Best Windows */}
        <div className="flex flex-col gap-5">

          {/* Proposed Date & Shift */}
          <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-200">Proposed Date &amp; Shift</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Area
                </label>
                <select
                  value={selectedArea ?? ""}
                  onChange={(e) => { setSelectedArea(e.target.value); setProposedDate(""); }}
                  className="h-10 w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3 text-sm text-slate-200 outline-none transition-colors focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                >
                  {plans.map((p) => (
                    <option key={p.area} value={p.area}>{p.area}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Proposed Date
                </label>
                <input
                  type="date"
                  value={proposedDate}
                  onChange={(e) => setProposedDate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3 text-sm text-slate-200 outline-none transition-colors focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Shift
                </label>
                <div className="flex gap-2">
                  {SHIFTS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setProposedShift(s)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                        proposedShift === s
                          ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                          : "border-gray-700 bg-transparent text-slate-400 hover:border-gray-600 hover:text-slate-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Planning Readiness Score */}
          <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-200">Planning Readiness Score</h2>

            {!proposedDate ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Clock className="mb-2 h-8 w-8 text-slate-700" />
                <p className="text-sm text-slate-500">Select a date to calculate readiness.</p>
              </div>
            ) : !activeReadiness ? (
              <div className="flex flex-col items-center py-6 text-center">
                <AlertTriangle className="mb-2 h-8 w-8 text-slate-700" />
                <p className="text-sm text-slate-500">No readiness data for this date &amp; shift.</p>
                <p className="mt-1 text-xs text-slate-600">Insert a row into planner_readiness_scores to see the score.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <ReadinessGauge
                  score={activeReadiness.readinessScore}
                  level={activeReadiness.readinessLevel}
                />

                {/* Breakdown */}
                <div className="rounded-lg border border-gray-800 px-4 py-1">
                  <BreakdownRow
                    label="Labour"
                    left={`Req: ${activeReadiness.labourRequiredHours}h`}
                    right={`Avail: ${activeReadiness.labourAvailableHours}h`}
                    status={activeReadiness.labourStatus}
                  />
                  <BreakdownRow
                    label="Skills"
                    left={`Req: ${activeReadiness.skillsRequired}`}
                    right={`Covered: ${activeReadiness.skillsCovered}`}
                    status={activeReadiness.skillsStatus}
                  />
                  <BreakdownRow
                    label="Spares"
                    left={`Req: ${activeReadiness.sparesRequired}`}
                    right={`Ready: ${activeReadiness.sparesReady}`}
                    status={activeReadiness.sparesStatus}
                  />
                  {activeReadiness.workloadClashHours > 0 && (
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-xs font-semibold text-slate-400">Clash hours</span>
                      <span className="text-xs font-semibold text-amber-400">
                        {activeReadiness.workloadClashHours}h
                      </span>
                    </div>
                  )}
                </div>

                {/* Warnings */}
                {activeReadiness.warnings.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {activeReadiness.warnings.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2"
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <span className="text-xs text-amber-300">{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendation */}
                {activeReadiness.recommendation && (
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/8 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 mb-1">
                      Recommendation
                    </p>
                    <p className="text-xs text-blue-300">{activeReadiness.recommendation}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Best Available Windows */}
          {selectedArea && areaReadiness.length > 0 && (
            <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Best Available Windows</h2>
              <p className="mb-3 text-[11px] text-slate-600">Top 5 by readiness score — click to select.</p>
              <BestWindowsTable
                scores={areaReadiness}
                selectedDate={proposedDate}
                selectedShift={proposedShift}
                onSelect={handleWindowSelect}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
