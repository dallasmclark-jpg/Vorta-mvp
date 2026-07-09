import {
  Award,
  BookOpen,
  BriefcaseBusiness,
  Calendar,
  Cog,
  LayoutDashboard,
  Network,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PortalShell } from "../../components/PortalShell";
import type { NavItem } from "../../components/PortalShell";
import { EngineerDashboardSection } from "../EngineerDashboard";
import { MyTrainingSection } from "./MyTrainingSection";
import { MyBookingsSection } from "./MyBookingsSection";
import { MyCertificationsSection } from "./MyCertificationsSection";
import { OpportunitiesSection } from "./OpportunitiesSection";
import { AiRecommendationsSection } from "./AiRecommendationsSection";
import { MySkillsSection } from "./MySkillsSection";
import { CareerPathSection } from "./CareerPathSection";
import { ProfileSettingsSection } from "./ProfileSettingsSection";
import { GlobalMaintenanceAiAssistant } from "../AiOperations/GlobalMaintenanceAiAssistant";

const nav: NavItem[] = [
  { label: "Dashboard",          icon: LayoutDashboard,  to: "/engineer/dashboard"          },
  { label: "My Skills",          icon: Network,          to: "/engineer/skills"             },
  { label: "My Training",        icon: BookOpen,         to: "/engineer/training"           },
  { label: "My Bookings",        icon: Calendar,         to: "/engineer/bookings"           },
  { label: "My Certifications",  icon: Award,            to: "/engineer/certifications"     },
  { label: "Opportunities",      icon: BriefcaseBusiness, to: "/engineer/opportunities"     },
  { label: "AI Recommendations", icon: Sparkles,         to: "/engineer/ai-recommendations" },
  { label: "Career Path",        icon: TrendingUp,       to: "/engineer/career-path"        },
];

const secondaryNav: NavItem[] = [
  { label: "Profile Settings", icon: Cog, to: "/engineer/settings" },
];

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

export const EngineerPortal = (): JSX.Element => (
  <PortalShell homeRoute="/engineer/dashboard" nav={nav} secondaryNav={secondaryNav} accentColor="emerald">
    <Routes>
      <Route path="dashboard"          element={<EngineerDashboardSection />} />
      <Route path="skills"             element={<MySkillsSection />} />
      <Route path="training"           element={<MyTrainingSection />} />
      <Route path="bookings"           element={<MyBookingsSection />} />
      <Route path="certifications"     element={<MyCertificationsSection />} />
      <Route path="opportunities"      element={<OpportunitiesSection />} />
      <Route path="ai-recommendations" element={<AiRecommendationsSection />} />
      <Route path="career-path"        element={<CareerPathSection />} />
      <Route path="settings"           element={<ProfileSettingsSection />} />
      <Route path="*"                  element={<Navigate to="dashboard" replace />} />
    </Routes>
    <GlobalMaintenanceAiAssistant role="engineer" />
  </PortalShell>
);
