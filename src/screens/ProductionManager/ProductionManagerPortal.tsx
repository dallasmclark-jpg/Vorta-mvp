import {
  BarChart2,
  Cog,
  Factory,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { VortaLogo } from "../../components/VortaLogo";
import { supabase } from "../../lib/supabaseClient";
import { PageTransition } from "../../components/PageTransition";
import { ProductionManagerDashboard } from "./ProductionManagerDashboard";
import { ProductionSkillsMatrixSection } from "./ProductionSkillsMatrixSection";
import { ProductionShiftCoverageSection } from "./ProductionShiftCoverageSection";
import { ProductionTrainingSection } from "./ProductionTrainingSection";
import { ProductionOperatorsSection } from "./ProductionOperatorsSection";
import { ProductionComplianceSection } from "./ProductionComplianceSection";

// ─── Nav config ──────────────────────────────────────────────────────────────

const navGroups = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/production/dashboard" },
    ],
  },
  {
    label: "Workforce",
    items: [
      { label: "Shift Coverage",  icon: Users,     to: "/production/shift-coverage"  },
      { label: "Operators",       icon: Factory,   to: "/production/operators"       },
      { label: "Skills Matrix",   icon: BarChart2, to: "/production/skills-matrix"   },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Training & Competency", icon: GraduationCap, to: "/production/training"    },
      { label: "Compliance",  icon: ShieldCheck,   to: "/production/compliance"  },
      { label: "Risk",        icon: ShieldAlert,   to: "/production/risk"        },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Recommendations", icon: Sparkles, to: "/production/ai-recommendations" },
    ],
  },
];

const secondaryNav = [
  { label: "Settings", icon: Cog, to: "/production/settings" },
];

// ─── Style tokens ─────────────────────────────────────────────────────────────

const labelBase = "font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] [font-style:var(--text-sm-medium-font-style)]";
const itemBase = "flex h-auto w-full items-center gap-3 rounded-lg py-2.5 px-2 text-sm transition-colors hover:bg-[#3b82f615] justify-center xl:justify-start xl:px-3";
const labelCls = "hidden xl:block";

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function ProductionSidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="relative flex h-full w-full flex-col border-r border-gray-800 bg-[#090b10] px-2 py-5 xl:px-4">
      <header className="flex h-10 items-center justify-center xl:justify-start xl:px-2">
        <NavLink to="/production/dashboard" aria-label="Vorta home" className="inline-flex items-center overflow-hidden">
          <span className="hidden xl:block"><VortaLogo /></span>
          <span className="block select-none font-mono text-sm font-bold text-white xl:hidden">&gt;&lt;</span>
        </NavLink>
      </header>

      <nav aria-label="Production primary" className="mt-4 flex flex-col gap-4">
        {navGroups.map(({ label: groupLabel, items }) => (
          <div key={groupLabel} className="flex flex-col gap-1">
            <p className="hidden xl:block px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              {groupLabel}
            </p>
            {items.map(({ label, icon: Icon, to }) => (
              <NavLink
                key={label}
                to={to}
                title={label}
                className={({ isActive }) =>
                  `${itemBase} ${isActive ? "bg-[#3b82f615] text-blue-400" : "text-slate-400 hover:text-slate-200"}`
                }
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className={`${labelBase} ${labelCls}`}>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <nav aria-label="Production secondary" className="mt-6 flex flex-1 flex-col justify-between">
        <div className="flex flex-col gap-1">
          {secondaryNav.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={label}
              to={to}
              title={label}
              className={({ isActive }) =>
                `${itemBase} ${isActive ? "bg-[#3b82f615] text-blue-400" : "text-slate-400 hover:text-slate-200"}`
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

// ─── Placeholder ──────────────────────────────────────────────────────────────

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center py-24">
      <div className="text-center">
        <Factory className="mx-auto mb-3 h-10 w-10 text-slate-700" />
        <p className="text-sm font-medium text-slate-400">{title}</p>
        <p className="mt-1 text-xs text-slate-600">Coming soon</p>
      </div>
    </div>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export const ProductionManagerPortal = (): JSX.Element => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const location  = useLocation();

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <main className="flex h-screen w-full overflow-hidden bg-[#0b0e14] text-white">
      <div className="flex h-full w-14 shrink-0 flex-col xl:w-56">
        <ProductionSidebar />
      </div>

      <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto">
        <PageTransition>
          <Routes>
            <Route path="dashboard"          element={<ProductionManagerDashboard />} />
            <Route path="shift-coverage"     element={<ProductionShiftCoverageSection />} />
            <Route path="operators"          element={<ProductionOperatorsSection />} />
            <Route path="skills-matrix"      element={<ProductionSkillsMatrixSection />} />
            <Route path="training"           element={<ProductionTrainingSection />} />
            <Route path="compliance"         element={<ProductionComplianceSection />} />
            <Route path="risk"               element={<Placeholder title="Production Risk" />} />
            <Route path="ai-recommendations" element={<Placeholder title="AI Recommendations" />} />
            <Route path="settings"           element={<Placeholder title="Settings" />} />
            <Route path="*"                  element={<Navigate to="dashboard" replace />} />
          </Routes>
        </PageTransition>
      </div>
    </main>
  );
};
