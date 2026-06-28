import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

type SelectSize = "sm" | "md" | "lg";

const SIZE_WIDTH: Record<SelectSize, string> = {
  sm: "w-[160px]",
  md: "w-[200px]",
  lg: "w-[240px]",
};

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown when value matches nothing (also used as aria-label fallback) */
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** sm=160px · md=200px · lg=240px. When omitted the button has no fixed width. */
  size?: SelectSize;
  /** Force a fixed pixel width; otherwise matches trigger width */
  menuWidth?: number;
}

const MAX_MENU_HEIGHT = 260;
const EDGE_GAP = 8;

// ─── Dropdown portal ──────────────────────────────────────────────────────────

interface DropdownPortalProps {
  anchorRect: DOMRect;
  options: SelectOption[];
  value: string;
  focusedIdx: number;
  onSelect: (val: string) => void;
  onClose: () => void;
  onFocus: (i: number) => void;
  menuWidth?: number;
  listRef: React.RefObject<HTMLUListElement>;
}

function DropdownPortal({
  anchorRect,
  options,
  value,
  focusedIdx,
  onSelect,
  onClose,
  onFocus,
  menuWidth,
  listRef,
}: DropdownPortalProps) {
  const width = menuWidth ?? anchorRect.width;

  // Prefer below; fall back to above
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const spaceAbove = anchorRect.top;
  const placeAbove = spaceBelow < 200 && spaceAbove > spaceBelow;

  let left = anchorRect.left + window.scrollX;
  left = Math.min(left, window.innerWidth + window.scrollX - width - EDGE_GAP);
  left = Math.max(left, EDGE_GAP);

  const top = placeAbove
    ? anchorRect.top + window.scrollY - EDGE_GAP   // translateY(-100%) via CSS
    : anchorRect.bottom + window.scrollY + 4;

  // Click outside
  useEffect(() => {
    function handle(e: MouseEvent | TouchEvent) {
      if (listRef.current && !listRef.current.closest("[data-dropdown-root]")?.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay so the trigger's own click doesn't re-open
    const id = setTimeout(() => {
      document.addEventListener("mousedown", handle);
      document.addEventListener("touchstart", handle);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [onClose, listRef]);

  // Keyboard
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); }
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);

  // Auto-scroll focused item
  useEffect(() => {
    if (focusedIdx >= 0 && listRef.current) {
      const el = listRef.current.children[focusedIdx] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIdx, listRef]);

  return createPortal(
    <div
      data-dropdown-root
      style={{
        position: "absolute",
        top,
        left,
        width,
        zIndex: 9998,
        transformOrigin: placeAbove ? "bottom center" : "top center",
        transform: placeAbove ? "translateY(-100%)" : undefined,
      }}
      className="animate-dropdown-in"
    >
      <ul
        ref={listRef}
        role="listbox"
        tabIndex={-1}
        style={{ maxHeight: MAX_MENU_HEIGHT }}
        className="overflow-y-auto rounded-xl border border-[#2a3347] bg-[#111827] py-1 shadow-2xl outline-none"
      >
        {options.map((opt, i) => {
          const isSelected = opt.value === value;
          const isFocused  = i === focusedIdx;
          return (
            <li
              key={opt.value}
              role="option"
              aria-selected={isSelected}
              onMouseEnter={() => onFocus(i)}
              onMouseDown={(e) => { e.preventDefault(); onSelect(opt.value); }}
              className={[
                "flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-3 text-sm transition-colors",
                isFocused  ? "bg-[#3b82f620] text-blue-300"  : "",
                isSelected && !isFocused ? "text-blue-400" : "",
                !isSelected && !isFocused ? "text-slate-300" : "",
              ].join(" ")}
            >
              <span className="flex-1 leading-snug">{opt.label}</span>
              {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden="true" />}
            </li>
          );
        })}
      </ul>
    </div>,
    document.body
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

let _uid = 0;

export const Select = ({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  disabled = false,
  size,
  menuWidth,
}: SelectProps): JSX.Element => {
  const [open,       setOpen]       = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [focusedIdx, setFocusedIdx] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef    = useRef<HTMLUListElement>(null);
  const idRef      = useRef(`sel-${++_uid}`);

  const selected = options.find((o) => o.value === value);
  const label    = selected?.label ?? placeholder ?? "Select…";
  const isEmpty  = !selected && !!placeholder;

  function openMenu() {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setAnchorRect(rect);
    const idx = options.findIndex((o) => o.value === value);
    setFocusedIdx(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    setFocusedIdx(-1);
    triggerRef.current?.focus();
  }

  function select(val: string) {
    onChange(val);
    closeMenu();
  }

  // Update anchor on scroll / resize while open
  useEffect(() => {
    if (!open) return;
    function update() {
      if (triggerRef.current) setAnchorRect(triggerRef.current.getBoundingClientRect());
    }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      open ? closeMenu() : openMenu();
    }
    if (e.key === "Escape" && open) { e.preventDefault(); closeMenu(); }
    if (e.key === "ArrowUp" && !open) { e.preventDefault(); openMenu(); }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx((i) => Math.min(i + 1, options.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setFocusedIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (focusedIdx >= 0) select(options[focusedIdx].value); }
    if (e.key === "Escape") { e.preventDefault(); closeMenu(); }
    if (e.key === "Tab")    { closeMenu(); }
  }

  // Focus the list when opened so keyboard works immediately
  useEffect(() => {
    if (open) {
      // Small delay so the portal renders first
      const id = requestAnimationFrame(() => listRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        id={idRef.current}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={placeholder}
        disabled={disabled}
        onClick={() => open ? closeMenu() : openMenu()}
        onKeyDown={onTriggerKeyDown}
        onKeyUp={(e) => { if (open) onListKeyDown(e as unknown as React.KeyboardEvent); }}
        className={[
          "inline-flex h-8 shrink-0 items-center justify-between gap-2 rounded-lg border bg-[#0b0e14] px-3 text-sm transition-colors",
          size ? SIZE_WIDTH[size] : "",
          "border-gray-800 text-slate-300",
          "hover:border-[#3b82f650] hover:text-slate-200",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/40",
          open ? "border-blue-500/40 ring-1 ring-blue-500/30" : "",
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
          isEmpty ? "text-slate-500" : "",
          className,
        ].join(" ")}
      >
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && anchorRect && (
        <DropdownPortal
          anchorRect={anchorRect}
          options={options}
          value={value}
          focusedIdx={focusedIdx}
          onSelect={select}
          onClose={closeMenu}
          onFocus={setFocusedIdx}
          menuWidth={menuWidth}
          listRef={listRef}
        />
      )}
    </>
  );
};
