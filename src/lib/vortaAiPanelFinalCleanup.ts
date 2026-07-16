const FINAL_PANEL_CLEANUP_MARKER = "vortaAiPanelFinalCleanup";

function installFinalPanelStyles(): void {
  if (document.getElementById("vorta-ai-panel-final-cleanup-styles")) return;

  const style = document.createElement("style");
  style.id = "vorta-ai-panel-final-cleanup-styles";
  style.textContent = `
    [data-vorta-ai-panel="true"] [aria-hidden="true"],
    [data-vorta-ai-intro-message="true"] {
      display: none !important;
    }

    [data-vorta-ai-panel-messages="true"][data-empty="true"] {
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
      align-items: stretch !important;
    }

    [data-vorta-ai-panel-messages="true"][data-empty="false"] {
      display: flex !important;
      flex-direction: column !important;
      justify-content: flex-start !important;
    }

    [data-vorta-ai-panel-messages="true"][data-empty="true"]
      [data-vorta-ai-intro-hint="true"] {
      width: 100%;
      max-width: 410px;
      margin: auto;
      border-color: rgba(59, 130, 246, 0.24);
      background: rgba(37, 99, 235, 0.075);
      color: #a8b4c6;
      text-align: left;
    }

    [data-vorta-ai-more-suggestions="true"] {
      color: #94a3b8 !important;
      font-weight: 600 !important;
    }

    [data-vorta-ai-more-suggestions="true"]:hover {
      color: #bfdbfe !important;
    }

    [data-vorta-ai-empty-evidence="true"] {
      display: none !important;
    }
  `;

  document.head.appendChild(style);
}

function hideElement(element: HTMLElement): void {
  element.hidden = true;
  element.setAttribute("aria-hidden", "true");
  element.style.setProperty("display", "none", "important");
}

function showElement(element: HTMLElement): void {
  element.hidden = false;
  element.setAttribute("aria-hidden", "false");
  element.style.removeProperty("display");
}

function isIntroductionMessage(message: HTMLElement): boolean {
  const text = message.textContent?.replace(/\s+/g, " ").trim() ?? "";

  return (
    /\bIntroduction\b/i.test(text) ||
    /I can answer .*questions using Vorta/i.test(text) ||
    /currently available in the MVP/i.test(text)
  );
}

function simplifyRealAnswer(message: HTMLElement): void {
  const bubble = message.firstElementChild;
  const answerRoot = bubble?.firstElementChild;
  if (!(answerRoot instanceof HTMLElement)) return;

  const headings = Array.from(answerRoot.querySelectorAll<HTMLHeadingElement>("h4"));
  const actionHeading = headings.find(
    (heading) => heading.textContent?.trim().toLowerCase() === "recommended action",
  );

  if (!actionHeading) return;

  const badgeRow = answerRoot.firstElementChild;
  if (badgeRow instanceof HTMLElement) {
    const badges = Array.from(badgeRow.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );

    if (badges.length > 0) {
      badges[0].textContent = "Maintenance Manager response";
      showElement(badges[0]);
      badges.slice(1).forEach(hideElement);
    }
  }

  const evidenceHeading = headings.find(
    (heading) => heading.textContent?.trim().toLowerCase() === "evidence",
  );
  const evidenceSection = evidenceHeading?.parentElement;

  if (evidenceSection instanceof HTMLElement) {
    const evidenceItems = evidenceSection.querySelectorAll("li");
    const hasEvidence = evidenceItems.length > 0;

    evidenceSection.dataset.vortaAiEmptyEvidence = String(!hasEvidence);

    if (!hasEvidence) {
      hideElement(evidenceSection);
    } else {
      evidenceSection.style.removeProperty("display");
      evidenceSection.hidden = false;
      evidenceSection.setAttribute("aria-hidden", "false");
    }
  }
}

function cleanPanel(): void {
  const closeButton = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Close global assistant"]',
  );
  const panel = closeButton?.closest<HTMLElement>("div.fixed");
  if (!panel) return;

  const messages =
    panel.querySelector<HTMLElement>('[data-vorta-ai-panel-messages="true"]') ??
    Array.from(panel.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.className.includes("overflow-y-auto"),
    );

  if (!(messages instanceof HTMLElement)) return;

  messages.dataset.vortaAiPanelMessages = "true";

  const hint = messages.querySelector<HTMLElement>(
    '[data-vorta-ai-intro-hint="true"]',
  );

  const messageElements = Array.from(messages.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  messageElements.forEach((message) => {
    if (message.dataset.vortaAiIntroHint === "true") return;

    if (isIntroductionMessage(message)) {
      message.dataset.vortaAiIntroMessage = "true";
      hideElement(message);
      return;
    }

    const isUser = message.className.includes("justify-end");
    message.dataset.vortaAiMessage = isUser ? "user" : "assistant";

    if (!isUser) simplifyRealAnswer(message);
  });

  const conversation = Array.from(messages.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.dataset.vortaAiIntroHint !== "true" &&
      child.dataset.vortaAiIntroMessage !== "true" &&
      child.getAttribute("aria-hidden") !== "true",
  );

  const empty = conversation.length === 0;
  messages.dataset.empty = String(empty);

  if (hint) {
    if (empty) {
      showElement(hint);
    } else {
      hideElement(hint);
    }
  }
}

function installFinalPanelCleanup(): void {
  const root = document.documentElement;
  if (root.dataset[FINAL_PANEL_CLEANUP_MARKER] === "true") return;
  root.dataset[FINAL_PANEL_CLEANUP_MARKER] = "true";

  installFinalPanelStyles();

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;

    window.requestAnimationFrame(() => {
      scheduled = false;
      cleanPanel();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  schedule();
}

installFinalPanelCleanup();
