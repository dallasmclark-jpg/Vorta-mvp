import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Loader2, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { askMyEngineerCalendar } from "./engineerCalendarService";

const CALENDAR_PROMPTS = [
  "What training have I got planned this year?",
  "How many overtime shifts have I done this year?",
];

function isCalendarQuestion(value: string): boolean {
  const question = value.trim().toLowerCase();
  return ["training", "overtime", "development", "calendar", "shift cover"].some((term) =>
    question.includes(term),
  );
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export function EngineerCalendarAiBridge(): JSX.Element | null {
  const { pathname } = useLocation();
  const { siteContext } = useAuth();
  const siteId = siteContext?.siteId ?? null;
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [promptTarget, setPromptTarget] = useState<HTMLElement | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCalendarQuestion = useCallback(
    async (value: string): Promise<void> => {
      const cleanQuestion = value.trim();
      if (!siteId || !cleanQuestion || !isCalendarQuestion(cleanQuestion)) return;
      setQuestion(cleanQuestion);
      setAnswer("");
      setError(null);
      setLoading(true);
      try {
        const result = await askMyEngineerCalendar(siteId, cleanQuestion);
        setAnswer(result.answer);
      } catch (calendarError) {
        setError(
          calendarError instanceof Error
            ? calendarError.message
            : "Vorta could not read your personal calendar activity.",
        );
      } finally {
        setLoading(false);
      }
    },
    [siteId],
  );

  useEffect(() => {
    if (pathname !== "/engineer/vorta") {
      setTarget(null);
      setPromptTarget(null);
      setQuestion("");
      setAnswer("");
      setError(null);
      return undefined;
    }

    const syncTargets = (): void => {
      setTarget(
        document.querySelector<HTMLElement>('[data-vorta-global-ai-messages="true"]'),
      );
      setPromptTarget(
        document.querySelector<HTMLElement>('[data-vorta-global-ai-prompts="true"]'),
      );
    };
    syncTargets();
    const observer = new MutationObserver(syncTargets);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/engineer/vorta") return undefined;

    const handleCalendarEvent = (event: Event): void => {
      const detail = (event as CustomEvent<{ question?: string }>).detail;
      const nextQuestion = String(detail?.question ?? "").trim();
      if (nextQuestion && isCalendarQuestion(nextQuestion)) {
        void runCalendarQuestion(nextQuestion);
      }
    };

    const handleClick = (event: MouseEvent): void => {
      const element = event.target as Element | null;
      const sendButton = element?.closest<HTMLButtonElement>(
        '[data-vorta-global-ai-send="true"]',
      );
      if (!sendButton) return;
      const input = document.querySelector<HTMLInputElement>(
        '[data-vorta-global-ai-input="true"]',
      );
      const nextQuestion = input?.value.trim() ?? "";
      if (!input || !isCalendarQuestion(nextQuestion)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setInputValue(input, "");
      void runCalendarQuestion(nextQuestion);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Enter" || event.shiftKey) return;
      const input = event.target as HTMLInputElement | null;
      if (!input?.matches('[data-vorta-global-ai-input="true"]')) return;
      const nextQuestion = input.value.trim();
      if (!isCalendarQuestion(nextQuestion)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setInputValue(input, "");
      void runCalendarQuestion(nextQuestion);
    };

    window.addEventListener("vorta-engineer-calendar-question", handleCalendarEvent as EventListener);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("vorta-engineer-calendar-question", handleCalendarEvent as EventListener);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [pathname, runCalendarQuestion]);

  useEffect(() => {
    if (!target || (!question && !loading)) return;
    window.setTimeout(() => {
      target.scrollTo({ top: target.scrollHeight, behavior: "smooth" });
    }, 0);
  }, [answer, error, loading, question, target]);

  if (pathname !== "/engineer/vorta") return null;

  return (
    <>
      {promptTarget
        ? createPortal(
            <div
              data-vorta-engineer-calendar-prompts="true"
              className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {CALENDAR_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void runCalendarQuestion(prompt)}
                  className="min-h-11 rounded-xl border border-blue-500/25 bg-blue-500/[0.07] px-3 text-left text-xs font-medium leading-5 text-slate-300 transition-colors hover:border-blue-400/45 hover:bg-blue-500/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {prompt}
                </button>
              ))}
            </div>,
            promptTarget,
          )
        : null}

      {target && (question || loading)
        ? createPortal(
            <div data-vorta-engineer-calendar-answer="true" className="space-y-3 px-4 pb-5 sm:px-5">
              {question ? (
                <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md border border-blue-500/25 bg-blue-600/15 px-3.5 py-3 text-sm leading-6 text-slate-100">
                  {question}
                </div>
              ) : null}

              <div className="max-w-[94%] rounded-2xl rounded-bl-md border border-slate-800/80 bg-[#07172b] px-3.5 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-400">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Ask Vorta · My profile
                </div>
                {loading ? (
                  <p className="mt-2 text-sm text-slate-400">Reading your calendar activity…</p>
                ) : error ? (
                  <p className="mt-2 text-sm leading-6 text-red-300">{error}</p>
                ) : (
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-200">{answer}</p>
                )}
                <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-600">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Personal engineer data only
                </div>
              </div>
            </div>,
            target,
          )
        : null}
    </>
  );
}
