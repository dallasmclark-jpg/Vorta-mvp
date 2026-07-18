import {
  useCallback,
  useEffect,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type PropsWithChildren,
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { warmMaintenancePortalDataFast } from "../../lib/maintenancePortalFastWarmup";
import { prefetchMaintenancePortalRoute } from "../../lib/maintenancePortalPrefetch";
import { trackPilotUsageEvent } from "../../lib/pilotUsage";
import { MaintenanceWorkOrderExecutionOverlay } from "../Equipment/MaintenanceWorkOrderExecutionOverlay";
import { isFaultQuestion } from "./faultIntelligenceData";
import { GlobalMaintenanceAiAssistantWithFaultsV2 } from "./GlobalMaintenanceAiAssistantWithFaultsV2";

const EQUIPMENT_ROUTE = /^\/equipment\/([^/]+)(?:\/|$)/;

interface GlobalAiPromptEventDetail {
  question?: string;
  submit?: boolean;
}

function decodeEquipmentId(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function equipmentIdFromPath(pathname: string): string | null {
  const routeMatch = pathname.match(EQUIPMENT_ROUTE);
  return routeMatch ? decodeEquipmentId(routeMatch[1]) : null;
}

function routeUrlFromTarget(target: EventTarget | null): URL | null {
  if (!(target instanceof Element)) return null;

  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  const href = anchor?.getAttribute("href")?.trim();
  if (!href) return null;

  const url = new URL(href, window.location.origin);
  return url.origin === window.location.origin ? url : null;
}

function routePathFromTarget(target: EventTarget | null): string | null {
  return routeUrlFromTarget(target)?.pathname ?? null;
}

export function MaintenanceAiWorkOrderExperience({
  children,
}: PropsWithChildren): JSX.Element {
  const { siteContext } = useAuth();
  const location = useLocation();

  useEffect(() => {
    warmMaintenancePortalDataFast();
  }, []);

  useEffect(() => {
    const siteId = siteContext?.siteId;
    if (!siteId) return;

    const equipmentId = equipmentIdFromPath(location.pathname);
    if (equipmentId) {
      const pathSegments = location.pathname.split("/");
      void trackPilotUsageEvent({
        siteId,
        eventType: "equipment_view",
        pathname: location.pathname,
        entityType: "equipment",
        entityId: equipmentId,
        metadata: { section: pathSegments[pathSegments.length - 1] || "overview" },
      });
      return;
    }

    if (location.pathname === "/dashboard") {
      void trackPilotUsageEvent({
        siteId,
        eventType: "dashboard_review",
        pathname: location.pathname,
        entityType: "route",
      });
      return;
    }

    if (location.pathname === "/pilot-impact") {
      void trackPilotUsageEvent({
        siteId,
        eventType: "pilot_impact_review",
        pathname: location.pathname,
        entityType: "route",
        metadata: { page: "impact" },
      });
      return;
    }

    if (location.pathname === "/skills-matrix") {
      void trackPilotUsageEvent({
        siteId,
        eventType: "capability_review",
        pathname: location.pathname,
        entityType: "route",
      });
    }
  }, [location.pathname, siteContext?.siteId]);

  useEffect(() => {
    const handleAiPrompt = (event: Event): void => {
      const detail = (event as CustomEvent<GlobalAiPromptEventDetail>).detail;
      const question = detail?.question?.trim() ?? "";
      const siteId = siteContext?.siteId;
      if (!detail?.submit || !question || !siteId) return;

      const equipmentId = equipmentIdFromPath(window.location.pathname);
      void trackPilotUsageEvent({
        siteId,
        eventType: "ask_vorta_query",
        pathname: window.location.pathname,
        entityType: equipmentId ? "equipment" : "route",
        entityId: equipmentId,
        metadata: {
          category: isFaultQuestion(question) ? "fault" : "general",
          questionLength: question.length,
        },
      });
    };

    window.addEventListener("vorta-global-ai-prompt", handleAiPrompt);
    return () => window.removeEventListener("vorta-global-ai-prompt", handleAiPrompt);
  }, [siteContext?.siteId]);

  const handleNavigationIntent = useCallback(
    (
      event:
        | ReactPointerEvent<HTMLDivElement>
        | ReactFocusEvent<HTMLDivElement>,
    ): void => {
      const pathname = routePathFromTarget(event.target);
      if (pathname) prefetchMaintenancePortalRoute(pathname);
    },
    [],
  );

  const trackRecommendationFollowThrough = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>): void => {
      const routeUrl = routeUrlFromTarget(event.target);
      const siteId = siteContext?.siteId;
      if (!routeUrl || !siteId || routeUrl.searchParams.get("from") !== "ai") return;

      void trackPilotUsageEvent({
        siteId,
        eventType: "recommendation_opened",
        pathname: window.location.pathname,
        entityType: "route",
        entityId: routeUrl.pathname,
        metadata: { destination: routeUrl.pathname },
      });
    },
    [siteContext?.siteId],
  );

  return (
    <div
      className="contents"
      onPointerOverCapture={handleNavigationIntent}
      onPointerDownCapture={handleNavigationIntent}
      onFocusCapture={handleNavigationIntent}
      onClickCapture={trackRecommendationFollowThrough}
    >
      {children}
      <GlobalMaintenanceAiAssistantWithFaultsV2 role="maintenance-manager" />
      <MaintenanceWorkOrderExecutionOverlay />
    </div>
  );
}
