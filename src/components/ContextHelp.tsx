import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, Zap } from "lucide-react";

export interface ContextHelpContent {
  title: string;
  body: string;
  usage?: string;
  aiNote?: string;
}

interface TooltipPortalProps {
  content: ContextHelpContent;
  anchorRect: DOMRect;
  onClose: () => void;
  id: string;
}

// Minimum gap from viewport edges
const EDGE_GAP = 12;
const TOOLTIP_W = 280;

function TooltipPortal({ content, anchorRect, onClose, id }: TooltipPortalProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Compute position: prefer below, fall back to above; clamp to viewport width
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const spaceAbove = anchorRect.top;
  const placeAbove  = spaceBelow < 180 && spaceAbove > spaceBelow;

  let left = anchorRect.left + window.scrollX;
  // Clamp so tooltip doesn't overflow right edge
  left = Math.min(left, window.innerWidth + window.scrollX - TOOLTIP_W - EDGE_GAP);
  left = Math.max(left, EDGE_GAP);

  const top = placeAbove
    ? anchorRect.top + window.scrollY - 8   // will translate up via CSS
    : anchorRect.bottom + window.scrollY + 8;

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      id={id}
      style={{
        position:  "absolute",
        top,
        left,
        width:     TOOLTIP_W,
        transform: placeAbove ? "translateY(-100%)" : undefined,
        zIndex:    9999,
      }}
      className="rounded-xl border border-[#2a3347] bg-[#111827] shadow-2xl"
    >
      {/* Arrow */}
      <div
        style={{
          position:  "absolute",
          left:      Math.min(
            Math.max(anchorRect.left + window.scrollX - left + anchorRect.width / 2 - 6, 12),
            TOOLTIP_W - 24
          ),
          ...(placeAbove
            ? { bottom: -5, borderTop: "5px solid #2a3347", borderBottom: "none" }
            : { top: -5,    borderBottom: "5px solid #2a3347", borderTop: "none" }),
          width: 0, height: 0,
          borderLeft:  "6px solid transparent",
          borderRight: "6px solid transparent",
        }}
      />
      <div className="flex flex-col gap-2.5 p-4">
        <p className="text-xs font-semibold text-slate-50">{content.title}</p>
        <p className="text-xs leading-relaxed text-slate-400">{content.body}</p>
        {content.usage && (
          <p className="text-xs leading-relaxed text-slate-500">
            <span className="font-medium text-slate-400">How to use: </span>
            {content.usage}
          </p>
        )}
        {content.aiNote && (
          <div className="flex items-start gap-1.5 rounded-lg border border-blue-500/20 bg-[#3b82f610] px-2.5 py-2">
            <Zap className="mt-0.5 h-3 w-3 shrink-0 text-blue-400" />
            <p className="text-[11px] leading-relaxed text-blue-300">{content.aiNote}</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

let _uid = 0;

interface ContextHelpProps {
  content: ContextHelpContent;
  /** Extra classes on the trigger button wrapper */
  className?: string;
}

export const ContextHelp = ({ content, className = "" }: ContextHelpProps): JSX.Element => {
  const [visible,    setVisible]    = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const idRef      = useRef(`ctx-help-${++_uid}`);

  function show() {
    if (triggerRef.current) {
      setAnchorRect(triggerRef.current.getBoundingClientRect());
      setVisible(true);
    }
  }

  function hide() {
    setVisible(false);
  }

  function toggle() {
    visible ? hide() : show();
  }

  // Update position on scroll/resize while open
  useEffect(() => {
    if (!visible) return;
    function update() {
      if (triggerRef.current) setAnchorRect(triggerRef.current.getBoundingClientRect());
    }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [visible]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Help: ${content.title}`}
        aria-describedby={visible ? idRef.current : undefined}
        aria-expanded={visible}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={toggle}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-slate-600 outline-none transition-colors hover:text-slate-400 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:text-slate-400 ${className}`}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {visible && anchorRect && (
        <TooltipPortal
          content={content}
          anchorRect={anchorRect}
          onClose={hide}
          id={idRef.current}
        />
      )}
    </>
  );
};
