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

  const iconStyle = { width: 16, height: 16, flex: "0 0 auto" } as const;

  return (
    <>
      {promptTarget
        ? createPortal(
            <div
              data-vorta-engineer-calendar-prompts="true"
              style={{ marginTop: 12, display: "grid", gap: 8 }}
            >
              {CALENDAR_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void runCalendarQuestion(prompt)}
                  style={{
                    minHeight: 44,
                    borderRadius: 12,
                    border: "1px solid #334155",
                    background: "#0f172a",
                    padding: "8px 12px",
                    color: "#cbd5e1",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: 500,
                    lineHeight: 1.5,
                    cursor: "pointer",
                  }}
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
            <div
              data-vorta-engineer-calendar-answer="true"
              style={{ display: "grid", gap: 12, padding: "0 16px 20px" }}
            >
              {question ? (
                <div
                  style={{
                    marginLeft: "auto",
                    maxWidth: "88%",
                    borderRadius: 16,
                    border: "1px solid #3b82f6",
                    background: "#172554",
                    padding: 12,
                    color: "#f1f5f9",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {question}
                </div>
              ) : null}

              <div
                style={{
                  maxWidth: "94%",
                  borderRadius: 16,
                  border: "1px solid #1e293b",
                  background: "#0f172a",
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#60a5fa",
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {loading ? <Loader2 style={iconStyle} /> : <Sparkles style={iconStyle} />}
                  Ask Vorta · My profile
                </div>
                {loading ? (
                  <p style={{ marginTop: 8, color: "#94a3b8", fontSize: 14 }}>
                    Reading your calendar activity…
                  </p>
                ) : error ? (
                  <p style={{ marginTop: 8, color: "#fca5a5", fontSize: 14, lineHeight: 1.5 }}>
                    {error}
                  </p>
                ) : (
                  <p
                    style={{
                      marginTop: 8,
                      whiteSpace: "pre-line",
                      color: "#e2e8f0",
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    {answer}
                  </p>
                )}
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#475569",
                    fontSize: 12,
                  }}
                >
                  <CalendarDays style={iconStyle} />
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
