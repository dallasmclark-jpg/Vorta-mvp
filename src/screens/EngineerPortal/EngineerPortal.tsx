import {
  Award,
  BookOpen,
  BriefcaseBusiness,
  Calendar,
  Cog,
  LayoutDashboard,
  LogOut,
  Network,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { VortaLogo } from "../../components/VortaLogo";
import { supabase } from "../../lib/supabaseClient";
import { EngineerDashboardSection } from "../EngineerDashboard";
import { MyTrainingSection } from "./MyTrainingSection";

// ─── Nav config ──────────────────────────────────────────────────────────────

const primaryNav = [
  { label: "Dashboard",          icon: LayoutDashboard, to: "/engineer/dashboard"          },
  { label: "My Skills",          icon: Network,         to: "/engineer/skills"             },
  { label: "My Training",        icon: BookOpen,        to: "/engineer/training"           },
  { label: "My Bookings",        icon: Calendar,        to: "/engineer/bookings"           },
  { label: "My Certifications",  icon: Award,           to: "/engineer/certifications"     },
  { label: "Opportunities",      icon: BriefcaseBusiness, to: "/engineer/opportunities"   },
  { label: "AI Recommendations", icon: Sparkles,        to: "/engineer/ai-recommendations" },
  { label: "Career Path",        icon: TrendingUp,      to: "/engineer/career-path"        },
];

const secondaryNav = [
  { label: "Profile Settings", icon: Cog,  to: "/engineer/settings" },
];

// ─── Shared style tokens (matches MM sidebar) ────────────────────────────────

const labelBase = "font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] [font-style:var(--text-sm-medium-font-style)]";

const itemBase = "flex h-auto w-full items-center gap-3 rounded-lg py-2.5 px-2 text-sm transition-colors hover:bg-[#10b98115] justify-center xl:justify-start xl:px-3";
const labelCls = "hidden xl:block";

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function EngineerSidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="relative flex h-full w-full flex-col border-r border-gray-800 bg-[#090b10] px-2 py-5 xl:px-4">
      <header className="flex h-10 items-center justify-center xl:justify-start xl:px-2">
        <NavLink to="/engineer/dashboard" aria-label="Vorta home" className="inline-flex items-center overflow-hidden">
          <span className="hidden xl:block"><VortaLogo /></span>
          <span className="block select-none font-mono text-sm font-bold text-white xl:hidden">&gt;&lt;</span>
        </NavLink>
      </header>

      <nav aria-label="Engineer primary" className="mt-4 flex flex-col gap-1">
        {primaryNav.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={label}
            to={to}
            title={label}
            className={({ isActive }) =>
              `${itemBase} ${isActive ? "bg-[#10b98115] text-emerald-400" : "text-slate-400 hover:text-slate-200"}`
            }
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={`${labelBase} ${labelCls}`}>{label}</span>
          </NavLink>
        ))}
      </nav>

      <nav aria-label="Engineer secondary" className="mt-6 flex flex-1 flex-col justify-between">
        <div className="flex flex-col gap-1">
          {secondaryNav.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={label}
              to={to}
              title={label}
              className={({ isActive }) =>
                `${itemBase} ${isActive ? "bg-[#10b98115] text-emerald-400" : "text-slate-400 hover:text-slate-200"}`
              }
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className={`${labelBase} ${labelCls}`}>{label}</span>
            </NavLink>
          ))}
        </div>

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
}

// ─── Placeholder for unbuilt pages ───────────────────────────────────────────

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center">
        <User className="mx-auto mb-3 h-10 w-10 text-slate-700" />
        <p className="text-sm font-medium text-slate-400">{title}</p>
        <p className="mt-1 text-xs text-slate-600">Coming soon</p>
      </div>
    </div>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export const EngineerPortal = (): JSX.Element => (
  <main className="flex h-screen w-full overflow-hidden bg-[#0b0e14] text-white">
    {/* Sidebar */}
    <div className="flex h-full w-14 shrink-0 flex-col xl:w-56">
      <EngineerSidebar />
    </div>

    {/* Content */}
    <div className="min-w-0 flex-1 overflow-y-auto">
      <Routes>
        <Route path="dashboard"         element={<EngineerDashboardSection />} />
        <Route path="skills"            element={<Placeholder title="My Skills" />} />
        <Route path="training"          element={<MyTrainingSection />} />
        <Route path="bookings"          element={<Placeholder title="My Bookings" />} />
        <Route path="certifications"    element={<Placeholder title="My Certifications" />} />
        <Route path="opportunities"     element={<Placeholder title="Opportunities" />} />
        <Route path="ai-recommendations" element={<Placeholder title="AI Recommendations" />} />
        <Route path="career-path"        element={<Placeholder title="Career Path" />} />
        <Route path="settings"          element={<Placeholder title="Profile Settings" />} />
        <Route path="*"                 element={<Navigate to="dashboard" replace />} />
      </Routes>
    </div>
  </main>
);
