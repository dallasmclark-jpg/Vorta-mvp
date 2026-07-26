import { Sparkles } from "lucide-react";
import {
  useCallback,
  useEffect,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type PropsWithChildren,
} from "react";
import { useLocation } from "react-router-dom";
import { DataTrustBanner } from "../../components/DataTrustBanner";
import { MaintenanceActionEvidenceHardening } from "../../components/MaintenanceActionEvidenceHardening";
import { MaintenancePortalHardening } from "../../components/MaintenancePortalHardening";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuth } from "../../lib/auth";
import { openMaintenanceAiAssistant } from "../../lib/maintenanceActions";
import { warmMaintenancePortalDataFast } from "../../lib/maintenancePortalFastWarmup";
import { prefetchMaintenancePortalRoute } from "../../lib/maintenancePortalPrefetch";
import { trackPilotUsageEvent } from "../../lib/pilotUsage";
import { getCachedEquipmentIdentity } from "../Equipment/equipmentService";
import { MaintenanceWorkOrderExecutionOverlay } from "../Equipment/MaintenanceWorkOrderExecutionOverlay";
import { isFaultQuestion } from "./faultIntelligenceData";
import { GlobalMaintenanceAiAssistantWithFaultsV2 } from "./GlobalMaintenanceAiAssistantWithFaultsV2";
import "./mobileAiPolish.css";

const EQUIPMENT_ROUTE = /^\/equipment\/([^/]+)(?:\/|$)/;

interface GlobalAiPromptEventDetail {
  question?: string;
  submit?: boolean;
  role?: "maintenance-manager";
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

function mobileAssistantPrompt(pathname: string): string {
  const equipmentId = equipmentIdFromPath(pathname);
  if (equipmentId) {
    const equipment = getCachedEquipmentIdentity(equipmentId);
    const section = pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ?? "overview";
    const equipmentLabel = equipment
      ? `${equipment.name} (${equipment.assetNumber})`
      : `equipment ${equipmentId}`;

    return `Review ${equipmentLabel} ${section} evidence and explain what needs attention.`;
  }

  if (pathname === "/dashboard") return "What needs attention first today?";
  if (pathname.includes("shift-cover")) return "Review the current shift cover risk and required action.";
  if (pathname === "/skills-matrix") return "Review the highest capability and skills coverage risk.";
  if (pathname === "/engineers") return "Which engineers and capability gaps need attention?";
  if (pathname === "/requirements") return "Which current workforce requirements need action first?";
  if (pathname === "/training" || pathname === "/training-providers") {
    return "Review the highest-priority training gap and the best next action.";
  }
  if (pathname === "/ai-matching") return "Review the strongest capability matches and their evidence.";
  if (pathname === "/career") return "Review the highest-priority workforce development action.";
  if (pathname === "/pilot-impact" || pathname === "/pilot-adoption") {
    return "Summarise the strongest pilot evidence and the main limitation.";
  }

  return "What should I review first on this page?";
}

export function MaintenanceAiWorkOrderExperience({
  children,
}: PropsWithChildren): JSX.Element {
  const { siteContext } = useAuth();
  const location = useLocation();
  const isPhone = useMediaQuery("(max-width: 639px)");
  const showDesktopAssistantLauncher =
    !isPhone &&
    location.pathname !== "/dashboard" &&
    !/^\/equipment\/[^/]+(?:\/|$)/.test(location.pathname);

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
      data-vorta-maintenance-portal="true"
      onPointerOverCapture={handleNavigationIntent}
      onPointerDownCapture={handleNavigationIntent}
      onFocusCapture={handleNavigationIntent}
      onClickCapture={trackRecommendationFollowThrough}
    >
      <DataTrustBanner />
      {children}
      {isPhone ? (
        <div
          aria-hidden="true"
          className="h-24 shrink-0"
          data-vorta-mobile-ai-safe-area="true"
        />
      ) : null}
      {isPhone ? (
        <button
          type="button"
          data-vorta-shared-mobile-ai-launcher="true"
          data-vorta-ai-context-prompt={mobileAssistantPrompt(location.pathname)}
          aria-label="Ask Vorta"
          onClick={() => {
            openMaintenanceAiAssistant({ submit: false });
          }}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-blue-400/30 bg-blue-600 px-5 text-sm font-bold text-white shadow-[0_14px_32px_rgba(15,23,42,0.55)] transition-colors active:bg-blue-500"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Ask Vorta
        </button>
      ) : null}
      <GlobalMaintenanceAiAssistantWithFaultsV2
        role="maintenance-manager"
        showLauncher={showDesktopAssistantLauncher}
      />
      <MaintenanceWorkOrderExecutionOverlay />
      <MaintenancePortalHardening />
      <MaintenanceActionEvidenceHardening />
    </div>
  );
}
