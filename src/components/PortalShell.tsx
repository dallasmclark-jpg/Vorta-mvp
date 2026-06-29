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
import { LogOut, Menu, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { VortaIcon, VortaLogo } from "./VortaLogo";
import { supabase } from "../lib/supabaseClient";
import { PageTransition } from "./PageTransition";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  icon: LucideIcon;
  to: string;
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

// ─── Single nav item ─────────────────────────────────────────────────────────

interface NavItemRowProps {
  item: NavItem;
  accent: Accent;
  labelVisible: boolean;
  indent?: boolean;
}

function NavItemRow({ item, accent, labelVisible, indent = false }: NavItemRowProps) {
  const { active, hover } = accentMap[accent];
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      title={item.label}
      className={({ isActive }) =>
        `${itemBase(hover)} ${indent ? "pl-7 xl:pl-8" : ""} ${
          isActive ? active : "text-slate-400 hover:text-slate-200"
        }`
      }
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className={`${labelBase} ${labelVisible ? "block" : "hidden xl:block"}`}>
        {item.label}
      </span>
    </NavLink>
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="relative flex h-full w-full flex-col border-r border-gray-800 bg-[#090b10] px-2 py-5 xl:px-4 overflow-hidden">
      {/* Close button (mobile overlay only) */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
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
      <nav aria-label="Secondary navigation" className="mt-4 flex flex-col gap-1 shrink-0">
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
            title="Log out"
            onClick={handleLogout}
            className={`${itemBase("hover:bg-red-500/10")} text-slate-500 hover:text-red-400`}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={`${labelBase} ${labelVisible ? "block" : "hidden xl:block"}`}>
              Log out
            </span>
          </button>
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
    <main className="flex h-screen w-full overflow-hidden bg-[#0b0e14] text-white">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      {/* w-14 = 56px (icon-only) below xl; w-56 = 224px (expanded) at xl+ */}
      <div className="hidden shrink-0 md:flex md:w-14 xl:w-56 h-screen flex-col sticky top-0">
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
          <div className="relative z-50 flex w-64 shrink-0 flex-col">
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <VortaIcon />
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </section>
    </main>
  );
};
