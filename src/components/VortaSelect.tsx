import { Check, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export interface VortaSelectSupportItem {
  label: string;
  dotClassName: string;
  textClassName?: string;
}

export interface VortaSelectOption<TValue extends string | number> {
  value: TValue;
  label: string;
  supportingItems?: readonly VortaSelectSupportItem[];
}

interface VortaSelectProps<TValue extends string | number> {
  label: string;
  value: TValue;
  options: readonly VortaSelectOption<TValue>[];
  onChange: (value: TValue) => void;
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

let openVortaSelectCount = 0;

function updateGlobalSelectState(open: boolean): () => void {
  if (typeof document === "undefined" || !open) return () => undefined;
  openVortaSelectCount += 1;
  document.documentElement.dataset.vortaSelectOpen = "true";
  return () => {
    openVortaSelectCount = Math.max(0, openVortaSelectCount - 1);
    if (openVortaSelectCount === 0) {
      delete document.documentElement.dataset.vortaSelectOpen;
    }
  };
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
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const hasSupportingItems = options.some((option) => Boolean(option.supportingItems?.length));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const menuReady = menuPosition !== null;

  useEffect(() => {
    setActiveIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  useEffect(() => updateGlobalSelectState(open), [open]);

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
    const optionHeight = compact
      ? (hasSupportingItems ? 48 : 38)
      : (hasSupportingItems ? 56 : 44);
    const containerPadding = compact ? 8 : 12;
    const desiredHeight = Math.min(
      options.length * optionHeight + containerPadding,
      compact ? (hasSupportingItems ? 256 : 248) : (hasSupportingItems ? 336 : 288),
    );
    const spaceBelow = Math.max(0, viewportBottom - rect.bottom - gap - margin);
    const spaceAbove = Math.max(0, rect.top - viewportTop - gap - margin);
    const placement: MenuPlacement =
      spaceBelow >= Math.min(desiredHeight, 160) || spaceBelow >= spaceAbove
        ? "bottom"
        : "top";
    const availableHeight = Math.max(
      72,
      Math.min(
        placement === "bottom" ? spaceBelow : spaceAbove,
        viewportHeight - margin * 2,
      ),
    );
    const maxHeight = Math.min(desiredHeight, availableHeight);
    const availableWidth = Math.max(0, viewportWidth - margin * 2);
    const width = Math.min(rect.width, availableWidth);
    const left = Math.min(
      Math.max(rect.left, viewportLeft + margin),
      viewportLeft + viewportWidth - margin - width,
    );
    const top = placement === "bottom"
      ? Math.min(rect.bottom + gap, viewportBottom - margin - maxHeight)
      : Math.max(viewportTop + margin, rect.top - gap - maxHeight);

    setMenuPosition({ left, top, width, maxHeight, placement, compact });
  }, [hasSupportingItems, options.length]);

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
      if (
        !rootRef.current?.contains(target)
        && !menuRef.current?.contains(target)
      ) {
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
      if (optionTop < menu.scrollTop) {
        menu.scrollTop = Math.max(0, optionTop - 4);
      } else if (optionBottom > menu.scrollTop + menu.clientHeight) {
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
  const selectedDescriptionId = `${listboxId}-selected-description`;
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
          className="fixed z-[120] touch-pan-y overscroll-contain overflow-y-auto rounded-xl border border-gray-700 bg-[#141820] p-1 shadow-2xl shadow-black/45 sm:p-1.5"
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
          data-vorta-select-placement={menuPosition.placement}
          data-vorta-select-compact={menuPosition.compact ? "true" : "false"}
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
                aria-describedby={option.supportingItems?.length ? `${listboxId}-option-${index}-description` : undefined}
                tabIndex={active ? 0 : -1}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={`flex w-full items-center justify-between gap-2.5 rounded-lg border px-2.5 text-left text-[13px] font-medium leading-5 transition-colors sm:gap-3 sm:px-3 sm:text-sm ${
                  option.supportingItems?.length ? "min-h-[48px] py-1.5 sm:min-h-14 sm:py-2" : "min-h-[38px] py-1 sm:min-h-11 sm:py-2"
                } ${
                  selected
                    ? "border-blue-500/60 bg-[#10151d] text-blue-200"
                    : active
                      ? "border-gray-700 bg-[#1a202a] text-slate-100"
                      : "border-transparent text-slate-300 hover:bg-[#1a202a]"
                }`}
                data-value={String(option.value)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words">{option.label}</span>
                  {option.supportingItems?.length ? (
                    <span
                      className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-medium leading-4 sm:text-xs"
                      data-vorta-select-supporting-items="true"
                    >
                      {option.supportingItems.map((item, supportIndex) => (
                        <span key={`${item.label}-${supportIndex}`} className={`inline-flex items-center gap-1 ${item.textClassName ?? "text-slate-400"}`}>
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dotClassName}`} aria-hidden="true" />
                          {item.label}
                        </span>
                      ))}
                    </span>
                  ) : null}
                  {option.supportingItems?.length ? (
                    <span id={`${listboxId}-option-${index}-description`} className="sr-only">
                      Included shifts: {option.supportingItems.map((item) => item.label).join(", ")}
                    </span>
                  ) : null}
                </span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </>,
      document.body,
    )
    : null;

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
        aria-describedby={selectedOption?.supportingItems?.length ? selectedDescriptionId : undefined}
        disabled={disabled}
        onClick={() => {
          if (!disabled && options.length > 0) {
            setActiveIndex(selectedIndex);
            setOpen((current) => !current);
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-gray-700 bg-[#0d1117] px-3 py-2 text-left text-sm font-medium text-slate-200 outline-none transition-colors hover:border-gray-600 focus-visible:border-blue-500/70 focus-visible:ring-2 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        data-vorta-select-trigger="true"
        data-value={String(value)}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">{selectedOption?.label ?? String(value)}</span>
          {selectedOption?.supportingItems?.length ? (
            <span
              className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-medium leading-4"
              data-vorta-select-selected-supporting-items="true"
            >
              {selectedOption.supportingItems.map((item, supportIndex) => (
                <span key={`${item.label}-${supportIndex}`} className={`inline-flex items-center gap-1 ${item.textClassName ?? "text-slate-400"}`}>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dotClassName}`} aria-hidden="true" />
                  {item.label}
                </span>
              ))}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {selectedOption?.supportingItems?.length ? (
        <span id={selectedDescriptionId} className="sr-only">
          Included shifts: {selectedOption.supportingItems.map((item) => item.label).join(", ")}
        </span>
      ) : null}
      {menu}
    </div>
  );
}
