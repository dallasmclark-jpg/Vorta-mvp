import {
  useCallback,
  useLayoutEffect,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  installMaintenanceDashboardSnapshotGuard,
  markExplicitRiskIntelligenceRefresh,
} from "../../lib/maintenanceDashboardSnapshotGuard";
import { DashboardOverviewSection } from "./sections/DashboardOverviewSection";

const REFRESH_CONTROL_LABEL = "refresh risk intelligence";

export function MaintenanceDashboardExperience(): JSX.Element {
  useLayoutEffect(
    () => installMaintenanceDashboardSnapshotGuard(),
    [],
  );

  const captureExplicitRefresh = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>): void => {
      if (!(event.target instanceof Element)) return;

      const button = event.target.closest<HTMLButtonElement>("button");
      if (!button) return;

      const accessibleLabel = [
        button.getAttribute("aria-label"),
        button.textContent,
        button.getAttribute("title"),
      ]
        .filter(Boolean)
        .join(" ")
        .trim()
        .toLowerCase();

      if (accessibleLabel.includes(REFRESH_CONTROL_LABEL)) {
        markExplicitRiskIntelligenceRefresh();
      }
    },
    [],
  );

  return (
    <div
      data-vorta-dashboard-root="true"
      onClickCapture={captureExplicitRefresh}
    >
      <style>{`
        [data-vorta-dashboard-root="true"] [role="tab"] {
          min-height: 2.5rem;
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
