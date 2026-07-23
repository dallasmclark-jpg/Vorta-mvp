import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Circle,
  X,
} from "lucide-react";
import { useModalFocusTrap } from "../../../../hooks/useModalFocusTrap";

type RiskScopeOption = {
  value: string;
  label: string;
  score: number | null;
  scoreLabel: string;
};

const parseRiskScopeOption = (
  option: HTMLOptionElement,
): RiskScopeOption => {
  const rawLabel = option.textContent?.trim() ?? "";
  const separatorIndex = rawLabel.lastIndexOf("·");
  const label =
    separatorIndex >= 0
      ? rawLabel.slice(0, separatorIndex).trim()
      : rawLabel;
  const scoreLabel =
    separatorIndex >= 0
      ? rawLabel.slice(separatorIndex + 1).trim()
      : "";
  const parsedScore = Number.parseFloat(scoreLabel);

  return {
    value: option.value,
    label,
    score: Number.isFinite(parsedScore) ? parsedScore : null,
    scoreLabel,
  };
};

const getRiskScoreClassName = (
  score: number | null,
): string => {
  if (score === null) return "text-slate-400";
  if (score >= 85) return "text-red-400";
  if (score >= 65) return "text-orange-400";
  if (score >= 40) return "text-yellow-400";
  if (score >= 20) return "text-emerald-400";
  return "text-cyan-400";
};

const getRiskDotClassName = (
  score: number | null,
): string => {
  if (score === null) return "bg-slate-500";
  if (score >= 85) return "bg-red-400";
  if (score >= 65) return "bg-orange-400";
  if (score >= 40) return "bg-yellow-400";
  if (score >= 20) return "bg-emerald-400";
  return "bg-cyan-400";
};

