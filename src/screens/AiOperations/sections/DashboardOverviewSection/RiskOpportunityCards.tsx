import { useEffect } from "react";
import { ArrowRight, TrendingDown } from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
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
