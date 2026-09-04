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
          top: -0.45rem;
          width: 3.45rem;
          height: 3.45rem;
          transform: translateX(-50%);
          border: 1px solid rgba(59, 130, 246, 0.38);
          border-radius: 9999px;
          background: #07172b;
          box-shadow:
            0 10px 24px rgba(0, 0, 0, 0.34),
            inset 0 0 0 1px rgba(96, 165, 250, 0.05);
          z-index: -1;
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"][aria-current="page"]::before {
          border-color: rgba(96, 165, 250, 0.72);
          background: #0b2343;
          box-shadow:
            0 10px 26px rgba(0, 0, 0, 0.38),
            0 0 22px rgba(37, 99, 235, 0.16),
            inset 0 0 0 1px rgba(147, 197, 253, 0.08);
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > span[aria-hidden="true"] {
          display: none;
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > svg {
          width: 1.5rem;
          height: 1.5rem;
          transform: translateY(-0.28rem);
        }

        [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > span:last-child {
          transform: translateY(0.18rem);
          font-weight: 600;
        }
      }
    `}</style>
  );
}
