import { Check, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export interface VortaMultiSelectOption<TValue extends string> {
  value: TValue;
  label: string;
  dotClassName?: string;
  textClassName?: string;
}

interface VortaMultiSelectProps<TValue extends string> {
  label: string;
  values: readonly TValue[];
  options: readonly VortaMultiSelectOption<TValue>[];
  allLabel: string;
  onChange: (values: TValue[]) => void;
  disabled?: boolean;
  className?: string;
}

type MenuPlacement = "top" | "bottom";
type MenuPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: MenuPlacement;
  compact: boolean;
};

function selectedSummary<TValue extends string>(
  values: readonly TValue[],
  options: readonly VortaMultiSelectOption<TValue>[],
  allLabel: string,
): string {
  if (values.length === 0) return allLabel;
  const labels = values
    .map((value) => options.find((option) => option.value === value)?.label)
    .filter((value): value is string => Boolean(value));
  if (labels.length === 0) return allLabel;
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} + ${labels[1]}`;
  return `${labels.length} teams selected`;
}

export function VortaMultiSelect<TValue extends string>({
  label,
  values,
  options,
  allLabel,
  onChange,
  disabled = false,
  className = "",
}: VortaMultiSelectProps<TValue>): JSX.Element {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const menuReady = menuPosition !== null;
  const selectedSet = useMemo(() => new Set(values), [values]);
  const summary = selectedSummary(values, options, allLabel);
  const selectedOptions = options.filter((option) => selectedSet.has(option.value));
  const optionCount = options.length + 1;

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  useEffect(() => {
    if (typeof document === "undefined" || !open) return undefined;
    document.documentElement.dataset.vortaSelectOpen = "true";
    return () => {
      delete document.documentElement.dataset.vortaSelectOpen;
    };
  }, [open]);

  const updateMenuPosition = useCallback((): void => {
    if (typeof window === "undefined") return;
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportLeft = visualViewport?.offsetLeft ?? 0;
    const viewportWidth = visualViewport?.width ?? window.innerWidth;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const compact = window.matchMedia("(max-width: 639px)").matches;
    const margin = 12;
    const gap = 8;
    const optionHeight = compact ? 44 : 48;
    const desiredHeight = Math.min(optionCount * optionHeight + 12, compact ? 300 : 360);
    const spaceBelow = Math.max(0, viewportBottom - rect.bottom - gap - margin);
    const spaceAbove = Math.max(0, rect.top - viewportTop - gap - margin);
    const placement: MenuPlacement =
      spaceBelow >= Math.min(desiredHeight, 176) || spaceBelow >= spaceAbove
        ? "bottom"
        : "top";
    const availableHeight = Math.max(
      96,
      Math.min(
        placement === "bottom" ? spaceBelow : spaceAbove,
        viewportHeight - margin * 2,
      ),
    );
    const maxHeight = Math.min(desiredHeight, availableHeight);
    const availableWidth = Math.max(0, viewportWidth - margin * 2);
    const width = Math.min(Math.max(rect.width, compact ? rect.width : 280), availableWidth);
    const left = Math.min(
      Math.max(rect.left, viewportLeft + margin),
      viewportLeft + viewportWidth - margin - width,
    );
    const top = placement === "bottom"
      ? Math.min(rect.bottom + gap, viewportBottom - margin - maxHeight)
      : Math.max(viewportTop + margin, rect.top - gap - maxHeight);

    setMenuPosition({ left, top, width, maxHeight, placement, compact });
  }, [optionCount]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return undefined;
    }

    updateMenuPosition();
    const visualViewport = window.visualViewport;
    const handleWindowScroll = (event: Event): void => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      updateMenuPosition();
    };
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", handleWindowScroll, true);
    visualViewport?.addEventListener("resize", updateMenuPosition);
    visualViewport?.addEventListener("scroll", updateMenuPosition);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", handleWindowScroll, true);
      visualViewport?.removeEventListener("resize", updateMenuPosition);
      visualViewport?.removeEventListener("scroll", updateMenuPosition);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePress = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  useEffect(() => {
    if (!open || !menuReady) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const option = optionRefs.current[activeIndex];
      const menu = menuRef.current;
      if (!option || !menu) return;
      const optionTop = option.offsetTop;
      const optionBottom = optionTop + option.offsetHeight;
      if (optionTop < menu.scrollTop) menu.scrollTop = Math.max(0, optionTop - 4);
      else if (optionBottom > menu.scrollTop + menu.clientHeight) {
        menu.scrollTop = optionBottom - menu.clientHeight + 4;
      }
      option.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, menuReady, open]);

  const closeAndFocusTrigger = (): void => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };

  const toggleIndex = (index: number): void => {
    if (index === 0) {
      onChange([]);
      closeAndFocusTrigger();
      return;
    }
    const option = options[index - 1];
    if (!option) return;
    onChange(
      selectedSet.has(option.value)
        ? values.filter((value) => value !== option.value)
        : [...values, option.value],
    );
  };

  const moveActive = (nextIndex: number): void => {
    setActiveIndex(Math.max(0, Math.min(optionCount - 1, nextIndex)));
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled || optionCount === 0) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "End" || event.key === "ArrowUp") setActiveIndex(optionCount - 1);
    else setActiveIndex(0);
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
      moveActive(optionCount - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleIndex(index);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocusTrigger();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const renderOption = (
    option: VortaMultiSelectOption<TValue> | null,
    index: number,
  ): JSX.Element => {
    const selected = option ? selectedSet.has(option.value) : values.length === 0;
    const active = index === activeIndex;
    const optionLabel = option?.label ?? allLabel;
    return (
      <button
        key={option ? option.value : "all"}
        ref={(node) => { optionRefs.current[index] = node; }}
        type="button"
        role="option"
        aria-selected={selected}
        tabIndex={active ? 0 : -1}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => toggleIndex(index)}
        onKeyDown={(event) => handleOptionKeyDown(event, index)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
          selected
            ? "border-blue-500/60 bg-[#10151d] text-blue-200"
            : active
              ? "border-gray-700 bg-[#1a202a] text-slate-100"
              : "border-transparent text-slate-300 hover:bg-[#1a202a]"
        }`}
        data-value={option?.value ?? "all"}
      >
        <span className={`inline-flex min-w-0 flex-1 items-center gap-2 ${option?.textClassName ?? ""}`}>
          {option?.dotClassName ? (
            <span className={`h-2 w-2 shrink-0 rounded-full ${option.dotClassName}`} aria-hidden="true" />
          ) : null}
          <span className="min-w-0 break-words">{optionLabel}</span>
        </span>
        {selected ? <Check className="h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" /> : null}
      </button>
    );
  };

  const menu = open && menuPosition && typeof document !== "undefined"
    ? createPortal(
      <>
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[110] bg-transparent"
          data-vorta-select-backdrop="true"
          onPointerDown={closeAndFocusTrigger}
        />
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-label={`${label} options`}
          aria-multiselectable="true"
          className="fixed z-[120] touch-pan-y overscroll-contain overflow-y-auto rounded-xl border border-gray-700 bg-[#141820] p-1.5 shadow-2xl shadow-black/45"
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
            overscrollBehavior: "contain",
            touchAction: "pan-y",
            WebkitOverflowScrolling: "touch",
          }}
          data-vorta-select-listbox="true"
          data-vorta-multi-select-listbox="true"
          data-vorta-select-placement={menuPosition.placement}
          data-vorta-select-compact={menuPosition.compact ? "true" : "false"}
        >
          {renderOption(null, 0)}
          {options.map((option, index) => renderOption(option, index + 1))}
        </div>
      </>,
      document.body,
    )
    : null;

  return (
    <div
      ref={rootRef}
      className={`relative grid min-w-0 gap-1 ${className}`}
      data-vorta-multi-select="true"
    >
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-describedby={`${listboxId}-selection`}
        disabled={disabled}
        onClick={() => {
          if (!disabled && optionCount > 0) {
            setActiveIndex(0);
            setOpen((current) => !current);
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-gray-700 bg-[#0d1117] px-3 py-2 text-left text-sm font-medium text-slate-200 outline-none transition-colors hover:border-gray-600 focus-visible:border-blue-500/70 focus-visible:ring-2 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        data-vorta-multi-select-trigger="true"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selectedOptions.slice(0, 2).map((option) => (
            <span
              key={option.value}
              className={`h-2 w-2 shrink-0 rounded-full ${option.dotClassName ?? "bg-slate-500"}`}
              aria-hidden="true"
            />
          ))}
          <span className="min-w-0 truncate">{summary}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      <span id={`${listboxId}-selection`} className="sr-only">
        {values.length === 0
          ? `${allLabel} selected`
          : `${values.length} selected: ${selectedOptions.map((option) => option.label).join(", ")}`}
      </span>
      {menu}
    </div>
  );
}
