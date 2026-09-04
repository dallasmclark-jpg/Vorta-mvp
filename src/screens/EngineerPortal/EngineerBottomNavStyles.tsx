export function EngineerBottomNavStyles(): JSX.Element {
  return (
    <style>{`
      @media (max-width: 767px) {
        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] {
          gap: 0.15rem !important;
          overflow: visible;
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > span[aria-hidden="true"] {
          display: none;
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > svg {
          box-sizing: content-box;
          width: 1.25rem;
          height: 1.25rem;
          padding: 0.52rem;
          border: 1px solid rgba(59, 130, 246, 0.30);
          border-radius: 9999px;
          background: rgba(15, 35, 61, 0.72);
          color: #7ab6ff;
          box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.035);
          transform: none;
          transition:
            border-color 160ms ease,
            background-color 160ms ease,
            color 160ms ease,
            box-shadow 160ms ease;
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"][aria-current="page"] > svg {
          border-color: rgba(96, 165, 250, 0.52);
          background: rgba(18, 48, 86, 0.78);
          color: #8bc0ff;
          box-shadow:
            0 0 0 2px rgba(59, 130, 246, 0.045),
            inset 0 0 0 1px rgba(191, 219, 254, 0.055);
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > span:last-child {
          margin-top: -0.08rem;
          transform: none;
          font-weight: 600;
          line-height: 1;
        }
      }
    `}</style>
  );
}
