const PANEL_INSTALL_MARKER = "vortaAiPanelEnhancement";

function installPanelStyles(): void {
  if (document.getElementById("vorta-ai-panel-enhancement-styles")) return;

  const style = document.createElement("style");
  style.id = "vorta-ai-panel-enhancement-styles";
  style.textContent = `
    [data-vorta-ai-panel="true"] {
      top: 1rem !important;
      right: 1rem !important;
      bottom: 1rem !important;
      width: min(520px, calc(100vw - 2rem)) !important;
      height: auto !important;
      max-height: none !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      border-radius: 1rem !important;
    }

    [data-vorta-ai-panel-header="true"],
    [data-vorta-ai-panel-context="true"],
    [data-vorta-ai-panel-footer="true"] {
      flex: 0 0 auto !important;
    }

    [data-vorta-ai-panel-header="true"] {
      min-height: 60px;
      padding: 0.75rem 1rem !important;
    }

    [data-vorta-ai-panel-context="true"] {
      padding: 0.75rem 1rem !important;
    }

    [data-vorta-ai-panel-messages="true"] {
      flex: 1 1 auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow-y: auto !important;
      padding: 1rem !important;
      scroll-behavior: smooth;
    }

    [data-vorta-ai-panel-footer="true"] {
      position: relative !important;
      z-index: 2;
      padding: 0.875rem 1rem !important;
      background: #10141d !important;
      box-shadow: 0 -12px 28px rgba(3, 7, 18, 0.2);
    }

    [data-vorta-ai-message="assistant"] > div {
      width: 100% !important;
      max-width: 100% !important;
      padding: 0.875rem !important;
    }

    [data-vorta-ai-message="user"] > div {
      max-width: 86% !important;
    }

    [data-vorta-ai-answer-root="true"] {
      gap: 0.75rem !important;
    }

    [data-vorta-ai-answer-label="true"] {
      display: block;
      margin-bottom: 0.3rem;
      color: #64748b;
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      line-height: 1rem;
      text-transform: uppercase;
    }

    [data-vorta-ai-direct-answer="true"] {
      color: #e2e8f0 !important;
      font-size: 0.8125rem !important;
      line-height: 1.35rem !important;
    }

    [data-vorta-ai-details-toggle="true"] {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      gap: 0.35rem;
      border: 1px solid rgba(71, 85, 105, 0.72);
      border-radius: 0.5rem;
      background: rgba(15, 18, 24, 0.82);
      padding: 0.4rem 0.65rem;
      color: #94a3b8;
      font-size: 0.6875rem;
      font-weight: 600;
      transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
    }

    [data-vorta-ai-details-toggle="true"]:hover {
      border-color: rgba(59, 130, 246, 0.48);
      background: rgba(37, 99, 235, 0.08);
      color: #bfdbfe;
    }

    [data-vorta-ai-detail="true"][hidden] {
      display: none !important;
    }

    [data-vorta-ai-intro-hint="true"] {
      border: 1px solid rgba(59, 130, 246, 0.18);
      border-radius: 0.75rem;
      background: rgba(37, 99, 235, 0.06);
      padding: 0.75rem 0.875rem;
      color: #94a3b8;
      font-size: 0.75rem;
      line-height: 1.25rem;
    }

    [data-vorta-ai-more-suggestions="true"] {
      border: 0;
      background: transparent;
      padding: 0.25rem 0.1rem;
      color: #64748b;
      font-size: 0.625rem;
      font-weight: 600;
      transition: color 160ms ease;
    }

    [data-vorta-ai-more-suggestions="true"]:hover {
      color: #93c5fd;
    }

    @media (max-width: 900px) {
      [data-vorta-ai-panel="true"] {
        width: min(480px, calc(100vw - 1.5rem)) !important;
        top: 0.75rem !important;
        right: 0.75rem !important;
        bottom: 0.75rem !important;
      }
    }

    @media (max-width: 640px) {
      [data-vorta-ai-panel="true"] {
        inset: 0 !important;
        width: 100vw !important;
        height: 100dvh !important;
        border-radius: 0 !important;
      }
    }
  `;

  document.head.appendChild(style);
}

function setElementHidden(element: HTMLElement, hidden: boolean): void {
  element.hidden = hidden;
  element.setAttribute("aria-hidden", String(hidden));
}

