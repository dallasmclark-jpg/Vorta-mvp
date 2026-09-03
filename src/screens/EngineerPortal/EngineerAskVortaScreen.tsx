import { useEffect } from "react";
import { Bot, Camera, Mic, Search, Sparkles } from "lucide-react";

function openEngineerAskVorta(): void {
  window.dispatchEvent(
    new CustomEvent("vorta-global-ai-prompt", {
      detail: { role: "engineer" },
    }),
  );
}

export function EngineerAskVortaScreen(): JSX.Element {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      openEngineerAskVorta();
    }, 0);

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
        }
      `}</style>
      <div
        data-vorta-engineer-ask-vorta-page="true"
        className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-2xl flex-col items-center justify-center gap-5 px-5 py-10 text-center"
      >
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/25 bg-blue-500/10 text-blue-300">
          <Sparkles className="h-7 w-7" />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-50">Ask Vorta</h1>
          <p className="text-sm leading-6 text-slate-400">Fault, evidence and safe action assistant</p>
        </div>
        <p className="max-w-md text-sm leading-6 text-slate-500">
          Use equipment history, work orders, manuals, SOPs, spares and verified Vorta evidence to diagnose maintenance problems.
        </p>
        <div className="grid w-full max-w-md grid-cols-2 gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#07172b] p-3"><Camera className="h-4 w-4 text-blue-400" />Photo evidence</div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#07172b] p-3"><Mic className="h-4 w-4 text-blue-400" />Voice input</div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#07172b] p-3"><Search className="h-4 w-4 text-blue-400" />Source search</div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#07172b] p-3"><Bot className="h-4 w-4 text-blue-400" />Engineer context</div>
        </div>
        <button
          type="button"
          onClick={openEngineerAskVorta}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          <Sparkles className="h-4 w-4" />
          Open Ask Vorta
        </button>
      </div>
    </>
  );
}
