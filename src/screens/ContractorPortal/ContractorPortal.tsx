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
import { PrototypePortalUnavailable } from "../../components/PrototypePortalUnavailable";
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

function Unavailable({ capability }: { capability: string }): JSX.Element {
  return (
    <PrototypePortalUnavailable
      portalName="Contractor"
      capability={capability}
    />
  );
}

export const ContractorPortal = (): JSX.Element => (
  <PortalShell homeRoute="/contractor/dashboard" nav={nav} secondaryNav={secondaryNav} accentColor="blue">
    <Routes>
      <Route path="dashboard"          element={<Unavailable capability="Contractor Dashboard" />} />
      <Route path="company-profile"    element={<Unavailable capability="Company Profile" />} />
      <Route path="engineers"          element={<Unavailable capability="Engineers" />} />
      <Route path="availability"       element={<Unavailable capability="Availability" />} />
      <Route path="opportunities"      element={<Unavailable capability="Opportunities" />} />
      <Route path="assignments"        element={<Unavailable capability="Assignments" />} />
      <Route path="job-reports"        element={<Unavailable capability="Job Reports" />} />
      <Route path="timesheets"         element={<Unavailable capability="Timesheets" />} />
      <Route path="invoices"           element={<Unavailable capability="Invoices" />} />
      <Route path="compliance"         element={<Unavailable capability="Compliance" />} />
      <Route path="ai-recommendations" element={<Unavailable capability="AI Recommendations" />} />
      <Route path="settings"           element={<Unavailable capability="Settings" />} />
      <Route path="*"                  element={<Navigate to="dashboard" replace />} />
    </Routes>
    <GlobalMaintenanceAiAssistant role="contractor" />
  </PortalShell>
);
