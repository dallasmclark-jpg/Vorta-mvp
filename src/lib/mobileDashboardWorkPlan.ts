const PHONE_VIEWPORT_QUERY = "(max-width: 639px)";
const INSTALLATION_MARKER = "data-vorta-mobile-work-plan-scroll";

const normalizeButtonLabel = (button: HTMLButtonElement): string =>
  (button.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();

const getWorkPlanSummary = (
  button: HTMLButtonElement,
): HTMLElement | null => {
  const buttonRow = button.parentElement;
  const summary = buttonRow?.parentElement;

  return summary instanceof HTMLElement
    ? summary
    : null;
};

const scrollToExpandedWorkPlan = (
  summary: HTMLElement,
): void => {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const panel = summary.nextElementSibling;

      if (
        !(panel instanceof HTMLElement) ||
        !panel.matches("div.border-t.pt-4")
      ) {
        return;
      }

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      panel.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  });
};

export const installMobileDashboardWorkPlan = (): void => {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    document.documentElement.hasAttribute(INSTALLATION_MARKER)
  ) {
    return;
  }

  document.documentElement.setAttribute(
    INSTALLATION_MARKER,
    "true",
  );

  document.addEventListener("click", (event) => {
    if (!window.matchMedia(PHONE_VIEWPORT_QUERY).matches) {
      return;
    }

    const target =
      event.target instanceof Element
        ? event.target.closest("button")
        : null;

    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const isOpeningWorkPlan =
      target.getAttribute("aria-expanded") === "false" &&
      normalizeButtonLabel(target) === "View work plan";

    if (!isOpeningWorkPlan) {
      return;
    }

    const summary = getWorkPlanSummary(target);

    if (summary) {
      scrollToExpandedWorkPlan(summary);
    }
  });
};
