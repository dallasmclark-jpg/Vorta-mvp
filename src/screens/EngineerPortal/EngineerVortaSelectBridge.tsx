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
    clone
      .querySelectorAll("select, input, textarea, button, option, optgroup")
      .forEach((node) => node.remove());
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
      event.stopImmediatePropagation?.();
      setActive(snapshotSelect(select));
    };

    const suppressNativeClick = (event: Event): void => {
      const target = event.target as Element | null;
      const select = target?.closest?.("select") as HTMLSelectElement | null;
      if (!isMobileEngineerSelect(select)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
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

        .vorta-select-overlay {
          position: fixed;
          inset: 0;
          z-index: 260;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 4rem 0.75rem max(0.75rem, env(safe-area-inset-bottom));
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(3px);
        }

        .vorta-select-sheet {
          display: flex;
          width: 100%;
          max-width: 28rem;
          max-height: 72dvh;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(51, 65, 85, 0.8);
          border-radius: 1.45rem;
          background: #07111f;
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.48);
        }

        .vorta-select-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.875rem 1rem;
          border-bottom: 1px solid rgba(30, 41, 59, 0.85);
        }

        .vorta-select-heading { min-width: 0; }
        .vorta-select-kicker {
          margin: 0;
          color: #60a5fa;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .vorta-select-title {
          margin: 0.25rem 0 0;
          overflow: hidden;
          color: #f1f5f9;
          font-size: 0.875rem;
          font-weight: 600;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .vorta-select-close {
          display: inline-flex;
          width: 2.5rem;
          height: 2.5rem;
          flex: 0 0 2.5rem;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(51, 65, 85, 0.8);
          border-radius: 0.75rem;
          background: #030c1d;
          color: #94a3b8;
        }
        .vorta-select-close:focus-visible,
        .vorta-select-option:focus-visible {
          outline: 2px solid #60a5fa;
          outline-offset: 2px;
        }
        .vorta-select-close svg { width: 1rem; height: 1rem; }

        .vorta-select-options {
          overflow-y: auto;
          padding: 0.625rem;
          overscroll-behavior: contain;
        }
        .vorta-select-group {
          margin: 0;
          padding: 0.75rem 0.75rem 0.25rem;
          color: #475569;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .vorta-select-option {
          display: flex;
          width: 100%;
          min-height: 3.35rem;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.25rem;
          padding: 0.625rem 0.875rem;
          border: 1px solid transparent;
          border-radius: 0.75rem;
          background: transparent;
          color: #e2e8f0;
          font: inherit;
          font-size: 0.875rem;
          font-weight: 500;
          text-align: left;
        }
        .vorta-select-option[data-selected="true"] {
          border-color: rgba(96, 165, 250, 0.45);
          background: rgba(59, 130, 246, 0.10);
          color: #dbeafe;
        }
        .vorta-select-option:disabled { opacity: 0.4; }
        .vorta-select-option-label {
          min-width: 0;
          flex: 1 1 auto;
          line-height: 1.25rem;
        }
        .vorta-select-radio {
          display: grid;
          width: 1.25rem;
          height: 1.25rem;
          flex: 0 0 1.25rem;
          place-items: center;
          border: 1px solid #64748b;
          border-radius: 9999px;
        }
        .vorta-select-option[data-selected="true"] .vorta-select-radio {
          border-color: #93c5fd;
          background: rgba(59, 130, 246, 0.10);
        }
        .vorta-select-radio-dot {
          width: 0.625rem;
          height: 0.625rem;
          border-radius: 9999px;
          background: #93c5fd;
        }
      `}</style>

      {active && typeof document !== "undefined"
        ? createPortal(
            <div
              className="vorta-select-overlay"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setActive(null);
              }}
            >
              <section
                role="listbox"
                aria-label={active.label}
                className="vorta-select-sheet"
              >
                <div className="vorta-select-header">
                  <div className="vorta-select-heading">
                    <p className="vorta-select-kicker">Vorta</p>
                    <h2 className="vorta-select-title">{active.label}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActive(null)}
                    aria-label="Close options"
                    className="vorta-select-close"
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>

                <div className="vorta-select-options">
                  {active.options.map((option, index) => {
                    const selected = option.value === active.value;
                    const previousGroup = index > 0 ? active.options[index - 1]?.group ?? null : null;
                    const showGroup = Boolean(option.group && option.group !== previousGroup);
                    return (
                      <div key={`${option.value}-${index}`}>
                        {showGroup ? (
                          <p className="vorta-select-group">{option.group}</p>
                        ) : null}
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          data-selected={selected ? "true" : "false"}
                          disabled={option.disabled}
                          onClick={() => choose(option)}
                          className="vorta-select-option"
                        >
                          <span className="vorta-select-option-label">{option.label}</span>
                          <span aria-hidden="true" className="vorta-select-radio">
                            {selected ? <i className="vorta-select-radio-dot" /> : null}
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
