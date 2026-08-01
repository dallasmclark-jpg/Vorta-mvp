import { useEffect, type KeyboardEvent } from "react";
import { ArrowRight, PackageX, TrendingDown } from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import { Card, CardContent } from "../../../../components/ui/card";
import { openWorkOrderDetail } from "../../../../lib/maintenanceActions";
import type {
  SiteRiskReductionAction,
  SiteRiskReductionPlan,
} from "../../../Equipment/equipmentService";
import { getRiskPlanActionRoute } from "../../riskActionRouting";
import {
  restoreDashboardScrollPosition,
  saveDashboardScrollPosition,
} from "./dashboardScrollState";

const ACTION_CATEGORY: Record<SiteRiskReductionAction["target"], string> = {
  spares: "Spare availability",
  skills: "Skills coverage",
  calibrations: "Calibration",
  "work-orders": "Maintenance work",
  overview: "Operational risk",
};

function rankActions(
  actions: SiteRiskReductionAction[],
): SiteRiskReductionAction[] {
  return actions
    .filter(
      (action) =>
        action.action.trim().length > 0 &&
        Number.isFinite(action.calculatedReduction) &&
        action.calculatedReduction > 0,
    )
    .slice()
    .sort(
      (left, right) =>
        right.calculatedReduction - left.calculatedReduction ||
        left.priority - right.priority,
    );
}

export function getLeadingRiskAction(
  plan: SiteRiskReductionPlan | null,
): SiteRiskReductionAction | null {
  return rankActions(plan?.actions ?? [])[0] ?? null;
}

export function getLeadingSpareRiskAction(
  plan: SiteRiskReductionPlan | null,
): SiteRiskReductionAction | null {
  return rankActions(
    (plan?.actions ?? []).filter((action) => action.target === "spares"),
  )[0] ?? null;
}

function actionCategory(action: SiteRiskReductionAction): string {
  return action.driver.trim() || ACTION_CATEGORY[action.target];
}

function spareStatus(action: SiteRiskReductionAction): string {
  if (action.status.trim()) return action.status.trim();

  const evidence = `${action.driver} ${action.action} ${action.detail}`.toLowerCase();
  if (evidence.includes("out of stock") || evidence.includes("out-of-stock")) {
    return "Out of stock";
  }
  if (evidence.includes("low stock") || evidence.includes("low-stock")) {
    return "Low stock";
  }
  return "Stock risk";
}

function formatReduction(value: number): string {
  return `−${Number(value).toFixed(1).replace(/\.0$/, "")} points`;
}

function openAction(
  plan: SiteRiskReductionPlan,
  action: SiteRiskReductionAction,
  onNavigate: (path: string) => void,
): void {
  saveDashboardScrollPosition();
  const workOrderNumber = action.workOrderNumbers[0] ?? null;
  if (action.target === "work-orders" && workOrderNumber) {
    openWorkOrderDetail({
      equipmentId: plan.equipmentId,
      workOrderNumber,
    });
    return;
  }

  onNavigate(getRiskPlanActionRoute(plan.equipmentId, action));
}

function useDashboardScrollRestoration(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;
    return restoreDashboardScrollPosition();
  }, [enabled]);
}

interface RiskOpportunityProps {
  plan: SiteRiskReductionPlan | null;
  onNavigate: (path: string) => void;
}

