import { useLayoutEffect, useState } from "react";

const PRIMARY_ASK_VORTA_INPUT_SELECTOR = 'input[placeholder^="Ask Vorta"]';
const ASSISTANT_SURFACE_SELECTOR =
  '[data-vorta-global-ai-panel="true"], [data-vorta-ai-workspace="true"]';
const VISIBILITY_RATIO = 0.5;

function primaryAskVortaInputs(): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(PRIMARY_ASK_VORTA_INPUT_SELECTOR),
  ).filter((input) => !input.closest(ASSISTANT_SURFACE_SELECTOR));
}

function isMeaningfullyVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const visibleWidth = Math.max(
    0,
    Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0),
  );
  const visibleHeight = Math.max(
    0,
    Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0),
  );
  const visibleArea = visibleWidth * visibleHeight;
  const totalArea = rect.width * rect.height;

  return totalArea > 0 && visibleArea / totalArea >= VISIBILITY_RATIO;
}

/**
 * VOR-104: the floating Ask Vorta launcher complements the primary page search
 * rather than duplicating it. Assistant/workspace inputs are deliberately
 * excluded so opening Ask Vorta never changes the page-entry visibility rule.
 */
export function usePrimaryAskVortaVisibility(): boolean {
  const [isPrimaryAskVortaVisible, setIsPrimaryAskVortaVisible] =
    useState(false);

  useLayoutEffect(() => {
    let scheduledFrame: number | null = null;
    const observedInputs = new Set<HTMLInputElement>();

    const evaluateVisibility = (): void => {
      scheduledFrame = null;
      setIsPrimaryAskVortaVisible(
        primaryAskVortaInputs().some(isMeaningfullyVisible),
      );
    };

    const scheduleVisibilityCheck = (): void => {
      if (scheduledFrame !== null) return;
      scheduledFrame = window.requestAnimationFrame(evaluateVisibility);
    };

    const intersectionObserver = new IntersectionObserver(
      scheduleVisibilityCheck,
      { threshold: [0, VISIBILITY_RATIO, 1] },
    );

    const syncObservedInputs = (): void => {
      const currentInputs = new Set(primaryAskVortaInputs());

      for (const input of observedInputs) {
        if (currentInputs.has(input)) continue;
        intersectionObserver.unobserve(input);
        observedInputs.delete(input);
      }

      for (const input of currentInputs) {
        if (observedInputs.has(input)) continue;
        observedInputs.add(input);
        intersectionObserver.observe(input);
      }

      // Run synchronously so an initially visible search suppresses the launcher
      // before the browser paints the first frame.
      evaluateVisibility();
    };

    const mutationObserver = new MutationObserver(syncObservedInputs);
    syncObservedInputs();
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    window.addEventListener("resize", scheduleVisibilityCheck);

    return () => {
      if (scheduledFrame !== null) {
        window.cancelAnimationFrame(scheduledFrame);
      }
      window.removeEventListener("resize", scheduleVisibilityCheck);
      mutationObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, []);

  return isPrimaryAskVortaVisible;
}
