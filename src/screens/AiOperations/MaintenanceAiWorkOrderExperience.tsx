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
import { supabase } from "../../lib/supabaseClient";
import { VORTA_WORK_ORDER_DETAIL_EVENT } from "../Equipment/GlobalWorkOrderExecutionOverlay";
import { MaintenanceWorkOrderExecutionOverlay } from "../Equipment/MaintenanceWorkOrderExecutionOverlay";
import { isFaultQuestion } from "./faultIntelligenceData";
import { GlobalMaintenanceAiAssistantWithFaultsV2 } from "./GlobalMaintenanceAiAssistantWithFaultsV2";

const EQUIPMENT_ROUTE = /^\/equipment\/([^/]+)(?:\/|$)/;
const WORK_ORDER_NUMBER = /\b(?:WO-\d+|\d{8,14})\b/i;
const PM_REFERENCE = /\bPM-\d+\b/i;

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

function getWorkOrderNumber(element: HTMLElement): string | null {
  const firstLabel = element.querySelector("span")?.textContent?.trim() ?? "";
  const firstMatch = firstLabel.match(WORK_ORDER_NUMBER)?.[0];
  if (firstMatch) return firstMatch;

  return element.textContent?.match(WORK_ORDER_NUMBER)?.[0] ?? null;
}

function getEquipmentId(element: HTMLElement): string | null {
  if (element instanceof HTMLAnchorElement) {
    const href = element.getAttribute("href")?.trim();
    if (href) {
      const url = new URL(href, window.location.origin);
      if (url.origin === window.location.origin) {
        const routeEquipmentId = equipmentIdFromPath(url.pathname);
        if (routeEquipmentId) return routeEquipmentId;
      }
    }
  }

  return equipmentIdFromPath(window.location.pathname);
}

function isScheduleAction(element: HTMLElement): boolean {
  const text = element.textContent?.toLowerCase() ?? "";
  return (
    PM_REFERENCE.test(element.textContent ?? "") ||
    text.includes("calibration") ||
    text.includes("pm backlog") ||
    text.includes("preventive maintenance")
  );
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

async function getEquipmentIdForWorkOrder(
  workOrderNumber: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("work_orders")
    .select("equipment_id")
    .eq("wo_number", workOrderNumber)
    .maybeSingle();

  if (error) {
    console.warn("Work order equipment lookup failed:", error.message);
    return null;
  }

  return typeof data?.equipment_id === "string"
    ? data.equipment_id
    : null;
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
      void trackPilotUsageEvent({
        siteId,
        eventType: "equipment_view",
        pathname: location.pathname,
        entityType: "equipment",
        entityId: equipmentId,
        metadata: { section: location.pathname.split("/").at(-1) ?? "overview" },
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

    if (location.pathname === "/pilot-impact" || location.pathname === "/pilot-adoption") {
      void trackPilotUsageEvent({
        siteId,
        eventType: "pilot_impact_review",
        pathname: location.pathname,
        entityType: "route",
        metadata: {
          page: location.pathname === "/pilot-adoption" ? "adoption" : "impact",
        },
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
      if (!pathname) return;

      prefetchMaintenancePortalRoute(pathname);
    },
    [],
  );

  const handleWorkOrderClick = useCallback(
    async (event: ReactMouseEvent<HTMLDivElement>): Promise<void> => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-global-work-order-overlay="true"]')) return;

      const interactiveElement = target.closest<HTMLElement>("a[href],button");
      if (!interactiveElement) return;

      const routeUrl = routeUrlFromTarget(interactiveElement);
      if (routeUrl?.searchParams.get("from") === "ai" && siteContext?.siteId) {
        void trackPilotUsageEvent({
          siteId: siteContext.siteId,
          eventType: "recommendation_opened",
          pathname: window.location.pathname,
          entityType: "route",
          entityId: routeUrl.pathname,
          metadata: { destination: routeUrl.pathname },
        });
      }

      if (
        interactiveElement instanceof HTMLButtonElement &&
        interactiveElement.closest("#work-order-register")
      ) {
        return;
      }

      const workOrderNumber = getWorkOrderNumber(interactiveElement);
      if (!workOrderNumber) return;

      const directEquipmentId = getEquipmentId(interactiveElement);
      if (!directEquipmentId && isScheduleAction(interactiveElement)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();

      const equipmentId =
        directEquipmentId ??
        (await getEquipmentIdForWorkOrder(workOrderNumber));
      if (!equipmentId) return;

      if (siteContext?.siteId) {
        void trackPilotUsageEvent({
          siteId: siteContext.siteId,
          eventType: "work_order_view",
          pathname: window.location.pathname,
          entityType: "work_order",
          entityId: workOrderNumber,
          metadata: { equipmentId },
        });
      }

      const faultPanel = interactiveElement.closest<HTMLElement>(
        '[data-vorta-fault-panel="true"]',
      );

      faultPanel
        ?.querySelector<HTMLButtonElement>(
          'button[data-vorta-fault-close="true"]',
        )
        ?.click();

      window.dispatchEvent(
        new CustomEvent(VORTA_WORK_ORDER_DETAIL_EVENT, {
          detail: {
            equipmentId,
            workOrderNumber,
          },
        }),
      );
    },
    [siteContext?.siteId],
  );

  return (
    <div
      className="contents"
      onPointerOverCapture={handleNavigationIntent}
      onPointerDownCapture={handleNavigationIntent}
      onFocusCapture={handleNavigationIntent}
      onClickCapture={handleWorkOrderClick}
    >
      {children}
      <GlobalMaintenanceAiAssistantWithFaultsV2 role="maintenance-manager" />
      <MaintenanceWorkOrderExecutionOverlay />
    </div>
  );
}
