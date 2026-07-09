import {
  Activity,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Cog,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PortalShell } from "../../components/PortalShell";
import type { NavItem } from "../../components/PortalShell";
import { OperatorDashboardSection } from "./OperatorDashboardSection";
import { OperatorMyShiftSection } from "./OperatorMyShiftSection";
import { OperatorMySkillsSection } from "./OperatorMySkillsSection";
import { OperatorTrainingSection } from "./OperatorTrainingSection";
import { OperatorComplianceSection } from "./OperatorComplianceSection";
import { OperatorTasksSection } from "./OperatorTasksSection";
import { OperatorAiGuidanceSection } from "./OperatorAiGuidanceSection";
import { OperatorKnowledgeBaseSection } from "./OperatorKnowledgeBaseSection";
import { OperatorProfileSettingsSection } from "./OperatorProfileSettingsSection";
import { GlobalMaintenanceAiAssistant } from "../AiOperations/GlobalMaintenanceAiAssistant";

const nav: NavItem[] = [
  { label: "Dashboard",      icon: LayoutDashboard, to: "/operator/dashboard"  },
  { label: "My Shift",       icon: Activity,        to: "/operator/shift"      },
  { label: "My Skills",      icon: CheckCircle2,    to: "/operator/skills"     },
  { label: "Training",       icon: GraduationCap,   to: "/operator/training"   },
  { label: "Compliance",     icon: ShieldCheck,     to: "/operator/compliance" },
  { label: "Tasks",          icon: ClipboardList,   to: "/operator/tasks"      },
  { label: "AI Guidance",    icon: Sparkles,        to: "/operator/ai-guidance"},
  { label: "Knowledge Base", icon: BookOpen,        to: "/operator/knowledge"  },
];

const secondaryNav: NavItem[] = [
  { label: "Profile Settings", icon: Cog, to: "/operator/settings" },
];

export const OperatorPortal = (): JSX.Element => (
  <PortalShell homeRoute="/operator/dashboard" nav={nav} secondaryNav={secondaryNav} accentColor="emerald">
    <Routes>
      <Route path="dashboard"  element={<OperatorDashboardSection />} />
      <Route path="shift"      element={<OperatorMyShiftSection />} />
      <Route path="skills"     element={<OperatorMySkillsSection />} />
      <Route path="training"   element={<OperatorTrainingSection />} />
      <Route path="compliance" element={<OperatorComplianceSection />} />
      <Route path="tasks"      element={<OperatorTasksSection />} />
      <Route path="ai-guidance" element={<OperatorAiGuidanceSection />} />
      <Route path="knowledge"  element={<OperatorKnowledgeBaseSection />} />
      <Route path="settings"   element={<OperatorProfileSettingsSection />} />
      <Route path="*"          element={<Navigate to="dashboard" replace />} />
    </Routes>
    <GlobalMaintenanceAiAssistant role="operator" />
  </PortalShell>
);
