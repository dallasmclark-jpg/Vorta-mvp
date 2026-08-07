import { useEffect } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";

const ACTIVE_TAB_STORAGE_KEY = "vorta:ask-vorta:workspace-tab:v1";
const SCROLL_STORAGE_KEY = "vorta:ask-vorta:workspace-scroll:v1";
const RETURN_ACTIVE_CONVERSATION_KEY =
  "vorta:ask-vorta:return-active-conversation:v1";
const WORKSPACE_SELECTOR = "[data-vorta-ai-workspace='true']";
const CONVERSATION_SELECTOR =
  "[data-vorta-ai-workspace-conversation='true']";
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

function removeSessionValue(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ask Vorta still works when browser storage is unavailable.
  }
}

function workspaceScrollContainer(workspace: Element): HTMLElement | null {
  return workspace.querySelector<HTMLElement>("main > div");
}

function conversationMessages(workspace: Element): HTMLElement[] {
  const conversation = workspace.querySelector<HTMLElement>(
    CONVERSATION_SELECTOR,
  );
  return conversation
    ? Array.from(
        conversation.querySelectorAll<HTMLElement>(":scope > div"),
      )
    : [];
}

function messageTop(
  scrollContainer: HTMLElement,
  message: HTMLElement,
): number {
  const scrollRect = scrollContainer.getBoundingClientRect();
  const messageRect = message.getBoundingClientRect();
  return Math.max(
    0,
    scrollContainer.scrollTop + messageRect.top - scrollRect.top - 20,
  );
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

  if (readSessionValue(RETURN_ACTIVE_CONVERSATION_KEY) === "1") {
    const activeRecent = workspace.querySelector<HTMLButtonElement>(
      'aside button[aria-current="page"]',
    );

    if (!activeRecent) {
      if (attempt < 8) {
        window.setTimeout(() => restoreWorkspaceView(attempt + 1), 50);
      }
      return;
    }

    activeRecent.click();
    removeSessionValue(RETURN_ACTIVE_CONVERSATION_KEY);
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
    let activeObserver: MutationObserver | null = null;
    let activeScrollContainer: HTMLElement | null = null;
    let activeScrollListener: (() => void) | null = null;
    let activeAnchor: HTMLElement | null = null;
    let followExpiryTimer: number | null = null;
    let settleTimer: number | null = null;
    let programmaticScrollUntil = 0;

    const schedule = (callback: () => void, delay: number): void => {
      const timer = window.setTimeout(() => {
        pendingTimers.delete(timer);
        callback();
      }, delay);
      pendingTimers.add(timer);
    };

    const clearTimer = (timer: number | null): void => {
      if (timer === null) return;
      window.clearTimeout(timer);
      pendingTimers.delete(timer);
    };

    const stopActiveMessageFollow = (): void => {
      activeObserver?.disconnect();
      activeObserver = null;
      if (activeScrollContainer && activeScrollListener) {
        activeScrollContainer.removeEventListener(
          "scroll",
          activeScrollListener,
        );
      }
      activeScrollContainer = null;
      activeScrollListener = null;
      activeAnchor = null;
      clearTimer(followExpiryTimer);
      clearTimer(settleTimer);
      followExpiryTimer = null;
      settleTimer = null;
    };

    const positionActiveMessage = (): void => {
      if (!activeScrollContainer || !activeAnchor) return;
      programmaticScrollUntil = Date.now() + 500;
      activeScrollContainer.scrollTo({
        top: messageTop(activeScrollContainer, activeAnchor),
        behavior: "smooth",
      });
    };

    const beginActiveMessageFollow = (attempt = 0): void => {
      const workspace = document.querySelector<HTMLElement>(
        WORKSPACE_SELECTOR,
      );
      const visible =
        workspace && window.getComputedStyle(workspace).display !== "none";
      const conversation = workspace?.querySelector<HTMLElement>(
        CONVERSATION_SELECTOR,
      );
      const scrollContainer = workspace
        ? workspaceScrollContainer(workspace)
        : null;

      if (!workspace || !visible || !conversation || !scrollContainer) {
        if (attempt < 12) {
          schedule(() => beginActiveMessageFollow(attempt + 1), 50);
        }
        return;
      }

      stopActiveMessageFollow();
      const baselineCount = conversationMessages(workspace).length;
      activeScrollContainer = scrollContainer;

      const userMovedAway = (): void => {
        if (
          Date.now() <= programmaticScrollUntil ||
          !activeScrollContainer ||
          !activeAnchor
        ) {
          return;
        }
        const expectedTop = messageTop(activeScrollContainer, activeAnchor);
        if (Math.abs(activeScrollContainer.scrollTop - expectedTop) > 110) {
          stopActiveMessageFollow();
        }
      };
      activeScrollListener = userMovedAway;
      scrollContainer.addEventListener("scroll", userMovedAway, {
        passive: true,
      });

      const followNewExchange = (): void => {
        if (!activeScrollContainer) return;
        const messages = conversationMessages(workspace);
        const newMessages = messages.slice(baselineCount);
        if (!activeAnchor) {
          activeAnchor =
            newMessages.find((message) =>
              message.classList.contains("justify-end"),
            ) ?? null;
        }
        if (!activeAnchor) return;

        positionActiveMessage();

        const latestAssistant = [...newMessages]
          .reverse()
          .find((message) => message.classList.contains("justify-start"));
        const responseComplete =
          Boolean(latestAssistant) &&
          !latestAssistant?.querySelector(".animate-spin");
        if (responseComplete) {
          clearTimer(settleTimer);
          settleTimer = window.setTimeout(() => {
            pendingTimers.delete(settleTimer as number);
            positionActiveMessage();
            stopActiveMessageFollow();
          }, 650);
          pendingTimers.add(settleTimer);
        }
      };

      activeObserver = new MutationObserver(followNewExchange);
      activeObserver.observe(conversation, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      followExpiryTimer = window.setTimeout(() => {
        pendingTimers.delete(followExpiryTimer as number);
        stopActiveMessageFollow();
      }, 60_000);
      pendingTimers.add(followExpiryTimer);
      followNewExchange();
    };

    const openWorkspace = (attempt = 0): void => {
      const expandButton = document.querySelector<HTMLButtonElement>(
        EXPAND_SELECTOR,
      );
      if (expandButton) {
        expandButton.click();
        schedule(() => restoreWorkspaceView(), 0);
        return;
      }

      if (attempt < 12) schedule(() => openWorkspace(attempt + 1), 50);
    };

    const handlePrompt = (): void => {
      schedule(() => openWorkspace(), 0);
      schedule(() => beginActiveMessageFollow(), 0);
    };

    const handleDocumentClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const workspace = target.closest(WORKSPACE_SELECTOR);
      if (workspace) {
        const button = target.closest("button") as HTMLButtonElement | null;
        if (button?.textContent?.trim() === "Send") {
          beginActiveMessageFollow();
        }

        if (
          target.closest('[aria-label="Return to compact Ask Vorta panel"]') ||
          target.closest("button")?.textContent?.includes(
            "Return to compact panel",
          )
        ) {
          stopActiveMessageFollow();
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
      stopActiveMessageFollow();
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
