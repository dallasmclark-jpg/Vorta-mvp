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
import { ProductionManagerDashboard } from "./ProductionManagerDashboard";
import { ProductionSkillsMatrixSection } from "./ProductionSkillsMatrixSection";
import { ProductionShiftCoverageSection } from "./ProductionShiftCoverageSection";
import { ProductionTrainingSection } from "./ProductionTrainingSection";
import { ProductionOperatorsSection } from "./ProductionOperatorsSection";
import { ProductionComplianceSection } from "./ProductionComplianceSection";
import { ProductionRiskSection } from "./ProductionRiskSection";
import { ProductionAiImprovementsSection } from "./ProductionAiImprovementsSection";
import { ProductionSettingsSection } from "./ProductionSettingsSection";
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

export const ProductionManagerPortal = (): JSX.Element => (
  <PortalShell homeRoute="/production/dashboard" nav={nav} secondaryNav={secondaryNav} accentColor="blue">
    <Routes>
      <Route path="dashboard"          element={<ProductionManagerDashboard />} />
      <Route path="shift-coverage"     element={<ProductionShiftCoverageSection />} />
      <Route path="operators"          element={<ProductionOperatorsSection />} />
      <Route path="skills-matrix"      element={<ProductionSkillsMatrixSection />} />
      <Route path="training"           element={<ProductionTrainingSection />} />
      <Route path="compliance"         element={<ProductionComplianceSection />} />
      <Route path="risk"               element={<ProductionRiskSection />} />
      <Route path="ai-recommendations" element={<ProductionAiImprovementsSection />} />
      <Route path="settings"           element={<ProductionSettingsSection />} />
      <Route path="*"                  element={<Navigate to="dashboard" replace />} />
    </Routes>
    <GlobalMaintenanceAiAssistant role="production-manager" />
  </PortalShell>
);
