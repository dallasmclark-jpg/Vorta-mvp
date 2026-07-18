/**
 * PortalShell — shared layout shell for every Vorta portal.
 *
 * Usage:
 *   <PortalShell homeRoute="/engineer/dashboard" nav={primaryNav} secondaryNav={secondaryNav}>
 *     <Routes>…</Routes>
 *   </PortalShell>
 *
 * Nav items may be flat (NavItem[]) or grouped (NavGroup[]).
 * Pass `accentColor` to override the active-state highlight (defaults to blue).
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, Menu, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { VortaIcon, VortaLogo } from "./VortaLogo";
import { supabase } from "../lib/supabaseClient";
import { PageTransition } from "./PageTransition";
import { useModalFocusTrap } from "../hooks/useModalFocusTrap";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  icon: LucideIcon;
  to: string;
  end?: boolean;
  children?: NavItem[];
}

export interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

/** Flat items or grouped items. */
export type NavConfig = NavItem[] | NavGroup[];

function isGrouped(nav: NavConfig): nav is NavGroup[] {
  return nav.length > 0 && "groupLabel" in nav[0];
}

// ─── Accent colours ───────────────────────────────────────────────────────────
// One canonical set — all portals use blue. Override per-portal via accentColor.

const accentMap = {
  blue:    { active: "bg-[#3b82f615] text-blue-400",    hover: "hover:bg-[#3b82f615]" },
  emerald: { active: "bg-[#10b98115] text-emerald-400", hover: "hover:bg-[#10b98115]" },
} as const;

type Accent = keyof typeof accentMap;

// ─── Style tokens (single source of truth) ───────────────────────────────────

const labelBase = "text-sm font-medium leading-none tracking-tight";
const itemBase  = (hover: string) =>
  `flex w-full items-center gap-3 rounded-lg py-2.5 px-2 text-sm transition-colors ${hover} justify-center xl:justify-start xl:px-3`;

interface SidebarTooltipPosition {
  top: number;
  left: number;
}

