import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Badge } from "../../../../components/ui/badge";
import { Card, CardContent } from "../../../../components/ui/card";
import { useAuth } from "../../../../lib/auth";
import type {
  RiskDashboardLabourCard,
  RiskDashboardScope,
  SiteRiskReductionPlan,
} from "../../../Equipment/equipmentService";
import {
  loadStoresInventorySnapshot,
  summariseStoresInventory,
  type InventoryExposureLevel,
  type StoresInventoryPayload,
} from "../../../StoresInventory/storesInventoryService";
import { RiskMeter } from "./RiskMeter";
import { getLeadingSpareRiskAction } from "./RiskOpportunityCards";
import { saveDashboardScrollPosition } from "./dashboardScrollState";

type SpareRiskEvidenceState =
  | "loading"
  | "ready"
  | "partial"
  | "stale"
  | "empty"
  | "unavailable";

interface RiskRailCardModel {
  key: string;
  kind: "labour" | "spares";
  slug: string;
  title: string;
  score: number | null;
  displayScore: string;
  progress: number;
  description: string;
  metricLabel: string;
  metricValue: string;
  extraLabel: string;
  extraValue: string;
  badgeLabel: string;
  badgeClassName: string;
  progressClassName: string;
  statusLabel: string;
  actionLabel: string;
  ariaLabel: string;
  onOpen: () => void;
}

const INVENTORY_STALE_AFTER_MS = 7 * 86_400_000;

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

function spareRiskPresentation(
  level: InventoryExposureLevel | null,
  evidenceState: SpareRiskEvidenceState,
) {
  if (!level) {
    if (evidenceState === "loading") {
      return {
        badgeLabel: "Loading",
        badgeClassName: "bg-slate-700/70 text-slate-300 hover:bg-slate-700/70",
        progressClassName: "bg-slate-600",
      };
    }

    if (evidenceState === "empty") {
      return {
        badgeLabel: "No evidence",
        badgeClassName: "bg-slate-700/70 text-slate-300 hover:bg-slate-700/70",
        progressClassName: "bg-slate-600",
      };
    }

    return {
      badgeLabel: "Unavailable",
      badgeClassName: "bg-slate-700/70 text-slate-300 hover:bg-slate-700/70",
      progressClassName: "bg-slate-600",
    };
  }

  if (level === "Critical") {
    return {
      badgeLabel: level,
      badgeClassName: "bg-red-500/20 text-red-400 hover:bg-red-500/20",
      progressClassName: "bg-red-500",
    };
  }
  if (level === "High") {
    return {
      badgeLabel: level,
      badgeClassName: "bg-orange-500/20 text-orange-400 hover:bg-orange-500/20",
      progressClassName: "bg-orange-500",
    };
  }
  if (level === "Medium") {
    return {
      badgeLabel: level,
      badgeClassName: "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20",
      progressClassName: "bg-yellow-400",
    };
  }
  if (level === "Low") {
    return {
      badgeLabel: level,
      badgeClassName: "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20",
      progressClassName: "bg-emerald-500",
    };
  }

  return {
    badgeLabel: level,
    badgeClassName: "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20",
    progressClassName: "bg-cyan-400",
  };
}

function isInventorySourceStale(payload: StoresInventoryPayload): boolean {
  if (!payload.latestSourceAt) return true;
  const sourceTimestamp = new Date(payload.latestSourceAt).getTime();
  return (
    !Number.isFinite(sourceTimestamp) ||
    Date.now() - sourceTimestamp > INVENTORY_STALE_AFTER_MS
  );
}

function resolveSpareEvidenceState(
  payload: StoresInventoryPayload,
): SpareRiskEvidenceState {
  if (
    payload.assetEvidence.status !== "ready" ||
    payload.riskEvidence.status !== "ready"
  ) {
    return "partial";
  }

  return isInventorySourceStale(payload) ? "stale" : "ready";
}

function spareRiskDescription(state: SpareRiskEvidenceState): string {
  if (state === "loading") {
    return "Calculating from live stock, criticality, lead-time and asset-risk evidence.";
  }
  if (state === "empty") {
    return "No inventory records are linked to the selected dashboard scope.";
  }
  if (state === "unavailable") {
    return "Inventory evidence could not be verified, so no risk score is shown.";
  }
  if (state === "stale") {
    return "Showing the last trusted inventory score while source evidence is stale.";
  }
  if (state === "partial") {
    return "Calculated from available stock, criticality, lead-time and asset-risk evidence.";
  }
  return "Stock-gap exposure weighted by criticality, lead time and linked asset risk.";
}

