import { ArrowLeft, Sparkles } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type PropsWithChildren,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { AskVortaDesktopWorkspaceExperience } from "./AskVortaDesktopWorkspaceExperience";
import { isFaultQuestion } from "./faultIntelligenceData";
import { GlobalMaintenanceAiAssistantWithFaultsV2 } from "./GlobalMaintenanceAiAssistantWithFaultsV2";
import { MobileAiPolishStyles } from "./MobileAiPolishStyles";
import { MobilePageHeaderExperience } from "./MobilePageHeaderExperience";
import { MobileTypographyStyles } from "./MobileTypographyStyles";

const EQUIPMENT_ROUTE = /^\/equipment\/([^/]+)(?:\/|$)/;
const ASK_VORTA_DOCUMENT_ROUTE = /^\/equipment\/[^/]+\/documents\/[^/]+$/;
const MAINTENANCE_DATA_RECOVERED_EVENT =
  "vorta:maintenance-data-recovered";

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
  const navigate = useNavigate();
  const isPhone = useMediaQuery("(max-width: 767px)");
  const [dataRecoveryRevision, setDataRecoveryRevision] = useState(0);
  const openedFromAskVorta =
    ASK_VORTA_DOCUMENT_ROUTE.test(location.pathname) &&
    new URLSearchParams(location.search).get("from") === "ai";
  const showDesktopAssistantLauncher = !isPhone;

  useEffect(() => {
    warmMaintenancePortalDataFast();
  }, []);

  useEffect(() => {
    const reloadCurrentDataRoute = (): void => {
      setDataRecoveryRevision((current) => current + 1);
    };

    window.addEventListener(
      MAINTENANCE_DATA_RECOVERED_EVENT,
      reloadCurrentDataRoute,
    );
    return () => {
      window.removeEventListener(
        MAINTENANCE_DATA_RECOVERED_EVENT,
        reloadCurrentDataRoute,
      );
    };
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

  const returnToAskVortaChat = useCallback((): void => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/dashboard", { replace: true });
    }

    window.setTimeout(() => {
      openMaintenanceAiAssistant({ submit: false });
    }, 0);
  }, [navigate]);

  return (
    <div
      className="contents"
      data-vorta-maintenance-portal="true"
      onPointerOverCapture={handleNavigationIntent}
      onPointerDownCapture={handleNavigationIntent}
      onFocusCapture={handleNavigationIntent}
      onClickCapture={trackRecommendationFollowThrough}
    >
      <MobileAiPolishStyles />
      <MobilePageHeaderExperience />
      <MobileTypographyStyles />
      <DataTrustBanner />
      <div
        key={dataRecoveryRevision}
        className="contents"
        data-vorta-maintenance-data-revision={dataRecoveryRevision}
      >
        {children}
      </div>
      {openedFromAskVorta ? (
        <button
          type="button"
          data-vorta-back-to-ask-vorta="true"
          aria-label="Back to Ask Vorta chat"
          title="Back to Ask Vorta chat"
          onClick={returnToAskVortaChat}
          className="fixed bottom-4 left-4 z-50 inline-flex h-11 items-center gap-2 rounded-full border border-blue-500/30 bg-blue-600 px-4 text-sm font-bold text-white shadow-xl transition-colors hover:bg-blue-500"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to chat
        </button>
      ) : null}
      {isPhone ? (
        <div
          aria-hidden="true"
          className="h-28 shrink-0"
          data-vorta-mobile-ai-safe-area="true"
        />
      ) : null}
      {isPhone ? (
        <button
          type="button"
          data-vorta-shared-mobile-ai-launcher="true"
          data-vorta-ai-context-prompt={mobileAssistantPrompt(location.pathname)}
          aria-label="Ask Vorta"
          title="Ask Vorta"
          onClick={() => {
            openMaintenanceAiAssistant({ submit: false });
          }}
          className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-40 inline-flex h-12 w-12 items-center justify-center gap-0 rounded-full border border-blue-400/30 bg-blue-600 p-0 text-sm font-bold text-white shadow-[0_12px_28px_rgba(15,23,42,0.5)] transition-colors active:bg-blue-500 min-[420px]:w-auto min-[420px]:gap-2 min-[420px]:px-4"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span data-vorta-mobile-ai-launcher-label="true" className="hidden min-[420px]:inline">
            Ask Vorta
          </span>
        </button>
      ) : null}
      <AskVortaDesktopWorkspaceExperience />
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
