export function EngineerBottomNavStyles(): JSX.Element {
  return (
    <style>{`
      @media (max-width: 767px) {
        [data-vorta-engineer-bottom-nav="true"] > a {
          display: grid !important;
          grid-template-rows: 2rem 0.875rem;
          place-items: center;
          align-content: center;
          gap: 0 !important;
        }

        [data-vorta-engineer-bottom-nav="true"] > a > span[aria-hidden="true"] {
          position: absolute;
          top: 0;
        }

        [data-vorta-engineer-bottom-nav="true"] > a > svg {
          grid-row: 1;
          align-self: center;
          justify-self: center;
        }

        [data-vorta-engineer-bottom-nav="true"] > a > span:last-child {
          grid-row: 2;
          align-self: center;
          margin: 0 !important;
          line-height: 0.875rem;
          transform: none !important;
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > span[aria-hidden="true"] {
          display: none;
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > svg {
          box-sizing: content-box;
          width: 1.2rem;
          height: 1.2rem;
          padding: 0.34rem;
          border: 1px solid rgba(71, 85, 105, 0.72);
          border-radius: 9999px;
          background: rgba(15, 23, 42, 0.45);
          color: #64748b;
          box-shadow: none;
          transition:
            border-color 160ms ease,
            background-color 160ms ease,
            color 160ms ease;
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"][aria-current="page"] > svg {
          border-color: rgba(96, 165, 250, 0.42);
          background: rgba(59, 130, 246, 0.12);
          color: #7ab6ff;
          box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.025);
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > span:last-child {
          font-weight: 600;
        }
      }
    `}</style>
  );
}
