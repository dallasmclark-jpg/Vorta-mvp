import { useEffect } from "react";
import { X } from "lucide-react";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Max width class — defaults to "max-w-md" */
  maxWidth?: string;
}

/**
 * Shared slide-over drawer shell for the Maintenance Manager portal.
 * Handles backdrop, slide animation, Escape key and close button.
 * Drop your drawer header + body content as children.
 */
export function DetailDrawer({ open, onClose, children, maxWidth = "max-w-md" }: DetailDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        className={`fixed inset-y-0 right-0 z-50 flex w-full ${maxWidth} flex-col border-l border-gray-800 bg-[#0d1117] shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {children}
      </aside>
    </>
  );
}

/**
 * Standardised close button for use in drawer headers.
 */
export function DrawerCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#ffffff10] hover:text-slate-200"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
