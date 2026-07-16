import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GlobalMaintenanceAiAssistantWithFaultsV2 } from "./GlobalMaintenanceAiAssistantWithFaultsV2";

type VortaAiRole =
  | "maintenance-manager"
  | "planner"
  | "engineer"
  | "operator"
  | "production-manager"
  | "contractor";

interface GlobalMaintenanceAiAssistantWithFaultsV3Props {
  role?: VortaAiRole;
}

function getWorkOrderNumber(anchor: HTMLAnchorElement): string | null {
  const firstLabel = anchor.querySelector("span")?.textContent?.trim() ?? "";
  if (firstLabel) return firstLabel;

  const fallback = anchor.textContent?.match(/\b(?:WO-\d+|\d{8,14})\b/i)?.[0];
  return fallback?.trim() || null;
}

function isCompletedRecord(anchor: HTMLAnchorElement): boolean {
  return Array.from(anchor.querySelectorAll("span")).some(
    (element) => element.textContent?.trim().toLowerCase() === "completed",
  );
}

export function GlobalMaintenanceAiAssistantWithFaultsV3({
  role = "maintenance-manager",
}: GlobalMaintenanceAiAssistantWithFaultsV3Props): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    const handleWorkOrderLink = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !anchor.closest('[data-vorta-fault-panel="true"]')) return;

      const url = new URL(anchor.href, window.location.origin);
      const routeMatch = url.pathname.match(/^\/equipment\/([^/]+)\/history\/?$/);
      if (!routeMatch) return;

      const workOrderNumber = getWorkOrderNumber(anchor);
      if (!workOrderNumber) return;

      event.preventDefault();
      event.stopPropagation();

      anchor
        .closest('[data-vorta-fault-panel="true"]')
        ?.querySelector<HTMLButtonElement>('button[data-vorta-fault-close="true"]')
        ?.click();

      const view = isCompletedRecord(anchor) ? "completed" : "open";
      navigate(
        `/equipment/${routeMatch[1]}/work-orders?workOrder=${encodeURIComponent(
          workOrderNumber,
        )}&view=${view}`,
      );
    };

    document.addEventListener("click", handleWorkOrderLink, true);
    return () => document.removeEventListener("click", handleWorkOrderLink, true);
  }, [navigate]);

  return <GlobalMaintenanceAiAssistantWithFaultsV2 role={role} />;
}