function enhanceSuggestions(contextSection: HTMLElement, panel: HTMLElement): void {
  const questionsContainer = contextSection.firstElementChild;
  if (!(questionsContainer instanceof HTMLElement)) return;

  const questionButtons = Array.from(
    questionsContainer.querySelectorAll<HTMLButtonElement>(":scope > button"),
  ).filter((button) => button.dataset.vortaAiMoreSuggestions !== "true");

  if (questionButtons.length < 3) return;

  const shortLabels = [
    "Review first today",
    "Highest site risk",
    "Most critical equipment",
  ];

  questionButtons.slice(0, 3).forEach((button, index) => {
    button.textContent = shortLabels[index];
  });

  const expanded = panel.dataset.suggestionsExpanded === "true";

  questionButtons.slice(3).forEach((button) => {
    setElementHidden(button, !expanded);
  });

  let moreButton = questionsContainer.querySelector<HTMLButtonElement>(
    '[data-vorta-ai-more-suggestions="true"]',
  );

  if (!moreButton && questionButtons.length > 3) {
    moreButton = document.createElement("button");
    moreButton.type = "button";
    moreButton.dataset.vortaAiMoreSuggestions = "true";
    moreButton.addEventListener("click", () => {
      panel.dataset.suggestionsExpanded = String(
        panel.dataset.suggestionsExpanded !== "true",
      );
      enhanceSuggestions(contextSection, panel);
    });
    questionsContainer.appendChild(moreButton);
  }

  if (moreButton) {
    moreButton.textContent = expanded ? "Fewer suggestions" : "More suggestions";
  }

  const liveRegion = contextSection.querySelector<HTMLElement>(
    '[aria-live="polite"]',
  );

  if (
    liveRegion &&
    /Using site risk|Using equipment risk|Shift skills context loaded/i.test(
      liveRegion.textContent ?? "",
    )
  ) {
    liveRegion.textContent = "Verified site, equipment and source context.";
  }
}

