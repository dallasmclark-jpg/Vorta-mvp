import {
  BarChart2,
  BookOpen,
  Briefcase,
  Building2,
  ClipboardList,
  Cog,
  FileText,
  LayoutDashboard,
  LogOut,
  Receipt,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { VortaLogo } from "../../components/VortaLogo";
import { supabase } from "../../lib/supabaseClient";
import { ContractorDashboardSection } from "./ContractorDashboardSection";
import { CompanyProfileSection } from "./CompanyProfileSection";
import { ContractorEngineersSection } from "./ContractorEngineersSection";
import { ContractorAvailabilitySection } from "./ContractorAvailabilitySection";
import { ContractorOpportunitiesSection } from "./ContractorOpportunitiesSection";
import { ContractorAssignmentsSection } from "./ContractorAssignmentsSection";
import { ContractorJobReportsSection } from "./ContractorJobReportsSection";
import { ContractorTimesheetsSection } from "./ContractorTimesheetsSection";
import { ContractorInvoicesSection } from "./ContractorInvoicesSection";
import { ContractorComplianceSection } from "./ContractorComplianceSection";
import { ContractorAiRecommendationsSection } from "./ContractorAiRecommendationsSection";

// ─── Nav config ──────────────────────────────────────────────────────────────

const primaryNav = [
  { label: "Dashboard",          icon: LayoutDashboard, to: "/contractor/dashboard"          },
  { label: "Company Profile",    icon: Building2,       to: "/contractor/company-profile"    },
  { label: "Engineers",          icon: Users,           to: "/contractor/engineers"          },
  { label: "Availability",       icon: BookOpen,        to: "/contractor/availability"       },
  { label: "Opportunities",      icon: Briefcase,       to: "/contractor/opportunities"      },
  { label: "Assignments",        icon: ClipboardList,   to: "/contractor/assignments"        },
  { label: "Job Reports",        icon: BarChart2,       to: "/contractor/job-reports"        },
  { label: "Timesheets",         icon: FileText,        to: "/contractor/timesheets"         },
  { label: "Invoices",           icon: Receipt,         to: "/contractor/invoices"           },
  { label: "Compliance",         icon: ShieldCheck,     to: "/contractor/compliance"         },
  { label: "AI Recommendations", icon: Sparkles,        to: "/contractor/ai-recommendations" },
];

const secondaryNav = [
  { label: "Settings", icon: Cog, to: "/contractor/settings" },
];

// ─── Style tokens ─────────────────────────────────────────────────────────────

const labelBase = "font-text-sm-medium text-[length:var(--text-sm-medium-font-size)] font-[number:var(--text-sm-medium-font-weight)] leading-[var(--text-sm-medium-line-height)] tracking-[var(--text-sm-medium-letter-spacing)] [font-style:var(--text-sm-medium-font-style)]";
const itemBase = "flex h-auto w-full items-center gap-3 rounded-lg py-2.5 px-2 text-sm transition-colors hover:bg-[#3b82f615] justify-center xl:justify-start xl:px-3";
const labelCls = "hidden xl:block";

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function ContractorSidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="relative flex h-full w-full flex-col border-r border-gray-800 bg-[#090b10] px-2 py-5 xl:px-4">
      <header className="flex h-10 items-center justify-center xl:justify-start xl:px-2">
        <NavLink to="/contractor/dashboard" aria-label="Vorta home" className="inline-flex items-center overflow-hidden">
          <span className="hidden xl:block"><VortaLogo /></span>
          <span className="block select-none font-mono text-sm font-bold text-white xl:hidden">&gt;&lt;</span>
        </NavLink>
      </header>

      <nav aria-label="Contractor primary" className="mt-4 flex flex-col gap-1">
        {primaryNav.map(({ label, icon: Icon, to }) => (
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
      </nav>

      <nav aria-label="Contractor secondary" className="mt-6 flex flex-1 flex-col justify-between">
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
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center">
        <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-700" />
        <p className="text-sm font-medium text-slate-400">{title}</p>
        <p className="mt-1 text-xs text-slate-600">Coming soon</p>
      </div>
    </div>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export const ContractorPortal = (): JSX.Element => (
  <main className="flex h-screen w-full overflow-hidden bg-[#0b0e14] text-white">
    <div className="flex h-full w-14 shrink-0 flex-col xl:w-56">
      <ContractorSidebar />
    </div>

    <div className="min-w-0 flex-1 overflow-y-auto">
      <Routes>
        <Route path="dashboard"          element={<ContractorDashboardSection />} />
        <Route path="company-profile"    element={<CompanyProfileSection />} />
        <Route path="engineers"          element={<ContractorEngineersSection />} />
        <Route path="availability"       element={<ContractorAvailabilitySection />} />
        <Route path="opportunities"      element={<ContractorOpportunitiesSection />} />
        <Route path="assignments"        element={<ContractorAssignmentsSection />} />
        <Route path="job-reports"        element={<ContractorJobReportsSection />} />
        <Route path="timesheets"         element={<ContractorTimesheetsSection />} />
        <Route path="invoices"           element={<ContractorInvoicesSection />} />
        <Route path="compliance"         element={<ContractorComplianceSection />} />
        <Route path="ai-recommendations" element={<ContractorAiRecommendationsSection />} />
        <Route path="settings"           element={<Placeholder title="Settings" />} />
        <Route path="*"                  element={<Navigate to="dashboard" replace />} />
      </Routes>
    </div>
  </main>
);
