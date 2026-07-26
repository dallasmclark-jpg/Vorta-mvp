import { DashboardOverviewSection } from "./sections/DashboardOverviewSection";

export function MaintenanceDashboardExperience(): JSX.Element {
  return (
    <div id="maintenance-dashboard-root" data-vorta-dashboard-root="true">
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

        @media (max-width: 767px) {
          [data-vorta-dashboard-root="true"] > section {
            gap: 1rem !important;
            padding: 0.75rem 0.75rem 1.5rem !important;
          }

          [data-vorta-dashboard-root="true"] > section > header {
            gap: 0.75rem !important;
            padding-bottom: 1rem !important;
          }

          [data-vorta-dashboard-root="true"] > section > header > div:last-child {
            width: 100%;
            gap: 0.5rem;
          }

          [data-vorta-dashboard-root="true"] > section > header > div:last-child > button:first-child {
            min-width: 0;
            min-height: 2.75rem;
            flex: 1 1 auto;
            padding-inline: 0.75rem;
          }

          [data-vorta-dashboard-root="true"] > section > header h1 {
            font-size: 1.625rem !important;
            line-height: 2rem !important;
          }

          [data-vorta-dashboard-root="true"] h2 {
            font-size: 1.1875rem !important;
            line-height: 1.55rem !important;
          }

          [data-vorta-dashboard-root="true"] section:has([aria-label^="View equipment in "]),
          [data-vorta-dashboard-root="true"] [data-vorta-dashboard-section="labour-risk"],
          [data-vorta-dashboard-root="true"] [aria-label="Risk reduction performance"] {
            scroll-margin-top: 1rem;
          }

          [data-vorta-dashboard-root="true"] section:has([aria-label^="View equipment in "]) > div:first-child,
          [data-vorta-dashboard-root="true"] [data-vorta-dashboard-section="labour-risk"] > div:first-child {
            align-items: flex-start;
            gap: 0.5rem;
          }

          [data-vorta-dashboard-root="true"] section:has([aria-label^="View equipment in "]) > div:first-child button,
          [data-vorta-dashboard-root="true"] [data-vorta-dashboard-section="labour-risk"] > div:first-child button {
            display: inline-flex;
            min-height: 2.75rem;
            align-items: center;
            justify-content: flex-end;
            padding: 0.25rem 0.5rem;
            text-align: right;
            font-size: 0.9375rem !important;
            line-height: 1.25rem;
          }

          [data-vorta-dashboard-root="true"] section:has([aria-label^="View equipment in "]) div:has(> [aria-label^="View equipment in "]) {
            display: flex !important;
            grid-template-columns: none !important;
            gap: 0.75rem !important;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            scroll-snap-type: x mandatory;
            scroll-padding-inline: 0;
            padding-right: 0.75rem;
            padding-bottom: 0.25rem;
            margin-right: -0.75rem;
            scrollbar-width: none;
          }

          [data-vorta-dashboard-root="true"] section:has([aria-label^="View equipment in "]) div:has(> [aria-label^="View equipment in "])::-webkit-scrollbar {
            display: none;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] {
            width: calc(100vw - 3rem);
            min-width: calc(100vw - 3rem);
            max-width: 22rem;
            flex: 0 0 calc(100vw - 3rem);
            scroll-snap-align: start;
            scroll-snap-stop: always;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] > div {
            gap: 0.625rem !important;
            padding: 0.875rem !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] h3 {
            font-size: 1.0625rem !important;
            line-height: 1.4rem !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] [class~="text-xs"] {
            font-size: 0.875rem !important;
            line-height: 1.25rem !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] [class~="text-xl"] {
            font-size: 1.5rem !important;
            line-height: 1.8rem !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] p[class*="min-h-9"] {
            min-height: 0 !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] dl {
            gap: 0.5rem !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] dl > div:not(:first-child) {
            display: none !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] button {
            min-height: 2.75rem;
            width: 100%;
            justify-content: center;
            font-size: 0.9375rem !important;
          }

          [data-vorta-dashboard-root="true"] [data-vorta-card-rail="labour-risk"] {
            display: flex !important;
            grid-template-columns: none !important;
            gap: 0.75rem !important;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            scroll-snap-type: x mandatory;
            scroll-padding-inline: 0;
            padding-right: 0.75rem;
            padding-bottom: 0.25rem;
            margin-right: -0.75rem;
            scrollbar-width: none;
          }

          [data-vorta-dashboard-root="true"] [data-vorta-card-rail="labour-risk"]::-webkit-scrollbar {
            display: none;
          }

          [data-vorta-dashboard-root="true"] [data-vorta-dashboard-card="labour-risk"] {
            width: calc(100vw - 3rem);
            min-width: calc(100vw - 3rem);
            max-width: 22rem;
            flex: 0 0 calc(100vw - 3rem);
            scroll-snap-align: start;
            scroll-snap-stop: always;
          }

          [data-vorta-dashboard-root="true"] [data-vorta-dashboard-card="labour-risk"] > div {
            gap: 0.625rem !important;
            padding: 0.875rem !important;
          }

          [data-vorta-dashboard-root="true"] [data-vorta-mobile-secondary="true"] {
            display: none !important;
          }

          [data-vorta-dashboard-root="true"] [data-vorta-mobile-card-action="true"] {
            display: inline-flex !important;
            min-height: 2.75rem;
            width: 100%;
            align-items: center;
            justify-content: center;
          }

          [data-vorta-dashboard-root="true"] [aria-label="Risk reduction KPI cards"] {
            scroll-padding-inline: 0;
          }

          [data-vorta-dashboard-root="true"] [aria-label="Risk reduction KPI cards"] > [data-risk-kpi-card] {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            scroll-snap-align: start;
            scroll-snap-stop: always;
          }

          [data-vorta-dashboard-root="true"] [data-risk-kpi-card] [class~="text-xs"] {
            font-size: 0.875rem !important;
            line-height: 1.25rem !important;
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
