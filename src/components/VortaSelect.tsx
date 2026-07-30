import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export interface VortaSelectOption<TValue extends string | number> {
  value: TValue;
  label: string;
}

interface VortaSelectProps<TValue extends string | number> {
  label: string;
  value: TValue;
  options: readonly VortaSelectOption<TValue>[];
  onChange: (value: TValue) => void;
  disabled?: boolean;
  className?: string;
}

export function VortaSelect<TValue extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
}: VortaSelectProps<TValue>): JSX.Element {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    setActiveIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsidePress = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => {
      optionRefs.current[activeIndex]?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, open]);

  const closeAndFocusTrigger = (): void => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };

  const selectIndex = (index: number): void => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    closeAndFocusTrigger();
  };

  const moveActive = (nextIndex: number): void => {
    setActiveIndex(Math.max(0, Math.min(options.length - 1, nextIndex)));
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled || options.length === 0) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) return;

    event.preventDefault();
    if (event.key === "ArrowUp") setActiveIndex(Math.max(0, selectedIndex - 1));
    else if (event.key === "Home") setActiveIndex(0);
    else if (event.key === "End") setActiveIndex(options.length - 1);
    else setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveActive(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectIndex(index);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocusTrigger();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const selectedOption = options[selectedIndex] ?? options[0];

  return (
    <div
      ref={rootRef}
      className={`relative grid min-w-0 gap-1 ${className}`}
      data-vorta-select="true"
    >
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => {
          if (!disabled && options.length > 0) {
            setActiveIndex(selectedIndex);
            setOpen((current) => !current);
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-left text-sm font-medium text-slate-200 outline-none transition-colors hover:border-gray-600 focus-visible:border-blue-500/70 focus-visible:ring-2 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        data-vorta-select-trigger="true"
        data-value={String(value)}
      >
        <span className="min-w-0 truncate">{selectedOption?.label ?? String(value)}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`${label} options`}
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-gray-700 bg-[#141820] p-1.5 shadow-2xl shadow-black/45"
          data-vorta-select-listbox="true"
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const active = index === activeIndex;
            return (
              <button
                key={String(option.value)}
                ref={(node) => { optionRefs.current[index] = node; }}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={active ? 0 : -1}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                  selected
                    ? "border-blue-500/60 bg-[#10151d] text-blue-200"
                    : active
                      ? "border-gray-700 bg-[#1a202a] text-slate-100"
                      : "border-transparent text-slate-300 hover:bg-[#1a202a]"
                }`}
                data-value={String(option.value)}
              >
                <span className="min-w-0 break-words">{option.label}</span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
