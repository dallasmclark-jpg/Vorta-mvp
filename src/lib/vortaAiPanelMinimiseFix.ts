function installVortaAiPanelMinimiseFix(): void {
  if (document.getElementById("vorta-ai-panel-minimise-styles")) return;

  const style = document.createElement("style");
  style.id = "vorta-ai-panel-minimise-styles";
  style.textContent = `
    [data-vorta-ai-panel="true"][data-minimised="true"] {
      top: auto !important;
      right: 1rem !important;
      bottom: 1rem !important;
      width: min(420px, calc(100vw - 2rem)) !important;
      height: auto !important;
      min-height: 0 !important;
    }

    @media (max-width: 640px) {
      [data-vorta-ai-panel="true"][data-minimised="true"] {
        inset: auto 0.75rem 0.75rem auto !important;
        width: calc(100vw - 1.5rem) !important;
        height: auto !important;
        border-radius: 1rem !important;
      }
    }
  `;
  document.head.appendChild(style);

  let scheduled = false;
  const sync = () => {
    scheduled = false;
    const closeButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Close global assistant"]',
    );
    const panel = closeButton?.closest<HTMLElement>("div.fixed");
    if (!panel) return;

    const visibleSections = Array.from(panel.children).filter(
      (child) => child instanceof HTMLElement && !child.hidden,
    );
    panel.dataset.minimised = String(visibleSections.length <= 1);
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(sync);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  schedule();
}

installVortaAiPanelMinimiseFix();
