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

      [data-vorta-maintenance-portal="true"] [class*="text-[7.5px]"],
      [data-vorta-maintenance-portal="true"] [class*="text-[8px]"],
      [data-vorta-maintenance-portal="true"] [class*="text-[8.5px]"],
      [data-vorta-maintenance-portal="true"] [class*="text-[9px]"],
      [data-vorta-maintenance-portal="true"] [class*="text-[9.5px]"],
      [data-vorta-maintenance-portal="true"] [class*="text-[10px]"],
      [data-vorta-maintenance-portal="true"] [class*="text-[11px]"] {
        font-size: 0.75rem !important;
        line-height: 1rem !important;
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

      @media (max-width: 420px) {
        [data-vorta-maintenance-portal="true"] {
          overflow-x: clip;
        }

        [data-vorta-maintenance-portal="true"] [class*="grid-cols-2"],
        [data-vorta-maintenance-portal="true"] [class*="grid-cols-3"],
        [data-vorta-maintenance-portal="true"] [class*="grid-cols-4"],
        [data-vorta-maintenance-portal="true"] [class*="grid-cols-5"],
        [data-vorta-maintenance-portal="true"] [class*="grid-cols-6"] {
          grid-template-columns: minmax(0, 1fr) !important;
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
        [data-vorta-maintenance-portal="true"] [class*="grid-cols-4"],
        [data-vorta-maintenance-portal="true"] [class*="grid-cols-5"],
        [data-vorta-maintenance-portal="true"] [class*="grid-cols-6"] {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        [data-vorta-maintenance-portal="true"] [role="dialog"] {
          max-width: min(92vw, 48rem) !important;
        }
      }
    `}</style>
  );
}
