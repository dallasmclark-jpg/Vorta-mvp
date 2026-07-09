import {
  BarChart2,
  BookOpen,
  Briefcase,
  Building2,
  ClipboardList,
  Cog,
  FileText,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PortalShell } from "../../components/PortalShell";
import type { NavGroup, NavItem } from "../../components/PortalShell";
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
import { ContractorSettingsSection } from "./ContractorSettingsSection";
import { GlobalMaintenanceAiAssistant } from "../AiOperations/GlobalMaintenanceAiAssistant";

const nav: NavGroup[] = [
  {
    groupLabel: "Work",
    items: [
      { label: "Dashboard",     icon: LayoutDashboard, to: "/contractor/dashboard"     },
      { label: "Opportunities", icon: Briefcase,       to: "/contractor/opportunities" },
      { label: "Assignments",   icon: ClipboardList,   to: "/contractor/assignments"   },
      { label: "Availability",  icon: BookOpen,        to: "/contractor/availability"  },
    ],
  },
  {
    groupLabel: "Operations",
    items: [
      { label: "Job Reports", icon: BarChart2, to: "/contractor/job-reports" },
      { label: "Timesheets",  icon: FileText,  to: "/contractor/timesheets"  },
      { label: "Invoices",    icon: Receipt,   to: "/contractor/invoices"    },
    ],
  },
  {
    groupLabel: "Business",
    items: [
      { label: "Engineers",       icon: Users,       to: "/contractor/engineers"       },
      { label: "Company Profile", icon: Building2,   to: "/contractor/company-profile" },
      { label: "Compliance",      icon: ShieldCheck, to: "/contractor/compliance"      },
    ],
  },
  {
    groupLabel: "Intelligence",
    items: [
      { label: "AI Recommendations", icon: Sparkles, to: "/contractor/ai-recommendations" },
    ],
  },
];

const secondaryNav: NavItem[] = [
  { label: "Settings", icon: Cog, to: "/contractor/settings" },
];

export const ContractorPortal = (): JSX.Element => (
  <PortalShell homeRoute="/contractor/dashboard" nav={nav} secondaryNav={secondaryNav} accentColor="blue">
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
      <Route path="settings"           element={<ContractorSettingsSection />} />
      <Route path="*"                  element={<Navigate to="dashboard" replace />} />
    </Routes>
    <GlobalMaintenanceAiAssistant role="contractor" />
  </PortalShell>
);
