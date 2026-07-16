import {
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  GlobalWorkOrderExecutionOverlay,
  VORTA_WORK_ORDER_DETAIL_EVENT,
} from "../Equipment/GlobalWorkOrderExecutionOverlay";
import { GlobalMaintenanceAiAssistantWithFaultsV2 } from "./GlobalMaintenanceAiAssistantWithFaultsV2";

const WORK_ORDER_ROUTE =
  /^\/equipment\/([^/]+)\/(?:history|work-orders)\/?$/;
const WORK_ORDER_NUMBER = /\b(?:WO-\d+|\d{8,14})\b/i;

function getWorkOrderNumber(anchor: HTMLAnchorElement): string | null {
  const firstLabel = anchor.querySelector("span")?.textContent?.trim() ?? "";
  if (WORK_ORDER_NUMBER.test(firstLabel)) return firstLabel;

  return anchor.textContent?.match(WORK_ORDER_NUMBER)?.[0] ?? null;
}

function getEquipmentId(anchor: HTMLAnchorElement): string | null {
  const href = anchor.getAttribute("href")?.trim();
  if (!href) return null;

  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) return null;

  const routeMatch = url.pathname.match(WORK_ORDER_ROUTE);
  if (!routeMatch) return null;

  try {
    return decodeURIComponent(routeMatch[1]);
  } catch {
    return routeMatch[1];
  }
}

export function MaintenanceAiWorkOrderExperience(): JSX.Element {
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

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      const faultPanel = anchor?.closest<HTMLElement>(
        '[data-vorta-fault-panel="true"]',
      );
      if (!anchor || !faultPanel) return;

      const equipmentId = getEquipmentId(anchor);
      const workOrderNumber = getWorkOrderNumber(anchor);
      if (!equipmentId || !workOrderNumber) return;

      event.preventDefault();
      event.stopPropagation();

      faultPanel
        .querySelector<HTMLButtonElement>(
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
      <GlobalMaintenanceAiAssistantWithFaultsV2 role="maintenance-manager" />
      <GlobalWorkOrderExecutionOverlay />
    </div>
  );
}
