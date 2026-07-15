function isControlledEquipmentDocumentUrl(value: string): boolean {
  try {
    const url = new URL(value, window.location.href);
    return (
      url.origin === window.location.origin &&
      /^\/equipment\/[^/]+\/documents\/[^/?#]+/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function normaliseControlledDocumentLinks(root: ParentNode = document): void {
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    if (!isControlledEquipmentDocumentUrl(anchor.href)) return;
    anchor.target = '_self';
    anchor.removeAttribute('rel');
  });
}

function navigateInsideVorta(value: string): void {
  const url = new URL(value, window.location.href);
  const nextLocation = `${url.pathname}${url.search}${url.hash}`;
  const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextLocation === currentLocation) return;

  window.history.pushState(window.history.state, '', nextLocation);
  window.dispatchEvent(
    new PopStateEvent('popstate', {
      state: window.history.state,
    }),
  );
}

normaliseControlledDocumentLinks();

document.addEventListener(
  'click',
  (event) => {
    if (
      event.defaultPrevented ||
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
    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor || !isControlledEquipmentDocumentUrl(anchor.href)) return;

    event.preventDefault();
    navigateInsideVorta(anchor.href);
  },
  true,
);

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node instanceof Element) normaliseControlledDocumentLinks(node);
    });
  });
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});
