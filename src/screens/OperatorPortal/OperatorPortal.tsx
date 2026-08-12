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
import { PrototypePortalUnavailable } from "../../components/PrototypePortalUnavailable";
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

function Unavailable({ capability }: { capability: string }): JSX.Element {
  return (
    <PrototypePortalUnavailable
      portalName="Operator"
      capability={capability}
    />
  );
}

export const OperatorPortal = (): JSX.Element => (
  <PortalShell homeRoute="/operator/dashboard" nav={nav} secondaryNav={secondaryNav} accentColor="emerald">
    <Routes>
      <Route path="dashboard"    element={<Unavailable capability="Operator Dashboard" />} />
      <Route path="shift"        element={<Unavailable capability="My Shift" />} />
      <Route path="skills"       element={<Unavailable capability="My Skills" />} />
      <Route path="training"     element={<Unavailable capability="Training" />} />
      <Route path="compliance"   element={<Unavailable capability="Compliance" />} />
      <Route path="tasks"        element={<Unavailable capability="Tasks" />} />
      <Route path="ai-guidance"  element={<Unavailable capability="AI Guidance" />} />
      <Route path="knowledge"    element={<Unavailable capability="Knowledge Base" />} />
      <Route path="settings"     element={<Unavailable capability="Profile Settings" />} />
      <Route path="*"            element={<Navigate to="dashboard" replace />} />
    </Routes>
    <GlobalMaintenanceAiAssistant role="operator" />
  </PortalShell>
);