export function BiggestReductionOpportunity({
  plan,
  onNavigate,
}: RiskOpportunityProps): JSX.Element | null {
  const action = getLeadingRiskAction(plan);
  useDashboardScrollRestoration(Boolean(plan && action));
  if (!plan || !action) return null;

  return (
    <button
      type="button"
      data-vorta-biggest-reduction-opportunity="true"
      aria-label={`Open biggest reduction opportunity: ${action.action}`}
      onClick={() => openAction(plan, action, onNavigate)}
      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.055] px-4 py-3 text-left transition-colors hover:border-emerald-400/45 hover:bg-emerald-500/[0.085] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141820] sm:gap-4 sm:px-5"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
            <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
            Biggest reduction opportunity
          </span>
          <Badge className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200 shadow-none">
            {actionCategory(action)}
          </Badge>
        </div>

        <p className="mt-1.5 break-words text-sm font-semibold leading-5 text-slate-50 [overflow-wrap:anywhere]">
          {action.action}
        </p>
        <p className="mt-1 break-words text-xs leading-5 text-slate-400 [overflow-wrap:anywhere]">
          Related equipment: {plan.equipmentName}
          {plan.equipmentCode ? ` · ${plan.equipmentCode}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-right">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-300/70">
            Site-risk reduction
          </p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-semibold text-emerald-400 sm:text-base">
            {formatReduction(action.calculatedReduction)}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-emerald-300" aria-hidden="true" />
      </div>
    </button>
  );
}

export function CriticalSpareRiskCard({
  plan,
  onNavigate,
}: RiskOpportunityProps): JSX.Element | null {
  const action = getLeadingSpareRiskAction(plan);
  useDashboardScrollRestoration(Boolean(plan && action));
  if (!plan || !action) return null;

  const partReference = action.sparePartNumbers[0] ?? null;
  const status = spareStatus(action);

  const openSpare = (): void => openAction(plan, action, onNavigate);
  const handleKey = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openSpare();
  };

  return (
    <Card
      role="link"
      tabIndex={0}
      data-vorta-critical-spare-risk-card="true"
      aria-label={`View spare risk: ${action.action}`}
      onClick={openSpare}
      onKeyDown={handleKey}
      className="cursor-pointer overflow-hidden rounded-xl border border-red-500/25 bg-[#141820] shadow-none transition-colors hover:border-red-400/40 hover:bg-[#181e2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
    >
      <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-300">
                <PackageX className="h-4 w-4" aria-hidden="true" />
                Critical spare shortage
              </span>
              <Badge className="rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300 shadow-none">
                {status}
              </Badge>
            </div>

            <h3 className="mt-2 break-words text-[15px] font-semibold leading-5 text-slate-50 [overflow-wrap:anywhere] sm:text-base">
              {action.action}
            </h3>
            {partReference && (
              <p className="mt-1 break-all text-xs font-medium text-slate-400">
                Part {partReference}
              </p>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Potential site-risk reduction
            </p>
            <p className="mt-1 whitespace-nowrap text-lg font-semibold text-emerald-400">
              {formatReduction(action.calculatedReduction)}
            </p>
          </div>
        </div>

        <dl className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0 rounded-lg border border-gray-800 bg-[#0d1117] p-3">
            <dt className="text-xs text-slate-500">Related equipment</dt>
            <dd className="mt-1 break-words font-medium text-slate-100 [overflow-wrap:anywhere]">
              {plan.equipmentName}
              {plan.equipmentCode ? ` · ${plan.equipmentCode}` : ""}
            </dd>
          </div>

          {plan.highestArea && (
            <div className="min-w-0 rounded-lg border border-gray-800 bg-[#0d1117] p-3">
              <dt className="text-xs text-slate-500">Area</dt>
              <dd className="mt-1 break-words font-medium text-slate-100 [overflow-wrap:anywhere]">
                {plan.highestArea}
              </dd>
            </div>
          )}

          <div className="min-w-0 rounded-lg border border-gray-800 bg-[#0d1117] p-3">
            <dt className="text-xs text-slate-500">Risk category</dt>
            <dd className="mt-1 break-words font-medium text-slate-100 [overflow-wrap:anywhere]">
              {actionCategory(action)}
            </dd>
          </div>
        </dl>

        {action.rankingReason.trim() && (
          <div className="rounded-lg border border-orange-500/15 bg-orange-500/[0.045] px-3 py-2.5">
            <p className="text-xs font-medium text-orange-300">Operational consequence</p>
            <p className="mt-1 break-words text-xs leading-5 text-slate-400 [overflow-wrap:anywhere]">
              {action.rankingReason}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-gray-800 pt-3">
          <p className="min-w-0 break-words text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">
            {action.detail || "Open the linked spare record to review stock evidence and replenishment action."}
          </p>
          <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 text-sm font-semibold text-blue-300">
            View spare
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
