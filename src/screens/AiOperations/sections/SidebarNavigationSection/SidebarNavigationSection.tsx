import {
  Building2,
  ClipboardList,
  Cog,
  FileBarChart2,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  LogOut,
  Network,
  Sparkles,
  Wrench,
  Users,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { VortaLogo } from "../../../../components/VortaLogo";
import { supabase } from "../../../../lib/supabaseClient";

const primaryNavigation = [
  { label: "Dashboard",     icon: LayoutDashboard, to: "/"               },
  { label: "Engineers",     icon: Users,           to: "/engineers"      },
  { label: "Skills Matrix", icon: Network,         to: "/skills-matrix"  },
  { label: "Requirements",  icon: ClipboardList,   to: "/requirements"   },
  { label: "Training",      icon: GraduationCap,   to: "/training"            },
  { label: "Providers",     icon: Building2,       to: "/training-providers"  },
  { label: "AI Matching",   icon: Sparkles,        to: "/ai-matching"         },
  { label: "AI Reports",    icon: FileBarChart2,   to: "/ai-reports"          },
  { label: "Equipment",     icon: Wrench,          to: "/equipment"           },
];

const secondaryNavigation = [
  { label: "Support",  icon: Headphones, to: "/support"  },
  { label: "Settings", icon: Cog,        to: "/settings" },
];

interface SidebarProps {
  /** When true, always show labels regardless of breakpoint (used in mobile overlay). */
  forceExpanded?: boolean;
}

export const SidebarNavigationSection = ({ forceExpanded }: SidebarProps): JSX.Element => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };
  const itemBase = [
    "flex h-auto w-full items-center gap-3 rounded-lg py-2.5 text-sm transition-colors hover:bg-[#3b82f61a]",
    forceExpanded
      ? "justify-start px-3"
      : "justify-center px-2 xl:justify-start xl:px-3",
  ].join(" ");

  const labelCls = forceExpanded ? "block" : "hidden xl:block";
  const padX     = forceExpanded ? "px-4" : "px-2 xl:px-4";

  return (
    <aside className={`relative flex h-full min-h-screen w-full flex-col border-r border-gray-800 bg-[#090b10] ${padX} py-5`}>
      <header className={`flex h-10 items-center ${forceExpanded ? "px-2" : "justify-center px-0 xl:justify-start xl:px-2"}`}>
        <NavLink to="/" aria-label="Vorta home" className="inline-flex items-center overflow-hidden">
          <span className={forceExpanded ? "block" : "hidden xl:block"}>
            <VortaLogo />
          </span>
          {!forceExpanded && (
            <span className="block select-none font-mono text-sm font-bold text-white xl:hidden">&gt;&lt;</span>
          )}
        </NavLink>
      </header>

      <nav aria-label="Primary" className="mt-4 flex flex-col gap-1">
        {primaryNavigation.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={label}
            to={to}
            end={to === "/"}
            title={label}
            className={({ isActive }) =>
              `${itemBase} ${isActive ? "bg-[#3b82f61a] text-blue-500" : "text-slate-400 hover:text-slate-200"}`
            }
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={`font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] [font-style:var(--text-sm-medium-font-style)] ${labelCls}`}>
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      <nav aria-label="Secondary" className="mt-6 flex flex-1 flex-col justify-between">
        <div className="flex flex-col gap-1">
          {secondaryNavigation.map(({ label, icon: Icon, to }) =>
            to ? (
              <NavLink
                key={label}
                to={to}
                title={label}
                className={({ isActive }) =>
                  `${itemBase} ${isActive ? "bg-[#3b82f61a] text-blue-500" : "text-slate-400 hover:text-slate-200"}`
                }
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className={`font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] [font-style:var(--text-sm-medium-font-style)] ${labelCls}`}>
                  {label}
                </span>
              </NavLink>
            ) : (
              <button
                key={label}
                type="button"
                title={label}
                className={`${itemBase} text-slate-400 hover:text-slate-200`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className={`font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] [font-style:var(--text-sm-medium-font-style)] ${labelCls}`}>
                  {label}
                </span>
              </button>
            )
          )}
        </div>

        {/* Logout — pinned to sidebar bottom */}
        <div className="mt-4 border-t border-gray-800 pt-4">
          <button
            type="button"
            title="Log out"
            onClick={handleLogout}
            className={`${itemBase} text-slate-500 hover:text-red-400`}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={`font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] [font-style:var(--text-sm-medium-font-style)] ${labelCls}`}>
              Log out
            </span>
          </button>
        </div>
      </nav>
    </aside>
  );
};
