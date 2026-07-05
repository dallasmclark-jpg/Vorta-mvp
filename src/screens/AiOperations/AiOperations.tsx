import { Navigate, Route, Routes } from "react-router-dom";
import { PortalShell } from "../../components/PortalShell";
import type { NavGroup } from "../../components/PortalShell";
import {
  Building2,
  ClipboardList,
  Cog,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  Network,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { DashboardOverviewSection } from "./sections/DashboardOverviewSection";
import { SkillsMatrixSection } from "../SkillsMatrix";
import { EngineersSection } from "../Engineers";
import { RequirementsSection } from "../Requirements";
import { TrainingSection } from "../Training";
import { TrainingProvidersSection } from "../TrainingProviders";
import { AiMatchingSection } from "../AiMatching";
import { SettingsSection } from "../Settings";
import { EquipmentSection, EquipmentOverview, EquipmentHealth, EquipmentWorkOrders, EquipmentPMs, EquipmentHistory, EquipmentSkills, EquipmentSpares } from "../Equipment";
import { SupportSection } from "../Support";
import { DesignSystemSection } from "../DesignSystem";

const nav: NavGroup[] = [
  {
    groupLabel: "Overview",
    items: [
      { label: "Dashboard",    icon: LayoutDashboard, to: "/dashboard"    },
      { label: "Equipment",    icon: Wrench,          to: "/equipment"    },
      { label: "AI Matching",  icon: Sparkles,        to: "/ai-matching"  },
    ],
  },
  {
    groupLabel: "Workforce",
    items: [
      { label: "Skills Matrix", icon: Network,       to: "/skills-matrix" },
      { label: "Engineers",     icon: Users,         to: "/engineers"     },
      { label: "Requirements",  icon: ClipboardList, to: "/requirements"  },
    ],
  },
  {
    groupLabel: "Training",
    items: [
      { label: "Bookings",  icon: GraduationCap, to: "/training"           },
      { label: "Providers", icon: Building2,     to: "/training-providers" },
    ],
  },
];

const secondaryNav = [
  { label: "Support",  icon: Headphones, to: "/support"  },
  { label: "Settings", icon: Cog,        to: "/settings" },
];

export const AiOperations = (): JSX.Element => (
  <PortalShell homeRoute="/dashboard" nav={nav} secondaryNav={secondaryNav} accentColor="blue">
    <Routes>
      <Route path="dashboard"          element={<DashboardOverviewSection />} />
      <Route path="skills-matrix"      element={<SkillsMatrixSection />} />
      <Route path="engineers"          element={<EngineersSection />} />
      <Route path="requirements"       element={<RequirementsSection />} />
      <Route path="training"           element={<TrainingSection />} />
      <Route path="training-providers" element={<TrainingProvidersSection />} />
      <Route path="ai-matching"        element={<AiMatchingSection />} />
      <Route path="settings"           element={<SettingsSection />} />
      <Route path="equipment"          element={<EquipmentSection />} />
      <Route path="equipment/:equipmentId/overview"     element={<EquipmentOverview />} />
      <Route path="equipment/:equipmentId/health"       element={<EquipmentHealth />} />
      <Route path="equipment/:equipmentId/work-orders"  element={<EquipmentWorkOrders />} />
      <Route path="equipment/:equipmentId/pms"          element={<EquipmentPMs />} />
      <Route path="equipment/:equipmentId/history"      element={<EquipmentHistory />} />
      <Route path="equipment/:equipmentId/skills"       element={<EquipmentSkills />} />
      <Route path="equipment/:equipmentId/spares"       element={<EquipmentSpares />} />
      <Route path="support"            element={<SupportSection />} />
      <Route path="design-system"      element={<DesignSystemSection />} />
      <Route path="*"                  element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </PortalShell>
);
