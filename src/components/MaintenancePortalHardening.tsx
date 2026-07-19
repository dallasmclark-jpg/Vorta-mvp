export function MaintenancePortalHardening(): JSX.Element {
  return (
    <style>{`
      [data-vorta-maintenance-portal="true"] {
        min-width: 0;
      }

      [data-vorta-maintenance-portal="true"] *,
      [data-vorta-maintenance-portal="true"] *::before,
      [data-vorta-maintenance-portal="true"] *::after {
        min-width: 0;
      }

      [data-vorta-maintenance-portal="true"] button,
      [data-vorta-maintenance-portal="true"] [role="button"],
      [data-vorta-maintenance-portal="true"] [role="dialog"] button,
      [data-vorta-maintenance-portal="true"] [role="dialog"] [role="button"] {
        min-height: 2.5rem;
      }

      [data-vorta-maintenance-portal="true"] td,
      [data-vorta-maintenance-portal="true"] th,
      [data-vorta-maintenance-portal="true"] [role="dialog"] {
        overflow-wrap: anywhere;
      }

      [data-vorta-maintenance-portal="true"] [role="dialog"] {
        max-height: calc(100dvh - 1rem);
      }

      @media (min-width: 1360px) and (max-width: 1535px) {
        body main:has([data-vorta-maintenance-portal="true"])
          > div[class*="md:w-14"][class*="2xl:w-56"] {
          width: 14rem !important;
        }

        body main:has([data-vorta-maintenance-portal="true"])
          > div[class*="md:w-14"]
          aside {
          padding-left: 1rem !important;
          padding-right: 1rem !important;
        }

        body main:has([data-vorta-maintenance-portal="true"])
          > div[class*="md:w-14"]
          aside
          [class~="hidden"][class*="2xl:block"] {
          display: block !important;
        }

        body main:has([data-vorta-maintenance-portal="true"])
          > div[class*="md:w-14"]
          aside
          [class~="block"][class*="2xl:hidden"] {
          display: none !important;
        }

        body main:has([data-vorta-maintenance-portal="true"])
          > div[class*="md:w-14"]
          aside
          a,
        body main:has([data-vorta-maintenance-portal="true"])
          > div[class*="md:w-14"]
          aside
          button {
          justify-content: flex-start !important;
          padding-left: 0.75rem !important;
          padding-right: 0.75rem !important;
        }

        body main:has([data-vorta-maintenance-portal="true"])
          > div[class*="md:w-14"]
          aside
          header {
          justify-content: flex-start !important;
          padding-left: 0.5rem !important;
        }

        body:has([data-vorta-maintenance-portal="true"]) > [role="tooltip"] {
          display: none !important;
        }
      }

      @media (max-width: 420px) {
        [data-vorta-maintenance-portal="true"] {
          overflow-x: clip;
        }

        [data-vorta-maintenance-portal="true"] [role="dialog"] {
          width: calc(100vw - 0.75rem) !important;
          max-width: calc(100vw - 0.75rem) !important;
          margin-inline: auto;
        }

        [data-vorta-maintenance-portal="true"] [class*="overflow-x-auto"] table {
          min-width: 42rem;
        }
      }

      @media (min-width: 600px) and (max-width: 1024px) {
        [data-vorta-maintenance-portal="true"] [role="dialog"] {
          max-width: min(92vw, 48rem) !important;
        }
      }
    `}</style>
  );
}
