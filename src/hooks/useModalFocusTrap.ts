import { useEffect, useLayoutEffect, useRef } from "react";

export const MODAL_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isFocusableElementVisible(element: HTMLElement): boolean {
  return (
    element.getAttribute("aria-hidden") !== "true" &&
    element.getAttribute("hidden") === null &&
    element.offsetParent !== null
  );
}

export function useModalFocusTrap<T extends HTMLElement>(
  active: boolean,
  onEscape?: () => void,
) {
  const containerRef = useRef<T>(null);
  const escapeHandlerRef = useRef(onEscape);

  useEffect(() => {
    escapeHandlerRef.current = onEscape;
  }, [onEscape]);

  useLayoutEffect(() => {
    if (!active) return undefined;

    const container = containerRef.current;
    if (!container) return undefined;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    container.dataset.vortaFocusTrap = "managed";
    document.body.style.overflow = "hidden";

    const focusableElements = (): HTMLElement[] =>
      Array.from(
        container.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR),
      ).filter(isFocusableElementVisible);

    const focusFrame = window.requestAnimationFrame(() => {
      const first = focusableElements()[0];
      (first ?? container).focus();
    });

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        if (escapeHandlerRef.current) {
          event.preventDefault();
          event.stopPropagation();
          escapeHandlerRef.current();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const elements = focusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown, true);
      delete container.dataset.vortaFocusTrap;
      document.body.style.overflow = previousOverflow;

      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [active]);

  return containerRef;
}
