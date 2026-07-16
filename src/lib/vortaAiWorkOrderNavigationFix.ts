const WORK_ORDER_DETAIL_EVENT = "vorta-work-order-detail";
const LINK_SELECTOR = '[data-vorta-work-order-overlay-link="true"]';

function getWorkOrderNumber(anchor: HTMLAnchorElement): string | null {
  const firstLabel = anchor.querySelector("span")?.textContent?.trim() ?? "";
  if (/\b(?:WO-\d+|\d{8,14})\b/i.test(firstLabel)) return firstLabel;

  return anchor.textContent?.match(/\b(?:WO-\d+|\d{8,14})\b/i)?.[0] ?? null;
}

function getEquipmentId(anchor: HTMLAnchorElement): string | null {
  const stored = anchor.dataset.vortaEquipmentId?.trim();
  if (stored) return stored;

  const originalHref =
    anchor.dataset.vortaOriginalHref?.trim() || anchor.getAttribute("href") || "";
  if (!originalHref) return null;

  const url = new URL(originalHref, window.location.origin);
  const routeMatch = url.pathname.match(
    /^\/equipment\/([^/]+)\/(?:history|work-orders)\/?$/,
  );
  if (!routeMatch) return null;

  try {
    return decodeURIComponent(routeMatch[1]);
  } catch {
    return routeMatch[1];
  }
}

function prepareWorkOrderLink(anchor: HTMLAnchorElement): void {
  if (!anchor.closest('[data-vorta-fault-panel="true"]')) return;

  const workOrderNumber = getWorkOrderNumber(anchor);
  const equipmentId = getEquipmentId(anchor);
  if (!workOrderNumber || !equipmentId) return;

  if (!anchor.dataset.vortaOriginalHref) {
    anchor.dataset.vortaOriginalHref = anchor.getAttribute("href") ?? "";
  }

  anchor.dataset.vortaWorkOrderOverlayLink = "true";
  anchor.dataset.vortaEquipmentId = equipmentId;
  anchor.dataset.vortaWorkOrderNumber = workOrderNumber;
  anchor.removeAttribute("href");
  anchor.setAttribute("role", "button");
  anchor.setAttribute("tabindex", "0");
  anchor.setAttribute("aria-label", `Open ${workOrderNumber} information`);
}

function prepareLinks(root: ParentNode = document): void {
  root
    .querySelectorAll<HTMLAnchorElement>(
      '[data-vorta-fault-panel="true"] a, a[data-vorta-work-order-overlay-link="true"]',
    )
    .forEach(prepareWorkOrderLink);
}

function openWorkOrderOverlay(anchor: HTMLAnchorElement, event: Event): void {
  const equipmentId = anchor.dataset.vortaEquipmentId?.trim();
  const workOrderNumber = anchor.dataset.vortaWorkOrderNumber?.trim();
  if (!equipmentId || !workOrderNumber) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  anchor
    .closest('[data-vorta-fault-panel="true"]')
    ?.querySelector<HTMLButtonElement>('button[data-vorta-fault-close="true"]')
    ?.click();

  window.queueMicrotask(() => {
    const locationAfterClick = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (locationAfterClick !== currentLocation) {
      window.history.replaceState(window.history.state, "", currentLocation);
      window.dispatchEvent(
        new PopStateEvent("popstate", { state: window.history.state }),
      );
    }

    window.dispatchEvent(
      new CustomEvent(WORK_ORDER_DETAIL_EVENT, {
        detail: {
          equipmentId,
          workOrderNumber,
        },
      }),
    );
  });
}

prepareLinks();

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node instanceof Element) prepareLinks(node);
    });
  });
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

document.addEventListener(
  "pointerdown",
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest<HTMLAnchorElement>(
      '[data-vorta-fault-panel="true"] a',
    );
    if (anchor) prepareWorkOrderLink(anchor);
  },
  true,
);

document.addEventListener(
  "click",
  (event) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest<HTMLAnchorElement>(LINK_SELECTOR);
    if (!anchor) return;

    openWorkOrderOverlay(anchor, event);
  },
  true,
);

document.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest<HTMLAnchorElement>(LINK_SELECTOR);
    if (!anchor) return;

    openWorkOrderOverlay(anchor, event);
  },
  true,
);
