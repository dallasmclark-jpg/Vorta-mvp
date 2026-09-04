export function EngineerBottomNavStyles(): JSX.Element {
  return (
    <style>{`
      @media (max-width: 767px) {
        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] {
          isolation: isolate;
          overflow: visible;
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"]::before {
          content: "";
          position: absolute;
          left: 50%;
          top: -0.2rem;
          width: 2.9rem;
          height: 2.9rem;
          transform: translateX(-50%);
          border: 1px solid rgba(59, 130, 246, 0.28);
          border-radius: 9999px;
          background: #071321;
          box-shadow:
            0 7px 18px rgba(0, 0, 0, 0.26),
            inset 0 0 0 1px rgba(96, 165, 250, 0.035);
          z-index: -1;
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"][aria-current="page"]::before {
          border-color: rgba(96, 165, 250, 0.56);
          background: #091a30;
          box-shadow:
            0 8px 20px rgba(0, 0, 0, 0.3),
            0 0 14px rgba(37, 99, 235, 0.08),
            inset 0 0 0 1px rgba(147, 197, 253, 0.055);
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > span[aria-hidden="true"] {
          display: none;
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > svg {
          width: 1.35rem;
          height: 1.35rem;
          transform: translateY(-0.22rem);
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > span:last-child {
          transform: translateY(0.45rem);
          font-weight: 600;
        }
      }
    `}</style>
  );
}
