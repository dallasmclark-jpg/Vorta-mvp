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

const simplifyMobileWorkPlanCard = (
  card: HTMLElement,
): void => {
  card.style.alignItems = "flex-start";
  card.style.gap = "0.625rem";
  card.style.gridTemplateColumns = "minmax(0, 1fr) auto";
  card.style.padding = "0.75rem";

  card
    .querySelectorAll<HTMLElement>(
      ":scope > span:first-child, :scope > div.min-w-0 > div:nth-child(2), :scope > div:last-child > p:first-child, :scope > div:last-child > p:last-child",
    )
    .forEach((element) => {
      element.hidden = true;
    });

  const title = card.querySelector<HTMLElement>(
    ":scope > div.min-w-0 > div:first-child > p",
  );

  if (title) {
    title.style.display = "-webkit-box";
    title.style.overflow = "hidden";
    title.style.lineHeight = "1.2rem";
    title.style.setProperty("-webkit-box-orient", "vertical");
    title.style.setProperty("-webkit-line-clamp", "2");
  }
};

const prepareMobileWorkPlan = (
  panel: HTMLElement,
): void => {
  panel.style.scrollMarginTop = "5.5rem";

  const content = panel.querySelector<HTMLElement>(
    ":scope > div.flex.flex-col.gap-5",
  );
  const queueSection = content?.children.item(2);

  if (!(queueSection instanceof HTMLElement)) {
    return;
  }

  const queueHeading = queueSection.firstElementChild;

  if (queueHeading instanceof HTMLElement) {
    queueHeading.hidden = true;
  }

  queueSection
    .querySelectorAll<HTMLElement>(
      ":scope > div.flex.flex-col.gap-2 > button",
    )
    .forEach(simplifyMobileWorkPlanCard);
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

      prepareMobileWorkPlan(panel);

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

  document.addEventListener(
    "click",
    (event) => {
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
    },
    { capture: true },
  );
};
