import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "info" | "warning";

export interface ToastOptions {
  type?: ToastType;
  message: string;
  /** ms — default 3200 */
  duration?: number;
}

// ─── Context ──────────────────────────────────────────────────────────────────

let _id = 0;

const ToastCtx = createContext<(opts: ToastOptions) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

// ─── Single toast item ────────────────────────────────────────────────────────

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />,
  info:    <Info          className="h-4 w-4 shrink-0 text-blue-400"    aria-hidden />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" aria-hidden />,
};

const barMap: Record<ToastType, string> = {
  success: "bg-emerald-500",
  info:    "bg-blue-500",
  warning: "bg-yellow-500",
};

interface ToastItemProps extends ToastOptions {
  id: number;
  onDismiss: () => void;
}

function ToastItem({ type = "info", message, duration = 3200, onDismiss }: ToastItemProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex min-w-[260px] max-w-sm items-start gap-3 overflow-hidden rounded-xl border border-[#2a3347] bg-[#111827] px-4 py-3 shadow-2xl animate-fade-in"
    >
      {iconMap[type]}
      <p className="flex-1 text-sm text-slate-200">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-slate-500 transition-colors hover:text-slate-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {/* Progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-[2px] ${barMap[type]}`}
        style={{ animation: `shrink-x ${duration}ms linear forwards` }}
      />
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ToastEntry extends ToastOptions {
  id: number;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((opts: ToastOptions) => {
    const id = ++_id;
    const duration = opts.duration ?? 3200;
    setToasts((prev) => [...prev.slice(-3), { ...opts, id }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={addToast}>
      {children}
      {createPortal(
        <div
          aria-label="Notifications"
          className="fixed top-6 right-6 z-[9999] flex flex-col items-end gap-2"
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  );
}
