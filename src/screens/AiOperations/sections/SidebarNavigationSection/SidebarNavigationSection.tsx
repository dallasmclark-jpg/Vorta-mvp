import { useState } from "react";
import {
  BookOpen,
  Building2,
  ChevronDown,
  ClipboardList,
  Cog,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  LogOut,
  Network,
  Sparkles,
  User,
  Users,
  Wrench,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { VortaLogo } from "../../../../components/VortaLogo";
import { supabase } from "../../../../lib/supabaseClient";

// ─── Primary navigation (no Training here — it is the expandable group below) ─

const primaryNavigation = [
  { label: "Dashboard",          icon: LayoutDashboard, to: "/"                   },
  { label: "Engineer Dashboard", icon: User,            to: "/engineer-dashboard" },
  { label: "Equipment",          icon: Wrench,          to: "/equipment"          },
  { label: "Skills Matrix",      icon: Network,         to: "/skills-matrix"      },
  { label: "Engineers",          icon: Users,           to: "/engineers"          },
  { label: "Requirements",       icon: ClipboardList,   to: "/requirements"       },
  { label: "AI Matching",        icon: Sparkles,        to: "/ai-matching"        },
];

// Training sub-items
const trainingChildren = [
  { label: "Bookings",   icon: BookOpen,   to: "/training"           },
  { label: "Providers",  icon: Building2,  to: "/training-providers" },
];

const secondaryNavigation = [
  { label: "Support",  icon: Headphones, to: "/support"  },
  { label: "Settings", icon: Cog,        to: "/settings" },
];

const labelBase = "font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] [font-style:var(--text-sm-medium-font-style)]";

interface SidebarProps {
  forceExpanded?: boolean;
}

export const SidebarNavigationSection = ({ forceExpanded }: SidebarProps): JSX.Element => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const trainingActive = location.pathname === "/training" || location.pathname === "/training-providers";

  // Training group is open when a training page is active, or user manually toggled
  const [trainingOpen, setTrainingOpen] = useState(trainingActive);

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
    <aside className={`relative flex h-full w-full flex-col border-r border-gray-800 bg-[#090b10] ${padX} py-5`}>
      {/* Logo */}
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

      {/* Primary nav */}
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
            <span className={`${labelBase} ${labelCls}`}>{label}</span>
          </NavLink>
        ))}

        {/* Training expandable group */}
        <div className="flex flex-col gap-0">
          <button
            type="button"
            title="Training"
            onClick={() => setTrainingOpen((v) => !v)}
            className={`${itemBase} ${trainingActive ? "text-blue-500" : "text-slate-400 hover:text-slate-200"}`}
          >
            <GraduationCap className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={`flex-1 text-left ${labelBase} ${labelCls}`}>Training</span>
            {/* Chevron — only visible when labels are shown */}
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${labelCls} ${trainingOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {/* Sub-items */}
          {trainingOpen && (
            <div className={`flex flex-col gap-0.5 ${forceExpanded ? "pl-6" : "xl:pl-6"}`}>
              {trainingChildren.map(({ label, icon: Icon, to }) => (
                <NavLink
                  key={label}
                  to={to}
                  title={label}
                  className={({ isActive }) =>
                    `${itemBase} ${isActive ? "bg-[#3b82f61a] text-blue-500" : "text-slate-500 hover:text-slate-200"}`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className={`${labelBase} ${labelCls} text-[13px]`}>{label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Secondary nav */}
      <nav aria-label="Secondary" className="mt-6 flex flex-1 flex-col justify-between">
        <div className="flex flex-col gap-1">
          {secondaryNavigation.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={label}
              to={to}
              title={label}
              className={({ isActive }) =>
                `${itemBase} ${isActive ? "bg-[#3b82f61a] text-blue-500" : "text-slate-400 hover:text-slate-200"}`
              }
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className={`${labelBase} ${labelCls}`}>{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Logout */}
        <div className="mt-4 border-t border-gray-800 pt-4">
          <button
            type="button"
            title="Log out"
            onClick={handleLogout}
            className={`${itemBase} text-slate-500 hover:text-red-400`}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={`${labelBase} ${labelCls}`}>Log out</span>
          </button>
        </div>
      </nav>
    </aside>
  );
};
