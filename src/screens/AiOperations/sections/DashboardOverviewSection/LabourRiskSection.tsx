import type { KeyboardEvent } from "react";
import { Badge } from "../../../../components/ui/badge";
import { Card, CardContent } from "../../../../components/ui/card";
import type {
  RiskDashboardLabourCard,
  RiskDashboardScope,
} from "../../../Equipment/equipmentService";
import { RiskMeter } from "./RiskMeter";

function riskPresentation(score: number, noEngineerOverride: boolean) {
  if (noEngineerOverride || score >= 85) {
    return {
      level: "Critical",
      badgeClassName: "bg-[#ef444420] text-red-500 hover:bg-[#ef444420]",
      progressClassName: "bg-red-500",
      label: noEngineerOverride
        ? "Critical no-cover override"
        : "Critical labour exposure",
    };
  }
  if (score >= 65) {
    return {
      level: "High",
      badgeClassName: "bg-orange-500/20 text-orange-400 hover:bg-orange-500/20",
      progressClassName: "bg-orange-500",
      label: "High labour exposure",
    };
  }
  if (score >= 40) {
    return {
      level: "Medium",
      badgeClassName: "bg-[#facc1520] text-yellow-400 hover:bg-[#facc1520]",
      progressClassName: "bg-yellow-400",
      label: "Reduced labour resilience",
    };
  }
  if (score >= 20) {
    return {
      level: "Low",
      badgeClassName: "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20",
      progressClassName: "bg-emerald-500",
      label: "Low labour exposure",
    };
  }
  return {
    level: "Minimal",
    badgeClassName: "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20",
    progressClassName: "bg-cyan-400",
    label: "Labour coverage stable",
  };
}

export function getLabourRiskWorkflowRoute(
  item: RiskDashboardLabourCard,
  activeScopeArea: string | null,
): string {
  const scopedParams = new URLSearchParams({ from: "dashboard" });
  if (activeScopeArea) scopedParams.set("area", activeScopeArea);

  if (item.slug === "shift-cover") {
    const shiftParams = new URLSearchParams({ from: "dashboard" });
    if (activeScopeArea) {
      shiftParams.set("scope", "area");
      shiftParams.set("area", activeScopeArea);
    }
    return `/maintenance/labour-risk/shift-cover?${shiftParams.toString()}`;
  }

  if (item.slug === "single-point-failure") {
    scopedParams.set("view", "priority");
    scopedParams.set("priority", "1");
    scopedParams.set("risk", item.slug);
    return `/skills-matrix?${scopedParams.toString()}`;
  }

  if (item.slug === "training-expiring") {
    scopedParams.set("priority", "High");
    return `/training?${scopedParams.toString()}`;
  }

  const detailParams = new URLSearchParams();
  if (activeScopeArea) {
    detailParams.set("scope", "area");
    detailParams.set("area", activeScopeArea);
  }
  const query = detailParams.toString();
  return `/maintenance/labour-risk/${item.slug}${query ? `?${query}` : ""}`;
}

interface LabourRiskSectionProps {
  scope: RiskDashboardScope | null;
  isSiteRiskScope: boolean;
  activeScopeLabel: string;
  activeScopeArea: string | null;
  onNavigate: (path: string) => void;
}

export function LabourRiskSection({
  scope,
  isSiteRiskScope,
  activeScopeLabel,
  activeScopeArea,
  onNavigate,
}: LabourRiskSectionProps): JSX.Element {
  const items = (scope?.labourCards ?? [])
    .slice()
    .sort((left, right) => right.score - left.score)
    .map((item) => {
      const presentation = riskPresentation(
        item.score,
        item.slug === "shift-cover" && Boolean(scope?.noEngineerOverride),
      );
      return {
        ...item,
        level: presentation.level,
        displayScore: Number(item.score).toFixed(1),
        progress: Math.max(0, Math.min(100, item.score)),
        label: item.statusLabel || presentation.label,
        badgeClassName: presentation.badgeClassName,
        progressClassName: presentation.progressClassName,
      };
    });

  const viewAllRoute = isSiteRiskScope
    ? "/maintenance/labour-risk/shift-cover"
    : `/maintenance/labour-risk/shift-cover?scope=area&area=${encodeURIComponent(
        activeScopeArea ?? "",
      )}`;

  const openItem = (item: RiskDashboardLabourCard): void => {
    onNavigate(
      getLabourRiskWorkflowRoute(
        item,
        isSiteRiskScope ? null : activeScopeArea,
      ),
    );
  };

  const handleKey = (
    event: KeyboardEvent<HTMLElement>,
    item: RiskDashboardLabourCard,
  ): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openItem(item);
  };

  return (
    <section
      className="flex w-full flex-col gap-4"
      data-vorta-dashboard-section="labour-risk"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-50">
          {isSiteRiskScope ? "Labour Risk" : `${activeScopeLabel} Labour Risk`}
        </h2>
        <button
          type="button"
          data-vorta-section-link="labour-risk"
          onClick={() => onNavigate(viewAllRoute)}
          className="text-sm font-medium text-blue-500 transition-colors hover:text-blue-400"
        >
          View all labour risks →
        </button>
      </div>

      <div
        data-vorta-card-rail="labour-risk"
        className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {items.map((item, index) => (
          <Card
            key={item.title}
            role="link"
            tabIndex={0}
            data-vorta-dashboard-card="labour-risk"
            data-vorta-labour-risk-card={item.slug}
            aria-label={`Open ${item.title} workflow`}
            onClick={() => openItem(item)}
            onKeyDown={(event) => handleKey(event, item)}
            className="cursor-pointer rounded-xl border border-gray-800 bg-[#141820] shadow-none transition-colors hover:border-gray-700 hover:bg-[#181e2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            <CardContent className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="flex-1 text-[15px] font-semibold leading-5 text-slate-50 sm:text-sm">
                  {item.title}
                </h3>
                <Badge
                  variant="secondary"
                  className={`rounded px-2 py-1 text-xs font-medium shadow-none ${item.badgeClassName}`}
                >
                  {item.level}
                </Badge>
              </div>
              <p
                data-vorta-mobile-secondary="true"
                className="text-[13px] leading-[18px] text-slate-400 sm:text-xs"
              >
                {item.description}
              </p>
              <div data-vorta-primary-metric="true" className="flex flex-col gap-0.5">
                <p className="text-[13px] text-slate-400 sm:text-xs">Overall risk score</p>
                <p className="text-2xl font-semibold text-slate-50 sm:text-xl">
                  {item.displayScore}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-slate-400 sm:text-xs">
                  {item.metricLabel}
                </span>
                <span className="text-[13px] font-semibold text-slate-50 sm:text-xs">
                  {item.metricValue}
                </span>
              </div>
              <div
                data-vorta-mobile-secondary="true"
                className="flex items-center justify-between gap-2"
              >
                <span className="text-xs text-slate-400">{item.extraLabel}</span>
                <span className="text-xs font-semibold text-slate-50">{item.extraValue}</span>
              </div>
              <div className="mt-auto flex flex-col gap-1.5 pt-1">
                <RiskMeter
                  value={item.progress}
                  fillClassName={item.progressClassName}
                  animate={index === 0}
                  ariaLabel={`${item.title} risk score ${item.displayScore}`}
                />
                <p className="text-[13px] leading-[18px] text-slate-400 sm:text-xs">
                  {item.label}
                </p>
              </div>
              <span
                data-vorta-mobile-card-action="true"
                aria-hidden="true"
                className="hidden rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 text-sm font-semibold text-blue-300"
              >
                Open details →
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
