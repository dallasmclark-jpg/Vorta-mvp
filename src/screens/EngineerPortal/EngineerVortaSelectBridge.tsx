import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface SelectOptionSnapshot {
  value: string;
  label: string;
  disabled: boolean;
  group: string | null;
}

interface ActiveSelectSnapshot {
  element: HTMLSelectElement;
  label: string;
  value: string;
  options: SelectOptionSnapshot[];
}

function isMobileEngineerSelect(select: HTMLSelectElement | null): select is HTMLSelectElement {
  if (!select || select.disabled) return false;
  if (!select.closest('[data-vorta-engineer-shell="true"]')) return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

function resolveSelectLabel(select: HTMLSelectElement): string {
  const ariaLabel = select.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = select.getAttribute("aria-labelledby")?.trim();
  if (labelledBy) {
    const labelledText = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    if (labelledText) return labelledText;
  }

  const label = select.closest("label");
  if (label) {
    const clone = label.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("select, input, textarea, button, option, optgroup").forEach((node) => node.remove());
    const text = clone.textContent?.replace(/\s+/g, " ").trim();
    if (text) return text;
  }

  const name = select.getAttribute("name")?.trim();
  if (name) {
    return name
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  return "Select option";
}

function snapshotSelect(select: HTMLSelectElement): ActiveSelectSnapshot {
  return {
    element: select,
    label: resolveSelectLabel(select),
    value: select.value,
    options: Array.from(select.options)
      .filter((option) => !option.hidden)
      .map((option) => ({
        value: option.value,
        label: option.label || option.textContent || option.value,
        disabled: option.disabled,
        group:
          option.parentElement instanceof HTMLOptGroupElement
            ? option.parentElement.label || null
            : null,
      })),
  };
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (setter) setter.call(select, value);
  else select.value = value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export function EngineerVortaSelectBridge(): JSX.Element {
  const [active, setActive] = useState<ActiveSelectSnapshot | null>(null);

  useEffect(() => {
    const openFromEvent = (event: Event): void => {
      const target = event.target as Element | null;
      const select = target?.closest?.("select") as HTMLSelectElement | null;
      if (!isMobileEngineerSelect(select)) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      setActive(snapshotSelect(select));
    };

    const suppressNativeClick = (event: Event): void => {
      const target = event.target as Element | null;
      const select = target?.closest?.("select") as HTMLSelectElement | null;
      if (!isMobileEngineerSelect(select)) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    };

    document.addEventListener("pointerdown", openFromEvent, true);
    document.addEventListener("click", suppressNativeClick, true);
    return () => {
      document.removeEventListener("pointerdown", openFromEvent, true);
      document.removeEventListener("click", suppressNativeClick, true);
    };
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [active]);

  const choose = (option: SelectOptionSnapshot): void => {
    if (!active || option.disabled) return;
    const select = active.element;
    setSelectValue(select, option.value);
    setActive(null);
    window.setTimeout(() => {
      if (select.isConnected) select.focus({ preventScroll: true });
    }, 0);
  };

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          [data-vorta-engineer-shell="true"] select {
            -webkit-appearance: none !important;
            appearance: none !important;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") !important;
            background-repeat: no-repeat !important;
            background-position: right 0.8rem center !important;
            background-size: 1rem 1rem !important;
            padding-right: 2.5rem !important;
            color-scheme: dark;
          }
        }
      `}</style>

      {active && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[260] flex items-end justify-center bg-black/72 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-16 backdrop-blur-[3px]"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setActive(null);
              }}
            >
              <section
                role="listbox"
                aria-label={active.label}
                className="flex max-h-[72dvh] w-full max-w-md flex-col overflow-hidden rounded-[1.45rem] border border-slate-700/80 bg-[#07111f] shadow-[0_22px_70px_rgba(0,0,0,0.48)]"
              >
                <div className="flex items-center justify-between gap-4 border-b border-slate-800/85 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-400">
                      Vorta
                    </p>
                    <h2 className="mt-1 truncate text-sm font-semibold text-slate-100">
                      {active.label}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActive(null)}
                    aria-label="Close options"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-[#030c1d] text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="overflow-y-auto p-2.5">
                  {active.options.map((option, index) => {
                    const selected = option.value === active.value;
                    const previousGroup = index > 0 ? active.options[index - 1]?.group ?? null : null;
                    const showGroup = Boolean(option.group && option.group !== previousGroup);
                    return (
                      <div key={`${option.value}-${index}`}>
                        {showGroup ? (
                          <p className="px-3 pb-1 pt-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                            {option.group}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          disabled={option.disabled}
                          onClick={() => choose(option)}
                          className={[
                            "mb-1 flex min-h-[3.35rem] w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40",
                            selected
                              ? "border-blue-400/45 bg-blue-500/[0.10] text-blue-100"
                              : "border-transparent bg-transparent text-slate-200 hover:border-slate-700/80 hover:bg-white/[0.03]",
                          ].join(" ")}
                        >
                          <span className="min-w-0 flex-1 leading-5">{option.label}</span>
                          <span
                            aria-hidden="true"
                            className={[
                              "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                              selected
                                ? "border-blue-300 bg-blue-500/10"
                                : "border-slate-500 bg-transparent",
                            ].join(" ")}
                          >
                            {selected ? <i className="h-2.5 w-2.5 rounded-full bg-blue-300" /> : null}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
