import { useEffect } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";

const ACTIVE_TAB_STORAGE_KEY = "vorta:ask-vorta:workspace-tab:v1";
const SCROLL_STORAGE_KEY = "vorta:ask-vorta:workspace-scroll:v1";
const WORKSPACE_SELECTOR = "[data-vorta-ai-workspace='true']";
const EXPAND_SELECTOR = "[data-vorta-global-ai-expand='true']";

function readSessionValue(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ask Vorta still works when browser storage is unavailable.
  }
}

function workspaceScrollContainer(workspace: Element): HTMLElement | null {
  return workspace.querySelector<HTMLElement>("main > div");
}

function storeWorkspaceView(): void {
  const workspace = document.querySelector(WORKSPACE_SELECTOR);
  if (!workspace) return;

  const activeTab = workspace.querySelector<HTMLButtonElement>(
    '[role="tab"][aria-selected="true"]',
  );
  const tabLabel = activeTab?.textContent?.trim();
  if (tabLabel) writeSessionValue(ACTIVE_TAB_STORAGE_KEY, tabLabel);

  const scrollContainer = workspaceScrollContainer(workspace);
  if (scrollContainer) {
    writeSessionValue(SCROLL_STORAGE_KEY, String(scrollContainer.scrollTop));
  }
}

function restoreWorkspaceView(attempt = 0): void {
  const workspace = document.querySelector<HTMLElement>(WORKSPACE_SELECTOR);
  const visible = workspace && window.getComputedStyle(workspace).display !== "none";

  if (!workspace || !visible) {
    if (attempt < 8) {
      window.setTimeout(() => restoreWorkspaceView(attempt + 1), 50);
    }
    return;
  }

  const savedTab = readSessionValue(ACTIVE_TAB_STORAGE_KEY);
  if (savedTab) {
    const matchingTab = Array.from(
      workspace.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).find((tab) => tab.textContent?.trim() === savedTab);

    if (matchingTab?.getAttribute("aria-selected") !== "true") {
      matchingTab?.click();
    }
  }

  const savedScroll = Number(readSessionValue(SCROLL_STORAGE_KEY));
  if (Number.isFinite(savedScroll)) {
    window.requestAnimationFrame(() => {
      const scrollContainer = workspaceScrollContainer(workspace);
      if (scrollContainer) scrollContainer.scrollTop = savedScroll;
    });
  }
}

export function AskVortaDesktopWorkspaceExperience(): JSX.Element {
  const isPhone = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    if (isPhone) return;

    const pendingTimers = new Set<number>();

    const schedule = (callback: () => void, delay: number): void => {
      const timer = window.setTimeout(() => {
        pendingTimers.delete(timer);
        callback();
      }, delay);
      pendingTimers.add(timer);
    };

    const openWorkspace = (attempt = 0): void => {
      const expandButton = document.querySelector<HTMLButtonElement>(EXPAND_SELECTOR);
      if (expandButton) {
        expandButton.click();
        schedule(() => restoreWorkspaceView(), 0);
        return;
      }

      if (attempt < 12) schedule(() => openWorkspace(attempt + 1), 50);
    };

    const handlePrompt = (): void => {
      schedule(() => openWorkspace(), 0);
    };

    const handleDocumentClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const workspace = target.closest(WORKSPACE_SELECTOR);
      if (workspace) {
        if (
          target.closest('[aria-label="Return to compact Ask Vorta panel"]') ||
          target.closest("button")?.textContent?.includes("Return to compact panel")
        ) {
          storeWorkspaceView();
        }

        if (target.closest('[role="tab"]')) {
          schedule(storeWorkspaceView, 0);
        }
      }

      if (target.closest(EXPAND_SELECTOR)) {
        schedule(() => restoreWorkspaceView(), 0);
        return;
      }

      if (target.closest('[aria-label="Ask Vorta AI"]')) {
        schedule(() => openWorkspace(), 0);
      }
    };

    window.addEventListener("vorta-global-ai-prompt", handlePrompt);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("vorta-global-ai-prompt", handlePrompt);
      document.removeEventListener("click", handleDocumentClick, true);
      pendingTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [isPhone]);

  return (
    <style data-vorta-ask-vorta-desktop-experience="true">{`
      @media (min-width: 768px) {
        [data-vorta-global-ai-panel="true"] {
          display: flex !important;
          flex-direction: column !important;
          width: min(620px, calc(100vw - 2rem)) !important;
          height: clamp(34rem, 68dvh, 48rem) !important;
          max-height: calc(100dvh - 2rem) !important;
        }

        [data-vorta-global-ai-panel="true"] [data-vorta-global-ai-header="true"],
        [data-vorta-global-ai-panel="true"] [data-vorta-global-ai-composer="true"] {
          flex: 0 0 auto !important;
        }

        [data-vorta-global-ai-panel="true"] [data-vorta-global-ai-messages="true"] {
          min-height: 0 !important;
          max-height: none !important;
          flex: 1 1 auto !important;
        }

        [data-vorta-global-ai-minimise="true"] {
          display: none !important;
        }
      }

      @media (min-width: 768px) and (max-width: 1279px) {
        [data-vorta-global-ai-panel="true"] {
          width: min(580px, calc(100vw - 2rem)) !important;
        }
      }
    `}</style>
  );
}
