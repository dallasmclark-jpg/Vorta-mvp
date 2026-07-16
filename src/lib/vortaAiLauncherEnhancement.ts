const DISCOVERY_KEY = "vorta-ai-launcher-discovered-v1";
const INSTALL_MARKER = "vortaAiLauncherEnhancement";

function installLauncherStyles(): void {
  if (document.getElementById("vorta-ai-launcher-styles")) return;

  const style = document.createElement("style");
  style.id = "vorta-ai-launcher-styles";
  style.textContent = `
    [data-vorta-ai-input-shell="true"] {
      border-color: rgba(59, 130, 246, 0.24) !important;
      background: #0d121b !important;
      border-radius: 0.75rem !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025) !important;
      transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease !important;
    }

    [data-vorta-ai-input-shell="true"]:hover,
    [data-vorta-ai-input-shell="true"]:focus-within {
      border-color: rgba(96, 165, 250, 0.42) !important;
      background: #101621 !important;
    }

    [data-vorta-ai-input-shell="true"][data-open="true"] {
      border-color: rgba(96, 165, 250, 0.46) !important;
      background: #101621 !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035), 0 0 18px rgba(37, 99, 235, 0.08) !important;
    }

    [data-vorta-ai-text="true"] > svg {
      display: none !important;
    }

    [data-vorta-ai-text="true"]::before {
      content: "✦";
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(96, 165, 250, 0.82);
      font-size: 0.95rem;
      line-height: 1;
      pointer-events: none;
    }

    [data-vorta-ai-launcher="true"] {
      min-width: 154px !important;
      border: 1px solid rgba(59, 130, 246, 0.62) !important;
      background: rgba(37, 99, 235, 0.11) !important;
      color: #dbeafe !important;
      border-radius: 0.75rem !important;
      box-shadow: 0 0 22px rgba(37, 99, 235, 0.16) !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.5rem !important;
      font-size: 0 !important;
      opacity: 1 !important;
      cursor: pointer !important;
      transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease, opacity 180ms ease !important;
    }

    [data-vorta-ai-launcher="true"]:hover {
      border-color: rgba(96, 165, 250, 0.86) !important;
      background: rgba(37, 99, 235, 0.2) !important;
      box-shadow: 0 0 26px rgba(37, 99, 235, 0.2) !important;
    }

    [data-vorta-ai-launcher="true"]:disabled {
      border-color: rgba(71, 85, 105, 0.58) !important;
      background: rgba(30, 41, 59, 0.35) !important;
      color: #64748b !important;
      box-shadow: none !important;
      cursor: not-allowed !important;
      opacity: 0.62 !important;
    }

    [data-vorta-ai-launcher="true"]:disabled:hover {
      border-color: rgba(71, 85, 105, 0.58) !important;
      background: rgba(30, 41, 59, 0.35) !important;
      box-shadow: none !important;
    }

    [data-vorta-ai-launcher="true"] > svg {
      display: none !important;
    }

    [data-vorta-ai-launcher="true"]::before {
      content: "✦";
      color: #93c5fd;
      font-size: 1rem;
      line-height: 1;
    }

    [data-vorta-ai-launcher="true"]:disabled::before {
      color: #64748b;
    }

    [data-vorta-ai-launcher="true"]::after {
      content: attr(data-vorta-ai-label);
      color: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.25rem;
      white-space: nowrap;
    }

    [data-vorta-ai-launcher="true"][data-open="true"] {
      border-color: rgba(96, 165, 250, 0.5) !important;
      background: rgba(37, 99, 235, 0.16) !important;
      color: #bfdbfe !important;
      box-shadow: 0 0 18px rgba(37, 99, 235, 0.12) !important;
    }

    @keyframes vorta-ai-discovery-pulse {
      0%, 100% {
        box-shadow: 0 0 18px rgba(37, 99, 235, 0.12);
      }
      50% {
        box-shadow: 0 0 30px rgba(59, 130, 246, 0.34);
      }
    }

    [data-vorta-ai-launcher="true"][data-discovery="true"]:not(:disabled) {
      animation: vorta-ai-discovery-pulse 2.4s ease-in-out 2;
    }

    @media (prefers-reduced-motion: reduce) {
      [data-vorta-ai-launcher="true"][data-discovery="true"] {
        animation: none;
      }
    }
  `;

  document.head.appendChild(style);
}

