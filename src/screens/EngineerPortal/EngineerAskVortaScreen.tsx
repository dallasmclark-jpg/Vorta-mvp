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
            top: 4rem !important;
            bottom: calc(4.5rem + env(safe-area-inset-bottom)) !important;
            height: auto !important;
            background: #000814 !important;
          }

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-messages="true"],
          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-composer="true"] {
            background: #000814 !important;
          }

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-header="true"],
          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-panel="true"] button[aria-label="Close global assistant"] {
            display: none !important;
          }

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-messages="true"] > div:first-child {
            display: none !important;
          }

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
            [data-vorta-global-ai-prompts="true"].hidden {
            display: none !important;
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

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-prompt-button="true"]:nth-child(3),
          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-prompt-button="true"]:nth-child(4) {
            display: block !important;
          }

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-composer="true"] {
            padding-left: 1.5rem !important;
            padding-right: 1.5rem !important;
          }

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-composer-row="true"] {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 0.25rem !important;
            min-height: 3.75rem !important;
            border: 1px solid rgb(51 65 85 / 0.95) !important;
            border-radius: 9999px !important;
            background: rgb(10 16 27 / 0.96) !important;
            padding: 0.375rem !important;
            box-shadow: 0 8px 24px rgb(0 0 0 / 0.2) !important;
          }

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-composer-row="true"] button[aria-label="Attach equipment or fault photo"] {
            order: 0 !important;
            position: relative !important;
            display: inline-flex !important;
            width: 2.5rem !important;
            height: 2.5rem !important;
            min-height: 2.5rem !important;
            flex: 0 0 2.5rem !important;
            align-items: center !important;
            justify-content: center !important;
            border: 0 !important;
            border-radius: 9999px !important;
            background: transparent !important;
            padding: 0 !important;
            color: #e2e8f0 !important;
          }

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-composer-row="true"] button[aria-label="Attach equipment or fault photo"] svg {
            display: none !important;
          }

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-composer-row="true"] button[aria-label="Attach equipment or fault photo"]::before {
            content: "+";
            display: block;
            font-size: 1.8rem;
            font-weight: 300;
            line-height: 1;
            transform: translateY(-1px);
          }

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-input="true"] {
            order: 1 !important;
            min-width: 0 !important;
            height: 2.5rem !important;
            flex: 1 1 auto !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            padding-left: 0.35rem !important;
            padding-right: 0.35rem !important;
            box-shadow: none !important;
            outline: none !important;
          }

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-composer-row="true"] button[aria-label="Start voice dictation"],
          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-composer-row="true"] button[aria-label="Stop voice dictation"] {
            order: 2 !important;
            width: 2.5rem !important;
            height: 2.5rem !important;
            min-height: 2.5rem !important;
            flex: 0 0 2.5rem !important;
            border: 0 !important;
            border-radius: 9999px !important;
            background: transparent !important;
            padding: 0 !important;
          }

          [data-vorta-engineer-shell="true"]:has([data-vorta-engineer-ask-vorta-page="true"])
            [data-vorta-global-ai-send="true"] {
            order: 3 !important;
            width: 2.5rem !important;
            height: 2.5rem !important;
            min-height: 2.5rem !important;
            flex: 0 0 2.5rem !important;
            border-radius: 9999px !important;
            background: #2563eb !important;
            padding: 0 !important;
            box-shadow: 0 7px 18px rgb(37 99 235 / 0.3) !important;
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
