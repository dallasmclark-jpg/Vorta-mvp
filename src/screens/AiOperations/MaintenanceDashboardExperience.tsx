import {
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { DashboardOverviewSection } from "./sections/DashboardOverviewSection";

const SHIFT_COVER_LABEL = "shift cover";

function selectedAreaScope(): string | null {
  const selectedTab = document.querySelector<HTMLElement>(
    '[aria-label="Risk intelligence scope"] [role="tab"][aria-selected="true"]',
  );
  if (!selectedTab) return null;

  const labelSpans = selectedTab.querySelectorAll<HTMLElement>("span");
  const label = labelSpans.item(1)?.textContent?.trim() ?? "";
  return label && label.toLowerCase() !== "site risk" ? label : null;
}

function isShiftCoverCard(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  const card = target.closest<HTMLElement>(".cursor-pointer");
  const heading = card?.querySelector<HTMLElement>("h3")?.textContent?.trim();
  return heading?.toLowerCase() === SHIFT_COVER_LABEL;
}

export function MaintenanceDashboardExperience(): JSX.Element {
  const navigate = useNavigate();

  const captureDashboardWorkflow = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>): void => {
      if (!isShiftCoverCard(event.target)) return;

      event.preventDefault();
      event.stopPropagation();

      const area = selectedAreaScope();
      const query = area
        ? `?scope=area&area=${encodeURIComponent(area)}`
        : "";
      navigate(`/maintenance/labour-risk/shift-cover${query}`);
    },
    [navigate],
  );

  return (
    <div
      data-vorta-dashboard-root="true"
      onClickCapture={captureDashboardWorkflow}
    >
      <style>{`
        [data-vorta-dashboard-root="true"] [role="tab"] {
          min-height: 2.5rem;
        }

        [data-vorta-maintenance-portal="true"]:has([data-vorta-dashboard-root="true"])
          > button.fixed.bottom-4.right-4 {
          display: none !important;
        }

        @media (min-width: 1280px) {
          [data-vorta-dashboard-root="true"] [aria-label="Risk reduction KPI cards"] {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            grid-auto-flow: row !important;
            overflow: visible !important;
            scroll-snap-type: none !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label="Risk reduction KPI cards"] > * {
            width: 100% !important;
            min-width: 0 !important;
          }

          [data-vorta-dashboard-root="true"] button[aria-label^="Scroll to previous risk KPI"],
          [data-vorta-dashboard-root="true"] button[aria-label^="Scroll to next risk KPI"] {
            display: none !important;
          }
        }
      `}</style>

      <DashboardOverviewSection />
    </div>
  );
}
