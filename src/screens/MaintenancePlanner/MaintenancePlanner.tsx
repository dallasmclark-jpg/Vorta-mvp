import { Navigate, Route, Routes } from "react-router-dom";
import { PortalShell } from "../../components/PortalShell";
import type { NavGroup } from "../../components/PortalShell";
import { Cog, Headphones, LayoutDashboard } from "lucide-react";
import { PlannerDashboardSection } from "./PlannerDashboardSection";
import { SupportSection } from "../Support";
import { SettingsSection } from "../Settings";

const nav: NavGroup[] = [
  {
    groupLabel: "Planning",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/planner-dashboard" },
    ],
  },
];

const secondaryNav = [
  { label: "Support",  icon: Headphones, to: "/support"  },
  { label: "Settings", icon: Cog,        to: "/settings" },
];

export const MaintenancePlanner = (): JSX.Element => (
  <PortalShell homeRoute="/planner-dashboard" nav={nav} secondaryNav={secondaryNav} accentColor="blue">
    <Routes>
      <Route index element={<Navigate to="planner-dashboard" replace />} />
      <Route path="planner-dashboard" element={<PlannerDashboardSection />} />
      <Route path="support"           element={<SupportSection />} />
      <Route path="settings"          element={<SettingsSection />} />
      <Route path="*"                 element={<Navigate to="planner-dashboard" replace />} />
    </Routes>
  </PortalShell>
);
