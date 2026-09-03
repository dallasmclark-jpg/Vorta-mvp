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
             header, composer and quick prompts already explain the experience. */
          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-messages="true"] > div:first-child {
            display: none !important;
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
