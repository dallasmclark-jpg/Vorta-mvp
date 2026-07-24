import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react";
import { Check, Monitor, Moon, Sun, type LucideProps } from "lucide-react";
import {
  getThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from "../lib/theme";
import "../theme.css";

interface ThemeOption {
  value: ThemePreference;
  label: string;
  description: string;
  icon: ComponentType<LucideProps>;
}

const options: ThemeOption[] = [
  {
    value: "light",
    label: "Light",
    description: "Bright surfaces for offices and daylight",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Vorta's original low-glare appearance",
    icon: Moon,
  },
  {
    value: "system",
    label: "System",
    description: "Follow this device's appearance",
    icon: Monitor,
  },
];

const getServerSnapshot = (): ThemePreference => "dark";

export function ThemeControl(): JSX.Element {
  const preference = useSyncExternalStore(
    subscribeTheme,
    getThemePreference,
    getServerSnapshot,
  );
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === preference) ?? options[1];
  const SelectedIcon = selected.icon;

  useEffect(() => {
    if (!open) return;

    const closeFromOutside = (event: MouseEvent): void => {
      if (!controlRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const closeFromKeyboard = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);

    return () => {
      document.removeEventListener("mousedown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [open]);

  return (
    <div
      ref={controlRef}
      className="vorta-theme-control fixed z-40"
      data-vorta-theme-control="true"
    >
      {open ? (
        <div
          role="menu"
          aria-label="Appearance"
          className="vorta-theme-menu absolute bottom-full left-0 mb-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700/80 bg-[#141820]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <div className="px-3 pb-2 pt-1">
            <p className="text-sm font-semibold text-slate-100">Appearance</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Choose how Vorta looks on this device.
            </p>
          </div>

          <div className="space-y-1">
            {options.map((option) => {
              const Icon = option.icon;
              const active = option.value === preference;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  data-vorta-theme-option={option.value}
                  onClick={() => {
                    setThemePreference(option.value);
                    setOpen(false);
                  }}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    active
                      ? "bg-blue-500/12 text-blue-300"
                      : "text-slate-300 hover:bg-white/[0.06] hover:text-slate-100"
                  }`}
                >
                  <span
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                      active
                        ? "border-blue-500/30 bg-blue-500/10"
                        : "border-slate-700 bg-[#10151d]"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-4 text-slate-500">
                      {option.description}
                    </span>
                  </span>

                  {active ? (
                    <Check className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Appearance: ${selected.label}`}
        data-vorta-theme-trigger="true"
        onClick={() => setOpen((current) => !current)}
        className="vorta-theme-trigger inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-700/80 bg-[#141820]/95 px-3.5 py-2 text-sm font-semibold text-slate-200 shadow-lg shadow-black/25 backdrop-blur-xl transition-colors hover:border-slate-600 hover:bg-[#181d26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0e14]"
      >
        <SelectedIcon className="h-4 w-4" aria-hidden="true" />
        <span>{selected.label}</span>
      </button>
    </div>
  );
}
