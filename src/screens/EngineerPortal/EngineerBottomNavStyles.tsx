const ENGINEER_BOTTOM_NAV_STYLES = `
@media (max-width: 767px) {
  [data-vorta-engineer-bottom-nav="true"] {
    left: 0.75rem !important;
    right: 0.75rem !important;
    bottom: max(0.35rem, env(safe-area-inset-bottom)) !important;
    width: auto !important;
    min-height: 4.65rem !important;
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
    align-items: center;
    overflow: visible !important;
    isolation: isolate;
    border: 1px solid rgba(51, 65, 85, 0.74) !important;
    border-radius: 1.75rem !important;
    background: rgba(3, 12, 29, 0.97) !important;
    padding: 0.4rem 0.45rem 0.5rem !important;
    box-shadow:
      0 18px 44px rgba(0, 0, 0, 0.42),
      inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;
    backdrop-filter: blur(18px);
  }

  [data-vorta-engineer-bottom-nav="true"]::before {
    content: "";
    position: absolute;
    left: 50%;
    top: -1.28rem;
    z-index: 0;
    width: 4.7rem;
    height: 4.7rem;
    transform: translateX(-50%);
    border-radius: 9999px;
    background: #000814;
    pointer-events: none;
  }

  [data-vorta-engineer-bottom-nav="true"] > a {
    position: relative;
    z-index: 1;
    display: flex !important;
    min-width: 0;
    min-height: 3.75rem !important;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.28rem !important;
    border-radius: 1rem;
    padding: 0.3rem 0.15rem !important;
    color: #71839c !important;
    transition:
      color 160ms ease,
      background-color 160ms ease,
      transform 160ms ease;
  }

  [data-vorta-engineer-bottom-nav="true"] > a > span[aria-hidden="true"] {
    display: none !important;
  }

  [data-vorta-engineer-bottom-nav="true"] > a > svg {
    width: 1.28rem;
    height: 1.28rem;
    stroke-width: 1.8;
    color: currentColor;
  }

  [data-vorta-engineer-bottom-nav="true"] > a > span:last-child {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: currentColor;
    font-size: 0.625rem;
    font-weight: 550;
    line-height: 0.8rem;
    letter-spacing: -0.01em;
  }

  [data-vorta-engineer-bottom-nav="true"] > a[aria-current="page"] {
    color: #60a5fa !important;
  }

  [data-vorta-engineer-bottom-nav="true"] > a:active {
    transform: translateY(1px);
  }

  [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] {
    grid-column: 3;
    grid-row: 1;
    align-self: stretch;
    justify-content: flex-end;
    padding-bottom: 0.22rem !important;
    color: #93c5fd !important;
  }

  [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > svg {
    position: absolute;
    left: 50%;
    top: -1.22rem;
    box-sizing: content-box !important;
    width: 1.42rem !important;
    height: 1.42rem !important;
    transform: translateX(-50%);
    padding: 0.98rem;
    border: 1px solid rgba(147, 197, 253, 0.28);
    border-radius: 9999px;
    background: #2563eb;
    color: #ffffff !important;
    stroke-width: 1.9;
    box-shadow:
      0 11px 26px rgba(37, 99, 235, 0.34),
      0 0 0 0.42rem #000814;
  }

  [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"] > span:last-child {
    margin-top: 2.1rem !important;
    color: #93c5fd !important;
    font-weight: 650;
  }

  [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"][aria-current="page"] > svg {
    border-color: rgba(191, 219, 254, 0.55);
    background: #3b82f6;
    box-shadow:
      0 12px 30px rgba(37, 99, 235, 0.46),
      0 0 0 0.42rem #000814,
      inset 0 1px 0 rgba(255, 255, 255, 0.16);
  }

  [data-vorta-engineer-bottom-nav="true"] > a[href="/engineer/vorta"]:active > svg {
    transform: translateX(-50%) scale(0.97);
  }

  [data-vorta-portal-scroll-container="true"] {
    padding-bottom: calc(6.35rem + env(safe-area-inset-bottom)) !important;
  }

  [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
    [data-vorta-global-ai-panel="true"][data-vorta-global-ai-panel="true"] {
    bottom: calc(6.85rem + env(safe-area-inset-bottom)) !important;
  }

  [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
    [data-vorta-engineer-composer-input="true"]:placeholder-shown {
    height: 2.5rem !important;
    min-height: 2.5rem !important;
    overflow-y: hidden !important;
  }
}
`;

export function EngineerBottomNavStyles(): JSX.Element {
  return <style>{ENGINEER_BOTTOM_NAV_STYLES}</style>;
}