function assistantIsOpen(): boolean {
  return Boolean(
    document.querySelector('button[aria-label="Close global assistant"]'),
  );
}

function hasSeenLauncher(): boolean {
  try {
    return window.localStorage.getItem(DISCOVERY_KEY) === "true";
  } catch {
    return false;
  }
}

function markLauncherSeen(): void {
  try {
    window.localStorage.setItem(DISCOVERY_KEY, "true");
  } catch {
    // The launcher remains fully usable when storage is unavailable.
  }

  document
    .querySelectorAll<HTMLElement>('[data-vorta-ai-launcher="true"]')
    .forEach((button) => {
      delete button.dataset.discovery;
    });
}

function findLauncherButton(row: HTMLElement): HTMLButtonElement | null {
  for (const child of Array.from(row.children)) {
    if (child instanceof HTMLButtonElement) return child;
  }

  return null;
}

function enhanceLaunchers(): boolean {
  const open = assistantIsOpen();
  let launcherFound = false;

  document
    .querySelectorAll<HTMLInputElement>('input[placeholder^="Ask Vorta"]')
    .forEach((input) => {
      const textContainer = input.parentElement;
      const inputShell = textContainer?.parentElement;
      const row = inputShell?.parentElement;

      if (
        !(textContainer instanceof HTMLElement) ||
        !(inputShell instanceof HTMLElement) ||
        !(row instanceof HTMLElement)
      ) {
        return;
      }

      const launcherButton = findLauncherButton(row);
      if (!launcherButton) return;

      launcherFound = true;

      textContainer.dataset.vortaAiText = "true";
      inputShell.dataset.vortaAiInputShell = "true";
      inputShell.dataset.open = String(open);
      inputShell.title = "Type your question, then press Ask Vorta AI";

      launcherButton.dataset.vortaAiLauncher = "true";
      launcherButton.dataset.open = String(open);
      launcherButton.dataset.vortaAiLabel = open
        ? "AI Assistant Open"
        : "Ask Vorta AI";
      launcherButton.setAttribute("aria-pressed", String(open));
      launcherButton.title = launcherButton.disabled
        ? "Enter a question before opening Vorta AI"
        : open
          ? "Vorta AI assistant is open"
          : "Ask Vorta AI";

      if (!open && !launcherButton.disabled && !hasSeenLauncher()) {
        launcherButton.dataset.discovery = "true";
      } else {
        delete launcherButton.dataset.discovery;
      }
    });

  return launcherFound;
}

function installVortaAiLauncherEnhancement(): void {
  const root = document.documentElement;
  if (root.dataset[INSTALL_MARKER] === "true") return;
  root.dataset[INSTALL_MARKER] = "true";

  installLauncherStyles();

  let scheduled = false;
  let discoveryTimer: number | null = null;

  const runEnhancement = () => {
    scheduled = false;
    const launcherFound = enhanceLaunchers();

    if (
      launcherFound &&
      !hasSeenLauncher() &&
      discoveryTimer === null
    ) {
      discoveryTimer = window.setTimeout(() => {
        markLauncherSeen();
        discoveryTimer = null;
      }, 5200);
    }
  };

  const scheduleEnhancement = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(runEnhancement);
  };

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const launcherButton = target.closest<HTMLButtonElement>(
        '[data-vorta-ai-launcher="true"]',
      );

      if (!launcherButton || launcherButton.disabled) return;

      markLauncherSeen();
      scheduleEnhancement();
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      const target = event.target;

      if (
        event.key !== "Enter" ||
        !(target instanceof HTMLInputElement) ||
        !target.matches('input[placeholder^="Ask Vorta"]')
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled"],
  });

  scheduleEnhancement();
}

installVortaAiLauncherEnhancement();
