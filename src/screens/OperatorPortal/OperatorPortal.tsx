import {
  Activity,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Cog,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { VortaLogo, VortaIcon } from "../../components/VortaLogo";
import { supabase } from "../../lib/supabaseClient";
import { PageTransition } from "../../components/PageTransition";
import { OperatorDashboardSection } from "./OperatorDashboardSection";
import { OperatorMyShiftSection } from "./OperatorMyShiftSection";
import { OperatorMySkillsSection } from "./OperatorMySkillsSection";
import { OperatorTrainingSection } from "./OperatorTrainingSection";
import { OperatorComplianceSection } from "./OperatorComplianceSection";
import { OperatorTasksSection } from "./OperatorTasksSection";
import { OperatorAiGuidanceSection } from "./OperatorAiGuidanceSection";
import { OperatorKnowledgeBaseSection } from "./OperatorKnowledgeBaseSection";
import { OperatorProfileSettingsSection } from "./OperatorProfileSettingsSection";

// ─── Nav config ───────────────────────────────────────────────────────────────

const primaryNav = [
  { label: "Dashboard",       icon: LayoutDashboard, to: "/operator/dashboard"  },
  { label: "My Shift",        icon: Activity,        to: "/operator/shift"      },
  { label: "My Skills",       icon: CheckCircle2,    to: "/operator/skills"     },
  { label: "Training",        icon: GraduationCap,   to: "/operator/training"   },
  { label: "Compliance",      icon: ShieldCheck,     to: "/operator/compliance" },
  { label: "Tasks",           icon: ClipboardList,   to: "/operator/tasks"      },
  { label: "AI Guidance",     icon: Sparkles,        to: "/operator/ai-guidance"},
  { label: "Knowledge Base",  icon: BookOpen,        to: "/operator/knowledge"  },
];

const secondaryNav = [
  { label: "Profile Settings", icon: Cog, to: "/operator/settings" },
];

// ─── Shared sidebar style tokens (matches existing portals) ───────────────────

const labelBase = "font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] [font-style:var(--text-sm-medium-font-style)]";
const itemBase  = "flex h-auto w-full items-center gap-3 rounded-lg py-2.5 px-2 text-sm transition-colors hover:bg-[#10b98115] justify-center xl:justify-start xl:px-3";
const labelCls  = "hidden xl:block";

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function OperatorSidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="relative flex h-full w-full flex-col border-r border-gray-800 bg-[#090b10] px-2 py-5 xl:px-4">
      <header className="flex h-10 items-center justify-center xl:justify-start xl:px-2">
        <NavLink to="/operator/dashboard" aria-label="Vorta home" className="inline-flex items-center overflow-hidden">
          <span className="hidden xl:block"><VortaLogo /></span>
          <span className="block xl:hidden"><VortaIcon /></span>
        </NavLink>
      </header>

      <nav aria-label="Operator primary" className="mt-4 flex flex-col gap-1">
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

      <nav aria-label="Operator secondary" className="mt-6 flex flex-1 flex-col justify-between">
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

// ─── Placeholder for unbuilt pages ────────────────────────────────────────────

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

// ─── Shell ────────────────────────────────────────────────────────────────────

export const OperatorPortal = (): JSX.Element => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const location  = useLocation();

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <main className="flex h-screen w-full overflow-hidden bg-[#0b0e14] text-white">
      {/* Sidebar */}
      <div className="flex h-full w-14 shrink-0 flex-col xl:w-56">
        <OperatorSidebar />
      </div>

      {/* Content */}
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto">
        <PageTransition>
          <Routes>
            <Route path="dashboard"  element={<OperatorDashboardSection />} />
            <Route path="shift"      element={<OperatorMyShiftSection />} />
            <Route path="skills"     element={<OperatorMySkillsSection />} />
            <Route path="training"   element={<OperatorTrainingSection />} />
            <Route path="compliance" element={<OperatorComplianceSection />} />
            <Route path="tasks"      element={<OperatorTasksSection />} />
            <Route path="ai-guidance"element={<OperatorAiGuidanceSection />} />
            <Route path="knowledge"  element={<OperatorKnowledgeBaseSection />} />
            <Route path="settings"   element={<OperatorProfileSettingsSection />} />
            <Route path="*"          element={<Navigate to="dashboard" replace />} />
          </Routes>
        </PageTransition>
      </div>
    </main>
  );
};