function simplifyBadges(answerRoot: HTMLElement): void {
  const badgeRow = answerRoot.firstElementChild;
  if (!(badgeRow instanceof HTMLElement)) return;

  const badges = Array.from(badgeRow.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  if (badges.length < 2) return;

  const roleLabel = badges[1].textContent?.trim() || "Vorta AI";
  badges[0].textContent = `${roleLabel} response`;
  badges.slice(1).forEach((badge) => setElementHidden(badge, true));
}

function updateAnswerDetails(answerRoot: HTMLElement): void {
  const expanded = answerRoot.dataset.detailsExpanded === "true";

  answerRoot
    .querySelectorAll<HTMLElement>('[data-vorta-ai-detail="true"]')
    .forEach((element) => setElementHidden(element, !expanded));

  const toggle = answerRoot.querySelector<HTMLButtonElement>(
    '[data-vorta-ai-details-toggle="true"]',
  );

  if (toggle) {
    toggle.textContent = expanded
      ? "Hide evidence and sources ︿"
      : "Evidence and sources ﹀";
    toggle.setAttribute("aria-expanded", String(expanded));
  }
}

function enhanceAnswer(message: HTMLElement): void {
  const bubble = message.firstElementChild;
  if (!(bubble instanceof HTMLElement)) return;

  const answerRoot = bubble.firstElementChild;
  if (!(answerRoot instanceof HTMLElement)) return;

  const headings = Array.from(answerRoot.querySelectorAll<HTMLHeadingElement>("h4"));
  const evidenceHeading = headings.find(
    (heading) => heading.textContent?.trim().toLowerCase() === "evidence",
  );
  const actionHeading = headings.find(
    (heading) => heading.textContent?.trim().toLowerCase() === "recommended action",
  );

  if (!evidenceHeading || !actionHeading) return;

  answerRoot.dataset.vortaAiAnswerRoot = "true";
  simplifyBadges(answerRoot);

  const directAnswer = Array.from(answerRoot.children).find(
    (child) => child instanceof HTMLParagraphElement,
  );

  if (directAnswer instanceof HTMLParagraphElement) {
    directAnswer.dataset.vortaAiDirectAnswer = "true";

    if (
      !directAnswer.previousElementSibling?.matches(
        '[data-vorta-ai-answer-label="true"]',
      )
    ) {
      const label = document.createElement("span");
      label.dataset.vortaAiAnswerLabel = "true";
      label.textContent = "Answer";
      directAnswer.before(label);
    }
  }

  const evidenceSection = evidenceHeading.parentElement;
  const actionSection = actionHeading.parentElement;

  if (!(evidenceSection instanceof HTMLElement) || !(actionSection instanceof HTMLElement)) {
    return;
  }

  evidenceSection.dataset.vortaAiDetail = "true";

  const children = Array.from(answerRoot.children);
  const actionIndex = children.indexOf(actionSection);

  children.slice(actionIndex + 1, -1).forEach((child) => {
    if (
      child instanceof HTMLElement &&
      child.dataset.vortaAiDetailsToggle !== "true"
    ) {
      child.dataset.vortaAiDetail = "true";
    }
  });

  let toggle = answerRoot.querySelector<HTMLButtonElement>(
    '[data-vorta-ai-details-toggle="true"]',
  );

  if (!toggle) {
    toggle = document.createElement("button");
    toggle.type = "button";
    toggle.dataset.vortaAiDetailsToggle = "true";
    toggle.addEventListener("click", () => {
      answerRoot.dataset.detailsExpanded = String(
        answerRoot.dataset.detailsExpanded !== "true",
      );
      updateAnswerDetails(answerRoot);
    });
    actionSection.after(toggle);
  }

  updateAnswerDetails(answerRoot);
}

function enhanceMessages(messagesSection: HTMLElement): void {
  messagesSection.dataset.vortaAiPanelMessages = "true";

  const children = Array.from(messagesSection.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  const existingHint = messagesSection.querySelector<HTMLElement>(
    '[data-vorta-ai-intro-hint="true"]',
  );

  const introMessage = children.find((child) =>
    /Introduction|I can answer Maintenance Manager questions/i.test(
      child.textContent ?? "",
    ),
  );

  if (introMessage) {
    introMessage.dataset.vortaAiIntroMessage = "true";
    setElementHidden(introMessage, true);
  }

  let hint = existingHint;
  if (!hint) {
    hint = document.createElement("div");
    hint.dataset.vortaAiIntroHint = "true";
    hint.textContent =
      "Ask about site risk, equipment, labour, PMs, spares or supporting documents.";
    messagesSection.prepend(hint);
  }

  const conversationMessages = Array.from(messagesSection.children).filter(
    (child) =>
      child instanceof HTMLElement &&
      child.dataset.vortaAiIntroHint !== "true" &&
      child.dataset.vortaAiIntroMessage !== "true",
  );

  setElementHidden(hint, conversationMessages.length > 0);

  conversationMessages.forEach((message) => {
    const isUser = message.className.includes("justify-end");
    message.dataset.vortaAiMessage = isUser ? "user" : "assistant";

    if (!isUser) enhanceAnswer(message);
  });
}

function enhancePanel(): void {
  const closeButton = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Close global assistant"]',
  );
  if (!closeButton) return;

  const panel = closeButton.closest<HTMLElement>("div.fixed");
  if (!panel) return;

  panel.dataset.vortaAiPanel = "true";

  const panelChildren = Array.from(panel.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  const header = panelChildren[0];
  if (header) header.dataset.vortaAiPanelHeader = "true";

  const messagesSection = panelChildren.find((child) =>
    child.className.includes("overflow-y-auto"),
  );

  const footerSection = panelChildren.find((child) =>
    Boolean(
      child.querySelector(
        'input[placeholder*="Ask about"], input[placeholder*="Loading site context"], input[placeholder*="Retry site context"]',
      ),
    ),
  );

  const contextSection = panelChildren.find(
    (child) =>
      child !== header &&
      child !== messagesSection &&
      child !== footerSection &&
      Boolean(child.querySelector('[aria-live="polite"]')),
  );

  if (contextSection) {
    contextSection.dataset.vortaAiPanelContext = "true";
    enhanceSuggestions(contextSection, panel);
  }

  if (messagesSection) enhanceMessages(messagesSection);

  if (footerSection) {
    footerSection.dataset.vortaAiPanelFooter = "true";
  }
}

function installVortaAiPanelEnhancement(): void {
  const root = document.documentElement;
  if (root.dataset[PANEL_INSTALL_MARKER] === "true") return;
  root.dataset[PANEL_INSTALL_MARKER] = "true";

  installPanelStyles();

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      enhancePanel();
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

installVortaAiPanelEnhancement();