function useCompactSidebarTooltip(
  label: string,
  enabled: boolean,
) {
  const [
    position,
    setPosition,
  ] =
    useState<SidebarTooltipPosition | null>(
      null,
    );

  const showTimerRef =
    useRef<number | null>(
      null,
    );

  const clearShowTimer = () => {
    if (
      showTimerRef.current !== null
    ) {
      window.clearTimeout(
        showTimerRef.current,
      );

      showTimerRef.current =
        null;
    }
  };

  const hideTooltip = () => {
    clearShowTimer();
    setPosition(null);
  };

  const showTooltip = (
    element: HTMLElement,
  ) => {
    clearShowTimer();

    if (
      !enabled ||
      window.matchMedia(
        "(min-width: 1280px)",
      ).matches
    ) {
      return;
    }

    const rect =
      element.getBoundingClientRect();

    showTimerRef.current =
      window.setTimeout(() => {
        setPosition({
          top:
            rect.top +
            rect.height / 2,
          left:
            rect.right + 10,
        });

        showTimerRef.current =
          null;
      }, 120);
  };

  useEffect(() => {
    if (!enabled) {
      hideTooltip();
    }
  }, [enabled]);

  useEffect(() => {
    const dismissTooltip = () => {
      hideTooltip();
    };

    window.addEventListener(
      "resize",
      dismissTooltip,
    );

    window.addEventListener(
      "scroll",
      dismissTooltip,
      true,
    );

    return () => {
      clearShowTimer();

      window.removeEventListener(
        "resize",
        dismissTooltip,
      );

      window.removeEventListener(
        "scroll",
        dismissTooltip,
        true,
      );
    };
  }, []);

  const tooltip =
    enabled &&
    position &&
    typeof document !==
      "undefined"
      ? createPortal(
          <div
            role="tooltip"
            style={{
              top: position.top,
              left: position.left,
            }}
            className="pointer-events-none fixed z-[200] -translate-y-1/2 animate-in whitespace-nowrap rounded-md border border-slate-700/80 bg-[#141820] px-2.5 py-1.5 text-xs font-semibold text-slate-100 shadow-[0_8px_24px_rgba(0,0,0,0.45)] fade-in-0 zoom-in-95 duration-150 xl:hidden"
          >
            <span
              aria-hidden="true"
              className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-[-45deg] border-l border-t border-slate-700/80 bg-[#141820]"
            />

            <span className="relative inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-blue-400"
              />

              {label}
            </span>
          </div>,
          document.body,
        )
      : null;

  return {
    showTooltip,
    hideTooltip,
    tooltip,
  };
}

// ─── Single nav item ─────────────────────────────────────────────────────────

interface NavItemRowProps {
  item: NavItem;
  accent: Accent;
  labelVisible: boolean;
  indent?: boolean;
}

function NavItemRow({
  item,
  accent,
  labelVisible,
  indent = false,
}: NavItemRowProps) {
  const {
    active,
    hover,
  } = accentMap[accent];

  const Icon = item.icon;
  const location = useLocation();

  const compactTooltip =
    useCompactSidebarTooltip(
      item.label,
      !labelVisible,
    );

  const normalisePath = (
    path: string,
  ): string => {
    if (path === "/") {
      return path;
    }

    return (
      path.replace(
        /\/+$/,
        "",
      ) || "/"
    );
  };

  const currentPath =
    normalisePath(
      location.pathname,
    );

  const targetPath =
    normalisePath(item.to);

  const isItemActive =
    item.end === true
      ? currentPath ===
        targetPath
      : currentPath ===
          targetPath ||
        currentPath.startsWith(
          `${targetPath}/`,
        );

  return (
    <>
      <NavLink
        to={item.to}
        end={item.end}
        aria-label={item.label}
        onMouseEnter={(event) =>
          compactTooltip.showTooltip(
            event.currentTarget,
          )
        }
        onMouseLeave={
          compactTooltip.hideTooltip
        }
        onFocus={(event) =>
          compactTooltip.showTooltip(
            event.currentTarget,
          )
        }
        onBlur={
          compactTooltip.hideTooltip
        }
        onClick={
          compactTooltip.hideTooltip
        }
        onKeyDown={(event) => {
          if (
            event.key === "Escape"
          ) {
            compactTooltip.hideTooltip();
          }
        }}
        className={() =>
          `${itemBase(hover)} ${
            indent
              ? "pl-7 xl:pl-8"
              : ""
          } ${
            isItemActive
              ? active
              : "text-slate-400 hover:text-slate-200"
          }`
        }
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className={`${labelBase} ${labelVisible ? "block" : "hidden xl:block"}`}>
          {item.label}
        </span>
      </NavLink>

      {compactTooltip.tooltip}
    </>
  );
}

// ─── Nav list (flat) ─────────────────────────────────────────────────────────

interface NavListProps {
  items: NavItem[];
  accent: Accent;
  labelVisible: boolean;
}

function NavList({ items, accent, labelVisible }: NavListProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <NavItemRow key={item.to} item={item} accent={accent} labelVisible={labelVisible} />
      ))}
    </div>
  );
}

// ─── Nav groups ──────────────────────────────────────────────────────────────

interface NavGroupsProps {
  groups: NavGroup[];
  accent: Accent;
  labelVisible: boolean;
}

