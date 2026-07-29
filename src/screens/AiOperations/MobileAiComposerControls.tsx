import { Mic, MicOff, Plus } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

type ComposerKind = "general" | "fault";

interface ComposerTarget {
  kind: ComposerKind;
  row: HTMLElement;
  input: HTMLInputElement;
}

interface SpeechAlternative {
  transcript: string;
}

interface SpeechResult {
  readonly length: number;
  readonly [index: number]: SpeechAlternative;
}

interface SpeechResultList {
  readonly length: number;
  readonly [index: number]: SpeechResult;
}

interface SpeechResultEvent {
  results: SpeechResultList;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const GENERAL_PANEL_SELECTOR = '[data-vorta-global-ai-panel="true"]';
const FAULT_FORM_SELECTOR = '[data-vorta-fault-panel="true"] form';

function isVisible(element: HTMLElement | null): element is HTMLElement {
  return Boolean(element?.isConnected && element.getClientRects().length > 0);
}

function findComposerTarget(): ComposerTarget | null {
  const faultForm = document.querySelector<HTMLElement>(FAULT_FORM_SELECTOR);
  const faultInput = faultForm?.querySelector<HTMLInputElement>('input[type="text"], input:not([type])') ?? null;

  if (isVisible(faultForm) && faultInput) {
    return { kind: "fault", row: faultForm, input: faultInput };
  }

  const generalPanel = document.querySelector<HTMLElement>(GENERAL_PANEL_SELECTOR);
  const generalFooter = generalPanel?.querySelector<HTMLElement>(
    '[data-vorta-global-ai-composer="true"]',
  ) ?? null;
  const generalRow = generalPanel?.querySelector<HTMLElement>(
    '[data-vorta-global-ai-composer-row="true"]',
  ) ?? null;
  const generalInput = generalRow?.querySelector<HTMLInputElement>('input[type="text"], input:not([type])') ?? null;

  if (isVisible(generalRow) && generalInput) {
    return { kind: "general", row: generalRow, input: generalInput };
  }

  return null;
}

function setControlledInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export function MobileAiComposerControls(): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechPrefixRef = useRef("");
  const [target, setTarget] = useState<ComposerTarget | null>(null);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const syncTarget = (): void => {
      const next = findComposerTarget();
      setTarget((current) => {
        if (
          current?.kind === next?.kind &&
          current?.row === next?.row &&
          current?.input === next?.input
        ) {
          return current;
        }
        return next;
      });
    };

    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    window.addEventListener("resize", syncTarget);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncTarget);
    };
  }, []);

  useEffect(() => {
    if (target) return;
    setAttachmentCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [target]);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognitionApi =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-GB";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += `${event.results[index]?.[0]?.transcript ?? ""} `;
      }

      const activeInput = findComposerTarget()?.input;
      if (!activeInput) return;
      const nextValue = [speechPrefixRef.current, transcript.trim()]
        .filter(Boolean)
        .join(" ");
      setControlledInputValue(activeInput, nextValue);
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      try {
        recognition.abort();
      } catch {
        // Recognition may already be inactive.
      }
      recognitionRef.current = null;
    };
  }, []);

  const handleFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []).slice(0, 6);
    setAttachmentCount(files.length);
  };

  const toggleFaultVoice = (): void => {
    const recognition = recognitionRef.current;
    const activeTarget = findComposerTarget();
    if (!recognition || !activeTarget || !speechSupported) return;

    if (listening) {
      try {
        recognition.stop();
      } catch {
        setListening(false);
      }
      return;
    }

    speechPrefixRef.current = activeTarget.input.value.trim();
    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFiles}
      />

      <span className="sr-only" role="status" aria-live="polite">
        {attachmentCount > 0
          ? `${attachmentCount} file${attachmentCount === 1 ? "" : "s"} selected`
          : ""}
      </span>

      {target
        ? createPortal(
            <button
              type="button"
              data-vorta-ai-attach-control="true"
              data-vorta-ai-attachment-count={attachmentCount}
              aria-label="Add photos and files"
              title={
                attachmentCount > 0
                  ? `${attachmentCount} file${attachmentCount === 1 ? "" : "s"} selected`
                  : "Add photos and files"
              }
              onClick={() => fileInputRef.current?.click()}
              className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors active:bg-slate-700/70"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              {attachmentCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold leading-none text-white">
                  {attachmentCount}
                </span>
              ) : null}
            </button>,
            target.row,
          )
        : null}

      {target?.kind === "fault"
        ? createPortal(
            <button
              type="button"
              data-vorta-ai-mobile-mic="true"
              aria-label={listening ? "Stop voice dictation" : "Start voice dictation"}
              aria-pressed={listening}
              disabled={!speechSupported}
              onClick={toggleFaultVoice}
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-35 ${
                listening
                  ? "bg-red-500/12 text-red-300"
                  : "text-slate-300 active:bg-slate-700/70"
              }`}
            >
              {listening ? (
                <MicOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Mic className="h-5 w-5" aria-hidden="true" />
              )}
            </button>,
            target.row,
          )
        : null}
    </>
  );
}