function spareRiskStatusLabel(
  level: InventoryExposureLevel | null,
  score: number | null,
  evidenceState: SpareRiskEvidenceState,
): string {
  if (score === null || !level) {
    if (evidenceState === "loading") return "Calculating spare availability exposure";
    if (evidenceState === "empty") return "No scoped inventory evidence";
    return "Spare risk not calculated";
  }

  if (evidenceState === "stale") {
    return `${level} spare exposure · last trusted snapshot`;
  }
  if (evidenceState === "partial") {
    return `${level} spare exposure · partial evidence`;
  }
  if (level === "Covered") {
    return "Spare availability covered";
  }
  return `${level} spare availability exposure`;
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

export function getSparesRiskWorkflowRoute(
  activeScopeArea: string | null,
): string {
  const params = new URLSearchParams({
    from: "dashboard",
    filter: "attention",
  });
  if (activeScopeArea) params.set("area", activeScopeArea);
  return `/stores-inventory?${params.toString()}`;
}

interface LabourRiskSectionProps {
  scope: RiskDashboardScope | null;
  isSiteRiskScope: boolean;
  activeScopeLabel: string;
  activeScopeArea: string | null;
  riskReductionPlan: SiteRiskReductionPlan | null;
  onNavigate: (path: string) => void;
}

export function LabourRiskSection({
  scope,
  isSiteRiskScope,
  activeScopeLabel,
  activeScopeArea,
  riskReductionPlan,
  onNavigate,
}: LabourRiskSectionProps): JSX.Element {
  const { siteContext } = useAuth();
  const [inventoryPayload, setInventoryPayload] =
    useState<StoresInventoryPayload | null>(null);
  const [spareEvidenceState, setSpareEvidenceState] =
    useState<SpareRiskEvidenceState>("loading");
  const trustedInventoryRef = useRef<{
    siteId: string;
    payload: StoresInventoryPayload;
  } | null>(null);
  const inventoryLoadSequenceRef = useRef(0);

  const loadSpareRisk = useCallback(async () => {
    const siteId = siteContext?.siteId ?? null;
    const sequence = inventoryLoadSequenceRef.current + 1;
    inventoryLoadSequenceRef.current = sequence;

    if (!siteId) {
      trustedInventoryRef.current = null;
      setInventoryPayload(null);
      setSpareEvidenceState("unavailable");
      return;
    }

    const previousSnapshot =
      trustedInventoryRef.current?.siteId === siteId
        ? trustedInventoryRef.current.payload
        : null;

    if (!previousSnapshot) {
      setInventoryPayload(null);
      setSpareEvidenceState("loading");
    }

    try {
      const result = await loadStoresInventorySnapshot(siteId);
      if (sequence !== inventoryLoadSequenceRef.current) return;

      if (result.status === "ready") {
        trustedInventoryRef.current = {
          siteId,
          payload: result.data,
        };
        setInventoryPayload(result.data);
        setSpareEvidenceState(resolveSpareEvidenceState(result.data));
        return;
      }

      if (result.status === "empty") {
        trustedInventoryRef.current = null;
        setInventoryPayload(null);
        setSpareEvidenceState("empty");
        return;
      }

      if (previousSnapshot) {
        setInventoryPayload(previousSnapshot);
        setSpareEvidenceState("stale");
      } else {
        trustedInventoryRef.current = null;
        setInventoryPayload(null);
        setSpareEvidenceState("unavailable");
      }
    } catch {
      if (sequence !== inventoryLoadSequenceRef.current) return;
      if (previousSnapshot) {
        setInventoryPayload(previousSnapshot);
        setSpareEvidenceState("stale");
      } else {
        trustedInventoryRef.current = null;
        setInventoryPayload(null);
        setSpareEvidenceState("unavailable");
      }
    }
  }, [siteContext?.siteId]);

  useEffect(() => {
    void loadSpareRisk();
    return () => {
      inventoryLoadSequenceRef.current += 1;
    };
  }, [loadSpareRisk]);

  useEffect(() => {
    const handleOnline = (): void => {
      void loadSpareRisk();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [loadSpareRisk]);

  const scopedInventoryItems = useMemo(() => {
    if (!inventoryPayload) return [];
    if (isSiteRiskScope || !activeScopeArea) return inventoryPayload.items;

    const normalisedArea = activeScopeArea.trim().toLowerCase();
    return inventoryPayload.items.filter(
      (item) => item.area.trim().toLowerCase() === normalisedArea,
    );
  }, [activeScopeArea, inventoryPayload, isSiteRiskScope]);

  const effectiveSpareEvidenceState: SpareRiskEvidenceState =
    inventoryPayload && scopedInventoryItems.length === 0
      ? "empty"
      : spareEvidenceState;

  const spareSummary = useMemo(
    () =>
      inventoryPayload && scopedInventoryItems.length > 0
        ? summariseStoresInventory(scopedInventoryItems)
        : null,
    [inventoryPayload, scopedInventoryItems],
  );

  const actionRequiredPartCount = useMemo(
    () => scopedInventoryItems.filter((item) => item.exposureScore > 0).length,
    [scopedInventoryItems],
  );

  const labourItems: RiskRailCardModel[] = (scope?.labourCards ?? []).map(
    (item) => {
      const presentation = riskPresentation(
        item.score,
        item.slug === "shift-cover" && Boolean(scope?.noEngineerOverride),
      );
      return {
        key: `labour-${item.slug}`,
        kind: "labour",
        slug: item.slug,
        title: item.title,
        score: item.score,
        displayScore: Number(item.score).toFixed(1),
        progress: Math.max(0, Math.min(100, item.score)),
        description: item.description,
        metricLabel: item.metricLabel,
        metricValue: item.metricValue,
        extraLabel: item.extraLabel,
        extraValue: item.extraValue,
        badgeLabel: presentation.level,
        badgeClassName: presentation.badgeClassName,
        progressClassName: presentation.progressClassName,
        statusLabel: item.statusLabel || presentation.label,
        actionLabel: "Open details →",
        ariaLabel: `Open ${item.title} workflow`,
        onOpen: () =>
          onNavigate(
            getLabourRiskWorkflowRoute(
              item,
              isSiteRiskScope ? null : activeScopeArea,
            ),
          ),
      };
    },
  );

  const leadingSpareAction = getLeadingSpareRiskAction(riskReductionPlan);
  const spareScore = spareSummary?.riskScore ?? null;
  const spareLevel = spareSummary?.riskLevel ?? null;
  const sparePresentation = spareRiskPresentation(
    spareLevel,
    effectiveSpareEvidenceState,
  );

  const spareItem: RiskRailCardModel = {
    key: "spares-risk",
    kind: "spares",
    slug: "spares-risk",
    title: "Spares Risk",
    score: spareScore,
    displayScore: spareScore === null ? "Not calculated" : spareScore.toFixed(1),
    progress: spareScore === null ? 0 : Math.max(0, Math.min(100, spareScore)),
    description: spareRiskDescription(effectiveSpareEvidenceState),
    metricLabel: "Affected assets",
    metricValue: spareSummary ? String(spareSummary.affectedAssets) : "—",
    extraLabel: "Action-required parts",
    extraValue: spareSummary ? String(actionRequiredPartCount) : "—",
    badgeLabel: sparePresentation.badgeLabel,
    badgeClassName: sparePresentation.badgeClassName,
    progressClassName: sparePresentation.progressClassName,
    statusLabel: spareRiskStatusLabel(
      spareLevel,
      spareScore,
      effectiveSpareEvidenceState,
    ),
    actionLabel: "Open inventory →",
    ariaLabel: leadingSpareAction
      ? `Open Spares Risk workflow. Highest current spare action: ${leadingSpareAction.action}`
      : "Open Spares Risk workflow",
    onOpen: () => {
      saveDashboardScrollPosition();
      onNavigate(
        getSparesRiskWorkflowRoute(
          isSiteRiskScope ? null : activeScopeArea,
        ),
      );
    },
  };

  const items = [...labourItems, spareItem].sort((left, right) => {
    const scoreDifference = (right.score ?? -1) - (left.score ?? -1);
    return scoreDifference || left.title.localeCompare(right.title);
  });

  const viewAllRoute = isSiteRiskScope
    ? "/maintenance/labour-risk/shift-cover"
    : `/maintenance/labour-risk/shift-cover?scope=area&area=${encodeURIComponent(
        activeScopeArea ?? "",
      )}`;

  const handleKey = (
    event: KeyboardEvent<HTMLElement>,
    item: RiskRailCardModel,
  ): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    item.onOpen();
  };

  return (
    <section
      className="flex w-full flex-col gap-4"
      data-vorta-dashboard-section="labour-risk"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-50">
          {isSiteRiskScope
            ? "Spares & Labour Risks"
            : `${activeScopeLabel} Spares & Labour Risks`}
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
            key={item.key}
            role="link"
            tabIndex={0}
            data-vorta-dashboard-card="labour-risk"
            data-vorta-labour-risk-card={item.slug}
            data-vorta-spares-risk-card={
              item.kind === "spares" ? "true" : undefined
            }
            aria-label={item.ariaLabel}
            onClick={item.onOpen}
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
                  className={`shrink-0 rounded px-2 py-1 text-xs font-medium shadow-none ${item.badgeClassName}`}
                >
                  {item.badgeLabel}
                </Badge>
              </div>
              <p
                data-vorta-mobile-secondary="true"
                className="text-[13px] leading-[18px] text-slate-400 sm:text-xs"
              >
                {item.description}
              </p>
              <div
                data-vorta-primary-metric="true"
                className="flex flex-col gap-0.5"
              >
                <p className="text-[13px] text-slate-400 sm:text-xs">
                  Overall risk score
                </p>
                <p
                  className={`font-semibold text-slate-50 ${
                    item.score === null
                      ? "text-lg leading-7 sm:text-base"
                      : "text-2xl sm:text-xl"
                  }`}
                >
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
                <span className="text-xs font-semibold text-slate-50">
                  {item.extraValue}
                </span>
              </div>
              <div className="mt-auto flex flex-col gap-1.5 pt-1">
                <RiskMeter
                  value={item.progress}
                  fillClassName={item.progressClassName}
                  animate={index === 0 && item.score !== null}
                  ariaLabel={
                    item.score === null
                      ? `${item.title} risk score not calculated`
                      : `${item.title} risk score ${item.displayScore}`
                  }
                />
                <p className="text-[13px] leading-[18px] text-slate-400 sm:text-xs">
                  {item.statusLabel}
                </p>
              </div>
              <span
                data-vorta-mobile-card-action="true"
                aria-hidden="true"
                className="hidden rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 text-sm font-semibold text-blue-300"
              >
                {item.actionLabel}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
