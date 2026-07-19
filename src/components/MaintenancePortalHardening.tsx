export function MaintenancePortalHardening(): JSX.Element {
  return (
    <style>{`
      [data-vorta-maintenance-portal="true"] {
        min-width: 0;
      }

      [data-vorta-maintenance-portal="true"] button,
      [data-vorta-maintenance-portal="true"] [role="button"] {
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
        [data-vorta-portal-shell="true"] [data-vorta-desktop-sidebar="true"] {
          width: 14rem !important;
        }

        [data-vorta-desktop-sidebar="true"] [data-vorta-sidebar="true"] {
          padding-left: 1rem !important;
          padding-right: 1rem !important;
        }

        [data-vorta-desktop-sidebar="true"] [data-vorta-sidebar-label="true"],
        [data-vorta-desktop-sidebar="true"] [data-vorta-sidebar-logo-full="true"] {
          display: block !important;
        }

        [data-vorta-desktop-sidebar="true"] [data-vorta-sidebar-logo-icon="true"],
        [data-vorta-sidebar-tooltip="true"] {
          display: none !important;
        }

        [data-vorta-desktop-sidebar="true"] [data-vorta-nav-item="true"] {
          justify-content: flex-start !important;
          padding-left: 0.75rem !important;
          padding-right: 0.75rem !important;
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
      }

      @media (min-width: 600px) and (max-width: 1024px) {
        [data-vorta-maintenance-portal="true"] [role="dialog"] {
          max-width: min(92vw, 48rem) !important;
        }
      }
    `}</style>
  );
}
