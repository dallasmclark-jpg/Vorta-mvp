import {
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type PropsWithChildren,
} from "react";
import { VORTA_WORK_ORDER_DETAIL_EVENT } from "../Equipment/GlobalWorkOrderExecutionOverlay";
import { MaintenanceWorkOrderExecutionOverlay } from "../Equipment/MaintenanceWorkOrderExecutionOverlay";
import { GlobalMaintenanceAiAssistantWithFaultsV2 } from "./GlobalMaintenanceAiAssistantWithFaultsV2";

const EQUIPMENT_ROUTE = /^\/equipment\/([^/]+)(?:\/|$)/;
const WORK_ORDER_NUMBER = /\b(?:WO-\d+|\d{8,14})\b/i;

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

export function MaintenanceAiWorkOrderExperience({
  children,
}: PropsWithChildren): JSX.Element {
  const handleWorkOrderClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>): void => {
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

      if (
        interactiveElement instanceof HTMLButtonElement &&
        interactiveElement.closest("#work-order-register")
      ) {
        return;
      }

      const equipmentId = getEquipmentId(interactiveElement);
      const workOrderNumber = getWorkOrderNumber(interactiveElement);
      if (!equipmentId || !workOrderNumber) return;

      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();

      const faultPanel = interactiveElement.closest<HTMLElement>(
        '[data-vorta-fault-panel="true"]',
      );

      faultPanel
        ?.querySelector<HTMLButtonElement>(
          'button[data-vorta-fault-close="true"]',
        )
        ?.click();

      window.queueMicrotask(() => {
        window.dispatchEvent(
          new CustomEvent(VORTA_WORK_ORDER_DETAIL_EVENT, {
            detail: {
              equipmentId,
              workOrderNumber,
            },
          }),
        );
      });
    },
    [],
  );

  return (
    <div className="contents" onClickCapture={handleWorkOrderClick}>
      {children}
      <GlobalMaintenanceAiAssistantWithFaultsV2 role="maintenance-manager" />
      <MaintenanceWorkOrderExecutionOverlay />
    </div>
  );
}
