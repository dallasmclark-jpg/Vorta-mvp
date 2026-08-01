import { useEffect, type KeyboardEvent } from "react";
import { ArrowRight, TrendingDown } from "lucide-react";
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

function stockPresentation(status: string): {
  badgeClassName: string;
  barClassName: string;
  barWidthClassName: string;
  label: string;
} {
  const normalised = status.toLowerCase();

  if (normalised.includes("out of stock")) {
    return {
      badgeClassName: "bg-red-500/20 text-red-400 hover:bg-red-500/20",
      barClassName: "bg-red-500",
      barWidthClassName: "w-full",
      label: "No stock available",
    };
  }

  if (normalised.includes("low stock")) {
    return {
      badgeClassName: "bg-orange-500/20 text-orange-400 hover:bg-orange-500/20",
      barClassName: "bg-orange-500",
      barWidthClassName: "w-2/3",
      label: "Low stock requires action",
    };
  }

  return {
    badgeClassName: "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20",
    barClassName: "bg-yellow-400",
    barWidthClassName: "w-1/2",
    label: "Spare availability requires review",
  };
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
  const presentation = stockPresentation(status);

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
      data-vorta-dashboard-card="labour-risk"
      data-vorta-labour-risk-card="critical-spare"
      data-vorta-critical-spare-risk-card="true"
      aria-label={`View spare risk: ${action.action}`}
      onClick={openSpare}
      onKeyDown={handleKey}
      className="h-full cursor-pointer rounded-xl border border-gray-800 bg-[#141820] shadow-none transition-colors hover:border-gray-700 hover:bg-[#181e2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
    >
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-5 text-slate-50 sm:text-sm">
            Critical spare shortage
          </h3>
          <Badge
            variant="secondary"
            className={`shrink-0 rounded px-2 py-1 text-xs font-medium shadow-none ${presentation.badgeClassName}`}
          >
            {status}
          </Badge>
        </div>

        <div className="min-w-0">
          <p
            data-vorta-mobile-secondary="true"
            className="line-clamp-3 break-words text-[13px] leading-[18px] text-slate-400 [overflow-wrap:anywhere] sm:text-xs"
          >
            {action.action}
          </p>
          {partReference && (
            <p className="mt-1 truncate text-xs font-medium text-slate-500" title={partReference}>
              Part {partReference}
            </p>
          )}
        </div>

        <div data-vorta-primary-metric="true" className="flex flex-col gap-0.5">
          <p className="text-[13px] text-slate-400 sm:text-xs">
            Potential site-risk reduction
          </p>
          <p className="whitespace-nowrap text-2xl font-semibold text-emerald-400 sm:text-xl">
            {formatReduction(action.calculatedReduction)}
          </p>
        </div>

        <div className="flex items-start justify-between gap-3">
          <span className="shrink-0 text-[13px] text-slate-400 sm:text-xs">
            Related equipment
          </span>
          <span
            className="line-clamp-2 min-w-0 text-right text-[13px] font-semibold leading-[18px] text-slate-50 [overflow-wrap:anywhere] sm:text-xs"
            title={plan.equipmentName}
          >
            {plan.equipmentName}
          </span>
        </div>

        <div
          data-vorta-mobile-secondary="true"
          className="flex items-center justify-between gap-3"
        >
          <span className="text-xs text-slate-400">Area</span>
          <span className="truncate text-right text-xs font-semibold text-slate-50">
            {plan.highestArea || "Site-wide"}
          </span>
        </div>

        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
            role="img"
            aria-label={`${status}: ${presentation.label}`}
          >
            <div
              className={`h-full rounded-full ${presentation.barClassName} ${presentation.barWidthClassName}`}
            />
          </div>
          <p className="text-[13px] leading-[18px] text-slate-400 sm:text-xs">
            {presentation.label}
          </p>
        </div>

        <span
          data-vorta-mobile-card-action="true"
          aria-hidden="true"
          className="hidden min-h-11 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 text-sm font-semibold text-blue-300"
        >
          View spare →
        </span>
      </CardContent>
    </Card>
  );
}
