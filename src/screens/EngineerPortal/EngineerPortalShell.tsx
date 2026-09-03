import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  Bot,
  ClipboardList,
  FileText,
  LogOut,
  Menu,
  MessageSquareText,
  Network,
  Package,
  Settings,
  Wrench,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { VortaIcon, VortaLogo } from "../../components/VortaLogo";
import { supabase } from "../../lib/supabaseClient";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#000814]";

export interface EngineerNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

export const ENGINEER_PRIMARY_NAV: EngineerNavItem[] = [
  { label: "Vorta", to: "/engineer/vorta", icon: Bot },
  { label: "My Work", to: "/engineer/work", icon: ClipboardList },
  { label: "Equipment", to: "/engineer/equipment", icon: Wrench },
  { label: "Stores", to: "/engineer/stores", icon: Package },
  { label: "Skills", to: "/engineer/skills", icon: Network },
];

export const ENGINEER_SECONDARY_NAV: EngineerNavItem[] = [
  { label: "Handover", to: "/engineer/handover", icon: MessageSquareText },
  { label: "Documents", to: "/engineer/documents", icon: FileText },
  { label: "Notifications", to: "/engineer/notifications", icon: Bell },
  { label: "Site Alerts", to: "/engineer/alerts", icon: AlertTriangle },
  { label: "Profile & Settings", to: "/engineer/settings", icon: Settings },
];

function pathIsActive(currentPath: string, targetPath: string, end = false): boolean {
  if (end) return currentPath === targetPath;
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

function EngineerDesktopNavItem({ item }: { item: EngineerNavItem }): JSX.Element {
  const location = useLocation();
  const active = pathIsActive(location.pathname, item.to, item.end);
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      aria-label={item.label}
      data-vorta-nav-item="true"
      className={`group flex min-h-11 items-center justify-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors 2xl:justify-start 2xl:px-3 ${FOCUS} ${
        active
          ? "bg-blue-500/[0.10] text-blue-300"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="hidden min-w-0 truncate 2xl:block">{item.label}</span>
    </NavLink>
  );
}

function EngineerMobileBottomNav(): JSX.Element {
  const location = useLocation();

  return (
    <nav
      data-vorta-engineer-bottom-nav="true"
      aria-label="Engineer primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-800/80 bg-[#000814]/95 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden"
    >
      {ENGINEER_PRIMARY_NAV.map((item) => {
        const Icon = item.icon;
        const active = pathIsActive(location.pathname, item.to, item.end);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            aria-label={item.label}
            className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors ${FOCUS} ${
              active ? "text-blue-400" : "text-slate-500"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-0 h-0.5 w-8 rounded-full bg-blue-500 transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
            />
            <Icon className={`h-5 w-5 ${active ? "stroke-[2]" : "stroke-[1.75]"}`} aria-hidden="true" />
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function EngineerMobileDrawer({ onClose }: { onClose: () => void }): JSX.Element {
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    drawerRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [onClose]);

  const handleLogout = async (): Promise<void> => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="fixed inset-0 z-[70] md:hidden" role="presentation">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Engineer menu"
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-[100dvh] w-[min(19rem,88vw)] flex-col border-l border-slate-800/80 bg-[#000814] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl outline-none"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <VortaLogo className="w-[132px]" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className={`inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white ${FOCUS}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          Engineer tools
        </p>
        <nav className="flex flex-col gap-1" aria-label="Engineer secondary navigation">
          {ENGINEER_SECONDARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${FOCUS} ${
                    isActive
                      ? "bg-blue-500/[0.10] text-blue-300"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-slate-800/80 pt-4">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400 ${FOCUS}`}
          >
            <LogOut className="h-5 w-5" />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

function resolveMobileTitle(pathname: string): string {
  const all = [...ENGINEER_PRIMARY_NAV, ...ENGINEER_SECONDARY_NAV];
  const matched = all
    .filter((item) => pathIsActive(pathname, item.to, item.end))
    .sort((a, b) => b.to.length - a.to.length)[0];

  if (pathname.includes("/work/")) return "Work Order";
  if (pathname.includes("/equipment/")) return "Equipment";
  if (pathname.includes("/stores/")) return "Spare Part";
  if (pathname.includes("/skills/")) return "Skill";
  return matched?.label ?? "Vorta";
}

export function EngineerPortalShell({ children }: { children: ReactNode }): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileTitle = useMemo(() => resolveMobileTitle(location.pathname), [location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async (): Promise<void> => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <main
      data-vorta-portal-shell="true"
      data-vorta-engineer-shell="true"
      className="flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[#000814] text-white"
    >
      <aside
        data-vorta-sidebar="true"
        className="hidden h-[100dvh] max-h-[100dvh] w-14 shrink-0 flex-col border-r border-slate-800/70 bg-[#000814] px-2 py-5 md:flex 2xl:w-56 2xl:px-4"
      >
        <NavLink
          to="/engineer/vorta"
          aria-label="Vorta engineer home"
          className={`mb-5 flex h-10 items-center justify-center overflow-hidden rounded-lg px-1 2xl:justify-start 2xl:px-2 ${FOCUS}`}
        >
          <span className="hidden 2xl:block"><VortaLogo /></span>
          <span className="block 2xl:hidden"><VortaIcon /></span>
        </NavLink>

        <nav className="flex min-h-0 flex-1 flex-col gap-1" aria-label="Engineer primary navigation">
          {ENGINEER_PRIMARY_NAV.map((item) => (
            <EngineerDesktopNavItem key={item.to} item={item} />
          ))}
        </nav>

        <nav className="mt-auto flex shrink-0 flex-col gap-1 border-t border-slate-800/70 pt-3" aria-label="Engineer secondary navigation">
          {ENGINEER_SECONDARY_NAV.map((item) => (
            <EngineerDesktopNavItem key={item.to} item={item} />
          ))}
          <button
            type="button"
            aria-label="Log out"
            onClick={() => void handleLogout()}
            className={`flex min-h-11 items-center justify-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-500/10 hover:text-red-400 2xl:justify-start 2xl:px-3 ${FOCUS}`}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="hidden 2xl:block">Log out</span>
          </button>
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          data-vorta-engineer-mobile-header="true"
          className="grid min-h-16 shrink-0 grid-cols-[auto_minmax(0,1fr)_2.75rem] items-center gap-3 border-b border-slate-800/70 bg-[#000814]/95 px-3 backdrop-blur-xl md:hidden"
        >
          <NavLink
            to="/engineer/vorta"
            aria-label="Vorta engineer home"
            className={`inline-flex min-h-11 items-center rounded-lg ${FOCUS}`}
          >
            <VortaLogo className="w-[124px]" />
          </NavLink>
          <span className="truncate text-right text-xs font-medium text-slate-500">{mobileTitle}</span>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open engineer menu"
            className={`inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white ${FOCUS}`}
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <div
          data-vorta-portal-scroll-container="true"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          {children}
        </div>
      </section>

      <EngineerMobileBottomNav />
      {menuOpen && <EngineerMobileDrawer onClose={() => setMenuOpen(false)} />}
    </main>
  );
}
