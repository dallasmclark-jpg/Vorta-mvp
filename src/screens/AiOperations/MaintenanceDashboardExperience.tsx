import { DashboardOverviewSection } from "./sections/DashboardOverviewSection";

export function MaintenanceDashboardExperience(): JSX.Element {
  return (
    <div data-vorta-dashboard-root="true">
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
