import {
  BarChart2,
  Cog,
  Factory,
  GraduationCap,
  LayoutDashboard,
  ShieldAlert,
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
    groupLabel: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/production/dashboard" },
    ],
  },
  {
    groupLabel: "Workforce",
    items: [
      { label: "Shift Coverage", icon: Users,     to: "/production/shift-coverage" },
      { label: "Operators",      icon: Factory,   to: "/production/operators"      },
      { label: "Skills Matrix",  icon: BarChart2, to: "/production/skills-matrix"  },
    ],
  },
  {
    groupLabel: "Operations",
    items: [
      { label: "Training & Competency", icon: GraduationCap, to: "/production/training"   },
      { label: "Compliance",            icon: ShieldCheck,   to: "/production/compliance" },
      { label: "Production Risk",       icon: ShieldAlert,   to: "/production/risk"       },
    ],
  },
  {
    groupLabel: "Intelligence",
    items: [
      { label: "AI Improvements", icon: Sparkles, to: "/production/ai-recommendations" },
    ],
  },
];

const secondaryNav: NavItem[] = [
  { label: "Settings", icon: Cog, to: "/production/settings" },
];

function Unavailable({ capability }: { capability: string }): JSX.Element {
  return (
    <PrototypePortalUnavailable
      portalName="Production Manager"
      capability={capability}
    />
  );
}

export const ProductionManagerPortal = (): JSX.Element => (
  <PortalShell homeRoute="/production/dashboard" nav={nav} secondaryNav={secondaryNav} accentColor="blue">
    <Routes>
      <Route path="dashboard"          element={<Unavailable capability="Production Manager Dashboard" />} />
      <Route path="shift-coverage"     element={<Unavailable capability="Shift Coverage" />} />
      <Route path="operators"          element={<Unavailable capability="Operators" />} />
      <Route path="skills-matrix"      element={<Unavailable capability="Skills Matrix" />} />
      <Route path="training"           element={<Unavailable capability="Training & Competency" />} />
      <Route path="compliance"         element={<Unavailable capability="Compliance" />} />
      <Route path="risk"               element={<Unavailable capability="Production Risk" />} />
      <Route path="ai-recommendations" element={<Unavailable capability="AI Improvements" />} />
      <Route path="settings"           element={<Unavailable capability="Settings" />} />
      <Route path="*"                  element={<Navigate to="dashboard" replace />} />
    </Routes>
    <GlobalMaintenanceAiAssistant role="production-manager" />
  </PortalShell>
);
