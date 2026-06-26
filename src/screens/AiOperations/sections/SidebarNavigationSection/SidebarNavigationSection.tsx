import {
  Cog,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  Network,
  Settings,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { VortaLogo } from "../../../../components/VortaLogo";

const primaryNavigation = [
  { label: "Dashboard",     icon: LayoutDashboard, to: "/"              },
  { label: "Skills Matrix", icon: Network,         to: "/skills-matrix" },
  { label: "Training",      icon: GraduationCap,   to: "/training"      },
  { label: "Equipment",     icon: Settings,        to: "/equipment"     },
];

const secondaryNavigation = [
  { label: "Support",  icon: Headphones },
  { label: "Settings", icon: Cog        },
];

const itemBase =
  "flex h-auto w-full items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-[#3b82f61a]";

export const SidebarNavigationSection = (): JSX.Element => {
  return (
    <aside className="relative flex h-full min-h-screen w-full flex-col border-r border-gray-800 bg-[#090b10] px-4 py-5">
      <header className="flex h-10 items-center px-2">
        <NavLink to="/" aria-label="Vorta home" className="inline-flex items-center">
          <VortaLogo />
        </NavLink>
      </header>

      <nav aria-label="Primary" className="mt-4 flex flex-col gap-1">
        {primaryNavigation.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={label}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `${itemBase} ${isActive ? "bg-[#3b82f61a] text-blue-500" : "text-slate-400 hover:text-slate-200"}`
            }
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] [font-style:var(--text-sm-medium-font-style)]">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      <nav aria-label="Secondary" className="mt-6 flex flex-1 flex-col justify-between">
        <div className="flex flex-col gap-1">
          {secondaryNavigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className={`${itemBase} text-slate-400 hover:text-slate-200`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] [font-style:var(--text-sm-medium-font-style)]">
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </aside>
  );
};