export function MobileRiskScopeSelector(): JSX.Element | null {
  const [selectElement, setSelectElement] =
    useState<HTMLSelectElement | null>(null);
  const [hostElement, setHostElement] =
    useState<HTMLElement | null>(null);
  const [options, setOptions] =
    useState<RiskScopeOption[]>([]);
  const [selectedValue, setSelectedValue] =
    useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const dialogRef = useModalFocusTrap<HTMLDivElement>(
    isOpen,
    () => setIsOpen(false),
  );

  const refreshFromNativeSelect = useCallback(
    (element: HTMLSelectElement) => {
      setOptions(
        Array.from(element.options).map(
          parseRiskScopeOption,
        ),
      );
      setSelectedValue(element.value);
    },
    [],
  );

  useEffect(() => {
    const element = document.getElementById(
      "risk-scope-select",
    );

    if (!(element instanceof HTMLSelectElement)) {
      return undefined;
    }

    const host = element.parentElement;
    if (!host) return undefined;

    const label = host.querySelector<HTMLLabelElement>(
      'label[for="risk-scope-select"]',
    );
    const previousSelectDisplay = element.style.display;
    const previousSelectTabIndex =
      element.getAttribute("tabindex");
    const previousSelectAriaHidden =
      element.getAttribute("aria-hidden");
    const previousLabelDisplay = label?.style.display ?? "";

    element.style.display = "none";
    element.setAttribute("tabindex", "-1");
    element.setAttribute("aria-hidden", "true");
    if (label) label.style.display = "none";

    setSelectElement(element);
    setHostElement(host);
    refreshFromNativeSelect(element);

    const handleNativeChange = () => {
      refreshFromNativeSelect(element);
    };

    const observer = new MutationObserver(() => {
      refreshFromNativeSelect(element);
    });

    element.addEventListener(
      "change",
      handleNativeChange,
    );
    observer.observe(element, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      element.removeEventListener(
        "change",
        handleNativeChange,
      );
      element.style.display = previousSelectDisplay;

      if (previousSelectTabIndex === null) {
        element.removeAttribute("tabindex");
      } else {
        element.setAttribute(
          "tabindex",
          previousSelectTabIndex,
        );
      }

      if (previousSelectAriaHidden === null) {
        element.removeAttribute("aria-hidden");
      } else {
        element.setAttribute(
          "aria-hidden",
          previousSelectAriaHidden,
        );
      }

      if (label) label.style.display = previousLabelDisplay;
    };
  }, [refreshFromNativeSelect]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const mediaQuery = window.matchMedia(
      "(min-width: 640px)",
    );
    const closeOnDesktop = (
      event: MediaQueryListEvent,
    ) => {
      if (event.matches) setIsOpen(false);
    };

    mediaQuery.addEventListener(
      "change",
      closeOnDesktop,
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        closeOnDesktop,
      );
    };
  }, [isOpen]);

  const selectedOption = useMemo(
    () =>
      options.find(
        (option) => option.value === selectedValue,
      ) ?? options[0] ?? null,
    [options, selectedValue],
  );

  const handleSelect = (
    value: string,
  ): void => {
    if (!selectElement) return;

    const nativeValueSetter =
      Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )?.set;

    if (nativeValueSetter) {
      nativeValueSetter.call(
        selectElement,
        value,
      );
    } else {
      selectElement.value = value;
    }

    setSelectedValue(value);
    selectElement.dispatchEvent(
      new Event("change", {
        bubbles: true,
      }),
    );
    setIsOpen(false);
  };

  if (!hostElement || !selectedOption) {
    return null;
  }

  const trigger = createPortal(
    <div
      data-vorta-mobile-risk-scope="true"
      className="sm:hidden"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Risk scope
      </p>

      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-600/80 bg-[#0d1117] px-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-colors hover:border-slate-500 hover:bg-[#111722] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${getRiskDotClassName(
            selectedOption.score,
          )}`}
        />

        <span className="min-w-0 flex-1 truncate text-base font-semibold text-slate-100">
          {selectedOption.label}
        </span>

        <span
          className={`shrink-0 text-base font-semibold tabular-nums ${getRiskScoreClassName(
            selectedOption.score,
          )}`}
        >
          {selectedOption.scoreLabel}
        </span>

        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/[0.035] text-slate-400">
          <ChevronDown
            className="h-4 w-4"
            aria-hidden="true"
          />
        </span>
      </button>
    </div>,
    hostElement,
  );

  const dialog =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[100] sm:hidden">
            <button
              type="button"
              aria-label="Close risk scope selector"
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 h-full w-full bg-black/75 backdrop-blur-sm"
            />

            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              aria-describedby={dialogDescriptionId}
              tabIndex={-1}
              className="absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-hidden rounded-t-[1.5rem] border-t border-slate-700/80 bg-[#10151d] shadow-[0_-24px_70px_rgba(0,0,0,0.65)] animate-in slide-in-from-bottom-6 duration-200"
            >
              <div className="flex items-start gap-3 border-b border-white/[0.07] px-5 pb-4 pt-3">
                <div className="min-w-0 flex-1">
                  <div
                    aria-hidden="true"
                    className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-600"
                  />
                  <h2
                    id={dialogTitleId}
                    className="text-lg font-semibold text-slate-50"
                  >
                    Risk scope
                  </h2>
                  <p
                    id={dialogDescriptionId}
                    className="mt-1 text-sm text-slate-400"
                  >
                    Choose the site or plant area to view.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="mt-5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.04] text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                  aria-label="Close risk scope selector"
                >
                  <X
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div className="max-h-[calc(78dvh-7.25rem)] overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                {options.map((option) => {
                  const isSelected =
                    option.value === selectedOption.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      aria-pressed={isSelected}
                      className={`mb-2 flex min-h-[4rem] w-full items-center gap-3 rounded-xl border px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
                        isSelected
                          ? "border-blue-500/45 bg-blue-600/15"
                          : "border-white/[0.055] bg-[#0c1118] hover:border-slate-600 hover:bg-[#121923]"
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          isSelected
                            ? "border-blue-400 bg-blue-500 text-white"
                            : "border-slate-600 text-slate-600"
                        }`}
                      >
                        {isSelected ? (
                          <Check
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        ) : (
                          <Circle
                            className="h-2.5 w-2.5"
                            aria-hidden="true"
                          />
                        )}
                      </span>

                      <span className="min-w-0 flex-1 truncate text-base font-semibold text-slate-100">
                        {option.label}
                      </span>

                      <span
                        className={`shrink-0 text-base font-semibold tabular-nums ${getRiskScoreClassName(
                          option.score,
                        )}`}
                      >
                        {option.scoreLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {trigger}
      {dialog}
    </>
  );
}
