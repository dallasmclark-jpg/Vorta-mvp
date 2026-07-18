export function MaintenanceActionEvidenceHardening(): JSX.Element {
  return (
    <style>{`
      [data-vorta-maintenance-portal="true"] [data-vorta-action-evidence] dt,
      [data-vorta-maintenance-portal="true"] [data-vorta-action-evidence] [data-label] {
        color: rgb(148 163 184);
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.04em;
      }

      @media (max-width: 1024px) {
        [data-vorta-maintenance-portal="true"] button,
        [data-vorta-maintenance-portal="true"] [role="button"],
        [data-vorta-maintenance-portal="true"] [role="dialog"] button,
        [data-vorta-maintenance-portal="true"] [role="dialog"] [role="button"] {
          min-height: 2.75rem;
        }
      }
    `}</style>
  );
}
