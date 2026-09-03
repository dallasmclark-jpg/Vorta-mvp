import { useEffect } from "react";

function openEngineerAskVorta(): void {
  window.dispatchEvent(
    new CustomEvent("vorta-global-ai-prompt", {
      detail: { role: "engineer" },
    }),
  );
}

export function EngineerAskVortaScreen(): JSX.Element {
  useEffect(() => {
    const timer = window.setTimeout(openEngineerAskVorta, 0);

    return () => {
      window.clearTimeout(timer);
      const closeButton = document.querySelector<HTMLButtonElement>(
        '[data-vorta-global-ai-panel="true"] button[aria-label="Close global assistant"]',
      );
      closeButton?.click();
    };
  }, []);

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-panel="true"] {
            bottom: calc(4.5rem + env(safe-area-inset-bottom)) !important;
            height: calc(100dvh - 4.5rem - env(safe-area-inset-bottom)) !important;
          }

          /* Ask Vorta is the page in the Engineer portal, so there is no second
             close/launch step. Leaving via the bottom navigation closes it. */
          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-panel="true"] button[aria-label="Close global assistant"] {
            display: none !important;
          }

          /* Remove the verbose introduction decision card. The role-specific
             header and composer already explain the experience. */
          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-messages="true"] > div:first-child {
            display: none !important;
          }

          /* When the conversation is empty, put the two useful starter actions
             in the open centre of the workspace instead of stacking them below
             the composer. They disappear automatically once a conversation starts. */
          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-prompts="true"] {
            position: absolute !important;
            top: 50% !important;
            left: 1.5rem !important;
            right: 1.5rem !important;
            z-index: 2 !important;
            transform: translateY(-50%) !important;
            border-bottom: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-prompts="true"] > div:first-child {
            margin: 0 !important;
            gap: 0.75rem !important;
          }

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-prompt-button="true"] {
            min-height: 3rem !important;
            width: 100% !important;
            border-color: rgb(51 65 85 / 0.9) !important;
            background: rgb(15 23 42 / 0.42) !important;
            font-size: 0.875rem !important;
          }
        }
      `}</style>
      <div
        data-vorta-engineer-ask-vorta-page="true"
        className="min-h-[calc(100dvh-8rem)] w-full"
        aria-hidden="true"
      />
    </>
  );
}
