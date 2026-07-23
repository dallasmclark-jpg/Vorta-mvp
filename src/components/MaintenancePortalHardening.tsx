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

      [data-vorta-maintenance-portal="true"] :where(
        a[href],
        button:not(:disabled),
        input:not(:disabled),
        select:not(:disabled),
        textarea:not(:disabled),
        [role="button"][tabindex]:not([tabindex="-1"]),
        [role="tab"][tabindex]:not([tabindex="-1"])
      ):focus-visible {
        outline: 2px solid #93c5fd;
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
      }

      [data-vorta-maintenance-portal="true"] [data-vorta-nav-item="true"][aria-current="page"] {
        box-shadow: inset 3px 0 0 currentColor;
        font-weight: 650;
      }

      [data-vorta-maintenance-portal="true"] [role="tab"][aria-selected="true"] {
        text-decoration-thickness: 0.125rem;
        text-underline-offset: 0.35rem;
      }

      [data-vorta-maintenance-portal="true"] [aria-pressed="true"] {
        box-shadow:
          inset 0 0 0 1px rgba(147, 197, 253, 0.7),
          0 0 0 2px rgba(59, 130, 246, 0.16);
      }

      [data-vorta-maintenance-portal="true"] td,
      [data-vorta-maintenance-portal="true"] th,
      [data-vorta-maintenance-portal="true"] [role="dialog"] {
        overflow-wrap: anywhere;
      }

      [data-vorta-maintenance-portal="true"] [role="dialog"] {
        max-height: calc(100dvh - 1rem);
      }

      @media (prefers-reduced-motion: reduce) {
        [data-vorta-maintenance-portal="true"] *,
        [data-vorta-maintenance-portal="true"] *::before,
        [data-vorta-maintenance-portal="true"] *::after {
          scroll-behavior: auto !important;
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }

      @media (forced-colors: active) {
        [data-vorta-maintenance-portal="true"] [data-vorta-nav-item="true"][aria-current="page"],
        [data-vorta-maintenance-portal="true"] [role="tab"][aria-selected="true"],
        [data-vorta-maintenance-portal="true"] [aria-pressed="true"] {
          outline: 2px solid Highlight;
          outline-offset: -2px;
        }
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

      @media (max-width: 639px) {
        [data-vorta-dashboard-root="true"] button:not([aria-label^="Explain "]),
        [data-vorta-dashboard-root="true"] [role="button"] {
          min-height: 2.75rem;
        }

        [data-vorta-dashboard-root="true"] button[aria-label="User profile"] {
          width: 2.75rem !important;
          min-width: 2.75rem;
          height: 2.75rem !important;
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