function NavGroups({ groups, accent, labelVisible }: NavGroupsProps) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ groupLabel, items }) => (
        <div key={groupLabel} className="flex flex-col gap-0.5">
          <p className={`px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600 ${labelVisible ? "block" : "hidden xl:block"}`}>
            {groupLabel}
          </p>
          {items.map((item) => (
            <NavItemRow key={item.to} item={item} accent={accent} labelVisible={labelVisible} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  homeRoute: string;
  nav: NavConfig;
  secondaryNav?: NavItem[];
  accent: Accent;
  /** When true all labels are always visible (used in mobile overlay). */
  forceLabels?: boolean;
  onClose?: () => void;
}

function Sidebar({ homeRoute, nav, secondaryNav, accent, forceLabels = false, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const labelVisible = forceLabels;

  const logoutTooltip =
    useCompactSidebarTooltip(
      "Log out",
      !labelVisible,
    );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="relative flex h-full max-h-[100dvh] w-full flex-col border-r border-gray-800 bg-[#090b10] px-2 py-5 xl:px-4 overflow-hidden">
      {/* Close button (mobile overlay only) */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Logo */}
      <header className={`flex h-10 items-center mb-4 ${forceLabels ? "px-2" : "justify-center px-0 xl:justify-start xl:px-2"}`}>
        <NavLink to={homeRoute} aria-label="Vorta home" onClick={onClose} className="inline-flex items-center overflow-hidden">
          <span className={forceLabels ? "block" : "hidden xl:block"}>
            <VortaLogo />
          </span>
          {!forceLabels && (
            <span className="block xl:hidden">
              <VortaIcon />
            </span>
          )}
        </NavLink>
      </header>

      {/* Primary nav */}
      <nav aria-label="Primary navigation" className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
        {isGrouped(nav)
          ? <NavGroups groups={nav} accent={accent} labelVisible={labelVisible} />
          : <NavList   items={nav}  accent={accent} labelVisible={labelVisible} />
        }
      </nav>

      {/* Secondary nav + logout */}
      <nav aria-label="Secondary navigation" className="mt-auto shrink-0 flex flex-col gap-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {secondaryNav && secondaryNav.length > 0 && (
          <div className="flex flex-col gap-0.5 mb-2">
            {secondaryNav.map((item) => (
              <NavItemRow key={item.to} item={item} accent={accent} labelVisible={labelVisible} />
            ))}
          </div>
        )}

        <div className="border-t border-gray-800 pt-4">
          <button
            type="button"
            aria-label="Log out"
            onMouseEnter={(event) =>
              logoutTooltip.showTooltip(
                event.currentTarget,
              )
            }
            onMouseLeave={
              logoutTooltip.hideTooltip
            }
            onFocus={(event) =>
              logoutTooltip.showTooltip(
                event.currentTarget,
              )
            }
            onBlur={
              logoutTooltip.hideTooltip
            }
            onKeyDown={(event) => {
              if (
                event.key === "Escape"
              ) {
                logoutTooltip.hideTooltip();
              }
            }}
            onClick={() => {
              logoutTooltip.hideTooltip();
              void handleLogout();
            }}
            className={`${itemBase("hover:bg-red-500/10")} text-slate-500 hover:text-red-400`}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={`${labelBase} ${labelVisible ? "block" : "hidden xl:block"}`}>
              Log out
            </span>
          </button>

          {logoutTooltip.tooltip}
        </div>
      </nav>
    </aside>
  );
}

// ─── PortalShell ─────────────────────────────────────────────────────────────

export interface PortalShellProps {
  homeRoute: string;
  nav: NavConfig;
  secondaryNav?: NavItem[];
  accentColor?: Accent;
  children: React.ReactNode;
}

export const PortalShell = ({
  homeRoute,
  nav,
  secondaryNav,
  accentColor = "blue",
  children,
}: PortalShellProps): JSX.Element => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mobileDrawerRef = useModalFocusTrap<HTMLDivElement>(
    mobileOpen,
    () => setMobileOpen(false),
  );
  const location  = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <main className="flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[#0b0e14] text-white">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      {/* w-14 = 56px (icon-only) below xl; w-56 = 224px (expanded) at xl+ */}
      <div className="hidden shrink-0 md:flex md:w-14 xl:w-56 h-[100dvh] max-h-[100dvh] overflow-hidden flex-col">
        <Sidebar
          homeRoute={homeRoute}
          nav={nav}
          secondaryNav={secondaryNav}
          accent={accentColor}
        />
      </div>

      {/* ── Mobile overlay sidebar ──────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Portal navigation"
            tabIndex={-1}
            className="relative z-50 flex w-64 shrink-0 flex-col"
          >
            <Sidebar
              homeRoute={homeRoute}
              nav={nav}
              secondaryNav={secondaryNav}
              accent={accentColor}
              forceLabels
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        {/* Mobile top bar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-800 bg-[#090b10] px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <VortaIcon />
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="min-w-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </section>
    </main>
  );
};
